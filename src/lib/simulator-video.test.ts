import { afterEach, describe, expect, it, vi } from 'vitest';
import { IMAGE_ANIMATION_SECONDS, IMAGE_FORMATS, IMAGE_MOVING_SECONDS, type ImageInput } from './simulator-image';
import { VIDEO_FPS, VIDEO_KEYFRAME_INTERVAL } from './simulator-video-config';

const drawMock = vi.fn();

vi.mock('./simulator-image', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./simulator-image')>();
  return {
    ...actual,
    drawSimulatorImage: (...args: unknown[]) => drawMock(...args),
  };
});

import { makeSimulatorVideo } from './simulator-video';

const SAMPLE_AVCC = new Uint8Array([
  0x01, 0x4d, 0x40, 0x28, 0xff, 0xe1, 0x00, 0x04, 0x67, 0x4d, 0x40, 0x28, 0x01, 0x00, 0x02, 0x68, 0xee,
]);

const SAMPLE_INPUT: ImageInput = {
  content: 'seats',
  format: 'wide',
  theme: 'light',
  title: 'Mi Congreso',
  kicker: 'Congreso · 29N',
  parties: [{ acronym: 'A', color: '#ff0000', seats: 180, vote: 'yes' }],
  voteColors: { yes: '#00ff00', no: '#ff0000', abstain: '#ffff00' },
  brand: 'Electosfera',
  address: 'electosfera.es/simulador',
};

const findBoxOffset = (bytes: Uint8Array, box: string) => {
  const needle = [...box].map((char) => char.charCodeAt(0));
  for (let i = 0; i <= bytes.length - 4; i += 1) {
    if (bytes[i] === needle[0] && bytes[i + 1] === needle[1] && bytes[i + 2] === needle[2] && bytes[i + 3] === needle[3]) {
      return i;
    }
  }
  return -1;
};

describe('makeSimulatorVideo', () => {
  afterEach(() => {
    drawMock.mockReset();
    vi.unstubAllGlobals();
  });

  it('produces a non-fragmented faststart MP4 with exact CFR frames and closes every VideoFrame', async () => {
    const encodedFrames: { timestamp: number; duration: number; keyFrame: boolean }[] = [];
    let closedFrames = 0;
    let encoderClosed = false;

    class FakeVideoFrame {
      timestamp: number;
      duration: number;
      constructor(_source: unknown, init: { timestamp: number; duration: number }) {
        this.timestamp = init.timestamp;
        this.duration = init.duration;
      }
      close() {
        closedFrames += 1;
      }
    }

    class FakeEncodedVideoChunk {
      type: EncodedVideoChunkType;
      timestamp: number;
      duration: number;
      byteLength: number;
      private payload: Uint8Array;
      constructor(type: EncodedVideoChunkType, timestamp: number, duration: number, payload: Uint8Array) {
        this.type = type;
        this.timestamp = timestamp;
        this.duration = duration;
        this.payload = payload;
        this.byteLength = payload.byteLength;
      }
      copyTo(dest: BufferSource) {
        const view = dest instanceof ArrayBuffer ? new Uint8Array(dest) : new Uint8Array(dest.buffer, dest.byteOffset, dest.byteLength);
        view.set(this.payload);
      }
    }

    class FakeVideoEncoder {
      static isConfigSupported = vi.fn(async (config: VideoEncoderConfig) => ({ supported: true, config }));
      state: CodecState = 'unconfigured';
      encodeQueueSize = 0;
      private output: EncodedVideoChunkOutputCallback;
      private configured?: VideoEncoderConfig;
      constructor(init: VideoEncoderInit) {
        this.output = init.output;
      }
      configure(config: VideoEncoderConfig) {
        this.state = 'configured';
        this.configured = config;
      }
      encode(frame: FakeVideoFrame, options?: VideoEncoderEncodeOptions) {
        const keyFrame = !!options?.keyFrame;
        encodedFrames.push({ timestamp: frame.timestamp, duration: frame.duration, keyFrame });
        const payload = new Uint8Array([0x00, 0x00, 0x00, 0x02, keyFrame ? 0x65 : 0x41, 0x00]);
        const chunk = new FakeEncodedVideoChunk(
          keyFrame ? 'key' : 'delta',
          frame.timestamp,
          frame.duration,
          payload,
        ) as unknown as EncodedVideoChunk;
        const meta: EncodedVideoChunkMetadata =
          encodedFrames.length === 1
            ? {
                decoderConfig: {
                  codec: this.configured!.codec,
                  codedWidth: this.configured!.width,
                  codedHeight: this.configured!.height,
                  description: SAMPLE_AVCC,
                },
              }
            : {};
        this.output(chunk, meta);
      }
      async flush() {}
      close() {
        this.state = 'closed';
        encoderClosed = true;
      }
      addEventListener() {}
      removeEventListener() {}
    }

    vi.stubGlobal('EncodedVideoChunk', FakeEncodedVideoChunk);
    vi.stubGlobal('VideoFrame', FakeVideoFrame);
    vi.stubGlobal('VideoEncoder', FakeVideoEncoder);

    const progress: number[] = [];
    const canvas = { width: IMAGE_FORMATS.wide.width, height: IMAGE_FORMATS.wide.height } as HTMLCanvasElement;
    const blob = await makeSimulatorVideo(canvas, SAMPLE_INPUT, (share) => progress.push(share));

    expect(blob).not.toBeNull();
    expect(blob!.type).toBe('video/mp4');
    expect(encoderClosed).toBe(true);

    const expectedFrames = Math.round(IMAGE_ANIMATION_SECONDS * VIDEO_FPS);
    expect(encodedFrames).toHaveLength(expectedFrames);
    expect(closedFrames).toBe(expectedFrames);
    expect(encodedFrames[0].keyFrame).toBe(true);
    expect(encodedFrames[VIDEO_KEYFRAME_INTERVAL].keyFrame).toBe(true);
    expect(encodedFrames[1].keyFrame).toBe(false);
    expect(progress.at(-1)).toBe(1);

    // Hold frames reuse one final canvas draw instead of redrawing identical frames.
    const movingFrames = Math.ceil(IMAGE_MOVING_SECONDS * VIDEO_FPS);
    expect(drawMock.mock.calls.length).toBeLessThanOrEqual(movingFrames + 1);

    // Standard non-fragmented faststart MP4: ftyp -> moov -> mdat, with no moof fragments.
    const bytes = new Uint8Array(await blob!.arrayBuffer());
    const ftyp = findBoxOffset(bytes, 'ftyp');
    const moov = findBoxOffset(bytes, 'moov');
    const mdat = findBoxOffset(bytes, 'mdat');
    const moof = findBoxOffset(bytes, 'moof');
    expect(ftyp).toBeGreaterThanOrEqual(0);
    expect(moov).toBeGreaterThan(ftyp);
    expect(mdat).toBeGreaterThan(moov);
    expect(moof).toBe(-1);
  });

  it('stops cleanly and closes the encoder when cancelled', async () => {
    let closed = false;
    class FakeVideoFrame {
      close() {}
    }
    class FakeVideoEncoder {
      static isConfigSupported = vi.fn(async (config: VideoEncoderConfig) => ({ supported: true, config }));
      state: CodecState = 'unconfigured';
      encodeQueueSize = 0;
      configure() {
        this.state = 'configured';
      }
      encode() {}
      async flush() {}
      close() {
        this.state = 'closed';
        closed = true;
      }
      addEventListener() {}
      removeEventListener() {}
    }

    vi.stubGlobal('VideoFrame', FakeVideoFrame);
    vi.stubGlobal('VideoEncoder', FakeVideoEncoder);

    let calls = 0;
    const canvas = { width: 1280, height: 720 } as HTMLCanvasElement;
    const blob = await makeSimulatorVideo(
      canvas,
      SAMPLE_INPUT,
      () => {},
      () => ++calls > 3,
    );

    expect(blob).toBeNull();
    expect(closed).toBe(true);
  });
});

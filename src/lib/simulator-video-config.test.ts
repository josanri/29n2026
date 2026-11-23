import { afterEach, describe, expect, it, vi } from 'vitest';
import { IMAGE_FORMATS } from './simulator-image';
import {
  MEDIA_RECORDER_TYPES,
  VIDEO_FPS,
  WEBCODECS_H264_CODECS,
  pickMediaRecorderType,
  pickWebCodecsConfig,
  videoBitrateFor,
} from './simulator-video-config';

describe('simulator video export configuration', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses even width and even height for every simulator format', () => {
    for (const format of Object.values(IMAGE_FORMATS)) {
      expect(format.width % 2).toBe(0);
      expect(format.height % 2).toBe(0);
    }
    expect(IMAGE_FORMATS.wide.width).toBe(1280);
    expect(IMAGE_FORMATS.wide.height).toBe(720);
  });

  it('scales target VBR bitrate by resolution between 3 Mbps and 5.5 Mbps', () => {
    expect(videoBitrateFor(1280, 720)).toBe(3_000_000);
    expect(videoBitrateFor(1080, 1080)).toBeGreaterThan(3_000_000);
    expect(videoBitrateFor(1080, 1080)).toBeLessThan(4_000_000);
    expect(videoBitrateFor(1080, 1920)).toBe(5_500_000);
  });

  it('uses H.264 Level 4.0 or higher in every explicit codec string', () => {
    const explicit = [...WEBCODECS_H264_CODECS, ...MEDIA_RECORDER_TYPES]
      .map((entry) => /avc1\.[0-9A-Fa-f]{6}/.exec(entry)?.[0])
      .filter((codec): codec is string => !!codec);
    expect(explicit.length).toBeGreaterThan(0);
    for (const codec of explicit) {
      const level = parseInt(codec.slice(-2), 16);
      expect(level).toBeGreaterThanOrEqual(0x28);
    }
  });

  it('prefers quality latency mode and variable bitrate for WebCodecs H.264', async () => {
    const isConfigSupported = vi.fn(async (config: VideoEncoderConfig) => ({
      supported: config.codec === 'avc1.640028' && config.latencyMode === 'quality' && config.bitrateMode === 'variable',
      config,
    }));
    vi.stubGlobal('VideoEncoder', Object.assign(function VideoEncoder() {}, { isConfigSupported }));
    vi.stubGlobal('VideoFrame', function VideoFrame() {});

    const selected = await pickWebCodecsConfig(1280, 720);
    expect(selected).toMatchObject({
      codec: 'avc1.640028',
      width: 1280,
      height: 720,
      framerate: VIDEO_FPS,
      latencyMode: 'quality',
      bitrateMode: 'variable',
      avc: { format: 'avc' },
    });
  });

  it('returns null when WebCodecs is unavailable or rejects every H.264 config', async () => {
    vi.stubGlobal('VideoEncoder', undefined);
    vi.stubGlobal('VideoFrame', undefined);
    expect(await pickWebCodecsConfig(1280, 720)).toBeNull();

    vi.stubGlobal('VideoEncoder', Object.assign(function VideoEncoder() {}, { isConfigSupported: vi.fn(async () => ({ supported: false })) }));
    vi.stubGlobal('VideoFrame', function VideoFrame() {});
    expect(await pickWebCodecsConfig(1280, 720)).toBeNull();
  });

  it('prefers H.264 MP4 before WebM in the MediaRecorder backup list', () => {
    vi.stubGlobal(
      'MediaRecorder',
      Object.assign(function MediaRecorder() {}, {
        isTypeSupported: (type: string) => type === 'video/mp4;codecs=avc1.4D4028' || type === 'video/webm',
      }),
    );
    expect(pickMediaRecorderType()).toBe('video/mp4;codecs=avc1.4D4028');
  });
});

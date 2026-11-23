/**
 * Offline MP4 video generator for the simulator using WebCodecs (`VideoEncoder`) and `mp4-muxer`.
 * Draws every frame deterministically at a constant 30 fps and writes a standard non-fragmented
 * H.264 MP4 with `fastStart` (`moov` at the front), so WhatsApp, Instagram, Telegram, X, iOS and
 * desktop players play and share it cleanly at high sharpness and small file size.
 * The page loads this module only when the reader asks for a video.
 */
import { ArrayBufferTarget, Muxer } from 'mp4-muxer';
import {
  IMAGE_ANIMATION_SECONDS,
  IMAGE_FORMATS,
  IMAGE_MOVING_SECONDS,
  drawSimulatorImage,
  type ImageInput,
} from './simulator-image';
import { VIDEO_FPS, VIDEO_KEYFRAME_INTERVAL, pickWebCodecsConfig } from './simulator-video-config';

const MAX_ENCODE_QUEUE = 8;

const yieldToUi = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

const waitForEncoderQueue = (encoder: VideoEncoder, hasError: () => boolean, stop: () => boolean) =>
  new Promise<void>((resolve) => {
    if (encoder.encodeQueueSize <= MAX_ENCODE_QUEUE || encoder.state !== 'configured' || hasError() || stop()) {
      resolve();
      return;
    }
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      clearInterval(check);
      encoder.removeEventListener('dequeue', onDequeue);
      resolve();
    };
    const onDequeue = () => {
      if (encoder.encodeQueueSize <= MAX_ENCODE_QUEUE || encoder.state !== 'configured' || hasError() || stop()) {
        done();
      }
    };
    const check = setInterval(onDequeue, 50);
    encoder.addEventListener('dequeue', onDequeue);
  });

/**
 * Encodes the simulator animation as a standard H.264 MP4 (`video/mp4`).
 * Returns `null` when stopped by the caller or when the browser cannot encode H.264 with WebCodecs.
 */
export const makeSimulatorVideo = async (
  canvas: HTMLCanvasElement,
  input: ImageInput,
  onProgress: (share: number) => void,
  stop: () => boolean = () => false,
): Promise<Blob | null> => {
  const { width, height } = IMAGE_FORMATS[input.format];
  const config = await pickWebCodecsConfig(width, height);
  if (!config) return null;

  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: { codec: 'avc', width, height, frameRate: VIDEO_FPS },
    fastStart: 'in-memory',
    firstTimestampBehavior: 'offset',
  });

  let encodeError: unknown = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (error) => {
      encodeError = error;
    },
  });

  try {
    encoder.configure(config);
    const totalFrames = Math.round(IMAGE_ANIMATION_SECONDS * VIDEO_FPS);
    let drewFinal = false;

    for (let frameIndex = 0; frameIndex < totalFrames; frameIndex += 1) {
      if (stop()) return null;
      if (encodeError) throw encodeError;

      const seconds = frameIndex / VIDEO_FPS;
      if (seconds < IMAGE_MOVING_SECONDS) {
        drawSimulatorImage(canvas, input, seconds);
      } else if (!drewFinal) {
        // Draw the static final image once and keep feeding CFR frames during the hold.
        drawSimulatorImage(canvas, input);
        drewFinal = true;
      }

      const timestamp = Math.round((frameIndex * 1_000_000) / VIDEO_FPS);
      const nextTimestamp = Math.round(((frameIndex + 1) * 1_000_000) / VIDEO_FPS);
      const videoFrame = new VideoFrame(canvas, { timestamp, duration: nextTimestamp - timestamp });
      try {
        encoder.encode(videoFrame, { keyFrame: frameIndex % VIDEO_KEYFRAME_INTERVAL === 0 });
      } finally {
        videoFrame.close();
      }

      onProgress((frameIndex + 1) / totalFrames);
      if (encoder.encodeQueueSize > MAX_ENCODE_QUEUE) {
        await waitForEncoderQueue(encoder, () => encodeError !== null, stop);
      } else if (frameIndex % 4 === 0) {
        await yieldToUi();
      }
    }

    if (stop()) return null;
    if (encodeError) throw encodeError;
    await encoder.flush();
    if (encodeError) throw encodeError;

    muxer.finalize();
    onProgress(1);
    return new Blob([target.buffer], { type: 'video/mp4' });
  } finally {
    if (encoder.state !== 'closed') encoder.close();
  }
};

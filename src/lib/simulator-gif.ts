/**
 * The animated GIF of the simulator. It draws each frame of the animation on the big canvas, copies it at half
 * size and encodes it with gifenc. Every browser can do it: it needs no recorder and no codec.
 * One palette for all the frames, taken from the final image: the colors do not flicker from frame to frame.
 * The page loads this module only when the reader asks for a GIF.
 */
import { GIFEncoder, applyPalette, quantize } from 'gifenc';
import { GIF_SCALE, IMAGE_FORMATS, IMAGE_HOLD_SECONDS, IMAGE_MOVING_SECONDS, drawSimulatorImage, type ImageInput } from './simulator-image';

/** 12.5 frames each second: a GIF counts time in hundredths, so 80 ms is exact. */
const FRAME_MS = 80;

/** The GIF, or null if `stop` says to stop before the end. */
export const makeSimulatorGif = async (
  canvas: HTMLCanvasElement,
  input: ImageInput,
  onProgress: (share: number) => void,
  stop: () => boolean = () => false,
): Promise<Blob | null> => {
  const { width, height } = IMAGE_FORMATS[input.format];
  const small = document.createElement('canvas');
  small.width = Math.round(width * GIF_SCALE);
  small.height = Math.round(height * GIF_SCALE);
  const ctx = small.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = 'high';
  const pixels = (time?: number) => {
    drawSimulatorImage(canvas, input, time);
    ctx.drawImage(canvas, 0, 0, small.width, small.height);
    return ctx.getImageData(0, 0, small.width, small.height).data;
  };

  const palette = quantize(pixels(), 256);
  const gif = GIFEncoder();
  const frames = Math.ceil((IMAGE_MOVING_SECONDS * 1000) / FRAME_MS);
  for (let frame = 0; frame < frames; frame += 1) {
    if (stop()) return null;
    const data = pixels((frame * FRAME_MS) / 1000);
    gif.writeFrame(applyPalette(data, palette), small.width, small.height, { palette, delay: FRAME_MS, repeat: 0 });
    onProgress(frame / frames);
    // Give the page a moment to paint the preview and the progress.
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  // The final image stays still, then the GIF starts again.
  gif.writeFrame(applyPalette(pixels(), palette), small.width, small.height, { palette, delay: IMAGE_HOLD_SECONDS * 1000 });
  gif.finish();
  onProgress(1);
  return new Blob([gif.bytes()], { type: 'image/gif' });
};

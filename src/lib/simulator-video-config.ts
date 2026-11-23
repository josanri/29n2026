/**
 * Codec and bitrate selection for the simulator video export.
 * Kept separate from `simulator-video.ts` so the page can check H.264 WebCodecs support
 * without loading `mp4-muxer` until the reader asks for a video.
 */

export const VIDEO_FPS = 30;
export const VIDEO_KEYFRAME_INTERVAL = VIDEO_FPS * 2;

/**
 * H.264 codec strings compatible with all simulator formats up to 1080 × 1920 at 30 fps.
 * Main and High Level 4.0 give sharper text and wide device support; Constrained Baseline 4.0
 * and Level 4.2 cover encoders with stricter profile or level rules.
 */
export const WEBCODECS_H264_CODECS = [
  'avc1.4D4028',
  'avc1.640028',
  'avc1.42E028',
  'avc1.4D402A',
  'avc1.64002A',
] as const;

/**
 * MIME types for the MediaRecorder backup path: MP4 with H.264 Level 4.0 first (for WhatsApp and
 * Instagram), then WebM, and plain `video/mp4` last (Safari; Chromium without H.264 puts VP9 in it).
 */
export const MEDIA_RECORDER_TYPES = [
  'video/mp4;codecs=avc1.4D4028',
  'video/mp4;codecs=avc1.640028',
  'video/mp4;codecs=avc1.42E028',
  'video/mp4;codecs=avc1',
  'video/webm;codecs=vp9',
  'video/webm',
  'video/mp4',
] as const;

/** Target VBR bitrate scaled to the pixel area: crisp text and edges without bloated 8 MB files. */
export const videoBitrateFor = (width: number, height: number) =>
  Math.round(Math.min(5_500_000, Math.max(3_000_000, width * height * 2.8)));

export const hasWebCodecsApi = () => typeof VideoEncoder === 'function' && typeof VideoFrame === 'function';

/**
 * Picks the highest-quality H.264 WebCodecs configuration that this browser supports for the given size.
 * Returns `null` when WebCodecs or H.264 encoding is unavailable.
 */
export const pickWebCodecsConfig = async (width: number, height: number): Promise<VideoEncoderConfig | null> => {
  if (!hasWebCodecsApi()) return null;
  const bitrate = videoBitrateFor(width, height);
  const variants: Partial<VideoEncoderConfig>[] = [
    { latencyMode: 'quality', bitrateMode: 'variable' },
    { latencyMode: 'quality' },
    { latencyMode: 'realtime' },
  ];
  for (const variant of variants) {
    for (const codec of WEBCODECS_H264_CODECS) {
      const candidate: VideoEncoderConfig = {
        codec,
        width,
        height,
        bitrate,
        framerate: VIDEO_FPS,
        avc: { format: 'avc' },
        ...variant,
      };
      try {
        const support = await VideoEncoder.isConfigSupported(candidate);
        if (support.supported) {
          return { ...(support.config ?? candidate), avc: { format: 'avc' } };
        }
      } catch {
        /* Try the next codec or mode. */
      }
    }
  }
  return null;
};

export const pickMediaRecorderType = (): string | undefined =>
  MEDIA_RECORDER_TYPES.find((type) => typeof MediaRecorder === 'function' && MediaRecorder.isTypeSupported(type));

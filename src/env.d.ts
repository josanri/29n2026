// The package maps `./900` to `./900.css` in its `exports`, so the import has no extension.
declare module '@fontsource/big-shoulders-display/900';

// WebMCP, declarative API: the attributes that turn a form into a tool for the AI agent of the browser
// (https://developer.chrome.com/docs/ai/webmcp/declarative-api).
declare namespace astroHTML.JSX {
  interface FormHTMLAttributes {
    toolname?: string;
    tooldescription?: string;
    toolautosubmit?: boolean;
  }
  interface InputHTMLAttributes {
    toolparamdescription?: string;
  }
}

// gifenc has no types: only the part that the GIF of the simulator uses (`src/lib/simulator-gif.ts`).
declare module 'gifenc' {
  type Palette = number[][];
  export function quantize(rgba: Uint8ClampedArray, maxColors: number, options?: { format?: 'rgb565' | 'rgb444' | 'rgba4444' }): Palette;
  export function applyPalette(rgba: Uint8ClampedArray, palette: Palette, format?: 'rgb565' | 'rgb444' | 'rgba4444'): Uint8Array;
  export function GIFEncoder(): {
    writeFrame(index: Uint8Array, width: number, height: number, options?: { palette?: Palette; delay?: number; repeat?: number }): void;
    finish(): void;
    bytes(): Uint8Array<ArrayBuffer>;
  };
}

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

/** Wrangler bundles a `.bin` file as an ArrayBuffer (its default «Data» rule). */
declare module '*.bin' {
  const data: ArrayBuffer;
  export default data;
}

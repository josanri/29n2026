/**
 * An 8-bit palette PNG from a buffer that already has the PNG row layout: each row starts with its filter byte (0,
 * «none») and has one palette index per pixel. The card is drawn straight into that layout, so nothing is copied.
 *
 * The compression is made here, not with zlib: zlib looks for repeats at every byte and needs 3 to 4 ms for the
 * 757 KB of a card, a third of the CPU budget of a request. A card is made of horizontal runs of one color (the
 * frame, the white, the stems of the letters), and many rows are the same as the row above. So the encoder reads
 * each row once as a list of runs:
 * - a row with the same runs as the row above is one copy of 1201 bytes at distance 1201 (five matches);
 * - any other row is, for each run, its first byte and a copy at distance 1 for the rest.
 * The codes are the fixed Huffman codes of deflate (no tables to build or send). The Adler-32 checksum of zlib is
 * also counted per run, with a formula, and not per byte. The result is 20 to 60 KB, in about 1 ms.
 */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array, start: number, end: number): number {
  let c = 0xffffffff;
  for (let i = start; i < end; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// ── Fixed Huffman codes of deflate (RFC 1951, 3.2.6), bit-reversed because deflate writes codes from the top bit ──

const reverse = (code: number, length: number) => {
  let out = 0;
  for (let i = 0; i < length; i++) out |= ((code >> i) & 1) << (length - 1 - i);
  return out;
};

/** Code and length of each literal/length symbol 0-287. */
const LITERAL_BITS = new Uint16Array(288);
const LITERAL_LENGTH = new Uint8Array(288);
for (let symbol = 0; symbol < 288; symbol++) {
  const [base, length, first] =
    symbol < 144 ? [0x30, 8, 0] : symbol < 256 ? [0x190, 9, 144] : symbol < 280 ? [0, 7, 256] : [0xc0, 8, 280];
  LITERAL_BITS[symbol] = reverse(base + symbol - first, length);
  LITERAL_LENGTH[symbol] = length;
}

const LENGTH_BASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
const LENGTH_EXTRA = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];

/** The bits of a match length 3-258 (its symbol and the extra bits) and how many there are. */
const MATCH_BITS = new Uint32Array(259);
const MATCH_LENGTH = new Uint8Array(259);
for (let length = 3; length <= 258; length++) {
  let code = LENGTH_BASE.length - 1;
  while (LENGTH_BASE[code] > length) code--;
  const symbol = 257 + code;
  MATCH_BITS[length] = LITERAL_BITS[symbol] | ((length - LENGTH_BASE[code]) << LITERAL_LENGTH[symbol]);
  MATCH_LENGTH[length] = LITERAL_LENGTH[symbol] + LENGTH_EXTRA[code];
}

const ADLER = 65521;

// Reused from one card to the next: the drawing and the encoding are synchronous, so two requests never share them.
let output = new Uint8Array(0);
let runValues = new Uint8Array(0);
let runLengths = new Uint16Array(0);
let previousValues = new Uint8Array(0);
let previousLengths = new Uint16Array(0);

/** zlib stream (RFC 1950) of `rows`: `height` rows of `stride` bytes. */
export function deflateRows(rows: Uint8Array, stride: number, height: number): Uint8Array {
  if (stride < 1025 || stride > 1536) throw new Error('deflateRows: the row copy is coded for rows of 1025-1536 bytes');
  // Worst case: every byte a 9-bit literal.
  const capacity = Math.ceil((rows.length * 9) / 8) + 64;
  if (output.length < capacity) output = new Uint8Array(capacity);
  if (runValues.length < stride) {
    runValues = new Uint8Array(stride);
    runLengths = new Uint16Array(stride);
    previousValues = new Uint8Array(stride);
    previousLengths = new Uint16Array(stride);
  }
  const out = output;
  // The bit writer is written out in each loop, not as a function: the first card of a new isolate runs before
  // the JIT compiler, and a call per code would cost more than the code.
  let at = 2;
  let bits = 0b011; // the only block: last, fixed Huffman codes
  let count = 3;
  out[0] = 0x78; // deflate, 32 KB window
  out[1] = 0x01; // no dictionary, «fastest» (0x7801 is a multiple of 31)
  const rowBits = reverse(20, 5) | ((stride - 1025) << 5); // distance code 20 and 9 extra bits
  const DISTANCE_1 = 0; // distance code 0 (5 bits of 0): distance 1

  let a = 1;
  let b = 0;
  let previousCount = -1;
  for (let y = 0; y < height; y++) {
    // The runs of this row.
    const start = y * stride;
    const end = start + stride;
    let runs = 0;
    for (let i = start; i < end; ) {
      const value = rows[i];
      let j = i + 1;
      while (j < end && rows[j] === value) j++;
      runValues[runs] = value;
      runLengths[runs++] = j - i;
      i = j;
    }
    let same = runs === previousCount;
    for (let r = 0; same && r < runs; r++) {
      same = runValues[r] === previousValues[r] && runLengths[r] === previousLengths[r];
    }

    if (same) {
      // The row above again: copies of up to 258 bytes at the distance of a row (the last one at least 3).
      let left = stride;
      while (left > 0) {
        const length = left > 258 + 3 || left <= 258 ? (left < 258 ? left : 258) : left - 3;
        bits |= MATCH_BITS[length] << count;
        count += MATCH_LENGTH[length];
        while (count >= 8) { out[at++] = bits; bits >>>= 8; count -= 8; }
        bits |= rowBits << count;
        count += 14;
        while (count >= 8) { out[at++] = bits; bits >>>= 8; count -= 8; }
        left -= length;
      }
    } else {
      for (let r = 0; r < runs; r++) {
        const value = runValues[r];
        const literal = LITERAL_BITS[value];
        const literalLength = LITERAL_LENGTH[value];
        bits |= literal << count;
        count += literalLength;
        while (count >= 8) { out[at++] = bits; bits >>>= 8; count -= 8; }
        let left = runLengths[r] - 1;
        while (left >= 3) {
          const length = left > 258 ? 258 : left;
          bits |= MATCH_BITS[length] << count;
          count += MATCH_LENGTH[length];
          while (count >= 8) { out[at++] = bits; bits >>>= 8; count -= 8; }
          bits |= DISTANCE_1 << count;
          count += 5;
          while (count >= 8) { out[at++] = bits; bits >>>= 8; count -= 8; }
          left -= length;
        }
        for (; left > 0; left--) {
          bits |= literal << count;
          count += literalLength;
          while (count >= 8) { out[at++] = bits; bits >>>= 8; count -= 8; }
        }
      }
      previousCount = runs;
      previousValues.set(runValues.subarray(0, runs));
      previousLengths.set(runLengths.subarray(0, runs));
    }

    // Adler-32 of the runs: n bytes of value v add n·v to «a» and n·a + v·n(n+1)/2 to «b».
    for (let r = 0; r < runs; r++) {
      const n = runLengths[r];
      const v = runValues[r];
      b = (b + n * a + v * ((n * (n + 1)) >> 1)) % ADLER;
      a = (a + n * v) % ADLER;
    }
  }

  // End of block, then the last bits to a whole byte.
  bits |= LITERAL_BITS[256] << count;
  count += LITERAL_LENGTH[256];
  while (count > 0) { out[at++] = bits; bits >>>= 8; count -= 8; }
  const adler = ((b << 16) | a) >>> 0;
  out[at++] = adler >>> 24;
  out[at++] = (adler >>> 16) & 0xff;
  out[at++] = (adler >>> 8) & 0xff;
  out[at++] = adler & 0xff;
  return out.subarray(0, at);
}

/** `rows`: `height` rows of `1 + width` bytes. `palette`: RGB triplets, at most 256. */
export function encodePng(width: number, height: number, rows: Uint8Array, palette: Uint8Array): Uint8Array {
  const idat = deflateRows(rows, width + 1, height);
  const chunks: [string, Uint8Array][] = [
    ['IHDR', ihdr(width, height)],
    ['PLTE', palette],
    ['IDAT', idat],
    ['IEND', new Uint8Array(0)],
  ];
  const size = 8 + chunks.reduce((sum, [, data]) => sum + 12 + data.length, 0);
  const png = new Uint8Array(size);
  const view = new DataView(png.buffer);
  png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  let at = 8;
  for (const [type, data] of chunks) {
    view.setUint32(at, data.length);
    for (let i = 0; i < 4; i++) png[at + 4 + i] = type.charCodeAt(i);
    png.set(data, at + 8);
    view.setUint32(at + 8 + data.length, crc32(png, at + 4, at + 8 + data.length));
    at += 12 + data.length;
  }
  return png;
}

function ihdr(width: number, height: number): Uint8Array {
  const data = new Uint8Array(13);
  const view = new DataView(data.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  data[8] = 8; // bits per index
  data[9] = 3; // palette
  return data;
}

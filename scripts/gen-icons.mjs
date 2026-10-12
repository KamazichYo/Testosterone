// Generates the PWA / home-screen icons as crisp pixel-art PNGs.
// Run: npm run icons
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const ART = [
  '..OO..............OO..',
  '.ObbO............ObbO.',
  '.ObbbO..........ObbbTO',
  '.ObBBBOOOOOOOOOOBBBbtO',
  '.ObBBBBBBBBBBBBBBBBbO.',
  '..OBBBBBBBBBBBBBBBBO..',
  '..OBBBBBBBBBBBBBBBBO..',
  '.OBBBEEBBBBBBBBEEBBBO.',
  '.OBBBEWBBBBBBBBEWBBBO.',
  '.OBBBEEBBLLLLBBEEBBBO.',
  '.OBBBBBBLLLLLLBBBBBBO.',
  '.OBBbBBLLLNNLLLBBbBBO.',
  '..OBbBBLLLNNLLLBBbBO..',
  '..OBBbLLLLOOLLLLbBBO..',
  '...OBBLLLOLLOLLLBBO...',
  '....OOLLLLPPLLLLOO....',
  '......OOLLPPLLOO......',
  '........OOOOOO........',
];
const PAL = {
  O: [59, 42, 42],
  B: [217, 154, 91],
  b: [181, 119, 63],
  L: [242, 207, 160],
  E: [43, 29, 29],
  W: [255, 255, 255],
  N: [43, 29, 29],
  P: [239, 125, 141],
  T: [95, 208, 104],
  t: [47, 138, 60],
};
const BG = [43, 36, 51];
const BG2 = [74, 61, 92];

function render(size, grid) {
  const px = new Uint8Array(size * size * 4);
  const scale = Math.floor(size / grid);
  const off = Math.floor((size - scale * grid) / 2);
  const artW = ART[0].length;
  const ax = Math.floor((grid - artW) / 2);
  const ay = Math.floor((grid - ART.length) / 2) + 1;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const gx = Math.floor((x - off) / scale);
      const gy = Math.floor((y - off) / scale);
      // background: radial-ish two-tone pixel disc
      const dx = gx - grid / 2 + 0.5;
      const dy = gy - grid / 2 + 0.5;
      let c = dx * dx + dy * dy < (grid * 0.42) ** 2 ? BG2 : BG;
      const row = ART[gy - ay];
      const ch = row ? row[gx - ax] : undefined;
      if (ch && ch !== '.') c = PAL[ch];
      const i = (y * size + x) * 4;
      px[i] = c[0];
      px[i + 1] = c[1];
      px[i + 2] = c[2];
      px[i + 3] = 255;
    }
  }
  return px;
}

const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    Buffer.from(rgba.buffer, y * size * 4, size * 4).copy(raw, y * (size * 4 + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync('public/icons', { recursive: true });
for (const [name, size] of [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['apple-touch-icon.png', 180],
]) {
  writeFileSync(`public/icons/${name}`, png(size, render(size, 32)));
  console.log('wrote', name);
}

// Dev-only gallery of procedurally drawn sprites: `npm run dev` → /dev/preview.html
//   ?scale=4   dog sheets (wild vs cared-for)
//   ?zoom=8    a few dog sheets, large
//   ?map=2     the whole Garages district with props and dogs
import { drawDogSheet } from '../src/art/dogArt';
import type { PixelCanvas } from '../src/art/PixelCanvas';
import { Rng } from '../src/core/rng';
import { generateLook } from '../src/dogs/generator';

const params = new URLSearchParams(location.search);
const scale = Number(params.get('scale') ?? 4);

function show(title: string, pcs: PixelCanvas[], s = scale) {
  const h = document.createElement('h3');
  h.textContent = title;
  document.body.appendChild(h);
  for (const pc of pcs) {
    const c = pc.toCanvas();
    c.style.width = `${pc.w * s}px`;
    c.style.height = `${pc.h * s}px`;
    document.body.appendChild(c);
  }
}

const rng = new Rng(Number(params.get('seed') ?? 7));
const looks = Array.from({ length: 6 }, () => generateLook(rng));

if (params.get('map')) {
  void import('./mapPreview').then((m) => show('Гаражи', [m.composeMap()], Number(params.get('map'))));
} else if (params.get('zoom')) {
  show('Кадры', looks.slice(0, 3).map((l) => drawDogSheet(l, { dirt: 0, angry: true, hungry: false, tagged: false })), Number(params.get('zoom')));
} else {
  show('Дикие (грязные, злые/голодные)', looks.map((l, i) => drawDogSheet(l, { dirt: 0.85, angry: i % 2 === 0, hungry: true, tagged: false })));
  show('После ухода (чистые, с биркой)', looks.map((l) => drawDogSheet(l, { dirt: 0, angry: false, hungry: false, tagged: true })));
}

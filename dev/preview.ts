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

if (params.get('chars')) {
  document.body.innerHTML = '';
  void import('../src/art/playerArt').then((m) => {
    show('Персонаж', [m.drawPlayerSheet()], Number(params.get('chars')));
    show('Собаки', looks.slice(0, 4).map((l) => drawDogSheet(l, { dirt: 0, angry: false, hungry: false, tagged: true })), Number(params.get('chars')));
  });
}

if (params.get('frames')) {
  document.body.innerHTML = '';
  const fr = params.get('frames')!.split(',').map(Number);
  const z = Number(params.get('z') ?? 8);
  const dirty = params.get('dirty') === '1';
  void import('../src/art/dogArt').then((m) => {
    const rng2 = new Rng(Number(params.get('seed') ?? 7));
    for (let i = 0; i < Number(params.get('n') ?? 6); i++) {
      const l = generateLook(rng2);
      show(`${l.size} ${l.build} ${l.coat} ${l.head} ${l.ears} ${l.tail} ${l.pattern}`, fr.map((f) => m.drawDogFrame(l, f, { dirt: dirty ? 0.85 : 0, angry: dirty, hungry: dirty, tagged: !dirty })), z);
    }
  });
}

if (params.get('people')) {
  document.body.innerHTML = '';
  const z = Number(params.get('people'));
  void Promise.all([import('../src/art/playerArt'), import('../src/art/humanArt'), import('../src/data/garages')]).then(([pa, ha, gd]) => {
    const sheet = pa.drawPlayerSheet();
    const frames: PixelCanvas[] = [];
    for (let i = 0; i < 39; i++) {
      const f = new (sheet.constructor as typeof PixelCanvas)(20, 30);
      for (let y = 0; y < 30; y++) for (let x = 0; x < 20; x++) f.set(x, y, sheet.get(i * 20 + x, y));
      frames.push(f);
    }
    show('Герой', frames.slice(0, 13), z);
    show('', frames.slice(13, 26), z);
    show('', frames.slice(26, 39), z);
    for (const n of gd.garagesDistrict().npcs) show(n.name, ha.drawPersonFrames(n.look as never), z);
  });
}

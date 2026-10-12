import { hash2 } from '../core/rng';
import type { DogLook } from '../dogs/types';
import { Color, hex, mix, shade } from './color';
import { PixelCanvas } from './PixelCanvas';

export const DOG_FRAME_W = 32;
export const DOG_FRAME_H = 24;

/** Frame indices inside a dog sheet. */
export const DOG_FRAMES = {
  idle: [0, 1],
  walk: [2, 3, 4, 5],
  eat: [6, 7],
  bark: [8],
  sleep: [9],
  happy: [10, 11],
} as const;
const FRAME_COUNT = 12;

export interface DogLookState {
  /** 0..1 — mud, matted fur, dull colours */
  dirt: number;
  /** 0..1 — angry eyebrows */
  angry: boolean;
  /** visible ribs */
  hungry: boolean;
  /** ear tag after the full care cycle */
  tagged: boolean;
}

interface Pose {
  legPhase: number; // -1 = standing still
  tailPhase: number;
  head: 'normal' | 'down' | 'up' | 'rest';
  mouth: 'closed' | 'open' | 'chew' | 'smile';
  lying: boolean;
  eyesClosed: boolean;
}

const POSES: Pose[] = [
  { legPhase: -1, tailPhase: 0, head: 'normal', mouth: 'closed', lying: false, eyesClosed: false },
  { legPhase: -1, tailPhase: 1, head: 'normal', mouth: 'closed', lying: false, eyesClosed: false },
  { legPhase: 0, tailPhase: 0, head: 'normal', mouth: 'closed', lying: false, eyesClosed: false },
  { legPhase: 1, tailPhase: 1, head: 'normal', mouth: 'closed', lying: false, eyesClosed: false },
  { legPhase: 2, tailPhase: 0, head: 'normal', mouth: 'closed', lying: false, eyesClosed: false },
  { legPhase: 3, tailPhase: 1, head: 'normal', mouth: 'closed', lying: false, eyesClosed: false },
  { legPhase: -1, tailPhase: 0, head: 'down', mouth: 'closed', lying: false, eyesClosed: false },
  { legPhase: -1, tailPhase: 1, head: 'down', mouth: 'chew', lying: false, eyesClosed: true },
  { legPhase: -1, tailPhase: 0, head: 'up', mouth: 'open', lying: false, eyesClosed: false },
  { legPhase: -1, tailPhase: 0, head: 'rest', mouth: 'closed', lying: true, eyesClosed: true },
  { legPhase: -1, tailPhase: 0, head: 'up', mouth: 'smile', lying: false, eyesClosed: true },
  { legPhase: -1, tailPhase: 2, head: 'up', mouth: 'smile', lying: false, eyesClosed: true },
];

const SIZE = {
  small: { rx: 6, ry: 3.8, leg: 4, head: 4 },
  medium: { rx: 7.5, ry: 4.3, leg: 5, head: 4.5 },
  large: { rx: 9, ry: 5, leg: 6, head: 5 },
} as const;

const MUD = hex('#6e5a43');
const DUST = hex('#8a7b66');
const NOSE = hex('#2a1e22');
const TONGUE = hex('#ef7d8d');
const WHITE = hex('#ffffff');
const TAG = hex('#ffd23f');

function fillTriangle(pc: PixelCanvas, ax: number, ay: number, bx: number, by: number, cx: number, cy: number, c: (x: number, y: number) => Color): void {
  const minX = Math.floor(Math.min(ax, bx, cx));
  const maxX = Math.ceil(Math.max(ax, bx, cx));
  const minY = Math.floor(Math.min(ay, by, cy));
  const maxY = Math.ceil(Math.max(ay, by, cy));
  const sign = (px: number, py: number, x1: number, y1: number, x2: number, y2: number) =>
    (px - x2) * (y1 - y2) - (x1 - x2) * (py - y2);
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      const d1 = sign(px, py, ax, ay, bx, by);
      const d2 = sign(px, py, bx, by, cx, cy);
      const d3 = sign(px, py, cx, cy, ax, ay);
      const neg = d1 < 0 || d2 < 0 || d3 < 0;
      const pos = d1 > 0 || d2 > 0 || d3 > 0;
      if (!(neg && pos)) pc.set(x, y, c(x, y));
    }
  }
}

export function drawDogFrame(look: DogLook, frame: number, st: DogLookState): PixelCanvas {
  const pc = new PixelCanvas(DOG_FRAME_W, DOG_FRAME_H);
  const pose = POSES[frame];
  const s = SIZE[look.size];
  const base = hex(look.base);
  const accent = hex(look.accent);
  const patch = hex(look.patch);
  const light = shade(base, 1.2);
  const dark = shade(base, 0.74);
  const farLeg = shade(base, 0.62);
  const ground = 21;

  const bx = 14.5;
  let by = ground - s.leg - s.ry + 1.5;
  if (pose.lying) by = ground - s.ry + 1.2;

  // ---------- legs ----------
  const legTop = Math.round(by + s.ry - 2);
  const backX = Math.round(bx - s.rx * 0.62);
  const frontX = Math.round(bx + s.rx * 0.5);
  const step = [1, 0, -1, 0];
  const legColor = (near: boolean, y: number): Color => {
    const sock = look.pattern === 'socks' && y >= ground - 1;
    if (sock) return near ? accent : shade(accent, 0.8);
    return near ? base : farLeg;
  };
  const drawLeg = (x: number, near: boolean, dx: number, lift: number) => {
    const bottom = ground - lift;
    for (let y = legTop; y <= bottom; y++) {
      const t = (y - legTop) / Math.max(1, bottom - legTop);
      const ox = Math.round(dx * t);
      pc.set(x + ox, y, legColor(near, y));
      pc.set(x + ox + 1, y, near ? (y < legTop + 2 ? dark : legColor(near, y)) : shade(farLeg, 0.9));
    }
  };
  let nearLegs: () => void;
  if (!pose.lying) {
    const p = pose.legPhase;
    const nf = p < 0 ? 0 : step[p];
    const nb = p < 0 ? 0 : -step[p];
    const liftF = p === 1 ? 1 : 0;
    const liftB = p === 3 ? 1 : 0;
    // far legs (behind body, darker, opposite phase)
    drawLeg(backX + 2, false, -nb, liftF);
    drawLeg(frontX + 2, false, -nf, liftB);
    // near legs are drawn after the body
    nearLegs = () => {
      drawLeg(backX, true, nb, liftB);
      drawLeg(frontX, true, nf, liftF);
    };
  } else {
    nearLegs = () => {
      // tucked paws stretched forward
      pc.rect(Math.round(bx + s.rx - 2), ground - 1, 4, 2, base);
      pc.set(Math.round(bx + s.rx + 1), ground - 1, light);
    };
  }

  // ---------- tail ----------
  const rearX = bx - s.rx + 0.5;
  const tailY = by - s.ry * 0.4;
  const wag = [0, 1, -1][pose.tailPhase];
  if (pose.lying) {
    pc.rect(Math.round(rearX - 2), ground - 1, 5, 2, dark);
    pc.set(Math.round(rearX - 2), ground - 1, look.tail === 'fluffy' ? accent : dark);
  } else if (look.tail === 'curl') {
    const cx = rearX + 0.5;
    const cy = tailY - 3 + wag * 0.3;
    for (let a = 0; a < Math.PI * 1.7; a += 0.15) {
      const x = cx - Math.cos(a) * 2.6;
      const y = cy - Math.sin(a) * 2.6;
      pc.set(x, y, a > Math.PI * 1.3 ? accent : base);
      pc.set(x + 0.7, y + 0.7, dark);
    }
  } else if (look.tail === 'straight') {
    const tx = rearX - 5;
    const ty = tailY - 4 + wag * 1.5;
    pc.line(rearX, tailY, tx, ty, base);
    pc.line(rearX, tailY + 1, tx, ty + 1, dark);
    pc.set(tx, ty, accent);
  } else {
    const tx = rearX - 3;
    const ty = tailY - 3 + wag;
    pc.ellipse(tx, ty, 3.2, 2.2, (nx, ny) => (nx < -0.5 ? accent : ny > 0.3 ? dark : base));
  }

  // ---------- body ----------
  const spots: { x: number; y: number; r: number }[] = [];
  if (look.pattern === 'spots') {
    for (let i = 0; i < 3; i++) {
      spots.push({
        x: bx + (hash2(i, 1, look.seed) - 0.5) * s.rx * 1.4,
        y: by + (hash2(i, 2, look.seed) - 0.6) * s.ry,
        r: 1.6 + hash2(i, 3, look.seed) * 1.8,
      });
    }
  }
  const ribsVisible = st.hungry && !pose.lying;
  pc.ellipse(bx, by, s.rx, pose.lying ? s.ry - 0.3 : s.ry, (nx, ny) => {
    const px = bx + nx * s.rx;
    const py = by + ny * s.ry;
    let c = base;
    if (look.pattern === 'saddle' && ny < 0.05 && nx < 0.7) c = patch;
    for (const sp of spots) if ((px - sp.x) ** 2 + (py - sp.y) ** 2 < sp.r * sp.r) c = patch;
    if (ny > 0.45 && nx > -0.55) c = accent; // belly / chest
    const d = nx * 0.3 + ny * 0.95;
    if (d < -0.62) c = c === base ? light : shade(c, 1.12);
    else if (d > 0.62) c = shade(c, 0.8);
    if (ribsVisible && ny > -0.2 && ny < 0.45 && Math.abs(nx - 0.1) < 0.35 && Math.round(px) % 2 === 0) c = shade(c, 0.82);
    return c;
  });
  // chest fluff toward the head
  pc.ellipse(bx + s.rx - 1.5, by + 0.5, 2.2, s.ry * 0.8, (_nx, ny) => (ny > -0.2 ? accent : base));

  nearLegs();

  // ---------- head ----------
  let hx = bx + s.rx + s.head * 0.4;
  let hy = by - s.ry * 0.6 - 2;
  // neck
  if (!pose.lying && pose.head !== 'down') {
    pc.ellipse(hx - 1.5, hy + 2.5, 2.4, 3, (nx) => (nx > 0.2 ? accent : base));
  }
  if (pose.head === 'down') {
    hx += 1.5;
    hy = by + 1.5;
  } else if (pose.head === 'up') {
    hy -= 1;
  } else if (pose.head === 'rest') {
    hx = bx + s.rx + 1;
    hy = ground - s.head + 0.8;
  }
  const r = s.head;
  // ear behind head (floppy draws after)
  const earBase = look.pattern === 'mask' ? patch : shade(base, 0.85);
  if (look.ears === 'up' || look.ears === 'half') {
    const tipH = look.ears === 'up' ? 3.6 : 2.4;
    const ex = hx - r * 0.45;
    const ey = hy - r + 1.2;
    fillTriangle(pc, ex - 1.8, ey + 0.6, ex + 0.2, ey - tipH, ex + 2, ey + 0.6, (x, y) =>
      x >= ex - 0.3 && y > ey - tipH + 1.6 ? shade(accent, 0.85) : earBase,
    );
    if (look.ears === 'half') pc.set(ex + 1, ey - tipH + 1, shade(earBase, 0.8));
  }

  pc.ellipse(hx, hy, r, r * 0.92, (nx, ny) => {
    let c = base;
    if (look.pattern === 'mask' && ny < 0.35 && nx < 0.6) c = patch;
    if (look.pattern === 'spots' && spots.length && nx < -0.2 && ny < 0) c = hash2(1, 9, look.seed) > 0.5 ? patch : c;
    const d = nx * 0.35 + ny * 0.9;
    if (d < -0.6) c = shade(c, 1.15);
    else if (d > 0.62) c = shade(c, 0.82);
    return c;
  });

  // muzzle
  const mDown = pose.head === 'down' ? 1.5 : 0;
  const mx0 = hx + r * 0.25;
  const mLen = r * 0.5 + 2.6;
  const mTop = Math.round(hy + 0.2 + mDown);
  const mH = look.size === 'small' ? 3 : 4;
  for (let j = 0; j < mH; j++) {
    for (let i = 0; i < mLen; i++) {
      const x = Math.round(mx0 + i);
      const y = mTop + j;
      const rounded = i >= mLen - 1 && (j === 0 || j === mH - 1);
      if (rounded) continue;
      pc.set(x, y, j === mH - 1 ? shade(accent, 0.85) : accent);
    }
  }
  const noseX = Math.round(mx0 + mLen - 1.2);
  pc.set(noseX, mTop, NOSE);
  pc.set(noseX - 1, mTop, NOSE);
  pc.set(noseX, mTop + 1, shade(NOSE, 1.3));

  // mouth
  const mouthY = mTop + mH - 1;
  if (pose.mouth === 'open') {
    pc.rect(Math.round(mx0 + 1), mouthY, Math.ceil(mLen) - 1, 2, NOSE);
    pc.set(Math.round(mx0 + 2), mouthY + 1, TONGUE);
    pc.set(Math.round(mx0 + 3), mouthY + 1, TONGUE);
    if (st.angry) {
      pc.set(Math.round(mx0 + mLen - 2), mouthY, WHITE);
      pc.set(Math.round(mx0 + 2), mouthY, WHITE);
    }
  } else if (pose.mouth === 'chew') {
    pc.hline(Math.round(mx0 + 1), Math.round(mx0 + mLen - 2), mouthY, shade(accent, 0.6));
  } else if (pose.mouth === 'smile') {
    pc.hline(Math.round(mx0 + 1), Math.round(mx0 + mLen - 2), mouthY, shade(accent, 0.6));
    pc.set(Math.round(mx0 + 2), mouthY + 1, TONGUE);
    pc.set(Math.round(mx0 + 3), mouthY + 1, TONGUE);
    pc.set(Math.round(mx0 + 2), mouthY + 2, shade(TONGUE, 0.85));
  } else {
    pc.set(Math.round(mx0 + mLen - 3), mouthY, shade(accent, 0.6));
  }

  // eye
  const ex = Math.round(hx + r * 0.15);
  const ey = Math.round(hy - r * 0.35 + mDown * 0.5);
  const eyeC = hex(look.eye);
  if (pose.eyesClosed) {
    pc.hline(ex - 1, ex, ey + 1, shade(eyeC, 1.4));
  } else {
    pc.set(ex, ey, WHITE);
    pc.set(ex + 1, ey, eyeC);
    pc.set(ex, ey + 1, eyeC);
    pc.set(ex + 1, ey + 1, eyeC);
  }
  if (st.angry && !pose.eyesClosed) {
    pc.set(ex - 1, ey - 2, NOSE);
    pc.set(ex, ey - 2, NOSE);
    pc.set(ex + 1, ey - 1, NOSE);
  }
  // cheek blush when happy and clean
  if (pose.mouth === 'smile' && st.dirt < 0.4) pc.set(ex, ey + 2, mix(accent, TONGUE, 0.5));

  if (look.ears === 'floppy') {
    const fx = hx - r * 0.5;
    const fy = hy - r * 0.15;
    pc.ellipse(fx, fy, 1.7, 3.1, (nx, ny) => (nx > 0.3 || ny > 0.6 ? shade(earBase, 0.75) : earBase));
  }

  if (st.tagged) {
    const tx = Math.round(hx - r * 0.5);
    const ty = Math.round(hy - r + (look.ears === 'floppy' ? 2 : 0));
    pc.rect(tx, ty, 2, 2, TAG);
    pc.set(tx + 1, ty + 1, shade(TAG, 0.75));
  }

  // ---------- dirt ----------
  if (st.dirt > 0.05) {
    for (let y = 0; y < pc.h; y++) {
      for (let x = 0; x < pc.w; x++) {
        if (!pc.isSolid(x, y)) continue;
        let c = pc.get(x, y);
        if (c === NOSE || c === WHITE || c === TAG) continue;
        c = mix(c, DUST, 0.35 * st.dirt);
        const low = (y - 6) / 16; // mud collects lower on the body
        const n = hash2(x, y, look.seed);
        if (n < st.dirt * (0.12 + low * 0.45)) c = mix(c, MUD, 0.75);
        else if (n > 1 - st.dirt * 0.08) c = shade(c, 0.78); // matted tufts
        pc.set(x, y, c);
      }
    }
  }

  pc.outline(0.42);
  return pc;
}

/** Builds a horizontal strip with all frames for one dog. */
export function drawDogSheet(look: DogLook, st: DogLookState): PixelCanvas {
  const sheet = new PixelCanvas(DOG_FRAME_W * FRAME_COUNT, DOG_FRAME_H);
  for (let f = 0; f < FRAME_COUNT; f++) sheet.blit(drawDogFrame(look, f, st), f * DOG_FRAME_W, 0);
  return sheet;
}

export const DOG_FRAME_COUNT = FRAME_COUNT;

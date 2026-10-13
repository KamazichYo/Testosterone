import { hash2 } from '../core/rng';
import type { Build, Coat, DogLook, HeadShape } from '../dogs/types';
import { Color, hex, mix, shade } from './color';
import { PixelCanvas } from './PixelCanvas';

export const DOG_FRAME_W = 40;
export const DOG_FRAME_H = 32;
/** feet stand on the bottom edge of row 30 */
export const DOG_ORIGIN_Y = 31 / DOG_FRAME_H;

/** Frame indices inside a dog sheet. `_down` = facing the camera, `_up` = walking away. */
export const DOG_FRAMES = {
  idle: [0, 1],
  walk: [2, 3, 4, 5],
  eat: [6, 7],
  bark: [8],
  sleep: [9],
  happy: [10, 11],
  sit: [12, 13],
  shake: [14, 15],
  sleepBreath: [9, 16],
  idle_down: [17, 18],
  walk_down: [19, 20, 21, 22],
  sit_down: [23, 24],
  bark_down: [25],
  idle_up: [26],
  walk_up: [27, 28, 29, 30],
} as const;
const FRAME_COUNT = 31;

export interface DogLookState {
  /** 0..1 — mud, matted fur, dull colours */
  dirt: number;
  angry: boolean;
  /** visible ribs */
  hungry: boolean;
  /** ear tag after the full care cycle */
  tagged: boolean;
}

type View = 'side' | 'front' | 'back';

interface Pose {
  view: View;
  /** walk cycle 0..3, -1 standing */
  step: number;
  tail: number;
  head: 'normal' | 'down' | 'up' | 'rest';
  mouth: 'closed' | 'open' | 'chew' | 'smile';
  eyes: 'open' | 'closed' | 'happy';
  sit?: boolean;
  lie?: boolean;
  shake?: number;
  breathe?: number;
}

const P = (view: View, step: number, tail: number, extra: Partial<Pose> = {}): Pose => ({
  view,
  step,
  tail,
  head: 'normal',
  mouth: 'closed',
  eyes: 'open',
  ...extra,
});

const POSES: Pose[] = [
  // side
  P('side', -1, 0),
  P('side', -1, 1),
  P('side', 0, 0),
  P('side', 1, 1),
  P('side', 2, 0),
  P('side', 3, 1),
  P('side', -1, 0, { head: 'down' }),
  P('side', -1, 1, { head: 'down', mouth: 'chew', eyes: 'closed' }),
  P('side', -1, 0, { head: 'up', mouth: 'open' }),
  P('side', -1, 0, { head: 'rest', lie: true, eyes: 'closed' }),
  P('side', -1, 1, { head: 'up', mouth: 'smile', eyes: 'happy' }),
  P('side', -1, 2, { head: 'up', mouth: 'smile', eyes: 'happy' }),
  P('side', -1, 1, { head: 'up', mouth: 'smile', sit: true }),
  P('side', -1, 2, { head: 'up', mouth: 'smile', sit: true }),
  P('side', -1, 1, { head: 'up', eyes: 'closed', shake: 1 }),
  P('side', -1, 2, { head: 'up', eyes: 'closed', shake: -1 }),
  P('side', -1, 0, { head: 'rest', lie: true, eyes: 'closed', breathe: 0.7 }),
  // front
  P('front', -1, 0),
  P('front', -1, 1, { eyes: 'closed' }),
  P('front', 0, 0),
  P('front', 1, 1),
  P('front', 2, 0),
  P('front', 3, 1),
  P('front', -1, 1, { sit: true, mouth: 'smile' }),
  P('front', -1, 2, { sit: true, mouth: 'smile', eyes: 'happy' }),
  P('front', -1, 0, { mouth: 'open' }),
  // back
  P('back', -1, 0),
  P('back', 0, 1),
  P('back', 1, 2),
  P('back', 2, 1),
  P('back', 3, 2),
];

const SIZES = {
  small: { len: 11, chest: 5.2, hip: 4.4, leg: 6.5, head: 5, leg_r: 1.35 },
  medium: { len: 14, chest: 6.3, hip: 5.3, leg: 8.4, head: 5.8, leg_r: 1.6 },
  large: { len: 16, chest: 7.3, hip: 6.1, leg: 10, head: 6.4, leg_r: 1.85 },
} as const;

const BUILD: Record<Build, { len: number; body: number; leg: number }> = {
  stocky: { len: 0.95, body: 1.1, leg: 0.8 },
  normal: { len: 1, body: 1, leg: 1 },
  lanky: { len: 1.06, body: 0.9, leg: 1.14 },
};

const MUD = hex('#6e5a43');
const DUST = hex('#8a7b66');
const NOSE = hex('#2a1e22');
const TONGUE = hex('#ef7d8d');
const WHITE = hex('#ffffff');
const TAG = hex('#ffd23f');
const INNER_EAR = hex('#e8a3a0');

/** Fill in fields added after the first release so old saves render the same way every time. */
export function fullLook(look: DogLook): Required<DogLook> {
  const pick = <T,>(arr: T[], salt: number) => arr[Math.floor(hash2(look.seed, salt, 7) * arr.length)];
  return {
    ...look,
    build: look.build ?? pick<Build>(['stocky', 'normal', 'normal', 'lanky'], 1),
    coat: look.coat ?? pick<Coat>(['short', 'short', 'long'], 2),
    head: look.head ?? pick<HeadShape>(['pointy', 'normal', 'normal', 'short'], 3),
  };
}

const tone = (c: Color, l: number): Color =>
  l >= 2 ? shade(c, 1.24) : l === 1 ? shade(c, 1.11) : l === 0 ? c : l === -1 ? shade(c, 0.84) : shade(c, 0.68);

const rad = (deg: number) => (deg * Math.PI) / 180;

interface Ctx {
  pc: PixelCanvas;
  look: Required<DogLook>;
  st: DogLookState;
  base: Color;
  accent: Color;
  patch: Color;
  s: { len: number; chest: number; hip: number; leg: number; head: number; legR: number };
  G: number;
  pose: Pose;
  frame: number;
}

export function drawDogFrame(lookIn: DogLook, frame: number, st: DogLookState): PixelCanvas {
  const look = fullLook(lookIn);
  const pc = new PixelCanvas(DOG_FRAME_W, DOG_FRAME_H);
  const pose = POSES[frame];
  const sz = SIZES[look.size];
  const b = BUILD[look.build];
  const ctx: Ctx = {
    pc,
    look,
    st,
    base: hex(look.base),
    accent: hex(look.accent),
    patch: hex(look.patch),
    s: {
      len: sz.len * b.len,
      chest: sz.chest * b.body,
      hip: sz.hip * b.body,
      leg: sz.leg * b.leg,
      head: sz.head,
      legR: sz.leg_r * (b.body > 1 ? 1.12 : b.body < 1 ? 0.9 : 1),
    },
    G: 30,
    pose,
    frame,
  };
  if (pose.view === 'side') drawSide(ctx);
  else if (pose.view === 'front') drawFront(ctx);
  else drawBack(ctx);
  postProcess(ctx);
  pc.outline(0.42);
  return pc;
}

// ------------------------------------------------------------------ shared helpers

function isDark(c: Color): boolean {
  return (c & 255) + ((c >>> 8) & 255) + ((c >>> 16) & 255) < 240;
}

/** Colour of fur at a spot for a given body part, before lighting. u/v are 0..1 local coordinates. */
function furColor(c: Ctx, part: 'body' | 'head' | 'leg' | 'tail' | 'ear', u: number, v: number, lowerLeg = false): Color {
  const L = c.look;
  if (part === 'leg') {
    if (L.pattern === 'socks' && lowerLeg) return c.accent;
    if (L.pattern === 'mask' && lowerLeg && isDark(c.base)) return c.accent; // tan points on black-and-tan dogs
    return c.base;
  }
  if (part === 'tail') return L.pattern === 'saddle' && u < 0.7 ? c.patch : c.base;
  if (part === 'ear') return L.pattern === 'mask' ? c.patch : c.base;
  if (part === 'body') {
    if (L.pattern === 'saddle' && v < 0.42 && u > 0.05 && u < 0.85) return c.patch;
    if (L.pattern === 'spots') {
      for (let i = 0; i < 3; i++) {
        const sx = 0.15 + hash2(i, 1, L.seed) * 0.7;
        const sy = 0.1 + hash2(i, 2, L.seed) * 0.5;
        const r = 0.16 + hash2(i, 3, L.seed) * 0.12;
        if ((u - sx) ** 2 * 2.2 + (v - sy) ** 2 < r * r) return c.patch;
      }
    }
    return c.base;
  }
  // head
  if (L.pattern === 'mask' && v < 0.55) return c.patch;
  if (L.pattern === 'spots' && hash2(5, 5, L.seed) > 0.5 && u < 0.5 && v < 0.6) return c.patch;
  return c.base;
}

function eye(c: Ctx, x: number, y: number, facing: 'right' | 'front', browDir = 1): void {
  const pc = c.pc;
  const e = hex(c.look.eye);
  const ex = Math.round(x);
  const ey = Math.round(y);
  const big = c.look.size !== 'small';
  if (c.pose.eyes === 'closed') {
    pc.hline(ex - (facing === 'front' ? 0 : 1), ex + 1, ey + 1, shade(e, 1.5));
    return;
  }
  if (c.pose.eyes === 'happy') {
    pc.set(ex, ey + 1, shade(e, 1.4));
    pc.set(ex + 1, ey, shade(e, 1.4));
    pc.set(ex + 2, ey + 1, shade(e, 1.4));
    return;
  }
  pc.rect(ex, ey, 2, big ? 3 : 2, e);
  pc.set(ex, ey, WHITE); // catchlight
  if (big) pc.set(ex + 1, ey + 2, shade(e, 1.6));
  if (c.st.angry) {
    // stern brow slanting toward the nose
    if (facing === 'right') {
      pc.set(ex - 1, ey - 2, NOSE);
      pc.set(ex, ey - 1, NOSE);
      pc.set(ex + 1, ey - 1, NOSE);
    } else {
      pc.set(ex + (browDir > 0 ? -1 : 2), ey - 2, NOSE);
      pc.set(ex, ey - 1, NOSE);
      pc.set(ex + 1, ey - 1, NOSE);
    }
  } else if (c.look.pattern === 'mask' && isDark(c.patch)) {
    // little tan eyebrow dots, like a black-and-tan street dog
    pc.set(ex, ey - 2, c.accent);
    pc.set(ex + 1, ey - 2, c.accent);
  }
}

// ------------------------------------------------------------------ side view (facing right)

interface LegPose {
  a: number;
  lift: number;
}

/** Trot: diagonal legs move together. Swing angle (deg, + = forward) and lift for each leg. */
function legAngles(step: number): { nearFore: LegPose; farFore: LegPose; nearHind: LegPose; farHind: LegPose } {
  if (step < 0) return { nearFore: { a: -2, lift: 0 }, farFore: { a: 4, lift: 0 }, nearHind: { a: 3, lift: 0 }, farHind: { a: -3, lift: 0 } };
  const ph = (step * Math.PI) / 2;
  const leg = (off: number, amp: number): LegPose => {
    const sw = Math.sin(ph + off);
    const forward = Math.cos(ph + off) > 0.3;
    return { a: sw * amp, lift: forward ? 1.6 : 0 };
  };
  return { nearFore: leg(0, 24), farHind: leg(0, 20), farFore: leg(Math.PI, 24), nearHind: leg(Math.PI, 20) };
}

function drawSide(c: Ctx): void {
  const { pc, s, pose, G, look } = c;
  const cx = 18.5;
  let hipX = cx - s.len / 2 + 1;
  let chestX = cx + s.len / 2 - 1;
  const bob = pose.step === 1 || pose.step === 3 ? -0.6 : 0;
  let chestY = G - s.leg - s.chest + 1.6 + bob;
  let hipY = G - s.leg - s.hip + 1.2 + bob;
  if (pose.sit) {
    hipY = G - s.hip * 0.95;
    hipX += 1.5;
    chestY -= 2.2;
    chestX -= 1;
  }
  if (pose.lie) {
    chestY = G - s.chest * 0.82;
    hipY = G - s.hip * 0.86;
  }
  const breathe = pose.breathe ?? 0;

  // far legs (darker, behind the body)
  const legs = legAngles(pose.step);
  if (!pose.lie && !pose.sit) {
    foreLeg(c, chestX + 1, chestY + s.chest * 0.45, legs.farFore, -2);
    hindLeg(c, hipX + 1.5, hipY + s.hip * 0.25, legs.farHind, -2);
  } else if (pose.sit) {
    foreLeg(c, chestX + 1.2, chestY + s.chest * 0.45, { a: 0, lift: 0 }, -2);
  }

  tailSide(c, hipX - s.hip * 0.85, hipY - s.hip * 0.45);

  // torso: chest + hips joined with a tucked belly
  const chestRy = s.chest + breathe;
  const hipRy = s.hip + breathe * 0.6;
  const chestTop = chestY - chestRy * 0.96;
  const hipTop = hipY - hipRy * 0.95;
  const chestBot = chestY + chestRy * 0.92;
  const hipBot = hipY + hipRy * 0.82;
  const tuck = pose.lie ? 0.4 : s.chest * 0.28;
  const x0 = Math.floor(hipX - s.hip * 1.1);
  const x1 = Math.ceil(chestX + s.chest * 1.05);
  const ribs = c.st.hungry && !pose.lie && !pose.sit;
  const bellyAt = (t: number) => hipBot + (chestBot - hipBot) * Math.max(0, t) ** 1.6 - tuck * Math.sin(Math.PI * Math.min(1, Math.max(0, t) * 1.15));
  for (let x = x0; x <= x1; x++) {
    for (let y = 0; y <= G; y++) {
      const px = x + 0.5;
      const py = y + 0.5;
      const inChest = ((px - chestX) / (s.chest * 1.05)) ** 2 + ((py - chestY) / chestRy) ** 2 <= 1;
      const inHip = ((px - hipX) / (s.hip * 1.1)) ** 2 + ((py - hipY) / hipRy) ** 2 <= 1;
      let inBand = false;
      let t = 0;
      if (px >= hipX && px <= chestX) {
        t = (px - hipX) / (chestX - hipX);
        const top = hipTop + (chestTop - hipTop) * t + Math.sin(t * Math.PI) * 0.4;
        inBand = py >= top && py <= bellyAt(t);
      }
      if (!inChest && !inHip && !inBand) continue;
      // u: 0 rump → 1 chest, v: 0 back → 1 belly
      const u = Math.max(0, Math.min(1, (px - (hipX - s.hip)) / (chestX + s.chest - (hipX - s.hip))));
      const topAt = hipTop + (chestTop - hipTop) * Math.max(0, Math.min(1, t || u));
      const botAt = Math.max(hipBot, chestBot);
      const v = Math.max(0, Math.min(1, (py - topAt) / (botAt - topAt)));
      let col = furColor(c, 'body', u, v);
      const chestFront = px > chestX - s.chest * 0.25 && v > 0.32;
      if (v > 0.74 || chestFront) col = c.accent;
      let l = v < 0.16 ? 2 : v < 0.34 ? 1 : v > 0.86 ? -2 : v > 0.68 ? -1 : 0;
      if (u < 0.1) l -= 1;
      if (hash2(x, y, look.seed) < 0.05) l -= 1; // fur strands
      if (look.coat === 'long' && (x + Math.floor(y * 0.6)) % 4 === 0 && v > 0.2) l -= 1;
      if (ribs && v > 0.35 && v < 0.7 && u > 0.45 && u < 0.75 && x % 2 === 0) l -= 1;
      pc.set(x, y, tone(col, Math.max(-2, Math.min(2, l))));
    }
  }
  if (look.coat === 'long' && !pose.lie) {
    // feathered belly and chest ruff
    for (let x = Math.round(hipX); x < chestX + s.chest * 0.6; x += 2) {
      const t = (x - hipX) / (chestX - hipX);
      const bot = bellyAt(t);
      const len = 1 + (hash2(x, 3, look.seed) > 0.5 ? 1 : 0);
      for (let k = 0; k < len; k++) pc.set(x, Math.round(bot) + k, tone(c.accent, -1));
    }
    pc.ellipse(chestX + s.chest * 0.7, chestY + 0.5, s.chest * 0.45, s.chest * 0.75, (nx) => tone(c.accent, nx < 0 ? 1 : 0));
  }

  // near legs
  if (pose.lie) {
    pc.capsule(chestX + 1, G - 1.2, chestX + s.chest + 3, G - 1, s.legR, (u) => tone(furColor(c, 'leg', u, 0, u > 0.6), u > 0.8 ? 1 : 0));
    pc.ellipse(hipX + 0.5, G - s.hip * 0.6, s.hip * 0.75, s.hip * 0.7, (nx, ny) => tone(c.base, ny < -0.3 ? 1 : nx > 0.4 ? -1 : 0));
  } else if (pose.sit) {
    pc.ellipse(hipX + 0.5, G - s.hip * 0.85, s.hip * 0.85, s.hip * 0.95, (nx, ny) => tone(c.base, ny < -0.4 ? 1 : ny > 0.5 ? -1 : nx > 0.5 ? -1 : 0));
    pc.capsule(hipX + 1, G - 1, hipX + s.hip + 2.5, G - 1, s.legR * 0.95, tone(furColor(c, 'leg', 1, 0, true), 0));
    foreLeg(c, chestX - 0.5, chestY + s.chest * 0.45, { a: 2, lift: 0 }, 0);
  } else {
    hindLeg(c, hipX, hipY + s.hip * 0.25, legs.nearHind, 0);
    foreLeg(c, chestX - 0.5, chestY + s.chest * 0.45, legs.nearFore, 0);
  }

  headSide(c, chestX, chestY, chestRy);
}

function foreLeg(c: Ctx, x: number, y: number, p: LegPose, l: number): void {
  const { pc, s, G } = c;
  const r = s.legR * (l < 0 ? 0.92 : 1);
  const a1 = rad(p.a * 0.8);
  const L1 = s.leg * 0.5;
  const kx = x + Math.sin(a1) * L1;
  const ky = y + Math.cos(a1) * L1;
  const footY = G - 0.8 - p.lift;
  // the forearm angles back a little when the leg is lifted (bent wrist)
  const fx = kx + Math.sin(rad(p.a * 0.4 - p.lift * 14)) * (footY - ky);
  pc.capsule(x, y, kx, ky, r * 1.15, (u, v) => tone(furColor(c, 'leg', u, v, false), l + (v > 0.3 ? -1 : 0)));
  pc.capsule(kx, ky, fx, footY, r, (u, v) => tone(furColor(c, 'leg', u, v, u > 0.35), l + (v > 0.3 ? -1 : 0)));
  pc.ellipse(fx + 0.8, footY + 0.2, r + 0.6, r * 0.75, tone(furColor(c, 'leg', 1, 0, true), l));
}

function hindLeg(c: Ctx, x: number, y: number, p: LegPose, l: number): void {
  const { pc, s, G } = c;
  const r = s.legR * (l < 0 ? 0.92 : 1);
  // thigh forward, shin back, hock down — the classic dog hind leg
  const t1 = rad(16 + p.a);
  const L1 = s.leg * 0.46;
  const kx = x + Math.sin(t1) * L1;
  const ky = y + Math.cos(t1) * L1;
  const t2 = rad(-38 + p.a * 0.6 - p.lift * 10);
  const L2 = s.leg * 0.38;
  const hx = kx + Math.sin(t2) * L2;
  const hy = ky + Math.cos(t2) * L2;
  const footY = G - 0.8 - p.lift;
  const fx = hx + Math.sin(rad(6 + p.a * 0.3)) * (footY - hy);
  const col = (lower: boolean) => (u: number, v: number) => tone(furColor(c, 'leg', u, v, lower && u > 0.3), l + (v > 0.3 ? -1 : 0));
  pc.capsule(x, y, kx, ky, r * 1.45, col(false)); // muscular thigh
  pc.capsule(kx, ky, hx, hy, r * 1.05, col(false));
  pc.capsule(hx, hy, fx, footY, r * 0.95, col(true));
  pc.ellipse(fx + 0.7, footY + 0.2, r + 0.5, r * 0.75, tone(furColor(c, 'leg', 1, 0, true), l));
  if (c.look.coat === 'long') pc.capsule(x - 1.5, y + 1, kx - 1.5, ky + 1, r * 0.8, tone(c.base, l - 1)); // trouser fur
}

function tailSide(c: Ctx, x: number, y: number): void {
  const { pc, look, pose, s } = c;
  const wag = [0, 1, -1][pose.tail] ?? 0;
  const fur = (u: number) => furColor(c, 'tail', u, 0);
  if (pose.lie) {
    pc.capsule(x + 1, c.G - 1.5, x - 5, c.G - 1.2, 1.3, (u) => tone(u > 0.8 ? c.accent : fur(u), 0));
    return;
  }
  if (pose.sit) {
    const tx = x - 3 - Math.abs(wag);
    pc.capsule(x + 1.5, c.G - 1.5, tx, c.G - 2 - (wag + 1), 1.2, (u) => tone(u > 0.85 ? c.accent : fur(u), 0));
    return;
  }
  const thick = look.tail === 'fluffy' ? 2.1 : look.coat === 'long' ? 1.6 : 1.2;
  switch (look.tail) {
    case 'curl': {
      // spitz-style ring over the back
      const ccx = x + 1.2 + wag * 0.3;
      const ccy = y - 3.2;
      const R = 2.8 + (s.hip > 5.5 ? 0.6 : 0);
      for (let a = 0; a < Math.PI * 1.65; a += 0.12) {
        const px = ccx - Math.cos(a) * R;
        const py = ccy - Math.sin(a) * R;
        pc.ellipse(px, py, thick, thick, tone(a > Math.PI * 1.3 ? c.accent : fur(a / 5), a < 1.2 ? 1 : 0));
      }
      break;
    }
    case 'straight': {
      // sabre tail held up and back
      const ang = rad(-55 + wag * 18);
      const ax = x - Math.cos(ang) * 4;
      const ay = y + Math.sin(ang) * 4;
      const bx = ax - Math.cos(ang - 0.6) * 4;
      const by = ay + Math.sin(ang - 0.6) * 4 - 0.5;
      pc.capsule(x, y, ax, ay, thick, (_u, v) => tone(fur(0.4), v < 0 ? 1 : -1));
      pc.capsule(ax, ay, bx, by, thick * 0.85, (u, v) => tone(u > 0.7 ? c.accent : fur(0.8), v < 0 ? 1 : -1));
      break;
    }
    case 'fluffy': {
      // plume
      const ang = rad(-35 + wag * 16);
      const ax = x - Math.cos(ang) * 4;
      const ay = y + Math.sin(ang) * 4 - 1;
      const bx = ax - 3;
      const by = ay - 1 + wag;
      pc.capsule(x, y, ax, ay, thick, (_u, v) => tone(fur(0.4), v < 0 ? 1 : 0));
      pc.capsule(ax, ay, bx, by, thick * 1.1, (u, v) => tone(u > 0.6 ? c.accent : fur(0.8), v < 0 ? 1 : -1));
      for (let i = 0; i < 4; i++) pc.set(Math.round(ax - i), Math.round(ay + thick + 0.5 + (i % 2)), tone(c.base, -1)); // feathering
      break;
    }
    default: {
      // low, relaxed tail hanging down
      const ang = rad(55 + wag * 10);
      const ax = x - Math.cos(ang) * 4;
      const ay = y + Math.sin(ang) * 4;
      const bx = ax - 1.5 - wag;
      const by = ay + 4;
      pc.capsule(x, y, ax, ay, thick, (_u, v) => tone(fur(0.4), v < 0 ? 0 : -1));
      pc.capsule(ax, ay, bx, by, thick * 0.9, (u) => tone(u > 0.75 ? c.accent : fur(0.8), -1));
    }
  }
}

function headSide(c: Ctx, chestX: number, chestY: number, chestRy: number): void {
  const { pc, s, pose, look, G } = c;
  const r = s.head;
  let hx = chestX + s.chest * 0.62 + r * 0.45;
  let hy = chestY - chestRy - r * 0.25;
  if (pose.head === 'up') hy -= pose.sit ? 2 : 1;
  if (pose.head === 'down') {
    hx += 2;
    hy = G - r * 1.05;
  }
  if (pose.head === 'rest') {
    hx = chestX + s.chest * 0.75 + r * 0.6;
    hy = G - r * 0.82;
  }
  // neck
  if (pose.head !== 'rest') {
    pc.capsule(chestX + s.chest * 0.25, chestY - chestRy * 0.35, hx - r * 0.25, hy + r * 0.2, s.chest * 0.55, (_u, v) =>
      tone(v > 0.2 ? c.accent : furColor(c, 'body', 0.9, 0.3), v < -0.4 ? 1 : 0),
    );
    if (look.coat === 'long') pc.ellipse(chestX + s.chest * 0.45, chestY - chestRy * 0.3, s.chest * 0.55, s.chest * 0.65, (nx) => tone(c.accent, nx > 0 ? 0 : 1));
  }

  // ears behind the skull
  const earCol = furColor(c, 'ear', 0, 0);
  const earTop = hy - r * 0.62;
  if (look.ears === 'up' || look.ears === 'half') {
    const h = look.ears === 'up' ? r * 1.15 : r * 0.8;
    const bx0 = hx - r * 0.55;
    const bx1 = hx + r * 0.08;
    const ax = hx - r * 0.32;
    pc.poly(
      [
        [bx0, earTop + 1],
        [ax, earTop - h],
        [bx1, earTop + 0.5],
      ],
      (x) => tone(earCol, x < ax ? 0 : -1),
    );
    pc.poly(
      [
        [bx0 + 1.2, earTop + 0.8],
        [ax + 0.2, earTop - h + 2.2],
        [bx1 - 1, earTop + 0.6],
      ],
      INNER_EAR,
    );
    if (look.ears === 'half') {
      pc.poly(
        [
          [ax - 0.8, earTop - h + 1.2],
          [ax + 2.2, earTop - h + 1.6],
          [ax + 0.4, earTop - h + 3.2],
        ],
        tone(earCol, -1),
      );
    }
  }

  // skull
  pc.ellipse(hx, hy, r * 0.95, r * 0.85, (nx, ny) => {
    const col = furColor(c, 'head', (nx + 1) / 2, (ny + 1) / 2);
    const d = nx * 0.3 + ny * 0.9;
    const l = d < -0.55 ? 2 : d < -0.2 ? 1 : d > 0.6 ? -1 : 0;
    if (ny > 0.25 && nx > -0.1) return tone(c.accent, l); // light cheek
    return tone(col, l);
  });

  // muzzle
  const len = { pointy: r * 0.95, normal: r * 0.72, short: r * 0.45 }[look.head];
  const down = pose.head === 'down' ? 1.2 : 0;
  const mx0 = hx + r * 0.25;
  const tipX = hx + r * 0.75 + len;
  const topY = hy - r * 0.18 + down;
  const botY = hy + r * 0.62 + down;
  pc.poly(
    [
      [mx0, topY - 0.4],
      [tipX - 0.6, topY + r * 0.12],
      [tipX + 0.4, topY + r * 0.32],
      [tipX - 0.3, botY - r * 0.18],
      [mx0 - 0.5, botY],
    ],
    (_x, y) => tone(c.accent, y < topY + 1 ? 1 : y > botY - 1.5 ? -1 : 0),
  );
  // nose
  const nx = Math.round(tipX - 1);
  const ny = Math.round(topY + r * 0.05);
  pc.rect(nx - 1, ny, 3, 2, NOSE);
  pc.set(nx, ny, shade(NOSE, 2.2)); // shiny
  // mouth
  const my = Math.round(botY - r * 0.28);
  if (pose.mouth === 'open') {
    pc.poly(
      [
        [mx0 + 1, my],
        [tipX - 1, my],
        [tipX - 2, my + 3],
        [mx0 + 1.5, my + 2],
      ],
      NOSE,
    );
    pc.rect(Math.round(mx0 + 2), my + 1, 2, 2, TONGUE);
    if (c.st.angry) {
      pc.set(Math.round(tipX - 2), my, WHITE);
      pc.set(Math.round(mx0 + 1.5), my, WHITE);
    }
  } else if (pose.mouth === 'smile') {
    pc.hline(Math.round(mx0 + 1), Math.round(tipX - 2), my, tone(c.accent, -2));
    pc.rect(Math.round(mx0 + 2), my + 1, 2, 2, TONGUE);
    pc.set(Math.round(mx0 + 2), my + 2, shade(TONGUE, 0.82));
  } else if (pose.mouth === 'chew') {
    pc.hline(Math.round(mx0 + 1), Math.round(tipX - 2), my + (c.frame % 2), tone(c.accent, -2));
  } else {
    pc.hline(Math.round(mx0 + 2), Math.round(tipX - 2), my, tone(c.accent, -2));
  }
  eye(c, hx + r * 0.12, hy - r * 0.38 + down * 0.5, 'right');
  if ((pose.mouth === 'smile' || pose.eyes === 'happy') && c.st.dirt < 0.4) pc.set(Math.round(hx + r * 0.3), Math.round(hy + r * 0.25), mix(c.accent, TONGUE, 0.5));

  if (look.ears === 'floppy') {
    pc.poly(
      [
        [hx - r * 0.62, earTop + 0.4],
        [hx - r * 0.02, earTop - 0.4],
        [hx + r * 0.05, hy + r * 0.25],
        [hx - r * 0.25, hy + r * 0.6],
        [hx - r * 0.6, hy + r * 0.35],
      ],
      (x, y) => tone(earCol, x > hx - r * 0.15 || y > hy + r * 0.3 ? -1 : 0),
    );
    if (look.coat === 'long') pc.set(Math.round(hx - r * 0.35), Math.round(hy + r * 0.65), tone(earCol, -1));
  }
  if (c.st.tagged) {
    const tx = Math.round(hx - r * 0.42);
    const ty = Math.round(look.ears === 'floppy' ? hy - r * 0.1 : earTop - 1);
    pc.rect(tx, ty, 2, 2, TAG);
    pc.set(tx + 1, ty + 1, shade(TAG, 0.75));
  }
}

// ------------------------------------------------------------------ front view (facing the camera)

function drawFront(c: Ctx): void {
  const { pc, s, pose, G, look } = c;
  const X = 20;
  const bob = pose.step === 1 || pose.step === 3 ? -0.6 : 0;
  const bodyCy = G - s.leg - s.chest * 0.35 + bob + (pose.sit ? -1 : 0);
  const legTop = G - s.leg + 1;
  const wag = [0, 1, -1][pose.tail] ?? 0;

  // tail peeking out behind the body
  if (!pose.sit) {
    const side = wag >= 0 ? 1 : -1;
    const tx = X + side * (s.chest + 1.5);
    pc.capsule(X + side * s.chest * 0.5, bodyCy - s.chest * 0.6, tx, bodyCy - s.chest - 2 - Math.abs(wag), look.tail === 'fluffy' ? 1.8 : 1.2, (u) =>
      tone(u > 0.8 ? c.accent : c.base, 0),
    );
  }

  if (!pose.sit) {
    // hind legs behind, slightly outward
    for (const side of [-1, 1]) {
      const lift = pose.step >= 0 && ((pose.step === 0 && side > 0) || (pose.step === 2 && side < 0)) ? 1 : 0;
      pc.capsule(X + side * s.chest * 0.85, legTop + 1, X + side * s.chest * 0.85, G - 0.8 - lift, s.legR, (_u, v) => tone(furColor(c, 'leg', 0, v, true), -2));
    }
  } else {
    // haunches on both sides and the tail curled on the ground
    for (const side of [-1, 1]) {
      pc.ellipse(X + side * s.chest * 0.95, G - s.hip * 0.7, s.hip * 0.62, s.hip * 0.78, (nx, ny) => tone(c.base, ny < -0.4 ? 1 : nx * side > 0.3 ? -1 : 0));
      pc.ellipse(X + side * s.chest * 0.75, G - 0.8, s.legR + 0.8, s.legR * 0.8, tone(furColor(c, 'leg', 1, 0, true), 0));
    }
    pc.capsule(X + s.chest * 0.6, G - 1, X + s.chest * 1.4 + Math.abs(wag), G - 1.5 - (wag + 1) * 0.6, 1.2, (u) => tone(u > 0.8 ? c.accent : c.base, 0));
  }

  // chest / body
  pc.ellipse(X, bodyCy, s.chest * 0.98, s.chest * 1.02, (nx, ny) => {
    let col = furColor(c, 'body', (nx + 1) / 2, (ny + 1) / 2);
    if (Math.abs(nx) < 0.45 && ny > -0.4) col = c.accent; // bib
    const l = nx < -0.55 ? 1 : nx > 0.55 ? -1 : ny > 0.7 ? -1 : 0;
    return tone(col, l - (hash2(Math.round(nx * 9), Math.round(ny * 9), look.seed) < 0.05 ? 1 : 0));
  });
  if (look.coat === 'long') pc.ellipse(X, bodyCy - s.chest * 0.2, s.chest * 0.55, s.chest * 0.7, (_nx, ny) => tone(c.accent, ny < -0.3 ? 1 : 0));

  // front legs
  for (const side of [-1, 1]) {
    const lift = pose.step >= 0 && ((pose.step === 0 && side < 0) || (pose.step === 2 && side > 0)) ? 1.5 : 0;
    const lx = X + side * s.chest * 0.42;
    pc.capsule(lx, bodyCy + s.chest * 0.3, lx, G - 0.9 - lift, s.legR * 1.05, (u, v) => tone(furColor(c, 'leg', u, v, u > 0.45), v * side > 0.3 ? -1 : 0));
    const py = G - 0.6 - lift;
    pc.ellipse(lx, py, s.legR + 0.8, s.legR * 0.75, tone(furColor(c, 'leg', 1, 0, true), 0));
    pc.set(Math.round(lx), Math.round(py), tone(furColor(c, 'leg', 1, 0, true), -1)); // toe split
  }

  headFront(c, X, bodyCy - s.chest * 0.95);
}

function headFront(c: Ctx, X: number, neckY: number): void {
  const { pc, s, pose, look } = c;
  const r = s.head;
  const hx = X;
  const hy = neckY - r * 0.55;
  const earCol = furColor(c, 'ear', 0, 0);
  if (look.ears === 'up' || look.ears === 'half') {
    for (const side of [-1, 1]) {
      const h = look.ears === 'up' ? r * 1.05 : r * 0.75;
      const b0 = hx + side * r * 0.25;
      const b1 = hx + side * r * 0.98;
      const ax = hx + side * r * 0.78;
      const ay = hy - r * 0.5 - h;
      pc.poly(
        [
          [b0, hy - r * 0.55],
          [ax, ay],
          [b1, hy - r * 0.2],
        ],
        (x) => tone(earCol, (x - hx) * side > r * 0.8 ? -1 : 0),
      );
      pc.poly(
        [
          [b0 + side * 1.2, hy - r * 0.55],
          [ax, ay + 2.2],
          [b1 - side * 1.2, hy - r * 0.3],
        ],
        INNER_EAR,
      );
      if (look.ears === 'half')
        pc.poly(
          [
            [ax - 1.2, ay + 0.8],
            [ax + 1.2, ay + 0.8],
            [ax - side * 0.5, ay + 3],
          ],
          tone(earCol, -1),
        );
    }
  }
  // skull
  pc.ellipse(hx, hy, r * 1.05, r * 0.92, (nx, ny) => {
    let col = furColor(c, 'head', (nx + 1) / 2, (ny + 1) / 2);
    if (look.pattern === 'mask' && Math.abs(nx) < 0.18 && ny < 0.2) col = c.accent; // blaze
    if (ny > 0.25 && Math.abs(nx) < 0.75) col = c.accent; // cheeks
    const l = ny < -0.55 ? 1 : nx > 0.6 ? -1 : 0;
    return tone(col, l);
  });
  // muzzle
  const mw = { pointy: 0.5, normal: 0.58, short: 0.62 }[look.head];
  const mh = { pointy: 0.45, normal: 0.38, short: 0.32 }[look.head];
  const my = hy + r * 0.42;
  pc.ellipse(hx, my, r * mw, r * mh, (_nx, ny) => tone(c.accent, ny > 0.4 ? -1 : ny < -0.4 ? 1 : 0));
  // nose
  const nyy = Math.round(my - r * mh * 0.65);
  pc.rect(Math.round(hx - 1.5), nyy, 3, 2, NOSE);
  pc.set(Math.round(hx - 1), nyy, shade(NOSE, 2.2));
  // mouth
  const mouthY = nyy + 2;
  if (pose.mouth === 'open') {
    pc.rect(Math.round(hx - 1.5), mouthY, 3, 2, NOSE);
    pc.set(Math.round(hx - 0.5), mouthY + 1, TONGUE);
    if (c.st.angry) {
      pc.set(Math.round(hx - 1.5), mouthY, WHITE);
      pc.set(Math.round(hx + 1.5), mouthY, WHITE);
    }
  } else {
    pc.set(Math.round(hx - 0.5), mouthY, tone(c.accent, -2));
    pc.set(Math.round(hx - 1.5), mouthY + 1, tone(c.accent, -2));
    pc.set(Math.round(hx + 0.5), mouthY + 1, tone(c.accent, -2));
    if (pose.mouth === 'smile') pc.rect(Math.round(hx - 0.5), mouthY + 1, 2, 2, TONGUE);
  }
  // eyes
  const ex = r * 0.48;
  eye(c, hx - ex - 1, hy - r * 0.2, 'front', 1);
  eye(c, hx + ex - 1, hy - r * 0.2, 'front', -1);
  if ((pose.mouth === 'smile' || pose.eyes === 'happy') && c.st.dirt < 0.4) {
    pc.set(Math.round(hx - ex - 1.5), Math.round(hy + r * 0.25), mix(c.accent, TONGUE, 0.5));
    pc.set(Math.round(hx + ex + 0.5), Math.round(hy + r * 0.25), mix(c.accent, TONGUE, 0.5));
  }
  if (look.ears === 'floppy') {
    for (const side of [-1, 1]) {
      pc.poly(
        [
          [hx + side * r * 0.55, hy - r * 0.78],
          [hx + side * r * 1.25, hy - r * 0.45],
          [hx + side * r * 1.25, hy + r * 0.35],
          [hx + side * r * 0.95, hy + r * 0.55],
          [hx + side * r * 0.75, hy - r * 0.1],
        ],
        (x) => tone(earCol, (x - hx) * side > r * 1.05 ? -1 : 0),
      );
    }
  }
  if (c.st.tagged) {
    const tx = Math.round(hx - r * 0.95 - (look.ears === 'floppy' ? 0.5 : 0));
    const ty = Math.round(hy - r * 0.55);
    pc.rect(tx, ty, 2, 2, TAG);
    pc.set(tx + 1, ty + 1, shade(TAG, 0.75));
  }
}

// ------------------------------------------------------------------ back view (walking away)

function drawBack(c: Ctx): void {
  const { pc, s, pose, G, look } = c;
  const X = 20;
  const bob = pose.step === 1 || pose.step === 3 ? -0.6 : 0;
  const rumpCy = G - s.leg - s.hip * 0.25 + bob;
  const wag = [0, 1, -1][pose.tail] ?? 0;

  // head beyond the body
  const r = s.head;
  const hy = rumpCy - s.hip - r * 0.35;
  const earCol = furColor(c, 'ear', 0, 0);
  if (look.ears === 'up' || look.ears === 'half') {
    for (const side of [-1, 1]) {
      const h = look.ears === 'up' ? r * 1.05 : r * 0.75;
      pc.poly(
        [
          [X + side * r * 0.25, hy - r * 0.4],
          [X + side * r * 0.78, hy - r * 0.4 - h],
          [X + side * r * 1.0, hy - r * 0.05],
        ],
        tone(earCol, 0),
      );
    }
  }
  pc.ellipse(X, hy, r * 1.0, r * 0.85, (nx, ny) => tone(furColor(c, 'head', (nx + 1) / 2, 0.2), ny < -0.5 ? 1 : nx > 0.5 ? -1 : 0));
  if (look.ears === 'floppy') {
    for (const side of [-1, 1]) {
      pc.poly(
        [
          [X + side * r * 0.55, hy - r * 0.7],
          [X + side * r * 1.2, hy - r * 0.35],
          [X + side * r * 1.15, hy + r * 0.45],
          [X + side * r * 0.8, hy + r * 0.3],
        ],
        tone(earCol, -1),
      );
    }
  }
  if (c.st.tagged) pc.rect(Math.round(X - r * 0.95), Math.round(hy - r * 0.45), 2, 2, TAG);

  // front legs barely visible
  for (const side of [-1, 1]) pc.capsule(X + side * s.chest * 0.75, rumpCy, X + side * s.chest * 0.75, G - 0.8, s.legR * 0.9, tone(c.base, -2));

  // body and rump seen from behind
  pc.ellipse(X, rumpCy - s.hip * 0.4, s.chest * 0.95, s.chest * 0.85, (nx, ny) => tone(furColor(c, 'body', 0.5, (ny + 1) / 2), ny < -0.5 ? 1 : nx > 0.5 ? -1 : 0));
  pc.ellipse(X, rumpCy, s.hip * 1.05, s.hip, (nx, ny) => {
    let col = furColor(c, 'body', 0.1, (ny + 1) / 2);
    if (ny > 0.55 && Math.abs(nx) < 0.35) col = c.accent;
    return tone(col, ny < -0.5 ? 1 : nx > 0.55 ? -1 : 0);
  });

  // hind legs
  for (const side of [-1, 1]) {
    const lift = pose.step >= 0 && ((pose.step === 0 && side < 0) || (pose.step === 2 && side > 0)) ? 1.5 : 0;
    const lx = X + side * s.hip * 0.55;
    pc.capsule(lx, rumpCy + s.hip * 0.3, lx, G - 0.9 - lift, s.legR * 1.1, (u, v) => tone(furColor(c, 'leg', u, v, u > 0.5), v * side > 0.3 ? -1 : 0));
    pc.ellipse(lx, G - 0.6 - lift, s.legR + 0.6, s.legR * 0.7, tone(furColor(c, 'leg', 1, 0, true), -1));
  }

  // tail up, wagging
  const tailCol = (u: number) => tone(u > 0.75 ? c.accent : furColor(c, 'tail', u, 0), 0);
  const topY = rumpCy - s.hip * 0.9;
  if (look.tail === 'low') {
    pc.capsule(X, topY + 1, X + wag * 2, topY + s.hip + 2, 1.2, tailCol);
  } else if (look.tail === 'curl') {
    for (let a = 0; a < Math.PI * 1.5; a += 0.15) pc.ellipse(X + wag + Math.cos(a) * 2.5, topY - 2.5 - Math.sin(a) * 2.5, 1.3, 1.3, tailCol(a / 5));
  } else {
    const thick = look.tail === 'fluffy' ? 2 : 1.3;
    pc.capsule(X, topY + 1, X + wag * 2.5, topY - 4, thick, tailCol);
    pc.capsule(X + wag * 2.5, topY - 4, X + wag * 4, topY - 7, thick * 0.9, (u) => tailCol(0.5 + u * 0.5));
  }
}

// ------------------------------------------------------------------ dirt, shake, etc.

function postProcess(c: Ctx): void {
  const { pc, pose, look, st } = c;
  if (pose.shake) {
    const copy = pc.data.slice();
    for (let y = 0; y < c.G - 3; y++) {
      const off = ((y >> 1) & 1 ? 1 : -1) * pose.shake;
      for (let x = 0; x < pc.w; x++) {
        const sx = x - off;
        pc.data[y * pc.w + x] = sx >= 0 && sx < pc.w ? copy[y * pc.w + sx] : 0;
      }
    }
    const drop = hex('#8fd3ff');
    for (let i = 0; i < 9; i++) {
      const a = hash2(i, c.frame, look.seed) * Math.PI * 2;
      const x = 19 + Math.cos(a) * (c.s.len * 0.75 + 2 + hash2(i, 7, look.seed) * 3);
      const y = c.G - c.s.leg - 3 + Math.sin(a) * (c.s.chest + 4);
      if (!pc.isSolid(x, y)) pc.set(x, y, drop);
    }
  }
  if (st.dirt > 0.05) {
    for (let y = 0; y < pc.h; y++) {
      for (let x = 0; x < pc.w; x++) {
        if (!pc.isSolid(x, y)) continue;
        let col = pc.get(x, y);
        if (col === NOSE || col === WHITE || col === TAG || col === TONGUE || col === INNER_EAR) continue;
        col = mix(col, DUST, 0.35 * st.dirt);
        const low = Math.max(0, (y - 10) / 20); // mud collects lower on the body and on the legs
        // clumps (2×2 blocks) read as mud patches instead of noise
        const n = hash2(x >> 1, y >> 1, look.seed);
        if (n < st.dirt * (0.04 + low * 0.38)) col = mix(col, MUD, 0.7);
        else if (hash2(x, y, look.seed + 1) > 1 - st.dirt * 0.04) col = shade(col, 0.8); // matted tufts
        pc.set(x, y, col);
      }
    }
    if (st.dirt > 0.6) {
      // a few burrs and twigs stuck in the fur
      for (let i = 0; i < 3; i++) {
        const x = Math.round(12 + hash2(i, 11, look.seed) * 16);
        const y = Math.round(10 + hash2(i, 12, look.seed) * 10);
        if (pc.isSolid(x, y) && pc.isSolid(x + 1, y)) pc.set(x, y, hex('#5a4630'));
      }
    }
  }
}

/** Builds a horizontal strip with all frames for one dog. */
export function drawDogSheet(look: DogLook, st: DogLookState): PixelCanvas {
  const sheet = new PixelCanvas(DOG_FRAME_W * FRAME_COUNT, DOG_FRAME_H);
  for (let f = 0; f < FRAME_COUNT; f++) sheet.blit(drawDogFrame(look, f, st), f * DOG_FRAME_W, 0);
  return sheet;
}

export const DOG_FRAME_COUNT = FRAME_COUNT;

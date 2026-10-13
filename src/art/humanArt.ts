import { Color, hex, shade } from './color';
import { PixelCanvas } from './PixelCanvas';

export const HUMAN_W = 20;
export const HUMAN_H = 30;
/** feet stand on the bottom edge of row 28 */
export const HUMAN_ORIGIN_Y = 29 / HUMAN_H;

export type Dir = 'down' | 'up' | 'side';

export interface HumanLook {
  skin: string;
  hair: string;
  hairStyle: 'ponytail' | 'short' | 'bun' | 'long' | 'bob';
  hat?: { kind: 'cap' | 'scarf' | 'beanie'; color: string };
  top: string;
  topStyle: 'vest' | 'hoodie' | 'cardigan' | 'tshirt' | 'overalls' | 'jacket';
  /** vest / overall colour, or a second colour for the top */
  accent?: string;
  bottom: string;
  bottomStyle: 'pants' | 'skirt' | 'shorts';
  shoes: string;
  glasses?: boolean;
  beard?: boolean;
  /** kids are shorter with bigger heads */
  small?: boolean;
}

export interface HumanPose {
  dir: Dir;
  /** walk cycle 0..3, -1 standing */
  step: number;
  arms: 'swing' | 'up' | 'throw' | 'knit' | 'wave' | 'crouch';
  breathe?: number;
  blink?: boolean;
  sit?: boolean;
  crouch?: boolean;
}

const EYE = hex('#2a1e22');
const BLUSH = hex('#f39a8f');
const STRIPE = hex('#f4f1c8');

const t = (c: Color, l: number): Color => (l >= 2 ? shade(c, 1.22) : l === 1 ? shade(c, 1.1) : l === 0 ? c : l === -1 ? shade(c, 0.84) : shade(c, 0.7));

/** A townsperson or the hero, drawn from simple capsule limbs with soft shading. 20×30. */
export function drawHuman(look: HumanLook, pose: HumanPose): PixelCanvas {
  const pc = new PixelCanvas(HUMAN_W, HUMAN_H);
  const skin = hex(look.skin);
  const hair = hex(look.hair);
  const top = hex(look.top);
  const acc = hex(look.accent ?? look.top);
  const bottom = hex(look.bottom);
  const shoes = hex(look.shoes);
  const kid = !!look.small;
  const G = 28; // ground row (feet bottom)
  const walking = pose.step >= 0;
  const bob = (walking && pose.step % 2 === 1 ? -1 : 0) + (pose.crouch ? 3 : 0);
  const breathe = pose.breathe ?? 0;

  // proportions
  const legLen = kid ? 5 : 7;
  const hipY = G - legLen - (pose.sit ? -2 : 0) + bob;
  const torsoH = kid ? 6 : 8;
  const shoulderY = hipY - torsoH + breathe;
  const headR = kid ? 5.2 : 5.4;
  const headCy = shoulderY - headR + 0.5 + (pose.crouch ? 0 : 0);
  const cx = 10;
  const side = pose.dir === 'side';
  const back = pose.dir === 'up';
  const torsoW = side ? 7 : kid ? 8 : 9;

  // ---------------- legs
  const legR = kid ? 1.3 : 1.5;
  const drawLeg = (hx: number, footX: number, footY: number, kneeX: number, kneeY: number, l: number, front: boolean) => {
    const col = look.bottomStyle === 'skirt' ? skin : bottom;
    const thighCol = look.bottomStyle === 'shorts' || look.bottomStyle === 'skirt' ? bottom : col;
    pc.capsule(hx, hipY + 0.5, kneeX, kneeY, legR + 0.2, (_u, v) => t(thighCol, l + (v > 0.4 ? -1 : 0)));
    pc.capsule(kneeX, kneeY, footX, footY - 1, legR, (_u, v) => t(look.bottomStyle === 'pants' ? bottom : skin, l + (v > 0.4 ? -1 : 0)));
    // shoe
    if (side) {
      pc.rect(Math.round(footX - 1), Math.round(footY - 1), 4, 2, t(shoes, l));
      pc.hline(Math.round(footX - 1), Math.round(footX + 2), Math.round(footY), t(shoes, l - 2));
    } else {
      pc.rect(Math.round(footX - 1.5), Math.round(footY - 1), 3, 2, t(shoes, l));
      pc.hline(Math.round(footX - 1.5), Math.round(footX + 1.5), Math.round(footY), t(shoes, l - 2));
      if (front && !back) pc.set(Math.round(footX - 0.5), Math.round(footY - 1), t(shoes, l + 1));
    }
  };

  if (pose.sit) {
    // sitting on a bench: thighs forward (toward camera), shins down
    for (const s of [-1, 1]) {
      const hx = cx + s * 2;
      pc.rect(Math.round(hx - 1.5), Math.round(hipY - 1), 3, 4, look.bottomStyle === 'pants' ? bottom : bottom);
      pc.capsule(hx, hipY + 3, hx, G - 1, legR, look.bottomStyle === 'pants' ? bottom : skin);
      pc.rect(Math.round(hx - 1.5), G - 1, 3, 2, shoes);
    }
  } else if (side) {
    // stride with bending knees
    const sw = walking ? [1, 0, -1, 0][pose.step] : 0;
    const lift = (n: number) => (walking && ((pose.step === 1 && n === 0) || (pose.step === 3 && n === 1)) ? 2 : 0);
    const legs = [
      { off: sw * 3, n: 0, l: -1 }, // far leg
      { off: -sw * 3, n: 1, l: 0 }, // near leg
    ];
    for (const leg of legs) {
      const fy = G - lift(leg.n);
      const fx = cx + leg.off;
      const kx = cx + leg.off * 0.5 + (lift(leg.n) ? 1.5 : 0);
      const ky = hipY + legLen * 0.5 - (lift(leg.n) ? 1 : 0);
      if (pose.crouch) drawLeg(cx, cx + 2 - leg.n, G, cx + 3, hipY + 1, leg.l, leg.n === 1);
      else drawLeg(cx, fx, fy, kx, ky, leg.l, leg.n === 1);
    }
  } else {
    for (const s of [-1, 1]) {
      const n = s < 0 ? 0 : 1;
      const lift = walking && ((pose.step === 0 && n === 0) || (pose.step === 2 && n === 1)) ? 1.5 : 0;
      const hx = cx + s * 2;
      const fx = cx + s * 2.3;
      if (pose.crouch) drawLeg(hx, cx + s * 3.5, G, cx + s * 4, hipY + 1.5, s > 0 ? -1 : 0, true);
      else drawLeg(hx, fx, G - lift, hx + s * 0.3, hipY + legLen * 0.5 - lift * 0.5, s > 0 ? -1 : 0, true);
    }
  }

  // ---------------- back arm (side view: far arm first)
  const armR = kid ? 1.1 : 1.25;
  const sleeve = look.topStyle === 'tshirt' || look.topStyle === 'overalls' ? skin : look.topStyle === 'vest' ? hex('#f6f2ea') : top;
  const shoulderL = { x: cx - torsoW / 2 + 0.5, y: shoulderY + 1.5 };
  const shoulderR = { x: cx + torsoW / 2 - 0.5, y: shoulderY + 1.5 };
  const armLen = kid ? 5 : 6.5;
  const drawArm = (sx: number, sy: number, hx: number, hy: number, l: number) => {
    const ex = (sx + hx) / 2 + (hx > sx ? 0.4 : -0.4);
    const ey = (sy + hy) / 2;
    pc.capsule(sx, sy, ex, ey, armR + 0.15, (_u, v) => t(look.topStyle === 'tshirt' ? top : sleeve, l + (v > 0.4 ? -1 : 0)));
    pc.capsule(ex, ey, hx, hy, armR, (_u, v) => t(sleeve, l + (v > 0.4 ? -1 : 0)));
    pc.ellipse(hx, hy + 0.3, armR + 0.3, armR + 0.3, t(skin, l));
  };
  const swing = walking ? [1, 0, -1, 0][pose.step] : 0;
  let frontArm: (() => void) | null = null;
  if (side) {
    const sx = cx + 0.5;
    const sy = shoulderY + 1.5;
    if (pose.arms === 'up') {
      drawArm(sx - 1, sy, sx - 0.5, sy - 7, -1);
      frontArm = () => drawArm(sx + 1, sy, sx + 1.5, sy - 7, 0);
    } else if (pose.arms === 'throw') {
      drawArm(sx - 1, sy, sx - 3, sy + armLen - 1, -1);
      frontArm = () => drawArm(sx, sy, sx + 5, sy - 4, 0);
    } else if (pose.arms === 'crouch') {
      frontArm = () => drawArm(sx, sy, sx + 5, sy + 4, 0);
    } else {
      drawArm(sx, sy, sx - swing * 3, sy + armLen, -1);
      frontArm = () => drawArm(sx, sy, sx + swing * 3, sy + armLen, 0);
    }
  } else if (back) {
    // in back view arms are drawn behind the torso only when raised
    if (pose.arms === 'up') {
      drawArm(shoulderL.x, shoulderL.y, shoulderL.x - 0.5, shoulderY - 6, 0);
      drawArm(shoulderR.x, shoulderR.y, shoulderR.x + 0.5, shoulderY - 6, -1);
    }
  }

  // ---------------- torso
  const tx0 = cx - torsoW / 2;
  const tyTop = shoulderY;
  const tyBot = hipY + 1;
  for (let y = Math.floor(tyTop); y <= Math.ceil(tyBot); y++) {
    const yy = y + 0.5 - tyTop;
    // rounded shoulders, slightly wider at the hips for skirts and cardigans
    const inset = yy < 1 ? 1 : 0;
    const flare = look.bottomStyle === 'skirt' && y > hipY - 1 ? 1 : 0;
    for (let x = Math.floor(tx0 + inset - flare); x < Math.ceil(tx0 + torsoW - inset + flare); x++) {
      const u = (x + 0.5 - tx0) / torsoW; // 0 left → 1 right
      let col = top;
      if (look.topStyle === 'vest' || look.topStyle === 'overalls') {
        const centre = Math.abs(u - 0.5) < (side ? 0.12 : 0.14);
        if (look.topStyle === 'vest') col = !back && !side && centre ? hex('#f6f2ea') : acc;
        else col = yy > 2 ? acc : top;
      }
      if (look.topStyle === 'cardigan' && !back && !side && Math.abs(u - 0.5) < 0.1) col = shade(top, 0.8);
      if (look.topStyle === 'jacket' && !back && !side && Math.abs(u - 0.5) < 0.06) col = shade(top, 0.7);
      if (y > hipY - 1 && look.bottomStyle !== 'skirt') col = look.topStyle === 'overalls' ? acc : bottom;
      if (look.bottomStyle === 'skirt' && y > hipY - 1) col = bottom;
      const l = side ? (u > 0.65 ? -1 : u < 0.2 ? 1 : 0) : u < 0.18 ? 1 : u > 0.78 ? -1 : 0;
      pc.set(x, y, t(col, l + (yy < 1.2 ? 1 : 0)));
    }
  }
  if (look.topStyle === 'vest') {
    // reflective stripe on each half of the vest (not across the shirt, so it doesn't read as a cross)
    const sy = Math.round(shoulderY + torsoH * 0.6);
    if (side || back) pc.hline(Math.round(tx0 + 1), Math.round(tx0 + torsoW - 2), sy, STRIPE);
    else {
      pc.hline(Math.round(tx0 + 1), Math.round(cx - 2), sy, STRIPE);
      pc.hline(Math.round(cx + 1), Math.round(tx0 + torsoW - 2), sy, STRIPE);
    }
  }
  if (look.topStyle === 'hoodie' && !back && !side) {
    pc.set(cx - 1, Math.round(shoulderY + 1), hex('#f6f2ea'));
    pc.set(cx + 1, Math.round(shoulderY + 1), hex('#f6f2ea'));
    pc.set(cx - 1, Math.round(shoulderY + 2), hex('#f6f2ea'));
    pc.set(cx + 1, Math.round(shoulderY + 2), hex('#f6f2ea'));
  }
  if (look.topStyle === 'vest' && back) {
    // paw print on the back of the volunteer vest
    const py = Math.round(shoulderY + 2);
    const paw = hex('#f6f2ea');
    pc.rect(cx - 1, py + 2, 2, 2, paw);
    pc.set(cx - 2, py + 1, paw);
    pc.set(cx + 1, py + 1, paw);
    pc.set(cx - 1, py, paw);
    pc.set(cx, py, paw);
  }
  if (look.topStyle === 'overalls' && !back) {
    pc.set(Math.round(tx0 + 2), Math.round(shoulderY + 2), hex('#e8d8a0'));
    pc.set(Math.round(tx0 + torsoW - 3), Math.round(shoulderY + 2), hex('#e8d8a0'));
  }

  // ---------------- front arms
  if (!side && !back) {
    if (pose.arms === 'up') {
      drawArm(shoulderL.x, shoulderL.y, shoulderL.x - 0.5, shoulderY - 6, 1);
      drawArm(shoulderR.x, shoulderR.y, shoulderR.x + 0.5, shoulderY - 6, -1);
    } else if (pose.arms === 'throw') {
      drawArm(shoulderL.x, shoulderL.y, shoulderL.x - 1, shoulderL.y + armLen, 0);
      drawArm(shoulderR.x, shoulderR.y, shoulderR.x + 2.5, shoulderY - 5, -1);
    } else if (pose.arms === 'knit' || pose.arms === 'crouch') {
      drawArm(shoulderL.x, shoulderL.y, cx - 1.5, shoulderL.y + armLen - 2, 0);
      drawArm(shoulderR.x, shoulderR.y, cx + 1.5, shoulderR.y + armLen - 2, -1);
      if (pose.arms === 'knit') {
        pc.set(cx, Math.round(shoulderL.y + armLen - 3), hex('#e0453f'));
        pc.set(cx + 1, Math.round(shoulderL.y + armLen - 2), hex('#e0453f'));
        pc.line(cx - 3, shoulderL.y + armLen - 4, cx + 3, shoulderL.y + armLen - 1, hex('#c9c6cf')); // needles
      }
    } else if (pose.arms === 'wave') {
      drawArm(shoulderL.x, shoulderL.y, shoulderL.x - 1, shoulderL.y + armLen, 0);
      drawArm(shoulderR.x, shoulderR.y, shoulderR.x + 3, shoulderY - 4, -1);
    } else {
      drawArm(shoulderL.x, shoulderL.y, shoulderL.x - 1 + swing * 0.5, shoulderL.y + armLen + swing * 0.5, 0);
      drawArm(shoulderR.x, shoulderR.y, shoulderR.x + 1 - swing * 0.5, shoulderR.y + armLen - swing * 0.5, -1);
    }
  } else if (back && pose.arms !== 'up') {
    drawArm(shoulderL.x, shoulderL.y, shoulderL.x - 1 - swing * 0.5, shoulderL.y + armLen - swing * 0.5, 0);
    drawArm(shoulderR.x, shoulderR.y, shoulderR.x + 1 + swing * 0.5, shoulderR.y + armLen + swing * 0.5, -1);
  }

  // ---------------- head
  drawHead(pc, look, pose, cx + (side ? 0.5 : 0), headCy, headR, skin, hair);

  if (frontArm) frontArm();

  pc.outline(0.4);
  return pc;
}

function drawHead(pc: PixelCanvas, look: HumanLook, pose: HumanPose, hx: number, hy: number, r: number, skin: Color, hair: Color): void {
  const side = pose.dir === 'side';
  const back = pose.dir === 'up';
  const hat = look.hat;
  // hair behind the head (long hair, ponytail, bun)
  if (look.hairStyle === 'long' && !side) pc.rect(Math.round(hx - r), Math.round(hy), Math.round(r * 2), Math.round(r + 2), t(hair, -1));
  if (look.hairStyle === 'ponytail') {
    const swing = pose.step >= 0 ? [1, 0, -1, 0][pose.step] : 0;
    if (side) pc.capsule(hx - r + 1.5, hy - 0.5, hx - r - 0.8 - swing * 0.5, hy + 3.5, 1.1, (_u, v) => t(hair, v > 0 ? -1 : 0));
    else if (back) pc.capsule(hx, hy, hx + swing * 0.5, hy + r + 2.5, 1.5, (_u, v) => t(hair, v > 0 ? -1 : 0));
  }
  if (look.hairStyle === 'bun' && !hat) pc.ellipse(hx + (side ? -r * 0.6 : 0), hy - r + 0.5, 2.2, 2, t(hair, 0));

  // skull + face
  pc.ellipse(hx, hy, r, r * 0.96, (nx, ny) => t(skin, nx < -0.5 && ny < 0 ? 1 : nx > 0.55 || ny > 0.75 ? -1 : 0));
  if (side) pc.set(Math.round(hx + r - 0.2), Math.round(hy + 0.5), t(skin, 0)); // nose

  // hair on top / sides
  const hairTop = (fill: (nx: number, ny: number) => boolean) =>
    pc.ellipseMask(hx, hy, r + 0.3, r * 0.98 + 0.3, (nx, ny) => (fill(nx, ny) ? t(hair, ny < -0.6 && nx < 0 ? 1 : nx > 0.6 ? -1 : 0) : null));
  if (back) {
    // whole back of the head is hair
    pc.ellipse(hx, hy, r + 0.3, r + 0.2, (nx, ny) => t(hair, ny < -0.5 && nx < 0 ? 1 : nx > 0.5 ? -1 : 0));
  } else if (side) {
    hairTop((nx, ny) => ny < -0.35 || (nx < -0.25 && ny < 0.55));
  } else {
    // fringe
    const fringe = look.hairStyle === 'bob' || look.hairStyle === 'long' ? -0.25 : -0.4;
    hairTop((nx, ny) => ny < fringe + Math.abs(nx) * 0.25 || (Math.abs(nx) > 0.82 && ny < 0.55));
  }
  // face details
  if (!back) {
    const ey = Math.round(hy + 0.3);
    if (side) {
      const ex = Math.round(hx + r * 0.45);
      if (pose.blink) pc.hline(ex, ex + 1, ey + 1, EYE);
      else {
        pc.rect(ex, ey, 1, 2, EYE);
        pc.set(ex, ey, shade(EYE, 3));
      }
      pc.set(ex - 1, ey - 1, t(hair, -1)); // brow
      pc.set(Math.round(hx + r * 0.3), ey + 2, BLUSH);
      pc.set(Math.round(hx + r * 0.65), ey + 3, t(skin, -2)); // mouth
      if (look.glasses) pc.rect(ex - 1, ey - 0, 3, 1, hex('#8d8d95'));
    } else {
      const lx = Math.round(hx - 2.6);
      const rx = Math.round(hx + 1.6);
      for (const ex of [lx, rx]) {
        if (pose.blink) pc.hline(ex, ex + 1, ey + 1, EYE);
        else {
          pc.rect(ex, ey, 2, 2, EYE);
          pc.set(ex, ey, shade(EYE, 3.2)); // catchlight
        }
        pc.hline(ex, ex + 1, ey - 2, t(hair, -1)); // brows
      }
      pc.set(lx - 1, ey + 2, BLUSH);
      pc.set(rx + 2, ey + 2, BLUSH);
      pc.hline(Math.round(hx - 0.5), Math.round(hx + 0.5), ey + 3, t(skin, -2)); // smile
      pc.set(Math.round(hx - 1.5), ey + 2, t(skin, -1));
      if (look.glasses) {
        // thin round-ish frames around the eyes, bridge in the middle
        const g = hex('#8d8d95');
        for (const ex of [lx, rx]) {
          pc.hline(ex - 1, ex + 2, ey - 1, g);
          pc.set(ex - 1, ey, g);
          pc.set(ex - 1, ey + 1, g);
          pc.set(ex + 2, ey, g);
          pc.set(ex + 2, ey + 1, g);
          pc.hline(ex, ex + 1, ey + 2, g);
        }
        pc.set(Math.round(hx), ey, g);
      }
      if (look.beard) {
        pc.ellipse(hx, hy + r * 0.62, r * 0.7, r * 0.4, (_nx, ny) => t(hair, ny > 0.3 ? -1 : 0));
        pc.hline(Math.round(hx - 0.5), Math.round(hx + 0.5), ey + 3, t(skin, -2));
      }
    }
  }

  // hats
  if (hat) {
    const hc = hex(hat.color);
    if (hat.kind === 'cap') {
      pc.ellipseMask(hx, hy - r * 0.45, r + 0.2, r * 0.62, (nx, ny) => (ny < 0.35 ? t(hc, nx < -0.3 && ny < -0.3 ? 1 : nx > 0.5 ? -1 : 0) : null));
      if (side) pc.rect(Math.round(hx + r * 0.3), Math.round(hy - r * 0.35), 4, 1, t(hc, -1));
      else if (!back) {
        pc.hline(Math.round(hx - r + 0.5), Math.round(hx + r - 0.5), Math.round(hy - r * 0.32), t(hc, -1));
        pc.set(Math.round(hx), Math.round(hy - r * 0.7), hex('#f6f2ea')); // badge
      } else pc.hline(Math.round(hx - 1), Math.round(hx + 1), Math.round(hy - r * 0.25), t(hc, -2));
    } else if (hat.kind === 'beanie') {
      pc.ellipseMask(hx, hy - r * 0.4, r + 0.3, r * 0.68, (_nx, ny) => (ny < 0.4 ? t(hc, ny < -0.4 ? 1 : 0) : null));
      pc.hline(Math.round(hx - r), Math.round(hx + r), Math.round(hy - r * 0.15), t(hc, -1));
      pc.ellipse(hx, hy - r - 0.8, 1.4, 1.2, t(hc, 1));
    } else {
      // headscarf (платок) with polka dots, tied under the chin
      pc.ellipseMask(hx, hy - 0.5, r + 0.6, r + 0.4, (nx, ny) => {
        const inFace = !back && !side && Math.abs(nx) < 0.62 && ny > -0.35;
        const inFaceSide = side && nx > -0.1 && ny > -0.35;
        if (inFace || inFaceSide) return null;
        const dot = (Math.round(nx * 6) + Math.round(ny * 6)) % 3 === 0;
        return t(hc, dot ? 2 : nx > 0.5 ? -1 : 0);
      });
      if (!back && !side) {
        pc.set(Math.round(hx - 1), Math.round(hy + r), t(hc, -1));
        pc.set(Math.round(hx + 1), Math.round(hy + r), t(hc, -1));
      }
    }
  }
}

/** All frames of a front-facing NPC: 0 idle, 1 blink, 2 action, 3 sit. */
export function drawPersonFrames(look: HumanLook, action: HumanPose['arms'] = 'wave'): PixelCanvas[] {
  return [
    drawHuman(look, { dir: 'down', step: -1, arms: 'swing' }),
    drawHuman(look, { dir: 'down', step: -1, arms: 'swing', blink: true }),
    drawHuman(look, { dir: 'down', step: -1, arms: action }),
    drawHuman(look, { dir: 'down', step: -1, arms: action === 'wave' ? 'swing' : action, sit: true }),
  ];
}

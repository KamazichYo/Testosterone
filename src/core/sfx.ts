import { gameState } from './state';

/**
 * Tiny synthesized sound effects (WebAudio) — no audio files to download, works offline.
 * The context is unlocked on the first user gesture (required on iOS).
 */
let ctx: AudioContext | null = null;

export function unlockAudio(): void {
  if (ctx) {
    if (ctx.state === 'suspended') void ctx.resume();
    return;
  }
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
}

function tone(freq: number, dur: number, type: OscillatorType, vol: number, slideTo?: number, delay = 0): void {
  if (!ctx || gameState.data.muted) return;
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noise(dur: number, vol: number, freq: number, delay = 0): void {
  if (!ctx || gameState.data.muted) return;
  const t0 = ctx.currentTime + delay;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = freq;
  const gain = ctx.createGain();
  gain.gain.value = vol;
  src.connect(filter).connect(gain).connect(ctx.destination);
  src.start(t0);
}

export type Sfx = 'bark' | 'growl' | 'coin' | 'throw' | 'catch' | 'fail' | 'pop' | 'tick' | 'bite' | 'happy' | 'van';

export function play(s: Sfx, pitch = 1): void {
  switch (s) {
    case 'bark':
      tone(420 * pitch, 0.09, 'sawtooth', 0.08, 260 * pitch);
      noise(0.08, 0.12, 900 * pitch);
      tone(380 * pitch, 0.08, 'sawtooth', 0.06, 240 * pitch, 0.14);
      break;
    case 'growl':
      tone(90 * pitch, 0.35, 'sawtooth', 0.05, 70 * pitch);
      break;
    case 'coin':
      tone(988, 0.08, 'square', 0.05);
      tone(1319, 0.18, 'square', 0.05, undefined, 0.07);
      break;
    case 'throw':
      tone(300, 0.15, 'triangle', 0.08, 700);
      break;
    case 'catch':
      [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.14, 'triangle', 0.08, undefined, i * 0.07));
      break;
    case 'fail':
      tone(330, 0.18, 'triangle', 0.08, 180);
      break;
    case 'pop':
      tone(660, 0.06, 'triangle', 0.07, 990);
      break;
    case 'tick':
      tone(1200, 0.03, 'square', 0.03);
      break;
    case 'bite':
      noise(0.12, 0.25, 600);
      tone(200, 0.12, 'square', 0.05, 90);
      break;
    case 'happy':
      tone(700, 0.08, 'sine', 0.07, 1100);
      tone(900, 0.1, 'sine', 0.06, 1400, 0.09);
      break;
    case 'van':
      tone(200, 0.12, 'square', 0.05);
      tone(200, 0.12, 'square', 0.05, undefined, 0.18);
      break;
  }
}

export function vibrate(ms: number | number[]): void {
  if (gameState.data.muted) return;
  try {
    navigator.vibrate?.(ms);
  } catch {
    // not supported (iOS) — ignore
  }
}

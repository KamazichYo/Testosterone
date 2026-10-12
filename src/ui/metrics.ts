/** Screen metrics: the canvas is rendered at device-pixel resolution, so UI sizes are expressed in CSS px × dpr. */
export const metrics = {
  dpr: 1,
  /** integer scale for pixel-art UI elements (~3 CSS px per art pixel) */
  art: 3,
  safe: { top: 0, bottom: 0, left: 0, right: 0 },
};

export function getDpr(): number {
  return Math.min(window.devicePixelRatio || 1, 3);
}

export function updateMetrics(): void {
  const dpr = getDpr();
  metrics.dpr = dpr;
  const cssW = window.innerWidth;
  metrics.art = Math.max(2, Math.round(3 * dpr * Math.min(1, cssW / 390)));
  const probe = document.getElementById('safe-area-probe');
  if (probe) {
    const cs = getComputedStyle(probe);
    metrics.safe = {
      top: parseFloat(cs.paddingTop) * dpr || 0,
      bottom: parseFloat(cs.paddingBottom) * dpr || 0,
      left: parseFloat(cs.paddingLeft) * dpr || 0,
      right: parseFloat(cs.paddingRight) * dpr || 0,
    };
  }
}

/** CSS px → canvas px */
export const px = (css: number): number => Math.round(css * metrics.dpr);

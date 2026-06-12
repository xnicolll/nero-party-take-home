// ============================================================
// NERO PARTY - ink math
// One continuous hand-drawn line travels the whole product. These
// helpers build its paths: wobbly strokes, variable-width heat
// lines, loop flourishes, and the crown. Seeded jitter keeps every
// stroke stable across renders.
// ============================================================

export function prng(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Pt = [number, number];

// Catmull-Rom through the points -> smooth cubic path (the hand never rules straight)
export function smoothPath(pts: Pt[]): string {
  if (pts.length < 2) return '';
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += `C${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
}

// a horizontal line that wobbles like it was drawn in one pass
export function wavyLine(
  x0: number,
  x1: number,
  y: number,
  wobble = 3,
  segments = 10,
  seed = 7,
): string {
  const rnd = prng(seed);
  const pts: Pt[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const jitter = i === 0 || i === segments ? 0.4 : 1;
    pts.push([x0 + (x1 - x0) * t, y + (rnd() - 0.5) * 2 * wobble * jitter]);
  }
  return smoothPath(pts);
}

// variable-width filled stroke: the line IS the data (heat per bucket)
export function heatOutline(x0: number, x1: number, y: number, widths: number[], seed = 7): string {
  const rnd = prng(seed);
  const n = widths.length;
  const top: Pt[] = [];
  const bot: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const x = x0 + (x1 - x0) * t;
    const wob = (rnd() - 0.5) * 1.6;
    const w = Math.max(0.6, widths[i]);
    top.push([x, y + wob - w / 2]);
    bot.push([x, y + wob + w / 2]);
  }
  bot.reverse();
  return smoothPath(top) + smoothPath(bot).replace(/^M/, 'L') + 'Z';
}

// a loop-the-loop flourish at (x, y) - the line celebrates a sync
export function loopPath(x: number, y: number, r = 12): string {
  return [
    `M${x - r * 2.4} ${y}`,
    `C${x - r * 1.2} ${y - r * 0.2} ${x - r * 0.4} ${y - r * 0.1} ${x} ${y - r * 0.9}`,
    `C${x + r * 0.5} ${y - r * 1.7} ${x - r * 1.4} ${y - r * 1.7} ${x - r * 0.9} ${y - r * 0.8}`,
    `C${x - r * 0.5} ${y - r * 0.1} ${x + r * 0.8} ${y + r * 0.15} ${x + r * 2.4} ${y}`,
  ].join('');
}

// the crown, drawn in one stroke: swoop in, three peaks, swoop out
export function crownPath(cx: number, cy: number, w: number): string {
  const h = w * 0.42;
  const x0 = cx - w / 2;
  const pts: Pt[] = [
    [x0 - w * 0.3, cy + h * 0.55],
    [x0, cy + h * 0.5],
    [x0 + w * 0.04, cy - h * 0.1],
    [x0 + w * 0.21, cy + h * 0.28],
    [x0 + w * 0.38, cy - h * 0.42],
    [x0 + w * 0.5, cy - h * 0.5],
    [x0 + w * 0.62, cy - h * 0.42],
    [x0 + w * 0.79, cy + h * 0.28],
    [x0 + w * 0.96, cy - h * 0.1],
    [x0 + w, cy + h * 0.5],
    [x0 + w * 1.3, cy + h * 0.55],
  ];
  return smoothPath(pts);
}

// a full-viewport swoop, edge to edge (the page-transition line)
export function swoopPath(w: number, h: number, seed = 11): string {
  const rnd = prng(seed);
  const yMid = h * (0.42 + rnd() * 0.2);
  const pts: Pt[] = [
    [-w * 0.05, yMid + (rnd() - 0.5) * h * 0.12],
    [w * 0.22, yMid - h * (0.06 + rnd() * 0.1)],
    [w * 0.46, yMid + h * (0.08 + rnd() * 0.08)],
    [w * 0.72, yMid - h * (0.05 + rnd() * 0.1)],
    [w * 1.05, yMid + (rnd() - 0.5) * h * 0.1],
  ];
  return smoothPath(pts);
}

// a hand-drawn pointing arrow: a properly bowed stroke, curved head
export function arrowPath(x0: number, y0: number, x1: number, y1: number, seed = 5): string {
  const rnd = prng(seed);
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const px = -dy / len; // perpendicular
  const py = dx / len;
  const bend = (0.5 + rnd() * 0.4) * Math.min(150, len * 0.5) * (rnd() > 0.5 ? 1 : -1);
  const c1x = x0 + dx * 0.28 + px * bend;
  const c1y = y0 + dy * 0.28 + py * bend;
  const c2x = x0 + dx * 0.74 + px * bend * 0.55;
  const c2y = y0 + dy * 0.74 + py * bend * 0.55;
  const ang = Math.atan2(y1 - c2y, x1 - c2x);
  const h = 12;
  const head = (side: number) => {
    const a = ang + Math.PI * 0.82 * side;
    const hx = x1 + Math.cos(a) * h;
    const hy = y1 + Math.sin(a) * h;
    const qx = x1 + Math.cos(a) * h * 0.5 + Math.cos(ang) * 2.5;
    const qy = y1 + Math.sin(a) * h * 0.5 + Math.sin(ang) * 2.5;
    return `M${x1.toFixed(1)} ${y1.toFixed(1)}Q${qx.toFixed(1)} ${qy.toFixed(1)} ${hx.toFixed(1)} ${hy.toFixed(1)}`;
  };
  return (
    `M${x0.toFixed(1)} ${y0.toFixed(1)}C${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)}` +
    head(1) +
    head(-1)
  );
}

// a wobbly filled blob: every guest gets their own hand-drawn shape
export function blobPath(cx: number, cy: number, r: number, seed = 9): string {
  const rnd = prng(seed);
  const n = 8;
  const pts: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rad = r * (0.78 + rnd() * 0.4);
    pts.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]);
  }
  pts.push(pts[0]);
  return smoothPath(pts) + 'Z';
}

// a wobbly closed circle for orbit rings
export function wobbleCirclePath(cx: number, cy: number, r: number, seed = 13): string {
  const rnd = prng(seed);
  const n = 20;
  const pts: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rad = r * (0.97 + rnd() * 0.06);
    pts.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]);
  }
  return smoothPath(pts) + 'Z';
}

// a single wobbly ink ray from center outward at a given angle
export function rayLine(
  cx: number,
  cy: number,
  angle: number,
  r0: number,
  r1: number,
  seed = 7,
): string {
  const rnd = prng(seed);
  const steps = 5;
  const pts: Pt[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const r = r0 + (r1 - r0) * t;
    const wobble = i === 0 || i === steps ? (rnd() - 0.5) * 1.2 : (rnd() - 0.5) * 3.5;
    const pa = angle + Math.PI / 2;
    pts.push([
      cx + Math.cos(angle) * r + Math.cos(pa) * wobble,
      cy + Math.sin(angle) * r + Math.sin(pa) * wobble,
    ]);
  }
  return smoothPath(pts);
}

// stable seed from a name, so a guest's doodle never changes shape
export function seedFromName(name: string): number {
  let h = 2166136261;
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

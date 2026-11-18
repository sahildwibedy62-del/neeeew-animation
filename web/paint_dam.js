// Painted textures for the dam / village / tunnel world (same flat-colour-with-dark-seams style as paint.js).
// All deterministic (seeded rng from paint.js). paint.js itself is kept unmodified.
import { rng } from './paint.js';

const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
const hsl = (h, s, l, a = 1) => `hsla(${h},${s}%,${l}%,${a})`;

/** weathered dam concrete: formwork lifts, panel joints, rain streaks, stains, speckle */
export function concrete(seed = 21, L0 = 66, hue = 210, sat = 5) {
  const [c, g] = cv(512, 512), r = rng(seed);
  g.fillStyle = hsl(hue, sat, L0); g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 70; i++) { g.fillStyle = hsl(hue + r() * 20 - 10, sat, L0 - 8 + r() * 14, .35); g.beginPath(); g.ellipse(r() * 512, r() * 512, 20 + r() * 60, 10 + r() * 30, 0, 0, 7); g.fill(); }
  for (let i = 0; i < 1600; i++) { g.fillStyle = hsl(hue, sat, L0 - 20 + r() * 34, .5); g.fillRect(r() * 512, r() * 512, 1.5 + r() * 2, 1.5 + r() * 2); }
  // rain streaks under each lift line
  for (let i = 0; i < 46; i++) { const x = r() * 512, y = (Math.floor(r() * 4)) * 128 + 4, h = 30 + r() * 110; const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, `rgba(40,42,48,${.25 + r() * .25})`); gr.addColorStop(1, 'rgba(40,42,48,0)'); g.fillStyle = gr; g.fillRect(x, y, 3 + r() * 9, h); }
  // formwork lift lines + vertical joints + tie holes
  for (let y = 0; y < 512; y += 128) { g.fillStyle = 'rgba(30,30,36,.75)'; g.fillRect(0, y, 512, 3); g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(0, y + 3, 512, 2); }
  for (let x = 0; x < 512; x += 256) { g.fillStyle = 'rgba(30,30,36,.55)'; g.fillRect(x, 0, 2, 512); }
  for (let y = 32; y < 512; y += 64) for (let x = 32; x < 512; x += 64) { g.fillStyle = 'rgba(35,35,40,.55)'; g.beginPath(); g.arc(x + (r() - .5) * 2, y, 2.6, 0, 7); g.fill(); }
  // rust bleeding from a couple of tie holes
  for (let i = 0; i < 4; i++) { const x = 32 + Math.floor(r() * 8) * 64, y = 32 + Math.floor(r() * 8) * 64; const gr = g.createLinearGradient(0, y, 0, y + 70); gr.addColorStop(0, 'rgba(140,80,40,.55)'); gr.addColorStop(1, 'rgba(140,80,40,0)'); g.fillStyle = gr; g.fillRect(x - 3, y, 6, 70); }
  return c;
}
/** apron / walkway concrete with a hazard-painted edge band at the bottom of the tile */
export function apron(seed = 22) {
  const c = concrete(seed, 60, 30, 6), g = c.getContext('2d');
  for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? '#2a2830' : '#e6b23a'; g.beginPath(); g.moveTo(i * 32, 512); g.lineTo(i * 32 + 32, 512); g.lineTo(i * 32 + 64, 470); g.lineTo(i * 32 + 32, 470); g.fill(); }
  return c;
}
/** rusted metal: orange-brown patches, dark pits, paint remains */
export function rust(seed = 23, paint = '#6f7a73') {
  const [c, g] = cv(256, 256), r = rng(seed);
  g.fillStyle = paint; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 90; i++) { g.fillStyle = hsl(18 + r() * 16, 55 + r() * 20, 28 + r() * 18, .55 + r() * .4); g.beginPath(); g.ellipse(r() * 256, r() * 256, 4 + r() * 28, 3 + r() * 18, r() * 3, 0, 7); g.fill(); }
  for (let i = 0; i < 160; i++) { g.fillStyle = 'rgba(30,16,10,.6)'; g.fillRect(r() * 256, r() * 256, 1.5, 1.5); }
  for (let i = 0; i < 12; i++) { const x = r() * 256; const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, 'rgba(120,60,24,.5)'); gr.addColorStop(1, 'rgba(120,60,24,0)'); g.fillStyle = gr; g.fillRect(x, r() * 100, 3, 160); }
  return c;
}
/** riveted steel plate (emergency gate, doors) */
export function steel(seed = 24, base = '#7d8a90') {
  const c = rust(seed, base), g = c.getContext('2d');
  for (let y = 0; y < 256; y += 128) { g.fillStyle = 'rgba(25,25,30,.8)'; g.fillRect(0, y, 256, 3); }
  g.fillStyle = 'rgba(25,25,30,.8)'; g.fillRect(0, 0, 3, 256); g.fillRect(128, 0, 3, 256);
  for (let y = 10; y < 256; y += 128) for (let x = 12; x < 256; x += 22) { g.fillStyle = '#3c4044'; g.beginPath(); g.arc(x, y, 3.5, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.arc(x - 1, y - 1, 1.3, 0, 7); g.fill(); }
  return c;
}
/** corrugated metal roof sheet */
export function corrugated(seed = 25, base = '#8d6a4e') {
  const [c, g] = cv(256, 256), r = rng(seed);
  for (let x = 0; x < 256; x += 16) { const gr = g.createLinearGradient(x, 0, x + 16, 0); gr.addColorStop(0, '#5a4636'); gr.addColorStop(0.5, base); gr.addColorStop(1, '#4a3a2c'); g.fillStyle = gr; g.fillRect(x, 0, 16, 256); }
  for (let i = 0; i < 40; i++) { g.fillStyle = hsl(20, 55, 30 + r() * 12, .5); g.beginPath(); g.ellipse(r() * 256, r() * 256, 4 + r() * 16, 3 + r() * 10, 0, 0, 7); g.fill(); }
  return c;
}
/** layered valley rock */
export function rock(seed = 26) {
  const [c, g] = cv(512, 512), r = rng(seed);
  g.fillStyle = '#8b8478'; g.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 512; y += 18 + r() * 30) { g.fillStyle = hsl(30 + r() * 10, 10 + r() * 8, 46 + r() * 18); g.fillRect(0, y, 512, 10 + r() * 26); g.fillStyle = 'rgba(40,34,30,.6)'; g.fillRect(0, y, 512, 2.5); }
  for (let i = 0; i < 60; i++) { g.strokeStyle = 'rgba(40,34,30,.55)'; g.lineWidth = 2; g.beginPath(); let x = r() * 512, y = r() * 512; g.moveTo(x, y); for (let k = 0; k < 4; k++) { x += r() * 30 - 15; y += 10 + r() * 25; g.lineTo(x, y); } g.stroke(); }
  for (let i = 0; i < 140; i++) { g.fillStyle = hsl(90 + r() * 25, 35, 32 + r() * 12, .7); g.beginPath(); g.ellipse(r() * 512, r() * 512, 3 + r() * 9, 2 + r() * 5, 0, 0, 7); g.fill(); }
  return c;
}
/** tunnel wall: concrete with a painted yellow/black band and a grime gradient at the floor */
export function tunnelWall(seed = 27) {
  const c = concrete(seed, 52, 200, 6), g = c.getContext('2d');
  g.fillStyle = '#d9a83a'; g.fillRect(0, 380, 512, 26);
  for (let i = 0; i < 16; i++) { g.fillStyle = '#26242a'; g.beginPath(); g.moveTo(i * 32, 406); g.lineTo(i * 32 + 14, 406); g.lineTo(i * 32 + 30, 380); g.lineTo(i * 32 + 16, 380); g.fill(); }
  const gr = g.createLinearGradient(0, 410, 0, 512); gr.addColorStop(0, 'rgba(30,36,34,0)'); gr.addColorStop(1, 'rgba(30,36,34,.6)'); g.fillStyle = gr; g.fillRect(0, 410, 512, 102);
  return c;
}
/** tunnel floor: wet concrete with a yellow guide line */
export function tunnelFloor(seed = 28) {
  const c = concrete(seed, 44, 200, 6), g = c.getContext('2d');
  g.fillStyle = '#d9b43a'; g.fillRect(236, 0, 16, 512);
  for (let y = 0; y < 512; y += 64) { g.fillStyle = 'rgba(20,20,24,.6)'; g.fillRect(236, y, 16, 20); }
  return c;
}
/** village plaster in warm tints */
export function plasterWarm(seed = 29, hue = 36, L = 84) {
  const [c, g] = cv(256, 256), r = rng(seed);
  g.fillStyle = hsl(hue, 45, L); g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 40; i++) { g.fillStyle = hsl(hue, 35, L - 10 + r() * 8, .5); g.beginPath(); g.ellipse(r() * 256, r() * 256, 10 + r() * 30, 6 + r() * 16, 0, 0, 7); g.fill(); }
  g.fillStyle = hsl(hue, 25, L - 26, .55); g.fillRect(0, 234, 256, 22);
  return c;
}
/** field / farmland stripes */
export function field(seed = 30, hue = 70) {
  const [c, g] = cv(256, 256), r = rng(seed);
  for (let y = 0; y < 256; y += 16) { g.fillStyle = hsl(hue + r() * 14, 40, 40 + (y / 16 % 2) * 8); g.fillRect(0, y, 256, 16); }
  for (let i = 0; i < 400; i++) { g.fillStyle = hsl(hue + 10, 45, 30 + r() * 20, .5); g.fillRect(r() * 256, r() * 256, 2, 2); }
  return c;
}

/** Crack network map for the dam face. World x in [-40,40] -> u, world y in [0,40] -> v.
 *  R = reveal time (0..255 ~ crackT 0..1), G = crack mask. A branch reveals where R <= crackT * 255. */
export const CRACK_ORIGIN = [0, 14];
export function crackMap() {
  const W = 2048, H = 1024, [c, g] = cv(W, H), r = rng(91);
  g.fillStyle = 'rgb(255,0,0)'; g.fillRect(0, 0, W, H);
  const P = (x, y) => [(x + 40) / 80 * W, (1 - y / 40) * H];
  g.lineCap = 'round'; g.lineJoin = 'round';
  const segs = [];
  // stage A (t 0..0.18): the hairline crack + first branches (shots 1-3). stage B (t 0.18..1): the break (shot 4).
  const grow = (x, y, ang, len, t0, speed, width, depth) => {
    let t = t0;
    const n = Math.max(3, Math.round(len / 0.35));
    for (let i = 0; i < n; i++) {
      ang += (r() - 0.5) * 0.9; const st = len / n, nx = x + Math.cos(ang) * st, ny = y + Math.sin(ang) * st;
      const t1 = t + st / speed;
      segs.push([x, y, nx, ny, t, width * (1 - 0.6 * i / n)]);
      if (depth > 0 && r() < 0.16) grow(nx, ny, ang + (r() < 0.5 ? 1 : -1) * (0.6 + r() * 0.6), len * (0.35 + r() * 0.3), t1, speed * 0.9, width * 0.6, depth - 1);
      x = nx; y = ny; t = t1;
    }
  };
  const [ox, oy] = CRACK_ORIGIN;
  // stage A: slow hairline, ~2.5 m
  grow(ox, oy, 1.2, 1.4, 0.0, 14, 7, 1); grow(ox, oy, -1.9, 1.6, 0.01, 14, 6, 1); grow(ox, oy, 0.2, 0.9, 0.05, 10, 5, 0);
  // stage B: fast spread over the centre blocks and beyond
  for (let k = 0; k < 9; k++) { const a = k / 9 * 6.283 + r() * 0.4; grow(ox + Math.cos(a) * 0.8, oy + Math.sin(a) * 0.8, a, 6 + r() * 12, 0.2 + r() * 0.08, 26, 9, 2); }
  for (let k = 0; k < 6; k++) { const x = -9 + r() * 18, y = 4 + r() * 16; grow(x, y, r() * 6.283, 4 + r() * 6, 0.35 + r() * 0.3, 22, 6, 1); }
  // draw: thick first so thin overlaps keep their own time
  segs.sort((a, b) => b[5] - a[5]);
  for (const [x0, y0, x1, y1, t, w] of segs) {
    const [a, b] = P(x0, y0), [cc, d] = P(x1, y1), tv = Math.max(1, Math.min(254, Math.round(t * 255)));
    g.strokeStyle = `rgb(${tv},255,0)`; g.lineWidth = Math.max(2, w); g.beginPath(); g.moveTo(a, b); g.lineTo(cc, d); g.stroke();
  }
  return c;
}

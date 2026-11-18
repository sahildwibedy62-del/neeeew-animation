
// ================= robots.js — cast for "The Little Robot That Held Back a Flood" =================
// Appended after toonbase.js + roman.js into web/toon.js (cat web/toonbase.js web/roman.js web/robots.js > web/toon.js),
// so it can use the toon-base internals: Pen, INK, mul, mix, shade, ellPts, rrect, rad, curve, OUTFITS, FACE.
// Design space 600 x 1000, soles at y = 975 (same contract as romanFront). All drawing is deterministic.

// ---- palette (locked; see assets/characters/PIP_MODEL_SHEET.md) ----
export const PIP = {
  body: "#e2ad2f", bodyLit: "#f0c64e", bodyDark: "#a87a22", joint: "#34323a", jointLit: "#4a4852",
  visor: "#1d1b24", eye: "#eafcff", eyeGlow: "#79e6ff", ind: "#2fe0cf", indDark: "#1b5d58",
  scarf: "#b9453b", scarfDark: "#82302c", scarfLit: "#d2675a", scratch: "#fff3c8", rust: "#8a4e22",
};

// human crew + villagers for this film (roman.js outfit keys, our own designs)
Object.assign(OUTFITS, {
  crewA: { tunic: "#d9792b", skin: "#f5c9a0", cap: "#f2c230", apron: "#e8dcc0" },          // hard-hat dam worker
  crewB: { tunic: "#3f6a6f", skin: "#ecd0b6", cap: "#f2c230", moustache: "#4a3020", stout: true },
  villA: { tunic: "#4f7fb8", skin: "#f5c9a0", hair: "#5a3b2a" },
  villB: { tunic: "#d9a441", skin: SKIN, hair: "#2b211c", dress: "#c25a7a" },
  villC: { tunic: "#5d8a3a", skin: "#c99067", hair: "#1e1714", stout: true },
  villD: { tunic: "#8e5aa8", skin: "#f3d6bb", hair: "#9a9188" },
});

const glow = (g, col, blur, fn) => { g.save(); g.shadowColor = col; g.shadowBlur = blur; fn(); g.restore(); };
const rr = (p, x0, y0, x1, y1, r, fill, ol) => p.poly(rrect(x0, y0, x1, y1, r), fill, ol);

/** PIP eye shapes. kind: neutral | wide | worried | determined | sad | happy | squint | off. look -1..1, lid 0..1 (blink) */
const pipEye = (p, cx, cy, side, kind, look, lid, glowK, s = 1) => {
  const g = p.g, k = glowK;
  const col = k <= 0.02 ? "#2a2933" : mix("#2a2933", PIP.eye, Math.min(1, k * 1.15));
  const rx = (kind === "wide" ? 50 : 41) * s, ry = (kind === "wide" ? 60 : 50) * s;
  const lx = cx + look * 14 * s;
  if (kind === "off") { p.ell(cx, cy, rx * 0.9, ry * 0.9, "#24232c", 0); p.ell(cx, cy, rx * 0.9, ry * 0.9, null, 4 * s); return; }
  if (kind === "happy") { glow(g, PIP.eyeGlow, 28 * k, () => p.arc(cx, cy + 12 * s, 36 * s, 30 * s, 200, 340, 20 * s, col)); return; }
  if (lid >= 1 || kind === "squint") { glow(g, PIP.eyeGlow, 22 * k, () => p.stroke([[cx - 34 * s, cy + 4 * s], [cx + 34 * s, cy + 4 * s]], 15 * s, col)); return; }
  // glowing LED eye
  glow(g, PIP.eyeGlow, 34 * k, () => p.ell(lx, cy, rx, ry, col, 0));
  // pupil ring (darker core that tracks the look direction)
  if (k > 0.05) { p.ell(lx + look * 8 * s, cy + 4 * s, rx * 0.36, ry * 0.36, mix(col, "#7fdcf0", 0.55), 0); p.ell(lx + look * 8 * s - 10 * s, cy - 14 * s, 9 * s, 11 * s, "#ffffff", 0); }
  // lids cut in visor colour: brow shape carries the emotion
  const V = PIP.visor, top = cy - ry - 4 * s;
  const lidPoly = (yIn, yOut) => p.poly([[cx - side * (rx + 8 * s), top - 30 * s], [cx + side * (rx + 8 * s), top - 30 * s], [cx + side * (rx + 8 * s), yOut], [cx - side * (rx + 8 * s), yIn]], V, 0);
  // side = -1 left eye, +1 right eye; "in" = toward the nose (x toward cx_face)
  const inY = (d) => top + d * s, b = lid * ry * 1.6;
  switch (kind) {
    case "worried": lidPoly(inY(10) + b, inY(36) + b); break;            // inner raised? (for worried: inner higher -> outer lower)
    case "sad": lidPoly(inY(14) + b, inY(52) + b); break;
    case "determined": lidPoly(inY(50) + b, inY(14) + b); break;         // inner low = frown
    case "wide": if (b > 0) lidPoly(inY(0) + b, inY(0) + b); break;
    default: lidPoly(inY(16) + b, inY(16) + b);
  }
};

/** PIP, front (or back) view. opts:
 *  expr, look, blink, eyeGlow(0..1), ind(0..1 indicator brightness), indCol, tilt, headTilt, bob, squash, step(0..1 run phase),
 *  run(0..1 run amount), L/R arm poses (hang|point|up|wave|reach|lever|hold|push|scan|swing|fist|down), lift, wind (scarf phase),
 *  windAmt, back(bool), dmg(0..1), facing(-1..1 small 3/4 shift), crouch(0..1) */
export const pipDraw = (p, o = {}) => {
  const { expr = "neutral", look = 0, blink = 0, eyeGlow = 1, ind = 1, indCol = PIP.ind, tilt = 0, headTilt = 0, bob = 0, squash = 0,
    step = 0, run = 0, L = "hang", R = "hang", wind = 0, windAmt = 0.4, back = false, dmg = 0, facing = 0, crouch = 0, lift = 0 } = o;
  const g = p.g, cx = 300, sole = 975, ol = 10;
  g.save();
  // squash & stretch about the soles
  const sy = 1 - squash * 0.12 - crouch * 0.1, sx = 1 + squash * 0.08 + crouch * 0.05;
  g.translate(cx, sole); g.scale(sx, sy); g.translate(-cx, -sole);
  const hipY = 805 + bob * 40 + crouch * 40, bodyTop = hipY - 205, neckY = bodyTop - 30;
  // ---------- legs ----------
  for (const side of [-1, 1]) {
    const ph = step + (side > 0 ? 0.5 : 0), sw = Math.sin(ph * Math.PI * 2);
    const lift = Math.max(0, Math.sin(ph * Math.PI * 2)) * 70 * run, fwd = sw * 34 * run;
    const hx = cx + side * 52 + facing * 8, fx = cx + side * 62 + fwd * 0.4 + facing * 10, fy = sole - 18 - lift;
    const kx = (hx + fx) / 2 + side * 18 + fwd * 0.6, ky = (hipY + fy) / 2 - 10 - lift * 0.3 + crouch * 25;
    p.stroke([[hx, hipY], [kx, ky], [fx, fy]], 30 + 2 * ol, INK);
    p.stroke([[hx, hipY], [kx, ky], [fx, fy]], 30, PIP.joint);
    p.stroke([[hx - 6, hipY + 10], [kx - 6, ky - 4]], 5, PIP.jointLit);
    p.ell(kx, ky, 19, 19, PIP.jointLit, 7);
    rr(p, fx - 46 + side * 8, fy - 18, fx + 46 + side * 8, fy + 20, 16, back ? PIP.bodyDark : PIP.body, ol);
    p.stroke([[fx - 34 + side * 8, fy - 6], [fx + 20 + side * 8, fy - 6]], 5, PIP.bodyLit);
  }
  // ---------- upper body (tilt about hip) ----------
  g.save(); g.translate(cx, hipY); g.rotate(rad(tilt)); g.translate(-cx, -hipY);
  const bx0 = 182 + facing * 6, bx1 = 418 + facing * 6;
  const S = (side) => [side < 0 ? bx0 + 12 : bx1 - 12, bodyTop + 44];
  const arm = (side, pose) => {
    const [sx_, sy_] = S(side), X = (d) => sx_ + side * d;
    switch (pose) {
      case "point": return [[sx_, sy_], [X(70), sy_ - 20], [X(150), sy_ - 70]];
      case "up": return [[sx_, sy_], [X(50), sy_ - 90], [X(70), sy_ - 200]];
      case "wave": { const w = Math.sin(o.wv || 0) * 30; return [[sx_, sy_], [X(60), sy_ - 80], [X(80 + w), sy_ - 190]]; }
      case "reach": { const lf = lift * 80; return [[sx_, sy_], [X(55), sy_ - 60 - lf * 0.5], [X(100), sy_ - 150 - lf]]; }
      case "lever": return [[sx_, sy_], [X(40), sy_ + 20 - lift * 60], [X(60), sy_ - 30 - lift * 120]];
      case "hold": return [[sx_, sy_], [X(30), sy_ + 70], [cx + side * 30, sy_ + 40]];
      case "push": return [[sx_, sy_], [X(50), sy_ + 10], [X(55), sy_ - 40]];
      case "scan": return [[sx_, sy_], [X(55), sy_ - 60], [cx + side * 140, bodyTop - 140]];
      case "swing": { const sw = Math.sin((step + (side > 0 ? 0 : 0.5)) * Math.PI * 2); return [[sx_, sy_], [X(36) + sw * 26, sy_ + 70], [X(28) + sw * 70, sy_ + 120 - Math.abs(sw) * 30]]; }
      case "fist": return [[sx_, sy_], [X(46), sy_ + 50], [X(30), sy_ - 20]];
      case "down": return [[sx_, sy_], [X(26), sy_ + 80], [X(30), sy_ + 150]];
      default: return [[sx_, sy_], [X(30), sy_ + 72], [X(26), sy_ + 140]];
    }
  };
  const drawArm = (side, pose) => {
    const pts = arm(side, pose), [hx, hy] = pts[2];
    p.stroke(curve(pts[0], pts[1], pts[2]), 22 + 2 * ol, INK);
    p.stroke(curve(pts[0], pts[1], pts[2]), 22, PIP.joint);
    for (let k = 1; k < 4; k++) { const c = curve(pts[0], pts[1], pts[2]), q = c[Math.floor(c.length * k / 4)]; p.ell(q[0], q[1], 13, 13, PIP.jointLit, 5); }
    p.ell(pts[0][0], pts[0][1], 24, 24, PIP.body, 8);
    // two-prong claw
    const dx = hx - pts[1][0], dy = hy - pts[1][1], l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l, nx = -uy, ny = ux;
    const open = pose === "up" || pose === "point" || pose === "wave" ? 0.8 : 0.4;
    for (const s of [-1, 1]) p.stroke([[hx, hy], [hx + ux * 26 + nx * s * 20 * open, hy + uy * 26 + ny * s * 20 * open], [hx + ux * 42 + nx * s * 8, hy + uy * 42 + ny * s * 8]], 11 + 2 * 7, INK);
    for (const s of [-1, 1]) p.stroke([[hx, hy], [hx + ux * 26 + nx * s * 20 * open, hy + uy * 26 + ny * s * 20 * open], [hx + ux * 42 + nx * s * 8, hy + uy * 42 + ny * s * 8]], 11, PIP.body);
    p.ell(hx, hy, 17, 17, PIP.joint, 7);
  };
  const frontArm = (pose) => pose === "hold" || pose === "push";
  if (!back) { if (!frontArm(L)) drawArm(-1, L); if (!frontArm(R)) drawArm(1, R); }
  else { drawArm(-1, L); drawArm(1, R); }
  // body box
  const body = rrect(bx0, bodyTop, bx1, hipY + 6, 46);
  p.gradFill(body, back ? PIP.bodyDark : PIP.body, PIP.bodyDark, rad(-120), 0.3);
  p.clip(body, () => {
    // hazard stripe band at the hem
    rr(p, bx0 - 10, hipY - 44, bx1 + 10, hipY + 10, 0, PIP.joint, 0);
    for (let i = -2; i < 9; i++) p.poly([[bx0 + i * 36, hipY + 10], [bx0 + i * 36 + 18, hipY + 10], [bx0 + i * 36 + 48, hipY - 44], [bx0 + i * 36 + 30, hipY - 44]], PIP.body, 0);
    p.stroke([[bx0 - 10, hipY - 44], [bx1 + 10, hipY - 44]], 6, INK);
    if (!back) {
      rr(p, cx - 62 + facing * 10, bodyTop + 40, cx + 62 + facing * 10, bodyTop + 128, 18, PIP.visor, 6);   // chest panel
      p.ell(cx - 26 + facing * 10, bodyTop + 84, 22, 22, "#e9e2cf", 5); p.stroke([[cx - 26 + facing * 10, bodyTop + 84], [cx - 12 + facing * 10, bodyTop + 72]], 4);
      for (let i = 0; i < 3; i++) p.dot(cx + 14 + i * 16 + facing * 10, bodyTop + 70, 6, i === 0 ? mix("#3a3a3a", indCol, ind) : i === 1 ? "#e9a23b" : "#6d6a72");
      p.stroke([[cx + 8 + facing * 10, bodyTop + 102], [cx + 50 + facing * 10, bodyTop + 102]], 5, "#6d6a72");
    } else { // back: battery pack + vents
      rr(p, cx - 70, bodyTop + 30, cx + 70, bodyTop + 140, 20, PIP.joint, 6);
      for (let i = 0; i < 4; i++) p.stroke([[cx - 48, bodyTop + 52 + i * 22], [cx + 48, bodyTop + 52 + i * 22]], 7, "#1a1920");
    }
    // wear: scratches, rust freckles, rivets
    const sc = [[bx0 + 22, bodyTop + 30, 40, 12], [bx1 - 60, bodyTop + 150, 30, -8], [bx0 + 40, bodyTop + 160, 22, 6]];
    for (const [x, y, w, d] of sc) p.stroke([[x, y], [x + w, y + d]], 3.5, PIP.scratch);
    for (const [x, y] of [[bx1 - 30, bodyTop + 30], [bx0 + 20, hipY - 60], [bx1 - 40, hipY - 70]]) p.ell(x, y, 7, 5, PIP.rust, 0);
    for (const s of [-1, 1]) for (const y of [bodyTop + 22, hipY - 58]) p.dot(cx + s * 98 + facing * 6, y, 5, PIP.bodyDark);
    if (dmg > 0.3) { p.stroke([[bx0 + 30, bodyTop + 60], [bx0 + 70, bodyTop + 100], [bx0 + 60, bodyTop + 140]], 4, INK); p.ell(bx1 - 50, bodyTop + 110, 20, 14, "#6b4a2a", 0); }
  });
  p.poly(body, null, ol);
  if (!back) { if (frontArm(L)) drawArm(-1, L); if (frontArm(R)) drawArm(1, R); }
  // neck
  rr(p, cx - 34, neckY - 30, cx + 34, bodyTop + 14, 10, PIP.joint, 8);
  // ---------- head (tilt about the neck) ----------
  g.save(); g.translate(cx, neckY); g.rotate(rad(headTilt)); g.translate(-cx, -neckY);
  const hb = neckY - 18, ht = hb - 268, hx0 = 118 + facing * 14, hx1 = 482 + facing * 14;
  // antenna stalk + indicator dome (turquoise status light)
  const ax = cx + 64 + facing * 18;
  p.stroke([[ax, ht + 6], [ax + 4, ht - 46]], 13 + 2 * 7, INK); p.stroke([[ax, ht + 6], [ax + 4, ht - 46]], 13, PIP.joint);
  const ic = mix(PIP.indDark, indCol, Math.min(1, ind));
  if (ind > 0.05) glow(g, indCol, 60 * ind, () => p.ell(ax + 4, ht - 66, 30, 28, ic, 0));
  p.ell(ax + 4, ht - 66, 30, 28, ic, 8);
  p.ell(ax - 6, ht - 76, 9, 7, ind > 0.3 ? "#e8fffb" : "#5f8a86", 0);
  // ear cans
  for (const s of [-1, 1]) { const ex = s < 0 ? hx0 - 6 : hx1 + 6; p.ell(ex, hb - 132, 30, 44, PIP.joint, 8); p.ell(ex + s * 4, hb - 132, 12, 22, PIP.jointLit, 0); }
  const head = rrect(hx0, ht, hx1, hb, 76);
  p.gradFill(head, back ? PIP.bodyDark : PIP.body, PIP.bodyDark, rad(-120), 0.35);
  p.clip(head, () => {
    p.stroke([[hx0 + 40, ht + 30], [hx1 - 80, ht + 30]], 9, PIP.bodyLit);                 // top highlight
    if (!back) {
      const V = rrect(hx0 + 36, ht + 52, hx1 - 36, hb - 40, 54);
      p.poly(V, PIP.visor, 7);
      p.clip(V, () => {
        const ey = (ht + 52 + hb - 40) / 2 + 2, ec = (hx0 + hx1) / 2 + facing * 12;
        const kind = expr === "shock" ? "wide" : expr;
        const lid = blink >= 1 ? 1 : blink > 0 ? 0.5 : 0;
        for (const side of [-1, 1]) pipEye(p, ec + side * 74, ey, side, kind, look, lid, eyeGlow);
        p.stroke([[hx0 + 70, ht + 72], [hx0 + 150, ht + 66]], 6, "rgba(255,255,255,.18)");   // visor glint
        if (dmg > 0.5) p.stroke([[hx1 - 120, ht + 60], [hx1 - 150, ht + 120], [hx1 - 130, ht + 160]], 4, "rgba(255,255,255,.35)");
      });
    } else {
      rr(p, cx - 110, ht + 70, cx + 110, hb - 60, 30, PIP.bodyDark, 6);
      for (let i = 0; i < 5; i++) p.stroke([[cx - 80, ht + 100 + i * 26], [cx + 80, ht + 100 + i * 26]], 8, PIP.joint);
    }
    for (const [x, y, w, d] of [[hx0 + 30, hb - 34, 36, -6], [hx1 - 70, ht + 40, 26, 8]]) p.stroke([[x, y], [x + w, y + d]], 3.5, PIP.scratch);
    p.ell(hx1 - 28, hb - 70, 10, 7, PIP.rust, 0);
    for (const x of [hx0 + 22, hx1 - 22]) for (const y of [ht + 40, hb - 30]) p.dot(x, y, 5.5, PIP.bodyDark);
  });
  p.poly(head, null, ol + 1);
  g.restore(); // head
  // ---------- scarf (drawn over the neck; tails flutter with wind) ----------
  {
    const sy0 = neckY - 8, w = windAmt;
    const band = [[cx - 74, sy0 - 26], [cx + 74, sy0 - 26], [cx + 80, sy0 + 20], [cx - 80, sy0 + 20]];
    p.poly(band.map(([x, y], i) => [x, y + (i < 2 ? 0 : 8 * Math.sin(i))]), PIP.scarf, 9);
    p.stroke([[cx - 60, sy0 - 4], [cx + 60, sy0 - 2]], 6, PIP.scarfDark);
    const kx = back ? cx - 20 : cx + 52, ky = sy0 + 10;
    p.ell(kx, ky, 26, 22, PIP.scarfDark, 8);
    for (let t = 0; t < 2; t++) {
      const pts = [], dir = back ? -1 : 1, len = t ? 150 : 200;
      for (let i = 0; i <= 10; i++) {
        const u = i / 10, wv = Math.sin(wind * 6.283 + u * 3.2 + t * 1.3) * 26 * w * u;
        pts.push([kx + dir * (12 + u * (40 + 120 * w)) + t * 14, ky + u * len * (1 - 0.55 * w) + wv]);
      }
      const left = pts.map(([x, y], i) => [x - 22 * (1 - i / 14), y]), right = pts.map(([x, y], i) => [x + 22 * (1 - i / 14), y]).reverse();
      p.poly([...left, ...right], t ? PIP.scarfDark : PIP.scarf, 8);
      const e = pts[pts.length - 1];
      for (let f = -1; f <= 1; f++) p.stroke([[e[0] + f * 10, e[1]], [e[0] + f * 12, e[1] + 22]], 5, t ? PIP.scarfDark : PIP.scarf); // frayed ends
      p.stroke(pts.slice(2, 8).map(([x, y]) => [x - 4, y]), 4, PIP.scarfLit);
    }
  }
  g.restore(); // upper body
  g.restore(); // squash
};

/** dormant / awakened maintenance robot (secondary cast). variant 0..3, on 0..1 (eye light), work = tool phase */
export const unitDraw = (p, v = 0, on = 0, work = 0, tool = 0) => {
  const cols = [["#8f9a86", "#5d6658"], ["#c4773a", "#7d4a26"], ["#7d8fa3", "#4c5a6b"], ["#b9a46a", "#776a40"]][v % 4];
  const [c0, c1] = cols, cx = 300, g = p.g;
  const tall = v === 2 ? 1.12 : v === 3 ? 0.9 : 1;
  const top = 975 - 860 * tall;
  // legs / treads
  if (v % 2) { rr(p, 170, 880, 430, 972, 40, "#2f2d33", 10); for (let i = 0; i < 6; i++) p.ell(200 + i * 40, 926, 16, 16, "#5a5860", 5); }
  else for (const s of [-1, 1]) { p.stroke([[cx + s * 50, 800], [cx + s * 64, 950]], 40, INK); p.stroke([[cx + s * 50, 800], [cx + s * 64, 950]], 26, "#3a3840"); rr(p, cx + s * 64 - 44, 940, cx + s * 64 + 44, 974, 12, c1, 8); }
  // arms
  const sw = Math.sin(work * 6.283);
  for (const s of [-1, 1]) {
    const up = tool && s > 0 ? 1 : 0;
    const a0 = [cx + s * 120, top + 420 * tall], a1 = [cx + s * 170, top + (520 - up * 140) * tall + sw * 20 * up], a2 = [cx + s * (150 + up * 40), top + (640 - up * 300) * tall + sw * 40 * up];
    p.stroke(curve(a0, a1, a2), 34, INK); p.stroke(curve(a0, a1, a2), 20, "#3a3840");
    p.ell(a2[0], a2[1], 22, 22, c1, 8);
    if (up && tool === 1) { p.stroke([a2, [a2[0] + 30, a2[1] - 70]], 22, INK); p.stroke([a2, [a2[0] + 30, a2[1] - 70]], 12, "#c9ccd2"); }  // welder
    if (up && tool === 2) { p.stroke([a2, [a2[0] - 20, a2[1] - 80]], 18, INK); rr(p, a2[0] - 60, a2[1] - 120, a2[0] + 20, a2[1] - 76, 8, "#8b8f96", 7); } // hammer
  }
  // body
  const body = rrect(cx - 130, top + 330 * tall, cx + 130, top + 820 * tall, 40);
  p.gradFill(body, c0, c1, rad(-120), 0.3); p.poly(body, null, 10);
  p.clip(body, () => {
    for (let i = 0; i < 7; i++) p.ell(cx - 100 + ((i * 53) % 200), top + (380 + ((i * 97) % 400)) * tall, 16, 10, "#7a4520", 0);   // rust
    rr(p, cx - 70, top + 420 * tall, cx + 70, top + 560 * tall, 14, "#25232b", 6);
    p.dot(cx - 30, top + 490 * tall, 10, mix("#3b3a40", "#ffb347", on)); p.dot(cx + 10, top + 490 * tall, 10, mix("#3b3a40", PIP.ind, on));
  });
  // head
  const hd = v === 1 ? rrect(cx - 110, top + 80 * tall, cx + 110, top + 320 * tall, 30) : ellPts(cx, top + 200 * tall, 125, 115 * tall);
  p.gradFill(hd, c0, c1, rad(-120), 0.3); p.poly(hd, null, 10);
  rr(p, cx - 85, top + 150 * tall, cx + 85, top + 260 * tall, 30, "#1d1b24", 7);
  for (const s of [-1, 1]) {
    const ex = cx + s * 40, ey = top + 205 * tall;
    if (on > 0.05) glow(g, PIP.eyeGlow, 40 * on, () => p.ell(ex, ey, 22, 26, mix("#33323a", "#dffaff", on), 0));
    else p.ell(ex, ey, 20, 24, "#33323a", 4);
  }
  p.stroke([[cx, top + 80 * tall], [cx, top + 30 * tall]], 18, INK); p.ell(cx, top + 22 * tall, 16, 16, mix("#3b3a40", PIP.ind, on), 6);
};

/** newspaper held up by a distracted worker (no text: grey squiggle columns) */
export const fxPaper = (p, k = 0) => {
  const w = 230 - k * 40;
  p.poly([[300 - w, 380], [300 + w, 370], [300 + w + 10, 640], [300 - w - 8, 650]], "#ece6d6", 10);
  p.stroke([[300, 375], [302, 645]], 5, "#9b9484");
  for (let c = 0; c < 4; c++) for (let r = 0; r < 7; r++) { const x = 300 - w + 30 + c * (w / 2) , y = 420 + r * 30; p.stroke([[x, y], [x + w / 2 - 40, y + 2]], 7, r === 0 ? "#5a5560" : "#b5ae9e"); }
  rr(p, 300 - w + 30, 430, 300 - w + 120, 520, 6, "#c9c0ad", 0);
};
/** steaming mug */
export const fxMug = (p, t = 0) => {
  rr(p, 240, 560, 360, 720, 18, "#c9553f", 10); p.arc(372, 630, 30, 40, -80, 80, 14);
  for (let i = 0; i < 3; i++) { const y0 = 540 - ((t * 120 + i * 50) % 150); p.stroke([[270 + i * 30, y0], [260 + i * 30 + 10 * Math.sin(t * 6 + i), y0 - 50]], 10, `rgba(255,255,255,${(0.6 * (1 - ((t * 120 + i * 50) % 150) / 150)).toFixed(2)})`); }
};
/** spark star burst (welding / electrical), 600 x 1000 canvas centre (300,500); t 0..1, seed varies the rays */
export const fxSpark = (p, t, seed = 1, col = "#ffe27a") => {
  const g = p.g, n = 9;
  g.save(); g.globalAlpha = Math.max(0, 1 - t);
  glow(g, "#ffb030", 40, () => {
    for (let i = 0; i < n; i++) { const a = (i / n) * 6.283 + seed * 1.7, r0 = 30 + 40 * t, r1 = 120 + 260 * t * (0.6 + 0.4 * ((i * 7 + seed) % 3) / 2); p.stroke([[300 + Math.cos(a) * r0, 500 + Math.sin(a) * r0], [300 + Math.cos(a) * r1, 500 + Math.sin(a) * r1]], 14 * (1 - t) + 4, col); }
    p.ell(300, 500, 60 * (1 - t) + 10, 60 * (1 - t) + 10, "#fffbe8", 0);
  });
  g.restore();
};
/** turquoise signal pulse ring (screen-facing) */
export const fxPulse = (p, t) => {
  const g = p.g; g.save(); g.globalAlpha = Math.max(0, 1 - t);
  glow(g, PIP.ind, 50, () => { g.beginPath(); g.ellipse(300, 500, 40 + 250 * t, 40 + 250 * t, 0, 0, 6.283); g.strokeStyle = "#aaffef"; g.lineWidth = 30 * (1 - t) + 6; g.stroke(); });
  g.restore();
};
/** small water droplet with a highlight */
export const fxDrop = (p) => { p.poly([[300, 380], [345, 500], [300, 560], [255, 500]], "#a8e4ff", 9); p.ell(300, 505, 46, 52, "#a8e4ff", 0); p.ell(285, 490, 12, 16, "#ffffff", 0); };
/** concrete dust burst (k 0..1) on 600 x 1000 */
export const fxDebrisDust = (p, k, col = "#d9cbb4") => fxDust(p, k, col);

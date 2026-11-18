// ---------- world ----------
// "The Little Robot That Held Back a Flood": arch dam + valley + village + maintenance station + mechanism enclosure,
// plus an enclosed underground tunnel set at x = TUN.x. Layout constants live in layout.js (shared with story.js).
const DECK = L.APRON;
const world = new THREE.Group(); scene.add(world);
const W2 = {}; // handles to animated world parts
// extra materials
const texD = (c, rx_ = 1, ry_ = 1, color = '#ffffff') => toon({ map: P.tex(c, rx_, ry_), color });
const MD = {
  conc: texD(PD.concrete(21), 1, 1), concB: texD(PD.concrete(31, 60), 1, 1), apron: texD(PD.apron(22), 1, 1),
  rust: texD(PD.rust(23), 1, 1), rustR: texD(PD.rust(33, '#8a4a2a'), 1, 1), steel: texD(PD.steel(24), 1, 1), steelY: texD(PD.steel(34, '#c79a3a'), 1, 1),
  corr: texD(PD.corrugated(25), 1, 1), rock: texD(PD.rock(26), 1, 1), tWall: texD(PD.tunnelWall(27), 1, 1), tFloor: texD(PD.tunnelFloor(28), 1, 1),
  pl1: texD(PD.plasterWarm(29, 38, 86), 1, 1), pl2: texD(PD.plasterWarm(39, 22, 82), 1, 1), pl3: texD(PD.plasterWarm(49, 48, 78), 1, 1),
  field1: texD(PD.field(30, 72), 1, 1), field2: texD(PD.field(40, 46), 1, 1),
  charcoal: toon({ color: '#34323a' }), yellow: toon({ color: '#e2ad2f' }), hazard: texD(PD.apron(52), 1, 1),
  winGold: new THREE.MeshBasicMaterial({ color: '#ffc857', fog: true }), lamp: new THREE.MeshBasicMaterial({ color: '#fff1c4', fog: true }),
  beacon: new THREE.MeshBasicMaterial({ color: '#ff3b2f', fog: true }), lockLamp: new THREE.MeshBasicMaterial({ color: '#ff3b2f', fog: true }),
  sig: new THREE.MeshBasicMaterial({ color: '#2fe0cf', fog: true, transparent: true, depthWrite: false, opacity: 0.5 }),
};
for (const k of ['conc', 'concB', 'apron', 'rock', 'tWall', 'tFloor', 'field1', 'field2', 'steel', 'steelY', 'rust', 'rustR', 'corr', 'pl1', 'pl2', 'pl3', 'hazard']) MD[k].map.wrapS = MD[k].map.wrapT = THREE.RepeatWrapping;

// ---- crack-aware dam concrete: toon material + world-space crack / scanner / repair overlay ----
const crackTex = new THREE.CanvasTexture(PD.crackMap()); crackTex.colorSpace = THREE.NoColorSpace; crackTex.anisotropy = 4;
const crackU = { crackMap: { value: crackTex }, crackT: { value: 0 }, scanC: { value: new THREE.Vector2(0, 14) }, scanR: { value: 0 }, scanOn: { value: 0 },
  repair: { value: 0 }, wet: { value: 0 } };
const damMat = MD.conc.clone(); damMat.map = MD.conc.map;
damMat.onBeforeCompile = (sh) => {
  Object.assign(sh.uniforms, crackU);
  sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;')
    .replace('#include <project_vertex>', '#include <project_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
  sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
    varying vec3 vWP; uniform sampler2D crackMap; uniform float crackT, scanR, scanOn, repair, wet; uniform vec2 scanC;`)
    .replace('#include <map_fragment>', `#include <map_fragment>
    { vec2 cuv = vec2((vWP.x + 40.) / 80., vWP.y / 40.);
      if (cuv.x > 0. && cuv.x < 1. && cuv.y > 0. && cuv.y < 1. && vWP.z > -1.5) {
        vec4 ck = texture2D(crackMap, cuv); float m = smoothstep(.3, .7, ck.g);
        float rev = m * (1. - smoothstep(crackT - .004, crackT + .004, ck.r));
        float dw = distance(vWP.xy, vec2(0., 14.));
        diffuseColor.rgb *= 1. - wet * .32 * (1. - smoothstep(0., 2.5 + wet * 6., dw)) * step(vWP.y, 14.5 + 1.5 * wet);
        vec3 crackCol = mix(vec3(.05, .04, .05), vec3(.74, .73, .69), repair);
        diffuseColor.rgb = mix(diffuseColor.rgb, crackCol, rev);
        float sd = distance(vWP.xy, scanC);
        float inS = (1. - smoothstep(scanR * .85, scanR, sd)) * scanOn;
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.12, .95, .85), m * inS * (1. - rev) * .95);
        float ring = (smoothstep(scanR - .22, scanR - .05, sd) - smoothstep(scanR - .05, scanR + .05, sd)) * scanOn;
        float grid = (step(.94, fract(vWP.x * 1.4)) + step(.94, fract(vWP.y * 1.4))) * inS * .25;
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.3, 1., .9), clamp(ring + grid, 0., 1.));
      } }`);
};

// ---- water: river, reservoir, flood (front-limited), tunnel flood; reuse the engine water look ----
const mkWater = (opts = {}) => {
  const u = { t: { value: 0 }, deep: { value: new THREE.Color('#2a6f7a') }, shal: { value: new THREE.Color('#5fb3b0') }, glint: { value: new THREE.Color('#effaff') },
    front: { value: 1e5 }, foamK: { value: opts.foam || 0 }, murk: { value: opts.murk || 0 }, flowDir: { value: opts.flow ?? 1 } };
  const m = new THREE.ShaderMaterial({ uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), ...u }, fog: true,
    vertexShader: `#include <fog_pars_vertex>
      varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.); vW = w.xyz; vec4 mvPosition = viewMatrix*w; gl_Position = projectionMatrix*mvPosition;
      #include <fog_vertex>
      }`,
    fragmentShader: `#include <fog_pars_fragment>
      uniform float t, front, foamK, murk, flowDir; uniform vec3 deep, shal, glint; varying vec3 vW;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
      void main(){
        float fz = front - vW.z + 1.2*sin(vW.x*.35 + t*3.) + .8*noise(vW.xz*.4 + t);
        if (fz < 0.) discard;
        vec2 p = vW.xz*vec2(.35,.12) + vec2(0., -t*.25*flowDir);
        float n = noise(p) * .6 + noise(p*2.3 + 7.) * .4;
        vec3 c = mix(deep, shal, .35 + .45*n);
        c = mix(c, vec3(.42,.38,.27), murk*(.5+.5*noise(vW.xz*.08 + t*.05)));
        float streak = smoothstep(.72, .78, noise(vW.xz*vec2(.8,.09) + vec2(0., -t*.6*flowDir)));
        c = mix(c, glint, streak*.7);
        float foam = foamK * (smoothstep(.55, .75, noise(vW.xz*.9 + vec2(t*.7, -t*1.4))) + (1. - smoothstep(0., 4., fz)));
        c = mix(c, vec3(.95,.97,.98), clamp(foam, 0., 1.)*.9);
        gl_FragColor = vec4(c,1.);
        #include <fog_fragment>
      }`,
  });
  m.userData.u = u;
  // matching normal/depth material: same front cut so the ink never outlines water that isn't drawn
  m.userData.ndMat = new THREE.ShaderMaterial({ uniforms: u,
    vertexShader: `varying vec3 vW; varying float vD; void main(){ vec4 w = modelMatrix*vec4(position,1.); vW = w.xyz; vec4 mv = viewMatrix*w; vD = -mv.z; gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform float front, t; varying vec3 vW; varying float vD;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
      void main(){ float fz = front - vW.z + 1.2*sin(vW.x*.35 + t*3.) + .8*noise(vW.xz*.4 + t); if (fz < 0.) discard; gl_FragColor = vec4(.5,1.,.5,vD); }` });
  return m;
};
const waters = [];
const addWater = (w, d, x, y, z, opts) => { const m = mkWater(opts); const me = new THREE.Mesh(new THREE.PlaneGeometry(w, d, 1, 1), m); me.rotation.x = -Math.PI / 2; me.position.set(x, y, z);
  me.userData.nd = m.userData.ndMat; me.receiveShadow = false; scene.add(me); waters.push(me); return me; };
const river = addWater(18, 900, 0, 0.12, 460, { foam: 0.15 });
const reservoir = addWater(900, 500, 0, 39.2, -262, { foam: 0, flow: -0.3 });
const flood = addWater(150, 260, 0, -1, 140, { foam: 0.6, murk: 0.7 });
const tunWater = addWater(4.3, L.TUN.len, L.TUN.x, -1, -L.TUN.len / 2, { foam: 0.9, murk: 0.3, flow: -2 });
const poolW = addWater(30, 22, 0, 0.18, 13, { foam: 0.8 });

// ---- flowing water sheets (leak trickle, jets, breach fall) ----
const flowMat = (c1 = '#5fb8c8', c2 = '#dff6ff') => {
  const u = { t: { value: 0 }, amt: { value: 0 }, c1: { value: new THREE.Color(c1) }, c2: { value: new THREE.Color(c2) }, speed: { value: 2.5 } };
  const m = new THREE.ShaderMaterial({ uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), ...u }, fog: true, side: THREE.DoubleSide,
    vertexShader: `#include <fog_pars_vertex>
      varying vec2 vUv; void main(){ vUv = uv; vec4 mvPosition = modelViewMatrix*vec4(position,1.); gl_Position = projectionMatrix*mvPosition;
      #include <fog_vertex>
      }`,
    fragmentShader: `#include <fog_pars_fragment>
      uniform float t, amt, speed; uniform vec3 c1, c2; varying vec2 vUv;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
      void main(){
        float e = abs(vUv.x - .5) * 2.;
        float wob = .12 * noise(vec2(vUv.y*6. - t*speed*1.3, vUv.x*3.));
        if (e > amt * (.88 + wob) || amt < .01) discard;
        if (vUv.y > .02 + amt * 1.2) discard;
        float s = noise(vec2(vUv.x*18., vUv.y*4. - t*speed));
        vec3 c = mix(c1, c2, smoothstep(.45, .8, s));
        c = mix(c, vec3(1.), smoothstep(.7, 1., e / max(amt, .01)) * .6);
        gl_FragColor = vec4(c, 1.);
        #include <fog_fragment>
      }`,
  });
  m.userData.u = u; return m;
};
/** bent sheet: starts at p0 going out along dir (+z) with speed v0, falls under gravity to floorY. width w. */
const sheetGeo = (w, v0, h0, floorY = 0.2, segs = 40) => {
  const g = new THREE.PlaneGeometry(1, 1, 4, segs), pa = g.attributes.position, uv = g.attributes.uv;
  const tHit = (v0 * 0 + Math.sqrt(2 * 9.8 * Math.max(0.1, h0 - floorY))) / 9.8;
  for (let i = 0; i < pa.count; i++) {
    const u = uv.getX(i), v = 1 - uv.getY(i), tt = v * tHit * 1.15;
    const z = v0 * tt, y = Math.max(floorY - h0, -0.5 * 9.8 * tt * tt);
    pa.setXYZ(i, (u - 0.5) * w * (1 + v * 0.6), y, z); uv.setXY(i, u, 1 - v);
  }
  g.computeVertexNormals(); return g;
};
// uv.y = 1 at source in PlaneGeometry; the shader uses vUv.y as "distance from source" so flip:
const flipV = (g) => { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i)); return g; };
const sheets = {};
const addSheet = (name, geo, x, y, z, ry = 0) => { const m = flowMat(); const me = new THREE.Mesh(flipV(geo), m); me.position.set(x, y, z); me.rotation.y = ry; me.userData.ndSkip = true; me.castShadow = false; scene.add(me); sheets[name] = me; return me; };
// leak trickle running down the face from the crack (vertical strip on the face)
{ const g = new THREE.PlaneGeometry(0.7, 14, 1, 20); g.translate(0, -7, 0); addSheet('leak', g, 0.2, L.CRACK0[1], L.faceZ(0.2) + 0.06); }
addSheet('jetA', sheetGeo(0.5, 3.0, 15.5), -1.6, 15.5, L.faceZ(-1.6) + 0.05);
addSheet('jetB', sheetGeo(0.6, 3.6, 11.0), 2.4, 11.0, L.faceZ(2.4) + 0.05);
addSheet('jetC', sheetGeo(0.45, 2.6, 18.0), 4.6, 18.0, L.faceZ(4.6) + 0.05);
addSheet('breach', sheetGeo(11.5, 9.5, 12.0, 0.2, 48), 0, 12.0, -0.4);
addSheet('breachLow', sheetGeo(11.5, 6.0, 4.0, 0.2, 30), 0, 4.2, -0.2);
{ const g = new THREE.PlaneGeometry(4.2, 4, 1, 8); g.translate(0, 0, 0); const me = addSheet('tunSurge', g, L.TUN.x, 1.6, -L.TUN.len + 2); }

// ---- the dam: arch of vertical slabs; the centre slab is modular (breach chunks + emergency gate) ----
const dam = new THREE.Group(); world.add(dam);
const slabAt = (x, w, y0, y1, mat = damMat, parent = dam, d = L.DAM_D) => {
  const th = Math.asin(x / L.R_ARC), cx = Math.sin(th) * (L.R_ARC + d / 2), cz = L.ARC_CZ - Math.cos(th) * (L.R_ARC + d / 2);
  const m = add(tbox(w, y1 - y0, d, 4), mat, cx, (y0 + y1) / 2, cz, parent); m.rotation.y = -th; return m;
};
const SLAB = 8.05;
for (let i = 1; i <= 8; i++) for (const s of [-1, 1]) {
  const x = s * (8 + (i - 0.5) * SLAB);
  slabAt(x, SLAB, 0, L.DAM_H);
  // stepped toe at the base
  const th = Math.asin(x / L.R_ARC), m = add(tbox(SLAB, 4, 3, 4), damMat, Math.sin(th) * (L.R_ARC - 1.5), 2, L.ARC_CZ - Math.cos(th) * (L.R_ARC - 1.5), dam); m.rotation.y = -th;
}
// centre slab pieces around the breach hole (x -8..8)
const B = L.BREACH;
add(tbox(16, B.y0, L.DAM_D, 4), damMat, 0, B.y0 / 2, -L.DAM_D / 2, dam);
add(tbox(16, L.DAM_H - B.y1, L.DAM_D, 4), damMat, 0, (B.y1 + L.DAM_H) / 2, -L.DAM_D / 2, dam);
for (const s of [-1, 1]) add(tbox(2, B.y1 - B.y0, L.DAM_D, 4), damMat, s * 7, (B.y0 + B.y1) / 2, -L.DAM_D / 2, dam);
// breach chunks 3 x 3 (fly out in shot 4)
const chunks = [];
for (let iy = 0; iy < 3; iy++) for (let ix = 0; ix < 3; ix++) {
  const w = 4, h = 6, x = -4 + ix * 4, y = B.y0 + h / 2 + iy * h;
  const c = add(tbox(w, h, L.DAM_D, 4), damMat, x, y, -L.DAM_D / 2, dam); c.userData.p0 = c.position.clone(); c.userData.k = iy * 3 + ix; chunks.push(c);
}
// reservoir water wall inside the hole (seen only once the chunks are gone)
{ const m = flowMat('#3f8f9a', '#bfe9f0'); m.userData.u.amt.value = 1; const me = new THREE.Mesh(flipV(new THREE.PlaneGeometry(12, 18, 1, 8)), m); me.position.set(0, (B.y0 + B.y1) / 2, -L.DAM_D + 0.3); me.userData.ndSkip = true; dam.add(me); W2.holeWater = me; }
// emergency gate (slides down behind the hole face)
const gate = new THREE.Group(); dam.add(gate);
add(tbox(12.6, 18.6, 0.6, 3), MD.steel, 0, 0, 0, gate);
for (let k = -2; k <= 2; k++) add(tbox(0.35, 18.6, 0.5, 2), MD.rust, k * 2.6, 0, 0.5, gate);
for (let k = -3; k <= 3; k++) add(tbox(12.6, 0.3, 0.45, 2), MD.rust, 0, k * 2.7, 0.5, gate);
gate.userData.yUp = (B.y0 + B.y1) / 2 + 19.5; gate.userData.yDown = (B.y0 + B.y1) / 2; gate.position.set(0, gate.userData.yUp, -2.2);
// crest: road, parapets, lamp posts, gatehouse with hoist wheel, gantry
for (let x = -68; x <= 68; x += 4) {
  const th = Math.asin(x / L.R_ARC), cx = Math.sin(th) * (L.R_ARC + L.DAM_D / 2), cz = L.ARC_CZ - Math.cos(th) * (L.R_ARC + L.DAM_D / 2);
  const p = add(tbox(4.05, 1.1, 0.45, 2), MD.concB, Math.sin(th) * (L.R_ARC + 0.25), L.DAM_H + 0.55, L.ARC_CZ - Math.cos(th) * (L.R_ARC + 0.25), dam); p.rotation.y = -th;
  const q = add(tbox(4.05, 1.1, 0.45, 2), MD.concB, Math.sin(th) * (L.R_ARC + L.DAM_D - 0.25), L.DAM_H + 0.55, L.ARC_CZ - Math.cos(th) * (L.R_ARC + L.DAM_D - 0.25), dam); q.rotation.y = -th;
  if (Math.abs(x) % 16 === 4) { const lp = add(new THREE.CylinderGeometry(0.1, 0.12, 4, 6), MD.charcoal, Math.sin(th) * (L.R_ARC + 0.3), L.DAM_H + 2.6, L.ARC_CZ - Math.cos(th) * (L.R_ARC + 0.3), dam); add(tbox(0.7, 0.3, 0.4, 1), MD.lamp, lp.position.x, L.DAM_H + 4.6, lp.position.z + 0.2, dam); }
  void cx; void cz;
}
const gh = new THREE.Group(); gh.position.set(0, L.DAM_H, -L.DAM_D / 2); dam.add(gh);
add(tbox(10, 4.5, 7, 2), MD.concB, 0, 2.25, 0, gh);
add(tbox(11, 0.5, 8, 2), MD.corr, 0, 4.7, 0, gh);
for (const s of [-1, 1]) add(tbox(1.2, 1.4, 0.1, 1), MD.winGold, s * 2.6, 2.6, 3.52, gh, { cast: false });
const hoist = new THREE.Group(); hoist.position.set(0, 7.4, 1.2); gh.add(hoist);
add(new THREE.TorusGeometry(2.1, 0.22, 8, 28), MD.rustR, 0, 0, 0, hoist);
for (let k = 0; k < 6; k++) { const sp = add(tbox(4.1, 0.18, 0.18, 1), MD.rustR, 0, 0, 0, hoist); sp.rotation.z = k * Math.PI / 6; }
add(new THREE.CylinderGeometry(0.4, 0.4, 0.8, 10), MD.charcoal, 0, 0, 0, hoist).rotation.x = Math.PI / 2;
for (const s of [-1, 1]) add(tbox(0.4, 3.4, 0.4, 1), MD.rust, s * 2.5, 5.8, 1.2, gh);
// gantry crane on the crest (rusty)
{ const g = new THREE.Group(); g.position.set(26, L.DAM_H, L.faceZ(26) - 5); g.rotation.y = -Math.asin(26 / L.R_ARC); dam.add(g);
  for (const s of [-1, 1]) for (const t of [-1, 1]) add(tbox(0.5, 8, 0.5, 2), MD.rustR, s * 4, 4, t * 4, g);
  for (const t of [-1, 1]) add(tbox(9, 0.7, 0.7, 2), MD.rustR, 0, 8.2, t * 4, g);
  add(tbox(1.6, 1.2, 9, 2), MD.steelY, 1.5, 7.4, 0, g); W2.gantry = g; }
// face details: ladders, a mid-height walkway, outlet pipes with valve wheels, gauge stripes
const ladder = (x, y0, y1) => { const z = L.faceZ(x) + 0.35, th = -Math.asin(x / L.R_ARC);
  for (const s of [-0.3, 0.3]) { const r_ = add(tbox(0.08, y1 - y0, 0.08, 1), MD.rust, x + s, (y0 + y1) / 2, z, dam); r_.rotation.y = th; }
  for (let y = y0 + 0.3; y < y1; y += 0.45) { const r_ = add(tbox(0.6, 0.05, 0.05, 1), MD.rust, x, y, z, dam, { cast: false }); r_.rotation.y = th; } };
ladder(-14.5, 0.6, 20); ladder(13.5, 0.6, 30); ladder(-36.5, 0.6, 24);
for (let x = -22; x <= 22; x += 2) { if (Math.abs(x) < 9) continue; const z = L.faceZ(x) + 0.7, th = -Math.asin(x / L.R_ARC);
  const w = add(tbox(2.05, 0.15, 1.4, 1), MD.steel, x, 20, z, dam); w.rotation.y = th; const r_ = add(tbox(2.05, 0.06, 0.06, 1), MD.rust, x, 21, z + 0.65, dam); r_.rotation.y = th;
  const pst = add(tbox(0.06, 1, 0.06, 1), MD.rust, x, 20.5, z + 0.65, dam); pst.rotation.y = th; }
for (const x of [-22, 21]) { const z = L.faceZ(x), th = -Math.asin(x / L.R_ARC), g = new THREE.Group(); g.position.set(x, 2.3, z); g.rotation.y = th; dam.add(g);
  const pipe = add(new THREE.CylinderGeometry(1.1, 1.1, 5, 16), MD.rustR, 0, 0, 2.4, g); pipe.rotation.x = Math.PI / 2;
  add(new THREE.TorusGeometry(1.25, 0.18, 8, 20), MD.rust, 0, 0, 1.2, g); add(new THREE.TorusGeometry(1.25, 0.18, 8, 20), MD.rust, 0, 0, 4.6, g);
  const vw = add(new THREE.TorusGeometry(0.6, 0.08, 6, 16), MD.beacon.clone(), 0, 1.6, 3.4, g); vw.material = toon({ color: '#b23a2a' }); vw.rotation.x = Math.PI / 2;
  add(new THREE.CylinderGeometry(0.1, 0.1, 0.6, 6), MD.charcoal, 0, 1.3, 3.4, g); }
for (let k = 0; k < 8; k++) { const x = 30.5, z = L.faceZ(x) + 0.04, th = -Math.asin(x / L.R_ARC); const m = add(tbox(0.9, 0.5, 0.05, 1), k % 2 ? MD.charcoal : MD.yellow, x, 4 + k * 2.5, z, dam, { cast: false }); m.rotation.y = th; }
// vertical drive shaft from the mechanism enclosure up to the crest (rusty pipe with brackets)
{ const x = L.GEAR.x, z = L.faceZ(x) + 0.55; const sh = add(new THREE.CylinderGeometry(0.28, 0.28, L.DAM_H - 4, 10), MD.rustR, x, 4 + (L.DAM_H - 4) / 2, z, dam);
  for (let y = 6; y < L.DAM_H; y += 5) add(tbox(0.9, 0.3, 0.9, 1), MD.rust, x, y, z - 0.1, dam); }
// valley walls (rock) the dam is keyed into, and the reservoir rim
for (const s of [-1, 1]) {
  const a = add(tbox(70, 66, 120, 12), MD.rock, s * 104, 26, 8, world); a.rotation.y = s * 0.12;
  const b = add(tbox(60, 40, 90, 12), MD.rock, s * 118, 14, 92, world, { cast: false }); b.rotation.y = s * 0.35;
  const c = add(tbox(90, 60, 140, 12), MD.rock, s * 120, 24, -110, world, { cast: false }); c.rotation.y = -s * 0.1;
  for (let k = 0; k < 7; k++) { const r_ = add(new THREE.DodecahedronGeometry(4 + (k % 3) * 2, 0), MD.rock, s * (66 + k * 2.2), 1.5 + (k % 2), 14 + k * 9, world); r_.rotation.set(k, k * 2, 0); }
}

// ---- downstream valley: ground, apron, fields, village, hill, trees ----
const ground = add(new THREE.PlaneGeometry(1400, 1400), M.grass, 0, 0, 500, world, { cast: false }); ground.rotation.x = -Math.PI / 2;
{ const gm = M.grass.clone(); gm.map = M.grass.map.clone(); gm.map.repeat.set(140, 140); gm.map.needsUpdate = true; ground.material = gm; }
// apron walkway along the dam foot (arc)
for (let x = -64; x <= 64; x += 4) {
  const th = Math.asin(x / L.R_ARC), d = Math.abs(x) < 9 ? 0 : 14, m = add(tbox(4.1, DECK, 14, 3), MD.apron, Math.sin(th) * (L.R_ARC - 7), DECK / 2, L.ARC_CZ - Math.cos(th) * (L.R_ARC - 7), world, { cast: false });
  m.rotation.y = -th; if (!d) { m.scale.z = 0.4; m.position.z += 4; }
}
// riverbanks (dirt) along the channel
for (const s of [-1, 1]) { const b = add(tbox(3, 0.5, 900, 6), M.dirt, s * 10, 0.05, 460, world, { cast: false }); }
// fields (patchwork) between the dam and the village
const rf = P.rng(71);
for (let i = 0; i < 14; i++) { const s = i % 2 ? 1 : -1, x = s * (18 + rf() * 40), z = 30 + rf() * 50; const f = add(new THREE.PlaneGeometry(14 + rf() * 10, 10 + rf() * 8), i % 3 ? MD.field1 : MD.field2, x, 0.03, z, world, { cast: false }); f.rotation.x = -Math.PI / 2; f.rotation.z = rf() * 0.6 - 0.3; }
// village houses: plaster, terracotta roofs, golden windows
const houses = [];
const house = (x, z, w, d, h, rot, mat) => {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; world.add(g);
  add(tbox(w, h, d, 2), mat, 0, h / 2, 0, g);
  const rfm = add(new THREE.ConeGeometry(Math.hypot(w, d) / 2 + 0.5, 2.2, 4), M.roof, 0, h + 1.1, 0, g); rfm.rotation.y = Math.PI / 4; rfm.scale.set(w / Math.hypot(w, d) * 1.414, 1, d / Math.hypot(w, d) * 1.414);
  add(box(0.9, 1.8, 0.1), M.door, 0, 0.9, d / 2 + 0.03, g, { cast: false });
  for (const s of [-1, 1]) { add(box(0.7, 0.8, 0.1), MD.winGold, s * w * 0.3, h * 0.62, d / 2 + 0.03, g, { cast: false }); add(box(0.1, 0.8, 0.7), MD.winGold, s * (w / 2 + 0.03), h * 0.62, 0, g, { cast: false }); }
  add(tbox(0.6, 1.4, 0.6, 1), M.stone, w * 0.25, h + 1.6, 0, g);  // chimney
  houses.push(g); return g;
};
const rh = P.rng(12);
for (let i = 0; i < 30; i++) {
  const s = i % 2 ? 1 : -1, x = s * (14 + rh() * 34), z = L.VILLAGE_Z[0] + rh() * (L.VILLAGE_Z[1] - L.VILLAGE_Z[0]);
  house(x, z, 4 + rh() * 3, 4 + rh() * 2.5, 3.4 + rh() * 2.6, (rh() - 0.5) * 0.8 + (s > 0 ? Math.PI * 0.5 : -Math.PI * 0.5) * 0.3, [MD.pl1, MD.pl2, MD.pl3][i % 3]);
}
// bell tower + bridge
{ const g = new THREE.Group(); g.position.set(-24, 0, 128); world.add(g); add(tbox(4, 14, 4, 2), MD.pl3, 0, 7, 0, g); const r_ = add(new THREE.ConeGeometry(3.4, 4, 4), M.roof, 0, 16, 0, g); r_.rotation.y = Math.PI / 4;
  add(box(1.2, 1.6, 0.1), MD.winGold, 0, 11.5, 2.03, g, { cast: false }); }
add(tbox(24, 0.6, 4, 2), M.plank, 0, 0.9, 124, world);
// the hill (higher ground) + trees
const hillM = add(new THREE.SphereGeometry(L.HILL.r, 40, 20), M.hill, L.HILL.x, L.HILL.cy, L.HILL.z, world, { cast: false });
const cypress = (x, z, h = 7, y = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); world.add(g); add(new THREE.CylinderGeometry(0.15, 0.2, 1, 6), M.trunk, 0, 0.5, 0, g); const c = add(new THREE.SphereGeometry(1, 10, 10), M.cypress, 0, 0.9 + h / 2, 0, g); c.scale.set(0.95, h / 2, 0.95); return g; };
const pine = (x, z, h = 6, y = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); world.add(g); const t = add(new THREE.CylinderGeometry(0.2, 0.3, h, 6), M.trunk, 0, h / 2, 0, g); t.rotation.z = 0.08; const c = add(new THREE.SphereGeometry(1, 12, 8), M.pine, 0.3, h + 0.3, 0, g); c.scale.set(3.2, 1.1, 3.2); return g; };
const rt = P.rng(44);
for (let i = 0; i < 70; i++) { const s = rt() < 0.5 ? -1 : 1, x = s * (16 + rt() * 70), z = 24 + rt() * 200; if (Math.abs(x) < 12) continue; if (x > L.YARD.x0 - 4 && x < L.YARD.x1 + 4 && z > L.YARD.z0 - 4 && z < L.YARD.z1 + 4) continue;
  let near = false; for (const h of houses) if (Math.hypot(h.position.x - x, h.position.z - z) < 5) near = true; if (near) continue;
  (i % 3 ? cypress : pine)(x, z, 5 + rt() * 4, L.hillY(x, z)); }
for (let i = 0; i < 20; i++) { const a = rt() * 6.283, d = rt() * 40; const x = L.HILL.x + Math.cos(a) * d, z = L.HILL.z + Math.sin(a) * d; if (Math.hypot(x - L.HILL.x, z - L.HILL.z) < 12) continue; cypress(x, z, 5 + rt() * 3, L.hillY(x, z)); }
// trees on top of the valley walls
for (let i = 0; i < 26; i++) { const s = i % 2 ? 1 : -1; pine(s * (75 + rt() * 50), -40 + rt() * 110, 5 + rt() * 4, 59); }
// far hills + mountains
for (let i = 0; i < 16; i++) { const a = rt() * Math.PI * 2, d = 260 + rt() * 160; const h = add(new THREE.SphereGeometry(50 + rt() * 40, 20, 10), i % 2 ? M.hill : M.hillFar, Math.cos(a) * d, -14, 120 + Math.sin(a) * d, world, { cast: false }); h.scale.y = 0.5 + rt() * 0.3; }
for (let i = 0; i < 14; i++) { const a = rt() * Math.PI * 2, d = 560 + rt() * 200, hh = 140 + rt() * 120, r_ = 120 + rt() * 70; const g = new THREE.Group(); g.position.set(Math.cos(a) * d, -5, Math.sin(a) * d); world.add(g); add(new THREE.ConeGeometry(r_, hh, 7), M.mount, 0, hh / 2, 0, g, { cast: false }); add(new THREE.ConeGeometry(r_ * 0.3, hh * 0.3, 7), M.snow, 0, hh * 0.86, 0, g, { cast: false }); }
// the abandoned robot yard: sheds, scrap piles (the robots themselves are instanced billboards)
{ const Y = L.YARD; for (let k = 0; k < 3; k++) { const g = new THREE.Group(); g.position.set(Y.x0 + 8 + k * 18, 0, Y.z1 + 4); world.add(g); add(tbox(12, 4.5, 7, 2), MD.rust, 0, 2.25, 0, g); const r_ = add(tbox(13, 0.4, 8, 2), MD.corr, 0, 4.8, 0, g); r_.rotation.z = 0.06; }
  const rs = P.rng(77); for (let k = 0; k < 18; k++) { const m = add(new THREE.DodecahedronGeometry(0.8 + rs() * 1.4, 0), k % 2 ? MD.rust : MD.rustR, Y.x0 + rs() * (Y.x1 - Y.x0), 0.5, Y.z0 + rs() * (Y.z1 - Y.z0), world); m.rotation.set(rs() * 3, rs() * 3, 0); m.scale.y = 0.6; } }

// ---- maintenance station: hut, corrugated roof, siren pole with beacon, warning lever box, bench ----
const station = new THREE.Group(); station.position.set(L.STATION.x, DECK, L.STATION.z); world.add(station);
add(tbox(6, 3.2, 4, 2), MD.concB, 0, 1.6, 0, station);
add(tbox(6.8, 0.25, 4.8, 2), MD.corr, 0, 3.35, 0.2, station).rotation.x = -0.08;
add(box(1.0, 2.0, 0.1), M.door, 1.8, 1.0, 2.03, station, { cast: false });
add(box(1.3, 0.9, 0.1), MD.winGold, -1.4, 1.9, 2.03, station, { cast: false });
add(tbox(1.5, 0.2, 0.3, 1), MD.yellow, -1.4, 1.35, 2.1, station);
const leverBox = add(tbox(0.7, 0.9, 0.3, 1), MD.yellow, L.LEVER.x - L.STATION.x, L.LEVER.y - DECK, 2.15, station);
const leverG = new THREE.Group(); leverG.position.set(L.LEVER.x - L.STATION.x, L.LEVER.y - DECK + 0.1, 2.35); station.add(leverG);
add(tbox(0.08, 0.6, 0.08, 1), MD.charcoal, 0, 0.3, 0, leverG); add(new THREE.SphereGeometry(0.1, 10, 8), toon({ color: '#c8302a' }), 0, 0.62, 0, leverG);
W2.lever = leverG;
const siren = new THREE.Group(); siren.position.set(3.6, 0, 1.8); station.add(siren);
add(new THREE.CylinderGeometry(0.09, 0.11, 4.6, 8), MD.charcoal, 0, 2.3, 0, siren);
const horn = add(new THREE.ConeGeometry(0.42, 0.9, 12, 1, true), MD.rustR, 0, 4.4, 0.35, siren); horn.rotation.x = Math.PI / 2;
const beacon = add(new THREE.SphereGeometry(0.22, 12, 8), MD.beacon, 0, 4.95, 0, siren); W2.beacon = beacon;
// bench + crates + tool rack
add(tbox(2.6, 0.12, 0.6, 1), M.plank, L.BENCH.x - L.STATION.x, 0.48, L.BENCH.z - L.STATION.z, station);
for (const s of [-1, 1]) add(tbox(0.12, 0.45, 0.5, 1), M.beam, L.BENCH.x - L.STATION.x + s * 1.1, 0.22, L.BENCH.z - L.STATION.z, station);
add(tbox(0.9, 0.7, 0.9, 1), M.plank, -3.9, 0.35, 1.4, station); add(tbox(0.7, 0.55, 0.7, 1), M.plank, -3.6, 0.98, 1.4, station);
// hatch to the tunnel (opens in shot 5)
const hatch = new THREE.Group(); hatch.position.set(6.4, DECK + 0.02, L.STATION.z + 3); world.add(hatch);
add(tbox(1.3, 0.1, 1.3, 1), MD.steelY, 0.65, 0, 0, hatch); W2.hatch = hatch;
add(tbox(1.5, 0.08, 1.5, 1), MD.charcoal, 6.4 + 0.65, DECK, L.STATION.z + 3, world, { cast: false });

// ---- emergency mechanism enclosure (open-top concrete walls at the dam foot) ----
const pit = new THREE.Group(); world.add(pit);
add(tbox(0.6, 3.2, 9, 2), MD.concB, -46.6, DECK + 1.6, 15.2, pit);
add(tbox(13.4, 3.2, 0.6, 2), MD.concB, -40, DECK + 1.6, 19.5, pit);
add(tbox(0.6, 1.2, 11, 2), MD.concB, -33.4, DECK + 0.6, 13.8, pit);
// big gear on the dam face (axis +z), teeth as boxes
const gear = new THREE.Group(); gear.position.set(L.GEAR.x, L.GEAR.y, L.GEAR.z); gear.rotation.y = -Math.asin(L.GEAR.x / L.R_ARC); world.add(gear);
const gearSpin = new THREE.Group(); gear.add(gearSpin);
{ const d = add(new THREE.CylinderGeometry(2.3, 2.3, 0.45, 32), MD.rustR, 0, 0, 0, gearSpin); d.rotation.x = Math.PI / 2;
  for (let k = 0; k < 20; k++) { const a = k / 20 * Math.PI * 2, t = add(tbox(0.5, 0.55, 0.45, 1), MD.rustR, Math.cos(a) * 2.5, Math.sin(a) * 2.5, 0, gearSpin); t.rotation.z = a; }
  for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2, h = add(new THREE.CylinderGeometry(0.42, 0.42, 0.5, 12), MD.charcoal, Math.cos(a) * 1.3, Math.sin(a) * 1.3, 0.02, gearSpin); h.rotation.x = Math.PI / 2; }
  const hub = add(new THREE.CylinderGeometry(0.55, 0.55, 0.8, 14), MD.steel, 0, 0, 0.2, gearSpin); hub.rotation.x = Math.PI / 2; }
// small gear meshing with it
const gear2 = new THREE.Group(); gear2.position.set(2.9, 2.0, 0.1); gear.add(gear2);
{ const d = add(new THREE.CylinderGeometry(1.0, 1.0, 0.4, 20), MD.rust, 0, 0, 0, gear2); d.rotation.x = Math.PI / 2;
  for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2, t = add(tbox(0.36, 0.4, 0.4, 1), MD.rust, Math.cos(a) * 1.12, Math.sin(a) * 1.12, 0, gear2); t.rotation.z = a; } }
// handwheel on a pedestal
const wheelG = new THREE.Group(); wheelG.position.set(-43.2, DECK + 1.25, 13.0); world.add(wheelG);
add(tbox(0.5, 1.2, 0.5, 1), MD.steel, -43.2, DECK + 0.6, 12.6, world);
const wheelSpin = new THREE.Group(); wheelG.add(wheelSpin);
{ add(new THREE.TorusGeometry(0.6, 0.06, 8, 24), toon({ color: '#b23a2a' }), 0, 0, 0, wheelSpin); for (let k = 0; k < 3; k++) { const s = add(tbox(1.2, 0.06, 0.06, 1), MD.charcoal, 0, 0, 0, wheelSpin); s.rotation.z = k * Math.PI / 3; } }
// locking housing with the empty socket (PIP becomes the missing pin)
const lockG = new THREE.Group(); lockG.position.set(L.LOCK.x, DECK, L.LOCK.z); lockG.rotation.y = -Math.asin(L.LOCK.x / L.R_ARC); world.add(lockG);
add(tbox(0.55, 1.6, 1.2, 1), MD.steelY, -0.62, 0.8, 0, lockG); add(tbox(0.55, 1.6, 1.2, 1), MD.steelY, 0.62, 0.8, 0, lockG);
add(tbox(1.8, 0.45, 1.2, 1), MD.steelY, 0, 1.82, 0, lockG); add(tbox(1.8, 0.2, 1.2, 1), MD.charcoal, 0, 0.1, 0, lockG);
add(tbox(0.7, 1.2, 0.2, 1), MD.charcoal, 0, 0.95, -0.55, lockG);                                  // dark socket back
for (const s of [-1, 1]) add(tbox(0.06, 1.5, 0.08, 1), MD.charcoal, s * 0.36, 0.95, 0.61, lockG);  // hazard edges
const lockLamp = add(new THREE.SphereGeometry(0.13, 10, 8), MD.lockLamp, 0, 2.2, 0.35, lockG); W2.lockLamp = lockLamp;
const lockBolt = add(tbox(2.4, 0.3, 0.3, 1), MD.steel, 1.9, 1.3, 0.2, lockG); W2.lockBolt = lockBolt;
add(new THREE.CylinderGeometry(0.12, 0.12, 2.0, 8), MD.charcoal, -1.6, 1.0, 0, lockG).rotation.z = Math.PI / 2;
// pipes along the enclosure wall
for (let k = 0; k < 2; k++) { const pp = add(new THREE.CylinderGeometry(0.16, 0.16, 8.6, 8), MD.rust, -46.1, DECK + 0.6 + k * 0.5, 15.2, world); pp.rotation.x = Math.PI / 2; }
const sigRing = new THREE.Mesh(new THREE.TorusGeometry(1, 0.06, 6, 48), MD.sig); sigRing.userData.ndSkip = true; sigRing.visible = false; scene.add(sigRing); W2.sigRing = sigRing;
const sigBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.6, 80, 12, 1, true), MD.sig.clone()); sigBeam.userData.ndSkip = true; sigBeam.visible = false; scene.add(sigBeam); W2.sigBeam = sigBeam;
// PIP's scanner beam (cone from the head indicator toward the scan point)
const scanCone = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 24, 1, true), new THREE.MeshBasicMaterial({ color: '#4ff0dd', transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide, fog: true }));
scanCone.geometry.translate(0, -0.5, 0); scanCone.userData.ndSkip = true; scanCone.visible = false; scene.add(scanCone); W2.scanCone = scanCone;

// ---- underground maintenance tunnel set (enclosed; along -z at x = TUN.x) ----
const tun = new THREE.Group(); tun.position.set(L.TUN.x, 0, 0); world.add(tun);
const TL = L.TUN.len, TW = 4.4, TH = 4.0;
const tAdd = (geo, mat, x, y, z, o = {}) => add(geo, mat, x, y, z, tun, { cast: false, ...o });
tAdd(tbox(TW, 0.3, TL, 4), MD.tFloor, 0, -0.15, -TL / 2);
tAdd(tbox(TW + 1, 0.3, TL, 4), MD.tWall, 0, TH + 0.15, -TL / 2);
for (const s of [-1, 1]) tAdd(tbox(0.4, TH, TL, 4), MD.tWall, s * (TW / 2 + 0.2), TH / 2, -TL / 2);
tAdd(tbox(TW, TH, 0.4, 4), MD.tWall, 0, TH / 2, 0.2); tAdd(tbox(TW, TH, 0.4, 4), MD.tWall, 0, TH / 2, -TL - 0.2);
// ribs, pipes, cable trays, lamps, red beacons
const tunBeacons = [];
for (let z = -3; z > -TL; z -= 6) {
  for (const s of [-1, 1]) tAdd(tbox(0.3, TH, 0.4, 1), MD.concB, s * (TW / 2 - 0.1), TH / 2, z);
  tAdd(tbox(TW, 0.35, 0.4, 1), MD.concB, 0, TH - 0.15, z);
  tAdd(tbox(0.8, 0.12, 0.3, 1), MD.lamp, 0, TH - 0.36, z - 3);
  if ((z / 6 | 0) % 2 === 0) tunBeacons.push(tAdd(new THREE.SphereGeometry(0.14, 8, 6), MD.beacon, -TW / 2 + 0.15, TH - 0.6, z - 1.5));
}
for (const [y, r_] of [[3.3, 0.18], [2.85, 0.12], [0.5, 0.22]]) { const p_ = tAdd(new THREE.CylinderGeometry(r_, r_, TL, 8), MD.rust, TW / 2 - 0.35, y, -TL / 2); p_.rotation.x = Math.PI / 2; }
{ const p_ = tAdd(new THREE.CylinderGeometry(0.26, 0.26, TL, 8), MD.steelY, -TW / 2 + 0.38, 3.2, -TL / 2); p_.rotation.x = Math.PI / 2; }
tAdd(tbox(0.3, 0.08, TL, 2), MD.charcoal, -TW / 2 + 0.35, 2.4, -TL / 2);
// valve wheels on the pipes
for (let z = -10; z > -TL; z -= 17) { const w = tAdd(new THREE.TorusGeometry(0.28, 0.05, 6, 14), toon({ color: '#b23a2a' }), TW / 2 - 0.62, 3.3, z); w.rotation.y = Math.PI / 2; }
// broken machinery obstacle: toppled pump housing + fallen pipe + debris
const obst = new THREE.Group(); obst.position.set(0, 0, L.OBST_Z); tun.add(obst);
{ const pmp = add(tbox(1.8, 0.9, 1.1, 1), MD.steelY, -0.9, 0.45, 0, obst); pmp.rotation.z = 0.22; pmp.rotation.y = 0.3;
  const fp = add(new THREE.CylinderGeometry(0.3, 0.3, 4.2, 10), MD.rust, 0.6, 0.55, 0.6, obst); fp.rotation.z = Math.PI / 2 - 0.15; fp.rotation.y = 0.35;
  for (let k = 0; k < 6; k++) add(new THREE.DodecahedronGeometry(0.18 + (k % 3) * 0.08, 0), MD.concB, -1.5 + k * 0.6, 0.12, 0.9 - (k % 2) * 1.4, obst); }
// sparking broken cable hanging from the ceiling near the obstacle
tAdd(tbox(0.04, 1.2, 0.04, 1), MD.charcoal, 1.0, TH - 0.6, L.OBST_Z - 1.2);
// bulkhead door (frame + two sliding leaves)
const door = new THREE.Group(); door.position.set(0, 0, L.DOOR_Z); tun.add(door);
add(tbox(TW, 0.5, 0.7, 1), MD.steel, 0, TH - 0.25, 0, door, { cast: false });
for (const s of [-1, 1]) add(tbox(0.5, TH, 0.7, 1), MD.steel, s * (TW / 2 - 0.25), TH / 2, 0, door, { cast: false });
const doorL = add(tbox(TW / 2 - 0.5, TH - 0.5, 0.25, 1), MD.steelY, -TW / 4 - 0.25, (TH - 0.5) / 2, 0, door, { cast: false });
const doorR = add(tbox(TW / 2 - 0.5, TH - 0.5, 0.25, 1), MD.steelY, TW / 4 + 0.25, (TH - 0.5) / 2, 0, door, { cast: false });
for (const d of [doorL, doorR]) { d.userData.x0 = d.position.x; for (let k = 0; k < 4; k++) add(tbox(0.06, 0.5, 0.27, 1), MD.charcoal, (k - 1.5) * 0.35, 0.3, 0, d, { cast: false }); }
W2.doorL = doorL; W2.doorR = doorR;
const doorLamp = tAdd(new THREE.SphereGeometry(0.16, 8, 6), MD.beacon, 0, TH - 0.15, L.DOOR_Z + 0.4); tunBeacons.push(doorLamp);
// far end: ladder up to the mechanism enclosure
for (let y = 0.4; y < TH; y += 0.4) tAdd(tbox(0.8, 0.06, 0.06, 1), MD.rust, 0, y, -TL + 0.15);

// ---- point lights (constant count so shaders never recompile): warning red, PIP turquoise, spark orange ----
const pRed = new THREE.PointLight('#ff3020', 0, 0, 2), pTq = new THREE.PointLight('#3ff0dc', 0, 0, 2), pSpk = new THREE.PointLight('#ffb040', 0, 0, 2);
scene.add(pRed); scene.add(pTq); scene.add(pSpk);

// ---- instanced particles: droplets (noink), debris (inked), sparks (additive) ----
const PCAP = { drop: 1400, debris: 220, spark: 260, dust: 120 };
const dropMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), toon({ color: '#d4f1fb' }), PCAP.drop); dropMesh.userData.ndSkip = true; dropMesh.castShadow = false; dropMesh.frustumCulled = false; scene.add(dropMesh);
const debMesh = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), damMat, PCAP.debris); debMesh.castShadow = true; debMesh.frustumCulled = false; scene.add(debMesh);
const spkMesh = new THREE.InstancedMesh(new THREE.OctahedronGeometry(1, 0), new THREE.MeshBasicMaterial({ color: '#ffd36a', fog: true }), PCAP.spark); spkMesh.userData.ndSkip = true; spkMesh.castShadow = false; spkMesh.frustumCulled = false; scene.add(spkMesh);
const dustMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshBasicMaterial({ color: '#d8cdb8', transparent: true, opacity: 0.5, depthWrite: false, fog: true }), PCAP.dust); dustMesh.userData.ndSkip = true; dustMesh.castShadow = false; dustMesh.frustumCulled = false; scene.add(dustMesh);
const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler(), tmpS = new THREE.Vector3(), tmpP = new THREE.Vector3();
const fillInst = (mesh, list, cap) => {
  const n = Math.min(cap, list.length);
  for (let i = 0; i < n; i++) { const q_ = list[i]; tmpE.set(q_[4] || 0, q_[5] || 0, q_[6] || 0); tmpQ.setFromEuler(tmpE); tmpS.set(q_[3], (q_[7] ?? 1) * q_[3], q_[3]); tmpP.set(q_[0], q_[1], q_[2]); tmpM.compose(tmpP, tmpQ, tmpS); mesh.setMatrixAt(i, tmpM); }
  mesh.count = n; mesh.instanceMatrix.needsUpdate = true; mesh.visible = n > 0;
};

// ---- instanced robot billboards (hundreds of dormant / awakened repair units) ----
const ATL = (() => { const c = document.createElement('canvas'); c.width = 1200; c.height = 1000; const g = c.getContext('2d');
  for (let v = 0; v < 4; v++) for (let on = 0; on < 2; on++) { g.save(); g.translate(v * 300, on * 500); g.scale(0.5, 0.5); T.unitDraw(new T.Pen(g), v, on, 0.25, on ? (v % 3) : 0); g.restore(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; })();
const robotNd = new THREE.ShaderMaterial({ uniforms: { map: { value: ATL } },
  vertexShader: `varying vec2 vUv; varying float vD; void main(){ vUv=uv; vec4 mv = modelViewMatrix*instanceMatrix*vec4(position,1.); vD=-mv.z; gl_Position=projectionMatrix*mv; }`,
  fragmentShader: `uniform sampler2D map; varying vec2 vUv; varying float vD; void main(){ if(texture2D(map,vUv).a<.5) discard; gl_FragColor=vec4(0.,0.,0.,vD); }`, side: THREE.DoubleSide });
const robotMeshes = [];
for (let v = 0; v < 4; v++) for (let on = 0; on < 2; on++) {
  const g = new THREE.PlaneGeometry(0.72, 1.2); g.translate(0, 0.6, 0); const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (v + uv.getX(i)) / 4, 1 - (on + 1 - uv.getY(i)) / 2);
  const m = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ map: ATL, alphaTest: 0.5, side: THREE.DoubleSide, fog: true }), 400);
  m.userData.nd = robotNd; m.castShadow = false; m.frustumCulled = false; m.count = 0; scene.add(m); robotMeshes.push(m);
}
const robotState = (list, cam) => {
  const buckets = robotMeshes.map(() => []);
  for (const r_ of list) buckets[(r_.v % 4) * 2 + (r_.on > 0.5 ? 1 : 0)].push(r_);
  robotMeshes.forEach((m, k) => {
    const L_ = buckets[k], n = Math.min(400, L_.length);
    for (let i = 0; i < n; i++) { const r_ = L_[i]; tmpE.set(0, Math.atan2(cam.position.x - r_.x, cam.position.z - r_.z), r_.roll || 0); tmpQ.setFromEuler(tmpE); tmpS.set(r_.s, r_.s, r_.s); tmpP.set(r_.x, r_.y, r_.z); tmpM.compose(tmpP, tmpQ, tmpS); m.setMatrixAt(i, tmpM); }
    m.count = n; m.instanceMatrix.needsUpdate = true; m.visible = n > 0;
  });
};

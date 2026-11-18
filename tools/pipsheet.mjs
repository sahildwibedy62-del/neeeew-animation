// Character model sheet for this film (no three.js needed).
//   node tools/pipsheet.mjs [out.png]
// Draws PIP (expressions, poses, run cycle, back view, damage), the dormant/awake repair units and the human crew
// from web/toon.js. Rebuild toon.js first: cat web/toonbase.js web/roman.js web/robots.js > web/toon.js
import { chromium } from 'playwright'; import http from 'http'; import fs from 'fs'; import path from 'path';

const out = process.argv[2] || 'stills/character_sheet.png';
const ROWS = [
  ['PIP expressions', [
    ['neutral', "T.pipDraw(p,{expr:'neutral'})"], ['wide', "T.pipDraw(p,{expr:'wide',L:'up',R:'up'})"], ['worried', "T.pipDraw(p,{expr:'worried',look:-0.6})"],
    ['determined', "T.pipDraw(p,{expr:'determined',L:'fist',R:'fist'})"], ['sad', "T.pipDraw(p,{expr:'sad',L:'hold',headTilt:-8})"], ['happy', "T.pipDraw(p,{expr:'happy',L:'wave',wv:1})"],
    ['blink', "T.pipDraw(p,{expr:'neutral',blink:1})"], ['off', "T.pipDraw(p,{expr:'off',eyeGlow:0,ind:0,dmg:1})"]]],
  ['PIP poses', [
    ['point', "T.pipDraw(p,{expr:'worried',R:'point',look:0.7,tilt:-4})"], ['scan', "T.pipDraw(p,{expr:'neutral',R:'scan',look:0.5})"], ['lever', "T.pipDraw(p,{expr:'determined',R:'lever',L:'lever',lift:1})"],
    ['push', "T.pipDraw(p,{expr:'determined',L:'push',R:'push',tilt:8})"], ['run 0', "T.pipDraw(p,{expr:'determined',run:1,step:0,L:'swing',R:'swing',tilt:6})"],
    ['run .25', "T.pipDraw(p,{expr:'determined',run:1,step:0.25,L:'swing',R:'swing',tilt:6})"], ['back', "T.pipDraw(p,{back:true,windAmt:0.8,wind:0.3})"], ['crouch', "T.pipDraw(p,{expr:'determined',crouch:1,squash:0.6})"]]],
  ['Repair units + crew', [
    ['unit 0 off', "T.unitDraw(p,0,0)"], ['unit 1 on', "T.unitDraw(p,1,1,0.2,1)"], ['unit 2 on', "T.unitDraw(p,2,1,0.5,2)"], ['unit 3 off', "T.unitDraw(p,3,0)"],
    ['crewA paper', "T.romanFront(p,'crewA',{seed:41,expr:'neutral',L:'cross',R:'cross'})"], ['crewB snore', "T.romanFront(p,'crewB',{seed:42,expr:'snore',blink:1})"],
    ['villB shock', "T.romanFront(p,'villB',{seed:51,expr:'shock',L:'up',R:'up'})"], ['villD', "T.romanFront(p,'villD',{seed:54,expr:'nervous'})"]]],
];
const root = path.resolve('web');
const page = `<!doctype html><meta charset=utf-8><body style="margin:0"><canvas id=c></canvas><script type=module>
import * as T from './toon.js';
const rows = ${JSON.stringify(ROWS)};
const CW = 300, CH = 500, c = document.getElementById('c'); c.width = CW * 8; c.height = (CH + 40) * rows.length + 60;
const g = c.getContext('2d'); g.fillStyle = '#efe8da'; g.fillRect(0, 0, c.width, c.height);
g.fillStyle = '#241726'; g.font = 'bold 34px sans-serif'; g.fillText('THE LITTLE ROBOT THAT HELD BACK A FLOOD  -  character model sheet', 16, 42);
rows.forEach(([title, cells], r) => {
  const y0 = 60 + r * (CH + 40);
  g.fillStyle = '#7a6e66'; g.font = 'bold 20px sans-serif'; g.fillText(title, 10, y0 + 22);
  cells.forEach(([label, code], i) => {
    g.save(); g.translate(i * CW, y0 + 36); g.scale(CW / 600, CH / 1000);
    try { const p = new T.Pen(g); (new Function('T', 'p', code))(T, p); } catch (e) { console.log('ERR ' + label + ' ' + e.message); }
    g.restore();
    g.fillStyle = '#241726'; g.font = '18px sans-serif'; g.fillText(label, i * CW + 10, y0 + CH + 30);
  });
});
window.ready = true;
</script>`;
const srv = http.createServer((q, s) => {
  const u = decodeURIComponent(q.url.split('?')[0]);
  if (u === '/' || u === '/sheet.html') { s.writeHead(200, { 'Content-Type': 'text/html' }); return s.end(page); }
  const p = path.join(root, path.normalize(u));
  if (!p.startsWith(root) || !fs.existsSync(p)) { s.writeHead(404); return s.end(); }
  s.writeHead(200, { 'Content-Type': 'text/javascript' }); fs.createReadStream(p).pipe(s);
}).listen(0);
await new Promise((r) => srv.on('listening', r));
const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 2400, height: 1700 } });
let errs = 0;
pg.on('console', (m) => { console.log('PAGE', m.text()); if (m.text().startsWith('ERR')) errs++; });
pg.on('pageerror', (e) => { console.log('ERR', e.message); errs++; });
await pg.goto(`http://localhost:${srv.address().port}/sheet.html`);
await pg.waitForFunction(() => window.ready, null, { timeout: 60000 }).catch(() => {});
const d = await pg.evaluate(() => window.ready ? document.getElementById('c').toDataURL('image/png') : null);
await b.close(); srv.close();
if (!d) { console.log('sheet failed: toon.js did not load'); process.exit(1); }
fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, Buffer.from(d.split(',')[1], 'base64'));
console.log(`wrote ${out}${errs ? `  (${errs} errors)` : ''}`); process.exit(errs ? 1 : 0);

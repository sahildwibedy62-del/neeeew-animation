# The Little Robot That Held Back a Flood

This is a 60-second vertical (1080x1920, 30 fps) animated short made with the WhatIF Animation Stories cartoon kit. The characters are flat 2D ink cards set inside a toon-shaded, inked three.js r160 world, rendered frame by frame in headless Chromium using CPU WebGL. The soundtrack is sound effects only: no voice and no music.

## Technologies
three.js r160 (vendored), the Pen/toon library (MIT, vendored), Playwright with Chromium, Node 22.6+, Python 3 with numpy and Pillow, and ffmpeg/ffprobe.

## Run locally
```
npm i playwright && npx playwright install chromium
pip install numpy pillow
cat web/toonbase.js web/roman.js web/robots.js > web/toon.js
node tools/pipsheet.mjs stills/character_sheet.png          # character sheet
node tools/render.mjs stills/a "5,200,400" && python3 tools/sheet.py stills/a stills/sheet_a.jpg
```
Rendering happens on your own machine. It does not use Netlify and needs no Netlify login.

## Roadmap
See `PLAN.md`. The 3D world still has to be connected into the engine. After that come the shot plan (`story.js`), the SFX-only audio, the look check, the full render and the QA, and finally the project documentation and the Netlify dashboard.

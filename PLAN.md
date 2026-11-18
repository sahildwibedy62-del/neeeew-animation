# PLAN — The Little Robot That Held Back a Flood (60 s, 1800 frames, 1080x1920, 30 fps, SFX only)

## Milestones
1. [x] Source audit — both ZIPs contain the same kit (only the top folder name differs). Engine, tools, vendor libraries and the example are copied unchanged into `engine/`, `tools/`, `vendor/`, `reference/`.
2. [x] Foundation — canonical folders created; `web/` is the runnable render root (engine copy + `lib/three.module.js` + built `toon.js`).
3. [x] PIP and cast design — `web/robots.js` (PIP, repair units, crew/villager outfits, FX cards); model sheet `stills/character_sheet.png` via `tools/pipsheet.mjs`.
4. [~] World — painted textures `web/paint_dam.js`, shared layout `web/layout.js`, dam/village/station/mechanism/tunnel/water/particles/robot-instancing code in `production/src/world_section.js`. **Not yet spliced into `web/main.js`** (it replaces the region between `// ---------- world ----------` and `// ---------- cards ----------`, the helmet prop, and `worldState()`; main.js must also import `./layout.js` as `L` and `./paint_dam.js` as `PD`). Not yet render-tested.
5. [ ] `web/story.js` — 8 shots with these frame ranges: 0–149, 150–359, 360–599, 600–869, 870–1139, 1140–1409, 1410–1619, 1620–1799. Plus cameras (motion.js `camFromKeys`), lights (sunrise/golden/tunnel/blue), worldAt, actorsAt, fxAt. Write `storyboard/PLAN.md` with the shot table.
6. [ ] SFX-only audio — `audio/sfx.py` using `Track(60.0)` (not `for_voice`), no music/drone; new synths (drip, servo, scan click, grind, spark, startup clicks). Add a `--sfx-only` mode to `finish.sh` (no voice reference, one measured gain to −14 LUFS, alimiter −1 dBTP, 60.000 s check). Keep voice mode untouched.
7. [ ] Look check — stills contact sheet for every shot; fix framing and ink problems.
8. [ ] Full render (`RESUME=1 WORKERS=2`, about 3 s per frame, roughly 1.5 h) → encode → QA (`out/qa.txt`).
9. [ ] Docs: CLAUDE.md, PROJECT_STATE.md, DECISIONS.md, CHANGELOG.md, DEPLOYMENT.md, ACCOUNT_SETUP.md, RENDER_GUIDE.md, ASSET_MANIFEST.md, `.gitignore` (frames, node_modules, out/*.mp4, .netlify/state), `netlify.toml` (static dashboard from `site/`, no site IDs).
10. [ ] Static Netlify dashboard in `site/` (storyboard, sheets, QA report, MP4 link).

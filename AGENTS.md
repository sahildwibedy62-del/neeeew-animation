# AGENTS.md

Read `PLAN.md` first. It lists what is done and the next action.

## Architecture
- `engine/`, `tools/`, `vendor/`, `reference/` hold the original kit, unmodified. Treat them as read-only.
- `web/` is the render root that `tools/render.mjs` serves (the `WEB` env var overrides it). It contains a copy of the engine, `lib/three.module.js`, `toonbase.js` (type-stripped from `vendor/toon.ts`), `robots.js` (this film's cast), `paint_dam.js` (textures plus the crack map), `layout.js` (shared world coordinates) and `story.js` (still the soldier example; it must be replaced).
- `web/toon.js` is a build artefact: `cat web/toonbase.js web/roman.js web/robots.js > web/toon.js`. `robots.js` depends on toonbase internals (`curve`, `rrect`, `ellPts`, `mix`, `rad`, `OUTFITS`) because the files are concatenated.
- `production/src/world_section.js` is the new world code, waiting to be spliced into `web/main.js`.

## Conventions and non-obvious decisions
- Every animation is a pure function of the frame number. Use the seeded `P.rng`; never use `Math.random`.
- Keep the counts of lights, instanced meshes and cards fixed, so shaders never recompile in the middle of a render.
- Water meshes use their own normal/depth material with the same front cut-off, so the ink pass never outlines water that isn't drawn.
- Audio is SFX only. Don't use `march`, `drone`, `sting` or `Track.for_voice()`. Create the track with `Track(60.0)`.
- Never commit frames, `node_modules`, tokens or Netlify site IDs. In this environment `node_modules/playwright*` are local symlinks into `/tmp`; don't commit them.
- Don't run build commands in agent sessions.

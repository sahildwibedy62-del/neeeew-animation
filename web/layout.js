// Shared world layout for main.js (geometry) and story.js (staging). Metres; y up; the village is downstream (+z).
export const R_ARC = 100, ARC_CZ = 100;                 // arch dam: face on a circle of radius 100 centred at (0, 0, 100)
export const DAM_H = 42, DAM_D = 10, APRON = 0.6;       // crest height, thickness, apron (walkway) top
export const faceZ = (x) => ARC_CZ - Math.sqrt(R_ARC * R_ARC - x * x);  // downstream face z at x
export const BREACH = { x0: -6, x1: 6, y0: 2, y1: 20 }; // section that blows out in shot 4
export const CRACK0 = [0, 14];                          // where the first crack appears (matches paint_dam CRACK_ORIGIN)
export const STATION = { x: 24, z: 10.2 };              // maintenance station hut (front wall at z + 2)
export const LEVER = { x: 22.4, y: 1.75, z: 12.25 };    // warning lever box on the hut front wall
export const BENCH = { x: 18.6, z: 12.6 };              // distracted workers
export const PIT = { x: -40, z: 14 };                   // emergency mechanism enclosure (open top) at the dam foot
export const LOCK = { x: -37.4, z: faceZ(-37.4) + 1.15 };  // locking socket PIP wedges into
export const GEAR = { x: -41.2, y: 3.1, z: faceZ(-41.2) + 0.7 };
export const TUN = { x: 600, len: 130 };                // underground tunnel set (separate, enclosed)
export const DOOR_Z = -78;                              // bulkhead door in the tunnel
export const OBST_Z = -44;                              // broken machinery in the tunnel
export const HILL = { x: -92, z: 132, r: 60, cy: -40, sy: 1 };  // higher ground the villagers run up
export const hillY = (x, z) => { const d2 = (x - HILL.x) ** 2 + (z - HILL.z) ** 2; return Math.max(0, HILL.cy + Math.sqrt(Math.max(0, HILL.r * HILL.r - d2)) * HILL.sy); };
export const YARD = { x0: 44, x1: 84, z0: 36, z1: 72 };  // abandoned robot yard (east bank)
export const VILLAGE_Z = [82, 175];

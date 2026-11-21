// Spindledeep — the one level, authored as carve/fill primitives (metres, y up).
// The world builder (terrain.js) rasterises these, erodes the edges with noise and makes the SDF.
// Route: cottage on the Brink → down the Throat → left into the Root Gardens → the Bell Gallery
// (left to right over the brambles) → the Ink Mere (right to left over the ink) → the Loom.

export const WORLD = { x0: 0, y0: -262, w: 120, h: 304, ppm: 8 };

const T = (pts) => ({ s: 'tunnel', pts });
const E = (cx, cy, rx, ry) => ({ s: 'ellipse', cx, cy, rx, ry });
const B = (x0, y0, x1, y1, r = 0.6) => ({ s: 'box', x0, y0, x1, y1, r });
const P = (pts) => ({ s: 'poly', pts });

// ground line of the surface (the Brink); everything below it is rock until carved
export function surfaceY(x) {
  return 0.0 + 0.5 * Math.sin(x * 0.21) + 0.35 * Math.sin(x * 0.53 + 1.3) + (x < 22 ? (22 - x) * 0.05 : 0);
}

export const OPS = [
  // ── the Throat: the pit under the Brink ────────────────────────────────────
  ['carve', P([[41.5, 2], [43, -5], [46, -11], [44.5, -20], [46.5, -29], [45, -38], [46.5, -46], [49, -58], [52, -63],
    [70, -63], [74, -56], [76.5, -45], [74.5, -35], [77, -26], [75, -16], [77.5, -6], [78.5, 2]])],
  ['fill', B(38, -10.6, 52.5, -8.6, 0.8)],     // L1
  ['fill', B(57.5, -18.6, 82, -16.6, 0.8)],    // L2
  ['fill', B(38, -27.6, 54, -25.6, 0.8)],      // L3
  ['fill', B(60, -35.6, 82, -33.6, 0.8)],      // L4
  ['fill', B(38, -41.8, 53.5, -39.6, 0.8)],    // L5: the peg; rappel off its lip
  ['carve', B(44.5, -51.8, 48.4, -46.6, 1.2)],   // undercut beneath L5 (the way out)
  ['carve', T([[47, -49.6, 1.7], [41, -50.4, 1.6], [36, -51.6, 1.7]])],
  ['carve', E(59, -6, 6, 3.5)],                // a little alcove air near the top so the walls breathe

  // ── the Root Gardens ───────────────────────────────────────────────────────
  ['carve', E(23, -54.5, 13.5, 6.8)],          // G1
  ['carve', E(9.5, -48.5, 3.2, 2.4)],          // alcove with a skein, up and left
  ['carve', T([[13, -53, 1.3], [10, -49, 1.4]])],
  ['carve', T([[12.5, -59, 2.1], [13, -66, 2.0], [15, -71, 2.2]])],  // drop into G2
  ['carve', E(25, -76.5, 16, 6.6)],            // G2
  ['carve', T([[39, -80, 1.7], [41.5, -86, 1.7], [37, -93, 1.8], [31, -99, 2.0], [29, -105, 2.2]])], // down to the Gallery
  ['fill', E(25, -84.2, 9, 2.6)],              // G2 floor hump

  // ── the Bell Gallery ───────────────────────────────────────────────────────
  ['carve', E(60, -127, 55, 21.5)],
  ['carve', E(28, -110, 6, 5)],
  ['fill', B(4, -121, 26.5, -117.8, 1.0)],     // B0, the west ledge
  ['fill', P([[43, -150], [43.8, -124.4], [48.6, -124.4], [49.5, -150]])],   // pillar P1
  ['fill', P([[64.5, -150], [65.4, -120.4], [70.6, -120.4], [71.5, -150]])], // pillar P2
  ['fill', P([[86.5, -150], [87.6, -126.4], [91.4, -126.4], [92.5, -150]])], // pillar P3
  ['fill', B(99.5, -124, 118, -121.6, 1.0)],   // B1, the east ledge
  ['carve', B(7, -146.5, 113, -128, 2.5)],     // flatten the gallery floor
  ['fill', B(0, -152, 120, -146.5, 0.5)],      // the floor (brambles grow on it)

  // ── shaft to the Mere ──────────────────────────────────────────────────────
  ['carve', T([[109, -123, 2.4], [110, -135, 2.4], [108.5, -147, 2.4], [109.5, -160, 2.6]])],

  // ── the Ink Mere ───────────────────────────────────────────────────────────
  ['carve', E(60, -182, 55, 22)],
  ['fill', B(0, -208, 120, -200.5, 0.6)],      // bed of the lake (ink fills to -196.6 between the shores)
  ['fill', B(98.5, -200, 120, -194.2, 1.2)],   // east shore
  ['fill', B(0, -200, 21, -194.2, 1.2)],       // west shore
  ['fill', P([[74.5, -199], [76, -192.2], [80, -192.2], [81.5, -199]])],   // I1
  ['fill', P([[48.5, -199], [50, -190.4], [55, -190.4], [56.5, -199]])],   // I2 (peg, memory)
  ['fill', P([[29, -199], [30.4, -193], [33.6, -193], [35, -199]])],       // I3
  // stalactites
  ['fill', P([[68, -160], [70.4, -171], [72, -160]])],
  ['fill', P([[44, -160], [46.2, -173], [48.6, -160]])],
  ['fill', P([[88, -161], [89.2, -168], [91, -161]])],
  ['fill', P([[22, -161], [23.6, -170], [25.6, -161]])],

  // ── down to the Loom ───────────────────────────────────────────────────────
  ['carve', T([[11, -195, 2.2], [9.5, -203, 2.2], [12, -211, 2.4], [16, -217, 2.6]])],
  ['carve', E(36, -232, 30, 16.5)],
  ['fill', B(0, -262, 120, -246.5, 0.5)],
];

// Areas: title card on first entry, ambience/music state, camera framing.
export const AREAS = [
  { id: 'brink', name: 'The Brink', y1: 50, y0: -6, viewH: 17, amb: [0.16, 0.17, 0.2], moon: 1.0 },
  { id: 'throat', name: 'The Throat', y1: -6, y0: -46, viewH: 19, amb: [0.085, 0.085, 0.1], moon: 0.75, x0: 36, x1: 82 },
  { id: 'gardens', name: 'The Root Gardens', y1: -44, y0: -103, x1: 44, viewH: 16, amb: [0.075, 0.078, 0.08], moon: 0 },
  { id: 'gallery', name: 'The Bell Gallery', y1: -103, y0: -150, viewH: 21, amb: [0.075, 0.072, 0.085], moon: 0 },
  { id: 'mere', name: 'The Ink Mere', y1: -150, y0: -208, viewH: 21, amb: [0.065, 0.068, 0.085], moon: 0 },
  { id: 'loom', name: 'The Loom', y1: -208, y0: -262, viewH: 17, amb: [0.08, 0.07, 0.065], moon: 0 },
];

// Backdrop paintings (scripts/art): world rect they span + parallax.
export const BACKDROPS = [
  { img: 'brink', cx: 45, cy: 13, w: 62, h: 36, par: 0.12 },
  { img: 'throat', cx: 60, cy: -26, w: 44, h: 76, par: 0.5 },
  { img: 'gardens', cx: 24, cy: -74, w: 54, h: 48, par: 0.55 },
  { img: 'bells', cx: 60, cy: -127, w: 94, h: 50, par: 0.55 },
  { img: 'mere', cx: 60, cy: -182, w: 94, h: 50, par: 0.55 },
  { img: 'loom', cx: 36, cy: -232, w: 52, h: 36, par: 0.5 },
]

export const START = { x: 20.5, y: 1.2 };

// The knitter's pegs. Tie the thread to one to make it your new anchor, refill, and respawn here.
export const PEGS = [
  { x: 19.2, y: 0.4, home: true },
  { x: 50.6, y: -39.6 },
  { x: 33.5, y: -60.6 },
  { x: 12.5, y: -82.4 },
  { x: 19.5, y: -117.8 },
  { x: 68, y: -120.4 },
  { x: 104.5, y: -121.6 },
  { x: 104, y: -194.2 },
  { x: 52.5, y: -190.4 },
  { x: 12, y: -194.2 },
  { x: 18, y: -244 },
];

// Iron rings. Hold the thread near one in the air and it snags there: swing.
export const HOOKS = [
  { x: 34.5, y: -112.6 }, { x: 57, y: -112.4 }, { x: 79.5, y: -112.6 }, { x: 96, y: -115.4 },
  { x: 90, y: -183.5 }, { x: 64, y: -181.5 }, { x: 41.5, y: -183 }, { x: 22.5, y: -186.5 },
  { x: 59.5, y: -24.5 }, // over the Throat: a spare ring, for the curious
];

// Bell flowers: a pluck travelling past rings them; rung bells light the dark and keep moths off.
export const BELLS = [
  { x: 34, y: -77, gate: 'g2' },
  { x: 46.2, y: -124.4, gate: 'east' },
  { x: 89.5, y: -126.4, gate: 'east' },
  { x: 108, y: -121.6, gate: 'east' },
  { x: 16, y: -53, gate: null },
  { x: 77.5, y: -192.2, gate: null },
  { x: 31.5, y: -193, gate: null },
];

// Ink veils: strands that block a passage until all their bells ring.
export const GATES = [
  { id: 'g2', x0: 38.9, x1: 39.9, y0: -82.6, y1: -77.2 },
  { id: 'east', x0: 105.8, x1: 112.8, y0: -123.4, y1: -122.4, floor: true },
];

export const SKEINS = [
  { x: 9.2, y: -50.2 }, { x: 47, y: -50.8 }, { x: 46.5, y: -123.8 }, { x: 116, y: -121 }, { x: 31.8, y: -192.6 },
];

export const NESTS = [
  { x: 30, y: -73, n: 4, r: 7 },
  { x: 58, y: -118, n: 4, r: 9 },
  { x: 82, y: -120, n: 5, r: 9 },
  { x: 64, y: -186, n: 5, r: 10 },
  { x: 34, y: -186, n: 4, r: 9 },
];

// Hazards: thorn brambles (capsule chains) and the ink.
// [x0, x1, yRef]: a bramble runs along the ground below yRef between x0 and x1
export const THORNS = [
  [47, 73, -58], [8, 42.5, -140], [49.6, 64.4, -140], [71.6, 86.4, -140], [92.6, 112, -140],
];
export const INK = [{ x0: 20, x1: 99, y: -196.6 }];
// stalactites that drip ink
export const DRIPS = [{ x: 70.4, y: -171 }, { x: 46.2, y: -173 }, { x: 89.2, y: -168 }];

// The knitter's grey thread: from her door, down through the deep, to her chair. Knots hold her voice.
export const GREY = [
  [18.8, 1.4], [30, 0.8], [41.2, 0.6], [42.6, -4], [45.4, -8.4], [47, -8.4], [50, -8.4], [52.4, -9], [56, -12], [58.5, -16.4],
  [66, -16.4], [62, -20], [56, -24], [53.6, -25.4], [44, -25.4], [41, -25.6], [50, -28], [57, -31], [60.5, -33.4],
  [70, -33.4], [64, -37], [54, -39.4], [47, -39.4], [50.2, -40], [53.4, -41], [52, -44], [48, -48.4], [40, -49], [36, -50.5],
  [30, -60.4], [20, -61], [14, -60], [12.8, -66], [16, -71], [22, -82], [30, -81.6], [37, -81], [40.2, -84], [37, -92],
  [31, -99], [28.5, -106], [24, -117.6], [26.5, -118], [34.5, -112.6], [45, -124.2], [57, -112.4], [67, -120.2],
  [79.5, -112.6], [89, -126.2], [96, -115.4], [101, -121.4], [109, -125], [110, -136], [108.6, -148], [109.6, -160],
  [104, -193.9], [99, -194], [90, -183.5], [78, -192], [64, -181.5], [52, -190.2], [41.5, -183], [32, -192.8],
  [22.5, -186.5], [17, -194], [11, -196], [9.6, -204], [12.6, -212], [17, -218], [22, -246], [31, -244.6],
];

// Her memories, knotted into the grey thread. `line` keys the voice file (assets/voice/<id>.ogg).
export const MEMORIES = [
  { id: 'm0', x: 37, y: 0.8, text: "I've gone down after the light, little one. Don't follow me. ...But if you do, keep hold of the thread." },
  { id: 'm1', x: 44.5, y: -25.4, text: 'Seventy winters I sat at that window and watched the dark breathe. Last night, it called me by my name.' },
  { id: 'm2', x: 26, y: -61, text: "I made you from the scraps of everything I loved. A sleeve of his coat. The ribbon from my wedding. You're stronger than you look." },
  { id: 'm3', x: 30, y: -81.6, text: "The moths came for my yarn first. They don't mean any harm. They're only hungry for warm things." },
  { id: 'm4', x: 67, y: -120.2, text: 'The bells still remember songs. Pluck your thread, and they will answer. Everything down here is only waiting to be answered.' },
  { id: 'm5', x: 52, y: -190.2, text: "Don't let the ink touch the thread. It makes things forget. It made me forget... the colour red." },
  { id: 'm6', x: 17, y: -218, text: "I'm so tired, little one. My yarn's run grey. I don't think I can climb back up." },
];
export const FINALE = {
  x: 31, y: -244.6,
  text: "You came all this way. Tie us together, then... and we'll go home the long way.",
  after: 'There. Now we are one thread.',
};
export const LIGHTS = [
  // static lamps: glow-fungus, the cottage window, her candle
  { x: 13.2, y: 2.2, r: 7, i: 1.3, c: [1.0, 0.62, 0.28], flicker: 1 },   // cottage window
  { x: 22, y: -49.6, r: 6, i: 0.7, c: [0.75, 0.85, 0.8], flicker: 0.2 },  // fungus G1
  { x: 30, y: -72.4, r: 6, i: 0.8, c: [0.75, 0.85, 0.8], flicker: 0.2 },  // fungus G2 (moths gather)
  { x: 33, y: -243.6, r: 9, i: 1.25, c: [1.0, 0.6, 0.27], flicker: 1 },  // her candle
];

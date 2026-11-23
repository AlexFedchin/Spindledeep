// Spindledeep — the one level, authored as carve/fill primitives (metres, y up).
// The world builder (terrain.js) rasterises these, erodes the edges with noise and makes the SDF.
// Route: cottage on the Brink → down the Throat → left into the Root Gardens → the Bell Gallery
// (left to right over the brambles) → the Ink Mere (right to left over the ink) → the Hall of Chairs → down a hole
// into the Hush (east, down, then a long dark gallery west) → the Treadles (rings over the barbs, a rope up, the
// heddles) → down the well into the Loom (the cloth floor, then the climb up the warp to the breast beam).

export const WORLD = { x0: 0, y0: -562, w: 120, h: 604, ppm: 8 };

const T = (pts) => ({ s: 'tunnel', pts });
const E = (cx, cy, rx, ry) => ({ s: 'ellipse', cx, cy, rx, ry });
const B = (x0, y0, x1, y1, r = 0.6) => ({ s: 'box', x0, y0, x1, y1, r });
const P = (pts) => ({ s: 'poly', pts });

// ground line of the surface (the Brink); everything below it is rock until carved
// the knitter's cottage sits on a little levelled yard so it stands on the ground, not over it
export const COTTAGE = { x: 11, w: 7.6, y: 0.55 };
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export function surfaceY(x) {
  const base = 0.0 + 0.5 * Math.sin(x * 0.21) + 0.35 * Math.sin(x * 0.53 + 1.3) + (x < 22 ? (22 - x) * 0.05 : 0);
  const yard = sstep(7.6, 10.2, x) * (1 - sstep(19.6, 22.4, x));
  return base + (COTTAGE.y - base) * yard;
}

export const OPS = [
  // ── the Throat: the pit under the Brink ────────────────────────────────────
  ['carve', P([[41.5, 2], [43, -5], [46, -11], [44.5, -20], [46.5, -29], [45, -38], [46.5, -46], [49, -58], [52, -63],
    [70, -63], [74, -56], [76.5, -45], [74.5, -35], [77, -26], [75, -16], [77.5, -6], [78.5, 2]])],
  ['fill', B(38, -10.6, 52.5, -8.6, 0.8)],     // L1
  ['fill', B(57.5, -18.6, 82, -16.6, 0.8)],    // L2
  ['fill', B(38, -27.6, 54, -25.6, 0.8)],      // L3
  ['fill', B(60, -35.6, 82, -33.6, 0.8)],      // L4
  ['fill', B(38, -41.8, 53, -39.6, 0.8)],      // L5: the peg; rappel off its lip
  ['carve', B(44, -52, 51.2, -46.2, 1.4)],     // undercut beneath L5 (the way out)
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
  ['carve', B(7, -146.5, 113, -128, 2.5)],     // flatten the gallery floor
  ['fill', B(4, -121, 29.5, -117.8, 1.0)],     // B0, the west ledge
  ['fill', P([[34.6, -150], [35.4, -122.4], [44.8, -122.4], [45.6, -150]])],   // pillar P1 (bell)
  ['fill', P([[50.2, -150], [51, -121.4], [59.2, -121.4], [60, -150]])], // pillar P2 (peg, memory)
  ['fill', P([[64.6, -150], [65.4, -123.4], [71.8, -123.4], [72.6, -150]])],         // pillar P3 (bell)
  ['fill', P([[77.2, -150], [78, -122.8], [85.8, -122.8], [86.6, -150]])],         // pillar P4
  ['fill', P([[90.4, -150], [91.2, -122.0], [94.8, -122.0], [95.6, -150]])],     // pillar P5
  ['fill', B(98.5, -124, 118, -121.6, 1.0)],   // B1, the east ledge
  ['fill', B(0, -152, 120, -146.5, 0.5)],      // the floor (brambles grow on it)

  // ── shaft to the Mere ──────────────────────────────────────────────────────
  ['carve', T([[109, -123, 2.4], [110, -135, 2.4], [108.5, -147, 2.4], [109.5, -160, 2.6], [107.6, -169, 2.6], [105.8, -176, 2.6]])],  // breaks through into the Mere's roof

  // ── the Ink Mere ───────────────────────────────────────────────────────────
  ['carve', E(60, -182, 55, 22)],
  ['fill', B(0, -208, 120, -200.5, 0.6)],      // bed of the lake (ink fills to -196.6 between the shores)
  ['fill', B(96.5, -200, 120, -194.2, 1.2)],   // east shore
  ['fill', B(0, -200, 21, -194.2, 1.2)],       // west shore
  ['fill', P([[84.6, -201], [86, -193.0], [91.4, -193.0], [92.8, -201]])],   // I1
  ['fill', P([[72.6, -201], [74, -192.0], [80, -192.0], [81.4, -201]])],   // I2 (bell)
  ['fill', P([[59.1, -201], [60.5, -190.4], [68.7, -190.4], [70.1, -201]])],   // I3 (peg, memory)
  ['fill', P([[46.1, -201], [47.5, -192.0], [54.5, -192.0], [55.9, -201]])],   // I4
  ['fill', P([[33.6, -201], [35, -193.0], [41.5, -193.0], [42.9, -201]])],   // I5 (bell)
  ['fill', P([[23.4, -201], [24.6, -193.4], [28.6, -193.4], [29.8, -201]])], // I6 (skein)
  // stalactites
  ['fill', P([[65.4, -160], [67.6, -171], [69.6, -160]])],
  ['fill', P([[44, -160], [46.2, -173], [48.6, -160]])],
  ['fill', P([[88, -161], [89.2, -168], [91, -161]])],
  ['fill', P([[22, -161], [23.6, -170], [25.6, -161]])],

  // ── down to the Loom ───────────────────────────────────────────────────────
  ['carve', T([[11, -195, 2.2], [9.5, -203, 2.2], [12, -211, 2.4], [16, -217, 2.6]])],
  ['carve', E(11.2, -193.6, 2.2, 1.5)],         // a clean mouth: the shore lip used to pinch the way in shut
  ['carve', E(36, -232, 30, 16.5)],
  ['fill', B(0, -262, 43.5, -246.5, 0.5)],     // the Hall's floor, with a hole in it (her grey thread goes down)
  ['fill', B(50.5, -262, 120, -246.5, 0.5)],

  // ── the Hush ──────────────────────────────────────────────────────────────
  ['carve', T([[47, -246, 3.0], [47.5, -258, 2.8], [47, -270, 2.8]])],     // down the hole
  ['carve', E(47, -276, 13, 8)],               // H1, where you land
  ['fill', B(30, -292, 64, -282.5, 0.6)],
  ['carve', T([[57, -280.4, 1.7], [66, -281.0, 1.6], [74, -280.2, 1.7], [81, -281.2, 1.8]])],
  ['carve', E(90, -280, 12, 7.5)],             // H2
  ['fill', B(76, -292, 104, -285.5, 0.6)],
  ['carve', T([[98, -284, 1.9], [101, -295, 2.0], [99, -305, 2.1], [96, -316, 2.2]])],
  ['carve', B(16, -326, 104, -315, 2.0)],      // H3, the long dark gallery west
  ['fill', P([[86, -326.5], [87.4, -324.6], [89.6, -324.6], [91, -326.5]])],
  ['fill', P([[44, -326.5], [45.4, -324.7], [47.6, -324.7], [49, -326.5]])],
  ['fill', P([[56, -315], [57.5, -318.5], [59, -315]])],
  ['fill', P([[30, -315], [31.2, -319], [32.6, -315]])],
  ['carve', B(71, -330.5, 73.2, -325.5, 0.4)],     // a barbed trench

  // ── the Treadles ──────────────────────────────────────────────────────────
  ['carve', T([[26.5, -324.6, 1.05], [26, -329, 1.5], [25, -338, 2.2], [20, -352, 2.4], [20, -362, 2.4]])],   // a narrow mouth: a running jump clears it
  ['carve', E(40, -372, 30, 18)],              // T1
  ['fill', B(8, -392, 26, -366, 0.8)],         // west ledge
  ['fill', P([[31.2, -392], [32, -366.5], [38, -366.5], [38.8, -392]])],   // pillar
  ['fill', P([[43.2, -392], [44, -366], [50, -366], [50.8, -392]])],       // pillar
  ['fill', B(56, -392, 72, -366, 0.8)],        // east ledge
  ['fill', B(0, -400, 120, -389, 0.5)],        // the barbed floor
  ['carve', B(62.5, -366.2, 70, -349.5, 1.0)], // the slot the rope hangs in
  ['carve', B(66, -358.2, 113, -350, 1.0)],    // the heddle corridor
  // the well down to the Loom, in two drops with a ledge between (one fall would be longer than the yarn)
  ['carve', T([[110, -357, 2.6], [111, -372, 3.0], [110, -390, 3.0], [110, -402, 3.0]])],
  ['carve', B(99.5, -404.6, 113, -398.5, 1.0)],
  ['fill', B(104, -412, 116, -404.6, 0.6)],
  ['carve', T([[101.6, -403, 2.4], [101, -420, 2.8], [104, -440, 3.0], [106, -452, 3.2], [106, -462, 3.0]])],

  // ── the Loom ──────────────────────────────────────────────────────────────
  ['carve', E(60, -492, 56, 62)],
  ['fill', B(0, -562, 120, -540, 0.5)],        // the cloth floor
  ['fill', B(96, -470, 120, -462, 0.8)],       // where you come in
  ['fill', B(46, -506, 56, -503.6, 0.5)],      // a ledge at the top of the first warp
  ['fill', B(30, -505.6, 39.6, -503.2, 0.5)],     // and one past the swinging ring (level with the first: a swing can't climb)
  ['fill', B(33.5, -472.4, 42, -470, 0.5)],
  ['fill', B(0, -450.4, 40, -444, 0.8)],       // the breast beam, where she sits
  ['carve', B(3, -444.1, 44, -436.5, 1.6)],    // and the dark gallery above it

  // ── hidden rooms ───────────────────────────────────────────────────────────
  // Each is a narrow crack off the beaten way into a small room with a keepsake. The cracks are real rock
  // openings, visible in the thread's light but easy to walk past; erosion is kept calm around them (QUIET) so
  // the noise pass cannot seal them.
  // the Cellar: a slit in the moonlit ground at the far west edge, a steep ramp down to a room under her yard
  ['carve', T([[1.4, 1.9, 0.6], [6.6, -3.6, 0.6], [8.6, -3.95, 0.6]])],
  ['carve', E(9.6, -3.2, 2.6, 1.3)],
  // the Diggers' Cache: a crawl at the far end of L2, where the ledge runs into the east wall
  ['carve', T([[75.0, -15.95, 0.6], [78.5, -15.8, 0.58], [82.2, -15.55, 0.6], [85.6, -15.85, 0.62]])],
  ['carve', E(85.8, -14.7, 3.2, 1.85)],
  // the Seed Hollow: a crack low in G2's west wall behind the peg, sloping down
  ['carve', T([[11.6, -80.5, 0.6], [8.8, -82.5, 0.6], [6.4, -84.6, 0.62]])],
  ['carve', E(3.6, -84.6, 2.9, 1.7)],
  // the Ringer's Cell: a crawl where B0 meets the gallery's west wall, behind the great bell
  ['carve', T([[12.4, -117.15, 0.6], [9, -117.0, 0.58], [6.6, -116.7, 0.6]])],
  ['carve', E(4.0, -116.0, 2.5, 1.6)],
  // the Sill: a lip of rock on the shaft's east wall; swing out to it on the way down
  ['fill', B(110.3, -157.0, 112.2, -156.1, 0.25)],
  ['carve', T([[111.2, -155.45, 0.65], [113.6, -155.3, 0.6]])],
  ['carve', E(116.4, -154.7, 2.7, 1.6)],
  // the Last Basket: a crawl at the foot of the Loom's east slope
  ['carve', T([[56.6, -243.65, 0.6], [58.6, -243.75, 0.62], [62.5, -243.6, 0.6], [66.4, -243.25, 0.62], [69.6, -243.55, 0.62]])],
  ['carve', E(70, -242.4, 3.2, 1.8)],
  // the Quiet Room: a crawl at the west end of the Hush's long gallery, past where the way goes down
  ['carve', T([[17.2, -325.4, 0.6], [12.5, -325.45, 0.6], [8.4, -325.25, 0.62]])],
  ['carve', E(5.4, -324.4, 3.0, 1.6)],
  // the Shoe: a crawl at the far end of the Treadles' west ledge
  ['carve', T([[13.2, -365.4, 0.6], [9.5, -365.45, 0.6], [6.6, -365.25, 0.62]])],
  ['carve', E(3.9, -364.4, 2.6, 1.55)],
];

// erosion stays calm in these rects [x0, y0, x1, y1] so the narrow cracks keep their shape
export const QUIET = [
  [0.5, -5.2, 12.8, 3.0], [74, -17.2, 89.6, -12.3], [0.4, -86.8, 12.6, -79.2], [1.2, -118.2, 13.2, -113.8],
  [109.8, -157.6, 119.6, -152.6], [57.6, -244.8, 73.8, -240.0],
  [0.4, -327.2, 18.6, -322.0], [0.4, -367.2, 14.6, -362.0],
];

// Areas: title card on first entry, ambience/music state, camera framing.
export const AREAS = [
  { id: 'brink', name: 'The Brink', y1: 50, y0: -6, viewH: 17, amb: [0.16, 0.17, 0.2], moon: 1.0 },
  { id: 'throat', name: 'The Throat', y1: -6, y0: -46, viewH: 19, amb: [0.032, 0.032, 0.04], moon: 0.45, x0: 36, x1: 82 },
  { id: 'gardens', name: 'The Root Gardens', y1: -44, y0: -103, x1: 44, viewH: 16, amb: [0.026, 0.028, 0.03], moon: 0 },
  { id: 'gallery', name: 'The Bell Gallery', y1: -103, y0: -150, viewH: 19, amb: [0.024, 0.023, 0.03], moon: 0 },
  { id: 'mere', name: 'The Ink Mere', y1: -150, y0: -208, viewH: 19, amb: [0.022, 0.023, 0.03], moon: 0 },
  { id: 'hall', name: 'The Hall of Chairs', y1: -208, y0: -262, viewH: 17, amb: [0.028, 0.024, 0.022], moon: 0 },
  { id: 'hush', name: 'The Hush', y1: -262, y0: -340, viewH: 16, amb: [0.012, 0.012, 0.016], moon: 0 },
  { id: 'treadles', name: 'The Treadles', y1: -340, y0: -430, viewH: 19, amb: [0.022, 0.02, 0.02], moon: 0 },
  { id: 'loom', name: 'The Loom', y1: -430, y0: -562, viewH: 23, amb: [0.03, 0.022, 0.02], moon: 0 },
];

// Backdrop paintings (scripts/art): world rect they span + parallax.
export const BACKDROPS = [
  { img: 'brink', cx: 42, cy: -1, w: 58, h: 32, par: 0.12 },
  { img: 'throat', cx: 60, cy: -26, w: 44, h: 76, par: 0.5 },
  { img: 'gardens', cx: 24, cy: -74, w: 54, h: 48, par: 0.55 },
  { img: 'bells', cx: 60, cy: -127, w: 94, h: 50, par: 0.55 },
  { img: 'mere', cx: 60, cy: -182, w: 94, h: 50, par: 0.55 },
  { img: 'loom', cx: 36, cy: -232, w: 52, h: 36, par: 0.5 },     // the Hall of Chairs (the old Loom painting: chairs under threads)
  { img: 'hush', cx: 60, cy: -300, w: 94, h: 56, par: 0.55 },
  { img: 'treadles', cx: 60, cy: -380, w: 94, h: 60, par: 0.55 },
  { img: 'loomdeep', cx: 60, cy: -492, w: 116, h: 130, par: 0.45 },
]

export const START = { x: 20.5, y: 1.2 };

// The knitter's pegs. Tie the thread to one to make it your new anchor, refill, and respawn here.
export const PEGS = [
  { x: 19.2, y: 0.4, home: true },
  { x: 50.6, y: -39.6 },
  { x: 33.5, y: -60.6 },
  { x: 12.5, y: -82.4 },
  { x: 19.5, y: -117.8 },
  { x: 55, y: -121.4 },
  { x: 103.8, y: -121.6 },
  { x: 104, y: -194.2 },
  { x: 63.5, y: -190.4 },
  { x: 15.6, y: -194.2 },  // west shore, beside the way down
  { x: 18, y: -244 },
  { x: 38.6, y: 0.5 },      // the lip of the pit
  { x: 51.5, y: -25.6 },    // L3, under her memory
  // the deep
  { x: 41.6, y: -246.5 },   // 13: the lip of the hole in the Hall
  { x: 40, y: -282.5 },     // 14: H1
  { x: 96, y: -285.5 },     // 15: H2
  { x: 94, y: -326 },       // 16: H3 east
  { x: 64, y: -326 },       // 17: H3 middle
  { x: 34, y: -326 },       // 18: H3 west
  { x: 18, y: -366 },       // 19: the Treadles' west ledge
  { x: 61, y: -366 },       // 20: the east ledge, under the rope
  { x: 74, y: -358.2 },     // 21: the start of the heddle corridor
  { x: 106, y: -358.2 },    // 22: the end of it
  { x: 104, y: -462 },      // 23: where you come into the Loom
  { x: 72, y: -540 },       // 24: on the cloth (the Weaver wakes when you leave it)
  { x: 50, y: -503.6 },     // 25: the first warp's ledge
  { x: 34, y: -503.2 },     // 26: past the swinging ring
  { x: 37, y: -470 },       // 27
  { x: 32, y: -444 },       // 28: the breast beam (the cloth stops)
  { x: 108.5, y: -404.6 },  // 29: the ledge halfway down the well
];

// Iron rings. Hold the thread near one in the air and it snags there: swing.
export const HOOKS = [
  // placed by the solver (scratchpad hooksolve): each is ~2.5 m above and ~3 m out from its take-off edge,
  // so a held thread only catches it at the top of a running jump
  { x: 32.5, y: -115.3 }, { x: 48.3, y: -119.9 }, { x: 62.2, y: -119.4 }, { x: 75.8, y: -121.9 }, { x: 88.8, y: -120.3 }, { x: 96.8, y: -118.8 },
  { x: 93.4, y: -191.0 }, { x: 82.5, y: -191.0 }, { x: 71.2, y: -189.2 }, { x: 57.5, y: -187.9 }, { x: 44.5, y: -189.5 }, { x: 31.0, y: -191.5 },
  { x: 59.5, y: -24.5 }, // over the Throat: a spare ring, for the curious
  // the Treadles: rings on chains, swinging (sway: [chain length, amplitude rad, period s, phase]); x, y = the ring at rest
  { x: 29.1, y: -363.6, sway: [5, 0.1, 3.4, 0] }, { x: 41.0, y: -364.0, sway: [5, 0.1, 3.4, 2.1] }, { x: 53.1, y: -363.6, sway: [5, 0.1, 3.4, 4.2] },
  // the Loom: one long chain between the ledges
  { x: 43, y: -501, sway: [6, 0.12, 3.6, 0] },
];

// Bell flowers: a pluck travelling past rings them; rung bells light the dark and keep moths off.
export const BELLS = [
  { x: 34, y: -77, gate: 'g2' },
  { x: 42.6, y: -122.4, gate: 'east' },
  { x: 69, y: -123.4, gate: 'east' },
  { x: 101.5, y: -121.6, gate: 'east' },
  { x: 16, y: -53, gate: null },
  { x: 76.5, y: -192.0, gate: null },
  { x: 37.5, y: -193.0, gate: null },
  // the Hush: lit bells keep the hands still
  { x: 92, y: -285.5, gate: null }, { x: 80, y: -326, gate: null }, { x: 52, y: -326, gate: null }, { x: 36.5, y: -326, gate: null },
];

// Ink veils: strands that block a passage until all their bells ring.
export const GATES = [
  { id: 'g2', x0: 38.9, x1: 39.9, y0: -82.6, y1: -77.2 },
  { id: 'east', x0: 105.8, x1: 112.8, y0: -123.4, y1: -122.4, floor: true },
];

// Hidden rooms (`r` is the room's ellipse, entered once for its title) and the keepsake each one hides.
// `hide` is drawn as solid rock until the room is first entered, so only the crack's mouth shows (physics never sees it).
export const SECRETS = [
  { name: 'The Cellar', hide: [0.3, -5.2, 13.0, -0.6], r: [9.6, -3.2, 2.6, 1.3], x: 10.8, y: -4.4, kind: 'spool', what: 'a wooden spool',
    text: 'Her first spool. Scratched into the end, over and over, in clumsy letters: I WAS MADE.' },
  { name: "The Diggers' Cache", hide: [76.5, -17.2, 89.6, -12.4], r: [85.8, -14.7, 3.2, 1.85], x: 86.6, y: -16.4, kind: 'button', what: 'a brass coat button',
    text: "From a miner's coat. They dug down to kill the thing that calls. The coats came back up the well, folded. The men didn't." },
  { name: 'The Seed Hollow', hide: [0.3, -86.8, 10.4, -81.4], r: [3.6, -84.6, 2.9, 1.7], x: 3.5, y: -86.2, kind: 'seeds', what: 'a packet of seeds',
    text: "Sweet peas. 'For the spring,' it says. There has not been a spring on the Brink in seventy years." },
  { name: "The Ringer's Cell", hide: [0.3, -118.0, 10.6, -113.6], r: [4.0, -116.0, 2.5, 1.6], x: 3.4, y: -117.4, kind: 'thimble', what: 'a silver thimble',
    text: 'Not hers. Older. Dented in the same place, by the same needle, by the woman who knitted her.' },
  { name: 'The Sill', hide: [112.6, -157.0, 119.8, -152.8], r: [116.4, -154.7, 2.7, 1.6], x: 116.0, y: -156.1, kind: 'eye', what: 'a spare button eye',
    text: 'A button eye, not yours. You have been passing them all the way down.' },
  { name: 'The Last Basket', hide: [62.4, -244.6, 74.0, -240.0], r: [70, -242.4, 3.2, 1.8], x: 69.4, y: -244.0, kind: 'mitten', what: 'a half-knitted mitten',
    text: "Half-knitted, needles still in it, sized for a hand with no fingers. It isn't for you. It's for the next one." },
  { name: 'The Quiet Room', hide: [0.3, -327.0, 11.6, -321.8], r: [5.4, -324.4, 3.0, 1.6], x: 4.6, y: -325.8, kind: 'pattern', what: 'a knitting pattern',
    text: 'A pattern for a doll, in her hand. Under it the same pattern in an older hand, and under that an older one still. One pattern, many hands.' },
  { name: 'The Shoe', hide: [0.3, -367.0, 8.6, -361.8], r: [3.9, -364.4, 2.6, 1.55], x: 3.4, y: -365.8, kind: 'shoe', what: "a child's shoe",
    text: "Very small and very old, the leather gone hard as wood. The first name the well ever called was a child's." },
];

export const SKEINS = [
  { x: 9.2, y: -50.2 }, { x: 47, y: -50.8 }, { x: 83, y: -122.8 }, { x: 100.6, y: -121.4 }, { x: 26, y: -193.4 },
];

export const NESTS = [
  { x: 30, y: -73, n: 4, r: 7 },
  { x: 62, y: -118, n: 4, r: 9 },
  { x: 88, y: -119, n: 4, r: 9 },
  { x: 76, y: -185, n: 4, r: 9 },
  { x: 44, y: -186, n: 5, r: 9 },
];

// Hazards: thorn brambles (capsule chains) and the ink.
// [x0, x1, yRef]: a bramble runs along the ground below yRef between x0 and x1
export const THORNS = [
  [71, 73.2, -327], [26, 56, -385],
  [47, 73, -58], [8, 34.4, -140], [45.9, 50, -140], [60.3, 64.4, -140], [72.9, 77, -140], [86.9, 90.2, -140], [95.8, 105.4, -140],
];
export const INK = [{ x0: 20, x1: 99, y: -196.6 }];
// stalactites that drip ink
export const DRIPS = [{ x: 67.6, y: -171 }, { x: 46.2, y: -173 }, { x: 89.2, y: -168 }, { x: 23.6, y: -170 }];

// The knitter's grey thread: from her door, down through the deep, to her chair. Knots hold her voice.
export const GREY = [
  [18.8, 1.4], [30, 0.8], [41.2, 0.6], [42.6, -4], [45.4, -8.4], [47, -8.4], [50, -8.4], [52.4, -9], [56, -12], [58.5, -16.4],
  [66, -16.4], [62, -20], [56, -24], [53.6, -25.4], [48.5, -25.4], [46.6, -25.6], [50, -28], [57, -31], [60.5, -33.4],
  [70, -33.4], [64, -37], [54, -39.4], [47, -39.4], [50.2, -40], [53.4, -41], [52, -44], [48, -48.4], [40, -49], [36, -50.5],
  [30, -60.4], [20, -61], [14, -60], [12.8, -66], [16, -71], [22, -82], [30, -81.6], [37, -81], [40.2, -84], [37, -92],
  [31, -99], [28.5, -106], [24, -117.6], [26.5, -118], [32.5, -115.3], [42, -122.2], [48.3, -119.9], [56.5, -120.2],
  [62.2, -119.4], [69, -123.2], [75.8, -121.9], [83, -122.6], [88.8, -120.3], [93, -121.8], [96.8, -118.8], [101, -121.4], [109, -125], [110, -136], [108.6, -148], [109.6, -160],
  [104, -193.9], [99, -194], [93.4, -191.0], [88, -192.8], [82.5, -191], [76, -191.8], [71.2, -189.2], [63.5, -190.2],
  [57.5, -187.9], [50, -191.8], [44.5, -189.5], [37, -192.8], [31, -191.5], [26, -193.2], [17, -194], [11, -196], [9.6, -204], [12.6, -212], [17, -218], [22, -246], [31, -246.2],
  // past her chair, down the hole, through the Hush
  [40, -246.3], [43.0, -246.6], [45.2, -252], [46.4, -266], [44, -282.3], [52, -282.3], [58, -281.6], [66, -282.4], [74, -281.6], [82, -282.8],
  [90, -285.3], [97, -285.3], [99.5, -292], [100.6, -300], [97.5, -312], [94, -325.8], [82, -325.8], [74.2, -325.8], [70, -325.8], [60, -325.8],
  [50, -324.5], [40, -325.8], [30, -325.8], [27, -330], [25, -340], [20.5, -352], [19.6, -358], [18, -365.8],
  // the Treadles: across the rings, up the rope, along the heddle corridor and down the well
  [25.6, -365.8], [29.1, -363.6], [34, -366.3], [41.0, -364.0], [47, -365.8], [53.1, -363.6], [58, -365.8], [66, -365.8], [68.4, -358],
  [70, -358], [90, -358], [108, -358], [110.5, -372], [110, -398], [108, -404.4], [103, -404.4], [101.2, -420], [104, -440], [106, -458], [102, -461.8], [96.6, -462],
  // the Loom: down to the cloth, across it, and up the warp to her
  [93, -505], [88, -539.8], [72, -539.8], [56, -539.8], [57.2, -520], [52, -503.4], [43, -501], [35, -503.0], [31.6, -485], [36, -469.8],
  [42.8, -458], [39.4, -443.8], [28, -443.8], [16, -443.8],
];

// Her memories, knotted into the grey thread. `line` keys the voice file (assets/voice/<id>.ogg).
// The story they tell (and where it turns) is in docs/STORY.md: it darkens with depth; keep the order.
export const MEMORIES = [
  { id: 'm0', x: 37, y: 0.8, text: "I've gone down after the light, little one. Don't follow me. ...But if you do, keep hold of the thread. Never let go of the thread." },
  { id: 'm1', x: 48.5, y: -25.4, text: 'Seventy winters I sat at that window and listened to the dark breathe. Every winter it calls one name up the well. Last night... it called mine.' },
  { id: 'm2', x: 26, y: -61, text: "I made you from the scraps of everything I loved. A sleeve of his coat. The ribbon from my wedding. You're stronger than the others were." },
  { id: 'm3', x: 30, y: -81.6, text: "The moths found the others first. Don't grieve for them, little one. They were only practice." },
  { id: 'm4', x: 56.5, y: -120.2, text: 'Pluck your thread, and the bells will answer. They rang for everyone it took. The ringer rang until his hands bled... and then they rang for him.' },
  { id: 'm5', x: 64.5, y: -190.2, text: "Don't let the ink touch you. It makes things forget what they are. I forgot for seventy winters... I forgot that I was made, too." },
  { id: 'm6', x: 17, y: -218, text: "She's so tired, little one. Her yarn's run grey. She can't climb back up. ...Come down. Come and sit with us. It's warm in the Loom." },
  { id: 'm7', x: 36, y: -246.2, text: "So many chairs. I counted them on my way down... forty-one. Every one of them has my shawl over it. Every one of them is mine." },
  { id: 'm8', x: 66, y: -282.4, text: "Hush now, little one. Hush. Don't pluck your thread down here... they don't like the noise. Be quiet, and they'll let you by." },
  { id: 'm9', x: 61.4, y: -365.8, line: 'm9', thread: 'old', text: "There you are. I came all this way too, once, and tied my thread to an old woman's. Tie yours to mine, little one... someone has to go home." },
  { id: 'm10', x: 82, y: -539.8, text: "Forty-one winters. Forty-one of us. Every one of us came down for the one before. Sit down, little one. Sit down, and be still." },
];
// her chair in the Hall of Chairs: empty, her candle still burning beside it
export const CHAIR = { x: 32.6, y: -246.2 };
export const FINALE = {
  x: 16, y: -443.8,
  text: "There you are. I came all this way too, once, and tied my thread to an old woman's. Tie yours to mine, little one... someone has to go home.",
  after: 'There. Next winter, it will call your name. Start knitting early, little one... it takes a few.',
  cut: "Oh... oh, little one. It's so quiet.",
};
export const LIGHTS = [
  // static lamps: glow-fungus, the cottage window, her candle
  { x: 13.2, y: 2.2, r: 7, i: 1.3, c: [1.0, 0.62, 0.28], flicker: 1 },   // cottage window
  { x: 22, y: -49.6, r: 6, i: 0.7, c: [0.75, 0.85, 0.8], flicker: 0.2 },  // fungus G1
  { x: 30, y: -72.4, r: 6, i: 0.8, c: [0.75, 0.85, 0.8], flicker: 0.2 },  // fungus G2 (moths gather)
  { x: 34.2, y: -245.4, r: 9, i: 1.25, c: [1.0, 0.6, 0.27], flicker: 1 },  // her candle by the empty chair in the Hall
  { x: 19, y: -443.2, r: 8, i: 1.15, c: [1.0, 0.6, 0.27], flicker: 1, finale: true },  // the candle beside her at the top of the Loom
  // the deep is not quite black: a cold breath over the Hall's chairs, lamps in the Treadles, and the Loom's cloth
  // giving off a faint warmth of its own (as if it were alive)
  { x: 18, y: -238, r: 13, i: 0.3, c: [0.7, 0.72, 0.82], flicker: 0 },
  { x: 33, y: -236, r: 13, i: 0.28, c: [0.7, 0.72, 0.82], flicker: 0 },
  { x: 16, y: -360, r: 8, i: 0.5, c: [1.0, 0.62, 0.3], flicker: 1 },
  { x: 62, y: -360, r: 8, i: 0.5, c: [1.0, 0.62, 0.3], flicker: 1 },
  { x: 88, y: -352, r: 9, i: 0.45, c: [1.0, 0.62, 0.3], flicker: 1 },
  { x: 108, y: -400, r: 7, i: 0.45, c: [1.0, 0.62, 0.3], flicker: 1 },
  { x: 40, y: -528, r: 30, i: 0.32, c: [0.95, 0.72, 0.6], flicker: 0.15 },
  { x: 85, y: -528, r: 30, i: 0.32, c: [0.95, 0.72, 0.6], flicker: 0.15 },
  { x: 30, y: -478, r: 20, i: 0.22, c: [0.95, 0.72, 0.6], flicker: 0.15 },
];

// ── the deep's machinery (deep.js) ─────────────────────────────────────────
// Ropes and warp threads you can climb: hold grip next to one. [x, yBottom, yTop]
export const ROPES = [
  [68.6, -366.2, -356.4],          // the Treadles: up out of the east ledge into the heddle corridor
  [57.4, -540, -502.4],            // the Loom: the first warp, cloth to ledge
  [31.6, -503.2, -469.4],          // the second, past the needles
  [42.4, -470, -443.0],            // the last, beside the breast beam
];
// Knitted hands in the Hush's walls: they reach for anything that stays quiet. [x, y] near a wall; reach in metres.
export const HANDS = [
  [36, -279, 4], [62, -279, 3.5], [72, -279, 3.5], [82, -276, 6], [100, -282, 5],
  [102, -296, 4], [90, -315.6, 10.5], [83, -315.6, 10.5], [76, -315.6, 10.5], [68, -315.6, 10.5], [62, -315.6, 10.5], [53, -315.6, 10.5],
  [46, -315.6, 10.5], [40, -315.6, 10.5], [35, -315.6, 10.5], [27, -315.6, 10.5], [17, -320, 5],
];
// Things that slam: heddle frames dropping in the Treadles, needles stabbing out of the Loom's cloth.
// rect at rest (x0, y0, x1, y1), the direction it moves and how far, the cycle (s) and its phase.
export const STAMPERS = [
  { kind: 'heddle', r: [77, -351, 79.6, -350], dir: [0, -1], dist: 7.0, per: 3.0, ph: 0.0 },
  { kind: 'heddle', r: [84, -351, 86.6, -350], dir: [0, -1], dist: 7.0, per: 3.0, ph: 0.75 },
  { kind: 'heddle', r: [91, -351, 93.6, -350], dir: [0, -1], dist: 7.0, per: 3.0, ph: 1.5 },
  { kind: 'heddle', r: [98, -351, 100.6, -350], dir: [0, -1], dist: 7.0, per: 2.4, ph: 0.4 },
  { kind: 'needle', r: [4, -489.5, 5, -488.9], dir: [1, 0], dist: 28, per: 3.2, ph: 0.0 },
  { kind: 'needle', r: [4, -481.5, 5, -480.9], dir: [1, 0], dist: 28, per: 3.2, ph: 1.6 },
  { kind: 'needle', r: [4, -459.6, 5, -459.0], dir: [1, 0], dist: 40.5, per: 3.6, ph: 0.9 },
];
// The cloth that rises after you in the Loom: wakes when you leave peg `peg` (24), stops at peg `stop` (28).
export const RISE = { x0: 4, x1: 116, y0: -540, y1: -446, speed: 1.5, peg: 24, stop: 28, delay: 4.0, back: 12 };

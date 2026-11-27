// Spindledeep — the one level, authored as carve/fill primitives (metres, y up).
// The world builder (terrain.js) rasterises these, erodes the edges with noise and makes the SDF.
// Route: cottage on the Brink → down the Throat → left into the Root Gardens → the Bell Gallery
// (left to right over the brambles) → the Ink Mere (right to left over the ink) → the Hall of Chairs → down a hole
// into the Hush (east, down, then a long dark gallery west) → the Treadles (rings over the barbs, a rope up, the
// heddles) → down the well into the Loom (the cloth floor, then the climb up the warp to the breast beam).

// (2026-11-27: widened east from 120 to 240 for the Dry Falls and the Stores; nothing west of 120 moved. The Brink's camera and ground stop at 120.)
export const WORLD = { x0: 0, y0: -562, w: 240, h: 604, ppm: 8 };
export const OLD_W = 120;

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

// Shelves hanging in the air [x0, x1, top]: the upper ways to the two rooms nobody could jump to. 'root' hangs in the roots of
// the Gardens, 'seat' on yarn from the roof of the Hall (drawn by drawShelves). Rises stay under 1.45 m, gaps under 2.5.
export const SHELVES = [
  // the Root Gardens: along under the roof from where you come in to the alcove over the drop, and a way up from the floor
  [31.4, 33.6, -52.4, 'root'], [27.6, 29.3, -51.4, 'root'], [24.0, 25.7, -51.0, 'root'], [20.5, 22.2, -52.1, 'root'], [17.0, 18.5, -51.6, 'root'],
  [13.4, 14.8, -52.3, 'root'], [9.4, 12.0, -51.8, 'root'],
  [24.4, 26.4, -59.2, 'root'], [21.2, 23.0, -57.9, 'root'], [24.4, 26.1, -56.5, 'root'], [21.0, 22.7, -55.1, 'root'], [24.4, 26.0, -53.6, 'root'],
  // the Hall of Chairs: from the chairs up and over the hole, to a chute in the east wall
  [24.4, 26.6, -245.2, 'seat'], [28.4, 30.0, -243.8, 'seat'], [31.8, 33.4, -242.4, 'seat'], [35.4, 37.0, -241.2, 'seat'], [39.2, 40.8, -240.0, 'seat'],
  [43.2, 44.6, -239.2, 'seat'], [47.0, 48.4, -238.6, 'seat'], [50.8, 52.2, -239.3, 'seat'], [54.6, 56.2, -238.6, 'seat'],
];

export const OPS = [
  ['fill', B(120.4, -2, 240, 46, 0.2)],      // (2026-11-27) the Brink ends where it always did: the world is wider below it, not up here
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
  ['carve', E(12.6, -49.9, 1.3, 1.2)],         // no tooth of rock over the last jump of its upper way
  ['carve', T([[12.5, -59, 2.1], [13, -66, 2.0], [15, -71, 2.2]])],  // drop into G2
  ['carve', E(25, -76.5, 16, 6.6)],            // G2
  ['carve', T([[39, -80, 1.7], [41.5, -86, 1.7], [37, -93, 1.8], [31, -99, 2.0], [29, -105, 2.2]])], // down to the Gallery
  ['fill', E(25, -84.2, 9, 2.6)],              // G2 floor hump
  // the Orchard (2026-11-25): off the way down, a quiet place nothing happens in
  ['carve', T([[41.6, -85.4, 1.75], [47, -86.2, 1.6], [54, -86.4, 1.7], [61, -86, 2.2]])],
  ['carve', E(76, -83, 19, 6.8)],
  ['carve', E(88, -82, 8, 5)],
  ['fill', B(57, -96, 97, -88.4, 0.9)],
  ['fill', B(42.3, -91, 48.5, -87.5, 0.6)],
  ['fill', E(70, -89.6, 6, 1.7)], ['fill', E(84, -89.8, 5, 1.5)],

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
  ['carve', T([[109, -123, 2.4], [110, -135, 2.4], [108.5, -147, 2.4], [109.5, -160, 2.6], [110.5, -166, 2.6]])],  // (2026-11-27: it no longer breaks into the Mere's roof; it ends in the Dry Falls)

  // ── the Ink Mere ───────────────────────────────────────────────────────────
  ['carve', E(60, -182, 55, 22)],
  ['fill', B(0, -208, 120, -200.5, 0.6)],      // bed of the lake (ink fills to -196.6 between the shores)
  ['fill', B(96.5, -200, 120, -194.2, 1.2)],   // east shore
  ['fill', B(0, -200, 22.4, -194.2, 0.5)],     // west shore (it reached to 21 and the last jump was lost there more often than anywhere)
  ['fill', P([[84.6, -201], [86, -193.0], [91.4, -193.0], [92.8, -201]])],   // I1
  ['fill', P([[72.6, -201], [74, -192.0], [80.3, -192.0], [81.6, -201]])],   // I2 (bell)
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

  // under the Hall (2026-11-25): a mat is woven across the hole; a door in its side leads round below the chairs
  ['carve', T([[47, -257.5, 1.5], [40, -257.5, 1.5]])],
  ['carve', B(9, -259, 42, -249.8, 1.0)],      // the Weighing Room
  ['carve', B(24.5, -263.2, 29.4, -258, 0.4)],   // its pit, full of pins
  ['carve', T([[11, -257.4, 1.5], [7.4, -258.2, 1.5], [6.6, -264, 1.6], [7, -271, 1.8]])],
  ['carve', B(4, -281, 31, -267.5, 1.2)],      // the Pews
  ['carve', B(12, -286, 24, -280.4, 0.4)],     // the trench the bridge goes over
  ['carve', T([[29, -279.5, 1.5], [36, -280.4, 1.6]])],
  ['fill', P([[13.6, -249], [16.6, -252.2], [19, -249]])], ['fill', P([[30.5, -249], [33.4, -253.0], [35, -249]])], ['fill', P([[37.4, -249], [38.6, -251.2], [41, -249]])],
  ['carve', E(22, -250.5, 5, 2.6)],
  ['fill', P([[12.4, -266.5], [14, -270.4], [16.2, -266.5]])], ['fill', P([[25, -266.5], [26.2, -269.6], [28.4, -266.5]])], ['carve', E(20, -268, 5.5, 2.4)],

  // ── the Hush ──────────────────────────────────────────────────────────────
  ['carve', T([[47, -246, 3.0], [47.5, -258, 2.8], [47, -270, 2.8]])],     // down the hole
  ['carve', E(47, -276, 13, 8)],               // H1, where you land
  ['fill', B(30, -292, 64, -282.5, 0.6)],
  ['carve', T([[57, -280.4, 1.7], [66.6, -281.0, 1.7]])],
  // the long way round (2026-11-25): down, west past the two slabs, back east over the pins, and up a rope into H2
  ['carve', T([[66.6, -281, 1.7], [67.4, -288, 1.7], [66.6, -297, 2.0]])],
  ['carve', B(22, -303, 70, -294.6, 1.2)],     // the Slabs
  ['fill', B(50, -301.6, 58.4, -300.8, 0.15)], ['fill', B(58.9, -303.4, 60.6, -301.9, 0.15)],
  ['fill', B(33.4, -301.6, 42, -300.8, 0.15)], ['fill', B(42.5, -303.4, 44.2, -301.9, 0.15)],
  ['carve', T([[25.4, -301.5, 1.5], [22.6, -304, 1.6], [23.4, -309.6, 1.7]])],
  ['carve', B(20, -312.2, 88, -305.6, 1.0)],   // the Pin Walk
  ['fill', P([[30, -294], [31.4, -297.6], [33, -294]])], ['fill', P([[45.4, -294], [46.6, -298.2], [48.4, -294]])], ['fill', P([[61, -294], [62, -296.8], [63.6, -294]])],
  ['fill', P([[26, -305], [27.2, -307.4], [29, -305]])], ['fill', P([[49.4, -305], [50.8, -308.0], [52.2, -305]])], ['fill', P([[69, -305], [70.4, -308.2], [72.4, -305]])],
  ['carve', E(90, -280, 12, 7.5)],             // H2
  ['fill', B(76, -292, 104, -285.5, 0.6)],
  ['carve', T([[84, -309, 1.7], [84, -297, 1.6], [84, -288, 1.6], [84, -283, 1.6]])],     // the rope up
  ['carve', T([[98, -284, 1.9], [101, -295, 2.0], [99, -305, 2.1], [96, -316, 2.2]])],
  ['carve', B(16, -326, 104, -315, 2.0)],      // H3, the long dark gallery west
  ['fill', P([[86, -326.5], [87.4, -324.6], [89.6, -324.6], [91, -326.5]])],
  ['fill', P([[44, -326.5], [45.4, -324.7], [47.6, -324.7], [49, -326.5]])],
  ['fill', P([[56, -315], [57.5, -318.5], [59, -315]])],
  ['fill', P([[30, -315], [31.2, -319], [32.6, -315]])],
  ['carve', B(71, -330.5, 73.2, -325.5, 0.4)],     // a barbed trench

  // ── the Treadles ──────────────────────────────────────────────────────────
  ['carve', T([[26.5, -324.6, 1.05], [26, -329, 1.5], [25, -338, 2.2], [20, -352, 2.4], [20, -362, 2.4]])],   // a narrow mouth: a running jump clears it
  // the Long Room (2026-11-25): another, off the shaft into the Treadles
  ['carve', T([[25.6, -337.4, 1.8], [33, -338.2, 1.8], [42, -339.2, 1.9], [52, -339.4, 2.2]])],
  ['carve', E(76, -338.2, 26, 4.2)],
  ['fill', B(26.3, -342.5, 33, -339.5, 0.5)],   // a lip in the shaft to catch
  ['fill', B(48, -347, 104, -341.4, 0.8)],
  ['fill', P([[60, -333], [61, -335.6], [62.6, -333]])], ['fill', P([[88, -333], [89.6, -336.2], [91, -333]])],
  ['carve', E(40, -372, 30, 18)],              // T1
  ['fill', B(8, -392, 26, -366, 0.8)],         // west ledge
  ['fill', P([[31.2, -392], [32, -366.5], [38, -366.5], [38.8, -392]])],   // pillar
  ['fill', P([[43.2, -392], [44, -366], [50, -366], [50.8, -392]])],       // pillar
  ['fill', B(56, -392, 72, -366, 0.8)],        // east ledge
  ['fill', B(0, -400, 120, -389, 0.5)],        // the barbed floor
  ['carve', B(62.5, -366.2, 70, -349.5, 1.0)], // the slot the rope hangs in
  ['carve', B(66, -358.2, 113, -350, 1.0)],    // the heddle corridor
  // the well down to the Loom, in two drops with a ledge between (one fall would be longer than the yarn)
  ['carve', B(99.5, -404.6, 113, -398.5, 1.0)],
  ['fill', B(104, -412, 116, -404.6, 0.6)],
  // the lower Treadles (2026-11-25): west along the bobbin's lane, down, and back east to the well's foot
  ['carve', B(34, -405, 101.5, -396.8, 1.0)],
  ['carve', B(85.1, -406.4, 86.9, -404, 0.15)], ['carve', B(75.1, -406.4, 76.9, -404, 0.15)], ['carve', B(65.1, -406.4, 66.9, -404, 0.15)],   // gutters
  ['carve', T([[37, -403.4, 1.6], [35.6, -408, 1.8], [36.4, -414.5, 1.9]])],
  ['carve', B(32, -421, 99, -411, 1.2)],
  ['carve', E(72, -397.4, 9, 2.4)], ['carve', E(94, -397.6, 5, 2.2)], ['fill', P([[60, -396], [61.6, -399.0], [64, -396]])], ['fill', P([[83, -396], [84.6, -398.8], [86, -396]])],
  ['carve', E(58, -411.4, 7, 2.2)], ['fill', P([[40.6, -410], [42, -413.6], [44, -410]])], ['fill', P([[84, -410], [85, -413], [86.4, -410]])],
  ['carve', T([[97.5, -419.4, 1.5], [100.4, -424, 2.2], [104, -440, 3.0], [106, -452, 3.2], [106, -462, 3.0]])],

  // ── the Loom ──────────────────────────────────────────────────────────────
  ['carve', E(60, -492, 56, 62)],
  ['fill', B(0, -562, 120, -540, 0.5)],        // the floor, where the called stand
  ['fill', B(96, -470, 120, -462, 0.8)],       // where you come in
  ['fill', B(46, -506, 56, -503.6, 0.5)],      // a ledge at the top of the first warp
  ['fill', B(30, -505.6, 39.6, -503.2, 0.5)],     // and one past the swinging ring (level with the first: a swing can't climb)
  ['fill', B(33.5, -472.4, 42, -470, 0.5)],
  ['fill', B(34.4, -489.8, 39.2, -488, 0.4)],     // N1: off the top of the second warp, eastward
  ['fill', B(50.4, -489, 54, -487, 0.4)],         // N2
  ['fill', B(59.6, -488.8, 64.4, -486.6, 0.4)],   // N3
  ['fill', B(80, -486, 88, -484, 0.4)],           // N4
  ['fill', B(41.6, -473.4, 49.4, -471.4, 0.4)],   // the machine's floor, west of its gap
  ['fill', B(55, -473.8, 84.6, -471.4, 0.4)],     // and east of it
  ['carve', B(64.1, -472.9, 65.9, -470, 0.15)], ['carve', B(72.1, -472.9, 73.9, -470, 0.15)],     // gutters
  ['fill', B(44.6, -465.6, 85.4, -463.6, 0.4)],   // its roof
  ['fill', B(0, -450.4, 40, -444, 0.8)],       // the breast beam
  ['carve', B(3, -444.1, 44, -424.5, 2.4)],    // and the high dark place above it

  // ── the Dry Falls (2026-11-27): off the foot of the shaft, east along a dry stream bed into a cave of stone basins stepping
  // down, a chute into the Cistern, and the Underway, a long low gallery back west that comes out on the Ink Mere's east shore.
  // Nothing in it can hurt her: it is only a long way. Every drop is a step down; nothing here needs a ring or a rope.
  ['carve', T([[110.5, -166, 2.6], [118, -166.5, 2.2], [126, -167.5, 2.0], [134, -169, 2.2]])],      // the dry channel
  ['carve', B(132, -190, 206, -150, 6)], ['carve', E(170, -153, 30, 9)], ['carve', E(150, -158, 12, 6)], ['carve', E(192, -158, 11, 7)],
  ['fill', B(130, -196, 146, -171.5, 0.5)], ['fill', B(146, -196, 155, -173.5, 0.5)], ['fill', B(155, -196, 163, -175.0, 0.5)],
  ['fill', B(163, -196, 172, -177.5, 0.5)], ['fill', B(172, -196, 180, -179.0, 0.5)], ['fill', B(180, -196, 190, -181.5, 0.5)], ['fill', B(190, -196, 208, -184.0, 0.5)],
  // a rim of old flowstone along the lip of each basin, and the hollow it held water in
  ['fill', E(145.3, -171.5, 0.8, 0.42)], ['fill', E(154.3, -173.5, 0.8, 0.42)], ['fill', E(162.3, -175.0, 0.8, 0.42)], ['fill', E(171.3, -177.5, 0.8, 0.42)],
  ['fill', E(179.3, -179.0, 0.8, 0.42)], ['fill', E(189.3, -181.5, 0.8, 0.42)],
  ['carve', E(139.5, -171.4, 3.2, 0.42)], ['carve', E(150.3, -173.4, 2.4, 0.4)], ['carve', E(158.8, -174.9, 2.0, 0.38)], ['carve', E(167.3, -177.4, 2.6, 0.42)],
  ['carve', E(175.8, -178.9, 1.9, 0.36)], ['carve', E(184.8, -181.4, 2.8, 0.42)], ['carve', E(198, -183.9, 4.5, 0.4)],
  // its walls are not cut square: hollows and bulges where the water turned
  ['carve', E(133.5, -160, 3.4, 6.5)], ['carve', E(206, -168, 3.2, 9)], ['carve', E(204, -155, 5, 4)], ['carve', E(137, -153.5, 6, 3.5)],
  ['fill', E(207.6, -178.6, 1.4, 3)], ['fill', E(162, -146.4, 5, 1.6)], ['fill', E(183.5, -145.6, 4, 1.4)],
  // curtains of stone from the roof, well above every jump
  ['fill', P([[141, -151], [143.2, -161], [145.6, -151]])], ['fill', P([[157, -150], [158.6, -163.5], [160.4, -150]])], ['fill', P([[166, -146], [167.2, -158], [168.8, -146]])],
  ['fill', P([[176, -147], [178.4, -165], [180.6, -147]])], ['fill', P([[186.5, -151], [187.6, -168.5], [189, -151]])], ['fill', P([[198, -152], [199.6, -172.5], [201.4, -152]])],
  ['fill', P([[152, -151.5], [152.8, -157], [153.8, -151.5]])], ['fill', P([[171.5, -146.5], [172.2, -153], [173.2, -146.5]])], ['fill', P([[193.5, -151], [194.2, -159], [195.2, -151]])],
  // the chute and the Cistern, a round room the water once filled; the Underway leaves it low on its west side
  ['carve', T([[204, -181.6, 2.0], [209, -186, 2.0], [213, -190.6, 2.2]])],
  ['carve', E(219, -190.6, 10.5, 5.6)], ['fill', B(207, -202, 232, -195.0, 0.6)],
  ['fill', E(229, -195, 2.4, 1.0)], ['fill', E(209.6, -195, 1.2, 0.5)],
  ['carve', T([[211, -193.4, 1.7], [198, -193.3, 1.75], [184, -193.2, 1.8], [170, -193.0, 1.8], [156, -192.9, 1.75], [142, -192.7, 1.7], [130, -192.6, 1.7], [120, -192.4, 1.6], [108, -192.4, 1.6]])],
  ['carve', E(191, -193.6, 4, 1.7)], ['carve', E(163, -193.4, 5, 1.6)], ['carve', E(137, -193.2, 3.5, 1.5)],      // where it widens
  ['fill', E(177, -195.0, 2.2, 0.5)], ['fill', E(149, -194.9, 1.8, 0.45)],                                       // low humps of old silt on its floor

  // ── the Stores (2026-11-27): the heddle corridor runs on east into a hall of shelves cut in the rock, five galleries deep.
  // East along the top, drop, west, drop, east, drop, west, drop to the floor, and west out of it to the well's ledge.
  // Off the third gallery's west end, the Drying Loft. Nothing in it moves.
  ['carve', T([[111, -355.6, 2.2], [120, -356.0, 2.0], [129, -356.2, 2.0]])],
  ['carve', B(128, -412, 214, -349, 3)], ['carve', E(171, -350, 36, 6)],
  ['carve', E(212, -362, 3.5, 6)], ['carve', E(130, -372, 3, 5)], ['carve', E(213, -386, 3, 5.5)], ['carve', E(130, -396, 3, 5)], ['fill', E(171, -344.6, 9, 1.8)],   // its ends are rock, not walls
  ['fill', B(126, -360.0, 196, -358.3, 0.4)],       // G1: east
  ['fill', B(142, -371.6, 216, -369.8, 0.4)],       // G2: west
  ['fill', B(124, -383.2, 198, -381.4, 0.4)],       // G3: east (and west into the loft)
  ['fill', B(142, -394.8, 216, -393.0, 0.4)],       // G4: west
  ['fill', B(124, -420, 216, -404.6, 0.5)],         // the floor: east, then back west out of it
  ['carve', E(119, -379.4, 7.5, 3.4)], ['carve', B(123, -381.4, 131, -377.4, 0.8)], ['fill', B(110, -386, 126, -381.4, 0.4)],          // the Drying Loft, open to the hall
  ['carve', T([[130, -402.9, 1.75], [122, -402.9, 1.75], [114, -402.8, 1.8]])],            // out of the floor, west to the well's ledge

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
  // and its upper way: a ledge over the east slope, and a chute down through the roof of the room
  ['fill', B(58.2, -241.4, 66, -239.6, 0.4)],
  ['carve', T([[61.4, -238.9, 0.7], [64.0, -239.0, 0.66], [66.8, -239.7, 0.64], [69.0, -241.4, 0.7]])],
  // the Quiet Room: a crawl at the west end of the Hush's long gallery, past where the way goes down
  ['carve', T([[17.2, -325.4, 0.6], [12.5, -325.45, 0.6], [8.4, -325.25, 0.62]])],
  ['carve', E(5.4, -324.4, 3.0, 1.6)],
  // the Shoe: a crawl at the far end of the Treadles' west ledge
  ['carve', T([[13.2, -365.4, 0.6], [9.5, -365.45, 0.6], [6.6, -365.25, 0.62]])],
  ['carve', E(3.9, -364.4, 2.6, 1.55)],
  // the Tally: across the shaft past the Weighing Room's door, on a ledge
  ['fill', B(3.4, -262.4, 5.7, -259.2, 0.3)],
  ['carve', T([[5.6, -258.1, 0.85], [4.2, -258.4, 0.62], [2.8, -258.2, 0.62]])],
  ['carve', E(2.7, -257.6, 1.9, 1.45)],
  // the Held Breath: a crawl at the west end of the Pin Walk, away from the pins
  ['carve', T([[21.4, -311.55, 0.62], [18.4, -311.5, 0.6], [15.4, -311.3, 0.62]])],
  ['carve', E(12.8, -310.8, 3.0, 1.6)],
  // the Cut: a crawl behind the first pole of the lower room
  ['carve', T([[33.6, -420.4, 0.62], [30.2, -420.35, 0.6], [27.6, -420.15, 0.62]])],
  ['carve', E(25.0, -419.4, 3.0, 1.6)],
  ...SHELVES.map(([x0, x1, y]) => ['fill', B(x0, y - 0.55, x1, y, 0.22)]),
];

// erosion stays calm in these rects [x0, y0, x1, y1] so the narrow cracks keep their shape
export const QUIET = [
  [0.4, -262, 9.4, -255.6], [9, -313.4, 22, -308.4], [21.4, -422, 34.4, -417.4],
  [1, -446, 46, -436], [41, -475, 86, -462], [33, -491, 90, -482],
  [0.5, -5.2, 12.8, 3.0], [74, -17.2, 89.6, -12.3], [0.4, -86.8, 12.6, -79.2], [1.2, -118.2, 13.2, -113.8],
  [109.8, -157.6, 119.6, -152.6], [57.6, -244.8, 73.8, -240.0],
  [0.4, -327.2, 18.6, -322.0], [0.4, -367.2, 14.6, -362.0],
  [57.8, -241.6, 72, -238.0], [20, -303.6, 64, -297], [63, -407, 89, -403.5], [33, -422, 98, -418.5], [10, -287, 33, -279], [6.6, -53.2, 12.2, -49.6],
  ...SHELVES.map(([x0, x1, y]) => [x0 - 0.9, y - 1.4, x1 + 0.9, y + 0.8]),
];

// [x0, x1, y]: ground planed level at y, where a jump has to be made
export const LEVEL = [
  [22.5, 29.5, -117.75],     // B0: the first ring
  [35.0, 39.0, -52.6],       // the way into the Root Gardens, over the drop (the first shelf is a jump from here)
  [51.0, 54.2, -25.4],       // L3, under the spare ring
  [11, 24.5, -259], [29.4, 45.5, -259],                                                  // the Weighing Room
  [5, 12.0, -281], [24.0, 30, -281],                                                     // the Pews
  [26, 33.4, -303], [44.2, 49.9, -303], [33.4, 42.4, -303], [49.9, 58.8, -303], [60.6, 66, -303],   // the Slabs
  [22, 88, -312.2],                                                                      // the Pin Walk
  [39.8, 65.0, -405], [67.0, 75.0, -405], [77, 85, -405], [87, 103, -405],               // the bobbin's lane
  [34, 99, -421],
  [34.8, 39.0, -488], [50.6, 53.8, -487], [59.8, 64.2, -486.6], [80.2, 87.8, -484], [42.0, 49.2, -471.4], [55.2, 64.1, -471.4], [65.9, 72.1, -471.4], [73.9, 84.4, -471.4],
  [18.5, 22.1, -194.2],      // the Mere's west shore, where the last jump lands
  [110, 118, -168.4],        // the foot of the shaft
];

// Areas: title card on first entry, ambience/music state, camera framing.
export const AREAS = [
  // (2026-11-27) the two long ways round, east of the old world's edge
  { id: 'falls', name: 'The Dry Falls', y1: -150, y0: -200, x0: 120, viewH: 18, amb: [0.026, 0.026, 0.032], moon: 0 },
  { id: 'falls', name: 'The Dry Falls', y1: -150, y0: -173, x0: 104, viewH: 18, amb: [0.026, 0.026, 0.032], moon: 0 },      // the shaft's foot, over the Mere's roof (the Underway's last stretch is the Mere's)
  { id: 'stores', name: 'The Stores', y1: -349, y0: -412, x0: 113, viewH: 19, amb: [0.026, 0.023, 0.022], moon: 0 },
  { id: 'brink', name: 'The Brink', y1: 50, y0: -6, viewH: 17, amb: [0.16, 0.17, 0.2], moon: 1.0 },
  { id: 'throat', name: 'The Throat', y1: -6, y0: -46, viewH: 19, amb: [0.032, 0.032, 0.04], moon: 0.45, x0: 36, x1: 82 },
  { id: 'gardens', name: 'The Root Gardens', y1: -44, y0: -103, x1: 44, viewH: 16, amb: [0.026, 0.028, 0.03], moon: 0 },
  { id: 'gallery', name: 'The Bell Gallery', y1: -103, y0: -150, viewH: 19, amb: [0.024, 0.023, 0.03], moon: 0 },
  { id: 'mere', name: 'The Ink Mere', y1: -150, y0: -208, viewH: 19, amb: [0.022, 0.023, 0.03], moon: 0 },
  { id: 'hall', name: 'The Hall of Chairs', y1: -208, y0: -262, viewH: 17, amb: [0.028, 0.024, 0.022], moon: 0 },
  { id: 'hall', name: 'The Hall of Chairs', y1: -262, y0: -286.5, x0: 0, x1: 32, viewH: 17, amb: [0.022, 0.02, 0.019], moon: 0 },      // the Pews, under it
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
  { img: 'loom', cx: 24, cy: -264, w: 58, h: 40, par: 0.6 },
  { img: 'treadles', cx: 64, cy: -408, w: 94, h: 44, par: 0.6 },
  { img: 'loomdeep', cx: 60, cy: -492, w: 116, h: 130, par: 0.45 },
  { img: 'falls', cx: 172, cy: -175, w: 112, h: 58, par: 0.55 },
  { img: 'stores', cx: 170, cy: -381, w: 100, h: 66, par: 0.55 },
]

export const START = { x: 20.5, y: 1.2 };

// The knitter's pegs. Tie the thread to one to make it your new anchor and respawn here. `off: n` (the user, 2026-11-27: fewer poles
// from the Ink Mere down) takes one out of the game but keeps its index (saves and code use them): a save there continues from pole n.
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
  { x: 18, y: -244, off: 9 },
  { x: 38.6, y: 0.5 },      // the lip of the pit
  { x: 51.5, y: -25.6 },    // L3, under her memory
  // the deep
  { x: 41.6, y: -246.5 },   // 13: the lip of the hole in the Hall
  { x: 40, y: -282.5, off: 34 },     // 14: H1
  { x: 96, y: -285.5 },     // 15: H2
  { x: 94, y: -326, off: 15 },       // 16: H3 east
  { x: 64, y: -326 },       // 17: H3 middle
  { x: 34, y: -326 },       // 18: H3 west
  { x: 18, y: -366 },       // 19: the Treadles' west ledge
  { x: 61, y: -366 },       // 20: the east ledge, under the rope
  { x: 74, y: -358.2, off: 20 },     // 21: the start of the heddle corridor
  { x: 106, y: -358.2 },    // 22: the end of it
  { x: 104, y: -462 },      // 23: where you come into the Loom
  { x: 72, y: -540 },       // 24: on the cloth (the Weaver wakes when you leave it)
  { x: 50, y: -503.6 },     // 25: the first warp's ledge
  { x: 34, y: -503.2 },     // 26: past the swinging ring
  { x: 37, y: -470 },       // 27
  { x: 32, y: -444 },       // 28: the breast beam (the cloth stops)
  { x: 108.5, y: -404.6, off: 22 },  // 29: the ledge halfway down the well
  { x: 53.2, y: -245.6 },   // 30: the Hall, east of the hole, outside the Last Basket
  { x: 39, y: -259, off: 13 },       // 31: the Weighing Room
  { x: 11.8, y: -259 },     // 32: past its door
  { x: 6.6, y: -281, off: 32 },      // 33: the Pews
  { x: 28, y: -281 },       // 34: over the bridge
  { x: 64, y: -303 },       // 35: the Slabs
  { x: 26.9, y: -303, off: 35 },     // 36: past their door
  { x: 47, y: -312.2 },     // 37: the Pin Walk, between the beds
  { x: 79, y: -312.2 },     // 38: under the rope
  { x: 98, y: -405, off: 22 },       // 39: before the bobbin's lane
  { x: 60, y: -405 },       // 40: past it
  { x: 39.5, y: -421 },     // 41: the lower room
  { x: 66, y: -421 },       // 42: past the pulled door
  { x: 83, y: -421, off: 42 },       // 43: before the last ring
  { x: 38.2, y: -488 },     // 44: N1
  { x: 52, y: -487 },       // 45: N2
  { x: 82.6, y: -484 },     // 46: N4
  { x: 83.6, y: -471.4 },   // 47: the machine
  { x: 56.4, y: -471.4 },   // 48: past the bobbin
  { x: 62, y: -87.6 },      // 49: the Orchard
  { x: 57, y: -341.2 },     // 50: the Long Room
  // (2026-11-27) the Dry Falls and the Stores
  { x: 114, y: -168.4 },    // 51: the foot of the shaft
  { x: 186, y: -181.5 },    // 52: the lowest basins
  { x: 216, y: -195.0 },    // 53: the Cistern
  { x: 160, y: -194.7 },    // 54: halfway along the Underway
  { x: 131, y: -358.3 },    // 55: the top gallery of the Stores
  { x: 150, y: -369.8 },    // 56: the second gallery, at its west end
  { x: 190, y: -381.4 },    // 57: the third gallery, at its east end
  { x: 150, y: -393.0 },    // 58: the fourth
  { x: 134, y: -404.6 },    // 59: the floor of the Stores, by the way out
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
  // what the thread can work (rig.js): `sink` goes down under her and lifts a door, `pull` is wound in from where she stands
  { x: 26.6, y: -256.2, sink: { dist: 1.2, gate: 'w1' } },
  { x: 9.6, y: -278.4, pull: { dx: -3.6, gate: 'bridge' } },
  { x: 38.7, y: -308.7 }, { x: 58.7, y: -308.7, sway: [2.6, 0.1, 3.2, 0.6] },
  { x: 48.7, y: -417.5, sway: [4, 0.1, 3.2, 1.0] },
  { x: 60.5, y: -418.4, pull: { dx: -4.0, gate: 'w2' } },
  { x: 57.0, y: -484.4, sway: [5, 0.1, 3.2, 0.4] },
  { x: 80.6, y: -468.6, pull: { dx: 2.6, gate: 'w4', speed: 1.7 } },
  { x: 52.2, y: -469.0, sink: { dist: 1.0, gate: 'w5' } },
  { x: 88.7, y: -417.5, sink: { dist: 1.1, gate: 'w3' } },
];

// Seats, where she can sit a while [x, y, which way she faces], and the quiet places' names [ellipse].
export const RESTS = [[69.6, -33.2, -1], [28.5, -60.6, -1], [78, -87.8, 1], [107, -194, -1], [15.0, -194, 1], [80, -341, -1], [49.0, -420.8, 1],
  [223.5, -195, -1], [117.5, -381.4, 1], [194, -184, -1]];      // (2026-11-27) the Cistern, the Drying Loft, the lowest basin: no words at these (REST_SAYS stops at 7)
// What she notices the first time she sits at each seat (in RESTS order; written, not spoken). Escalation map in docs/STORY.md.
export const REST_SAYS = [
  'Someone rested here often, on the way down. By the seat, scratched small, a tally: one mark a winter. Then the marks stop.',
  'A cushion, knitted, gone hard with the damp. She made the seat soft for whoever came after her.',
  'From here you can see the whole orchard. Nothing on it has ever fruited. She sat here anyway, as if it might.',
  'A line scratched on the stone above the ink, and another higher, and another higher still. It is rising.',
  'Pins stuck in the seat in a row, the way she kept them on her sleeve. Eleven. One for each doll that got this far.',
  'The seat is warm. Nothing down here is warm. Something was sitting here, and got up when it heard you coming.',
  'Beside the seat, scratched deep: DO NOT SLEEP HERE. Under it, in another hand, the same. Under that, the same, in yours.',
];
export const PLACES = [{ name: 'The Orchard', x: 76, y: -84, rx: 18, ry: 6 }, { name: 'The Long Room', x: 76, y: -338.4, rx: 25, ry: 4.4 },
  { name: 'The Cistern', x: 219, y: -191, rx: 9, ry: 4.5 }, { name: 'The Drying Loft', x: 119, y: -379.6, rx: 6, ry: 3 }];

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
  { x: 92, y: -285.5, gate: null }, { x: 46.5, y: -303, gate: null }, { x: 66, y: -312.2, gate: null }, { x: 80, y: -326, gate: null }, { x: 52, y: -326, gate: null }, { x: 36.5, y: -326, gate: null },
];

// Ink veils: strands that block a passage until all their bells ring.
export const GATES = [
  { id: 'g2', x0: 38.9, x1: 39.9, y0: -82.6, y1: -77.2 },
  { id: 'east', x0: 105.8, x1: 112.8, y0: -123.4, y1: -122.4, floor: true },
  // worked by the thread (rig.js)
  { id: 'mat', x0: 43.2, x1: 51.8, y0: -259.6, y1: -259, floor: true },
  { id: 'w1', rig: true, x0: 14.2, x1: 14.9, y0: -259, y1: -250.6 },
  { id: 'bridge', rig: true, bridge: true, len: 12.6, x0: 24.4, x1: 24.5, y0: -281.35, y1: -281, open: 1 },
  { id: 'h1', rig: true, spindles: true, dir: -1, x0: 28.2, x1: 28.9, y0: -303, y1: -295.4 },
  { id: 'w2', rig: true, x0: 69.6, x1: 70.3, y0: -421, y1: -411.8 },
  { id: 'w3', rig: true, x0: 94.6, x1: 95.3, y0: -421, y1: -411.8 },
  { id: 'w4', rig: true, x0: 77.2, x1: 77.9, y0: -471.4, y1: -465.5 },
  { id: 'w5', rig: true, x0: 45.4, x1: 46.1, y0: -471.4, y1: -465.5 },
  // strips of the cloth: one tears away a moment after she lands on it
  { id: 'strip1', give: true, x0: 40.9, x1: 43.1, y0: -487.9, y1: -487.5 }, { id: 'strip2', give: true, x0: 45.4, x1: 48.2, y0: -487.5, y1: -487.1 },
  { id: 'strip3', give: true, x0: 66.6, x1: 68.8, y0: -486.4, y1: -486.0 }, { id: 'strip4', give: true, x0: 71.2, x1: 73.4, y0: -485.7, y1: -485.3 }, { id: 'strip5', give: true, x0: 75.7, x1: 77.9, y0: -485.1, y1: -484.7 },
];

// Hidden rooms (`r` is the room's ellipse, entered once for its title) and the keepsake each one hides.
// `hide` is drawn as solid rock until the room is first entered, so only the crack's mouth shows (physics never sees it).
export const SECRETS = [
  { name: 'The Cellar', hide: [0.3, -5.2, 13.0, -0.6], r: [9.6, -3.2, 2.6, 1.3], x: 10.8, y: -4.4, kind: 'spool', what: 'a wooden spool',
    text: 'Her first spool. Scratched into the end, small and careful, the one rule she kept: NEVER NAME THEM.' },
  { name: "The Diggers' Cache", hide: [76.5, -17.2, 89.6, -12.4], r: [85.8, -14.7, 3.2, 1.85], x: 86.6, y: -16.4, kind: 'button', what: 'a brass coat button',
    text: "From a miner's coat. They dug down to kill the thing that calls. The coats came back up the well, folded. The men didn't." },
  { name: 'The Seed Hollow', at: 2.4, hide: [0.3, -86.8, 10.4, -81.4], r: [3.6, -84.6, 2.9, 1.7], x: 3.5, y: -86.2, kind: 'seeds', what: 'a packet of seeds',
    text: "Sweet peas. 'For the spring,' it says. There has not been a spring on the Brink in seventy years." },
  { name: "The Ringer's Cell", hide: [0.3, -118.0, 10.6, -113.6], r: [4.0, -116.0, 2.5, 1.6], x: 3.4, y: -117.4, kind: 'thimble', what: 'a silver thimble',
    text: "Her mother's thimble. There was a name inside it once. Someone has filed it away, all the way through the silver." },
  { name: 'The Sill', at: 2.2, hide: [112.6, -157.0, 119.8, -152.8], r: [116.4, -154.7, 2.7, 1.6], x: 116.0, y: -156.1, kind: 'eye', what: 'a spare button eye',
    text: 'A button eye, not yours. You have been passing them all the way down.' },
  { name: 'The Last Basket', hide: [65.4, -244.6, 74.0, -238.8], r: [70, -242.4, 3.2, 1.8], x: 69.4, y: -244.0, kind: 'mitten', what: 'a half-knitted mitten',
    text: "Half-knitted, needles still in it, sized for a hand with no fingers. It isn't for you. It's for the next one." },
  { name: 'The Quiet Room', hide: [0.3, -327.0, 11.6, -321.8], r: [5.4, -324.4, 3.0, 1.6], x: 4.6, y: -325.8, kind: 'pattern', what: 'a knitting pattern',
    text: "A pattern for a doll, in her hand. At the bottom, underlined twice: 'Sew the mouth shut, so it can tell it nothing. No name, so it can't be called.'" },
  { name: 'The Shoe', hide: [0.3, -367.0, 8.6, -361.8], r: [3.9, -364.4, 2.6, 1.55], x: 3.4, y: -365.8, kind: 'shoe', what: "a child's shoe",
    text: "Very small and very old. A child fell down the well, before the cottage was built. She called for her mother for three days. On the fourth day, something else began to call." },
  { name: 'The Tally', hide: [0.3, -260.4, 4.3, -255.6], r: [2.6, -257.6, 1.8, 1.4], x: 2.4, y: -258.8, kind: 'weight', what: 'an iron weight',
    text: 'Filed down at the base, a little at a time, until it weighed exactly what a name weighs. There are forty-one scratches round it. The last is new.' },
  { name: 'The Held Breath', hide: [9.0, -313.2, 19.6, -308.6], r: [12.8, -310.8, 3.0, 1.6], x: 12.2, y: -312.0, kind: 'tag', what: "a child's luggage tag",
    text: 'The name has been cut out of it, very neatly, by somebody who loved her. It was too late. It had already been read aloud.' },
  { name: 'The Cut', hide: [21.4, -421.8, 31.6, -417.2], r: [25.0, -419.4, 3.0, 1.6], x: 24.4, y: -420.6, kind: 'scissors', what: 'embroidery scissors',
    text: 'One point snapped off. She meant to cut her own thread on the way down, and sat here a long time with them open. It asked her, in her mother\'s voice, to wait.' },
];

// What lies about off the way. The first is a skein of her red yarn; the rest are her letters, each dropped down the well one
// winter (the user, 2026-11-27: the thread no longer runs out, so skeins no longer let it reach further). Saves index this list.
// Letters follow the escalation map in docs/STORY.md: nothing at a shallower depth knows more than what lies below it.
export const SKEINS = [
  { x: 9.2, y: -50.2 },
  { x: 47, y: -50.8, letter: "My dear, I drop one of these down the well every winter, the night the first snow comes. I don't know how far paper falls. I keep the kettle on. — me" },
  { x: 83, y: -122.8, letter: "My dear, the bells under the gallery rang again last night. I counted. I always count. It was nobody we knew, this time. — me" },
  { x: 226.5, y: -195.0, letter: "My dear, the ringer's wife came up the hill to ask what the bells meant. I told her they meant nothing. She stopped asking. Then the bells rang for him. — me" },
  { x: 26, y: -193.4, letter: "My dear, I have stopped saying it, even to myself. You said mine that last night, down at the well, and something said it back. I keep it in my mouth like a stone. — me" },
  { x: 18.6, y: -259, letter: "My dear, I dreamt of a room full of chairs, and you in one, rocking, telling someone who you missed. You always were too honest. Don't tell it anything else. — me" },
  { x: 31, y: -303, letter: "My dear, your voice has been at the door three nights running. It knows what you called me. It doesn't know which of us takes sugar. I don't open it. — me" },
  { x: 44, y: -405, letter: "My dear, it called me tonight. It's very good at you now. I'm going down with the last doll and the long red ball, and I won't answer it, whatever it says. If this reaches you first, don't come up to meet me. — me" },
  { x: 91, y: -87.8, letter: "My dear, I knit them small, so they'll fit where you went. This one has your patience and none of my temper. I'm sorry about the mouths. It's safer. — me" },
  { x: 97, y: -341, letter: "My dear, the garden moved tonight, under the snow, like something turning over in its sleep. I think it heard me humming. I don't hum now. — me" },
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
  [25, 28.9, -261], [12.6, 23.4, -284], [36.8, 40.2, -311], [56.8, 60.9, -311], [46.8, 50.9, -420], [86.8, 90.0, -420],
  [47, 73, -58], [8, 34.4, -140], [45.9, 50, -140], [60.3, 64.4, -140], [72.9, 77, -140], [86.9, 90.2, -140], [95.8, 105.4, -140],
];
export const INK = [{ x0: 20, x1: 99, y: -196.6 }];
// stalactites that drip ink
export const DRIPS = [{ x: 67.6, y: -171 }, { x: 46.2, y: -173 }, { x: 89.2, y: -168 }, { x: 23.6, y: -170 }];

// Spindles: one turns while the thread runs past it within r; its gate opens when all of its spindles turn.
export const SPINDLES = [
  { x: 54.2, y: -300.1, r: 0.95, gate: 'h1' }, { x: 37.6, y: -302.3, r: 0.95, gate: 'h1' },
];
// A bobbin as big as a cart rolls between x0 and x1 on a floor at y, over the thread and everything else.
export const BOBBINS = [{ x0: 63, x1: 93.5, y: -405, r: 1.25, speed: 5.2 }, { x0: 58.6, x1: 75.4, y: -471.4, r: 1.25, speed: 5.6 }];

// The knitter's grey thread: from her door, down through the deep, to her chair. Knots hold her voice.
export const GREY = [
  [18.8, 1.4], [30, 0.8], [41.2, 0.6], [42.6, -4], [45.4, -8.4], [47, -8.4], [50, -8.4], [52.4, -9], [56, -12], [58.5, -16.4],
  [66, -16.4], [62, -20], [56, -24], [53.6, -25.4], [48.5, -25.4], [46.6, -25.6], [50, -28], [57, -31], [60.5, -33.4],
  [70, -33.4], [64, -37], [54, -39.4], [47, -39.4], [50.2, -40], [53.4, -41], [52, -44], [48, -48.4], [40, -49], [36, -50.5],
  [30, -60.4], [20, -61], [14, -60], [12.8, -66], [16, -71], [22, -82], [30, -81.6], [37, -81], [40.2, -84], [37, -92],
  [31, -99], [28.5, -106], [24, -117.6], [26.5, -118], [32.5, -115.3], [42, -122.2], [48.3, -119.9], [56.5, -120.2],
  [62.2, -119.4], [69, -123.2], [75.8, -121.9], [83, -122.6], [88.8, -120.3], [93, -121.8], [96.8, -118.8], [101, -121.4], [109, -125], [110, -136], [108.6, -148], [109.6, -160],
  [111, -167.8], [118, -168.4], [126, -169.2], [134, -170.9], [145, -171.2], [146.5, -173.3], [154.5, -173.2], [156, -174.8], [162.5, -174.7], [164, -177.3],
  [171.5, -177.2], [173, -178.8], [179.5, -178.7], [181, -181.3], [189.5, -181.2], [191, -183.8], [203, -183.8], [209, -186.4], [213, -191.6], [217, -194.8],
  [211, -194.9], [198, -194.9], [184, -194.9], [170, -194.7], [156, -194.6], [142, -194.4], [130, -194.2], [118, -194.0], [109, -194.0],
  [104, -193.9], [99, -194], [93.4, -191.0], [88, -192.8], [82.5, -191], [76, -191.8], [71.2, -189.2], [63.5, -190.2],
  [57.5, -187.9], [50, -191.8], [44.5, -189.5], [37, -192.8], [31, -191.5], [26, -193.2], [17, -194], [11, -196], [9.6, -204], [12.6, -212], [17, -218], [22, -246], [31, -246.2],
  // past her chair, down the hole, through the Hush
  [40, -246.3], [43.0, -246.6], [45.2, -252], [46, -258.7], [39, -258.7], [30.2, -258.7], [26.6, -256.2], [23.2, -258.7], [12, -258.7], [7.4, -259.6], [6.6, -266], [6.6, -280.8], [11.6, -280.8],
  [24.4, -280.8], [30, -280.8], [36, -281.8], [44, -282.3], [52, -282.3], [58, -281.9], [64, -282.4], [67.2, -289], [66.2, -298], [64, -302.8],
  [60, -301.7], [54.2, -300.6], [49.4, -302.8], [44.6, -302.8], [37.6, -302.8], [27, -302.8], [23, -305], [24, -312], [35.4, -312], [38.7, -308.7], [42.4, -312],
  [55.4, -312], [58.7, -308.7], [62, -312], [79, -312], [84, -311], [84, -290], [84.2, -283.6], [87, -285.2], [90, -285.3], [97, -285.3], [99.5, -292], [100.6, -300], [97.5, -312], [94, -325.8], [82, -325.8], [74.2, -325.8], [70, -325.8], [60, -325.8],
  [50, -324.5], [40, -325.8], [30, -325.8], [27, -330], [25, -340], [20.5, -352], [19.6, -358], [18, -365.8],
  // the Treadles: across the rings, up the rope, along the heddle corridor and down the well
  [25.6, -365.8], [29.1, -363.6], [34, -366.3], [41.0, -364.0], [47, -365.8], [53.1, -363.6], [58, -365.8], [66, -365.8], [68.4, -358],
  [70, -358], [90, -358], [108, -358], [120, -358.0], [130, -358.1], [160, -358.1], [195.5, -358.1], [197.5, -369.6], [170, -369.6], [143, -369.6],
  [141, -381.2], [170, -381.2], [197.5, -381.2], [199.5, -392.8], [175, -392.8], [143, -392.8], [140.5, -404.4],
  [130, -404.5], [122, -404.6], [113, -404.5], [108, -404.4], [98, -404.8], [60, -404.8], [38, -404.8], [35.6, -409], [36.6, -420.8], [45.2, -420.8], [48.7, -417.5], [52.4, -420.8], [66, -420.8], [85.2, -420.8], [88.7, -417.5], [92.4, -420.8], [97.5, -420.6], [100.4, -425], [104, -440], [106, -458], [102, -461.8], [96.6, -462],
  // the Loom: down to the cloth, across it, and up the warp to her
  [93, -505], [88, -539.8], [72, -539.8], [56, -539.8], [57.2, -520], [52, -503.4], [43, -501], [35, -503.0], [31.6, -495], [32.2, -487], [36.6, -487.8], [42, -487.3], [46.6, -486.9], [52, -486.8], [57, -484.4], [62, -486.4], [67.6, -485.8], [72.3, -485.1], [76.8, -484.5], [84, -483.8], [86.6, -477], [84, -471.2],
  [74.6, -471.2], [65, -471.2], [56, -471.2], [52.2, -469.0], [48.4, -471.2], [42.6, -471.2], [38, -469.8],
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
  { id: 'm5', x: 64.5, y: -190.2, text: "Don't let the ink touch you. It makes things forget. When it called my husband, he forgot his own face down here... but he remembered my name. He said it out loud. And it heard." },
  { id: 'm6', x: 17, y: -218, text: "She's so tired, little one. Her yarn's run grey. She can't climb back up. ...Come down. Come and sit with us. It's warm in the Loom." },
  { id: 'm7', x: 36, y: -246.2, text: "Forty-one chairs. It sits you down, little one. It's so gentle. It asks you who you miss... and you tell it. Then it calls them, too. That is how it has our names." },
  { id: 'm8', x: 66, y: -282.4, text: "Hush now, little one. Hush. Don't pluck your thread down here... they don't like the noise. Be quiet, and they'll let you by." },
  { id: 'm9', x: 61.4, y: -365.8, line: 'm9', thread: 'old', text: "Mama? I fell down the well. It's dark. Mama, there's something down here with me. It says everything I say." },
  { id: 'm10', x: 67.6, y: -539.8, text: "This is the last of me, little one. I told you, don't follow. 'Never let go of the thread...' that part was not my voice. It can't climb. It needs one thread, from here to the top, and you have brought it one. When it begs you with my voice, bite your thread in two. I never gave you a name. So it can never call you." },
  // in the rooms the thread opens (at the end of the list: saves keep them by their place in it)
  { id: 'm11', x: 10.4, y: -280.8, text: "They sat in rows down here, little one, and said them aloud. The names of everyone they had lost. They thought that they were praying." },
  { id: 'm12', x: 47.4, y: -302.8, text: 'When it moves in the walls, be still. I was still for a whole winter, once. It sat beside me the whole time.' },
  { id: 'm13', x: 43.6, y: -420.8, text: 'I can hear you coming down. Such small feet. ...I never gave you feet that make a sound.' },
];
// her chair in the Hall of Chairs: empty, her candle still burning beside it
export const CHAIR = { x: 32.6, y: -246.2 };
// what is left of her, at the top of the Loom: a shawl with nothing much in it, her glasses, the candle she carried down
export const REMAINS = { x: 28.4, candle: 26.4 };
export const FINALE = {
  x: 16, y: -443.8,
  text: "There you are. Oh, little one, you came all this way. I'm so cold. I can't see the light. Tie your thread to mine, and pull me up. Please. Please.",
  love: "Don't you love me? I made you. Don't you love me?",
  mama: 'Mama?',
  tieit: 'Tie it. Tie it. Tie it. Tie it. Tie it.',
  after: 'Thank you, little one. Now we can all come up.',
  scream: 'WHAT HAVE YOU DONE??',
  cut4: 'Hold on to me!',
  cut3: "Little one? Little one? That isn't a name. What is your name?",
  names: ['Ada?', 'Agnes?', 'Alice?', 'Anna?', 'Beatrice?', 'Bertha?', 'Catherine?', 'Clara?', 'Dora?', 'Edith?', 'Eleanor?', 'Ellen?', 'Emma?'],
};
export const LIGHTS = [
  // static lamps: glow-fungus, the cottage window, her candle
  { x: 13.2, y: 2.2, r: 7, i: 1.3, c: [1.0, 0.62, 0.28], flicker: 1 },   // cottage window
  { x: 22, y: -49.6, r: 6, i: 0.7, c: [0.75, 0.85, 0.8], flicker: 0.2 },  // fungus G1
  { x: 30, y: -72.4, r: 6, i: 0.8, c: [0.75, 0.85, 0.8], flicker: 0.2 },  // fungus G2 (moths gather)
  { x: 21.3, y: -192.4, r: 6, i: 0.55, c: [1.0, 0.66, 0.34], flicker: 1 },  // a ferry lamp left burning on the far shore of the Mere
  { x: 34.2, y: -245.4, r: 9, i: 1.25, c: [1.0, 0.6, 0.27], flicker: 1 },  // her candle by the empty chair in the Hall
  { x: 26.4, y: -443.3, r: 6.5, i: 0.9, c: [1.0, 0.6, 0.27], flicker: 1, finale: true },  // her candle at the top of the Loom
  // the deep is not quite black: a cold breath over the Hall's chairs, lamps in the Treadles, and a grey nothing in the Loom
  { x: 18, y: -238, r: 13, i: 0.3, c: [0.7, 0.72, 0.82], flicker: 0 },
  { x: 33, y: -236, r: 13, i: 0.28, c: [0.7, 0.72, 0.82], flicker: 0 },
  { x: 36, y: -252.5, r: 10, i: 0.34, c: [0.7, 0.72, 0.82], flicker: 0 }, { x: 18, y: -252.5, r: 10, i: 0.34, c: [0.7, 0.72, 0.82], flicker: 0 },
  { x: 18, y: -276, r: 9, i: 0.3, c: [0.7, 0.72, 0.82], flicker: 0 }, { x: 9, y: -272, r: 9, i: 0.34, c: [0.7, 0.72, 0.82], flicker: 0 }, { x: 25, y: -273, r: 9, i: 0.36, c: [0.7, 0.72, 0.82], flicker: 0 },
  { x: 95, y: -399, r: 9, i: 0.45, c: [1.0, 0.62, 0.3], flicker: 1 }, { x: 70, y: -398.5, r: 9, i: 0.4, c: [1.0, 0.62, 0.3], flicker: 1 }, { x: 46, y: -398.5, r: 8, i: 0.4, c: [1.0, 0.62, 0.3], flicker: 1 },
  { x: 38, y: -413, r: 8, i: 0.4, c: [1.0, 0.62, 0.3], flicker: 1 }, { x: 64, y: -413, r: 9, i: 0.4, c: [1.0, 0.62, 0.3], flicker: 1 }, { x: 92, y: -413, r: 8, i: 0.4, c: [1.0, 0.62, 0.3], flicker: 1 },
  { x: 64, y: -81, r: 12, i: 0.26, c: [0.66, 0.8, 0.76], flicker: 0 }, { x: 77, y: -80, r: 14, i: 0.3, c: [0.66, 0.8, 0.76], flicker: 0 }, { x: 89, y: -81, r: 12, i: 0.26, c: [0.66, 0.8, 0.76], flicker: 0 },      // the Orchard
  { x: 62, y: -336.4, r: 11, i: 0.24, c: [0.74, 0.74, 0.82], flicker: 0 }, { x: 78, y: -336.4, r: 11, i: 0.24, c: [0.74, 0.74, 0.82], flicker: 0 }, { x: 93, y: -337, r: 11, i: 0.24, c: [0.74, 0.74, 0.82], flicker: 0 },      // the Long Room
  { x: 16, y: -360, r: 8, i: 0.5, c: [1.0, 0.62, 0.3], flicker: 1 },
  { x: 62, y: -360, r: 8, i: 0.5, c: [1.0, 0.62, 0.3], flicker: 1 },
  { x: 88, y: -352, r: 9, i: 0.45, c: [1.0, 0.62, 0.3], flicker: 1 },
  { x: 108, y: -400, r: 7, i: 0.45, c: [1.0, 0.62, 0.3], flicker: 1 },
  // (2026-11-27) the Dry Falls: a cold grey in the basins, nothing in the Underway but what she brings; the Cistern a little warmer
  { x: 150, y: -165, r: 16, i: 0.2, c: [0.72, 0.78, 0.86], flicker: 0 }, { x: 178, y: -170, r: 16, i: 0.2, c: [0.72, 0.78, 0.86], flicker: 0 }, { x: 199, y: -176, r: 13, i: 0.18, c: [0.72, 0.78, 0.86], flicker: 0 },
  { x: 214, y: -190, r: 9, i: 0.26, c: [0.8, 0.82, 0.86], flicker: 0 }, { x: 225, y: -190, r: 9, i: 0.26, c: [0.8, 0.82, 0.86], flicker: 0 },
  // the Stores: a lamp left on each gallery, the loft's own
  { x: 134, y: -356.6, r: 9, i: 0.45, c: [1.0, 0.62, 0.3], flicker: 1 }, { x: 186, y: -356.6, r: 9, i: 0.4, c: [1.0, 0.62, 0.3], flicker: 1 },
  { x: 206, y: -368.2, r: 9, i: 0.42, c: [1.0, 0.62, 0.3], flicker: 1 }, { x: 156, y: -368.2, r: 8, i: 0.36, c: [1.0, 0.62, 0.3], flicker: 1 },
  { x: 136, y: -379.8, r: 8, i: 0.36, c: [1.0, 0.62, 0.3], flicker: 1 }, { x: 180, y: -379.8, r: 9, i: 0.4, c: [1.0, 0.62, 0.3], flicker: 1 },
  { x: 206, y: -391.4, r: 9, i: 0.4, c: [1.0, 0.62, 0.3], flicker: 1 }, { x: 160, y: -391.4, r: 8, i: 0.36, c: [1.0, 0.62, 0.3], flicker: 1 },
  { x: 146, y: -403, r: 9, i: 0.4, c: [1.0, 0.62, 0.3], flicker: 1 }, { x: 196, y: -403, r: 9, i: 0.42, c: [1.0, 0.62, 0.3], flicker: 1 },
  { x: 116, y: -379.6, r: 7, i: 0.3, c: [0.86, 0.8, 0.72], flicker: 0 }, { x: 122, y: -379.6, r: 7, i: 0.3, c: [0.86, 0.8, 0.72], flicker: 0 },
  { x: 40, y: -528, r: 26, i: 0.15, c: [0.7, 0.76, 0.9], flicker: 0 },
  { x: 82, y: -528, r: 26, i: 0.15, c: [0.7, 0.76, 0.9], flicker: 0 },
  { x: 30, y: -478, r: 20, i: 0.16, c: [0.7, 0.76, 0.9], flicker: 0 },
];

// ── the deep's machinery (deep.js) ─────────────────────────────────────────
// Ropes and warp threads you can climb: hold grip next to one. [x, yBottom, yTop]
export const ROPES = [
  [84, -312.3, -284.0],            // the Hush: up out of the Pin Walk into H2
  [68.6, -366.2, -356.4],          // the Treadles: up out of the east ledge into the heddle corridor
  [57.4, -540, -502.4],            // the Loom: the first warp, cloth to ledge
  [31.6, -503.2, -486.8],          // the second, past the needles
  [86.6, -484.0, -469.2],          // the third, at the far side
  [42.4, -470, -443.0],            // the last, beside the breast beam
];
// Hands in the Hush's earth (deep.js HAND): [x, y] near a wall, floor or roof; reach in metres.
export const HANDS = [
  [36, -279, 4], [57, -277, 5], [62, -279, 3.5], [82, -276, 6],
  [56, -295, 7], [46, -295, 7], [38, -295, 7], [31, -295, 7], [48, -302.6, 2.2], [30, -302.6, 2.2],                 // the Slabs
  [32, -306, 6], [44, -306, 6], [52, -306, 6], [64, -306, 6], [72, -306, 6], [50, -311.8, 2.2], [75, -311.8, 2.2], [86, -300, 3], [82, -292, 3],      // the Pin Walk, and the rope
  [86, -285, 2.4], [100, -282, 5],
  [102, -296, 4], [96, -303, 4], [90, -315.6, 10.8], [83, -315.6, 10.8], [76, -315.6, 10.8], [68, -315.6, 10.8], [60, -315.6, 10.8], [53, -315.6, 10.8],
  [46, -315.6, 10.8], [40, -315.6, 10.8], [35, -315.6, 10.8], [27, -315.6, 10.8], [17, -320, 5],
  // up out of the floor of the long gallery
  [86, -325.6, 2.4], [78.5, -325.6, 2.4], [68, -325.6, 2.4], [57.5, -325.6, 2.4], [48.2, -324, 2.4], [40.5, -325.6, 2.4], [30, -325.6, 2.4],
];
// Things that slam: heddle frames dropping in the Treadles, needles stabbing out of the Loom's cloth.
// rect at rest (x0, y0, x1, y1), the direction it moves and how far, the cycle (s) and its phase.
export const STAMPERS = [
  { kind: 'heddle', r: [77, -351, 79.6, -350], dir: [0, -1], dist: 7.0, per: 3.0, ph: 0.0 },
  { kind: 'heddle', r: [84, -351, 86.6, -350], dir: [0, -1], dist: 7.0, per: 3.0, ph: 0.75 },
  { kind: 'heddle', r: [91, -351, 93.6, -350], dir: [0, -1], dist: 7.0, per: 3.0, ph: 1.5 },
  { kind: 'heddle', r: [98, -351, 100.6, -350], dir: [0, -1], dist: 7.0, per: 2.4, ph: 0.4 },
  { kind: 'heddle', r: [53.4, -397.8, 56, -396.8], dir: [0, -1], dist: 7.2, per: 3.0, ph: 0.4 },
  { kind: 'heddle', r: [47, -397.8, 49.6, -396.8], dir: [0, -1], dist: 7.2, per: 2.4, ph: 1.1 },
  { kind: 'heddle', r: [73.5, -412, 76.1, -411], dir: [0, -1], dist: 9.0, per: 2.8, ph: 0.2 },
  { kind: 'heddle', r: [78.2, -412, 80.8, -411], dir: [0, -1], dist: 9.0, per: 2.8, ph: 1.6 },
  { kind: 'needle', r: [4, -489.5, 5, -488.9], dir: [1, 0], dist: 28, per: 3.2, ph: 0.0 },
  { kind: 'needle', r: [4, -497.0, 5, -496.4], dir: [1, 0], dist: 28, per: 3.2, ph: 1.6 },
  { kind: 'needle', r: [4, -459.6, 5, -459.0], dir: [1, 0], dist: 40.5, per: 3.6, ph: 0.9 },
];
// The dark that rises after you in the Loom: wakes when you leave peg `peg` (24) and her last words are over (`after` s),
// stops at peg `stop` (28). `lag`: it is never further below you than this.
export const RISE = { x0: 4, x1: 116, y0: -540, y1: -446, peg: 24, stop: 28, delay: 3.0, back: 12, after: 31,
  // from each pole: how fast it comes (m/s), and how far below her it can be left. In between it gathers itself and heaves (`surge`)
  legs: { 24: [1.7, 17], 25: [1.2, 14], 26: [1.2, 13], 44: [0.42, 12], 45: [0.42, 12], 46: [0.62, 11], 47: [0.3, 10], 48: [0.34, 10], 27: [1.3, 13] },
  surge: { every: 8.5, warn: 1.1, len: 0.8, k: 4.2 } };
// the called, standing on the floor of the Loom: [x, picture, height]
export const CALLED = [
  [85.6, 0, 1.9], [83.9, 3, 1.75], [82.2, 2, 1.5], [80.1, 1, 1.95], [78.4, 0, 1.7], [76.0, 3, 1.9], [74.6, 2, 1.85], [69.4, 1, 1.9], [67.9, 0, 1.35], [66.0, 3, 1.8],
  [64.2, 2, 1.9], [62.4, 1, 1.75], [59.9, 0, 1.95], [54.2, 3, 1.7], [52.0, 2, 1.9], [49.6, 0, 1.8], [46.8, 1, 1.3], [44.5, 3, 1.95], [41.2, 2, 1.8], [38.0, 0, 1.9], [34.8, 1, 1.7],
];

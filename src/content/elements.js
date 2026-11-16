// Shared description of each design element: what the engine checks and
// what it leaves to the engineer. Used by the Help page and the public
// calculator pages (src/public). Keep in step with the engines: every
// statement must describe what the backend actually does.
/* ---- what each element does: checks made, and what is left to the engineer ---- */
export const ELEMENTS = [
  {
    key: "slab", name: "Slab: one-way and two-way", to: "/structural-input",
    checks: [
      "Design load from EN 1990 Eq. 6.10 with imposed load and downward wind; the leading action can be chosen or left on Auto (the larger case is used).",
      "Bending: required steel, minimum steel and the bars provided (EC2 6.1, 9.2.1.1). Two-way slabs use moment coefficients and design four locations: short and long span, midspan and continuous edges.",
      "Shear without shear reinforcement (EC2 6.2.2).",
      "Deflection by span / effective depth (EC2 7.4.2, Eq. 7.16).",
      "Reinforcement plan drawing and bar schedule (not for cantilever slabs).",
    ],
    limits: [
      "Wind uplift (suction) is not checked: wind is a downward pressure only.",
      "Cover is not checked against the exposure class on the one-way slab (the two-way slab checks it only when no cover is entered).",
      "No fire or crack-width check on these two; the continuous slab has both.",
    ],
  },
  {
    key: "cslab", name: "Continuous one-way slab", to: "/continuous-slab",
    checks: [
      "Pattern loading: loaded spans carry the full design load, unloaded spans 1.35 Gk (EC2 5.1.3). Moments and shears are enveloped separately.",
      "Bending at every span and support, shear at each support (EC2 6.1, 6.2.2).",
      "Deflection by span / effective depth (EC2 7.4.2).",
      "Cover for the exposure class (EC2 4.4.1), fire resistance (EN 1992-1-2 Table 5.8) and crack control by bar spacing (EC2 7.3.3).",
      "Elevation drawing and bar schedule: top bars over the supports, bottom bars per span, distribution bars.",
    ],
    limits: [
      "Spans over 4.5 m are designed, with a note in the report.",
      "Crack control uses the ULS lever arm, which gives a steel stress about 3% lower than a cracked elastic section.",
      "Bar curtailment uses simplified rules (top bars 0.3 x the longer adjacent span each side of a support), stated in the report.",
    ],
  },
  {
    key: "beam", name: "Beam: simply supported", to: "/beam",
    checks: [
      "Bending: required and minimum steel and the bars provided (EC2 6.1). When the engine chooses the bar size it also checks the clear spacing between bars (EC2 8.2).",
      "Shear resistance and links (EC2 6.2).",
      "Deflection by span / effective depth (EC2 7.4.2).",
      "Anchorage at simple supports (EC2 9.2.1.4), bar spacing, an elevation and section drawing and a bar schedule.",
    ],
    limits: [
      "The crushing limit of the concrete struts (V_Rd,max) and the minimum link ratio are not checked. Check both by hand for heavily loaded or short beams.",
      "The detailing designs the span steel only: hogging steel at fixed ends is not detailed.",
    ],
  },
  {
    key: "cbeam", name: "Beam: continuous", to: "/continuous-beam",
    checks: [
      "Analysis of the spans with the end supports taken both pinned and fixed; the worse of the two governs each section.",
      "Bending at spans and supports, shear and links.",
      "Deflection of every span with its own factor (single, end or interior span).",
      "Crack control by bar size or spacing (EC2 7.3.3) and cover for the exposure class and working life (EC2 4.4.1).",
      "End anchorage, an elevation drawing and a bar schedule (bottom bars per span, top bars over supports, hangers, links).",
    ],
    limits: [
      "No pattern loading: every span carries the full design load at once. Check alternate-span loading by hand where live load is large compared with dead load.",
      "The quasi-permanent factor for cracking is taken as 0.6.",
    ],
  },
  {
    key: "column", name: "Column", to: "/column-input",
    checks: [
      "Axial, uniaxial or biaxial bending, with the load entered directly or taken down from the floors.",
      "Slenderness limit and second-order moments by nominal curvature (EC2 5.8.3.1, 5.8.8).",
      "N-M interaction for the section; biaxial interaction (EC2 5.8.9).",
      "Bar and link detailing limits (EC2 9.5). Section and bars can differ by storey.",
      "Storey-by-storey drawing and bar schedule: main bars with laps, links closer at laps and below floors, cross-ties where needed.",
    ],
    limits: [
      "Fire resistance is not checked.",
    ],
  },
  {
    key: "pad", name: "Foundation: pad footing", to: "/foundation-input",
    checks: [
      "Bearing pressure on service loads plus the weight of the footing and the soil on it, with eccentricity and uplift.",
      "Bending at the column (or pedestal) face from the trapezoidal pressure; minimum and maximum steel.",
      "One-way shear at d from the face and punching shear around the column (EC2 6.2, 6.4.4).",
      "Anchorage of the bottom bars at the footing edge (EC2 9.8.2.2), a reinforcement drawing and a bar schedule with starter bars and links.",
      "Optional: size the footing from the allowable bearing pressure, deepening it until the checks pass.",
    ],
    limits: [
      "Bearing is a warning only: a footing that exceeds the allowable pressure still shows PASS overall. Read the Bearing tab.",
      "Edge and corner columns: the reduced punching perimeters are not modelled, so punching is reported as not applicable there. Check it by hand.",
      "The design approach (EN 1997-1) is not applied; bearing uses the allowable pressure you enter.",
      "Links are not scheduled for circular columns.",
    ],
  },
  {
    key: "combined", name: "Foundation: combined footing", to: "/foundation-input?type=combined",
    checks: [
      "Bearing on service loads; shear force and bending moment along the footing.",
      "Separate bottom (sagging) and top (hogging) longitudinal steel, and transverse steel.",
      "Shear at d from each face of each column; punching at each column (EC2 6.4.4).",
      "Optional sizing so the footing centre sits under the resultant of the two column loads.",
    ],
    limits: [
      "Two rectangular columns only.",
      "The engine does not add steel to pass shear; a shear failure needs a deeper footing.",
      "Bearing is a warning only, as for the pad footing.",
    ],
  },
  {
    key: "stair", name: "Staircase", to: "/staircase-design",
    checks: [
      "Flight and landing analysed as a frame pinned at both ends, per metre width.",
      "Bottom steel for the span, top steel where the flight meets the landing, distribution steel.",
      "Deflection (EC2 7.4.2) and shear including the axial force in the frame (EC2 6.2.2).",
      "Anchorage at the landing support, a to-scale section and a bar schedule.",
    ],
    limits: [
      "The pinned frame usually shows a small uplift at the landing support. It is reported as a warning, not a failure.",
      "The self-weight of the waist is taken on its thickness, without a slope factor.",
    ],
  },
];

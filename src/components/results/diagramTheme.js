// src/components/results/diagramTheme.js
// One colour set for the force diagrams on every results page (slab, continuous
// slab, beam, continuous beam, staircase, footings), so a sagging moment looks
// the same wherever it is drawn:
//   sagging (+, bottom tension)  blue
//   hogging (-, top tension)     red
//   shear force                  green
//   axial force                  amber
//   deflected shape              violet
export const DIAGRAM = {
  sagging: "#2563eb",
  hogging: "#dc2626",
  shear: "#059669",
  axial: "#d97706",
  deflection: "#7c3aed",
  fillOpacity: 0.18,
};

// colour for a signed moment value
export const momentColor = (m) => (m < 0 ? DIAGRAM.hogging : DIAGRAM.sagging);

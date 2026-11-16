// Leaving a results page whose design has not been saved asks first (Save /
// Discard / Cancel). The results top bar (components/results/DesignTopBar.jsx)
// registers the guard; links are caught there, and buttons that navigate in
// code wrap the navigation: guardNavigation(() => navigate(...)).

let guard = null; // { isDirty(): boolean, prompt(go: () => void): void }

export function registerGuard(g) {
  guard = g;
  return () => { if (guard === g) guard = null; };
}

// Runs go() now, or after the user chose Save or Discard.
export function guardNavigation(go) {
  if (guard?.isDirty()) guard.prompt(go);
  else go();
}

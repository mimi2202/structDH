// Quick design: one element designed on its own, outside any project. The
// Quick Design page sets the mode when an element is started; MainLayout then
// shows only that element and the way back (not the full element list), and
// any dashboard-level page (AccountLayout) ends the mode again.
// Kept in sessionStorage, so it lasts for this tab only.

const KEY = 'design_mode';
// Reference pages that keep the quick-design sidebar while one is in progress.
const TOOL_PATHS = ['/load-cases', '/materials'];

// Every element the engines design. `saved` = the savedDesigns element key.
// `paths` = the input / results routes that belong to the element.
export const QUICK_ELEMENTS = [
  {
    key: 'slab', label: 'One-way / two-way slab', saved: 'slab', path: '/structural-input',
    paths: ['/structural-input', '/slab-results'], code: 'EC2 6.1 · 6.2 · 7.4',
    summary: 'Single panel, simply supported or with continuous edges (two-way coefficients).',
    checks: ['Flexure', 'Shear', 'Deflection (span/depth)', 'Wind combination'],
  },
  {
    key: 'continuous-slab', label: 'Continuous slab', saved: 'continuous-slab', path: '/continuous-slab',
    paths: ['/continuous-slab', '/continuous-slab-results'], code: 'EC2 5.1.3 · 6.1 · 7.3',
    summary: 'One-way slab over several spans with pattern loading.',
    checks: ['Hogging / sagging', 'Shear', 'Deflection', 'Cover, fire, crack'],
  },
  {
    key: 'beam', label: 'Beam', saved: 'beam', path: '/beam',
    paths: ['/beam', '/beam-results'], code: 'EC2 6.1 · 6.2 · 7.4',
    summary: 'Simply supported rectangular or flanged beam.',
    checks: ['Flexure', 'Shear links', 'Deflection', 'Bar spacing'],
  },
  {
    key: 'continuous-beam', label: 'Continuous beam', saved: 'continuous-beam', path: '/continuous-beam',
    paths: ['/continuous-beam', '/continuous-beam-results'], code: 'EC2 5.4 · 6.1 · 7.3',
    summary: 'Multi-span beam, pinned or fixed ends.',
    checks: ['Support / span moments', 'Shear', 'Deflection per span', 'Crack control'],
  },
  {
    key: 'column', label: 'Column', saved: 'column', path: '/column-input',
    paths: ['/column-input', '/column-results'], code: 'EC2 5.8 · 6.1',
    summary: 'Braced or unbraced column, uniaxial or biaxial bending.',
    checks: ['Slenderness', 'Second-order moments', 'N-M interaction', 'Links'],
  },
  {
    key: 'pad', label: 'Pad foundation', saved: 'foundation', path: '/foundation-input?type=pad',
    paths: ['/foundation-input', '/foundation-results'], code: 'EC2 6.4 · 9.8 · EN 1997-1',
    summary: 'Isolated pad under one column; can size the footing for you.',
    checks: ['Bearing (SLS)', 'Bending', 'One-way shear', 'Punching', 'Detailing'],
  },
  {
    key: 'combined', label: 'Combined footing', saved: 'foundation', path: '/foundation-input?type=combined',
    paths: ['/foundation-input', '/foundation-results'], code: 'EC2 6.4 · 9.8 · EN 1997-1',
    summary: 'One footing under two columns, centroid on the load resultant.',
    checks: ['Bearing (SLS)', 'Top / bottom steel', 'Shear', 'Punching per column'],
  },
  {
    key: 'staircase', label: 'Staircase', saved: 'staircase', path: '/staircase-design',
    paths: ['/staircase-design', '/staircase-results'], code: 'EC2 6.1 · 6.2 · 7.4',
    summary: 'Flight and landing analysed as a frame, with bar schedule.',
    checks: ['Frame analysis', 'Flexure', 'Deflection', 'Shear', 'Anchorage'],
  },
];

export const elementByKey = (k) => QUICK_ELEMENTS.find((e) => e.key === k) || null;

export function startQuickDesign(elementKey) {
  try { sessionStorage.setItem(KEY, JSON.stringify({ mode: 'quick', element: elementKey, at: Date.now() })); } catch { /* storage disabled */ }
}

// Ends a quick design or a project design.
export function endQuickDesign() {
  try { sessionStorage.removeItem(KEY); } catch { /* storage disabled */ }
}

// The quick design in progress on this path, or null. Project pages
// (/workspace/...) are never quick, and the element must match the page.
export function quickDesignFor(pathname) {
  if (pathname.startsWith('/workspace/')) return null;
  try {
    const v = JSON.parse(sessionStorage.getItem(KEY));
    const el = v?.mode === 'quick' ? elementByKey(v.element) : null;
    return el && [...el.paths, ...TOOL_PATHS].some((p) => pathname.startsWith(p)) ? el : null;
  } catch {
    return null;
  }
}

// Project design: the element pages work for one project. Set by the project's
// design hub (/workspace/:ws/projects/:id/design); saves made while it is set
// are attached to that project (utils/savedDesigns.js). Same storage key as a
// quick design, so starting one ends the other; AccountLayout ends both.
export const projectHubPath = (p) => `/workspace/${p.workspace_id || 'personal'}/projects/${p.id}/design`;

export const DESIGN_MODE_EVENT = 'design-mode';

export function startProjectDesign(project) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({
      mode: 'project', project: { id: project.id, name: project.name, workspace_id: project.workspace_id || null }, at: Date.now(),
    }));
    // next tick: the layout's listener is attached after the page's effect runs
    setTimeout(() => window.dispatchEvent(new Event(DESIGN_MODE_EVENT)), 0);
  } catch { /* storage disabled */ }
}

// The project being designed, or null.
export function currentProjectDesign() {
  try {
    const v = JSON.parse(sessionStorage.getItem(KEY));
    return v?.mode === 'project' && v.project?.id ? v.project : null;
  } catch {
    return null;
  }
}

// Public site settings. SITE_URL is the one place the canonical address is
// set (canonical links now; sitemap, Open Graph and JSON-LD in phase 2).
// Override with VITE_SITE_URL at build time (e.g. for a preview deployment).
export const SITE_URL = (import.meta.env?.VITE_SITE_URL || "https://spheredesignhub.com").replace(/\/+$/, "");

export const PRODUCT = "Sphere Design Hub";

// One plain definition, used the same way on every page.
export const DEFINITION =
  "Sphere Design Hub is a web-based Eurocode 2 reinforced concrete design tool for beams, columns, slabs, foundations and staircases. " +
  "It produces step-by-step calculations with clause references, reinforcement drawings and bar schedules.";

// Shown on every public page; date of the last content review (fixed string so
// the prerendered HTML and the browser render match).
export const LAST_UPDATED = "16 November 2026";

export const LOGIN_URL = "/login";
export const SIGNUP_URL = "/signup";

export const DISCLAIMER =
  "Sphere Design Hub is a design aid. Every result must be checked by a qualified structural engineer, " +
  "who remains responsible for the design.";

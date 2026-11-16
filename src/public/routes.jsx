// The public route list: the only pages that are prerendered and indexable.
// Used by the browser (src/main.jsx picks the public bundle for these paths),
// the prerender script and, in phase 2, the sitemap.
import React from "react";
import { HomePage, ModulePage, MethodologyPage, NotFoundPage } from "./PublicPages";
import { MODULES } from "./modules";
import { PRODUCT } from "./site";

export const PUBLIC_ROUTES = [
  {
    path: "/",
    title: `${PRODUCT}: Eurocode 2 Structural Design Tool`,
    description: "Design reinforced concrete beams, columns, slabs, foundations and staircases to Eurocode 2, with clause-referenced calculations, drawings and bar schedules.",
    render: () => <HomePage />,
  },
  ...MODULES.map((m) => ({
    path: `/${m.slug}`,
    title: m.title,
    description: m.description,
    render: () => <ModulePage slug={m.slug} />,
  })),
  {
    path: "/methodology",
    title: `How Calculations Are Verified | ${PRODUCT}`,
    description: "How Sphere Design Hub checks its Eurocode 2 calculations: hand calculations, independent solvers, worked examples, and the simplifications each calculator makes.",
    render: () => <MethodologyPage />,
  },
];

export const NOT_FOUND = {
  path: "/404",
  title: `Page Not Found | ${PRODUCT}`,
  description: "There is no page at this address.",
  render: () => <NotFoundPage />,
  noindex: true,
};

// "/eurocode-2-beam-design-calculator/" and the bare path both match
export const normalise = (pathname) => (pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname);
export const publicRoute = (pathname) => PUBLIC_ROUTES.find((r) => r.path === normalise(pathname)) || null;

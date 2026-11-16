// Server entry for the build-time prerender (scripts/prerender.mjs).
// Built with `vite build --ssr`; never shipped to the browser.
/* eslint-disable react-refresh/only-export-components */
import React from "react";
import { renderToString } from "react-dom/server";
import PublicApp from "./PublicApp";
import { PUBLIC_ROUTES, NOT_FOUND } from "./routes";
import { SITE_URL } from "./site";

export { PUBLIC_ROUTES, NOT_FOUND, SITE_URL };

export function render(path) {
  return renderToString(<PublicApp pathname={path} />);
}

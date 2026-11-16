// Browser side of the public pages: picks the page for the current path. The
// HTML is already there from the build (scripts/prerender.mjs), so main.jsx
// hydrates it instead of rendering from scratch.
import { publicRoute, NOT_FOUND } from "./routes";

export default function PublicApp({ pathname }) {
  const route = publicRoute(pathname) || NOT_FOUND;
  return route.render();
}

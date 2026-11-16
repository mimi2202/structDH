// Build-time prerender of the public pages (run after `vite build` and
// `vite build --ssr src/public/entry-server.jsx --outDir dist-ssr`).
//   dist/index.html            home page (prerendered)
//   dist/<slug>.html           each public page (served at /<slug> by cleanUrls)
//   dist/404.html              real 404 page for unknown URLs
//   dist/app.html              empty app shell, noindex (app routes rewrite here)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const ssr = path.join(root, "dist-ssr", "entry-server.js");

const { render, PUBLIC_ROUTES, NOT_FOUND, SITE_URL } = await import(pathToFileURL(ssr).href);

// Every app route in App.jsx must be rewritten to the app shell by vercel.json,
// otherwise it would be a 404 in production. Fail the build if one is missing.
{
  const app = fs.readFileSync(path.join(root, "src", "App.jsx"), "utf8");
  const rewrites = JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8")).rewrites || [];
  const toRe = (src) => new RegExp("^" + src.replace(/:(\w+)\*/g, ".*").replace(/:(\w+)/g, "[^/]+") + "$");
  const res = rewrites.filter((r) => r.destination === "/app.html").map((r) => toRe(r.source));
  const publicPaths = new Set(PUBLIC_ROUTES.map((r) => r.path));
  const missing = [...app.matchAll(/path="([^"]+)"/g)].map((m) => m[1])
    .filter((p) => !publicPaths.has(p) && p !== "*")
    .map((p) => p.replace(/:\w+/g, "x1"))
    .filter((p) => !res.some((re) => re.test(p)));
  if (missing.length) {
    console.error(`vercel.json does not rewrite these app routes to /app.html:\n  ${missing.join("\n  ")}`);
    process.exit(1);
  }
}
const template = fs.readFileSync(path.join(dist, "index.html"), "utf8");

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function page(route, { body = "", noindex = false, canonical = true, marker = "" } = {}) {
  const head = [
    `<title>${esc(route.title)}</title>`,
    `<meta name="description" content="${esc(route.description)}" />`,
    canonical ? `<link rel="canonical" href="${SITE_URL}${route.path === "/" ? "/" : route.path}" />` : "",
    noindex ? `<meta name="robots" content="noindex, nofollow" />` : "",
  ].filter(Boolean).join("\n    ");
  let html = template.replace(/<title>[\s\S]*?<\/title>/, head);
  if (marker) html = html.replace(/<html lang="en"/, `<html lang="en" data-page="${marker}"`);
  return html.replace('<div id="root"></div>', `<div id="root">${body}</div>`);
}

const write = (file, html) => {
  fs.mkdirSync(path.dirname(path.join(dist, file)), { recursive: true });
  fs.writeFileSync(path.join(dist, file), html);
};

// the app shell first: index.html is about to become the home page
write("app.html", page({ title: "Sphere Design Hub", description: "Sphere Design Hub app." }, { noindex: true, canonical: false }));

for (const r of PUBLIC_ROUTES) {
  write(r.path === "/" ? "index.html" : `${r.path.slice(1)}.html`, page(r, { body: render(r.path) }));
}
write("404.html", page(NOT_FOUND, { body: render(NOT_FOUND.path), noindex: true, canonical: false, marker: "404" }));

fs.rmSync(path.join(root, "dist-ssr"), { recursive: true, force: true });
console.log(`prerendered ${PUBLIC_ROUTES.length} public pages + 404 + app shell (site ${SITE_URL})`);

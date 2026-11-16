// Public, prerendered pages (home, one page per calculator, methodology, 404).
// Rendered to static HTML at build time (scripts/prerender.mjs) and hydrated
// in the browser by src/public/PublicApp.jsx. Rules for this file:
//   - render must be pure (no window / localStorage / dates), so the HTML from
//     the build and the browser render are identical;
//   - links are plain <a href> so crawlers and visitors get real URLs.
import React from "react";
import { PRODUCT, DEFINITION, LAST_UPDATED, LOGIN_URL, SIGNUP_URL, DISCLAIMER } from "./site";
import { MODULES, moduleBySlug } from "./modules";
import { ELEMENTS } from "../content/elements";

const elementByKey = Object.fromEntries(ELEMENTS.map((e) => [e.key, e]));

const NAVY = "#0A2F44";
const A = "font-medium text-[#0A2F44] underline-offset-2 hover:underline";

function Layout({ children, crumbs }) {
  return (
    <div className="min-h-screen bg-white text-[#0F172A]">
      <header className="border-b border-[#e2e8f0] bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <a href="/" className="flex items-center gap-2" aria-label={`${PRODUCT} home`}>
            <span className="flex h-8 w-8 items-center justify-center rounded-md text-[11px] font-bold text-white" style={{ background: NAVY }}>SDH</span>
            <span className="text-sm font-semibold">{PRODUCT}</span>
          </a>
          <nav aria-label="Main" className="flex items-center gap-4 text-sm">
            <a href="#calculators" className="hidden text-[#334155] hover:text-[#0A2F44] sm:inline">Calculators</a>
            <a href="/methodology" className="hidden text-[#334155] hover:text-[#0A2F44] sm:inline">Methodology</a>
            <a href={LOGIN_URL} className="rounded-md px-3 py-1.5 font-medium text-white" style={{ background: NAVY }}>Log in</a>
          </nav>
        </div>
      </header>
      {crumbs && (
        <nav aria-label="Breadcrumb" className="mx-auto max-w-6xl px-4 pt-4 text-xs text-[#64748b]">
          <ol className="flex flex-wrap gap-1">
            {crumbs.map(([label, href], i) => (
              <li key={label} className="flex gap-1">
                {i > 0 && <span aria-hidden>/</span>}
                {href ? <a href={href} className="hover:underline">{label}</a> : <span aria-current="page">{label}</span>}
              </li>
            ))}
          </ol>
        </nav>
      )}
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      <footer className="border-t border-[#e2e8f0] bg-[#f8fafc]">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 text-sm sm:grid-cols-3">
          <div>
            <p className="font-semibold">{PRODUCT}</p>
            <p className="mt-1 text-xs text-[#64748b]">Eurocode 2 structural design tool.</p>
          </div>
          <div id="calculators">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#64748b]">Calculators</p>
            <ul className="mt-2 space-y-1">
              {MODULES.map((m) => <li key={m.slug}><a href={`/${m.slug}`} className="text-[#334155] hover:underline">{m.name}</a></li>)}
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#64748b]">Sphere Design Hub</p>
            <ul className="mt-2 space-y-1">
              <li><a href="/methodology" className="text-[#334155] hover:underline">Methodology</a></li>
              <li><a href={LOGIN_URL} className="text-[#334155] hover:underline">Log in</a></li>
              <li><a href={SIGNUP_URL} className="text-[#334155] hover:underline">Create an account</a></li>
            </ul>
          </div>
        </div>
        <p className="mx-auto max-w-6xl px-4 pb-6 text-xs text-[#64748b]">{DISCLAIMER} Last updated {LAST_UPDATED}.</p>
      </footer>
    </div>
  );
}

function List({ items }) {
  return <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[15px] leading-relaxed text-[#334155]">{items.map((t) => <li key={t}>{t}</li>)}</ul>;
}

function Section({ title, children }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold text-[#0F172A]">{title}</h2>
      {children}
    </section>
  );
}

function LoginCta({ name }) {
  return (
    <section className="mt-10 rounded-xl border border-[#cbd5e1] bg-[#f8fafc] p-6">
      <h2 className="text-lg font-semibold">Use the {name.toLowerCase()} calculator</h2>
      <p className="mt-1 text-sm text-[#475569]">The calculators need an account. Your designs, reports and projects are kept in your account.</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <a href={LOGIN_URL} className="rounded-md px-4 py-2 text-sm font-medium text-white" style={{ background: NAVY }}>Log in to use this calculator</a>
        <a href={SIGNUP_URL} className="rounded-md border border-[#0A2F44] px-4 py-2 text-sm font-medium text-[#0A2F44]">Create an account</a>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ home */
export function HomePage() {
  return (
    <Layout>
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{PRODUCT}: Eurocode 2 structural design tool</h1>
      <p className="mt-4 max-w-3xl text-lg leading-relaxed text-[#334155]">{DEFINITION}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <a href={LOGIN_URL} className="rounded-md px-4 py-2 text-sm font-medium text-white" style={{ background: NAVY }}>Log in</a>
        <a href={SIGNUP_URL} className="rounded-md border border-[#0A2F44] px-4 py-2 text-sm font-medium text-[#0A2F44]">Create an account</a>
      </div>

      <Section title="What every design includes">
        <List items={[
          "A calculation report in numbered sections, each step with its EN 1992-1-1 (Eurocode 2) clause reference.",
          "A pass or fail for every check and the utilisation of each, with the governing check named.",
          "Reinforcement drawings and a bar schedule with shape codes, cut lengths and weights.",
          "A PDF of the full report with a cover page naming the designer and checker.",
          "Designs saved to projects, with a checked / issued status for each calculation.",
        ]} />
      </Section>

      <section id="calculators" className="mt-10">
        <h2 className="text-lg font-semibold">Calculators</h2>
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MODULES.map((m) => (
            <li key={m.slug} className="rounded-xl border border-[#e2e8f0] p-5 shadow-sm">
              <h3 className="font-semibold"><a href={`/${m.slug}`} className={A}>{m.h1}</a></h3>
              <p className="mt-2 text-sm leading-relaxed text-[#475569]">{m.intro}</p>
            </li>
          ))}
        </ul>
      </section>

      <Section title="How the results are checked">
        <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-[#334155]">
          Each calculator states what it checks and what it leaves to the engineer. The checks and the simplifications are listed on
          every calculator page and in every report. Read <a href="/methodology" className={A}>how the calculations are verified</a>.
        </p>
      </Section>
    </Layout>
  );
}

/* ---------------------------------------------------------- calculators */
export function ModulePage({ slug }) {
  const m = moduleBySlug[slug];
  const el = elementByKey[m.element];
  return (
    <Layout crumbs={[["Calculators", "#calculators"], [m.name, null]]}>
      <article className="max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight">{m.h1}</h1>
        <p className="mt-4 text-lg leading-relaxed text-[#334155]">{m.intro}</p>
        <p className="mt-3 text-[15px] leading-relaxed text-[#475569]">{DEFINITION}</p>

        <Section title="What it checks"><List items={el.checks} /></Section>
        <Section title="What you enter"><List items={m.inputs} /></Section>
        <Section title="What you get"><List items={m.outputs} /></Section>
        <Section title="Limits and assumptions">
          <p className="mt-2 text-[15px] text-[#475569]">What this calculator does not check, or simplifies. Check these by hand where they matter.</p>
          <List items={el.limits} />
        </Section>

        <LoginCta name={m.name} />

        <Section title="Related calculators">
          <ul className="mt-3 space-y-1.5 text-[15px]">
            {m.related.map((s) => <li key={s}><a href={`/${s}`} className={A}>{moduleBySlug[s].h1}</a></li>)}
            <li><a href="/methodology" className={A}>How the calculations are verified</a></li>
          </ul>
        </Section>
        <p className="mt-8 text-xs text-[#64748b]">{DISCLAIMER}</p>
      </article>
    </Layout>
  );
}

/* ---------------------------------------------------------- methodology */
export function MethodologyPage() {
  return (
    <Layout crumbs={[["Methodology", null]]}>
      <article className="max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight">How Sphere Design Hub calculations are verified</h1>
        <p className="mt-4 text-lg leading-relaxed text-[#334155]">
          Every calculator in {PRODUCT} follows EN 1992-1-1 (Eurocode 2) and writes out each step of the design with its clause
          reference, so the engineer can check the working, not only the answer.
        </p>

        <Section title="How the engines are checked">
          <List items={[
            "Changes to a calculator are tested by sending real design requests to the running engine and comparing the results with independent hand calculations.",
            "Where a result can be worked out in closed form (for example wL²/8 for a simply supported span, or the three-moment equation for continuous spans) the engine's numbers are compared with it directly.",
            "Frame and continuous analyses are cross-checked with an independent solver.",
            "Results are also compared with published worked examples. Where the software deliberately differs from an example, the difference is recorded rather than hidden.",
          ]} />
        </Section>

        <Section title="What the reports tell you">
          <List items={[
            "The slab, beam, column and staircase reports list the nationally determined parameters the engine uses at the start of the report.",
            "Every check shows its demand, its resistance, the utilisation and the clause it comes from.",
            "Simplifications made by the engine are stated in the report and on the calculator pages, under limits and assumptions.",
          ]} />
        </Section>

        <Section title="Known simplifications">
          <p className="mt-2 text-[15px] text-[#475569]">Each calculator page lists its own limits. In summary:</p>
          <ul className="mt-3 space-y-4">
            {MODULES.filter((m, i, a) => a.findIndex((x) => x.element === m.element) === i).map((m) => (
              <li key={m.slug}>
                <h3 className="font-semibold"><a href={`/${m.slug}`} className={A}>{elementByKey[m.element].name}</a></h3>
                <List items={elementByKey[m.element].limits} />
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Responsibility">
          <p className="mt-3 text-[15px] leading-relaxed text-[#334155]">{DISCLAIMER}</p>
        </Section>
      </article>
    </Layout>
  );
}

/* ------------------------------------------------------------------- 404 */
export function NotFoundPage() {
  return (
    <Layout>
      <h1 className="text-3xl font-bold tracking-tight">Page not found</h1>
      <p className="mt-4 text-[15px] text-[#334155]">There is no page at this address.</p>
      <ul className="mt-4 space-y-1.5 text-[15px]">
        <li><a href="#calculators" className={A}>All calculators</a></li>
        <li><a href={LOGIN_URL} className={A}>Log in</a></li>
      </ul>
    </Layout>
  );
}

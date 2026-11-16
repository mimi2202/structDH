// Prints a saved design's Overview report (the full numbered document with
// its drawings and charts, exactly as its results page downloads it) from
// another page: the results page is rendered off screen with the saved state
// through <Routes location>, and its own download button ([data-pdf-download])
// is pressed once it has drawn. onDone runs after the print dialog closes.
// The route context is reset to the root: a nested <Routes> may otherwise only
// take locations under the parent route (/reports).
import React, { useEffect, useRef } from "react";
import { Routes, Route, UNSAFE_RouteContext as RouteContext } from "react-router-dom";
import StructuralResults from "../StructuralResults";
import ContinuousSlabResults from "../ContinuousSlabResults";
import BeamResults from "../BeamResults";
import ContinuousBeamResults from "../ContinuousBeamResults";
import ColumnResults from "../ColumnResults";
import FoundationResults from "../FoundationResults";
import StaircaseResults from "../StaircaseResults";
import { designRoute, designState } from "../../utils/savedDesigns";

const PAGES = {
  "/slab-results": StructuralResults,
  "/continuous-slab-results": ContinuousSlabResults,
  "/beam-results": BeamResults,
  "/continuous-beam-results": ContinuousBeamResults,
  "/column-results": ColumnResults,
  "/foundation-results": FoundationResults,
  "/staircase-results": StaircaseResults,
};

const ROOT_ROUTE = { outlet: null, matches: [], isDataRoute: false };

export default function DesignPdfHost({ design, onDone }) {
  const box = useRef(null);
  const route = designRoute(design, design.element);
  const Page = PAGES[route];
  // the latest onDone, without restarting the print sequence when the parent re-renders
  const doneRef = useRef(onDone);
  useEffect(() => { doneRef.current = onDone; }, [onDone]);

  useEffect(() => {
    if (!Page) { doneRef.current?.("This design cannot be printed from here."); return undefined; }
    let finished = false;
    const done = (msg) => { if (!finished) { finished = true; doneRef.current?.(msg); } };
    let clickTimer = null;
    const poll = setInterval(() => {
      const btn = box.current?.querySelector("[data-pdf-download]");
      if (!btn) return;
      clearInterval(poll);
      // give diagrams and charts a moment to draw, then download as the page would
      clickTimer = setTimeout(() => btn.click(), 1200);
    }, 200);
    const afterPrint = () => setTimeout(() => done(), 300);
    window.addEventListener("afterprint", afterPrint);
    const giveUp = setTimeout(() => done(), 20000);
    return () => {
      clearInterval(poll); clearTimeout(clickTimer); clearTimeout(giveUp);
      window.removeEventListener("afterprint", afterPrint);
    };
  }, [Page]);

  if (!Page) return null;
  const location = { pathname: route, search: "", hash: "", state: designState(design), key: `pdf-${design.element}-${design.id}` };
  return (
    <div ref={box} aria-hidden className="pointer-events-none fixed -left-[12000px] top-0 w-[1280px]" data-pdf-host>
      <RouteContext.Provider value={ROOT_ROUTE}>
        <Routes location={location}>
          <Route path={route} element={<Page />} />
        </Routes>
      </RouteContext.Provider>
    </div>
  );
}

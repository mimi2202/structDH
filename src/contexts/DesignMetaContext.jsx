// src/contexts/DesignMetaContext.jsx
//
// MainLayout's top "context strip" (Design Code / Analysis / Concrete /
// Steel) needs to reflect whatever design is actually loaded on the current
// results page. The router applies MainLayout centrally (see App.jsx) and
// only ever passes `currentModule`/`breadcrumb` -- it has no way to know
// which design a given page will load, since that only exists inside each
// results page's own state after its API response comes back. A shared
// context is the right bridge for that, same pattern as ThemeContext /
// AuthContext / WorkspaceContext already used in this app.
//
// Usage in a results page, once its design data has loaded:
//   const { setDesignMeta } = useDesignMeta();
//   useEffect(() => {
//     if (!data) return;
//     setDesignMeta({
//       designCode: data.summary.design_code,
//       analysisMethod: data.summary.analysis,
//       concreteGrade: data.summary.concrete_grade,
//       steelGrade: data.summary.steel_grade,
//     });
//     return () => setDesignMeta(null); // reset when leaving the page
//   }, [data]);
import React, { createContext, useContext, useState, useCallback } from "react";

const DEFAULT_META = {
  designCode: "EC2",
  analysisMethod: "Limit State",
  concreteGrade: "C30/37",
  steelGrade: "B500",
};

const DesignMetaContext = createContext({
  designMeta: DEFAULT_META,
  setDesignMeta: () => {},
});

export function DesignMetaProvider({ children }) {
  const [designMeta, setDesignMetaState] = useState(DEFAULT_META);

  // Accepts either a full/partial meta object or null to reset to defaults
  // (e.g. when navigating away from a results page back to a plain input
  // page that has no specific design loaded).
  const setDesignMeta = useCallback((meta) => {
    setDesignMetaState(meta ? { ...DEFAULT_META, ...meta } : DEFAULT_META);
  }, []);

  return (
    <DesignMetaContext.Provider value={{ designMeta, setDesignMeta }}>
      {children}
    </DesignMetaContext.Provider>
  );
}

export function useDesignMeta() {
  return useContext(DesignMetaContext);
}
// src/utils/appSettings.js
// App-wide preferences set on the Settings page, kept in this browser's
// localStorage. Input pages read them when a form is first opened or reset:
//   - designer / checker (and qualifications) fill those fields when blank;
//   - the default concrete and steel grade replace the page's own default on
//     a fresh form only (a draft in progress keeps its grades).
// The company name is printed at the top of every PDF cover page.

const KEY = "app_settings";

export const SETTINGS_DEFAULTS = {
  company: "",
  designerName: "", designerQualifications: "",
  checkedBy: "", checkerQualifications: "",
  concreteGrade: "",      // "" = each page's own default
  steelGrade: "",         // "" = each page's own default
};

// grades every element's input page offers
export const COMMON_CONCRETE = ["C25/30", "C30/37", "C35/45"];
export const COMMON_STEEL = ["B500", "B460"];

export function getSettings() {
  try {
    return { ...SETTINGS_DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || "{}") };
  } catch {
    return { ...SETTINGS_DEFAULTS };
  }
}

export function saveSettings(settings) {
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* storage disabled */ }
}

const IDENTITY = ["designerName", "designerQualifications", "checkedBy", "checkerQualifications"];
const SNAKE = {
  designerName: "designer_name", designerQualifications: "designer_qualifications",
  checkedBy: "checked_by", checkerQualifications: "checker_qualifications",
};

/**
 * form   the page's form object (defaults, or defaults merged with a draft)
 * opts   keys: "camel" | "snake"   how the page names the designer fields
 *        concrete, steel           the page's grade field names (optional)
 *        steelNumeric              the steel field holds "460", not "B460"
 *        fresh                     true for a new or reset form (grades applied)
 */
export function applySettings(form, { keys = "snake", concrete, steel, steelNumeric = false, fresh = false } = {}) {
  const s = getSettings();
  const out = { ...form };
  for (const k of IDENTITY) {
    const field = keys === "camel" ? k : SNAKE[k];
    if (field in out && !String(out[field] || "").trim() && s[k]) out[field] = s[k];
  }
  if (fresh) {
    if (concrete && s.concreteGrade) out[concrete] = s.concreteGrade;
    if (steel && s.steelGrade) out[steel] = steelNumeric ? s.steelGrade.replace(/\D/g, "") : s.steelGrade;
  }
  return out;
}

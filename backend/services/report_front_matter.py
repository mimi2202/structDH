# backend/services/report_front_matter.py
#
# The three sections the column report opens with -- REPORT IDENTIFICATION,
# 0. DESIGN BASIS AND SCOPE, 0b. NATIONALLY DETERMINED PARAMETERS USED --
# built here for the slab and beam reports so every element's calculation
# package starts the same way. Layout and wording follow column_engine.py
# (_identification_section, _design_basis_section, _ndp_section); the
# element-specific facts (method, loading, scope, verification record, the
# parameter values the engine actually uses) are passed in by each service,
# so nothing here claims a check or a verification an element does not have.
from datetime import datetime, timezone
import re

try:
    from engine.column_engine import PRODUCT_NAME, REPORT_TITLE, SOFTWARE_VERSION, CALC_ID_PREFIX, _build_id
except ImportError:
    from column_engine import PRODUCT_NAME, REPORT_TITLE, SOFTWARE_VERSION, CALC_ID_PREFIX, _build_id


def row(reference, calculation, output=""):
    return {"reference": reference, "calculation": calculation, "output": output}


def section(title, rows):
    return {"title": title, "rows": rows}


def make_meta(member):
    """Same identity block as the column report: the calculation ID is the UTC
    time of the run, so it says when the numbers were produced, not which inputs."""
    now = datetime.now(timezone.utc)
    slug = re.sub(r"[^A-Za-z0-9_-]+", "-", (member or "").strip()).strip("-") or "X"
    return {
        "product": PRODUCT_NAME,
        "title": REPORT_TITLE,
        "software_version": SOFTWARE_VERSION,
        "build": _build_id() or "not recorded",
        "calculation_id": f"{CALC_ID_PREFIX}-{slug}-{now:%Y%m%d-%H%M%S}",
        "generated_utc": f"{now.day} {now:%B %Y}, {now:%H:%M} UTC",
    }


def _person(name, quals, label):
    if not name and not quals:
        return f"{label}: not entered"
    if name and quals:
        return f"{name}, {quals}"
    return name or f"Qualifications: {quals}"


def front_matter(*, member, member_label, design, design_tag, checks, design_basis,
                 module, used_for, basis_of_design, load_path, loading, not_assessed,
                 verification, ndp_rows):
    """
    checks: [(name, ratio or None, "PASS"/"FAIL")] -- the software's own checks
      as listed in the report; ratio None where no single ratio applies.
    design_basis: the request's SlabDesignBasis / BeamDesignBasis (attribute access).
    verification: [(reference, text, output)] -- only what is actually on record.
    ndp_rows: element-specific rows for section 0b; the opening "Basis" row and
      the closing "Check before submission" row are added here.
    Returns [identification, 0, 0b] as plain {"title", "rows"} dicts.
    """
    meta = make_meta(member)
    db = design_basis
    choice = getattr(db, "independent_check", None)

    def box(v):
        return "[X]" if choice == v else "[ ]"

    failed = [n for n, _, s in checks if s != "PASS"]
    rated = [(n, r) for n, r, _ in checks if r is not None]
    if rated:
        gov_name, gov_ratio = max(rated, key=lambda x: x[1])
        util = row("Governing utilisation",
                   f"{gov_ratio:.3f} for {gov_name}. The highest ratio among the software's own "
                   "checks (design action over resistance; for deflection, actual over allowable "
                   "span/depth). Items listed as not assessed in section 0 are not in this figure.",
                   "software check")
    else:
        util = row("Governing utilisation", "no ratio available", "software check")

    identification = section("REPORT IDENTIFICATION", [
        row("Product", meta["product"], meta["title"]),
        row("Software version", f"{meta['software_version']}, build {meta['build']}", "version"),
        row("Calculation ID", meta["calculation_id"], "run identifier"),
        row("Generated", meta["generated_utc"], "UTC"),
        row("Standard", "BS EN 1992-1-1 with the UK National Annex as the intended basis. "
                        "See section 0b.", "EC2, UK NA"),
        row("Member", member_label, "member"),
        row("Design", design, design_tag),
        util,
        row("Status",
            ("All software checks satisfied. This is the software's own checks only; scope "
             "and open points are in section 0."
             if not failed else
             f"{len(failed)} check(s) failed: {', '.join(failed)}."),
            "PASS" if not failed else "FAIL"),
        row("Independent check",
            f"{box('required')} Required     {box('completed')} Completed"
            + ("" if choice else "     (not stated)"),
            "designer to state"),
    ])

    designer = (getattr(db, "designer_name", None) or "").strip()
    dq = (getattr(db, "designer_qualifications", None) or "").strip()
    checker = (getattr(db, "checked_by", None) or "").strip()
    cq = (getattr(db, "checker_qualifications", None) or "").strip()
    stab = (getattr(db, "stability_responsible", None) or "").strip()

    basis = section("0. DESIGN BASIS AND SCOPE", [
        row("Design standard",
            "BS EN 1992-1-1 (Eurocode 2). The UK National Annex is the intended basis. "
            "Section 0b lists each parameter and where its value comes from.",
            "EC2, UK NA"),
        row("Software",
            f"{PRODUCT_NAME}, {module} module, version {SOFTWARE_VERSION}, build "
            f"{meta['build']}. Used for: {used_for}",
            SOFTWARE_VERSION),
        row("Basis of design", basis_of_design, "ultimate limit state"),
        row("Load path and stability", load_path, "assumption"),
        row("Loading", loading, "limitation"),
        row("Not assessed by this tool", not_assessed, "outside scope"),
        row("Designer", _person(designer, dq, "Name"), "as entered" if (designer or dq) else "blank"),
        row("Checked by", _person(checker, cq, "Name"), "as entered" if (checker or cq) else "blank"),
        row("Responsible for stability", stab if stab else "Organisation or individual: not entered",
            "as entered" if stab else "blank"),
    ] + [row(r, t, o) for r, t, o in verification] + [
        row("Designer's confirmation",
            "That the application and limitations of this software are understood and that "
            "its results have been verified independently is a statement for the designer to "
            "make. The software does not make it.",
            "designer to confirm"),
    ])

    ndp = section("0b. NATIONALLY DETERMINED PARAMETERS USED", [
        row("Basis",
            "BS EN 1992-1-1 with the UK National Annex (BS NA EN 1992-1-1) as the intended "
            "basis. For each parameter: the clause, the value this run used, and where the "
            "value comes from.",
            "UK NA intended"),
    ] + ndp_rows + [
        row("Check before submission",
            "The software does not compare any of these values with the UK National Annex "
            "document. Confirm the cover requirement above and every row not marked "
            "'UK NA checked' against your copy of BS NA EN 1992-1-1.",
            "engineer to confirm"),
    ])
    return [identification, basis, ndp]


# ---------- 0b rows shared by the slab and beam engines ----------
# Every one of these engines hard-codes the values below (none are inputs), so
# the source is "fixed in software". The UK NA values quoted are the same ones
# the column report quotes.

def ndp_partial_factors():
    return [
        row("EN 1992-1-1 Cl. 2.4.2.4",
            "gamma_c = 1.5, gamma_s = 1.15. UK NA: 1.5 and 1.15.", "fixed in software"),
        row("EN 1990",
            "gamma_G = 1.35, gamma_Q = 1.5, Eq. 6.10. Recommended values; the UK NA to EN 1990 "
            "was not checked here.", "fixed in software"),
    ]


def ndp_alpha_cc_k_method(extra=""):
    return row("EN 1992-1-1 Cl. 3.1.6(1)P",
               "alpha_cc = 0.85 for flexure: the K-method used (K' = 0.167, "
               "z = d[0.5 + sqrt(0.25 - K/1.134)], A_s = M/(0.87 f_yk z)) has it built in, "
               "1.134 = 2 x 0.85/1.5. UK NA: 0.85. CEN recommended: 1.0." + extra,
               "fixed in software")


def ndp_cover_rows(c_min_dur_text, dev_mm=5.0, entered=True):
    """Cover as the slab/beam engines apply it: c_nom = clear cover entered + 5 mm,
    or (two-way slab with no cover entered) c_nom = c_min + delta_c_dev."""
    how = "clear cover entered + " if entered else "c_min + "
    return [
        row("EN 1992-1-1 Cl. 4.4.1.3",
            f"c_nom = {how}{dev_mm:.0f} mm, so delta_c_dev = {dev_mm:.0f} mm, fixed. The "
            "recommended value is 10 mm; Cl. 4.4.1.3(3) allows down to 5 mm only where a "
            "quality assurance system includes measurement of cover. The UK NA value was not "
            "checked here.",
            "fixed in software"),
        row("EN 1992-1-1 Cl. 4.4.1.2(5)", c_min_dur_text, "see text"),
        row("UK NA Table NA.2",
            "The UK NA gives cover by exposure class and concrete quality (50 year life, 20 mm "
            "aggregate) in place of Table 4.4N. That table is not implemented. Confirm c_nom "
            "against it for the concrete actually specified.",
            "engineer to check"),
    ]


def ndp_min_steel():
    return row("EN 1992-1-1 Cl. 9.2.1.1(1)",
               "A_s,min = max(0.26 f_ctm/f_yk b_t d, 0.0013 b_t d).", "EN text")


def ndp_shear_no_links():
    return row("EN 1992-1-1 Cl. 6.2.2(1)",
               "C_Rd,c = 0.18/gamma_c, k = 1 + sqrt(200/d) <= 2.0, v_min = 0.035 k^1.5 f_ck^0.5. "
               "Recommended values; the UK NA value was not checked here.",
               "EN text")


def ndp_deflection():
    return row("EN 1992-1-1 Cl. 7.4.2",
               "Span/effective depth by Eq. 7.16a/b with K from Table 7.4N, then the "
               "steel-stress factor taken as A_s,prov/A_s,req <= 1.5 (the 310/sigma_s form of "
               "Cl. 7.4.2(2)) only if the basic ratio fails. Recommended values; the UK NA value "
               "was not checked here.",
               "EN text")

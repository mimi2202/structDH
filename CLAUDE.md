# StructAI: notes for Claude

FastAPI backend (`backend/`, run with `python -m uvicorn server:app --port <port>` from `backend/`) and a React/Vite frontend (`src/`). EC2-only structural design tool.

## How this user wants work done
- Make small, targeted edits, never full-file rewrites. Show `git diff` for each file.
- Check every change with **real requests to a running backend**. Ideally go through the real `src/services/api.js`: bundle it with esbuild, with `--define:import.meta.env.VITE_API_BASE='"http://localhost:<port>"'`, and call it from Node.
- Check the numbers against a **hand calculation** (wL²/8, three-moment equation, …). A past bug mixed up N/mm and kN/m and made moments 1e6 too large.
- Be suspicious of earlier uncommitted edits. Some turned out to be wholesale rewrites that broke things (`beam_schemas.py`, `ContinuousSlabInput.jsx`). Read the diff before trusting them.
- Windows: `uvicorn --reload` can hang silently and keep serving stale code, or leave an orphaned port. Restart by hand on a fresh port after backend edits.

## Status as of 2026-10-02 (nothing committed yet)

### Done and tested
- **Design Basis feature** (designer, checker, stability, independent check, printed in the report; blank fields print "not entered"):
  - Beam: `BeamDesignBasis` in `backend/models/beam_schemas.py`. The file was restored from HEAD; the broken rewrite is backed up in the session scratchpad. `design_basis` is also wired into `continuous_beam_schemas.py`. Rows are appended to "1. Design Basis and References" by `_design_basis_rows()` in `beam_service.py`; `continuous_beam_service.py` imports it.
  - `src/pages/BeamInput.jsx` has a `DesignBasisSection` card in both simple and continuous modes; `buildContinuousPayload()` sends `design_basis`.
  - `api.js` has `design_basis` mappings for slab, beam, continuous beam and continuous slab. Comments deleted by an earlier edit were restored from HEAD.
  - Slab pages (`StructuralInput.jsx`, `ContinuousSlabInput.jsx`) verified working.
- **EC2 only**: both beam request models reject BS8110 and ACI318 (`model_validator`). BeamInput's dropdown is EC2 only, with defaults EC2/C25/30/B500.
- **App.jsx**: removed the duplicate `/continuous-beam` route. `/continuous-beam` renders `BeamInput` in continuous mode. `ContinuousBeamInput.jsx` and `components/beam/ContinuousBeamForm.jsx` are now unused but kept; the user does not want them deleted.
- **ContinuousSlabInput.jsx**: the page sends `{...form, spanLengths: form.spans}` (previously it sent empty spans and every request got a 422). Added the **Occupancy** dropdown (fills in the live load; "Custom" is the default) and **Region** (cost rates only).
- **Continuous-slab engine** (`backend/engine/continuous_one_way_slab_engine.py`):
  - Pattern loading: unloaded spans now carry 1.35Gk (EC2 5.1.3) instead of 0.
  - Shear is enveloped on its own (new `SupportResult.shear_pattern`). This fixes "End support shear = 0".
  - Verified: 3×4 m, h = 200 gives hogging 21.36, sagging 17.60, V 30.54/21.06, matching hand calculations; the unequal-span case was checked with an independent solver.

### Done 2026-10-03: durability, fire and crack checks for continuous slab
- `backend/services/continuous_slab_service.py` adds `_durability_fire_crack()`:
  - Cover for exposure: EC2 4.4.1, using `EXPOSURE_MIN_DUR_MM` from the two-way engine, Δc_dev = 5.
  - Fire: EN 1992-1-2 Table 5.8, checking h_s and axis distance a = c_nom + φ/2.
  - Crack control: EC2 7.3.3 / Table 7.3N spacing, with σs = M·qp/(z·As,prov). Uses ψ2 from occupancy; occupancy not stated → 0.6. Exemption 7.3.3(1) applies when h ≤ 200 and the limit equals the Table 7.1N value. w_lim = min(user limit, Table 7.1N value).
  - New report section "10b. Durability, Fire and Crack Control"; the checks are added to compliance and to the overall status.
  - Wired through: `occupancy` on `ContinuousSlabRequest`; `api.js` sends `occupancy || null` and keeps fire_rating 0 (was `|| 60`); page has Exposure / Fire (REI, 0 = not checked) / Crack-width dropdowns.
  - Fixed while testing: pinned end supports (M ~1e-15) were listed as crack locations (now `M_hog > 0.01`); shear section 10 "Main term"/"Governing" rows, dropped by an earlier edit, restored.
  - Verified via bundled api.js on a fresh port, all hand-checked: 3×4 m h=175 XC3 cover 25 → cover FAIL; REI 60 pass; REI 240 a=40<65 FAIL; h≤200 exemption; h=220 office ψ2=0.3 → σs 227 MPa, s_max 217 < 250 FAIL; w=0.2 column interpolation; fire 0 → not checked.
  - Simplifications (documented, not changed): σs uses the ULS lever arm z (≤0.95d), ~3% lower than elastic cracked z; c_min,dur table (20/25/30/35) is above EC2 Table 4.4N S4.

### Done 2026-10-03: design progress bar on all element pages
- New `src/components/ui/DesignProgressBar.jsx` (same look and 20% → 45% steps as the slab page's inline bar, and it scrolls itself into view). Used as `<DesignProgressBar active={busy} />` after the error banner in BeamInput (simple and continuous), ColumnInput, ContinuousSlabInput, FoundationInput.
- Verified in headless Chrome (playwright-core + installed Chrome, mock auth through localStorage `auth_user`/`auth_token`, POSTs delayed 2.5 s): bar appears on each page, in view, and every page reaches its results page.
- The slab page (`StructuralInput.jsx`) now uses the same component (its inline bar and `progress` state removed); verified in view in the browser.

### Done 2026-10-03: column-style front matter on slab and beam reports
- New `backend/services/report_front_matter.py` builds REPORT IDENTIFICATION, 0. DESIGN BASIS AND SCOPE and 0b. NATIONALLY DETERMINED PARAMETERS USED in the column report's layout (reuses PRODUCT_NAME / SOFTWARE_VERSION / _build_id from `column_engine.py`). Each service passes its own facts: `_slab_front_matter` (one-way and two-way, `slab_service.py`), `_front_matter` in `continuous_slab_service.py`, `beam_service.py` and `continuous_beam_service.py`.
- Designer / checker / stability / independent-check rows moved out of "1. Design Basis and References" (and continuous slab's old "0. Design Basis") into section 0, as in the column report. The old `_design_basis_rows` helpers in those files are gone (foundation_service still has its own).
- Rows state only what each engine does. Facts behind them: every engine uses the K-method (alpha_cc 0.85 built in), except two-way (z = 0.9d); cover = clear cover + 5 mm (delta_c_dev 5 vs recommended 10); only the continuous slab (and the two-way slab when no cover is entered) checks cover against exposure; the continuous beam has NO pattern loading and its crack width is hard-coded 0.00/PASS; the simple beam does not check V_Rd,max or rho_w,min.
- Verified with real requests through the UI (headless Chrome) and api.js for all five reports; governing utilisation cross-checked against each report's checks (beam: wL^2/8 = 133.7, MEd/MRd = 0.923).
- Foundation reports do not have the front matter yet.

### Done 2026-10-03: continuous beam deflection, dead slab fallback removed, foundation tested
- `beam_cont_engine.py` deflection: every span checked with its own K (1.0 single / 1.3 end / 1.5 interior) and A_s,req, governing = highest actual/allowable; F1 = 0.8 where b_eff/b_w > 3 (EC2 7.4.2(2)); allowable capped at 40K (Concrete Centre limit the engine used before Eq. 7.16); Eq. 7.16b fixed to K[11 + 1.5 sqrt(fck) rho0/rho] (was missing rho0/rho: unconservative). F2 = 7/l_eff not applied (reported). Verified on 4 real requests, all spans match hand calc; a shallow 2x7 m case now correctly FAILS (19.89 > 17.76).
- `ContinuousBeamResults.jsx`: L/d ratios were labelled as mm (card 6, SLS table, summary, diagram); relabelled with per-span L/d. 13 JSX attributes like label="ρ..." rendered literally; now label={"..."}.
- `slab_service.py`: unreachable non-EC2 fallback deleted (calculate_slab_design legacy body, _build_slab_report, BS8110_TABLE, _interp; 333 lines). Now raises RuntimeError if neither engine applies. Docstring in schemas.py updated.
- Foundation (user's new pad_foundation_engine.py): 5 real-request cases, all 15 outputs per case match an independent hand calc. Method problems found, NOT fixed (await user):
  - Punching: relief area (cx+4d)(cy+4d) at qmax; when the 2d perimeter is outside the footing (4 of 5 cases, incl. the UI default) V_Ed clamps to 0. Case 3.5 m pad: engine OK, EC2 6.4.4 search (a <= 2d, relief at q0, vRd x 2d/a) gives ratio 1.10.
  - fctm = 2.6 if fck <= 25 else 2.9: As,min 17% low at C40.
  - Same N used for bearing (SLS) and ULS design; footing self-weight not in bearing; rho_l = 0.002 fixed in shear.
  - verify_pad_foundation.py cited in the docstring does not exist. Combined-footing backend route removed but /combined-input page and api.js still call it (404).

### Done 2026-10-05: Eq. 7.16 fixed in the remaining engines
- `beam_ss_engine.py`, `continuous_one_way_slab_engine.py`: branch B now K[11 + 1.5 sqrt(fck) rho0/rho] (was missing rho0/rho: unconservative). `two_way_slab_engine.py`: branch A now has the 3.2 sqrt(fck)(rho0/rho - 1)^1.5 term, branch B has rho0/rho. Report formula text updated (beam, continuous slab, two-way rows in `slab_service.py`; the two-way report marks the unused branch "not used").
- Verified via bundled api.js on a fresh port, all hand-checked: beam 7 m 300x450 C25 rho 0.01002 -> 14.74 (was 18.50; now FAILS 17.41 > 15.33 with F3); beam default 17.85; cont. slab 2x4.5 h125 K 1.3 -> 22.50; two-way 6x7 h130 C25 -> 24.38 (was 27.75); two-way 6x7 h150 branch A 30.55.
- Not changed: no upper cap on branch A in the slab engines, so very lightly reinforced slabs print large limits (two-way default 295; continuous beam caps at 40K). All engines now use Eq. 7.16 the same way.

### Done 2026-10-05: known-issues list cleared
- BeamInput: `ec2Draft()` resets a stale BS8110 draft (code + M25/Fe500 grades) to EC2 defaults for both simple and continuous drafts. Verified in headless Chrome with a planted BS8110 draft: POST goes out EC2/C25/30/B500, HTTP 200, results page reached.
- Looked at the new cards in a running browser: Design Basis on /beam and /continuous-beam (section 5, numbering OK, "Designed by" reaches `design_basis`), continuous slab Region/Exposure/Fire/Crack/Occupancy (Office fills live load 2.5).
- `__pycache__/*.pyc` untracked with `git rm --cached` (11 files, staged as deletions; files stay on disk; .gitignore already covers them).
- Lint: `StepBtn` uses `const Icon = icon` (the rule ignores capitalised vars, not destructured args).

### Done 2026-10-05: combined footing method fixed (`combined_footing_engine.py`)
- Shear: V from the shear diagram at d from each face of each column, both sides, rho_l from the steel in the tension face (was: end cantilevers only, from column centre, rho 0.002).
- Longitudinal: separate bottom (max sagging) and top (max hogging) steel; column My are point moments in the diagram (M(L) = 0 now); steel compared per metre (As over full width B was compared with per-metre As,prov); K > 0.167 -> NOT OK; fctm EC2 Table 3.1.
- Punching: EC2 6.4.4(2) per column, a <= 2d search, relief at q under that column, vRd,c x 2d/a, beta Eq. 6.51 (both directions added); perimeter must fit on the footing, else "not applicable" (one-way shear governs); vRd,max = 0.5 nu fck/gamma_c at column face (UK NA). d_eff = (d_long + d_trans)/2, rho = sqrt(rho_long rho_trans).
- Bearing on SLS: optional `service_axial_kN` per column (blank -> ULS used) + footing self-weight; SLS moments = ULS x P_sls/P_uls.
- Response: `soil_pressure` is now SLS; new `soil_pressure_uls`, `sls_from_uls`, `longitudinal_bottom`/`longitudinal_top` (replace `longitudinal`), shear `sections[]`, punching `columns[]`. Report sections 2, 6, 8, 10a/10b, 13, 14, 15 rewritten.
- UI: FoundationInput Combined gets SLS load columns (defaults 360/250); switching to Combined (or `?type=combined`) lengthens the footing to 2 x projection + spacing (defaults now 5000 mm, was a 422). /combined-input and /combined-results redirect to /foundation-input?type=combined; their imports removed from App.jsx, files kept (written for an older 3-column API). FoundationResults combined view shows top/bottom steel, every shear section, both columns' punching.
- Verified: 5 cases via real requests, all outputs match an independent hand calc (numerical integration of the soil reaction, own punching search); UI paths in headless Chrome all reach results; pad cases unchanged. 5.6x2.0 h500 900+1200 now FAILS shear (554 > 407 kN; was 251 PASS).
- Not done: no option to add top steel to pass shear (engine picks minimal steel, e.g. case h700 fails by 0.4% with T20@200 top); transverse moment uses qmax over the full length.

### Done 2026-10-20: pad footing shear and punching (`pad_foundation_engine.py`)
- One-way shear: rho_l = As,prov/(b d) per direction (was 0.002); fctm EC2 Table 3.1 (imported `_fctm` from the combined engine).
- Punching: EC2 6.4.4(2) search a <= 2d and a <= smaller projection, relief at ULS q0 = N/A, vRd = vRd,c 2d/a, beta Eq. 6.51 both directions, d = (dx+dy)/2, rho = sqrt(rho_x rho_y); no perimeter fits -> "not applicable"; vRd,max at u0. punching_pct = max(ratio, face ratio). PunchingOut gets applicable/a_mm/u_m/beta/VEd_red_kN/vRd_MPa/v0_MPa/vRdmax_MPa; report section 11 rewritten; results page shows a, vRd and the face check.
- Verified: 6 cases via bundled api.js vs independent script (scratchpad handcalc_pad.py), all shear and punching values match. User's 1500 h400 230x450 1250 kN: punching was 0%, now 82.8%; shear X 117% (real; 2300 h500 passes at 84.5%).
- Still: shear VEd uses qmax over the whole projection (conservative); engine never adds steel to pass shear.

### Done 2026-10-20: pad footing bearing on SLS, input draft, shape check, DA help
- `pad_foundation_engine.py`: bearing/uplift on service loads + footing self-weight (25 kN/m3), as in the combined engine; no service axial -> ULS used. Structural design unchanged (ULS net pressure). Request gets `service_axial_kN`, `service_moment_x/y_kNm`; response `soil_pressure` is now SLS, plus `soil_pressure_uls`, `sls_from_uls`, `footing_weight_kN`, `sls_total_load_kN`. Report section 5 rewritten. The old ULS-vs-allowable check failed even the page defaults (204 > 200).
- FoundationInput: sends the Service row; sessionStorage draft (`foundationInputDraft`, Reset clears); Square/Rectangular warning, auto-corrected on design; explanation box for each EN 1997-1 design approach (DA is display-only).
- Verified: 4 pad cases via bundled api.js match hand calc (e.g. 2.2 m pad SLS 900 -> qmax 200.20, 2.3 m -> 184.16); UI in headless Chrome.

### Done 2026-10-20: pad column shape, offset, fixity
- Circular (`column_shape`, column_x_mm = D): punching u = pi(D+2a), beta = 1 + 0.6 pi (|ex|+|ey|)/(D+2a) (Eq. 6.53 at 2d); bending/one-way shear at the equal-area square face 0.886D.
- `column_offset_x/y_mm` (replaces the display-only Eccentricity): footing moments Mx = Mx,col + N oy, My = My,col + N ox (ULS and SLS, W_f at centre); larger overhang designed; punching relief = ULS pressure under the column centre, perimeter limited by the shorter overhang. Location Edge/Corner on the page sets the offset so the column is flush (then punching "not applicable": truncated perimeters of Fig. 6.15 NOT modelled). Validator rejects offsets that put the column outside.
- `column_fixity` "pinned" drops the column moments (bearing, design, beta).
- Combined mode hides Column Shape (combined engine is rectangular only).
- Verified: 6 cases via bundled api.js vs independent script (scratchpad handcalc_pad2.py), all match; UI in headless Chrome.

### Done 2026-10-20: results tabs + cover page on every element's PDF
- `src/utils/reportCover.js` `buildCoverHtml()`: cover page (element, member, project, which tab, what it holds, key facts, PASS/FAIL, designer / checker / stability / independent check read from the report rows -- both row shapes -- "Not entered" when blank, calc ID + date). `exportElementToPdf(el, name, cover)` prepends it (print CSS `.pdf-cover`, page break after).
- `src/components/ReportSections.jsx`: report sections filtered by title regex, shown inside a tab (dr-row/dr-section print classes).
- New tabs: ContinuousSlabResults (Overview / Flexural Design / Shear Design / Deflection & Durability; Download used window.print() of the whole page), FoundationResults pad + combined (Overview / Bearing / Flexural Design / Shear & Punching). Each in-depth tab = its panels + the matching report trace.
- Cover wired on beam, continuous beam, slab (dead "Export Excel" button -> Download Report), continuous slab, column, pad, combined. Download prints the active tab only.
- BeamResults: 34 JSX attributes + the BMD label printed literal "·" etc.; now `={"..."}`. Same for one placeholder in ColumnInput.
- Verified in headless Chrome: all 7 element pages x every tab -> cover present, right section, designer name from the input ("Not entered" when blank); PDF render: page 1 cover, page 2+ the tab.
- Slab results buttons wired (were dead): Save / Save Results -> `utils/savedDesigns.js` (localStorage `saved_designs_slab`, newest first, max 20, drops oldest on quota); Open -> modal list with open/delete (opening replaces location.state); Export Results -> `utils/exportCsv.js` CSV with BOM (summary, forces, reinforcement flattened, checks, warnings, calc trace); the dead "more" button is a menu of these. Verified in headless Chrome.
- Lint now clean on every file touched today (unused vars; TopBtn/OutlineBtn `const Icon = icon`; ColumnInput's step-clamp effect removed -- STEPS_AXIAL === STEPS_FULL so it could never fire; FoundationResults `allow` now draws the allowable-bearing plane on the 3D plot).

- PDF charts: `exportElementToPdf` is now async; `snapshotCharts()` replaces each Plotly chart in the print copy with a PNG from `Plotly.toImage` (Plotly loaded by dynamic import only when the page has one) and copies plain 2D canvases via toDataURL -- the innerHTML copy left WebGL canvases blank, so the footing 3D soil-pressure plot was missing from every PDF. Print sheet is hidden on screen while charts are captured. Plot camera pulled back (z-axis labels were clipped) and colorbar title fixed (Plotly 3 needs title.text). Verified: pad + combined Bearing-tab PDFs contain the chart image.

- PDF SVG diagrams: the print rule `#__print_sheet * { height: auto !important }` also hit SVG `<rect>` (height is a CSS geometry property in Chrome) and collapsed every rectangle: beam elevation/section, slab plan, column section, cont. beam sections all printed blank. Rule now `*:not(svg):not(svg *)`. Checked print renders of beam, cont. beam, slab, cont. slab, column (overview + interaction): no collapsed shapes. Also fixed the last literal unicode escapes in JSX text (BeamResults M_Ed/M_Rd "kN·m" x2, ColumnInput crank-note dash; scan script in scratchpad find_jsx_text_escapes.py) and the slab cover title "Two-Way Slab Slab".
- Utilisation bars print: they were never in the PDF (the height:auto print rule made the empty bar divs 0 tall, and backgrounds were forced transparent). Bar track + fill now carry `pdf-keep-color` (track also `pdf-bar-track`): exempt from the height and background rules, `print-color-adjust: exact` so they print with Chrome's "Background graphics" off, track forced #e2e8f0 so dark mode prints a pale track. Bars: slab `Gauge` (StructuralResults), column `UtilBar` (ColumnResults; biaxial, axial, moment). Verified by real PDFs (printBackground false, light + dark theme) rendered with PyMuPDF. New bars elsewhere need the same two classes.

### Done 2026-10-24: pad footing per Structville textbook Ch. 8 (`STRUCTVILLE TEXTBOOK_111532.pdf`, PDF p.205-225)
- `pad_foundation_engine.py`: design moment and one-way shear from the trapezoidal ULS pressure (M = q_f a^2/2 + (q_edge - q_f) a^2/3; V = (q_edge + q_d)/2 (a - d); mean across the width, both overhangs) instead of qmax over the projection. Soil on footing W_s = (A - column) h_s gamma_s in SLS bearing. `sls_factor`: service blank -> SLS = ULS / factor (book 1.36). `size_pad_foundation()`: A = N_sls/(q_allow - gamma_c h - gamma_s h_s), rounded up to 100 mm (L/B ratio kept), widened until eccentric SLS passes, trial depth +50 mm until all checks pass; report section "2b. Footing Sizing".
- Request: `sls_factor`, `soil_unit_weight_kN_m3`, `soil_depth_above_mm`, `auto_size` (rejected with an offset column). Response: `soil_weight_kN`, `auto_sized`. Page: "Size the footing for me" checkbox, ULS/SLS factor (default 1.36), sends unit weight of soil and depth below ground - h.
- Kept stricter than the book: no 2d/a enhancement on one-way shear at d (book doubles vRd,c), EC2 6.4.4 punching search.
- Verified via bundled api.js: book Group A M 37.528 (book 37.518), As 286.9, As,min 498.7, Y12@200; Group C M 12.725 (12.724); Group B 21.066 vs book 20.303 = book arithmetic slip (2nd term 1.451, book prints 0.688). Auto-size cases hand-checked (1.6 m fails SLS 152.7 > 150 -> 1.7 m; 1200 kN -> 2300 x 2300, h 250 -> 450). UI in headless Chrome: default form + auto-size + blank service -> 1900 x 1900, N 640.07 matches hand calc.
- Combined footing (8.5.4), same day: `combined_footing_engine.py` gets soil on footing W_s = (A - 2 columns) h_s gamma_s, `sls_factor` for columns with no service load, and `size_combined_footing()`: footing centroid on the SLS load resultant (p1 + x = L/2 = p2 + (s - x); entered left projection = shorter overhang, longer rounded up to 10 mm; heavier column gets the longer one), B = N_sls/(q_net L) rounded up to 100 mm then widened until SLS passes, depth +50 mm. Request: same 4 fields as pad (column-fit validator skipped when auto_size); response: `footing_weight_kN`, `soil_weight_kN`, `sls_total_load_kN`, `auto_sized`, `left/right_projection_m`; report "2b. Footing Sizing". Page: checkbox and ULS/SLS factor now also in combined mode; results show projections.
- Verified: book 8.5.4 loads -> x = 0.210 m, projections 0.56/0.15 m (book 0.55/0.15 with L fixed at 1.5), L 1.533, B 0.5, W_f/W_s/N hand-checked; page defaults auto -> 5550 x 700 x 650 (x = 1.230, A 3.49) hand-checked; headless Chrome reaches results with the sized geometry. Regression vs HEAD (in-process): combined without new fields identical; pad bearing/punching identical, M/V lower as intended (65.40 -> 61.32 kNm/m).
- Simplification: when sizing deepens h, h_s (soil above) stays as sent (page: depth below ground - trial h), so soil weight is slightly overestimated (conservative).
- Detailing + bar schedule (book 9.10, 10.2), same day: new `backend/engine/foundation_detailing.py` (anchorage f_bd/l_b,rqd/l_bd with bent-bar alpha1/alpha2; EC2 9.8.2.2 edge check F_s = R z_e/z_i at x = h/2, e = 0.15b, z_i = 0.9d; U-bar legs max(150, needed) <= h - 2c; bar count floor((W - 2c)/s) + 1; cut length = sum of dims (book convention, no BS 8666 deduction); starters L-bar, 300 foot, projection = soil depth + lap l0 = 1.5 l_b,rqd unless entered; book unit masses; 12 m pieces). Service `_pad_detailing` / `_combined_detailing` / `_detailing_section` (report sections 13 pad, 16 combined); square pad merges both layers into one mark like the book; combined schedules bottom/top longitudinal, bottom transverse and top transverse distribution (book mark 07). Request: `n_members`, `starter_bar_count`, `starter_bar_dia_mm`, `starter_projection_mm`; response `detailing` (dict). Detailing status IS part of the overall PASS/FAIL (service sets res.overall_status = FAIL before the report; "Detailing (EC2 9.8.2.2)" row above "Overall" in the final summary; "Detailing" chip on both views); auto-sizing passes `extra_ok` so a failing edge anchorage deepens the footing (verified: Y25 h300 pad FAIL leg 225 > 200; auto -> h350 PASS leg 200 <= 250; Y12 regression unchanged; combined same). UI: inputs in the Materials card; results tab "Detailing & Schedule" (anchorage, callouts, starters, schedule with shape sketches, totals/tonnes/pieces) on pad and combined.
- Verified vs book 10.2 schedule via bundled api.js: marks 01 (16 x 3, 1.7 m, 81.6 m, 72.46 kg), 02 (12 x 7, 117.6 m, 104.43), 06 (10 x 8, 96 m, 85.25), 07 (16 x 1.0 m, 14.21), 08 (8 x 1.723, 12.24), 05 starters 2.615 m -- all identical. Book 9.10 lbd 25.44 phi reproduced (Y16, fyk 460). Edge anchorage hand-checked (Type 1: F_s 69.70 kN/m, sigma 123.3). UI in headless Chrome: tab on both views, n_members reaches the request (5 x 84.55 = 422.75 kg).
- Not from the book: column links in the stub (book mark 03) are left to the column element.

### Known, not fixed

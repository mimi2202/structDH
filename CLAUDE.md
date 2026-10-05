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

### Pad footing, still NOT fixed (await user)
- Punching: relief area (cx+4d)(cy+4d) at qmax; V_Ed clamps to 0 when the 2d perimeter is outside the footing; EC2 6.4.4 search gives 1.10 on a 3.5 m pad the engine passes. Same fix as the combined engine would apply.
- fctm 2.6/2.9 (As,min 17% low at C40); bearing on ULS loads with no self-weight; rho_l = 0.002 fixed.

### Known, not fixed
- Pre-existing lint error: `allow` unused in `SoilPressure3D` (FoundationResults.jsx:175), also in HEAD.

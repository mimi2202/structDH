# backend/engine/staircase_engine.py
"""
Staircase: one flight + landing, designed per metre width, following
Structville "Structural Analysis and Design of Residential Buildings"
(Ubani), section 5.4 (PDF p.136-139).

Book method, kept:
  * Loads (5.4.1): waist h x 25, steps 0.5 x riser x 25, finishes; flight
    gk = waist + steps + finishes, landing gk = h x 25 + finishes;
    n = 1.35 gk + 1.5 qk. Flight load applied along the sloping member in the
    global vertical direction (the book's reactions 44.137 + 10.017 =
    13.565 x 2.928 + 12.026 x 1.2 confirm this), landing load on its length.
  * Model (5.4.1 figure): bent frame A (top of flight) - B (flight/landing
    junction) - C (end of landing), pinned at A and C. A is
    flight_span above B; B to C is level. Solved by the force method with the
    horizontal reaction as the redundant.
  * Flexure (5.4.2): K = M/(fck b d^2), z = d[0.5 + sqrt(0.25 - 0.882K)]
    <= 0.95d, As = M/(0.87 fyk z), fctm = 0.3 fck^(2/3),
    As,min = 0.26 fctm/fyk b d >= 0.0013 b d.
  * Deflection: K = 1.0, rho = As,prov/(b d), Eq. 7.16a/b, 310/sigma_s =
    500 As,prov/(fyk As,req), L = horizontal distance between supports.
  * Shear: VRd,c of EC2 6.2.2(1) with k1 sigma_cp, sigma_cp = N/Ac, using the
    frame's axial force (tension reduces VRd,c, as the book says).

Changed from the book (user decisions 2026-11-02):
  * The waist load is NOT multiplied by cos(alpha): the self-weight of the
    sloping waist is already vertical, and it is applied per sloping length
    (book: 4.375 x cos 33.69 = 3.640, about 7% low on the flight gk).
  * The frame is solved exactly (flexural deformation, constant EI). For the
    book's own loads this gives H = 65.0 kN, not the printed 38.461, with a
    hogging moment at B; the book's diagrams are consistent with its H but
    no elastic solution of the drawn frame reproduces it. Top steel is
    designed for the hogging moment.
  * 310/sigma_s capped at 1.5 (UK NA, as the other engines); book takes 2.0.

Also checked here (EC2 rules the book does not show): bar spacing 9.3.1.1(3),
distribution steel >= 20% 9.3.1.1(2), As,max 9.2.1.1(3), K <= 0.167.
"""
from dataclasses import dataclass
from typing import Optional
import math

GAMMA_C = 25.0          # kN/m3, book 5.4.1
SPACINGS = [300, 275, 250, 225, 200, 175, 150, 125, 100, 75]
K_LIM = 0.167
F3_CAP = 1.5


@dataclass
class StaircaseInput:
    n_risers: int = 10
    riser_mm: float = 150.0
    going_mm: float = 250.0
    flight_span_mm: float = 2515.0      # horizontal, support A to B
    landing_mm: float = 1200.0          # horizontal, B to support C
    thickness_mm: float = 175.0         # waist and landing
    finishes_kN_m2: float = 1.2
    qk_kN_m2: float = 3.0
    fck: float = 25.0
    fyk: float = 460.0
    cover_mm: float = 25.0
    main_bar_mm: float = 12.0
    main_spacing_mm: Optional[float] = None     # None -> chosen
    top_bar_mm: float = 12.0
    top_spacing_mm: Optional[float] = None
    dist_bar_mm: float = 10.0
    dist_spacing_mm: Optional[float] = None


def bar_area(phi, s):
    return math.pi * phi ** 2 / 4 * 1000 / s


def fctm(fck):
    return 0.3 * fck ** (2 / 3)


def as_min(fck, fyk, d):
    return max(0.26 * fctm(fck) / fyk * 1000 * d, 0.0013 * 1000 * d)


# ---------------------------------------------------------------- loads
def loads(d: StaircaseInput):
    h = d.thickness_mm / 1000
    n_treads = d.n_risers - 1
    rise = d.n_risers * d.riser_mm / 1000
    going = n_treads * d.going_mm / 1000
    alpha = math.degrees(math.atan(rise / going)) if going > 0 else 90.0
    g_waist = h * GAMMA_C
    g_steps = 0.5 * d.riser_mm / 1000 * GAMMA_C
    gk_f = g_waist + g_steps + d.finishes_kN_m2
    gk_l = h * GAMMA_C + d.finishes_kN_m2
    return {
        "n_treads": n_treads, "rise_m": rise, "going_m": going, "alpha_deg": alpha,
        "g_waist": g_waist, "g_waist_book": g_waist * math.cos(math.radians(alpha)),
        "g_steps": g_steps, "finishes": d.finishes_kN_m2,
        "gk_flight": gk_f, "gk_landing": gk_l, "qk": d.qk_kN_m2,
        "n_flight": 1.35 * gk_f + 1.5 * d.qk_kN_m2,
        "n_landing": 1.35 * gk_l + 1.5 * d.qk_kN_m2,
    }


# ---------------------------------------------------------------- analysis
class Frame:
    """A (0, Hf) pinned, B (L1, 0), C (L1 + L2, 0) pinned. w1 per sloping
    length of AB, w2 per length of BC, both vertical (kN/m).
    H > 0: tension (A pulled towards -x, C towards +x)."""

    def __init__(self, L1, Hf, L2, w1, w2, H=None):
        self.L1, self.Hf, self.L2, self.w1, self.w2 = L1, Hf, L2, w1, w2
        self.Ls = math.hypot(L1, Hf)
        self.c, self.s = L1 / self.Ls, Hf / self.Ls
        self.L = L1 + L2
        self.W1, self.W2 = w1 * self.Ls, w2 * L2
        # primary structure: pin A, roller C
        self.VC0 = (self.W1 * L1 / 2 + self.W2 * (L1 + L2 / 2)) / self.L
        self.VA0 = self.W1 + self.W2 - self.VC0
        if H is None:
            d10, d11 = self._flexibility()
            H = -d10 / d11
            self.d10, self.d11 = d10, d11
        self.H = H
        self.VA = self.VA0 + H * Hf / self.L
        self.VC = self.VC0 - H * Hf / self.L

    def M0(self, x):
        if x <= self.L1:
            return self.VA0 * x - (self.w1 / self.c) * x * x / 2
        return self.VA0 * x - self.W1 * (x - self.L1 / 2) - self.w2 * (x - self.L1) ** 2 / 2

    def m1(self, x):
        """Moment from the unit redundant pair (sagging +)."""
        if x <= self.L1:
            return self.Hf * x / self.L - self.Hf * x / self.L1
        return self.Hf * x / self.L - self.Hf

    def _flexibility(self):
        """Integrals of M0 m1 ds and m1^2 ds (EI const). M0 is quadratic and
        m1 linear in x on each member, so Simpson's rule is exact."""
        def simpson(f, a, b):
            return (b - a) / 6 * (f(a) + 4 * f((a + b) / 2) + f(b))
        e = 1e-12
        L1, L = self.L1, self.L
        ab = lambda g: simpson(g, 0.0, L1 - e) / self.c      # ds = dx / cos
        bc = lambda g: simpson(g, L1 + e, L)
        d10 = ab(lambda x: self.M0(x) * self.m1(x)) + bc(lambda x: self.M0(x) * self.m1(x))
        d11 = ab(lambda x: self.m1(x) ** 2) + bc(lambda x: self.m1(x) ** 2)
        return d10, d11

    def at(self, x, member=None):
        """M (sagging +), V (perpendicular to the member), N (tension +) at
        horizontal position x. At B (x = L1) pass member="landing" for the
        landing side (V and N jump there; M does not)."""
        M = self.M0(x) + self.H * self.m1(x)
        if member == "flight" or (member is None and x <= self.L1):
            Fx, Fy = -self.H, self.VA - (self.w1 / self.c) * x
            N = -(Fx * self.c - Fy * self.s)
            V = Fx * self.s + Fy * self.c
            member = "flight"
        else:
            Fy = self.VA - self.W1 - self.w2 * (x - self.L1)
            N, V, member = self.H, Fy, "landing"
        return M, V, N, member

    def stations(self, n=120):
        """(x, member) pairs; B appears on both members."""
        pts = [(i / n * self.L1, "flight") for i in range(n + 1)]
        pts += [(self.L1 + i / n * self.L2, "landing") for i in range(n + 1)]
        # zero-shear point of the flight for the exact peak
        x0 = (self.VA - self.H * self.s / self.c) * self.c / self.w1 if self.w1 else None
        # (V = 0 on AB: -H s + (VA - w1 x / c) c = 0)
        if x0 is not None and 0 < x0 < self.L1:
            pts.append((x0, "flight"))
        Fy_B = self.VA - self.W1
        if self.w2 and 0 < Fy_B / self.w2 < self.L2:
            pts.append((self.L1 + Fy_B / self.w2, "landing"))
        return sorted(pts, key=lambda p: (p[0], p[1] != "flight"))


# ---------------------------------------------------------------- design
def flexure(M_kNm, d_mm, fck, fyk):
    K = M_kNm * 1e6 / (fck * 1000 * d_mm ** 2) if M_kNm > 0 else 0.0
    if K > K_LIM:
        return {"K": K, "z_mm": None, "As_req": None, "status": "NOT OK"}
    z = min(d_mm * (0.5 + math.sqrt(0.25 - 0.882 * K)), 0.95 * d_mm)
    As = M_kNm * 1e6 / (0.87 * fyk * z) if M_kNm > 0 else 0.0
    return {"K": K, "z_mm": z, "z_capped": z >= 0.95 * d_mm - 1e-9, "As_req": As, "status": "OK"}


def provide(phi, need, s_max, spacing=None):
    """Bars at the given spacing, or the widest standard spacing <= s_max
    that gives at least `need` mm2/m."""
    if spacing:
        return spacing, bar_area(phi, spacing)
    for s in SPACINGS:
        if s <= s_max and bar_area(phi, s) >= need:
            return s, bar_area(phi, s)
    s = SPACINGS[-1]
    return s, bar_area(phi, s)


def ld_basic(fck, rho, K=1.0):
    rho0 = math.sqrt(fck) * 1e-3
    if rho <= rho0:
        v = K * (11 + 1.5 * math.sqrt(fck) * rho0 / rho + 3.2 * math.sqrt(fck) * (rho0 / rho - 1) ** 1.5)
        branch = "7.16a"
    else:
        v = K * (11 + 1.5 * math.sqrt(fck) * rho0 / rho)   # rho' = 0
        branch = "7.16b"
    return v, rho0, branch


def vrdc(fck, d_mm, rho_l, N_kN, h_mm):
    """EC2 6.2.2(1), b = 1000. N tension +; sigma_cp compression +."""
    k = min(1 + math.sqrt(200 / d_mm), 2.0)
    rho = min(rho_l, 0.02)
    sigma_cp = -N_kN * 1e3 / (1000 * h_mm)
    fcd = fck / 1.5
    sigma_cp = min(sigma_cp, 0.2 * fcd)
    v_main = 0.18 / 1.5 * k * (100 * rho * fck) ** (1 / 3)
    vmin = 0.035 * k ** 1.5 * math.sqrt(fck)
    v = max(v_main + 0.15 * sigma_cp, vmin + 0.15 * sigma_cp, 0.0)
    return {"k": k, "k_raw": 1 + math.sqrt(200 / d_mm), "rho": rho, "sigma_cp": sigma_cp,
            "v_main": v_main, "vmin": vmin, "VRdc_kN": v * d_mm}


def design_staircase(d: StaircaseInput) -> dict:
    ld = loads(d)
    L1, Hf, L2 = d.flight_span_mm / 1000, ld["rise_m"], d.landing_mm / 1000
    fr = Frame(L1, Hf, L2, ld["n_flight"], ld["n_landing"])
    h = d.thickness_mm

    pts = []
    for x, member in fr.stations():
        M, V, N, mem = fr.at(x, member)
        y = Hf * (1 - x / L1) if mem == "flight" else 0.0
        pts.append({"x": x, "y": y, "M": M, "V": V, "N": N, "member": mem})
    M_sag = max(max(p["M"] for p in pts), 0.0)
    p_sag = max(pts, key=lambda p: p["M"])
    M_hog = max(-min(p["M"] for p in pts), 0.0)
    p_hog = min(pts, key=lambda p: p["M"])
    MB = fr.at(L1)[0]

    # bottom (span) steel
    d_bot = h - d.cover_mm - d.main_bar_mm / 2
    fb = flexure(M_sag, d_bot, d.fck, d.fyk)
    Asmin_b = as_min(d.fck, d.fyk, d_bot)
    s_max_main = min(2 * h, 250)          # EC2 9.3.1.1(3), areas of maximum moment
    need_b = max(fb["As_req"] or 0.0, Asmin_b)
    s_b, Asp_b = provide(d.main_bar_mm, need_b, s_max_main, d.main_spacing_mm)

    # top steel at B (hogging), only when the frame hogs
    top = None
    if M_hog > 0.01:
        d_top = h - d.cover_mm - d.top_bar_mm / 2
        ft = flexure(M_hog, d_top, d.fck, d.fyk)
        Asmin_t = as_min(d.fck, d.fyk, d_top)
        need_t = max(ft["As_req"] or 0.0, Asmin_t)
        s_t, Asp_t = provide(d.top_bar_mm, need_t, s_max_main, d.top_spacing_mm)
        top = {"M": M_hog, "x": p_hog["x"], "member": p_hog["member"], "d_mm": d_top, **ft,
               "As_min": Asmin_t, "bar": d.top_bar_mm, "spacing": s_t, "As_prov": Asp_t,
               "spacing_ok": s_t <= s_max_main,
               "status": "OK" if ft["status"] == "OK" and Asp_t >= need_t - 1e-6 and s_t <= s_max_main
                         and Asp_t <= 0.04 * 1000 * h else "NOT OK"}

    # distribution steel, EC2 9.3.1.1(2): >= 20% of the main steel
    need_d = 0.2 * Asp_b
    s_max_dist = min(3 * h, 400)
    s_d, Asp_d = provide(d.dist_bar_mm, need_d, s_max_dist, d.dist_spacing_mm)

    # deflection (book: K = 1.0, rho from As,prov, L between supports)
    rho = Asp_b / (1000 * d_bot)
    basic, rho0, branch = ld_basic(d.fck, rho, 1.0)
    As_req_b = fb["As_req"] or 0.0
    f3_raw = 500 * Asp_b / (d.fyk * As_req_b) if As_req_b > 0 else float("inf")
    sigma_s = 310 * d.fyk * As_req_b / (500 * Asp_b)
    F3 = min(f3_raw, F3_CAP)
    allow = basic * F3
    L_def = fr.L * 1000
    actual = L_def / d_bot

    # shear: every station, VRd,c with the axial force there and the steel in
    # the tension face (bottom where M >= 0, top where M < 0)
    shear = None
    for p in pts:
        hog = p["M"] < 0 and top is not None
        dd = top["d_mm"] if hog else d_bot
        As_t = top["As_prov"] if hog else Asp_b
        r = vrdc(d.fck, dd, As_t / (1000 * dd), p["N"], h)
        ratio = abs(p["V"]) / r["VRdc_kN"] if r["VRdc_kN"] > 0 else float("inf")
        if shear is None or ratio > shear["ratio"]:
            shear = {"x": p["x"], "member": p["member"], "VEd": abs(p["V"]), "NEd": p["N"],
                     "d_mm": dd, "As": As_t, "face": "top" if hog else "bottom", **r, "ratio": ratio}
    shear["status"] = "OK" if shear["ratio"] <= 1.0 else "NOT OK"

    bottom = {"M": M_sag, "x": p_sag["x"], "member": p_sag["member"], "d_mm": d_bot, **fb,
              "As_min": Asmin_b, "bar": d.main_bar_mm, "spacing": s_b, "As_prov": Asp_b,
              "spacing_ok": s_b <= s_max_main,
              "status": "OK" if fb["status"] == "OK" and Asp_b >= need_b - 1e-6 and s_b <= s_max_main
                        and Asp_b <= 0.04 * 1000 * h else "NOT OK"}
    dist = {"bar": d.dist_bar_mm, "spacing": s_d, "As_prov": Asp_d, "As_req": need_d,
            "s_max": s_max_dist,
            "status": "OK" if Asp_d >= need_d - 1e-6 and s_d <= s_max_dist else "NOT OK"}
    defl = {"K": 1.0, "rho": rho, "rho0": rho0, "branch": branch, "basic": basic,
            "sigma_s": sigma_s, "F3_raw": f3_raw, "F3": F3, "allowable": allow,
            "L_mm": L_def, "actual": actual, "ratio": actual / allow,
            "status": "OK" if actual <= allow else "NOT OK"}

    checks = [bottom["status"], dist["status"], defl["status"], shear["status"]]
    if top:
        checks.append(top["status"])
    warnings = []
    if fr.VC < 0:
        warnings.append(f"Support C reaction is negative ({fr.VC:.2f} kN/m, uplift): the landing "
                        "support must hold the landing down, or the pinned-frame model does not apply.")
    if fr.VA < 0:
        warnings.append(f"Support A reaction is negative ({fr.VA:.2f} kN/m): hold-down needed at A.")
    return {
        "loads": ld, "frame": fr, "points": pts,
        "M_sag": M_sag, "M_hog": M_hog, "M_B": MB,
        "bottom": bottom, "top": top, "dist": dist, "deflection": defl, "shear": shear,
        "s_max_main": s_max_main,
        "overall_status": "PASS" if all(c == "OK" for c in checks) else "FAIL",
        "warnings": warnings,
    }

# backend/engine/load_combination.py
"""
EN 1990 Eq. 6.10 ULS combination with one leading and one accompanying
variable action, for slabs carrying imposed load Q_k and a downward wind
pressure W_k on their surface (e.g. a roof slab).

    imposed leading:  w = 1.35 G_k + 1.5 Q_k + 1.5 psi_0,w W_k
    wind leading:     w = 1.35 G_k + 1.5 W_k + 1.5 psi_0,q Q_k

leading = "auto" takes the larger. With W_k = 0 this is exactly
1.35 G_k + 1.5 Q_k, so a slab with no wind is designed as before.
Wind uplift (suction) is not modelled: W_k is a downward pressure, >= 0.

psi_0 (EN 1990 Table A1.1, recommended values): imposed categories A-D 0.7,
storage (E) 1.0; wind 0.6.
"""

GAMMA_G = 1.35
GAMMA_Q = 1.50
PSI0_WIND = 0.6
PSI0_IMPOSED_STORAGE = 1.0
PSI0_IMPOSED = 0.7


def psi0_imposed_for_use(building_use) -> float:
    return PSI0_IMPOSED_STORAGE if "storage" in str(building_use or "").lower() else PSI0_IMPOSED


def uls_combination(Gk: float, Qk: float, Wk: float = 0.0, leading: str = "auto",
                    psi0_q: float = PSI0_IMPOSED, psi0_w: float = PSI0_WIND) -> dict:
    Wk = max(float(Wk or 0.0), 0.0)
    w_imp = GAMMA_G * Gk + GAMMA_Q * Qk + GAMMA_Q * psi0_w * Wk
    w_wind = GAMMA_G * Gk + GAMMA_Q * Wk + GAMMA_Q * psi0_q * Qk
    lead = (leading or "auto").lower()
    if Wk <= 0:
        lead = "imposed"            # no wind: nothing to accompany
    elif lead not in ("imposed", "wind"):
        lead = "wind" if w_wind > w_imp + 1e-12 else "imposed"
    w_ed = w_wind if lead == "wind" else w_imp
    # characteristic SLS combination (EN 1990 Eq. 6.14b), same leading action
    service = Gk + (Wk + psi0_q * Qk if lead == "wind" else Qk + psi0_w * Wk)
    return {
        "Gk": Gk, "Qk": Qk, "Wk": Wk, "psi0_q": psi0_q, "psi0_w": psi0_w,
        "w_imposed_leading": w_imp, "w_wind_leading": w_wind,
        "leading": lead, "leading_requested": (leading or "auto").lower(),
        "w_ed": w_ed, "service": service,
    }

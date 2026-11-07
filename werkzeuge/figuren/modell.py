"""Figurenmodell: Vorwärtskinematik und Muskelflächen. Muss mit Kotlin (Figuren.kt) und JS (figuren.js) übereinstimmen.

Haltung = 17 Zahlen: hx, hy, t, k, z, o1, u1, h1, o2, u2, h2, s1, w1, f1, s2, w2, f2
Winkel in Grad, absolut: 0 = nach oben, 90 = nach vorn (rechts), 180 = nach unten. h = Hand relativ zum Unterarm.
Ansichten: seite (blickt nach rechts), vorn, hinten.
"""
import math

P = ["hx", "hy", "t", "k", "z", "o1", "u1", "h1", "o2", "u2", "h2", "s1", "w1", "f1", "s2", "w2", "f2"]
IX = {n: i for i, n in enumerate(P)}

L_RUMPF, L_OA, L_UA, L_HAND, L_OS, L_US, L_FUSS, L_FERSE = 30.0, 16.0, 14.0, 3.0, 23.0, 22.0, 8.0, 2.5
SCHULTER_BREIT, HUEFTE_BREIT = 10.0, 5.5


def d(a):
    r = math.radians(a)
    return (math.sin(r), -math.cos(r))


def add(p, v, s=1.0):
    return (p[0] + v[0] * s, p[1] + v[1] * s)


def gelenke(ansicht, h):
    """Gelenkpunkte als dict. Arm/Bein 1 = vorn bzw. rechts im Bild."""
    g = {}
    H = (h[0], h[1])
    t, k, z = h[2], h[3], h[4]
    g["H"] = H
    if ansicht == "seite":
        S0 = add(H, d(t), L_RUMPF)
        g["S0"] = S0
        g["KOPF"] = add(S0, d(t + k), 9.0)
        S = add(S0, d(t), z)
        sh = [S, S]
        hu = [H, H]
    else:
        N = add(H, d(t), L_RUMPF)
        g["S0"] = N
        g["KOPF"] = add(N, d(t + k), 8.5)
        p = d(t + 90)
        basis = add(N, d(t), -3 + z)
        sh = [add(basis, p, SCHULTER_BREIT), add(basis, p, -SCHULTER_BREIT)]
        hu = [add(H, p, HUEFTE_BREIT), add(H, p, -HUEFTE_BREIT)]
    # Hilfspunkte: Nacken (Stange hinter dem Hals), Brust (vor dem Brustbein), Becken vorn (Hip Thrust)
    dt = d(t)
    vorn_n = (-dt[1], dt[0])
    if ansicht == "seite":
        g["NACKEN"] = add(add(g["S0"], vorn_n, -4.6), dt, -1.5)
        g["BRUST"] = add(add(H, dt, 23), vorn_n, 7.5)
        g["BECKEN"] = add(add(H, dt, 2), vorn_n, 7.5)
    else:
        g["NACKEN"] = add(g["S0"], dt, -2)
        g["BRUST"] = add(H, dt, 22)
        g["BECKEN"] = add(H, dt, 2)
    for i, (oi, ui, hi, si, wi, fi) in enumerate([(5, 6, 7, 11, 12, 13), (8, 9, 10, 14, 15, 16)]):
        n = str(i + 1)
        S = sh[i]
        E = add(S, d(h[oi]), L_OA)
        W = add(E, d(h[ui]), L_UA)
        HA = add(W, d(h[ui] + h[hi]), L_HAND)
        K = add(hu[i], d(h[si]), L_OS)
        A = add(K, d(h[wi]), L_US)
        g["S" + n], g["E" + n], g["W" + n], g["HA" + n] = S, E, W, HA
        g["HU" + n], g["K" + n], g["A" + n] = hu[i], K, A
        if ansicht == "seite":
            g["T" + n] = add(A, d(h[fi]), L_FUSS)
            g["F" + n] = add(A, d(h[fi]), -L_FERSE)
        else:
            # Fuß von vorn: kurzer Strich nach außen-unten
            g["T" + n] = add(A, d(h[wi] + (25 if i == 0 else -25)), 4.5)
            g["F" + n] = A
    return g


# Muskelflächen: (muskel, segment, u0, u1, v, halbbreite). Segment: von Gelenk zu Gelenk; v quer, positiv = vorn (seite)
# bzw. nach außen (vorn/hinten; bei Arm/Bein 2 gespiegelt). Rumpf: von H zu S0.
MUSKELN = {
    "seite": [
        ("UNTERER_RUECKEN", "rumpf", 0.05, 0.42, -4.4, 2.0),
        ("LAT", "rumpf", 0.38, 0.86, -4.7, 2.6),
        ("TRAPEZ", "rumpf", 0.80, 1.10, -3.6, 2.3),
        ("BAUCH", "rumpf", 0.10, 0.58, 4.3, 2.2),
        ("BRUST", "rumpf", 0.58, 0.93, 4.7, 2.9),
        ("GESAESS", "os", -0.12, 0.34, -3.4, 3.4),
        ("ADDUKTOREN", "os", 0.10, 0.55, 0.2, 1.6),
        ("BEINBEUGER", "os", 0.32, 0.92, -2.4, 2.3),
        ("QUADRIZEPS", "os", 0.10, 0.92, 2.3, 2.7),
        ("WADEN", "us", 0.06, 0.56, -1.7, 2.1),
        ("TRIZEPS", "oa", 0.28, 0.92, -1.5, 1.8),
        ("BIZEPS", "oa", 0.34, 0.90, 1.5, 1.8),
        ("SCHULTERN", "oa", -0.10, 0.40, 0.0, 3.5),
        ("UNTERARME", "ua", 0.04, 0.66, 0.0, 2.0),
    ],
    "vorn": [
        ("BAUCH", "rumpf", 0.10, 0.58, 0.0, 3.6),
        ("BRUST", "rumpf", 0.60, 0.90, 4.6, 3.7),
        ("BRUST", "rumpf", 0.60, 0.90, -4.6, 3.7),
        ("TRAPEZ", "rumpf", 0.93, 1.07, 5.4, 1.6),
        ("TRAPEZ", "rumpf", 0.93, 1.07, -5.4, 1.6),
        ("QUADRIZEPS", "os", 0.12, 0.92, 0.5, 3.1),
        ("ADDUKTOREN", "os", 0.06, 0.52, -2.8, 1.5),
        ("WADEN", "us", 0.08, 0.50, -1.6, 1.4),
        ("WADEN", "us", 0.08, 0.50, 1.6, 1.4),
        ("BIZEPS", "oa", 0.34, 0.90, 0.0, 2.0),
        ("SCHULTERN", "oa", -0.10, 0.38, 0.0, 3.5),
        ("UNTERARME", "ua", 0.04, 0.66, 0.0, 2.0),
    ],
    "hinten": [
        ("UNTERER_RUECKEN", "rumpf", 0.04, 0.36, 2.2, 1.8),
        ("UNTERER_RUECKEN", "rumpf", 0.04, 0.36, -2.2, 1.8),
        ("LAT", "rumpf", 0.32, 0.82, 5.0, 3.0),
        ("LAT", "rumpf", 0.32, 0.82, -5.0, 3.0),
        ("TRAPEZ", "rumpf", 0.62, 1.07, 0.0, 4.3),
        ("GESAESS", "os", -0.16, 0.30, -0.6, 4.2),
        ("BEINBEUGER", "os", 0.30, 0.92, 0.0, 2.8),
        ("WADEN", "us", 0.06, 0.56, 0.0, 2.6),
        ("TRIZEPS", "oa", 0.28, 0.92, 0.0, 2.0),
        ("SCHULTERN", "oa", -0.10, 0.38, 0.0, 3.5),
        ("UNTERARME", "ua", 0.04, 0.66, 0.0, 2.0),
    ],
}


def segmente(ansicht, g, nr):
    """Segmente (name -> (start, ende, seite)) für Arm/Bein nr. seite = Vorzeichen für v."""
    n = str(nr)
    sg = 1 if nr == 1 else -1
    return {
        "oa": (g["S" + n], g["E" + n], sg),
        "ua": (g["E" + n], g["W" + n], sg),
        "os": (g["HU" + n], g["K" + n], sg),
        "us": (g["K" + n], g["A" + n], sg),
    }


def ellipse(a, b, u0, u1, v, hw, vorzeichen, rumpf_seite):
    """Ellipse im Segment-Koordinatensystem -> (mitte, rx, ry, winkel_grad)."""
    dx, dy = b[0] - a[0], b[1] - a[1]
    l = math.hypot(dx, dy) or 1.0
    ex, ey = dx / l, dy / l
    if rumpf_seite:
        nx, ny = -ey, ex  # Rumpf zeigt nach oben: vorn = rechts
    else:
        nx, ny = ey, -ex  # Glied zeigt nach unten: vorn = rechts
    um = (u0 + u1) / 2 * l
    vv = v * vorzeichen
    c = (a[0] + ex * um + nx * vv, a[1] + ey * um + ny * vv)
    return c, (u1 - u0) / 2 * l, hw, math.degrees(math.atan2(ey, ex))


def muskelflaechen(ansicht, g):
    """Liste (gruppe, muskel, mitte, rx, ry, winkel). gruppe: 'fern' (Glieder 2 in seite), 'rumpf', 'nah'."""
    out = []
    for (m, seg, u0, u1, v, hw) in MUSKELN[ansicht]:
        if seg == "rumpf":
            # vorn/hinten: v positiv = Bildrechts
            out.append(("rumpf", m) + ellipse(g["H"], g["S0"], u0, u1, v, hw, 1, True) + (0,))
            continue
        for nr in (1, 2):
            s = segmente(ansicht, g, nr)[seg]
            vz = s[2] if ansicht != "seite" else 1
            grp = ("fern" if nr == 2 else "nah") if ansicht == "seite" else "nah"
            out.append((grp, m) + ellipse(s[0], s[1], u0, u1, v, hw, vz, False) + (nr,))
    return out


def lerp_haltung(a, b, x):
    return [p + (q - p) * x for p, q in zip(a, b)]

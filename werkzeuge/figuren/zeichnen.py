"""SVG-Vorschau einer Figur (nur zum Entwerfen; die Apps zeichnen selbst)."""
import math
from modell import gelenke, muskelflaechen, lerp_haltung, d, add

HAUT = "#d9dde2"
HAUT_FERN = "#b9bfc7"
MUSKEL = "#c9ced5"
MUSKEL_FERN = "#aab1ba"
LINIE = "#5f6670"
GERAET = "#4a4f57"
GERAET_HELL = "#9aa1aa"
PRIMAER = "#C2185B"
SEKUNDAER = "#ef8fb3"


def L(a, b, w, c, cap="round", op=1.0):
    return f'<line x1="{a[0]:.2f}" y1="{a[1]:.2f}" x2="{b[0]:.2f}" y2="{b[1]:.2f}" stroke="{c}" stroke-width="{w}" stroke-linecap="{cap}" opacity="{op}"/>'


def C(p, r, fill, stroke=None, w=0.8):
    s = f' stroke="{stroke}" stroke-width="{w}"' if stroke else ""
    return f'<circle cx="{p[0]:.2f}" cy="{p[1]:.2f}" r="{r}" fill="{fill}"{s}/>'


def E(c, rx, ry, ang, fill):
    return f'<ellipse cx="{c[0]:.2f}" cy="{c[1]:.2f}" rx="{max(rx,0.1):.2f}" ry="{ry:.2f}" transform="rotate({ang:.1f} {c[0]:.2f} {c[1]:.2f})" fill="{fill}"/>'


def poly(pts, fill, stroke=None):
    s = " ".join(f"{x:.2f},{y:.2f}" for x, y in pts)
    st = f' stroke="{stroke or fill}" stroke-width="2.2" stroke-linejoin="round"'
    return f'<polygon points="{s}" fill="{fill}"{st}/>'


def rumpf_form(ansicht, g):
    H, S = g["H"], g["S0"]
    dx, dy = S[0] - H[0], S[1] - H[1]
    l = math.hypot(dx, dy)
    ex, ey = dx / l, dy / l
    nx, ny = -ey, ex
    if ansicht == "seite":
        prof = [(0.0, -5.2, 4.6), (0.55, -5.6, 5.4), (0.85, -5.4, 6.4), (1.0, -3.6, 3.6)]
    else:
        prof = [(0.0, -8.5, 8.5), (0.45, -7.2, 7.2), (0.8, -10.5, 10.5), (1.0, -9.0, 9.0)]
    links = [(H[0] + ex * u * l + nx * a, H[1] + ey * u * l + ny * a) for u, a, b in prof]
    rechts = [(H[0] + ex * u * l + nx * b, H[1] + ey * u * l + ny * b) for u, a, b in prof]
    return links + rechts[::-1]


def farbe(m, prim, sek, fern):
    if m in prim:
        return PRIMAER
    if m in sek:
        return SEKUNDAER
    return MUSKEL_FERN if fern else MUSKEL


def figur_svg(x, prim, sek, szene=None, last=None, geraet=None, ansicht="seite", fx=0.0):
    g = gelenke(ansicht, x)
    flaechen = muskelflaechen(ansicht, g)
    out = []
    out.append(L((0, 104), (120, 104), 1.2, GERAET_HELL, "butt"))
    for el in szene or []:
        out.append(szene_el(el))
    lastteile = last_svg(last, geraet, g, ansicht, fx) if last else ([], [])
    out += lastteile[0]

    def glieder(nr, haut, fern):
        n = str(nr)
        r = []
        r.append(L(g["HU" + n], g["K" + n], 9.5 if ansicht == "seite" else 8.6, haut))
        r.append(L(g["K" + n], g["A" + n], 6.6, haut))
        r.append(L(g["F" + n], g["T" + n], 3.4, haut))
        r += [E(*f[2:6], farbe(f[1], prim, sek, fern)) for f in flaechen if f[0] == ("fern" if fern else "nah") and f[1] in BEIN and _gehoert(f, g, nr, ansicht)]
        return r

    def arm(nr, haut, fern):
        n = str(nr)
        r = [L(g["S" + n], g["E" + n], 6.4, haut), L(g["E" + n], g["W" + n], 5.2, haut), L(g["W" + n], g["HA" + n], 4.4, haut)]
        r += [E(*f[2:6], farbe(f[1], prim, sek, fern)) for f in flaechen if f[0] == ("fern" if fern else "nah") and f[1] in ARM and _gehoert(f, g, nr, ansicht)]
        return r

    if ansicht == "seite":
        out += arm(2, HAUT_FERN, True)
        out += glieder(2, HAUT_FERN, True)
        out += glieder(1, HAUT, False)
        out.append(L(g["S0"], g["KOPF"], 4.5, HAUT))
        out.append(poly(rumpf_form(ansicht, g), HAUT))
        out += [E(*f[2:6], farbe(f[1], prim, sek, False)) for f in flaechen if f[0] == "rumpf"]
        out.append(C(g["KOPF"], 6.3, HAUT))
        out += arm(1, HAUT, False)
    else:
        out += glieder(1, HAUT, False) + glieder(2, HAUT, False)
        out.append(L(g["S0"], g["KOPF"], 5, HAUT))
        out.append(poly(rumpf_form(ansicht, g), HAUT))
        out += [E(*f[2:6], farbe(f[1], prim, sek, False)) for f in flaechen if f[0] == "rumpf"]
        out.append(C(g["KOPF"], 6.3, HAUT))
        out += arm(1, HAUT, False) + arm(2, HAUT, False)
    out += lastteile[1]
    return "\n".join(out)


ARM = {"SCHULTER_VORN", "SCHULTER_SEITE", "SCHULTER_HINTEN", "BIZEPS", "BRACHIALIS", "TRIZEPS_LANG", "TRIZEPS_SEITE", "UNTERARM_BEUGER", "UNTERARM_STRECKER"}
BEIN = {"GESAESS_GROSS", "GESAESS_MITTEL", "ADDUKTOREN", "BEINBEUGER", "QUADRIZEPS", "WADE_GASTRO", "WADE_SOLEUS"}


def _gehoert(f, g, nr, ansicht):
    return f[6] == nr


def szene_el(el):
    t = el[0]
    if t == "bank":  # Polster von a nach b, Beine zum Boden
        a, b = el[1], el[2]
        r = [L(((a[0] + b[0]) / 2, (a[1] + b[1]) / 2), ((a[0] + b[0]) / 2, 104), 2.2, GERAET_HELL, "butt"), L(a, b, 4.6, GERAET)]
        return "".join(r)
    if t == "linie":
        return L(el[1], el[2], el[3] if len(el) > 3 else 2, GERAET_HELL if (len(el) < 5 or el[4] == "hell") else GERAET)
    if t == "stange":
        return C(el[1], 1.6, GERAET)
    if t == "kasten":
        x0, y0, x1, y1 = el[1]
        return f'<rect x="{x0}" y="{y0}" width="{x1-x0}" height="{y1-y0}" rx="1.5" fill="{GERAET_HELL}"/>'
    return ""


def last_svg(last, geraet, g, ansicht, x=0.0):
    """(hinten, vorn): Geräteteile hinter bzw. vor der Figur."""
    hinten, vorn = [], []
    punkte = [g[p] for p in last.get("punkte", [])]
    if not punkte:
        return hinten, vorn
    art = last.get("art") or geraet
    anker = last.get("anker")
    if anker and last.get("anker_b"):
        anker = [(a[0] + (b[0] - a[0]) * x, a[1] + (b[1] - a[1]) * x) for a, b in zip(anker, last["anker_b"])]
    if art == "KABEL" and last.get("stange") and len(punkte) == 2:
        a, b = punkte
        vorn.append(L((a[0] - 4, a[1]), (b[0] + 4, b[1]), 1.8, GERAET))
        m = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
        hinten.append(C(anker[0], 2.3, GERAET))
        hinten.append(L(anker[0], m, 0.9, GERAET))
        return hinten, vorn
    if art == "POLSTER":
        for p in punkte:
            vorn.append(C(p, 3.2, GERAET))
        return hinten, vorn
    if art == "ROLLE":
        p = punkte[0]
        vorn.append(C((p[0], p[1] + 2.3), 4.2, GERAET))
        vorn.append(C((p[0], p[1] + 2.3), 1.3, GERAET_HELL))
        return hinten, vorn
    if art == "SEIL":
        a, b = punkte[0], punkte[-1]
        c = anker[0]
        vorn.append(f'<path d="M{a[0]:.1f},{a[1]:.1f} Q{c[0]:.1f},{c[1]:.1f} {b[0]:.1f},{b[1]:.1f}" stroke="{GERAET}" stroke-width="0.9" fill="none"/>')
        return hinten, vorn
    if art in ("LH", "EZ", "SMITH"):
        if ansicht == "seite":
            m = (sum(p[0] for p in punkte) / len(punkte), sum(p[1] for p in punkte) / len(punkte))
            if art == "SMITH":
                hinten.append(L((m[0] + 1.5, 8), (m[0] + 1.5, 104), 1.6, GERAET_HELL, "butt"))
            (vorn if last.get("vorn") else hinten).append(C(m, 8.2 if art != "EZ" else 6.4, GERAET, None))
            vorn.append(C(m, 1.6, GERAET))
        else:
            a, b = punkte[0], punkte[-1]
            dx, dy = b[0] - a[0], b[1] - a[1]
            l = math.hypot(dx, dy) or 1
            ex, ey = dx / l, dy / l
            if l < 1:
                ex, ey = 1, 0
            m = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
            halb = 27 if art != "EZ" else 18
            vorn.append(L((m[0] - ex * halb, m[1] - ey * halb), (m[0] + ex * halb, m[1] + ey * halb), 1.6, GERAET))
            for s in (-1, 1):
                c = (m[0] + ex * s * (halb - 4), m[1] + ey * s * (halb - 4))
                vorn.append(L((c[0] - ey * 8, c[1] + ex * 8), (c[0] + ey * 8, c[1] - ex * 8), 3.2, GERAET, "butt"))
    elif art == "KH":
        for p in punkte:
            vorn.append(C(p, 3.7, GERAET))
            vorn.append(C(p, 1.2, GERAET_HELL))
    elif art == "KB":
        for p in punkte:
            vorn.append(L(p, (p[0], p[1] + 2.5), 1.4, GERAET))
            vorn.append(C((p[0], p[1] + 6.0), 4.6, GERAET))
    elif art in ("KABEL", "BAND"):
        anker = anker or [(110, 20)]
        for i, p in enumerate(punkte):
            a = anker[min(i, len(anker) - 1)]
            if art == "KABEL":
                hinten.append(L((a[0], 4), (a[0], 104), 3.0, GERAET_HELL, "butt"))
                hinten.append(C(a, 2.3, GERAET))
                vorn.append(L(a, p, 0.9, GERAET))
                vorn.append(C(p, 1.8, GERAET))
            else:
                vorn.append(L(a, p, 1.3, "#7c8a5a"))
                hinten.append(C(a, 1.5, GERAET))
    elif art == "MASCHINE":
        anker = anker or [(100, 60)]
        for i, p in enumerate(punkte):
            anker_i = anker[min(i, len(anker) - 1)]
            hinten.append(L(anker_i, (anker_i[0], 104), 3.0, GERAET_HELL, "butt"))
            vorn.append(L(anker_i, p, 2.4, GERAET))
            vorn.append(C(anker_i, 2.2, GERAET))
            vorn.append(C(p, 2.4, GERAET))
    elif art == "PLATTE":
        w = last.get("winkel", 0)
        for p in punkte:
            v = d(w + 90)
            p = add(p, d(w), last.get("versatz", 0))
            vorn.append(L(add(p, v, -7), add(p, v, 7), 3.0, GERAET))
    return hinten, vorn


def bild(x, prim, sek, **kw):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -6 120 114" width="228" height="216">{figur_svg(x, prim, sek, **kw)}</svg>'

"""Muskelflächen je Ansicht als Teilmuskeln: (teil, segment, u0, u1, v, halbbreite). Ersetzt MUSKELN in modell.py,
figuren.js und Figuren.kt (Aufruf mit --ersetzen). v: seite positiv = vorn; vorn/hinten positiv = nach außen (Bildrechts beim Rumpf)."""
import re, sys
def sym(*z):  # Rumpf links und rechts
    t, seg, u0, u1, v, hw = z
    return [(t, seg, u0, u1, v, hw), (t, seg, u0, u1, -v, hw)]
SEITE = [
    ("UNTERER_RUECKEN", "rumpf", 0.05, 0.42, -4.4, 2.0),
    ("LAT", "rumpf", 0.38, 0.86, -4.7, 2.6),
    ("TRAPEZ_MITTE", "rumpf", 0.70, 0.92, -3.9, 2.0),
    ("TRAPEZ_OBEN", "rumpf", 0.90, 1.10, -3.2, 2.0),
    ("ROTATOREN", "rumpf", 0.74, 0.90, -2.2, 1.3),
    ("BAUCH_SCHRAEG", "rumpf", 0.12, 0.55, 2.4, 1.8),
    ("BAUCH_GERADE", "rumpf", 0.10, 0.58, 4.6, 1.5),
    ("BRUST_UNTEN", "rumpf", 0.58, 0.72, 4.9, 2.6),
    ("BRUST_MITTE", "rumpf", 0.70, 0.84, 5.0, 2.8),
    ("BRUST_OBEN", "rumpf", 0.82, 0.95, 4.5, 2.4),
    ("GESAESS_MITTEL", "os", -0.22, 0.08, -1.2, 2.6),
    ("GESAESS_GROSS", "os", -0.12, 0.34, -3.4, 3.4),
    ("ADDUKTOREN", "os", 0.10, 0.55, 0.2, 1.6),
    ("BEINBEUGER", "os", 0.32, 0.92, -2.4, 2.3),
    ("QUADRIZEPS", "os", 0.10, 0.92, 2.3, 2.7),
    ("WADE_GASTRO", "us", 0.06, 0.46, -1.8, 2.1),
    ("WADE_SOLEUS", "us", 0.40, 0.72, -1.3, 1.5),
    ("TRIZEPS_SEITE", "oa", 0.28, 0.80, -1.2, 1.5),
    ("TRIZEPS_LANG", "oa", 0.40, 0.92, -1.9, 1.1),
    ("BIZEPS", "oa", 0.34, 0.88, 1.6, 1.7),
    ("BRACHIALIS", "oa", 0.62, 0.94, 0.6, 1.0),
    ("SCHULTER_SEITE", "oa", -0.10, 0.36, 0.0, 2.6),
    ("SCHULTER_VORN", "oa", -0.08, 0.40, 1.7, 1.9),
    ("SCHULTER_HINTEN", "oa", -0.08, 0.40, -1.7, 1.9),
    ("UNTERARM_BEUGER", "ua", 0.04, 0.66, 0.8, 1.3),
    ("UNTERARM_STRECKER", "ua", 0.04, 0.66, -0.8, 1.3),
]
VORN = [
    *sym("LAT", "rumpf", 0.44, 0.74, 6.6, 1.4),
    *sym("ROTATOREN", "rumpf", 0.84, 0.94, 6.8, 1.2),
    *sym("BAUCH_SCHRAEG", "rumpf", 0.12, 0.55, 5.4, 1.7),
    ("BAUCH_GERADE", "rumpf", 0.10, 0.58, 0.0, 2.6),
    *sym("BRUST_UNTEN", "rumpf", 0.60, 0.72, 4.6, 3.4),
    *sym("BRUST_MITTE", "rumpf", 0.70, 0.82, 4.6, 3.7),
    *sym("BRUST_OBEN", "rumpf", 0.80, 0.91, 4.4, 3.2),
    *sym("TRAPEZ_OBEN", "rumpf", 0.93, 1.07, 5.4, 1.6),
    *sym("GESAESS_MITTEL", "rumpf", -0.04, 0.14, 7.0, 1.7),
    ("QUADRIZEPS", "os", 0.12, 0.92, 0.5, 3.1),
    ("ADDUKTOREN", "os", 0.06, 0.52, -2.8, 1.5),
    ("WADE_GASTRO", "us", 0.08, 0.50, -1.6, 1.4),
    ("WADE_SOLEUS", "us", 0.20, 0.62, 1.6, 1.3),
    ("BIZEPS", "oa", 0.34, 0.90, 0.0, 2.0),
    ("BRACHIALIS", "oa", 0.60, 0.92, 1.6, 1.0),
    ("SCHULTER_SEITE", "oa", -0.10, 0.36, 1.5, 2.4),
    ("SCHULTER_VORN", "oa", -0.10, 0.38, -0.6, 2.6),
    ("UNTERARM_BEUGER", "ua", 0.04, 0.66, -0.5, 1.5),
    ("UNTERARM_STRECKER", "ua", 0.04, 0.60, 1.3, 1.0),
]
HINTEN = [
    *sym("UNTERER_RUECKEN", "rumpf", 0.04, 0.36, 2.2, 1.8),
    *sym("LAT", "rumpf", 0.32, 0.82, 5.0, 3.0),
    ("TRAPEZ_MITTE", "rumpf", 0.60, 0.90, 0.0, 3.0),
    ("TRAPEZ_OBEN", "rumpf", 0.88, 1.07, 0.0, 4.3),
    *sym("ROTATOREN", "rumpf", 0.70, 0.86, 4.4, 1.6),
    *sym("GESAESS_MITTEL", "rumpf", -0.02, 0.14, 6.6, 1.8),
    ("GESAESS_GROSS", "os", -0.16, 0.30, -0.6, 4.2),
    ("BEINBEUGER", "os", 0.30, 0.92, 0.0, 2.8),
    ("WADE_GASTRO", "us", 0.06, 0.48, 0.0, 2.6),
    ("WADE_SOLEUS", "us", 0.44, 0.72, 0.0, 1.6),
    ("TRIZEPS_SEITE", "oa", 0.28, 0.86, 0.9, 1.3),
    ("TRIZEPS_LANG", "oa", 0.34, 0.92, -0.9, 1.3),
    ("SCHULTER_SEITE", "oa", -0.10, 0.34, 1.5, 2.4),
    ("SCHULTER_HINTEN", "oa", -0.10, 0.38, -0.6, 2.6),
    ("UNTERARM_STRECKER", "ua", 0.04, 0.66, 0.0, 2.0),
]
T = {"seite": SEITE, "vorn": VORN, "hinten": HINTEN}
f = lambda x: f"{x:.2f}"

def py():
    o = ["MUSKELN = {"]
    for a, l in T.items():
        o.append(f'    "{a}": [')
        o += [f'        ("{t}", "{s}", {f(u0)}, {f(u1)}, {v:.1f}, {hw:.1f}),' for t, s, u0, u1, v, hw in l]
        o.append("    ],")
    return "\n".join(o + ["}"])

def js():
    o = ["const MUSKELN = {"]
    for a, l in T.items():
        o.append(f"  {a}: [")
        o += [f"    ['{t}', '{s}', {f(u0)}, {f(u1)}, {v:.1f}, {hw:.1f}]," for t, s, u0, u1, v, hw in l]
        o.append("  ],")
    return "\n".join(o + ["};"])

def kt():
    o = ["    private val MUSKELN: Map<String, List<Def>> = mapOf("]
    for a, l in T.items():
        o.append(f'        "{a}" to defs(')
        o += [f'            Teil.{t}, "{s}", {f(u0)}, {f(u1)}, {v:.1f}, {hw:.1f},' for t, s, u0, u1, v, hw in l]
        o.append("        ),")
    return "\n".join(o + ["    )"])

def ersetzen(pfad, muster, neu):
    s = open(pfad).read()
    s2, n = re.subn(muster, lambda m: neu, s, count=1, flags=re.S)
    assert n == 1, pfad
    open(pfad, "w").write(s2)

if __name__ == "__main__":
    modell, web, kot = sys.argv[1:4]
    ersetzen(modell, r"MUSKELN = \{\n.*?\n\}", py())
    ersetzen(web, r"const MUSKELN = \{\n.*?\n\};", js())
    ersetzen(kot, r"    private val MUSKELN: Map<String, List<Def>> = mapOf\(\n.*?\n    \)", kt())

"""Haltungen je Bewegungsmuster als Funktion des Fortschritts x (0 = Start, 1 = Endstellung).
Daraus werden je Bewegung 5 Schlüsselbilder abgetastet; die Apps interpolieren linear dazwischen und spielen hin und her.
"""
import math
from modell import P, IX, gelenke, d, L_OA, L_UA, L_HAND, L_OS, L_US

BODEN = 102.3          # Knöchelhöhe Seitenansicht (Fuß steht auf y = 104)
BODEN_V = 98.5         # Knöchelhöhe Vorder-/Rückansicht
BASIS = dict(hx=55, hy=56.5, t=0, k=0, z=0, o1=180, u1=180, h1=0, o2=180, u2=180, h2=0,
             s1=180, w1=180, f1=90, s2=180, w2=180, f2=90)
SCHLUESSEL = 5


def L(a, b, x):
    return a + (b - a) * x


def winkel_zu(a, b):
    return math.degrees(math.atan2(b[0] - a[0], -(b[1] - a[1])))


def nahe(w, ref):
    while w - ref > 180:
        w -= 360
    while w - ref < -180:
        w += 360
    return w


def ik(basis, ziel, l1, l2, beuge, ref1, ref2):
    """Zwei Glieder von basis zum ziel. beuge +1/-1 wählt die Knickrichtung. Gibt (winkel1, winkel2)."""
    dx, dy = ziel[0] - basis[0], ziel[1] - basis[1]
    D = min(max(math.hypot(dx, dy), 1e-3), l1 + l2 - 1e-3)
    phi = winkel_zu(basis, ziel)
    c = (l1 * l1 + D * D - l2 * l2) / (2 * l1 * D)
    alpha = math.degrees(math.acos(max(-1, min(1, c))))
    w1 = phi + beuge * alpha
    E = (basis[0] + d(w1)[0] * l1, basis[1] + d(w1)[1] * l1)
    w2 = winkel_zu(E, ziel)
    return nahe(w1, ref1), nahe(w2, ref2)


def hal(ansicht="seite", fuss=None, huefte=None, punkt=None, sym=None, arm=(), bein=(), os=1.0, ua1=1.0, af=1.0, **kw):
    """Haltung bauen.
    Kurzschlüssel o,u,h,s,w,f setzen beide Seiten; in vorn/hinten wird Seite 2 gespiegelt (sym).
    fuss=(nr, x): Knöchel nr steht bei x auf dem Boden. huefte=(x, y). punkt=(gelenk, (x, y)) verschiebt die Figur.
    arm/bein: Liste (nr, (x, y), beuge) – Hand (HA) bzw. Knöchel (A) per IK ans Ziel.
    """
    h = dict(BASIS)
    if ansicht != "seite":
        h.update(f1=0, f2=0)
    for kurz in "ouhswf":
        if kurz in kw:
            v = kw.pop(kurz)
            h[kurz + "1"] = v
            h[kurz + "2"] = v
    gesetzt = set(kw)
    h.update(kw)
    if sym if sym is not None else ansicht != "seite":
        for kurz in "ouhsw":
            if kurz + "2" not in gesetzt:
                h[kurz + "2"] = -h[kurz + "1"]
    if huefte:
        h["hx"], h["hy"] = huefte
    x = [float(h[n]) for n in P]
    if os != 1.0 or ua1 != 1.0 or af != 1.0:
        x.append(float(os))
    if ua1 != 1.0 or af != 1.0:
        x.append(float(ua1))
    if af != 1.0:
        x.append(float(af))
    if fuss:
        nr, fx = fuss
        A = gelenke(ansicht, x, os)["A" + str(nr)]
        x[0] += fx - A[0]
        x[1] += (BODEN if ansicht == "seite" else BODEN_V) - A[1]
    if punkt:
        name, (px, py) = punkt
        q = gelenke(ansicht, x, os)[name]
        x[0] += px - q[0]
        x[1] += py - q[1]
    for nr, ziel, beuge in arm:
        g = gelenke(ansicht, x, os)
        oi, ui, hi = IX["o%d" % nr], IX["u%d" % nr], IX["h%d" % nr]
        # Ziel ist die Handmitte: Handgelenk liegt L_HAND davor in Unterarmrichtung; einfache Näherung über die Länge
        a, b = ik(g["S%d" % nr], ziel, L_OA, L_UA + L_HAND, beuge, x[oi], x[ui])
        x[oi], x[ui] = a, b
        x[hi] = 0.0
    for nr, ziel, beuge in bein:
        g = gelenke(ansicht, x, os)
        si, wi = IX["s%d" % nr], IX["w%d" % nr]
        a, b = ik(g["HU%d" % nr], ziel, L_OS * os, L_US, beuge, x[si], x[wi])
        x[si], x[wi] = a, b
    return [round(v, 2) for v in x]


A = {}


def arch(id, ansicht, fn, szene=(), punkte=(), anker=None, art=None, winkel=None, dauer=2.6, stange=False, anker_b=None):
    bilder = [fn(i / (SCHLUESSEL - 1)) for i in range(SCHLUESSEL)]
    last = {"punkte": list(punkte)}
    if anker is not None:
        last["anker"] = [anker] if isinstance(anker, tuple) else list(anker)
    if anker_b is not None:
        last["anker_b"] = [anker_b] if isinstance(anker_b, tuple) else list(anker_b)
    if art:
        last["art"] = art
    if winkel is not None:
        last["winkel"] = winkel
    if stange:
        last["stange"] = True
    A[id] = dict(ansicht=ansicht, bilder=bilder, szene=list(szene), last=last, dauer=dauer)


H2 = ("HA1", "HA2")
H1 = ("HA1",)
BANK = lambda x0, x1, y: ("bank", (x0, y), (x1, y))


# ================= Brust =================
def bank(id, neigung):
    # Rückenlage, Kopf links. Neigung > 0 = Schrägbank, < 0 = Negativbank.
    t = -90 + neigung
    hu = (64, 66)
    szene = [("bank", (64 - 34 * math.cos(math.radians(neigung)), 70 - 34 * math.sin(math.radians(neigung))), (72, 70))]
    def fn(x):
        g = gelenke("seite", hal(huefte=hu, t=t))
        s0 = g["S0"]
        # unten: Stange auf der unteren Brust (Richtung Hüfte), oben: über dem Schultergelenk
        ziel = (s0[0] + L(11, 2, x) + neigung * 0.12, s0[1] - L(7, 31, x))
        return hal(huefte=hu, t=t, s=105, w=165, f=95, arm=[(1, ziel, 1), (2, (ziel[0] + 1, ziel[1]), 1)])
    arch(id, "seite", fn, szene=szene, punkte=H2, anker=(98, 30))


bank("bankdruecken", 0)
bank("schraegbank", 32)
bank("negativbank", -14)


def brustpresse(x):
    hu = (46, 68)
    g = gelenke("seite", hal(huefte=hu, t=-6))
    s0 = g["S0"]
    ziel = (s0[0] + L(8, 31, x), s0[1] + 3)
    return hal(huefte=hu, t=-6, s=88, w=170, f=95, arm=[(1, ziel, 1), (2, (ziel[0] - 1, ziel[1]), 1)])


arch("brustpresse", "seite", brustpresse, szene=[BANK(36, 56, 72), ("linie", (38, 72), (31, 36), 4, "dunkel")], punkte=H2, anker=(70, 12))


def fliegende(x):
    p = hal("vorn", fuss=(1, 66), s1=176, w1=178)
    g = gelenke("vorn", p)
    y = g["S1"][1] + 7
    hx = L(g["S1"][0] + 28, 64, x)
    return hal("vorn", fuss=(1, 66), s1=176, w1=178, arm=[(1, (hx, y), 1), (2, (120 - hx, y), -1)])


arch("fliegende", "vorn", fliegende, punkte=H2, anker=[(104, 18), (16, 18)])


def fliegende_bank(id, neigung):
    # Kurzhantel-Fliegende auf der Bank, von der Seite. Die Arme gehen seitlich weg, darum wirken sie verkürzt:
    # unten neben der Bank kurz, über der Brust in voller Länge.
    t = -90 + neigung
    hu = (64, 66)
    szene = [("bank", (round(64 - 34 * math.cos(math.radians(neigung)), 1), round(70 - 34 * math.sin(math.radians(neigung)), 1)), (72, 70))]
    def fn(x):
        phi = L(102, 4, x)  # Winkel des Arms zur Senkrechten über der Brust, seitlich gemessen
        c = math.cos(math.radians(phi))
        w = (0 if c >= 0 else 180) + neigung * 0.3
        return hal(huefte=hu, t=t, s=105, w=165, f=95, o=w + 6, u=w - 6, af=max(abs(c), 0.22))
    arch(id, "seite", fn, szene=szene, punkte=H2)


fliegende_bank("fliegende_bank", 0)
fliegende_bank("schraegfliegende", 32)


def kabelcross(x):
    return hal("vorn", fuss=(1, 66), o1=L(62, 160, x), u1=L(72, 222, x), s1=176, w1=178)


arch("kabelcross", "vorn", kabelcross, punkte=H2, anker=[(114, 8), (6, 8)])


def liegestuetz(x):
    # Drehung um die Zehen: oben 21°, unten 9° Körperneigung
    n = L(21, 9, x)
    t, s = -90 + n, 90 + n
    p = hal(t=t, s=s, w=s, f=170, punkt=("T1", (104, 103.5)))
    sx = gelenke("seite", p)["S0"][0]
    return hal(t=t, s=s, w=s, f=170, punkt=("T1", (104, 103.5)), arm=[(1, (sx + 1, 103), -1), (2, (sx + 2, 103), -1)])


arch("liegestuetz", "seite", liegestuetz)


def dips(x):
    griff = (58, 46)
    return hal(t=L(8, 24, x), s=166, w=250, f=160, punkt=("S0", (L(58.5, 62, x), L(16, 40, x))),
               arm=[(1, griff, -1), (2, (griff[0] - 1, griff[1]), -1)])


arch("dips", "seite", dips, szene=[("linie", (46, 46), (74, 46), 2.4, "dunkel"), ("linie", (70, 46), (70, 104), 2.2)], punkte=("K1",), anker=(30, 80))


def trizepsdips(x):
    # Hände hinter dem Körper auf der Bankkante, Hüfte sinkt vor der Bank ab, Ellbogen zeigen nach hinten
    griff = (36, 66)
    return hal(t=L(2, 6, x), f=90, punkt=("S0", (L(39, 42, x), L(37, 52, x))),
               arm=[(1, griff, 1), (2, (griff[0] - 1, griff[1]), 1)], bein=[(1, (86, BODEN), 1), (2, (87, BODEN), 1)])


arch("trizepsdips", "seite", trizepsdips, szene=[BANK(16, 38, 68)])


# ================= Rücken =================
def kreuzheben(x):
    return hal(fuss=(1, 55), t=L(58, 0, x), s=L(126, 180, x), w=L(208, 180, x), o=180, u=180, o2=181, u2=181)


arch("kreuzheben", "seite", kreuzheben, punkte=H2)


def kreuzheben_kh(x):
    return hal(fuss=(1, 55), t=L(48, 0, x), s=L(130, 180, x), w=L(205, 180, x), o=L(180, 182, x), u=180)


arch("kreuzheben_kh", "seite", kreuzheben_kh, punkte=H2)


def sumo(x):
    return hal("vorn", fuss=(1, 82), t=0, s1=L(122, 150, x), w1=L(196, 168, x),
               arm=[(1, (63, L(88, 66, x)), 1), (2, (57, L(88, 66, x)), -1)])


arch("sumo", "vorn", sumo, punkte=H2)


def rumaenisch(x):
    return hal(fuss=(1, 55), t=L(0, 72, x), s=L(178, 158, x), w=L(180, 186, x), o=180, u=180, o2=181, u2=181)


arch("rumaenisch", "seite", rumaenisch, punkte=H2)


def klimmzug(id, ansicht, breite):
    def fn(x):
        return hal(ansicht, huefte=(60, L(57, 39, x)), s1=172, w1=190, f1=0,
                   arm=[(1, (60 + breite, 2), 1), (2, (60 - breite, 2), -1)])
    arch(id, ansicht, fn, szene=[("linie", (20, 1), (100, 1), 2.0, "dunkel")], punkte=("K1", "K2"), anker=(60, 96))


klimmzug("klimmzug", "hinten", 20)
klimmzug("chinup", "vorn", 10)


def latzug(id, breite, ende=-4):
    def fn(x):
        hy = 56
        g = gelenke("hinten", hal("hinten", huefte=(60, hy)))
        sy = g["S1"][1]
        # Start: Arme fast gestreckt über dem Kopf; Ende: Stange vor dem Kinn, Ellbogen unten seitlich
        y = L(sy - 30.5, sy + ende, x)
        return hal("hinten", huefte=(60, hy), s1=172, w1=180,
                   arm=[(1, (60 + breite, y), 1), (2, (60 - breite, y), -1)])
    arch(id, "hinten", fn, punkte=H2, anker=(60, -6), stange=True)




def latzug_seite(x, ende=6):
    # Von der Seite, sitzend, Oberschenkel unter der Knierolle: Hände von gestreckt über dem Kopf
    # vor dem Gesicht vorbei bis zur oberen Brust, Ellbogen nach unten und leicht nach hinten
    hu = (44, 74)
    t = L(-2, -14, x)
    g = gelenke("seite", hal(huefte=hu, t=t))
    s0 = g["S0"]
    hand = (L(s0[0] + 5, s0[0] + 10, x), L(s0[1] - 31, s0[1] + ende, x))
    return hal(huefte=hu, t=t, s=88, w=178, f=95, arm=[(1, hand, 1), (2, (hand[0] - 0.5, hand[1]), 1)])


_LATZUG_SZENE = [BANK(34, 56, 78), ("linie", (56, 104), (56, 64), 2.2), ("linie", (54, 66), (62, 66), 4, "dunkel")]
arch("latzug", "seite", latzug_seite, szene=_LATZUG_SZENE, punkte=H2, anker=(56, -6), stange=True)
arch("latzugeng", "seite", lambda x: latzug_seite(x, 9), szene=_LATZUG_SZENE, punkte=H2, anker=(56, -6), stange=True)


def rudern(id, t0, art=None):
    def fn(x):
        p = hal(fuss=(1, 52), t=t0, s=160, w=198)
        g = gelenke("seite", p)
        s0 = g["S0"]
        hand = (L(s0[0] + 2, g["H"][0] + 13, x), L(s0[1] + 29, g["H"][1] + 4, x))
        return hal(fuss=(1, 52), t=t0, s=160, w=198, arm=[(1, hand, 1), (2, (hand[0] - 1, hand[1]), 1)])
    arch(id, "seite", fn, punkte=H2, art=art)


rudern("rudern", 68)
rudern("pendlay", 84)
rudern("tbar", 50, art="LH")


def einarm(x):
    p = hal(huefte=(40, 57), t=86, s1=180, w1=180, s2=92, w2=-90, f2=180)
    g = gelenke("seite", p)
    s0 = g["S0"]
    hand = (L(s0[0], g["H"][0] + 14, x), L(s0[1] + 29, g["H"][1] - 1, x))
    return hal(huefte=(40, 57), t=86, s1=178, w1=178, s2=92, w2=-90, f2=180, o2=180, u2=180,
               arm=[(1, hand, 1), (2, (s0[0] + 2, 67), 1)])


arch("einarm", "seite", einarm, szene=[BANK(36, 80, 69)], punkte=H1)


def kabelrudern(id, liegen=False):
    def fn(x):
        hu = (40, 80)
        t = L(14, -8, x)
        g = gelenke("seite", hal(huefte=hu, t=t))
        s0 = g["S0"]
        hand = (L(s0[0] + 29, g["H"][0] + 10, x), L(s0[1] + 6, g["H"][1] - 8, x))
        return hal(huefte=hu, t=t, s=96, w=104, f=10, arm=[(1, hand, 1), (2, (hand[0] - 1, hand[1]), 1)])
    arch(id, "seite", fn, szene=[BANK(30, 50, 84), ("linie", (86, 84), (90, 104), 3, "dunkel")], punkte=H2, anker=(108, 76))


kabelrudern("kabelrudern")


def brustgestuetzt(x):
    t = 48
    p = hal(t=t, s=172, w=190, fuss=(1, 46))
    g = gelenke("seite", p)
    s0 = g["S0"]
    hand = (L(s0[0] + 1, s0[0] - 9, x), L(s0[1] + 29, s0[1] + 6, x))
    return hal(t=t, s=172, w=190, fuss=(1, 46), arm=[(1, hand, 1), (2, (hand[0] - 1, hand[1]), 1)])


arch("brustgestuetzt", "seite", brustgestuetzt, szene=[("bank", (50, 66), (74, 40))], punkte=H2, anker=(92, 50))


def pullover(x):
    hu = (70, 68)
    t = -90
    g = gelenke("seite", hal(huefte=hu, t=t))
    s0 = g["S0"]
    w = L(-100, -5, x)
    hand = (s0[0] + math.sin(math.radians(w)) * 30, s0[1] - math.cos(math.radians(w)) * 30)
    return hal(huefte=hu, t=t, s=102, w=170, f=95, arm=[(1, hand, 1), (2, (hand[0] + 0.5, hand[1]), 1)])


arch("pullover", "seite", pullover, szene=[BANK(34, 76, 72)], punkte=H2)


def pullover_kabel(x):
    w = L(40, 168, x)
    return hal(fuss=(1, 52), t=14, s=172, w=186, o=w, u=w + 4)


arch("pullover_kabel", "seite", pullover_kabel, punkte=H2, anker=(104, 8), stange=False)


def shrugs(x):
    return hal("vorn", fuss=(1, 66), z=L(0, 6.5, x), o1=172, u1=176, s1=177, w1=180)


arch("shrugs", "vorn", shrugs, punkte=H2, anker=(60, 104))


def facepull(x):
    hand = (L(92, 66, x), L(30, 24, x))
    return hal(fuss=(1, 46), t=-4, s1=172, w1=186, s2=196, w2=180,
               arm=[(1, hand, 1), (2, (hand[0] - 1, hand[1]), 1)])


arch("facepull", "seite", facepull, punkte=H2, anker=(110, 28))


def hyperext(x):
    # Römischer Stuhl 45°: Beine schräg nach hinten unten, Oberkörper vom Hängen bis in die Linie der Beine
    return hal(t=L(160, 45, x), s=225, w=225, f=135, o=L(175, 140, x), u=L(175, 140, x), punkt=("H", (56, 44)))


arch("hyperext", "seite", hyperext, szene=[("linie", (54, 54), (62, 46), 4.2, "dunkel"), ("linie", (56, 52), (40, 104), 2.2), ("linie", (16, 82), (26, 90), 3.2, "dunkel")])


def goodmorning(x):
    return hal(fuss=(1, 55), t=L(0, 78, x), s=L(176, 164, x), w=184, o=205 + L(0, 78, x) * 1.0, u=L(25, 103, x))


arch("goodmorning", "seite", goodmorning, punkte=("NACKEN",))


# ================= Schultern =================
def schulterdruecken(x):
    hy = 55
    g = gelenke("vorn", hal("vorn", huefte=(60, hy)))
    s0 = g["S0"]
    y = L(s0[1] - 3, s0[1] - 31, x)
    return hal("vorn", huefte=(60, hy), s1=178, w1=180, arm=[(1, (60 + 15, y), 1), (2, (60 - 15, y), -1)])


arch("schulterdruecken", "vorn", schulterdruecken, punkte=H2, anker=[(96, 60), (24, 60)])


def arnold(x):
    hy = 55
    g = gelenke("vorn", hal("vorn", huefte=(60, hy)))
    s0 = g["S0"]
    y = L(s0[1] + 1, s0[1] - 31, x)
    bx = L(6, 15, x)
    return hal("vorn", huefte=(60, hy), s1=178, w1=180, arm=[(1, (60 + bx, y), L(-1, 1, x) if x > 0.5 else -1), (2, (60 - bx, y), 1 if x <= 0.5 else -1)])


arch("arnold", "vorn", arnold, punkte=H2)


def pushpress(x):
    k = math.sin(math.pi * min(1, x * 1.6)) if x < 0.62 else 0
    p = hal("vorn", fuss=(1, 66), s1=L(176, 164, k), w1=L(180, 190, k))
    g = gelenke("vorn", p)
    s0 = g["S0"]
    y = L(s0[1] - 3, s0[1] - 31, x)
    return hal("vorn", fuss=(1, 66), s1=L(176, 164, k), w1=L(180, 190, k), arm=[(1, (75, y), 1), (2, (45, y), -1)])


arch("pushpress", "vorn", pushpress, punkte=H2)


def seitheben(x):
    return hal("vorn", fuss=(1, 66), o1=L(168, 88, x), u1=L(172, 95, x), s1=176, w1=178)


arch("seitheben", "vorn", seitheben, punkte=H2, anker=[(48, 102), (72, 102)])


def frontheben(x):
    return hal(fuss=(1, 52), o1=L(184, 84, x), u1=L(184, 82, x), o2=L(182, 86, x), u2=L(182, 84, x))


arch("frontheben", "seite", frontheben, punkte=H2, anker=(40, 102))


def reversefly(x):
    # Von hinten: Arme leicht gebeugt, aus dem Hängen vor dem Körper bis auf Schulterhöhe zur Seite
    # (vorgebeugt mit Kurzhanteln, am Kabel oder an der Reverse-Butterfly-Maschine)
    o = L(162, 90, x)
    return hal("hinten", fuss=(1, 66), s1=176, w1=178, o1=o, u1=o + 8)


arch("reversefly", "hinten", reversefly, punkte=H2, anker=[(16, 20), (104, 20)])


def aufrechtrudern(x):
    p = hal("vorn", fuss=(1, 66))
    g = gelenke("vorn", p)
    s0 = g["S0"]
    y = L(g["H"][1] + 4, s0[1] + 1, x)
    return hal("vorn", fuss=(1, 66), s1=176, w1=178, arm=[(1, (64, y), 1), (2, (56, y), -1)])


arch("aufrechtrudern", "vorn", aufrechtrudern, punkte=H2, anker=(60, 102))


# ================= Arme =================
def bizepscurl(x):
    return hal(fuss=(1, 52), o1=L(184, 176, x), u1=L(184, 28, x), o2=L(180, 172, x), u2=L(180, 24, x))


arch("bizepscurl", "seite", bizepscurl, punkte=H2, anker=(76, 102))


def scottcurl(x):
    return hal(huefte=(44, 70), t=14, s=94, w=180, f=90, o=146, u=L(140, 18, x))


_g = gelenke("seite", scottcurl(0))
_pad = lambda p: (p[0] - 3.4, p[1] + 5.0)
arch("scottcurl", "seite", scottcurl, szene=[BANK(34, 52, 74), ("linie", _pad(_g["S1"]), _pad(_g["E1"]), 4.6, "dunkel"), ("linie", (_g["E1"][0] - 4, _g["E1"][1] + 4), (_g["E1"][0] - 4, 104), 2.2)], punkte=H2, anker=(80, 50))


def konzentration(x):
    return hal(huefte=(40, 72), t=34, s1=86, w1=180, s2=70, w2=170, f=90, o1=176, u1=L(174, 40, x), o2=150, u2=150)


arch("konzentration", "seite", konzentration, szene=[BANK(28, 50, 76)], punkte=H1)


def schraegcurl(x):
    return hal(huefte=(52, 70), t=-34, s=90, w=180, f=90, o=188, u=L(188, 36, x))


arch("schraegcurl", "seite", schraegcurl, szene=[BANK(42, 62, 74), ("linie", (44, 72), (28, 46), 4.6, "dunkel")], punkte=H2)


def trizepsdruecken(x):
    return hal(fuss=(1, 50), t=12, s=176, w=184, o=172, u=L(62, 172, x))


arch("trizepsdruecken", "seite", trizepsdruecken, punkte=H2, anker=(76, 4))


def stirndruecken(x):
    hu = (66, 66)
    return hal(huefte=hu, t=-90, s=105, w=165, f=95, o=-12, u=L(-132, -10, x))


arch("stirndruecken", "seite", stirndruecken, szene=[BANK(30, 74, 70)], punkte=H2)


def trizepsueberkopf(x):
    return hal(fuss=(1, 52), t=-3, o=-8, u=L(-172, -6, x))


arch("trizepsueberkopf", "seite", trizepsueberkopf, punkte=H2, anker=(30, 100))


def kickback(x):
    return hal(fuss=(1, 52), t=72, s1=168, w1=192, s2=196, w2=196, o1=262, u1=L(178, 262, x), o2=140, u2=150)


_kb = gelenke("seite", kickback(0))["HA2"]
arch("kickback", "seite", kickback, szene=[BANK(round(_kb[0] - 12, 1), round(_kb[0] + 6, 1), round(_kb[1] + 2, 1))], punkte=H1, anker=(94, 100))


def handgelenk(x):
    return hal(huefte=(40, 72), t=22, s=86, w=180, f=90, o=170, u=92, h=L(48, -42, x))


arch("handgelenk", "seite", handgelenk, szene=[BANK(28, 50, 76)], punkte=H2)


def farmer(x):
    return hal(huefte=(55, 57.3), s1=L(158, 200, x), w1=L(172, 214, x), s2=L(200, 158, x), w2=L(214, 172, x),
               f1=90, f2=90, o=180, u=180)


arch("farmer", "seite", farmer, punkte=H2)


# ================= Beine =================
def kniebeuge(x):
    t = L(0, 42, x)
    return hal(fuss=(1, 55), t=t, s=L(180, 97, x), w=L(180, 205, x), o=200 + t, u=25 + t)


arch("kniebeuge", "seite", kniebeuge, punkte=("NACKEN",))


def kniebeuge_kh(x):
    return hal(fuss=(1, 55), t=L(0, 30, x), s=L(180, 97, x), w=L(180, 208, x), o=180, u=180)


arch("kniebeuge_kh", "seite", kniebeuge_kh, punkte=H2)


def frontkniebeuge(x):
    t = L(0, 22, x)
    p = hal(fuss=(1, 55), t=t, s=L(180, 95, x), w=L(180, 214, x))
    g = gelenke("seite", p)
    s0 = g["S0"]
    d_ = d(t + 90)
    hand = (s0[0] + d_[0] * 6 + d(t)[0] * 1, s0[1] + d_[1] * 6 + d(t)[1] * 1)
    return hal(fuss=(1, 55), t=t, s=L(180, 95, x), w=L(180, 214, x), arm=[(1, hand, -1), (2, (hand[0] - 0.5, hand[1]), -1)])


arch("frontkniebeuge", "seite", frontkniebeuge, punkte=("BRUST",))


def goblet(x):
    t = L(0, 26, x)
    p = hal(fuss=(1, 55), t=t, s=L(180, 95, x), w=L(180, 212, x))
    g = gelenke("seite", p)
    hand = g["BRUST"]
    hand = (hand[0] + 2, hand[1] + 2)
    return hal(fuss=(1, 55), t=t, s=L(180, 95, x), w=L(180, 212, x), arm=[(1, hand, -1), (2, (hand[0] - 0.5, hand[1]), -1)])


arch("goblet", "seite", goblet, punkte=("HA1",))


def hackenschmidt(x):
    return hal(fuss=(1, 62), t=L(-12, -2, x), s=L(176, 92, x), w=L(176, 202, x), o=200, u=25)


arch("hackenschmidt", "seite", hackenschmidt, punkte=("NACKEN",), art="POLSTER", szene=[("linie", (34, 104), (50, 10), 2.2), ("linie", (56, 103), (76, 103), 2.6, "dunkel")])


def _presse_sitz(hu=(40, 76), t=-58):
    dt = d(t)
    hinten = (dt[1] * 6, -dt[0] * 6)  # zur Rückenseite
    a = (hu[0] + hinten[0] - dt[0] * 3, hu[1] + hinten[1] - dt[1] * 3)
    b = (hu[0] + hinten[0] + dt[0] * 33, hu[1] + hinten[1] + dt[1] * 33)
    r = lambda p: (round(p[0], 1), round(p[1], 1))
    return [("linie", r(a), r(b), 4.6, "dunkel"), ("linie", r(a), (a[0] + 12, a[1] - 2), 4.6, "dunkel"),
            ("linie", (round(a[0] + 2, 1), round(a[1], 1)), (round(a[0] + 2, 1), 104), 2.2), ("linie", r(b), (round(b[0], 1), 104), 2.2)]


def beinpresse(x):
    hu = (40, 76)
    ziel = (L(56, 76, x), L(52, 34, x))
    return hal(huefte=hu, t=-58, o=150, u=150, f=L(10, 52, x), bein=[(1, ziel, 1), (2, (ziel[0] - 1, ziel[1] + 1), 1)])


arch("beinpresse", "seite", beinpresse, szene=_presse_sitz() + [("linie", (50, 66), (92, 18), 1.6)],
     punkte=("A1",), art="PLATTE", winkel=40)


def ausfallschritt(x):
    hy = L(56.9, 68, x)
    return hal(huefte=(56, hy), t=L(0, 4, x), f1=90, f2=L(110, 128, x), o=180, u=180,
               bein=[(1, (70, BODEN), 1), (2, (38, BODEN - L(0, 3, x)), -1)])


arch("ausfallschritt", "seite", ausfallschritt, punkte=H2)


def bulgarisch(x):
    hy = L(60, 74, x)
    return hal(huefte=(54, hy), t=L(4, 14, x), f1=90, f2=200, o=180, u=180,
               bein=[(1, (66, BODEN), 1), (2, (28, 74), -1)])


arch("bulgarisch", "seite", bulgarisch, szene=[BANK(18, 34, 78)], punkte=H2)


def stepup(x):
    return hal(huefte=(L(54, 64, x), L(56, 37, x)), t=L(10, 0, x), f=90, o=180, u=180,
               bein=[(1, (68, 80.3), 1), (2, (L(46, 62, x), L(BODEN, 80.3, x * x)), 1)])


arch("stepup", "seite", stepup, szene=[("kasten", (56, 82, 84, 104))], punkte=H2)


def beinstrecker(x):
    return hal(huefte=(42, 64), t=-12, o=150, u=150, s=90, w=L(180, 95, x), f=L(90, 10, x))


arch("beinstrecker", "seite", beinstrecker, szene=[BANK(34, 58, 70), ("linie", (34, 70), (28, 34), 4, "dunkel")], punkte=("A1",), anker=(64, 66))


def beincurl(x):
    return hal(huefte=(48, 66), t=90, k=-20, o1=210, u1=220, o2=210, u2=220, s=-90, w=L(-90, 18, x), f=L(180, 100, x))


arch("beincurl", "seite", beincurl, szene=[("linie", (14, 70), (82, 70), 4.6, "dunkel"), ("linie", (48, 70), (48, 104), 2.2)], punkte=("A1",), anker=(25, 64))


def beincurlsitz(x):
    return hal(huefte=(42, 64), t=-10, o=150, u=150, s=90, w=L(92, 196, x), f=L(10, 100, x))


arch("beincurlsitz", "seite", beincurlsitz, szene=[BANK(34, 58, 70), ("linie", (34, 70), (28, 34), 4, "dunkel")], punkte=("A1",), anker=(64, 66))


def hipthrust(id, schulter_y, lh=True):
    def fn(x):
        t = L(-58, -92, x) if schulter_y < 90 else L(-91, -118, x)
        return hal(t=t, f=90, o=88, u=92, punkt=("S0", (32, schulter_y)),
                   bein=[(1, (80, BODEN), -1), (2, (80, BODEN), -1)])
    szene = [BANK(14, 34, schulter_y + 5)] if schulter_y < 90 else []
    arch(id, "seite", fn, szene=szene, punkte=("BECKEN",), anker=(54, 104))


hipthrust("hipthrust", 70)
hipthrust("glutebridge", 96)


def kickbackbein(x):
    return hal(fuss=(2, 52), t=24, s2=180, w2=180, s1=L(178, 236, x), w1=L(186, 226, x), f1=L(90, 140, x),
               arm=[(1, (76, 56), 1), (2, (76, 56), 1)])


arch("kickbackbein", "seite", kickbackbein, szene=[("linie", (78, 40), (78, 104), 2.6, "dunkel")], punkte=("A1",), anker=(102, 100))


def abduktor(x, rein=False):
    # Sitzend, von vorn: Oberschenkel zeigen zum Betrachter (verkürzt), Unterschenkel hängen zur Fußstütze.
    # Abduktoren: Knie drücken die Polster außen auseinander. Adduktoren: Knie drücken die Polster innen zusammen.
    a = L(8, 42, x) if not rein else L(42, 8, x)  # Spreizwinkel der Oberschenkel in der Waagerechten
    dx, dy = 23 * math.sin(math.radians(a)), 4.0  # sichtbarer Teil des Oberschenkels
    os = math.hypot(dx, dy) / 23
    s1 = winkel_zu((0, 0), (dx, dy))
    p = hal("vorn", huefte=(60, 72), t=0, s1=s1, o1=150, u1=176, os=os, f1=0)
    k = gelenke("vorn", p)["K1"]
    w = winkel_zu(k, (67, 99))  # Füße bleiben auf der Fußstütze
    return hal("vorn", huefte=(60, 72), t=0, s1=s1, w1=w, o1=150, u1=176, os=os, f1=0)


_SITZ_V = [("kasten", (46, 40, 74, 76)), ("linie", (40, 76), (80, 76), 4.6, "dunkel"), ("linie", (60, 76), (60, 104), 2.2)]
arch("abduktor", "vorn", abduktor, szene=_SITZ_V, punkte=("KA1", "KA2"), art="POLSTER")
arch("adduktor", "vorn", lambda x: abduktor(x, True), szene=_SITZ_V, punkte=("KI1", "KI2"), art="POLSTER")


def wadenstehend(x):
    return hal(t=0, f=L(90, 128, x), o=200, u=25, punkt=("T1", (62, BODEN)))


arch("wadenstehend", "seite", wadenstehend, szene=[("kasten", (50, 102, 74, 104))], punkte=("NACKEN",), anker=(28, 40))


def wadenstehend_kh(x):
    return hal(t=0, f=L(90, 128, x), o=180, u=180, punkt=("T1", (62, BODEN)))


arch("wadenstehend_kh", "seite", wadenstehend_kh, punkte=H2)


def wadensitzend(x):
    return hal(t=4, s=90, w=180, o=170, u=110, f=L(90, 126, x), punkt=("T1", (68, BODEN)))


arch("wadensitzend", "seite", wadensitzend, szene=[BANK(30, 52, 80)], punkte=("K1",), art="POLSTER")


def wadenpresse(x):
    return hal(huefte=(40, 76), t=-58, o=150, u=150, s=56, w=56, f=L(-40, -4, x) + 90)


arch("wadenpresse", "seite", wadenpresse, szene=_presse_sitz() + [("linie", (50, 66), (92, 18), 1.6)], punkte=("T1",), art="PLATTE", winkel=40)


def kbswing(x):
    t = L(64, -2, x)
    w = L(205, 80, x)
    return hal(fuss=(1, 52), t=t, s=L(140, 180, x), w=L(204, 180, x), o=w, u=w)


arch("kbswing", "seite", kbswing, punkte=H2)


# ================= Rumpf =================
def crunch(x):
    t = L(-88, -52, x)
    return hal(t=t, k=L(0, 10, x), o=t + 150, u=t - 30, punkt=("H", (54, 97.5)), bein=[(1, (78, BODEN), -1), (2, (78, BODEN), -1)], f=90)


arch("crunch", "seite", crunch)


def kabelcrunch(x):
    t = L(20, 96, x)
    return hal(huefte=(50, 79), t=t, k=L(10, 30, x), s=180, w=270, f=268, o=t + 180 - 30, u=t + 10)


arch("kabelcrunch", "seite", kabelcrunch, punkte=("HA1",), anker=(80, 4))


def beinheben(x):
    p = hal(o=-4, u=-4, s=L(162, 84, x), w=L(212, 88, x), f=L(130, 40, x), t=L(0, -10, x), punkt=("HA1", (60, -2)))
    return p


arch("beinheben", "seite", beinheben, szene=[("linie", (34, -2), (88, -2), 2.0, "dunkel")])


def plank(x):
    n = L(11, 12.5, x)
    p = hal(t=-90 + n, s=90 + n, w=90 + n, f=170, k=10, punkt=("T1", (104, 103.5)))
    sx = gelenke("seite", p)["S0"][0]
    return hal(t=-90 + n, s=90 + n, w=90 + n, f=170, k=10, punkt=("T1", (104, 103.5)), arm=[(1, (sx - 14, 102), 1), (2, (sx - 13, 102), 1)])


arch("plank", "seite", plank, dauer=3.6)


def russian(x):
    return hal(huefte=(56, 96), t=-40, k=10, s=56, w=118, f=170, o=L(100, 150, x), u=L(90, 150, x), o2=L(150, 100, x), u2=L(150, 90, x))


arch("russian", "seite", russian, punkte=H2)


def abroller(x):
    t = L(40, 82, x)
    return hal(t=t, s=L(150, 104, x), w=270, f=268, punkt=("K1", (48, 101.5)),
               arm=[(1, (L(66, 94, x), 97.4), 1), (2, (L(66, 94, x), 97.4), 1)])


arch("abroller", "seite", abroller, punkte=("HA1",), art="ROLLE")


def woodchop(x):
    return hal("vorn", fuss=(1, 68), sym=False, o1=L(40, 206, x), u1=L(40, 206, x), o2=L(60, 196, x), u2=L(48, 186, x),
               s1=176, w1=178, s2=-170, w2=-176)


arch("woodchop", "vorn", woodchop, punkte=("HA1",), anker=(110, 6))


# ================= Ausdauer =================
def laufen(x):
    return hal(huefte=(55, 58), t=10, s1=L(148, 214, x), w1=L(196, 250, x), s2=L(214, 148, x), w2=L(250, 196, x),
               f1=L(80, 150, x), f2=L(150, 80, x), o1=L(140, 214, x), u1=L(70, 140, x), o2=L(214, 140, x), u2=L(140, 70, x))


arch("laufen", "seite", laufen, dauer=1.0)


def radfahren(x):
    hu = (44, 53)
    pedal = (58, 88)
    w = L(0, 180, x)
    p1 = (pedal[0] + 8 * math.sin(math.radians(w)), pedal[1] - 8 * math.cos(math.radians(w)))
    p2 = (pedal[0] - 8 * math.sin(math.radians(w)), pedal[1] + 8 * math.cos(math.radians(w)))
    return hal(huefte=hu, t=20, f=100, arm=[(1, (79, 42), -1), (2, (79, 42), -1)], bein=[(1, p1, -1), (2, p2, -1)])


arch("radfahren", "seite", radfahren, dauer=1.2,
     szene=[("linie", (38, 57), (50, 57), 3.4, "dunkel"), ("linie", (44, 58), (48, 104), 2.6, "dunkel"), ("linie", (86, 104), (80, 42), 2.6, "dunkel"),
            ("linie", (76, 42), (84, 42), 3, "dunkel"), ("linie", (47, 92), (58, 88), 2.2, "dunkel"), ("linie", (36, 104), (92, 104), 3, "dunkel")])


def rudergeraet(x):
    # 0 = Auslage (Knie gebeugt, Arme lang), 1 = Endzug
    sitz = (L(52, 34, x), 90)
    t = L(28, -18, x)
    p = hal(huefte=sitz, t=t)
    g = gelenke("seite", p)
    s0 = g["S0"]
    hand = (L(s0[0] + 29, g["H"][0] + 12, x), L(s0[1] + 6, g["H"][1] - 10, x))
    return hal(huefte=sitz, t=t, f=60, arm=[(1, hand, 1), (2, (hand[0] - 1, hand[1]), 1)],
               bein=[(1, (78, 94), -1), (2, (78, 94), -1)])


arch("rudergeraet", "seite", rudergeraet, szene=[("linie", (16, 96), (96, 96), 2.6, "dunkel"), ("linie", (80, 88), (80, 100), 3, "dunkel")], punkte=H2, anker=(100, 82), art="KABEL")


def crosstrainer(x):
    return hal(huefte=(52, 46), t=4, f=90, arm=[(1, (L(66, 78, x), 52), -1), (2, (L(78, 66, x), 52), -1)],
               bein=[(1, (L(46, 66, x), L(88, 84, x)), -1), (2, (L(66, 46, x), L(84, 88, x)), -1)])


arch("crosstrainer", "seite", crosstrainer, dauer=1.4, szene=[("linie", (40, 92), (82, 92), 2.6, "dunkel"), ("linie", (86, 30), (90, 104), 2.6, "dunkel")])


def seilspringen(x):
    hop = math.sin(math.pi * x) * 3
    return hal("vorn", huefte=(60, 57 - hop), s1=176, w1=180, o1=160, u1=110, f1=0)


arch("seilspringen", "vorn", seilspringen, dauer=0.8, punkte=H2, art="SEIL", anker=(60, -6), anker_b=(60, 112))


# ================= Ergänzungen für Import-Übungen =================
def katana(x):
    # Katana Extension von hinten: Kabel kommt unten von der Gegenseite, Hand startet hinter der
    # Gegenschulter (Ellbogen hoch, Arm gebeugt) und streckt diagonal nach oben außen – wie ein Schwert ziehen
    p = hal("hinten", fuss=(1, 66), s1=176, w1=178, o2=176, u2=178)
    g = gelenke("hinten", p)
    s1 = g["S1"]
    start = (56, s1[1] + 1)
    ende = (s1[0] + 21, s1[1] - 21)
    hand = (L(start[0], ende[0], x), L(start[1], ende[1], x))
    return hal("hinten", fuss=(1, 66), s1=176, w1=178, o2=176, u2=178, arm=[(1, hand, -1)])


arch("katana", "hinten", katana, punkte=H1, anker=(10, 100), art="KABEL")


def rotatoren(x):
    # Außenrotation am Kabel von vorn: Ellbogen am Körper, Unterarm waagerecht, dreht von vor dem Bauch nach außen
    phi = L(-62, 72, x)  # Drehwinkel des Unterarms in der Waagerechten (0 = nach vorn)
    dx, dy = 14 * math.sin(math.radians(phi)), 2.5
    u = winkel_zu((0, 0), (dx, dy))
    return hal("vorn", fuss=(1, 66), s1=176, w1=178, o1=176, u1=u, h1=0, ua1=math.hypot(dx, dy) / 14)


arch("rotatoren", "vorn", rotatoren, punkte=H1, anker=(10, 52), art="KABEL")


def schwimmen(x):
    # Kraul von der Seite: Körper waagerecht im Wasser, Arme wechseln, Beine schlagen
    return hal(huefte=(40, 74), t=92, k=-10, o1=L(30, 200, x), u1=L(40, 200, x), o2=L(200, 30, x), u2=L(200, 40, x),
               s1=L(262, 280, x), w1=L(268, 282, x), s2=L(280, 262, x), w2=L(282, 268, x), f1=350, f2=350)


arch("schwimmen", "seite", schwimmen, dauer=1.1, szene=[("linie", (-10, 70), (130, 70), 1.2)])


# Rückfall für unbekannte Übungen: ruhig stehen
arch("stehen_vorn", "vorn", lambda x: hal("vorn", fuss=(1, 66), o1=170, u1=172, s1=177, w1=180, z=L(0, 0.6, x)), dauer=4)
arch("stehen_hinten", "hinten", lambda x: hal("hinten", fuss=(1, 66), o1=170, u1=172, s1=177, w1=180, z=L(0, 0.6, x)), dauer=4)


# ================= Zuordnung Bewegung -> Muster (je Gerät) =================
ZUORDNUNG = {
    "bankdruecken": {"*": "bankdruecken", "ma": "brustpresse"},
    "schraegbank": {"*": "schraegbank", "ma": "brustpresse"},
    "negativbank": {"*": "negativbank", "ma": "brustpresse"},
    "brustpresse": "brustpresse",
    "fliegende": {"*": "fliegende", "kh": "fliegende_bank", "kabel": "kabelcross"},
    "schraegfliegende": {"*": "schraegfliegende", "kabel": "kabelcross"},
    "butterfly": "fliegende",
    "kabelcross": "kabelcross",
    "liegestuetz": "liegestuetz",
    "dips": "dips",
    "kreuzheben": {"*": "kreuzheben", "kh": "kreuzheben_kh", "kb": "kreuzheben_kh"},
    "sumo": "sumo",
    "trapbar": "kreuzheben:LH",
    "rumaenisch": "rumaenisch",
    "klimmzug": "klimmzug",
    "chinup": "chinup",
    "latzug": "latzug",
    "latzugeng": "latzugeng",
    "rudern": "rudern",
    "pendlay": "pendlay",
    "einarm": {"*": "einarm", "kabel": "kabelrudern"},
    "kabelrudern": "kabelrudern",
    "tbar": "tbar",
    "brustgestuetzt": "brustgestuetzt",
    "pullover": {"*": "pullover", "kabel": "pullover_kabel"},
    "shrugs": "shrugs",
    "facepull": "facepull",
    "hyperext": "hyperext",
    "goodmorning": "goodmorning",
    "schulterdruecken": "schulterdruecken",
    "arnold": "arnold",
    "pushpress": "pushpress",
    "seitheben": "seitheben",
    "frontheben": "frontheben",
    "reversefly": "reversefly",
    "aufrechtrudern": "aufrechtrudern",
    "bizepscurl": {"*": "bizepscurl", "ma": "scottcurl"},
    "hammercurl": "bizepscurl",
    "scottcurl": "scottcurl",
    "konzentration": "konzentration",
    "schraegcurl": "schraegcurl",
    "trizepsdruecken": "trizepsdruecken",
    "stirndruecken": "stirndruecken",
    "trizepsueberkopf": "trizepsueberkopf",
    "enges": "bankdruecken",
    "trizepsdips": {"*": "trizepsdips", "ma": "dips"},
    "kickback": "kickback",
    "handgelenk": "handgelenk",
    "farmer": "farmer",
    "kniebeuge": {"*": "kniebeuge", "kh": "kniebeuge_kh"},
    "frontkniebeuge": "frontkniebeuge",
    "goblet": "goblet",
    "hackenschmidt": "hackenschmidt",
    "beinpresse": "beinpresse",
    "ausfallschritt": "ausfallschritt",
    "bulgarisch": "bulgarisch",
    "stepup": "stepup",
    "beinstrecker": "beinstrecker",
    "beincurl": "beincurl",
    "beincurlsitz": "beincurlsitz",
    "hipthrust": "hipthrust",
    "glutebridge": "glutebridge",
    "kickbackbein": "kickbackbein",
    "abduktor": "abduktor",
    "adduktor": "adduktor",
    "wadenstehend": {"*": "wadenstehend", "kh": "wadenstehend_kh", "kg": "wadenstehend_kh", "": "wadenstehend_kh"},
    "wadensitzend": "wadensitzend",
    "wadenpresse": "wadenpresse",
    "kbswing": "kbswing",
    "crunch": "crunch",
    "kabelcrunch": "kabelcrunch",
    "beinheben": "beinheben",
    "plank": "plank",
    "russian": "russian:KH",
    "abroller": "abroller",
    "woodchop": "woodchop",
    "laufen": "laufen",
    "radfahren": "radfahren",
    "rudergeraet": "rudergeraet",
    "crosstrainer": "crosstrainer",
    "seilspringen": "seilspringen",
}
ZUORDNUNG.update({"katana": "katana:KABEL", "rotatoren": {"*": "rotatoren:KABEL", "band": "rotatoren:BAND"}, "schwimmen": "schwimmen"})

# ================= Stichworte für Übungen ohne Katalogtreffer =================
# (Wortanfänge im normierten Namen ohne Gerätewörter, Bewegung aus ZUORDNUNG, Gerätekürzel wenn der Name keins nennt).
# Reihenfolge zählt: das erste passende Stichwort gewinnt.
STICHWORTE = [
    (["katana"], "katana", "kabel"),
    (["rotator", "external rotation", "internal rotation", "aussenrotation", "innenrotation"], "rotatoren", "kabel"),
    (["swim", "schwimm", "kraul", "brustschwimm"], "schwimmen", ""),
    (["iso lateral pulldown", "iso lateral pull down"], "latzug", "ma"),
    (["pulldown", "pull down", "latzug", "lat pull"], "latzug", "kabel"),
    (["pull up", "pullup", "chin", "klimmzug"], "klimmzug", ""),
    (["lateral", "side raise", "seitheben", "seitlich"], "seitheben", "kh"),
    (["front raise", "frontheben"], "frontheben", "kh"),
    (["rear delt", "reverse fly", "reverse butterfly"], "reversefly", "ma"),
    (["face pull"], "facepull", "kabel"),
    (["tricep curl", "triceps curl", "tricep push", "triceps push", "pushdown", "push down", "pressdown"], "trizepsdruecken", "kabel"),
    (["tricep ext", "triceps ext", "overhead ext", "trizeps"], "trizepsueberkopf", "kh"),
    (["skull", "french"], "stirndruecken", "ez"),
    (["kickback"], "kickback", "kh"),
    (["hammer"], "hammercurl", "kh"),
    (["preacher", "scott"], "scottcurl", "ez"),
    (["bicep", "biceps", "bizeps", "curl"], "bizepscurl", "kh"),
    (["shoulder press", "overhead press", "military", "schulterdr"], "schulterdruecken", "ma"),
    (["leg press", "beinpresse"], "beinpresse", "ma"),
    (["leg ext", "beinstreck"], "beinstrecker", "ma"),
    (["leg curl", "beinbeug"], "beincurl", "ma"),
    (["calf", "wade"], "wadenstehend", "ma"),
    (["squat", "kniebeug"], "kniebeuge", "lh"),
    (["decline", "negativ"], "negativbank", "lh"),
    (["incline", "schraeg"], "schraegbank", "lh"),
    (["chest press", "brustpresse"], "brustpresse", "ma"),
    (["fly", "flye", "butterfly", "pec deck"], "fliegende", "ma"),
    (["crossover", "cross over"], "kabelcross", "kabel"),
    (["bench", "bankdr", "press"], "bankdruecken", "lh"),
    (["dip"], "dips", ""),
    (["bock", "back ext", "hyperext", "rueckenstreck", "unterer r"], "hyperext", ""),
    (["deadlift", "kreuzheb"], "kreuzheben", "lh"),
    (["row machine", "rowing", "ergo"], "rudergeraet", ""),
    (["row", "ruder"], "kabelrudern", "kabel"),
    (["shrug"], "shrugs", "kh"),
    (["lunge", "ausfall"], "ausfallschritt", "kh"),
    (["abduct", "abdukt"], "abduktor", "ma"),
    (["adduct", "addukt"], "adduktor", "ma"),
    (["hip thrust", "glute", "bridge"], "hipthrust", "lh"),
    (["crunch", "sit up", "situp", "bauch"], "crunch", ""),
    (["plank", "unterarmst"], "plank", ""),
    (["leg raise", "knee raise", "beinheb"], "beinheben", ""),
    (["bike", "cycl", "rad", "spinning"], "radfahren", ""),
    (["elliptical", "cross trainer", "crosstrain"], "crosstrainer", ""),
    (["run", "jog", "lauf", "treadmill", "cardio", "walk"], "laufen", ""),
]

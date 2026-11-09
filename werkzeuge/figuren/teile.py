"""Teilmuskeln: Quelle für js/muskelteile.js (Web) und Teile.kt (Android). Aufruf: python3 teile.py <web-js> <kotlin-datei>
Jeder Teilmuskel gehört zu einer der 14 Muskelgruppen. Je Bewegung: (Hauptmuskeln, mitarbeitende Muskeln) als Teilmuskeln.
"""
import sys, json

# key: (gruppe, titel, fachbegriff, erholungsstunden, kurz)
TEILE = {
    "BRUST_OBEN": ("BRUST", "Obere Brust", "M. pectoralis major, Pars clavicularis", 60, "BO"),
    "BRUST_MITTE": ("BRUST", "Mittlere Brust", "M. pectoralis major, Pars sternocostalis", 60, "BM"),
    "BRUST_UNTEN": ("BRUST", "Untere Brust", "M. pectoralis major, Pars abdominalis", 60, "BU"),
    "SCHULTER_VORN": ("SCHULTERN", "Vordere Schulter", "M. deltoideus, Pars clavicularis", 48, "SV"),
    "SCHULTER_SEITE": ("SCHULTERN", "Seitliche Schulter", "M. deltoideus, Pars acromialis", 48, "SS"),
    "SCHULTER_HINTEN": ("SCHULTERN", "Hintere Schulter", "M. deltoideus, Pars spinalis", 48, "SH"),
    "ROTATOREN": ("SCHULTERN", "Rotatorenmanschette", "M. infraspinatus, M. teres minor, M. supraspinatus, M. subscapularis", 36, "RO"),
    "BIZEPS": ("BIZEPS", "Bizeps", "M. biceps brachii", 40, "BI"),
    "BRACHIALIS": ("BIZEPS", "Oberarmmuskel (Brachialis)", "M. brachialis", 40, "BR"),
    "TRIZEPS_LANG": ("TRIZEPS", "Trizeps langer Kopf", "M. triceps brachii, Caput longum", 40, "TL"),
    "TRIZEPS_SEITE": ("TRIZEPS", "Trizeps seitlicher und innerer Kopf", "M. triceps brachii, Caput laterale und mediale", 40, "TS"),
    "UNTERARM_BEUGER": ("UNTERARME", "Unterarmbeuger", "M. flexor carpi radialis und ulnaris, M. flexor digitorum", 36, "UB"),
    "UNTERARM_STRECKER": ("UNTERARME", "Unterarmstrecker und Oberarmspeichenmuskel", "M. brachioradialis, M. extensor carpi radialis und ulnaris", 36, "US"),
    "BAUCH_GERADE": ("BAUCH", "Gerader Bauch", "M. rectus abdominis", 36, "BG"),
    "BAUCH_SCHRAEG": ("BAUCH", "Schräge Bauchmuskeln", "M. obliquus externus und internus abdominis", 36, "BS"),
    "QUADRIZEPS": ("QUADRIZEPS", "Quadrizeps", "M. quadriceps femoris", 72, "QU"),
    "ADDUKTOREN": ("ADDUKTOREN", "Adduktoren", "Mm. adductores, M. gracilis", 48, "AD"),
    "LAT": ("LAT", "Latissimus", "M. latissimus dorsi, M. teres major", 60, "LA"),
    "TRAPEZ_OBEN": ("TRAPEZ", "Oberer Trapez (Nacken)", "M. trapezius, Pars descendens", 48, "TO"),
    "TRAPEZ_MITTE": ("TRAPEZ", "Mittlerer Rücken (Trapez, Rautenmuskeln)", "M. trapezius, Pars transversa und ascendens; Mm. rhomboidei", 48, "TM"),
    "UNTERER_RUECKEN": ("UNTERER_RUECKEN", "Rückenstrecker", "M. erector spinae", 72, "UR"),
    "GESAESS_GROSS": ("GESAESS", "Großer Gesäßmuskel", "M. gluteus maximus", 72, "GG"),
    "GESAESS_MITTEL": ("GESAESS", "Mittlerer Gesäßmuskel (Abduktoren)", "M. gluteus medius und minimus, M. tensor fasciae latae", 48, "GM"),
    "BEINBEUGER": ("BEINBEUGER", "Beinbeuger", "M. biceps femoris, M. semitendinosus, M. semimembranosus", 72, "BB"),
    "WADE_GASTRO": ("WADEN", "Zwillingswadenmuskel", "M. gastrocnemius", 36, "WG"),
    "WADE_SOLEUS": ("WADEN", "Schollenmuskel", "M. soleus", 36, "WS"),
}
K = {v[4]: k for k, v in TEILE.items()}

Z = """
bankdruecken BM BU | SV TS TL
schraegbank BO | SV BM TS
negativbank BU | BM TS
brustpresse BM BU | SV TS
fliegende BM | BO BU SV
schraegfliegende BO | SV BM
butterfly BM | BO BU
kabelcross BU BM | SV
liegestuetz BM BU | SV TS BG
dips BU TS TL | SV BM
kreuzheben BB GG UR | QU TO TM UB LA AD
sumo GG QU AD | BB UR TO
trapbar QU GG | BB UR TO UB
rumaenisch BB GG | UR UB
klimmzug LA | BI BR TM SH UB
chinup LA BI | BR TM UB
latzug LA | BI BR TM SH
latzugeng LA | BI BR TM
rudern LA TM | SH BI BR UR
pendlay LA TM | SH BI BR UR
einarm LA | TM SH BI BR
kabelrudern TM LA | SH BI BR UB
tbar LA TM | SH BI UR
brustgestuetzt TM LA | SH BI BR
pullover LA | BU TL
shrugs TO | UB TM
facepull SH RO | TM
hyperext UR | GG BB
goodmorning BB UR | GG
schulterdruecken SV | SS TS TL TO
arnold SV SS | TS
pushpress SV | SS TS QU GG
seitheben SS | SV TO
frontheben SV | BO SS
reversefly SH | TM RO
aufrechtrudern SS TO | SV BI
bizepscurl BI | BR UB
hammercurl BR US | BI
scottcurl BI | BR
konzentration BI | BR
schraegcurl BI | BR
trizepsdruecken TS | TL
stirndruecken TL TS |
trizepsueberkopf TL | TS
enges TS TL BM | SV
trizepsdips TS TL | BU SV
trizepsmaschine TS TL | BU SV
kickback TL TS |
handgelenk UB | US
kniebeuge QU GG | AD UR BB
frontkniebeuge QU | GG BG UR
goblet QU GG | AD BG
hackenschmidt QU | GG AD
bulgarisch_hack QU GG | AD GM BB
beinpresse QU GG | AD
ausfallschritt QU GG | AD GM BB
bulgarisch QU GG | AD GM
stepup QU GG | GM
beinstrecker QU |
beincurl BB | WG
beincurlsitz BB |
hipthrust GG | BB GM
glutebridge GG | BB
kickbackbein GG | GM BB
abduktor GM | GG
adduktor AD |
wadenstehend WG | WS
wadensitzend WS | WG
wadenpresse WG | WS
kbswing GG BB | UR SV UB
crunch BG | BS
kabelcrunch BG | BS
beinheben BG | BS
plank BG | BS SV
russian BS | BG
abroller BG | LA BS
woodchop BS | BG
laufen QU | WG WS BB GG
radfahren QU | GG BB WG
rudergeraet QU LA | GG BB BI TM UR
crosstrainer QU | GG BB WG
seilspringen WG | WS
katana TL TS |
rotatoren RO | SH TM
schwimmen LA SV | TL BM BG RO
"""
ZUORDNUNG = {}
for z in Z.strip().splitlines():
    a, b = z.split("|")
    key, *p = a.split()
    ZUORDNUNG[key] = ([K[x] for x in p], [K[x] for x in b.split()])


def js():
    o = ["// Erzeugt von werkzeuge/figuren/teile.py – nicht von Hand ändern.",
         "/** Teilmuskeln je Muskelgruppe: [gruppe], [titel], [fach] (Fachbegriff), [erholungStunden]. */",
         "export const Teil = {"]
    for k, (g, t, f, h, _) in TEILE.items():
        o.append(f"  {k}: {{ gruppe: '{g}', titel: {json.dumps(t, ensure_ascii=False)}, fach: {json.dumps(f, ensure_ascii=False)}, erholungStunden: {h} }},")
    o.append("};")
    o.append("export const TEILE = Object.keys(Teil);")
    o.append("/** Je Bewegung: [Hauptmuskeln, mitarbeitende Muskeln] als Teilmuskeln. */")
    o.append("export const TEIL_ZUORDNUNG = {")
    for k, (p, s) in ZUORDNUNG.items():
        o.append(f"  {k}: [{json.dumps(p)}, {json.dumps(s)}],".replace('"', "'"))
    o.append("};")
    return "\n".join(o) + "\n"


def kt():
    o = ["package de.dachapp.krafttraining.logic", "", "// Erzeugt von werkzeuge/figuren/teile.py – nicht von Hand ändern.", "",
         "/** Teilmuskel einer [Muskel]-Gruppe mit Fachbegriff und grober Erholungszeit. */",
         "enum class Teil(val gruppe: Muskel, val titel: String, val fach: String, val erholungStunden: Double) {"]
    for k, (g, t, f, h, _) in TEILE.items():
        o.append(f"    {k}(Muskel.{g}, {json.dumps(t, ensure_ascii=False)}, {json.dumps(f, ensure_ascii=False)}, {h}.0),")
    o.append("}")
    o.append("")
    o.append("internal object TeilDaten {")
    o.append("    /** Je Bewegung: Hauptmuskeln und mitarbeitende Muskeln als Teilmuskeln. */")
    o.append("    val zuordnung: Map<String, Pair<List<Teil>, List<Teil>>> = mapOf(")
    for k, (p, s) in ZUORDNUNG.items():
        lp = ", ".join("Teil." + x for x in p); ls = ", ".join("Teil." + x for x in s)
        o.append(f'        "{k}" to (listOf({lp}) to {"listOf(" + ls + ")" if s else "emptyList()"}),')
    o.append("    )")
    o.append("}")
    return "\n".join(o) + "\n"


if __name__ == "__main__":
    open(sys.argv[1], "w").write(js())
    open(sys.argv[2], "w").write(kt())

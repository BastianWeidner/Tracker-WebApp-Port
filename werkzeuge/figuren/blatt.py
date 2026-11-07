import sys
sys.path.insert(0, '.')
import haltungen, katalog
from zeichnen import bild
from modell import lerp_haltung
K = katalog.lade()
def muster(key, g):
    z = haltungen.ZUORDNUNG.get(key)
    if isinstance(z, dict):
        z = z.get(katalog.KURZ[g], z['*'])
    m, _, art = z.partition(':')
    return m, art or None
def frame(a, x):
    b = a['bilder']; n = len(b) - 1
    i = min(int(x * n), n - 1); f = x * n - i
    return lerp_haltung(b[i], b[i + 1], f)
def zeile(key, g):
    m, art = muster(key, g); a = haltungen.A[m]; k = K[key]; g = art or g
    cells = [bild(frame(a, x), k['primaer'], k['sekundaer'], szene=a['szene'], last=a['last'], geraet=g, ansicht=a['ansicht'], fx=x) for x in (0, 0.5, 1)]
    return f'<div style="display:flex;align-items:center;gap:2px;border-bottom:1px solid #ddd"><b style="width:110px;font:11px sans-serif">{key}<br>{g}<br>→{m}</b>{"".join(cells)}</div>'
args = sys.argv[1:]
paare = []
for key, k in K.items():
    for g in (k['geraete'] if '--alle' in args else k['geraete'][:1]):
        paare.append((key, g))
wahl = [a for a in args if not a.startswith('--')]
if wahl: paare = [p for p in paare if p[0] in wahl]
seiten = [paare[i:i + 12] for i in range(0, len(paare), 12)]
for n, s in enumerate(seiten):
    open(f'blatt{n}.html', 'w').write('<html><body style="margin:2px;background:#fff">' + ''.join(zeile(*p) for p in s) + '</body></html>')
print(len(seiten))

import sys, importlib
sys.path.insert(0, '.')
import haltungen
from zeichnen import bild
args = sys.argv[1:]
ids = [a for a in args if not a.startswith('--')] or list(haltungen.A)
GER = {'bankdruecken':'LH','schraegbank':'LH','negativbank':'LH','rudern':'LH','pendlay':'LH','kreuzheben':'LH','rumaenisch':'LH','kniebeuge':'LH','frontkniebeuge':'LH','goodmorning':'LH','sumo':'LH','pushpress':'LH','aufrechtrudern':'LH','bizepscurl':'KH','kreuzheben_kh':'KH','kniebeuge_kh':'KH','einarm':'KH','pullover':'KH','fliegende_bank':'KH','schraegfliegende':'KH','shrugs':'KH','schulterdruecken':'KH','arnold':'KH','seitheben':'KH','frontheben':'KH','reversefly':'KH','scottcurl':'EZ','konzentration':'KH','schraegcurl':'KH','stirndruecken':'EZ','trizepsueberkopf':'KH','kickback':'KH','handgelenk':'LH','farmer':'KH','goblet':'KH','ausfallschritt':'KH','bulgarisch':'KH','stepup':'KH','wadenstehend_kh':'KH','kbswing':'KB','russian':'KH','hipthrust':'LH','glutebridge':'LH','trizepsdruecken':'KABEL','facepull':'KABEL','kabelrudern':'KABEL','kabelcross':'KABEL','fliegende':'MASCHINE','brustpresse':'MASCHINE','latzug':'KABEL','latzugeng':'KABEL','pullover_kabel':'KABEL','kabelcrunch':'KABEL','woodchop':'KABEL','schraegcurl':'KH','beinstrecker':'MASCHINE','beincurl':'MASCHINE','beincurlsitz':'MASCHINE','brustgestuetzt':'MASCHINE','kickbackbein':'KABEL','wadenstehend':'MASCHINE','dips':'MASCHINE'}
def frame(a, x):
    from modell import lerp_haltung
    b = a['bilder']; n = len(b) - 1
    i = min(int(x * n), n - 1); f = x * n - i
    return lerp_haltung(b[i], b[i + 1], f)
XS = [i/8 for i in range(9)] if '--fein' in args else (0, .25, .5, .75, 1)
rows = []
for id in ids:
    a = haltungen.A[id]
    cells = [bild(frame(a, x), ['X'], [], szene=a['szene'], last=a['last'], geraet=GER.get(id), ansicht=a['ansicht'], fx=x) for x in XS]
    rows.append(f'<div style="display:flex;align-items:center;border-bottom:1px solid #ccc"><b style="width:90px;font:12px sans-serif">{id}<br>{a["ansicht"]}</b>{"".join(cells)}</div>')
pro = int(next((a[2:] for a in args if a.startswith('--') and a[2:].isdigit()), 8))
for n in range(0, len(rows), pro):
    open(f'm{n//pro}.html', 'w').write('<html><body style="margin:2px;background:#fff;width:1240px">' + ''.join(rows[n:n+pro]) + '</body></html>')
print((len(rows)+pro-1)//pro)

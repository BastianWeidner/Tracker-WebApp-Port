"""Schreibt die Figurendaten für Web (JS) und Android (Kotlin) sowie Referenzwerte für Tests."""
import json, sys
import haltungen, modell

def r(v):
    if isinstance(v, float):
        return round(v, 2)
    if isinstance(v, (list, tuple)):
        return [r(x) for x in v]
    if isinstance(v, dict):
        return {k: r(x) for k, x in v.items()}
    return v

def szene_json(el):
    t = el[0]
    if t == 'bank':
        return {'typ': 'bank', 'p': [*el[1], *el[2]]}
    if t == 'linie':
        return {'typ': 'linie', 'p': [*el[1], *el[2]], 'b': el[3] if len(el) > 3 else 2, 'dunkel': len(el) > 4 and el[4] == 'dunkel'}
    if t == 'kasten':
        return {'typ': 'kasten', 'p': list(el[1])}
    raise ValueError(t)

def daten():
    muster = {}
    for id, a in haltungen.A.items():
        last = dict(a['last'])
        m = {'id': id, 'ansicht': a['ansicht'], 'dauer': a['dauer'], 'bilder': a['bilder'], 'szene': [szene_json(e) for e in a['szene']]}
        if last.get('punkte'):
            l = {'punkte': last['punkte']}
            for k in ('anker', 'anker_b'):
                if k in last:
                    l[k] = [list(p) for p in last[k]]
            for k in ('art', 'winkel', 'stange'):
                if k in last:
                    l[k] = last[k]
            m['last'] = l
        muster[id] = m
    return r({'muster': muster, 'zuordnung': haltungen.ZUORDNUNG})

def referenz():
    # Gelenke und Muskelflächen einiger Haltungen, damit JS und Kotlin gegen Python prüfen können
    out = []
    for id in ('kniebeuge', 'latzug', 'seitheben', 'bankdruecken'):
        a = haltungen.A[id]
        h = a['bilder'][2]
        g = modell.gelenke(a['ansicht'], h)
        f = modell.muskelflaechen(a['ansicht'], g)
        out.append({'muster': id, 'ansicht': a['ansicht'], 'haltung': h,
                    'gelenke': {k: [round(v[0], 3), round(v[1], 3)] for k, v in g.items()},
                    'flaechen': [[x[0], x[1], round(x[2][0], 3), round(x[2][1], 3), round(x[3], 3), round(x[4], 3), round(x[5], 2), x[6]] for x in f]})
    return out

def _haupt():
    d = daten()
    json.dump(d, open('figuren.json', 'w'), separators=(',', ':'), ensure_ascii=False)
    json.dump(referenz(), open('referenz.json', 'w'), separators=(',', ':'))
    print(len(d['muster']), 'Muster', len(json.dumps(d, separators=(',', ':'))), 'Bytes')


def kotlin(pfad):
    text = json.dumps(daten(), separators=(',', ':'), ensure_ascii=True)
    assert '$' not in text and '"""' not in text
    teile = [text[i:i + 20000] for i in range(0, len(text), 20000)]
    k = ['package de.dachapp.krafttraining.logic', '', '// Erzeugt von werkzeuge/figuren/export.py – nicht von Hand ändern.',
         '/** Haltungen und Zuordnung der Übungsbilder als JSON (gleiche Daten wie js/figuren-daten.js der Web-App). */',
         'internal object FigurenDaten {', '    fun json(): String = listOf(']
    k += [f'        """{t}""",' for t in teile]
    k += ['    ).joinToString("")', '}', '']
    open(pfad, 'w').write('\n'.join(k))


if __name__ == '__main__':
    _haupt()
    if len(sys.argv) > 1:
        kotlin(sys.argv[1])

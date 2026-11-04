"""Schreibt sw.js aus sw.vorlage.js: Liste aller Dateien der App und eine Version aus deren Inhalt.
Aufruf im App-Ordner: python3 werkzeuge/sw-bauen.py"""
import hashlib, json, os
wurzel = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(wurzel)
kern, rest = ['./', 'index.html', 'manifest.webmanifest'], []
h = hashlib.sha256()
for ordner in ['css', 'js', 'fonts', 'icons', 'vendor', 'daten']:
    for d, _, dateien in sorted(os.walk(ordner)):
        for f in sorted(dateien):
            p = os.path.join(d, f).replace(os.sep, '/')
            if p.endswith(('.txt', '.map')) or '/lizenzen/' in p:
                continue
            h.update(p.encode()); h.update(open(p, 'rb').read())
            (rest if p.startswith(('vendor/tesseract', 'daten/')) else kern).append(p)
for p in ['index.html', 'manifest.webmanifest']:
    h.update(open(p, 'rb').read())
v = open('sw.vorlage.js').read()
v = v.replace('__VERSION__', h.hexdigest()[:12]).replace('__KERN__', json.dumps(kern)).replace('__REST__', json.dumps(rest))
open('sw.js', 'w').write(v)
print('sw.js:', len(kern), 'Kern-Dateien,', len(rest), 'weitere, Version', h.hexdigest()[:12])

"""Baut daten/namen.tsv.gz aus den Datenbank-Teilen: je Produkt „Suchtext<TAB>EAN“, Suchtext aus Name und Marke wie
Suchtext.normal in der Android-App (klein, Umlaute und ae/oe/ue → a/o/u, ß → ss, ohne Akzente und Satzzeichen).
Aufruf im App-Ordner: python3 werkzeuge/namen-index.py"""
import glob, gzip, re, unicodedata, os
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
def normal(s):
    s = s.lower().replace('ä', 'a').replace('ö', 'o').replace('ü', 'u').replace('ß', 'ss')
    s = ''.join(c for c in unicodedata.normalize('NFD', s) if not unicodedata.combining(c))
    s = s.replace('ae', 'a').replace('oe', 'o').replace('ue', 'u')
    return re.sub(r'[^a-z0-9]+', ' ', s).strip()
zeilen = []
for f in sorted(glob.glob('daten/naehrwerte/*.tsv.gz')):
    for z in gzip.open(f, 'rt', encoding='utf-8'):
        t = z.rstrip('\n').split('\t')
        if len(t) < 3: continue
        n = normal(t[1] + ' ' + t[2])
        if n: zeilen.append(f'{n}\t{t[0]}')
with gzip.open('daten/namen.tsv.gz', 'wt', encoding='ascii', compresslevel=9) as f:
    f.write('\n'.join(zeilen) + '\n')
print(len(zeilen), os.path.getsize('daten/namen.tsv.gz'))

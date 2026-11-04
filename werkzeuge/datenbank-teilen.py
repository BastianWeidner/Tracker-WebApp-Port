"""Teilt die Nährwert-Datenbank der Android-App (naehrwerte.bin.gz, Format DACHNW01) in 100 Teile fürs Web.
Aufruf: python3 werkzeuge/datenbank-teilen.py <naehrwerte.bin.gz> daten/naehrwerte"""
import gzip, struct, sys, os
src, out = sys.argv[1], sys.argv[2]
b = gzip.open(src).read()
print("raw", len(b))
assert b[:8] == b"DACHNW01"
p = 8
n = struct.unpack(">i", b[p:p+4])[0]; p += 4
def utf(p):
    l = struct.unpack(">H", b[p:p+2])[0]
    s = b[p+2:p+2+l].replace(b"\xc0\x80", b"\x00").decode("utf-8", "surrogatepass")
    s = s.encode("utf-16", "surrogatepass").decode("utf-16")
    return s, p+2+l
stand, p = utf(p); quelle, p = utf(p)
idx = p; txt = idx + n*12
shards = {}
for i in range(n):
    ean, pos = struct.unpack(">qi", b[idx+i*12: idx+i*12+12])
    t, _ = utf(txt+pos)
    t = t.replace("\n", " ")
    shards.setdefault((ean//10) % 100, []).append(f"{ean}\t{t}")
os.makedirs(out, exist_ok=True)
tot = 0
for k, v in shards.items():
    data = ("\n".join(v) + "\n").encode()
    with gzip.open(f"{out}/{k:02d}.tsv.gz", "wb", 9) as f: f.write(data)
    tot += os.path.getsize(f"{out}/{k:02d}.tsv.gz")
import json
json.dump({"anzahl": n, "stand": stand, "quelle": quelle, "shards": 100}, open(f"{out}/info.json", "w"), ensure_ascii=False)
print(n, stand, quelle, "gz total", tot, "max shard", max(len(v) for v in shards.values()))

import re
SRC='/mnt/project-files/dach-app/features/krafttraining/logic/src/main/kotlin/de/dachapp/krafttraining/logic/Katalog.kt'
GER={'L':'LH','K':'KH','C':'KABEL','M':'MASCHINE','S':'SMITH','E':'EZ','KB':'KB','B':'BAND','KG':'KOERPER','null':None}
KURZ={'LH':'lh','KH':'kh','KABEL':'kabel','MASCHINE':'ma','SMITH':'smith','EZ':'ez','KB':'kb','BAND':'band','KOERPER':'kg',None:''}
def lade():
    out={}
    for m in re.finditer(r'Bewegung\("(\w+)", "([^"]+)", listOf\([^)]*\), listOf\(([^)]*)\)(?:, (?:listOf\(([^)]*)\)|emptyList\(\)))?(?:, listOf\(([^)]*)\))?',open(SRC).read()):
        key,name,p,s,g=m.groups()
        sp=lambda t:[x.strip() for x in (t or '').split(',') if x.strip()]
        out[key]=dict(name=name,primaer=sp(p),sekundaer=sp(s),geraete=[GER[x] for x in sp(g)] or [None])
    return out

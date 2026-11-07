# Übungsbilder entwerfen

Selbst gezeichnete Figuren (keine fremden Bilder). Eine Figur hat Rumpf, Kopf, zwei Arme und zwei Beine; jede
Haltung sind 17 Zahlen (Hüfte, Winkel von Rumpf, Kopf, Armen, Beinen, Füßen). Eine Bewegung besteht aus fünf
Schlüsselbildern, die App spielt sie hin und her.

- `modell.py`: Gelenke und Muskelflächen (muss zu `js/figuren.js` und `Figuren.kt` der Android-App passen).
- `haltungen.py`: je Bewegungsmuster eine Funktion `fn(x)` von Start (0) bis Endstellung (1), Szene (Bank, Stange),
  Last (Hände, Anker für Kabel/Maschine) und die Zuordnung Bewegung → Muster je Gerät (`ZUORDNUNG`).
- `export.py`: schreibt `figuren.json` und `referenz.json` (Testwerte); mit Pfad als Argument zusätzlich
  `FigurenDaten.kt` für Android.
- `blatt.py` + `zeichnen.py`: Übersicht als HTML (Start, Mitte, Ende je Übung) zum Prüfen; liest die Muskeln aus
  dem Android-Katalog (Pfad in `katalog.py`).

Übernehmen in die Web-App:

```sh
cd werkzeuge/figuren && python3 export.py
(echo "// Erzeugt von werkzeuge/figuren/export.py – nicht von Hand ändern."; echo -n "export default "; cat figuren.json; echo ";") > ../../js/figuren-daten.js
cp referenz.json ../../test/daten/figuren-referenz.json
cd ../.. && node test/figuren.test.mjs && python3 werkzeuge/sw-bauen.py
```

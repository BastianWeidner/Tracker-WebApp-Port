// Nährwerte als Bild teilen (Insta-Story und Co.), wie Teilbild.kt + Teilen.kt der Android-App:
// PNG mit durchsichtigem Hintergrund, weiße Nunito mit Schatten, 1080 px breit. Ohne Abhängigkeiten, Logik in Node testbar.

/** Ganze Zahl mit Tausenderpunkt, z. B. 2450.4 → „2.450“. */
export function tausender(d) {
  if (!Number.isFinite(d)) return '–';
  const n = Math.round(d);
  const s = String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return n < 0 ? `-${s}` : s;
}

/** Inhalt des Bilds: [ziel] (Tagesziele) nur für einen ganzen Tag, dann „Wert / Ziel“. */
export function inhalt(titel, n, mitFett, ziel = null) {
  const z = (w, zw) => tausender(w) + (zw > 0 ? ` / ${tausender(zw)}` : '');
  const makros = [
    { zahl: z(n.eiweiss, ziel?.eiweiss), einheit: 'g', name: 'Protein' },
    { zahl: z(n.kohlenhydrate, ziel?.kohlenhydrate), einheit: 'g', name: 'Carbs' },
  ];
  if (mitFett) makros.push({ zahl: z(n.fett, ziel?.fett), einheit: 'g', name: 'Fett' });
  return {
    titel: (titel || '').trim() || 'Heute',
    kcal: { zahl: z(n.kcal, ziel?.kcal), einheit: 'kcal' },
    makros,
    fusszeile: 'Food & Boost',
    signatur: 'by BW',
  };
}

/** Dateiname ohne Sonderzeichen, z. B. „food-boost-muesli.png“. */
export function dateiname(teil) {
  const t = String(teil).toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/, '');
  return `food-boost-${t || 'werte'}.png`;
}

/** Zeichnet [inh] auf eine neue Leinwand (Browser). Vorher sollten die Schriften geladen sein (schriftenLaden). */
export function zeichnen(inh) {
  const breite = 1080, rand = 64, innen = breite - 2 * rand, abstand = 28;
  const c = document.createElement('canvas');
  let g = c.getContext('2d');
  const schrift = (gewicht, px) => `${gewicht} ${px}px Nunito, system-ui, sans-serif`;
  const mess = (f, t) => { g.font = f; return g.measureText(t).width; };
  const passend = (gewicht, px, t, platz) => { const w = mess(schrift(gewicht, px), t); return w > platz ? px * platz / w : px; };
  const hoehe = (px) => px * 1.364; // Nunito: ascent + descent ≈ 1,364 em

  const titelPx = passend(700, 56, inh.titel, innen);
  let kzPx = 200, kePx = 72;
  const kb = () => mess(schrift(800, kzPx), inh.kcal.zahl) + 20 + mess(schrift(700, kePx), inh.kcal.einheit);
  if (kb() > innen) { const f = innen / kb(); kzPx *= f; kePx *= f; }
  const n = Math.max(1, inh.makros.length), spalte = innen / n;
  let mzPx = n > 2 ? 104 : 124, mePx = n > 2 ? 52 : 60;
  const mnPx = n > 2 ? 44 : 50;
  const mw = Math.max(...inh.makros.map((m) => mess(schrift(800, mzPx), m.zahl) + 10 + mess(schrift(700, mePx), m.einheit)));
  if (mw > spalte - 24) { const f = (spalte - 24) / mw; mzPx *= f; mePx *= f; }
  const fussPx = 38, sigPx = 28;

  const gesamt = rand + hoehe(titelPx) + abstand + hoehe(kzPx) + abstand + hoehe(mzPx) + hoehe(mnPx) + abstand * 1.5 + hoehe(fussPx) + hoehe(sigPx) + rand;
  c.width = breite;
  c.height = Math.ceil(gesamt);
  g = c.getContext('2d'); // nach Größenänderung frischer Zustand, Hintergrund bleibt durchsichtig
  g.textBaseline = 'alphabetic';
  g.fillStyle = '#ffffff';
  const text = (t, gewicht, px, x, grund, alpha = 1) => {
    g.font = schrift(gewicht, px);
    g.globalAlpha = alpha;
    g.shadowColor = 'rgba(0,0,0,0.67)';
    g.shadowBlur = px / 4.5;
    g.shadowOffsetY = px / 30;
    g.fillText(t, x, grund);
  };
  const asc = (px) => px * 1.011; // Nunito-Ascent
  const mittig = (t, gewicht, px, y, alpha) => text(t, gewicht, px, breite / 2 - mess(schrift(gewicht, px), t) / 2, y + asc(px), alpha);

  let y = rand;
  mittig(inh.titel, 700, titelPx, y, 0.92);
  y += hoehe(titelPx) + abstand;
  const wz = mess(schrift(800, kzPx), inh.kcal.zahl);
  const x0 = breite / 2 - kb() / 2;
  text(inh.kcal.zahl, 800, kzPx, x0, y + asc(kzPx));
  text(inh.kcal.einheit, 700, kePx, x0 + wz + 20, y + asc(kzPx));
  y += hoehe(kzPx) + abstand;
  const nameY = y + hoehe(mzPx);
  inh.makros.forEach((m, i) => {
    const mitte = rand + spalte * i + spalte / 2;
    const w = mess(schrift(800, mzPx), m.zahl);
    const xs = mitte - (w + 10 + mess(schrift(700, mePx), m.einheit)) / 2;
    text(m.zahl, 800, mzPx, xs, y + asc(mzPx));
    text(m.einheit, 700, mePx, xs + w + 10, y + asc(mzPx));
    text(m.name, 700, mnPx, mitte - mess(schrift(700, mnPx), m.name) / 2, nameY + asc(mnPx), 0.9);
  });
  y = nameY + hoehe(mnPx) + abstand * 1.5;
  mittig(inh.fusszeile, 700, fussPx, y, 0.78);
  y += hoehe(fussPx);
  mittig(inh.signatur, 700, sigPx, y, 0.7);
  return c;
}

/** Nunito in den Gewichten fürs Bild laden, sonst zeichnet die Leinwand beim ersten Mal mit Ersatzschrift. */
export async function schriftenLaden() {
  try { await Promise.all([document.fonts.load('800 100px Nunito'), document.fonts.load('700 100px Nunito')]); } catch (e) { /* Ersatzschrift */ }
}

/** Leinwand als PNG über das Teilen-Menü anbieten, sonst herunterladen. false = abgebrochen. */
export async function teilen(leinwand, name) {
  const blob = await new Promise((ok) => leinwand.toBlob(ok, 'image/png'));
  const datei = new File([blob], name, { type: 'image/png' });
  try {
    if (navigator.canShare?.({ files: [datei] })) {
      await navigator.share({ files: [datei] });
      return true;
    }
  } catch (e) {
    if (e.name === 'AbortError') return false;
  }
  const url = URL.createObjectURL(datei);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return true;
}

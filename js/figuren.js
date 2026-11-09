// Übungsbilder: animierte Figur mit Gerät und farbig markierten Muskeln (Port von FigurBild.kt / Figuren.kt der Android-App).
// Die Haltungen stehen in figuren-daten.js (erzeugt aus werkzeuge/figuren/, nicht von Hand ändern).
import { html, useEffect, useRef } from '../vendor/preact-htm.js';
import DATEN from './figuren-daten.js';
import { Geraet, finde, zerlege, Teile, Teil } from './training-logik.js';

const L_RUMPF = 30, L_OA = 16, L_UA = 14, L_HAND = 3, L_OS = 23, L_US = 22, L_FUSS = 8, L_FERSE = 2.5;
const SCHULTER_BREIT = 10, HUEFTE_BREIT = 5.5;

const d = (a) => { const r = (a * Math.PI) / 180; return [Math.sin(r), -Math.cos(r)]; };
const add = (p, v, s = 1) => [p[0] + v[0] * s, p[1] + v[1] * s];

/** Gelenkpunkte einer Haltung (17 Zahlen: hx hy t k z o1 u1 h1 o2 u2 h2 s1 w1 f1 s2 w2 f2;
 * optional 18.: Längenfaktor Oberschenkel, 19.: Längenfaktor Unterarm 1, 20.: Längenfaktor beider Arme,
 * wenn das Glied zum Betrachter zeigt). */
export function gelenke(ansicht, h) {
  const g = {};
  const H = [h[0], h[1]];
  const [t, k, z] = [h[2], h[3], h[4]];
  const os = h.length > 17 ? h[17] : 1, ua1 = h.length > 18 ? h[18] : 1, af = h.length > 19 ? h[19] : 1;
  g.H = H;
  let sh, hu;
  if (ansicht === 'seite') {
    const S0 = add(H, d(t), L_RUMPF);
    g.S0 = S0;
    g.KOPF = add(S0, d(t + k), 9);
    const S = add(S0, d(t), z);
    sh = [S, S]; hu = [H, H];
  } else {
    const N = add(H, d(t), L_RUMPF);
    g.S0 = N;
    g.KOPF = add(N, d(t + k), 8.5);
    const p = d(t + 90);
    const basis = add(N, d(t), -3 + z);
    sh = [add(basis, p, SCHULTER_BREIT), add(basis, p, -SCHULTER_BREIT)];
    hu = [add(H, p, HUEFTE_BREIT), add(H, p, -HUEFTE_BREIT)];
  }
  const dt = d(t);
  const vn = [-dt[1], dt[0]];
  if (ansicht === 'seite') {
    g.NACKEN = add(add(g.S0, vn, -4.6), dt, -1.5);
    g.BRUST = add(add(H, dt, 23), vn, 7.5);
    g.BECKEN = add(add(H, dt, 2), vn, 7.5);
  } else {
    g.NACKEN = add(g.S0, dt, -2);
    g.BRUST = add(H, dt, 22);
    g.BECKEN = add(H, dt, 2);
  }
  [[5, 6, 7, 11, 12, 13], [8, 9, 10, 14, 15, 16]].forEach(([oi, ui, hi, si, wi, fi], i) => {
    const n = i + 1;
    const S = sh[i];
    const E = add(S, d(h[oi]), L_OA * af);
    const W = add(E, d(h[ui]), L_UA * af * (i === 0 ? ua1 : 1));
    const K = add(hu[i], d(h[si]), L_OS * os);
    const A = add(K, d(h[wi]), L_US);
    Object.assign(g, { ['S' + n]: S, ['E' + n]: E, ['W' + n]: W, ['HA' + n]: add(W, d(h[ui] + h[hi]), L_HAND), ['HU' + n]: hu[i], ['K' + n]: K, ['A' + n]: A });
    if (ansicht === 'seite') {
      g['T' + n] = add(A, d(h[fi]), L_FUSS);
      g['F' + n] = add(A, d(h[fi]), -L_FERSE);
    } else {
      g['T' + n] = add(A, d(h[wi] + (i === 0 ? 25 : -25)), 4.5);
      g['F' + n] = A;
      // Knie außen/innen (Polster der Abduktoren-/Adduktorenmaschine)
      const p = d(t + 90), sg = i === 0 ? 1 : -1;
      g['KA' + n] = add(K, p, 3.8 * sg);
      g['KI' + n] = add(K, p, -3.8 * sg);
    }
  });
  return g;
}

// (muskel, segment, u0, u1, v, halbbreite) wie modell.py
const MUSKELN = {
  seite: [
    ['UNTERER_RUECKEN', 'rumpf', 0.05, 0.42, -4.4, 2.0],
    ['LAT', 'rumpf', 0.38, 0.86, -4.7, 2.6],
    ['TRAPEZ_MITTE', 'rumpf', 0.70, 0.92, -3.9, 2.0],
    ['TRAPEZ_OBEN', 'rumpf', 0.90, 1.10, -3.2, 2.0],
    ['ROTATOREN', 'rumpf', 0.74, 0.90, -2.2, 1.3],
    ['BAUCH_SCHRAEG', 'rumpf', 0.12, 0.55, 2.4, 1.8],
    ['BAUCH_GERADE', 'rumpf', 0.10, 0.58, 4.6, 1.5],
    ['BRUST_UNTEN', 'rumpf', 0.58, 0.72, 4.9, 2.6],
    ['BRUST_MITTE', 'rumpf', 0.70, 0.84, 5.0, 2.8],
    ['BRUST_OBEN', 'rumpf', 0.82, 0.95, 4.5, 2.4],
    ['GESAESS_MITTEL', 'os', -0.22, 0.08, -1.2, 2.6],
    ['GESAESS_GROSS', 'os', -0.12, 0.34, -3.4, 3.4],
    ['ADDUKTOREN', 'os', 0.10, 0.55, 0.2, 1.6],
    ['BEINBEUGER', 'os', 0.32, 0.92, -2.4, 2.3],
    ['QUADRIZEPS', 'os', 0.10, 0.92, 2.3, 2.7],
    ['WADE_GASTRO', 'us', 0.06, 0.46, -1.8, 2.1],
    ['WADE_SOLEUS', 'us', 0.40, 0.72, -1.3, 1.5],
    ['TRIZEPS_SEITE', 'oa', 0.28, 0.80, -1.2, 1.5],
    ['TRIZEPS_LANG', 'oa', 0.40, 0.92, -1.9, 1.1],
    ['BIZEPS', 'oa', 0.34, 0.88, 1.6, 1.7],
    ['BRACHIALIS', 'oa', 0.62, 0.94, 0.6, 1.0],
    ['SCHULTER_SEITE', 'oa', -0.10, 0.36, 0.0, 2.6],
    ['SCHULTER_VORN', 'oa', -0.08, 0.40, 1.7, 1.9],
    ['SCHULTER_HINTEN', 'oa', -0.08, 0.40, -1.7, 1.9],
    ['UNTERARM_BEUGER', 'ua', 0.04, 0.66, 0.8, 1.3],
    ['UNTERARM_STRECKER', 'ua', 0.04, 0.66, -0.8, 1.3],
  ],
  vorn: [
    ['LAT', 'rumpf', 0.44, 0.74, 6.6, 1.4],
    ['LAT', 'rumpf', 0.44, 0.74, -6.6, 1.4],
    ['ROTATOREN', 'rumpf', 0.84, 0.94, 6.8, 1.2],
    ['ROTATOREN', 'rumpf', 0.84, 0.94, -6.8, 1.2],
    ['BAUCH_SCHRAEG', 'rumpf', 0.12, 0.55, 5.4, 1.7],
    ['BAUCH_SCHRAEG', 'rumpf', 0.12, 0.55, -5.4, 1.7],
    ['BAUCH_GERADE', 'rumpf', 0.10, 0.58, 0.0, 2.6],
    ['BRUST_UNTEN', 'rumpf', 0.60, 0.72, 4.6, 3.4],
    ['BRUST_UNTEN', 'rumpf', 0.60, 0.72, -4.6, 3.4],
    ['BRUST_MITTE', 'rumpf', 0.70, 0.82, 4.6, 3.7],
    ['BRUST_MITTE', 'rumpf', 0.70, 0.82, -4.6, 3.7],
    ['BRUST_OBEN', 'rumpf', 0.80, 0.91, 4.4, 3.2],
    ['BRUST_OBEN', 'rumpf', 0.80, 0.91, -4.4, 3.2],
    ['TRAPEZ_OBEN', 'rumpf', 0.93, 1.07, 5.4, 1.6],
    ['TRAPEZ_OBEN', 'rumpf', 0.93, 1.07, -5.4, 1.6],
    ['GESAESS_MITTEL', 'rumpf', -0.04, 0.14, 7.0, 1.7],
    ['GESAESS_MITTEL', 'rumpf', -0.04, 0.14, -7.0, 1.7],
    ['QUADRIZEPS', 'os', 0.12, 0.92, 0.5, 3.1],
    ['ADDUKTOREN', 'os', 0.06, 0.52, -2.8, 1.5],
    ['WADE_GASTRO', 'us', 0.08, 0.50, -1.6, 1.4],
    ['WADE_SOLEUS', 'us', 0.20, 0.62, 1.6, 1.3],
    ['BIZEPS', 'oa', 0.34, 0.90, 0.0, 2.0],
    ['BRACHIALIS', 'oa', 0.60, 0.92, 1.6, 1.0],
    ['SCHULTER_SEITE', 'oa', -0.10, 0.36, 1.5, 2.4],
    ['SCHULTER_VORN', 'oa', -0.10, 0.38, -0.6, 2.6],
    ['UNTERARM_BEUGER', 'ua', 0.04, 0.66, -0.5, 1.5],
    ['UNTERARM_STRECKER', 'ua', 0.04, 0.60, 1.3, 1.0],
  ],
  hinten: [
    ['UNTERER_RUECKEN', 'rumpf', 0.04, 0.36, 2.2, 1.8],
    ['UNTERER_RUECKEN', 'rumpf', 0.04, 0.36, -2.2, 1.8],
    ['LAT', 'rumpf', 0.32, 0.82, 5.0, 3.0],
    ['LAT', 'rumpf', 0.32, 0.82, -5.0, 3.0],
    ['TRAPEZ_MITTE', 'rumpf', 0.60, 0.90, 0.0, 3.0],
    ['TRAPEZ_OBEN', 'rumpf', 0.88, 1.07, 0.0, 4.3],
    ['ROTATOREN', 'rumpf', 0.70, 0.86, 4.4, 1.6],
    ['ROTATOREN', 'rumpf', 0.70, 0.86, -4.4, 1.6],
    ['GESAESS_MITTEL', 'rumpf', -0.02, 0.14, 6.6, 1.8],
    ['GESAESS_MITTEL', 'rumpf', -0.02, 0.14, -6.6, 1.8],
    ['GESAESS_GROSS', 'os', -0.16, 0.30, -0.6, 4.2],
    ['BEINBEUGER', 'os', 0.30, 0.92, 0.0, 2.8],
    ['WADE_GASTRO', 'us', 0.06, 0.48, 0.0, 2.6],
    ['WADE_SOLEUS', 'us', 0.44, 0.72, 0.0, 1.6],
    ['TRIZEPS_SEITE', 'oa', 0.28, 0.86, 0.9, 1.3],
    ['TRIZEPS_LANG', 'oa', 0.34, 0.92, -0.9, 1.3],
    ['SCHULTER_SEITE', 'oa', -0.10, 0.34, 1.5, 2.4],
    ['SCHULTER_HINTEN', 'oa', -0.10, 0.38, -0.6, 2.6],
    ['UNTERARM_STRECKER', 'ua', 0.04, 0.66, 0.0, 2.0],
  ],
};
const SEG = { oa: ['S', 'E'], ua: ['E', 'W'], os: ['HU', 'K'], us: ['K', 'A'] };

function ellipse(a, b, u0, u1, v, hw, vz, rumpf) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const l = Math.hypot(dx, dy) || 1;
  const ex = dx / l, ey = dy / l;
  const [nx, ny] = rumpf ? [-ey, ex] : [ey, -ex];
  const um = ((u0 + u1) / 2) * l, vv = v * vz;
  return [[a[0] + ex * um + nx * vv, a[1] + ey * um + ny * vv], ((u1 - u0) / 2) * l, hw, (Math.atan2(ey, ex) * 180) / Math.PI];
}

/** Muskelflächen: [gruppe ('fern'|'rumpf'|'nah'), muskel, mitte, rx, ry, winkel, glied]. */
export function muskelflaechen(ansicht, g) {
  const out = [];
  for (const [m, seg, u0, u1, v, hw] of MUSKELN[ansicht]) {
    if (seg === 'rumpf') { out.push(['rumpf', m, ...ellipse(g.H, g.S0, u0, u1, v, hw, 1, true), 0]); continue; }
    for (const nr of [1, 2]) {
      const [p, q] = SEG[seg];
      const vz = ansicht === 'seite' ? 1 : nr === 1 ? 1 : -1;
      const grp = ansicht === 'seite' ? (nr === 2 ? 'fern' : 'nah') : 'nah';
      out.push([grp, m, ...ellipse(g[p + nr], g[q + nr], u0, u1, v, hw, vz, false), nr]);
    }
  }
  return out;
}

/** Muster und Gerät zu einer Übung, oder null. */
export function musterFuer(u) {
  if (!u) return null;
  let key = null, kurz = '';
  const id = u.id || '';
  if (!id.startsWith('e:')) {
    const i = id.indexOf('-');
    key = i < 0 ? id : id.slice(0, i);
    kurz = i < 0 ? '' : id.slice(i + 1);
  }
  if (!key || !(key in DATEN.zuordnung)) {
    const t = finde(u.importName || u.name || '');
    const b = t.bewegung || (t.uebung && { key: t.uebung.id.split('-')[0] });
    if (b) {
      key = b.key;
      const tu = t.uebung?.id || '';
      kurz = tu.includes('-') ? tu.slice(tu.indexOf('-') + 1) : '';
      // Bewegung bekannt, Gerät nicht im Katalog (z. B. „Cable Shoulder Press“): Gerät aus dem Namen zeichnen
      const g = t.uebung ? null : zerlege(u.importName || u.name || '')[1];
      if (g) kurz = Geraet[g].kurz;
    }
  }
  let z = key && DATEN.zuordnung[key];
  let geraet = Object.keys(Geraet).find((g) => Geraet[g].kurz === kurz) || null;
  if (!z) {
    // Kein Katalogtreffer: Stichworte im Namen (z. B. „Katana Extension“, „Iso-lateral Pulldown“)
    const [basis, g] = zerlege(u.importName || u.name || '');
    const t = ` ${basis} `;
    for (const [worte, k, std] of DATEN.stichworte || []) {
      if (!worte.some((w) => t.includes(` ${w}`))) continue;
      const kz = g ? Geraet[g].kurz : / machi/.test(t) ? 'ma' : std;
      z = DATEN.zuordnung[k];
      if (typeof z === 'object') z = z[kz] ?? z['*'];
      const [m, art] = z.split(':');
      return { muster: DATEN.muster[m], geraet: art || Object.keys(Geraet).find((x) => Geraet[x].kurz === kz) || null };
    }
  }
  if (!z) {
    // Unbekannt: ruhig stehend, Ansicht nach Hauptmuskeln
    const hinten = ['TRIZEPS', 'LAT', 'TRAPEZ', 'UNTERER_RUECKEN', 'GESAESS', 'BEINBEUGER', 'WADEN'];
    const n = (u.primaer || []).filter((m) => hinten.includes(m)).length;
    return { muster: DATEN.muster[n * 2 > (u.primaer || []).length ? 'stehen_hinten' : 'stehen_vorn'], geraet: null };
  }
  if (typeof z === 'object') z = z[kurz] ?? z['*'];
  const [m, art] = z.split(':');
  return { muster: DATEN.muster[m], geraet: art || geraet };
}

/** Haltung zum Fortschritt x (0..1) aus den Schlüsselbildern. */
export function haltung(muster, x) {
  const b = muster.bilder, n = b.length - 1;
  const i = Math.min(Math.floor(x * n), n - 1), f = x * n - i;
  return b[i].map((v, j) => v + (b[i + 1][j] - v) * f);
}

// ---------- Zeichnen (SVG-Text) ----------
const f2 = (v) => Math.round(v * 100) / 100;
const linie = (a, b, w, kl, cap = 'round') => `<line x1="${f2(a[0])}" y1="${f2(a[1])}" x2="${f2(b[0])}" y2="${f2(b[1])}" stroke-width="${w}" stroke-linecap="${cap}" class="${kl}"/>`;
const kreis = (p, r, kl) => `<circle cx="${f2(p[0])}" cy="${f2(p[1])}" r="${r}" class="${kl}"/>`;
const ell = ([c, rx, ry, w], kl) => `<ellipse cx="${f2(c[0])}" cy="${f2(c[1])}" rx="${f2(Math.max(rx, 0.1))}" ry="${ry}" transform="rotate(${f2(w)} ${f2(c[0])} ${f2(c[1])})" class="${kl}"/>`;

function rumpfForm(ansicht, g) {
  const [H, S] = [g.H, g.S0];
  const dx = S[0] - H[0], dy = S[1] - H[1];
  const l = Math.hypot(dx, dy);
  const ex = dx / l, ey = dy / l, nx = -ey, ny = ex;
  const prof = ansicht === 'seite'
    ? [[0, -5.2, 4.6], [0.55, -5.6, 5.4], [0.85, -5.4, 6.4], [1, -3.6, 3.6]]
    : [[0, -8.5, 8.5], [0.45, -7.2, 7.2], [0.8, -10.5, 10.5], [1, -9, 9]];
  const pt = (u, a) => [H[0] + ex * u * l + nx * a, H[1] + ey * u * l + ny * a];
  const pts = [...prof.map(([u, a]) => pt(u, a)), ...prof.map(([u, , b]) => pt(u, b)).reverse()];
  return `<polygon points="${pts.map((p) => `${f2(p[0])},${f2(p[1])}`).join(' ')}" class="fh fh-r"/>`;
}

function szeneSvg(el) {
  const p = el.p;
  if (el.typ === 'bank') {
    const m = [(p[0] + p[2]) / 2, (p[1] + p[3]) / 2];
    return linie(m, [m[0], 104], 2.2, 'fgh', 'butt') + linie([p[0], p[1]], [p[2], p[3]], 4.6, 'fg');
  }
  if (el.typ === 'linie') return linie([p[0], p[1]], [p[2], p[3]], el.b, el.dunkel ? 'fg' : 'fgh');
  if (el.typ === 'kasten') return `<rect x="${p[0]}" y="${p[1]}" width="${p[2] - p[0]}" height="${p[3] - p[1]}" rx="1.5" class="fgh-f"/>`;
  return '';
}

function lastSvg(last, geraet, g, ansicht, x) {
  const hinten = [], vorn = [];
  const punkte = (last.punkte || []).map((n) => g[n]);
  if (!punkte.length) return [hinten, vorn];
  const art = last.art || geraet;
  let anker = last.anker;
  if (anker && last.anker_b) anker = anker.map((a, i) => [a[0] + (last.anker_b[i][0] - a[0]) * x, a[1] + (last.anker_b[i][1] - a[1]) * x]);
  const ankerI = (i, std) => (anker || [std])[Math.min(i, (anker || [std]).length - 1)];
  if (art === 'KABEL' && last.stange && punkte.length === 2) {
    const [a, b] = punkte;
    vorn.push(linie([a[0] - 4, a[1]], [b[0] + 4, b[1]], 1.8, 'fg'));
    hinten.push(kreis(anker[0], 2.3, 'fg-f'), linie(anker[0], [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], 0.9, 'fg'));
  } else if (art === 'POLSTER') {
    punkte.forEach((p) => vorn.push(kreis(p, 3.2, 'fg-f')));
  } else if (art === 'ROLLE') {
    const p = punkte[0];
    vorn.push(kreis([p[0], p[1] + 2.3], 4.2, 'fg-f'), kreis([p[0], p[1] + 2.3], 1.3, 'fgh-f'));
  } else if (art === 'SEIL') {
    const [a, b, c] = [punkte[0], punkte[punkte.length - 1], anker[0]];
    vorn.push(`<path d="M${f2(a[0])},${f2(a[1])} Q${f2(c[0])},${f2(c[1])} ${f2(b[0])},${f2(b[1])}" stroke-width="0.9" class="fg" fill="none"/>`);
  } else if (art === 'LH' || art === 'EZ' || art === 'SMITH') {
    if (ansicht === 'seite') {
      const m = [punkte.reduce((s, p) => s + p[0], 0) / punkte.length, punkte.reduce((s, p) => s + p[1], 0) / punkte.length];
      if (art === 'SMITH') hinten.push(linie([m[0] + 1.5, -4], [m[0] + 1.5, 104], 1.6, 'fgh', 'butt'));
      (last.vorn ? vorn : hinten).push(kreis(m, art === 'EZ' ? 6.4 : 8.2, 'fg-f'));
      vorn.push(kreis(m, 1.6, 'fg-f'));
    } else {
      const [a, b] = [punkte[0], punkte[punkte.length - 1]];
      let ex = b[0] - a[0], ey = b[1] - a[1];
      const l = Math.hypot(ex, ey);
      if (l < 1) { ex = 1; ey = 0; } else { ex /= l; ey /= l; }
      const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const halb = art === 'EZ' ? 18 : 27;
      vorn.push(linie([m[0] - ex * halb, m[1] - ey * halb], [m[0] + ex * halb, m[1] + ey * halb], 1.6, 'fg'));
      for (const s of [-1, 1]) {
        const c = [m[0] + ex * s * (halb - 4), m[1] + ey * s * (halb - 4)];
        vorn.push(linie([c[0] - ey * 8, c[1] + ex * 8], [c[0] + ey * 8, c[1] - ex * 8], 3.2, 'fg', 'butt'));
      }
    }
  } else if (art === 'KH') {
    punkte.forEach((p) => vorn.push(kreis(p, 3.7, 'fg-f'), kreis(p, 1.2, 'fgh-f')));
  } else if (art === 'KB') {
    punkte.forEach((p) => vorn.push(linie(p, [p[0], p[1] + 2.5], 1.4, 'fg'), kreis([p[0], p[1] + 6], 4.6, 'fg-f')));
  } else if (art === 'KABEL' || art === 'BAND') {
    punkte.forEach((p, i) => {
      const a = ankerI(i, [110, 20]);
      if (art === 'KABEL') {
        hinten.push(linie([a[0], -4], [a[0], 104], 3, 'fgh', 'butt'), kreis(a, 2.3, 'fg-f'));
        vorn.push(linie(a, p, 0.9, 'fg'), kreis(p, 1.8, 'fg-f'));
      } else {
        vorn.push(linie(a, p, 1.3, 'fband'));
        hinten.push(kreis(a, 1.5, 'fg-f'));
      }
    });
  } else if (art === 'MASCHINE') {
    punkte.forEach((p, i) => {
      const a = ankerI(i, [100, 60]);
      hinten.push(linie(a, [a[0], 104], 3, 'fgh', 'butt'));
      vorn.push(linie(a, p, 2.4, 'fg'), kreis(a, 2.2, 'fg-f'), kreis(p, 2.4, 'fg-f'));
    });
  } else if (art === 'PLATTE') {
    const v = d((last.winkel || 0) + 90), n = d(last.winkel || 0);
    punkte.forEach((p0) => { const p = add(p0, n, last.versatz || 0); vorn.push(linie(add(p, v, -7), add(p, v, 7), 3, 'fg')); });
  }
  return [hinten, vorn];
}

/** SVG-Inhalt (ohne <svg>) der Figur zum Fortschritt x. prim/sek: Teilmuskeln (muskelteile.js). */
export function figurSvg(muster, geraet, prim, sek, x) {
  const ansicht = muster.ansicht;
  const g = gelenke(ansicht, haltung(muster, x));
  const fl = muskelflaechen(ansicht, g);
  const P = new Set(prim), S = new Set(sek);
  const mk = (m, fern) => (P.has(m) ? 'fm-p' : S.has(m) ? 'fm-s' : fern ? 'fm fm-fern' : 'fm');
  const out = [linie([-10, 104], [130, 104], 1.2, 'fboden', 'butt')];
  for (const el of muster.szene) out.push(szeneSvg(el));
  const [lh, lv] = muster.last ? lastSvg(muster.last, geraet, g, ansicht, x) : [[], []];
  out.push(...lh);
  const flaechen = (grp, nr, teile) => fl.filter((f) => f[0] === grp && f[6] === nr && teile.has(f[1])).map((f) => ell(f.slice(2, 6), mk(f[1], grp === 'fern')));
  const bein = (nr, fern) => {
    const kl = fern ? 'fh fh-fern' : 'fh';
    return [linie(g['HU' + nr], g['K' + nr], ansicht === 'seite' ? 9.5 : 8.6, kl), linie(g['K' + nr], g['A' + nr], 6.6, kl), linie(g['F' + nr], g['T' + nr], 3.4, kl),
      ...flaechen(fern ? 'fern' : 'nah', nr, BEIN)];
  };
  const arm = (nr, fern) => {
    const kl = fern ? 'fh fh-fern' : 'fh';
    return [linie(g['S' + nr], g['E' + nr], 6.4, kl), linie(g['E' + nr], g['W' + nr], 5.2, kl), linie(g['W' + nr], g['HA' + nr], 4.4, kl),
      ...flaechen(fern ? 'fern' : 'nah', nr, ARM)];
  };
  const rumpf = () => [linie(g.S0, g.KOPF, ansicht === 'seite' ? 4.5 : 5, 'fh'), rumpfForm(ansicht, g),
    ...fl.filter((f) => f[0] === 'rumpf').map((f) => ell(f.slice(2, 6), mk(f[1], false))), kreis(g.KOPF, 6.3, 'fh-f')];
  if (ansicht === 'seite') out.push(...arm(2, true), ...bein(2, true), ...bein(1, false), ...rumpf(), ...arm(1, false));
  else out.push(...bein(1, false), ...bein(2, false), ...rumpf(), ...arm(1, false), ...arm(2, false));
  out.push(...lv);
  return out.join('');
}

// Teilmuskeln an Armen und Beinen (werden mit dem jeweiligen Glied gezeichnet)
const ARM = new Set(['SCHULTER_VORN', 'SCHULTER_SEITE', 'SCHULTER_HINTEN', 'BIZEPS', 'BRACHIALIS', 'TRIZEPS_LANG', 'TRIZEPS_SEITE', 'UNTERARM_BEUGER', 'UNTERARM_STRECKER']);
const BEIN = new Set(['GESAESS_GROSS', 'GESAESS_MITTEL', 'ADDUKTOREN', 'BEINBEUGER', 'QUADRIZEPS', 'WADE_GASTRO', 'WADE_SOLEUS']);

const rahmenCache = new Map();
/** Ausschnitt um die Figur über alle Schlüsselbilder (für kleine Bilder): [x, y, breite, höhe], quadratisch. */
export function rahmen(muster) {
  if (rahmenCache.has(muster)) return rahmenCache.get(muster);
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const h of muster.bilder) {
    for (const p of Object.values(gelenke(muster.ansicht, h))) {
      x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]);
    }
  }
  const rand = 8, gr = Math.max(x1 - x0, y1 - y0) + 2 * rand;
  const r = [(x0 + x1) / 2 - gr / 2, (y0 + y1) / 2 - gr / 2, gr, gr].map(f2);
  rahmenCache.set(muster, r);
  return r;
}

/** Fortschritt hin und her, weich an den Enden. */
export const pendel = (sek, dauer) => (1 - Math.cos((2 * Math.PI * sek) / (2 * dauer))) / 2;

/** Fortschritt zur Zeit: hin und her, bei zyklischen Mustern (Radfahren, Schwimmen) immer vorwärts im Kreis. */
export const fortschritt = (muster, sek) => (muster.zyklisch ? ((sek / (2 * muster.dauer)) % 1 + 1) % 1 : pendel(sek, muster.dauer));

/** Übungsbild. animiert: Bewegung läuft (nur wenn sichtbar und ohne „Bewegung reduzieren“). */
export function FigurBild({ uebung, animiert = false, klein = false }) {
  const ref = useRef();
  const info = musterFuer(uebung);
  const [prim, sek0] = uebung ? Teile.von(uebung) : [[], []];
  const sek = sek0.filter((m) => !prim.includes(m));
  useEffect(() => {
    const el = ref.current;
    if (!el || !info) return undefined;
    const ruhig = !animiert || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (ruhig) { el.innerHTML = figurSvg(info.muster, info.geraet, prim, sek, 1); return undefined; }
    let id = 0, sichtbar = true;
    const t0 = performance.now();
    const schritt = (t) => {
      if (sichtbar) el.innerHTML = figurSvg(info.muster, info.geraet, prim, sek, fortschritt(info.muster, (t - t0) / 1000));
      id = requestAnimationFrame(schritt);
    };
    const beob = 'IntersectionObserver' in window ? new IntersectionObserver(([e]) => { sichtbar = e.isIntersecting; }) : null;
    beob?.observe(el);
    id = requestAnimationFrame(schritt);
    return () => { cancelAnimationFrame(id); beob?.disconnect(); };
  }, [info?.muster, info?.geraet, animiert, prim.join(), sek.join()]);
  if (!info) return null;
  const titel = `Übungsbild ${uebung.name}` + (prim.length ? `, markiert: ${prim.map((m) => Teil[m].titel).join(', ')}` : '');
  const vb = klein ? rahmen(info.muster).join(' ') : '0 -6 120 114';
  return html`<svg ref=${ref} class=${'figur' + (klein ? ' figur-klein' : '')} viewBox=${vb} role="img" aria-label=${titel}></svg>`;
}

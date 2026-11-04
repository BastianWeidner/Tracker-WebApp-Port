// Kamera, Barcode (ZXing als WebAssembly) und Texterkennung (Tesseract, deutsch). Beides läuft im Browser, die
// Dateien liegen unter vendor/ und werden offline aus dem Speicher des Service Workers geladen.

const abs = (p) => new URL(p, location.href).href;

function skript(src) {
  return new Promise((ok, fehler) => {
    if (document.querySelector(`script[data-src="${src}"]`)) return ok();
    const s = document.createElement('script');
    s.src = src;
    s.dataset.src = src;
    s.onload = () => ok();
    s.onerror = () => fehler(new Error('Konnte ' + src + ' nicht laden'));
    document.head.appendChild(s);
  });
}

// ---------- Barcode ----------

let zxing = null;
async function zxingLaden() {
  zxing ??= (async () => {
    await skript('vendor/zxing/zxing-reader.js');
    const Z = window.ZXingWASM;
    Z.prepareZXingModule({
      overrides: { locateFile: (pfad, prefix) => (pfad.endsWith('.wasm') ? abs('vendor/zxing/zxing_reader.wasm') : prefix + pfad) },
      fireImmediately: true,
    });
    return Z;
  })().catch((e) => { zxing = null; throw e; });
  return zxing;
}

const FORMATE = ['EAN13', 'EAN8', 'UPCA', 'UPCE'];

/** Barcode in einem Bild (ImageData, Blob oder File); null, wenn keiner gefunden. */
export async function barcodeLesen(bild, schnell = false) {
  const Z = await zxingLaden();
  const r = await Z.readBarcodes(bild, { formats: FORMATE, tryHarder: !schnell, tryRotate: !schnell, tryInvert: false, maxNumberOfSymbols: 1 });
  const t = r.find((x) => x.isValid && x.text);
  return t ? t.text : null;
}

/** Hintere Kamera starten. Gibt den MediaStream zurück. */
export async function kameraStarten(video) {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('Dieser Browser erlaubt keinen Kamerazugriff. Bitte „Foto aufnehmen“ benutzen.');
  const strom = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
  });
  video.srcObject = strom;
  video.setAttribute('playsinline', '');
  video.muted = true;
  await video.play();
  return strom;
}

export function kameraStoppen(strom) {
  strom?.getTracks().forEach((t) => t.stop());
}

/**
 * Liest fortlaufend Bilder aus dem Video und sucht einen Barcode (mittlerer Bildstreifen, das ist schneller).
 * Gibt eine Funktion zum Beenden zurück; [gefunden] wird höchstens einmal aufgerufen.
 */
export function barcodeSchleife(video, gefunden) {
  let aus = false;
  const leinwand = document.createElement('canvas');
  const ctx = leinwand.getContext('2d', { willReadFrequently: true });
  zxingLaden().catch(() => {});
  async function runde() {
    if (aus) return;
    const w = video.videoWidth, h = video.videoHeight;
    if (w && h) {
      // Mittleres Drittel der Höhe, auf höchstens 1280 px Breite verkleinert.
      const sx = 0, sy = Math.floor(h * 0.25), sw = w, sh = Math.floor(h * 0.5);
      const f = Math.min(1, 1280 / sw);
      leinwand.width = Math.round(sw * f);
      leinwand.height = Math.round(sh * f);
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, leinwand.width, leinwand.height);
      try {
        const code = await barcodeLesen(ctx.getImageData(0, 0, leinwand.width, leinwand.height), true);
        if (code && !aus) { aus = true; gefunden(code); return; }
      } catch (e) { console.warn(e); }
    }
    setTimeout(runde, 150);
  }
  runde();
  return () => { aus = true; };
}

// ---------- Texterkennung ----------

let tess = null;
function tesseract(fortschritt) {
  tess ??= (async () => {
    await skript('vendor/tesseract/tesseract.min.js');
    return window.Tesseract.createWorker('deu', 1, {
      workerPath: abs('vendor/tesseract/worker.min.js'),
      corePath: abs('vendor/tesseract/core/'),
      langPath: abs('vendor/tesseract/lang'),
      gzip: true,
      cacheMethod: 'none',
      logger: (m) => fortschritt?.(m),
    });
  })().catch((e) => { tess = null; throw e; });
  return tess;
}

/** Bild verkleinern bzw. vergrößern auf gut lesbare Größe (lange Seite etwa 2000 px), als Canvas. */
async function vorbereiten(datei) {
  const bmp = await createImageBitmap(datei);
  const lang = Math.max(bmp.width, bmp.height);
  const f = Math.min(2.5, 2000 / lang);
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * f);
  c.height = Math.round(bmp.height * f);
  const ctx = c.getContext('2d');
  ctx.filter = 'grayscale(1) contrast(1.25)';
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close?.();
  return c;
}

/**
 * Text eines Fotos als Zeilen mit Lage im Bild (wie die Textstücke von ML Kit in der Android-App).
 * [fortschritt] bekommt Meldungen beim ersten Laden der Erkennung.
 */
export async function textLesen(datei, fortschritt) {
  const worker = await tesseract(fortschritt);
  const bild = await vorbereiten(datei);
  const { data } = await worker.recognize(bild, {}, { blocks: true, text: true });
  const boxen = [];
  for (const b of data.blocks || []) for (const p of b.paragraphs || []) for (const l of p.lines || []) {
    const text = (l.text || '').replace(/\s+/g, ' ').trim();
    if (text && l.confidence > 20) boxen.push({ text, links: l.bbox.x0, oben: l.bbox.y0, rechts: l.bbox.x1, unten: l.bbox.y1 });
  }
  return boxen;
}

/** Erkennung schon im Hintergrund laden, damit der erste Scan schneller geht. */
export function vorladen() {
  zxingLaden().catch(() => {});
}

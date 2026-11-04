const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const dir = process.argv[2];
  const svg = fs.readFileSync(dir + '/icons/icon.svg', 'utf8');
  const b = await chromium.launch();
  const p = await b.newPage();
  for (const [name, size, pad, rund] of [['icon-192.png', 192, 0, true], ['icon-512.png', 512, 0, true], ['icon-maskable-512.png', 512, 0, false], ['apple-touch-icon.png', 180, 0, false]]) {
    const s = rund ? svg : svg.replace('rx="112"', 'rx="0"');
    await p.setViewportSize({ width: size, height: size });
    await p.setContent(`<html><body style="margin:0;background:transparent">${s.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
    await p.screenshot({ path: `${dir}/icons/${name}`, omitBackground: true });
  }
  await b.close();
})();

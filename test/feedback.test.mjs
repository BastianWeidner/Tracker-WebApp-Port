// Feedback-Link. Aufruf: node test/feedback.test.mjs
import * as F from '../js/feedback.js';
import assert from 'node:assert/strict';
const ok = (n, f) => { try { f(); console.log('✓', n); } catch (e) { console.log('✗', n, e.stack); process.exitCode = 1; } };

ok('Betreff mit App und Version', () => assert.equal(F.betreff('Gym', '1.8.2'), 'Feedback Gym (Web) 1.8.2'));
ok('Link an die Feedback-Adresse, sauber kodiert', () => {
  const l = F.link('Food & Boost', '1.8.2');
  assert.ok(l.startsWith('mailto:bastian.weidner.bw+feedback@gmail.com?subject='));
  const u = new URL(l);
  assert.equal(u.searchParams.get('subject'), 'Feedback Food & Boost (Web) 1.8.2');
  assert.match(u.searchParams.get('body'), /Version 1\.8\.2/);
  assert.ok(!l.includes(' '));
});

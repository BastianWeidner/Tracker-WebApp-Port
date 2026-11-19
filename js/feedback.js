// Freiwilliges Feedback: nur ein mailto-Link. Kein Tracking, keine Netzwerkaufrufe, nichts wird automatisch angehängt.
export const ADRESSE = 'bastian.weidner.bw+feedback@gmail.com';

/** „Feedback Gym (Web) 1.8.2“ */
export const betreff = (app, version) => `Feedback ${app} (Web)${version ? ` ${version}` : ''}`;

export const text = (app, version) => `Hallo Bastian,\n\n\n\n---\nApp: ${app} (Web-App)${version ? `, Version ${version}` : ''}\n`;

/** mailto-Link mit Betreff und Text, sauber kodiert (Leerzeichen als %20, & als %26). */
export const link = (app, version) =>
  `mailto:${ADRESSE}?subject=${encodeURIComponent(betreff(app, version))}&body=${encodeURIComponent(text(app, version))}`;

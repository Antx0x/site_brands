// ============================================================
// site/src/brandfetch.js — URL-uri de logo de la Brandfetch (CDN)
//
// Sursa principală de logo-uri în site. Construiește un link CDN
// „Logo Link" din DOMENIUL fiecărei firme (luat din companii.json),
// fără să descarce nimic — imaginea se încarcă live în browser.
//
// Tipul implicit e "icon", fiindcă e singura variantă pe care o are
// aproape orice brand și care arată bine tăiată rotund. Pentru câteva
// firme la care preferi altă variantă, pune o suprascriere în TIP_BRAND.
//
// Dacă un brand nu are domeniu sau CDN-ul dă 404, componentele cad
// automat pe logo-ul local din public/logos (descărcat de pe Wikidata).
//
// Client ID-ul (public) vine din site/.env: VITE_BRANDFETCH_CLIENT_ID
// ============================================================

import companii from './companii.json';

const CLIENT_ID = import.meta.env.VITE_BRANDFETCH_CLIENT_ID;

export const slug = (s) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_');

// ── corecturi de domeniu ─────────────────────────────────────
// Wikidata pune uneori în site_oficial un URL care nu e site-ul
// brandului. Aici îl suprascriem (aceleași corecturi ca în scraper).
const DOMENII_MANUAL = {
  'Schwarz Group': 'schwarz-gruppe.de',
};

// ── tip preferat per brand (implicit "icon") ─────────────────
// Ex: 'KFC': 'symbol' dacă vrei simbolul în loc de icon la KFC.
const TIP_BRAND = {};

// ── branduri care folosesc DIRECT logo-ul local din public/logos ──
// Pentru numele de aici NU se cere Brandfetch: componenta pornește
// direct de la /logos/<slug>.png (logo-ul tău din folder), iar dacă
// acela lipsește cade pe inițială. Folosește-o când icon-ul Brandfetch
// nu-ți place și preferi imaginea ta.
//
// Numele trebuie să fie IDENTIC cu "nume"-le din companii.json.
// Ex:
//   const PREFERA_LOCAL = new Set([
//     'Dedeman',
//     'Banca Transilvania',
//   ]);
const PREFERA_LOCAL = new Set([
  // adaugă aici brandurile, câte unul pe linie:
    'Profi',
    'BRD', 
]);

function domeniuDin(site) {
  try {
    return new URL(site).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

// nume → domeniu, pentru branduri ȘI companii-mamă
const DOMENII = new Map();
for (const c of companii) {
  if (!c.gasit) continue;
  DOMENII.set(c.nume, DOMENII_MANUAL[c.nume] || domeniuDin(c.site_oficial));
  const m = c.companie_mama_detalii;
  if (m && m.nume) DOMENII.set(m.nume, DOMENII_MANUAL[m.nume] || domeniuDin(m.site_oficial));
}

// URL-ul CDN pentru un brand, sau null dacă nu-l putem construi
// (fără Client ID sau fără domeniu → componenta cade pe logo-ul local).
export function urlBrandfetch(nume, marime = 256) {
  if (!CLIENT_ID) return null;
  if (PREFERA_LOCAL.has(nume)) return null; // acest brand folosește logo-ul local
  const dom = DOMENII.get(nume);
  if (!dom) return null;
  const tip = TIP_BRAND[nume] || 'icon';
  return (
    `https://cdn.brandfetch.io/${dom}/type/${tip}` +
    `/w/${marime}/h/${marime}/fallback/404?c=${CLIENT_ID}`
  );
}

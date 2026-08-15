// ============================================================
// filtreaza_consumables.js — validează extracția pe companii-mamă.
//
// Pentru fiecare secțiune din consumables_plan.json (ex. "PepsiCo" cu
// lista lui de QID-uri), verifică ce companie-mamă a rezultat pentru
// fiecare brand. Compania „corectă" a secțiunii = cea mai frecventă
// (modală) printre brandurile ei. Brandurile a căror mamă NU coincide
// sunt IGNORATE (scoase din fișier) și listate separat.
//
// Rulezi din scraper/ DUPĂ ce s-a terminat extracția:
//   node filtreaza_consumables.js
//
// Intrare : date/companii_wikidata_consumables.json (extracția brută)
// Ieșire  : - rescrie fișierul cu doar brandurile valide
//           - date/companii_wikidata_consumables_raw.json (copia brută)
//           - date/consumables_ignorate.json (lista ignorate)
// ============================================================

const fs = require('fs');
const path = require('path');

const FISIER = path.join('date', 'companii_wikidata_consumables.json');
const PLAN = require('./consumables_plan.json');

const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

if (!fs.existsSync(FISIER)) {
  console.log(`Nu găsesc ${FISIER} — rulează întâi extracția.`);
  process.exit(1);
}

const brute = JSON.parse(fs.readFileSync(FISIER, 'utf-8'));
const dupaId = new Map(); // qid → obiect brand
for (const b of brute) if (b.wikidata_id) dupaId.set(b.wikidata_id, b);

// qid → listă de secțiuni în care apare
const sectiuniAle = new Map();
for (const s of PLAN) for (const q of s.qids) {
  if (!sectiuniAle.has(q)) sectiuniAle.set(q, []);
  sectiuniAle.get(q).push(s.parinte);
}

// pentru fiecare secțiune: compania-mamă modală (după companie_mama_id)
const parinteAsteptat = {}; // sectiune → { id, nume, potrivireCuTitlul }
for (const s of PLAN) {
  const frecv = new Map(); // mamaId → { n, nume }
  for (const q of s.qids) {
    const b = dupaId.get(q);
    if (!b || !b.gasit || !b.companie_mama_id) continue;
    const cur = frecv.get(b.companie_mama_id) || { n: 0, nume: b.companie_mama };
    cur.n++;
    frecv.set(b.companie_mama_id, cur);
  }
  let bestId = null, best = { n: 0 };
  for (const [id, v] of frecv) if (v.n > best.n) { bestId = id; best = v; }
  const potr = bestId ? (norm(best.nume).includes(norm(s.parinte)) || norm(s.parinte).includes(norm(best.nume))) : false;
  parinteAsteptat[s.parinte] = { id: bestId, nume: best.nume || null, potrivire: potr };
}

// decide păstrat / ignorat
const pastrate = [];
const ignorate = [];
for (const b of brute) {
  const sect = sectiuniAle.get(b.wikidata_id) || [];
  // se păstrează dacă mama lui = mama așteptată a VREUNEI secțiuni în care apare
  const potrivit = sect.find((s) => parinteAsteptat[s]?.id && b.companie_mama_id === parinteAsteptat[s].id);
  if (b.gasit && potrivit) {
    pastrate.push(b);
  } else {
    ignorate.push({
      nume: b.nume || b.cautare,
      wikidata_id: b.wikidata_id || null,
      sectiuni: sect,
      mama_rezultata: b.companie_mama || (b.gasit ? '(fără mamă)' : '(negăsit pe Wikidata)'),
      asteptat: sect.map((s) => parinteAsteptat[s]?.nume).filter(Boolean).join(' / ') || '?',
    });
  }
}

// scrie rezultatele
fs.copyFileSync(FISIER, path.join('date', 'companii_wikidata_consumables_raw.json'));
fs.writeFileSync(FISIER, JSON.stringify(pastrate, null, 2), 'utf-8');
fs.writeFileSync(path.join('date', 'consumables_ignorate.json'), JSON.stringify(ignorate, null, 2), 'utf-8');

// raport
console.log(`\n=== PARINTE PER SECTIUNE (modal) ===`);
for (const s of PLAN) {
  const p = parinteAsteptat[s.parinte];
  const flag = p.id ? (p.potrivire ? '✓' : '⚠ NU se potrivește cu titlul!') : '✗ niciun părinte';
  console.log(`  ${s.parinte.padEnd(24)} → ${p.nume || '—'}  ${flag}`);
}

console.log(`\n=== REZULTAT ===`);
console.log(`păstrate: ${pastrate.length} | ignorate: ${ignorate.length} (din ${brute.length})`);

console.log(`\n=== BRANDURI IGNORATE (${ignorate.length}) ===`);
for (const g of ignorate) {
  console.log(`  ✗ ${(g.nume || '?').padEnd(26)} [${g.sectiuni.join(',')}]  mamă rezultată: ${g.mama_rezultata}  (așteptat: ${g.asteptat})`);
}
console.log(`\nDetalii în date/consumables_ignorate.json. Fișierul filtrat: ${FISIER}\n`);

// ============================================================
// filtreaza_categorie.js — validează extracția pe companii-mamă,
// pentru ORICE categorie (consumables, auto, ...).
//
// Pentru fiecare secțiune din <cat>_plan.json verifică ce companie-mamă
// a rezultat pentru fiecare brand. Compania „corectă" a secțiunii = cea
// mai frecventă (modală) printre brandurile ei. Brandurile a căror mamă
// NU coincide sunt IGNORATE (scoase din fișier) și listate separat.
//
// Rulezi din scraper/ DUPĂ extracție:
//   node filtreaza_categorie.js auto
//   node filtreaza_categorie.js consumables
//
// Intrare : date/companii_wikidata_<cat>.json + <cat>_plan.json
// Ieșire  : rescrie fișierul cu brandurile valide,
//           date/companii_wikidata_<cat>_raw.json (copia brută),
//           date/<cat>_ignorate.json (lista ignorate)
// ============================================================

const fs = require('fs');
const path = require('path');

const CAT = process.argv[2];
if (!CAT) {
  console.log('Folosire: node filtreaza_categorie.js <categorie>   (ex. auto, consumables)');
  process.exit(1);
}
const FISIER = path.join('date', `companii_wikidata_${CAT}.json`);
const PLAN_FILE = `./${CAT}_plan.json`;

const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

if (!fs.existsSync(FISIER)) { console.log(`Nu găsesc ${FISIER}`); process.exit(1); }
if (!fs.existsSync(path.resolve(PLAN_FILE))) { console.log(`Nu găsesc ${CAT}_plan.json`); process.exit(1); }

const PLAN = require(PLAN_FILE);
const brute = JSON.parse(fs.readFileSync(FISIER, 'utf-8'));
const dupaId = new Map();
for (const b of brute) if (b.wikidata_id) dupaId.set(b.wikidata_id, b);

const sectiuniAle = new Map();
for (const s of PLAN) for (const q of s.qids) {
  if (!sectiuniAle.has(q)) sectiuniAle.set(q, []);
  sectiuniAle.get(q).push(s.parinte);
}

// mama modală per secțiune
const parinteAsteptat = {};
for (const s of PLAN) {
  const frecv = new Map();
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

const pastrate = [];
const ignorate = [];
for (const b of brute) {
  const sect = sectiuniAle.get(b.wikidata_id) || [];
  const potrivit = sect.find((s) => parinteAsteptat[s]?.id && b.companie_mama_id === parinteAsteptat[s].id);
  if (b.gasit && potrivit) pastrate.push(b);
  else ignorate.push({
    nume: b.nume || b.cautare,
    wikidata_id: b.wikidata_id || null,
    sectiuni: sect,
    mama_rezultata: b.companie_mama || (b.gasit ? '(fără mamă)' : '(negăsit)'),
    asteptat: sect.map((s) => parinteAsteptat[s]?.nume).filter(Boolean).join(' / ') || '?',
  });
}

fs.copyFileSync(FISIER, path.join('date', `companii_wikidata_${CAT}_raw.json`));
fs.writeFileSync(FISIER, JSON.stringify(pastrate, null, 2), 'utf-8');
fs.writeFileSync(path.join('date', `${CAT}_ignorate.json`), JSON.stringify(ignorate, null, 2), 'utf-8');

console.log(`\n=== ${CAT.toUpperCase()} · PARINTE PER SECTIUNE (modal) ===`);
for (const s of PLAN) {
  const p = parinteAsteptat[s.parinte];
  const flag = p.id ? (p.potrivire ? '✓' : '⚠ diferă de titlu') : '✗ niciun părinte';
  console.log(`  ${s.parinte.padEnd(26)} → ${p.nume || '—'}  ${flag}`);
}
console.log(`\n=== REZULTAT === păstrate: ${pastrate.length} | ignorate: ${ignorate.length} (din ${brute.length})`);
console.log(`\n=== BRANDURI IGNORATE (${ignorate.length}) ===`);
for (const g of ignorate) {
  console.log(`  ✗ ${(g.nume || '?').padEnd(24)} [${g.sectiuni.join(',')}]  mamă: ${g.mama_rezultata}  (așteptat: ${g.asteptat})`);
}
console.log(`\nFișier filtrat: ${FISIER} · ignorate: date/${CAT}_ignorate.json\n`);

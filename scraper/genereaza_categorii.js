// ============================================================
// genereaza_categorii.js — construiește paginile de categorii din
// imaginile puse în site/public/logos/<categorie>/, grupându-le automat
// pe compania-mamă potrivită (din companii.json / Wikidata).
//
// Cum funcționează: numele fișierului png = slug-ul brandului. Îl caut
// în companii.json → aflu compania-mamă (companie_mama) → pun imaginea
// în containerul acelei companii. Așa, când adaugi imagini în folderul
// unei categorii, ele apar automat sub firma corectă (Nestlé, PepsiCo…),
// fără să editezi nimic manual.
//
// Scrie rezultatul în site/src/categorie_<categorie>.json (formatul pe
// care îl afișează deja pagina). Categoriile fără imagini nu se ating.
//
// Rulezi din folderul scraper/:
//   node genereaza_categorii.js
//
// Precondiție: brandurile trebuie să existe în companii.json (rulează
// întâi wikidata_companii.js pentru ele). Fișierele care nu se potrivesc
// cu niciun brand sunt raportate la final.
// ============================================================

const fs = require('fs');
const path = require('path');

const slug = (s) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const COMPANII = path.join('..', 'site', 'src', 'companii.json');
const LOGOS = path.join('..', 'site', 'public', 'logos');
const SRC = path.join('..', 'site', 'src');
const CATEGORII = ['consumables', 'auto', 'apps', 'devices'];

if (!fs.existsSync(COMPANII)) {
  console.log(`Nu găsesc ${COMPANII}`);
  process.exit(1);
}

const companii = JSON.parse(fs.readFileSync(COMPANII, 'utf-8')).filter((c) => c.gasit);

// slug(brand) → { nume, parent } și numele-mamă → simbol de bursă
const brandInfo = new Map();
const parentSimbol = new Map();
for (const c of companii) {
  const parent = c.companie_mama || c.nume; // brand → mama; companie → ea însăși
  brandInfo.set(slug(c.nume), { nume: c.nume, parent });

  const md = c.companie_mama_detalii;
  if (md && md.nume) {
    const l = (md.listari || []).find((x) => x.simbol);
    if (l && !parentSimbol.has(md.nume)) parentSimbol.set(md.nume, l.simbol);
  }
  const l2 = (c.listari || []).find((x) => x.simbol);
  if (l2 && !parentSimbol.has(c.nume)) parentSimbol.set(c.nume, l2.simbol);
}

let totalImagini = 0;
const totalNepotrivite = [];

for (const cat of CATEGORII) {
  const dir = path.join(LOGOS, cat);
  if (!fs.existsSync(dir)) {
    console.log(`(${cat}: fără folder public/logos/${cat}/ — sar)`);
    continue;
  }
  const files = fs.readdirSync(dir).filter((f) => /\.(png|jpe?g|webp|svg)$/i.test(f));
  if (files.length === 0) {
    console.log(`(${cat}: fără imagini — nu ating categorie_${cat}.json)`);
    continue;
  }

  const grupuri = new Map(); // parent → [{ nume, logo }]
  const nepotrivite = [];
  for (const f of files) {
    const s = f.replace(/\.[^.]+$/, '');
    const info = brandInfo.get(s);
    if (!info) {
      nepotrivite.push(f);
      continue;
    }
    if (!grupuri.has(info.parent)) grupuri.set(info.parent, []);
    grupuri.get(info.parent).push({ nume: info.nume, logo: `/logos/${cat}/${f}` });
  }

  // companiile cu cele mai multe branduri primele; brandurile alfabetic
  const date = [...grupuri.entries()]
    .map(([parinte, branduri]) => ({
      parinte,
      simbol: parentSimbol.get(parinte) || null,
      branduri: branduri.sort((a, b) => a.nume.localeCompare(b.nume)),
    }))
    .sort((a, b) => b.branduri.length - a.branduri.length || a.parinte.localeCompare(b.parinte));

  fs.writeFileSync(path.join(SRC, `categorie_${cat}.json`), JSON.stringify(date, null, 2) + '\n', 'utf-8');

  const potrivite = files.length - nepotrivite.length;
  totalImagini += potrivite;
  console.log(`\n✔ ${cat}: ${potrivite} imagini în ${date.length} companii → categorie_${cat}.json`);
  for (const g of date) console.log(`    ${g.parinte}: ${g.branduri.map((b) => b.nume).join(', ')}`);
  if (nepotrivite.length) {
    console.log(`  ⚠ fără potrivire în companii.json (rulează wikidata_companii.js pentru ele sau verifică numele):`);
    for (const f of nepotrivite) console.log(`      ${f}`);
    totalNepotrivite.push(...nepotrivite.map((f) => `${cat}/${f}`));
  }
}

console.log(`\n============================================`);
console.log(`✔ ${totalImagini} imagini plasate. ${totalNepotrivite.length} nepotrivite.`);
console.log(`============================================\n`);

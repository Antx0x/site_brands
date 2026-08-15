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

// ── companii „self-brand" ─────────────────────────────────────
// Companii care apar ȘI ca plăcuță de brand în propriul container
// (numele companiei = numele brandului, ex. Ferrari, unde marca se
// identifică chiar cu firma). Lista o scrii în scraper/self_brand.json:
//   ["Ferrari", "BMW", "Toyota"]
// Merge pe TOATE categoriile. Companiile care NU-s în listă rămân doar
// containere-holding, fără plăcuță proprie (ex. Unilever).
const SELF_BRAND = fs.existsSync('self_brand.json')
  ? JSON.parse(fs.readFileSync('self_brand.json', 'utf-8'))
  : [];
for (const nume of SELF_BRAND) {
  brandInfo.set(slug(nume), { nume, parent: nume }); // se auto-parentează
}

// Fișier de date opțional per categorie: dă lista COMPLETĂ de branduri
// (ca să apară și cele fără logo, ca placeholder cu numele). Categoriile
// fără fișier de date rămân „image-driven" (doar ce are imagine).
const CATEGORIE_DATA = {
  consumables: path.join('date', 'companii_wikidata_consumables.json'),
  auto: path.join('date', 'companii_wikidata_auto.json'),
};

const totalNepotrivite = [];

for (const cat of CATEGORII) {
  const dir = path.join(LOGOS, cat);

  // imaginile existente în folderul categoriei: slug → nume fișier
  const fisierPtSlug = new Map();
  if (fs.existsSync(dir)) {
    for (const f of fs.readdirSync(dir).filter((f) => /\.(png|jpe?g|webp|svg)$/i.test(f))) {
      fisierPtSlug.set(f.replace(/\.[^.]+$/, ''), f);
    }
  }

  // setul de branduri = imaginile + brandurile din fișierul de date (dacă e)
  const slugSet = new Set(fisierPtSlug.keys());
  const dataFile = CATEGORIE_DATA[cat];
  if (dataFile && fs.existsSync(dataFile)) {
    for (const b of JSON.parse(fs.readFileSync(dataFile, 'utf-8'))) {
      if (b.gasit && b.nume) slugSet.add(slug(b.nume));
    }
  }

  // self-brand: o companie din listă apare ca plăcuță în containerul ei
  // dacă are imagine în categorie SAU e părinte al vreunui brand de aici
  const parintiPrezenti = new Set();
  for (const s of slugSet) {
    const info = brandInfo.get(s);
    if (info) parintiPrezenti.add(info.parent);
  }
  for (const nume of SELF_BRAND) {
    const sl = slug(nume);
    if (fisierPtSlug.has(sl) || parintiPrezenti.has(nume)) slugSet.add(sl);
  }

  if (slugSet.size === 0) {
    console.log(`(${cat}: fără branduri — nu ating categorie_${cat}.json)`);
    continue;
  }

  const grupuri = new Map(); // parent → [{ nume, logo }]
  const nepotrivite = [];
  let cuLogo = 0, placeholder = 0;
  for (const s of slugSet) {
    const info = brandInfo.get(s);
    if (!info) {
      nepotrivite.push(s);
      continue;
    }
    const fisier = fisierPtSlug.get(s);
    const logo = fisier ? `/logos/${cat}/${fisier}` : ''; // gol → placeholder cu numele
    if (fisier) cuLogo++; else placeholder++;
    if (!grupuri.has(info.parent)) grupuri.set(info.parent, []);
    grupuri.get(info.parent).push({ nume: info.nume, logo });
  }

  const date = [...grupuri.entries()]
    .map(([parinte, branduri]) => ({
      parinte,
      simbol: parentSimbol.get(parinte) || null,
      branduri: branduri.sort((a, b) => a.nume.localeCompare(b.nume)),
    }))
    .sort((a, b) => b.branduri.length - a.branduri.length || a.parinte.localeCompare(b.parinte));

  fs.writeFileSync(path.join(SRC, `categorie_${cat}.json`), JSON.stringify(date, null, 2) + '\n', 'utf-8');

  console.log(`\n✔ ${cat}: ${date.length} companii · ${cuLogo} cu logo + ${placeholder} placeholder → categorie_${cat}.json`);
  if (nepotrivite.length) {
    console.log(`  ⚠ ${nepotrivite.length} sluguri fără potrivire în companii.json: ${nepotrivite.join(', ')}`);
    totalNepotrivite.push(...nepotrivite.map((s) => `${cat}/${s}`));
  }
}

console.log(`\n============================================`);
console.log(`✔ Gata. ${totalNepotrivite.length} nepotrivite în total.`);
console.log(`============================================\n`);

// ============================================================
// preia_locatii.js (v2) — extrage locațiile din toată România ale
// brandurilor din OpenStreetMap (Overpass), pentru harta uriașă a țării.
//
// Rulare (din folderul scraper/):
//   node preia_locatii.js                 → TOATE brandurile din orase.js
//   node preia_locatii.js "Profi" "Lidl"  → doar brandurile date
//   node preia_locatii.js --combina       → doar recombină fișierele deja extrase
//
// Pentru fiecare brand scrie date/locatii_<slug>.json, apoi combină tot
// în site/src/locatii_harta.json (ce citește harta), cu câte o culoare
// per brand.
//
// Potrivire robustă: întâi după brand:wikidata (QID din companii.json),
// apoi tag-ul brand, apoi nume pe shop/amenity/office. Așa prinde și
// băncile/benzinăriile, nu doar magazinele.
// ============================================================

const fs = require('fs');
const path = require('path');

const OVERPASS = 'https://overpass-api.de/api/interpreter';
const UA = 'BrandExplorerRO/0.2 (proiect personal de invatare; antonioizbinda@gmail.com)';
const DATE = 'date';
const ORASE = path.join('..', 'site', 'src', 'orase.js');
const COMPANII = path.join('..', 'site', 'src', 'companii.json');
const HARTA_OUT = path.join('..', 'site', 'src', 'locatii_harta.json');

const pauza = (ms) => new Promise((r) => setTimeout(r, ms));
const slug = (s) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
const escRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// paletă de culori distincte, câte una per brand
const PALETA = [
  '#e6194b', '#3cb44b', '#4363d8', '#f58231', '#911eb4', '#46f0f0', '#f032e6',
  '#bcf60c', '#fabebe', '#008080', '#e6beff', '#9a6324', '#800000', '#aaffc3',
  '#808000', '#ffd8b1', '#000075', '#a9a9a9', '#ff4500', '#1e90ff', '#228b22',
  '#c71585', '#daa520', '#00ced1', '#8b008b', '#ff1493',
];

// Lista de branduri: din scraper/branduri.json (sursă durabilă). Dacă
// lipsește dar există încă orase.js, o extrage de-acolo. branduri.json e
// generat o dată din orase.js și rămâne chiar dacă orase.js e șters.
const BRANDURI_FISIER = 'branduri.json';
function branduriDinOrase() {
  const src = fs.readFileSync(ORASE, 'utf8');
  const set = new Set();
  for (const m of src.matchAll(/brand:\s*"([^"]+)"/g)) set.add(m[1]);
  for (const m of src.matchAll(/brand:\s*'([^']+)'/g)) set.add(m[1]);
  for (const m of src.matchAll(/branduri:\s*\[([^\]]+)\]/g)) {
    for (const b of m[1].matchAll(/"([^"]+)"|'([^']+)'/g)) set.add(b[1] || b[2]);
  }
  return [...set].filter((s) => s && s.trim().length > 1).sort();
}
function listaBranduri() {
  if (fs.existsSync(BRANDURI_FISIER)) return JSON.parse(fs.readFileSync(BRANDURI_FISIER, 'utf8'));
  if (fs.existsSync(ORASE)) return branduriDinOrase();
  console.log('Nu găsesc branduri.json și nici orase.js — dă brandurile ca argumente.');
  return [];
}

const companii = JSON.parse(fs.readFileSync(COMPANII, 'utf8'));
// QID-uri pentru branduri care nu-s în companii.json (verificate manual)
const QID_MANUAL = {
  Altex: 'Q2840436',
  BCR: 'Q806149',
  Dedeman: 'Q5249762',
  Deichmann: 'Q664543',
  'H&M': 'Q188326',
  IKEA: 'Q54078',
  Intersport: 'Q666888',
  "McDonald's": 'Q38076',
  OMV: 'Q168238',
  Sephora: 'Q2408041',
  Starbucks: 'Q37158',
};
const qidDe = (n) => {
  if (QID_MANUAL[n]) return QID_MANUAL[n];
  const c = companii.find((x) => x.nume === n);
  return c && c.wikidata_id && /^Q\d+$/.test(c.wikidata_id) ? c.wikidata_id : null;
};

async function overpass(query, incercare = 1) {
  const r = await fetch(OVERPASS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
    body: 'data=' + encodeURIComponent(query),
  });
  if ((r.status === 429 || r.status === 504) && incercare <= 3) {
    const asteapta = incercare * 20000;
    console.log(`    … server ocupat (${r.status}), aștept ${asteapta / 1000}s`);
    await pauza(asteapta);
    return overpass(query, incercare + 1);
  }
  if (!r.ok) throw new Error(`Overpass ${r.status}: ${(await r.text()).slice(0, 160)}`);
  return r.json();
}

function interogare(nume, qid) {
  const re = escRegex(nume);
  const c = [];
  // brand:wikidata și brand= sunt rapide și precise (indexate); name~
  // doar pe shop, ca plasă ușoară. Scanarea pe amenity/office e prea
  // lentă la nivel de țară, așa că ne bazăm pe tag-urile brand.
  if (qid) c.push(`nwr["brand:wikidata"="${qid}"](area.ro);`);
  c.push(`nwr["brand"="${nume}"](area.ro);`);
  c.push(`nwr["name"~"${re}",i]["shop"](area.ro);`);
  return `[out:json][timeout:120];area["ISO3166-1"="RO"][admin_level=2]->.ro;(${c.join('')});out center tags;`;
}

function adresa(t) {
  return [t['addr:street'], t['addr:housenumber']].filter(Boolean).join(' ') || null;
}

async function extrage(nume) {
  const qid = qidDe(nume);
  const t0 = Date.now();
  const d = await overpass(interogare(nume, qid));
  const vazut = new Set();
  const locatii = [];
  for (const e of d.elements || []) {
    const lat = e.lat ?? e.center?.lat;
    const lng = e.lon ?? e.center?.lon;
    if (lat == null || lng == null) continue;
    const cheie = e.type + '/' + e.id;
    if (vazut.has(cheie)) continue;
    vazut.add(cheie);
    const t = e.tags || {};
    locatii.push({
      lat: +lat.toFixed(6),
      lng: +lng.toFixed(6),
      nume: t.name || nume,
      oras: t['addr:city'] || null,
      adresa: adresa(t),
    });
  }
  const rezultat = {
    brand: nume,
    wikidata_id: qid,
    total: locatii.length,
    cu_oras: locatii.filter((l) => l.oras).length,
    generat: new Date().toISOString().slice(0, 10),
    locatii,
  };
  fs.writeFileSync(path.join(DATE, `locatii_${slug(nume)}.json`), JSON.stringify(rezultat, null, 2), 'utf8');
  console.log(
    `  ✔ ${nume.padEnd(30)} ${String(locatii.length).padStart(5)} locații  (${((Date.now() - t0) / 1000).toFixed(0)}s${qid ? ', via QID' : ''})`
  );
  return rezultat.total;
}

// combină toate date/locatii_*.json → site/src/locatii_harta.json
function combina() {
  const files = fs
    .readdirSync(DATE)
    .filter((f) => /^locatii_.+\.json$/.test(f))
    .sort();
  const branduri = [];
  const locatii = [];
  files.forEach((f, i) => {
    const d = JSON.parse(fs.readFileSync(path.join(DATE, f), 'utf8'));
    if (!d.locatii || d.locatii.length === 0) return;
    const culoare = PALETA[branduri.length % PALETA.length];
    branduri.push({ nume: d.brand, slug: slug(d.brand), culoare, total: d.locatii.length });
    for (const l of d.locatii) locatii.push({ brand: d.brand, ...l });
  });
  branduri.sort((a, b) => b.total - a.total);
  const out = { generat: new Date().toISOString().slice(0, 10), branduri, locatii };
  fs.writeFileSync(HARTA_OUT, JSON.stringify(out), 'utf8');
  console.log(
    `\n✔ Combinat: ${locatii.length} locații din ${branduri.length} branduri → ${HARTA_OUT} (${(fs.statSync(HARTA_OUT).size / 1024 / 1024).toFixed(1)} MB)`
  );
}

(async () => {
  fs.mkdirSync(DATE, { recursive: true });
  const args = process.argv.slice(2);

  if (args.includes('--combina')) {
    combina();
    return;
  }

  const branduri = args.length ? args : listaBranduri();
  console.log(`\n${branduri.length} branduri de extras:\n${branduri.join(', ')}\n`);

  let ok = 0;
  for (const b of branduri) {
    try {
      await extrage(b);
      ok++;
    } catch (e) {
      console.log(`  ✗ ${b}: ${e.message}`);
    }
    await pauza(4000); // politețe față de serverul public Overpass
  }
  console.log(`\n${ok}/${branduri.length} branduri extrase.`);
  combina();
  console.log('\n✔ Gata.\n');
})();

// ============================================================
// wikidata_companii.js (v3) — extrage date despre branduri/companii
// din API-ul oficial Wikidata.
//
// Rulezi din folderul scraper/ (fără npm install):
//   node wikidata_companii.js "Lidl" "Dedeman" "OMV Petrom"
//   node wikidata_companii.js Q1431486      (merge și cu ID Wikidata)
//
// v3: - reîncercare automată la eroarea 429 (rate limit Wikidata)
//     - salvează după FIECARE brand, nu la final
//     - ACUMULEAZĂ în date/companii_wikidata.json: brandurile noi se
//       adaugă, cele re-căutate se actualizează, restul rămân
// ============================================================

const fs = require('fs');
const path = require('path');

const BRANDURI = process.argv.slice(2);
if (BRANDURI.length === 0) {
  console.log('Folosire: node wikidata_companii.js "Lidl" "Dedeman" ...');
  process.exit(1);
}

const API = 'https://www.wikidata.org/w/api.php';
const LIMBA = 'en';
const FISIER = path.join('date', 'companii_wikidata.json');

const pauza = (ms) => new Promise((r) => setTimeout(r, ms));

// apel API cu reîncercare la 429 / erori de rețea
async function api(params, incercare = 1) {
  const url = API + '?' + new URLSearchParams({ format: 'json', ...params });
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'BrandExplorerRO/0.3 (proiect personal de invatare)' },
    });
    if (r.status === 429) throw new Error('429');
    if (!r.ok) throw new Error(`API ${r.status}`);
    return await r.json();
  } catch (e) {
    if (incercare <= 3) {
      const asteapta = incercare * 10000; // 10s, 20s, 30s
      console.log(`  … limitare/eroare (${e.message}), aștept ${asteapta / 1000}s și reîncerc`);
      await pauza(asteapta);
      return api(params, incercare + 1);
    }
    throw e;
  }
}

// P31 ("instance of") — tipurile acceptate: firme și branduri
const TIPURI_FIRMA = [
  'Q783794',   // company
  'Q891723',   // public company (listate la bursă)
  'Q4830453',  // business
  'Q6881511',  // enterprise
  'Q167037',   // corporation
  'Q431289',   // brand
  'Q507619',   // retail chain
  'Q18043413', // supermarket chain
  'Q190117',   // automobile manufacturer
  'Q1973694',  // bank
  'Q688515',   // insurance company
];

// cuvinte care indică o firmă/brand în descrierea Wikidata (pentru treapta 2)
const SEMNE_FIRMA =
  /company|brand|chain|retailer|manufacturer|corporation|business|enterprise|conglomerate|producer|maker|bank|supermarket|store|restaurant|fast.?food|coffee|fashion|clothing|automaker|airline|operator|telecommunications|oil|energy|pharma/i;

async function cautaEntitate(nume) {
  if (/^Q\d+$/.test(nume)) return { id: nume, label: nume, description: '(ID direct)' };

  // TREAPTA 1: căutare filtrată — doar entități care SUNT firme/branduri
  try {
    const filtru = 'haswbstatement:' + TIPURI_FIRMA.map((q) => 'P31=' + q).join('|');
    const d = await api({
      action: 'query',
      list: 'search',
      srsearch: `${nume} ${filtru}`,
      srlimit: '5',
    });
    const hit = d?.query?.search?.[0];
    if (hit && /^Q\d+$/.test(hit.title)) {
      return { id: hit.title, label: nume, description: '(găsit cu filtrul de firmă/brand)' };
    }
  } catch {}

  // TREAPTA 2 (rezervă): căutarea clasică + euristica pe descriere
  const d = await api({
    action: 'wbsearchentities',
    search: nume,
    language: 'en',
    uselang: LIMBA,
    type: 'item',
    limit: 10,
  });
  if (!d.search || d.search.length === 0) return null;
  const firma = d.search.find((r) => r.description && SEMNE_FIRMA.test(r.description));
  return firma || d.search[0];
}

// ---- helpers pentru claims ----
const claims = (ent, p) => (ent.claims && ent.claims[p]) || [];
const idDin = (c) => c.mainsnak?.datavalue?.value?.id || null;
const stringDin = (c) => c.mainsnak?.datavalue?.value || null;
const numarDin = (c) => {
  const v = c.mainsnak?.datavalue?.value;
  return v && v.amount ? parseFloat(v.amount) : null;
};

async function fisa(entitateId) {
  const d = await api({
    action: 'wbgetentities',
    ids: entitateId,
    props: 'claims|labels|descriptions',
    languages: LIMBA,
  });
  const ent = d.entities[entitateId];
  const listari = claims(ent, 'P414').map((c) => ({
    bursa_id: idDin(c),
    simbol: c.qualifiers?.P249?.[0]?.datavalue?.value || null,
  }));
  return {
    wikidata_id: entitateId,
    nume: ent.labels?.[LIMBA]?.value || entitateId,
    descriere: ent.descriptions?.[LIMBA]?.value || null,
    companie_mama_id: idDin(claims(ent, 'P749')[0] || {}),
    proprietar_id: idDin(claims(ent, 'P127')[0] || {}),
    listari,
    site_oficial: stringDin(claims(ent, 'P856')[0] || {}),
    sediu_id: idDin(claims(ent, 'P159')[0] || {}),
    industrie_id: idDin(claims(ent, 'P452')[0] || {}),
    angajati: numarDin(claims(ent, 'P1128')[0] || {}),
  };
}

// rezolvă etichetele pentru un set de ID-uri Q
async function etichete(ids) {
  const rezultat = {};
  const lista = [...new Set(ids.filter(Boolean))];
  for (let i = 0; i < lista.length; i += 50) {
    const d = await api({
      action: 'wbgetentities',
      ids: lista.slice(i, i + 50).join('|'),
      props: 'labels',
      languages: LIMBA,
    });
    for (const [q, e] of Object.entries(d.entities || {})) {
      rezultat[q] = e.labels?.[LIMBA]?.value || q;
    }
  }
  return rezultat;
}

function completeaza(info, et) {
  info.companie_mama = et[info.companie_mama_id] || null;
  info.proprietar = et[info.proprietar_id] || null;
  info.sediu = et[info.sediu_id] || null;
  info.industrie = et[info.industrie_id] || null;
  info.listari = info.listari.map((l) => ({
    bursa: et[l.bursa_id] || l.bursa_id,
    simbol: l.simbol,
  }));
}

// ---- încărcare + salvare cu acumulare ----
function incarca() {
  if (!fs.existsSync(FISIER)) return [];
  try {
    return JSON.parse(fs.readFileSync(FISIER, 'utf-8'));
  } catch {
    console.log(`Atenție: ${FISIER} era corupt — pornesc cu listă goală.`);
    return [];
  }
}

function salveaza(toate, info) {
  // înlocuiește după wikidata_id sau după numele căutat; altfel adaugă
  const idx = toate.findIndex(
    (x) =>
      (info.wikidata_id && x.wikidata_id === info.wikidata_id) ||
      x.cautare === info.cautare
  );
  if (idx >= 0) toate[idx] = info;
  else toate.push(info);
  fs.mkdirSync('date', { recursive: true });
  fs.writeFileSync(FISIER, JSON.stringify(toate, null, 2), 'utf-8');
}

(async () => {
  const toate = incarca();
  console.log(`Fișier existent: ${toate.length} intrări.\n`);

  for (const numeBrand of BRANDURI) {
    console.log(`──── Caut: "${numeBrand}" ────`);
    try {
      const gasit = await cautaEntitate(numeBrand);
      if (!gasit) {
        console.log('  ✗ Nu există pe Wikidata.\n');
        salveaza(toate, { cautare: numeBrand, gasit: false });
        continue;
      }
      console.log(`  ✓ ${gasit.id}: ${gasit.label} — ${gasit.description || ''}`);

      const info = await fisa(gasit.id);
      info.cautare = numeBrand;
      info.gasit = true;

      if (info.companie_mama_id) {
        console.log(`  → compania mamă (${info.companie_mama_id})...`);
        info.companie_mama_detalii = await fisa(info.companie_mama_id);
      }

      // etichetele pentru acest brand (+ mama lui)
      const ids = [
        info.companie_mama_id, info.proprietar_id, info.sediu_id, info.industrie_id,
        ...info.listari.map((l) => l.bursa_id),
      ];
      if (info.companie_mama_detalii) {
        const m = info.companie_mama_detalii;
        ids.push(m.companie_mama_id, m.proprietar_id, m.sediu_id, m.industrie_id);
        ids.push(...m.listari.map((l) => l.bursa_id));
      }
      const et = await etichete(ids);
      completeaza(info, et);
      if (info.companie_mama_detalii) completeaza(info.companie_mama_detalii, et);

      salveaza(toate, info); // salvat imediat — nu se pierde la erori ulterioare

      const l = info.listari[0] || info.companie_mama_detalii?.listari?.[0];
      console.log(
        `  ✔ salvat | mamă: ${info.companie_mama || '—'} | bursă: ${
          l && l.simbol ? `${l.bursa}:${l.simbol}` : 'nelistată'
        }\n`
      );
    } catch (e) {
      console.log(`  ✗ eșuat definitiv: ${e.message} — trec mai departe.\n`);
    }
    await pauza(3000 + Math.random() * 2000); // 3-5s între branduri, sub radarul 429
  }

  console.log(`✔ Gata. ${toate.length} intrări în ${FISIER}\n`);
})();
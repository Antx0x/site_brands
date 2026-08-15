// ============================================================
// descarca_logos.js (v3) — TOATE logo-urile de pe Wikidata → logos_bf/
//
// Sursa de fallback pentru site (când Brandfetch nu are logo-ul).
// Spre deosebire de v2 (care lua UN singur logo per brand, direct în
// public/logos), v3 descarcă TOATE valorile din secțiunea "logo image"
// (P154) a fiecărei entități — multe branduri au mai multe.
//
// Le salvează în ../site/public/logos_bf ca:
//   <slug>_1.png, <slug>_2.png, ...
//   ex: coca_cola_co_1.png, coca_cola_co_2.png
//
// De acolo le organizezi manual: ștergi ce nu vrei, iar pe cea aleasă
// o redenumești în <slug>.png și o muți în public/logos/ (unde o caută
// fallback-ul din site).
//
// Citește entitățile (brand + companie-mamă) din datele curente ale
// site-ului: ../site/src/companii.json, după câmpul wikidata_id.
//
// Rulezi din folderul scraper/:
//   node descarca_logos.js                 → toate, în ../site/public/logos_bf
//   node descarca_logos.js --only coca     → o singură firmă (test)
//   node descarca_logos.js --dry           → doar arată ce ar descărca
//   node descarca_logos.js --force         → rescrie fișierele existente
//   node descarca_logos.js --dest <cale>   → alt folder de destinație
// ============================================================

const fs = require('fs');
const path = require('path');

// De unde citește entitățile. Implicit datele site-ului; poți suprascrie
// cu IN_FISIER (ex. IN_FISIER=date/companii_wikidata_consumables.json).
const COMPANII = process.env.IN_FISIER || path.join('..', 'site', 'src', 'companii.json');
const LATIME = 256;
const MAX_LOGO_PER_ENTITATE = Number(process.env.MAX_LOGO) || 12; // câte fișiere-logo/entitate

// ── argumente ────────────────────────────────────────────────
const argv = process.argv.slice(2);
const are = (n) => argv.includes(n);
const val = (n, implicit) => {
  const i = argv.indexOf(n);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : implicit;
};
const DEST = path.resolve(val('--dest', path.join('..', 'site', 'public', 'logos_bf')));
const FORTA = are('--force');
const USCAT = are('--dry');
const DOAR = (val('--only', '') || '').toLowerCase();

if (!fs.existsSync(COMPANII)) {
  console.log(`Nu găsesc ${COMPANII}`);
  process.exit(1);
}

// Wikimedia cere un User-Agent descriptiv, cu contact. Un UA generic
// e limitat (429) mult mai agresiv. Pune contactul tău aici (email sau
// pagina proiectului) — ajunge doar la serverele Wikimedia.
const CONTACT = 'antonioizbinda@gmail.com';
const UA = `BrandExplorerRO/0.4 (proiect personal de invatare; ${CONTACT})`;
const pauza = (ms) => new Promise((r) => setTimeout(r, ms));
const slug = (s) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_');

// fetch cu reîncercare pe 429/503: respectă antetul Retry-After dacă
// există, altfel backoff exponențial (2s, 4s, 8s...). Așa nu ne mai
// oprim la prima limitare — doar așteptăm și reluăm.
async function fetchWiki(url, opts = {}, reincercari = 4) {
  for (let i = 0; ; i++) {
    const r = await fetch(url, { ...opts, headers: { 'User-Agent': UA, ...(opts.headers || {}) } });
    if (r.status !== 429 && r.status !== 503) return r;
    if (i >= reincercari) return r; // renunțăm; apelantul tratează statusul
    const retryAfter = Number(r.headers.get('retry-after'));
    const asteapta = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2000 * 2 ** i;
    console.log(`   … ${r.status}, aștept ${(asteapta / 1000).toFixed(0)}s și reîncerc (${i + 1}/${reincercari})`);
    await pauza(asteapta);
  }
}

async function apiWikidata(params) {
  const url =
    'https://www.wikidata.org/w/api.php?' +
    new URLSearchParams({ format: 'json', ...params });
  const r = await fetchWiki(url);
  if (!r.ok) throw new Error(`API ${r.status}`);
  return r.json();
}

// TOATE fișierele-logo valide din P154 (nu doar unul), în ordine:
// întâi "preferred", apoi restul; fără cele "deprecated"; deduplicat.
function toateLogourile(declaratii) {
  if (!declaratii || declaratii.length === 0) return [];
  const valide = declaratii.filter(
    (c) => c?.mainsnak?.datavalue?.value && c.rank !== 'deprecated'
  );
  valide.sort((a, b) => (b.rank === 'preferred' ? 1 : 0) - (a.rank === 'preferred' ? 1 : 0));
  const fisiere = valide.map((c) => c.mainsnak.datavalue.value);
  return [...new Set(fisiere)]; // elimină duplicatele, păstrează ordinea
}

// apel la API-ul Commons (nu Wikidata)
async function apiCommons(params) {
  const url =
    'https://commons.wikimedia.org/w/api.php?' + new URLSearchParams({ format: 'json', ...params });
  const r = await fetchWiki(url);
  if (!r.ok) throw new Error(`Commons ${r.status}`);
  return r.json();
}

// P373 = numele categoriei Commons a entității. Multe categorii au un
// subgrup de logo-uri (ex. "Foo logos") sau fișiere cu "logo"/"icon" în
// nume. Întoarcem fișierele-logo din categorie + din subcategoriile-logo.
async function logouriDinCategorie(categorie) {
  const gasite = [];
  const cats = ['Category:' + categorie];
  try {
    const sub = await apiCommons({
      action: 'query',
      list: 'categorymembers',
      cmtitle: 'Category:' + categorie,
      cmtype: 'subcat',
      cmlimit: '50',
    });
    for (const m of sub?.query?.categorymembers || []) {
      if (/logo/i.test(m.title)) cats.push(m.title); // ex. "Category:Foo logos"
    }
  } catch {}
  for (const cat of cats) {
    try {
      const d = await apiCommons({
        action: 'query',
        list: 'categorymembers',
        cmtitle: cat,
        cmtype: 'file',
        cmlimit: '200',
      });
      const catELogo = /logo/i.test(cat);
      for (const m of d?.query?.categorymembers || []) {
        const titlu = m.title.replace(/^File:/, '');
        if (!/\.(png|svg|jpe?g|webp)$/i.test(titlu)) continue;
        // dintr-o categorie generală luăm doar fișierele cu "logo"/"icon" în
        // nume; dintr-o subcategorie de logo-uri le luăm pe toate
        if (catELogo || /logo|icon/i.test(titlu)) gasite.push(titlu);
      }
    } catch {}
    await pauza(300);
  }
  return [...new Set(gasite)];
}

// URL de descărcare prin API-ul Commons (metoda de rezervă)
async function urlPrinApi(fisier) {
  const url =
    'https://commons.wikimedia.org/w/api.php?' +
    new URLSearchParams({
      format: 'json',
      action: 'query',
      titles: 'File:' + fisier,
      prop: 'imageinfo',
      iiprop: 'url',
      iiurlwidth: String(LATIME),
    });
  const r = await fetchWiki(url);
  if (!r.ok) return null;
  const d = await r.json();
  const pagina = Object.values(d?.query?.pages || {})[0];
  return pagina?.imageinfo?.[0]?.thumburl || pagina?.imageinfo?.[0]?.url || null;
}

async function descarca(urlImg) {
  const r = await fetchWiki(urlImg, { redirect: 'follow' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length < 200) throw new Error('fișier gol');
  return buf;
}

// descarcă un fișier Commons (cu metoda de rezervă), întoarce buffer-ul
async function descarcaCommons(fisier) {
  try {
    return await descarca(
      'https://commons.wikimedia.org/wiki/Special:FilePath/' +
        encodeURIComponent(fisier) +
        `?width=${LATIME}`
    );
  } catch {
    const alternativ = await urlPrinApi(fisier);
    if (!alternativ) throw new Error('nici API-ul Commons nu a dat URL');
    return descarca(alternativ);
  }
}

(async () => {
  const companii = JSON.parse(fs.readFileSync(COMPANII, 'utf-8')).filter((c) => c.gasit);

  // qid → nume, pentru branduri ȘI companii-mamă
  const entitati = new Map();
  for (const c of companii) {
    if (c.wikidata_id) entitati.set(c.wikidata_id, c.nume);
    const m = c.companie_mama_detalii;
    if (m && m.wikidata_id) entitati.set(m.wikidata_id, m.nume);
  }

  let lista = [...entitati]; // [qid, nume]
  if (DOAR) lista = lista.filter(([, nume]) => nume.toLowerCase().includes(DOAR));

  if (lista.length === 0) {
    console.log(DOAR ? `Nicio firmă nu se potrivește cu "${DOAR}".` : 'Nicio entitate de procesat.');
    process.exit(0);
  }

  console.log(`\n${lista.length} entități de verificat.`);
  console.log(`Destinație: ${DEST}${USCAT ? '  (--dry: nu se scrie nimic)' : ''}\n`);
  if (!USCAT) fs.mkdirSync(DEST, { recursive: true });

  // P154 (logo image) + P373 (Commons category) pentru toate entitățile
  const ids = lista.map(([qid]) => qid);
  const logos = {}; // qid → [fisier1, fisier2, ...]
  const commonsCat = {}; // qid → numele categoriei Commons (P373)
  for (let i = 0; i < ids.length; i += 50) {
    try {
      const d = await apiWikidata({
        action: 'wbgetentities',
        ids: ids.slice(i, i + 50).join('|'),
        props: 'claims',
      });
      for (const [qid, ent] of Object.entries(d.entities || {})) {
        logos[qid] = toateLogourile(ent?.claims?.P154);
        const cat = ent?.claims?.P373?.[0]?.mainsnak?.datavalue?.value;
        if (cat) commonsCat[qid] = cat;
      }
    } catch (e) {
      console.log(`! lotul ${i / 50 + 1} a eșuat (${e.message}) — reîncearcă mai târziu`);
    }
    await pauza(1200);
  }

  // Îmbogățire: logo-uri suplimentare din categoria Commons (P373)
  const cuCat = ids.filter((q) => commonsCat[q]);
  if (cuCat.length) console.log(`\nCaut logo-uri în categorii Commons (P373) pentru ${cuCat.length} entități...`);
  for (const q of cuCat) {
    try {
      const extra = await logouriDinCategorie(commonsCat[q]);
      if (extra.length) {
        const set = new Set(logos[q] || []); // P154 rămân primele
        for (const f of extra) set.add(f);
        logos[q] = [...set].slice(0, MAX_LOGO_PER_ENTITATE);
      }
    } catch {}
    await pauza(300);
  }

  let descarcate = 0, sarite = 0;
  const probleme = [];

  for (const [qid, nume] of lista) {
    const fisiere = logos[qid] || [];
    if (fisiere.length === 0) {
      probleme.push(`${nume} (${qid}): nu are P154 pe Wikidata sau lotul a eșuat`);
      console.log(`✗ ${nume}: niciun logo`);
      continue;
    }

    console.log(`\n${nume}  (${qid})  — ${fisiere.length} logo-uri P154`);
    let n = 0;
    for (const fisier of fisiere) {
      n++;
      const numeFisier = `${slug(nume)}_${n}.png`;
      const destinatie = path.join(DEST, numeFisier);

      if (!FORTA && !USCAT && fs.existsSync(destinatie)) {
        sarite++;
        continue;
      }
      if (USCAT) {
        console.log(`  · ${numeFisier.padEnd(34)} ← ${fisier}`);
        continue;
      }
      try {
        const buf = await descarcaCommons(fisier);
        fs.writeFileSync(destinatie, buf);
        descarcate++;
        console.log(`  ✔ ${numeFisier.padEnd(34)} (${(buf.length / 1024).toFixed(0)} KB)`);
      } catch (e) {
        probleme.push(`${nume} → ${numeFisier}: "${fisier}" — ${e.message}`);
        console.log(`  ✗ ${numeFisier}: ${e.message}`);
      }
      await pauza(800 + Math.random() * 400);
    }
  }

  console.log(`\n============================================`);
  if (USCAT) console.log('Rulare de probă (--dry) — nu s-a scris niciun fișier.');
  else console.log(`✔ ${descarcate} descărcate, ${sarite} existau deja.`);
  if (probleme.length > 0) {
    console.log(`\nProbleme (${probleme.length}):`);
    for (const p of probleme) console.log('  - ' + p);
  }
  console.log(`============================================\n`);
})();

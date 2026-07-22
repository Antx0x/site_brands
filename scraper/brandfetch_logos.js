// ============================================================
// brandfetch_logos.js — TOATE logo-urile de la Brandfetch → folder local
//
// Spre deosebire de descarca_logos.js (care ia logo-urile de pe
// Wikidata/Commons), acesta caută după DOMENIUL firmei, luat din
// câmpul "site_oficial" din companii.json.
//
// Descarcă TOATE variantele pe care le oferă Brandfetch pentru fiecare
// firmă (icon / symbol / logo / other, temă light / dark, format
// png / jpeg / webp / svg). Le salvează pe toate, ca să alegi tu manual
// pe care o vrei. Numele fișierului:
//
//   <slug>__<NN>_<tip>_<tema>.<ext>
//   ex: kfc__01_icon_dark.jpeg, kfc__02_logo_light.png, kfc__02_logo_light.svg
//
// Toate variantele aceleiași firme încep cu același prefix (kfc__),
// deci stau grupate când sortezi folderul. NN e indexul variantei din
// răspunsul API (păstrează ordinea), ca să nu se suprascrie două „other".
// Extensia e cea REALĂ a imaginii (ca fișierul să fie valid / vizibil).
//
// Fluxul tău: te uiți în folder → alegi fișierul care-ți place →
// îl redenumești în <slug>.png → îl muți în site/public/logos/.
// (Dacă alegi un .svg sau .jpeg, îl convertești în .png înainte.)
//
// Cheia de Brand API se pune în scraper/.env (fișier care NU se comite):
//   BRANDFETCH_API_KEY=cheia_ta
// Atenție: e cheia de Brand API (lungă), NU Client ID-ul de CDN.
//
// Rulezi din folderul scraper/:
//   node brandfetch_logos.js                → toate firmele, în ../site/public/logos_bf
//   node brandfetch_logos.js --only kfc     → o singură firmă (test)
//   node brandfetch_logos.js --dry          → doar arată ce ar descărca
//   node brandfetch_logos.js --force        → rescrie fișierele existente
//   node brandfetch_logos.js --no-svg       → sare peste variantele SVG
//   node brandfetch_logos.js --dest <cale>  → alt folder de destinație
// ============================================================

const fs = require('fs');
const path = require('path');

// .env din folderul scraper/ (Node 22 îl citește nativ)
try {
  process.loadEnvFile(path.join(__dirname, '.env'));
} catch {
  // lipsește .env — mergem pe variabila de mediu, dacă există
}

const CHEIE = process.env.BRANDFETCH_API_KEY;
const COMPANII = path.join('..', 'site', 'src', 'companii.json');

// ── argumente din linia de comandă ───────────────────────────
const argv = process.argv.slice(2);
const are = (n) => argv.includes(n);
const val = (n, implicit) => {
  const i = argv.indexOf(n);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : implicit;
};

const DEST = path.resolve(val('--dest', path.join('..', 'site', 'public', 'logos_bf')));
const FORTA = are('--force');
const USCAT = are('--dry');
const FARA_SVG = are('--no-svg');
const DOAR = (val('--only', '') || '').toLowerCase();

const slug = (s) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_');

const pauza = (ms) => new Promise((r) => setTimeout(r, ms));

// ── domenii corectate manual ─────────────────────────────────
// Wikidata pune uneori în "site_oficial" un URL care nu e site-ul
// brandului (o inițiativă, o subpagină). Aici le suprascriem.
const DOMENII_MANUAL = {
  'Schwarz Group': 'schwarz-gruppe.de', // site_oficial → reset-plastic.com (inițiativă de mediu)
};

function domeniuPentru(nume, siteOficial) {
  if (DOMENII_MANUAL[nume]) return DOMENII_MANUAL[nume];
  if (!siteOficial) return null;
  try {
    return new URL(siteOficial).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

// ── API Brandfetch ───────────────────────────────────────────
async function iaBrand(domeniu) {
  const r = await fetch(`https://api.brandfetch.io/v2/brands/${encodeURIComponent(domeniu)}`, {
    headers: { Authorization: `Bearer ${CHEIE}`, Accept: 'application/json' },
  });
  if (r.status === 404) throw new Error('brand negăsit la Brandfetch');
  if (r.status === 401 || r.status === 403)
    throw new Error('cheie de API invalidă sau fără drepturi (e cheia de Brand API, nu Client ID-ul?)');
  if (r.status === 429) throw new Error('limită de cereri atinsă (429)');
  if (!r.ok) throw new Error(`API ${r.status}`);
  return r.json();
}

// extensia reală, după formatul raportat de API
const EXT = { jpeg: 'jpeg', jpg: 'jpeg', png: 'png', webp: 'webp', svg: 'svg' };

async function descarca(url) {
  const r = await fetch(url, { redirect: 'follow' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length < 100) throw new Error('fișier gol');
  return buf;
}

// Din obiectul brandului, scoate lista plată de variante de descărcat.
// Fiecare intrare din brand.logos poate avea mai multe formate; le luăm
// pe toate (png/jpeg/webp/svg), fiecare devine un fișier separat.
function varianteDinBrand(brand) {
  const out = [];
  (brand?.logos || []).forEach((l, idx) => {
    const tip = l.type || 'other';
    const tema = l.theme || 'notema';
    for (const f of l.formats || []) {
      const ext = EXT[(f.format || '').toLowerCase()];
      if (!f.src || !ext) continue;
      if (FARA_SVG && ext === 'svg') continue;
      const nn = String(idx + 1).padStart(2, '0');
      out.push({
        eticheta: `${nn}_${tip}_${tema}`, // fără extensie; se adaugă la salvare
        ext,
        src: f.src,
        marime: f.size || null,
        dim: f.width && f.height ? `${f.width}x${f.height}` : '—',
      });
    }
  });
  return out;
}

// ── program principal ────────────────────────────────────────
(async () => {
  if (!CHEIE) {
    console.log('\nLipsește cheia de API.');
    console.log('Creează scraper/.env cu linia:');
    console.log('   BRANDFETCH_API_KEY=cheia_ta_de_Brand_API\n');
    process.exit(1);
  }
  if (!fs.existsSync(COMPANII)) {
    console.log(`Nu găsesc ${COMPANII}`);
    process.exit(1);
  }

  // brandurile + companiile-mamă, fiecare cu domeniul ei
  const companii = JSON.parse(fs.readFileSync(COMPANII, 'utf-8')).filter((c) => c.gasit);
  const entitati = new Map(); // nume → domeniu
  for (const c of companii) {
    entitati.set(c.nume, domeniuPentru(c.nume, c.site_oficial));
    const m = c.companie_mama_detalii;
    if (m && m.nume) entitati.set(m.nume, domeniuPentru(m.nume, m.site_oficial));
  }

  let lista = [...entitati];
  if (DOAR) lista = lista.filter(([n]) => n.toLowerCase().includes(DOAR));

  if (lista.length === 0) {
    console.log(DOAR ? `Nicio firmă nu se potrivește cu "${DOAR}".` : 'Nicio firmă de procesat.');
    process.exit(0);
  }

  console.log(`\n${lista.length} entități de procesat.`);
  console.log(`Destinație: ${DEST}${USCAT ? '  (--dry: nu se scrie nimic)' : ''}`);
  console.log(FARA_SVG ? 'SVG: sărit (--no-svg)\n' : 'Se descarcă toate formatele (inclusiv SVG).\n');

  if (!USCAT) fs.mkdirSync(DEST, { recursive: true });

  let fisiere = 0, sarite = 0, firmeOk = 0;
  const probleme = [];

  for (const [nume, domeniu] of lista) {
    if (!domeniu) {
      probleme.push(`${nume}: nu are site_oficial valid în companii.json`);
      console.log(`✗ ${nume}: fără domeniu`);
      continue;
    }

    let variante;
    try {
      const brand = await iaBrand(domeniu);
      variante = varianteDinBrand(brand);
    } catch (e) {
      probleme.push(`${nume} (${domeniu}): ${e.message}`);
      console.log(`✗ ${nume}: ${e.message}`);
      if (e.message.includes('429')) {
        console.log('\nOprire: limita de cereri a fost atinsă.');
        break;
      }
      await pauza(500);
      continue;
    }

    if (variante.length === 0) {
      probleme.push(`${nume} (${domeniu}): Brandfetch nu are nicio variantă descărcabilă`);
      console.log(`✗ ${nume}: nicio variantă`);
      await pauza(400);
      continue;
    }

    console.log(`\n${nume}  (${domeniu})  — ${variante.length} variante`);
    firmeOk++;

    for (const v of variante) {
      const fisier = `${slug(nume)}__${v.eticheta}.${v.ext}`;
      const destinatie = path.join(DEST, fisier);

      if (!FORTA && !USCAT && fs.existsSync(destinatie)) {
        sarite++;
        continue;
      }
      if (USCAT) {
        console.log(`  · ${fisier.padEnd(42)} ${v.dim}`);
        continue;
      }
      try {
        const buf = await descarca(v.src);
        fs.writeFileSync(destinatie, buf);
        fisiere++;
        console.log(`  ✔ ${fisier.padEnd(42)} ${v.dim}  (${(buf.length / 1024).toFixed(0)} KB)`);
      } catch (e) {
        probleme.push(`${nume} → ${fisier}: ${e.message}`);
        console.log(`  ✗ ${fisier}: ${e.message}`);
      }
      await pauza(250 + Math.random() * 200);
    }

    await pauza(300);
  }

  console.log(`\n============================================`);
  if (USCAT) console.log(`Rulare de probă (--dry) — nu s-a scris nimic. ${firmeOk} firme au variante.`);
  else console.log(`✔ ${fisiere} fișiere descărcate din ${firmeOk} firme, ${sarite} existau deja.`);
  if (probleme.length > 0) {
    console.log(`\nProbleme (${probleme.length}):`);
    for (const p of probleme) console.log('  - ' + p);
  }
  console.log(`============================================\n`);
})();

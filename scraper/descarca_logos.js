// ============================================================
// descarca_logos.js (v2) — logo-uri de pe Wikidata → site/public/logos/
//
// v2:
//  - alege corect logo-ul când există mai multe valori:
//    rangul "preferred" primul; altfel una FĂRĂ "end time"
//    (adică logo-ul actual, nu cel istoric); ignoră "deprecated"
//  - motiv clar în consolă pentru fiecare eșec (nu are P154 /
//    eroare la descărcare / etc.)
//  - metodă de rezervă la descărcare (API-ul Commons) dacă
//    Special:FilePath dă eroare
//
// Rulezi din folderul scraper/:
//   node descarca_logos.js
// ============================================================

const fs = require('fs');
const path = require('path');

const COMPANII = path.join('date', 'companii_wikidata.json');
const DEST = path.join('..', 'site', 'public', 'logos');
const LATIME = 256;

if (!fs.existsSync(COMPANII)) {
  console.log('Nu găsesc date/companii_wikidata.json');
  process.exit(1);
}

const UA = 'BrandExplorerRO/0.2 (proiect personal de invatare)';
const pauza = (ms) => new Promise((r) => setTimeout(r, ms));
const slug = (s) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_');

async function apiWikidata(params) {
  const url =
    'https://www.wikidata.org/w/api.php?' +
    new URLSearchParams({ format: 'json', ...params });
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error(`API ${r.status}`);
  return r.json();
}

// alege logo-ul corect dintre mai multe declarații P154
function alegeLogo(declaratii) {
  if (!declaratii || declaratii.length === 0) return null;
  const valide = declaratii.filter(
    (c) => c?.mainsnak?.datavalue?.value && c.rank !== 'deprecated'
  );
  if (valide.length === 0) return null;
  // 1) rangul "preferred" (logo-ul marcat drept actual)
  const preferat = valide.find((c) => c.rank === 'preferred');
  if (preferat) return preferat.mainsnak.datavalue.value;
  // 2) o valoare fără calificativul "end time" (P582) = încă în uz
  const curenta = valide.find((c) => !c.qualifiers?.P582);
  if (curenta) return curenta.mainsnak.datavalue.value;
  // 3) altfel, ultima din listă (cea mai recentă istoric)
  return valide[valide.length - 1].mainsnak.datavalue.value;
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
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!r.ok) return null;
  const d = await r.json();
  const pagina = Object.values(d?.query?.pages || {})[0];
  return pagina?.imageinfo?.[0]?.thumburl || pagina?.imageinfo?.[0]?.url || null;
}

async function descarca(urlImg) {
  const r = await fetch(urlImg, { redirect: 'follow', headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length < 200) throw new Error('fișier gol');
  return buf;
}

(async () => {
  fs.mkdirSync(DEST, { recursive: true });

  const companii = JSON.parse(fs.readFileSync(COMPANII, 'utf-8')).filter((c) => c.gasit);
  const entitati = new Map();
  for (const c of companii) {
    if (c.wikidata_id) entitati.set(c.wikidata_id, c.nume);
    const m = c.companie_mama_detalii;
    if (m && m.wikidata_id) entitati.set(m.wikidata_id, m.nume);
  }
  console.log(`\n${entitati.size} entități de verificat.\n`);

  // P154 în loturi de 50, cu toleranță la erori per lot
  const ids = [...entitati.keys()];
  const logos = {};
  for (let i = 0; i < ids.length; i += 50) {
    try {
      const d = await apiWikidata({
        action: 'wbgetentities',
        ids: ids.slice(i, i + 50).join('|'),
        props: 'claims',
      });
      for (const [qid, ent] of Object.entries(d.entities || {})) {
        const fisier = alegeLogo(ent?.claims?.P154);
        if (fisier) logos[qid] = fisier;
      }
    } catch (e) {
      console.log(`! lotul ${i / 50 + 1} a eșuat (${e.message}) — reîncearcă mai târziu`);
    }
    await pauza(800);
  }

  let descarcate = 0, sarite = 0;
  const probleme = [];

  for (const [qid, nume] of entitati) {
    const destinatie = path.join(DEST, `${slug(nume)}.png`);
    if (fs.existsSync(destinatie)) {
      sarite++;
      continue;
    }
    if (!logos[qid]) {
      probleme.push(`${nume} (${qid}): nu are P154 pe Wikidata sau lotul a eșuat`);
      continue;
    }

    try {
      let buf;
      try {
        // metoda 1: Special:FilePath (redirect direct la thumbnail)
        buf = await descarca(
          'https://commons.wikimedia.org/wiki/Special:FilePath/' +
            encodeURIComponent(logos[qid]) +
            `?width=${LATIME}`
        );
      } catch {
        // metoda 2: API-ul Commons → thumburl
        const alternativ = await urlPrinApi(logos[qid]);
        if (!alternativ) throw new Error('nici API-ul Commons nu a dat URL');
        buf = await descarca(alternativ);
      }
      fs.writeFileSync(destinatie, buf);
      descarcate++;
      console.log(`✔ ${nume} → logos/${slug(nume)}.png (${(buf.length / 1024).toFixed(0)} KB)`);
    } catch (e) {
      probleme.push(`${nume}: "${logos[qid]}" — ${e.message}`);
      console.log(`✗ ${nume}: ${e.message}`);
    }
    await pauza(400 + Math.random() * 300);
  }

  console.log(`\n============================================`);
  console.log(`✔ ${descarcate} descărcate, ${sarite} existau deja.`);
  if (probleme.length > 0) {
    console.log(`\nProbleme (${probleme.length}):`);
    for (const p of probleme) console.log('  - ' + p);
  }
  console.log(`============================================\n`);
})();
// ============================================================
// scrape.js — Scraper Google Maps pentru proiectul Local Reviews (v3)
//
// Cum rulezi (din folderul scraper/):
//   node scrape.js "restaurante Piatra Neamț"
//   node scrape.js "cafenele Piatra Neamț"
//
// Rezultatul se salvează în folderul date/ ca fișier JSON.
// ============================================================

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// ===== CONFIGURARE =====
const CAUTARE = process.argv[2] || 'restaurante Piatra Neamț';
const ORAS = 'Piatra Neamț';
const JUDET = 'Neamț';
const DELAY_MIN = 3000; // ms — pauza minimă între acțiuni
const DELAY_MAX = 8000; // ms — pauza maximă
const MAX_SCROLLS = 60; // limită de siguranță ca să nu ruleze la infinit

// Pauză aleatorie, ca un om (niciodată exact același interval)
function pauza() {
  const ms = DELAY_MIN + Math.random() * (DELAY_MAX - DELAY_MIN);
  return new Promise((r) => setTimeout(r, ms));
}

// "(1.234)" -> 1234  |  "2,1 mii" -> 2100  |  "2.1K" -> 2100
function parseNumarReviews(text) {
  if (!text) return 0;
  // format prescurtat folosit de Google peste ~1000 de recenzii
  if (/mii|\d\s*k\b/i.test(text)) {
    const m = text.match(/(\d+(?:[.,]\d+)?)/);
    return m ? Math.round(parseFloat(m[1].replace(',', '.')) * 1000) : 0;
  }
  const cifre = text.replace(/[^\d]/g, '');
  return cifre ? parseInt(cifre, 10) : 0;
}

// "4,5" -> 4.5
function parseRating(text) {
  if (!text) return null;
  const v = parseFloat(text.replace(',', '.'));
  return Number.isNaN(v) ? null : v;
}

(async () => {
  console.log(`\n=== Caut: "${CAUTARE}" ===\n`);

  const browser = await chromium.launch({ headless: false }); // vizibil = mai greu de detectat
  const context = await browser.newContext({
    locale: 'ro-RO',
    viewport: { width: 1400, height: 900 },
  });
  const page = await context.newPage();

  await page.goto(
    `https://www.google.com/maps/search/${encodeURIComponent(CAUTARE)}`,
    { waitUntil: 'domcontentloaded' }
  );

  // Pagina de consimțământ GDPR (apare de obicei doar la prima rulare)
  try {
    await page
      .getByRole('button', { name: /Acceptă tot|Accept all/i })
      .click({ timeout: 6000 });
    console.log('Am acceptat pagina de consimțământ.');
    await pauza();
  } catch {
    // nu a apărut — e ok
  }

  // Lista de rezultate din stânga
  const feed = page.locator('div[role="feed"]');
  await feed.waitFor({ timeout: 20000 });
  await pauza();

  // ===== SCROLL până la finalul listei =====
  let nrAnterior = 0;
  let faraProgres = 0;

  for (let i = 1; i <= MAX_SCROLLS; i++) {
    await feed.evaluate((el) => el.scrollBy(0, el.clientHeight * 2));
    await pauza();

    const nrCurent = await page.locator('div[role="feed"] a.hfpxzc').count();
    console.log(`Scroll ${i}: ${nrCurent} locații încărcate`);

    // Google afișează acest text când nu mai are rezultate
    const sfarsit = await page
      .getByText(/sfârșitul listei|end of the list/i)
      .count();
    if (sfarsit > 0) {
      console.log('\nAm ajuns la finalul listei.');
      break;
    }

    if (nrCurent === nrAnterior) {
      faraProgres++;
      if (faraProgres >= 4) {
        console.log('\nNu mai apar rezultate noi, mă opresc.');
        break;
      }
    } else {
      faraProgres = 0;
    }
    nrAnterior = nrCurent;
  }

  // ===== EXTRAGEREA datelor din carduri =====
  const brute = await page.$$eval('div[role="feed"] div.Nv2PK', (carduri) =>
    carduri.map((card) => {
      const link = card.querySelector('a.hfpxzc');
      const rating = card.querySelector('span.MW4etd');
      const img = card.querySelector('img');

      // Numărul de recenzii — încercăm 3 variante, în ordine:
      let reviews_text = null;
      // 1) clasa clasică
      const r1 = card.querySelector('span.UY7F9');
      if (r1) reviews_text = r1.textContent;
      // 2) aria-label-ul rândului cu stele: "4,5 stele 2.176 recenzii"
      if (!reviews_text) {
        const stele = card.querySelector('span[role="img"]');
        const aria = stele ? stele.getAttribute('aria-label') || '' : '';
        const m = aria.match(/(\d[\d.,]*)\s*(?:de\s*)?(recenzi|review)/i);
        if (m) reviews_text = m[1];
      }
      // 3) numărul din paranteze din textul cardului: "4,5(1.234)" sau "4,6(2,1 mii)"
      if (!reviews_text) {
        const m2 = (card.textContent || '').match(/\((\d[\d.,]*\s*(?:mii|k)?)\)/i);
        if (m2) reviews_text = m2[1];
      }

      // Categoria: căutăm rândul de detalii de tip "Restaurant · Str. Ștefan cel Mare 5"
      let categorie = null;
      const randuri = card.querySelectorAll('.W4Efsd');
      for (const rand of randuri) {
        const t = rand.textContent || '';
        // sărim peste rândul cu ratingul (conține paranteze cu nr. de recenzii)
        if (t.includes('·') && !t.includes('(')) {
          categorie = t.split('·')[0].trim();
          break;
        }
      }

      return {
        nume: link ? link.getAttribute('aria-label') : null,
        url_maps: link ? link.href : null,
        rating_text: rating ? rating.textContent : null,
        reviews_text,
        categorie,
        poza_url: img ? img.src : null,
      };
    })
  );

  await browser.close();

  // ===== CURĂȚARE + DEDUPLICARE =====
  const vazute = new Set();
  const locatii = [];

  for (const l of brute) {
    if (!l.nume || !l.url_maps) continue;
    if (vazute.has(l.url_maps)) continue; // aceeași locație poate apărea de 2 ori
    vazute.add(l.url_maps);

    locatii.push({
      nume: l.nume,
      rating: parseRating(l.rating_text),
      numar_reviewuri: parseNumarReviews(l.reviews_text),
      categorie: l.categorie,
      poza_url: l.poza_url,
      url_maps: l.url_maps,
      oras: ORAS,
      judet: JUDET,
      cautare: CAUTARE,
      extras_la: new Date().toISOString(),
    });
  }

  // ===== SALVARE =====
  const slug = CAUTARE
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // scoate diacriticele
    .replace(/[^a-z0-9]+/g, '_');

  fs.mkdirSync('date', { recursive: true });
  const fisier = path.join('date', `${slug}.json`);
  fs.writeFileSync(fisier, JSON.stringify(locatii, null, 2), 'utf-8');

  console.log(`\n✔ Am salvat ${locatii.length} locații în ${fisier}`);
  console.log(
    `   (din care ${locatii.filter((l) => l.numar_reviewuri >= 20).length} au minim 20 de recenzii)\n`
  );
})();
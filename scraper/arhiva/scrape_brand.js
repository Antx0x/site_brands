// ============================================================
// scrape_brand.js (v3) — caută un brand în top 100 orașe din România
//
// Rulezi din folderul scraper/:
//   node scrape_brand.js "McDonald's"
//
// v3: - lista = top 100 orașe după populație (~45-60 min/brand)
//     - pauze reduse: scroll 2-5s, între orașe 6-15s
//     - detecție CAPTCHA cu oprire automată (progres salvat)
// Progresul e salvat după fiecare oraș; la repornire continuă.
// ============================================================

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BRAND = process.argv[2];
if (!BRAND) {
  console.log('Folosire: node scrape_brand.js "McDonald\'s"');
  process.exit(1);
}

// Top 100 orașe după populație (recensământ 2021, ordine orientativă).
// Adaugă/scoate/comentează cu // după nevoie.
const ORASE = [
  // 1-10
  'București', 'Cluj-Napoca', 'Iași', 'Constanța', 'Timișoara',
  'Brașov', 'Craiova', 'Galați', 'Oradea', 'Ploiești',
  // 11-20
  'Brăila', 'Arad', 'Pitești', 'Bacău', 'Sibiu',
  'Târgu Mureș', 'Baia Mare', 'Buzău', 'Râmnicu Vâlcea', 'Botoșani',
  // 21-30
  'Satu Mare', 'Suceava', 'Bistrița', 'Piatra Neamț', 'Drobeta-Turnu Severin',
  'Târgoviște', 'Focșani', 'Târgu Jiu', 'Tulcea', 'Alba Iulia',
  // 31-40
  'Slatina', 'Reșița', 'Călărași', 'Giurgiu', 'Deva',
  'Hunedoara', 'Zalău', 'Sfântu Gheorghe', 'Roman', 'Bârlad',
  // 41-50
  'Vaslui', 'Mediaș', 'Turda', 'Slobozia', 'Voluntari',
  'Alexandria România', 'Popești-Leordeni', 'Medgidia', 'Năvodari', 'Lugoj',
  // 51-60
  'Onești', 'Miercurea Ciuc', 'Pantelimon', 'Sighetu Marmației', 'Săcele',
  'Petroșani', 'Mangalia', 'Tecuci', 'Odorheiu Secuiesc', 'Râmnicu Sărat',
  // 61-70
  'Pașcani', 'Reghin', 'Câmpina', 'Mioveni', 'Câmpulung',
  'Caracal', 'Fetești', 'Făgăraș', 'Curtea de Argeș', 'Sebeș',
  // 71-80
  'Bragadiru', 'Huși', 'Fălticeni', 'Oltenița', 'Dej',
  'Buftea', 'Roșiorii de Vede', 'Borșa', 'Sighișoara', 'Rădăuți',
  // 81-90
  'Dorohoi', 'Turnu Măgurele', 'Caransebeș', 'Zărnești', 'Codlea',
  'Câmpia Turzii', 'Târnăveni', 'Cisnădie', 'Vulcan', 'Aiud',
  // 91-100
  'Petrila', 'Lupeni', 'Otopeni', 'Cugir', 'Gherla',
  'Carei', 'Comănești', 'Târgu Neamț', 'Moinești', 'Motru',
];

const DELAY_MIN = 2000;
const DELAY_MAX = 5000;
const MAX_SCROLLS = 40;

const pauza = () =>
  new Promise((r) => setTimeout(r, DELAY_MIN + Math.random() * (DELAY_MAX - DELAY_MIN)));
const pauzaLunga = () =>
  new Promise((r) => setTimeout(r, 6000 + Math.random() * 9000)); // 6-15s între orașe

// ===== DETECȚIE CAPTCHA / BLOCAJ =====
async function esteBlocat(page) {
  if (page.url().includes('/sorry/')) return true; // pagina clasică de blocaj Google
  const areRecaptcha = await page
    .locator('iframe[src*="recaptcha"]')
    .count()
    .catch(() => 0);
  if (areRecaptcha > 0) return true;
  const text = await page
    .locator('body')
    .textContent({ timeout: 3000 })
    .catch(() => '');
  return /unusual traffic|trafic neobișnuit|nu ești un robot|not a robot/i.test(
    text || ''
  );
}

function parseNumar(text) {
  if (!text) return 0;
  if (/mii|\d\s*k\b/i.test(text)) {
    const m = text.match(/(\d+(?:[.,]\d+)?)/);
    return m ? Math.round(parseFloat(m[1].replace(',', '.')) * 1000) : 0;
  }
  const cifre = text.replace(/[^\d]/g, '');
  return cifre ? parseInt(cifre, 10) : 0;
}

function parseRating(text) {
  if (!text) return null;
  const v = parseFloat(String(text).replace(',', '.'));
  return Number.isNaN(v) ? null : v;
}

// cheie unică de locație: ID-ul Google din URL (sau URL-ul întreg)
function cheie(url) {
  const m = url && url.match(/19s(ChIJ[^?&!]+)/);
  return m ? m[1] : url;
}

const slug = (s) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_');

(async () => {
  fs.mkdirSync('date', { recursive: true });
  const FISIER = path.join('date', `brand_${slug(BRAND)}.json`);

  // reluăm de unde am rămas, dacă fișierul există deja
  let locatii = [];
  const oraseFacute = new Set();
  if (fs.existsSync(FISIER)) {
    try {
      locatii = JSON.parse(fs.readFileSync(FISIER, 'utf-8'));
    } catch {
      console.log(`Atenție: ${FISIER} e corupt/gol — pornesc de la zero.`);
      locatii = [];
    }
    locatii.forEach((l) => oraseFacute.add(l.oras_gasit_de || l.oras_cautat));
    console.log(`Reiau: ${locatii.length} locații existente, ${oraseFacute.size} orașe deja făcute.`);
  }
  const chei = new Set(locatii.map((l) => cheie(l.url_maps)));

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    locale: 'ro-RO',
    viewport: { width: 1400, height: 900 },
  });
  const page = await context.newPage();

  // consimțământul GDPR — o singură dată, înainte de buclă
  await page.goto('https://www.google.com/maps', { waitUntil: 'domcontentloaded' });
  try {
    await page
      .getByRole('button', { name: /Acceptă tot|Accept all/i })
      .click({ timeout: 6000 });
    await new Promise((r) => setTimeout(r, 2000));
  } catch {}

  for (const oras of ORASE) {
    if (oraseFacute.has(oras)) continue;
    console.log(`\n=== ${BRAND} — ${oras} ===`);

    await page.goto(
      'https://www.google.com/maps/search/' + encodeURIComponent(`${BRAND} ${oras}`),
      { waitUntil: 'domcontentloaded' }
    );

    // ---- verificare blocaj, imediat după încărcare ----
    if (await esteBlocat(page)) {
      console.log('\n🛑 CAPTCHA / avertisment de trafic detectat!');
      console.log('   Progresul de până acum e salvat. Oprește-te pe azi;');
      console.log('   mâine rulezi aceeași comandă și continuă de unde a rămas.\n');
      await browser.close();
      process.exit(1);
    }

    const gasite = [];
    const feed = page.locator('div[role="feed"]');
    let areFeed = true;
    try {
      await feed.waitFor({ timeout: 10000 });
    } catch {
      areFeed = false;
    }

    if (areFeed) {
      // ----- listă de rezultate: scroll + extragere din carduri -----
      let nrAnterior = 0;
      let faraProgres = 0;
      for (let i = 1; i <= MAX_SCROLLS; i++) {
        await feed.evaluate((el) => el.scrollBy(0, el.clientHeight * 2));
        await pauza();
        const nrCurent = await page.locator('div[role="feed"] a.hfpxzc').count();
        const sfarsit = await page.getByText(/sfârșitul listei|end of the list/i).count();
        if (sfarsit > 0) break;
        if (nrCurent === nrAnterior && ++faraProgres >= 3) break;
        if (nrCurent !== nrAnterior) faraProgres = 0;
        nrAnterior = nrCurent;
      }

      const brute = await page.$$eval('div[role="feed"] div.Nv2PK', (carduri) =>
        carduri.map((card) => {
          const link = card.querySelector('a.hfpxzc');
          const rating = card.querySelector('span.MW4etd');
          const img = card.querySelector('img');
          let reviews_text = null;
          const r1 = card.querySelector('span.UY7F9');
          if (r1) reviews_text = r1.textContent;
          if (!reviews_text) {
            const stele = card.querySelector('span[role="img"]');
            const aria = stele ? stele.getAttribute('aria-label') || '' : '';
            const m = aria.match(/(\d[\d.,]*)\s*(?:de\s*)?(recenzi|review)/i);
            if (m) reviews_text = m[1];
          }
          if (!reviews_text) {
            const m2 = (card.textContent || '').match(/\((\d[\d.,]*\s*(?:mii|k)?)\)/i);
            if (m2) reviews_text = m2[1];
          }
          let categorie = null;
          for (const rand of card.querySelectorAll('.W4Efsd')) {
            const t = rand.textContent || '';
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
      gasite.push(...brute);
    } else if (page.url().includes('/maps/place/')) {
      // ----- un singur rezultat: Maps a sărit direct pe pagina locației -----
      try {
        await page.waitForSelector('div[role="main"] h1', { timeout: 10000 });
        const nume = await page.locator('div[role="main"] h1').first().textContent();
        const fRating = await page
          .locator('div[role="main"] span.F7nice')
          .first()
          .textContent()
          .catch(() => null);
        let reviews_text = null;
        const labels = await page.$$eval('div[role="main"] [aria-label]', (els) =>
          els.map((e) => e.getAttribute('aria-label'))
        );
        for (const a of labels) {
          const m = a && a.match(/(\d[\d.,]*(?:\s*mii)?)\s*(?:de\s*)?(?:recenzi|review)/i);
          if (m) { reviews_text = m[1]; break; }
        }
        const categorie = await page
          .locator('div[role="main"] button.DkEaL')
          .first()
          .textContent()
          .catch(() => null);
        gasite.push({
          nume: nume ? nume.trim() : null,
          url_maps: page.url(),
          rating_text: fRating ? fRating.match(/\d[.,]\d/)?.[0] || null : null,
          reviews_text,
          categorie: categorie ? categorie.trim() : null,
          poza_url: null,
        });
      } catch {
        console.log('  (pagină de locație unică — nu am putut extrage)');
      }
    } else {
      // niciun rezultat SAU blocaj apărut între timp — verificăm încă o dată
      if (await esteBlocat(page)) {
        console.log('\n🛑 CAPTCHA / avertisment de trafic detectat!');
        console.log('   Progresul e salvat. Reia mâine cu aceeași comandă.\n');
        await browser.close();
        process.exit(1);
      }
      console.log('  (niciun rezultat în acest oraș)');
    }

    // filtrare pe nume (căutarea aduce și concurenți/locații irelevante)
    const brandLower = BRAND.toLowerCase().replace(/[^a-z0-9]/g, '');
    let noi = 0;
    for (const l of gasite) {
      if (!l.nume || !l.url_maps) continue;
      const numeLower = l.nume.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!numeLower.includes(brandLower)) continue; // nu e brandul căutat
      const k = cheie(l.url_maps);
      if (chei.has(k)) continue; // dublură (posibil din alt oraș apropiat)
      chei.add(k);
      noi++;
      locatii.push({
        nume: l.nume,
        brand: BRAND,
        rating: parseRating(l.rating_text),
        numar_reviewuri: parseNumar(l.reviews_text),
        categorie: l.categorie,
        poza_url: l.poza_url,
        url_maps: l.url_maps,
        oras_cautat: oras,
        extras_la: new Date().toISOString(),
      });
    }

    fs.writeFileSync(FISIER, JSON.stringify(locatii, null, 2), 'utf-8');
    console.log(`  +${noi} locații noi (total: ${locatii.length})`);

    await pauzaLunga();
  }

  await browser.close();

  const totalReviews = locatii.reduce((s, l) => s + (l.numar_reviewuri || 0), 0);
  const faraNumar = locatii.filter((l) => !l.numar_reviewuri).length;
  console.log(`\n============================================`);
  console.log(`✔ ${BRAND}: ${locatii.length} locații în ${FISIER}`);
  console.log(`  Total recenzii adunate: ${totalReviews.toLocaleString('ro-RO')}`);
  if (faraNumar > 0) {
    console.log(`  ${faraNumar} locații fără număr — rulează:`);
    console.log(`  node enrich.js ${FISIER}`);
  }
  console.log(`============================================\n`);
})();
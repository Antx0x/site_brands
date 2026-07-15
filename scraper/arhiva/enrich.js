// ============================================================
// enrich.js (v2) — completează numărul de recenzii lipsă (unde e 0)
// vizitând pagina Maps a fiecărei locații.
//
// Rulezi din folderul scraper/:
//   node enrich.js date/brand_mcdonald_s.json
//
// Modifică fișierul JSON pe loc, salvând progresul după fiecare
// locație — poți opri oricând cu Ctrl+C fără să pierzi nimic.
//
// v2: consimțământul GDPR e acceptat o dată, înainte de buclă
//     (în v1 prima locație eșua mereu din cauza asta).
// ============================================================

const { chromium } = require('playwright');
const fs = require('fs');

const FISIER = process.argv[2];
if (!FISIER || !fs.existsSync(FISIER)) {
  console.log('Folosire: node enrich.js date/brand_mcdonald_s.json');
  process.exit(1);
}

function pauza() {
  return new Promise((r) => setTimeout(r, 4000 + Math.random() * 5000));
}

// "2.176" -> 2176 | "2,1 mii" -> 2100
function parseNumar(text) {
  if (!text) return 0;
  if (/mii|\d\s*k\b/i.test(text)) {
    const m = text.match(/(\d+(?:[.,]\d+)?)/);
    return m ? Math.round(parseFloat(m[1].replace(',', '.')) * 1000) : 0;
  }
  const cifre = text.replace(/[^\d]/g, '');
  return cifre ? parseInt(cifre, 10) : 0;
}

(async () => {
  const locatii = JSON.parse(fs.readFileSync(FISIER, 'utf-8'));
  const lipsa = locatii.filter((l) => !l.numar_reviewuri).length;
  console.log(`\n${lipsa} locații fără număr de recenzii (din ${locatii.length}).\n`);
  if (lipsa === 0) {
    console.log('Nimic de completat.');
    process.exit(0);
  }

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    locale: 'ro-RO',
    viewport: { width: 1400, height: 900 },
  });
  const page = await context.newPage();

  // acceptăm consimțământul GDPR o singură dată, ÎNAINTE de buclă
  await page.goto('https://www.google.com/maps', { waitUntil: 'domcontentloaded' });
  try {
    await page
      .getByRole('button', { name: /Acceptă tot|Accept all/i })
      .click({ timeout: 6000 });
    await new Promise((r) => setTimeout(r, 2000));
  } catch {}

  for (const l of locatii) {
    if (l.numar_reviewuri > 0) continue; // are deja, sărim

    try {
      await page.goto(l.url_maps, { waitUntil: 'domcontentloaded' });

      // așteptăm panoul locației
      await page.waitForSelector('div[role="main"] h1', { timeout: 15000 });
      await new Promise((r) => setTimeout(r, 1500));

      // 1) căutăm un aria-label care conține numărul + "recenzii"
      let text = null;
      const labels = await page.$$eval(
        'div[role="main"] [aria-label]',
        (els) => els.map((e) => e.getAttribute('aria-label'))
      );
      for (const a of labels) {
        const m =
          a &&
          a.match(/(\d[\d.,]*(?:\s*mii)?)\s*(?:de\s*)?(?:recenzi|review)/i);
        if (m) {
          text = m[1];
          break;
        }
      }

      // 2) fallback: numărul din paranteze de lângă rating
      if (!text) {
        const f = await page
          .locator('div[role="main"] span.F7nice')
          .first()
          .textContent()
          .catch(() => null);
        const m2 = f && f.match(/\((\d[\d.,]*\s*(?:mii|k)?)\)/i);
        if (m2) text = m2[1];
      }

      const nr = parseNumar(text);
      if (nr > 0) {
        l.numar_reviewuri = nr;
        console.log(`✔ ${l.nume}: ${nr} recenzii`);
      } else {
        console.log(`✗ ${l.nume}: nu am găsit numărul`);
      }
    } catch (e) {
      console.log(`✗ ${l.nume}: eroare (${String(e.message).split('\n')[0]})`);
    }

    // salvăm progresul după fiecare locație
    fs.writeFileSync(FISIER, JSON.stringify(locatii, null, 2), 'utf-8');
    await pauza();
  }

  await browser.close();
  const ramase = locatii.filter((l) => !l.numar_reviewuri).length;
  console.log(`\n✔ Gata. Locații rămase fără număr: ${ramase}\n`);
})();
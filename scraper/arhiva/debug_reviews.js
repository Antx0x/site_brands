// ============================================================
// debug_reviews.js — investigăm unde ține Google numărul de recenzii
//
// Rulezi din folderul scraper/:
//   node debug_reviews.js
//
// Face doar 3 scroll-uri, apoi salvează în date/debug_cards.json
// structura internă a primelor carduri (aria-labels, text, HTML).
// Trimite-mi conținutul fișierului rezultat.
// ============================================================

const { chromium } = require('playwright');
const fs = require('fs');

function pauza() {
  return new Promise((r) => setTimeout(r, 3000 + Math.random() * 3000));
}

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    locale: 'ro-RO',
    viewport: { width: 1400, height: 900 },
  });
  const page = await context.newPage();

  await page.goto(
    'https://www.google.com/maps/search/' +
      encodeURIComponent('restaurante Piatra Neamț'),
    { waitUntil: 'domcontentloaded' }
  );

  try {
    await page
      .getByRole('button', { name: /Acceptă tot|Accept all/i })
      .click({ timeout: 6000 });
    await pauza();
  } catch {}

  const feed = page.locator('div[role="feed"]');
  await feed.waitFor({ timeout: 20000 });
  await pauza();

  // doar 3 scroll-uri, cât să avem carduri și "vechi" și "noi"
  for (let i = 0; i < 3; i++) {
    await feed.evaluate((el) => el.scrollBy(0, el.clientHeight * 2));
    await pauza();
  }

  const debug = await page.$$eval('div[role="feed"] div.Nv2PK', (carduri) =>
    carduri.slice(0, 10).map((card, idx) => {
      const link = card.querySelector('a.hfpxzc');

      // toate aria-label-urile din card
      const ariaLabels = [];
      card.querySelectorAll('[aria-label]').forEach((el) => {
        ariaLabels.push({
          tag: el.tagName,
          clasa: el.className ? String(el.className).slice(0, 60) : '',
          aria: (el.getAttribute('aria-label') || '').slice(0, 150),
        });
      });

      return {
        index: idx,
        nume: link ? link.getAttribute('aria-label') : null,
        text_complet: (card.textContent || '').slice(0, 400),
        aria_labels: ariaLabels,
        // HTML complet doar pentru primele 2 carduri (e lung)
        html: idx < 2 ? card.outerHTML.slice(0, 6000) : null,
      };
    })
  );

  await browser.close();

  fs.mkdirSync('date', { recursive: true });
  fs.writeFileSync(
    'date/debug_cards.json',
    JSON.stringify(debug, null, 2),
    'utf-8'
  );
  console.log('\n✔ Am salvat detaliile în date/debug_cards.json');
  console.log('Trimite-mi conținutul acestui fișier.\n');
})();
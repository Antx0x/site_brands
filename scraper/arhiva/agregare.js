// ============================================================
// agregare.js — citește toate fișierele date/brand_*.json și
// generează clasamentul: date/branduri.json
//
// Rulezi din folderul scraper/ (după scrape + enrich):
//   node agregare.js
//
// Pentru fiecare brand calculează:
//   - total_reviewuri  (suma recenziilor — scorul de popularitate)
//   - rating_mediu     (medie ponderată cu nr. de recenzii)
//   - numar_locatii
//   - categorie        (cea mai frecventă categorie Google)
//   - logo             (numele fișierului de logo așteptat)
// ============================================================

const fs = require('fs');
const path = require('path');

const slug = (s) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_');

const fisiere = fs
  .readdirSync('date')
  .filter((f) => f.startsWith('brand_') && f.endsWith('.json'));

if (fisiere.length === 0) {
  console.log('Nu am găsit fișiere brand_*.json în folderul date/');
  process.exit(1);
}

const branduri = [];

for (const f of fisiere) {
  const locatii = JSON.parse(fs.readFileSync(path.join('date', f), 'utf-8'));
  if (locatii.length === 0) continue;

  const brand = locatii[0].brand || f.replace(/^brand_|\.json$/g, '');

  // suma recenziilor
  const total_reviewuri = locatii.reduce(
    (s, l) => s + (l.numar_reviewuri || 0),
    0
  );

  // rating mediu PONDERAT cu numărul de recenzii
  // (o locație cu 5.000 de recenzii trage media mai tare decât una cu 30)
  const cuRating = locatii.filter(
    (l) => l.rating != null && l.numar_reviewuri > 0
  );
  const sumaPonderata = cuRating.reduce(
    (s, l) => s + l.rating * l.numar_reviewuri,
    0
  );
  const sumaPonderi = cuRating.reduce((s, l) => s + l.numar_reviewuri, 0);
  const rating_mediu =
    sumaPonderi > 0 ? Math.round((sumaPonderata / sumaPonderi) * 100) / 100 : null;

  // categoria cea mai frecventă printre locațiile brandului
  const frecventa = {};
  for (const l of locatii) {
    if (l.categorie) frecventa[l.categorie] = (frecventa[l.categorie] || 0) + 1;
  }
  const categorie =
    Object.entries(frecventa).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  // câte locații nu au încă număr de recenzii (ca să știi dacă datele-s complete)
  const fara_numar = locatii.filter((l) => !l.numar_reviewuri).length;

  branduri.push({
    brand,
    logo: `${slug(brand)}.png`, // pui fișierul în site/public/logos/
    categorie,
    numar_locatii: locatii.length,
    total_reviewuri,
    rating_mediu,
    fara_numar, // 0 = date complete; >0 = mai rulează enrich
  });
}

// clasament: descrescător după totalul de recenzii
branduri.sort((a, b) => b.total_reviewuri - a.total_reviewuri);

fs.writeFileSync(
  path.join('date', 'branduri.json'),
  JSON.stringify(branduri, null, 2),
  'utf-8'
);

// afișăm clasamentul în consolă
console.log('\n════════ CLASAMENT BRANDURI ════════\n');
branduri.forEach((b, i) => {
  const avert = b.fara_numar > 0 ? `  ⚠ ${b.fara_numar} locații fără număr` : '';
  console.log(
    `${String(i + 1).padStart(2)}. ${b.brand.padEnd(20)} ` +
      `${b.total_reviewuri.toLocaleString('ro-RO').padStart(12)} recenzii | ` +
      `${String(b.numar_locatii).padStart(4)} locații | ` +
      `rating ${b.rating_mediu ?? '—'}${avert}`
  );
});
console.log(`\n✔ Salvat în date/branduri.json (${branduri.length} branduri)\n`);
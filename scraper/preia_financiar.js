// ============================================================
// preia_financiar.js — descarcă prețul + istoricul pe 5 ani pentru
// toate companiile listate din date/companii_wikidata.json,
// prin API-ul public Yahoo Finance (fără cheie).
//
// Rulezi din folderul scraper/:
//   node preia_financiar.js
//
// Rezultat: date/financiar.json → îl copiezi în site/src/financiar.json
// Rulează-l când vrei date proaspete (o dată pe zi/săptămână e suficient).
// ============================================================

const fs = require('fs');
const path = require('path');

const COMPANII = path.join('date', 'companii_wikidata.json');
if (!fs.existsSync(COMPANII)) {
  console.log('Nu găsesc date/companii_wikidata.json — rulează întâi wikidata_companii.js');
  process.exit(1);
}

// sufixele Yahoo pentru fiecare bursă (numele = eticheta de la Wikidata)
const SUFIXE = {
  'New York Stock Exchange': '',
  'NASDAQ': '',
  'Nasdaq': '',
  'Euronext Paris': '.PA',
  'Bucharest Stock Exchange': '.RO',
  'London Stock Exchange': '.L',
  'Frankfurt Stock Exchange': '.DE',
  'Tokyo Stock Exchange': '.T',
  'Vienna Stock Exchange': '.VI',
  'Euronext Amsterdam': '.AS',
  'Borsa Italiana': '.MI',
  'SIX Swiss Exchange': '.SW',
};

const pauza = (ms) => new Promise((r) => setTimeout(r, ms));

// prima listare cu simbol: a brandului sau a companiei mamă
function listarea(c) {
  const proprie = (c.listari || []).find((l) => l.simbol);
  if (proprie) return { ...proprie, entitate: c.nume };
  const m = c.companie_mama_detalii;
  const aMamei = m ? (m.listari || []).find((l) => l.simbol) : null;
  if (aMamei) return { ...aMamei, entitate: m.nume };
  return null;
}

async function preiaYahoo(simbolYahoo) {
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(simbolYahoo)}` +
    '?range=5y&interval=1mo';
  const r = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
    },
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const d = await r.json();
  const res = d?.chart?.result?.[0];
  if (!res) throw new Error(d?.chart?.error?.description || 'răspuns gol');

  const meta = res.meta || {};
  const timpi = res.timestamp || [];
  const inchideri = res.indicators?.quote?.[0]?.close || [];

  const istoric = timpi
    .map((t, i) => ({
      data: new Date(t * 1000).toISOString().slice(0, 7), // "2024-07"
      pret: inchideri[i] != null ? Math.round(inchideri[i] * 100) / 100 : null,
    }))
    .filter((p) => p.pret != null);

  const primul = istoric[0]?.pret;
  const pret = meta.regularMarketPrice ?? istoric[istoric.length - 1]?.pret ?? null;
  const variatie5a =
    primul && pret ? Math.round(((pret - primul) / primul) * 1000) / 10 : null;

  return {
    moneda: meta.currency || null,
    pret,
    variatie_5a_procent: variatie5a,
    istoric,
  };
}

(async () => {
  const companii = JSON.parse(fs.readFileSync(COMPANII, 'utf-8')).filter((c) => c.gasit);
  const rezultate = [];

  for (const c of companii) {
    const l = listarea(c);
    if (!l) {
      console.log(`— ${c.nume}: nelistată, sar peste`);
      continue;
    }
    const sufix = SUFIXE[l.bursa];
    if (sufix === undefined) {
      console.log(`? ${c.nume}: bursă necunoscută "${l.bursa}" — adaug-o în SUFIXE`);
      continue;
    }
    const simbolYahoo = l.simbol + sufix;
    try {
      const fin = await preiaYahoo(simbolYahoo);
      rezultate.push({
        brand: c.nume,          // cheia de potrivire cu companii.json de pe site
        entitate: l.entitate,   // cine e listat de fapt (brandul sau mama)
        bursa: l.bursa,
        simbol: l.simbol,
        simbol_yahoo: simbolYahoo,
        actualizat: new Date().toISOString().slice(0, 10),
        ...fin,
      });
      console.log(
        `✔ ${c.nume} (${simbolYahoo}): ${fin.pret} ${fin.moneda} | 5 ani: ${fin.variatie_5a_procent}% | ${fin.istoric.length} puncte`
      );
    } catch (e) {
      console.log(`✗ ${c.nume} (${simbolYahoo}): ${e.message}`);
    }
    await pauza(1000 + Math.random() * 500);
  }

  fs.writeFileSync(path.join('date', 'financiar.json'), JSON.stringify(rezultate, null, 2), 'utf-8');
  console.log(`\n✔ ${rezultate.length} companii salvate în date/financiar.json`);
  console.log('  Copiază fișierul în site/src/financiar.json\n');
})();
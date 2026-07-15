// ============================================================
// preia_fundamentale.js — date financiare ANUALE pentru companiile
// listate din date/companii_wikidata.json, prin Yahoo Finance:
//
//   - venituri (total revenue)
//   - profit net (net income)
//   - număr de acțiuni (diluted average shares)
//   - datorii totale
//   - cash flow operațional
//   - market cap ESTIMAT per an (acțiuni × prețul de la finalul anului)
//   - P/E curent (preț / profit pe acțiune)
//
// Rulezi din folderul scraper/:
//   node preia_fundamentale.js
//
// Rezultat: date/fundamentale.json → copiat în site/src/fundamentale.json
// ============================================================

const fs = require('fs');
const path = require('path');

const COMPANII = path.join('date', 'companii_wikidata.json');
if (!fs.existsSync(COMPANII)) {
  console.log('Nu găsesc date/companii_wikidata.json');
  process.exit(1);
}

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

// tipurile Yahoo → numele câmpurilor noastre
const TIPURI = {
  annualTotalRevenue: 'venituri',
  annualNetIncome: 'profit_net',
  annualDilutedAverageShares: 'actiuni',
  annualTotalDebt: 'datorii',
  annualOperatingCashFlow: 'cashflow_operational',
};

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const pauza = (ms) => new Promise((r) => setTimeout(r, ms));

function listarea(c) {
  const proprie = (c.listari || []).find((l) => l.simbol);
  if (proprie) return { ...proprie, entitate: c.nume };
  const m = c.companie_mama_detalii;
  const aMamei = m ? (m.listari || []).find((l) => l.simbol) : null;
  if (aMamei) return { ...aMamei, entitate: m.nume };
  return null;
}

// fundamentalele anuale (ultimii ~5 ani raportați)
async function fundamentale(sym) {
  const p2 = Math.floor(Date.now() / 1000);
  const p1 = p2 - 6 * 365 * 24 * 3600;
  const url =
    `https://query1.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/${encodeURIComponent(sym)}` +
    `?symbol=${encodeURIComponent(sym)}&type=${Object.keys(TIPURI).join(',')}&period1=${p1}&period2=${p2}`;
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const d = await r.json();
  const serii = d?.timeseries?.result || [];

  const ani = {}; // "2023" -> { venituri, profit_net, ... }
  for (const serie of serii) {
    const tip = serie?.meta?.type?.[0];
    const camp = TIPURI[tip];
    if (!camp || !serie[tip]) continue;
    for (const v of serie[tip]) {
      if (!v || !v.asOfDate || v.reportedValue?.raw == null) continue;
      const an = v.asOfDate.slice(0, 4);
      if (!ani[an]) ani[an] = { an };
      ani[an][camp] = v.reportedValue.raw;
    }
  }
  return Object.values(ani).sort((a, b) => a.an.localeCompare(b.an));
}

// prețurile lunare pe 6 ani (pentru market cap istoric + preț curent)
async function preturi(sym) {
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=6y&interval=1mo`;
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const d = await r.json();
  const res = d?.chart?.result?.[0];
  if (!res) throw new Error('fără istoric de preț');
  const timpi = res.timestamp || [];
  const inchideri = res.indicators?.quote?.[0]?.close || [];
  const lunar = {}; // "2023-12" -> preț
  timpi.forEach((t, i) => {
    if (inchideri[i] != null) lunar[new Date(t * 1000).toISOString().slice(0, 7)] = inchideri[i];
  });
  return { lunar, pretCurent: res.meta?.regularMarketPrice ?? null, moneda: res.meta?.currency ?? null };
}

// prețul de la finalul unui an (decembrie, sau ultima lună disponibilă din an)
function pretFinalAn(lunar, an) {
  for (const luna of ['12', '11', '10', '09']) {
    if (lunar[`${an}-${luna}`] != null) return lunar[`${an}-${luna}`];
  }
  return null;
}

(async () => {
  const companii = JSON.parse(fs.readFileSync(COMPANII, 'utf-8')).filter((c) => c.gasit);
  const rezultate = [];

  for (const c of companii) {
    const l = listarea(c);
    if (!l) continue;
    const sufix = SUFIXE[l.bursa];
    if (sufix === undefined) {
      console.log(`? ${c.nume}: bursă necunoscută "${l.bursa}"`);
      continue;
    }
    const sym = l.simbol + sufix;

    try {
      const ani = await fundamentale(sym);
      await pauza(800);
      const { lunar, pretCurent, moneda } = await preturi(sym);

      // market cap estimat per an + P/E curent
      for (const a of ani) {
        const p = pretFinalAn(lunar, a.an);
        a.market_cap_estimat = a.actiuni && p ? Math.round(a.actiuni * p) : null;
      }
      const ultim = [...ani].reverse().find((a) => a.profit_net && a.actiuni);
      const pe_curent =
        ultim && pretCurent
          ? Math.round((pretCurent / (ultim.profit_net / ultim.actiuni)) * 10) / 10
          : null;
      const mcap_curent =
        ultim && pretCurent && ultim.actiuni ? Math.round(ultim.actiuni * pretCurent) : null;

      rezultate.push({
        brand: c.nume,
        entitate: l.entitate,
        simbol_yahoo: sym,
        moneda,
        pe_curent,
        market_cap_curent_estimat: mcap_curent,
        actualizat: new Date().toISOString().slice(0, 10),
        ani,
      });
      console.log(
        `✔ ${c.nume} (${sym}): ${ani.length} ani | P/E ${pe_curent ?? '—'} | mcap ~${
          mcap_curent ? (mcap_curent / 1e9).toFixed(1) + ' mld ' + moneda : '—'
        }`
      );
    } catch (e) {
      console.log(`✗ ${c.nume} (${sym}): ${e.message}`);
    }
    await pauza(1200);
  }

  fs.writeFileSync(path.join('date', 'fundamentale.json'), JSON.stringify(rezultate, null, 2), 'utf-8');
  console.log(`\n✔ ${rezultate.length} companii în date/fundamentale.json`);
  console.log('  Copiază fișierul în site/src/fundamentale.json\n');
})();
// ============================================================
// App.jsx (v4) — dark mode implicit + light mode, buton de comutare
//
// NECESITĂ în src/index.css, sub @import "tailwindcss":
//   @custom-variant dark (&:where(.dark, .dark *));
//
// Paletă dark: fundal albastru închis (slate-950), carduri/menuri
// gri-albăstrui (slate-800/900), text alb.
// ============================================================

import { useMemo, useState } from 'react';
import companiiRaw from './companii.json';
import financiar from './financiar.json';
import fundamentale from './fundamentale.json';
import { LOCATII, CULORI } from './locatii';
import Harta from './Harta';
import Grafic from './Grafic';
import PaginaOrase from './PaginaOrase';

const companii = companiiRaw.filter((c) => c.gasit);

const slug = (s) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_');

const BURSE_SCURT = {
  'New York Stock Exchange': 'NYSE',
  'NASDAQ': 'NASDAQ',
  'Tokyo Stock Exchange': 'TSE',
  'London Stock Exchange': 'LSE',
  'Euronext Paris': 'Euronext Paris',
  'Frankfurt Stock Exchange': 'FRA',
  'Vienna Stock Exchange': 'VIE',
  'Bucharest Stock Exchange': 'BVB',
};
const bursaScurt = (n) => BURSE_SCURT[n] || n || '?';

function listare(c) {
  const proprie = (c.listari || []).find((l) => l.simbol);
  if (proprie) return { ...proprie, prin: c.nume };
  const m = c.companie_mama_detalii;
  const aMamei = m ? (m.listari || []).find((l) => l.simbol) : null;
  if (aMamei) return { ...aMamei, prin: m.nume };
  return null;
}

const finPentru = (nume) => financiar.find((f) => f.brand === nume || f.entitate === nume);
const fundPentru = (nume) => fundamentale.find((f) => f.brand === nume || f.entitate === nume);

function Logo({ nume, marime = 'w-10 h-10' }) {
  const [eroare, setEroare] = useState(false);
  if (eroare) {
    return (
      <div className={`${marime} rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-200 font-bold shrink-0`}>
        {nume[0]}
      </div>
    );
  }
  return (
    <img
      src={`/logos/${slug(nume)}.png`}
      alt={nume}
      className={`${marime} rounded-full object-contain bg-white shrink-0`}
      onError={() => setEroare(true)}
    />
  );
}

function EtichetaTip({ tip }) {
  return tip === 'companie' ? (
    <span className="text-[10px] uppercase tracking-wide bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 px-1.5 py-0.5 rounded">
      companie
    </span>
  ) : (
    <span className="text-[10px] uppercase tracking-wide bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 px-1.5 py-0.5 rounded">
      brand
    </span>
  );
}

function BadgeBursa({ l }) {
  if (l) {
    return (
      <span className="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 px-2 py-1 rounded-full font-semibold whitespace-nowrap">
        <span className="font-normal opacity-70">{bursaScurt(l.bursa)}</span>
        {' : '}
        {l.simbol}
      </span>
    );
  }
  return (
    <span className="text-xs bg-slate-100 text-slate-400 dark:bg-slate-700 dark:text-slate-400 px-2 py-1 rounded-full">
      privată
    </span>
  );
}

function Rand({ eticheta, valoare, link }) {
  if (!valoare) return null;
  return (
    <div className="flex justify-between gap-4 py-2 border-b border-slate-100 dark:border-slate-700 last:border-0">
      <span className="text-slate-500 dark:text-slate-400 text-sm">{eticheta}</span>
      {link ? (
        <a href={link} target="_blank" rel="noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline text-sm text-right break-all">
          {valoare}
        </a>
      ) : (
        <span className="text-sm font-medium text-right">{valoare}</span>
      )}
    </div>
  );
}

const CARD = 'bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700';

function Pagina({ c, entitati, tema, deschide, inapoi }) {
  const proprie = (c.listari || []).find((x) => x.simbol);
  const mamaDet = c.companie_mama_detalii;
  const listareaMamei = mamaDet ? (mamaDet.listari || []).find((x) => x.simbol) : null;
  const fin = finPentru(c.nume);
  const fd = fundPentru(c.nume);
    const mama = c.companie_mama
    ? entitati.find((e) => e.nume === c.companie_mama)
    : null;
  const branduriDetinute =
    c.tip === 'companie'
      ? entitati.filter((e) => e.companie_mama === c.nume)
      : [];
 
  const fmt = (v) =>
    v == null ? '—' : Math.abs(v) >= 1e9 ? (v / 1e9).toFixed(2) + ' mld' : (v / 1e6).toFixed(0) + ' mil';

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <button onClick={inapoi} className="text-sm text-blue-600 dark:text-blue-400 hover:underline mb-4">
        ← Înapoi la listă
      </button>

      <div className={`${CARD} p-5 flex items-center gap-4 flex-wrap`}>
        <Logo nume={c.nume} marime="w-14 h-14" />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">{c.nume}</h1>
            <EtichetaTip tip={c.tip} />
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">{c.descriere}</p>
        </div>
        <div className="ml-auto flex flex-col sm:flex-row gap-2">
          {proprie ? (
            <button className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-left transition-colors">
              <div className="text-xs opacity-80">Listată direct</div>
              <div className="font-bold">{bursaScurt(proprie.bursa)} : {proprie.simbol}</div>
            </button>
          ) : listareaMamei ? (
            <button
              onClick={() => mama && deschide(mama)}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-left transition-colors"
            >
              <div className="text-xs opacity-80">Prin {mamaDet.nume}</div>
              <div className="font-bold">{bursaScurt(listareaMamei.bursa)} : {listareaMamei.simbol}</div>
            </button>
          ) : (
            <button className="px-4 py-2 rounded-xl bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400 text-left cursor-not-allowed">
              <div className="text-xs">{c.companie_mama || 'Companie privată'}</div>
              <div className="font-bold">Nelistată la bursă</div>
            </button>
          )}

          {/* NOU: brandul e listat ȘI mama e listată → al doilea buton, spre mamă */}
          {proprie && listareaMamei && (
            <button
              onClick={() => mama && deschide(mama)}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-left transition-colors"
            >
              <div className="text-xs opacity-80">Compania mamă · {mamaDet.nume}</div>
              <div className="font-bold">{bursaScurt(listareaMamei.bursa)} : {listareaMamei.simbol}</div>
            </button>
          )}
        </div>
      </div>

      {branduriDetinute.length > 0 && (
        <div className={`${CARD} p-5 mt-4`}>
          <h2 className="font-semibold mb-3">Branduri deținute</h2>
          <div className="flex flex-wrap gap-2">
            {branduriDetinute.map((b) => (
              <button
                key={b.wikidata_id}
                onClick={() => deschide(b)}
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-700 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600 rounded-full text-sm"
              >
                <Logo nume={b.nume} marime="w-5 h-5" />
                {b.nume}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className={`${CARD} p-5 mt-4`}>
        <h2 className="font-semibold mb-2">Despre {c.nume}</h2>
        <Rand eticheta="Industrie" valoare={c.industrie} />
        <Rand eticheta="Sediu central" valoare={c.sediu} />
        <Rand eticheta="Angajați" valoare={c.angajati ? c.angajati.toLocaleString('en-US') : null} />
        <Rand eticheta="Site oficial" valoare={c.site_oficial} link={c.site_oficial} />
        <Rand eticheta="Wikidata" valoare={c.wikidata_id} link={`https://www.wikidata.org/wiki/${c.wikidata_id}`} />
        {mama && (
          <div className="flex justify-between gap-4 py-2">
            <span className="text-slate-500 dark:text-slate-400 text-sm">Compania mamă</span>
            <button onClick={() => deschide(mama)} className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline">
              {mama.nume} →
            </button>
          </div>
        )}
      </div>

      {fin && (
        <div className={`${CARD} p-5 mt-4`}>
          <h2 className="font-semibold">
            Acțiunea {fin.entitate}{' '}
            <span className="text-slate-400 text-sm">({bursaScurt(fin.bursa)} : {fin.simbol})</span>
          </h2>
          <div className="text-2xl font-bold my-2">
            {fin.pret} {fin.moneda}
            <span className={'ml-3 text-sm font-semibold ' + (fin.variatie_5a_procent >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
              {fin.variatie_5a_procent >= 0 ? '+' : ''}{fin.variatie_5a_procent}% în 5 ani
            </span>
          </div>
          <Grafic istoric={fin.istoric} />
          <p className="text-xs text-slate-400 mt-2">Date: Yahoo Finance · actualizat {fin.actualizat}</p>
        </div>
      )}

      {fd && fd.ani?.length > 0 && (
        <div className={`${CARD} p-5 mt-4 overflow-x-auto`}>
          <h2 className="font-semibold mb-1">Date financiare anuale — {fd.entitate}</h2>
          <div className="text-xs text-slate-400 mb-3">
            P/E curent: {fd.pe_curent ?? '—'} · monedă: {fd.moneda} · market cap estimat
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                <th className="py-2 pr-4">An</th>
                <th className="py-2 pr-4 text-right">Venituri</th>
                <th className="py-2 pr-4 text-right">Profit net</th>
                <th className="py-2 pr-4 text-right">Acțiuni</th>
                <th className="py-2 text-right">Market cap (est.)</th>
              </tr>
            </thead>
            <tbody>
              {[...fd.ani].reverse().map((a) => (
                <tr key={a.an} className="border-b border-slate-100 dark:border-slate-700 last:border-0">
                  <td className="py-2 pr-4 font-medium">{a.an}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{fmt(a.venituri)}</td>
                  <td className={'py-2 pr-4 text-right tabular-nums ' + (a.profit_net < 0 ? 'text-red-600 dark:text-red-400' : '')}>
                    {fmt(a.profit_net)}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums">
                    {a.actiuni ? (a.actiuni / 1e6).toFixed(0) + ' mil' : '—'}
                  </td>
                  <td className="py-2 text-right tabular-nums">{fmt(a.market_cap_estimat)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {LOCATII[c.nume] && (
        <div className={`${CARD} p-5 mt-4`}>
          <h2 className="font-semibold mb-3">Locații în România</h2>
          <Harta locatii={LOCATII[c.nume]} culoare={CULORI[c.nume]} tema={tema} />
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [selectat, setSelectat] = useState(null);
  const [cautare, setCautare] = useState('');
  const [filtru, setFiltru] = useState('Toate');
  const [arataHarti, setArataHarti] = useState(false);
  const [tema, setTema] = useState(() => localStorage.getItem('tema') || 'dark');

  const comutaTema = () => {
    const t = tema === 'dark' ? 'light' : 'dark';
    setTema(t);
    localStorage.setItem('tema', t);
  };

 const entitati = useMemo(() => {
    const lista = [];
    const numeExistente = new Set(companii.map((c) => c.nume));
    const mameDerivate = new Map();

    for (const c of companii) {
      const tip = c.companie_mama || c.companie_mama_id ? 'brand' : 'companie';
      lista.push({ ...c, tip });

      const m = c.companie_mama_detalii;
      const numeMama = (m && m.nume) || c.companie_mama;
      if (numeMama && !numeExistente.has(numeMama) && !mameDerivate.has(numeMama)) {
        mameDerivate.set(numeMama, {
          ...(m || {}),
          nume: numeMama,
          wikidata_id: (m && m.wikidata_id) || 'derivat_' + numeMama, // doar cheie internă
          tip: 'companie',
          gasit: true,
        });
      }
    }
    return [...lista, ...mameDerivate.values()];
  }, []);

  // învelișul care activează dark mode-ul (clasa "dark" pe rădăcină)
  const Invelis = ({ children }) => (
    <div className={tema === 'dark' ? 'dark' : ''}>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
        {children}
      </div>
    </div>
  );

  const ButonTema = () => (
    <button
      onClick={comutaTema}
      title="Comută tema"
      className="px-2.5 py-1 text-sm rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700"
    >
      {tema === 'dark' ? '☀️' : '🌙'}
    </button>
  );

  if (arataHarti) {
    return (
      <Invelis>
        <PaginaOrase
          inapoi={() => setArataHarti(false)}
          tema={tema}
          ButonTema={ButonTema}
          deschideBrand={(nume) => {
            const e = entitati.find((x) => x.nume === nume);
            if (e) {
              setArataHarti(false);   // închide harta
              setSelectat(e);         // deschide pagina brandului
            }
          }}
        />
      </Invelis>
    );
  }

  if (selectat) {
    return (
      <Invelis>
        <Pagina
          c={selectat}
          entitati={entitati}
          tema={tema}
          deschide={(e) => setSelectat(e)}
          inapoi={() => setSelectat(null)}
        />
      </Invelis>
    );
  }

  const norm = (s) =>
    (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const q = norm(cautare.trim());
  const lista = entitati.filter((c) => {
    if (filtru === 'Companii' && c.tip !== 'companie') return false;
    if (filtru === 'Branduri' && c.tip !== 'brand') return false;
    return !q || norm(c.nume).includes(q) || norm(c.companie_mama).includes(q);
  });

  return (
    <Invelis>
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3 flex-wrap">
          <h1 className="text-lg font-bold whitespace-nowrap">
            📊 Branduri <span className="text-blue-600 dark:text-blue-400">România</span>
          </h1>
          <div className="flex gap-1 ml-2">
            {['Toate', 'Companii', 'Branduri'].map((f) => (
              <button
                key={f}
                onClick={() => setFiltru(f)}
                className={
                  'px-2.5 py-1 text-xs rounded-full ' +
                  (filtru === f
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700')
                }
              >
                {f}
              </button>
            ))}
            <button
              onClick={() => setArataHarti(true)}
              className="px-2.5 py-1 text-xs rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
            >
              🗺 Hărți
            </button>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <input
              type="text"
              placeholder="Caută brand sau companie..."
              value={cautare}
              onChange={(e) => setCautare(e.target.value)}
              className="w-44 sm:w-56 px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400"
            />
            <ButonTema />
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        <div className={`${CARD} divide-y divide-slate-100 dark:divide-slate-700`}>
          {lista.map((c) => {
            const l = listare(c);
            return (
              <div
                key={c.wikidata_id}
                onClick={() => setSelectat(c)}
                className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer"
              >
                <Logo nume={c.nume} />
                <div className="min-w-0">
                  <div className="font-semibold flex items-center gap-2">
                    {c.nume} <EtichetaTip tip={c.tip} />
                  </div>
                  <div className="text-xs text-slate-400 truncate">
                    {c.industrie || c.descriere}
                    {c.tip === 'brand' && c.companie_mama ? ` · deținut de ${c.companie_mama}` : ''}
                  </div>
                </div>
                <div className="ml-auto shrink-0">
                  <BadgeBursa l={l} />
                </div>
              </div>
            );
          })}
          {lista.length === 0 && (
            <div className="px-4 py-8 text-center text-slate-400">Niciun rezultat.</div>
          )}
        </div>
        <p className="text-xs text-slate-400 mt-4">
          Date: Wikidata (CC0) · Yahoo Finance. Proiect personal de învățare —
          nu constituie recomandare de investiții.
        </p>
      </main>
    </Invelis>
  );
  
}
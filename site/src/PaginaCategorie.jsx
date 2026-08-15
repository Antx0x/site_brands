// ============================================================
// site/src/PaginaCategorie.jsx — pagină de categorie "Brands You Know"
//
// Layout dens (bin-packing / masonry): fiecare companie e un card care
// se dimensionează după câte branduri are — companiile mari se întind pe
// mai multe coloane/rânduri, cele mici (1-3 branduri) se strâng și se
// împachetează una lângă alta în golurile rămase (grid-auto-flow: dense).
// Ex.: Tesla (1 brand) încape lângă Boeing și Airbus, sub un card mare.
//
// Fiecare card: antet (logo + nume mamă + ticker) + grid de branduri.
// Imaginea vine din "logo" (JSON) sau /logos/<folder>/<slug>.png; dacă
// lipsește, se afișează placeholder cu numele.
// ============================================================

import { useState } from 'react';
import Logo from './Logo';

const slug = (s) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

// câte coloane/rânduri de branduri (interior) pentru B branduri — ținem
// forma aproape pătrată, max 4 coloane
function dimensiuni(B) {
  let innerCols;
  if (B <= 1) innerCols = 1;
  else if (B === 2) innerCols = 2;
  else if (B === 3) innerCols = 3;
  else if (B === 4) innerCols = 2;
  else innerCols = Math.min(4, Math.ceil(Math.sqrt(B)));
  const rows = Math.ceil(B / innerCols);
  // cardurile single sunt 2 coloane late (ca să încapă numele companiei în
  // antet și logo-ul să iasă mai mare), dar interiorul rămâne pe 1 coloană
  const colSpan = B <= 1 ? 2 : innerCols;
  return { innerCols, colSpan, rows };
}

function PlacutaBrand({ nume, logo, folder }) {
  const src = logo || (folder ? `/logos/${folder}/${slug(nume)}.png` : null);
  const [eroare, setEroare] = useState(!src);
  return (
    <div className="min-h-0 rounded-lg bg-white flex items-center justify-center overflow-hidden p-2">
      {eroare ? (
        <span className="text-[11px] font-medium text-slate-500 text-center leading-tight">
          {nume}
        </span>
      ) : (
        <img src={src} alt={nume} title={nume} className="max-w-full max-h-full object-contain" onError={() => setEroare(true)} />
      )}
    </div>
  );
}

function CardCompanie({ comp, folder }) {
  const branduri = comp.branduri || [];
  const { innerCols, colSpan, rows } = dimensiuni(branduri.length);
  return (
    <div
      style={{ gridColumn: `span ${colSpan}`, gridRow: `span ${rows + 1}` }}
      className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm hover:shadow-md transition-shadow"
    >
      {/* antet: logo + nume + ticker */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-2 border-white rounded-t-2xl shrink-0">
        <Logo nume={comp.parinte} marime="w-9 h-9" />
        <span className="font-semibold text-base leading-tight truncate">{comp.parinte}</span>
        {comp.simbol && (
          <span className="ml-auto shrink-0 text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300">
            {comp.simbol}
          </span>
        )}
      </div>
      {/* grid de branduri — umple restul cardului */}
      <div
        className="flex-1 grid gap-3.5 p-1.5 min-h-0 bg-white"
        style={{ gridTemplateColumns: `repeat(${innerCols}, minmax(0,1fr))`, gridAutoRows: '1fr' }}
      >
        {branduri.map((b) => (
          <PlacutaBrand key={b.nume} nume={b.nume} logo={b.logo} folder={folder} />
        ))}
      </div>
    </div>
  );
}

export default function PaginaCategorie({ eticheta, date = [], folder }) {
  return (
    <main className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-1">{eticheta}</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
        Companiile-mamă și brandurile pe care le dețin.
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
          gridAutoRows: '90px',
          gridAutoFlow: 'row dense',
          gap: '25px',
        }}
      >
        {date.map((comp) => (
          <CardCompanie key={comp.parinte} comp={comp} folder={folder} />
        ))}
      </div>
    </main>
  );
}

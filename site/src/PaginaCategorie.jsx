// ============================================================
// site/src/PaginaCategorie.jsx — o pagină de categorie "Brands You Know"
//
// Un card per companie-mamă (Nestlé, PepsiCo…), unul sub altul.
// Numele + logo-ul mamei stau DEASUPRA containerului; în container,
// brandurile deținute pe un grid cu coloane dinamice (auto-fill),
// deci numărul de rânduri/coloane se adaptează la câte branduri are.
//
// Momentan brandurile sunt PLACEHOLDER-e (dreptunghiuri gri cu numele);
// când `logo` din JSON e completat, se afișează imaginea în locul lor.
// ============================================================

import { useState } from 'react';
import Logo from './Logo';

const CARD = 'bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700';

const slug = (s) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

// Sursa imaginii: câmpul "logo" din JSON dacă e completat (cale explicită),
// altfel automat /logos/<folder>/<slug(nume)>.png. Dacă fișierul lipsește,
// se afișează placeholder-ul gri cu numele brandului.
function BrandPlaceholder({ nume, logo, folder }) {
  const src = logo || (folder ? `/logos/${folder}/${slug(nume)}.png` : null);
  const [eroare, setEroare] = useState(!src);
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="w-full aspect-[4/3] rounded-xl bg-slate-100 dark:bg-slate-700/60 border border-slate-200 dark:border-slate-600 flex items-center justify-center overflow-hidden p-2">
        {eroare ? (
          <span className="text-xs font-medium text-slate-500 dark:text-slate-300 text-center leading-tight">
            {nume}
          </span>
        ) : (
          <img
            src={src}
            alt={nume}
            className="max-w-full max-h-full object-contain"
            onError={() => setEroare(true)}
          />
        )}
      </div>
    </div>
  );
}

export default function PaginaCategorie({ eticheta, date = [], folder }) {
  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-1">{eticheta}</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
        Companiile-mamă și brandurile pe care le dețin.
      </p>

      <div className="flex flex-col gap-6">
        {date.map((comp) => (
          <div key={comp.parinte} className={`${CARD} p-5`}>
            {/* antet: logo + nume mamă + simbol de bursă */}
            <div className="flex items-center gap-3 mb-4">
              <Logo nume={comp.parinte} marime="w-11 h-11" />
              <div className="min-w-0">
                <h2 className="font-bold text-lg leading-tight truncate">{comp.parinte}</h2>
                {comp.simbol && (
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    {comp.simbol}
                  </span>
                )}
              </div>
              <span className="ml-auto text-xs text-slate-400 shrink-0">
                {(comp.branduri || []).length} branduri
              </span>
            </div>

            {/* grid dinamic de branduri (auto-fill) */}
            <div
              className="grid gap-3"
              style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))' }}
            >
              {(comp.branduri || []).map((b) => (
                <BrandPlaceholder key={b.nume} nume={b.nume} logo={b.logo} folder={folder} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}

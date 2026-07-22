// ============================================================
// site/src/Logo.jsx — logo rotund cu fallback în 3 trepte
//   0 = Brandfetch (CDN) → 1 = logo local Wikidata → 2 = inițiala
// Extras din App.jsx ca să-l poată folosi și Header/PaginaCategorie.
// ============================================================

import { useState } from 'react';
import { urlBrandfetch } from './brandfetch';

const slug = (s) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_');

export default function Logo({ nume, marime = 'w-10 h-10' }) {
  const bf = urlBrandfetch(nume);
  const [treapta, setTreapta] = useState(bf ? 0 : 1);
  if (treapta >= 2) {
    return (
      <div className={`${marime} rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-200 font-bold shrink-0`}>
        {(nume || '?')[0]}
      </div>
    );
  }
  // iconul Brandfetch e pătrat → cover; logo-ul Wikidata poate fi lat → contain
  return (
    <img
      src={treapta === 0 ? bf : `/logos/${slug(nume)}.png`}
      alt={nume}
      className={`${marime} rounded-full bg-white shrink-0 ${treapta === 0 ? 'object-cover' : 'object-contain'}`}
      onError={() => setTreapta((t) => t + 1)}
    />
  );
}

// ============================================================
// site/src/Header.jsx — header global negru, prezent pe toate paginile
//
// Stânga:  logo + titlu "Romania Brands" (click → lista completă)
// Mijloc:  search cu autocomplete (sugestii live → pagina brandului)
// Dreapta: Brands You Know ▾ (categorii) · Companies · Brands ·
//          Maps ▾ (orașe) · comutator temă
//
// Dropdown-urile se deschid la hover (desktop) și la tap (mobil).
// ============================================================

import { useState } from 'react';
import Logo from './Logo';

const norm = (s) =>
  (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// buton de navigație cu dropdown; hover pe desktop, tap pe mobil
function NavDropdown({ eticheta, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-slate-200 hover:text-white whitespace-nowrap"
      >
        {eticheta}
        <span className={'text-[10px] transition-transform ' + (open ? 'rotate-180' : '')}>▾</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full min-w-[200px] rounded-xl bg-slate-900 border border-slate-700 shadow-xl py-1.5 z-50">
          {children}
        </div>
      )}
    </div>
  );
}

function ItemDropdown({ children, onClick }) {
  return (
    <button
      onClick={onClick}
      className="block w-full text-left px-4 py-2 text-sm text-slate-200 hover:bg-slate-800 hover:text-white"
    >
      {children}
    </button>
  );
}

export default function Header({
  entitati = [],
  onDeschideEntitate,
  onLista,
  categorii = [],
  onCategorie,
  orase = [],
  onOras,
  tema,
  comutaTema,
}) {
  const [q, setQ] = useState('');
  const [focus, setFocus] = useState(false);

  const nq = norm(q.trim());
  const sugestii = nq
    ? entitati
        .filter((e) => norm(e.nume).includes(nq) || norm(e.companie_mama).includes(nq))
        .slice(0, 7)
    : [];

  const alege = (e) => {
    onDeschideEntitate && onDeschideEntitate(e);
    setQ('');
    setFocus(false);
  };

  return (
    <header className="sticky top-0 z-30 bg-black text-white border-b border-slate-800">
      <div className="mx-auto max-w-7xl px-4 h-14 flex items-center gap-3">
        {/* stânga: titlu */}
        <button
          onClick={() => onLista && onLista('Toate')}
          className="flex items-center gap-2 shrink-0"
        >
          <span className="text-xl">📊</span>
          <span className="font-bold text-lg whitespace-nowrap">Romania Brands</span>
        </button>

        {/* mijloc: search cu autocomplete */}
        <div className="relative flex-1 max-w-md mx-2">
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => setFocus(true)}
            onBlur={() => setTimeout(() => setFocus(false), 150)}
            placeholder="Search brands and companies..."
            className="w-full px-4 py-1.5 text-sm rounded-full bg-slate-800/80 border border-slate-700 text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {focus && sugestii.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1 rounded-xl bg-slate-900 border border-slate-700 shadow-xl py-1.5 z-50 overflow-hidden">
              {sugestii.map((e) => (
                <button
                  key={e.wikidata_id}
                  onMouseDown={(ev) => ev.preventDefault()} /* nu pierde focusul înainte de click */
                  onClick={() => alege(e)}
                  className="flex items-center gap-2.5 w-full text-left px-3 py-2 hover:bg-slate-800"
                >
                  <Logo nume={e.nume} marime="w-6 h-6" />
                  <span className="min-w-0">
                    <span className="block text-sm text-white truncate">{e.nume}</span>
                    {e.companie_mama && (
                      <span className="block text-[11px] text-slate-400 truncate">
                        {e.companie_mama}
                      </span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* dreapta: navigație */}
        <nav className="ml-auto flex items-center gap-0.5 shrink-0">
          <NavDropdown eticheta="Brands You Know">
            {categorii.map((cat) => (
              <ItemDropdown key={cat.id} onClick={() => onCategorie && onCategorie(cat.id)}>
                {cat.eticheta}
              </ItemDropdown>
            ))}
          </NavDropdown>

          <button
            onClick={() => onLista && onLista('Companii')}
            className="px-3 py-2 text-sm font-medium text-slate-200 hover:text-white whitespace-nowrap"
          >
            Companies
          </button>
          <button
            onClick={() => onLista && onLista('Branduri')}
            className="px-3 py-2 text-sm font-medium text-slate-200 hover:text-white whitespace-nowrap"
          >
            Brands
          </button>

          <NavDropdown eticheta="Maps">
            {orase.map((o) => (
              <ItemDropdown key={o.id} onClick={() => onOras && onOras(o.id)}>
                {o.nume}
              </ItemDropdown>
            ))}
          </NavDropdown>

          <button
            onClick={comutaTema}
            title="Comută tema"
            className="ml-1 px-2.5 py-1.5 text-sm rounded-full bg-slate-800 hover:bg-slate-700"
          >
            {tema === 'dark' ? '☀️' : '🌙'}
          </button>
        </nav>
      </div>
    </header>
  );
}

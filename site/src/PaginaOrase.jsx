// ============================================================
// site/src/PaginaOrase.jsx (v2) — hărți pe orașe, TOT ECRANUL
//
// - harta ocupă 2/3 din lățime și toată înălțimea rămasă sub meniu
// - panoul cu liste ocupă 1/3 din ecran, pe toată înălțimea
// - dark mode: în temă întunecată harta folosește tile-uri dark (CARTO)
// - primește din App: inapoi, tema, ButonTema
// ============================================================

import { useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ORASE_HARTA, LOCURI } from './orase';

const slug = (s) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_');

function iconPentru(loc, estompat) {
  const esteMall = loc.tip === 'mall';
  const initiala = esteMall ? '🛍' : (loc.brand || '?')[0];
  const img = esteMall
    ? ''
    : `<img src="/logos/${slug(loc.brand)}.png" onerror="this.style.display='none'"
         style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain;
                padding:2px;background:#fff;border-radius:50%"/>`;
  const contor = esteMall
    ? `<i style="position:absolute;bottom:-5px;right:-5px;background:#7c3aed;color:#fff;border-radius:9999px;font-size:10px;line-height:1;padding:3px 6px;font-style:normal;border:1.5px solid #fff;z-index:2">${(loc.branduri || []).length}</i>`
    : '';
  return L.divIcon({
    className: '',
   html: `<div style="position:relative;width:38px;height:38px;border-radius:50%;background:#fff;
           border:2.5px solid ${esteMall ? '#7c3aed' : '#0f172a'};
           overflow:${esteMall ? 'visible' : 'hidden'};
           box-shadow:0 2px 6px rgba(0,0,0,.35);
           display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:15px;
           transition:all .25s;
           ${estompat ? 'transform:scale(.55);filter:blur(1.5px) grayscale(.8);opacity:.4' : ''}">
           ${initiala}${img}${contor}
         </div>`,
    iconSize: [38, 38],
    iconAnchor: [19, 19],
  });
}

// ── BANNERE ───────────────────────────────────────────────────
// Imaginea de banner vine din public/banners/<slug>.jpg (același slug
// ca la logo-uri). Dacă lipsește, cade automat pe logo-ul existent, iar
// dacă nici acela nu există, pe inițiala brandului. Containerul are
// aceeași dimensiune fixă (16:9) în toate cele trei cazuri.
const BANNER_BOX =
  'relative w-full aspect-video rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 ' +
  'border border-slate-200 dark:border-slate-700 cursor-pointer ' +
  'hover:ring-2 hover:ring-blue-500 transition';

function Banner({ nume, deschideBrand }) {
  // 0 = banner, 1 = logo (fallback), 2 = inițiala (fallback final)
  const [treapta, setTreapta] = useState(0);

  return (
    <div
      onClick={() => deschideBrand && deschideBrand(nume)}
      className={BANNER_BOX}
      title={nume}
    >
      {treapta === 2 ? (
        <div className="absolute inset-0 flex items-center justify-center text-2xl font-bold text-slate-500 dark:text-slate-300">
          {nume[0]}
        </div>
      ) : (
        <img
          src={treapta === 0 ? `/banners/${slug(nume)}.jpg` : `/logos/${slug(nume)}.png`}
          alt={nume}
          // bannerul umple caseta (cover); logo-ul se încadrează fără să fie tăiat
          className={
            'absolute inset-0 w-full h-full ' +
            (treapta === 0 ? 'object-cover' : 'object-contain bg-white p-3')
          }
          onError={() => setTreapta((t) => t + 1)}
        />
      )}
    </div>
  );
}

export default function PaginaOrase({ inapoi, tema, ButonTema, deschideBrand }) {
  const [orasId, setOrasId] = useState('piatra-neamt');
  const [selectat, setSelectat] = useState(null);
   const [cautaPin, setCautaPin] = useState('');
  const norm = (s) =>
    (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const q = norm(cautaPin.trim());
  const seVede = (loc) => {
    if (!q) return true;
    if (loc.tip === 'mall')
      return norm(loc.nume).includes(q) || (loc.branduri || []).some((b) => norm(b).includes(q));
    return norm(loc.brand).includes(q) || norm(loc.nume).includes(q);
  };
  const oras = ORASE_HARTA[orasId];
  const locuri = useMemo(() => LOCURI.filter((l) => l.oras === orasId), [orasId]);

  // tile-uri diferite pe teme: OSM clasic (light) / CARTO dark matter (dark)
    const tiles = {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  };
  return (
    <div className="h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* meniul de sus */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <div className="px-4 py-2.5 flex items-center gap-3 flex-wrap">
          <button onClick={inapoi} className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
            ← Companii
          </button>
            <input
  type="text"
  placeholder="Caută brand pe hartă..."
  value={cautaPin}
  onChange={(e) => setCautaPin(e.target.value)}
  className="w-44 px-3 py-1 text-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
/>
          <h1 className="text-lg font-bold">🗺 Hărți pe orașe</h1>
          <div className="flex gap-1 ml-auto flex-wrap items-center">
            {Object.entries(ORASE_HARTA).map(([id, o]) => (
              <button
                key={id}
                onClick={() => {
                  setOrasId(id);
                  setSelectat(null);
                }}
                className={
                  'px-3 py-1 text-sm rounded-full ' +
                  (orasId === id
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700')
                }
              >
                {o.nume}
              </button>
            ))}
            {ButonTema && <ButonTema />}
          </div>
        </div>
      </header>

      {/* harta (2/3) + panoul (1/3), pe toată înălțimea rămasă */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        <div className="h-[55vh] lg:h-auto lg:flex-[2] min-w-0 shrink-0">
          <MapContainer
            key={orasId + tema} /* remontează la schimbarea orașului sau a temei */
            center={oras.centru}
            zoom={oras.zoom}
            minZoom={oras.minZoom}
            maxBounds={oras.limite}
            maxBoundsViscosity={1.0}
            style={{ height: '100%', width: '100%' }}
            scrollWheelZoom={true}
          >
            <TileLayer url={tiles.url} attribution={tiles.attribution} />
            {locuri.map((loc, i) => (
              <Marker
                key={i + q}
                position={[loc.lat, loc.lng]}
                icon={iconPentru(loc, !seVede(loc))}
                zIndexOffset={seVede(loc) ? 1000 : 0}
                eventHandlers={{ click: () => setSelectat(loc) }}
              />
            ))}
          </MapContainer>
        </div>

        {/* panoul din dreapta — 1/3 din ecran, scrollabil */}
        <aside className="flex-1 lg:flex-[1] min-h-0 lg:min-w-[260px] lg:max-w-[420px] border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-y-auto">
          <div className="p-4">
            {!selectat ? (
              <div className="text-sm text-slate-400 py-10 text-center">
                Apasă pe un pin de pe hartă.
                <div className="mt-3 text-xs">
                  {locuri.length} locații în {oras.nume}
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-semibold">{selectat.nume}</h2>
                  <button
                    onClick={() => setSelectat(null)}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm"
                  >
                    ✕
                  </button>
                </div>
                <div className="mt-3">
                  {selectat.tip === 'mall' ? (
                    // MALL: bannerele companiilor din mall, grid de 2 coloane
                    <div className="grid grid-cols-2 gap-2.5">
                      {(selectat.branduri || []).map((b) => (
                        <Banner key={b} nume={b} deschideBrand={deschideBrand} />
                      ))}
                    </div>
                  ) : (
                    // PIN INDIVIDUAL: un singur banner, centrat, de aceeași
                    // dimensiune ca o celulă din grid (jumătate minus jumătate de gap)
                    <div className="w-[calc(50%-0.3125rem)] mx-auto">
                      <Banner nume={selectat.brand} deschideBrand={deschideBrand} />
                    </div>
                  )}
                </div>

              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
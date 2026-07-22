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
import { urlBrandfetch } from './brandfetch';

const slug = (s) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_');

function iconPentru(loc, estompat) {
  const esteMall = loc.tip === 'mall';
  const initiala = esteMall ? '🛍' : (loc.brand || '?')[0];
  // pin: Brandfetch icon (cover) → logo local Wikidata (contain) → inițiala
  // (mall-urile n-au loc.brand — de aceea totul e condiționat de esteMall)
  const bf = esteMall ? null : urlBrandfetch(loc.brand, 76);
  const local = esteMall ? '' : `/logos/${slug(loc.brand)}.png`;
  const img = esteMall
    ? ''
    : `<img src="${bf || local}" data-local="${local}" data-treapta="${bf ? 0 : 1}"
         onerror="if(this.dataset.treapta==='0'){this.dataset.treapta='1';this.src=this.dataset.local;this.style.objectFit='contain'}else{this.style.display='none'}"
         style="position:absolute;inset:0;width:100%;height:100%;object-fit:${bf ? 'cover' : 'contain'};
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

// ── ICONURI ROTUNDE ──────────────────────────────────────────
// Aceleași imagini din public/logos ca în restul site-ului, dar
// afișate mari, într-un container rotund de dimensiune fixă
// (object-fit: cover), ca să fie toate identice ca mărime
// indiferent de rezoluția fiecărui fișier sursă.
const ICON_BOX =
  'relative w-full aspect-square rounded-full overflow-hidden bg-white dark:bg-slate-800 ' +
  'border-2 border-slate-200 dark:border-slate-700 cursor-pointer ' +
  'hover:ring-2 hover:ring-blue-500 transition shrink-0';

function IconBrand({ nume, deschideBrand }) {
  // treapta 0 = Brandfetch (CDN), 1 = logo local Wikidata, 2 = inițiala
  const bf = urlBrandfetch(nume);
  const [treapta, setTreapta] = useState(bf ? 0 : 1);

  return (
    <div
      onClick={() => deschideBrand && deschideBrand(nume)}
      className={ICON_BOX}
      title={nume}
    >
      {treapta >= 2 ? (
        <div className="absolute inset-0 flex items-center justify-center text-3xl font-bold text-slate-500 dark:text-slate-300">
          {nume[0]}
        </div>
      ) : (
        <img
          src={treapta === 0 ? bf : `/logos/${slug(nume)}.png`}
          alt={nume}
          // iconul Brandfetch e pătrat → cover; logo-ul Wikidata poate fi lat → contain
          className={
            'absolute inset-0 w-full h-full ' + (treapta === 0 ? 'object-cover' : 'object-contain')
          }
          onError={() => setTreapta((t) => t + 1)}
        />
      )}
    </div>
  );
}

export default function PaginaOrase({ orasId = 'piatra-neamt', tema, deschideBrand }) {
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
    <div className="h-full flex flex-col lg:flex-row min-h-0 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* harta (2/3) */}
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
            <input
              type="text"
              placeholder="Search brand on map..."
              value={cautaPin}
              onChange={(e) => setCautaPin(e.target.value)}
              className="w-full mb-4 px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400"
            />
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
                    // MALL: iconurile rotunde ale companiilor din mall, grid de 2 coloane
                    <div className="grid grid-cols-2 gap-2.5">
                      {(selectat.branduri || []).map((b) => (
                        <IconBrand key={b} nume={b} deschideBrand={deschideBrand} />
                      ))}
                    </div>
                  ) : (
                    // PIN INDIVIDUAL: un singur icon rotund, centrat, de aceeași
                    // dimensiune ca o celulă din grid (jumătate minus jumătate de gap)
                    <div className="w-[calc(50%-0.3125rem)] mx-auto">
                      <IconBrand nume={selectat.brand} deschideBrand={deschideBrand} />
                    </div>
                  )}
                </div>

              </div>
            )}
          </div>
        </aside>
    </div>
  );
}
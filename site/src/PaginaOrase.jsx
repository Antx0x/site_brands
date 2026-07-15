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
import companiiRaw from './companii.json';


const slug = (s) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_');

const companii = companiiRaw.filter((c) => c.gasit);
function infoBrand(numeBrand) {
  const c = companii.find((x) => x.nume === numeBrand);
  if (!c) return null;
  const proprie = (c.listari || []).find((l) => l.simbol);
  if (proprie) return { simbol: proprie.simbol, listat: true };
  const m = c.companie_mama_detalii;
  const aMamei = m ? (m.listari || []).find((l) => l.simbol) : null;
  if (aMamei) return { simbol: aMamei.simbol, listat: true, prin: m.nume };
  return { listat: false };
}

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

function LogoMic({ nume }) {
  const [eroare, setEroare] = useState(false);
  if (eroare) {
    return (
      <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-600 flex items-center justify-center text-slate-600 dark:text-slate-200 text-xs font-bold shrink-0">
        {nume[0]}
      </div>
    );
  }
  return (
    <img
      src={`/logos/${slug(nume)}.png`}
      alt={nume}
      className="w-7 h-7 rounded-full object-contain bg-white shrink-0"
      onError={() => setEroare(true)}
    />
  );
}

function RandBrand({ nume, deschideBrand }) {
  const info = infoBrand(nume);
  return (
    <div
      onClick={() => deschideBrand && deschideBrand(nume)}
      className="flex items-center gap-2 py-2 border-b border-slate-100 dark:border-slate-700 last:border-0 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 rounded px-1 -mx-1"
    >
      <LogoMic nume={nume} />
      <span className="text-sm font-medium min-w-0 truncate">{nume}</span>
      <span className="ml-auto shrink-0">
        {info?.listat ? (
          <span className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 px-1.5 py-0.5 rounded-full font-semibold">
            {info.simbol}
          </span>
        ) : info ? (
          <span className="text-[10px] bg-slate-100 text-slate-400 dark:bg-slate-700 px-1.5 py-0.5 rounded-full">privată</span>
        ) : (
          <span className="text-[10px] text-slate-300 dark:text-slate-500">—</span>
        )}
      </span>
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
                <div className="text-xs text-slate-400 mb-2">
                  {selectat.tip === 'mall' ? (
                  (selectat.branduri || []).map((b) => (
                    <RandBrand key={b} nume={b} deschideBrand={deschideBrand} />
                  ))
                  ) : (
                    <RandBrand nume={selectat.brand} deschideBrand={deschideBrand} />
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
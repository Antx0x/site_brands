// ============================================================
// site/src/HartaRomania.jsx — harta unică a României cu TOATE locațiile
// brandurilor (din OpenStreetMap via preia_locatii.js), grupate în clustere.
//
// - clustere (leaflet.markercluster): se strâng la zoom out, se desfac la zoom in
// - culoare per brand + legendă cu filtru (bifezi ce branduri vezi)
// - căutare de oraș (tip Google Maps) care duce harta la orașul căutat
// - popup-ul pinului arată și COORDONATELE (pentru editări viitoare)
//
// Datele vin din locatii_harta.json (generat de scraper/preia_locatii.js):
//   { branduri: [{nume, slug, culoare, total}], locatii: [{brand,lat,lng,nume,oras,adresa}] }
// ============================================================

import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import harta from './locatii_harta.json';
import { urlBrandfetch, slug } from './brandfetch';

const CULOARE = Object.fromEntries((harta.branduri || []).map((b) => [b.nume, b.culoare]));

const esc = (s) => String(s || '').replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));

// un icon cu LOGO-ul brandului per brand, refolosit de toate pinurile lui:
// Brandfetch (icon) → logo local /logos/<slug>.png → punct colorat (fallback)
const iconCache = {};
function iconPentru(brand, culoare) {
  if (iconCache[brand]) return iconCache[brand];
  const c = culoare || '#7c3aed';
  const bf = urlBrandfetch(brand, 40);
  const local = `/logos/${slug(brand)}.png`;
  const fitInit = bf ? 'object-fit:cover' : 'object-fit:contain;padding:2px';
  const html =
    `<div style="width:30px;height:30px;border-radius:50%;background:#fff;border:2px solid ${c};` +
    `overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center">` +
    `<img src="${bf || local}" data-local="${local}" data-t="${bf ? 0 : 1}" ` +
    `onerror="if(this.dataset.t==='0'){this.dataset.t='1';this.src=this.dataset.local;this.style.objectFit='contain';this.style.padding='2px'}` +
    `else{this.style.display='none';this.parentNode.style.background='${c}'}" ` +
    `style="width:100%;height:100%;${fitInit}"/>` +
    `</div>`;
  iconCache[brand] = L.divIcon({ className: '', html, iconSize: [30, 30], iconAnchor: [15, 15] });
  return iconCache[brand];
}

// strat de clustere; se reconstruiește când se schimbă lista filtrată
function StratClustere({ locatii }) {
  const map = useMap();
  useEffect(() => {
    const grup = L.markerClusterGroup({
      chunkedLoading: true,
      maxClusterRadius: 55,
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
    });
    const markeri = locatii.map((l) => {
      const m = L.marker([l.lat, l.lng], { icon: iconPentru(l.brand, CULOARE[l.brand]) });
      const linii = [
        `<b>${esc(l.nume)}</b>`,
        esc(l.brand) !== esc(l.nume) ? esc(l.brand) : '',
        esc(l.adresa),
        esc(l.oras),
        `<span style="color:#888">📍 ${l.lat}, ${l.lng}</span>`,
      ].filter(Boolean);
      m.bindPopup(linii.join('<br>'));
      return m;
    });
    grup.addLayers(markeri);
    map.addLayer(grup);
    return () => map.removeLayer(grup);
  }, [locatii, map]);
  return null;
}

function ExpuneHarta({ setHarta }) {
  const map = useMap();
  useEffect(() => setHarta(map), [map, setHarta]);
  return null;
}

export default function HartaRomania() {
  const [mapa, setMapa] = useState(null);
  const [q, setQ] = useState('');
  const [cauta, setCauta] = useState(false);
  const [mesaj, setMesaj] = useState('');
  const [active, setActive] = useState(() => new Set((harta.branduri || []).map((b) => b.nume)));
  const [legendaDeschisa, setLegendaDeschisa] = useState(false);
  const abort = useRef(null);

  const locatiiFiltrate = useMemo(
    () => (harta.locatii || []).filter((l) => active.has(l.brand)),
    [active]
  );

  const toggle = (nume) =>
    setActive((s) => {
      const n = new Set(s);
      n.has(nume) ? n.delete(nume) : n.add(nume);
      return n;
    });
  const toate = () => setActive(new Set((harta.branduri || []).map((b) => b.nume)));
  const niciunul = () => setActive(new Set());

  async function cautaOras(e) {
    e.preventDefault();
    const text = q.trim();
    if (!text || !mapa) return;
    setCauta(true);
    setMesaj('');
    if (abort.current) abort.current.abort();
    abort.current = new AbortController();
    try {
      const url =
        'https://nominatim.openstreetmap.org/search?' +
        new URLSearchParams({ q: text + ', Romania', format: 'json', limit: '1', countrycodes: 'ro' });
      const r = await fetch(url, { signal: abort.current.signal, headers: { Accept: 'application/json' } });
      const d = await r.json();
      if (d[0]) mapa.flyTo([+d[0].lat, +d[0].lon], 13, { duration: 1.2 });
      else setMesaj('Nu am găsit orașul.');
    } catch (err) {
      if (err.name !== 'AbortError') setMesaj('Eroare la căutare.');
    } finally {
      setCauta(false);
    }
  }

  return (
    <div className="h-full relative bg-slate-50 dark:bg-slate-950">
      {/* căutare de oraș, flotantă */}
      <form onSubmit={cautaOras} className="absolute top-3 left-3 z-[500] flex items-center gap-2">
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Zoom pe oraș (ex. Cluj-Napoca)..."
          className="w-56 px-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white/95 dark:bg-slate-800/95 shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={cauta}
          className="px-3 py-1.5 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-md disabled:opacity-60"
        >
          {cauta ? '…' : 'Caută'}
        </button>
        {mesaj && (
          <span className="px-2 py-1 text-xs rounded bg-white/95 dark:bg-slate-800/95 text-red-600 shadow">{mesaj}</span>
        )}
      </form>

      {/* legendă + filtru de branduri, dreapta-sus */}
      <div className="absolute top-3 right-3 z-[500] w-56 rounded-lg bg-white/95 dark:bg-slate-800/95 shadow-md text-sm">
        <button
          onClick={() => setLegendaDeschisa((v) => !v)}
          className="w-full flex items-center justify-between px-3 py-2 font-semibold"
        >
          <span>Branduri ({active.size}/{(harta.branduri || []).length})</span>
          <span className="text-xs">{legendaDeschisa ? '▲' : '▼'}</span>
        </button>
        {legendaDeschisa && (
          <div className="border-t border-slate-200 dark:border-slate-700">
            <div className="flex gap-2 px-3 py-1.5 text-xs">
              <button onClick={toate} className="text-blue-600 dark:text-blue-400 hover:underline">toate</button>
              <button onClick={niciunul} className="text-blue-600 dark:text-blue-400 hover:underline">niciunul</button>
            </div>
            <div className="max-h-64 overflow-y-auto px-1 pb-2">
              {(harta.branduri || []).map((b) => (
                <label
                  key={b.nume}
                  className="flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                >
                  <input type="checkbox" checked={active.has(b.nume)} onChange={() => toggle(b.nume)} />
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ background: b.culoare }} />
                  <span className="flex-1 truncate">{b.nume}</span>
                  <span className="text-xs text-slate-400">{b.total}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* contor */}
      <div className="absolute bottom-3 left-3 z-[500] px-3 py-1.5 text-xs rounded-lg bg-white/95 dark:bg-slate-800/95 shadow-md">
        <b>{locatiiFiltrate.length.toLocaleString('ro-RO')}</b> locații afișate
      </div>

      <MapContainer center={[45.9, 25.0]} zoom={7} minZoom={6} style={{ height: '100%', width: '100%' }} scrollWheelZoom={true}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        <ExpuneHarta setHarta={setMapa} />
        <StratClustere locatii={locatiiFiltrate} />
      </MapContainer>
    </div>
  );
}

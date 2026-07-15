// site/src/Harta.jsx (v2) — hartă cu locațiile unui brand (toată țara)
// v2: primește prop "tema" — în dark mode folosește tile-uri întunecate

import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

export default function Harta({ locatii, culoare = '#e4002b', tema = 'light' }) {
  const puncte = (locatii || []).filter((l) => l.lat != null && l.lng != null);

  const tiles = {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  };
  return (
    <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
      <MapContainer
        key={tema}
        center={[45.94, 24.97]}
        zoom={7}
        style={{ height: 480, width: '100%' }}
        scrollWheelZoom={true}
      >
        <TileLayer url={tiles.url} attribution={tiles.attribution} />
        {puncte.map((l, i) => (
          <CircleMarker
            key={i}
            center={[l.lat, l.lng]}
            radius={7}
            pathOptions={{ color: culoare, fillColor: culoare, fillOpacity: 0.85, weight: 2 }}
          >
            <Popup>
              <b>{l.nume && !/vezi pe harta/i.test(l.nume) ? l.nume : l.brand}</b>
              {l.oras ? <div>{l.oras}</div> : null}
              {l.adresa ? <div>{l.adresa}</div> : null}
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
      <div className="bg-white dark:bg-slate-800 px-4 py-2 text-xs text-slate-500 dark:text-slate-400">
        {puncte.length} locații pe hartă
      </div>
    </div>
  );
}
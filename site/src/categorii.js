// ============================================================
// site/src/categorii.js — index-ul celor 4 categorii "Brands You Know"
//
// Datele efective stau în câte un JSON per categorie (categorie_*.json),
// în stilul locatii_*: fiecare e o listă de companii-mamă, fiecare cu
// simbolul de bursă și brandurile deținute:
//   { parinte, simbol, branduri: [{ nume, logo }] }
//
// Aici doar le legăm: id (folosit în rute), eticheta afișată și datele.
// Ordinea de aici e ordinea din dropdown-ul "Brands You Know".
// ============================================================

import consumables from './categorie_consumables.json';
import auto from './categorie_auto.json';
import apps from './categorie_apps.json';
import devices from './categorie_devices.json';

export const CATEGORII = [
  { id: 'consumables', eticheta: 'Consumables', date: consumables },
  { id: 'auto', eticheta: 'Auto', date: auto },
  { id: 'apps', eticheta: 'Apps/Sites', date: apps },
  { id: 'devices', eticheta: 'Devices', date: devices },
];

export const categoriePentru = (id) => CATEGORII.find((c) => c.id === id);

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

// `folder` = subfolderul din public/logos unde stau imaginile categoriei.
// Codul caută automat /logos/<folder>/<slug(nume)>.png pentru fiecare brand,
// deci e destul să pui fișierele acolo (numite ca slug-ul brandului).
// Poți suprascrie oricând cu o cale explicită în câmpul "logo" din JSON
// (util dacă vrei și subfoldere per corporație, ex. consumables/nestle/...).
export const CATEGORII = [
  { id: 'consumables', eticheta: 'Consumables', folder: 'consumables', date: consumables },
  { id: 'auto', eticheta: 'Auto', folder: 'auto', date: auto },
  { id: 'apps', eticheta: 'Apps/Sites', folder: 'apps', date: apps },
  { id: 'devices', eticheta: 'Devices', folder: 'devices', date: devices },
];

export const categoriePentru = (id) => CATEGORII.find((c) => c.id === id);

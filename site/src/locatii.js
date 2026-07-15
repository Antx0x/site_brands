// site/src/locatii.js — registrul locațiilor per brand.
// Când extragi un brand nou, copiezi JSON-ul în src/ și adaugi o linie aici.
// Cheia trebuie să fie identică cu "nume"-le brandului din companii.json.

import kfc from './locatii_kfc.json';
import mcdonalds from './locatii_mcdonalds.json';   // ← nou
import orange from './locatii_orange.json';


export const LOCATII = {
  'KFC': kfc,
  'McDonald\'s': mcdonalds,   
  'Orange': orange,
  // 'Lukoil': lukoil,
};

// culoarea pinurilor per brand (opțional; implicit roșu)
export const CULORI = {
  'KFC': '#e4002b',
  "McDonald's": '#ffc300',
  'Lukoil': '#d31a35',
};
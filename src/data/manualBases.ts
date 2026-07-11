import type { CityBase } from '../types/city';

// Bases reais que não vieram da consulta ao OpenStreetMap (scripts/fetch-city-data.mjs)
// e foram adicionadas manualmente.
export const MANUAL_BASES: CityBase[] = [
  {
    id: 'manual/9-cipe-industrial',
    unitType: 'viatura',
    name: '9ª CIPE (Setor Industrial)',
    // R. Afonso Egídio de Souza, 269 - Distrito Industrial, Uberlândia - MG, 38402-332
    // geocodificado via Nominatim/OSM (precisão de rua, não do número exato)
    location: [-18.8674922, -48.2934489],
  },
];

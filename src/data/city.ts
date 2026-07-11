import type { LatLng } from '../types/game';

// Centro de Uberlândia/MG (Praça Tubal Vilela)
export const UBERLANDIA_CENTER: LatLng = [-18.9186, -48.2772];

export const UBERLANDIA_DEFAULT_ZOOM = 13;

// Bounding box aproximada da área urbana de Uberlândia, usada para
// restringir o pan do mapa e para consultas à Overpass API.
export const UBERLANDIA_BBOX = {
  south: -18.97,
  west: -48.34,
  north: -18.86,
  east: -48.21,
};

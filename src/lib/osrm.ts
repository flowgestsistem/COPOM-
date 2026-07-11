import type { LatLng } from '../types/game';
import { haversineDistanceMeters } from './geo';

const OSRM_ENDPOINT = 'https://router.project-osrm.org/route/v1/driving';
const FALLBACK_SPEED_MPS = 8.3; // ~30 km/h, usado se a rota real não puder ser calculada

export interface RouteResult {
  points: LatLng[];
  durationMs: number;
  distanceMeters: number;
}

interface OsrmResponse {
  routes?: {
    geometry: { coordinates: [number, number][] };
    duration: number;
    distance: number;
  }[];
}

/** Rota real nas ruas entre dois pontos, via OSRM. */
export async function fetchRoute(from: LatLng, to: LatLng): Promise<RouteResult> {
  const url = `${OSRM_ENDPOINT}/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`OSRM respondeu ${res.status}`);

  const data: OsrmResponse = await res.json();
  const route = data.routes?.[0];
  if (!route) throw new Error('OSRM não retornou nenhuma rota');

  return {
    points: route.geometry.coordinates.map(([lon, lat]): LatLng => [lat, lon]),
    durationMs: route.duration * 1000,
    distanceMeters: route.distance,
  };
}

/** Linha reta com duração estimada, usada quando o OSRM falha ou está indisponível. */
export function straightLineFallback(from: LatLng, to: LatLng): RouteResult {
  const distanceMeters = haversineDistanceMeters(from, to);
  return {
    points: [from, to],
    durationMs: (distanceMeters / FALLBACK_SPEED_MPS) * 1000,
    distanceMeters,
  };
}

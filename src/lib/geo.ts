import type { LatLng } from '../types/game';

const EARTH_RADIUS_M = 6_371_000;
const METERS_PER_DEGREE_LAT = 111_320;

/** Desloca um ponto por uma distância (metros) numa direção (graus, 0 = norte). */
export function offsetLatLng(base: LatLng, bearingDeg: number, distanceMeters: number): LatLng {
  const [lat, lon] = base;
  const bearingRad = (bearingDeg * Math.PI) / 180;
  const dLat = (distanceMeters * Math.cos(bearingRad)) / METERS_PER_DEGREE_LAT;
  const metersPerDegreeLon = METERS_PER_DEGREE_LAT * Math.cos((lat * Math.PI) / 180);
  const dLon = (distanceMeters * Math.sin(bearingRad)) / metersPerDegreeLon;
  return [lat + dLat, lon + dLon];
}

/** Desloca um ponto por um deslocamento leste/norte (metros) — útil para grades. */
export function gridOffsetLatLng(base: LatLng, eastMeters: number, northMeters: number): LatLng {
  const afterNorth = offsetLatLng(base, northMeters >= 0 ? 0 : 180, Math.abs(northMeters));
  return offsetLatLng(afterNorth, eastMeters >= 0 ? 90 : 270, Math.abs(eastMeters));
}

export function haversineDistanceMeters(a: LatLng, b: LatLng): number {
  const [lat1, lon1] = a;
  const [lat2, lon2] = b;
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);

  const h =
    sinDLat * sinDLat +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * sinDLon * sinDLon;

  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

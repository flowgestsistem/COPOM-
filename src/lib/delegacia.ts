import type { CityBase } from '../types/city';
import type { LatLng } from '../types/game';
import { haversineDistanceMeters } from './geo';

const CIVIL_POLICE_NAME_PATTERN = /delegacia|pol[íi]cia civil|drpc/i;

/** Delegacia de polícia civil real mais próxima, usada pra levar suspeitos presos. */
export function findNearestDelegacia(bases: CityBase[], location: LatLng): CityBase | null {
  const candidates = bases.filter((b) => CIVIL_POLICE_NAME_PATTERN.test(b.name));
  if (candidates.length === 0) return null;

  return candidates.reduce((closest, base) => {
    const distance = haversineDistanceMeters(location, base.location);
    const closestDistance = haversineDistanceMeters(location, closest.location);
    return distance < closestDistance ? base : closest;
  });
}

import type { LatLng, UnitType } from './game';

export interface CityBase {
  id: string;
  unitType: UnitType;
  name: string;
  location: LatLng;
}

export interface CityStreet {
  id: string;
  name: string;
  points: LatLng[];
}

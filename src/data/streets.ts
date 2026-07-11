import raw from './streets.json';
import type { CityStreet } from '../types/city';

// Avenidas e ruas reais de Uberlândia, obtidas do OpenStreetMap.
// Ver scripts/fetch-city-data.mjs para regenerar.
export const CITY_STREETS: CityStreet[] = raw as CityStreet[];

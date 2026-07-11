import raw from './bases.json';
import type { CityBase } from '../types/city';
import { MANUAL_BASES } from './manualBases';

// Delegacias, quartéis de bombeiro e hospitais reais de Uberlândia,
// obtidos do OpenStreetMap. Ver scripts/fetch-city-data.mjs para regenerar.
export const CITY_BASES: CityBase[] = [...(raw as CityBase[]), ...MANUAL_BASES];

import type { UnitType } from '../types/game';

export interface VehiclePhoto {
  path: string;
  count: number;
}

export interface VehicleGroup {
  baseId: string;
  unitType: UnitType;
  label: string;
  photos: VehiclePhoto[];
}

const BASE_ID = {
  bpm17: 'way/300946872', // Quartel Polícia Militar (17 BPM)
  bombeirosCentral: 'way/305161140', // Corpo de Bombeiros
  bombeirosNorteIndustrial: 'way/1463844664', // Pelotão Norte/Industrial - 5ºPel/1ªCia/5ºBBM
  // Av. Getúlio Vargas, 2323 - Tubalina, Uberlândia - MG, 38412-066
  policiaCivil: 'way/1499153903',
  cipe9: 'manual/9-cipe-industrial', // 9ª CIPE (Bairro Industrial)
};

/** Uma foto por unidade (contagem 1 cada). */
function uniformPhotos(prefix: string, count: number): VehiclePhoto[] {
  return Array.from({ length: count }, (_, i) => ({ path: `/viaturas/${prefix}-${i + 1}.png`, count: 1 }));
}

/** Cada foto representa várias viaturas idênticas — contagem por foto. */
function weightedPhotos(prefix: string, counts: number[]): VehiclePhoto[] {
  return counts.map((count, i) => ({ path: `/viaturas/${prefix}-${i + 1}.png`, count }));
}

function explicitPhotos(names: string[]): VehiclePhoto[] {
  return names.map((name) => ({ path: `/viaturas/${name}.png`, count: 1 }));
}

// Viaturas reais fotografadas pelo usuário, associadas às bases correspondentes.
// Quantidades por foto conforme informado pelo usuário (uma foto pode representar
// várias viaturas idênticas da frota real).
export const VEHICLE_GROUPS: VehicleGroup[] = [
  { baseId: BASE_ID.bpm17, unitType: 'viatura', label: 'Ambiental', photos: weightedPhotos('17bpm-ambiental', [6, 4]) },
  {
    baseId: BASE_ID.bpm17,
    unitType: 'viatura',
    label: 'Patrulha Rural',
    photos: weightedPhotos('17bpm-patrulha-rural', [7]),
  },
  {
    baseId: BASE_ID.bpm17,
    unitType: 'viatura',
    label: 'Rádio Patrulha',
    photos: weightedPhotos('17bpm-radio-patrulha', [15, 8, 3, 26, 8]),
  },
  {
    baseId: BASE_ID.bpm17,
    unitType: 'viatura',
    label: 'Rodoviária',
    photos: weightedPhotos('17bpm-rodoviaria', [6, 3, 5, 5, 2]),
  },
  {
    baseId: BASE_ID.bpm17,
    unitType: 'viatura',
    label: 'Tático Móvel',
    photos: weightedPhotos('17bpm-tatico-movel', [12, 20]),
  },
  {
    baseId: BASE_ID.bombeirosCentral,
    unitType: 'bombeiro',
    label: 'Bombeiros',
    photos: uniformPhotos('bombeiros', 6),
  },
  {
    // Quartel central (Av. Rondon) — Unidade de Resgate
    baseId: BASE_ID.bombeirosCentral,
    unitType: 'bombeiro',
    label: 'UR Resgate',
    photos: [{ path: '/viaturas/bombeiros-ur-1.png', count: 3 }],
  },
  {
    // Quartel central (Av. Rondon) — Auto Bomba Tanque Salvamento
    baseId: BASE_ID.bombeirosCentral,
    unitType: 'bombeiro',
    label: 'ABTS',
    photos: [{ path: '/viaturas/bombeiros-abts-1.png', count: 2 }],
  },
  {
    baseId: BASE_ID.bombeirosNorteIndustrial,
    unitType: 'bombeiro',
    label: 'Bombeiros',
    photos: explicitPhotos(['bombeiros-7', 'bombeiros-8', 'bombeiros-9', 'bombeiros-10', 'bombeiros-11']),
  },
  {
    // Pelotão Norte/Industrial — Auto Bomba Tanque Salvamento
    baseId: BASE_ID.bombeirosNorteIndustrial,
    unitType: 'bombeiro',
    label: 'ABTS',
    photos: [{ path: '/viaturas/bombeiros-abts-1.png', count: 2 }],
  },
  { baseId: BASE_ID.cipe9, unitType: 'viatura', label: 'GER', photos: uniformPhotos('9cipe-ger', 1) },
  // Delegacia Central da Polícia Civil — frota completa (4 de cada modelo)
  {
    baseId: BASE_ID.policiaCivil,
    unitType: 'viatura',
    label: 'Jeep Renegade',
    photos: [{ path: '/viaturas/policia-civil-jeep.png', count: 4 }],
  },
  {
    baseId: BASE_ID.policiaCivil,
    unitType: 'viatura',
    label: 'Fiat Toro',
    photos: [{ path: '/viaturas/policia-civil-toro.png', count: 4 }],
  },
  {
    baseId: BASE_ID.policiaCivil,
    unitType: 'viatura',
    label: 'Renault Duster',
    photos: [{ path: '/viaturas/policia-civil-duster.png', count: 4 }],
  },
];

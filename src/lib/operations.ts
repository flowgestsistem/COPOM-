import type { LatLng, OperationType, Unit } from '../types/game';
import { haversineDistanceMeters, offsetLatLng } from './geo';
import { UBERLANDIA_CENTER } from '../data/city';
import type { DispatchCandidate } from './dispatch';
import type { CityBase } from '../types/city';
import { isCivilPoliceUnit } from './civilPolice';

export const OPERATION_MAX_RANGE_METERS = 80_000;

export const PATROL_RADIUS_OPTIONS_M = [500, 1000, 2000, 3000, 5000];

export const DURATION_OPTIONS_MIN = [15, 20, 30, 45, 60, 90, 120];

/** Tipos que usam circuito de patrulha (não ficam parados no ponto). */
export function isPatrolOperationType(type: OperationType): boolean {
  return type === 'patrulha' || type === 'centro_seguro' || type === 'rodovia';
}

/** Tipos estacionários (blitz / mandado / busca). */
export function isStationaryOperationType(type: OperationType): boolean {
  return type === 'blitz' || type === 'mandado' || type === 'busca_apreensao';
}

export interface OperationDraft {
  type: OperationType;
  /** Título exibido (ex.: Centro Seguro). */
  title: string;
  location: LatLng | null;
  radiusMeters: number;
  unitIds: string[];
  durationMinutes: number;
  notes?: string;
  /** Se true, exige clique no mapa (não usa local padrão). */
  requireMapPick: boolean;
}

export interface OperationPreset {
  type: OperationType;
  title: string;
  description: string;
  defaultDurationMin: number;
  defaultRadiusM: number;
  /** Local sugerido (centro / anel rodoviário). */
  defaultLocation?: LatLng;
  requireMapPick: boolean;
  /** Preferir Polícia Civil na lista. */
  preferCivil: boolean;
  category: 'prevencao' | 'tatico' | 'investigativo';
}

/** Ponto típico de rodovia no anel de Uberlândia (BR / contorno). */
export function defaultRodoviaLocation(): LatLng {
  // ~9 km ao norte do centro — corredor rodoviário
  return offsetLatLng(UBERLANDIA_CENTER, 15, 9000);
}

export const OPERATION_PRESETS: OperationPreset[] = [
  {
    type: 'centro_seguro',
    title: 'Centro Seguro',
    description: 'Patrulhamento ostensivo no centro — prevenção e visibilidade policial',
    defaultDurationMin: 45,
    defaultRadiusM: 2000,
    defaultLocation: UBERLANDIA_CENTER,
    requireMapPick: false,
    preferCivil: false,
    category: 'prevencao',
  },
  {
    type: 'rodovia',
    title: 'Operação Rodovias',
    description: 'Patrulhamento e prevenção nas rodovias e contorno do município',
    defaultDurationMin: 60,
    defaultRadiusM: 3000,
    defaultLocation: defaultRodoviaLocation(),
    requireMapPick: true,
    preferCivil: false,
    category: 'prevencao',
  },
  {
    type: 'busca_apreensao',
    title: 'Busca e apreensão',
    description: 'Cumprimento em endereço no mapa — prioridade Polícia Civil',
    defaultDurationMin: 40,
    defaultRadiusM: 500,
    requireMapPick: true,
    preferCivil: true,
    category: 'investigativo',
  },
  {
    type: 'blitz',
    title: 'Blitz',
    description: 'Bloqueio e fiscalização de veículos no local escolhido',
    defaultDurationMin: 30,
    defaultRadiusM: 500,
    requireMapPick: true,
    preferCivil: false,
    category: 'tatico',
  },
  {
    type: 'mandado',
    title: 'Cumprimento de mandado',
    description: 'Mandado judicial em endereço — PM e/ou PC',
    defaultDurationMin: 35,
    defaultRadiusM: 500,
    requireMapPick: true,
    preferCivil: true,
    category: 'investigativo',
  },
  {
    type: 'patrulha',
    title: 'Patrulhamento livre',
    description: 'Circuito de patrulha em raio definido no mapa',
    defaultDurationMin: 30,
    defaultRadiusM: 1500,
    requireMapPick: true,
    preferCivil: false,
    category: 'prevencao',
  },
];

export function defaultDraftFor(type: OperationType): OperationDraft {
  const preset = OPERATION_PRESETS.find((p) => p.type === type);
  return {
    type,
    title: preset?.title ?? type,
    location: preset?.defaultLocation ?? null,
    radiusMeters: preset?.defaultRadiusM ?? 1000,
    unitIds: [],
    durationMinutes: preset?.defaultDurationMin ?? (isPatrolOperationType(type) ? 30 : 20),
    notes: '',
    requireMapPick: preset?.requireMapPick ?? true,
  };
}

export function draftFromPreset(preset: OperationPreset): OperationDraft {
  return {
    type: preset.type,
    title: preset.title,
    location: preset.defaultLocation ?? null,
    radiusMeters: preset.defaultRadiusM,
    unitIds: [],
    durationMinutes: preset.defaultDurationMin,
    notes: '',
    requireMapPick: preset.requireMapPick,
  };
}

export interface OperationUnitOptions {
  /** Só forças policiais (viatura) — nunca bombeiros. */
  policeOnly?: boolean;
  bases?: CityBase[];
  preferCivil?: boolean;
}

/** Viaturas policiais disponíveis para montar a operação. */
export function availableUnitsForOperation(
  units: Unit[],
  location: LatLng,
  options: OperationUnitOptions = {}
): DispatchCandidate[] {
  const policeOnly = options.policeOnly !== false;
  let list = units.filter((u) => u.status === 'disponivel');
  if (policeOnly) {
    list = list.filter((u) => u.type === 'viatura');
  }

  const mapped = list
    .map((unit) => ({
      unit,
      distanceMeters: haversineDistanceMeters(unit.position, location),
      isCivil: options.bases ? isCivilPoliceUnit(unit, options.bases) : false,
    }))
    .sort((a, b) => {
      if (options.preferCivil && a.isCivil !== b.isCivil) {
        return a.isCivil ? -1 : 1;
      }
      return a.distanceMeters - b.distanceMeters;
    });

  return mapped.map(({ unit, distanceMeters }) => ({ unit, distanceMeters }));
}

export function isWithinOperationRange(location: LatLng): boolean {
  return haversineDistanceMeters(UBERLANDIA_CENTER, location) <= OPERATION_MAX_RANGE_METERS;
}

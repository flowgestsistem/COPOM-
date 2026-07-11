import type { CityBase } from '../types/city';
import { haversineDistanceMeters } from './geo';
import type { Incident, IncidentType, Unit, UnitType } from '../types/game';

/**
 * Emergência médica (samu) → somente bombeiros.
 * Incêndio/salvamento → bombeiros.
 * Polícia → viatura.
 */
export const UNIT_TYPE_FOR_INCIDENT: Record<IncidentType, UnitType> = {
  policia: 'viatura',
  incendio: 'bombeiro',
  samu: 'bombeiro',
};

export interface DispatchCandidate {
  unit: Unit;
  distanceMeters: number;
}

export interface BaseDispatchGroup {
  base: CityBase;
  candidates: DispatchCandidate[];
  nearestMeters: number;
}

function isDispatchable(unit: Unit): boolean {
  return unit.status === 'disponivel' || (unit.status !== 'a_caminho' && !!unit.operationId);
}

/** Unidades disponíveis do tipo certo, mais próximas primeiro. */
export function availableUnitsSorted(units: Unit[], incident: Incident): DispatchCandidate[] {
  const wantedType = UNIT_TYPE_FOR_INCIDENT[incident.type];
  return units
    .filter((u) => u.type === wantedType && isDispatchable(u))
    .map((unit) => ({ unit, distanceMeters: haversineDistanceMeters(unit.position, incident.location) }))
    .sort((a, b) => a.distanceMeters - b.distanceMeters);
}

/** Agrupa candidatos por batalhão/base para a UI de despacho. */
export function availableUnitsByBase(
  units: Unit[],
  incident: Incident,
  bases: CityBase[]
): BaseDispatchGroup[] {
  const candidates = availableUnitsSorted(units, incident);
  const byBase = new Map<string, DispatchCandidate[]>();

  for (const c of candidates) {
    const list = byBase.get(c.unit.baseId) ?? [];
    list.push(c);
    byBase.set(c.unit.baseId, list);
  }

  const groups: BaseDispatchGroup[] = [];
  for (const [baseId, list] of byBase) {
    const base = bases.find((b) => b.id === baseId);
    if (!base) continue;
    groups.push({
      base,
      candidates: list,
      nearestMeters: list[0]?.distanceMeters ?? Infinity,
    });
  }

  return groups.sort((a, b) => a.nearestMeters - b.nearestMeters);
}

/** Hospitais / UAIs / pronto-socorro para transporte de vítima. */
export function hospitalBases(bases: CityBase[]): CityBase[] {
  return bases.filter((b) => {
    if (b.unitType !== 'ambulancia') return false;
    const n = b.name.toLowerCase();
    return (
      n.includes('hospital') ||
      n.includes('uai') ||
      n.includes('pronto') ||
      n.includes('maternidade') ||
      n.includes('upa') ||
      n.includes('clínica') ||
      n.includes('clinica') ||
      n.includes('samu')
    );
  });
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

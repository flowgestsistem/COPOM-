import type { Incident, Unit } from '../types/game';
import { haversineDistanceMeters } from './geo';
import { UNIT_TYPE_FOR_INCIDENT } from './dispatch';
import { formatDistance } from './dispatch';
import { LABEL_BY_INCIDENT_TYPE, LABEL_BY_ZONE } from './labels';

/** Raio padrão para “apoio próximo” (metros). */
export const NEARBY_SUPPORT_RANGE_M = 10_000;

export interface NearbySupportOption {
  incident: Incident;
  distanceMeters: number;
  distanceLabel: string;
  typeLabel: string;
  zoneLabel: string | null;
  isNearest: boolean;
}

/** Pode ser redirecionada para apoiar outra ocorrência? */
export function canRedirectToSupport(unit: Unit): boolean {
  if (unit.status === 'levando_preso') return false;
  if (unit.pendingDecision === 'hospital') return false;
  // livre, patrulha, operação, deslocamento, retornando, ou já em outra ocorrência
  return (
    unit.status === 'disponivel' ||
    unit.status === 'em_operacao' ||
    unit.status === 'retornando' ||
    unit.status === 'a_caminho' ||
    unit.status === 'no_local' ||
    unit.status === 'aguardando_decisao'
  );
}

/**
 * Ocorrências ativas compatíveis com o tipo da unidade, ordenadas por proximidade.
 */
export function findNearbySupportIncidents(
  unit: Unit,
  incidents: Incident[],
  maxMeters = NEARBY_SUPPORT_RANGE_M
): NearbySupportOption[] {
  if (!canRedirectToSupport(unit)) return [];

  const wanted = UNIT_TYPE_FOR_INCIDENT;
  const list = incidents
    .filter((i) => i.status !== 'resolvido')
    .filter((i) => wanted[i.type] === unit.type)
    .filter((i) => i.id !== unit.assignedIncidentId)
    .map((incident) => ({
      incident,
      distanceMeters: haversineDistanceMeters(unit.position, incident.location),
    }))
    .filter((x) => x.distanceMeters <= maxMeters)
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, 6);

  return list.map((x, idx) => ({
    incident: x.incident,
    distanceMeters: x.distanceMeters,
    distanceLabel: formatDistance(x.distanceMeters),
    typeLabel: LABEL_BY_INCIDENT_TYPE[x.incident.type],
    zoneLabel: x.incident.zone ? LABEL_BY_ZONE[x.incident.zone] ?? x.incident.zone : null,
    isNearest: idx === 0,
  }));
}

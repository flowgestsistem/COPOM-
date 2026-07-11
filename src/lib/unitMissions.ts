import type { CityBase } from '../types/city';
import type { LatLng, ResponseCode, Unit, UnitMission } from '../types/game';
import { haversineDistanceMeters } from './geo';

export const STRATEGIC_POINT_DURATION_MS = 40 * 60_000; // 40 min
export const UNIT_PATROL_DURATION_MS = 20 * 60_000;
export const UNIT_PATROL_RADIUS_M = 1000;

export function clearMissionFields(): Partial<Unit> {
  return {
    mission: 'none',
    responseCode: undefined,
    missionEndsAt: undefined,
    patrolEndsAt: undefined,
    nextPatrolEventAt: undefined,
    assignedIncidentId: undefined,
    operationId: undefined,
    route: undefined,
    routeProgress: undefined,
    routeDurationMs: undefined,
    routeStartedAt: undefined,
  };
}

export function applyEnRoute(
  unit: Unit,
  opts: {
    mission: UnitMission;
    responseCode: ResponseCode;
    assignedIncidentId?: string;
    baseId?: string;
    base?: LatLng;
    missionEndsAt?: number;
    patrolEndsAt?: number;
  }
): Unit {
  return {
    ...unit,
    status: 'a_caminho',
    mission: opts.mission,
    responseCode: opts.responseCode,
    assignedIncidentId: opts.assignedIncidentId,
    operationId: undefined,
    patrolEndsAt: opts.patrolEndsAt,
    missionEndsAt: opts.missionEndsAt,
    baseId: opts.baseId ?? unit.baseId,
    base: opts.base ?? unit.base,
    nextPatrolEventAt: undefined,
    // limpa serviço/fila do local anterior ao ir em apoio
    serviceEndsAt: undefined,
    serviceRole: undefined,
    serviceRoleLabel: undefined,
    actionQueue: undefined,
    pendingDecision: undefined,
    pendingIncidentTitle: undefined,
    patrolLoopCenter: undefined,
    patrolLoopRadius: undefined,
    patrolStartAngleDeg: undefined,
  };
}

export function applyRoute(unit: Unit, route: { points: LatLng[]; durationMs: number }): Unit {
  return {
    ...unit,
    route: route.points,
    routeDurationMs: route.durationMs,
    routeStartedAt: Date.now(),
    routeProgress: 0,
  };
}

/** Bases para as quais a unidade pode ser realocada (mesmo tipo operacional). */
export function reallocatableBases(bases: CityBase[], unit: Unit): CityBase[] {
  return bases
    .filter((b) => b.id !== unit.baseId && b.unitType === unit.type)
    .sort(
      (a, b) =>
        haversineDistanceMeters(unit.position, a.location) - haversineDistanceMeters(unit.position, b.location)
    );
}

export function baseDistanceLabel(from: LatLng, to: LatLng): string {
  const m = haversineDistanceMeters(from, to);
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

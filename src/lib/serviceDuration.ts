import type { Incident, IncidentType, Unit } from '../types/game';
import {
  fireRoleDurationMs,
  pickFireRoleForUnit,
  type FireTeamRole,
  fireRoleLabel,
} from './fireTeams';

const BASE_SERVICE_MS: Record<IncidentType, number> = {
  policia: 55_000,
  incendio: 100_000,
  samu: 70_000,
};

const PRIORITY_MULTIPLIER: Record<Incident['priority'], number> = {
  1: 1.55,
  2: 1,
  3: 0.65,
};

const JITTER_MS = 25_000;

/** Tempo genérico (PM / fallback) que a unidade fica no local. */
export function serviceDurationMs(incident: Incident): number {
  const base =
    BASE_SERVICE_MS[incident.type] * PRIORITY_MULTIPLIER[incident.priority] +
    Math.random() * JITTER_MS;
  return Math.max(35_000, Math.round(base));
}

export interface UnitServicePlan {
  role: FireTeamRole | 'atendimento';
  roleLabel: string;
  durationMs: number;
}

/**
 * Plano de trabalho da unidade no local.
 * Bombeiros: papel + duração realista; demais: atendimento padrão.
 */
export function planUnitService(
  unit: Unit,
  incident: Incident,
  peersOnScene: Unit[]
): UnitServicePlan {
  if (unit.type === 'bombeiro' || unit.type === 'ambulancia') {
    const already = peersOnScene
      .filter((u) => u.id !== unit.id && u.serviceRole)
      .map((u) => u.serviceRole as FireTeamRole);
    const role =
      unit.type === 'ambulancia'
        ? ('aph' as FireTeamRole)
        : pickFireRoleForUnit(unit, incident, already);
    return {
      role,
      roleLabel: fireRoleLabel(role),
      durationMs: fireRoleDurationMs(role, incident),
    };
  }

  return {
    role: 'atendimento',
    roleLabel: 'Atendimento no local',
    durationMs: serviceDurationMs(incident),
  };
}

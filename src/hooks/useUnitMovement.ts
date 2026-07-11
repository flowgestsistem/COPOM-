import { useEffect } from 'react';
import type { Unit } from '../types/game';
import { positionAlongRoute } from '../lib/routeInterpolation';

const TICK_MS = 300;
const MOVING_STATUSES: Unit['status'][] = ['a_caminho', 'em_operacao', 'levando_preso', 'retornando'];

function clearRouteFields(unit: Unit): Unit {
  return {
    ...unit,
    route: undefined,
    routeProgress: undefined,
    routeDurationMs: undefined,
    routeStartedAt: undefined,
  };
}

export function useUnitMovement(setUnits: (updater: (prev: Unit[]) => Unit[]) => void) {
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();

      setUnits((prev) =>
        prev.map((unit) => {
          // Missões paradas sem rota: ponto estratégico ou apoio sem assign
          if (
            !unit.route &&
            unit.missionEndsAt &&
            now >= unit.missionEndsAt &&
            (unit.status === 'em_operacao' ||
              (unit.status === 'no_local' && unit.mission === 'apoio_ocorrencia' && !unit.assignedIncidentId))
          ) {
            return {
              ...clearRouteFields(unit),
              status: 'retornando',
              mission: 'none',
              responseCode: undefined,
              missionEndsAt: undefined,
              patrolEndsAt: undefined,
              nextPatrolEventAt: undefined,
              assignedIncidentId: undefined,
            };
          }

          if (
            !MOVING_STATUSES.includes(unit.status) ||
            !unit.route ||
            !unit.routeStartedAt ||
            !unit.routeDurationMs
          ) {
            return unit;
          }

          const elapsed = now - unit.routeStartedAt;
          const progress = unit.routeDurationMs === 0 ? 1 : Math.min(elapsed / unit.routeDurationMs, 1);

          if (progress >= 1) {
            const endPos = unit.route[unit.route.length - 1];

            if (unit.status === 'retornando') {
              return {
                ...clearRouteFields(unit),
                status: 'disponivel',
                position: endPos,
                assignedIncidentId: undefined,
                operationId: undefined,
                mission: 'none',
                responseCode: undefined,
                missionEndsAt: undefined,
                patrolEndsAt: undefined,
                nextPatrolEventAt: undefined,
                patrolLoopCenter: undefined,
                patrolLoopRadius: undefined,
                patrolStartAngleDeg: undefined,
              };
            }

            if (unit.status === 'levando_preso') {
              return {
                ...clearRouteFields(unit),
                status: 'retornando',
                position: endPos,
              };
            }

            if (unit.status === 'em_operacao') {
              if (unit.patrolEndsAt && now >= unit.patrolEndsAt) {
                return {
                  ...clearRouteFields(unit),
                  status: 'retornando',
                  operationId: undefined,
                  mission: 'none',
                  responseCode: undefined,
                  patrolEndsAt: undefined,
                  missionEndsAt: undefined,
                  nextPatrolEventAt: undefined,
                  patrolLoopCenter: undefined,
                  patrolLoopRadius: undefined,
                  patrolStartAngleDeg: undefined,
                  position: endPos,
                };
              }
              // circuito de patrulha: reinicia o loop
              return { ...unit, position: unit.route[0], routeStartedAt: now, routeProgress: 0 };
            }

            // chegou (status a_caminho)
            if (unit.mission === 'deslocamento' || unit.mission === 'realocacao') {
              return {
                ...clearRouteFields(unit),
                status: 'disponivel',
                position: endPos,
                mission: 'none',
                responseCode: undefined,
                missionEndsAt: undefined,
                assignedIncidentId: undefined,
                operationId: undefined,
              };
            }

            if (unit.mission === 'ponto_estrategico') {
              return {
                ...clearRouteFields(unit),
                status: 'em_operacao',
                position: endPos,
                responseCode: undefined,
                nextPatrolEventAt: now + 15_000,
                missionEndsAt: unit.missionEndsAt ?? now + 40 * 60_000,
              };
            }

            if (unit.mission === 'patrulha' && !unit.operationId) {
              // patrulha unitária: se a rota era só até o centro, o loop deve ter sido setado ao iniciar
              // se chegou sem loop, fica em operação no ponto
              return {
                ...clearRouteFields(unit),
                status: 'em_operacao',
                position: endPos,
                responseCode: undefined,
                patrolEndsAt: unit.patrolEndsAt ?? unit.missionEndsAt ?? now + 20 * 60_000,
                nextPatrolEventAt: now + 20_000,
              };
            }

            // despacho / apoio / operação com destino
            return {
              ...clearRouteFields(unit),
              status: 'no_local',
              position: endPos,
              routeProgress: 1,
              responseCode: undefined,
              // apoio secundário: permanece um tempo e volta (sem assign)
              missionEndsAt:
                unit.mission === 'apoio_ocorrencia' && !unit.assignedIncidentId
                  ? unit.missionEndsAt ?? now + 8 * 60_000
                  : unit.missionEndsAt,
            };
          }

          return { ...unit, position: positionAlongRoute(unit.route, progress), routeProgress: progress };
        })
      );
    }, TICK_MS);

    return () => clearInterval(interval);
  }, [setUnits]);
}

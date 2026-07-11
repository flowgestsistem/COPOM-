import { useEffect, useRef, type MutableRefObject } from 'react';
import type { CityBase } from '../types/city';
import type { Operation, PatrolEvent, Unit } from '../types/game';
import type { TrafficVehicle } from '../types/traffic';
import { fetchRoute, straightLineFallback } from '../lib/osrm';
import { findNearestDelegacia } from '../lib/delegacia';
import { generateVehicleCheck } from '../lib/vehicleCheck';
import { nextBlitzCheckDelay, nextPatrolEventDelay, rollPatrolEvent } from '../lib/patrolEvents';
import { rollDepartmentEvent } from '../lib/departmentEvents';
import { chance } from '../lib/random';
import {
  APPROACH_RANGE_M,
  approachHoldMs,
  describeTrafficApproach,
  findNearestTrafficTarget,
  generateTrafficVehicleCheck,
  stopTrafficForApproach,
} from '../lib/trafficApproach';

type SetUnits = (updater: (prev: Unit[]) => Unit[]) => void;
type SetOperations = (updater: (prev: Operation[]) => Operation[]) => void;

/**
 * "IA" das operações: unidades patrulhando fazem abordagens (inclusive no
 * trânsito civil real do mapa), pedem apoio e perseguem suspeitos; blitz
 * gera relatório de veículos. Prisões → transporte à delegacia.
 */
export function usePatrolEvents(
  units: Unit[],
  setUnits: SetUnits,
  operations: Operation[],
  setOperations: SetOperations,
  bases: CityBase[],
  onEvent: (event: PatrolEvent) => void,
  trafficRef?: MutableRefObject<TrafficVehicle[]>
) {
  const arrestInFlight = useRef<Set<string>>(new Set());

  useEffect(() => {
    const now = Date.now();

    // patrulha automática, operação de patrulha e ponto estratégico
    const patrolling = units.filter(
      (u) =>
        u.status === 'em_operacao' &&
        (u.mission === 'patrulha' ||
          u.mission === 'ponto_estrategico' ||
          !!u.operationId ||
          u.nextPatrolEventAt !== undefined)
    );

    for (const unit of patrolling) {
      // só PM aborda trânsito civil de rotina
      const canApproachTraffic = unit.type === 'viatura';

      if (unit.nextPatrolEventAt === undefined) {
        setUnits((prev) =>
          prev.map((u) =>
            u.id === unit.id ? { ...u, nextPatrolEventAt: now + nextPatrolEventDelay() } : u
          )
        );
        continue;
      }
      if (unit.nextPatrolEventAt > now) continue;

      const fleet = trafficRef?.current ?? [];
      const nearTraffic =
        canApproachTraffic && fleet.length > 0
          ? findNearestTrafficTarget(fleet, unit.position, APPROACH_RANGE_M)
          : null;

      // Se há civil por perto, alta chance de abordar ele (aleatório)
      const forceTrafficStop = !!nearTraffic && chance(0.72);

      let eventType: PatrolEvent['type'];
      let description: string;
      let outcome: string;
      let arrest: boolean;
      let vehicleCheck = undefined as PatrolEvent['vehicleCheck'];

      if (forceTrafficStop && nearTraffic) {
        const hold = approachHoldMs();
        const stopped = stopTrafficForApproach(
          fleet,
          nearTraffic.vehicle.id,
          unit.id,
          hold
        );
        const check = generateTrafficVehicleCheck(nearTraffic.vehicle.kind);
        const text = describeTrafficApproach(
          nearTraffic.vehicle.kind,
          check,
          nearTraffic.distanceM
        );
        eventType = 'abordagem_veiculo';
        description = stopped
          ? `[${unit.department}] ${text.description}`
          : `[${unit.department}] Tentativa de abordagem — veículo se afastou`;
        outcome = stopped ? text.outcome : 'Condutor não parou — informativo';
        arrest = stopped && text.arrest;
        vehicleCheck = check;
      } else {
        const roll =
          unit.mission === 'ponto_estrategico' || unit.mission === 'patrulha'
            ? rollDepartmentEvent(unit.department, unit.type)
            : rollPatrolEvent();

        // se o roll for abordagem a veículo e há trânsito, ainda tenta o mapa
        if (
          canApproachTraffic &&
          roll.type === 'abordagem_veiculo' &&
          nearTraffic &&
          chance(0.85)
        ) {
          const hold = approachHoldMs();
          stopTrafficForApproach(fleet, nearTraffic.vehicle.id, unit.id, hold);
          const check = generateTrafficVehicleCheck(nearTraffic.vehicle.kind);
          const text = describeTrafficApproach(
            nearTraffic.vehicle.kind,
            check,
            nearTraffic.distanceM
          );
          eventType = 'abordagem_veiculo';
          description = `[${unit.department}] ${text.description}`;
          outcome = text.outcome;
          arrest = text.arrest;
          vehicleCheck = check;
        } else {
          const descriptionPrefix =
            unit.mission === 'ponto_estrategico'
              ? `[${unit.department} · ponto estratégico] `
              : unit.mission === 'patrulha'
                ? `[${unit.department}] `
                : '';
          eventType = roll.type;
          description = `${descriptionPrefix}${roll.description}`;
          outcome = roll.outcome;
          arrest = roll.arrest;
          vehicleCheck = roll.vehicleCheck;
        }
      }

      onEvent({
        id: `patrol-event-${now}-${Math.random().toString(36).slice(2, 7)}`,
        unitId: unit.id,
        unitLabel: unit.label,
        operationId: unit.operationId,
        type: eventType,
        location: unit.position,
        description,
        outcome,
        arrest,
        vehicleCheck,
        createdAt: now,
      });

      if (arrest && !arrestInFlight.current.has(unit.id)) {
        arrestInFlight.current.add(unit.id);
        const delegacia = findNearestDelegacia(bases, unit.position);

        if (delegacia) {
          fetchRoute(unit.position, delegacia.location)
            .catch(() => straightLineFallback(unit.position, delegacia.location))
            .then((route) => {
              setUnits((prev) =>
                prev.map((u) =>
                  u.id === unit.id
                    ? {
                        ...u,
                        status: 'levando_preso',
                        route: route.points,
                        routeDurationMs: route.durationMs,
                        routeStartedAt: Date.now(),
                        routeProgress: 0,
                        nextPatrolEventAt: undefined,
                      }
                    : u
                )
              );
            })
            .finally(() => arrestInFlight.current.delete(unit.id));
        } else {
          setUnits((prev) =>
            prev.map((u) =>
              u.id === unit.id ? { ...u, nextPatrolEventAt: now + nextPatrolEventDelay() } : u
            )
          );
        }
      } else {
        setUnits((prev) =>
          prev.map((u) =>
            u.id === unit.id ? { ...u, nextPatrolEventAt: now + nextPatrolEventDelay() } : u
          )
        );
      }
    }

    const activeBlitz = operations.filter((o) => o.type === 'blitz' && o.status === 'em_andamento');
    for (const op of activeBlitz) {
      if (op.nextVehicleCheckAt === undefined) {
        setOperations((prev) =>
          prev.map((o) => (o.id === op.id ? { ...o, nextVehicleCheckAt: now + nextBlitzCheckDelay() } : o))
        );
        continue;
      }
      if (op.nextVehicleCheckAt > now) continue;

      // blitz: tenta parar um civil próximo a alguma unidade da blitz
      const blitzUnits = units.filter((u) => op.unitIds.includes(u.id));
      const fleet = trafficRef?.current ?? [];
      let usedTraffic = false;
      for (const bu of blitzUnits) {
        const near = findNearestTrafficTarget(fleet, bu.position, APPROACH_RANGE_M + 40);
        if (near) {
          stopTrafficForApproach(fleet, near.vehicle.id, bu.id, approachHoldMs());
          const check = generateTrafficVehicleCheck(near.vehicle.kind);
          setOperations((prev) =>
            prev.map((o) =>
              o.id === op.id
                ? {
                    ...o,
                    vehicleChecks: [check, ...(o.vehicleChecks ?? [])].slice(0, 20),
                    nextVehicleCheckAt: now + nextBlitzCheckDelay(),
                  }
                : o
            )
          );
          usedTraffic = true;
          break;
        }
      }
      if (!usedTraffic) {
        const vehicleCheck = generateVehicleCheck();
        setOperations((prev) =>
          prev.map((o) =>
            o.id === op.id
              ? {
                  ...o,
                  vehicleChecks: [vehicleCheck, ...(o.vehicleChecks ?? [])].slice(0, 20),
                  nextVehicleCheckAt: now + nextBlitzCheckDelay(),
                }
              : o
          )
        );
      }
    }
  }, [units, operations, setUnits, setOperations, bases, onEvent, trafficRef]);
}

import { useEffect, useRef } from 'react';
import type { Operation, Unit } from '../types/game';
import { fetchPatrolLoop } from '../lib/patrolRoute';
import { straightLineFallback } from '../lib/osrm';
import { isPatrolOperationType, isStationaryOperationType } from '../lib/operations';

type SetUnits = (updater: (prev: Unit[]) => Unit[]) => void;
type SetOperations = (updater: (prev: Operation[]) => Operation[]) => void;

/**
 * Governa o ciclo de vida das operações depois do despacho:
 * unidade chega no local -> blitz/mandado aguardam a duração definida;
 * patrulha entra num circuito individual (espalhado na zona) que se repete
 * até o tempo acabar -> ao final, a unidade fica "retornando".
 */
export function useOperationLifecycle(
  units: Unit[],
  setUnits: SetUnits,
  operations: Operation[],
  setOperations: SetOperations
) {
  const inFlightLoops = useRef<Set<string>>(new Set());

  useEffect(() => {
    const now = Date.now();

    const arrived = units.filter((u) => u.status === 'no_local' && u.operationId);

    for (const unit of arrived) {
      const operation = operations.find((o) => o.id === unit.operationId);
      if (!operation) continue;

      if (operation.status === 'a_caminho') {
        setOperations((prev) =>
          prev.map((o) => (o.id === operation.id ? { ...o, status: 'em_andamento', startedAt: now } : o))
        );
      }

      if (isPatrolOperationType(operation.type) && !inFlightLoops.current.has(unit.id)) {
        inFlightLoops.current.add(unit.id);
        const patrolEndsAt = (operation.startedAt ?? now) + operation.durationMs;

        // usa centro/raio/ângulo individuais da viatura (já espalhados na zona)
        const loopCenter = unit.patrolLoopCenter ?? operation.location;
        const loopRadius = unit.patrolLoopRadius ?? operation.radiusMeters ?? 1000;
        const startAngle = unit.patrolStartAngleDeg ?? 0;

        fetchPatrolLoop(loopCenter, loopRadius, { startAngleDeg: startAngle })
          .catch(() => {
            // fallback: circuito sintético ao redor do ponto da unidade
            const fallback = straightLineFallback(loopCenter, unit.position);
            return {
              points: [unit.position, loopCenter, ...fallback.points, unit.position],
              durationMs: Math.max(45_000, loopRadius * 40),
              distanceMeters: loopRadius * 4,
            };
          })
          .then((loop) => {
            setUnits((prev) =>
              prev.map((u) =>
                u.id === unit.id
                  ? {
                      ...u,
                      status: 'em_operacao',
                      route: loop.points,
                      routeDurationMs: Math.max(loop.durationMs, 40_000),
                      routeStartedAt: Date.now(),
                      routeProgress: 0,
                      patrolEndsAt,
                      mission: 'patrulha',
                    }
                  : u
              )
            );
          })
          .finally(() => inFlightLoops.current.delete(unit.id));
      }

      // busca/mandado/blitz: fica no local em operação até o timer
      if (isStationaryOperationType(operation.type) && unit.status === 'no_local') {
        setUnits((prev) =>
          prev.map((u) =>
            u.id === unit.id && u.operationId === operation.id
              ? {
                  ...u,
                  status: 'em_operacao',
                  missionEndsAt: (operation.startedAt ?? now) + operation.durationMs,
                  nextPatrolEventAt: now + 20_000,
                }
              : u
          )
        );
      }
    }

    const stationaryDone = operations.filter(
      (o) =>
        isStationaryOperationType(o.type) &&
        o.status === 'em_andamento' &&
        o.startedAt !== undefined &&
        now - o.startedAt >= o.durationMs
    );

    if (stationaryDone.length > 0) {
      const doneIds = new Set(stationaryDone.map((o) => o.id));
      setOperations((prev) => prev.map((o) => (doneIds.has(o.id) ? { ...o, status: 'concluida' } : o)));
      setUnits((prev) =>
        prev.map((u) =>
          u.operationId && doneIds.has(u.operationId)
            ? {
                ...u,
                status: 'retornando',
                operationId: undefined,
                patrolLoopCenter: undefined,
                patrolLoopRadius: undefined,
                patrolStartAngleDeg: undefined,
              }
            : u
        )
      );
    }
  }, [units, operations, setUnits, setOperations]);
}

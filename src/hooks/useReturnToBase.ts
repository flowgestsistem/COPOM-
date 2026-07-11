import { useEffect, useRef } from 'react';
import type { Unit } from '../types/game';
import { fetchRoute, straightLineFallback } from '../lib/osrm';

type SetUnits = (updater: (prev: Unit[]) => Unit[]) => void;

/**
 * Busca a rota real de volta à base para qualquer unidade que fique "retornando"
 * sem rota ainda — usado tanto depois de uma ocorrência quanto de uma operação.
 */
export function useReturnToBase(units: Unit[], setUnits: SetUnits) {
  const inFlightReturns = useRef<Set<string>>(new Set());

  useEffect(() => {
    const needsReturnRoute = units.filter(
      (u) => u.status === 'retornando' && !u.route && !inFlightReturns.current.has(u.id)
    );

    for (const unit of needsReturnRoute) {
      inFlightReturns.current.add(unit.id);
      fetchRoute(unit.position, unit.base)
        .catch(() => straightLineFallback(unit.position, unit.base))
        .then((route) => {
          setUnits((prev) =>
            prev.map((u) =>
              u.id === unit.id
                ? { ...u, route: route.points, routeDurationMs: route.durationMs, routeStartedAt: Date.now(), routeProgress: 0 }
                : u
            )
          );
        })
        .finally(() => inFlightReturns.current.delete(unit.id));
    }
  }, [units, setUnits]);
}

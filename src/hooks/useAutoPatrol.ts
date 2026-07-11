import { useEffect, useRef } from 'react';
import type { CityStreet } from '../types/city';
import type { LatLng, Unit } from '../types/game';
import { UBERLANDIA_CENTER } from '../data/city';
import { offsetLatLng } from '../lib/geo';
import { fetchRoute, straightLineFallback } from '../lib/osrm';
import { fetchPatrolLoop } from '../lib/patrolRoute';
import { applyEnRoute, applyRoute } from '../lib/unitMissions';

type SetUnits = (updater: (prev: Unit[]) => Unit[]) => void;

const BPM17_BASE_ID = 'way/300946872';
/** A cada ~70s tenta enviar algumas viaturas (esporádico, menos agitado). */
const TICK_MS = 70_000;

type PatrolZone = 'urbano' | 'rural' | 'rodovia';

interface AutoPatrolRule {
  matchDepartment: (department: string) => boolean;
  zone: PatrolZone;
  /** Chance de enviar 1 viatura neste tick. */
  chancePerTick: number;
  maxConcurrent: number;
  durationMs: [number, number];
  loopRadiusM: number;
}

/**
 * 17º BPM — patrulha automática:
 * - Rádio Patrulha + Tático Móvel → cidade
 * - Rodoviária → rodovias do entorno
 * - Ambiental → rural, bem raro
 */
const RULES: AutoPatrolRule[] = [
  {
    matchDepartment: (d) => /r[aá]dio\s*patrulha/i.test(d),
    zone: 'urbano',
    chancePerTick: 0.36,
    maxConcurrent: 4,
    durationMs: [9 * 60_000, 18 * 60_000],
    loopRadiusM: 1100,
  },
  {
    matchDepartment: (d) => /t[aá]tico/i.test(d),
    zone: 'urbano',
    chancePerTick: 0.24,
    maxConcurrent: 2,
    durationMs: [11 * 60_000, 20 * 60_000],
    loopRadiusM: 1000,
  },
  {
    matchDepartment: (d) => /rodovi[aá]ria/i.test(d),
    zone: 'rodovia',
    chancePerTick: 0.28,
    maxConcurrent: 2,
    durationMs: [12 * 60_000, 22 * 60_000],
    loopRadiusM: 1800,
  },
  {
    matchDepartment: (d) => /ambiental|meio\s*ambiente/i.test(d),
    zone: 'rural',
    chancePerTick: 0.045,
    maxConcurrent: 1,
    durationMs: [10 * 60_000, 18 * 60_000],
    loopRadiusM: 1400,
  },
];

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function pickPoint(zone: PatrolZone, streets: CityStreet[]): LatLng {
  if (zone === 'urbano') {
    if (streets.length > 0 && Math.random() < 0.85) {
      const street = streets[Math.floor(Math.random() * streets.length)];
      return street.points[Math.floor(Math.random() * street.points.length)];
    }
    return offsetLatLng(UBERLANDIA_CENTER, Math.random() * 360, rand(800, 5500));
  }
  if (zone === 'rural') {
    return offsetLatLng(UBERLANDIA_CENTER, Math.random() * 360, rand(5500, 12_000));
  }
  // rodovias: corredores no anel externo
  const corridors = [0, 40, 85, 130, 175, 220, 265, 310];
  const bearing = corridors[Math.floor(Math.random() * corridors.length)] + rand(-12, 12);
  return offsetLatLng(UBERLANDIA_CENTER, bearing, rand(7000, 13_500));
}

function isAutoPatroling(unit: Unit): boolean {
  return (
    unit.mission === 'patrulha' &&
    !unit.operationId &&
    !unit.assignedIncidentId &&
    (unit.status === 'a_caminho' || unit.status === 'em_operacao' || unit.status === 'retornando')
  );
}

interface LoopCache {
  points: LatLng[];
  durationMs: number;
  endsAt: number;
}

/**
 * Patrulha esporádica automática do 17 BPM (sem o operador criar operação).
 */
export function useAutoPatrol(
  units: Unit[],
  setUnits: SetUnits,
  streets: CityStreet[],
  enabled: boolean
) {
  const unitsRef = useRef(units);
  unitsRef.current = units;
  const dispatching = useRef<Set<string>>(new Set());
  const loopCache = useRef<Map<string, LoopCache>>(new Map());
  const fetchingLoop = useRef<Set<string>>(new Set());

  // ─── Tick: tenta despachar viaturas ───
  useEffect(() => {
    if (!enabled) return;

    const sendOne = (rule: AutoPatrolRule) => {
      const current = unitsRef.current;
      const concurrent = current.filter(
        (u) => u.baseId === BPM17_BASE_ID && rule.matchDepartment(u.department) && isAutoPatroling(u)
      ).length;
      if (concurrent >= rule.maxConcurrent) return;

      const free = current.filter(
        (u) =>
          u.baseId === BPM17_BASE_ID &&
          u.status === 'disponivel' &&
          !u.operationId &&
          !u.assignedIncidentId &&
          rule.matchDepartment(u.department) &&
          !dispatching.current.has(u.id)
      );
      if (free.length === 0) return;

      const unit = free[Math.floor(Math.random() * free.length)];
      const center = pickPoint(rule.zone, streets);
      const endsAt = Date.now() + rand(rule.durationMs[0], rule.durationMs[1]);
      const startAngle = Math.random() * 360;

      dispatching.current.add(unit.id);

      setUnits((prev) =>
        prev.map((u) =>
          u.id === unit.id
            ? {
                ...applyEnRoute(u, {
                  mission: 'patrulha',
                  responseCode: 2,
                  patrolEndsAt: endsAt,
                  missionEndsAt: endsAt,
                }),
                patrolLoopCenter: center,
                patrolLoopRadius: rule.loopRadiusM,
                patrolStartAngleDeg: startAngle,
              }
            : u
        )
      );

      // rota até o setor + pré-cache do circuito
      Promise.all([
        fetchRoute(unit.position, center).catch(() => straightLineFallback(unit.position, center)),
        fetchPatrolLoop(center, rule.loopRadiusM, { startAngleDeg: startAngle }).catch(() => ({
          points: [
            center,
            offsetLatLng(center, startAngle, rule.loopRadiusM),
            offsetLatLng(center, startAngle + 120, rule.loopRadiusM),
            offsetLatLng(center, startAngle + 240, rule.loopRadiusM),
            center,
          ],
          durationMs: 50_000,
          distanceMeters: rule.loopRadiusM * 4,
        })),
      ])
        .then(([routeTo, loop]) => {
          loopCache.current.set(unit.id, {
            points: loop.points,
            durationMs: Math.max(loop.durationMs, 40_000),
            endsAt,
          });
          setUnits((prev) =>
            prev.map((u) => {
              if (u.id !== unit.id) return u;
              // se foi interrompida (despacho/ocorrência), não aplica
              if (u.mission !== 'patrulha' || u.assignedIncidentId || u.operationId) return u;
              return applyRoute(u, routeTo);
            })
          );
        })
        .finally(() => {
          dispatching.current.delete(unit.id);
        });
    };

    const tick = () => {
      for (const rule of RULES) {
        if (Math.random() <= rule.chancePerTick) sendOne(rule);
      }
    };

    const initial = window.setTimeout(tick, 15_000);
    const interval = window.setInterval(tick, TICK_MS);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
  }, [enabled, streets, setUnits]);

  // ─── Ao chegar no setor (em_operacao sem rota, ou no_local em patrulha auto) → aplica circuito ───
  useEffect(() => {
    if (!enabled) return;

    for (const unit of units) {
      if (unit.mission !== 'patrulha' || unit.operationId || unit.assignedIncidentId) continue;

      const needsLoop =
        (unit.status === 'em_operacao' && (!unit.route || unit.route.length < 2)) ||
        unit.status === 'no_local';

      if (!needsLoop) continue;
      if (fetchingLoop.current.has(unit.id)) continue;

      const cached = loopCache.current.get(unit.id);
      if (cached) {
        loopCache.current.delete(unit.id);
        setUnits((prev) =>
          prev.map((u) =>
            u.id === unit.id && u.mission === 'patrulha' && !u.operationId && !u.assignedIncidentId
              ? {
                  ...u,
                  status: 'em_operacao',
                  route: cached.points,
                  routeDurationMs: cached.durationMs,
                  routeStartedAt: Date.now(),
                  routeProgress: 0,
                  patrolEndsAt: u.patrolEndsAt ?? cached.endsAt,
                }
              : u
          )
        );
        continue;
      }

      // cache ainda não pronto: busca agora
      fetchingLoop.current.add(unit.id);
      const center = unit.patrolLoopCenter ?? unit.position;
      const radius = unit.patrolLoopRadius ?? 1000;
      const startAngle = unit.patrolStartAngleDeg ?? 0;
      const endsAt = unit.patrolEndsAt ?? Date.now() + 12 * 60_000;

      fetchPatrolLoop(center, radius, { startAngleDeg: startAngle })
        .catch(() => ({
          points: [
            center,
            offsetLatLng(center, startAngle, radius),
            offsetLatLng(center, startAngle + 120, radius),
            offsetLatLng(center, startAngle + 240, radius),
            center,
          ],
          durationMs: 50_000,
          distanceMeters: radius * 4,
        }))
        .then((loop) => {
          setUnits((prev) =>
            prev.map((u) =>
              u.id === unit.id && u.mission === 'patrulha' && !u.operationId && !u.assignedIncidentId
                ? {
                    ...u,
                    status: 'em_operacao',
                    route: loop.points,
                    routeDurationMs: Math.max(loop.durationMs, 40_000),
                    routeStartedAt: Date.now(),
                    routeProgress: 0,
                    patrolEndsAt: endsAt,
                  }
                : u
            )
          );
        })
        .finally(() => {
          fetchingLoop.current.delete(unit.id);
        });
    }
  }, [enabled, units, setUnits]);
}

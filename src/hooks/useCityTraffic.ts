import { useEffect, useMemo, useRef } from 'react';
import type { CityStreet } from '../types/city';
import type { Unit } from '../types/game';
import type { TrafficKind, TrafficState, TrafficVehicle } from '../types/traffic';
import { haversineDistanceMeters } from '../lib/geo';
import {
  EMERGENCY_CLEAR_M,
  EMERGENCY_YIELD_M,
  TRAFFIC_FLEET_SIZE,
  TRAFFIC_KIND_WEIGHTS,
  TRAFFIC_SPEED_MPS,
  TRAFFIC_TICK_MS,
} from '../lib/trafficConfig';
import {
  buildTrafficNetwork,
  pickNextStreet,
  samplePath,
  type TrafficNetwork,
} from '../lib/trafficNetwork';

function pickKind(preferHighway: boolean): TrafficKind {
  const weights = TRAFFIC_KIND_WEIGHTS.map((k) => ({
    kind: k.kind,
    w: preferHighway ? k.w * (0.5 + k.highwayBias) : k.w * (1.2 - k.highwayBias * 0.6),
  }));
  const total = weights.reduce((s, x) => s + x.w, 0);
  let r = Math.random() * total;
  for (const item of weights) {
    r -= item.w;
    if (r <= 0) return item.kind;
  }
  return 'car';
}

function randSpeed(kind: TrafficKind): number {
  const [lo, hi] = TRAFFIC_SPEED_MPS[kind];
  return lo + Math.random() * (hi - lo);
}

function lightGroupFor(streetIndex: number, progress: number): number {
  const slot = Math.floor(progress * 5.5);
  return streetIndex * 16 + slot;
}

function spawnFleet(network: TrafficNetwork, count: number): TrafficVehicle[] {
  const fleet: TrafficVehicle[] = [];
  if (network.paths.length === 0) return fleet;

  let guard = 0;
  while (fleet.length < count && guard < count * 5) {
    guard++;
    const preferHwy = Math.random() < 0.22;
    const pool =
      preferHwy && network.highwayish.length > 0
        ? network.highwayish
        : network.urban.length > 0
          ? network.urban
          : network.paths.map((_, idx) => idx);

    const streetIndex = pool[Math.floor(Math.random() * pool.length)];
    const path = network.paths[streetIndex];
    if (path.lengthM < 40) continue;

    const kind = pickKind(preferHwy || network.highwayish.includes(streetIndex));
    const direction: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
    const progress = 0.05 + Math.random() * 0.9;
    const { position, heading } = samplePath(path, progress, direction);

    fleet.push({
      id: `civ-${fleet.length}`,
      kind,
      streetIndex,
      progress,
      direction,
      speedMps: randSpeed(kind),
      position,
      heading,
      state: 'moving',
      waitUntil: 0,
      lightGroup: lightGroupFor(streetIndex, progress),
    });
  }
  return fleet;
}

function emergencyUnits(units: Unit[]): Unit[] {
  return units.filter(
    (u) =>
      u.status === 'a_caminho' &&
      u.responseCode === 3 &&
      (u.type === 'viatura' || u.type === 'bombeiro' || u.type === 'ambulancia')
  );
}

function stepVehicle(
  v: TrafficVehicle,
  network: TrafficNetwork,
  tMs: number,
  dt: number,
  emerg: Unit[],
  stoppedGroups: Set<number>
): TrafficVehicle {
  const path = network.paths[v.streetIndex];
  if (!path) return v;

  let nearestEmerg = Infinity;
  for (const u of emerg) {
    const d = haversineDistanceMeters(v.position, u.position);
    if (d < nearestEmerg) nearestEmerg = d;
  }

  // ── abordado por patrulha: fica parado até o fim da verificação ──
  if (v.state === 'approached') {
    const until = v.approachUntil ?? v.waitUntil;
    if (tMs < until) {
      return { ...v, waitUntil: until };
    }
    // liberado: retoma o fluxo
    return {
      ...v,
      state: 'moving',
      approachUnitId: undefined,
      approachUntil: undefined,
      waitUntil: 0,
    };
  }

  if (nearestEmerg < EMERGENCY_YIELD_M) {
    return { ...v, state: 'yielding', waitUntil: tMs + 1_200 };
  }
  if (v.state === 'yielding' && nearestEmerg < EMERGENCY_CLEAR_M) {
    return { ...v, waitUntil: tMs + 400 };
  }
  if (v.state === 'yielding' && !(nearestEmerg >= EMERGENCY_CLEAR_M && tMs >= v.waitUntil)) {
    return v;
  }

  if (
    (v.state === 'waiting_light' || v.state === 'queued' || v.state === 'stopped') &&
    tMs < v.waitUntil
  ) {
    return v;
  }

  const group = lightGroupFor(v.streetIndex, v.progress);
  if (stoppedGroups.has(group) && (v.state === 'moving' || v.state === 'yielding')) {
    return {
      ...v,
      state: 'queued',
      waitUntil: tMs + 1_500 + Math.random() * 2_500,
      lightGroup: group,
    };
  }

  const slotProgress = (v.progress * 5.5) % 1;
  if (
    (v.state === 'moving' || v.state === 'yielding') &&
    slotProgress > 0.88 &&
    Math.random() < 0.04 * dt * 5
  ) {
    const wait = 2_800 + Math.random() * 5_500;
    const g = lightGroupFor(v.streetIndex, v.progress);
    stoppedGroups.add(g);
    return {
      ...v,
      state: 'waiting_light',
      waitUntil: tMs + wait,
      lightGroup: g,
    };
  }

  const speed = v.kind === 'moto' ? v.speedMps * 1.05 : v.speedMps;
  const flow = 0.85 + Math.random() * 0.2;
  const deltaProg = ((speed * flow * dt) / path.lengthM) * v.direction;
  let progress = v.progress + deltaProg;
  let streetIndex = v.streetIndex;
  let direction = v.direction;
  const preferHwy = v.kind === 'semi' || v.kind === 'truck';

  if (progress >= 1 || progress <= 0) {
    const atEnd = progress >= 1;
    if (Math.random() < 0.35) {
      const chosen = pickNextStreet(network, streetIndex, atEnd, preferHwy);
      const sample = samplePath(
        network.paths[chosen.streetIndex],
        chosen.progress,
        chosen.direction
      );
      return {
        ...v,
        ...chosen,
        state: 'waiting_light',
        waitUntil: tMs + 900 + Math.random() * 2_200,
        lightGroup: lightGroupFor(chosen.streetIndex, chosen.progress),
        position: sample.position,
        heading: sample.heading,
      };
    }
    const chosen = pickNextStreet(network, streetIndex, atEnd, preferHwy);
    streetIndex = chosen.streetIndex;
    progress = chosen.progress;
    direction = chosen.direction;
  }

  const sample = samplePath(network.paths[streetIndex], progress, direction);
  const state: TrafficState = 'moving';
  return {
    ...v,
    streetIndex,
    progress,
    direction,
    state,
    lightGroup: lightGroupFor(streetIndex, progress),
    position: sample.position,
    heading: sample.heading,
    waitUntil: 0,
  };
}

/**
 * Trânsito civil — estado só em ref (não re-renderiza o App a cada frame).
 * A camada Canvas lê o ref e redesenha sozinha.
 */
export function useCityTraffic(streets: CityStreet[], units: Unit[], enabled: boolean) {
  const network = useMemo(() => buildTrafficNetwork(streets), [streets]);
  const vehiclesRef = useRef<TrafficVehicle[]>([]);
  const unitsRef = useRef(units);
  unitsRef.current = units;

  useEffect(() => {
    if (!enabled || network.paths.length === 0) {
      vehiclesRef.current = [];
      return;
    }
    vehiclesRef.current = spawnFleet(network, TRAFFIC_FLEET_SIZE);
  }, [enabled, network]);

  useEffect(() => {
    if (!enabled || network.paths.length === 0) return;

    let last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      const dt = Math.min(0.5, (now - last) / 1000);
      last = now;
      const tMs = Date.now();
      const emerg = emergencyUnits(unitsRef.current);

      const stoppedGroups = new Set<number>();
      for (const v of vehiclesRef.current) {
        if (
          (v.state === 'waiting_light' || v.state === 'queued') &&
          v.waitUntil > tMs
        ) {
          stoppedGroups.add(v.lightGroup);
        }
      }

      const prev = vehiclesRef.current;
      const next = new Array<TrafficVehicle>(prev.length);
      for (let i = 0; i < prev.length; i++) {
        next[i] = stepVehicle(prev[i], network, tMs, dt, emerg, stoppedGroups);
      }
      vehiclesRef.current = next;
    }, TRAFFIC_TICK_MS);

    return () => window.clearInterval(id);
  }, [enabled, network]);

  return vehiclesRef;
}

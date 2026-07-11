import type { LatLng } from '../types/game';
import type { TrafficKind, TrafficVehicle } from '../types/traffic';
import type { VehicleCheck } from '../types/game';
import { haversineDistanceMeters } from './geo';
import { chance, pickOne, randomInt } from './random';
import { generateVehicleCheck } from './vehicleCheck';

export const TRAFFIC_KIND_LABEL: Record<TrafficKind, string> = {
  car: 'carro',
  moto: 'motocicleta',
  pickup: 'caminhonete',
  van: 'utilitário',
  truck: 'caminhão',
  semi: 'carreta',
};

const MODELS_BY_KIND: Record<TrafficKind, string[]> = {
  car: [
    'Volkswagen Gol',
    'Chevrolet Onix',
    'Fiat Argo',
    'Hyundai HB20',
    'Toyota Corolla',
    'Honda Civic',
    'Renault Kwid',
  ],
  moto: ['Honda CG 160', 'Yamaha Factor 125', 'Honda Biz 125', 'Honda PCX', 'Yamaha Fazer 250'],
  pickup: ['Fiat Strada', 'Volkswagen Saveiro', 'Chevrolet S10', 'Toyota Hilux', 'Ford Ranger'],
  van: ['Fiat Fiorino', 'Renault Kangoo', 'Volkswagen Kombi', 'Mercedes Sprinter'],
  truck: ['Mercedes Accelo', 'Volkswagen Delivery', 'Ford Cargo', 'Iveco Daily'],
  semi: ['Scania R450', 'Volvo FH', 'Mercedes Actros', 'DAF XF'],
};

/** Alcance em que a patrulha “enxerga” o trânsito para abordar. */
export const APPROACH_RANGE_M = 160;
/** Duração típica da abordagem no mapa. */
export const APPROACH_HOLD_MS: [number, number] = [12_000, 28_000];

export function findNearestTrafficTarget(
  fleet: TrafficVehicle[],
  from: LatLng,
  maxMeters = APPROACH_RANGE_M
): { vehicle: TrafficVehicle; distanceM: number } | null {
  let best: { vehicle: TrafficVehicle; distanceM: number } | null = null;
  for (const v of fleet) {
    if (v.state === 'approached') continue;
    const d = haversineDistanceMeters(from, v.position);
    if (d > maxMeters) continue;
    if (!best || d < best.distanceM) best = { vehicle: v, distanceM: d };
  }
  return best;
}

/** Marca o civil como abordado (parado) no ref da frota. */
export function stopTrafficForApproach(
  fleet: TrafficVehicle[],
  trafficId: string,
  unitId: string,
  holdMs: number
): boolean {
  const now = Date.now();
  const idx = fleet.findIndex((v) => v.id === trafficId);
  if (idx < 0) return false;
  const v = fleet[idx];
  if (v.state === 'approached') return false;
  fleet[idx] = {
    ...v,
    state: 'approached',
    approachUnitId: unitId,
    approachUntil: now + holdMs,
    waitUntil: now + holdMs,
  };
  return true;
}

export function approachHoldMs(): number {
  const [lo, hi] = APPROACH_HOLD_MS;
  return lo + Math.random() * (hi - lo);
}

/**
 * Boletim de abordagem coerente com o tipo de veículo civil no mapa.
 */
export function generateTrafficVehicleCheck(kind: TrafficKind): VehicleCheck {
  const base = generateVehicleCheck();
  const model = pickOne(MODELS_BY_KIND[kind]);
  // motos: furto/roubo um pouco mais comum em abordagem; carretas menos
  let outcome = base.outcome;
  let roubado = base.roubado;
  if (kind === 'moto' && chance(0.04) && !roubado) {
    roubado = true;
    outcome = 'apreendido';
  }
  if ((kind === 'semi' || kind === 'truck') && outcome === 'apreendido' && chance(0.4)) {
    // pesados: mais notificação/multa que roubo na abordagem de rotina
    roubado = false;
    outcome = chance(0.5) ? 'multado' : 'liberado';
  }
  return {
    ...base,
    model,
    year: randomInt(kind === 'semi' ? 2010 : 2005, 2025),
    roubado,
    outcome,
  };
}

export function describeTrafficApproach(
  kind: TrafficKind,
  check: VehicleCheck,
  distanceM: number
): { description: string; outcome: string; arrest: boolean } {
  const label = TRAFFIC_KIND_LABEL[kind];
  const dist =
    distanceM < 40 ? 'à frente' : distanceM < 90 ? 'na via' : `a ~${Math.round(distanceM)} m`;
  const description = `Abordagem a ${label} ${check.model} (${check.plate}) — ${dist}`;
  const arrest = check.outcome === 'apreendido';
  const outcome =
    check.outcome === 'apreendido'
      ? `${label[0].toUpperCase()}${label.slice(1)} com registro de furto/roubo — condutor detido`
      : check.outcome === 'multado'
        ? 'Irregularidade (IPVA/documentação) — multado e notificado'
        : 'Documentação regular — liberado e seguiu viagem';
  return { description, outcome, arrest };
}

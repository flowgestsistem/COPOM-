import type { TrafficKind } from '../types/traffic';

/** Mix de frota civil (Uberlândia: maioria carros; pesados nas vias principais). */
export const TRAFFIC_KIND_WEIGHTS: { kind: TrafficKind; w: number; highwayBias: number }[] = [
  { kind: 'car', w: 0.52, highwayBias: 0.4 },
  { kind: 'moto', w: 0.18, highwayBias: 0.15 },
  { kind: 'pickup', w: 0.12, highwayBias: 0.2 },
  { kind: 'van', w: 0.08, highwayBias: 0.15 },
  { kind: 'truck', w: 0.06, highwayBias: 0.55 },
  { kind: 'semi', w: 0.04, highwayBias: 0.85 },
];

export const TRAFFIC_SPEED_MPS: Record<TrafficKind, [number, number]> = {
  car: [9, 16], // ~32–58 km/h
  moto: [11, 18],
  pickup: [8, 14],
  van: [7, 13],
  truck: [6, 11],
  semi: [5, 10],
};

/** Quantidade alvo de veículos civis (leve o suficiente pro browser). */
export const TRAFFIC_FLEET_SIZE = 110;
export const TRAFFIC_TICK_MS = 220;
/** Zoom mínimo para desenhar trânsito (abaixo some). */
export const TRAFFIC_MIN_ZOOM = 13;
/** Raio em que a sirene faz o trânsito ceder. */
export const EMERGENCY_YIELD_M = 140;
export const EMERGENCY_CLEAR_M = 200;

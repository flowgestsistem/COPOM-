import type { LatLng } from '../types/game';
import { offsetLatLng } from './geo';
import type { RouteResult } from './osrm';

const OSRM_ENDPOINT = 'https://router.project-osrm.org/route/v1/driving';
const PATROL_POINTS = 5;

interface OsrmResponse {
  routes?: {
    geometry: { coordinates: [number, number][] };
    duration: number;
    distance: number;
  }[];
}

export interface PatrolAssignment {
  /** Ponto de entrada na zona (destino inicial da viatura). */
  entryPoint: LatLng;
  /** Centro do circuito individual da viatura. */
  loopCenter: LatLng;
  /** Raio do circuito individual (fica dentro da zona). */
  loopRadius: number;
  /** Ângulo inicial dos waypoints (graus). */
  startAngleDeg: number;
}

/**
 * Espalha N viaturas pela zona de patrulha (círculo).
 * Cada uma recebe um setor + profundidade diferente para cobrir a área.
 */
export function spreadPatrolAssignments(
  center: LatLng,
  radiusMeters: number,
  unitCount: number
): PatrolAssignment[] {
  if (unitCount <= 0) return [];

  if (unitCount === 1) {
    return [
      {
        entryPoint: center,
        loopCenter: center,
        loopRadius: radiusMeters,
        startAngleDeg: 0,
      },
    ];
  }

  return Array.from({ length: unitCount }, (_, i) => {
    // Setores uniformes ao redor do círculo
    const sectorAngle = (360 / unitCount) * i;
    // Alterna profundidade (anel interno / médio / externo) para preencher a zona
    const ring = i % 3;
    const depthFactor = ring === 0 ? 0.32 : ring === 1 ? 0.55 : 0.78;
    const entryPoint = offsetLatLng(center, sectorAngle, radiusMeters * depthFactor);

    // Centro do loop no mesmo setor, um pouco mais para dentro
    const loopCenterDist = radiusMeters * Math.min(0.5, depthFactor * 0.85);
    const loopCenter = offsetLatLng(center, sectorAngle + 12, loopCenterDist);

    // Raio do circuito individual: cabe no setor e dentro da zona
    // com várias viaturas, loops menores; com poucas, loops maiores
    const sectorShare = Math.max(0.28, Math.min(0.55, 0.9 / Math.sqrt(unitCount)));
    const loopRadius = Math.max(180, radiusMeters * sectorShare);

    return {
      entryPoint,
      loopCenter,
      loopRadius,
      startAngleDeg: sectorAngle,
    };
  });
}

/** Pontos espalhados em círculo ao redor do centro, usados como paradas do circuito. */
function patrolWaypoints(center: LatLng, radiusMeters: number, startAngleDeg = 0, count = PATROL_POINTS): LatLng[] {
  return Array.from({ length: count }, (_, i) =>
    offsetLatLng(center, startAngleDeg + (360 / count) * i, radiusMeters)
  );
}

/**
 * Circuito real (OSRM) ao redor de um centro — cada viatura pode ter centro/raio/ângulo próprios.
 */
export async function fetchPatrolLoop(
  center: LatLng,
  radiusMeters: number,
  options?: { startAngleDeg?: number; pointCount?: number }
): Promise<RouteResult> {
  const startAngle = options?.startAngleDeg ?? 0;
  const pointCount = options?.pointCount ?? PATROL_POINTS;
  const waypoints = [center, ...patrolWaypoints(center, radiusMeters, startAngle, pointCount), center];
  const coords = waypoints.map(([lat, lon]) => `${lon},${lat}`).join(';');
  const url = `${OSRM_ENDPOINT}/${coords}?overview=full&geometries=geojson`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`OSRM respondeu ${res.status}`);

  const data: OsrmResponse = await res.json();
  const route = data.routes?.[0];
  if (!route) throw new Error('OSRM não retornou nenhuma rota de patrulha');

  return {
    points: route.geometry.coordinates.map(([lon, lat]): LatLng => [lat, lon]),
    durationMs: route.duration * 1000,
    distanceMeters: route.distance,
  };
}

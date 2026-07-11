import { haversineDistanceMeters } from './geo';
import type { LatLng } from '../types/game';

function lerp(a: LatLng, b: LatLng, t: number): LatLng {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/** Posição interpolada ao longo de uma polilinha, na fração [0, 1] do trajeto. */
export function positionAlongRoute(points: LatLng[], progress: number): LatLng {
  if (points.length === 0) throw new Error('Rota vazia');
  if (points.length === 1 || progress <= 0) return points[0];
  if (progress >= 1) return points[points.length - 1];

  const segmentLengths = points.slice(1).map((p, i) => haversineDistanceMeters(points[i], p));
  const totalLength = segmentLengths.reduce((a, b) => a + b, 0);
  if (totalLength === 0) return points[0];

  const targetDistance = progress * totalLength;
  let walked = 0;

  for (let i = 0; i < segmentLengths.length; i++) {
    const segmentLength = segmentLengths[i];
    if (walked + segmentLength >= targetDistance) {
      const segmentT = segmentLength === 0 ? 0 : (targetDistance - walked) / segmentLength;
      return lerp(points[i], points[i + 1], segmentT);
    }
    walked += segmentLength;
  }

  return points[points.length - 1];
}

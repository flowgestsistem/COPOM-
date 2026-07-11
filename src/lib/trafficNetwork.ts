import type { CityStreet } from '../types/city';
import type { LatLng } from '../types/game';
import { haversineDistanceMeters } from './geo';

export interface StreetPath {
  id: string;
  name: string;
  points: LatLng[];
  /** Comprimento total em metros. */
  lengthM: number;
  /** Distâncias cumulativas por vértice. */
  cum: number[];
  start: LatLng;
  end: LatLng;
  /** Índices de ruas conectadas (extremidades próximas). */
  neighbors: number[];
}

export interface TrafficNetwork {
  paths: StreetPath[];
  /** Amostra de índices “rodovia/avenida” (nomes longos / vias principais). */
  highwayish: number[];
  urban: number[];
}

const LINK_RADIUS_M = 95;

function pathLength(points: LatLng[]): { lengthM: number; cum: number[] } {
  const cum = [0];
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineDistanceMeters(points[i - 1], points[i]);
    cum.push(total);
  }
  return { lengthM: Math.max(total, 1), cum };
}

function cellKey(lat: number, lon: number, size = 0.002): string {
  return `${Math.floor(lat / size)}_${Math.floor(lon / size)}`;
}

/**
 * Pré-processa as ruas OSM de Uberlândia em uma rede navegável leve
 * (sem OSRM): conexões por proximidade de extremos.
 */
export function buildTrafficNetwork(streets: CityStreet[]): TrafficNetwork {
  const usable = streets.filter((s) => s.points.length >= 2);
  const paths: StreetPath[] = usable.map((s) => {
    const { lengthM, cum } = pathLength(s.points);
    return {
      id: s.id,
      name: s.name,
      points: s.points,
      lengthM,
      cum,
      start: s.points[0],
      end: s.points[s.points.length - 1],
      neighbors: [],
    };
  });

  // grade espacial dos extremos
  const buckets = new Map<string, { pathIndex: number; end: 0 | 1 }[]>();
  const add = (p: LatLng, pathIndex: number, end: 0 | 1) => {
    const key = cellKey(p[0], p[1]);
    const list = buckets.get(key) ?? [];
    list.push({ pathIndex, end });
    buckets.set(key, list);
  };

  for (let i = 0; i < paths.length; i++) {
    add(paths[i].start, i, 0);
    add(paths[i].end, i, 1);
  }

  const nearKeys = (p: LatLng): string[] => {
    const size = 0.002;
    const i0 = Math.floor(p[0] / size);
    const j0 = Math.floor(p[1] / size);
    const keys: string[] = [];
    for (let di = -1; di <= 1; di++) {
      for (let dj = -1; dj <= 1; dj++) {
        keys.push(`${i0 + di}_${j0 + dj}`);
      }
    }
    return keys;
  };

  const link = (a: number, b: number) => {
    if (a === b) return;
    if (!paths[a].neighbors.includes(b)) paths[a].neighbors.push(b);
    if (!paths[b].neighbors.includes(a)) paths[b].neighbors.push(a);
  };

  for (let i = 0; i < paths.length; i++) {
    for (const endPt of [paths[i].start, paths[i].end]) {
      for (const key of nearKeys(endPt)) {
        const bucket = buckets.get(key);
        if (!bucket) continue;
        for (const other of bucket) {
          if (other.pathIndex === i) continue;
          const otherPt = other.end === 0 ? paths[other.pathIndex].start : paths[other.pathIndex].end;
          if (haversineDistanceMeters(endPt, otherPt) <= LINK_RADIUS_M) {
            link(i, other.pathIndex);
          }
        }
      }
    }
  }

  const highwayish: number[] = [];
  const urban: number[] = [];
  for (let i = 0; i < paths.length; i++) {
    const n = paths[i].name.toLowerCase();
    const isHwy =
      n.includes('rodovia') ||
      n.includes('br-') ||
      n.includes('br ') ||
      n.includes('anel viário') ||
      n.includes('anel viario') ||
      n.includes('contorno') ||
      paths[i].lengthM > 1200;
    if (isHwy) highwayish.push(i);
    else urban.push(i);
  }

  return { paths, highwayish, urban };
}

/** Posição e heading ao longo de um trecho. */
export function samplePath(
  path: StreetPath,
  progress: number,
  direction: 1 | -1
): { position: LatLng; heading: number } {
  const t = Math.max(0, Math.min(1, progress));
  const dist = t * path.lengthM;
  const pts = path.points;
  const cum = path.cum;

  let i = 0;
  while (i < cum.length - 2 && cum[i + 1] < dist) i++;

  const segLen = Math.max(cum[i + 1] - cum[i], 0.001);
  const localT = (dist - cum[i]) / segLen;
  const a = pts[i];
  const b = pts[Math.min(i + 1, pts.length - 1)];
  const position: LatLng = [a[0] + (b[0] - a[0]) * localT, a[1] + (b[1] - a[1]) * localT];

  // heading do segmento no sentido de direction
  const from = direction === 1 ? a : b;
  const to = direction === 1 ? b : a;
  const dLat = to[0] - from[0];
  const dLon = to[1] - from[1];
  const heading = (Math.atan2(dLon, dLat) * 180) / Math.PI; // 0 = norte
  return { position, heading: ((heading % 360) + 360) % 360 };
}

/** Escolhe próxima rua ao chegar no extremo (ou reverte se sem vizinho). */
export function pickNextStreet(
  network: TrafficNetwork,
  streetIndex: number,
  atEnd: boolean,
  preferHighway: boolean
): { streetIndex: number; progress: number; direction: 1 | -1 } {
  const path = network.paths[streetIndex];
  const tip = atEnd ? path.end : path.start;
  const candidates = path.neighbors.filter((idx) => {
    if (preferHighway) return network.highwayish.includes(idx) || Math.random() < 0.45;
    return true;
  });
  const pool = candidates.length > 0 ? candidates : path.neighbors;

  if (pool.length === 0) {
    // reverte na mesma rua
    return {
      streetIndex,
      progress: atEnd ? 0.999 : 0.001,
      direction: atEnd ? -1 : 1,
    };
  }

  const nextIdx = pool[Math.floor(Math.random() * pool.length)];
  const next = network.paths[nextIdx];
  const distStart = haversineDistanceMeters(tip, next.start);
  const distEnd = haversineDistanceMeters(tip, next.end);
  if (distStart <= distEnd) {
    return { streetIndex: nextIdx, progress: 0.001, direction: 1 };
  }
  return { streetIndex: nextIdx, progress: 0.999, direction: -1 };
}

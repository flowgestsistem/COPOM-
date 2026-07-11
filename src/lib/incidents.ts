import type { CityStreet } from '../types/city';
import type { Incident, IncidentType, LatLng } from '../types/game';
import { UBERLANDIA_BBOX, UBERLANDIA_CENTER } from '../data/city';
import { haversineDistanceMeters, offsetLatLng } from './geo';
import { pickWeighted } from './random';
import { catalogFor, catalogSize, type IncidentZone } from './incidentCatalog';
import { incidentRequiresCivilPolice } from './civilPolice';

/** Ocorrências concentradas em Uberlândia e entorno imediato. */
export const INCIDENT_MAX_RANGE_M = 14_000;

const TYPE_WEIGHTS: Record<IncidentType, number> = {
  policia: 0.48,
  samu: 0.32,
  incendio: 0.2,
};

/** Maioria urbana; rural/rodovia/rio só com títulos daquela zona. */
const ZONE_WEIGHTS: Record<IncidentZone, number> = {
  urbano: 0.7,
  rural: 0.14,
  rodovia: 0.1,
  rio: 0.06,
};

const ZONE_LABEL: Record<IncidentZone, string> = {
  urbano: 'área urbana de Uberlândia',
  rural: 'área rural de Uberlândia',
  rodovia: 'rodovia no entorno de Uberlândia',
  rio: 'rio/córrego no entorno de Uberlândia',
};

export interface GenerateIncidentOptions {
  /** Locais de ocorrências já ativas — evita empilhar no mapa. */
  avoidLocations?: LatLng[];
  /** Distância mínima em relação a avoidLocations (metros). */
  minSeparationMeters?: number;
}

function pickZone(): IncidentZone {
  return pickWeighted(ZONE_WEIGHTS);
}

function clampToCity(location: LatLng): LatLng {
  const [lat, lon] = location;
  return [
    Math.min(UBERLANDIA_BBOX.north, Math.max(UBERLANDIA_BBOX.south, lat)),
    Math.min(UBERLANDIA_BBOX.east, Math.max(UBERLANDIA_BBOX.west, lon)),
  ];
}

function randomInRing(minM: number, maxM: number): LatLng {
  const cappedMax = Math.min(maxM, INCIDENT_MAX_RANGE_M);
  const cappedMin = Math.min(minM, cappedMax * 0.9);
  const dist = cappedMin + Math.random() * (cappedMax - cappedMin);
  const bearing = Math.random() * 360;
  const raw = offsetLatLng(UBERLANDIA_CENTER, bearing, dist);
  return Math.random() < 0.35 ? clampToCity(raw) : raw;
}

function isFarEnough(location: LatLng, avoid: LatLng[], minM: number): boolean {
  if (avoid.length === 0 || minM <= 0) return true;
  return avoid.every((p) => haversineDistanceMeters(location, p) >= minM);
}

function locationForZone(
  zone: IncidentZone,
  streets: CityStreet[],
  avoid: LatLng[],
  minSeparation: number
): { location: LatLng; placeName: string } {
  const rings: Record<IncidentZone, [number, number]> = {
    urbano: [200, 6_000],
    rural: [4_000, 12_000],
    rodovia: [3_000, 11_000],
    rio: [2_000, 10_000],
  };
  const [minM, maxM] = rings[zone];

  // tenta vários pontos até achar um afastado das ocorrências ativas
  const attempts = 14;
  let fallback: { location: LatLng; placeName: string } | null = null;

  for (let i = 0; i < attempts; i++) {
    let location: LatLng;
    let placeName: string;

    if (zone === 'urbano' && streets.length > 0) {
      const street = streets[Math.floor(Math.random() * streets.length)];
      location = street.points[Math.floor(Math.random() * street.points.length)];
      placeName = street.name;
    } else {
      location = randomInRing(minM, maxM);
      placeName = ZONE_LABEL[zone];
    }

    if (!fallback) fallback = { location, placeName };
    if (isFarEnough(location, avoid, minSeparation)) {
      return { location, placeName };
    }
  }

  // último recurso: empurra o fallback para longe do cluster mais próximo
  if (fallback && avoid.length > 0) {
    const nearest = avoid.reduce((best, p) => {
      const d = haversineDistanceMeters(fallback!.location, p);
      return d < best.d ? { p, d } : best;
    }, { p: avoid[0], d: Infinity });
    const bearing = Math.random() * 360;
    return {
      location: offsetLatLng(nearest.p, bearing, minSeparation + 200 + Math.random() * 600),
      placeName: fallback.placeName,
    };
  }

  return fallback ?? { location: randomInRing(minM, maxM), placeName: ZONE_LABEL[zone] };
}

let incidentCounter = 0;

export function generateIncident(
  streets: CityStreet[],
  options: GenerateIncidentOptions = {}
): Incident {
  const avoid = options.avoidLocations ?? [];
  const minSeparation = options.minSeparationMeters ?? 0;

  // 1) zona e tipo primeiro
  const zone = pickZone();
  const type = pickWeighted(TYPE_WEIGHTS);

  // 2) só títulos que fazem sentido naquela zona
  let pool = catalogFor(type, zone);
  if (pool.length === 0) {
    pool = (['policia', 'incendio', 'samu'] as IncidentType[]).flatMap((t) => catalogFor(t, zone));
  }
  if (pool.length === 0) {
    pool = catalogFor('policia', 'urbano');
  }

  const entry = pool[Math.floor(Math.random() * pool.length)];
  const { location, placeName } = locationForZone(zone, streets, avoid, minSeparation);

  incidentCounter += 1;

  const title = entry.title;
  return {
    id: `incident-${Date.now()}-${incidentCounter}`,
    type: entry.type,
    title,
    description: `${entry.detail} Local: ${placeName}.`,
    location,
    priority: entry.priority,
    status: 'aguardando',
    createdAt: Date.now(),
    icon: entry.icon,
    zone,
    requiresCivilPolice: incidentRequiresCivilPolice(title, entry.type),
  };
}

export { catalogSize };

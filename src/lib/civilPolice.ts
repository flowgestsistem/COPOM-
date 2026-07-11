import type { CityBase } from '../types/city';
import type { CivilCase, Incident, LatLng, Unit } from '../types/game';
import { haversineDistanceMeters } from './geo';

/** Títulos / padrões que exigem Polícia Civil no local. */
const CIVIL_REQUIRED_PATTERN =
  /homicídio|homicidio|cadáver|cadaver|local de crime|investigação|investigacao|latrocínio|latrocinio|sequestro|cárcere|carcere|violência doméstica|violencia domestica|medida protetiva|estupro|abuso|morte|corpo encontrado|furto de gado|roubo a mão armada|assalto a mão armada|disparo de arma|arma de fogo|tráfico de drogas|trafico de drogas|mandado|desaparecid|prisão|prisao|apreensão|apreensao|estelionato|golpe do pix/i;

export function incidentRequiresCivilPolice(title: string, type: Incident['type']): boolean {
  if (type !== 'policia') return false;
  return CIVIL_REQUIRED_PATTERN.test(title);
}

export function isCivilPoliceUnit(unit: Unit, bases: CityBase[]): boolean {
  const base = bases.find((b) => b.id === unit.baseId);
  if (!base) return false;
  const name = `${base.name} ${unit.department} ${unit.label}`.toLowerCase();
  return /pol[íi]cia civil|delegacia|investiga|plantão|plantao|drpc/i.test(name);
}

export function freeCivilUnits(units: Unit[], bases: CityBase[]): Unit[] {
  return units
    .filter((u) => u.type === 'viatura' && u.status === 'disponivel' && isCivilPoliceUnit(u, bases))
    .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
}

export function nearestFreeCivilUnit(
  units: Unit[],
  bases: CityBase[],
  location: LatLng
): Unit | null {
  const free = freeCivilUnits(units, bases);
  if (free.length === 0) return null;
  return free.reduce((best, u) => {
    const d = haversineDistanceMeters(u.position, location);
    const bd = haversineDistanceMeters(best.position, location);
    return d < bd ? u : best;
  });
}

let caseCounter = 0;
let boCounter = 1000;

export function createCivilCase(incident: Incident): CivilCase {
  caseCounter += 1;
  const now = Date.now();
  return {
    id: `civil-case-${now}-${caseCounter}`,
    incidentId: incident.id,
    title: incident.title,
    location: incident.location,
    status: 'aguardando_viatura',
    createdAt: now,
    updatedAt: now,
    notes: ['Caso aberto — aguardando viatura da Polícia Civil.'],
    arrestCount: 0,
    evidenceCollected: false,
  };
}

export function nextBoNumber(): string {
  boCounter += 1;
  const year = new Date().getFullYear();
  return `BO-${year}-${boCounter}`;
}

export function civilStatusLabel(status: CivilCase['status']): string {
  switch (status) {
    case 'aguardando_viatura':
      return 'Aguardando viatura PC';
    case 'a_caminho':
      return 'PC a caminho';
    case 'no_local':
      return 'PC no local';
    case 'em_investigacao':
      return 'Em investigação';
    case 'bo_em_andamento':
      return 'B.O. em andamento';
    case 'concluido':
      return 'Concluído';
    default:
      return status;
  }
}

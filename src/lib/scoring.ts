import type { Incident } from '../types/game';

/** Pontos concedidos ao concluir uma ocorrência — prioridades mais altas valem mais. */
export function scoreForIncident(incident: Incident): number {
  return (4 - incident.priority) * 100;
}

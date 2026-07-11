import type { Incident } from '../types/game';

/** Pontos concedidos ao concluir uma ocorrência — prioridades mais altas valem mais. */
export function scoreForIncident(incident: Incident): number {
  let pts = (4 - incident.priority) * 100;
  if (incident.armed) pts += 40;
  if ((incident.victimCount ?? 0) > 1) pts += 25;
  if (incident.requiresCivilPolice) pts += 30;
  // bônus leve por histórico de ações documentadas
  if ((incident.outcomes?.length ?? 0) >= 2) pts += 20;
  if ((incident.log?.length ?? 0) >= 5) pts += 15;
  return pts;
}

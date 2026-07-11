import type { Incident, Unit } from '../types/game';
import { planUnitService } from '../lib/serviceDuration';
import {
  fireRoleDurationMs,
  fireRoleLabel,
  pickFireRoleForUnit,
  type FireTeamRole,
} from '../lib/fireTeams';

type SetUnits = (updater: (prev: Unit[]) => Unit[]) => void;
type SetIncidents = (updater: (prev: Incident[]) => Incident[]) => void;

/** Inicia atendimento no local com papel/duração por unidade (multi-equipe BM). */
export function startIncidentService(
  incidentId: string,
  unitId: string,
  incidents: Incident[],
  setIncidents: SetIncidents,
  setUnits: SetUnits,
  options?: { fireRole?: FireTeamRole }
): void {
  const incident = incidents.find((i) => i.id === incidentId);
  if (!incident) return;
  const now = Date.now();

  // lemos o estado via functional updates em sequência controlada
  setUnits((prev) => {
    const peers = prev.filter((u) => u.assignedIncidentId === incidentId);
    const actor = prev.find((u) => u.id === unitId);
    if (!actor) return prev;

    let plan = planUnitService(actor, incident, peers);
    if (options?.fireRole) {
      plan = {
        role: options.fireRole,
        roleLabel: fireRoleLabel(options.fireRole),
        durationMs: fireRoleDurationMs(options.fireRole, incident),
      };
    }

    const actorEnds = now + plan.durationMs;
    const assignedRoles: FireTeamRole[] = [plan.role as FireTeamRole];

    const next = prev.map((u) => {
      if (u.id === unitId) {
        return {
          ...u,
          status: 'no_local' as const,
          // menu de ações permanece disponível para enfileirar a próxima
          pendingDecision: 'acoes_local' as const,
          pendingIncidentTitle: `${plan.roleLabel} · ${incident.title}`,
          assignedIncidentId: incidentId,
          serviceRole: String(plan.role),
          serviceRoleLabel: plan.roleLabel,
          serviceEndsAt: actorEnds,
          missionEndsAt: actorEnds,
          actionQueue: u.actionQueue ?? [],
        };
      }

      if (
        u.assignedIncidentId === incidentId &&
        (u.status === 'no_local' ||
          u.status === 'aguardando_decisao' ||
          u.pendingDecision === 'chegada') &&
        !u.serviceEndsAt
      ) {
        if (u.type === 'bombeiro' || u.type === 'ambulancia') {
          const role =
            u.type === 'ambulancia'
              ? ('aph' as FireTeamRole)
              : pickFireRoleForUnit(u, incident, assignedRoles);
          assignedRoles.push(role);
          const dur = fireRoleDurationMs(role, incident);
          const e = now + dur;
          const label = fireRoleLabel(role);
          return {
            ...u,
            status: 'no_local' as const,
            pendingDecision: undefined,
            pendingIncidentTitle: `${label} · ${incident.title}`,
            assignedIncidentId: incidentId,
            serviceRole: role,
            serviceRoleLabel: label,
            serviceEndsAt: e,
            missionEndsAt: e,
          };
        }
        return {
          ...u,
          status: 'no_local' as const,
          pendingDecision: undefined,
          pendingIncidentTitle: `Apoio no local — compartilhando atendimento · ${incident.title}`,
          assignedIncidentId: incidentId,
        };
      }
      return u;
    });

    const maxEnds = next
      .filter((u) => u.assignedIncidentId === incidentId && u.serviceEndsAt)
      .reduce((m, u) => Math.max(m, u.serviceEndsAt!), actorEnds);

    const roleNotes = next
      .filter((u) => u.assignedIncidentId === incidentId && u.serviceRoleLabel)
      .map((u) => `${u.label}: ${u.serviceRoleLabel}`)
      .join('; ');

    // agenda update do incidente após o batch de unidades
    window.setTimeout(() => {
      setIncidents((incPrev) =>
        incPrev.map((i) =>
          i.id === incidentId
            ? {
                ...i,
                status: 'em_atendimento',
                resolvesAt: Math.max(i.resolvesAt ?? 0, maxEnds),
                assignedUnitId: i.assignedUnitId ?? unitId,
                description: roleNotes
                  ? i.description.includes('[Equipes:')
                    ? i.description.replace(/\[Equipes:[^\]]*\]/, `[Equipes: ${roleNotes}]`)
                    : `${i.description} [Equipes: ${roleNotes}]`
                  : i.description,
              }
            : i
        )
      );
    }, 0);

    return next;
  });
}

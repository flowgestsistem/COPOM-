import { useEffect, useRef } from 'react';
import type { Incident, Unit } from '../types/game';
import { scoreForIncident } from '../lib/scoring';
import { playArrivalBeep, playDecisionBeep } from '../lib/sound';
import {
  fireRoleDurationMs,
  fireRoleLabel,
  pickFireRoleForUnit,
  type FireTeamRole,
} from '../lib/fireTeams';
import { makeLogEntry, outcomeForCompletedAction } from '../lib/incidentRealism';

export { startIncidentService } from './startIncidentService';

type SetUnits = (updater: (prev: Unit[]) => Unit[]) => void;
type SetIncidents = (updater: (prev: Incident[]) => Incident[]) => void;

/**
 * Ciclo multi-equipe:
 * - cada bombeiro no local tem serviceEndsAt (APH, extricaÃ§Ã£o, combateâ€¦)
 * - o incidente sÃ³ fecha quando o maior timer acaba e ninguÃ©m ainda estÃ¡ trabalhando
 * - reforÃ§os que chegam em atendimento recebem papel automÃ¡tico e estendem o prazo
 */
export function useIncidentLifecycle(
  units: Unit[],
  setUnits: SetUnits,
  incidents: Incident[],
  setIncidents: SetIncidents,
  onScore: (points: number) => void,
  onArrivalMenu?: (unitId: string) => void
) {
  const arrivalBeeped = useRef<Set<string>>(new Set());
  const finishBeeped = useRef<Set<string>>(new Set());
  const supportJoined = useRef<Set<string>>(new Set());
  const unitTaskDone = useRef<Set<string>>(new Set());

  useEffect(() => {
    const now = Date.now();

    // ─── Unidade termina a própria tarefa ───
    for (const unit of units) {
      if (!unit.serviceEndsAt || unit.serviceEndsAt > now) continue;
      if (!unit.assignedIncidentId) continue;
      // chave por fim da tarefa (permite várias em sequência)
      const doneKey = `${unit.id}:${unit.serviceEndsAt}`;
      if (unitTaskDone.current.has(doneKey)) continue;
      unitTaskDone.current.add(doneKey);

      const incident = incidents.find((i) => i.id === unit.assignedIncidentId);
      if (!incident) continue;

      const queued = unit.actionQueue?.length ?? 0;
      const active = unit.activeSceneAction;
      const outcome = active
        ? outcomeForCompletedAction(
            { id: active.id, title: active.title, effect: active.effect },
            incident,
            unit
          )
        : null;

      // diário + bônus de pontuação por ação concluída
      if (outcome) {
        setIncidents((prev) =>
          prev.map((i) => {
            if (i.id !== incident.id) return i;
            const log = [...(i.log ?? []), makeLogEntry(outcome.note, 'resultado')].slice(-40);
            const outcomes = [...(i.outcomes ?? []), outcome.note].slice(-20);
            let next = {
              ...i,
              log,
              outcomes,
              description: i.description.includes(outcome.note)
                ? i.description
                : `${i.description} [${outcome.note}]`,
            };
            if (outcome.forcePreserve || outcome.forceCivil) {
              next = { ...next, requiresCivilPolice: true };
            }
            return next;
          })
        );
        if (outcome.scoreBonus > 0) onScore(outcome.scoreBonus);
      }

      const nextDecision =
        queued > 0
          ? ('acoes_local' as const)
          : outcome?.nextDecision === 'policia'
            ? ('policia' as const)
            : outcome?.nextDecision === 'hospital'
              ? ('hospital' as const)
              : outcome?.nextDecision === 'disposicao'
                ? ('disposicao' as const)
                : ('acoes_local' as const);

      setUnits((prev) =>
        prev.map((u) =>
          u.id === unit.id
            ? {
                ...u,
                serviceEndsAt: undefined,
                missionEndsAt: undefined,
                activeSceneAction: undefined,
                status: 'no_local' as const,
                pendingDecision: nextDecision,
                pendingIncidentTitle:
                  queued > 0
                    ? `Tarefa ok (${u.serviceRoleLabel ?? 'ação'}) — próxima na fila (${queued}) · ${incident.title}`
                    : outcome
                      ? `${outcome.note.split(':').slice(1).join(':').trim() || 'Tarefa concluída'} · ${incident.title}`
                      : `Tarefa concluída (${u.serviceRoleLabel ?? 'atendimento'}) — pode enfileirar outra · ${incident.title}`,
              }
            : u
        )
      );

      if (nextDecision !== 'acoes_local' && queued === 0) {
        playDecisionBeep();
        onArrivalMenu?.(unit.id);
      }
    }

    // â”€â”€â”€ Apoio chega com ocorrÃªncia em andamento â”€â”€â”€
    for (const unit of units) {
      if (unit.status !== 'no_local' || !unit.assignedIncidentId) continue;
      if (unit.pendingDecision === 'chegada' || unit.pendingDecision === 'acoes_local') continue;
      if (unit.serviceEndsAt) continue;
      if (unit.pendingIncidentTitle?.includes('Tarefa conclu')) continue;

      const incident = incidents.find((i) => i.id === unit.assignedIncidentId);
      if (!incident || incident.status !== 'em_atendimento') continue;

      const key = `join:${unit.id}:${incident.id}`;
      if (supportJoined.current.has(key)) continue;
      if (unit.serviceRole) {
        supportJoined.current.add(key);
        continue;
      }

      if (unit.type === 'bombeiro' || unit.type === 'ambulancia') {
        supportJoined.current.add(key);
        const peers = units.filter(
          (u) => u.assignedIncidentId === incident.id && u.id !== unit.id && u.serviceRole
        );
        const already = peers.map((u) => u.serviceRole as FireTeamRole);
        const role =
          unit.type === 'ambulancia'
            ? ('aph' as FireTeamRole)
            : pickFireRoleForUnit(unit, incident, already);
        const duration = fireRoleDurationMs(role, incident);
        const label = fireRoleLabel(role);
        const ends = now + duration;

        setUnits((prev) =>
          prev.map((u) =>
            u.id === unit.id
              ? {
                  ...u,
                  status: 'no_local',
                  pendingDecision: undefined,
                  serviceRole: role,
                  serviceRoleLabel: label,
                  serviceEndsAt: ends,
                  missionEndsAt: ends,
                  pendingIncidentTitle: `${label} Â· ${incident.title}`,
                  responseCode: undefined,
                  route: undefined,
                  routeProgress: undefined,
                  routeDurationMs: undefined,
                  routeStartedAt: undefined,
                }
              : u
          )
        );

        setIncidents((prev) =>
          prev.map((i) => {
            if (i.id !== incident.id) return i;
            const note = `[${unit.label}: ${label}]`;
            return {
              ...i,
              description: i.description.includes(note) ? i.description : `${i.description} ${note}`,
              resolvesAt: Math.max(i.resolvesAt ?? 0, ends),
            };
          })
        );
        continue;
      }

      supportJoined.current.add(key);
      const isPrimary = incident.assignedUnitId === unit.id;
      if (isPrimary && unit.pendingDecision) continue;

      setUnits((prev) =>
        prev.map((u) =>
          u.id === unit.id
            ? {
                ...u,
                status: 'no_local',
                pendingDecision: undefined,
                pendingIncidentTitle: isPrimary
                  ? incident.title
                  : `Apoio no local â€” compartilhando atendimento Â· ${incident.title}`,
                responseCode: undefined,
                route: undefined,
                routeProgress: undefined,
                routeDurationMs: undefined,
                routeStartedAt: undefined,
              }
            : u
        )
      );
    }

    // â”€â”€â”€ Chegada: bip + menu â”€â”€â”€
    const arrivedForMenu = units.filter((u) => {
      if (u.status !== 'no_local' || !u.assignedIncidentId) return false;
      if (u.pendingDecision === 'chegada') return false;
      const incident = incidents.find((i) => i.id === u.assignedIncidentId);
      return !!incident && incident.status === 'despachado';
    });

    for (const unit of arrivedForMenu) {
      const incident = incidents.find((i) => i.id === unit.assignedIncidentId)!;
      const key = `${unit.id}:${unit.assignedIncidentId}`;
      if (arrivalBeeped.current.has(key)) continue;

      const peerHasMenu = units.some(
        (x) =>
          x.id !== unit.id &&
          x.assignedIncidentId === unit.assignedIncidentId &&
          x.pendingDecision === 'chegada'
      );
      if (peerHasMenu) {
        arrivalBeeped.current.add(key);
        supportJoined.current.add(`join:${unit.id}:${incident.id}`);
        // Apoio também entra em 'chegada' para a IA tática assumir (sem travar o COPOM)
        setUnits((prev) =>
          prev.map((u) =>
            u.id === unit.id
              ? {
                  ...u,
                  status: 'aguardando_decisao',
                  pendingDecision: 'chegada',
                  pendingIncidentTitle: `Apoio no local · ${incident.title}`,
                  mission: 'apoio_ocorrencia',
                  responseCode: undefined,
                  route: undefined,
                  routeProgress: undefined,
                  routeDurationMs: undefined,
                  routeStartedAt: undefined,
                }
              : u.id !== unit.id &&
                  u.assignedIncidentId === incident.id &&
                  u.pendingDecision === 'chegada'
                ? {
                    ...u,
                    pendingIncidentTitle: `${u.pendingIncidentTitle ?? incident.title} · ${unit.label} chegou (apoio)`,
                  }
                : u
          )
        );
        onArrivalMenu?.(unit.id);
        continue;
      }

      if (incident.assignedUnitId && unit.id !== incident.assignedUnitId) {
        const primary = units.find((x) => x.id === incident.assignedUnitId);
        if (primary && primary.status === 'a_caminho') {
          arrivalBeeped.current.add(key);
          // Apoio chegou antes da principal — age no local (IA) sem esperar
          setUnits((prev) =>
            prev.map((u) =>
              u.id === unit.id
                ? {
                    ...u,
                    status: 'aguardando_decisao',
                    pendingDecision: 'chegada',
                    pendingIncidentTitle: `Apoio no local (principal a caminho) · ${incident.title}`,
                    mission: 'apoio_ocorrencia',
                    responseCode: undefined,
                    route: undefined,
                    routeProgress: undefined,
                    routeDurationMs: undefined,
                    routeStartedAt: undefined,
                  }
                : u
            )
          );
          onArrivalMenu?.(unit.id);
          continue;
        }
      }

      // Bombeiro de apoio em ocorrÃªncia jÃ¡ com principal no menu: se principal jÃ¡ iniciouâ€¦ handled above
      // Bombeiros que chegam enquanto status despachado e principal jÃ¡ no local: podem abrir menu se forem first free
      arrivalBeeped.current.add(key);

      const enRoutePeers = units.filter(
        (x) =>
          x.id !== unit.id &&
          x.assignedIncidentId === unit.assignedIncidentId &&
          x.status === 'a_caminho'
      );
      const onScenePeers = units.filter(
        (x) =>
          x.id !== unit.id &&
          x.assignedIncidentId === unit.assignedIncidentId &&
          (x.status === 'no_local' || x.status === 'aguardando_decisao')
      );

      let titleExtra = '';
      if (enRoutePeers.length > 0) {
        titleExtra = ` Â· reforÃ§o a caminho: ${enRoutePeers.map((p) => p.label).join(', ')}`;
      } else if (onScenePeers.length > 0) {
        titleExtra = ` Â· apoio no local: ${onScenePeers.map((p) => p.label).join(', ')}`;
      }

      playArrivalBeep();

      setUnits((prev) =>
        prev.map((u) =>
          u.id === unit.id
            ? {
                ...u,
                status: 'aguardando_decisao',
                pendingDecision: 'chegada',
                pendingIncidentTitle: `${incident.title}${titleExtra}`,
                responseCode: undefined,
                route: undefined,
                routeProgress: undefined,
                routeDurationMs: undefined,
                routeStartedAt: undefined,
              }
            : u
        )
      );

      onArrivalMenu?.(unit.id);
    }

    // â”€â”€â”€ Fim do atendimento: timer global + ninguÃ©m mais trabalhando â”€â”€â”€
    const justFinished = incidents.filter((i) => {
      if (i.status !== 'em_atendimento' || i.resolvesAt === undefined || i.resolvesAt > now) {
        return false;
      }
      const team = units.filter((u) => u.assignedIncidentId === i.id);
      // ainda tem equipe com tarefa em andamento
      if (team.some((u) => u.serviceEndsAt && u.serviceEndsAt > now)) return false;
      // ainda há ações enfileiradas
      if (team.some((u) => (u.actionQueue?.length ?? 0) > 0)) return false;
      // ainda tem equipe a caminho — espera chegar
      if (team.some((u) => u.status === 'a_caminho')) return false;
      return true;
    });

    if (justFinished.length === 0) return;

    const finishedIds = new Set(justFinished.map((i) => i.id));
    onScore(justFinished.reduce((sum, i) => sum + scoreForIncident(i), 0));

    const needPcIds = new Set(justFinished.filter((i) => i.requiresCivilPolice).map((i) => i.id));
    const normalIds = new Set(justFinished.filter((i) => !i.requiresCivilPolice).map((i) => i.id));

    setIncidents((prev) =>
      prev.map((i) => {
        if (needPcIds.has(i.id)) return { ...i, status: 'aguardando_pc', resolvesAt: undefined };
        if (normalIds.has(i.id)) return { ...i, status: 'aguardando_decisao' };
        return i;
      })
    );

    setUnits((prev) =>
      prev.map((u) => {
        if (!u.assignedIncidentId || !finishedIds.has(u.assignedIncidentId)) return u;
        if (u.pendingDecision === 'chegada') return u;
        if (u.status === 'a_caminho') return u;

        const incident = justFinished.find((i) => i.id === u.assignedIncidentId);
        if (!incident) return u;

        if (incident.requiresCivilPolice) {
          return {
            ...u,
            status: 'no_local',
            pendingDecision: undefined,
            pendingIncidentTitle: `Preservando local â€” ${incident.title}`,
            serviceEndsAt: undefined,
            responseCode: undefined,
            route: undefined,
            routeProgress: undefined,
            routeDurationMs: undefined,
            routeStartedAt: undefined,
          };
        }

        if (!finishBeeped.current.has(incident.id)) {
          finishBeeped.current.add(incident.id);
          playDecisionBeep();
        }

        const pendingDecision = incident.type === 'policia' ? 'policia' : 'hospital';
        const isPrimary = incident.assignedUnitId === u.id;

        if (!isPrimary) {
          return {
            ...u,
            status: 'aguardando_decisao',
            pendingDecision: 'disposicao',
            pendingIncidentTitle: `Equipe liberada â€” ${incident.title}`,
            serviceEndsAt: undefined,
            responseCode: undefined,
            route: undefined,
            routeProgress: undefined,
            routeDurationMs: undefined,
            routeStartedAt: undefined,
          };
        }

        return {
          ...u,
          status: 'aguardando_decisao',
          pendingDecision,
          pendingIncidentTitle: incident.title,
          serviceEndsAt: undefined,
          responseCode: undefined,
          route: undefined,
          routeProgress: undefined,
          routeDurationMs: undefined,
          routeStartedAt: undefined,
        };
      })
    );
  }, [units, incidents, setUnits, setIncidents, onScore, onArrivalMenu]);
}


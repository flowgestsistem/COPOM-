import { useEffect, useRef } from 'react';
import type { CityBase } from '../types/city';
import type { Incident, Unit } from '../types/game';
import {
  aiRadioCall,
  planCivilDecision,
  planDisposition,
  planHospitalId,
  planPoliceDecision,
  planTacticalResponse,
} from '../lib/tacticalAI';
import { makeLogEntry } from '../lib/incidentRealism';
import type { SceneAction } from '../lib/sceneActions';
import type { CivilDecisionAction, DispositionAction, PoliceDecisionAction } from '../components/UnitDecisionSheet';
import { radioClosing, radioOnScene } from '../lib/policeProtocol';
import { formatReturnMessage, makeAiOpsEvent, type AiOpsEvent } from '../lib/aiOpsFeed';

type SetIncidents = (updater: (prev: Incident[]) => Incident[]) => void;

type AIHandlers = {
  onSceneAction: (unitId: string, action: SceneAction) => void;
  onPoliceAction: (unitId: string, action: PoliceDecisionAction) => void;
  onCivilAction: (unitId: string, action: CivilDecisionAction) => void;
  onDisposition: (unitId: string, action: DispositionAction) => void;
  onHospital: (unitId: string, hospitalBaseId: string) => void;
  onNotify?: (event: AiOpsEvent) => void;
};

/**
 * IA autônoma da corporação — resolve no local sem o operador.
 * Notifica cada passo (chegada, ações, retorno/base ou condução de preso).
 */
export function useTacticalAI({
  enabled,
  started,
  paused,
  units,
  incidents,
  bases,
  setIncidents,
  onSceneAction,
  onPoliceAction,
  onCivilAction,
  onDisposition,
  onHospital,
  onNotify,
}: {
  enabled: boolean;
  started: boolean;
  paused: boolean;
  units: Unit[];
  incidents: Incident[];
  bases: CityBase[];
  setIncidents: SetIncidents;
} & AIHandlers) {
  const handledRef = useRef<Set<string>>(new Set());
  const timersRef = useRef<number[]>([]);
  const notifiedReturnRef = useRef<Set<string>>(new Set());
  const handlersRef = useRef<AIHandlers>({
    onSceneAction,
    onPoliceAction,
    onCivilAction,
    onDisposition,
    onHospital,
    onNotify,
  });
  handlersRef.current = {
    onSceneAction,
    onPoliceAction,
    onCivilAction,
    onDisposition,
    onHospital,
    onNotify,
  };

  const notify = (event: AiOpsEvent) => {
    handlersRef.current.onNotify?.(event);
  };

  useEffect(() => {
    return () => {
      for (const t of timersRef.current) window.clearTimeout(t);
      timersRef.current = [];
    };
  }, []);

  // Avisa o operador quando a unidade começa a voltar ou conduzir preso
  useEffect(() => {
    if (!enabled || !started) return;
    for (const unit of units) {
      if (unit.status === 'retornando') {
        const key = `ret:${unit.id}:${unit.routeStartedAt ?? 'x'}`;
        if (notifiedReturnRef.current.has(key)) continue;
        notifiedReturnRef.current.add(key);
        notify(
          makeAiOpsEvent({
            kind: 'retorno_base',
            unitId: unit.id,
            unitLabel: unit.label,
            unitType: unit.type,
            message: formatReturnMessage(unit.label, unit.type, false),
            detail:
              unit.type === 'bombeiro' || unit.type === 'ambulancia'
                ? 'Corpo de Bombeiros — QAP na base após atendimento.'
                : 'Polícia Militar — retornando ao batalhão / sede.',
            important: true,
          })
        );
      }
      if (unit.status === 'levando_preso') {
        const key = `preso:${unit.id}:${unit.routeStartedAt ?? 'x'}`;
        if (notifiedReturnRef.current.has(key)) continue;
        notifiedReturnRef.current.add(key);
        notify(
          makeAiOpsEvent({
            kind: 'conduzindo_preso',
            unitId: unit.id,
            unitLabel: unit.label,
            unitType: unit.type,
            message: formatReturnMessage(unit.label, unit.type, true),
            detail: 'Polícia Militar — deslocamento à autoridade policial (delegacia).',
            important: true,
          })
        );
      }
    }
    if (notifiedReturnRef.current.size > 120) notifiedReturnRef.current.clear();
  }, [units, enabled, started]);

  useEffect(() => {
    if (!enabled || !started || paused) return;

    const now = Date.now();
    const h = () => handlersRef.current;
    const schedule = (fn: () => void, ms: number) => {
      const id = window.setTimeout(fn, ms);
      timersRef.current.push(id);
    };

    for (const unit of units) {
      const busy = !!(unit.serviceEndsAt && unit.serviceEndsAt > now);
      const hasQueue = (unit.actionQueue?.length ?? 0) > 0;
      const finalDecision =
        unit.pendingDecision === 'hospital' ||
        unit.pendingDecision === 'policia' ||
        unit.pendingDecision === 'civil' ||
        unit.pendingDecision === 'disposicao';

      // Unidade no local sem tarefa: principal (chegada) OU apoio parado
      const onSceneIdle =
        !!unit.assignedIncidentId &&
        !busy &&
        !hasQueue &&
        !finalDecision &&
        (unit.status === 'no_local' || unit.status === 'aguardando_decisao') &&
        (unit.pendingDecision === 'chegada' ||
          unit.pendingDecision === 'acoes_local' ||
          unit.pendingDecision === undefined ||
          unit.mission === 'apoio_ocorrencia' ||
          (unit.pendingIncidentTitle?.includes('Apoio') ?? false));

      // ─── Plano + execução (principal e APOIO) ───
      if (onSceneIdle && unit.assignedIncidentId) {
        const incident = incidents.find((i) => i.id === unit.assignedIncidentId);
        if (!incident) continue;
        // se já concluiu tarefas e tem outcome, deixa o bloco idle fechar o ciclo
        const alreadyWorked =
          !!unit.serviceRole ||
          (incident.outcomes?.length ?? 0) > 0 ||
          (unit.pendingIncidentTitle?.includes('Tarefa conclu') ?? false);
        // acoes_local com trabalho já feito → não re-planeja, vai pro idle/finish
        if (alreadyWorked && unit.pendingDecision !== 'chegada') {
          // cai no idle abaixo
        } else if (!alreadyWorked || unit.pendingDecision === 'chegada') {
          const isSupport =
            unit.mission === 'apoio_ocorrencia' ||
            (incident.assignedUnitId !== undefined && incident.assignedUnitId !== unit.id) ||
            (unit.pendingIncidentTitle?.includes('Apoio') ?? false);

          // chave por estado: re-tenta se ficou travado em chegada
          const key = `plan:${unit.id}:${incident.id}:${isSupport ? 'apoio' : 'main'}:${unit.pendingDecision ?? 'none'}`;
          if (!handledRef.current.has(key)) {
            handledRef.current.add(key);

            const plan = planTacticalResponse(incident, unit, units, bases);
            let actions = plan.actions.filter((a) => a.effect !== 'apurar_fatos');
            // apoio: plano curto (1–2 ações), sem B.O./flagrante duplicado
            if (isSupport) {
              actions = actions
                .filter(
                  (a) =>
                    a.effect !== 'flagrante' &&
                    a.effect !== 'bo_local' &&
                    a.effect !== 'resolve_light' &&
                    a.id !== 'nada_consta' &&
                    a.id !== 'sem_risco'
                )
                .slice(0, unit.type === 'bombeiro' || unit.type === 'ambulancia' ? 2 : 2);
            }
            if (actions.length === 0) {
              if (unit.type === 'bombeiro' || unit.type === 'ambulancia') {
                actions.push({
                  id: 'suporte_bm',
                  title: isSupport ? 'Apoiar equipes no local' : 'Assumir atendimento APH/salvamento',
                  description: 'Função automática de bombeiros no local',
                  effect: 'fire_role',
                  fireRole: unit.type === 'ambulancia' ? 'aph' : 'suporte',
                  category: 'socorro',
                });
              } else {
                actions.push({
                  id: isSupport ? 'dividir_funcoes' : 'atender',
                  title: isSupport ? 'Integrar perímetro e apoiar guarnição' : 'Iniciar atendimento no local',
                  description: isSupport
                    ? 'Apoio ostensivo — perímetro e contenção'
                    : 'Protocolo automático da guarnição',
                  effect: 'start_service',
                  category: 'tatica',
                });
              }
            }

            setIncidents((prev) =>
              prev.map((i) => {
                if (i.id !== incident.id) return i;
                const log = [
                  ...(i.log ?? []),
                  makeLogEntry(radioOnScene(unit, i), 'sistema'),
                  makeLogEntry(
                    `${aiRadioCall(unit, i, isSupport ? 'apoio autônomo' : 'autonomia')} — ${Math.round(plan.confidence * 100)}%`,
                    'sistema'
                  ),
                  makeLogEntry(
                    `${isSupport ? 'APOIO' : 'PRINCIPAL'} POP: ${actions.map((p) => p.title).join(' → ')}`,
                    'acao'
                  ),
                ].slice(-40);
                return { ...i, log };
              })
            );

            // garante pendingDecision para o motor de serviço
            // (start_service usa assignedIncidentId)

            notify(
              makeAiOpsEvent({
                kind: 'chegada',
                unitId: unit.id,
                unitLabel: unit.label,
                unitType: unit.type,
                incidentTitle: incident.title,
                message: isSupport
                  ? `${unit.label} (APOIO) chegou no local e entra em ação sem o COPOM decidir.`
                  : `${unit.label} chegou no local e assume a ocorrência sem intervenção do COPOM.`,
                detail: `Plano: ${actions.map((a) => a.title).join(' → ')}`,
              })
            );

            notify(
              makeAiOpsEvent({
                kind: 'plano',
                unitId: unit.id,
                unitLabel: unit.label,
                unitType: unit.type,
                incidentTitle: incident.title,
                message: isSupport
                  ? `Plano de apoio (${actions.length} etapas)`
                  : `Plano tático (${actions.length} etapas)`,
                detail: actions.map((a, i) => `${i + 1}. ${a.title}`).join(' · '),
              })
            );

            const [first, ...rest] = actions;
            if (first) {
              schedule(() => {
                notify(
                  makeAiOpsEvent({
                    kind: 'acao',
                    unitId: unit.id,
                    unitLabel: unit.label,
                    unitType: unit.type,
                    incidentTitle: incident.title,
                    message: `Em execução: ${first.title}`,
                    detail: first.description,
                  })
                );
                h().onSceneAction(unit.id, first);
                rest.forEach((action, idx) => {
                  schedule(() => {
                    notify(
                      makeAiOpsEvent({
                        kind: 'acao',
                        unitId: unit.id,
                        unitLabel: unit.label,
                        unitType: unit.type,
                        incidentTitle: incident.title,
                        message: `Próxima ação: ${action.title}`,
                        detail: action.description,
                      })
                    );
                    h().onSceneAction(unit.id, action);
                  }, 220 + idx * 160);
                });
              }, 280 + Math.random() * 220);
            }
            continue;
          }
        }
      }

      // ─── Tarefa em andamento: avisa status ───
      if (
        unit.serviceEndsAt &&
        unit.serviceEndsAt > now &&
        unit.assignedIncidentId &&
        unit.serviceRoleLabel
      ) {
        const key = `svc:${unit.id}:${unit.serviceEndsAt}`;
        if (!handledRef.current.has(key)) {
          handledRef.current.add(key);
          const incident = incidents.find((i) => i.id === unit.assignedIncidentId);
          notify(
            makeAiOpsEvent({
              kind: 'acao',
              unitId: unit.id,
              unitLabel: unit.label,
              unitType: unit.type,
              incidentTitle: incident?.title,
              message: `${unit.label} no local: ${unit.serviceRoleLabel}`,
              detail: unit.pendingIncidentTitle,
            })
          );
        }
      }

      // ─── Idle no local: fecha ciclo sozinha (principal e APOIO) ───
      if (
        unit.assignedIncidentId &&
        !busy &&
        !hasQueue &&
        (unit.pendingDecision === 'acoes_local' ||
          unit.pendingDecision === undefined ||
          unit.pendingDecision === 'chegada')
      ) {
        const incident = incidents.find((i) => i.id === unit.assignedIncidentId);
        if (!incident) continue;

        const isSupport =
          unit.mission === 'apoio_ocorrencia' ||
          (incident.assignedUnitId !== undefined && incident.assignedUnitId !== unit.id);

        const hasWork =
          !!unit.serviceRole ||
          (incident.outcomes?.length ?? 0) > 0 ||
          (incident.log ?? []).some((l) => l.kind === 'resultado') ||
          (unit.pendingIncidentTitle?.includes('Tarefa conclu') ?? false);

        // ainda não trabalhou → o bloco de plano trata
        if (!hasWork && unit.pendingDecision === 'chegada') continue;
        if (!hasWork && !isSupport) continue;

        const title = unit.pendingIncidentTitle ?? '';
        if (title.includes('Apurando') || title.includes('Iniciando') || title.includes('Fila:')) continue;
        // se ainda em chegada sem serviço, não encerra
        if (unit.pendingDecision === 'chegada' && !hasWork) continue;

        const key = `idle:${unit.id}:${incident.id}:${incident.outcomes?.length ?? 0}:${unit.serviceRole ?? 'x'}`;
        if (handledRef.current.has(key)) continue;
        handledRef.current.add(key);

        // APOIO: após sua tarefa, só volta à base (não decide flagrante da ocorrência)
        if (isSupport) {
          schedule(() => {
            notify(
              makeAiOpsEvent({
                kind: 'resultado',
                unitId: unit.id,
                unitLabel: unit.label,
                unitType: unit.type,
                incidentTitle: incident.title,
                message: `${unit.label} (APOIO) concluiu a função no local.`,
                detail: 'Liberando guarnição de apoio — retorno à base.',
              })
            );
            // só principal decide hospital/prisão; apoio retorna
            h().onDisposition(unit.id, 'retornar');
          }, 500);
          continue;
        }

        const needHospital =
          incident.type === 'samu' ||
          unit.type === 'bombeiro' ||
          unit.type === 'ambulancia' ||
          (incident.victimCount ?? 0) > 0 ||
          (incident.outcomes ?? []).some((o) => /hospital|vítima|vitima|aph|médic|medic|estabiliz/i.test(o));

        const policeLike =
          unit.type === 'viatura' &&
          (incident.type === 'policia' ||
            (incident.outcomes ?? []).some((o) => /flagrante|condu|preso|b\.o\.|bo-|ilicito|ilícito/i.test(o)));

        schedule(() => {
          notify(
            makeAiOpsEvent({
              kind: 'resultado',
              unitId: unit.id,
              unitLabel: unit.label,
              unitType: unit.type,
              incidentTitle: incident.title,
              message: `${unit.label} concluiu as ações no local. Encaminhando providências finais…`,
            })
          );

          if (needHospital && (unit.type === 'bombeiro' || unit.type === 'ambulancia' || !policeLike)) {
            const hid = planHospitalId(unit, bases);
            if (hid) {
              notify(
                makeAiOpsEvent({
                  kind: 'hospital',
                  unitId: unit.id,
                  unitLabel: unit.label,
                  unitType: unit.type,
                  incidentTitle: incident.title,
                  message: `${unit.label} está removendo vítima para hospital / UAI.`,
                  important: true,
                })
              );
              h().onHospital(unit.id, hid);
            } else {
              h().onDisposition(unit.id, 'retornar');
            }
            return;
          }
          if (policeLike) {
            const pick = planPoliceDecision(incident, unit);
            h().onPoliceAction(unit.id, pick);
            return;
          }
          if (needHospital) {
            const hid = planHospitalId(unit, bases);
            if (hid) {
              notify(
                makeAiOpsEvent({
                  kind: 'hospital',
                  unitId: unit.id,
                  unitLabel: unit.label,
                  unitType: unit.type,
                  incidentTitle: incident.title,
                  message: `${unit.label} encaminha vítima a unidade de saúde.`,
                  important: true,
                })
              );
              h().onHospital(unit.id, hid);
            } else h().onDisposition(unit.id, 'retornar');
            return;
          }
          h().onDisposition(unit.id, planDisposition(incident, unit));
        }, 600);
        continue;
      }

      // ─── Decisões formais ───
      if (unit.pendingDecision === 'policia' && unit.assignedIncidentId) {
        const incident = incidents.find((i) => i.id === unit.assignedIncidentId);
        if (!incident) continue;
        const key = `pol:${unit.id}:${incident.id}`;
        if (handledRef.current.has(key)) continue;
        handledRef.current.add(key);
        const pick = planPoliceDecision(incident, unit);
        schedule(() => {
          setIncidents((prev) =>
            prev.map((i) =>
              i.id === incident.id
                ? {
                    ...i,
                    log: [
                      ...(i.log ?? []),
                      makeLogEntry(aiRadioCall(unit, i, `decisão policial → ${pick}`), 'resultado'),
                    ].slice(-40),
                  }
                : i
            )
          );
          if (pick === 'delegacia') {
            notify(
              makeAiOpsEvent({
                kind: 'conduzindo_preso',
                unitId: unit.id,
                unitLabel: unit.label,
                unitType: unit.type,
                incidentTitle: incident.title,
                message: `${unit.label} (PM) adotou flagrante/condução — deslocando à delegacia.`,
                important: true,
              })
            );
          } else if (pick === 'hospital') {
            notify(
              makeAiOpsEvent({
                kind: 'hospital',
                unitId: unit.id,
                unitLabel: unit.label,
                unitType: unit.type,
                incidentTitle: incident.title,
                message: `${unit.label} vai encaminhar envolvido/vítima a hospital.`,
              })
            );
          } else {
            notify(
              makeAiOpsEvent({
                kind: 'resultado',
                unitId: unit.id,
                unitLabel: unit.label,
                unitType: unit.type,
                incidentTitle: incident.title,
                message: `${unit.label} encerrou no local (${pick === 'liberar' ? 'liberação' : 'B.O./providências'}) e retorna à base.`,
              })
            );
          }
          h().onPoliceAction(unit.id, pick);
        }, 400);
        continue;
      }

      if (unit.pendingDecision === 'hospital') {
        const key = `hosp:${unit.id}:${unit.assignedIncidentId ?? 'x'}`;
        if (handledRef.current.has(key)) continue;
        handledRef.current.add(key);
        const hid = planHospitalId(unit, bases);
        schedule(() => {
          if (hid) h().onHospital(unit.id, hid);
          else h().onDisposition(unit.id, 'retornar');
        }, 350);
        continue;
      }

      if (unit.pendingDecision === 'civil' && unit.assignedIncidentId) {
        const incident = incidents.find((i) => i.id === unit.assignedIncidentId);
        if (!incident) continue;
        const key = `civil:${unit.id}:${incident.id}`;
        if (handledRef.current.has(key)) continue;
        handledRef.current.add(key);
        const pick = planCivilDecision(incident);
        schedule(() => h().onCivilAction(unit.id, pick), 400);
        continue;
      }

      if (unit.pendingDecision === 'disposicao') {
        const key = `disp:${unit.id}:${unit.pendingIncidentTitle ?? unit.id}`;
        if (handledRef.current.has(key)) continue;
        handledRef.current.add(key);
        const incident = unit.assignedIncidentId
          ? incidents.find((i) => i.id === unit.assignedIncidentId)
          : undefined;
        schedule(() => {
          if (incident) {
            setIncidents((prev) =>
              prev.map((i) =>
                i.id === incident.id
                  ? {
                      ...i,
                      log: [
                        ...(i.log ?? []),
                        makeLogEntry(radioClosing(i, 'retorno à base / QAP'), 'resultado'),
                      ].slice(-40),
                    }
                  : i
              )
            );
          }
          // sempre retornar à base no modo IA (sem pedir destino ao operador)
          h().onDisposition(unit.id, 'retornar');
        }, 320);
      }
    }

    if (handledRef.current.size > 280) {
      handledRef.current.clear();
    }
  }, [enabled, started, paused, units, incidents, bases, setIncidents]);
}

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
      // ─── Chegada: plano + execução autônoma ───
      if (unit.pendingDecision === 'chegada' && unit.assignedIncidentId) {
        const incident = incidents.find((i) => i.id === unit.assignedIncidentId);
        if (!incident) continue;
        const key = `plan:${unit.id}:${incident.id}`;
        if (handledRef.current.has(key)) continue;
        if (unit.serviceEndsAt && unit.serviceEndsAt > now) continue;
        if ((unit.actionQueue?.length ?? 0) > 0) continue;

        handledRef.current.add(key);
        const plan = planTacticalResponse(incident, unit, units, bases);
        const actions = plan.actions.filter((a) => a.effect !== 'apurar_fatos');
        if (actions.length === 0) {
          const fallback = plan.actions.find((a) => a.effect !== 'apurar_fatos');
          if (fallback) actions.push(fallback);
        }
        // garante pelo menos atendimento padrão
        if (actions.length === 0) {
          actions.push({
            id: 'atender',
            title: 'Iniciar atendimento no local',
            description: 'Protocolo automático da guarnição',
            effect: 'start_service',
            category: 'tatica',
          });
        }

        setIncidents((prev) =>
          prev.map((i) => {
            if (i.id !== incident.id) return i;
            const log = [
              ...(i.log ?? []),
              makeLogEntry(radioOnScene(unit, i), 'sistema'),
              makeLogEntry(
                `${aiRadioCall(unit, i, 'autonomia')} — confiança ${Math.round(plan.confidence * 100)}%`,
                'sistema'
              ),
              makeLogEntry(`POP: ${actions.map((p) => p.title).join(' → ')}`, 'acao'),
            ].slice(-40);
            return { ...i, log };
          })
        );

        notify(
          makeAiOpsEvent({
            kind: 'chegada',
            unitId: unit.id,
            unitLabel: unit.label,
            unitType: unit.type,
            incidentTitle: incident.title,
            message: `${unit.label} chegou no local e assume a ocorrência sem intervenção do COPOM.`,
            detail: `Confiança da IA: ${Math.round(plan.confidence * 100)}%`,
          })
        );

        notify(
          makeAiOpsEvent({
            kind: 'plano',
            unitId: unit.id,
            unitLabel: unit.label,
            unitType: unit.type,
            incidentTitle: incident.title,
            message: `Plano tático (${actions.length} etapas)`,
            detail: actions.map((a, i) => `${i + 1}. ${a.title}`).join(' · '),
          })
        );

        const [first, ...rest] = actions;
        if (!first) continue;

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
        }, 350 + Math.random() * 250);

        continue;
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

      // ─── Idle no local: fecha ciclo sozinha ───
      if (
        unit.pendingDecision === 'acoes_local' &&
        unit.assignedIncidentId &&
        !(unit.serviceEndsAt && unit.serviceEndsAt > now) &&
        (unit.actionQueue?.length ?? 0) === 0
      ) {
        const incident = incidents.find((i) => i.id === unit.assignedIncidentId);
        if (!incident) continue;
        const hasWork =
          (incident.outcomes?.length ?? 0) > 0 ||
          (incident.log ?? []).some((l) => l.kind === 'resultado' || l.kind === 'acao');
        if (!hasWork) continue;

        const title = unit.pendingIncidentTitle ?? '';
        if (title.includes('Apurando') || title.includes('Iniciando') || title.includes('Fila:')) continue;

        const key = `idle:${unit.id}:${incident.id}:${incident.outcomes?.length ?? 0}`;
        if (handledRef.current.has(key)) continue;
        handledRef.current.add(key);

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

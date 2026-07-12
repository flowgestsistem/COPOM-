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

type SetIncidents = (updater: (prev: Incident[]) => Incident[]) => void;

type AIHandlers = {
  onSceneAction: (unitId: string, action: SceneAction) => void;
  onPoliceAction: (unitId: string, action: PoliceDecisionAction) => void;
  onCivilAction: (unitId: string, action: CivilDecisionAction) => void;
  onDisposition: (unitId: string, action: DispositionAction) => void;
  onHospital: (unitId: string, hospitalBaseId: string) => void;
};

/**
 * IA autônoma da corporação:
 * - ao chegar no local, monta plano tático e executa ações
 * - após tarefas, resolve hospital / delegacia / disposição sozinha
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
}: {
  enabled: boolean;
  started: boolean;
  paused: boolean;
  units: Unit[];
  incidents: Incident[];
  bases: CityBase[];
  setIncidents: SetIncidents;
} & AIHandlers) {
  /** Evita reprocessar o mesmo “estado” da unidade. */
  const handledRef = useRef<Set<string>>(new Set());
  const timersRef = useRef<number[]>([]);
  const handlersRef = useRef<AIHandlers>({
    onSceneAction,
    onPoliceAction,
    onCivilAction,
    onDisposition,
    onHospital,
  });
  handlersRef.current = {
    onSceneAction,
    onPoliceAction,
    onCivilAction,
    onDisposition,
    onHospital,
  };

  useEffect(() => {
    return () => {
      for (const t of timersRef.current) window.clearTimeout(t);
      timersRef.current = [];
    };
  }, []);

  useEffect(() => {
    if (!enabled || !started || paused) return;

    const now = Date.now();
    const h = () => handlersRef.current;
    const schedule = (fn: () => void, ms: number) => {
      const id = window.setTimeout(fn, ms);
      timersRef.current.push(id);
    };

    for (const unit of units) {
      // ─── Chegada: planejar e executar ───
      if (unit.pendingDecision === 'chegada' && unit.assignedIncidentId) {
        const incident = incidents.find((i) => i.id === unit.assignedIncidentId);
        if (!incident) continue;
        const key = `plan:${unit.id}:${incident.id}`;
        if (handledRef.current.has(key)) continue;
        if (unit.serviceEndsAt && unit.serviceEndsAt > now) continue;
        if ((unit.actionQueue?.length ?? 0) > 0) continue;

        handledRef.current.add(key);
        const plan = planTacticalResponse(incident, unit, units, bases);
        // modo autônomo: pula diálogo interativo (apuração manual fica para o operador)
        const actions = plan.actions.filter((a) => a.effect !== 'apurar_fatos');
        if (actions.length === 0 && plan.actions[0]) {
          // se só tinha apuração, usa a 2ª melhor via re-plan sem filtro — pega start_service
          const fallback = plan.actions.find((a) => a.effect !== 'apurar_fatos');
          if (fallback) actions.push(fallback);
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
              makeLogEntry(plan.rationale, 'acao'),
              makeLogEntry(
                actions.length
                  ? `Executando POP: ${actions.map((p) => p.title).join(' → ')}`
                  : 'Sem ações elegíveis — reavaliar',
                'acao'
              ),
            ].slice(-40);
            return { ...i, log };
          })
        );

        const [first, ...rest] = actions;
        if (!first) continue;

        schedule(() => {
          h().onSceneAction(unit.id, first);
          rest.forEach((action, idx) => {
            schedule(() => {
              h().onSceneAction(unit.id, action);
            }, 200 + idx * 140);
          });
        }, 320 + Math.random() * 280);

        continue;
      }

      // ─── Idle no local: fechar ciclo após ações ───
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
          (incident.log ?? []).some((l) => l.kind === 'resultado');
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
          if (needHospital && (unit.type === 'bombeiro' || unit.type === 'ambulancia' || !policeLike)) {
            const hid = planHospitalId(unit, bases);
            if (hid) h().onHospital(unit.id, hid);
            else h().onDisposition(unit.id, 'retornar');
            return;
          }
          if (policeLike) {
            h().onPoliceAction(unit.id, planPoliceDecision(incident, unit));
            return;
          }
          if (needHospital) {
            const hid = planHospitalId(unit, bases);
            if (hid) h().onHospital(unit.id, hid);
            else h().onDisposition(unit.id, 'retornar');
            return;
          }
          h().onDisposition(unit.id, planDisposition(incident, unit));
        }, 500);
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
          h().onDisposition(unit.id, incident ? planDisposition(incident, unit) : 'retornar');
        }, 320);
      }
    }

    if (handledRef.current.size > 280) {
      handledRef.current.clear();
    }
  }, [enabled, started, paused, units, incidents, bases, setIncidents]);
}

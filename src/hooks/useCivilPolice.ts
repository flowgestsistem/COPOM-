import { useEffect, useRef } from 'react';
import type { CityBase } from '../types/city';
import type { CivilCase, Incident, Unit } from '../types/game';
import {
  createCivilCase,
  isCivilPoliceUnit,
  nearestFreeCivilUnit,
  nextBoNumber,
} from '../lib/civilPolice';
import { fetchRoute, straightLineFallback } from '../lib/osrm';
import { applyEnRoute, applyRoute } from '../lib/unitMissions';
import { playDecisionBeep, playDispatchRadio } from '../lib/sound';

type SetUnits = (updater: (prev: Unit[]) => Unit[]) => void;
type SetIncidents = (updater: (prev: Incident[]) => Incident[]) => void;
type SetCases = (updater: (prev: CivilCase[]) => CivilCase[]) => void;

const INVESTIGATION_MS = 35_000;

/**
 * - Abre caso PC quando ocorrência exige investigação
 * - Auto-despacha viatura da PC (ou aguarda se ocupada)
 * - Chegada → investigação → bip para decisão do operador
 */
export function useCivilPolice(
  units: Unit[],
  setUnits: SetUnits,
  incidents: Incident[],
  setIncidents: SetIncidents,
  civilCases: CivilCase[],
  setCivilCases: SetCases,
  bases: CityBase[],
  enabled: boolean
) {
  const dispatching = useRef<Set<string>>(new Set());
  const investigating = useRef<Set<string>>(new Set());

  // 1) Abrir caso quando PM inicia atendimento em ocorrência que exige PC
  useEffect(() => {
    if (!enabled) return;

    for (const incident of incidents) {
      if (!incident.requiresCivilPolice) continue;
      if (incident.civilCaseId) continue;
      if (incident.status !== 'em_atendimento' && incident.status !== 'despachado') continue;

      const civilCase = createCivilCase(incident);
      setCivilCases((prev) => [civilCase, ...prev].slice(0, 80));
      setIncidents((prev) =>
        prev.map((i) => (i.id === incident.id ? { ...i, civilCaseId: civilCase.id } : i))
      );
    }
  }, [enabled, incidents, setCivilCases, setIncidents]);

  // 2) Auto-despacho PC quando há caso aguardando e unidade livre
  useEffect(() => {
    if (!enabled) return;

    const pending = civilCases.filter((c) => c.status === 'aguardando_viatura' && !c.unitId);
    for (const civilCase of pending) {
      if (dispatching.current.has(civilCase.id)) continue;

      const incident = incidents.find((i) => i.id === civilCase.incidentId);
      if (!incident || incident.status === 'resolvido') continue;

      const free = nearestFreeCivilUnit(units, bases, civilCase.location);
      if (!free) continue;

      dispatching.current.add(civilCase.id);
      playDispatchRadio();

      setCivilCases((prev) =>
        prev.map((c) =>
          c.id === civilCase.id
            ? {
                ...c,
                status: 'a_caminho',
                unitId: free.id,
                unitLabel: free.label,
                updatedAt: Date.now(),
                notes: [...c.notes, `${free.label} despachada automaticamente para o local.`],
              }
            : c
        )
      );
      setIncidents((prev) =>
        prev.map((i) =>
          i.id === civilCase.incidentId
            ? { ...i, civilUnitId: free.id, status: i.status === 'aguardando_pc' ? 'aguardando_pc' : i.status }
            : i
        )
      );

      const from = free.position;
      const to = civilCase.location;
      setUnits((prev) =>
        prev.map((u) =>
          u.id === free.id
            ? applyEnRoute(u, {
                mission: 'apoio_ocorrencia',
                responseCode: 2,
                assignedIncidentId: civilCase.incidentId,
              })
            : u
        )
      );

      fetchRoute(from, to)
        .catch(() => straightLineFallback(from, to))
        .then((route) => {
          setUnits((prev) =>
            prev.map((u) => (u.id === free.id ? applyRoute(u, route) : u))
          );
        })
        .finally(() => {
          dispatching.current.delete(civilCase.id);
        });
    }
  }, [enabled, civilCases, units, incidents, bases, setCivilCases, setIncidents, setUnits]);

  // (cenário aguardando_pc já é definido no useIncidentLifecycle quando exige PC)

  // 4) PC chega no local → investigação
  useEffect(() => {
    if (!enabled) return;
    const now = Date.now();

    for (const unit of units) {
      if (unit.status !== 'no_local' || !unit.assignedIncidentId) continue;
      if (!isCivilPoliceUnit(unit, bases)) continue;

      const civilCase = civilCases.find(
        (c) => c.unitId === unit.id && (c.status === 'a_caminho' || c.status === 'no_local')
      );
      if (!civilCase) continue;
      if (investigating.current.has(civilCase.id)) continue;

      investigating.current.add(civilCase.id);

      setCivilCases((prev) =>
        prev.map((c) =>
          c.id === civilCase.id
            ? {
                ...c,
                status: 'em_investigacao',
                updatedAt: now,
                notes: [...c.notes, 'Viatura PC no local — investigação iniciada.'],
              }
            : c
        )
      );
      setIncidents((prev) =>
        prev.map((i) =>
          i.id === civilCase.incidentId
            ? { ...i, status: 'investigacao_pc', resolvesAt: now + INVESTIGATION_MS }
            : i
        )
      );
    }
  }, [enabled, units, civilCases, bases, setCivilCases, setIncidents]);

  // 5) Fim da investigação → BO + decisão
  useEffect(() => {
    if (!enabled) return;
    const now = Date.now();

    for (const incident of incidents) {
      if (incident.status !== 'investigacao_pc') continue;
      if (!incident.resolvesAt || incident.resolvesAt > now) continue;
      if (!incident.civilCaseId) continue;

      const civilCase = civilCases.find((c) => c.id === incident.civilCaseId);
      if (!civilCase || civilCase.status === 'concluido') continue;

      const bo = civilCase.boNumber ?? nextBoNumber();
      playDecisionBeep();

      setCivilCases((prev) =>
        prev.map((c) =>
          c.id === civilCase.id
            ? {
                ...c,
                status: 'bo_em_andamento',
                boNumber: bo,
                evidenceCollected: true,
                updatedAt: now,
                notes: [
                  ...c.notes,
                  `Coleta de provas concluída.`,
                  `B.O. ${bo} registrado — aguardando decisão do operador.`,
                ],
              }
            : c
        )
      );

      setIncidents((prev) =>
        prev.map((i) => (i.id === incident.id ? { ...i, status: 'aguardando_decisao' } : i))
      );

      // PC e PM no local pedem decisão
      setUnits((prev) =>
        prev.map((u) =>
          u.assignedIncidentId === incident.id &&
          (u.status === 'no_local' || u.status === 'em_operacao' || u.status === 'aguardando_decisao')
            ? {
                ...u,
                status: 'aguardando_decisao',
                pendingDecision: isCivilPoliceUnit(u, bases) ? 'civil' : 'disposicao',
                pendingIncidentTitle: incident.title,
              }
            : u
        )
      );

      investigating.current.delete(civilCase.id);
    }
  }, [enabled, incidents, civilCases, bases, setCivilCases, setIncidents, setUnits]);
}

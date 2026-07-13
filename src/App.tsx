import { useCallback, useEffect, useRef, useState } from 'react';
import { CityMap } from './components/CityMap';
import { DispatchPanel } from './components/DispatchPanel';
import { OperationsPanel } from './components/OperationsPanel';
import { BaseRosterPanel } from './components/BaseRosterPanel';
import { IncidentAlertBanner } from './components/IncidentAlertBanner';
import { RingingOverlay } from './components/RingingOverlay';
import { StartScreen } from './components/StartScreen';
import { UnitActionMenu, type UnitActionId } from './components/UnitActionMenu';
import { BasePickerSheet } from './components/BasePickerSheet';
import { SupportCodeSheet } from './components/SupportCodeSheet';
import { MapPickBanner } from './components/MapPickBanner';
import {
  UnitDecisionSheet,
  type CivilDecisionAction,
  type DispositionAction,
  type PoliceDecisionAction,
} from './components/UnitDecisionSheet';
import type { SceneAction } from './lib/sceneActions';
import { actionDurationMs, makeLogEntry } from './lib/incidentRealism';
import { useTacticalAI } from './hooks/useTacticalAI';
import { radioDispatch } from './lib/policeProtocol';
import { AiOpsFeed } from './components/AiOpsFeed';
import type { AiOpsEvent } from './lib/aiOpsFeed';
import {
  createInterviewSession,
  type InterviewSession,
  type PostInterviewActionId,
} from './lib/sceneInterview';
import { SceneInterviewPanel } from './components/SceneInterviewPanel';
import { IncidentDashboard } from './components/IncidentDashboard';
import { UnitDetailPanel } from './components/UnitDetailPanel';
import { CivilPolicePanel, type CivilPoliceTab } from './components/CivilPolicePanel';
import { CITY_BASES } from './data/bases';
import { CITY_STREETS } from './data/streets';
import type { CityBase } from './types/city';
import { useIncidentFeed } from './hooks/useIncidentFeed';
import { useIncidentAlerts } from './hooks/useIncidentAlerts';
import { startIncidentService, useIncidentLifecycle } from './hooks/useIncidentLifecycle';
import { useOperationLifecycle } from './hooks/useOperationLifecycle';
import { usePatrolEvents } from './hooks/usePatrolEvents';
import { useReturnToBase } from './hooks/useReturnToBase';
import { useUnitMovement } from './hooks/useUnitMovement';
import { useCivilPolice } from './hooks/useCivilPolice';
import { useAutoPatrol } from './hooks/useAutoPatrol';
import { useCityTraffic } from './hooks/useCityTraffic';
import { basesToUnits } from './lib/units';
import { fetchRoute, straightLineFallback } from './lib/osrm';
import { fetchPatrolLoop, spreadPatrolAssignments } from './lib/patrolRoute';
import {
  isRadioPatrolUnit,
  playDispatchRadio,
  playRadioPatrolDispatch,
  stopAllSirens,
  stopRinging,
} from './lib/sound';
import {
  draftFromPreset,
  isPatrolOperationType,
  type OperationDraft,
  type OperationPreset,
} from './lib/operations';
import { LABEL_BY_OPERATION_TYPE } from './lib/labels';
import { UNIT_TYPE_FOR_INCIDENT } from './lib/dispatch';
import { findNearestDelegacia } from './lib/delegacia';
import { isCivilPoliceUnit } from './lib/civilPolice';
import {
  applyEnRoute,
  applyRoute,
  STRATEGIC_POINT_DURATION_MS,
  UNIT_PATROL_DURATION_MS,
  UNIT_PATROL_RADIUS_M,
} from './lib/unitMissions';
import type { CivilCase, LatLng, Operation, PatrolEvent, ResponseCode, Unit } from './types/game';
import './App.css';

type MapPickMode =
  | null
  | { kind: 'deslocar'; unitId: string }
  | { kind: 'ponto_estrategico'; unitId: string }
  | { kind: 'apoio_ocorrencia'; unitId: string };

type OverlayMode =
  | null
  | { kind: 'unit_menu'; unitId: string }
  | { kind: 'unit_detail'; unitId: string }
  | { kind: 'realocar'; unitId: string }
  | { kind: 'support_code'; unitId: string; incidentId: string }
  | { kind: 'unit_decision'; unitId: string }
  | { kind: 'incident_dash'; incidentId: string }
  | { kind: 'scene_interview'; unitId: string; incidentId: string };

function App() {
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [units, setUnits] = useState<Unit[]>(() => basesToUnits(CITY_BASES));
  const [score, setScore] = useState(0);
  const { incidents, setIncidents } = useIncidentFeed(CITY_STREETS, started && !paused);
  const { ringingIncident, currentAlert, blinkingIds, ringSecondsLeft, answerCall, dismissAlert } =
    useIncidentAlerts(incidents, started);

  const [operations, setOperations] = useState<Operation[]>([]);
  const [draft, setDraft] = useState<OperationDraft | null>(null);
  const [picking, setPicking] = useState(false);
  const [patrolEvents, setPatrolEvents] = useState<PatrolEvent[]>([]);
  const [selectedBaseId, setSelectedBaseId] = useState<string | null>(null);
  const [mapPick, setMapPick] = useState<MapPickMode>(null);
  const [overlay, setOverlay] = useState<OverlayMode>(null);
  const [focusLocation, setFocusLocation] = useState<LatLng | null>(null);
  /** Câmera segue esta unidade no mapa (null = desligado). */
  const [followUnitId, setFollowUnitId] = useState<string | null>(null);
  const [civilCases, setCivilCases] = useState<CivilCase[]>([]);
  const [leftTab, setLeftTab] = useState<'ocorrencias' | 'civil'>('ocorrencias');
  const [civilTab, setCivilTab] = useState<CivilPoliceTab>('todos');
  /** Mobile: qual painel está em foco (mapa = tela principal). */
  const [mobileView, setMobileView] = useState<'mapa' | 'ocorrencias' | 'operacoes'>('mapa');
  /** Sessões de apuração no local (diálogo com vítima/testemunha). */
  const [interviewSessions, setInterviewSessions] = useState<Record<string, InterviewSession>>({});
  /**
   * IA tática da corporação: guarnições atuam sozinhas no local
   * (ações, hospital, delegacia, retorno à base).
   */
  const [aiAutonomous, setAiAutonomous] = useState(true);
  const aiAutonomousRef = useRef(true);
  aiAutonomousRef.current = aiAutonomous;
  /** Feed de ações da IA no local (operador só acompanha). */
  const [aiOpsEvents, setAiOpsEvents] = useState<AiOpsEvent[]>([]);
  const pushAiOps = useCallback((event: AiOpsEvent) => {
    setAiOpsEvents((prev) => [event, ...prev].slice(0, 24));
  }, []);

  const openMapView = useCallback(() => setMobileView('mapa'), []);
  const waitingIncidents = incidents.filter((i) => i.status === 'aguardando').length;
  const activeCivilCases = civilCases.filter((c) => c.status !== 'concluido').length;
  const activeOps = operations.filter(
    (o) => o.status === 'a_caminho' || o.status === 'em_andamento'
  ).length;

  // Chamada / alerta / pick no mapa: volta pro mapa no celular
  useEffect(() => {
    if (ringingIncident || currentAlert || mapPick || picking) {
      setMobileView('mapa');
    }
  }, [ringingIncident, currentAlert, mapPick, picking]);

  // Overlays e base no mapa: não deixa o sheet atrás do painel Central/Ops
  useEffect(() => {
    if (overlay || selectedBaseId) {
      setMobileView('mapa');
    }
  }, [overlay, selectedBaseId]);

  /** Abre menu de ações só no modo manual — com IA ligada a guarnição resolve sozinha. */
  const openUnitDecision = useCallback((unitId: string) => {
    if (aiAutonomousRef.current) {
      setSelectedBaseId(null);
      // fecha qualquer menu de decisão que esteja aberto
      setOverlay((prev) => (prev?.kind === 'unit_decision' ? null : prev));
      return;
    }
    setOverlay({ kind: 'unit_decision', unitId });
    setSelectedBaseId(null);
    setMobileView('mapa');
  }, []);

  const openArrivalMenu = openUnitDecision;

  // IA ON: nunca deixa o painel "escolha a ação" na tela
  useEffect(() => {
    if (!aiAutonomous) return;
    setOverlay((prev) => (prev?.kind === 'unit_decision' ? null : prev));
  }, [aiAutonomous, units, overlay?.kind]);

  useUnitMovement(setUnits);
  useReturnToBase(units, setUnits);
  useIncidentLifecycle(
    units,
    setUnits,
    incidents,
    setIncidents,
    (points) => setScore((s) => s + points),
    openArrivalMenu
  );
  useOperationLifecycle(units, setUnits, operations, setOperations);
  const trafficRef = useCityTraffic(CITY_STREETS, units, started && !paused);
  usePatrolEvents(
    units,
    setUnits,
    operations,
    setOperations,
    CITY_BASES,
    (event) => setPatrolEvents((prev) => [event, ...prev].slice(0, 30)),
    trafficRef
  );
  useCivilPolice(units, setUnits, incidents, setIncidents, civilCases, setCivilCases, CITY_BASES, started);
  useAutoPatrol(units, setUnits, CITY_STREETS, started);

  async function routeUnit(
    unitId: string,
    from: LatLng,
    to: LatLng,
    patch: (u: Unit) => Unit
  ) {
    setUnits((prev) => prev.map((u) => (u.id === unitId ? patch(u) : u)));
    const route = await fetchRoute(from, to).catch(() => straightLineFallback(from, to));
    setUnits((prev) => prev.map((u) => (u.id === unitId ? applyRoute(u, route) : u)));
  }

  async function handleDispatch(unitId: string, incidentId: string, code: ResponseCode = 3) {
    const unit = units.find((u) => u.id === unitId);
    const incident = incidents.find((i) => i.id === incidentId);
    if (!unit || !incident) return;

    // Mantém o dashboard da ocorrência aberto para destacar reforços em seguida
    setOverlay((prev) =>
      prev?.kind === 'incident_dash' && prev.incidentId === incidentId
        ? prev
        : prev?.kind === 'support_code'
          ? null
          : prev?.kind === 'incident_dash'
            ? prev
            : null
    );
    playDispatchRadio();
    if (isRadioPatrolUnit(unit.department, unit.label)) {
      // voz de despacho específica de Rádio Patrulha (logo após o estática do rádio)
      window.setTimeout(() => playRadioPatrolDispatch(), 280);
    }

    if (unit.operationId) {
      const opId = unit.operationId;
      setOperations((prev) =>
        prev.map((o) => {
          if (o.id !== opId) return o;
          const remaining = o.unitIds.filter((id) => id !== unitId);
          return { ...o, unitIds: remaining, status: remaining.length === 0 ? 'interrompida' : o.status };
        })
      );
    }

    const becomesPrimary = !incident.assignedUnitId || incident.status === 'aguardando';
    const isReinforce =
      !becomesPrimary &&
      (incident.status === 'despachado' ||
        incident.status === 'em_atendimento' ||
        incident.status === 'aguardando_pc' ||
        incident.status === 'investigacao_pc');

    setIncidents((prev) =>
      prev.map((i) => {
        if (i.id !== incidentId) return i;
        const radio = radioDispatch(unit, i, code);
        if (becomesPrimary) {
          return {
            ...i,
            status: 'despachado',
            assignedUnitId: unitId,
            log: [...(i.log ?? []), makeLogEntry(radio, 'despacho')].slice(-40),
          };
        }
        if (i.status === 'aguardando') {
          return {
            ...i,
            status: 'despachado',
            assignedUnitId: i.assignedUnitId ?? unitId,
            log: [...(i.log ?? []), makeLogEntry(radio, 'despacho')].slice(-40),
          };
        }
        // reforço: anota que outra unidade foi destacada (IA da guarnição no local)
        if (isReinforce) {
          const note = `[Reforço: ${unit.label} a caminho.]`;
          if (i.description.includes(note)) return i;
          return {
            ...i,
            description: `${i.description} ${note}`,
            log: [
              ...(i.log ?? []),
              makeLogEntry(`Apoio solicitado — ${radio}`, 'apoio'),
            ].slice(-40),
          };
        }
        return i;
      })
    );

    // Avisa guarnição já no local / em menu de chegada que reforço vem a caminho
    if (isReinforce) {
      setUnits((prev) =>
        prev.map((u) => {
          if (u.assignedIncidentId !== incidentId) return u;
          if (u.id === unitId) return u;
          if (
            u.status === 'no_local' ||
            u.status === 'aguardando_decisao' ||
            u.pendingDecision === 'chegada'
          ) {
            const base = u.pendingIncidentTitle ?? incident.title;
            const tag = ` · reforço ${unit.label} a caminho`;
            if (base.includes('reforço')) return u;
            return { ...u, pendingIncidentTitle: `${base}${tag}` };
          }
          return u;
        })
      );
    }

    await routeUnit(unitId, unit.position, incident.location, (u) =>
      applyEnRoute(u, {
        mission: becomesPrimary ? 'despacho' : 'apoio_ocorrencia',
        responseCode: code,
        // todas as unidades do caso ficam vinculadas (compartilham atendimento)
        assignedIncidentId: incidentId,
        missionEndsAt: undefined,
      })
    );
  }

  function startPreset(preset: OperationPreset) {
    const d = draftFromPreset(preset);
    setDraft(d);
    // se já tem local padrão (Centro Seguro), não força pick; senão abre mapa
    setPicking(!!d.requireMapPick && !d.location);
  }

  function cancelDraft() {
    setDraft(null);
    setPicking(false);
  }

  function updateDraft(partial: Partial<OperationDraft>) {
    setDraft((d) => (d ? { ...d, ...partial } : d));
  }

  function toggleDraftUnit(unitId: string) {
    setDraft((d) => {
      if (!d) return d;
      const has = d.unitIds.includes(unitId);
      return { ...d, unitIds: has ? d.unitIds.filter((id) => id !== unitId) : [...d.unitIds, unitId] };
    });
  }

  function pickLocation(location: LatLng) {
    if (mapPick?.kind === 'deslocar') {
      void handleDeslocar(mapPick.unitId, location);
      return;
    }
    if (mapPick?.kind === 'ponto_estrategico') {
      void handlePontoEstrategico(mapPick.unitId, location);
      return;
    }
    setDraft((d) => (d ? { ...d, location } : d));
    setPicking(false);
  }

  async function handleDeslocar(unitId: string, location: LatLng) {
    const unit = units.find((u) => u.id === unitId);
    if (!unit || unit.status !== 'disponivel') return;
    playDispatchRadio();
    setMapPick(null);
    setOverlay(null);
    await routeUnit(unitId, unit.position, location, (u) =>
      applyEnRoute(u, { mission: 'deslocamento', responseCode: 2 })
    );
  }

  async function handlePontoEstrategico(unitId: string, location: LatLng) {
    const unit = units.find((u) => u.id === unitId);
    if (!unit || unit.status !== 'disponivel') return;
    playDispatchRadio();
    setMapPick(null);
    setOverlay(null);
    const endsAt = Date.now() + STRATEGIC_POINT_DURATION_MS;
    await routeUnit(unitId, unit.position, location, (u) =>
      applyEnRoute(u, {
        mission: 'ponto_estrategico',
        responseCode: 2,
        missionEndsAt: endsAt,
      })
    );
  }

  async function handleRealocar(unitId: string, base: CityBase) {
    const unit = units.find((u) => u.id === unitId);
    if (!unit || unit.status !== 'disponivel') return;
    playDispatchRadio();
    setOverlay(null);
    setSelectedBaseId(null);
    await routeUnit(unitId, unit.position, base.location, (u) =>
      applyEnRoute(u, {
        mission: 'realocacao',
        responseCode: 2,
        baseId: base.id,
        base: base.location,
      })
    );
  }

  async function handleStartUnitPatrol(unitId: string) {
    const unit = units.find((u) => u.id === unitId);
    if (!unit || unit.status !== 'disponivel') return;
    playDispatchRadio();
    setOverlay(null);
    setSelectedBaseId(null);

    const endsAt = Date.now() + UNIT_PATROL_DURATION_MS;
    setUnits((prev) =>
      prev.map((u) =>
        u.id === unitId
          ? applyEnRoute(u, {
              mission: 'patrulha',
              responseCode: 2,
              patrolEndsAt: endsAt,
              missionEndsAt: endsAt,
            })
          : u
      )
    );

    try {
      const loop = await fetchPatrolLoop(unit.position, UNIT_PATROL_RADIUS_M).catch(() =>
        straightLineFallback(unit.position, unit.position)
      );
      setUnits((prev) =>
        prev.map((u) =>
          u.id === unitId
            ? {
                ...applyRoute(u, loop),
                status: 'em_operacao',
                mission: 'patrulha',
                responseCode: undefined,
                patrolEndsAt: endsAt,
                missionEndsAt: endsAt,
                nextPatrolEventAt: Date.now() + 20_000,
              }
            : u
        )
      );
    } catch {
      setUnits((prev) =>
        prev.map((u) =>
          u.id === unitId
            ? {
                ...u,
                status: 'em_operacao',
                mission: 'patrulha',
                responseCode: undefined,
                patrolEndsAt: endsAt,
                missionEndsAt: endsAt,
                nextPatrolEventAt: Date.now() + 20_000,
              }
            : u
        )
      );
    }
  }

  async function handleSupportCode(unitId: string, incidentId: string, code: ResponseCode) {
    setOverlay(null);
    setMapPick(null);
    setSelectedBaseId(null);
    await handleDispatch(unitId, incidentId, code);
  }

  function handleUnitAction(unitId: string, action: UnitActionId) {
    const unit = units.find((u) => u.id === unitId);
    if (!unit || unit.status !== 'disponivel') return;

    if (action === 'deslocar') {
      setOverlay(null);
      setSelectedBaseId(null);
      setMapPick({ kind: 'deslocar', unitId });
      return;
    }
    if (action === 'realocar') {
      setOverlay({ kind: 'realocar', unitId });
      return;
    }
    if (action === 'patrulha') {
      void handleStartUnitPatrol(unitId);
      return;
    }
    if (action === 'ponto_estrategico') {
      setOverlay(null);
      setSelectedBaseId(null);
      setMapPick({ kind: 'ponto_estrategico', unitId });
      return;
    }
    if (action === 'apoio') {
      setOverlay(null);
      setSelectedBaseId(null);
      setMapPick({ kind: 'apoio_ocorrencia', unitId });
    }
  }

  function handleSelectIncidentForSupport(incidentId: string) {
    if (mapPick?.kind !== 'apoio_ocorrencia') return;
    const unit = units.find((u) => u.id === mapPick.unitId);
    const incident = incidents.find((i) => i.id === incidentId);
    if (!unit || !incident || incident.status === 'resolvido') return;

    // preferir tipo compatível; ainda permite reforço do mesmo tipo
    const preferred = UNIT_TYPE_FOR_INCIDENT[incident.type];
    if (preferred !== unit.type) {
      // permite mesmo assim se for viatura em ocorrência de polícia
      if (!(unit.type === 'viatura' && incident.type === 'policia')) {
        return;
      }
    }

    setMapPick(null);
    setOverlay({ kind: 'support_code', unitId: unit.id, incidentId });
  }

  async function launchOperation() {
    if (!draft || !draft.location) return;
    const location = draft.location;
    const opId = `operation-${Date.now()}`;
    const unitIds = draft.unitIds;
    const isPatrol = isPatrolOperationType(draft.type);
    const radius = draft.radiusMeters ?? 1000;

    // Patrulha multi-viatura: cada uma recebe um setor/anel dentro da zona
    const patrolAssignments = isPatrol ? spreadPatrolAssignments(location, radius, unitIds.length) : [];

    const operation: Operation = {
      id: opId,
      type: draft.type,
      title: draft.title.trim() || LABEL_BY_OPERATION_TYPE[draft.type],
      location,
      radiusMeters: isPatrol ? radius : undefined,
      unitIds: [...unitIds],
      durationMs: draft.durationMinutes * 60_000,
      status: 'a_caminho',
      createdAt: Date.now(),
      notes: draft.notes?.trim() || undefined,
    };

    setOperations((prev) => [...prev, operation]);
    playDispatchRadio();

    setUnits((prev) =>
      prev.map((u) => {
        if (!unitIds.includes(u.id)) return u;
        const idx = unitIds.indexOf(u.id);
        const assignment = patrolAssignments[idx];
        return {
          ...u,
          status: 'a_caminho',
          operationId: opId,
          mission: isPatrol ? 'patrulha' : 'none',
          responseCode: 2,
          patrolLoopCenter: assignment?.loopCenter,
          patrolLoopRadius: assignment?.loopRadius,
          patrolStartAngleDeg: assignment?.startAngleDeg,
        };
      })
    );
    setDraft(null);
    setPicking(false);

    for (let i = 0; i < unitIds.length; i++) {
      const unitId = unitIds[i];
      const unit = units.find((u) => u.id === unitId);
      if (!unit) continue;
      const destination = isPatrol ? (patrolAssignments[i]?.entryPoint ?? location) : location;
      const route = await fetchRoute(unit.position, destination).catch(() =>
        straightLineFallback(unit.position, destination)
      );
      setUnits((prev) =>
        prev.map((u) =>
          u.id === unitId
            ? {
                ...u,
                route: route.points,
                routeDurationMs: route.durationMs,
                routeStartedAt: Date.now(),
                routeProgress: 0,
              }
            : u
        )
      );
    }
  }

  function cancelOperation(opId: string) {
    setOperations((prev) => prev.map((o) => (o.id === opId ? { ...o, status: 'interrompida' } : o)));
    setUnits((prev) =>
      prev.map((u) =>
        u.operationId === opId
          ? {
              ...u,
              status: 'retornando',
              operationId: undefined,
              mission: 'none',
              responseCode: undefined,
              patrolEndsAt: undefined,
              missionEndsAt: undefined,
              patrolLoopCenter: undefined,
              patrolLoopRadius: undefined,
              patrolStartAngleDeg: undefined,
              route: undefined,
              routeProgress: undefined,
              routeDurationMs: undefined,
              routeStartedAt: undefined,
            }
          : u
      )
    );
  }

  const selectedBase = selectedBaseId ? CITY_BASES.find((b) => b.id === selectedBaseId) ?? null : null;
  const overlayUnit =
    overlay && 'unitId' in overlay ? units.find((u) => u.id === overlay.unitId) ?? null : null;
  const supportIncident =
    overlay?.kind === 'support_code' ? incidents.find((i) => i.id === overlay.incidentId) ?? null : null;
  const dashIncident =
    overlay?.kind === 'incident_dash' ? incidents.find((i) => i.id === overlay.incidentId) ?? null : null;
  const interviewKey =
    overlay?.kind === 'scene_interview' ? `${overlay.unitId}:${overlay.incidentId}` : null;
  const activeInterview = interviewKey ? interviewSessions[interviewKey] ?? null : null;
  const interviewIncident =
    overlay?.kind === 'scene_interview'
      ? incidents.find((i) => i.id === overlay.incidentId) ?? null
      : null;

  const mapPickActive =
    mapPick?.kind === 'deslocar' || mapPick?.kind === 'ponto_estrategico' || picking;
  const incidentSelectMode = mapPick?.kind === 'apoio_ocorrencia';

  function cancelMapPick() {
    setMapPick(null);
  }

  function resolveIncidentForUnit(unitId: string) {
    const unit = units.find((u) => u.id === unitId);
    if (!unit?.assignedIncidentId) return;
    const id = unit.assignedIncidentId;
    setIncidents((prev) => prev.map((i) => (i.id === id ? { ...i, status: 'resolvido' } : i)));
  }

  /** Após ação final: todas as viaturas no caso pedem disposição (base ou deslocar). */
  function offerDispositionToUnitsOnIncident(incidentId: string, title: string) {
    setIncidents((prev) => prev.map((i) => (i.id === incidentId ? { ...i, status: 'resolvido' } : i)));
    setUnits((prev) =>
      prev.map((u) =>
        u.assignedIncidentId === incidentId
          ? {
              ...u,
              status: 'aguardando_decisao',
              pendingDecision: 'disposicao',
              pendingIncidentTitle: title,
              responseCode: undefined,
              route: undefined,
              routeProgress: undefined,
              routeDurationMs: undefined,
              routeStartedAt: undefined,
            }
          : u
      )
    );
    setOverlay(null);
  }

  function clearDecisionAndReturn(unitId: string) {
    const unit = units.find((u) => u.id === unitId);
    const incidentId = unit?.assignedIncidentId;
    const title = unit?.pendingIncidentTitle ?? 'Ocorrência';
    if (incidentId) {
      offerDispositionToUnitsOnIncident(incidentId, title);
      // se só esta unidade, já oferece disposição para ela
      return;
    }
    setUnits((prev) =>
      prev.map((u) =>
        u.id === unitId
          ? {
              ...u,
              status: 'retornando',
              pendingDecision: undefined,
              pendingIncidentTitle: undefined,
              assignedIncidentId: undefined,
              mission: 'none',
              responseCode: undefined,
              route: undefined,
              routeProgress: undefined,
              routeDurationMs: undefined,
              routeStartedAt: undefined,
            }
          : u
      )
    );
    setOverlay(null);
  }

  /** Ações que podem ir para a fila (rodar em sequência no local). */
  function isQueueableSceneAction(action: SceneAction): boolean {
    return (
      action.effect === 'start_service' ||
      action.effect === 'start_service_preserve' ||
      action.effect === 'fire_role' ||
      action.effect === 'request_support' ||
      action.effect === 'identify' ||
      action.effect === 'bo_local'
    );
  }

  function enqueueSceneAction(unitId: string, action: SceneAction) {
    setUnits((prev) =>
      prev.map((u) => {
        if (u.id !== unitId) return u;
        const queue = [...(u.actionQueue ?? [])];
        // evita duplicar a mesma ação em sequência
        if (queue.some((q) => q.id === action.id && q.fireRole === action.fireRole)) {
          return u;
        }
        queue.push({
          id: action.id,
          title: action.title,
          description: action.description,
          effect: action.effect,
          fireRole: action.fireRole,
          durationMs: action.durationMs,
          category: action.category,
        });
        return {
          ...u,
          actionQueue: queue,
          pendingDecision: 'acoes_local',
          pendingIncidentTitle: `Fila: ${queue.length} ação(ões) · em serviço: ${u.serviceRoleLabel ?? 'sim'}`,
        };
      })
    );
    // mantém o menu aberto para enfileirar mais (só modo manual)
    openUnitDecision(unitId);
  }

  function logIncident(incidentId: string, text: string, kind: 'sistema' | 'despacho' | 'acao' | 'resultado' | 'apoio' = 'acao') {
    setIncidents((prev) =>
      prev.map((i) => {
        if (i.id !== incidentId) return i;
        const log = [...(i.log ?? []), makeLogEntry(text, kind)].slice(-40);
        return { ...i, log };
      })
    );
  }

  function executeSceneActionNow(unitId: string, action: SceneAction) {
    const unit = units.find((u) => u.id === unitId);
    if (!unit?.assignedIncidentId) return;
    const incidentId = unit.assignedIncidentId;
    const incident = incidents.find((i) => i.id === incidentId);
    if (!incident) return;

    if (action.effect === 'apurar_fatos') {
      const key = `${unitId}:${incidentId}`;
      logIncident(incidentId, `${unit.label}: iniciou apuração com vítima/testemunha`, 'acao');
      setInterviewSessions((prev) => {
        if (prev[key]) return prev;
        return { ...prev, [key]: createInterviewSession(incident, unitId) };
      });
      setUnits((prev) =>
        prev.map((u) =>
          u.id === unitId
            ? {
                ...u,
                status: 'no_local',
                pendingDecision: 'acoes_local',
                pendingIncidentTitle: `Apurando fatos — ${incident.title}`,
              }
            : u
        )
      );
      setOverlay({ kind: 'scene_interview', unitId, incidentId });
      return;
    }

    if (action.effect === 'hospital') {
      setUnits((prev) =>
        prev.map((u) =>
          u.id === unitId
            ? {
                ...u,
                status: 'aguardando_decisao',
                pendingDecision: 'hospital',
                pendingIncidentTitle: incident.title,
                actionQueue: undefined,
              }
            : u
        )
      );
      setIncidents((prev) =>
        prev.map((i) =>
          i.id === incidentId && (i.status === 'despachado' || i.status === 'em_atendimento')
            ? { ...i, status: 'em_atendimento', assignedUnitId: i.assignedUnitId ?? unitId }
            : i
        )
      );
      openUnitDecision(unitId);
      return;
    }

    if (action.effect === 'delegacia' || action.effect === 'flagrante') {
      logIncident(incidentId, `${unit.label}: ${action.title}`, 'acao');
      void handlePoliceDecision(unitId, 'delegacia');
      return;
    }

    if (action.effect === 'resolve_light') {
      logIncident(incidentId, `${unit.label}: sem providências / falso alarme`, 'resultado');
      setUnits((prev) =>
        prev.map((u) => (u.id === unitId ? { ...u, actionQueue: undefined, activeSceneAction: undefined } : u))
      );
      setScore((s) => s + 15);
      offerDispositionToUnitsOnIncident(incidentId, incident.title);
      return;
    }

    if (action.effect === 'bo_local') {
      const bo = `BO-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 90000) + 10000)}`;
      logIncident(incidentId, `${unit.label}: lavrando B.O. ${bo} no local`, 'acao');
      startIncidentService(incidentId, unitId, incidents, setIncidents, setUnits, {
        durationMs: action.durationMs ?? actionDurationMs(action, incident),
        roleLabel: `B.O. ${bo}`,
        activeSceneAction: {
          id: action.id,
          title: action.title,
          description: action.description,
          effect: action.effect,
          durationMs: action.durationMs,
          category: action.category,
        },
      });
      openUnitDecision(unitId);
      return;
    }

    if (action.effect === 'fire_role' && action.fireRole) {
      logIncident(incidentId, `${unit.label}: ${action.title}`, 'acao');
      startIncidentService(incidentId, unitId, incidents, setIncidents, setUnits, {
        fireRole: action.fireRole as import('./lib/fireTeams').FireTeamRole,
        activeSceneAction: {
          id: action.id,
          title: action.title,
          description: action.description,
          effect: action.effect,
          fireRole: action.fireRole,
        },
      });
      openUnitDecision(unitId);
      return;
    }

    const duration = action.durationMs ?? actionDurationMs(action, incident);
    logIncident(incidentId, `${unit.label}: ${action.title}`, 'acao');
    startIncidentService(incidentId, unitId, incidents, setIncidents, setUnits, {
      durationMs: duration,
      roleLabel: action.title,
      activeSceneAction: {
        id: action.id,
        title: action.title,
        description: action.description,
        effect: action.effect,
        fireRole: action.fireRole,
        durationMs: duration,
        category: action.category,
      },
    });

    if (isCivilPoliceUnit(unit, CITY_BASES) && incident.civilCaseId) {
      const now = Date.now();
      setIncidents((prev) =>
        prev.map((i) =>
          i.id === incidentId
            ? { ...i, status: 'investigacao_pc', resolvesAt: now + 35_000, civilUnitId: unitId }
            : i
        )
      );
      setCivilCases((prev) =>
        prev.map((c) =>
          c.id === incident.civilCaseId
            ? {
                ...c,
                status: 'em_investigacao',
                unitId,
                unitLabel: unit.label,
                updatedAt: now,
                notes: [...c.notes, `${unit.label}: ${action.title}`],
              }
            : c
        )
      );
    }

    if (action.effect === 'request_support') {
      setIncidents((prev) =>
        prev.map((i) =>
          i.id === incidentId
            ? {
                ...i,
                description: `${i.description} [Reforço solicitado pela guarnição.]`,
                log: [...(i.log ?? []), makeLogEntry(`${unit.label} solicitou reforço`, 'apoio')].slice(-40),
              }
            : i
        )
      );
    }

    if (action.effect === 'start_service_preserve' || action.title.toLowerCase().includes('preservar')) {
      setIncidents((prev) =>
        prev.map((i) =>
          i.id === incidentId
            ? {
                ...i,
                requiresCivilPolice: true,
                description: `${i.description} [Local preservado pela guarnição.]`,
                log: [...(i.log ?? []), makeLogEntry(`${unit.label}: local preservado para PC`, 'acao')].slice(
                  -40
                ),
              }
            : i
        )
      );
    }

    // menu permanece para enfileirar a próxima (só modo manual)
    openUnitDecision(unitId);
  }

  function handleSceneAction(unitId: string, action: SceneAction) {
    const unit = units.find((u) => u.id === unitId);
    if (!unit?.assignedIncidentId) return;
    const incident = incidents.find((i) => i.id === unit.assignedIncidentId);
    if (!incident) return;

    const busy = !!(unit.serviceEndsAt && unit.serviceEndsAt > Date.now());

    // se está em uma tarefa e a ação é sequenciável → entra na fila
    if (busy && isQueueableSceneAction(action)) {
      enqueueSceneAction(unitId, action);
      return;
    }

    // imediata (livre ou ação que interrompe/encerra)
    executeSceneActionNow(unitId, action);
  }

  // lock: evita disparar várias da fila no mesmo frame
  const queueLockRef = useRef<Set<string>>(new Set());

  // quando uma tarefa termina e há fila, dispara a próxima automaticamente
  useEffect(() => {
    const now = Date.now();
    for (const unit of units) {
      if (!unit.assignedIncidentId) continue;
      if (unit.serviceEndsAt && unit.serviceEndsAt > now) continue;
      if (!unit.actionQueue || unit.actionQueue.length === 0) continue;
      if (unit.status === 'a_caminho' || unit.status === 'retornando' || unit.status === 'levando_preso') {
        continue;
      }
      if (queueLockRef.current.has(unit.id)) continue;

      const [next, ...rest] = unit.actionQueue;
      const sceneAction: SceneAction = {
        id: next.id,
        title: next.title,
        description: next.description,
        effect: next.effect as SceneAction['effect'],
        fireRole: next.fireRole,
        durationMs: next.durationMs,
        category: next.category as SceneAction['category'],
      };

      queueLockRef.current.add(unit.id);

      setUnits((prev) =>
        prev.map((u) =>
          u.id === unit.id
            ? {
                ...u,
                actionQueue: rest,
                pendingDecision: 'acoes_local',
                pendingIncidentTitle: `Iniciando: ${next.title}${rest.length ? ` · +${rest.length} na fila` : ''}`,
              }
            : u
        )
      );

      window.setTimeout(() => {
        executeSceneActionNow(unit.id, sceneAction);
        // libera o lock depois da tarefa ter serviceEndsAt (ou falha)
        window.setTimeout(() => {
          queueLockRef.current.delete(unit.id);
        }, 400);
      }, 60);
      break; // um por ciclo
    }
    // processa fila quando units mudam
  }, [units]);

  function handlePostInterviewAction(unitId: string, incidentId: string, actionId: PostInterviewActionId) {
    const unit = units.find((u) => u.id === unitId);
    const incident = incidents.find((i) => i.id === incidentId);
    if (!unit || !incident) return;

    const key = `${unitId}:${incidentId}`;
    const session = interviewSessions[key];
    const factsNote =
      session && session.summary.length > 0
        ? ` [Apuração: ${session.summary.slice(0, 3).join(' | ')}]`
        : ' [Apuração concluída no local.]';

    if (actionId === 'request_support' || actionId === 'specialized') {
      setIncidents((prev) =>
        prev.map((i) =>
          i.id === incidentId
            ? {
                ...i,
                description: `${i.description}${factsNote}${
                  actionId === 'specialized'
                    ? ' [Equipe especializada solicitada pela guarnição.]'
                    : ' [Reforço solicitado após apuração.]'
                }`,
                status: i.status === 'aguardando' ? 'despachado' : i.status,
              }
            : i
        )
      );
      setUnits((prev) =>
        prev.map((u) =>
          u.id === unitId
            ? {
                ...u,
                status: 'no_local',
                pendingDecision: undefined,
                pendingIncidentTitle: `No local — aguardando ${actionId === 'specialized' ? 'especializada' : 'reforço'} · ${incident.title}`,
                assignedIncidentId: incidentId,
              }
            : u
        )
      );
      // abre dashboard para despachar mais unidades
      setOverlay({ kind: 'incident_dash', incidentId });
      return;
    }

    if (actionId === 'hospital') {
      setIncidents((prev) =>
        prev.map((i) =>
          i.id === incidentId
            ? {
                ...i,
                description: `${i.description}${factsNote}`,
                status: i.status === 'despachado' || i.status === 'aguardando' ? 'em_atendimento' : i.status,
              }
            : i
        )
      );
      setUnits((prev) =>
        prev.map((u) =>
          u.id === unitId
            ? {
                ...u,
                status: 'aguardando_decisao',
                pendingDecision: 'hospital',
                pendingIncidentTitle: incident.title,
                assignedIncidentId: incidentId,
              }
            : u
        )
      );
      openUnitDecision(unitId);
      return;
    }

    if (actionId === 'delegacia') {
      void handlePoliceDecision(unitId, 'delegacia');
      return;
    }

    if (actionId === 'resolve_light') {
      setIncidents((prev) =>
        prev.map((i) =>
          i.id === incidentId ? { ...i, description: `${i.description}${factsNote}` } : i
        )
      );
      offerDispositionToUnitsOnIncident(incidentId, incident.title);
      return;
    }

    // start_service | preserve_pc
    if (actionId === 'preserve_pc') {
      setIncidents((prev) =>
        prev.map((i) =>
          i.id === incidentId
            ? {
                ...i,
                requiresCivilPolice: true,
                description: `${i.description}${factsNote} [Local preservado — aguardando PC.]`,
              }
            : i
        )
      );
    } else {
      setIncidents((prev) =>
        prev.map((i) =>
          i.id === incidentId ? { ...i, description: `${i.description}${factsNote}` } : i
        )
      );
    }

    startIncidentService(incidentId, unitId, incidents, setIncidents, setUnits);
    setOverlay(null);
  }

  function handleDisposition(unitId: string, action: DispositionAction) {
    if (action === 'retornar') {
      setUnits((prev) =>
        prev.map((u) =>
          u.id === unitId
            ? {
                ...u,
                status: 'retornando',
                pendingDecision: undefined,
                pendingIncidentTitle: undefined,
                assignedIncidentId: undefined,
                mission: 'none',
                responseCode: undefined,
                route: undefined,
                routeProgress: undefined,
                routeDurationMs: undefined,
                routeStartedAt: undefined,
              }
            : u
        )
      );
      setOverlay(null);
      return;
    }
    // deslocar
    setUnits((prev) =>
      prev.map((u) =>
        u.id === unitId
          ? {
              ...u,
              pendingDecision: undefined,
              pendingIncidentTitle: undefined,
              assignedIncidentId: undefined,
              status: 'disponivel',
            }
          : u
      )
    );
    setOverlay(null);
    setMapPick({ kind: 'deslocar', unitId });
  }

  function handleCivilAction(unitId: string, action: CivilDecisionAction) {
    const unit = units.find((u) => u.id === unitId);
    if (!unit?.assignedIncidentId) return;
    const incidentId = unit.assignedIncidentId;
    const incident = incidents.find((i) => i.id === incidentId);
    const caseId = incident?.civilCaseId;

    if (action === 'prisao') {
      const delegacia = findNearestDelegacia(CITY_BASES, unit.position);
      if (caseId) {
        setCivilCases((prev) =>
          prev.map((c) =>
            c.id === caseId
              ? {
                  ...c,
                  status: 'concluido',
                  arrestCount: c.arrestCount + 1,
                  completedAt: Date.now(),
                  updatedAt: Date.now(),
                  notes: [...c.notes, 'Prisão efetuada — condução à delegacia.'],
                }
              : c
          )
        );
      }
      if (delegacia) {
        playDispatchRadio();
        setIncidents((prev) => prev.map((i) => (i.id === incidentId ? { ...i, status: 'resolvido' } : i)));
        // PC leva preso; demais unidades pedem disposição
        setUnits((prev) =>
          prev.map((u) => {
            if (u.id === unitId) {
              return {
                ...u,
                status: 'levando_preso',
                pendingDecision: undefined,
                pendingIncidentTitle: undefined,
                assignedIncidentId: undefined,
                mission: 'none',
                responseCode: 2,
              };
            }
            if (u.assignedIncidentId === incidentId) {
              return {
                ...u,
                status: 'aguardando_decisao',
                pendingDecision: 'disposicao',
                pendingIncidentTitle: incident?.title ?? 'Ocorrência',
              };
            }
            return u;
          })
        );
        setOverlay(null);
        void fetchRoute(unit.position, delegacia.location)
          .catch(() => straightLineFallback(unit.position, delegacia.location))
          .then((route) => {
            setUnits((prev) => prev.map((u) => (u.id === unitId ? applyRoute(u, route) : u)));
          });
        return;
      }
    }

    if (caseId) {
      const note =
        action === 'concluir_bo'
          ? 'B.O. concluído pelo operador.'
          : action === 'provas'
            ? 'Coleta de provas encerrada.'
            : 'Caso arquivado — sem indícios suficientes.';
      setCivilCases((prev) =>
        prev.map((c) =>
          c.id === caseId
            ? {
                ...c,
                status: 'concluido',
                evidenceCollected: c.evidenceCollected || action === 'provas' || action === 'concluir_bo',
                completedAt: Date.now(),
                updatedAt: Date.now(),
                notes: [...c.notes, note],
              }
            : c
        )
      );
    }

    offerDispositionToUnitsOnIncident(incidentId, incident?.title ?? 'Ocorrência');
  }

  async function handleHospitalTransport(unitId: string, hospitalBaseId: string) {
    const unit = units.find((u) => u.id === unitId);
    const hospital = CITY_BASES.find((b) => b.id === hospitalBaseId);
    if (!unit || !hospital) return;
    playDispatchRadio();
    resolveIncidentForUnit(unitId);
    setOverlay(null);
    setUnits((prev) =>
      prev.map((u) =>
        u.id === unitId
          ? {
              ...u,
              status: 'a_caminho',
              mission: 'deslocamento',
              responseCode: 2,
              pendingDecision: undefined,
              pendingIncidentTitle: undefined,
              assignedIncidentId: undefined,
            }
          : u
      )
    );
    const route = await fetchRoute(unit.position, hospital.location).catch(() =>
      straightLineFallback(unit.position, hospital.location)
    );
    setUnits((prev) =>
      prev.map((u) =>
        u.id === unitId
          ? {
              ...applyRoute(u, route),
              // ao chegar no hospital vira disponivel via mission deslocamento
              mission: 'deslocamento',
            }
          : u
      )
    );
  }

  async function handlePoliceDecision(unitId: string, action: PoliceDecisionAction) {
    const unit = units.find((u) => u.id === unitId);
    if (!unit) return;

    if (action === 'liberar' || action === 'encerrar') {
      clearDecisionAndReturn(unitId);
      return;
    }

    if (action === 'hospital') {
      setUnits((prev) =>
        prev.map((u) => (u.id === unitId ? { ...u, pendingDecision: 'hospital' } : u))
      );
      openUnitDecision(unitId);
      return;
    }

    if (action === 'delegacia') {
      const delegacia = findNearestDelegacia(CITY_BASES, unit.position);
      if (!delegacia) {
        clearDecisionAndReturn(unitId);
        return;
      }
      playDispatchRadio();
      const incidentId = unit.assignedIncidentId;
      if (incidentId) {
        setIncidents((prev) => prev.map((i) => (i.id === incidentId ? { ...i, status: 'resolvido' } : i)));
        setUnits((prev) =>
          prev.map((u) => {
            if (u.id === unitId) {
              return {
                ...u,
                status: 'levando_preso',
                pendingDecision: undefined,
                pendingIncidentTitle: undefined,
                assignedIncidentId: undefined,
                mission: 'none',
                responseCode: 2,
              };
            }
            if (u.assignedIncidentId === incidentId) {
              return {
                ...u,
                status: 'aguardando_decisao',
                pendingDecision: 'disposicao',
                pendingIncidentTitle: unit.pendingIncidentTitle ?? 'Ocorrência',
              };
            }
            return u;
          })
        );
        setOverlay(null);
        void fetchRoute(unit.position, delegacia.location)
          .catch(() => straightLineFallback(unit.position, delegacia.location))
          .then((route) => {
            setUnits((prev) => prev.map((u) => (u.id === unitId ? applyRoute(u, route) : u)));
          });
        return;
      }
      resolveIncidentForUnit(unitId);
      setOverlay(null);
      setUnits((prev) =>
        prev.map((u) =>
          u.id === unitId
            ? {
                ...u,
                status: 'levando_preso',
                pendingDecision: undefined,
                pendingIncidentTitle: undefined,
                assignedIncidentId: undefined,
                mission: 'none',
                responseCode: 2,
              }
            : u
        )
      );
      const route = await fetchRoute(unit.position, delegacia.location).catch(() =>
        straightLineFallback(unit.position, delegacia.location)
      );
      setUnits((prev) => prev.map((u) => (u.id === unitId ? applyRoute(u, route) : u)));
    }
  }

  // IA tática: corporação age sozinha na chegada e nas decisões
  useTacticalAI({
    enabled: aiAutonomous && started && !paused,
    started,
    paused,
    units,
    incidents,
    bases: CITY_BASES,
    setIncidents,
    onSceneAction: handleSceneAction,
    onPoliceAction: (unitId, action) => {
      void handlePoliceDecision(unitId, action);
    },
    onCivilAction: handleCivilAction,
    onDisposition: handleDisposition,
    onHospital: (unitId, hospitalId) => {
      void handleHospitalTransport(unitId, hospitalId);
    },
    onNotify: pushAiOps,
  });

  function handleSelectUnitOnMap(unitId: string) {
    const unit = units.find((u) => u.id === unitId);
    if (!unit) return;
    setSelectedBaseId(null);
    // apuração em curso reabre o diálogo
    if (unit.assignedIncidentId && unit.pendingIncidentTitle?.includes('Apurando')) {
      const key = `${unitId}:${unit.assignedIncidentId}`;
      if (interviewSessions[key]) {
        setOverlay({ kind: 'scene_interview', unitId, incidentId: unit.assignedIncidentId });
        return;
      }
    }
    // painel completo de detalhes da unidade
    setOverlay({ kind: 'unit_detail', unitId });
  }

  /** Não envia unidade — encerra sem pontuar. */
  function handleIgnoreIncident(incidentId: string) {
    setIncidents((prev) => prev.map((i) => (i.id === incidentId ? { ...i, status: 'resolvido' } : i)));
    setOverlay(null);
  }

  /** Descarta da fila (falso positivo, duplicada…). */
  function handleDiscardIncident(incidentId: string) {
    setIncidents((prev) => prev.filter((i) => i.id !== incidentId));
    setOverlay(null);
  }

  function endShift() {
    stopRinging();
    stopAllSirens();
    setStarted(false);
    setPaused(false);
    setIncidents([]);
    setScore(0);
    setOperations([]);
    setPatrolEvents([]);
    setDraft(null);
    setPicking(false);
    setSelectedBaseId(null);
    setMapPick(null);
    setOverlay(null);
    setFocusLocation(null);
    setFollowUnitId(null);
    setCivilCases([]);
    setLeftTab('ocorrencias');
    setMobileView('mapa');
    setAiOpsEvents([]);
    setUnits(basesToUnits(CITY_BASES));
  }

  // se a viatura seguida volta à base (disponível) ou some, para de seguir
  useEffect(() => {
    if (!followUnitId) return;
    const fu = units.find((u) => u.id === followUnitId);
    if (!fu || fu.status === 'disponivel') {
      setFollowUnitId(null);
    }
  }, [followUnitId, units]);

  const pickBanner =
    mapPick?.kind === 'deslocar'
      ? {
          title: 'Deslocar viatura',
          subtitle: 'Toque no mapa para definir o destino (código 2)',
        }
      : mapPick?.kind === 'ponto_estrategico'
        ? {
            title: 'Ponto estratégico',
            subtitle: 'Toque no mapa o local de observação / fiscalização',
          }
        : mapPick?.kind === 'apoio_ocorrencia'
          ? {
              title: 'Apoio em ocorrência',
              subtitle: 'Toque em uma ocorrência no mapa',
            }
          : null;

  return (
    <div className={`app-shell app-shell--mobile-${mobileView}`}>
      <header className="app-header">
        <div className="app-header__brand">
          <h1>
            <span className="app-header__title-full">COPOM/COBOM — Uberlândia</span>
            <span className="app-header__title-short">COPOM</span>
          </h1>
          <span className="app-header__status app-header__status-full">
            {units.length} unidades · {incidents.length} ocorrências · {score} pts
            {started && paused ? ' · pausado' : started ? ' · em plantão' : ''}
          </span>
        </div>
        <div className="app-header__chips" aria-label="Resumo do plantão">
          <span className="app-header__chip">
            <em>{units.length}</em> un.
          </span>
          <span className={`app-header__chip${waitingIncidents > 0 ? ' app-header__chip--alert' : ''}`}>
            <em>{incidents.length}</em> occ
          </span>
          <span className="app-header__chip app-header__chip--score">
            <em>{score}</em> pts
          </span>
          {started && paused && <span className="app-header__chip app-header__chip--pause">pausa</span>}
        </div>
        {started && (
          <div className="app-header__actions">
            <button
              type="button"
              className={`app-header__btn app-header__btn--ai${aiAutonomous ? ' is-on' : ''}`}
              onClick={() => setAiAutonomous((v) => !v)}
              title={
                aiAutonomous
                  ? 'IA da corporação ATIVA — guarnições atuam sozinhas no local'
                  : 'IA desligada — você decide cada ação no local'
              }
            >
              <span className="app-header__btn-full">{aiAutonomous ? 'IA corporação: ON' : 'IA corporação: OFF'}</span>
              <span className="app-header__btn-short">{aiAutonomous ? 'IA ON' : 'IA OFF'}</span>
            </button>
            <button type="button" className="app-header__btn" onClick={() => setPaused((p) => !p)}>
              <span className="app-header__btn-full">{paused ? 'Retomar ocorrências' : 'Pausar ocorrências'}</span>
              <span className="app-header__btn-short">{paused ? 'Retomar' : 'Pausar'}</span>
            </button>
            <button type="button" className="app-header__btn app-header__btn--danger" onClick={endShift}>
              <span className="app-header__btn-full">Encerrar plantão</span>
              <span className="app-header__btn-short">Sair</span>
            </button>
          </div>
        )}
      </header>
      <div className="app-body">
        {/* Backdrop: toque fora fecha o painel no mobile */}
        {mobileView !== 'mapa' && (
          <button
            type="button"
            className="app-mobile-backdrop"
            aria-label="Fechar painel e voltar ao mapa"
            onClick={openMapView}
          />
        )}
        <div className="app-left" id="app-left-panel">
          <div className="app-panel-mobile-bar">
            <span className="app-panel-mobile-bar__handle" aria-hidden />
            <div className="app-panel-mobile-bar__row">
              <span className="app-panel-mobile-bar__title">Central 190 / 193</span>
              <button
                type="button"
                className="app-panel-mobile-bar__close"
                onClick={openMapView}
                aria-label="Voltar ao mapa"
              >
                Fechar
              </button>
            </div>
          </div>
          <div className="app-left__tabs" role="tablist" aria-label="Painéis da central">
            <button
              type="button"
              role="tab"
              className={`app-left__tab${leftTab === 'ocorrencias' ? ' is-active' : ''}`}
              aria-selected={leftTab === 'ocorrencias'}
              onClick={() => setLeftTab('ocorrencias')}
            >
              <span className="app-left__tab-ico" aria-hidden>
                📡
              </span>
              Ocorrências
              {waitingIncidents > 0 && <em>{waitingIncidents}</em>}
            </button>
            <button
              type="button"
              role="tab"
              className={`app-left__tab${leftTab === 'civil' ? ' is-active' : ''}`}
              aria-selected={leftTab === 'civil'}
              onClick={() => setLeftTab('civil')}
            >
              <span className="app-left__tab-ico" aria-hidden>
                ⚖
              </span>
              Polícia Civil
              {activeCivilCases > 0 && <em>{activeCivilCases}</em>}
            </button>
          </div>
          {leftTab === 'ocorrencias' ? (
            <DispatchPanel
              incidents={incidents}
              units={units}
              bases={CITY_BASES}
              onOpenIncident={(id) => {
                setOverlay({ kind: 'incident_dash', incidentId: id });
                const inc = incidents.find((i) => i.id === id);
                if (inc) setFocusLocation(inc.location);
                openMapView();
              }}
            />
          ) : (
            <CivilPolicePanel
              cases={civilCases}
              activeTab={civilTab}
              onTabChange={setCivilTab}
              onFocusCase={(caseId) => {
                const c = civilCases.find((x) => x.id === caseId);
                if (c) setFocusLocation([...c.location]);
                openMapView();
              }}
            />
          )}
        </div>
        <main className="app-map">
          {!started && <StartScreen onStart={() => setStarted(true)} />}
          {started && (
            <div
              className={`ai-status-pill${aiAutonomous ? '' : ' ai-status-pill--off'}`}
              role="status"
              aria-live="polite"
            >
              <span className="ai-status-pill__dot" aria-hidden />
              {aiAutonomous
                ? 'IA tática ativa — guarnições resolvem sozinhas no local'
                : 'IA off — controle manual das ações'}
            </div>
          )}
          {started && aiAutonomous && (
            <AiOpsFeed
              events={aiOpsEvents}
              onDismiss={(id) => setAiOpsEvents((prev) => prev.filter((e) => e.id !== id))}
            />
          )}
          {ringingIncident && (
            <RingingOverlay
              onAnswer={answerCall}
              incident={ringingIncident}
              secondsLeft={ringSecondsLeft}
            />
          )}
          {currentAlert && (
            <IncidentAlertBanner
              incident={currentAlert}
              onDismiss={dismissAlert}
              onOpen={(inc) => {
                dismissAlert();
                setOverlay({ kind: 'incident_dash', incidentId: inc.id });
                setFocusLocation([...inc.location]);
              }}
            />
          )}
          {pickBanner && (
            <MapPickBanner title={pickBanner.title} subtitle={pickBanner.subtitle} onCancel={cancelMapPick} />
          )}
          {dashIncident && (
            <IncidentDashboard
              incident={dashIncident}
              units={units}
              bases={CITY_BASES}
              onClose={() => setOverlay(null)}
              onDispatch={(u, i) => void handleDispatch(u, i, 3)}
              onIgnore={handleIgnoreIncident}
              onDiscard={handleDiscardIncident}
              onFocusMap={(inc) => setFocusLocation([...inc.location])}
            />
          )}

          {selectedBase && !overlay && !mapPick && (
            <BaseRosterPanel
              base={selectedBase}
              units={units}
              onClose={() => setSelectedBaseId(null)}
              draftActive={!!draft}
              onAddToDraft={toggleDraftUnit}
              onSelectUnit={(unitId) => setOverlay({ kind: 'unit_menu', unitId })}
            />
          )}

          {overlay?.kind === 'unit_menu' && overlayUnit && (
            <UnitActionMenu
              unit={overlayUnit}
              onClose={() => setOverlay(null)}
              onAction={(action) => handleUnitAction(overlayUnit.id, action)}
            />
          )}

          {overlay?.kind === 'unit_detail' && overlayUnit && (
            <UnitDetailPanel
              unit={overlayUnit}
              incidents={incidents}
              operations={operations}
              bases={CITY_BASES}
              following={followUnitId === overlayUnit.id}
              onClose={() => setOverlay(null)}
              onToggleFollow={() => {
                setFollowUnitId((prev) => (prev === overlayUnit.id ? null : overlayUnit.id));
                setFocusLocation(null);
              }}
              onSendSupport={(incidentId) => {
                // interrompe patrulha/operação e vai em apoio (código 3)
                void handleDispatch(overlayUnit.id, incidentId, 3);
                setOverlay(null);
                setFocusLocation(
                  incidents.find((i) => i.id === incidentId)?.location
                    ? ([...incidents.find((i) => i.id === incidentId)!.location] as LatLng)
                    : null
                );
              }}
              onOpenActions={() => {
                if (
                  overlayUnit.assignedIncidentId &&
                  (overlayUnit.status === 'no_local' ||
                    overlayUnit.status === 'em_operacao' ||
                    overlayUnit.pendingDecision === 'chegada' ||
                    overlayUnit.pendingDecision === 'acoes_local' ||
                    (overlayUnit.status === 'aguardando_decisao' &&
                      overlayUnit.pendingDecision &&
                      overlayUnit.pendingDecision !== 'disposicao'))
                ) {
                  setUnits((prev) =>
                    prev.map((u) =>
                      u.id === overlayUnit.id &&
                      u.pendingDecision !== 'hospital' &&
                      u.pendingDecision !== 'policia' &&
                      u.pendingDecision !== 'civil' &&
                      u.pendingDecision !== 'disposicao'
                        ? {
                            ...u,
                            pendingDecision: u.pendingDecision === 'chegada' ? 'chegada' : 'acoes_local',
                          }
                        : u
                    )
                  );
                  openUnitDecision(overlayUnit.id);
                } else if (overlayUnit.status === 'disponivel') {
                  setOverlay({ kind: 'unit_menu', unitId: overlayUnit.id });
                } else if (overlayUnit.status === 'aguardando_decisao' && overlayUnit.pendingDecision) {
                  openUnitDecision(overlayUnit.id);
                }
              }}
            />
          )}

          {followUnitId && (
            <div className="follow-banner" role="status">
              <span>
                Seguindo{' '}
                <strong>{units.find((u) => u.id === followUnitId)?.label ?? 'viatura'}</strong>
              </span>
              <button type="button" onClick={() => setFollowUnitId(null)}>
                Parar
              </button>
            </div>
          )}

          {overlay?.kind === 'realocar' && overlayUnit && (
            <BasePickerSheet
              unit={overlayUnit}
              bases={CITY_BASES}
              onClose={() => setOverlay(null)}
              onPick={(base) => void handleRealocar(overlayUnit.id, base)}
            />
          )}

          {overlay?.kind === 'support_code' && overlayUnit && supportIncident && (
            <SupportCodeSheet
              unit={overlayUnit}
              incident={supportIncident}
              onClose={() => setOverlay(null)}
              onSelectCode={(code) => void handleSupportCode(overlayUnit.id, supportIncident.id, code)}
            />
          )}

          {overlay?.kind === 'unit_decision' && overlayUnit && (
            <UnitDecisionSheet
              unit={overlayUnit}
              bases={CITY_BASES}
              allUnits={units}
              incident={
                overlayUnit.assignedIncidentId
                  ? incidents.find((i) => i.id === overlayUnit.assignedIncidentId) ?? null
                  : null
              }
              onClose={() => setOverlay(null)}
              onHospital={(hospitalId) => void handleHospitalTransport(overlayUnit.id, hospitalId)}
              onPoliceAction={(action) => void handlePoliceDecision(overlayUnit.id, action)}
              onCivilAction={(action) => handleCivilAction(overlayUnit.id, action)}
              onDisposition={(action) => handleDisposition(overlayUnit.id, action)}
              onSceneAction={(action) => handleSceneAction(overlayUnit.id, action)}
            />
          )}

          {overlay?.kind === 'scene_interview' && overlayUnit && interviewIncident && activeInterview && (
            <SceneInterviewPanel
              unit={overlayUnit}
              incident={interviewIncident}
              session={activeInterview}
              onSessionChange={(next) =>
                setInterviewSessions((prev) => ({
                  ...prev,
                  [`${overlay.unitId}:${overlay.incidentId}`]: next,
                }))
              }
              onFinishApuracao={(done) =>
                setInterviewSessions((prev) => ({
                  ...prev,
                  [`${overlay.unitId}:${overlay.incidentId}`]: done,
                }))
              }
              onPostAction={(actionId) =>
                handlePostInterviewAction(overlay.unitId, overlay.incidentId, actionId)
              }
              onClose={() => setOverlay(null)}
            />
          )}

          <CityMap
            units={units}
            incidents={incidents}
            blinkingIds={blinkingIds}
            focusLocation={focusLocation ?? currentAlert?.location ?? null}
            followUnitId={followUnitId}
            operations={operations}
            pickingLocation={mapPickActive}
            onPickLocation={pickLocation}
            pendingLocation={draft?.location ?? null}
            pendingRadiusMeters={
              draft && isPatrolOperationType(draft.type) ? draft.radiusMeters : undefined
            }
            bases={CITY_BASES}
            onSelectBase={(id) => {
              if (mapPick) return;
              setSelectedBaseId(id);
              setOverlay(null);
              openMapView();
            }}
            incidentSelectMode={incidentSelectMode}
            onSelectIncident={handleSelectIncidentForSupport}
            onSelectUnit={(unitId) => {
              handleSelectUnitOnMap(unitId);
              openMapView();
            }}
            trafficRef={trafficRef}
            layoutKey={mobileView}
          />
        </main>
        <aside className="app-ops" id="app-ops-panel" aria-label="Operações">
          <div className="app-panel-mobile-bar">
            <span className="app-panel-mobile-bar__handle" aria-hidden />
            <div className="app-panel-mobile-bar__row">
              <span className="app-panel-mobile-bar__title">Operações</span>
              <button
                type="button"
                className="app-panel-mobile-bar__close"
                onClick={openMapView}
                aria-label="Voltar ao mapa"
              >
                Fechar
              </button>
            </div>
          </div>
          <OperationsPanel
            units={units}
            bases={CITY_BASES}
            operations={operations}
            draft={draft}
            picking={picking}
            patrolEvents={patrolEvents}
            onStartPreset={(preset) => {
              startPreset(preset);
              openMapView();
            }}
            onStartPicking={() => {
              setPicking(true);
              openMapView();
            }}
            onUpdateDraft={updateDraft}
            onToggleUnit={toggleDraftUnit}
            onLaunch={() => void launchOperation()}
            onCancelDraft={cancelDraft}
            onCancelOperation={cancelOperation}
          />
        </aside>
      </div>

      <nav className="app-mobile-nav" aria-label="Navegação principal">
        <button
          type="button"
          className={`app-mobile-nav__btn${mobileView === 'ocorrencias' ? ' is-active' : ''}`}
          onClick={() =>
            setMobileView((v) => (v === 'ocorrencias' ? 'mapa' : 'ocorrencias'))
          }
          aria-current={mobileView === 'ocorrencias' ? 'page' : undefined}
        >
          <span className="app-mobile-nav__icon" aria-hidden>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" strokeLinecap="round" />
            </svg>
          </span>
          <span className="app-mobile-nav__label">Central</span>
          {waitingIncidents + activeCivilCases > 0 && (
            <em className="app-mobile-nav__badge">{waitingIncidents + activeCivilCases}</em>
          )}
        </button>
        <button
          type="button"
          className={`app-mobile-nav__btn app-mobile-nav__btn--map${mobileView === 'mapa' ? ' is-active' : ''}`}
          onClick={() => setMobileView('mapa')}
          aria-current={mobileView === 'mapa' ? 'page' : undefined}
        >
          <span className="app-mobile-nav__icon" aria-hidden>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M9 4l-5 2v14l5-2 6 2 5-2V4l-5 2-6-2z" strokeLinejoin="round" />
              <path d="M9 4v14M15 6v14" strokeLinecap="round" />
            </svg>
          </span>
          <span className="app-mobile-nav__label">Mapa</span>
        </button>
        <button
          type="button"
          className={`app-mobile-nav__btn${mobileView === 'operacoes' ? ' is-active' : ''}`}
          onClick={() => setMobileView((v) => (v === 'operacoes' ? 'mapa' : 'operacoes'))}
          aria-current={mobileView === 'operacoes' ? 'page' : undefined}
        >
          <span className="app-mobile-nav__icon" aria-hidden>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="app-mobile-nav__label">Ops</span>
          {activeOps > 0 && <em className="app-mobile-nav__badge">{activeOps}</em>}
        </button>
      </nav>
    </div>
  );
}

export default App;

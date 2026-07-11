import type { CityBase } from '../types/city';
import type { Incident, Operation, Unit } from '../types/game';
import { haversineDistanceMeters } from './geo';
import {
  LABEL_BY_INCIDENT_TYPE,
  LABEL_BY_OPERATION_TYPE,
  LABEL_BY_UNIT_STATUS,
  LABEL_BY_UNIT_TYPE,
  LABEL_BY_ZONE,
} from './labels';
import { formatServiceRemaining } from './fireTeams';
import { isCivilPoliceUnit } from './civilPolice';

export interface UnitDetailInfo {
  headline: string;
  statusLabel: string;
  typeLabel: string;
  department: string;
  codeLabel: string | null;
  missionLabel: string | null;
  /** Para onde a unidade se desloca agora. */
  destination: {
    title: string;
    detail: string;
    coords: string | null;
  } | null;
  /** Progresso da rota 0–100. */
  routeProgressPct: number | null;
  etaLabel: string | null;
  /** Paciente / preso / carga tática. */
  cargo: {
    kind: 'paciente' | 'preso' | 'nenhum';
    title: string;
    reason: string | null;
  };
  /** Ocorrência vinculada. */
  incident: {
    title: string;
    typeLabel: string;
    zone: string | null;
    priority: number;
    status: string;
    snippet: string;
  } | null;
  /** Operação tática vinculada. */
  operation: {
    title: string;
    typeLabel: string;
  } | null;
  /** Papel no local (APH, extricação…). */
  service: {
    role: string;
    remaining: string | null;
  } | null;
  /** Dicas de ação / flags. */
  flags: string[];
  pendingHint: string | null;
}

function fmtCoords(pos: [number, number] | undefined | null): string | null {
  if (!pos) return null;
  return `${pos[0].toFixed(5)}, ${pos[1].toFixed(5)}`;
}

function nearestBase(point: [number, number], bases: CityBase[], maxM = 120): CityBase | null {
  let best: CityBase | null = null;
  let bestD = maxM;
  for (const b of bases) {
    const d = haversineDistanceMeters(point, b.location);
    if (d < bestD) {
      bestD = d;
      best = b;
    }
  }
  return best;
}

function missionLabel(unit: Unit): string | null {
  switch (unit.mission) {
    case 'despacho':
      return 'Despacho para ocorrência';
    case 'apoio_ocorrencia':
      return 'Apoio em ocorrência';
    case 'patrulha':
      return 'Patrulhamento / circuito';
    case 'ponto_estrategico':
      return 'Ponto estratégico';
    case 'deslocamento':
      return 'Deslocamento';
    case 'realocacao':
      return 'Realocação de base';
    default:
      if (unit.status === 'levando_preso') return 'Condução de preso';
      if (unit.status === 'retornando') return 'Retorno à base';
      if (unit.operationId) return 'Em operação tática';
      if (unit.assignedIncidentId) return 'Vinculada à ocorrência';
      return null;
  }
}

function inferCargo(
  unit: Unit,
  incident: Incident | null,
  bases: CityBase[]
): UnitDetailInfo['cargo'] {
  if (unit.status === 'levando_preso') {
    const reason =
      incident?.title ??
      unit.pendingIncidentTitle?.replace(/^.*?—\s*/, '') ??
      'Condução após flagrante / ocorrência policial';
    return {
      kind: 'preso',
      title: 'Com preso a bordo',
      reason: `Motivo aparente: ${reason}`,
    };
  }

  // transporte hospitalar (bombeiro/ambulância a caminho de hospital)
  if (
    (unit.type === 'bombeiro' || unit.type === 'ambulancia') &&
    unit.status === 'a_caminho' &&
    unit.route &&
    unit.route.length > 0
  ) {
    const end = unit.route[unit.route.length - 1];
    const hosp = nearestBase(end, bases.filter((b) => b.unitType === 'ambulancia' || /hospital|uai|upa|pronto/i.test(b.name)), 200);
    if (hosp || unit.pendingDecision === 'hospital' || unit.mission === 'deslocamento') {
      if (hosp || /hospital|uai|upa/i.test(unit.pendingIncidentTitle ?? '')) {
        return {
          kind: 'paciente',
          title: 'Com paciente / vítima a bordo',
          reason: incident
            ? `Origem: ${incident.title}`
            : unit.pendingIncidentTitle ?? 'Transporte para unidade de saúde',
        };
      }
    }
  }

  if (
    (unit.type === 'bombeiro' || unit.type === 'ambulancia') &&
    (unit.serviceRole === 'aph' || unit.pendingDecision === 'hospital')
  ) {
    return {
      kind: 'paciente',
      title: unit.pendingDecision === 'hospital' ? 'Aguardando remoção hospitalar' : 'Atendimento a vítima no local',
      reason: incident?.title ?? unit.pendingIncidentTitle ?? null,
    };
  }

  if (unit.type === 'viatura' && incident && /preso|prisão|flagrante|conduz/i.test(unit.pendingIncidentTitle ?? '')) {
    return {
      kind: 'preso',
      title: 'Situação com detido / condução',
      reason: incident.title,
    };
  }

  return { kind: 'nenhum', title: 'Sem carga especial', reason: null };
}

function destinationFor(
  unit: Unit,
  incident: Incident | null,
  operation: Operation | null,
  bases: CityBase[]
): UnitDetailInfo['destination'] {
  const end = unit.route && unit.route.length > 0 ? unit.route[unit.route.length - 1] : null;
  const coords = fmtCoords(end);

  if (unit.status === 'retornando') {
    const base = bases.find((b) => b.id === unit.baseId);
    return {
      title: base?.name ?? 'Base de origem',
      detail: 'Retornando ao quartel / delegacia',
      coords: fmtCoords(unit.base),
    };
  }

  if (unit.status === 'levando_preso') {
    const destBase = end ? nearestBase(end, bases, 250) : null;
    return {
      title: destBase?.name ?? 'Delegacia',
      detail: 'Conduzindo preso para a autoridade policial',
      coords,
    };
  }

  if (unit.status === 'a_caminho' || unit.status === 'em_operacao') {
    if (incident && (unit.mission === 'despacho' || unit.mission === 'apoio_ocorrencia' || unit.assignedIncidentId)) {
      const place = incident.description.match(/Local:\s*(.+?)\./)?.[1];
      return {
        title: incident.title,
        detail: place
          ? `Ocorrência · ${place}`
          : `Ocorrência · ${LABEL_BY_INCIDENT_TYPE[incident.type]}${incident.zone ? ` · ${LABEL_BY_ZONE[incident.zone]}` : ''}`,
        coords: coords ?? fmtCoords(incident.location),
      };
    }

    if (operation) {
      return {
        title: operation.title,
        detail: `${LABEL_BY_OPERATION_TYPE[operation.type]} · setor da operação`,
        coords: coords ?? fmtCoords(operation.location),
      };
    }

    if (unit.mission === 'patrulha' && unit.patrolLoopCenter) {
      return {
        title: 'Setor de patrulha',
        detail: unit.patrolLoopRadius
          ? `Circuito ~${Math.round(unit.patrolLoopRadius)} m de raio`
          : 'Circuito de patrulhamento',
        coords: fmtCoords(unit.patrolLoopCenter),
      };
    }

    if (unit.mission === 'ponto_estrategico') {
      return {
        title: 'Ponto estratégico',
        detail: 'Posicionamento fixo no local designado',
        coords: coords ?? fmtCoords(unit.position),
      };
    }

    if (end) {
      const near = nearestBase(end, bases, 200);
      if (near) {
        return {
          title: near.name,
          detail: unit.mission === 'deslocamento' ? 'Deslocamento / transporte' : 'Destino no mapa',
          coords,
        };
      }
      return {
        title: 'Destino no mapa',
        detail: 'Deslocamento em andamento',
        coords,
      };
    }
  }

  if (unit.status === 'no_local' || unit.status === 'em_operacao') {
    if (incident) {
      return {
        title: 'No local da ocorrência',
        detail: incident.title,
        coords: fmtCoords(incident.location),
      };
    }
    if (operation) {
      return {
        title: 'No setor da operação',
        detail: operation.title,
        coords: fmtCoords(operation.location),
      };
    }
  }

  if (unit.status === 'disponivel') {
    const base = bases.find((b) => b.id === unit.baseId);
    return {
      title: base?.name ?? 'Na base',
      detail: 'Unidade disponível',
      coords: fmtCoords(unit.base),
    };
  }

  return null;
}

export function buildUnitDetail(
  unit: Unit,
  incidents: Incident[],
  operations: Operation[],
  bases: CityBase[]
): UnitDetailInfo {
  const incident = unit.assignedIncidentId
    ? incidents.find((i) => i.id === unit.assignedIncidentId) ?? null
    : null;
  const operation = unit.operationId
    ? operations.find((o) => o.id === unit.operationId) ?? null
    : null;

  const progress =
    unit.routeProgress !== undefined && unit.route && unit.route.length > 1
      ? Math.round(Math.min(1, Math.max(0, unit.routeProgress)) * 100)
      : null;

  let etaLabel: string | null = null;
  if (
    unit.routeDurationMs &&
    unit.routeStartedAt &&
    unit.routeProgress !== undefined &&
    unit.routeProgress < 1 &&
    (unit.status === 'a_caminho' || unit.status === 'retornando' || unit.status === 'levando_preso')
  ) {
    const left = Math.max(0, unit.routeDurationMs * (1 - unit.routeProgress));
    const sec = Math.ceil(left / 1000);
    etaLabel = sec >= 60 ? `ETA ~${Math.ceil(sec / 60)} min` : `ETA ~${sec}s`;
  }

  const cargo = inferCargo(unit, incident, bases);
  const flags: string[] = [];

  if (unit.responseCode === 3) flags.push('Código 3 — sirene / emergência');
  if (unit.responseCode === 2) flags.push('Código 2 — deslocamento sem sirene');
  if (isCivilPoliceUnit(unit, bases)) flags.push('Polícia Civil');
  if (unit.type === 'bombeiro') flags.push('Corpo de Bombeiros');
  if (unit.mission === 'apoio_ocorrencia') flags.push('Unidade de apoio');
  if (unit.pendingIncidentTitle?.includes('Tarefa concluída')) flags.push('Tarefa no local concluída');

  let pendingHint: string | null = null;
  if (unit.pendingDecision === 'chegada') pendingHint = 'Aguardando ação da guarnição no local';
  else if (unit.pendingDecision === 'hospital') pendingHint = 'Selecionar hospital / UAI para a vítima';
  else if (unit.pendingDecision === 'policia') pendingHint = 'Decisão policial pendente (delegacia, liberar…)';
  else if (unit.pendingDecision === 'civil') pendingHint = 'Decisão da Polícia Civil pendente';
  else if (unit.pendingDecision === 'disposicao') pendingHint = 'Disposição da viatura (base ou deslocar)';

  return {
    headline: unit.label,
    statusLabel: LABEL_BY_UNIT_STATUS[unit.status],
    typeLabel: LABEL_BY_UNIT_TYPE[unit.type],
    department: unit.department,
    codeLabel:
      unit.responseCode === 3 ? 'Cód. 3' : unit.responseCode === 2 ? 'Cód. 2' : null,
    missionLabel: missionLabel(unit),
    destination: destinationFor(unit, incident, operation, bases),
    routeProgressPct: progress,
    etaLabel,
    cargo,
    incident: incident
      ? {
          title: incident.title,
          typeLabel: LABEL_BY_INCIDENT_TYPE[incident.type],
          zone: incident.zone ? LABEL_BY_ZONE[incident.zone] ?? incident.zone : null,
          priority: incident.priority,
          status: incident.status,
          snippet: incident.description.slice(0, 160) + (incident.description.length > 160 ? '…' : ''),
        }
      : null,
    operation: operation
      ? {
          title: operation.title,
          typeLabel: LABEL_BY_OPERATION_TYPE[operation.type],
        }
      : null,
    service:
      unit.serviceRoleLabel
        ? {
            role: unit.serviceRoleLabel,
            remaining:
              unit.serviceEndsAt && unit.serviceEndsAt > Date.now()
                ? formatServiceRemaining(unit.serviceEndsAt)
                : null,
          }
        : null,
    flags,
    pendingHint,
  };
}

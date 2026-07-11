import type { Incident, Unit } from '../types/game';

/**
 * Papéis operacionais do Corpo de Bombeiros em uma ocorrência multi-equipe.
 * Tempos inspirados em atendimento real (comprimidos para o jogo).
 */
export type FireTeamRole =
  | 'aph' // atendimento pré-hospitalar (UR)
  | 'extricacao' // desencarceramento / extricação
  | 'combate_incendio' // ABTS / linha de mangueira
  | 'salvamento' // resgate técnico / confinado / altura
  | 'isolamento' // perímetro, tráfego, segurança
  | 'suporte' // apoio logístico / 2ª equipe
  | 'aquatico'; // resgate aquático

export interface FireRoleSpec {
  role: FireTeamRole;
  label: string;
  /** Duração base em ms (jogo). */
  baseMs: number;
  /** Variação aleatória. */
  jitterMs: number;
  /** Preferência por departamento/label da viatura. */
  preferredFor: RegExp;
}

/** Durações ~ escala de plantão: minutos reais ≈ segundos de jogo × fator. */
const ROLE_SPECS: FireRoleSpec[] = [
  {
    role: 'aph',
    label: 'Atendimento pré-hospitalar (APH)',
    baseMs: 70_000,
    jitterMs: 35_000,
    preferredFor: /ur\s*resgate|resgate|samu/i,
  },
  {
    role: 'extricacao',
    label: 'Extricação / desencarceramento',
    baseMs: 95_000,
    jitterMs: 45_000,
    preferredFor: /ur\s*resgate|resgate|abts/i,
  },
  {
    role: 'combate_incendio',
    label: 'Combate a incêndio',
    baseMs: 120_000,
    jitterMs: 50_000,
    preferredFor: /abts|bomba|tanque/i,
  },
  {
    role: 'salvamento',
    label: 'Salvamento / resgate técnico',
    baseMs: 100_000,
    jitterMs: 40_000,
    preferredFor: /abts|bombeiro/i,
  },
  {
    role: 'isolamento',
    label: 'Isolamento e segurança de via',
    baseMs: 55_000,
    jitterMs: 25_000,
    preferredFor: /bombeiro/i,
  },
  {
    role: 'suporte',
    label: 'Apoio operacional no local',
    baseMs: 50_000,
    jitterMs: 20_000,
    preferredFor: /bombeiro/i,
  },
  {
    role: 'aquatico',
    label: 'Resgate aquático',
    baseMs: 110_000,
    jitterMs: 40_000,
    preferredFor: /bombeiro|abts|ur/i,
  },
];

const PRIORITY_MULT: Record<1 | 2 | 3, number> = {
  1: 1.45,
  2: 1,
  3: 0.7,
};

function has(title: string, re: RegExp): boolean {
  return re.test(title);
}

export function fireRoleLabel(role: FireTeamRole): string {
  return ROLE_SPECS.find((s) => s.role === role)?.label ?? role;
}

export function fireRoleDurationMs(role: FireTeamRole, incident: Incident): number {
  const spec = ROLE_SPECS.find((s) => s.role === role) ?? ROLE_SPECS.find((s) => s.role === 'suporte')!;
  const p = PRIORITY_MULT[incident.priority];
  // acidentes com múltiplas vítimas / ferragem: extricação mais longa
  let extra = 1;
  if (role === 'extricacao' && has(incident.title, /capotamento|ferragem|extric|prisão|preso em/i)) {
    extra = 1.25;
  }
  if (role === 'combate_incendio' && has(incident.title, /estrutural|galpão|galpao|prédio|predio/i)) {
    extra = 1.3;
  }
  if (role === 'aph' && has(incident.title, /múltiplas|multiplas|várias vítimas|varias vitimas/i)) {
    extra = 1.2;
  }
  const ms = (spec.baseMs * p * extra + Math.random() * spec.jitterMs) | 0;
  return Math.max(40_000, ms);
}

/** Papéis úteis para esta ocorrência (ordem de prioridade). */
export function neededRolesForIncident(incident: Incident): FireTeamRole[] {
  const t = incident.title;
  const roles: FireTeamRole[] = [];

  if (incident.type === 'incendio' || has(t, /incêndio|incendio|fumaça|fumaca|queimada|gás|gas|explos/i)) {
    roles.push('combate_incendio', 'isolamento', 'salvamento', 'aph', 'suporte');
  } else if (has(t, /afog|rio|água|agua|correnteza|embarcação|embarcacao/i)) {
    roles.push('aquatico', 'aph', 'isolamento', 'suporte');
  } else if (
    has(t, /acidente|colisão|colisao|capotamento|atropelamento|trânsito|transito|ferragem|extric/i)
  ) {
    // acidente de trânsito típico multi-equipe
    roles.push('aph', 'extricacao', 'isolamento', 'suporte', 'salvamento');
  } else if (has(t, /resgate|salvamento|preso|confinado|elevador|altura|poço|poco/i)) {
    roles.push('salvamento', 'aph', 'isolamento', 'suporte');
  } else if (incident.type === 'samu' || has(t, /mal súbito|parada|AVC|trauma|ferida|parto/i)) {
    roles.push('aph', 'suporte', 'isolamento');
  } else {
    roles.push('suporte', 'aph', 'isolamento');
  }

  return roles;
}

function unitTag(unit: Unit): string {
  return `${unit.department} ${unit.label}`;
}

/**
 * Escolhe o melhor papel livre para a viatura, conforme tipo (UR/ABTS/geral)
 * e o que já está coberto no local.
 */
export function pickFireRoleForUnit(
  unit: Unit,
  incident: Incident,
  alreadyAssigned: FireTeamRole[]
): FireTeamRole {
  const needed = neededRolesForIncident(incident);
  const free = needed.filter((r) => !alreadyAssigned.includes(r));
  const pool = free.length > 0 ? free : needed;
  const tag = unitTag(unit);

  // UR Resgate: prioriza APH e extricação
  if (/ur\s*resgate|resgate/i.test(tag)) {
    for (const r of ['aph', 'extricacao', 'salvamento'] as FireTeamRole[]) {
      if (pool.includes(r)) return r;
    }
  }
  // ABTS: combate, salvamento, extricação
  if (/abts|bomba|tanque/i.test(tag)) {
    for (const r of ['combate_incendio', 'extricacao', 'salvamento', 'isolamento'] as FireTeamRole[]) {
      if (pool.includes(r)) return r;
    }
  }

  // melhor match por preferredFor
  for (const role of pool) {
    const spec = ROLE_SPECS.find((s) => s.role === role);
    if (spec?.preferredFor.test(tag)) return role;
  }

  return pool[0] ?? 'suporte';
}

/** Mapeia ação de cena → papel de bombeiro. */
export function fireRoleFromSceneActionId(actionId: string): FireTeamRole | null {
  switch (actionId) {
    case 'combate':
    case 'combate_fogo':
      return 'combate_incendio';
    case 'evacuar':
    case 'isolar_incendio':
    case 'isolar_via':
    case 'isolamento':
      return 'isolamento';
    case 'resgate':
    case 'extricacao':
    case 'rescate_aquatico':
      return actionId === 'rescate_aquatico' ? 'aquatico' : actionId === 'resgate' ? 'salvamento' : 'extricacao';
    case 'estabilizar':
    case 'socorro':
    case 'aph':
    case 'atender_bm':
      return 'aph';
    case 'suporte_bm':
      return 'suporte';
    default:
      return null;
  }
}

export function formatServiceRemaining(endsAt: number, now = Date.now()): string {
  const s = Math.max(0, Math.ceil((endsAt - now) / 1000));
  if (s >= 60) {
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}m${r.toString().padStart(2, '0')}s`;
  }
  return `${s}s`;
}

export function isFireServiceUnit(unit: Unit): boolean {
  return unit.type === 'bombeiro' || unit.type === 'ambulancia';
}

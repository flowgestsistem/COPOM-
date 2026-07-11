import type { Incident, IncidentLogEntry, Unit } from '../types/game';
import { pickOne } from './random';

export type IncidentCaller =
  | 'vitima'
  | 'testemunha'
  | 'anonimo'
  | 'alarme'
  | 'camera'
  | 'policial'
  | 'hospital'
  | 'comercio';

export type IncidentTag =
  | 'violencia'
  | 'arma'
  | 'transito'
  | 'drogas'
  | 'patrimonio'
  | 'domestica'
  | 'pessoa'
  | 'rural'
  | 'incendio'
  | 'medico'
  | 'aquatico'
  | 'ordem'
  | 'flagrante';

const CALLER_LABEL: Record<IncidentCaller, string> = {
  vitima: 'Vítima',
  testemunha: 'Testemunha',
  anonimo: 'Denúncia anônima',
  alarme: 'Alarme / central de segurança',
  camera: 'Câmera / monitoramento',
  policial: 'Guarnição / ronda',
  hospital: 'Unidade de saúde',
  comercio: 'Comerciante / estabelecimento',
};

export function callerLabel(c: IncidentCaller): string {
  return CALLER_LABEL[c] ?? c;
}

export function tagLabel(tag: IncidentTag): string {
  const map: Record<IncidentTag, string> = {
    violencia: 'Violência',
    arma: 'Arma',
    transito: 'Trânsito',
    drogas: 'Entorpecentes',
    patrimonio: 'Patrimônio',
    domestica: 'Doméstica',
    pessoa: 'Pessoa',
    rural: 'Rural',
    incendio: 'Incêndio',
    medico: 'Médica',
    aquatico: 'Aquático',
    ordem: 'Ordem pública',
    flagrante: 'Flagrante',
  };
  return map[tag] ?? tag;
}

function has(title: string, re: RegExp): boolean {
  return re.test(title);
}

/** Tags derivadas do título — guiam ações e realismo. */
export function tagsFromTitle(title: string, type: Incident['type']): IncidentTag[] {
  const tags = new Set<IncidentTag>();
  if (type === 'incendio') tags.add('incendio');
  if (type === 'samu') tags.add('medico');

  if (has(title, /roubo|assalto|furto|arrombamento|invasão|invasao|vandalismo|pichação|pichacao|fios|estelionato|golpe|lotérica|loterica|farmácia|farmacia/i)) {
    tags.add('patrimonio');
  }
  if (has(title, /briga|agressão|agressao|vias de fato|tumulto|desordem|sequestro|cárcere|carcere/i)) {
    tags.add('violencia');
  }
  if (has(title, /disparo|arma|tiroteio|armada|armado/i)) tags.add('arma');
  if (has(title, /trânsito|transito|colisão|colisao|capotamento|atropelamento|acidente|embriaguez|direção|direcao|corrida|rodovia|via/i)) {
    tags.add('transito');
  }
  if (has(title, /tráfico|trafico|drogas|entorpecente/i)) tags.add('drogas');
  if (has(title, /doméstica|domestica|medida protetiva|ameaça|ameaca/i)) tags.add('domestica');
  if (has(title, /desaparecida|menor|abandonado|suicídio|suicidio|surto|cadáver|cadaver|corpo|homicídio|homicidio/i)) {
    tags.add('pessoa');
  }
  if (has(title, /fazenda|sítio|sitio|rural|gado|curral|vicinal|pasto/i)) tags.add('rural');
  if (has(title, /afog|rio|água|agua|correnteza|embarcação|embarcacao/i)) tags.add('aquatico');
  if (has(title, /perturbação|perturbacao|som alto|manifestação|manifestacao|fila|festa/i)) {
    tags.add('ordem');
  }
  if (has(title, /mal súbito|mal subito|parada|AVC|convuls|parto|trauma|hemorragia|ferida/i)) {
    tags.add('medico');
  }
  if (has(title, /incêndio|incendio|fumaça|fumaca|queimada|gás|gas|explos/i)) tags.add('incendio');

  if (tags.size === 0) {
    if (type === 'policia') tags.add('ordem');
    if (type === 'samu') tags.add('medico');
    if (type === 'incendio') tags.add('incendio');
  }
  return [...tags];
}

export function pickCaller(title: string, type: Incident['type']): IncidentCaller {
  if (type === 'samu' || has(title, /mal súbito|parto|AVC|parada|trauma/i)) {
    return pickOne(['vitima', 'testemunha', 'hospital', 'anonimo'] as IncidentCaller[]);
  }
  if (type === 'incendio' || has(title, /incêndio|incendio|fumaça|fumaca|alarme/i)) {
    return pickOne(['alarme', 'testemunha', 'comercio', 'anonimo'] as IncidentCaller[]);
  }
  if (has(title, /roubo|assalto|furto|lotérica|loja|comércio|comercio|farmácia/i)) {
    return pickOne(['vitima', 'comercio', 'camera', 'alarme'] as IncidentCaller[]);
  }
  if (has(title, /doméstica|domestica|medida/i)) {
    return pickOne(['vitima', 'anonimo', 'testemunha'] as IncidentCaller[]);
  }
  if (has(title, /trânsito|transito|colisão|acidente|atropelamento/i)) {
    return pickOne(['vitima', 'testemunha', 'policial', 'camera'] as IncidentCaller[]);
  }
  if (has(title, /disparo|tiroteio|armada/i)) {
    return pickOne(['anonimo', 'testemunha', 'camera', 'policial'] as IncidentCaller[]);
  }
  return pickOne(['anonimo', 'testemunha', 'vitima', 'policial', 'camera'] as IncidentCaller[]);
}

export function estimateVictims(title: string, type: Incident['type']): number {
  if (has(title, /sem vítima|sem vitima|falso|improcedente|placa|veículo abandonado|veiculo abandonado|som alto|perturbação|perturbacao/i)) {
    return 0;
  }
  if (has(title, /acidente|colisão|colisao|capotamento|atropelamento|tiroteio|explos|incêndio|incendio/i)) {
    return 1 + Math.floor(Math.random() * 3);
  }
  if (type === 'samu' || has(title, /vítima|vitima|ferida|mal súbito|parto|trauma/i)) {
    return 1 + (Math.random() < 0.25 ? 1 : 0);
  }
  if (has(title, /briga|tumulto|torcida/i)) return 1 + Math.floor(Math.random() * 2);
  return Math.random() < 0.55 ? 1 : 0;
}

export function estimateSuspects(title: string): number {
  if (has(title, /assalto|roubo|tráfico|trafico|armada|tiroteio|sequestro|invasão|invasao/i)) {
    return 1 + Math.floor(Math.random() * 2);
  }
  if (has(title, /briga|agressão|agressao|doméstica|domestica|ameaça|ameaca/i)) return 1;
  if (has(title, /furto|arrombamento|pichação|vandalismo/i)) return Math.random() < 0.6 ? 1 : 0;
  return 0;
}

export function isArmedFromTitle(title: string): boolean {
  return /arma|armada|armado|disparo|tiroteio|assalto a mão armada|assalto a mao armada/i.test(title);
}

/** Número de protocolo estilo COPOM (ex.: 2026-041287). */
export function makeProtocolNumber(createdAt = Date.now()): string {
  const d = new Date(createdAt);
  const y = d.getFullYear();
  const seq = String(Math.floor(Math.random() * 900000) + 100000);
  return `${y}-${seq}`;
}

export function makeLogEntry(
  text: string,
  kind: IncidentLogEntry['kind'] = 'sistema'
): IncidentLogEntry {
  return {
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    at: Date.now(),
    text,
    kind,
  };
}

export function appendIncidentLog(incident: Incident, text: string, kind: IncidentLogEntry['kind'] = 'sistema'): Incident {
  const entry = makeLogEntry(text, kind);
  const log = [...(incident.log ?? []), entry].slice(-40);
  return { ...incident, log };
}

/** Enriquecimento aplicado na geração da ocorrência. */
export function enrichIncident(incident: Incident): Incident {
  const tags = tagsFromTitle(incident.title, incident.type);
  const caller = pickCaller(incident.title, incident.type);
  const victimCount = estimateVictims(incident.title, incident.type);
  const suspectCount = estimateSuspects(incident.title);
  const armed = isArmedFromTitle(incident.title);
  const protocolNumber = makeProtocolNumber(incident.createdAt);

  const bits: string[] = [];
  bits.push(`Protocolo ${protocolNumber}`);
  bits.push(`Solicitante: ${callerLabel(caller)}`);
  if (victimCount > 0) bits.push(victimCount === 1 ? '1 vítima relatada' : `${victimCount} vítimas relatadas`);
  if (suspectCount > 0) bits.push(suspectCount === 1 ? '1 suspeito' : `${suspectCount} suspeitos`);
  if (armed) bits.push('Informação de arma de fogo');
  if (incident.zone) bits.push(`Zona ${incident.zone}`);

  const detailLine = bits.join(' · ');
  const description = incident.description.includes('Protocolo')
    ? incident.description
    : `${incident.description} ${detailLine}.`;

  const log: IncidentLogEntry[] = [
    makeLogEntry(`Chamado recebido — ${incident.title}`, 'sistema'),
    makeLogEntry(`${detailLine}`, 'sistema'),
  ];

  return {
    ...incident,
    description,
    tags,
    caller,
    victimCount,
    suspectCount,
    armed,
    protocolNumber,
    log,
  };
}

export interface ActionOutcome {
  note: string;
  scoreBonus: number;
  /** Próximo fluxo sugerido após a tarefa. */
  nextDecision?: 'policia' | 'hospital' | 'disposicao' | 'acoes_local';
  forcePreserve?: boolean;
  forceCivil?: boolean;
}

/** Resultado narrativo ao concluir uma ação no local. */
export function outcomeForCompletedAction(
  action: { id: string; title: string; effect: string },
  incident: Incident,
  unit: Unit
): ActionOutcome {
  const id = action.id;

  if (action.effect === 'resolve_light' || id === 'nada_consta' || id === 'sem_risco') {
    return {
      note: `${unit.label}: ocorrência improcedente / sem providências — liberado o local.`,
      scoreBonus: 15,
      nextDecision: 'disposicao',
    };
  }

  if (action.effect === 'delegacia' || id.includes('conduzir') || id === 'flagrante' || id === 'prisao_flagrante') {
    return {
      note: `${unit.label}: flagrante / condução à autoridade policial iniciada.`,
      scoreBonus: 80,
      nextDecision: 'policia',
    };
  }

  if (action.effect === 'hospital' || id.includes('hospital')) {
    return {
      note: `${unit.label}: vítima estabilizada — encaminhamento a unidade de saúde.`,
      scoreBonus: 60,
      nextDecision: 'hospital',
    };
  }

  if (id === 'preservar' || id === 'isolar_crime' || action.effect === 'start_service_preserve') {
    return {
      note: `${unit.label}: local isolado e preservado para perícia / PC.`,
      scoreBonus: 45,
      forcePreserve: true,
      forceCivil: true,
      nextDecision: 'acoes_local',
    };
  }

  if (id === 'bo_local' || id === 'registrar_bo') {
    const bo = `BO-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 90000) + 10000)}`;
    return {
      note: `${unit.label}: B.O. nº ${bo} lavrado no local (sem condução).`,
      scoreBonus: 55,
      nextDecision: 'disposicao',
    };
  }

  if (id === 'identificar' || id === 'identificacao' || id === 'abordar' || id === 'abordagem_veiculo') {
    const ok = Math.random() < 0.72;
    return {
      note: ok
        ? `${unit.label}: identificação realizada — documentos em ordem / nada consta.`
        : `${unit.label}: irregularidade na identificação — aprofundar abordagem.`,
      scoreBonus: ok ? 30 : 50,
      nextDecision: ok ? 'acoes_local' : 'policia',
    };
  }

  if (id === 'revistar' || id === 'apreender') {
    const hit = Math.random() < 0.4;
    return {
      note: hit
        ? `${unit.label}: material ilícito apreendido — registrar e conduzir.`
        : `${unit.label}: revista concluída — nada de ilícito encontrado.`,
      scoreBonus: hit ? 70 : 25,
      nextDecision: hit ? 'policia' : 'acoes_local',
    };
  }

  if (id === 'conter' || id === 'isolar' || id === 'area_segura' || id === 'perimetro' || id === 'sinalizar') {
    return {
      note: `${unit.label}: perímetro/controle restabelecido no local.`,
      scoreBonus: 35,
      nextDecision: 'acoes_local',
    };
  }

  if (id === 'proteger' || id === 'cumprir_medida') {
    return {
      note: `${unit.label}: vítima acolhida; medidas de proteção aplicadas no local.`,
      scoreBonus: 65,
      nextDecision: Math.random() < 0.45 ? 'policia' : 'acoes_local',
    };
  }

  if (id === 'busca_area' || id === 'buscar_suspeito') {
    const found = Math.random() < 0.35;
    return {
      note: found
        ? `${unit.label}: suspeito localizado nas imediações — iniciar abordagem.`
        : `${unit.label}: varredura sem localização do suspeito — ampliar cerco.`,
      scoreBonus: found ? 75 : 30,
      nextDecision: found ? 'policia' : 'acoes_local',
    };
  }

  if (id === 'laudo' || id === 'croqui' || id === 'fotos_local') {
    return {
      note: `${unit.label}: documentação do local (fotos/croqui) concluída.`,
      scoreBonus: 40,
      nextDecision: 'acoes_local',
    };
  }

  if (id === 'orientar' || id === 'mediacao') {
    return {
      note: `${unit.label}: orientação / mediação realizada — partes acalmadas.`,
      scoreBonus: 40,
      nextDecision: 'disposicao',
    };
  }

  if (id === 'testemunhas' || id === 'depoimentos') {
    return {
      note: `${unit.label}: testemunhas identificadas e contatos registrados.`,
      scoreBonus: 35,
      nextDecision: 'acoes_local',
    };
  }

  if (action.effect === 'request_support' || id.includes('reforco')) {
    return {
      note: `${unit.label}: reforço solicitado e situação estabilizada aguardando apoio.`,
      scoreBonus: 20,
      nextDecision: 'acoes_local',
    };
  }

  if (action.effect === 'fire_role' || unit.type === 'bombeiro') {
    return {
      note: `${unit.label}: ${action.title} — tarefa de socorro/combate concluída.`,
      scoreBonus: 50,
      nextDecision: incident.victimCount && incident.victimCount > 0 ? 'hospital' : 'acoes_local',
    };
  }

  // genérico
  const roll = Math.random();
  if (roll < 0.2 && (incident.tags?.includes('violencia') || incident.tags?.includes('arma'))) {
    return {
      note: `${unit.label}: situação contida — há elementos para condução.`,
      scoreBonus: 55,
      nextDecision: 'policia',
    };
  }
  if (roll < 0.35 && (incident.victimCount ?? 0) > 0) {
    return {
      note: `${unit.label}: atendimento prestado — avaliar remoção médica.`,
      scoreBonus: 45,
      nextDecision: 'hospital',
    };
  }
  return {
    note: `${unit.label}: ${action.title} concluída no local.`,
    scoreBonus: 30,
    nextDecision: 'acoes_local',
  };
}

/** Duração sugerida por tipo de ação (ms). */
export function actionDurationMs(
  action: { id: string; durationMs?: number },
  incident: Incident
): number {
  if (action.durationMs) return action.durationMs;
  const p = incident.priority;
  const mult = p === 1 ? 1.35 : p === 3 ? 0.75 : 1;
  const base: Record<string, number> = {
    apurar: 45_000,
    isolar: 40_000,
    perimetro: 40_000,
    area_segura: 50_000,
    conter: 45_000,
    abordar: 35_000,
    identificar: 30_000,
    revistar: 40_000,
    apreender: 50_000,
    preservar: 55_000,
    isolar_crime: 60_000,
    testemunhas: 40_000,
    depoimentos: 45_000,
    busca_area: 55_000,
    buscar_suspeito: 60_000,
    sinalizar: 35_000,
    vitimas: 50_000,
    proteger: 45_000,
    cumprir_medida: 50_000,
    bo_local: 55_000,
    registrar_bo: 55_000,
    laudo: 45_000,
    croqui: 40_000,
    fotos_local: 30_000,
    orientar: 25_000,
    mediacao: 35_000,
    orientar_domestica: 30_000,
    atender: 50_000,
    negociar: 70_000,
    reforco: 25_000,
    aguardar_reforco: 40_000,
    dividir_funcoes: 30_000,
    triagem: 35_000,
    ventilacao: 40_000,
  };
  const ms = base[action.id] ?? 45_000;
  return Math.round((ms + Math.random() * 15_000) * mult);
}

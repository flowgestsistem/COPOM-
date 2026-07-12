import type { IncidentType, OperationType, Unit, UnitType } from '../types/game';

export const EMOJI_BY_INCIDENT_TYPE: Record<IncidentType, string> = {
  policia: '🚨',
  incendio: '🔥',
  samu: '🚑',
};

export const LABEL_BY_INCIDENT_TYPE: Record<IncidentType, string> = {
  policia: 'PM — Ostensiva',
  incendio: 'BM — Incêndio/Salvamento',
  samu: 'BM/APH — Emergência médica',
};

export const COLOR_BY_UNIT_TYPE: Record<UnitType, string> = {
  viatura: '#2563eb',
  bombeiro: '#dc2626',
  ambulancia: '#16a34a',
};

export const LABEL_BY_UNIT_TYPE: Record<UnitType, string> = {
  viatura: 'Viatura (Polícia)',
  bombeiro: 'Bombeiros',
  ambulancia: 'Ambulância (SAMU)',
};

export const LABEL_BY_UNIT_STATUS: Record<Unit['status'], string> = {
  disponivel: 'Disponível (QAP)',
  a_caminho: 'Em deslocamento',
  no_local: 'No local (QTH)',
  em_operacao: 'Em operação / patrulha',
  aguardando_decisao: 'Aguardando decisão do COPOM',
  levando_preso: 'Conduzindo à autoridade policial',
  retornando: 'Retornando à base / sede',
};

export const LABEL_BY_ZONE: Record<string, string> = {
  urbano: 'Urbano',
  rural: 'Rural',
  rodovia: 'Rodovia',
  rio: 'Rio / córrego',
};

export const LABEL_BY_INCIDENT_STATUS: Record<string, string> = {
  aguardando: 'Na fila — aguarda despacho',
  despachado: 'Viatura em deslocamento',
  em_atendimento: 'Em atendimento no local',
  aguardando_pc: 'Preservado — aguarda Polícia Civil',
  investigacao_pc: 'PC no local / investigação',
  aguardando_decisao: 'Aguarda decisão do operador',
  resolvido: 'Encerrada / resolvida',
};

export const EMOJI_BY_OPERATION_TYPE: Record<OperationType, string> = {
  blitz: '🚧',
  mandado: '📋',
  patrulha: '🔄',
  centro_seguro: '🛡️',
  rodovia: '🛣️',
  busca_apreensao: '🔍',
};

export const LABEL_BY_OPERATION_TYPE: Record<OperationType, string> = {
  blitz: 'Blitz',
  mandado: 'Cumprimento de mandado',
  patrulha: 'Patrulhamento',
  centro_seguro: 'Centro Seguro',
  rodovia: 'Operação Rodovias',
  busca_apreensao: 'Busca e apreensão',
};

export const DESCRIPTION_BY_OPERATION_TYPE: Record<OperationType, string> = {
  blitz: 'Bloqueio e fiscalização de veículos no local',
  mandado: 'Cumprimento de mandado judicial no endereço',
  patrulha: 'Circuito de patrulhamento em raio definido',
  centro_seguro: 'Patrulhamento ostensivo no centro — prevenção ao crime',
  rodovia: 'Patrulhamento preventivo nas rodovias do entorno',
  busca_apreensao: 'Busca e apreensão em imóvel selecionado no mapa',
};

export const LABEL_BY_OPERATION_STATUS: Record<
  'a_caminho' | 'em_andamento' | 'concluida' | 'interrompida',
  string
> = {
  a_caminho: 'A caminho',
  em_andamento: 'Em andamento',
  concluida: 'Concluída',
  interrompida: 'Interrompida',
};

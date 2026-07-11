export type LatLng = [number, number];

export type IncidentType = 'policia' | 'incendio' | 'samu';

export type IncidentStatus =
  | 'aguardando'
  | 'despachado'
  | 'em_atendimento'
  | 'aguardando_pc' // PM no local, aguardando Polícia Civil
  | 'investigacao_pc' // PC no local investigando
  | 'aguardando_decisao'
  | 'resolvido';

export type IncidentZone = 'urbano' | 'rural' | 'rodovia' | 'rio';

/** Origem do chamado (190/193). */
export type IncidentCaller =
  | 'vitima'
  | 'testemunha'
  | 'anonimo'
  | 'alarme'
  | 'camera'
  | 'policial'
  | 'hospital'
  | 'comercio';

/** Tags semânticas para ações e realismo. */
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

export interface IncidentLogEntry {
  id: string;
  at: number;
  text: string;
  kind: 'sistema' | 'despacho' | 'acao' | 'resultado' | 'apoio';
}

export interface Incident {
  id: string;
  type: IncidentType;
  title: string;
  description: string;
  location: LatLng;
  priority: 1 | 2 | 3; // 1 = crítica, 3 = baixa
  status: IncidentStatus;
  createdAt: number;
  assignedUnitId?: string;
  resolvesAt?: number;
  icon?: string; // sobrepõe o emoji padrão do tipo (ver public/icons/)
  zone?: IncidentZone;
  /** Exige presença da Polícia Civil (investigação / local de crime). */
  requiresCivilPolice?: boolean;
  /** Unidade da PC designada (auto ou manual). */
  civilUnitId?: string;
  /** Caso aberto na aba da Polícia Civil. */
  civilCaseId?: string;
  /** Protocolo COPOM (ex.: 2026-041287). */
  protocolNumber?: string;
  /** Quem acionou a central. */
  caller?: IncidentCaller;
  /** Classificação tática da ocorrência. */
  tags?: IncidentTag[];
  victimCount?: number;
  suspectCount?: number;
  armed?: boolean;
  /** Diário operacional do atendimento. */
  log?: IncidentLogEntry[];
  /** Resultados de ações já concluídas. */
  outcomes?: string[];
}

/** Andamento de casos da Polícia Civil. */
export type CivilCaseStatus =
  | 'aguardando_viatura' // sem PC livre
  | 'a_caminho'
  | 'no_local'
  | 'em_investigacao'
  | 'bo_em_andamento'
  | 'concluido';

export interface CivilCase {
  id: string;
  incidentId: string;
  title: string;
  location: LatLng;
  status: CivilCaseStatus;
  unitId?: string;
  unitLabel?: string;
  createdAt: number;
  updatedAt: number;
  boNumber?: string;
  notes: string[];
  arrestCount: number;
  evidenceCollected: boolean;
  completedAt?: number;
}

export type UnitType = 'viatura' | 'bombeiro' | 'ambulancia';

export type UnitStatus =
  | 'disponivel'
  | 'a_caminho'
  | 'no_local'
  | 'em_operacao'
  | 'aguardando_decisao'
  | 'levando_preso'
  | 'retornando';

/** Decisão pendente do operador após o atendimento no local. */
export type PendingDecision =
  | 'chegada' // viatura acabou de chegar — ações da guarnição
  | 'acoes_local' // no local — menu de ações sempre disponível (fila)
  | 'hospital'
  | 'policia'
  | 'civil'
  | 'disposicao';

/** Ação da guarnição enfileirada (executa em sequência no local). */
export interface QueuedSceneAction {
  id: string;
  title: string;
  description: string;
  effect: string;
  fireRole?: string;
  durationMs?: number;
  category?: string;
}

/** 2 = sem sirene · 3 = com sirene (emergência). */
export type ResponseCode = 2 | 3;

export type UnitMission =
  | 'none'
  | 'deslocamento'
  | 'realocacao'
  | 'patrulha'
  | 'ponto_estrategico'
  | 'apoio_ocorrencia'
  | 'despacho';

export interface Unit {
  id: string;
  baseId: string;
  type: UnitType;
  label: string;
  /** Departamento/grupo da frota (ex.: Rádio Patrulha, Ambiental). */
  department: string;
  base: LatLng;
  position: LatLng;
  status: UnitStatus;
  photoUrl?: string;
  assignedIncidentId?: string;
  operationId?: string;
  responseCode?: ResponseCode;
  mission?: UnitMission;
  /** Após atendimento: operador escolhe hospital ou ação policial. */
  pendingDecision?: PendingDecision;
  pendingIncidentTitle?: string;
  /** Fim de ponto estratégico ou patrulha unitária. */
  missionEndsAt?: number;
  patrolEndsAt?: number; // apenas unidades em patrulha (status em_operacao)
  nextPatrolEventAt?: number; // apenas unidades em patrulha (status em_operacao)
  /** Centro do circuito de patrulha individual (espalhado na zona). */
  patrolLoopCenter?: LatLng;
  /** Raio do circuito individual. */
  patrolLoopRadius?: number;
  /** Ângulo inicial do circuito (graus). */
  patrolStartAngleDeg?: number;
  /**
   * Papel da equipe no local (bombeiros multi-equipe: APH, extricação, combate…).
   * Cada viatura trabalha em paralelo com seu próprio timer.
   */
  serviceRole?: string;
  /** Rótulo legível do papel (ex.: "Extricação / desencarceramento"). */
  serviceRoleLabel?: string;
  /** Quando esta unidade termina a tarefa no local. */
  serviceEndsAt?: number;
  /**
   * Fila de ações da guarnição no local.
   * Enquanto uma roda (serviceEndsAt), as demais esperam e disparam em sequência.
   */
  actionQueue?: QueuedSceneAction[];
  /** Última ação de cena em execução (para resultado ao terminar). */
  activeSceneAction?: QueuedSceneAction;
  route?: LatLng[];
  routeProgress?: number; // 0..1
  routeStartedAt?: number;
  routeDurationMs?: number;
}

export type OperationType =
  | 'blitz'
  | 'mandado'
  | 'patrulha'
  /** Prevenção no centro — patrulha ostensiva. */
  | 'centro_seguro'
  /** Patrulhamento em rodovias do entorno. */
  | 'rodovia'
  /** Busca e apreensão em endereço (mapa) — PC/PM. */
  | 'busca_apreensao';

export type OperationStatus = 'a_caminho' | 'em_andamento' | 'concluida' | 'interrompida';

export interface VehicleCheck {
  id: string;
  plate: string;
  model: string;
  year: number;
  ipvaPago: boolean;
  roubado: boolean;
  outcome: 'liberado' | 'multado' | 'apreendido';
  checkedAt: number;
}

export interface Operation {
  id: string;
  type: OperationType;
  title: string;
  location: LatLng;
  radiusMeters?: number; // patrulha / centro seguro / rodovia
  patrolRoute?: LatLng[]; // circuito real (OSRM) ao redor do ponto, apenas patrulha
  unitIds: string[];
  durationMs: number; // duração no local (blitz/mandado) ou de patrulhamento total
  startedAt?: number; // quando a primeira unidade chegou e a operação começou de fato
  status: OperationStatus;
  createdAt: number;
  vehicleChecks?: VehicleCheck[]; // apenas blitz
  nextVehicleCheckAt?: number; // apenas blitz
  /** Observação tática (ex.: alvo da busca). */
  notes?: string;
}

export type PatrolEventType = 'abordagem_pedestre' | 'abordagem_veiculo' | 'pedido_apoio' | 'perseguicao';

export interface PatrolEvent {
  id: string;
  unitId: string;
  unitLabel: string;
  operationId?: string;
  type: PatrolEventType;
  location: LatLng;
  description: string;
  outcome: string;
  arrest: boolean;
  vehicleCheck?: VehicleCheck;
  createdAt: number;
}

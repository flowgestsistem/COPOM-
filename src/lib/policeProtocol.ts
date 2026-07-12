/**
 * Linguagem e procedimentos operacionais realistas (COPOM / PM-MG / BM).
 * Textos no estilo de comunicação rádio e despacho civil.
 */
import type { Incident, ResponseCode, Unit } from '../types/game';
import { pickOne } from './random';

/** Códigos de resposta usuais no despacho. */
export const RESPONSE_CODE_LABEL: Record<ResponseCode, string> = {
  2: 'Código 2 — deslocamento sem prioridade de sirene',
  3: 'Código 3 — emergência, dispositivos sonoros e luminosos',
};

export function formatQTH(lat: number, lng: number): string {
  return `QTH aprox. ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

/** Frases de abertura de chamado 190/193. */
export function radioCallOpen(incident: Incident): string {
  const prio =
    incident.priority === 1 ? 'PRIORIDADE ALTA' : incident.priority === 2 ? 'prioridade média' : 'rotina';
  return `Central, novo atendimento ${incident.protocolNumber ?? 's/n'} — ${prio}. Natureza: ${incident.title}.`;
}

export function radioDispatch(unit: Unit, incident: Incident, code: ResponseCode): string {
  const codeTxt = code === 3 ? 'código três' : 'código dois';
  return `${unit.label}, ${unit.department}, dirija-se ao local. Natureza ${incident.title}. Deslocamento em ${codeTxt}. Confirme recepção.`;
}

export function radioOnScene(unit: Unit, incident: Incident): string {
  return `${unit.label} no local. QTH confirmado. Iniciando procedimentos. Protocolo ${incident.protocolNumber ?? '—'}.`;
}

export function radioAction(unit: Unit, actionTitle: string): string {
  return `${unit.label} informa: ${actionTitle}. Aguardando orientações / dando continuidade.`;
}

export function radioResult(unit: Unit, note: string): string {
  const clean = note.replace(/^[^:]+:\s*/, '');
  return `${unit.label} atualiza: ${clean}`;
}

export function radioClosing(incident: Incident, disposition: string): string {
  return `Encerramento protocolo ${incident.protocolNumber ?? incident.id.slice(-6)}. Providência: ${disposition}. Central ciente.`;
}

/** Narrativas de solicitante no estilo 190. */
export function callerNarrative(incident: Incident): string {
  const caller = incident.caller ?? 'anonimo';
  const openers: Record<string, string[]> = {
    vitima: [
      'Solicitante identifica-se como vítima e pede apoio imediato.',
      'Vítima relata estar em situação de risco e solicita viatura.',
      'Comunicante (vítima) descreve o fato e pede presença policial.',
    ],
    testemunha: [
      'Testemunha ocular relata o fato e permanece no local.',
      'Terceiro presencia a ocorrência e aciona a central.',
      'Passante informa o QTH e descreve os envolvidos.',
    ],
    anonimo: [
      'Denúncia anônima via 190 — veracidade a confirmar no local.',
      'Chamado anônimo com indício de ocorrência em andamento.',
      'Informante não se identifica; central registra e despacha.',
    ],
    alarme: [
      'Disparo de alarme monitorado; empresa de segurança acionou a central.',
      'Central de alarme solicita verificação de intrusão.',
    ],
    camera: [
      'Monitoramento por CFTV identificou movimento suspeito.',
      'Operador de câmera repassa imagens e solicita apoio.',
    ],
    policial: [
      'Guarnição em ronda solicita apoio / comunica ocorrência.',
      'Unidade de serviço visualiza o fato e pede complementação.',
    ],
    hospital: [
      'Unidade de saúde solicita apoio policial / remoção.',
      'Plantão hospitalar comunica paciente vítima de violência.',
    ],
    comercio: [
      'Comerciante aciona a central e permanece no estabelecimento.',
      'Responsável pelo comércio relata furto/roubo em andamento ou consumado.',
    ],
  };
  const pool = openers[caller] ?? openers.anonimo;
  return pickOne(pool);
}

/** Procedimentos operacionais padrão (POP) sugeridos por natureza. */
export function popStepsForIncident(incident: Incident): string[] {
  const t = incident.title.toLowerCase();
  const tags = incident.tags ?? [];

  if (incident.armed || tags.includes('arma') || /tiroteio|armada|disparo/.test(t)) {
    return [
      'Isolar perímetro e afastar civis',
      'Solicitar reforço tático se necessário',
      'Estabelecer cobertura e comunicação rádio',
      'Negociar / conter com segurança da guarnição',
      'Preservar local e acionar PC se houver vítima fatal ou crime complexo',
    ];
  }
  if (tags.includes('domestica') || /doméstica|medida protetiva/.test(t)) {
    return [
      'Separar as partes e garantir integridade da vítima',
      'Verificar existência de medida protetiva',
      'Registrar depoimentos iniciais',
      'Conduzir agressor em flagrante se cabível',
      'Orientar rede de proteção (Delegacia da Mulher / CREAS)',
    ];
  }
  if (tags.includes('transito') || /acidente|colisão|atropelamento|capotamento/.test(t)) {
    return [
      'Sinalizar a via e proteger o local',
      'Prestar primeiros socorros / acionar BM-APH',
      'Identificar condutores e testemunhas',
      'Documentar croqui e danos',
      'Liberar via quando seguro',
    ];
  }
  if (tags.includes('drogas') || /tráfico|entorpecente/.test(t)) {
    return [
      'Abordagem ostensiva com cobertura',
      'Revista pessoal e veicular',
      'Apreensão de material com cadeia de custódia',
      'Prisão em flagrante e condução à autoridade policial',
    ];
  }
  if (incident.type === 'incendio' || tags.includes('incendio')) {
    return [
      'Isolar área de risco e evacuar civis',
      'Combate ao foco com ABTS / linha de ataque',
      'Busca e salvamento de vítimas',
      'Ventilação e rescaldo',
      'Entrega do local à perícia / responsáveis quando seguro',
    ];
  }
  if (incident.type === 'samu' || tags.includes('medico')) {
    return [
      'Avaliação primária (ABC) e APH',
      'Imobilização e estabilização',
      'Decisão de remoção para UAI/hospital de referência',
      'Passagem de plantão à equipe receptora',
    ];
  }
  if (tags.includes('patrimonio') || /roubo|furto|assalto|arrombamento/.test(t)) {
    return [
      'Isolar e preservar a cena',
      'Ouvir vítima/testemunhas (apuração inicial)',
      'Busca nas imediações por autores',
      'Registrar B.O. / acionar PC se crime complexo',
      'Restituir local ao responsável quando possível',
    ];
  }
  return [
    'Chegada e reconhecimento do local',
    'Contenção da situação e segurança da guarnição',
    'Identificação de envolvidos',
    'Providências legais cabíveis',
    'Encerramento e retorno à disponibilidade',
  ];
}

export function natureCodeHint(incident: Incident): string {
  // Códigos ilustrativos estilo natureza de ocorrência (não oficiais MG, mas didáticos)
  const t = incident.title.toLowerCase();
  if (/homicídio|homicidio|cadáver|cadaver/.test(t)) return 'Natureza: homicídio / encontro de cadáver';
  if (/roubo|assalto/.test(t)) return 'Natureza: roubo';
  if (/furto/.test(t)) return 'Natureza: furto';
  if (/tráfico|trafico|droga/.test(t)) return 'Natureza: tráfico de drogas';
  if (/doméstica|domestica/.test(t)) return 'Natureza: violência doméstica';
  if (/ameaça|ameaca/.test(t)) return 'Natureza: ameaça';
  if (/acidente|colisão|atropelamento/.test(t)) return 'Natureza: acidente de trânsito';
  if (/incêndio|incendio/.test(t)) return 'Natureza: incêndio';
  if (/mal súbito|parada|AVC|trauma/.test(t)) return 'Natureza: emergência clínica / trauma';
  if (incident.type === 'policia') return 'Natureza: ocorrência policial ostensiva';
  if (incident.type === 'incendio') return 'Natureza: bombeiros / salvamento';
  return 'Natureza: atendimento de emergência';
}

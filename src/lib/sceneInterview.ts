import type { Incident } from '../types/game';
import { pickOne } from './random';

export type InterviewSpeakerRole = 'vitima' | 'testemunha' | 'solicitante' | 'envolvido';

export interface InterviewMessage {
  id: string;
  from: 'guarnicao' | 'civil';
  text: string;
  at: number;
}

export interface InterviewQuestion {
  id: string;
  label: string;
  /** Chave de fato revelada ao usar esta pergunta. */
  factId: string;
}

export interface InterviewFact {
  id: string;
  label: string;
  /** Resposta do civil ao revelar este fato. */
  answer: string;
  /** Palavras-chave no texto livre (sem acento, minúsculo). */
  keywords: string[];
}

export interface InterviewSession {
  incidentId: string;
  unitId: string;
  speakerRole: InterviewSpeakerRole;
  speakerName: string;
  opening: string;
  messages: InterviewMessage[];
  facts: InterviewFact[];
  questions: InterviewQuestion[];
  revealedFactIds: string[];
  /** Mínimo de fatos para liberar “encerrar apuração” com boa qualidade. */
  targetFacts: number;
  complete: boolean;
  summary: string[];
}

export type PostInterviewActionId =
  | 'start_service'
  | 'preserve_pc'
  | 'request_support'
  | 'specialized'
  | 'hospital'
  | 'delegacia'
  | 'resolve_light';

export interface PostInterviewAction {
  id: PostInterviewActionId;
  title: string;
  description: string;
}

const FIRST_NAMES = [
  'Ana',
  'Bruno',
  'Carla',
  'Diego',
  'Elisa',
  'Fábio',
  'Gabriela',
  'Henrique',
  'Isabela',
  'João',
  'Larissa',
  'Marcos',
  'Natália',
  'Otávio',
  'Patrícia',
  'Rafael',
  'Sabrina',
  'Thiago',
];

const LAST_NAMES = [
  'Silva',
  'Santos',
  'Oliveira',
  'Souza',
  'Lima',
  'Ferreira',
  'Costa',
  'Almeida',
  'Ribeiro',
  'Carvalho',
];

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function msg(from: InterviewMessage['from'], text: string): InterviewMessage {
  return {
    id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    from,
    text,
    at: Date.now(),
  };
}

function roleLabel(role: InterviewSpeakerRole): string {
  switch (role) {
    case 'vitima':
      return 'Vítima';
    case 'testemunha':
      return 'Testemunha';
    case 'envolvido':
      return 'Envolvido';
    default:
      return 'Solicitante';
  }
}

function pickPersona(incident: Incident): {
  role: InterviewSpeakerRole;
  name: string;
  opening: string;
} {
  const name = `${pickOne(FIRST_NAMES)} ${pickOne(LAST_NAMES)}`;
  const t = incident.title;

  if (incident.type === 'samu' || /mal súbito|parada|AVC|convuls|parto|trauma|ferida|hemorragia/i.test(t)) {
    return {
      role: 'vitima',
      name,
      opening: `Oi… eu sou ${name}. Preciso de ajuda, a situação médica está piorando aqui.`,
    };
  }
  if (incident.type === 'incendio' || /incêndio|incendio|fumaça|fumaca|gás|gas|explos/i.test(t)) {
    return {
      role: 'solicitante',
      name,
      opening: `Sou ${name}. Tem fumaça/fogo e tem gente na área — estou com medo de piorar.`,
    };
  }
  if (/roubo|assalto|furto|arrombamento/i.test(t)) {
    return {
      role: 'vitima',
      name,
      opening: `Polícia? Aqui é ${name}. Acabei de ser vítima — ainda estou tremendo.`,
    };
  }
  if (/briga|agressão|agressao|vias de fato|doméstica|domestica/i.test(t)) {
    return {
      role: 'vitima',
      name,
      opening: `Meu nome é ${name}. Teve agressão, preciso que a guarnição entenda o que aconteceu.`,
    };
  }
  if (/disparo|arma|tiroteio|pessoa armada/i.test(t)) {
    return {
      role: 'testemunha',
      name,
      opening: `Aqui é ${name}. Eu vi o movimento com arma / ouvi disparos. Posso contar o que vi.`,
    };
  }
  if (/trânsito|transito|colisão|colisao|acidente|atropelamento/i.test(t)) {
    return {
      role: 'envolvido',
      name,
      opening: `Sou ${name}, estava envolvido no acidente. Posso explicar como foi.`,
    };
  }
  if (/cadáver|cadaver|morte|homicídio|homicidio/i.test(t)) {
    return {
      role: 'testemunha',
      name,
      opening: `Meu nome é ${name}. Eu achei/vi a situação. Estou abalado, mas falo o que sei.`,
    };
  }
  if (/tráfico|trafico|drogas/i.test(t)) {
    return {
      role: 'testemunha',
      name,
      opening: `Sou ${name}. Tem movimento de drogas aqui, posso apontar o que vi.`,
    };
  }

  return {
    role: 'solicitante',
    name,
    opening: `Alô, sou ${name}. Eu que liguei pro 190/193. Posso passar os detalhes do que está acontecendo.`,
  };
}

function buildFacts(incident: Incident): InterviewFact[] {
  const t = incident.title;
  const zone = incident.zone ?? 'urbano';
  const place = incident.description.match(/Local:\s*(.+?)\./)?.[1] ?? 'neste local';

  const common: InterviewFact[] = [
    {
      id: 'quando',
      label: 'Quando começou',
      answer: `Foi há poucos minutos, bem agora — mais ou menos entre 5 e 15 minutos. Eu ainda estava em ${place}.`,
      keywords: ['quando', 'hora', 'quanto tempo', 'ja faz', 'começou', 'comecou', 'aconteceu'],
    },
    {
      id: 'local',
      label: 'Onde exatamente',
      answer: `Foi bem aqui em ${place}, na área ${zone}. Dá pra ver da calçada/entrada.`,
      keywords: ['onde', 'local', 'endereco', 'endereço', 'rua', 'aqui', 'lugar'],
    },
    {
      id: 'risco',
      label: 'Risco no momento',
      answer:
        incident.priority === 1
          ? 'Ainda tem risco alto. Precisa agir rápido.'
          : 'No momento está mais controlado, mas pode piorar se demorar.',
      keywords: ['risco', 'perigo', 'seguro', 'arma', 'ameaca', 'ameaça', 'ainda'],
    },
  ];

  if (incident.type === 'samu' || /mal súbito|parada|AVC|convuls|parto|trauma|ferida/i.test(t)) {
    return [
      ...common,
      {
        id: 'sintomas',
        label: 'Sintomas / quadro',
        answer:
          'A pessoa está mal — dor forte / falta de ar / desmaio. Precisa de atendimento pré-hospitalar.',
        keywords: ['sintoma', 'dor', 'desmaio', 'respir', 'sangue', 'consciencia', 'consciência', 'como esta'],
      },
      {
        id: 'quantas_vitimas',
        label: 'Quantas vítimas',
        answer: 'Pelo que vejo, uma vítima principal. Tem gente em volta, mas o foco é essa pessoa.',
        keywords: ['quantas', 'vitima', 'vítima', 'feridos', 'pessoas'],
      },
      {
        id: 'primeiros_socorros',
        label: 'Já fizeram algo',
        answer: 'Tentamos deitar e afrouxar a roupa. Ninguém é da área de saúde aqui.',
        keywords: ['socorro', 'ajudou', 'fez', 'remedio', 'remédio', 'samu'],
      },
    ];
  }

  if (incident.type === 'incendio' || /incêndio|incendio|fumaça|fumaca|gás|gas/i.test(t)) {
    return [
      ...common,
      {
        id: 'foco',
        label: 'Onde está o foco',
        answer: 'O foco parece ser na estrutura/veículo ali — tem fumaça subindo e cheiro forte.',
        keywords: ['fogo', 'foco', 'fumaca', 'fumaça', 'chama', 'queim'],
      },
      {
        id: 'pessoas_dentro',
        label: 'Pessoas em risco',
        answer: 'Não tenho certeza se tem alguém preso. Ouvi gritos no começo.',
        keywords: ['pessoa', 'preso', 'dentro', 'crianca', 'criança', 'idoso', 'evacu'],
      },
      {
        id: 'explosao',
        label: 'Risco de explosão / gás',
        answer: 'Tem cheiro estranho, pode ser gás. Melhor isolar.',
        keywords: ['gas', 'gás', 'explos', 'botija', 'caminho'],
      },
    ];
  }

  if (/roubo|assalto|furto|arrombamento/i.test(t)) {
    return [
      ...common,
      {
        id: 'autor',
        label: 'Descrição do autor',
        answer:
          'Era um homem, roupa escura, mais ou menos 1,70. Foi correndo na direção do quarteirão seguinte.',
        keywords: ['autor', 'ladrão', 'ladrao', 'suspeito', 'homem', 'mulher', 'descri', 'roupa', 'fugiu'],
      },
      {
        id: 'arma',
        label: 'Usou arma?',
        answer: /assalto|roubo/i.test(t)
          ? 'Sim, mostrou algo como arma. Fiquei com medo e entreguei.'
          : 'Não vi arma. Parecia furto rápido.',
        keywords: ['arma', 'revólver', 'revolver', 'faca', 'ameac', 'ameaç'],
      },
      {
        id: 'objeto',
        label: 'O que foi levado',
        answer: 'Levaram celular / bolsa / pertences. Consigo descrever o aparelho se precisar.',
        keywords: ['levou', 'roubou', 'celular', 'bolsa', 'dinheiro', 'objeto', 'bem'],
      },
      {
        id: 'direcao_fuga',
        label: 'Direção de fuga',
        answer: 'Fugiu a pé / de moto na direção da avenida principal.',
        keywords: ['fuga', 'fugiu', 'direcao', 'direção', 'moto', 'carro', 'para onde'],
      },
    ];
  }

  if (/briga|agressão|agressao|doméstica|domestica|vias de fato/i.test(t)) {
    return [
      ...common,
      {
        id: 'agressor',
        label: 'Quem agrediu',
        answer: 'Foi uma pessoa conhecida/do local. Ainda pode estar por perto.',
        keywords: ['agressor', 'marido', 'esposa', 'vizinho', 'quem', 'bateu'],
      },
      {
        id: 'lesao',
        label: 'Lesões',
        answer: 'Tem marca/hematoma. Dói, mas estou consciente.',
        keywords: ['lesao', 'lesão', 'machuc', 'sangue', 'dor', 'ferida'],
      },
      {
        id: 'continua',
        label: 'Ainda há agressão',
        answer: 'Parou quando a viatura chegou, mas a tensão continua alta.',
        keywords: ['ainda', 'continua', 'parou', 'brigando', 'gritando'],
      },
    ];
  }

  if (/disparo|arma|tiroteio|pessoa armada/i.test(t)) {
    return [
      ...common,
      {
        id: 'tiros',
        label: 'Quantos disparos',
        answer: 'Ouvi vários estampidos. Não sei se alguém foi atingido.',
        keywords: ['tiro', 'disparo', 'quantos', 'estouro', 'arma'],
      },
      {
        id: 'armado',
        label: 'Onde está o armado',
        answer: 'Vi alguém com arma indo em direção ao beco/estacionamento.',
        keywords: ['armado', 'onde esta', 'onde está', 'fugiu', 'escond'],
      },
      {
        id: 'vitimas_tiro',
        label: 'Vítimas',
        answer: 'Não confirmei feridos, mas o pessoal se espalhou gritando.',
        keywords: ['ferido', 'vitima', 'vítima', 'atingido', 'morto'],
      },
    ];
  }

  if (/trânsito|transito|colisão|colisao|acidente|atropelamento/i.test(t)) {
    return [
      ...common,
      {
        id: 'veiculos',
        label: 'Veículos envolvidos',
        answer: 'Dois veículos se envolveram. Um ficou atravessado atrapalhando a via.',
        keywords: ['carro', 'moto', 'caminhao', 'caminhão', 'veiculo', 'veículo', 'placa'],
      },
      {
        id: 'feridos_transito',
        label: 'Feridos',
        answer: 'Tem gente reclamando de dor. Não sei se é grave.',
        keywords: ['ferido', 'dor', 'hospital', 'sangue', 'inconsciente'],
      },
      {
        id: 'via',
        label: 'Via bloqueada',
        answer: 'A pista está parcialmente bloqueada. Tem risco de novo choque.',
        keywords: ['pista', 'via', 'bloqueada', 'transito', 'trânsito', 'faixa'],
      },
    ];
  }

  // genérico policial
  return [
    ...common,
    {
      id: 'o_que_viu',
      label: 'O que aconteceu',
      answer: `Vou resumir: ${incident.title.toLowerCase()}. Eu vi/escutei e chamei a polícia.`,
      keywords: ['o que', 'aconteceu', 'conta', 'explica', 'como foi', 'fato'],
    },
    {
      id: 'envolvidos',
      label: 'Envolvidos',
      answer: 'Tem pelo menos uma pessoa envolvida. Posso apontar se ainda estiver por perto.',
      keywords: ['envolvido', 'quem', 'suspeito', 'pessoa', 'identif'],
    },
    {
      id: 'provas',
      label: 'Provas / imagens',
      answer: 'Pode ter câmera no comércio da esquina. Eu não gravei tudo.',
      keywords: ['camera', 'câmera', 'video', 'vídeo', 'prova', 'film'],
    },
  ];
}

/** Cria sessão de apuração para a 1ª guarnição no local. */
export function createInterviewSession(incident: Incident, unitId: string): InterviewSession {
  const persona = pickPersona(incident);
  const facts = buildFacts(incident);
  const questions: InterviewQuestion[] = facts.map((f) => ({
    id: `q-${f.id}`,
    label: f.label,
    factId: f.id,
  }));

  return {
    incidentId: incident.id,
    unitId,
    speakerRole: persona.role,
    speakerName: persona.name,
    opening: persona.opening,
    messages: [msg('civil', persona.opening)],
    facts,
    questions,
    revealedFactIds: [],
    targetFacts: Math.min(3, facts.length),
    complete: false,
    summary: [],
  };
}

function revealFact(session: InterviewSession, factId: string): InterviewSession {
  if (session.revealedFactIds.includes(factId)) {
    const fact = session.facts.find((f) => f.id === factId);
    return {
      ...session,
      messages: [
        ...session.messages,
        msg('civil', fact ? 'Já te falei isso… mas repito: ' + fact.answer : 'Já comentei isso.'),
      ],
    };
  }
  const fact = session.facts.find((f) => f.id === factId);
  if (!fact) {
    return {
      ...session,
      messages: [
        ...session.messages,
        msg('civil', 'Não sei te responder isso com certeza agora…'),
      ],
    };
  }
  return {
    ...session,
    revealedFactIds: [...session.revealedFactIds, factId],
    summary: [...session.summary, `${fact.label}: ${fact.answer}`],
    messages: [...session.messages, msg('civil', fact.answer)],
  };
}

/** Pergunta programada (botão). */
export function askScriptedQuestion(session: InterviewSession, questionId: string): InterviewSession {
  const q = session.questions.find((x) => x.id === questionId);
  if (!q || session.complete) return session;
  const withAsk: InterviewSession = {
    ...session,
    messages: [...session.messages, msg('guarnicao', q.label + '?')],
  };
  return revealFact(withAsk, q.factId);
}

/**
 * Texto livre estilo Emergency 4: casa palavras-chave com fatos
 * e devolve resposta contextual.
 */
export function askFreeText(session: InterviewSession, text: string): InterviewSession {
  if (session.complete) return session;
  const raw = text.trim();
  if (!raw) return session;

  const withAsk: InterviewSession = {
    ...session,
    messages: [...session.messages, msg('guarnicao', raw)],
  };

  const n = norm(raw);

  // cumprimentos / calma
  if (/^(oi|ola|olá|bom dia|boa tarde|boa noite|calma|fica calmo|respira)\b/.test(n)) {
    return {
      ...withAsk,
      messages: [
        ...withAsk.messages,
        msg(
          'civil',
          `Obrigado… eu sou ${session.speakerName}. Pode perguntar o que precisar pra apurar.`
        ),
      ],
    };
  }

  // nome
  if (/\b(nome|se apresenta|quem e voce|quem é você|qual seu nome)\b/.test(n)) {
    return {
      ...withAsk,
      messages: [
        ...withAsk.messages,
        msg(
          'civil',
          `Meu nome é ${session.speakerName}. Sou ${roleLabel(session.speakerRole).toLowerCase()} desta ocorrência.`
        ),
      ],
    };
  }

  // match fatos por keyword
  let best: { fact: InterviewFact; score: number } | null = null;
  for (const fact of session.facts) {
    let score = 0;
    for (const kw of fact.keywords) {
      if (n.includes(norm(kw))) score += kw.length > 4 ? 2 : 1;
    }
    if (score > 0 && (!best || score > best.score)) best = { fact, score };
  }

  if (best && best.score > 0) {
    return revealFact(withAsk, best.fact.id);
  }

  // fallback realista
  const fallbacks = [
    'Não entendi bem… pode perguntar de outro jeito? Tipo quando foi, quem era, se tem arma…',
    'Tô nervoso. Pergunta objetiva: o que você precisa saber agora?',
    'Posso falar de horário, descrição, direção de fuga ou se tem feridos — o que prefere?',
    'Não tenho certeza desse detalhe. Quer que eu aponte no local o que eu vi?',
  ];
  return {
    ...withAsk,
    messages: [...withAsk.messages, msg('civil', pickOne(fallbacks))],
  };
}

export function completeInterview(session: InterviewSession): InterviewSession {
  if (session.complete) return session;
  const n = session.revealedFactIds.length;
  const closing =
    n >= session.targetFacts
      ? 'Obrigado. Acho que já passei o principal. A guarnição pode agir com o que apurou.'
      : n === 0
        ? 'Tá… se não tiver mais pergunta, a guarnição vai ter que decidir com pouco detalhe.'
        : 'Beleza. Se precisar de mais alguma coisa eu estou por aqui.';

  return {
    ...session,
    complete: true,
    messages: [...session.messages, msg('civil', closing)],
  };
}

export function interviewProgress(session: InterviewSession): {
  revealed: number;
  total: number;
  ready: boolean;
} {
  const revealed = session.revealedFactIds.length;
  return {
    revealed,
    total: session.facts.length,
    ready: revealed >= session.targetFacts || session.complete,
  };
}

/** Ações liberadas após apuração (ou se pular com poucos fatos). */
export function buildPostInterviewActions(
  incident: Incident,
  session: InterviewSession
): PostInterviewAction[] {
  const actions: PostInterviewAction[] = [];
  const push = (a: PostInterviewAction) => {
    if (!actions.some((x) => x.id === a.id)) actions.push(a);
  };
  const text = `${incident.title} ${session.summary.join(' ')}`.toLowerCase();

  push({
    id: 'start_service',
    title: 'Iniciar providências no local',
    description: 'Guarnição age com base nos fatos apurados',
  });

  push({
    id: 'request_support',
    title: 'Solicitar reforço',
    description: 'Pedir outra viatura para o local (dashboard de despacho)',
  });

  // equipe especializada por contexto
  if (
    incident.type === 'incendio' ||
    incident.type === 'samu' ||
    /fogo|fumaça|fumaca|gás|gas|ferida|desmaio|mal/i.test(text)
  ) {
    push({
      id: 'specialized',
      title: 'Acionar equipe especializada',
      description:
        incident.type === 'samu' || /ferida|desmaio|mal|trauma/i.test(text)
          ? 'Priorizar bombeiros / suporte pré-hospitalar'
          : 'Priorizar combate a incêndio / salvamento',
    });
  } else if (/arma|tiro|homicídio|homicidio|cadáver|cadaver|tráfico|trafico/i.test(text)) {
    push({
      id: 'specialized',
      title: 'Acionar equipe especializada',
      description: 'Tático / Polícia Civil conforme a gravidade apurada',
    });
  } else {
    push({
      id: 'specialized',
      title: 'Acionar equipe especializada',
      description: 'Reforço tático ou apoio de outra corporação',
    });
  }

  if (
    incident.requiresCivilPolice ||
    /homicídio|homicidio|cadáver|cadaver|local de crime|arma|tráfico/i.test(text)
  ) {
    push({
      id: 'preserve_pc',
      title: 'Preservar local e aguardar PC',
      description: 'Isolar a cena para a Polícia Civil',
    });
  }

  if (incident.type === 'samu' || /ferida|vítima|vitima|desmaio|trauma|hospital/i.test(text)) {
    push({
      id: 'hospital',
      title: 'Encaminhar a hospital / UAI',
      description: 'Transporte da vítima após estabilização',
    });
  }

  if (/prisão|preso|flagrante|agressor|roubo|assalto|tráfico/i.test(text) || incident.type === 'policia') {
    push({
      id: 'delegacia',
      title: 'Conduzir à delegacia',
      description: 'Se houver flagrante ou necessidade de condução',
    });
  }

  push({
    id: 'resolve_light',
    title: 'Sem providências / falso alarme',
    description: 'Encerrar após apuração sem novas medidas',
  });

  return actions;
}

export function speakerRoleLabel(role: InterviewSpeakerRole): string {
  return roleLabel(role);
}

import type { Incident, Unit } from '../types/game';
import { actionDurationMs } from './incidentRealism';

/**
 * Efeito da ação escolhida na chegada / no local.
 * O App interpreta e aplica no estado do jogo.
 */
export type SceneActionEffect =
  | 'start_service' // inicia atendimento no local (timer)
  | 'start_service_preserve' // atende e preserva (PC)
  | 'hospital' // fluxo hospital
  | 'delegacia' // conduzir preso
  | 'resolve_light' // encerra leve + disposição
  | 'request_support' // inicia atendimento e pede reforço (só status)
  | 'apurar_fatos' // diálogo com vítima/testemunha (1ª guarnição)
  | 'fire_role' // bombeiros: inicia papel específico (APH, extricação…)
  | 'bo_local' // lavrar B.O. no local e liberar
  | 'flagrante' // prisão em flagrante → delegacia
  | 'identify'; // abordagem / identificação

export type SceneActionCategory =
  | 'tatica'
  | 'investigativa'
  | 'assistencial'
  | 'administrativa'
  | 'socorro';

export interface SceneAction {
  id: string;
  title: string;
  description: string;
  effect: SceneActionEffect;
  /** Papel de bombeiro (quando effect === fire_role). */
  fireRole?: string;
  /** Duração custom (ms). */
  durationMs?: number;
  category?: SceneActionCategory;
  /** Risco / gravidade da ação (UI). */
  risk?: 1 | 2 | 3;
}

function has(title: string, re: RegExp): boolean {
  return re.test(title);
}

function hasTag(incident: Incident, tag: string): boolean {
  return !!incident.tags?.includes(tag as never);
}

export interface SceneActionContext {
  /** Unidades do mesmo caso ainda a caminho. */
  enRouteUnits?: Unit[];
  /** Unidades do mesmo caso já no local (exceto a atual). */
  onSceneUnits?: Unit[];
}

/** Monta menu de ações coerente com o tipo e o título da ocorrência. */
export function buildSceneActions(
  incident: Incident,
  unit: Unit,
  context?: SceneActionContext
): SceneAction[] {
  const title = incident.title;
  const actions: SceneAction[] = [];
  const push = (a: SceneAction) => {
    if (!actions.some((x) => x.id === a.id)) {
      const withDur = { ...a, durationMs: a.durationMs ?? actionDurationMs(a, incident) };
      actions.push(withDur);
    }
  };

  const enRoute = context?.enRouteUnits ?? [];
  const onScene = context?.onSceneUnits ?? [];
  const armed = incident.armed || hasTag(incident, 'arma') || has(title, /arma|tiroteio|armada/i);

  // 1ª guarnição: apurar fatos com vítima/testemunha (diálogo interativo)
  if (unit.type === 'viatura' || unit.type === 'bombeiro') {
    push({
      id: 'apurar',
      title: 'Apurar os fatos no local',
      description: 'Ouvir vítima/testemunha — perguntas prontas ou texto livre',
      effect: 'apurar_fatos',
      category: 'investigativa',
    });
  }

  // Multi-guarnição: organizar com quem já está / quem vem
  if (enRoute.length > 0 || onScene.length > 0) {
    if (enRoute.length > 0) {
      push({
        id: 'aguardar_reforco',
        title: 'Aguardar reforço e organizar',
        description: `${enRoute.map((u) => u.label).join(', ')} a caminho — manter perímetro até integrar`,
        effect: 'start_service',
        category: 'tatica',
      });
    }
    if (onScene.length > 0) {
      push({
        id: 'dividir_funcoes',
        title: 'Dividir funções com o apoio',
        description: `Organizar com ${onScene.map((u) => u.label).join(', ')} (contenção, vítimas, perímetro)`,
        effect: 'start_service',
        category: 'tatica',
      });
    }
  }

  // ─── Polícia Militar ───
  if (incident.type === 'policia' && unit.type === 'viatura') {
    // sempre: perímetro básico e identificação
    push({
      id: 'perimetro',
      title: 'Estabelecer perímetro de segurança',
      description: 'Isolar área, afastar curiosos e controlar acessos',
      effect: 'start_service',
      category: 'tatica',
      risk: armed ? 2 : 1,
    });
    push({
      id: 'identificar',
      title: 'Identificar envolvidos',
      description: 'Conferir documentos, mandados e antecedentes',
      effect: 'identify',
      category: 'investigativa',
    });
    push({
      id: 'fotos_local',
      title: 'Registrar o local (fotos/vídeo)',
      description: 'Documentar cena, veículos e vestígios para o B.O.',
      effect: 'start_service',
      category: 'investigativa',
    });

    if (
      hasTag(incident, 'patrimonio') ||
      has(title, /roubo|assalto|furto|arrombamento|invasão|invasao|vandalismo|clonada|roubado/i)
    ) {
      push({
        id: 'isolar',
        title: 'Isolar o perímetro do crime',
        description: 'Cercar a área e impedir contaminação da cena',
        effect: 'start_service_preserve',
        category: 'tatica',
        risk: 2,
      });
      push({
        id: 'abordar',
        title: 'Abordar suspeitos',
        description: 'Abordagem ostensiva com cobertura de guarnição',
        effect: 'start_service',
        category: 'tatica',
        risk: 2,
      });
      push({
        id: 'revistar',
        title: 'Revistar pessoas/veículos',
        description: 'Busca pessoal e veicular por armas e objetos',
        effect: 'start_service',
        category: 'investigativa',
        risk: 2,
      });
      push({
        id: 'buscar_suspeito',
        title: 'Varredura nas imediações',
        description: 'Procurar autor em fuga em ruas e estabelecimentos próximos',
        effect: 'start_service',
        category: 'tatica',
        risk: 2,
      });
      push({
        id: 'preservar',
        title: 'Preservar o local para PC',
        description: 'Manter a cena intacta até a Polícia Civil',
        effect: 'start_service_preserve',
        category: 'investigativa',
      });
      push({
        id: 'flagrante',
        title: 'Prisão em flagrante',
        description: 'Autuar e conduzir à delegacia com materialidade',
        effect: 'flagrante',
        category: 'tatica',
        risk: 3,
      });
    }

    if (hasTag(incident, 'violencia') || has(title, /briga|agressão|agressao|vias de fato|tumulto|desordem|torcida/i)) {
      push({
        id: 'conter',
        title: 'Conter a confusão',
        description: 'Separar envolvidos e restabelecer a ordem',
        effect: 'start_service',
        category: 'tatica',
        risk: 2,
      });
      push({
        id: 'mediacao',
        title: 'Mediação entre as partes',
        description: 'Acalmar ânimos e orientar sobre vias legais',
        effect: 'start_service',
        category: 'assistencial',
      });
      push({
        id: 'conduzir_agressor',
        title: 'Conduzir agressor',
        description: 'Prender em flagrante e levar à delegacia',
        effect: 'flagrante',
        category: 'tatica',
        risk: 3,
      });
    }

    if (armed || hasTag(incident, 'arma') || has(title, /disparo|arma|tiroteio|pessoa armada/i)) {
      push({
        id: 'area_segura',
        title: 'Estabelecer área segura',
        description: 'Evacuar civis e posicionar a guarnição em cobertura',
        effect: 'start_service',
        category: 'tatica',
        risk: 3,
      });
      push({
        id: 'negociar',
        title: 'Negociar / conter armado',
        description: 'Abordagem tática, diálogo e contenção do suspeito',
        effect: 'start_service',
        category: 'tatica',
        risk: 3,
      });
      push({
        id: 'reforco_tatico',
        title: 'Solicitar reforço tático',
        description: 'Pedir Tático Móvel / GER e manter o cerco',
        effect: 'request_support',
        category: 'tatica',
        risk: 3,
      });
      push({
        id: 'busca_area',
        title: 'Busca tática na área',
        description: 'Varrer quadras e edifícios em busca do armado',
        effect: 'start_service',
        category: 'tatica',
        risk: 3,
      });
    }

    if (hasTag(incident, 'transito') || has(title, /trânsito|transito|colisão|colisao|capotamento|atropelamento|acidente|embriaguez|corrida/i)) {
      push({
        id: 'sinalizar',
        title: 'Sinalizar e organizar o trânsito',
        description: 'Cones, desvio e proteção da via',
        effect: 'start_service',
        category: 'tatica',
      });
      push({
        id: 'vitimas',
        title: 'Atender vítimas / primeiros socorros',
        description: 'Avaliação inicial até chegada do socorro',
        effect: 'start_service',
        category: 'assistencial',
        risk: 2,
      });
      push({
        id: 'croqui',
        title: 'Croqui / boletim de acidente',
        description: 'Documentar posições, danos e depoimentos',
        effect: 'start_service',
        category: 'administrativa',
      });
      push({
        id: 'abordagem_veiculo',
        title: 'Abordar condutores',
        description: 'CNH, CRLV, etilômetro e estado de embriaguez',
        effect: 'identify',
        category: 'investigativa',
      });
      push({
        id: 'hospital_vitima',
        title: 'Encaminhar vítima a hospital',
        description: 'Transporte de feridos para unidade de saúde',
        effect: 'hospital',
        category: 'assistencial',
        risk: 2,
      });
    }

    if (hasTag(incident, 'domestica') || has(title, /doméstica|domestica|medida protetiva|ameaça|ameaca/i)) {
      push({
        id: 'proteger',
        title: 'Proteger a vítima',
        description: 'Afastar o agressor e garantir segurança imediata',
        effect: 'start_service',
        category: 'assistencial',
        risk: 2,
      });
      push({
        id: 'cumprir_medida',
        title: 'Cumprir / verificar medida protetiva',
        description: 'Conferir ordem judicial e conduzir se necessário',
        effect: 'flagrante',
        category: 'tatica',
        risk: 2,
      });
      push({
        id: 'orientar_domestica',
        title: 'Orientar sobre direitos e rede de apoio',
        description: 'Informar delegacia da mulher, CREAS e canais',
        effect: 'start_service',
        category: 'assistencial',
      });
    }

    if (hasTag(incident, 'drogas') || has(title, /tráfico|trafico|drogas|entorpecente/i)) {
      push({
        id: 'apreender',
        title: 'Apreender entorpecentes',
        description: 'Revista, apreensão e isolamento do ponto',
        effect: 'start_service',
        category: 'investigativa',
        risk: 2,
      });
      push({
        id: 'conduzir_trafico',
        title: 'Conduzir envolvidos (flagrante)',
        description: 'Prisão em flagrante e condução à delegacia',
        effect: 'flagrante',
        category: 'tatica',
        risk: 3,
      });
    }

    if (hasTag(incident, 'pessoa') || has(title, /cadáver|cadaver|morte|corpo|homicídio|homicidio|desaparecida|menor|suicídio|suicidio|surto/i)) {
      push({
        id: 'isolar_crime',
        title: 'Isolar local sensível / de crime',
        description: 'Preservar a cena até a Polícia Civil',
        effect: 'start_service_preserve',
        category: 'investigativa',
        risk: 2,
      });
      push({
        id: 'testemunhas',
        title: 'Identificar testemunhas',
        description: 'Recolher contatos e depoimentos iniciais',
        effect: 'start_service',
        category: 'investigativa',
      });
      push({
        id: 'busca_area',
        title: 'Busca por pessoa / vestígios',
        description: 'Varrer área e acionar apoio se necessário',
        effect: 'start_service',
        category: 'tatica',
      });
      if (has(title, /surto|suicídio|suicidio/i)) {
        push({
          id: 'vitimas',
          title: 'Acolhimento e contenção humanizada',
          description: 'Abordagem sem agressividade; acionar saúde mental se preciso',
          effect: 'start_service',
          category: 'assistencial',
          risk: 2,
        });
      }
    }

    if (hasTag(incident, 'ordem') || has(title, /perturbação|perturbacao|som alto|manifestação|manifestacao|fila|festa/i)) {
      push({
        id: 'orientar',
        title: 'Orientar e advertir',
        description: 'Notificar responsáveis e restabelecer a ordem',
        effect: 'start_service',
        category: 'administrativa',
      });
      push({
        id: 'mediacao',
        title: 'Mediação de conflito',
        description: 'Intervir verbalmente e evitar escalada',
        effect: 'start_service',
        category: 'assistencial',
      });
    }

    // administrativos sempre disponíveis
    push({
      id: 'bo_local',
      title: 'Lavrar B.O. no local',
      description: 'Registrar ocorrência sem condução imediata',
      effect: 'bo_local',
      category: 'administrativa',
    });
    push({
      id: 'atender',
      title: 'Iniciar atendimento padrão',
      description: 'Guarnição assume a ocorrência no protocolo tático',
      effect: 'start_service',
      category: 'tatica',
    });
    push({
      id: 'reforco',
      title: 'Solicitar reforço policial',
      description: 'Pedir outra viatura e manter o local sob controle',
      effect: 'request_support',
      category: 'tatica',
    });
    push({
      id: 'nada_consta',
      title: 'Sem providências / falso alarme',
      description: 'Nada a apurar — liberar e encerrar',
      effect: 'resolve_light',
      category: 'administrativa',
    });
  }

  // ─── Bombeiros (incêndio / salvamento / médica / acidente multi-equipe) ───
  if (unit.type === 'bombeiro' || incident.type === 'incendio' || incident.type === 'samu') {
    const isUr = /ur\s*resgate|resgate/i.test(`${unit.department} ${unit.label}`);
    const isAbts = /abts|bomba|tanque/i.test(`${unit.department} ${unit.label}`);
    const isAccident = has(
      title,
      /acidente|colisão|colisao|capotamento|atropelamento|trânsito|transito|ferragem|extric/i
    );

    if (incident.type === 'incendio' || hasTag(incident, 'incendio') || has(title, /incêndio|incendio|fumaça|fumaca|queimada|gás|gas|explos/i)) {
      push({
        id: 'combate',
        title: 'Iniciar combate ao fogo',
        description: isAbts
          ? 'ABTS na linha — ataque ao foco (tempo longo)'
          : 'Posicionar equipe e atacar o foco',
        effect: 'fire_role',
        fireRole: 'combate_incendio',
        category: 'socorro',
        risk: 3,
      });
      push({
        id: 'evacuar',
        title: 'Evacuar a edificação',
        description: 'Retirar pessoas em risco e contabilizar vítimas',
        effect: 'fire_role',
        fireRole: 'salvamento',
        category: 'socorro',
        risk: 3,
      });
      push({
        id: 'isolar_incendio',
        title: 'Isolar área de risco',
        description: 'Perímetro de segurança e tráfego',
        effect: 'fire_role',
        fireRole: 'isolamento',
        category: 'tatica',
      });
      push({
        id: 'ventilacao',
        title: 'Ventilação / controle de fumaça',
        description: 'Abrir vias de escape de fumaça e avaliar estrutura',
        effect: 'fire_role',
        fireRole: 'suporte',
        category: 'socorro',
      });
    }

    if (
      isAccident ||
      hasTag(incident, 'transito') ||
      has(title, /resgate|salvamento|preso|confinado|elevador|altura|poço|poco|cisterna|ferragem|extric/i)
    ) {
      push({
        id: 'extricacao',
        title: 'Iniciar extricação / desencarceramento',
        description: isUr || isAbts
          ? 'Ferramentas de resgate — tempo conforme gravidade'
          : 'Liberar vítima presa em ferragem',
        effect: 'fire_role',
        fireRole: 'extricacao',
        category: 'socorro',
        risk: 3,
      });
      push({
        id: 'resgate',
        title: 'Resgate técnico no local',
        description: 'Operação de salvamento da vítima',
        effect: 'fire_role',
        fireRole: 'salvamento',
        category: 'socorro',
        risk: 3,
      });
      push({
        id: 'estabilizar',
        title: 'Estabilizar a vítima (APH)',
        description: isUr ? 'UR: suporte básico de vida no local' : 'Primeiros socorros e imobilização',
        effect: 'fire_role',
        fireRole: 'aph',
        category: 'socorro',
        risk: 2,
      });
      push({
        id: 'isolar_via',
        title: 'Isolar a via / segurança',
        description: 'Sinalizar, bloquear e proteger o perímetro',
        effect: 'fire_role',
        fireRole: 'isolamento',
        category: 'tatica',
      });
    }

    if (hasTag(incident, 'aquatico') || has(title, /afog|rio|água|agua|correnteza|embarcação|embarcacao/i)) {
      push({
        id: 'rescate_aquatico',
        title: 'Resgate aquático',
        description: 'Equipe de mergulho / salvamento na água',
        effect: 'fire_role',
        fireRole: 'aquatico',
        category: 'socorro',
        risk: 3,
      });
    }

    if (
      incident.type === 'samu' ||
      hasTag(incident, 'medico') ||
      has(title, /mal súbito|mal subito|parada|AVC|convuls|parto|trauma|vítima|vitima|ferida|hemorragia/i)
    ) {
      push({
        id: 'socorro',
        title: 'Prestar atendimento pré-hospitalar',
        description: isUr ? 'UR assume o APH no local' : 'Avaliação e suporte básico de vida',
        effect: 'fire_role',
        fireRole: 'aph',
        category: 'socorro',
        risk: 2,
      });
      push({
        id: 'triagem',
        title: 'Triagem e classificação de vítimas',
        description: 'Priorizar atendimento se houver múltiplas vítimas',
        effect: 'fire_role',
        fireRole: 'aph',
        category: 'socorro',
      });
      push({
        id: 'hospital',
        title: 'Encaminhar a hospital / UAI',
        description: 'Transporte da vítima após estabilização',
        effect: 'hospital',
        category: 'socorro',
      });
    }

    push({
      id: 'suporte_bm',
      title: 'Apoiar outras equipes no local',
      description: 'Logística, ferramenta e cobertura — trabalha em paralelo',
      effect: 'fire_role',
      fireRole: 'suporte',
      category: 'socorro',
    });
    push({
      id: 'atender_bm',
      title: 'Assumir papel automático',
      description: 'Sistema escolhe a função conforme a viatura (UR/ABTS/apoio)',
      effect: 'start_service',
      category: 'socorro',
    });
    push({
      id: 'reforco_bm',
      title: 'Solicitar mais equipes de bombeiros',
      description: 'Pedir UR, ABTS ou apoio no dashboard',
      effect: 'request_support',
      category: 'tatica',
    });
    push({
      id: 'sem_risco',
      title: 'Sem risco / ocorrência improcedente',
      description: 'Nada a fazer — encerrar e liberar',
      effect: 'resolve_light',
      category: 'administrativa',
    });
  }

  // ─── Ambulância (se houver) ───
  if (unit.type === 'ambulancia') {
    push({
      id: 'aph',
      title: 'Atendimento pré-hospitalar',
      description: 'Avaliar e estabilizar a vítima',
      effect: 'start_service',
      category: 'socorro',
    });
    push({
      id: 'hospital_samu',
      title: 'Remover para hospital',
      description: 'Transporte assistido',
      effect: 'hospital',
      category: 'socorro',
    });
  }

  // fallback absoluto
  if (actions.length === 0) {
    push({
      id: 'padrao',
      title: 'Iniciar atendimento',
      description: 'Guarnição age conforme o protocolo',
      effect: 'start_service',
      category: 'tatica',
    });
  }

  // Ordena: tática/socorro primeiro, depois investigativa, administrativa por último
  const order: Record<string, number> = {
    socorro: 0,
    tatica: 1,
    assistencial: 2,
    investigativa: 3,
    administrativa: 4,
  };
  actions.sort((a, b) => (order[a.category ?? 'tatica'] ?? 5) - (order[b.category ?? 'tatica'] ?? 5));

  return actions;
}

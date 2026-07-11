import type { Incident, Unit } from '../types/game';

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
  | 'fire_role'; // bombeiros: inicia papel específico (APH, extricação…)

export interface SceneAction {
  id: string;
  title: string;
  description: string;
  effect: SceneActionEffect;
  /** Papel de bombeiro (quando effect === fire_role). */
  fireRole?: string;
}

function has(title: string, re: RegExp): boolean {
  return re.test(title);
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
    if (!actions.some((x) => x.id === a.id)) actions.push(a);
  };

  const enRoute = context?.enRouteUnits ?? [];
  const onScene = context?.onSceneUnits ?? [];

  // 1ª guarnição: apurar fatos com vítima/testemunha (diálogo interativo)
  push({
    id: 'apurar',
    title: 'Apurar os fatos no local',
    description: 'Ouvir vítima/testemunha — perguntas prontas ou texto livre',
    effect: 'apurar_fatos',
  });

  // Multi-guarnição: organizar com quem já está / quem vem
  if (enRoute.length > 0 || onScene.length > 0) {
    if (enRoute.length > 0) {
      push({
        id: 'aguardar_reforco',
        title: 'Aguardar reforço e organizar',
        description: `${enRoute.map((u) => u.label).join(', ')} a caminho — manter perímetro até integrar`,
        effect: 'start_service',
      });
    }
    if (onScene.length > 0) {
      push({
        id: 'dividir_funcoes',
        title: 'Dividir funções com o apoio',
        description: `Organizar com ${onScene.map((u) => u.label).join(', ')} (contenção, vítimas, perímetro)`,
        effect: 'start_service',
      });
    }
  }

  // ─── Polícia Militar ───
  if (incident.type === 'policia' && unit.type === 'viatura') {
    if (has(title, /roubo|assalto|furto|arrombamento|invasão|invasao/i)) {
      push({
        id: 'isolar',
        title: 'Isolar o perímetro',
        description: 'Cercar a área e impedir entrada de curiosos',
        effect: 'start_service',
      });
      push({
        id: 'abordar',
        title: 'Abordar suspeitos',
        description: 'Identificar e abordar envolvidos no local',
        effect: 'start_service',
      });
      push({
        id: 'preservar',
        title: 'Preservar o local',
        description: 'Manter a cena intacta para a Polícia Civil',
        effect: incident.requiresCivilPolice ? 'start_service_preserve' : 'start_service',
      });
    }

    if (has(title, /briga|agressão|agressao|vias de fato|tumulto|desordem/i)) {
      push({
        id: 'conter',
        title: 'Conter a confusão',
        description: 'Separar envolvidos e restabelecer a ordem',
        effect: 'start_service',
      });
      push({
        id: 'conduzir_agressor',
        title: 'Conduzir agressor',
        description: 'Prender em flagrante e levar à delegacia',
        effect: 'delegacia',
      });
    }

    if (has(title, /disparo|arma|tiroteio|pessoa armada/i)) {
      push({
        id: 'area_segura',
        title: 'Estabelecer área segura',
        description: 'Evacuar civis e posicionar a guarnição',
        effect: 'start_service',
      });
      push({
        id: 'negociar',
        title: 'Negociar / conter armado',
        description: 'Abordagem tática e contenção do suspeito',
        effect: 'start_service',
      });
      push({
        id: 'reforco_tatico',
        title: 'Solicitar reforço tático',
        description: 'Pedir apoio e manter o cerco',
        effect: 'request_support',
      });
    }

    if (has(title, /trânsito|transito|colisão|colisao|capotamento|atropelamento|acidente/i)) {
      push({
        id: 'sinalizar',
        title: 'Sinalizar e liberar via',
        description: 'Organizar o trânsito e proteger o local',
        effect: 'start_service',
      });
      push({
        id: 'vitimas',
        title: 'Atender vítimas / socorro',
        description: 'Prestar primeiros cuidados até o socorro',
        effect: 'start_service',
      });
      push({
        id: 'hospital_vitima',
        title: 'Encaminhar vítima a hospital',
        description: 'Transporte de feridos para unidade de saúde',
        effect: 'hospital',
      });
    }

    if (has(title, /doméstica|domestica|medida protetiva|ameaça|ameaca/i)) {
      push({
        id: 'proteger',
        title: 'Proteger a vítima',
        description: 'Afastar o agressor e garantir segurança',
        effect: 'start_service',
      });
      push({
        id: 'cumprir_medida',
        title: 'Cumprir medida protetiva',
        description: 'Aplicar a medida e conduzir se necessário',
        effect: 'delegacia',
      });
    }

    if (has(title, /tráfico|trafico|drogas|entorpecente/i)) {
      push({
        id: 'apreender',
        title: 'Apreender entorpecentes',
        description: 'Revista, apreensão e isolamento do ponto',
        effect: 'start_service',
      });
      push({
        id: 'conduzir_trafico',
        title: 'Conduzir envolvidos',
        description: 'Prisão em flagrante e condução',
        effect: 'delegacia',
      });
    }

    if (has(title, /cadáver|cadaver|morte|corpo|homicídio|homicidio/i)) {
      push({
        id: 'isolar_crime',
        title: 'Isolar local de crime',
        description: 'Preservar a cena até a Polícia Civil',
        effect: 'start_service_preserve',
      });
      push({
        id: 'testemunhas',
        title: 'Identificar testemunhas',
        description: 'Recolher contatos e depoimentos iniciais',
        effect: 'start_service',
      });
    }

    if (has(title, /embriaguez|direção perigosa|direcao perigosa|corrida ilegal/i)) {
      push({
        id: 'abordagem_veiculo',
        title: 'Abordar o condutor',
        description: 'Fiscalizar documentos e estado do motorista',
        effect: 'start_service',
      });
      push({
        id: 'recolher_cnh',
        title: 'Autuar e recolher veículo',
        description: 'Medidas administrativas e condução se couber',
        effect: 'start_service',
      });
    }

    // genéricos PM
    push({
      id: 'atender',
      title: 'Iniciar atendimento no local',
      description: 'Guarnição assume a ocorrência e age no padrão',
      effect: 'start_service',
    });
    push({
      id: 'reforco',
      title: 'Solicitar reforço',
      description: 'Pedir outra viatura e manter o local',
      effect: 'request_support',
    });
    push({
      id: 'nada_consta',
      title: 'Sem providências / falso alarme',
      description: 'Nada a apurar — liberar e encerrar',
      effect: 'resolve_light',
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

    if (incident.type === 'incendio' || has(title, /incêndio|incendio|fumaça|fumaca|queimada|gás|gas|explos/i)) {
      push({
        id: 'combate',
        title: 'Iniciar combate ao fogo',
        description: isAbts
          ? 'ABTS na linha — ataque ao foco (tempo longo)'
          : 'Posicionar equipe e atacar o foco',
        effect: 'fire_role',
        fireRole: 'combate_incendio',
      });
      push({
        id: 'evacuar',
        title: 'Evacuar a edificação',
        description: 'Retirar pessoas em risco',
        effect: 'fire_role',
        fireRole: 'salvamento',
      });
      push({
        id: 'isolar_incendio',
        title: 'Isolar área de risco',
        description: 'Perímetro de segurança e tráfego',
        effect: 'fire_role',
        fireRole: 'isolamento',
      });
    }

    if (
      isAccident ||
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
      });
      push({
        id: 'resgate',
        title: 'Resgate técnico no local',
        description: 'Operação de salvamento da vítima',
        effect: 'fire_role',
        fireRole: 'salvamento',
      });
      push({
        id: 'estabilizar',
        title: 'Estabilizar a vítima (APH)',
        description: isUr ? 'UR: suporte básico de vida no local' : 'Primeiros socorros e imobilização',
        effect: 'fire_role',
        fireRole: 'aph',
      });
      push({
        id: 'isolar_via',
        title: 'Isolar a via / segurança',
        description: 'Sinalizar, bloquear e proteger o perímetro',
        effect: 'fire_role',
        fireRole: 'isolamento',
      });
    }

    if (has(title, /afog|rio|água|agua|correnteza|embarcação|embarcacao/i)) {
      push({
        id: 'rescate_aquatico',
        title: 'Resgate aquático',
        description: 'Equipe de mergulho / salvamento na água',
        effect: 'fire_role',
        fireRole: 'aquatico',
      });
    }

    if (
      incident.type === 'samu' ||
      has(title, /mal súbito|mal subito|parada|AVC|convuls|parto|trauma|vítima|vitima|ferida|hemorragia/i)
    ) {
      push({
        id: 'socorro',
        title: 'Prestar atendimento pré-hospitalar',
        description: isUr ? 'UR assume o APH no local' : 'Avaliação e suporte básico de vida',
        effect: 'fire_role',
        fireRole: 'aph',
      });
      push({
        id: 'hospital',
        title: 'Encaminhar a hospital / UAI',
        description: 'Transporte da vítima após estabilização',
        effect: 'hospital',
      });
    }

    push({
      id: 'suporte_bm',
      title: 'Apoiar outras equipes no local',
      description: 'Logística, ferramenta e cobertura — trabalha em paralelo',
      effect: 'fire_role',
      fireRole: 'suporte',
    });
    push({
      id: 'atender_bm',
      title: 'Assumir papel automático',
      description: 'Sistema escolhe a função conforme a viatura (UR/ABTS/apoio)',
      effect: 'start_service',
    });
    push({
      id: 'reforco_bm',
      title: 'Solicitar mais equipes de bombeiros',
      description: 'Pedir UR, ABTS ou apoio no dashboard',
      effect: 'request_support',
    });
    push({
      id: 'sem_risco',
      title: 'Sem risco / ocorrência improcedente',
      description: 'Nada a fazer — encerrar e liberar',
      effect: 'resolve_light',
    });
  }

  // ─── Ambulância (se houver) ───
  if (unit.type === 'ambulancia') {
    push({
      id: 'aph',
      title: 'Atendimento pré-hospitalar',
      description: 'Avaliar e estabilizar a vítima',
      effect: 'start_service',
    });
    push({
      id: 'hospital_samu',
      title: 'Remover para hospital',
      description: 'Transporte assistido',
      effect: 'hospital',
    });
  }

  // fallback absoluto
  if (actions.length === 0) {
    push({
      id: 'padrao',
      title: 'Iniciar atendimento',
      description: 'Guarnição age conforme o protocolo',
      effect: 'start_service',
    });
  }

  return actions;
}

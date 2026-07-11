/**
 * IA tática da corporação — planeja e prioriza ações no local
 * como uma guarnição experiente (PM / BM / PC).
 */
import type { CityBase } from '../types/city';
import type { Incident, Unit } from '../types/game';
import { hospitalBases } from './dispatch';
import { haversineDistanceMeters } from './geo';
import { isCivilPoliceUnit } from './civilPolice';
import {
  buildSceneActions,
  type SceneAction,
  type SceneActionContext,
} from './sceneActions';

export type TacticalPolicePick = 'delegacia' | 'liberar' | 'hospital' | 'encerrar';
export type TacticalCivilPick = 'concluir_bo' | 'prisao' | 'provas' | 'arquivar';
export type TacticalDispositionPick = 'retornar' | 'deslocar';

export interface TacticalPlan {
  /** Sequência de ações a executar no local (ordem). */
  actions: SceneAction[];
  /** Resumo legível para o diário / UI. */
  rationale: string;
  /** Confiança 0–1 da IA na estratégia. */
  confidence: number;
}

function scoreAction(action: SceneAction, incident: Incident, unit: Unit, step: number): number {
  let s = 0;
  const id = action.id;
  const tags = incident.tags ?? [];
  const armed = !!incident.armed || tags.includes('arma');
  const victims = incident.victimCount ?? 0;
  const isSupport = !!incident.assignedUnitId && incident.assignedUnitId !== unit.id;

  // categorias base
  if (action.category === 'tatica') s += 12;
  if (action.category === 'socorro') s += 14;
  if (action.category === 'investigativa') s += 8;
  if (action.category === 'assistencial') s += 7;
  if (action.category === 'administrativa') s += 3;

  // prioridade da ocorrência
  s += (4 - incident.priority) * 6;

  // armado → perímetro / tático primeiro
  if (armed) {
    if (['area_segura', 'perimetro', 'isolar', 'negociar', 'reforco_tatico', 'busca_area'].includes(id)) s += 40;
    if (id === 'nada_consta' || id === 'sem_risco') s -= 50;
  }

  // vítimas → socorro
  if (victims > 0) {
    if (['vitimas', 'socorro', 'estabilizar', 'hospital', 'hospital_vitima', 'triagem', 'aph'].includes(id)) s += 35;
    if (action.effect === 'hospital' || action.effect === 'fire_role' && action.fireRole === 'aph') s += 20;
  }

  // tags específicas
  if (tags.includes('violencia')) {
    if (['conter', 'mediacao', 'flagrante', 'conduzir_agressor', 'proteger'].includes(id)) s += 28;
  }
  if (tags.includes('patrimonio')) {
    if (['isolar', 'preservar', 'abordar', 'revistar', 'buscar_suspeito', 'fotos_local', 'flagrante'].includes(id))
      s += 26;
  }
  if (tags.includes('drogas')) {
    if (['apreender', 'revistar', 'conduzir_trafico', 'flagrante'].includes(id)) s += 30;
  }
  if (tags.includes('domestica')) {
    if (['proteger', 'cumprir_medida', 'orientar_domestica', 'apurar'].includes(id)) s += 32;
  }
  if (tags.includes('transito')) {
    if (['sinalizar', 'vitimas', 'croqui', 'abordagem_veiculo', 'extricacao', 'isolar_via'].includes(id)) s += 28;
  }
  if (tags.includes('pessoa') || tags.includes('flagrante')) {
    if (['isolar_crime', 'preservar', 'testemunhas', 'busca_area', 'apurar'].includes(id)) s += 30;
  }
  if (tags.includes('incendio')) {
    if (['combate', 'evacuar', 'isolar_incendio', 'ventilacao'].includes(id)) s += 36;
  }
  if (tags.includes('medico')) {
    if (['socorro', 'triagem', 'hospital', 'estabilizar', 'aph'].includes(id)) s += 34;
  }
  if (tags.includes('aquatico')) {
    if (id === 'rescate_aquatico') s += 40;
  }

  // 1ª ação: preferir apuração / perímetro / combate
  if (step === 0) {
    if (id === 'apurar' && unit.type === 'viatura' && !armed) s += 18;
    if (['perimetro', 'area_segura', 'isolar', 'combate', 'sinalizar'].includes(id)) s += 15;
    if (action.effect === 'resolve_light') s -= 40;
    if (action.effect === 'bo_local') s -= 10;
  }

  // apoio não é principal: evita B.O. / flagrante duplicado; faz suporte
  if (isSupport) {
    if (['bo_local', 'flagrante', 'apurar', 'nada_consta'].includes(id)) s -= 25;
    if (['dividir_funcoes', 'aguardar_reforco', 'perimetro', 'suporte_bm', 'vitimas', 'revistar'].includes(id))
      s += 22;
    if (unit.type === 'bombeiro' && action.effect === 'fire_role') s += 20;
  }

  // risco alto só se necessário
  if (action.risk === 3 && !armed && victims === 0) s -= 8;
  if (action.risk === 3 && armed) s += 10;

  // evitar falso alarme cedo
  if ((id === 'nada_consta' || id === 'sem_risco') && incident.priority === 1) s -= 60;

  // jitter leve para não ser robótico
  s += Math.random() * 4;

  return s;
}

function scoreActionWithBases(
  action: SceneAction,
  incident: Incident,
  unit: Unit,
  step: number,
  bases: CityBase[]
): number {
  let s = scoreAction(action, incident, unit, step);
  if (isCivilPoliceUnit(unit, bases)) {
    if (['preservar', 'isolar_crime', 'testemunhas', 'fotos_local', 'apurar', 'bo_local'].includes(action.id)) {
      s += 25;
    }
  }
  return s;
}

/**
 * Monta um plano de 2–5 ações realistas para a guarnição no local.
 */
export function planTacticalResponse(
  incident: Incident,
  unit: Unit,
  allUnits: Unit[],
  bases: CityBase[]
): TacticalPlan {
  const enRouteUnits = allUnits.filter(
    (u) =>
      u.id !== unit.id &&
      u.assignedIncidentId === incident.id &&
      u.status === 'a_caminho'
  );
  const onSceneUnits = allUnits.filter(
    (u) =>
      u.id !== unit.id &&
      u.assignedIncidentId === incident.id &&
      (u.status === 'no_local' ||
        u.status === 'aguardando_decisao' ||
        u.status === 'em_operacao')
  );

  const ctx: SceneActionContext = { enRouteUnits, onSceneUnits };
  const catalog = buildSceneActions(incident, unit, ctx);

  // ranqueia
  const ranked = catalog
    .map((a) => ({ a, score: scoreActionWithBases(a, incident, unit, 0, bases) }))
    .sort((x, y) => y.score - x.score);

  const isSupport = !!incident.assignedUnitId && incident.assignedUnitId !== unit.id;
  const armed = !!incident.armed || (incident.tags ?? []).includes('arma');
  const victims = incident.victimCount ?? 0;

  // tamanho do plano
  let planSize = 3;
  if (incident.priority === 1 || armed) planSize = 4;
  if (victims > 1 || (incident.tags ?? []).includes('incendio')) planSize = 5;
  if (isSupport) planSize = Math.min(planSize, 2);
  if (incident.priority === 3 && !armed) planSize = 2;

  const picked: SceneAction[] = [];
  const usedIds = new Set<string>();
  const usedEffects = new Set<string>();

  // fases desejadas (orquestra a sequência)
  const phases: Array<(a: SceneAction) => boolean> = isSupport
    ? [
        (a) =>
          ['perimetro', 'dividir_funcoes', 'aguardar_reforco', 'isolar_via', 'suporte_bm', 'vitimas'].includes(
            a.id
          ) || a.effect === 'fire_role',
        (a) => a.category === 'tatica' || a.category === 'socorro' || a.category === 'assistencial',
      ]
    : unit.type === 'bombeiro' || incident.type === 'incendio' || incident.type === 'samu'
      ? [
          (a) =>
            ['combate', 'isolar_incendio', 'isolar_via', 'sinalizar', 'area_segura', 'evacuar'].includes(a.id) ||
            a.fireRole === 'isolamento' ||
            a.fireRole === 'combate_incendio',
          (a) =>
            a.effect === 'fire_role' ||
            ['socorro', 'estabilizar', 'extricacao', 'resgate', 'triagem', 'vitimas'].includes(a.id),
          (a) => a.effect === 'hospital' || a.id === 'hospital' || a.id === 'hospital_vitima',
        ]
      : [
          // PM principal
          (a) =>
            ['perimetro', 'area_segura', 'isolar', 'isolar_crime', 'sinalizar', 'apurar'].includes(a.id) ||
            a.effect === 'apurar_fatos',
          (a) =>
            ['conter', 'proteger', 'abordar', 'revistar', 'busca_area', 'buscar_suspeito', 'negociar', 'vitimas'].includes(
              a.id
            ),
          (a) =>
            ['testemunhas', 'fotos_local', 'croqui', 'apreender', 'preservar', 'identificar'].includes(a.id) ||
            a.effect === 'identify',
          (a) =>
            a.effect === 'flagrante' ||
            a.effect === 'bo_local' ||
            a.effect === 'hospital' ||
            ['flagrante', 'bo_local', 'hospital_vitima', 'conduzir_agressor', 'conduzir_trafico'].includes(a.id),
        ];

  for (const phase of phases) {
    if (picked.length >= planSize) break;
    const candidate = ranked.find(
      ({ a }) => phase(a) && !usedIds.has(a.id) && !(a.effect === 'resolve_light' && picked.length === 0)
    );
    if (candidate) {
      picked.push(candidate.a);
      usedIds.add(candidate.a.id);
      usedEffects.add(candidate.a.effect);
    }
  }

  // completa com melhores restantes (sem duplicar resolve_light cedo)
  for (const { a } of ranked) {
    if (picked.length >= planSize) break;
    if (usedIds.has(a.id)) continue;
    if (a.effect === 'resolve_light' && picked.length < planSize - 1) continue;
    if (a.effect === 'request_support' && enRouteUnits.length > 0) continue;
    // evita dois flagrantes
    if (a.effect === 'flagrante' && usedEffects.has('flagrante')) continue;
    if (a.effect === 'bo_local' && usedEffects.has('flagrante')) continue;
    picked.push(a);
    usedIds.add(a.id);
    usedEffects.add(a.effect);
  }

  // se plano vazio, força atendimento padrão
  if (picked.length === 0 && ranked[0]) {
    picked.push(ranked[0].a);
  }

  // não terminar só com request_support
  if (picked.length === 1 && picked[0].effect === 'request_support') {
    const alt = ranked.find(({ a }) => a.effect === 'start_service' || a.effect === 'fire_role');
    if (alt) picked.push(alt.a);
  }

  const confidence = Math.min(
    0.98,
    0.55 +
      (incident.tags?.length ?? 0) * 0.05 +
      (armed ? 0.1 : 0) +
      (picked.length >= 3 ? 0.12 : 0.05) +
      (incident.priority === 1 ? 0.08 : 0)
  );

  const role = isSupport ? 'apoio' : 'guarnição principal';
  const rationale = [
    `IA tática (${role}) — ${unit.label}`,
    `Prioridade P${incident.priority}${armed ? ' · armado' : ''}${victims ? ` · ${victims} vit.` : ''}`,
    `Plano: ${picked.map((p) => p.title).join(' → ')}`,
  ].join(' · ');

  return { actions: picked, rationale, confidence };
}

/** Decisão policial final automática. */
export function planPoliceDecision(incident: Incident, unit: Unit): TacticalPolicePick {
  const tags = incident.tags ?? [];
  const armed = !!incident.armed || tags.includes('arma');
  const outcomes = (incident.outcomes ?? []).join(' ').toLowerCase();

  if (
    outcomes.includes('flagrante') ||
    outcomes.includes('condução') ||
    outcomes.includes('ilicito') ||
    outcomes.includes('ilícito') ||
    armed ||
    tags.includes('drogas') ||
    tags.includes('violencia')
  ) {
    // se mencionou liberado na identificação, pode encerrar
    if (outcomes.includes('nada consta') && !armed && Math.random() < 0.35) {
      return 'encerrar';
    }
    return 'delegacia';
  }

  if ((incident.victimCount ?? 0) > 0 || outcomes.includes('médic') || outcomes.includes('medic')) {
    return 'hospital';
  }

  if (tags.includes('ordem') || incident.priority === 3) {
    return Math.random() < 0.5 ? 'liberar' : 'encerrar';
  }

  if (outcomes.includes('b.o.') || outcomes.includes('bo-')) {
    return 'encerrar';
  }

  void unit;
  return incident.priority === 1 ? 'delegacia' : 'encerrar';
}

export function planCivilDecision(incident: Incident): TacticalCivilPick {
  const outcomes = (incident.outcomes ?? []).join(' ').toLowerCase();
  if (outcomes.includes('flagrante') || outcomes.includes('prisão') || outcomes.includes('preso')) {
    return 'prisao';
  }
  if (outcomes.includes('prova') || outcomes.includes('preserv')) {
    return 'provas';
  }
  if (incident.priority === 3 && Math.random() < 0.3) return 'arquivar';
  return 'concluir_bo';
}

export function planDisposition(_incident: Incident, _unit: Unit): TacticalDispositionPick {
  // padrão corporativo: retornar à base (disponível de novo)
  return 'retornar';
}

export function planHospitalId(unit: Unit, bases: CityBase[]): string | null {
  const hospitals = hospitalBases(bases)
    .map((h) => ({ id: h.id, d: haversineDistanceMeters(unit.position, h.location) }))
    .sort((a, b) => a.d - b.d);
  return hospitals[0]?.id ?? null;
}

/** Mensagem curta de rádio/IA para o diário. */
export function aiRadioCall(unit: Unit, incident: Incident, phase: string): string {
  return `IA · ${unit.label}: ${phase} — ${incident.protocolNumber ?? incident.title}`;
}

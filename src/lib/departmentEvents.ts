import type { UnitType } from '../types/game';
import type { PatrolEventRoll } from './patrolEvents';
import { rollPatrolEvent } from './patrolEvents';
import { chance, pickWeighted } from './random';

interface DeptEventTemplate {
  type: PatrolEventRoll['type'];
  description: string;
  outcomeOk: string;
  outcomeArrest: string;
  arrestChance: number;
}

const BY_DEPARTMENT: Record<string, DeptEventTemplate[]> = {
  Ambiental: [
    {
      type: 'abordagem_veiculo',
      description: 'Fiscalização de canoa/embarcação sem documentação',
      outcomeOk: 'Embarcação regularizada — liberada com orientação',
      outcomeArrest: 'Canoa sem registro e redes ilegais — material apreendido',
      arrestChance: 0.22,
    },
    {
      type: 'abordagem_pedestre',
      description: 'Abordagem por suspeita de pesca ilegal em área protegida',
      outcomeOk: 'Documentação e equipamento regulares — liberado',
      outcomeArrest: 'Pesca ilegal confirmada — autuação e apreensão do pescado',
      arrestChance: 0.28,
    },
    {
      type: 'abordagem_pedestre',
      description: 'Verificação de descarte irregular / poluição de córrego',
      outcomeOk: 'Orientação ambiental prestada — sem infração',
      outcomeArrest: 'Descarte irregular flagrado — autuação ambiental',
      arrestChance: 0.15,
    },
    {
      type: 'abordagem_veiculo',
      description: 'Fiscalização de transporte de madeira / carga florestal',
      outcomeOk: 'Nota fiscal e guia florestal ok — liberado',
      outcomeArrest: 'Carga irregular sem documentação — veículo retido',
      arrestChance: 0.18,
    },
    {
      type: 'perseguicao',
      description: 'Perseguição a suspeitos de caça ilegal na área',
      outcomeOk: 'Suspeitos não localizados na mata',
      outcomeArrest: 'Caçadores detidos com armadilhas e armas',
      arrestChance: 0.3,
    },
  ],
  'Patrulha Rural': [
    {
      type: 'abordagem_veiculo',
      description: 'Veículo sem documentação em zona rural',
      outcomeOk: 'Documentação regular — liberado',
      outcomeArrest: 'Veículo irregular e carga suspeita — condutor detido',
      arrestChance: 0.2,
    },
    {
      type: 'abordagem_pedestre',
      description: 'Verificação de gado na pista / propriedade rural',
      outcomeOk: 'Situação controlada com o proprietário',
      outcomeArrest: 'Furto de gado em flagrante — envolvido detido',
      arrestChance: 0.12,
    },
    {
      type: 'pedido_apoio',
      description: 'Estrada barrada / conflito fundiário — solicitou reforço',
      outcomeOk: 'Apoio a caminho para a zona rural',
      outcomeArrest: 'Conflito contido com apoio',
      arrestChance: 0.05,
    },
    {
      type: 'abordagem_veiculo',
      description: 'Abordagem a pickup em estrada vicinal suspeita',
      outcomeOk: 'Rotina — sem irregularidades',
      outcomeArrest: 'Ferramentas e produto de furto rural apreendidos',
      arrestChance: 0.16,
    },
  ],
  'Rádio Patrulha': [
    {
      type: 'abordagem_veiculo',
      description: 'Abordagem de rotina a veículo na área',
      outcomeOk: 'Documentação regular — liberado',
      outcomeArrest: 'Veículo com restrição — condutor detido',
      arrestChance: 0.1,
    },
    {
      type: 'abordagem_pedestre',
      description: 'Abordagem a pedestre em atitude suspeita',
      outcomeOk: 'Identidade ok — liberado',
      outcomeArrest: 'Mandado em aberto — conduzido',
      arrestChance: 0.12,
    },
    {
      type: 'perseguicao',
      description: 'Perseguição a veículo que evadiu abordagem',
      outcomeOk: 'Suspeito não localizado',
      outcomeArrest: 'Condutor alcançado e preso',
      arrestChance: 0.35,
    },
    {
      type: 'pedido_apoio',
      description: 'Briga / tumulto — solicitou reforço na área',
      outcomeOk: 'Apoio solicitado ao COPOM',
      outcomeArrest: 'Envolvidos contidos com apoio',
      arrestChance: 0.08,
    },
  ],
  Rodoviária: [
    {
      type: 'abordagem_veiculo',
      description: 'Fiscalização de excesso de velocidade / radar',
      outcomeOk: 'Dentro do limite — liberado',
      outcomeArrest: 'Embriaguez ao volante — condutor autuado e recolhido',
      arrestChance: 0.14,
    },
    {
      type: 'abordagem_veiculo',
      description: 'Fiscalização de carga e documentação do veículo',
      outcomeOk: 'Carga e documentos ok',
      outcomeArrest: 'Carga irregular / sem nota — retenção do veículo',
      arrestChance: 0.18,
    },
    {
      type: 'abordagem_veiculo',
      description: 'Atendimento a acidente leve na via',
      outcomeOk: 'BO e liberação da via',
      outcomeArrest: 'Condutor embriagado no acidente — detido',
      arrestChance: 0.1,
    },
  ],
  'Tático Móvel': [
    {
      type: 'abordagem_pedestre',
      description: 'Abordagem ostensiva a grupo suspeito',
      outcomeOk: 'Área pacificada — sem prisões',
      outcomeArrest: 'Armas e entorpecentes apreendidos — detidos',
      arrestChance: 0.25,
    },
    {
      type: 'perseguicao',
      description: 'Cerco e perseguição tática a suspeito armado',
      outcomeOk: 'Suspeito evadiu o cerco',
      outcomeArrest: 'Suspeito rendido e preso',
      arrestChance: 0.4,
    },
    {
      type: 'pedido_apoio',
      description: 'Apoio tático solicitado por outra viatura',
      outcomeOk: 'Equipe tática em deslocamento de apoio',
      outcomeArrest: 'Apoio concluído com prisão',
      arrestChance: 0.15,
    },
  ],
  GER: [
    {
      type: 'abordagem_pedestre',
      description: 'Ação GER em área de risco',
      outcomeOk: 'Área varrida — sem ocorrência',
      outcomeArrest: 'Prisão em flagrante na operação GER',
      arrestChance: 0.3,
    },
    {
      type: 'abordagem_veiculo',
      description: 'Abordagem GER a veículo em corredor de risco',
      outcomeOk: 'Sem irregularidades',
      outcomeArrest: 'Veículo com restrição e ocupantes detidos',
      arrestChance: 0.22,
    },
    {
      type: 'perseguicao',
      description: 'Perseguição GER a alvo prioritário',
      outcomeOk: 'Alvo não localizado',
      outcomeArrest: 'Alvo capturado',
      arrestChance: 0.38,
    },
  ],
  'Polícia Civil': [
    {
      type: 'abordagem_pedestre',
      description: 'Diligência / intimação em endereço da área',
      outcomeOk: 'Diligência cumprida sem resistência',
      outcomeArrest: 'Mandado cumprido — conduzido à delegacia',
      arrestChance: 0.2,
    },
    {
      type: 'abordagem_veiculo',
      description: 'Local de crime / preservação e vistorias',
      outcomeOk: 'Local preservado e periciado',
      outcomeArrest: 'Suspeito localizado e preso em flagrante',
      arrestChance: 0.15,
    },
  ],
  Bombeiros: [
    {
      type: 'pedido_apoio',
      description: 'Verificação de risco de incêndio / prevenção',
      outcomeOk: 'Risco controlado — orientação prestada',
      outcomeArrest: 'Princípio de incêndio contido',
      arrestChance: 0.05,
    },
    {
      type: 'abordagem_pedestre',
      description: 'Salvamento de animal / resgate leve',
      outcomeOk: 'Resgate concluído com sucesso',
      outcomeArrest: 'Situação estabilizada',
      arrestChance: 0.02,
    },
    {
      type: 'pedido_apoio',
      description: 'Vazamento / produto perigoso — avaliação no local',
      outcomeOk: 'Área isolada e liberada',
      outcomeArrest: 'Vazamento contido com apoio especializado',
      arrestChance: 0.08,
    },
  ],
};

function templatesFor(department: string, unitType: UnitType): DeptEventTemplate[] {
  if (BY_DEPARTMENT[department]?.length) return BY_DEPARTMENT[department];
  if (unitType === 'bombeiro') return BY_DEPARTMENT.Bombeiros;
  if (department.toLowerCase().includes('ambiental')) return BY_DEPARTMENT.Ambiental;
  if (department.toLowerCase().includes('rural')) return BY_DEPARTMENT['Patrulha Rural'];
  if (department.toLowerCase().includes('rodov')) return BY_DEPARTMENT.Rodoviária;
  if (department.toLowerCase().includes('tático') || department.toLowerCase().includes('tatico'))
    return BY_DEPARTMENT['Tático Móvel'];
  if (department.toLowerCase().includes('ger') || department.toLowerCase().includes('cipe'))
    return BY_DEPARTMENT.GER;
  if (department.toLowerCase().includes('civil')) return BY_DEPARTMENT['Polícia Civil'];
  if (department.toLowerCase().includes('rádio') || department.toLowerCase().includes('radio'))
    return BY_DEPARTMENT['Rádio Patrulha'];
  return [];
}

/** Evento de fiscalização/abordagem conforme a especialidade da viatura. */
export function rollDepartmentEvent(department: string, unitType: UnitType): PatrolEventRoll {
  const templates = templatesFor(department, unitType);
  if (templates.length === 0) return rollPatrolEvent();

  const weights: Record<string, number> = {};
  templates.forEach((_, i) => {
    weights[String(i)] = 1;
  });
  const idx = Number(pickWeighted(weights));
  const picked = templates[idx] ?? templates[0];
  const arrest = chance(picked.arrestChance);

  return {
    type: picked.type,
    description: picked.description,
    outcome: arrest ? picked.outcomeArrest : picked.outcomeOk,
    arrest,
  };
}

import type { PatrolEventType, VehicleCheck } from '../types/game';
import { chance, pickWeighted } from './random';
import { generateVehicleCheck } from './vehicleCheck';

const EVENT_WEIGHTS: Record<PatrolEventType, number> = {
  abordagem_veiculo: 0.45,
  abordagem_pedestre: 0.35,
  pedido_apoio: 0.12,
  perseguicao: 0.08,
};

// Baseado em como a abordagem funciona na prática: mandado em aberto é o que
// justifica prender um pedestre; a maioria das abordagens termina em liberação.
const PEDESTRIAN_ARREST_PROBABILITY = 0.08;
const PURSUIT_ARREST_PROBABILITY = 0.35;

export interface PatrolEventRoll {
  type: PatrolEventType;
  description: string;
  outcome: string;
  arrest: boolean;
  vehicleCheck?: VehicleCheck;
}

export function rollPatrolEvent(): PatrolEventRoll {
  const type = pickWeighted(EVENT_WEIGHTS);

  if (type === 'abordagem_veiculo') {
    const vehicleCheck = generateVehicleCheck();
    const arrest = vehicleCheck.outcome === 'apreendido';
    const outcome =
      vehicleCheck.outcome === 'apreendido'
        ? 'Veículo com registro de furto/roubo — condutor detido'
        : vehicleCheck.outcome === 'multado'
          ? 'IPVA em atraso — condutor multado e notificado'
          : 'Documentação regular — liberado';
    return {
      type,
      description: `Abordagem a veículo ${vehicleCheck.model} (${vehicleCheck.plate})`,
      outcome,
      arrest,
      vehicleCheck,
    };
  }

  if (type === 'abordagem_pedestre') {
    const arrest = chance(PEDESTRIAN_ARREST_PROBABILITY);
    return {
      type,
      description: 'Abordagem a pedestre para verificação',
      outcome: arrest ? 'Mandado de prisão em aberto — pedestre detido' : 'Documentação regular — liberado',
      arrest,
    };
  }

  if (type === 'pedido_apoio') {
    return {
      type,
      description: 'Solicitou reforço de outra viatura na área',
      outcome: 'Apoio a caminho',
      arrest: false,
    };
  }

  const arrest = chance(PURSUIT_ARREST_PROBABILITY);
  return {
    type: 'perseguicao',
    description: 'Iniciou perseguição a veículo suspeito',
    outcome: arrest ? 'Suspeito alcançado e preso' : 'Suspeito não localizado',
    arrest,
  };
}

/** Eventos de patrulha mais espaçados — menos spam no painel. */
const MIN_PATROL_EVENT_INTERVAL_MS = 40_000;
const MAX_PATROL_EVENT_INTERVAL_MS = 95_000;

export function nextPatrolEventDelay(): number {
  return (
    MIN_PATROL_EVENT_INTERVAL_MS +
    Math.random() * (MAX_PATROL_EVENT_INTERVAL_MS - MIN_PATROL_EVENT_INTERVAL_MS)
  );
}

const MIN_BLITZ_CHECK_INTERVAL_MS = 18_000;
const MAX_BLITZ_CHECK_INTERVAL_MS = 38_000;

export function nextBlitzCheckDelay(): number {
  return (
    MIN_BLITZ_CHECK_INTERVAL_MS +
    Math.random() * (MAX_BLITZ_CHECK_INTERVAL_MS - MIN_BLITZ_CHECK_INTERVAL_MS)
  );
}

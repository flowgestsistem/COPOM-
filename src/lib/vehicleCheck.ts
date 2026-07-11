import type { VehicleCheck } from '../types/game';
import { chance, pickOne, randomInt } from './random';

// Modelos populares no mercado brasileiro
const MODELS = [
  'Volkswagen Gol',
  'Volkswagen Fox',
  'Fiat Uno',
  'Fiat Palio',
  'Fiat Strada',
  'Chevrolet Onix',
  'Chevrolet Celta',
  'Hyundai HB20',
  'Renault Kwid',
  'Toyota Corolla',
  'Honda Civic',
  'Honda CG 160',
  'Yamaha Factor 125',
  'Honda Biz 125',
];

const PLATE_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const PLATE_DIGITS = '0123456789';

function randomChar(pool: string): string {
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Placa no padrão Mercosul (LLL#L##). */
function generatePlate(): string {
  return (
    randomChar(PLATE_LETTERS) +
    randomChar(PLATE_LETTERS) +
    randomChar(PLATE_LETTERS) +
    randomChar(PLATE_DIGITS) +
    randomChar(PLATE_LETTERS) +
    randomChar(PLATE_DIGITS) +
    randomChar(PLATE_DIGITS)
  );
}

const IPVA_PAGO_PROBABILITY = 0.78;
const ROUBADO_PROBABILITY = 0.03;
const MULTA_SE_IPVA_ATRASADO_PROBABILITY = 0.3;

/**
 * Gera um "boletim" de veículo plausível para abordagem/blitz.
 *
 * Baseado em como a fiscalização funciona no Brasil: IPVA atrasado por si só
 * normalmente gera multa/notificação (CTB), não prisão do condutor. Veículo
 * com registro de furto/roubo é o que justifica apreensão e detenção.
 */
export function generateVehicleCheck(): VehicleCheck {
  const ipvaPago = chance(IPVA_PAGO_PROBABILITY);
  const roubado = chance(ROUBADO_PROBABILITY);

  let outcome: VehicleCheck['outcome'] = 'liberado';
  if (roubado) {
    outcome = 'apreendido';
  } else if (!ipvaPago && chance(MULTA_SE_IPVA_ATRASADO_PROBABILITY)) {
    outcome = 'multado';
  }

  return {
    id: `check-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    plate: generatePlate(),
    model: pickOne(MODELS),
    year: randomInt(2003, 2024),
    ipvaPago,
    roubado,
    outcome,
    checkedAt: Date.now(),
  };
}

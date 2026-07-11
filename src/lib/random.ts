export function pickWeighted<T extends string>(weights: Record<T, number>): T {
  const entries = Object.entries(weights) as [T, number][];
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let roll = Math.random() * total;
  for (const [key, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return key;
  }
  return entries[entries.length - 1][0];
}

export function pickOne<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

export function randomInt(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min + 1));
}

export function chance(probability: number): boolean {
  return Math.random() < probability;
}

/**
 * Intervalo entre eventos independentes e aleatórios (processo de Poisson) —
 * o mesmo modelo estatístico usado pra chamadas de emergência reais: a maioria
 * dos intervalos fica perto da média, mas às vezes vêm dois quase juntos e
 * às vezes demora bem mais que a média, de forma espontânea.
 */
export function exponentialInterval(meanMs: number, minMs = 0, maxMs = Infinity): number {
  const raw = -Math.log(1 - Math.random()) * meanMs;
  return Math.min(Math.max(raw, minMs), maxMs);
}

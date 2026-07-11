import { useEffect, useRef, useState } from 'react';
import type { CityStreet } from '../types/city';
import { generateIncident } from '../lib/incidents';
import { exponentialInterval } from '../lib/random';
import type { Incident } from '../types/game';

/**
 * Ritmo do plantão (estilo COPOM real, jogável):
 * - média ~1m50s entre ligações
 * - nunca duas em menos de ~50s
 * - se a fila enche, o sistema “segura” e demora mais
 * - no máximo 5 aguardando e 9 ativas (não resolvidas)
 */
const MEAN_SPAWN_MS = 110_000;
const MIN_SPAWN_MS = 50_000;
const MAX_SPAWN_MS = 320_000;
/** Primeira ligação só depois de um respiro no início do plantão. */
const FIRST_SPAWN_MIN_MS = 28_000;
const FIRST_SPAWN_MAX_MS = 55_000;

const MAX_AGUARDANDO = 5;
const MAX_ACTIVE = 9;
/** Distância mínima entre uma nova ocorrência e as ativas no mapa. */
const MIN_SEPARATION_M = 900;

function countAguardando(list: Incident[]): number {
  return list.filter((i) => i.status === 'aguardando').length;
}

function countActive(list: Incident[]): number {
  return list.filter((i) => i.status !== 'resolvido').length;
}

/**
 * Ajusta a média do intervalo conforme a carga atual do plantão.
 * Fila cheia → menos ligações; plantão calmo → ritmo normal.
 */
function meanForLoad(aguardando: number, active: number): number {
  let mean = MEAN_SPAWN_MS;

  if (aguardando >= 2) mean *= 1.35;
  if (aguardando >= 3) mean *= 1.45;
  if (aguardando >= 4) mean *= 1.55;

  if (active >= 5) mean *= 1.25;
  if (active >= 7) mean *= 1.35;

  // prioridade 1 abertas: um pouco mais de espaçamento para o operador respirar
  return mean;
}

function minForLoad(aguardando: number): number {
  if (aguardando >= 3) return 70_000;
  if (aguardando >= 2) return 58_000;
  return MIN_SPAWN_MS;
}

export function useIncidentFeed(streets: CityStreet[], enabled: boolean) {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const incidentsRef = useRef(incidents);
  incidentsRef.current = incidents;
  const firstSpawnDone = useRef(false);

  useEffect(() => {
    if (!enabled || streets.length === 0) {
      firstSpawnDone.current = false;
      return;
    }

    function clearTimer() {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    }

    function scheduleNext(isFirst: boolean) {
      clearTimer();

      const current = incidentsRef.current;
      const aguardando = countAguardando(current);
      const active = countActive(current);

      // saturado: reavalia em 40s em vez de gerar
      if (aguardando >= MAX_AGUARDANDO || active >= MAX_ACTIVE) {
        timeoutRef.current = setTimeout(() => scheduleNext(false), 40_000);
        return;
      }

      let delay: number;
      if (isFirst && !firstSpawnDone.current) {
        delay =
          FIRST_SPAWN_MIN_MS + Math.random() * (FIRST_SPAWN_MAX_MS - FIRST_SPAWN_MIN_MS);
      } else {
        delay = exponentialInterval(
          meanForLoad(aguardando, active),
          minForLoad(aguardando),
          MAX_SPAWN_MS
        );
      }

      timeoutRef.current = setTimeout(() => {
        setIncidents((prev) => {
          const aguardandoNow = countAguardando(prev);
          const activeNow = countActive(prev);
          if (aguardandoNow >= MAX_AGUARDANDO || activeNow >= MAX_ACTIVE) {
            return prev;
          }

          const avoid = prev
            .filter((i) => i.status !== 'resolvido')
            .map((i) => i.location);

          const next = generateIncident(streets, {
            avoidLocations: avoid,
            minSeparationMeters: MIN_SEPARATION_M,
          });

          firstSpawnDone.current = true;
          return [...prev, next];
        });

        // reprograma com base na carga (lê ref após o set)
        window.setTimeout(() => scheduleNext(false), 0);
      }, delay);
    }

    scheduleNext(true);

    return () => {
      clearTimer();
    };
  }, [streets, enabled]);

  // Ao pausar/encerrar plantão (enabled=false), mantém as ocorrências;
  // ao reativar, o effect reinicia o agendamento com respiro inicial.
  useEffect(() => {
    if (!enabled) firstSpawnDone.current = false;
  }, [enabled]);

  return { incidents, setIncidents };
}

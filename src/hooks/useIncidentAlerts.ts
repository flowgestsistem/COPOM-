import { useEffect, useRef, useState } from 'react';
import type { Incident } from '../types/game';
import { playAnswerSequence, startRinging, stopRinging } from '../lib/sound';

const BLINK_DURATION_MS = 12_000;
/** Pausa mínima entre o fim de uma ligação e o toque da próxima. */
const RING_GAP_BASE_MS = 4_500;
/** Se não atender em 35s, a ligação cai (ocorrência permanece no painel). */
const RING_TIMEOUT_MS = 35_000;
/** Quantas ligações podem ficar na fila do telefone (as demais só vão ao painel). */
const MAX_RING_QUEUE = 3;

export function useIncidentAlerts(incidents: Incident[], plantaoAtivo = true) {
  const seenIds = useRef<Set<string>>(new Set());
  const queueRef = useRef<Incident[]>([]);
  const ringingRef = useRef<Incident | null>(null);
  const ringTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextRingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ringStartedAtRef = useRef<number>(0);
  const lastCallEndedAtRef = useRef<number>(0);

  const [ringingIncident, setRingingIncident] = useState<Incident | null>(null);
  const [currentAlert, setCurrentAlert] = useState<Incident | null>(null);
  const [blinkingIds, setBlinkingIds] = useState<Set<string>>(new Set());
  /** Segundos restantes para atender (0 = sem ligação). */
  const [ringSecondsLeft, setRingSecondsLeft] = useState(0);

  function clearRingTimeout() {
    if (ringTimeoutRef.current) {
      clearTimeout(ringTimeoutRef.current);
      ringTimeoutRef.current = null;
    }
  }

  function clearNextRingTimer() {
    if (nextRingTimerRef.current) {
      clearTimeout(nextRingTimerRef.current);
      nextRingTimerRef.current = null;
    }
  }

  /** Gap cresce se ainda há várias na fila do telefone. */
  function gapAfterCallMs(): number {
    const queued = queueRef.current.length;
    if (queued >= 2) return RING_GAP_BASE_MS + 5_000;
    if (queued >= 1) return RING_GAP_BASE_MS + 2_500;
    return RING_GAP_BASE_MS;
  }

  function beginRing(next: Incident) {
    ringingRef.current = next;
    setRingingIncident(next);
    startRinging();
    ringStartedAtRef.current = Date.now();
    setRingSecondsLeft(Math.ceil(RING_TIMEOUT_MS / 1000));

    clearRingTimeout();
    ringTimeoutRef.current = setTimeout(() => {
      missCall();
    }, RING_TIMEOUT_MS);
  }

  function startNextIfIdle() {
    if (ringingRef.current) return;
    clearNextRingTimer();

    const next = queueRef.current.shift();
    if (!next) {
      setRingSecondsLeft(0);
      return;
    }

    const sinceLast = Date.now() - lastCallEndedAtRef.current;
    const needGap = lastCallEndedAtRef.current > 0 ? Math.max(0, gapAfterCallMs() - sinceLast) : 0;

    if (needGap > 80) {
      // devolve à fila e espera o respiro
      queueRef.current.unshift(next);
      nextRingTimerRef.current = setTimeout(() => {
        nextRingTimerRef.current = null;
        if (ringingRef.current) return;
        const again = queueRef.current.shift();
        if (again) beginRing(again);
      }, needGap);
      return;
    }

    beginRing(next);
  }

  function missCall() {
    if (!ringingRef.current) return;
    clearRingTimeout();
    stopRinging();
    ringingRef.current = null;
    setRingingIncident(null);
    setRingSecondsLeft(0);
    lastCallEndedAtRef.current = Date.now();
    // ocorrência continua na fila de despacho; só a ligação cai
    nextRingTimerRef.current = setTimeout(startNextIfIdle, gapAfterCallMs());
  }

  // contagem regressiva na UI
  useEffect(() => {
    if (!ringingIncident) {
      setRingSecondsLeft(0);
      return;
    }
    const tick = setInterval(() => {
      const elapsed = Date.now() - ringStartedAtRef.current;
      const left = Math.max(0, Math.ceil((RING_TIMEOUT_MS - elapsed) / 1000));
      setRingSecondsLeft(left);
    }, 250);
    return () => clearInterval(tick);
  }, [ringingIncident]);

  // encerrar plantão: para telefone, limpa fila e alertas
  useEffect(() => {
    if (plantaoAtivo) return;
    clearRingTimeout();
    clearNextRingTimer();
    stopRinging();
    ringingRef.current = null;
    queueRef.current = [];
    seenIds.current = new Set();
    lastCallEndedAtRef.current = 0;
    setRingingIncident(null);
    setCurrentAlert(null);
    setBlinkingIds(new Set());
    setRingSecondsLeft(0);
  }, [plantaoAtivo]);

  useEffect(() => {
    if (!plantaoAtivo) return;

    const newOnes = incidents.filter((i) => !seenIds.current.has(i.id));
    if (newOnes.length === 0) return;

    for (const incident of newOnes) {
      seenIds.current.add(incident.id);
      // prioridade 1 entra na fila do telefone com preferência
      if (queueRef.current.length < MAX_RING_QUEUE || incident.priority === 1) {
        if (incident.priority === 1) {
          queueRef.current.unshift(incident);
          // mantém fila limitada
          if (queueRef.current.length > MAX_RING_QUEUE + 1) {
            queueRef.current = queueRef.current.slice(0, MAX_RING_QUEUE + 1);
          }
        } else if (queueRef.current.length < MAX_RING_QUEUE) {
          queueRef.current.push(incident);
        }
        // se a fila do telefone está cheia e não é P1: só painel (sem toque extra)
      }
    }
    startNextIfIdle();
  }, [incidents, plantaoAtivo]);

  function answerCall() {
    const incident = ringingRef.current;
    if (!incident) return;

    clearRingTimeout();
    stopRinging();
    // Médica / bombeiros → áudio bombeiros-emergencia; polícia → fala padrão COPOM
    playAnswerSequence(incident.type);
    ringingRef.current = null;
    setRingingIncident(null);
    setRingSecondsLeft(0);
    lastCallEndedAtRef.current = Date.now();
    setCurrentAlert(incident);
    setBlinkingIds((prev) => new Set(prev).add(incident.id));

    setTimeout(() => {
      setBlinkingIds((prev) => {
        const next = new Set(prev);
        next.delete(incident.id);
        return next;
      });
    }, BLINK_DURATION_MS);

    // dá tempo de ouvir o áudio da ligação antes da próxima tocar
    const audioBreath =
      incident.type === 'samu' || incident.type === 'incendio' ? 3_500 : 2_200;
    nextRingTimerRef.current = setTimeout(startNextIfIdle, gapAfterCallMs() + audioBreath);
  }

  return {
    ringingIncident,
    currentAlert,
    blinkingIds,
    ringSecondsLeft,
    answerCall,
    dismissAlert: () => setCurrentAlert(null),
  };
}

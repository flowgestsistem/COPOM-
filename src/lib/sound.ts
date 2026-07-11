import type { IncidentType } from '../types/game';

const RING_SRC = '/sounds/incident-alert.mp3';
const ANSWER_SRCS = ['/sounds/answer-1.mp3', '/sounds/answer-2.mp3'];
/** Áudio da ligação: ocorrência médica / bombeiros (não é sirene). */
const CALL_BOMBEIROS_SRC = '/sounds/bombeiros-emergencia.mp3';
const DISPATCH_RADIO_SRC = '/sounds/radio-static.mp3';
/** Voz de despacho ao enviar Rádio Patrulha para ocorrência. */
const DISPATCH_RADIO_PATRULHA_SRC = '/sounds/despacho-radio-patrulha.mp3';
const SIREN_POLICE_SRC = '/sounds/sirene-policia.mp3';
/** Sirene de viaturas de bombeiros / ambulância em código 3. */
const SIREN_FIRE_SRC = '/sounds/sirene-bombeiros.mp3';

export type SirenKind = 'police' | 'fire';

let ringAudio: HTMLAudioElement | null = null;
const sirenAudios: Partial<Record<SirenKind, HTMLAudioElement>> = {};

const SIREN_SRC: Record<SirenKind, string> = {
  police: SIREN_POLICE_SRC,
  fire: SIREN_FIRE_SRC,
};

/** Volume do toque de telefone (0..1). */
const RING_VOLUME = 0.28;

/** Telefone tocando em loop, até a ligação ser atendida. */
export function startRinging(): void {
  stopRinging();
  ringAudio = new Audio(RING_SRC);
  ringAudio.loop = true;
  ringAudio.volume = RING_VOLUME;
  ringAudio.play().catch(() => {
    // navegadores bloqueiam áudio antes de qualquer interação do usuário na página
  });
}

export function stopRinging(): void {
  ringAudio?.pause();
  ringAudio = null;
}

/**
 * Som de desenganchar o telefone (gancho soltando + clique).
 * Gerado por Web Audio — sem arquivo externo.
 */
export function playPhonePickup(): void {
  try {
    const ctx = new AudioContext();
    const now = ctx.currentTime;

    // “clique” do gancho
    const click = ctx.createOscillator();
    const clickGain = ctx.createGain();
    click.type = 'square';
    click.frequency.setValueAtTime(180, now);
    click.frequency.exponentialRampToValueAtTime(60, now + 0.08);
    clickGain.gain.setValueAtTime(0.0001, now);
    clickGain.gain.exponentialRampToValueAtTime(0.18, now + 0.01);
    clickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
    click.connect(clickGain);
    clickGain.connect(ctx.destination);
    click.start(now);
    click.stop(now + 0.12);

    // ruído curto (plástico / cabo)
    const bufferSize = Math.floor(ctx.sampleRate * 0.12);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.25));
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.12, now + 0.02);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
    noise.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(now + 0.02);

    // tom de linha “aberto” suave
    const tone = ctx.createOscillator();
    const toneGain = ctx.createGain();
    tone.type = 'sine';
    tone.frequency.value = 425;
    toneGain.gain.setValueAtTime(0.0001, now + 0.08);
    toneGain.gain.exponentialRampToValueAtTime(0.04, now + 0.15);
    toneGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
    tone.connect(toneGain);
    toneGain.connect(ctx.destination);
    tone.start(now + 0.08);
    tone.stop(now + 0.4);

    window.setTimeout(() => void ctx.close(), 600);
  } catch {
    // Web Audio indisponível
  }
}

/** Uma das duas falas de atendimento COPOM, escolhida aleatoriamente. */
export function playAnswerVoice(): void {
  const src = ANSWER_SRCS[Math.floor(Math.random() * ANSWER_SRCS.length)];
  new Audio(src).play().catch(() => {});
}

/** Conteúdo da ligação: emergência médica / bombeiros (arquivo enviado pelo operador). */
export function playBombeirosCallAudio(): void {
  const audio = new Audio(CALL_BOMBEIROS_SRC);
  audio.volume = 0.85;
  audio.play().catch(() => {});
}

/**
 * Desengancha o telefone e toca o áudio da ligação conforme o tipo:
 * - samu / incêndio → áudio de emergência dos bombeiros
 * - polícia → fala padrão de atendimento
 */
export function playAnswerSequence(incidentType?: IncidentType): void {
  playPhonePickup();
  window.setTimeout(() => {
    if (incidentType === 'samu' || incidentType === 'incendio') {
      playBombeirosCallAudio();
    } else {
      playAnswerVoice();
    }
  }, 380);
}

export function playDispatchRadio(): void {
  new Audio(DISPATCH_RADIO_SRC).play().catch(() => {});
}

/** Fala de despacho ao enviar viatura de Rádio Patrulha para ocorrência. */
export function playRadioPatrolDispatch(): void {
  const audio = new Audio(DISPATCH_RADIO_PATRULHA_SRC);
  audio.volume = 0.9;
  audio.play().catch(() => {});
}

/** Departamento/label de Rádio Patrulha (17 BPM). */
export function isRadioPatrolUnit(department: string, label?: string): boolean {
  const text = `${department} ${label ?? ''}`;
  return /r[aá]dio\s*patrulha/i.test(text);
}

function playToneSequence(
  tones: { freq: number; start: number; dur: number; vol?: number }[],
  closeAfterMs: number
): void {
  try {
    const ctx = new AudioContext();
    const now = ctx.currentTime;
    for (const t of tones) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = t.freq;
      const vol = t.vol ?? 0.2;
      const t0 = now + t.start;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + t.dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + t.dur + 0.02);
    }
    window.setTimeout(() => void ctx.close(), closeAfterMs);
  } catch {
    // Web Audio indisponível
  }
}

/** Bip — fim de atendimento / decisão pendente (agudo, 3 toques). */
export function playDecisionBeep(): void {
  playToneSequence(
    [
      { freq: 880, start: 0, dur: 0.12, vol: 0.2 },
      { freq: 1175, start: 0.16, dur: 0.14, vol: 0.22 },
      { freq: 880, start: 0.34, dur: 0.12, vol: 0.2 },
    ],
    800
  );
}

/**
 * Bip de chegada no local — distinto do bip de fim de atendimento
 * (grave → médio, 2 toques longos).
 */
export function playArrivalBeep(): void {
  playToneSequence(
    [
      { freq: 520, start: 0, dur: 0.18, vol: 0.24 },
      { freq: 690, start: 0.22, dur: 0.22, vol: 0.26 },
    ],
    700
  );
}

function ensureSiren(kind: SirenKind): HTMLAudioElement {
  let audio = sirenAudios[kind];
  if (!audio) {
    audio = new Audio(SIREN_SRC[kind]);
    audio.loop = true;
    audio.volume = 0;
    audio.preload = 'auto';
    sirenAudios[kind] = audio;
  }
  return audio;
}

/**
 * Ajusta o volume da sirene (0..1). Em 0, pausa o áudio.
 * Uma instância em loop por tipo (polícia / bombeiros).
 */
export function setSirenVolume(kind: SirenKind, volume: number): void {
  const v = Math.max(0, Math.min(1, volume));
  const audio = ensureSiren(kind);

  if (v < 0.02) {
    audio.volume = 0;
    if (!audio.paused) {
      audio.pause();
      try {
        audio.currentTime = 0;
      } catch {
        // ignore
      }
    }
    return;
  }

  audio.volume = v;
  if (audio.paused) {
    audio.play().catch(() => {
      // autoplay bloqueado até interação do usuário
    });
  }
}

export function stopAllSirens(): void {
  setSirenVolume('police', 0);
  setSirenVolume('fire', 0);
}

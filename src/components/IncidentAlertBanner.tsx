import { useEffect, useState } from 'react';
import type { Incident } from '../types/game';
import {
  EMOJI_BY_INCIDENT_TYPE,
  LABEL_BY_INCIDENT_TYPE,
  LABEL_BY_ZONE,
} from '../lib/labels';
import { CUSTOM_INCIDENT_ICONS } from '../lib/customIcons';
import { callerLabel, tagLabel } from '../lib/incidentRealism';
import { natureCodeHint } from '../lib/policeProtocol';
import type { IncidentTag } from '../types/game';

/** Tempo até o modal fechar automaticamente. */
export const ALERT_AUTO_DISMISS_MS = 15_000;

function priorityLabel(p: 1 | 2 | 3): string {
  if (p === 1) return 'Crítica';
  if (p === 2) return 'Média';
  return 'Baixa';
}

function typeTone(type: Incident['type']): string {
  if (type === 'incendio') return 'fire';
  if (type === 'samu') return 'med';
  return 'police';
}

export function IncidentAlertBanner({
  incident,
  onDismiss,
  onOpen,
}: {
  incident: Incident;
  onDismiss: () => void;
  /** Abre o dashboard de despacho e fecha o alerta. */
  onOpen?: (incident: Incident) => void;
}) {
  const [leftMs, setLeftMs] = useState(ALERT_AUTO_DISMISS_MS);
  const total = ALERT_AUTO_DISMISS_MS;
  const secondsLeft = Math.max(0, Math.ceil(leftMs / 1000));
  const progress = Math.max(0, Math.min(1, leftMs / total));

  useEffect(() => {
    setLeftMs(ALERT_AUTO_DISMISS_MS);
    const started = Date.now();
    const tick = window.setInterval(() => {
      const elapsed = Date.now() - started;
      const remaining = Math.max(0, ALERT_AUTO_DISMISS_MS - elapsed);
      setLeftMs(remaining);
      if (remaining <= 0) {
        window.clearInterval(tick);
        onDismiss();
      }
    }, 50);
    return () => window.clearInterval(tick);
  }, [incident.id, onDismiss]);

  const customIconUrl = incident.icon ? CUSTOM_INCIDENT_ICONS[incident.icon] : undefined;
  const tone = typeTone(incident.type);
  const nature = natureCodeHint(incident);

  // Texto curto legível (sem repetir protocolo/solicitante colados)
  const summaryBits: string[] = [];
  if (incident.zone) summaryBits.push(LABEL_BY_ZONE[incident.zone] ?? incident.zone);
  if ((incident.victimCount ?? 0) > 0) {
    summaryBits.push(
      incident.victimCount === 1 ? '1 vítima relatada' : `${incident.victimCount} vítimas relatadas`
    );
  }
  if ((incident.suspectCount ?? 0) > 0) {
    summaryBits.push(
      incident.suspectCount === 1 ? '1 suspeito' : `${incident.suspectCount} suspeitos`
    );
  }
  if (incident.armed) summaryBits.push('Informação de arma de fogo');

  return (
    <div
      className={`alert-modal alert-modal--${tone} alert-modal--p${incident.priority}`}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="alert-modal-title"
      aria-describedby="alert-modal-desc"
    >
      <div className="alert-modal__backdrop" onClick={onDismiss} aria-hidden />

      <div className="alert-modal__panel">
        {/* barra de tempo */}
        <div className="alert-modal__timer-track" aria-hidden>
          <div className="alert-modal__timer-fill" style={{ transform: `scaleX(${progress})` }} />
        </div>

        <header className="alert-modal__header">
          <div className="alert-modal__icon-wrap" aria-hidden>
            {customIconUrl ? (
              <img src={customIconUrl} alt="" className="alert-modal__icon-img" />
            ) : (
              <span className="alert-modal__icon-emoji">{EMOJI_BY_INCIDENT_TYPE[incident.type]}</span>
            )}
          </div>

          <div className="alert-modal__header-text">
            <div className="alert-modal__kicker-row">
              <span className="alert-modal__kicker">Novo atendimento · Central 190/193</span>
              <span className={`alert-modal__pri alert-modal__pri--${incident.priority}`}>
                P{incident.priority} · {priorityLabel(incident.priority)}
              </span>
            </div>
            <h2 id="alert-modal-title" className="alert-modal__title">
              {incident.title}
            </h2>
            <p className="alert-modal__nature">{nature}</p>
          </div>

          <div className="alert-modal__countdown" title="Fecha automaticamente">
            <strong>{secondsLeft}</strong>
            <span>seg</span>
          </div>
        </header>

        <div id="alert-modal-desc" className="alert-modal__body">
          <div className="alert-modal__grid">
            <div className="alert-modal__field">
              <span className="alert-modal__label">Protocolo</span>
              <strong className="alert-modal__value alert-modal__value--mono">
                {incident.protocolNumber ?? '—'}
              </strong>
            </div>
            <div className="alert-modal__field">
              <span className="alert-modal__label">Canal</span>
              <strong className="alert-modal__value">{LABEL_BY_INCIDENT_TYPE[incident.type]}</strong>
            </div>
            <div className="alert-modal__field">
              <span className="alert-modal__label">Solicitante</span>
              <strong className="alert-modal__value">
                {incident.caller ? callerLabel(incident.caller) : 'Não identificado'}
              </strong>
            </div>
            <div className="alert-modal__field">
              <span className="alert-modal__label">Zona</span>
              <strong className="alert-modal__value">
                {incident.zone ? LABEL_BY_ZONE[incident.zone] ?? incident.zone : '—'}
              </strong>
            </div>
            <div className="alert-modal__field">
              <span className="alert-modal__label">Vítimas / suspeitos</span>
              <strong className="alert-modal__value">
                {incident.victimCount ?? 0} vit. · {incident.suspectCount ?? 0} susp.
              </strong>
            </div>
            <div className="alert-modal__field">
              <span className="alert-modal__label">Coordenadas</span>
              <strong className="alert-modal__value alert-modal__value--mono">
                {incident.location[0].toFixed(5)}, {incident.location[1].toFixed(5)}
              </strong>
            </div>
          </div>

          {(incident.tags?.length ?? 0) > 0 && (
            <div className="alert-modal__tags">
              {incident.tags!.map((t) => (
                <span key={t} className={`alert-modal__tag alert-modal__tag--${t}`}>
                  {tagLabel(t as IncidentTag)}
                </span>
              ))}
              {incident.armed && <span className="alert-modal__tag alert-modal__tag--arma">Arma informada</span>}
              {incident.requiresCivilPolice && (
                <span className="alert-modal__tag alert-modal__tag--pc">Exige Polícia Civil</span>
              )}
            </div>
          )}

          {summaryBits.length > 0 && (
            <p className="alert-modal__summary">{summaryBits.join(' · ')}</p>
          )}

          <div className="alert-modal__brief">
            <span className="alert-modal__label">Resumo do chamado</span>
            <p>
              {incident.type === 'incendio'
                ? 'Solicitado Corpo de Bombeiros. Isolar área, combater foco e avaliar vítimas.'
                : incident.type === 'samu'
                  ? 'Emergência médica. Priorizar APH, estabilização e remoção se necessário.'
                  : 'Presença policial ostensiva. Reconhecer o local, conter a situação e adotar providências legais.'}
            </p>
          </div>
        </div>

        <footer className="alert-modal__footer">
          <div className="alert-modal__timer-text" aria-live="polite">
            Fecha em <strong>{secondsLeft}s</strong>
          </div>
          <div className="alert-modal__actions">
            <button type="button" className="alert-modal__btn alert-modal__btn--ghost" onClick={onDismiss}>
              Dispensar
            </button>
            {onOpen && (
              <button
                type="button"
                className="alert-modal__btn alert-modal__btn--primary"
                onClick={() => onOpen(incident)}
              >
                Abrir despacho
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}

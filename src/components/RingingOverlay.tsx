import type { Incident } from '../types/game';
import { LABEL_BY_INCIDENT_TYPE } from '../lib/labels';

export function RingingOverlay({
  onAnswer,
  incident,
  secondsLeft = 0,
}: {
  onAnswer: () => void;
  incident?: Incident | null;
  /** Contagem regressiva até a ligação cair (segundos). */
  secondsLeft?: number;
}) {
  return (
    <div className="ringing-widget" role="complementary" aria-label="Telefone tocando">
      <button type="button" className="ringing-widget__phone-btn" onClick={onAnswer} aria-label="Atender ligação">
        <div className="ringing-widget__glow" aria-hidden />
        <img
          src="/ui/telefone-copom.png"
          alt="Telefone — clique para atender"
          className="ringing-widget__phone"
          draggable={false}
        />
        <span className="ringing-widget__ripple" aria-hidden />
        <span className="ringing-widget__ripple ringing-widget__ripple--delay" aria-hidden />
      </button>

      <div className="ringing-widget__info">
        <div className="ringing-widget__header">
          <strong>Ligação entrando</strong>
          {secondsLeft > 0 && (
            <span className={`ringing-widget__timer${secondsLeft <= 10 ? ' is-urgent' : ''}`} title="Tempo até cair">
              {secondsLeft}s
            </span>
          )}
        </div>
        {incident ? (
          <span className="ringing-widget__title">
            {LABEL_BY_INCIDENT_TYPE[incident.type]} · {incident.title}
          </span>
        ) : (
          <span className="ringing-widget__title">Clique no telefone para atender</span>
        )}
        <em>Clique para atender · cai em 30s</em>
      </div>
    </div>
  );
}

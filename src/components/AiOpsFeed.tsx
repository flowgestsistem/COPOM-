import { useEffect, useState } from 'react';
import type { AiOpsEvent } from '../lib/aiOpsFeed';

const VISIBLE_MS = 14_000;
const MAX_VISIBLE = 5;

export function AiOpsFeed({
  events,
  onDismiss,
}: {
  events: AiOpsEvent[];
  onDismiss: (id: string) => void;
}) {
  // força re-render para expirar cards
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(t);
  }, []);

  const now = Date.now();
  const visible = events
    .filter((e) => now - e.at < VISIBLE_MS || e.important)
    .slice(0, MAX_VISIBLE);

  // auto-dismiss non-important after timeout
  useEffect(() => {
    for (const e of events) {
      if (e.important) continue;
      const left = VISIBLE_MS - (Date.now() - e.at);
      if (left <= 0) onDismiss(e.id);
      else {
        const t = window.setTimeout(() => onDismiss(e.id), left + 30);
        return () => window.clearTimeout(t);
      }
    }
  }, [events, onDismiss]);

  if (visible.length === 0) return null;

  return (
    <div className="ai-ops-feed" aria-live="polite" aria-label="Ações da IA tática">
      {visible.map((e) => (
        <article
          key={e.id}
          className={`ai-ops-card ai-ops-card--${e.kind}${e.important ? ' is-important' : ''}`}
        >
          <header className="ai-ops-card__head">
            <span className={`ai-ops-card__dot ai-ops-card__dot--${e.unitType ?? 'viatura'}`} />
            <span className="ai-ops-card__kind">{kindLabel(e.kind)}</span>
            <button
              type="button"
              className="ai-ops-card__close"
              onClick={() => onDismiss(e.id)}
              aria-label="Dispensar"
            >
              ×
            </button>
          </header>
          <strong className="ai-ops-card__unit">{e.unitLabel}</strong>
          <p className="ai-ops-card__msg">{e.message}</p>
          {e.detail && <p className="ai-ops-card__detail">{e.detail}</p>}
          {e.incidentTitle && <p className="ai-ops-card__inc">{e.incidentTitle}</p>}
        </article>
      ))}
    </div>
  );
}

function kindLabel(kind: AiOpsEvent['kind']): string {
  switch (kind) {
    case 'chegada':
      return 'No local';
    case 'plano':
      return 'Plano tático';
    case 'acao':
      return 'Em ação';
    case 'resultado':
      return 'Concluído';
    case 'retorno_base':
      return 'Retorno à base';
    case 'conduzindo_preso':
      return 'Condução';
    case 'hospital':
      return 'Remoção';
    default:
      return 'IA tática';
  }
}

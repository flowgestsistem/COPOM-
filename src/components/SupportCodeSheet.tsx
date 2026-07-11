import type { Incident, Unit } from '../types/game';
import { LABEL_BY_INCIDENT_TYPE } from '../lib/labels';

export function SupportCodeSheet({
  unit,
  incident,
  onSelectCode,
  onClose,
}: {
  unit: Unit;
  incident: Incident;
  onSelectCode: (code: 2 | 3) => void;
  onClose: () => void;
}) {
  return (
    <div className="unit-action-menu unit-action-menu--sheet" role="dialog" aria-label="Código de deslocamento">
      <header className="unit-action-menu__header">
        <div className="unit-action-menu__titles">
          <span className="unit-action-menu__kicker">Apoio · {unit.label}</span>
          <strong>{incident.title}</strong>
          <span className="unit-action-menu__status">
            {LABEL_BY_INCIDENT_TYPE[incident.type]} · {incident.status.replace('_', ' ')}
          </span>
        </div>
        <button type="button" className="unit-action-menu__close" onClick={onClose} aria-label="Fechar">
          ×
        </button>
      </header>

      <p className="unit-action-menu__hint">Como a viatura deve se deslocar até a ocorrência?</p>

      <div className="support-code-actions">
        <button type="button" className="support-code-btn support-code-btn--2" onClick={() => onSelectCode(2)}>
          <strong>Código 2</strong>
          <span>Deslocamento sem sirene</span>
        </button>
        <button type="button" className="support-code-btn support-code-btn--3" onClick={() => onSelectCode(3)}>
          <strong>Código 3</strong>
          <span>Emergência — sirene ligada</span>
        </button>
      </div>
    </div>
  );
}

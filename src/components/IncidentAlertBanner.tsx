import { useEffect } from 'react';
import type { Incident } from '../types/game';
import { EMOJI_BY_INCIDENT_TYPE } from '../lib/labels';
import { CUSTOM_INCIDENT_ICONS } from '../lib/customIcons';

const AUTO_DISMISS_MS = 8_000;

export function IncidentAlertBanner({
  incident,
  onDismiss,
}: {
  incident: Incident;
  onDismiss: () => void;
}) {
  useEffect(() => {
    const timeout = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(timeout);
  }, [incident.id, onDismiss]);

  const customIconUrl = incident.icon ? CUSTOM_INCIDENT_ICONS[incident.icon] : undefined;

  return (
    <div className="incident-alert-banner" role="alert" onClick={onDismiss}>
      <span className="incident-alert-banner__icon">
        {customIconUrl ? (
          <img src={customIconUrl} alt="" style={{ width: 28, height: 28, display: 'block' }} />
        ) : (
          EMOJI_BY_INCIDENT_TYPE[incident.type]
        )}
      </span>
      <div className="incident-alert-banner__body">
        <strong>{incident.title}</strong>
        <span>{incident.description}</span>
      </div>
      <span className="incident-alert-banner__priority">Prioridade {incident.priority}</span>
    </div>
  );
}

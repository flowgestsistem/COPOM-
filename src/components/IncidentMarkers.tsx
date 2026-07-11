import L from 'leaflet';
import { Marker, Popup } from 'react-leaflet';
import type { Incident } from '../types/game';
import { EMOJI_BY_INCIDENT_TYPE, LABEL_BY_INCIDENT_TYPE } from '../lib/labels';
import { CUSTOM_INCIDENT_ICONS } from '../lib/customIcons';

function incidentIcon(incident: Incident, blinking: boolean, selectable: boolean): L.DivIcon {
  const size = 22 + (3 - incident.priority) * 6;
  const className = [
    'incident-marker',
    blinking ? 'incident-marker--blink' : '',
    selectable ? 'incident-marker--selectable' : '',
  ]
    .filter(Boolean)
    .join(' ');
  const customIconUrl = incident.icon ? CUSTOM_INCIDENT_ICONS[incident.icon] : undefined;

  const inner = customIconUrl
    ? `<img src="${customIconUrl}" style="width:${size}px;height:${size}px;display:block;filter:drop-shadow(0 0 2px #000)" />`
    : `<div style="font-size:${size}px">${EMOJI_BY_INCIDENT_TYPE[incident.type]}</div>`;

  return L.divIcon({
    html: `<div class="${className}">${inner}</div>`,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

export function IncidentMarkers({
  incidents,
  blinkingIds,
  selectMode = false,
  onSelectIncident,
}: {
  incidents: Incident[];
  blinkingIds: Set<string>;
  /** Quando true, clique na ocorrência chama onSelectIncident (modo apoio). */
  selectMode?: boolean;
  onSelectIncident?: (incidentId: string) => void;
}) {
  const pending = incidents.filter((i) => i.status !== 'resolvido');

  return (
    <>
      {pending.map((incident) => (
        <Marker
          key={incident.id}
          position={incident.location}
          icon={incidentIcon(incident, blinkingIds.has(incident.id), selectMode)}
          eventHandlers={
            selectMode && onSelectIncident
              ? {
                  click: (e) => {
                    L.DomEvent.stopPropagation(e.originalEvent);
                    onSelectIncident(incident.id);
                  },
                }
              : undefined
          }
        >
          {!selectMode && (
            <Popup>
              <strong>{incident.title}</strong>
              <br />
              {incident.description}
              <br />
              {LABEL_BY_INCIDENT_TYPE[incident.type]} · Prioridade {incident.priority}
              <br />
              Status: {incident.status}
            </Popup>
          )}
        </Marker>
      ))}
    </>
  );
}

import { useState } from 'react';
import type { CityBase } from '../types/city';
import type { Incident, Unit } from '../types/game';
import {
  EMOJI_BY_INCIDENT_TYPE,
  LABEL_BY_INCIDENT_TYPE,
  LABEL_BY_UNIT_STATUS,
  LABEL_BY_ZONE,
} from '../lib/labels';
import { CUSTOM_INCIDENT_ICONS } from '../lib/customIcons';
import { catalogSize } from '../lib/incidents';

function statusLabel(status: Incident['status']): string {
  switch (status) {
    case 'aguardando':
      return 'Aguardando';
    case 'despachado':
      return 'Despachado';
    case 'em_atendimento':
      return 'Em atendimento';
    case 'aguardando_pc':
      return 'Aguardando PC';
    case 'investigacao_pc':
      return 'Investigação PC';
    case 'aguardando_decisao':
      return 'Decisão';
    default:
      return status;
  }
}

function IncidentListCard({
  incident,
  units,
  onOpen,
}: {
  incident: Incident;
  units: Unit[];
  onOpen: (incidentId: string) => void;
}) {
  const linked = units.filter((u) => u.assignedIncidentId === incident.id);
  const assignedUnits =
    linked.length > 0
      ? linked
      : units.filter((u) => u.id === incident.assignedUnitId);
  const isMedical = incident.type === 'samu';

  return (
    <li>
      <button
        type="button"
        className={`inc-card inc-card--p${incident.priority} inc-card--${incident.type} inc-card--clickable`}
        onClick={() => onOpen(incident.id)}
      >
        <header className="inc-card__head">
          <span className="inc-card__icon" aria-hidden>
            {incident.icon && CUSTOM_INCIDENT_ICONS[incident.icon] ? (
              <img src={CUSTOM_INCIDENT_ICONS[incident.icon]} alt="" />
            ) : (
              EMOJI_BY_INCIDENT_TYPE[incident.type]
            )}
          </span>
          <div className="inc-card__titles">
            <strong>{incident.title}</strong>
            <span className="inc-card__meta">
              {incident.protocolNumber ? `${incident.protocolNumber} · ` : ''}
              {LABEL_BY_INCIDENT_TYPE[incident.type]}
              {incident.zone ? ` · ${LABEL_BY_ZONE[incident.zone] ?? incident.zone}` : ''}
              {(incident.victimCount ?? 0) > 0 ? ` · ${incident.victimCount} vit.` : ''}
            </span>
          </div>
          <span className={`inc-card__pri inc-card__pri--${incident.priority}`}>P{incident.priority}</span>
        </header>

        <p className="inc-card__desc">{incident.description}</p>

        <div className="inc-card__badges">
          <span className={`inc-card__badge inc-card__badge--${incident.status}`}>{statusLabel(incident.status)}</span>
          {isMedical && <span className="inc-card__badge inc-card__badge--hint">Bombeiros</span>}
          {incident.armed && <span className="inc-card__badge inc-card__badge--aguardando">Arma</span>}
          {incident.requiresCivilPolice && (
            <span className="inc-card__badge inc-card__badge--hint">PC</span>
          )}
          {assignedUnits.length > 1 && (
            <span className="inc-card__badge inc-card__badge--hint">{assignedUnits.length} un.</span>
          )}
        </div>

        {incident.status !== 'aguardando' && assignedUnits.length > 0 && (
          <div className="inc-card__assigned">
            <strong>
              {assignedUnits.length === 1
                ? assignedUnits[0].label
                : assignedUnits.map((u) => u.label).join(' · ')}
            </strong>
            <span>
              {assignedUnits.length === 1
                ? LABEL_BY_UNIT_STATUS[assignedUnits[0].status]
                : `${assignedUnits.filter((u) => u.status === 'a_caminho').length} a caminho · ${assignedUnits.filter((u) => u.status !== 'a_caminho').length} no local/ocup.`}
            </span>
          </div>
        )}

        <span className="inc-card__open-hint">
          {assignedUnits.length > 0 ? 'Abrir · reforço / detalhes ›' : 'Abrir painel de despacho ›'}
        </span>
      </button>
    </li>
  );
}

export function DispatchPanel({
  incidents,
  units,
  bases: _bases,
  onOpenIncident,
}: {
  incidents: Incident[];
  units: Unit[];
  bases: CityBase[];
  onOpenIncident: (incidentId: string) => void;
}) {
  const [filter, setFilter] = useState<'all' | Incident['type']>('all');

  const active = incidents
    .filter((i) => i.status !== 'resolvido')
    .filter((i) => filter === 'all' || i.type === filter)
    .sort((a, b) => a.priority - b.priority || a.createdAt - b.createdAt);

  const counts = {
    all: incidents.filter((i) => i.status !== 'resolvido').length,
    policia: incidents.filter((i) => i.status !== 'resolvido' && i.type === 'policia').length,
    incendio: incidents.filter((i) => i.status !== 'resolvido' && i.type === 'incendio').length,
    samu: incidents.filter((i) => i.status !== 'resolvido' && i.type === 'samu').length,
  };

  return (
    <aside className="dispatch-panel">
      <header className="dispatch-panel__header">
        <div>
          <span className="dispatch-panel__kicker">Central 190 / 193</span>
          <h2>Ocorrências</h2>
        </div>
        <span className="dispatch-panel__count">{counts.all}</span>
      </header>

      <div className="dispatch-panel__filters" role="tablist" aria-label="Filtrar por tipo">
        {(
          [
            ['all', 'Todas', counts.all],
            ['policia', 'Polícia', counts.policia],
            ['incendio', 'Bombeiros', counts.incendio],
            ['samu', 'Médica', counts.samu],
          ] as const
        ).map(([key, label, n]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={filter === key}
            className={`dispatch-panel__filter${filter === key ? ' is-active' : ''}`}
            onClick={() => setFilter(key)}
          >
            {label}
            <em>{n}</em>
          </button>
        ))}
      </div>

      <p className="dispatch-panel__catalog-hint">
        {catalogSize().toLocaleString('pt-BR')} cenários · toque para abrir o painel
      </p>

      {active.length === 0 ? (
        <div className="dispatch-panel__empty-box">
          <strong>Fila vazia</strong>
          <p>Nenhuma ocorrência no momento. Novos chamados chegam aleatoriamente.</p>
        </div>
      ) : (
        <ul className="dispatch-panel__list">
          {active.map((incident) => (
            <IncidentListCard
              key={incident.id}
              incident={incident}
              units={units}
              onOpen={onOpenIncident}
            />
          ))}
        </ul>
      )}
    </aside>
  );
}

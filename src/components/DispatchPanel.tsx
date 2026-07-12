import { useMemo, useState } from 'react';
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
      return 'Na fila';
    case 'despachado':
      return 'Em deslocamento';
    case 'em_atendimento':
      return 'No local';
    case 'aguardando_pc':
      return 'Aguarda PC';
    case 'investigacao_pc':
      return 'PC investiga';
    case 'aguardando_decisao':
      return 'Decisão';
    default:
      return status;
  }
}

function timeAgo(ts: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}min`;
  return `${Math.floor(m / 60)}h`;
}

function IncidentListCard({
  incident,
  units,
  onOpen,
  index,
}: {
  incident: Incident;
  units: Unit[];
  onOpen: (incidentId: string) => void;
  index: number;
}) {
  const linked = units.filter((u) => u.assignedIncidentId === incident.id);
  const assignedUnits =
    linked.length > 0 ? linked : units.filter((u) => u.id === incident.assignedUnitId);
  const isMedical = incident.type === 'samu';
  const waiting = incident.status === 'aguardando';

  return (
    <li style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}>
      <button
        type="button"
        className={`cm-card cm-card--p${incident.priority} cm-card--${incident.type}${waiting ? ' cm-card--pulse' : ''}`}
        onClick={() => onOpen(incident.id)}
      >
        <div className="cm-card__priority-bar" aria-hidden />
        <header className="cm-card__head">
          <span className="cm-card__icon" aria-hidden>
            {incident.icon && CUSTOM_INCIDENT_ICONS[incident.icon] ? (
              <img src={CUSTOM_INCIDENT_ICONS[incident.icon]} alt="" />
            ) : (
              EMOJI_BY_INCIDENT_TYPE[incident.type]
            )}
          </span>
          <div className="cm-card__titles">
            <div className="cm-card__title-row">
              <strong>{incident.title}</strong>
              <span className={`cm-card__pri cm-card__pri--${incident.priority}`}>P{incident.priority}</span>
            </div>
            <span className="cm-card__meta">
              {incident.protocolNumber && (
                <span className="cm-card__protocol">{incident.protocolNumber}</span>
              )}
              <span>{LABEL_BY_INCIDENT_TYPE[incident.type]}</span>
              {incident.zone && <span>{LABEL_BY_ZONE[incident.zone] ?? incident.zone}</span>}
              <span className="cm-card__ago">{timeAgo(incident.createdAt)}</span>
            </span>
          </div>
        </header>

        <p className="cm-card__desc">{incident.description}</p>

        <div className="cm-card__badges">
          <span className={`cm-card__badge cm-card__badge--${incident.status}`}>
            {statusLabel(incident.status)}
          </span>
          {isMedical && <span className="cm-card__badge cm-card__badge--soft">APH / BM</span>}
          {incident.armed && <span className="cm-card__badge cm-card__badge--danger">Arma</span>}
          {incident.requiresCivilPolice && (
            <span className="cm-card__badge cm-card__badge--violet">PC</span>
          )}
          {(incident.victimCount ?? 0) > 0 && (
            <span className="cm-card__badge cm-card__badge--soft">
              {incident.victimCount} vit.
            </span>
          )}
          {assignedUnits.length > 0 && (
            <span className="cm-card__badge cm-card__badge--soft">
              {assignedUnits.length} un.
            </span>
          )}
        </div>

        {assignedUnits.length > 0 && (
          <div className="cm-card__units">
            <div className="cm-card__units-row">
              {assignedUnits.slice(0, 3).map((u) => (
                <span key={u.id} className="cm-card__unit-chip" title={LABEL_BY_UNIT_STATUS[u.status]}>
                  {u.photoUrl ? <img src={u.photoUrl} alt="" /> : null}
                  <em>{u.label}</em>
                </span>
              ))}
              {assignedUnits.length > 3 && (
                <span className="cm-card__unit-more">+{assignedUnits.length - 3}</span>
              )}
            </div>
          </div>
        )}

        <footer className="cm-card__footer">
          <span>{assignedUnits.length > 0 ? 'Detalhes e reforço' : 'Abrir despacho'}</span>
          <span className="cm-card__chevron" aria-hidden>
            ›
          </span>
        </footer>
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
  const [query, setQuery] = useState('');

  const activeAll = useMemo(
    () => incidents.filter((i) => i.status !== 'resolvido'),
    [incidents]
  );

  const counts = useMemo(
    () => ({
      all: activeAll.length,
      policia: activeAll.filter((i) => i.type === 'policia').length,
      incendio: activeAll.filter((i) => i.type === 'incendio').length,
      samu: activeAll.filter((i) => i.type === 'samu').length,
      waiting: activeAll.filter((i) => i.status === 'aguardando').length,
      critical: activeAll.filter((i) => i.priority === 1).length,
    }),
    [activeAll]
  );

  const active = useMemo(() => {
    const q = query.trim().toLowerCase();
    return activeAll
      .filter((i) => filter === 'all' || i.type === filter)
      .filter((i) => {
        if (!q) return true;
        return (
          i.title.toLowerCase().includes(q) ||
          i.description.toLowerCase().includes(q) ||
          (i.protocolNumber ?? '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => a.priority - b.priority || a.createdAt - b.createdAt);
  }, [activeAll, filter, query]);

  return (
    <div className="central-modal central-modal--dispatch">
      <header className="central-modal__hero">
        <div className="central-modal__hero-glow" aria-hidden />
        <div className="central-modal__hero-top">
          <div>
            <span className="central-modal__live">
              <i />
              AO VIVO
            </span>
            <span className="central-modal__kicker">Central 190 / 193</span>
            <h2 className="central-modal__title">Ocorrências</h2>
          </div>
          <div className="central-modal__counter" title="Fila ativa">
            <strong>{counts.all}</strong>
            <span>ativas</span>
          </div>
        </div>

        <div className="central-modal__stats">
          <div className={`central-modal__stat${counts.waiting > 0 ? ' is-alert' : ''}`}>
            <em>{counts.waiting}</em>
            <span>Na fila</span>
          </div>
          <div className={`central-modal__stat${counts.critical > 0 ? ' is-crit' : ''}`}>
            <em>{counts.critical}</em>
            <span>P1 crítica</span>
          </div>
          <div className="central-modal__stat">
            <em>{catalogSize().toLocaleString('pt-BR')}</em>
            <span>Cenários</span>
          </div>
        </div>
      </header>

      <div className="central-modal__toolbar">
        <label className="central-modal__search">
          <span className="central-modal__search-icon" aria-hidden>
            ⌕
          </span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar protocolo, natureza, local…"
            autoComplete="off"
          />
          {query && (
            <button type="button" className="central-modal__search-clear" onClick={() => setQuery('')}>
              ×
            </button>
          )}
        </label>

        <div className="central-modal__filters" role="tablist" aria-label="Filtrar por tipo">
          {(
            [
              ['all', 'Todas', counts.all, 'all'],
              ['policia', 'PM', counts.policia, 'policia'],
              ['incendio', 'BM', counts.incendio, 'incendio'],
              ['samu', 'Médica', counts.samu, 'samu'],
            ] as const
          ).map(([key, label, n, tone]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={filter === key}
              className={`central-modal__chip central-modal__chip--${tone}${filter === key ? ' is-active' : ''}`}
              onClick={() => setFilter(key)}
            >
              <span>{label}</span>
              <em>{n}</em>
            </button>
          ))}
        </div>
      </div>

      <div className="central-modal__body">
        {active.length === 0 ? (
          <div className="central-modal__empty">
            <div className="central-modal__radar" aria-hidden>
              <span />
              <span />
              <span />
            </div>
            <strong>{query ? 'Nenhum resultado' : 'Fila em espera'}</strong>
            <p>
              {query
                ? 'Tente outro termo ou limpe a busca.'
                : 'Nenhum chamado ativo. Novas ocorrências chegam aleatoriamente no plantão.'}
            </p>
            {query && (
              <button type="button" className="central-modal__empty-btn" onClick={() => setQuery('')}>
                Limpar busca
              </button>
            )}
          </div>
        ) : (
          <ul className="central-modal__list">
            {active.map((incident, index) => (
              <IncidentListCard
                key={incident.id}
                incident={incident}
                units={units}
                onOpen={onOpenIncident}
                index={index}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import type { CityBase } from '../types/city';
import type { Incident, Unit } from '../types/game';
import {
  EMOJI_BY_INCIDENT_TYPE,
  LABEL_BY_INCIDENT_TYPE,
  LABEL_BY_UNIT_STATUS,
  LABEL_BY_ZONE,
} from '../lib/labels';
import { CUSTOM_INCIDENT_ICONS } from '../lib/customIcons';
import { availableUnitsByBase, formatDistance } from '../lib/dispatch';
import { formatServiceRemaining } from '../lib/fireTeams';
import { callerLabel, tagLabel } from '../lib/incidentRealism';
import type { IncidentTag } from '../types/game';

function statusLabel(status: Incident['status']): string {
  switch (status) {
    case 'aguardando':
      return 'Aguardando despacho';
    case 'despachado':
      return 'Unidade a caminho';
    case 'em_atendimento':
      return 'Em atendimento no local';
    case 'aguardando_pc':
      return 'Aguardando Polícia Civil';
    case 'investigacao_pc':
      return 'Investigação PC';
    case 'aguardando_decisao':
      return 'Aguardando decisão do operador';
    case 'resolvido':
      return 'Encerrada';
    default:
      return status;
  }
}

function priorityLabel(p: 1 | 2 | 3): string {
  if (p === 1) return 'Crítica';
  if (p === 2) return 'Média';
  return 'Baixa';
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function unitRole(unit: Unit, incident: Incident): string {
  if (unit.serviceRoleLabel) return unit.serviceRoleLabel;
  if (incident.assignedUnitId === unit.id) return 'Principal';
  if (unit.mission === 'apoio_ocorrencia') return 'Apoio';
  return 'Designada';
}

export function IncidentDashboard({
  incident,
  units,
  bases,
  onDispatch,
  onIgnore,
  onDiscard,
  onClose,
  onFocusMap,
}: {
  incident: Incident;
  units: Unit[];
  bases: CityBase[];
  onDispatch: (unitId: string, incidentId: string) => void;
  /** Não envia unidade — encerra sem despacho. */
  onIgnore: (incidentId: string) => void;
  /** Remove a ocorrência da fila. */
  onDiscard: (incidentId: string) => void;
  onClose: () => void;
  onFocusMap?: (incident: Incident) => void;
}) {
  const [openBaseId, setOpenBaseId] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const groups = useMemo(() => availableUnitsByBase(units, incident, bases), [units, incident, bases]);

  // atualiza contagem regressiva das equipes no local
  useEffect(() => {
    const hasTimers = units.some(
      (u) => u.assignedIncidentId === incident.id && u.serviceEndsAt
    );
    if (!hasTimers) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [units, incident.id]);

  const assignedUnits = useMemo(() => {
    const linked = units.filter((u) => u.assignedIncidentId === incident.id);
    if (linked.length > 0) return linked;
    const primary = units.find((u) => u.id === incident.assignedUnitId);
    return primary ? [primary] : [];
  }, [units, incident.id, incident.assignedUnitId]);

  const enRouteCount = assignedUnits.filter((u) => u.status === 'a_caminho').length;
  const onSceneCount = assignedUnits.filter(
    (u) =>
      u.status === 'no_local' ||
      u.status === 'aguardando_decisao' ||
      u.status === 'em_operacao'
  ).length;

  const isMedical = incident.type === 'samu';
  const isActive =
    incident.status === 'aguardando' ||
    incident.status === 'despachado' ||
    incident.status === 'em_atendimento' ||
    incident.status === 'aguardando_pc' ||
    incident.status === 'investigacao_pc';
  const canDispatch = isActive && incident.status !== 'resolvido';
  const isReinforce = assignedUnits.length > 0;
  const canCloseWithoutUnit = incident.status === 'aguardando';

  const icon =
    incident.icon && CUSTOM_INCIDENT_ICONS[incident.icon] ? (
      <img src={CUSTOM_INCIDENT_ICONS[incident.icon]} alt="" className="inc-dash__type-img" />
    ) : (
      <span className="inc-dash__type-emoji">{EMOJI_BY_INCIDENT_TYPE[incident.type]}</span>
    );

  return (
    <div className="inc-dash-overlay" role="presentation" onClick={onClose}>
      <div
        className={`inc-dash inc-dash--${incident.type} inc-dash--p${incident.priority}`}
        role="dialog"
        aria-modal="true"
        aria-label={`Ocorrência: ${incident.title}`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="inc-dash__header">
          <div className="inc-dash__type-chip" aria-hidden>
            {icon}
          </div>
          <div className="inc-dash__header-text">
            <span className="inc-dash__kicker">Central de despacho</span>
            <h2>{incident.title}</h2>
            <p>
              {LABEL_BY_INCIDENT_TYPE[incident.type]}
              {incident.zone ? ` · ${LABEL_BY_ZONE[incident.zone] ?? incident.zone}` : ''}
              {' · '}
              Prioridade {incident.priority} ({priorityLabel(incident.priority)})
            </p>
          </div>
          <button type="button" className="inc-dash__close" onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </header>

        <div className="inc-dash__body">
          <section className="inc-dash__section">
            <h3>Detalhes</h3>
            <p className="inc-dash__desc">{incident.description}</p>
            {(incident.tags?.length ?? 0) > 0 && (
              <div className="inc-dash__tags">
                {incident.tags!.map((t) => (
                  <span key={t} className={`inc-dash__tag inc-dash__tag--${t}`}>
                    {tagLabel(t as IncidentTag)}
                  </span>
                ))}
                {incident.armed && <span className="inc-dash__tag inc-dash__tag--arma">Arma informada</span>}
              </div>
            )}
            <dl className="inc-dash__meta">
              <div>
                <dt>Status</dt>
                <dd>
                  <span className={`inc-dash__badge inc-dash__badge--${incident.status}`}>
                    {statusLabel(incident.status)}
                  </span>
                </dd>
              </div>
              <div>
                <dt>Protocolo</dt>
                <dd>{incident.protocolNumber ?? '—'}</dd>
              </div>
              <div>
                <dt>Solicitante</dt>
                <dd>{incident.caller ? callerLabel(incident.caller) : '—'}</dd>
              </div>
              <div>
                <dt>Registrada às</dt>
                <dd>{formatTime(incident.createdAt)}</dd>
              </div>
              <div>
                <dt>Zona</dt>
                <dd>{incident.zone ? LABEL_BY_ZONE[incident.zone] ?? incident.zone : '—'}</dd>
              </div>
              <div>
                <dt>Vítimas / suspeitos</dt>
                <dd>
                  {incident.victimCount ?? 0} vit. · {incident.suspectCount ?? 0} susp.
                </dd>
              </div>
              <div>
                <dt>Coordenadas</dt>
                <dd className="inc-dash__coords">
                  {incident.location[0].toFixed(5)}, {incident.location[1].toFixed(5)}
                </dd>
              </div>
            </dl>
            {onFocusMap && (
              <button type="button" className="inc-dash__btn inc-dash__btn--ghost" onClick={() => onFocusMap(incident)}>
                Ver no mapa
              </button>
            )}
            {isMedical && (
              <p className="inc-dash__hint">Emergência médica: apenas unidades do Corpo de Bombeiros.</p>
            )}
            {incident.requiresCivilPolice && (
              <p className="inc-dash__hint inc-dash__hint--civil">
                Exige Polícia Civil — viatura PC é despachada automaticamente (se disponível).
              </p>
            )}
            {incident.armed && (
              <p className="inc-dash__hint inc-dash__hint--multi">
                Informação de arma de fogo — priorizar perímetro e reforço tático.
              </p>
            )}
            {assignedUnits.length > 1 && (
              <p className="inc-dash__hint inc-dash__hint--multi">
                {onSceneCount > 0 && enRouteCount > 0
                  ? `${onSceneCount} no local · ${enRouteCount} a caminho — guarnições se organizam e compartilham o atendimento.`
                  : assignedUnits.length > 1
                    ? `${assignedUnits.length} unidades designadas — atendimento compartilhado.`
                    : null}
              </p>
            )}
          </section>

          {(incident.log?.length ?? 0) > 0 && (
            <section className="inc-dash__section">
              <h3>Diário operacional</h3>
              <ul className="inc-dash__log">
                {[...(incident.log ?? [])]
                  .slice()
                  .reverse()
                  .slice(0, 12)
                  .map((entry) => (
                    <li key={entry.id} className={`inc-dash__log-item inc-dash__log-item--${entry.kind}`}>
                      <time>{formatTime(entry.at)}</time>
                      <span>{entry.text}</span>
                    </li>
                  ))}
              </ul>
            </section>
          )}

          {assignedUnits.length > 0 && (
            <section className="inc-dash__section">
              <h3>
                {assignedUnits.length === 1 ? 'Unidade designada' : `Unidades designadas (${assignedUnits.length})`}
              </h3>
              <ul className="inc-dash__assigned-list">
                {assignedUnits.map((u) => {
                  const working = u.serviceEndsAt && u.serviceEndsAt > now;
                  const done =
                    u.pendingIncidentTitle?.includes('Tarefa concluída') ||
                    (u.serviceRole && !working && incident.status === 'em_atendimento');
                  return (
                    <li key={u.id} className="inc-dash__assigned">
                      {u.photoUrl && <img src={u.photoUrl} alt="" className="inc-dash__unit-photo" />}
                      <div>
                        <strong>
                          {u.label}
                          <span className="inc-dash__role">{unitRole(u, incident)}</span>
                        </strong>
                        <span>
                          {u.department} · {LABEL_BY_UNIT_STATUS[u.status]}
                          {working && u.serviceEndsAt
                            ? ` · restam ${formatServiceRemaining(u.serviceEndsAt, now)}`
                            : ''}
                          {done ? ' · tarefa ok' : ''}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {canDispatch && (
            <section className="inc-dash__section">
              <h3>{isReinforce ? 'Despachar reforço' : 'Despachar unidade'}</h3>
              <p className="inc-dash__section-lead">
                {isReinforce
                  ? incident.type === 'incendio' ||
                    incident.type === 'samu' ||
                    /acidente|colisão|colisao|capotamento/i.test(incident.title)
                    ? 'Despache UR, ABTS ou apoio. Cada equipe assume um papel (APH, extricação, combate…) com tempo próprio.'
                    : 'Destaque outra viatura. Quem já está no local fica ciente do reforço e as equipes se organizam no atendimento.'
                  : 'Escolha o batalhão e a viatura que responderá a esta ocorrência.'}
              </p>
              {groups.length === 0 ? (
                <p className="inc-dash__empty">Nenhuma unidade compatível disponível no momento.</p>
              ) : (
                <ul className="inc-dash__bases">
                  {groups.map((group) => {
                    const open = openBaseId === group.base.id;
                    return (
                      <li key={group.base.id}>
                        <button
                          type="button"
                          className={`inc-dash__base-btn${open ? ' is-open' : ''}`}
                          onClick={() => setOpenBaseId(open ? null : group.base.id)}
                        >
                          <span className="inc-dash__base-name">{group.base.name}</span>
                          <span className="inc-dash__base-meta">
                            {group.candidates.length} un. · mais próxima {formatDistance(group.nearestMeters)}
                          </span>
                          <span aria-hidden>{open ? '▾' : '›'}</span>
                        </button>
                        {open && (
                          <ul className="inc-dash__units">
                            {group.candidates.map(({ unit, distanceMeters }) => (
                              <li key={unit.id}>
                                <button
                                  type="button"
                                  className="inc-dash__unit-btn"
                                  onClick={() => onDispatch(unit.id, incident.id)}
                                >
                                  {unit.photoUrl && (
                                    <img src={unit.photoUrl} alt="" className="inc-dash__unit-photo" />
                                  )}
                                  <span className="inc-dash__unit-text">
                                    <strong>{unit.label}</strong>
                                    <span>
                                      {unit.department} · {formatDistance(distanceMeters)}
                                      {unit.operationId ? ' · interrompe operação' : ''}
                                    </span>
                                  </span>
                                  <span className="inc-dash__unit-go">{isReinforce ? 'Reforço' : 'Despachar'}</span>
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          )}

          {canCloseWithoutUnit && (
            <section className="inc-dash__section inc-dash__section--actions">
              <h3>Outras ações</h3>
              <div className="inc-dash__actions">
                <button
                  type="button"
                  className="inc-dash__btn inc-dash__btn--muted"
                  onClick={() => onIgnore(incident.id)}
                >
                  <strong>Não enviar unidade</strong>
                  <span>Encerra a ocorrência sem despachar ninguém</span>
                </button>
                <button
                  type="button"
                  className="inc-dash__btn inc-dash__btn--danger"
                  onClick={() => onDiscard(incident.id)}
                >
                  <strong>Descartar ocorrência</strong>
                  <span>Remove da fila (falso positivo, duplicada, etc.)</span>
                </button>
              </div>
            </section>
          )}
        </div>

        <footer className="inc-dash__footer">
          <span className="inc-dash__id">ID {incident.id.slice(-12)}</span>
          <button type="button" className="inc-dash__btn inc-dash__btn--primary" onClick={onClose}>
            Fechar
          </button>
        </footer>
      </div>
    </div>
  );
}

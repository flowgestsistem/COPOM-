import { useMemo } from 'react';
import type { CityBase } from '../types/city';
import type { Incident, Operation, Unit } from '../types/game';
import { buildUnitDetail } from '../lib/unitDetail';
import { findNearbySupportIncidents } from '../lib/nearbySupport';

function resolvePhoto(url?: string): string {
  if (!url) return '';
  const raw = url.trim();
  if (!raw) return '';
  if (raw.startsWith('http') || raw.startsWith('data:') || raw.startsWith('/')) return raw;
  return `/${raw}`;
}

export function UnitDetailPanel({
  unit,
  incidents,
  operations,
  bases,
  following = false,
  onClose,
  onOpenActions,
  onToggleFollow,
  onSendSupport,
}: {
  unit: Unit;
  incidents: Incident[];
  operations: Operation[];
  bases: CityBase[];
  following?: boolean;
  onClose: () => void;
  onOpenActions?: () => void;
  onToggleFollow?: () => void;
  onSendSupport?: (incidentId: string) => void;
}) {
  const d = buildUnitDetail(unit, incidents, operations, bases);
  const nearby = useMemo(() => findNearbySupportIncidents(unit, incidents), [unit, incidents]);
  const nearest = nearby[0] ?? null;
  const photo = resolvePhoto(unit.photoUrl);
  const canOpenActions =
    !!onOpenActions &&
    (!!unit.pendingDecision ||
      unit.status === 'disponivel' ||
      (!!unit.assignedIncidentId &&
        (unit.status === 'no_local' || unit.status === 'em_operacao')));

  return (
    <div className="unit-sheet" role="dialog" aria-label={`Detalhes de ${unit.label}`}>
      <button type="button" className="unit-sheet__scrim" onClick={onClose} aria-label="Fechar painel" />

      <div className="unit-sheet__panel">
        {/* Hero com foto grande (estilo do popup antigo, unificado) */}
        <div className="unit-sheet__hero">
          {photo ? (
            <img
              src={photo}
              alt=""
              className="unit-sheet__hero-img"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <div className="unit-sheet__hero-fallback" aria-hidden>
              {unit.label.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="unit-sheet__hero-shade" />
          <button type="button" className="unit-sheet__close" onClick={onClose} aria-label="Fechar">
            ×
          </button>
          <div className="unit-sheet__hero-text">
            <span className="unit-sheet__kicker">Unidade operacional</span>
            <h2 className="unit-sheet__title">{d.headline}</h2>
            <p className="unit-sheet__sub">
              {d.department} · {d.typeLabel}
            </p>
          </div>
        </div>

        <div className="unit-sheet__badges">
          <span className="unit-sheet__badge unit-sheet__badge--status">{d.statusLabel}</span>
          {d.codeLabel && <span className="unit-sheet__badge unit-sheet__badge--code">{d.codeLabel}</span>}
          {d.missionLabel && <span className="unit-sheet__badge">{d.missionLabel}</span>}
          {following && <span className="unit-sheet__badge unit-sheet__badge--follow">Seguindo</span>}
        </div>

        <div className="unit-sheet__body">
          {onSendSupport && nearby.length > 0 && (
            <section className="unit-sheet__section unit-sheet__section--support">
              <h3>Apoio próximo</h3>
              <p className="unit-sheet__lead">
                Há ocorrência{nearby.length > 1 ? 's' : ''} na área. Direcione esta guarnição:
              </p>
              {nearest && (
                <button
                  type="button"
                  className="unit-sheet__support-primary"
                  onClick={() => onSendSupport(nearest.incident.id)}
                >
                  <strong>Direcionar para apoio próximo</strong>
                  <span>
                    {nearest.incident.title} · {nearest.distanceLabel}
                    {nearest.zoneLabel ? ` · ${nearest.zoneLabel}` : ''}
                  </span>
                </button>
              )}
              {nearby.length > 1 && (
                <ul className="unit-sheet__support-list">
                  {nearby.map((opt) => (
                    <li key={opt.incident.id}>
                      <button
                        type="button"
                        className={`unit-sheet__support-item${opt.isNearest ? ' is-nearest' : ''}`}
                        onClick={() => onSendSupport(opt.incident.id)}
                      >
                        <span className="unit-sheet__support-item-text">
                          <strong>{opt.incident.title}</strong>
                          <span>
                            {opt.typeLabel}
                            {opt.zoneLabel ? ` · ${opt.zoneLabel}` : ''} · P{opt.incident.priority} ·{' '}
                            {opt.distanceLabel}
                          </span>
                        </span>
                        <span className="unit-sheet__support-go">Apoiar</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {d.destination && (
            <section className="unit-sheet__section">
              <h3>Destino</h3>
              <p className="unit-sheet__dest-title">{d.destination.title}</p>
              <p className="unit-sheet__meta">{d.destination.detail}</p>
              {d.destination.coords && <p className="unit-sheet__coords">{d.destination.coords}</p>}
              {(d.routeProgressPct !== null || d.etaLabel) && (
                <div className="unit-sheet__progress">
                  {d.routeProgressPct !== null && (
                    <>
                      <div className="unit-sheet__bar">
                        <span style={{ width: `${d.routeProgressPct}%` }} />
                      </div>
                      <span>
                        {d.routeProgressPct}% do trajeto{d.etaLabel ? ` · ${d.etaLabel}` : ''}
                      </span>
                    </>
                  )}
                  {d.routeProgressPct === null && d.etaLabel && <span>{d.etaLabel}</span>}
                </div>
              )}
            </section>
          )}

          <section className="unit-sheet__section">
            <h3>{unit.type === 'viatura' ? 'Situação / condução' : 'Vítima / paciente'}</h3>
            <div className={`unit-sheet__cargo unit-sheet__cargo--${d.cargo.kind}`}>
              <strong>{d.cargo.title}</strong>
              {d.cargo.reason && <span>{d.cargo.reason}</span>}
            </div>
          </section>

          {d.incident && (
            <section className="unit-sheet__section">
              <h3>Ocorrência vinculada</h3>
              <p className="unit-sheet__dest-title">{d.incident.title}</p>
              <p className="unit-sheet__meta">
                {d.incident.typeLabel}
                {d.incident.zone ? ` · ${d.incident.zone}` : ''} · P{d.incident.priority}
              </p>
              {d.incident.snippet && <p className="unit-sheet__snippet">{d.incident.snippet}</p>}
            </section>
          )}

          {d.operation && (
            <section className="unit-sheet__section">
              <h3>Operação tática</h3>
              <p className="unit-sheet__dest-title">{d.operation.title}</p>
              <p className="unit-sheet__meta">{d.operation.typeLabel}</p>
            </section>
          )}

          {d.service && (
            <section className="unit-sheet__section">
              <h3>Papel no local</h3>
              <p className="unit-sheet__dest-title">{d.service.role}</p>
              {d.service.remaining && (
                <p className="unit-sheet__meta">Tempo restante: {d.service.remaining}</p>
              )}
            </section>
          )}

          {d.flags.length > 0 && (
            <section className="unit-sheet__section">
              <h3>Indicadores</h3>
              <ul className="unit-sheet__flags">
                {d.flags.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </section>
          )}

          {unit.pendingIncidentTitle && (
            <section className="unit-sheet__section">
              <h3>Último relatório</h3>
              <p className="unit-sheet__snippet">{unit.pendingIncidentTitle}</p>
            </section>
          )}

          {d.pendingHint && <p className="unit-sheet__pending">{d.pendingHint}</p>}
        </div>

        <footer className="unit-sheet__footer">
          <button type="button" className="unit-sheet__btn unit-sheet__btn--ghost" onClick={onClose}>
            Fechar
          </button>
          {onToggleFollow && (
            <button
              type="button"
              className={`unit-sheet__btn unit-sheet__btn--follow${following ? ' is-active' : ''}`}
              onClick={onToggleFollow}
            >
              {following ? 'Parar de seguir' : 'Seguir viatura'}
            </button>
          )}
          {canOpenActions && (
            <button type="button" className="unit-sheet__btn unit-sheet__btn--primary" onClick={onOpenActions}>
              {unit.assignedIncidentId && unit.status !== 'disponivel'
                ? unit.actionQueue?.length
                  ? `Ações (${unit.actionQueue.length} na fila)`
                  : 'Ações da guarnição'
                : unit.pendingDecision
                  ? 'Abrir ações'
                  : 'Ações da viatura'}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}

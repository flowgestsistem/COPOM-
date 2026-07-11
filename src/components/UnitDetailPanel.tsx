import { useMemo } from 'react';
import type { CityBase } from '../types/city';
import type { Incident, Operation, Unit } from '../types/game';
import { buildUnitDetail } from '../lib/unitDetail';
import { findNearbySupportIncidents } from '../lib/nearbySupport';

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
  /** Câmera do mapa está seguindo esta unidade. */
  following?: boolean;
  onClose: () => void;
  /** Abre menu de ações / decisão se houver. */
  onOpenActions?: () => void;
  onToggleFollow?: () => void;
  /** Envia esta unidade em apoio a uma ocorrência. */
  onSendSupport?: (incidentId: string) => void;
}) {
  const d = buildUnitDetail(unit, incidents, operations, bases);
  const nearby = useMemo(
    () => findNearbySupportIncidents(unit, incidents),
    [unit, incidents]
  );
  const nearest = nearby[0] ?? null;

  return (
    <div className="unit-detail" role="dialog" aria-label={`Detalhes de ${unit.label}`}>
      <header className="unit-detail__header">
        {unit.photoUrl && (
          <img src={unit.photoUrl} alt="" className="unit-detail__photo" />
        )}
        <div className="unit-detail__titles">
          <span className="unit-detail__kicker">Detalhes da unidade</span>
          <strong>{d.headline}</strong>
          <span className="unit-detail__sub">
            {d.department} · {d.typeLabel}
          </span>
        </div>
        <button type="button" className="unit-detail__close" onClick={onClose} aria-label="Fechar">
          ×
        </button>
      </header>

      <div className="unit-detail__badges">
        <span className={`unit-detail__badge unit-detail__badge--status`}>{d.statusLabel}</span>
        {d.codeLabel && <span className="unit-detail__badge unit-detail__badge--code">{d.codeLabel}</span>}
        {d.missionLabel && <span className="unit-detail__badge">{d.missionLabel}</span>}
      </div>

      <div className="unit-detail__body">
        {/* Apoio a ocorrência próxima — destaque no topo */}
        {onSendSupport && nearby.length > 0 && (
          <section className="unit-detail__section unit-detail__section--support">
            <h3>Apoio próximo</h3>
            <p className="unit-detail__support-lead">
              Há ocorrência{nearby.length > 1 ? 's' : ''} na área. Direcione esta guarnição:
            </p>

            {nearest && (
              <button
                type="button"
                className="unit-detail__support-primary"
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
              <ul className="unit-detail__support-list">
                {nearby.map((opt) => (
                  <li key={opt.incident.id}>
                    <button
                      type="button"
                      className={`unit-detail__support-item${opt.isNearest ? ' is-nearest' : ''}`}
                      onClick={() => onSendSupport(opt.incident.id)}
                    >
                      <span className="unit-detail__support-item-text">
                        <strong>{opt.incident.title}</strong>
                        <span>
                          {opt.typeLabel}
                          {opt.zoneLabel ? ` · ${opt.zoneLabel}` : ''} · P{opt.incident.priority} ·{' '}
                          {opt.distanceLabel}
                        </span>
                      </span>
                      <span className="unit-detail__support-go">Apoiar</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {d.destination && (
          <section className="unit-detail__section">
            <h3>Destino</h3>
            <p className="unit-detail__dest-title">{d.destination.title}</p>
            <p className="unit-detail__dest-detail">{d.destination.detail}</p>
            {d.destination.coords && (
              <p className="unit-detail__coords">{d.destination.coords}</p>
            )}
            {(d.routeProgressPct !== null || d.etaLabel) && (
              <div className="unit-detail__progress">
                {d.routeProgressPct !== null && (
                  <>
                    <div className="unit-detail__bar">
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

        <section className="unit-detail__section">
          <h3>{unit.type === 'viatura' ? 'Situação / condução' : 'Vítima / paciente'}</h3>
          <p className={`unit-detail__cargo unit-detail__cargo--${d.cargo.kind}`}>
            <strong>{d.cargo.title}</strong>
            {d.cargo.reason && <span>{d.cargo.reason}</span>}
          </p>
        </section>

        {d.incident && (
          <section className="unit-detail__section">
            <h3>Ocorrência vinculada</h3>
            <p className="unit-detail__dest-title">{d.incident.title}</p>
            <p className="unit-detail__meta-line">
              {d.incident.typeLabel}
              {d.incident.zone ? ` · ${d.incident.zone}` : ''}
              {' · '}P{d.incident.priority}
            </p>
            <p className="unit-detail__snippet">{d.incident.snippet}</p>
          </section>
        )}

        {d.operation && (
          <section className="unit-detail__section">
            <h3>Operação tática</h3>
            <p className="unit-detail__dest-title">{d.operation.title}</p>
            <p className="unit-detail__meta-line">{d.operation.typeLabel}</p>
          </section>
        )}

        {d.service && (
          <section className="unit-detail__section">
            <h3>Papel no local</h3>
            <p className="unit-detail__dest-title">{d.service.role}</p>
            {d.service.remaining && (
              <p className="unit-detail__meta-line">Tempo restante: {d.service.remaining}</p>
            )}
          </section>
        )}

        {d.flags.length > 0 && (
          <section className="unit-detail__section">
            <h3>Indicadores</h3>
            <ul className="unit-detail__flags">
              {d.flags.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </section>
        )}

        {unit.pendingIncidentTitle && (
          <section className="unit-detail__section">
            <h3>Último relatório</h3>
            <p className="unit-detail__snippet">{unit.pendingIncidentTitle}</p>
          </section>
        )}

        {d.pendingHint && <p className="unit-detail__pending">{d.pendingHint}</p>}
      </div>

      <footer className="unit-detail__footer">
        <button type="button" className="unit-detail__btn unit-detail__btn--ghost" onClick={onClose}>
          Fechar
        </button>
        {onToggleFollow && (
          <button
            type="button"
            className={`unit-detail__btn unit-detail__btn--follow${following ? ' is-active' : ''}`}
            onClick={onToggleFollow}
          >
            {following ? 'Parar de seguir' : 'Seguir viatura'}
          </button>
        )}
        {onOpenActions &&
          (unit.pendingDecision ||
            unit.status === 'disponivel' ||
            (unit.assignedIncidentId &&
              (unit.status === 'no_local' || unit.status === 'em_operacao'))) && (
            <button
              type="button"
              className="unit-detail__btn unit-detail__btn--primary"
              onClick={onOpenActions}
            >
              {unit.assignedIncidentId && unit.status !== 'disponivel'
                ? unit.actionQueue?.length
                  ? `Ações da guarnição (${unit.actionQueue.length} na fila)`
                  : 'Ações da guarnição'
                : unit.pendingDecision
                  ? 'Abrir ações'
                  : 'Ações da viatura'}
            </button>
          )}
      </footer>
    </div>
  );
}

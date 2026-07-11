import { useMemo, useState } from 'react';
import type { Operation, OperationStatus, PatrolEvent, Unit } from '../types/game';
import type { CityBase } from '../types/city';
import {
  DESCRIPTION_BY_OPERATION_TYPE,
  LABEL_BY_OPERATION_STATUS,
  LABEL_BY_OPERATION_TYPE,
  LABEL_BY_UNIT_STATUS,
} from '../lib/labels';
import {
  availableUnitsForOperation,
  DURATION_OPTIONS_MIN,
  isPatrolOperationType,
  isWithinOperationRange,
  OPERATION_MAX_RANGE_METERS,
  OPERATION_PRESETS,
  PATROL_RADIUS_OPTIONS_M,
  type OperationDraft,
  type OperationPreset,
} from '../lib/operations';
import { formatDistance } from '../lib/dispatch';
import { isCivilPoliceUnit } from '../lib/civilPolice';
import { OperationTypeIcon } from './OperationIcons';

type OpsTab = 'operacoes' | 'andamento' | 'eventos';

function DraftForm({
  draft,
  units,
  bases,
  picking,
  onStartPicking,
  onUpdateDraft,
  onToggleUnit,
  onLaunch,
  onCancelDraft,
}: {
  draft: OperationDraft;
  units: Unit[];
  bases: CityBase[];
  picking: boolean;
  onStartPicking: () => void;
  onUpdateDraft: (partial: Partial<OperationDraft>) => void;
  onToggleUnit: (unitId: string) => void;
  onLaunch: () => void;
  onCancelDraft: () => void;
}) {
  const preferCivil = draft.type === 'busca_apreensao' || draft.type === 'mandado';
  const candidates = draft.location
    ? availableUnitsForOperation(units, draft.location, {
        policeOnly: true,
        bases,
        preferCivil,
      })
    : [];
  const withinRange = draft.location ? isWithinOperationRange(draft.location) : true;
  const needsPatrolRadius = isPatrolOperationType(draft.type);
  const canLaunch =
    !!draft.location && withinRange && draft.unitIds.length > 0 && draft.durationMinutes > 0;

  return (
    <div className={`operation-draft operation-draft--${draft.type}`}>
      <div className="operation-draft__header">
        <span className={`op-type-chip op-type-chip--${draft.type}`} aria-hidden>
          <OperationTypeIcon type={draft.type} className="op-type-icon" />
        </span>
        <div className="operation-draft__titles">
          <span className="ops-kicker">Montar operação</span>
          <strong>{draft.title || LABEL_BY_OPERATION_TYPE[draft.type]}</strong>
        </div>
        <button type="button" className="operation-draft__close" onClick={onCancelDraft} aria-label="Cancelar rascunho">
          ×
        </button>
      </div>

      <p className="operation-draft__hint">{DESCRIPTION_BY_OPERATION_TYPE[draft.type]}</p>

      <label className="operation-draft__field">
        <span className="operation-draft__label">Nome da operação</span>
        <input
          type="text"
          value={draft.title}
          maxLength={60}
          onChange={(e) => onUpdateDraft({ title: e.target.value })}
          placeholder="Ex.: Centro Seguro — turno tarde"
        />
      </label>

      <button
        type="button"
        className={`operation-draft__pick-btn${picking ? ' operation-draft__pick-btn--active' : ''}${
          draft.location ? ' operation-draft__pick-btn--done' : ''
        }`}
        onClick={onStartPicking}
      >
        <span className="operation-draft__pick-icon" aria-hidden>
          {picking ? '⌖' : draft.location ? '✓' : '📍'}
        </span>
        <span>
          {picking
            ? draft.type === 'busca_apreensao'
              ? 'Clique no mapa no endereço da busca…'
              : 'Clique no mapa para marcar o setor…'
            : draft.location
              ? draft.requireMapPick
                ? 'Local definido — clique para alterar'
                : 'Local padrão definido — clique para alterar no mapa'
              : 'Escolher local no mapa'}
        </span>
      </button>

      {draft.location && !withinRange && (
        <p className="operation-draft__warning">
          Fora do raio de {OPERATION_MAX_RANGE_METERS / 1000} km permitido a partir de Uberlândia.
        </p>
      )}

      {needsPatrolRadius && (
        <div className="operation-draft__field">
          <span className="operation-draft__label">Raio de atuação / patrulha</span>
          <div className="operation-draft__radius-options" role="group" aria-label="Raio de patrulha">
            {PATROL_RADIUS_OPTIONS_M.map((r) => (
              <button
                key={r}
                type="button"
                className={r === draft.radiusMeters ? 'active' : ''}
                onClick={() => onUpdateDraft({ radiusMeters: r })}
              >
                {r < 1000 ? `${r} m` : `${r / 1000} km`}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="operation-draft__field">
        <span className="operation-draft__label">Duração no setor</span>
        <div className="operation-draft__radius-options" role="group" aria-label="Duração">
          {DURATION_OPTIONS_MIN.map((m) => (
            <button
              key={m}
              type="button"
              className={m === draft.durationMinutes ? 'active' : ''}
              onClick={() => onUpdateDraft({ durationMinutes: m })}
            >
              {m} min
            </button>
          ))}
        </div>
      </div>

      {(draft.type === 'busca_apreensao' || draft.type === 'mandado') && (
        <label className="operation-draft__field">
          <span className="operation-draft__label">Observações / alvo</span>
          <input
            type="text"
            value={draft.notes ?? ''}
            maxLength={120}
            placeholder="Ex.: casa amarela, mandado 123/2026"
            onChange={(e) => onUpdateDraft({ notes: e.target.value })}
          />
        </label>
      )}

      {draft.location && (
        <div className="operation-draft__field">
          <span className="operation-draft__label">
            Forças policiais{' '}
            <em>
              {draft.unitIds.length} selecionada{draft.unitIds.length === 1 ? '' : 's'}
            </em>
          </span>
          {preferCivil && (
            <p className="operation-draft__subhint">Polícia Civil aparece primeiro na lista.</p>
          )}
          {candidates.length === 0 ? (
            <p className="ops-empty">Nenhuma viatura policial disponível.</p>
          ) : (
            <ul className="operation-draft__units">
              {candidates.map(({ unit, distanceMeters }) => {
                const checked = draft.unitIds.includes(unit.id);
                const isCivil = isCivilPoliceUnit(unit, bases);
                return (
                  <li key={unit.id}>
                    <label className={`operation-draft__unit-row${checked ? ' is-selected' : ''}`}>
                      <input type="checkbox" checked={checked} onChange={() => onToggleUnit(unit.id)} />
                      <span className="operation-draft__unit-name">
                        {unit.label}
                        <small>
                          {unit.department}
                          {isCivil ? ' · PC' : ' · PM'}
                        </small>
                      </span>
                      <span className="operation-draft__unit-dist">{formatDistance(distanceMeters)}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      <div className="operation-draft__actions">
        <button type="button" className="ops-btn ops-btn--ghost" onClick={onCancelDraft}>
          Cancelar
        </button>
        <button type="button" className="ops-btn ops-btn--primary" disabled={!canLaunch} onClick={onLaunch}>
          Lançar operação
        </button>
      </div>
    </div>
  );
}

function statusBadgeClass(status: OperationStatus): string {
  if (status === 'a_caminho') return 'ops-badge ops-badge--enroute';
  if (status === 'em_andamento') return 'ops-badge ops-badge--active';
  if (status === 'interrompida') return 'ops-badge ops-badge--warn';
  return 'ops-badge';
}

function OperationCard({
  operation,
  units,
  onCancel,
}: {
  operation: Operation;
  units: Unit[];
  onCancel: (id: string) => void;
}) {
  const assignedUnits = units.filter((u) => operation.unitIds.includes(u.id) || u.operationId === operation.id);
  const canCancel = operation.status === 'a_caminho' || operation.status === 'em_andamento';
  const mins = Math.round(operation.durationMs / 60_000);

  return (
    <li className={`operation-card operation-card--${operation.type}`}>
      <div className="operation-card__header">
        <span className={`op-type-chip op-type-chip--${operation.type}`} aria-hidden>
          <OperationTypeIcon type={operation.type} className="op-type-icon" />
        </span>
        <div className="operation-card__titles">
          <strong>{operation.title}</strong>
          <span className={statusBadgeClass(operation.status)}>{LABEL_BY_OPERATION_STATUS[operation.status]}</span>
        </div>
      </div>
      <p className="operation-card__meta">
        {LABEL_BY_OPERATION_TYPE[operation.type]} · {mins} min
        {operation.radiusMeters ? ` · raio ${operation.radiusMeters >= 1000 ? `${operation.radiusMeters / 1000} km` : `${operation.radiusMeters} m`}` : ''}
      </p>
      {operation.notes && <p className="operation-card__notes">{operation.notes}</p>}

      {assignedUnits.length > 0 && (
        <ul className="operation-card__units">
          {assignedUnits.map((u) => (
            <li key={u.id}>
              <span className="operation-card__unit-label">
                {u.label}
                <small> · {u.department}</small>
              </span>
              <span className="operation-card__unit-status">{LABEL_BY_UNIT_STATUS[u.status]}</span>
            </li>
          ))}
        </ul>
      )}

      {operation.type === 'blitz' && operation.vehicleChecks && operation.vehicleChecks.length > 0 && (
        <div className="operation-card__checks">
          <span className="operation-draft__label">
            Veículos parados <em>{operation.vehicleChecks.length}</em>
          </span>
          <ul>
            {operation.vehicleChecks.map((c) => (
              <li key={c.id} className={`vehicle-check vehicle-check--${c.outcome}`}>
                <strong>{c.plate}</strong> {c.model} {c.year} · IPVA {c.ipvaPago ? 'ok' : 'atrasado'} ·{' '}
                {c.outcome === 'liberado' ? 'Liberado' : c.outcome === 'multado' ? 'Multado' : 'Apreendido'}
              </li>
            ))}
          </ul>
        </div>
      )}

      {canCancel && (
        <button type="button" className="ops-btn ops-btn--danger" onClick={() => onCancel(operation.id)}>
          Encerrar operação
        </button>
      )}
    </li>
  );
}

const PATROL_EVENT_EMOJI: Record<PatrolEvent['type'], string> = {
  abordagem_pedestre: '🚶',
  abordagem_veiculo: '🚗',
  pedido_apoio: '📻',
  perseguicao: '🚨',
};

function PatrolEventFeed({ events }: { events: PatrolEvent[] }) {
  if (events.length === 0) {
    return <p className="ops-empty">Nenhum evento de patrulha ainda.</p>;
  }

  return (
    <ul className="patrol-event-feed__list">
      {events.slice(0, 20).map((event) => (
        <li key={event.id} className={event.arrest ? 'patrol-event--arrest' : ''}>
          <span className="patrol-event__icon" aria-hidden>
            {PATROL_EVENT_EMOJI[event.type]}
          </span>
          <div className="patrol-event__body">
            <strong>{event.unitLabel}</strong>
            <p>{event.description}</p>
            <span className="patrol-event__outcome">{event.outcome}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

function PresetGrid({
  onPick,
}: {
  onPick: (preset: OperationPreset) => void;
}) {
  const groups = useMemo(() => {
    const prevencao = OPERATION_PRESETS.filter((p) => p.category === 'prevencao');
    const tatico = OPERATION_PRESETS.filter((p) => p.category === 'tatico');
    const inv = OPERATION_PRESETS.filter((p) => p.category === 'investigativo');
    return [
      { title: 'Prevenção e ostensividade', items: prevencao },
      { title: 'Tático / trânsito', items: tatico },
      { title: 'Investigativo / cumprimento', items: inv },
    ];
  }, []);

  return (
    <div className="ops-presets">
      <p className="ops-presets__lead">
        Monte operações só com <strong>forças policiais</strong> (PM e PC). Escolha o modelo, as viaturas e o tempo
        de permanência.
      </p>
      {groups.map((g) => (
        <div key={g.title} className="ops-presets__group">
          <span className="ops-section-label">{g.title}</span>
          <div className="operations-panel__new-buttons">
            {g.items.map((preset) => (
              <button
                key={preset.type}
                type="button"
                className={`op-launch-card op-launch-card--${preset.type}`}
                onClick={() => onPick(preset)}
              >
                <span className={`op-type-chip op-type-chip--${preset.type}`} aria-hidden>
                  <OperationTypeIcon type={preset.type} className="op-type-icon" />
                </span>
                <span className="op-launch-card__text">
                  <strong>{preset.title}</strong>
                  <span>{preset.description}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function OperationsPanel({
  units,
  bases,
  operations,
  draft,
  picking,
  patrolEvents,
  onStartPreset,
  onStartPicking,
  onUpdateDraft,
  onToggleUnit,
  onLaunch,
  onCancelDraft,
  onCancelOperation,
}: {
  units: Unit[];
  bases: CityBase[];
  operations: Operation[];
  draft: OperationDraft | null;
  picking: boolean;
  patrolEvents: PatrolEvent[];
  onStartPreset: (preset: OperationPreset) => void;
  onStartPicking: () => void;
  onUpdateDraft: (partial: Partial<OperationDraft>) => void;
  onToggleUnit: (unitId: string) => void;
  onLaunch: () => void;
  onCancelDraft: () => void;
  onCancelOperation: (id: string) => void;
}) {
  const [tab, setTab] = useState<OpsTab>('operacoes');
  const activeOperations = operations.filter((o) => o.status !== 'concluida' && o.status !== 'interrompida');

  // ao montar rascunho, fica na aba operações
  const effectiveTab = draft ? 'operacoes' : tab;

  return (
    <section className="operations-panel">
      <header className="operations-panel__header">
        <div>
          <span className="ops-kicker">Console tático</span>
          <h2>Operações</h2>
        </div>
        {activeOperations.length > 0 && (
          <span className="ops-count ops-count--accent" title="Operações ativas">
            {activeOperations.length} ativa{activeOperations.length === 1 ? '' : 's'}
          </span>
        )}
      </header>

      {!draft && (
        <div className="ops-tabs" role="tablist" aria-label="Seções de operações">
          <button
            type="button"
            role="tab"
            aria-selected={effectiveTab === 'operacoes'}
            className={effectiveTab === 'operacoes' ? 'is-active' : ''}
            onClick={() => setTab('operacoes')}
          >
            Operações
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={effectiveTab === 'andamento'}
            className={effectiveTab === 'andamento' ? 'is-active' : ''}
            onClick={() => setTab('andamento')}
          >
            Em andamento
            {activeOperations.length > 0 && <em>{activeOperations.length}</em>}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={effectiveTab === 'eventos'}
            className={effectiveTab === 'eventos' ? 'is-active' : ''}
            onClick={() => setTab('eventos')}
          >
            Eventos
          </button>
        </div>
      )}

      {draft ? (
        <DraftForm
          draft={draft}
          units={units}
          bases={bases}
          picking={picking}
          onStartPicking={onStartPicking}
          onUpdateDraft={onUpdateDraft}
          onToggleUnit={onToggleUnit}
          onLaunch={onLaunch}
          onCancelDraft={onCancelDraft}
        />
      ) : effectiveTab === 'operacoes' ? (
        <PresetGrid
          onPick={(preset) => {
            onStartPreset(preset);
          }}
        />
      ) : effectiveTab === 'andamento' ? (
        <div className="operations-panel__list-wrap">
          {activeOperations.length === 0 ? (
            <p className="ops-empty">Nenhuma operação ativa. Monte uma na aba Operações.</p>
          ) : (
            <ul className="operations-panel__list">
              {activeOperations.map((op) => (
                <OperationCard key={op.id} operation={op} units={units} onCancel={onCancelOperation} />
              ))}
            </ul>
          )}
        </div>
      ) : (
        <section className="patrol-event-feed">
          <div className="ops-section-head">
            <h3>Eventos de patrulha / operação</h3>
            <span className="ops-count">{Math.min(patrolEvents.length, 20)}</span>
          </div>
          <PatrolEventFeed events={patrolEvents} />
        </section>
      )}
    </section>
  );
}

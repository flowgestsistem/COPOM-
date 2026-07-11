import { useEffect, useMemo, useState } from 'react';
import type { CityBase } from '../types/city';
import type { Unit } from '../types/game';
import { BASE_PHOTOS } from '../data/basePhotos';
import { LABEL_BY_UNIT_STATUS, LABEL_BY_UNIT_TYPE } from '../lib/labels';

function statusClass(status: Unit['status']): string {
  if (status === 'disponivel') return 'base-dash__status base-dash__status--free';
  if (status === 'a_caminho' || status === 'retornando') return 'base-dash__status base-dash__status--enroute';
  return 'base-dash__status base-dash__status--busy';
}

function RosterUnitRow({
  unit,
  draftActive,
  onAddToDraft,
  onSelectUnit,
}: {
  unit: Unit;
  draftActive: boolean;
  onAddToDraft: (unitId: string) => void;
  onSelectUnit: (unitId: string) => void;
}) {
  const isFree = unit.status === 'disponivel';
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <li className="base-dash__unit">
      <button type="button" className="base-dash__unit-main" onClick={() => onSelectUnit(unit.id)}>
        {unit.photoUrl && !imgFailed ? (
          <img
            src={unit.photoUrl}
            alt={unit.label}
            className="base-dash__unit-photo"
            loading="lazy"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div className="base-dash__unit-photo base-dash__unit-photo--empty" aria-hidden>
            🚓
          </div>
        )}
        <div className="base-dash__unit-info">
          <div className="base-dash__unit-top">
            <strong title={unit.label}>{unit.label}</strong>
            <span className={statusClass(unit.status)}>{LABEL_BY_UNIT_STATUS[unit.status]}</span>
          </div>
          <span className="base-dash__unit-meta">
            {unit.department} · {LABEL_BY_UNIT_TYPE[unit.type]}
          </span>
          <span className="base-dash__unit-hint">Toque para ações</span>
        </div>
        <span className="base-dash__unit-chevron" aria-hidden>
          ›
        </span>
      </button>

      {isFree && draftActive && unit.type === 'viatura' && (
        <button
          type="button"
          className="base-dash__add-draft"
          onClick={(e) => {
            e.stopPropagation();
            onAddToDraft(unit.id);
          }}
        >
          + Adicionar à operação
        </button>
      )}
    </li>
  );
}

interface DepartmentSummary {
  name: string;
  total: number;
  available: number;
  samplePhoto?: string;
  unitType: Unit['type'];
}

export function BaseRosterPanel({
  base,
  units,
  onClose,
  draftActive,
  onAddToDraft,
  onSelectUnit,
}: {
  base: CityBase;
  units: Unit[];
  onClose: () => void;
  draftActive: boolean;
  onAddToDraft: (unitId: string) => void;
  onSelectUnit: (unitId: string) => void;
}) {
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);

  // troca de batalhão reseta o submenu
  useEffect(() => {
    setSelectedDepartment(null);
  }, [base.id]);

  const roster = useMemo(() => units.filter((u) => u.baseId === base.id), [units, base.id]);
  const photo = BASE_PHOTOS[base.id];

  const stats = useMemo(() => {
    const available = roster.filter((u) => u.status === 'disponivel').length;
    const busy = roster.length - available;
    return { total: roster.length, available, busy };
  }, [roster]);

  const departments = useMemo(() => {
    const map = new Map<string, DepartmentSummary>();
    for (const unit of roster) {
      const key = unit.department || 'Frota geral';
      const existing = map.get(key);
      if (existing) {
        existing.total += 1;
        if (unit.status === 'disponivel') existing.available += 1;
        if (!existing.samplePhoto && unit.photoUrl) existing.samplePhoto = unit.photoUrl;
      } else {
        map.set(key, {
          name: key,
          total: 1,
          available: unit.status === 'disponivel' ? 1 : 0,
          samplePhoto: unit.photoUrl,
          unitType: unit.type,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [roster]);

  const departmentUnits = useMemo(() => {
    if (!selectedDepartment) return [];
    return roster
      .filter((u) => (u.department || 'Frota geral') === selectedDepartment)
      .sort((a, b) => {
        if (a.status === 'disponivel' && b.status !== 'disponivel') return -1;
        if (a.status !== 'disponivel' && b.status === 'disponivel') return 1;
        return a.label.localeCompare(b.label, 'pt-BR');
      });
  }, [roster, selectedDepartment]);

  return (
    <div className="base-dash" role="dialog" aria-label={`Dashboard ${base.name}`}>
      <header className="base-dash__header">
        <div className="base-dash__header-main">
          {selectedDepartment ? (
            <button type="button" className="base-dash__back" onClick={() => setSelectedDepartment(null)}>
              ‹ Departamentos
            </button>
          ) : (
            <span className="base-dash__kicker">Unidade operacional</span>
          )}
          <h3>{selectedDepartment ?? base.name}</h3>
          {!selectedDepartment && (
            <p className="base-dash__subtitle">{LABEL_BY_UNIT_TYPE[base.unitType]}</p>
          )}
          {selectedDepartment && (
            <p className="base-dash__subtitle">
              {departmentUnits.length} viatura{departmentUnits.length === 1 ? '' : 's'} · {base.name}
            </p>
          )}
        </div>
        <button type="button" className="base-dash__close" onClick={onClose} aria-label="Fechar">
          ×
        </button>
      </header>

      {!selectedDepartment && (
        <>
          {photo && (
            <div className="base-dash__hero">
              <img src={photo} alt={base.name} />
            </div>
          )}

          <div className="base-dash__stats" aria-label="Resumo da frota">
            <div className="base-dash__stat">
              <strong>{stats.total}</strong>
              <span>Total</span>
            </div>
            <div className="base-dash__stat base-dash__stat--free">
              <strong>{stats.available}</strong>
              <span>Disponíveis</span>
            </div>
            <div className="base-dash__stat base-dash__stat--busy">
              <strong>{stats.busy}</strong>
              <span>Em serviço</span>
            </div>
          </div>

          <div className="base-dash__section">
            <span className="base-dash__section-label">Departamentos</span>
            {departments.length === 0 ? (
              <p className="base-dash__empty">Nenhuma viatura cadastrada nesta base.</p>
            ) : (
              <ul className="base-dash__dept-list">
                {departments.map((dept) => (
                  <li key={dept.name}>
                    <button
                      type="button"
                      className="base-dash__dept"
                      onClick={() => setSelectedDepartment(dept.name)}
                    >
                      {dept.samplePhoto ? (
                        <img src={dept.samplePhoto} alt="" className="base-dash__dept-photo" />
                      ) : (
                        <span className="base-dash__dept-photo base-dash__dept-photo--empty" aria-hidden>
                          🚓
                        </span>
                      )}
                      <span className="base-dash__dept-text">
                        <strong>{dept.name}</strong>
                        <span>
                          {dept.available}/{dept.total} disponíveis · {LABEL_BY_UNIT_TYPE[dept.unitType]}
                        </span>
                      </span>
                      <span className="base-dash__dept-chevron" aria-hidden>
                        ›
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      {selectedDepartment && (
        <div className="base-dash__section base-dash__section--units">
          {departmentUnits.length === 0 ? (
            <p className="base-dash__empty">Nenhuma viatura neste departamento.</p>
          ) : (
            <ul className="base-dash__unit-list">
              {departmentUnits.map((unit) => (
                <RosterUnitRow
                  key={unit.id}
                  unit={unit}
                  draftActive={draftActive}
                  onAddToDraft={onAddToDraft}
                  onSelectUnit={onSelectUnit}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

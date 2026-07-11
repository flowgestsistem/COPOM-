import type { CityBase } from '../types/city';
import type { Unit } from '../types/game';
import { BASE_PHOTOS } from '../data/basePhotos';
import { baseDistanceLabel, reallocatableBases } from '../lib/unitMissions';

export function BasePickerSheet({
  unit,
  bases,
  onPick,
  onClose,
}: {
  unit: Unit;
  bases: CityBase[];
  onPick: (base: CityBase) => void;
  onClose: () => void;
}) {
  const options = reallocatableBases(bases, unit);

  return (
    <div className="unit-action-menu unit-action-menu--sheet" role="dialog" aria-label="Realocar batalhão">
      <header className="unit-action-menu__header">
        <div className="unit-action-menu__titles">
          <span className="unit-action-menu__kicker">Realocar</span>
          <strong>{unit.label}</strong>
          <span className="unit-action-menu__status">Selecione o batalhão de destino</span>
        </div>
        <button type="button" className="unit-action-menu__close" onClick={onClose} aria-label="Fechar">
          ×
        </button>
      </header>

      {options.length === 0 ? (
        <p className="unit-action-menu__hint">Nenhuma base compatível encontrada.</p>
      ) : (
        <ul className="unit-action-menu__list">
          {options.map((base) => {
            const photo = BASE_PHOTOS[base.id];
            return (
              <li key={base.id}>
                <button type="button" className="unit-action-menu__item" onClick={() => onPick(base)}>
                  {photo ? (
                    <img src={photo} alt="" className="unit-action-menu__base-photo" />
                  ) : (
                    <span className="unit-action-menu__icon" aria-hidden>
                      🏛
                    </span>
                  )}
                  <span className="unit-action-menu__text">
                    <strong>{base.name}</strong>
                    <span>{baseDistanceLabel(unit.position, base.location)} da posição atual</span>
                  </span>
                  <span className="unit-action-menu__chevron" aria-hidden>
                    ›
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

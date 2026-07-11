import type { Unit } from '../types/game';
import { LABEL_BY_UNIT_STATUS } from '../lib/labels';

export type UnitActionId =
  | 'deslocar'
  | 'realocar'
  | 'patrulha'
  | 'ponto_estrategico'
  | 'apoio';

const ACTIONS: { id: UnitActionId; title: string; description: string; icon: string }[] = [
  {
    id: 'deslocar',
    title: 'Deslocar',
    description: 'Escolha um ponto no mapa e envie a viatura',
    icon: '→',
  },
  {
    id: 'realocar',
    title: 'Realocar batalhão',
    description: 'Transfere a viatura para outro batalhão/base',
    icon: '⇄',
  },
  {
    id: 'patrulha',
    title: 'Iniciar patrulhamento',
    description: 'Circuito de patrulha na área atual',
    icon: '↻',
  },
  {
    id: 'ponto_estrategico',
    title: 'Ponto estratégico',
    description: 'Fixa a viatura e fiscaliza conforme a especialidade',
    icon: '◎',
  },
  {
    id: 'apoio',
    title: 'Apoio em ocorrência',
    description: 'Código 2 ou 3 para ocorrência em andamento',
    icon: '✕',
  },
];

export function UnitActionMenu({
  unit,
  onAction,
  onClose,
}: {
  unit: Unit;
  onAction: (action: UnitActionId) => void;
  onClose: () => void;
}) {
  const free = unit.status === 'disponivel';

  return (
    <div className="unit-action-menu" role="dialog" aria-label={`Ações · ${unit.label}`}>
      <header className="unit-action-menu__header">
        {unit.photoUrl && <img src={unit.photoUrl} alt="" className="unit-action-menu__photo" />}
        <div className="unit-action-menu__titles">
          <span className="unit-action-menu__kicker">{unit.department}</span>
          <strong>{unit.label}</strong>
          <span className="unit-action-menu__status">{LABEL_BY_UNIT_STATUS[unit.status]}</span>
        </div>
        <button type="button" className="unit-action-menu__close" onClick={onClose} aria-label="Fechar">
          ×
        </button>
      </header>

      {!free && (
        <p className="unit-action-menu__hint">Unidade em serviço — ações disponíveis apenas quando disponível.</p>
      )}

      <ul className="unit-action-menu__list">
        {ACTIONS.map((action) => (
          <li key={action.id}>
            <button
              type="button"
              className="unit-action-menu__item"
              disabled={!free}
              onClick={() => onAction(action.id)}
            >
              <span className="unit-action-menu__icon" aria-hidden>
                {action.icon}
              </span>
              <span className="unit-action-menu__text">
                <strong>{action.title}</strong>
                <span>{action.description}</span>
              </span>
              <span className="unit-action-menu__chevron" aria-hidden>
                ›
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

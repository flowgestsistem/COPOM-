import type { CivilCase } from '../types/game';
import { civilStatusLabel } from '../lib/civilPolice';

type TabId = 'investigacao' | 'bo' | 'prisoes' | 'todos';

export function CivilPolicePanel({
  cases,
  activeTab,
  onTabChange,
  onFocusCase,
}: {
  cases: CivilCase[];
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  onFocusCase: (caseId: string) => void;
}) {
  const open = cases.filter((c) => c.status !== 'concluido');
  const withBo = cases.filter((c) => !!c.boNumber);
  const withArrest = cases.filter((c) => c.arrestCount > 0);
  const investigating = cases.filter(
    (c) => c.status === 'em_investigacao' || c.status === 'bo_em_andamento' || c.status === 'no_local'
  );

  const list =
    activeTab === 'investigacao'
      ? investigating
      : activeTab === 'bo'
        ? withBo
        : activeTab === 'prisoes'
          ? withArrest
          : open.length > 0
            ? open
            : cases.slice(0, 20);

  const counts = {
    todos: open.length,
    investigacao: investigating.length,
    bo: withBo.filter((c) => c.status !== 'concluido').length,
    prisoes: withArrest.length,
  };

  return (
    <aside className="civil-panel">
      <header className="civil-panel__header">
        <div>
          <span className="civil-panel__kicker">Polícia Civil</span>
          <h2>Investigação</h2>
        </div>
        <span className="civil-panel__count">{counts.todos}</span>
      </header>

      <div className="civil-panel__tabs" role="tablist">
        {(
          [
            ['todos', 'Ativos', counts.todos],
            ['investigacao', 'Investigação', counts.investigacao],
            ['bo', 'B.O.', counts.bo],
            ['prisoes', 'Prisões', counts.prisoes],
          ] as const
        ).map(([id, label, n]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={activeTab === id}
            className={`civil-panel__tab${activeTab === id ? ' is-active' : ''}`}
            onClick={() => onTabChange(id)}
          >
            {label}
            <em>{n}</em>
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <div className="civil-panel__empty">
          <strong>Nenhum registro</strong>
          <p>
            {activeTab === 'prisoes'
              ? 'Prisões aparecerão quando houver condução pela PC.'
              : activeTab === 'bo'
                ? 'Boletins de ocorrência serão gerados ao fim da investigação.'
                : 'Casos que exigem PC aparecem aqui automaticamente.'}
          </p>
        </div>
      ) : (
        <ul className="civil-panel__list">
          {list.map((c) => (
            <li key={c.id}>
              <button type="button" className={`civil-card civil-card--${c.status}`} onClick={() => onFocusCase(c.id)}>
                <div className="civil-card__top">
                  <strong>{c.title}</strong>
                  <span className={`civil-card__badge civil-card__badge--${c.status}`}>
                    {civilStatusLabel(c.status)}
                  </span>
                </div>
                {c.boNumber && (
                  <p className="civil-card__bo">
                    <span>B.O.</span> {c.boNumber}
                  </p>
                )}
                <div className="civil-card__meta">
                  {c.unitLabel ? <span>{c.unitLabel}</span> : <span>Sem viatura designada</span>}
                  {c.evidenceCollected && <span className="civil-card__tag">Provas</span>}
                  {c.arrestCount > 0 && (
                    <span className="civil-card__tag civil-card__tag--arrest">
                      {c.arrestCount} prisão{c.arrestCount > 1 ? 'ões' : ''}
                    </span>
                  )}
                </div>
                {c.notes.length > 0 && (
                  <p className="civil-card__note">{c.notes[c.notes.length - 1]}</p>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}

export type CivilPoliceTab = TabId;

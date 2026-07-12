import { useMemo, useState } from 'react';
import type { CivilCase } from '../types/game';
import { civilStatusLabel } from '../lib/civilPolice';

type TabId = 'investigacao' | 'bo' | 'prisoes' | 'todos';

function timeAgo(ts: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}min`;
  return `${Math.floor(m / 60)}h`;
}

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
  const [query, setQuery] = useState('');

  const open = cases.filter((c) => c.status !== 'concluido');
  const withBo = cases.filter((c) => !!c.boNumber);
  const withArrest = cases.filter((c) => c.arrestCount > 0);
  const investigating = cases.filter(
    (c) => c.status === 'em_investigacao' || c.status === 'bo_em_andamento' || c.status === 'no_local'
  );

  const counts = {
    todos: open.length,
    investigacao: investigating.length,
    bo: withBo.filter((c) => c.status !== 'concluido').length,
    prisoes: withArrest.length,
    done: cases.filter((c) => c.status === 'concluido').length,
  };

  const baseList =
    activeTab === 'investigacao'
      ? investigating
      : activeTab === 'bo'
        ? withBo
        : activeTab === 'prisoes'
          ? withArrest
          : open.length > 0
            ? open
            : cases.slice(0, 20);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return baseList;
    return baseList.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        (c.boNumber ?? '').toLowerCase().includes(q) ||
        (c.unitLabel ?? '').toLowerCase().includes(q) ||
        c.notes.some((n) => n.toLowerCase().includes(q))
    );
  }, [baseList, query]);

  return (
    <div className="central-modal central-modal--civil">
      <header className="central-modal__hero central-modal__hero--civil">
        <div className="central-modal__hero-glow central-modal__hero-glow--violet" aria-hidden />
        <div className="central-modal__hero-top">
          <div>
            <span className="central-modal__live central-modal__live--violet">
              <i />
              PC
            </span>
            <span className="central-modal__kicker central-modal__kicker--violet">Polícia Civil</span>
            <h2 className="central-modal__title">Investigação & B.O.</h2>
          </div>
          <div className="central-modal__counter central-modal__counter--violet" title="Casos ativos">
            <strong>{counts.todos}</strong>
            <span>ativos</span>
          </div>
        </div>

        <div className="central-modal__stats">
          <div className="central-modal__stat">
            <em>{counts.investigacao}</em>
            <span>Investigando</span>
          </div>
          <div className="central-modal__stat">
            <em>{counts.bo}</em>
            <span>B.O.</span>
          </div>
          <div className={`central-modal__stat${counts.prisoes > 0 ? ' is-alert' : ''}`}>
            <em>{counts.prisoes}</em>
            <span>Prisões</span>
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
            placeholder="Buscar caso, B.O., viatura…"
            autoComplete="off"
          />
          {query && (
            <button type="button" className="central-modal__search-clear" onClick={() => setQuery('')}>
              ×
            </button>
          )}
        </label>

        <div className="central-modal__filters" role="tablist" aria-label="Filtrar casos PC">
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
              className={`central-modal__chip central-modal__chip--civil${activeTab === id ? ' is-active' : ''}`}
              onClick={() => onTabChange(id)}
            >
              <span>{label}</span>
              <em>{n}</em>
            </button>
          ))}
        </div>
      </div>

      <div className="central-modal__body">
        {list.length === 0 ? (
          <div className="central-modal__empty">
            <div className="central-modal__radar central-modal__radar--violet" aria-hidden>
              <span />
              <span />
              <span />
            </div>
            <strong>Nenhum registro</strong>
            <p>
              {activeTab === 'prisoes'
                ? 'Prisões aparecem quando houver condução pela Polícia Civil.'
                : activeTab === 'bo'
                  ? 'Boletins são gerados ao concluir a investigação no local.'
                  : query
                    ? 'Nenhum caso corresponde à busca.'
                    : 'Casos que exigem PC entram aqui automaticamente.'}
            </p>
          </div>
        ) : (
          <ul className="central-modal__list">
            {list.map((c, index) => (
              <li key={c.id} style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}>
                <button
                  type="button"
                  className={`cm-card cm-card--civil cm-card--${c.status}`}
                  onClick={() => onFocusCase(c.id)}
                >
                  <div className="cm-card__priority-bar cm-card__priority-bar--violet" aria-hidden />
                  <header className="cm-card__head">
                    <span className="cm-card__icon cm-card__icon--civil" aria-hidden>
                      ⚖
                    </span>
                    <div className="cm-card__titles">
                      <div className="cm-card__title-row">
                        <strong>{c.title}</strong>
                        <span className={`cm-card__badge cm-card__badge--${c.status}`}>
                          {civilStatusLabel(c.status)}
                        </span>
                      </div>
                      <span className="cm-card__meta">
                        {c.boNumber ? (
                          <span className="cm-card__protocol">B.O. {c.boNumber}</span>
                        ) : (
                          <span>Sem B.O. ainda</span>
                        )}
                        <span className="cm-card__ago">{timeAgo(c.updatedAt || c.createdAt)}</span>
                      </span>
                    </div>
                  </header>

                  <div className="cm-card__badges">
                    {c.unitLabel ? (
                      <span className="cm-card__badge cm-card__badge--soft">{c.unitLabel}</span>
                    ) : (
                      <span className="cm-card__badge cm-card__badge--danger">Sem viatura</span>
                    )}
                    {c.evidenceCollected && (
                      <span className="cm-card__badge cm-card__badge--soft">Provas</span>
                    )}
                    {c.arrestCount > 0 && (
                      <span className="cm-card__badge cm-card__badge--danger">
                        {c.arrestCount} prisão{c.arrestCount > 1 ? 'ões' : ''}
                      </span>
                    )}
                  </div>

                  {c.notes.length > 0 && (
                    <p className="cm-card__desc cm-card__desc--note">{c.notes[c.notes.length - 1]}</p>
                  )}

                  <footer className="cm-card__footer">
                    <span>Focar no mapa</span>
                    <span className="cm-card__chevron" aria-hidden>
                      ›
                    </span>
                  </footer>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export type CivilPoliceTab = TabId;

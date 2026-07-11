export function StartScreen({ onStart }: { onStart: () => void }) {
  return (
    <div className="start-screen">
      <div className="start-screen__backdrop" aria-hidden />

      <div className="start-screen__shell">
        <aside className="start-screen__rail" aria-hidden>
          <div className="start-screen__rail-mark">
            <span className="start-screen__rail-dot" />
            <span className="start-screen__rail-line" />
            <span className="start-screen__rail-dot" />
          </div>
          <span className="start-screen__rail-text">SISTEMA OPERACIONAL · UDI</span>
        </aside>

        <div className="start-screen__panel">
          <header className="start-screen__header">
            <div className="start-screen__brand">
              <div className="start-screen__badge" aria-hidden>
                <svg viewBox="0 0 32 32" className="start-screen__badge-icon">
                  <path
                    d="M16 3L5 8v8c0 7.2 4.8 13.4 11 15 6.2-1.6 11-7.8 11-15V8L16 3z"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M16 10v8M12.5 14h7"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <div>
                <span className="start-screen__kicker">Centro de operações</span>
                <h1 className="start-screen__title">
                  COPOM <span className="start-screen__title-sep">/</span> COBOM
                </h1>
                <p className="start-screen__subtitle">Uberlândia · Minas Gerais</p>
              </div>
            </div>
          </header>

          <div className="start-screen__body">
            <p className="start-screen__lead">
              Você assume o posto de operador. Monitore o mapa, atenda chamadas e despache
              unidades em tempo real pela cidade.
            </p>

            <ul className="start-screen__features">
              <li>
                <span className="start-screen__feat-icon" aria-hidden>
                  <svg viewBox="0 0 20 20" fill="none">
                    <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M10 6v4l2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </span>
                <div>
                  <strong>Ocorrências em tempo real</strong>
                  <span>Chamadas e prioridades no painel de despacho</span>
                </div>
              </li>
              <li>
                <span className="start-screen__feat-icon" aria-hidden>
                  <svg viewBox="0 0 20 20" fill="none">
                    <path
                      d="M3 14l4-4 3 3 7-8"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <div>
                  <strong>Frota e batalhões</strong>
                  <span>Viaturas por departamento, missões e apoio</span>
                </div>
              </li>
              <li>
                <span className="start-screen__feat-icon" aria-hidden>
                  <svg viewBox="0 0 20 20" fill="none">
                    <rect x="3" y="4" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M3 8h14M8 4v12" stroke="currentColor" strokeWidth="1.5" />
                  </svg>
                </span>
                <div>
                  <strong>Operações táticas</strong>
                  <span>Blitz, mandado, patrulha e ponto estratégico</span>
                </div>
              </li>
            </ul>
          </div>

          <footer className="start-screen__footer">
            <div className="start-screen__meta">
              <span>Modo simulação</span>
              <span className="start-screen__meta-dot" />
              <span>Mapa Uberlândia</span>
            </div>
            <button type="button" className="start-screen__cta" onClick={onStart}>
              <span>Iniciar plantão</span>
              <svg viewBox="0 0 20 20" fill="none" aria-hidden>
                <path
                  d="M4 10h11M11 5l5 5-5 5"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </footer>
        </div>
      </div>
    </div>
  );
}

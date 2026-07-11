import { useEffect, useMemo, useRef, useState } from 'react';
import type { Incident, Unit } from '../types/game';
import {
  askFreeText,
  askScriptedQuestion,
  buildPostInterviewActions,
  completeInterview,
  interviewProgress,
  speakerRoleLabel,
  type InterviewSession,
  type PostInterviewAction,
  type PostInterviewActionId,
} from '../lib/sceneInterview';

export function SceneInterviewPanel({
  unit,
  incident,
  session,
  onSessionChange,
  onFinishApuracao,
  onPostAction,
  onClose,
}: {
  unit: Unit;
  incident: Incident;
  session: InterviewSession;
  onSessionChange: (next: InterviewSession) => void;
  onFinishApuracao: (session: InterviewSession) => void;
  onPostAction: (actionId: PostInterviewActionId) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState('');
  const [phase, setPhase] = useState<'dialogo' | 'acoes'>(
    session.complete ? 'acoes' : 'dialogo'
  );
  const scroller = useRef<HTMLDivElement>(null);
  const progress = interviewProgress(session);

  useEffect(() => {
    if (session.complete) setPhase('acoes');
  }, [session.complete]);

  const unusedQuestions = useMemo(
    () => session.questions.filter((q) => !session.revealedFactIds.includes(q.factId)),
    [session.questions, session.revealedFactIds]
  );

  const postActions = useMemo(
    () => (phase === 'acoes' ? buildPostInterviewActions(incident, session) : []),
    [phase, incident, session]
  );

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [session.messages.length, phase]);

  function sendFree() {
    const text = draft.trim();
    if (!text || session.complete) return;
    onSessionChange(askFreeText(session, text));
    setDraft('');
  }

  function ask(qId: string) {
    if (session.complete) return;
    onSessionChange(askScriptedQuestion(session, qId));
  }

  function finish() {
    const done = completeInterview(session);
    onSessionChange(done);
    onFinishApuracao(done);
    setPhase('acoes');
  }

  return (
    <div className="scene-interview" role="dialog" aria-label="Apuração no local">
      <header className="scene-interview__header">
        {unit.photoUrl && (
          <img src={unit.photoUrl} alt="" className="scene-interview__unit-photo" />
        )}
        <div className="scene-interview__titles">
          <span className="scene-interview__kicker">Apuração no local</span>
          <strong>{unit.label}</strong>
          <span className="scene-interview__meta">
            {incident.title}
            {' · '}
            {speakerRoleLabel(session.speakerRole)}: {session.speakerName}
          </span>
        </div>
        <button type="button" className="scene-interview__close" onClick={onClose} aria-label="Fechar">
          ×
        </button>
      </header>

      <div className="scene-interview__progress" aria-label="Progresso da apuração">
        <div className="scene-interview__progress-bar">
          <span
            style={{
              width: `${Math.min(100, (progress.revealed / Math.max(1, progress.total)) * 100)}%`,
            }}
          />
        </div>
        <span>
          Fatos apurados: {progress.revealed}/{progress.total}
          {progress.ready && phase === 'dialogo' ? ' · pode encerrar' : ''}
        </span>
      </div>

      {phase === 'dialogo' && (
        <>
          <div className="scene-interview__chat" ref={scroller}>
            {session.messages.map((m) => (
              <div
                key={m.id}
                className={`scene-interview__bubble scene-interview__bubble--${m.from}`}
              >
                <span className="scene-interview__who">
                  {m.from === 'guarnicao' ? unit.label : session.speakerName}
                </span>
                <p>{m.text}</p>
              </div>
            ))}
          </div>

          {session.summary.length > 0 && (
            <div className="scene-interview__facts">
              <h4>Caderno de fatos</h4>
              <ul>
                {session.summary.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </div>
          )}

          {unusedQuestions.length > 0 && (
            <div className="scene-interview__presets">
              <span className="scene-interview__presets-label">Perguntas sugeridas</span>
              <div className="scene-interview__chips">
                {unusedQuestions.slice(0, 6).map((q) => (
                  <button key={q.id} type="button" className="scene-interview__chip" onClick={() => ask(q.id)}>
                    {q.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <form
            className="scene-interview__composer"
            onSubmit={(e) => {
              e.preventDefault();
              sendFree();
            }}
          >
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Digite livremente (estilo Emergency 4)…"
              maxLength={280}
              autoComplete="off"
            />
            <button type="submit" disabled={!draft.trim()}>
              Enviar
            </button>
          </form>

          <footer className="scene-interview__footer">
            <button type="button" className="scene-interview__btn scene-interview__btn--ghost" onClick={onClose}>
              Minimizar
            </button>
            <button
              type="button"
              className="scene-interview__btn scene-interview__btn--primary"
              onClick={finish}
            >
              {progress.revealed === 0 ? 'Encerrar com poucos fatos' : 'Encerrar apuração e agir'}
            </button>
          </footer>
        </>
      )}

      {phase === 'acoes' && (
        <div className="scene-interview__post">
          <p className="scene-interview__post-lead">
            Apuração encerrada. Com base no que {session.speakerName} contou, escolha a próxima
            providência:
          </p>
          {session.summary.length > 0 && (
            <ul className="scene-interview__summary">
              {session.summary.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          )}
          <ul className="scene-interview__actions">
            {postActions.map((a: PostInterviewAction) => (
              <li key={a.id}>
                <button type="button" className="scene-interview__action" onClick={() => onPostAction(a.id)}>
                  <strong>{a.title}</strong>
                  <span>{a.description}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

import { useMemo } from 'react';
import type { CityBase } from '../types/city';
import type { Incident, Unit } from '../types/game';
import { hospitalBases, formatDistance } from '../lib/dispatch';
import { haversineDistanceMeters } from '../lib/geo';
import { LABEL_BY_UNIT_STATUS } from '../lib/labels';
import { buildSceneActions, type SceneAction } from '../lib/sceneActions';

export type PoliceDecisionAction =
  | 'delegacia'
  | 'liberar'
  | 'hospital'
  | 'encerrar';

export type CivilDecisionAction =
  | 'concluir_bo'
  | 'prisao'
  | 'provas'
  | 'arquivar';

export type DispositionAction = 'retornar' | 'deslocar';

export function UnitDecisionSheet({
  unit,
  bases,
  incident,
  allUnits,
  onHospital,
  onPoliceAction,
  onCivilAction,
  onDisposition,
  onSceneAction,
  onClose,
}: {
  unit: Unit;
  bases: CityBase[];
  /** Ocorrência ligada (necessário para menu de chegada contextual). */
  incident?: Incident | null;
  /** Todas as unidades (para multi-equipe: reforço a caminho / no local). */
  allUnits?: Unit[];
  onHospital: (hospitalBaseId: string) => void;
  onPoliceAction: (action: PoliceDecisionAction) => void;
  onCivilAction?: (action: CivilDecisionAction) => void;
  onDisposition?: (action: DispositionAction) => void;
  onSceneAction?: (action: SceneAction) => void;
  onClose: () => void;
}) {
  const hospitals = useMemo(() => {
    return hospitalBases(bases)
      .map((h) => ({ base: h, distanceMeters: haversineDistanceMeters(unit.position, h.location) }))
      .sort((a, b) => a.distanceMeters - b.distanceMeters)
      .slice(0, 12);
  }, [bases, unit.position]);

  const enRoutePeers = useMemo(() => {
    if (!incident || !allUnits) return [] as Unit[];
    return allUnits.filter(
      (u) =>
        u.id !== unit.id &&
        u.assignedIncidentId === incident.id &&
        u.status === 'a_caminho'
    );
  }, [allUnits, incident, unit.id]);

  const onScenePeers = useMemo(() => {
    if (!incident || !allUnits) return [] as Unit[];
    return allUnits.filter(
      (u) =>
        u.id !== unit.id &&
        u.assignedIncidentId === incident.id &&
        (u.status === 'no_local' ||
          u.status === 'aguardando_decisao' ||
          u.status === 'em_operacao')
    );
  }, [allUnits, incident, unit.id]);

  const onSceneForActions =
    !!incident &&
    unit.assignedIncidentId === incident.id &&
    (unit.status === 'no_local' ||
      unit.status === 'em_operacao' ||
      unit.status === 'aguardando_decisao') &&
    unit.pendingDecision !== 'hospital' &&
    unit.pendingDecision !== 'policia' &&
    unit.pendingDecision !== 'civil' &&
    unit.pendingDecision !== 'disposicao';

  const isSceneMenu =
    unit.pendingDecision === 'chegada' ||
    unit.pendingDecision === 'acoes_local' ||
    (onSceneForActions && !unit.pendingDecision);

  const sceneActions = useMemo(() => {
    if (!isSceneMenu || !incident) return [];
    return buildSceneActions(incident, unit, {
      enRouteUnits: enRoutePeers,
      onSceneUnits: onScenePeers,
    });
  }, [unit, incident, enRoutePeers, onScenePeers, isSceneMenu]);

  const isArrival = isSceneMenu;
  const isHospital = unit.pendingDecision === 'hospital';
  const isPolice = unit.pendingDecision === 'policia';
  const isCivil = unit.pendingDecision === 'civil';
  const isDisposition = unit.pendingDecision === 'disposicao';
  const busy = !!(unit.serviceEndsAt && unit.serviceEndsAt > Date.now());
  const queue = unit.actionQueue ?? [];

  const kicker = isArrival
    ? busy
      ? 'Guarnição no local · enfileirar ações'
      : enRoutePeers.length > 0 || onScenePeers.length > 0
        ? 'Guarnição no local · multi-equipe'
        : 'Guarnição no local · ações'
    : isCivil
      ? 'Polícia Civil — decisão'
      : isDisposition
        ? 'Disposição da viatura'
        : 'Atendimento concluído';

  return (
    <div className="unit-decision" role="dialog" aria-label="Ações da guarnição">
      <header className="unit-decision__header">
        {unit.photoUrl && <img src={unit.photoUrl} alt="" className="unit-decision__photo" />}
        <div className="unit-decision__titles">
          <span className="unit-decision__kicker">{kicker}</span>
          <strong>{unit.label}</strong>
          <span className="unit-decision__status">
            {unit.pendingIncidentTitle ?? LABEL_BY_UNIT_STATUS[unit.status]}
          </span>
          {isArrival && incident && (
            <span className="unit-decision__occ-type">
              {incident.type === 'policia' ? 'Policial' : incident.type === 'incendio' ? 'Bombeiros' : 'Médica'}
              {incident.zone ? ` · ${incident.zone}` : ''}
            </span>
          )}
        </div>
        <button type="button" className="unit-decision__close" onClick={onClose} aria-label="Fechar">
          ×
        </button>
      </header>

      {isArrival && onSceneAction && (
        <div className="unit-decision__body">
          <p className="unit-decision__lead">
            {busy
              ? 'Equipe em serviço. Clique em mais ações para enfileirar — quando terminar uma, inicia a próxima.'
              : queue.length > 0
                ? 'Próximas ações na fila serão executadas em sequência. Pode adicionar mais:'
                : 'Escolha a ação no local. Pode enfileirar várias em sequência:'}
          </p>
          {incident && (
            <p className="unit-decision__context">{incident.description}</p>
          )}
          {busy && unit.serviceRoleLabel && (
            <p className="unit-decision__now">
              <strong>Agora:</strong> {unit.serviceRoleLabel}
            </p>
          )}
          {queue.length > 0 && (
            <div className="unit-decision__queue">
              <span className="unit-decision__queue-label">Fila ({queue.length})</span>
              <ol>
                {queue.map((q, i) => (
                  <li key={`${q.id}-${i}`}>
                    {i + 1}. {q.title}
                  </li>
                ))}
              </ol>
            </div>
          )}
          {(enRoutePeers.length > 0 || onScenePeers.length > 0) && (
            <div className="unit-decision__peers">
              {onScenePeers.length > 0 && (
                <p className="unit-decision__peer-line">
                  <strong>No local:</strong> {onScenePeers.map((p) => p.label).join(', ')} — vão
                  compartilhar o atendimento.
                </p>
              )}
              {enRoutePeers.length > 0 && (
                <p className="unit-decision__peer-line unit-decision__peer-line--enroute">
                  <strong>A caminho:</strong> {enRoutePeers.map((p) => p.label).join(', ')} — a
                  guarnição sabe do reforço e se organiza na chegada.
                </p>
              )}
            </div>
          )}
          <ul className="unit-decision__actions">
            {sceneActions.map((action) => (
              <li key={action.id}>
                <button
                  type="button"
                  className="unit-decision__action"
                  onClick={() => onSceneAction(action)}
                >
                  <strong>
                    {busy ? '＋ ' : ''}
                    {action.title}
                  </strong>
                  <span>
                    {busy ? 'Enfileirar · ' : ''}
                    {action.description}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {isHospital && (
        <div className="unit-decision__body">
          <p className="unit-decision__lead">Selecione o hospital / UAI para transportar a vítima.</p>
          {hospitals.length === 0 ? (
            <p className="unit-decision__empty">Nenhum hospital cadastrado na base de dados.</p>
          ) : (
            <ul className="unit-decision__list">
              {hospitals.map(({ base, distanceMeters }) => (
                <li key={base.id}>
                  <button type="button" className="unit-decision__item" onClick={() => onHospital(base.id)}>
                    <span className="unit-decision__item-text">
                      <strong>{base.name}</strong>
                      <span>{formatDistance(distanceMeters)}</span>
                    </span>
                    <span className="unit-decision__item-go">Levar</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {isPolice && (
        <div className="unit-decision__body">
          <p className="unit-decision__lead">Escolha a ação referente a esta ocorrência.</p>
          <ul className="unit-decision__actions">
            <li>
              <button type="button" className="unit-decision__action" onClick={() => onPoliceAction('delegacia')}>
                <strong>Conduzir à delegacia</strong>
                <span>Preso / conduzido para a delegacia civil</span>
              </button>
            </li>
            <li>
              <button type="button" className="unit-decision__action" onClick={() => onPoliceAction('hospital')}>
                <strong>Encaminhar a hospital</strong>
                <span>Vítima ou envolvido necessita atendimento médico</span>
              </button>
            </li>
            <li>
              <button type="button" className="unit-decision__action" onClick={() => onPoliceAction('liberar')}>
                <strong>Liberar no local</strong>
                <span>Sem condução — encerra atendimento</span>
              </button>
            </li>
            <li>
              <button type="button" className="unit-decision__action" onClick={() => onPoliceAction('encerrar')}>
                <strong>Encerrar ocorrência</strong>
                <span>Providências no local concluídas</span>
              </button>
            </li>
          </ul>
        </div>
      )}

      {isCivil && onCivilAction && (
        <div className="unit-decision__body">
          <p className="unit-decision__lead">Ações da Polícia Civil neste caso.</p>
          <ul className="unit-decision__actions">
            <li>
              <button type="button" className="unit-decision__action" onClick={() => onCivilAction('concluir_bo')}>
                <strong>Concluir B.O.</strong>
                <span>Finaliza o boletim e libera as equipes</span>
              </button>
            </li>
            <li>
              <button type="button" className="unit-decision__action" onClick={() => onCivilAction('prisao')}>
                <strong>Efetuar prisão / condução</strong>
                <span>Registra prisão e conduz à delegacia</span>
              </button>
            </li>
            <li>
              <button type="button" className="unit-decision__action" onClick={() => onCivilAction('provas')}>
                <strong>Coleta de provas concluída</strong>
                <span>Mantém B.O. e encerra no local</span>
              </button>
            </li>
            <li>
              <button type="button" className="unit-decision__action" onClick={() => onCivilAction('arquivar')}>
                <strong>Arquivar / sem indícios</strong>
                <span>Encerra o caso sem prisão</span>
              </button>
            </li>
          </ul>
        </div>
      )}

      {isDisposition && onDisposition && (
        <div className="unit-decision__body">
          <p className="unit-decision__lead">Para onde esta viatura deve ir agora?</p>
          <ul className="unit-decision__actions">
            <li>
              <button type="button" className="unit-decision__action" onClick={() => onDisposition('retornar')}>
                <strong>Retornar à base</strong>
                <span>Volta ao batalhão / delegacia de origem</span>
              </button>
            </li>
            <li>
              <button type="button" className="unit-decision__action" onClick={() => onDisposition('deslocar')}>
                <strong>Deslocar para outro ponto</strong>
                <span>Clique no mapa o próximo destino</span>
              </button>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}

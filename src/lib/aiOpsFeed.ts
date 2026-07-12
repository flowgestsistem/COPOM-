/**
 * Eventos da IA tática para o operador acompanhar sem intervir.
 */

export type AiOpsKind =
  | 'chegada'
  | 'plano'
  | 'acao'
  | 'resultado'
  | 'retorno_base'
  | 'conduzindo_preso'
  | 'hospital'
  | 'info';

export interface AiOpsEvent {
  id: string;
  at: number;
  kind: AiOpsKind;
  unitId: string;
  unitLabel: string;
  unitType?: 'viatura' | 'bombeiro' | 'ambulancia';
  incidentTitle?: string;
  /** Texto principal para o operador. */
  message: string;
  /** Detalhe opcional (POP / ação). */
  detail?: string;
  /** Destaque visual (retorno / prisão). */
  important?: boolean;
}

export function makeAiOpsEvent(
  partial: Omit<AiOpsEvent, 'id' | 'at'> & { id?: string; at?: number }
): AiOpsEvent {
  return {
    id: partial.id ?? `ai-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    at: partial.at ?? Date.now(),
    kind: partial.kind,
    unitId: partial.unitId,
    unitLabel: partial.unitLabel,
    unitType: partial.unitType,
    incidentTitle: partial.incidentTitle,
    message: partial.message,
    detail: partial.detail,
    important: partial.important,
  };
}

export function formatReturnMessage(unitLabel: string, unitType: string, withPrisoner: boolean): string {
  if (withPrisoner) {
    return `${unitLabel} (PM) finalizou no local e está conduzindo preso à delegacia.`;
  }
  if (unitType === 'bombeiro' || unitType === 'ambulancia') {
    return `${unitLabel} (Bombeiros) finalizou o atendimento e está retornando à base.`;
  }
  return `${unitLabel} (PM) finalizou o atendimento e está retornando à base.`;
}

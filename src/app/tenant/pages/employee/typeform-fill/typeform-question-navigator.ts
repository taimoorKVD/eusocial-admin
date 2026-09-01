import { ConditionalFieldEffects } from '../../../../shared/conditional-logic';
import { sortDynamicFields } from '../../../../shared/dynamic-form/dynamic-form.builder';
import { DynamicField } from '../../../../interfaces/dynamic-field';

export type TypeformPhase = 'questions' | 'review';

export interface TypeformNavigationState {
  phase: TypeformPhase;
  activeQuestionIndex: number;
  visibleQuestionIds: string[];
  activeFieldId: string | null;
}

export function buildVisibleQuestionIds(
  fields: DynamicField[],
  effects: Record<string, ConditionalFieldEffects>,
): string[] {
  return sortDynamicFields(fields)
    .filter((field) => {
      const effect = effects[field.id];
      return effect ? effect.visible : field.isShow !== false;
    })
    .map((field) => field.id);
}

export function createInitialNavigationState(
  fields: DynamicField[],
  effects: Record<string, ConditionalFieldEffects>,
): TypeformNavigationState {
  const visibleQuestionIds = buildVisibleQuestionIds(fields, effects);

  return {
    phase: visibleQuestionIds.length ? 'questions' : 'review',
    activeQuestionIndex: 0,
    visibleQuestionIds,
    activeFieldId: visibleQuestionIds[0] ?? null,
  };
}

export function clampQuestionIndex(index: number, queueLength: number): number {
  if (queueLength <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(index, queueLength - 1));
}

export function resolveActiveFieldId(
  visibleQuestionIds: readonly string[],
  activeQuestionIndex: number,
): string | null {
  return visibleQuestionIds[activeQuestionIndex] ?? null;
}

export function rebuildNavigationState(
  current: TypeformNavigationState,
  fields: DynamicField[],
  effects: Record<string, ConditionalFieldEffects>,
): TypeformNavigationState {
  if (current.phase === 'review') {
    return {
      ...current,
      visibleQuestionIds: buildVisibleQuestionIds(fields, effects),
    };
  }

  const visibleQuestionIds = buildVisibleQuestionIds(fields, effects);

  if (!visibleQuestionIds.length) {
    return {
      phase: 'review',
      activeQuestionIndex: 0,
      visibleQuestionIds,
      activeFieldId: null,
    };
  }

  const previousActiveId = current.activeFieldId;
  let activeQuestionIndex = previousActiveId
    ? visibleQuestionIds.indexOf(previousActiveId)
    : current.activeQuestionIndex;

  if (activeQuestionIndex === -1) {
    activeQuestionIndex = clampQuestionIndex(current.activeQuestionIndex, visibleQuestionIds.length);
  }

  activeQuestionIndex = clampQuestionIndex(activeQuestionIndex, visibleQuestionIds.length);

  return {
    phase: 'questions',
    activeQuestionIndex,
    visibleQuestionIds,
    activeFieldId: resolveActiveFieldId(visibleQuestionIds, activeQuestionIndex),
  };
}

export function advanceNavigationState(
  current: TypeformNavigationState,
  fields: DynamicField[],
  effects: Record<string, ConditionalFieldEffects>,
): TypeformNavigationState {
  const visibleQuestionIds = buildVisibleQuestionIds(fields, effects);

  if (!visibleQuestionIds.length) {
    return {
      phase: 'review',
      activeQuestionIndex: 0,
      visibleQuestionIds,
      activeFieldId: null,
    };
  }

  const activeQuestionIndex = clampQuestionIndex(
    current.activeQuestionIndex,
    visibleQuestionIds.length,
  );
  const activeFieldId = resolveActiveFieldId(visibleQuestionIds, activeQuestionIndex);
  const isLastQuestion = activeQuestionIndex >= visibleQuestionIds.length - 1;

  if (isLastQuestion) {
    return {
      phase: 'review',
      activeQuestionIndex,
      visibleQuestionIds,
      activeFieldId,
    };
  }

  const nextIndex = activeQuestionIndex + 1;

  return {
    phase: 'questions',
    activeQuestionIndex: nextIndex,
    visibleQuestionIds,
    activeFieldId: resolveActiveFieldId(visibleQuestionIds, nextIndex),
  };
}

export function retreatNavigationState(current: TypeformNavigationState): TypeformNavigationState {
  if (current.phase === 'review') {
    const lastIndex = Math.max(current.visibleQuestionIds.length - 1, 0);

    return {
      phase: current.visibleQuestionIds.length ? 'questions' : 'review',
      activeQuestionIndex: lastIndex,
      visibleQuestionIds: current.visibleQuestionIds,
      activeFieldId: resolveActiveFieldId(current.visibleQuestionIds, lastIndex),
    };
  }

  const nextIndex = Math.max(current.activeQuestionIndex - 1, 0);

  return {
    ...current,
    activeQuestionIndex: nextIndex,
    activeFieldId: resolveActiveFieldId(current.visibleQuestionIds, nextIndex),
  };
}

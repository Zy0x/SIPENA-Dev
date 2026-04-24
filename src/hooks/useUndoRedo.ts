import { useState, useCallback, useRef } from 'react';

interface UndoRedoState<T> {
  past: T[];
  present: T;
  future: T[];
}

interface UndoRedoActions<T> {
  set: (newPresent: T, actionName?: string) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  reset: (newPresent: T) => void;
  lastAction: string | null;
}

const MAX_HISTORY = 20;

export function useUndoRedo<T>(initialPresent: T): [T, UndoRedoActions<T>] {
  const [state, setState] = useState<UndoRedoState<T>>({
    past: [],
    present: initialPresent,
    future: [],
  });
  const lastActionRef = useRef<string | null>(null);

  const canUndo = state.past.length > 0;
  const canRedo = state.future.length > 0;

  const set = useCallback((newPresent: T, actionName?: string) => {
    setState((currentState) => {
      const { past, present } = currentState;
      if (newPresent === present) return currentState;
      
      const newPast = [...past, present].slice(-MAX_HISTORY);
      lastActionRef.current = actionName || null;
      
      return {
        past: newPast,
        present: newPresent,
        future: [],
      };
    });
  }, []);

  const undo = useCallback(() => {
    setState((currentState) => {
      const { past, present, future } = currentState;
      if (past.length === 0) return currentState;

      const previous = past[past.length - 1];
      const newPast = past.slice(0, past.length - 1);
      lastActionRef.current = 'undo';

      return {
        past: newPast,
        present: previous,
        future: [present, ...future].slice(0, MAX_HISTORY),
      };
    });
  }, []);

  const redo = useCallback(() => {
    setState((currentState) => {
      const { past, present, future } = currentState;
      if (future.length === 0) return currentState;

      const next = future[0];
      const newFuture = future.slice(1);
      lastActionRef.current = 'redo';

      return {
        past: [...past, present].slice(-MAX_HISTORY),
        present: next,
        future: newFuture,
      };
    });
  }, []);

  const reset = useCallback((newPresent: T) => {
    lastActionRef.current = null;
    setState({
      past: [],
      present: newPresent,
      future: [],
    });
  }, []);

  return [
    state.present,
    {
      set,
      undo,
      redo,
      canUndo,
      canRedo,
      reset,
      lastAction: lastActionRef.current,
    },
  ];
}

import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useMemo, useReducer } from 'react';
import { adventureReducer, INITIAL_ADVENTURE_SESSION, parseAdventureSession, type AdventureAction } from '../lib/adventureMachine';
import type { AdventureSession, ContinuationKind } from '../types';

export const ADVENTURE_STORAGE_KEY = 'bubble-breaker:v2:adventure-state:v1';

interface AdventureContextValue {
  state: AdventureSession;
  dispatch: React.Dispatch<AdventureAction>;
  chooseContinuation: (kind: ContinuationKind) => void;
  resetAdventure: () => void;
}

const AdventureContext = createContext<AdventureContextValue | null>(null);

function initialState(): AdventureSession {
  if (typeof window === 'undefined') return INITIAL_ADVENTURE_SESSION;
  return parseAdventureSession(window.localStorage.getItem(ADVENTURE_STORAGE_KEY));
}

export function AdventureProvider({ children }: PropsWithChildren) {
  const [state, dispatch] = useReducer(adventureReducer, undefined, initialState);

  useEffect(() => {
    window.localStorage.setItem(ADVENTURE_STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const chooseContinuation = useCallback((kind: ContinuationKind) => {
    dispatch({ type: 'CHOOSE_CONTINUATION', kind });
  }, []);
  const resetAdventure = useCallback(() => dispatch({ type: 'RESET' }), []);
  const value = useMemo(() => ({ state, dispatch, chooseContinuation, resetAdventure }), [state, chooseContinuation, resetAdventure]);

  return <AdventureContext.Provider value={value}>{children}</AdventureContext.Provider>;
}

export function useAdventure(): AdventureContextValue {
  const context = useContext(AdventureContext);
  if (!context) throw new Error('useAdventure must be used inside AdventureProvider');
  return context;
}

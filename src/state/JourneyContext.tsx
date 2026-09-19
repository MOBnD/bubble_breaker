import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from 'react';
import { getConnection } from '../data/topics';
import type { Journey, JourneyRuntimeState, PersistedJourneyState } from '../types';

export const STORAGE_KEY = 'bubble-breaker-v2:journeys:v1';

type JourneyAction =
  | { type: 'START'; topicId: string; demo: boolean; now?: string; id?: string }
  | { type: 'TRAVEL'; connectionId: string; now?: string }
  | { type: 'CONTINUE'; journeyId: string }
  | { type: 'ENTER_DEMO' }
  | { type: 'EXIT_DEMO' }
  | { type: 'CLEAR_HISTORY' };

const EMPTY_PERSISTED_STATE: PersistedJourneyState = {
  version: 1,
  journeys: [],
  activeJourneyId: null,
};

function makeId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `journey-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function createJourney(topicId: string, now = new Date().toISOString(), id = makeId()): Journey {
  return {
    id,
    startedAt: now,
    updatedAt: now,
    startTopicId: topicId,
    currentTopicId: topicId,
    steps: [{ topicId, bridgeLabels: [], surpriseScore: 0, discoveredAt: now }],
  };
}

function travel(journey: Journey, connectionId: string, now: string): Journey {
  const connection = getConnection(connectionId);
  if (connection.fromTopicId !== journey.currentTopicId) return journey;

  return {
    ...journey,
    currentTopicId: connection.toTopicId,
    updatedAt: now,
    steps: [
      ...journey.steps,
      {
        topicId: connection.toTopicId,
        fromTopicId: connection.fromTopicId,
        connectionId: connection.id,
        branchKind: connection.branchKind,
        bridgeLabels: connection.bridgeLabels,
        explanation: connection.explanation,
        surpriseScore: connection.surpriseScore,
        discoveredAt: now,
      },
    ],
  };
}

export function journeyReducer(state: JourneyRuntimeState, action: JourneyAction): JourneyRuntimeState {
  switch (action.type) {
    case 'START': {
      const journey = createJourney(action.topicId, action.now, action.id);
      if (action.demo) return { ...state, isDemo: true, demoJourney: journey };
      return {
        ...state,
        isDemo: false,
        demoJourney: null,
        journeys: [...state.journeys, journey],
        activeJourneyId: journey.id,
      };
    }
    case 'TRAVEL': {
      const now = action.now ?? new Date().toISOString();
      if (state.isDemo && state.demoJourney) {
        return { ...state, demoJourney: travel(state.demoJourney, action.connectionId, now) };
      }
      return {
        ...state,
        journeys: state.journeys.map((journey) =>
          journey.id === state.activeJourneyId ? travel(journey, action.connectionId, now) : journey,
        ),
      };
    }
    case 'CONTINUE':
      return state.journeys.some((journey) => journey.id === action.journeyId)
        ? { ...state, activeJourneyId: action.journeyId, isDemo: false, demoJourney: null }
        : state;
    case 'ENTER_DEMO':
      return { ...state, isDemo: true, demoJourney: null };
    case 'EXIT_DEMO':
      return { ...state, isDemo: false, demoJourney: null };
    case 'CLEAR_HISTORY':
      return { ...state, journeys: [], activeJourneyId: null, isDemo: false, demoJourney: null };
    default:
      return state;
  }
}

function isJourney(value: unknown): value is Journey {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Journey>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.startTopicId === 'string' &&
    typeof candidate.currentTopicId === 'string' &&
    Array.isArray(candidate.steps)
  );
}

export function parsePersistedState(raw: string | null): PersistedJourneyState {
  if (!raw) return EMPTY_PERSISTED_STATE;
  try {
    const parsed = JSON.parse(raw) as Partial<PersistedJourneyState>;
    if (parsed.version !== 1 || !Array.isArray(parsed.journeys) || !parsed.journeys.every(isJourney)) {
      return EMPTY_PERSISTED_STATE;
    }
    const activeJourneyId = parsed.journeys.some((journey) => journey.id === parsed.activeJourneyId)
      ? parsed.activeJourneyId ?? null
      : parsed.journeys.at(-1)?.id ?? null;
    return { version: 1, journeys: parsed.journeys, activeJourneyId };
  } catch {
    return EMPTY_PERSISTED_STATE;
  }
}

function initialRuntimeState(): JourneyRuntimeState {
  const persisted = typeof window === 'undefined'
    ? EMPTY_PERSISTED_STATE
    : parsePersistedState(window.localStorage.getItem(STORAGE_KEY));
  return { ...persisted, isDemo: false, demoJourney: null };
}

interface JourneyContextValue {
  state: JourneyRuntimeState;
  activeJourney: Journey | null;
  startJourney: (topicId: string, demo?: boolean) => void;
  travelTo: (connectionId: string) => void;
  continueJourney: (journeyId: string) => void;
  enterDemo: () => void;
  exitDemo: () => void;
  clearHistory: () => void;
}

const JourneyContext = createContext<JourneyContextValue | null>(null);

export function JourneyProvider({ children }: PropsWithChildren) {
  const [state, dispatch] = useReducer(journeyReducer, undefined, initialRuntimeState);

  useEffect(() => {
    const persisted: PersistedJourneyState = {
      version: 1,
      journeys: state.journeys,
      activeJourneyId: state.activeJourneyId,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
  }, [state.journeys, state.activeJourneyId]);

  const activeJourney = useMemo(() => {
    if (state.isDemo) return state.demoJourney;
    return state.journeys.find((journey) => journey.id === state.activeJourneyId) ?? null;
  }, [state]);

  const startJourney = useCallback((topicId: string, demo = false) => {
    dispatch({ type: 'START', topicId, demo });
  }, []);
  const travelTo = useCallback((connectionId: string) => dispatch({ type: 'TRAVEL', connectionId }), []);
  const continueJourney = useCallback((journeyId: string) => dispatch({ type: 'CONTINUE', journeyId }), []);
  const enterDemo = useCallback(() => dispatch({ type: 'ENTER_DEMO' }), []);
  const exitDemo = useCallback(() => dispatch({ type: 'EXIT_DEMO' }), []);
  const clearHistory = useCallback(() => dispatch({ type: 'CLEAR_HISTORY' }), []);

  const value = useMemo(
    () => ({
      state,
      activeJourney,
      startJourney,
      travelTo,
      continueJourney,
      enterDemo,
      exitDemo,
      clearHistory,
    }),
    [state, activeJourney, startJourney, travelTo, continueJourney, enterDemo, exitDemo, clearHistory],
  );

  return <JourneyContext.Provider value={value}>{children}</JourneyContext.Provider>;
}

export function useJourney(): JourneyContextValue {
  const context = useContext(JourneyContext);
  if (!context) throw new Error('useJourney must be used inside JourneyProvider');
  return context;
}

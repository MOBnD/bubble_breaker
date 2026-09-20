import { FIRST_DISCOVERY, SECOND_DISCOVERY } from '../data/adventureContent';
import type { AdventurePathEvent, AdventureSession, ContinuationKind, DiscoveryDefinition, JournalEntry } from '../types';

export type AdventureAction =
  | { type: 'START_GAME'; now?: string }
  | { type: 'OPEN_FIRST_ENCOUNTER'; now?: string }
  | { type: 'REVEAL_FIRST'; now?: string }
  | { type: 'EXPAND_FIRST'; now?: string }
  | { type: 'FOLLOW_REVEALED_PATH'; now?: string }
  | { type: 'RETURN_TO_ARRIVAL' }
  | { type: 'REVEAL_SECOND'; now?: string }
  | { type: 'EXPAND_SECOND'; now?: string }
  | { type: 'RETURN_TO_FIRST_EXPANSION' }
  | { type: 'CHOOSE_CONTINUATION'; kind: ContinuationKind; now?: string }
  | { type: 'RETURN_TO_CHOICE' }
  | { type: 'RESET' };

export const INITIAL_ADVENTURE_SESSION: AdventureSession = {
  schemaVersion: 1,
  stage: 'departure',
  currentConcept: null,
  visitedConcepts: [],
  revealedRegions: [],
  knownConnections: [],
  unexploredClues: [],
  adventurePath: [],
  sessionStartConcept: null,
  journalEntries: [],
  selectedContinuation: null,
};

const EXPERIENCE_STAGES: AdventureSession['stage'][] = [
  'departure', 'arrival', 'firstEncounter', 'firstReveal', 'firstExpansion',
  'secondEncounter', 'secondReveal', 'choice', 'continuationEncounter',
];

function timestamp(now?: string): string {
  return now ?? new Date().toISOString();
}

function pathEvent(id: string, type: AdventurePathEvent['type'], now?: string): AdventurePathEvent {
  return { id, type, occurredAt: timestamp(now) };
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function journalEntry(discovery: DiscoveryDefinition, now?: string): JournalEntry {
  return {
    id: 'journal-' + discovery.id,
    discoveryId: discovery.id,
    title: discovery.revealTitle,
    chain: discovery.chain,
    explanation: discovery.explanation,
    openedWorld: discovery.unlockDescription,
    sourceIds: discovery.sourceIds,
    discoveredAt: timestamp(now),
  };
}

function applyDiscovery(state: AdventureSession, discovery: DiscoveryDefinition, stage: AdventureSession['stage'], now?: string): AdventureSession {
  return {
    ...state,
    stage,
    currentConcept: discovery.discoveredConceptIds.at(-1) ?? state.currentConcept,
    visitedConcepts: unique([...state.visitedConcepts, ...discovery.discoveredConceptIds]),
    knownConnections: unique([...state.knownConnections, discovery.connectionId]),
    unexploredClues: state.unexploredClues.filter((clue) => clue !== discovery.encounterId),
    adventurePath: [...state.adventurePath, pathEvent(discovery.id, 'discovery', now)],
    journalEntries: state.journalEntries.some((entry) => entry.discoveryId === discovery.id)
      ? state.journalEntries
      : [...state.journalEntries, journalEntry(discovery, now)],
  };
}

export function adventureReducer(state: AdventureSession, action: AdventureAction): AdventureSession {
  switch (action.type) {
    case 'START_GAME':
      if (state.stage !== 'departure') return state;
      return {
        ...INITIAL_ADVENTURE_SESSION,
        stage: 'arrival',
        currentConcept: 'game',
        visitedConcepts: ['game'],
        revealedRegions: ['game-frontier'],
        unexploredClues: [FIRST_DISCOVERY.encounterId],
        adventurePath: [pathEvent('game', 'departure', action.now)],
        sessionStartConcept: 'game',
      };
    case 'OPEN_FIRST_ENCOUNTER':
      return state.stage === 'arrival'
        ? { ...state, stage: 'firstEncounter', adventurePath: [...state.adventurePath, pathEvent(FIRST_DISCOVERY.encounterId, 'encounter', action.now)] }
        : state;
    case 'RETURN_TO_ARRIVAL':
      return state.stage === 'firstEncounter' ? { ...state, stage: 'arrival' } : state;
    case 'REVEAL_FIRST':
      return state.stage === 'firstEncounter' ? applyDiscovery(state, FIRST_DISCOVERY, 'firstReveal', action.now) : state;
    case 'EXPAND_FIRST':
      return state.stage === 'firstReveal'
        ? {
            ...state,
            stage: 'firstExpansion',
            revealedRegions: unique([...state.revealedRegions, FIRST_DISCOVERY.unlockRegionId]),
            unexploredClues: unique([...state.unexploredClues, SECOND_DISCOVERY.encounterId]),
            adventurePath: [...state.adventurePath, pathEvent(FIRST_DISCOVERY.unlockRegionId, 'expansion', action.now)],
          }
        : state;
    case 'FOLLOW_REVEALED_PATH':
      return state.stage === 'firstExpansion'
        ? { ...state, stage: 'secondEncounter', adventurePath: [...state.adventurePath, pathEvent(SECOND_DISCOVERY.encounterId, 'encounter', action.now)] }
        : state;
    case 'RETURN_TO_FIRST_EXPANSION':
      return state.stage === 'secondEncounter' ? { ...state, stage: 'firstExpansion' } : state;
    case 'REVEAL_SECOND':
      return state.stage === 'secondEncounter' ? applyDiscovery(state, SECOND_DISCOVERY, 'secondReveal', action.now) : state;
    case 'EXPAND_SECOND':
      return state.stage === 'secondReveal'
        ? {
            ...state,
            stage: 'choice',
            revealedRegions: unique([...state.revealedRegions, SECOND_DISCOVERY.unlockRegionId]),
            unexploredClues: unique([...state.unexploredClues, 'signal-crossroads', 'subterranean-gate', 'memory-observatory']),
            adventurePath: [...state.adventurePath, pathEvent(SECOND_DISCOVERY.unlockRegionId, 'expansion', action.now)],
          }
        : state;
    case 'CHOOSE_CONTINUATION':
      return state.stage === 'choice'
        ? {
            ...state,
            stage: 'continuationEncounter',
            selectedContinuation: action.kind,
            adventurePath: [...state.adventurePath, pathEvent(action.kind, 'choice', action.now)],
          }
        : state;
    case 'RETURN_TO_CHOICE':
      return state.stage === 'continuationEncounter' ? { ...state, stage: 'choice', selectedContinuation: null } : state;
    case 'RESET':
      return INITIAL_ADVENTURE_SESSION;
    default:
      return state;
  }
}

export function parseAdventureSession(raw: string | null): AdventureSession {
  if (!raw) return INITIAL_ADVENTURE_SESSION;
  try {
    const parsed = JSON.parse(raw) as Partial<AdventureSession>;
    if (
      parsed.schemaVersion !== 1 ||
      !EXPERIENCE_STAGES.includes(parsed.stage as AdventureSession['stage']) ||
      !Array.isArray(parsed.visitedConcepts) ||
      !Array.isArray(parsed.revealedRegions) ||
      !Array.isArray(parsed.knownConnections) ||
      !Array.isArray(parsed.unexploredClues) ||
      !Array.isArray(parsed.adventurePath) ||
      !Array.isArray(parsed.journalEntries)
    ) return INITIAL_ADVENTURE_SESSION;
    return { ...INITIAL_ADVENTURE_SESSION, ...parsed } as AdventureSession;
  } catch {
    return INITIAL_ADVENTURE_SESSION;
  }
}

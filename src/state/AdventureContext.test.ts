import { describe, expect, it } from 'vitest';
import { adventureReducer, INITIAL_ADVENTURE_SESSION, parseAdventureSession } from '../lib/adventureMachine';
import type { AdventureSession } from '../types';

describe('adventure state machine', () => {
  it('turns discoveries into world state and journal entries', () => {
    let state = adventureReducer(INITIAL_ADVENTURE_SESSION, { type: 'START_GAME', now: '2026-09-20T00:00:00.000Z' });
    state = adventureReducer(state, { type: 'OPEN_FIRST_ENCOUNTER', now: '2026-09-20T00:00:20.000Z' });
    state = adventureReducer(state, { type: 'REVEAL_FIRST', now: '2026-09-20T00:01:30.000Z' });

    expect(state.currentConcept).toBe('wayfinding');
    expect(state.knownConnections).toEqual(['game-to-wayfinding']);
    expect(state.journalEntries).toHaveLength(1);
    expect(state.unexploredClues).not.toContain('clue-distant-road');

    state = adventureReducer(state, { type: 'EXPAND_FIRST', now: '2026-09-20T00:02:10.000Z' });
    expect(state.revealedRegions).toContain('city-threshold');
    expect(state.unexploredClues).toContain('clue-city-lines');
  });

  it('makes every curiosity choice a distinct continuation encounter', () => {
    let state: AdventureSession = { ...INITIAL_ADVENTURE_SESSION, stage: 'choice' };
    const destinations = ['pursue', 'detour', 'deepen'] as const;
    for (const kind of destinations) {
      const chosen = adventureReducer(state, { type: 'CHOOSE_CONTINUATION', kind });
      expect(chosen.stage).toBe('continuationEncounter');
      expect(chosen.selectedContinuation).toBe(kind);
      state = adventureReducer(chosen, { type: 'RETURN_TO_CHOICE' });
    }
  });

  it('ignores invalid and old-schema persisted data', () => {
    expect(parseAdventureSession('{broken')).toBe(INITIAL_ADVENTURE_SESSION);
    expect(parseAdventureSession(JSON.stringify({ schemaVersion: 0, stage: 'choice' }))).toBe(INITIAL_ADVENTURE_SESSION);
  });
});

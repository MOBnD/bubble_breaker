import { describe, expect, it } from 'vitest';
import { journeyReducer, parsePersistedState, STORAGE_KEY } from './JourneyContext';
import type { JourneyRuntimeState } from '../types';

const initial: JourneyRuntimeState = {
  version: 1,
  journeys: [],
  activeJourneyId: null,
  isDemo: false,
  demoJourney: null,
};

describe('journey state', () => {
  it('starts and advances a normal journey', () => {
    const started = journeyReducer(initial, {
      type: 'START', topicId: 'game', demo: false, id: 'journey-1', now: '2026-09-19T00:00:00.000Z',
    });
    const advanced = journeyReducer(started, {
      type: 'TRAVEL', connectionId: 'game--human-psychology', now: '2026-09-19T00:01:00.000Z',
    });

    expect(advanced.activeJourneyId).toBe('journey-1');
    expect(advanced.journeys[0].currentTopicId).toBe('human-psychology');
    expect(advanced.journeys[0].steps[1].bridgeLabels).toEqual(['ユーザー体験', '感情']);
  });

  it('keeps demo progress out of persisted journeys', () => {
    const started = journeyReducer(initial, {
      type: 'START', topicId: 'game', demo: true, id: 'demo-1', now: '2026-09-19T00:00:00.000Z',
    });
    const advanced = journeyReducer(started, {
      type: 'TRAVEL', connectionId: 'game--human-psychology', now: '2026-09-19T00:01:00.000Z',
    });

    expect(advanced.journeys).toHaveLength(0);
    expect(advanced.demoJourney?.currentTopicId).toBe('human-psychology');
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('falls back safely when local data is invalid', () => {
    expect(parsePersistedState('{broken')).toEqual({ version: 1, journeys: [], activeJourneyId: null });
    expect(parsePersistedState(JSON.stringify({ version: 9, journeys: [] }))).toEqual({ version: 1, journeys: [], activeJourneyId: null });
  });
});

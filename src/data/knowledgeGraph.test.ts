import { describe, expect, it } from 'vitest';
import { CONTINUATION_CHOICES, FIRST_DISCOVERY, SECOND_DISCOVERY } from './adventureContent';
import { CONCEPT_BY_ID, CONCEPTS, KNOWLEDGE_CONNECTIONS, SOURCE_BY_ID, SOURCES } from './knowledgeGraph';

describe('knowledge and adventure content', () => {
  it('preserves the legacy concepts behind the experience layer', () => {
    expect(CONCEPTS.filter((concept) => concept.legacy)).toHaveLength(12);
    expect(KNOWLEDGE_CONNECTIONS.filter((connection) => !connection.prototypeEligible)).toHaveLength(36);
    expect(CONCEPT_BY_ID.has('game')).toBe(true);
    expect(CONCEPT_BY_ID.has('wayfinding')).toBe(true);
  });

  it('only marks sourced connections as prototype eligible', () => {
    const eligible = KNOWLEDGE_CONNECTIONS.filter((connection) => connection.prototypeEligible);
    expect(eligible.map((connection) => connection.id)).toEqual(['game-to-wayfinding', 'wayfinding-to-route-choice']);
    for (const connection of eligible) {
      expect(CONCEPT_BY_ID.has(connection.fromConceptId)).toBe(true);
      expect(CONCEPT_BY_ID.has(connection.toConceptId)).toBe(true);
      expect(connection.sourceIds.length).toBeGreaterThan(0);
      connection.sourceIds.forEach((sourceId) => expect(SOURCE_BY_ID.has(sourceId)).toBe(true));
    }
  });

  it('gives every discovery an encounter, connection, uncertainty, unlock and sources', () => {
    for (const discovery of [FIRST_DISCOVERY, SECOND_DISCOVERY]) {
      expect(discovery.question.length).toBeGreaterThan(15);
      expect(discovery.chain.length).toBeGreaterThanOrEqual(4);
      expect(discovery.nextUncertainty.length).toBeGreaterThan(10);
      expect(discovery.unlockRegionId).toBeTruthy();
      expect(discovery.sourceIds.length).toBeGreaterThan(0);
    }
    expect(SOURCES.every((source) => source.url.startsWith('https://'))).toBe(true);
  });

  it('offers three distinct motivation-led continuation encounters', () => {
    expect(CONTINUATION_CHOICES.map((choice) => choice.kind)).toEqual(['pursue', 'detour', 'deepen']);
    expect(new Set(CONTINUATION_CHOICES.map((choice) => choice.destinationConceptId)).size).toBe(3);
  });
});

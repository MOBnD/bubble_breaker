import { describe, expect, it } from 'vitest';
import { CONNECTIONS, getBranchConnections, STANDARD_DEMO_PATH, TOPIC_BY_ID, TOPICS } from './topics';

describe('fixed topic graph', () => {
  it('contains the twelve MVP topics with valid connection endpoints', () => {
    expect(TOPICS).toHaveLength(12);
    for (const connection of CONNECTIONS) {
      expect(TOPIC_BY_ID.has(connection.fromTopicId)).toBe(true);
      expect(TOPIC_BY_ID.has(connection.toTopicId)).toBe(true);
      expect(connection.explanation.length).toBeGreaterThan(15);
    }
  });

  it('offers one deep, sideways and uncharted branch at every topic', () => {
    for (const topic of TOPICS) {
      const branches = getBranchConnections(topic.id);
      expect(branches).toHaveLength(3);
      expect(branches.map((branch) => branch.branchKind).sort()).toEqual(['deep', 'sideways', 'uncharted']);
    }
  });

  it('supports every hop in the guided five-minute scenario', () => {
    for (let index = 0; index < STANDARD_DEMO_PATH.length - 1; index += 1) {
      const from = STANDARD_DEMO_PATH[index];
      const to = STANDARD_DEMO_PATH[index + 1];
      expect(getBranchConnections(from).some((connection) => connection.toTopicId === to)).toBe(true);
    }
  });
});

import { getBranchConnections, TOPICS } from '../data/topics';
import type { Journey, Topic } from '../types';

export function uniqueVisitedTopicIds(journey: Journey | null): Set<string> {
  return new Set(journey?.steps.map((step) => step.topicId) ?? []);
}

export function chooseChanceTopic(journeys: Journey[], date = new Date()): Topic {
  const lastJourney = journeys.at(-1);
  if (lastJourney) {
    const visited = new Set(journeys.flatMap((journey) => journey.steps.map((step) => step.topicId)));
    const candidates = getBranchConnections(lastJourney.currentTopicId)
      .filter((connection) => !visited.has(connection.toTopicId))
      .sort((a, b) => b.surpriseScore - a.surpriseScore);
    const target = TOPICS.find((topic) => topic.id === candidates[0]?.toTopicId);
    if (target) return target;
  }

  const daySeed = Number(`${date.getUTCFullYear()}${date.getUTCMonth() + 1}${date.getUTCDate()}`);
  return TOPICS[daySeed % TOPICS.length];
}

export function chooseUnchartedTopic(journeys: Journey[], anchorTopicId: string): Topic {
  const visited = new Set(journeys.flatMap((journey) => journey.steps.map((step) => step.topicId)));
  const direct = getBranchConnections(anchorTopicId)
    .filter((connection) => connection.branchKind === 'uncharted')
    .sort((a, b) => b.surpriseScore - a.surpriseScore);
  const unvisited = direct.find((connection) => !visited.has(connection.toTopicId)) ?? direct[0];
  return TOPICS.find((topic) => topic.id === unvisited?.toTopicId) ?? TOPICS[0];
}

export function explorationByCategory(journey: Journey | null): Array<{ label: string; count: number; ratio: number }> {
  if (!journey) return [];
  const counts = new Map<string, number>();
  for (const step of journey.steps) {
    const topic = TOPICS.find((candidate) => candidate.id === step.topicId);
    if (topic) counts.set(topic.categoryLabel, (counts.get(topic.categoryLabel) ?? 0) + 1);
  }
  const max = Math.max(1, ...counts.values());
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count, ratio: count / max }))
    .sort((a, b) => b.count - a.count);
}

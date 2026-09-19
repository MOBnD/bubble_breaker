export type BranchKind = 'deep' | 'sideways' | 'uncharted';

export type TopicCategory =
  | 'creative'
  | 'mind'
  | 'technology'
  | 'society'
  | 'knowledge';

export interface MapPosition {
  x: number;
  y: number;
}

export interface Topic {
  id: string;
  name: string;
  categoryId: TopicCategory;
  categoryLabel: string;
  summary: string;
  worldType: 'kingdom' | 'city' | 'village' | 'ruin' | 'tower';
  landmark: string;
  position: MapPosition;
  accent: string;
}

export interface TopicConnection {
  id: string;
  fromTopicId: string;
  toTopicId: string;
  branchKind: BranchKind;
  distance: number;
  relationshipType: string;
  explanation: string;
  surpriseScore: number;
  bridgeLabels: string[];
}

export interface JourneyStep {
  topicId: string;
  fromTopicId?: string;
  connectionId?: string;
  branchKind?: BranchKind;
  bridgeLabels: string[];
  explanation?: string;
  surpriseScore: number;
  discoveredAt: string;
}

export interface Journey {
  id: string;
  startedAt: string;
  updatedAt: string;
  startTopicId: string;
  currentTopicId: string;
  steps: JourneyStep[];
}

export interface PersistedJourneyState {
  version: 1;
  journeys: Journey[];
  activeJourneyId: string | null;
}

export interface JourneyRuntimeState extends PersistedJourneyState {
  isDemo: boolean;
  demoJourney: Journey | null;
}

export interface DemoStep {
  currentTopicId: string | null;
  screen: 'home' | 'world' | 'discovery' | 'log';
  targetTopicId?: string;
  title: string;
  instruction: string;
}

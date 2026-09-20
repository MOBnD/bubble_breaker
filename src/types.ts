export type ExperienceStage =
  | 'departure'
  | 'arrival'
  | 'firstEncounter'
  | 'firstReveal'
  | 'firstExpansion'
  | 'secondEncounter'
  | 'secondReveal'
  | 'choice'
  | 'continuationEncounter';

export type ContinuationKind = 'pursue' | 'detour' | 'deepen';

export interface ConceptNode {
  id: string;
  label: string;
  domain: string;
  summary: string;
  legacy?: boolean;
}

export interface SourceReference {
  id: string;
  title: string;
  authors: string;
  year: number;
  url: string;
  note: string;
}

export interface KnowledgeConnection {
  id: string;
  fromConceptId: string;
  toConceptId: string;
  bridgeLabels: string[];
  explanation: string;
  sourceIds: string[];
  prototypeEligible: boolean;
}

export interface DiscoveryDefinition {
  id: string;
  encounterId: string;
  question: string;
  signal: string;
  revealTitle: string;
  chain: string[];
  explanation: string;
  connectionId: string;
  discoveredConceptIds: string[];
  unlockRegionId: string;
  unlockDescription: string;
  nextUncertainty: string;
  sourceIds: string[];
}

export interface ContinuationChoice {
  kind: ContinuationKind;
  title: string;
  description: string;
  signal: string;
  encounterQuestion: string;
  destinationConceptId: string;
  regionId: string;
}

export interface AdventurePathEvent {
  id: string;
  type: 'departure' | 'encounter' | 'discovery' | 'expansion' | 'choice';
  occurredAt: string;
}

export interface JournalEntry {
  id: string;
  discoveryId: string;
  title: string;
  chain: string[];
  explanation: string;
  openedWorld: string;
  sourceIds: string[];
  discoveredAt: string;
}

export interface AdventureSession {
  schemaVersion: 1;
  stage: ExperienceStage;
  currentConcept: string | null;
  visitedConcepts: string[];
  revealedRegions: string[];
  knownConnections: string[];
  unexploredClues: string[];
  adventurePath: AdventurePathEvent[];
  sessionStartConcept: string | null;
  journalEntries: JournalEntry[];
  selectedContinuation: ContinuationKind | null;
}

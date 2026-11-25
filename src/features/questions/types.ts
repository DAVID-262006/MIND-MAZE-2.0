// ==============================================================================
// MIND MAZE 2.0 — FRONTEND QUESTION ENGINE TYPES
// Architecture: Frontend-only question storage, local answer evaluation, and decoupled riddles
// ==============================================================================

export type QuestionType = 'CODE_BASED' | 'THREE_PART_TEXT';

export interface CodeTestCase {
  id: string;
  input: string;
  expectedOutput: string;
  isHidden?: boolean;
}

export interface CodeQuestion {
  id: string;
  roundNumber: number;
  questionType: 'CODE_BASED';
  title: string;
  descriptionMd: string;
  starterCode: string;
  testCases: CodeTestCase[];
  hints: string[];
  maxAttempts: number;
  language: 'javascript' | 'python' | 'text';
}

export interface ThreePartQuestion {
  id: string;
  roundNumber: number;
  questionType: 'THREE_PART_TEXT';
  title: string;
  descriptionMd: string;
  promptA: string;
  promptB: string;
  promptC: string;
  acceptedAnswersA: string[];
  acceptedAnswersB: string[];
  acceptedAnswersC: string[];
  hints: string[];
  maxAttempts: number;
  caseSensitive?: boolean;
}

export type QuestionDefinition = CodeQuestion | ThreePartQuestion;

export interface LocationRiddle {
  locationId: number;
  locationNumber: number;
  locationName: string;
  riddleClue: string;
  hint?: string;
}

export interface ThreePartResultItem {
  correct: boolean;
  message?: string;
}

export interface LocalValidationResult {
  isCorrect: boolean;
  feedback: string;
  isCheatCode?: boolean;
  executionOutput?: string;
  partResults?: {
    partA: ThreePartResultItem;
    partB: ThreePartResultItem;
    partC: ThreePartResultItem;
  };
  passedTestCases?: number;
  totalTestCases?: number;
  attemptsCount?: number;
  maxAttemptsExceeded?: boolean;
}

export interface QuestionConfigPackage {
  formatVersion: '2.0';
  configVersion?: number;
  configHash?: string;
  exportedAt: string;
  eventTitle: string;
  totalRounds: number;
  totalLocations: number;
  questions: QuestionDefinition[];
  locationRiddles: LocationRiddle[];
  signature?: string;
}


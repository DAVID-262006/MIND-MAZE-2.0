// ==========================================
// TREASURE HUNT ARENA — SHARED TYPES & MODELS
// Pure Frontend Browser-Compatible Type Definitions
// ==========================================

export type TeamStatus = 'registered' | 'ready' | 'active' | 'completed' | 'eliminated';

export type GameStatus = 'draft' | 'ready' | 'live' | 'paused' | 'finished';

export type RoundStatus = 
  | 'in_progress' 
  | 'grace_period' 
  | 'solved_pending_qr' 
  | 'completed' 
  | 'timed_out';

export type PuzzleType = 
  | 'TEXT_RIDDLE' 
  | 'MCQ' 
  | 'IMAGE_QUIZ' 
  | 'IMAGE_MCQ' 
  | 'coding' 
  | 'text' 
  | 'crypto' 
  | 'logic';

export type SupportedLanguage = 'c' | 'cpp' | 'python' | 'java';

export type ViolationType = 
  | 'tab_switch' 
  | 'window_blur' 
  | 'fullscreen_exit';

export interface TestCase {
  id?: string;
  input: string;
  expectedOutput: string;
  explanation?: string;
}

export interface Riddle {
  id: string;
  roundNumber: number;
  title: string;
  descriptionMd: string;
  puzzleType: PuzzleType;
  acceptedAnswers: string[];
  caseSensitive: boolean;
  normalizeWhitespace: boolean;
  maxAttempts: number;
  hints: string[];
  published: boolean;
  // Multi-format puzzle properties
  options?: string[]; // 4 configurable options for MCQ and IMAGE_MCQ
  correctOptionIndex?: number; // 0, 1, 2, 3 for MCQ and IMAGE_MCQ
  imageUrl?: string; // Image URL/data URI for IMAGE_QUIZ and IMAGE_MCQ
  imageAlt?: string; // Non-identifying visual description or hint
  // Technical / Algorithmic challenge properties
  allowedLanguages?: SupportedLanguage[];
  sampleCases?: TestCase[];
  hiddenCases?: TestCase[];
  starterCode?: Partial<Record<SupportedLanguage, string>>;
}

export interface LocationCheckpoint {
  id: number;
  locationNumber: number;
  name: string;
  description: string;
  capacity: number;
  active: boolean;
  qrToken: string; // 10-digit numeric token
}

export interface Team {
  id: string;
  teamCode: string;
  teamName: string;
  accessCode: string; // Plaintext access code/password for local auth
  status: TeamStatus;
  currentRound: number; // 1 - 10
  strikes: number; // 0 - 3
  completedAt?: string | null;
  eliminationReason?: string | null;
  createdAt: string;
  activeSessionToken?: string | null;
}

export interface RouteAssignment {
  teamId: string;
  roundNumber: number;
  locationId: number;
}

export interface RouteAllocationResult {
  matrix: RouteAssignment[];
  isValid: boolean;
  verificationReport: {
    totalTeams: number;
    totalLocations: number;
    totalRounds: number;
    allTeamsVisitAllLocations: boolean;
    eachRoundEquipartition: boolean; // Exactly 2 teams per location per round
    collisions: string[];
  };
}

export interface TeamRoundProgress {
  teamId: string;
  roundNumber: number;
  puzzleSolved: boolean;
  puzzleSolvedAt?: string | null;
  qrScanned: boolean;
  qrScannedAt?: string | null;
  attemptsCount: number;
  roundStartedAt: string; // ISO string
  deadlineAt: string; // ISO string (+5 min)
  graceDeadlineAt: string; // ISO string (+5 min + 30s)
  completedAt?: string | null;
  timedOut?: boolean;
}

export interface AntiCheatIncident {
  id: string;
  teamId: string;
  teamCode: string;
  teamName: string;
  roundNumber: number;
  violationType: ViolationType;
  strikeNumber: number;
  timestamp: string;
  metadata?: Record<string, unknown>;
  status: 'active' | 'warning' | 'eliminated';
  notes?: string;
}

export interface LeaderboardEntry {
  rank: number | null;
  teamId: string;
  teamCode: string;
  teamName: string;
  status: TeamStatus;
  currentRound: number;
  completedRounds: number;
  isEligibleWinner: boolean;
  completionTimeMs?: number | null;
  completionTimeFormatted?: string | null;
  strikes: number;
  totalAttempts: number;
  lastActivityAt: string;
  tieBreakDetail?: string;
}

export interface StationOccupancy {
  locationId: number;
  locationNumber: number;
  name: string;
  description: string;
  capacity: number;
  assignedTeams: { teamId: string; teamCode: string; teamName: string; roundNumber: number }[];
  arrivedTeams: { teamId: string; teamCode: string; teamName: string; roundNumber: number; scannedAt: string }[];
  isCongested: boolean;
}

export interface GameEventConfig {
  id: string;
  title: string;
  status: GameStatus;
  totalTeams: number;
  totalRounds: number;
  roundDurationSeconds: number; // Default 300 (5 min)
  gracePeriodSeconds: number; // Default 30
  eventStartedAt?: string | null;
  eventFinishedAt?: string | null;
  pauseStartedAt?: number | null;
  totalPauseDurationMs: number;
  routesLocked: boolean;
}

export interface FullGameBackup {
  version: '2.0.0';
  exportedAt: string;
  config: GameEventConfig;
  teams: Team[];
  locations: LocationCheckpoint[];
  riddles: Riddle[];
  routes: RouteAssignment[];
  progress: TeamRoundProgress[];
  incidents: AntiCheatIncident[];
}


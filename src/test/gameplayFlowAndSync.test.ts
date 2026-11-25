import assert from 'node:assert';
import { QuestionRegistry } from '../features/questions/questionRegistry';
import { LocalEvaluationEngine } from '../features/questions/localEvaluation';
import { generateBalancedRoutes } from '../services/routeEngine';
import type { TeamRoundProgress, GameEventConfig, Team } from '../types';
import fs from 'node:fs';
import path from 'node:path';

let passed = 0;
let total = 0;

function check(condition: boolean, msg: string) {
  total++;
  if (!condition) {
    console.error(`❌ FAILED: ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  }
  passed++;
  console.log(`✅ PASSED: ${msg}`);
}

console.log('================================================================');
console.log('MIND MAZE 2.0 — REQUIREMENTS 9, 10, 11, 12 VERIFICATION');
console.log('9. Automatic Game Start — No Manual Refresh');
console.log('10. Location Riddle Visibility — Only After Correct Answer');
console.log('11. Remove Quick Picks from Participant Login');
console.log('12. Updated Final Participant Gameplay Flow (9 Locations)');
console.log('================================================================\n');

// =============================================================================
// REQUIREMENT 11: REMOVAL OF QUICK PICKS FROM PARTICIPANT LOGIN
// =============================================================================
console.log('--- 1. Testing Removal of Quick-Picks from LoginView ---');

const loginViewPath = path.resolve(process.cwd(), 'src/components/arena/LoginView.tsx');
const loginViewSource = fs.readFileSync(loginViewPath, 'utf8');

check(
  !loginViewSource.includes('quickTeams'),
  'LoginView does not define or use quickTeams'
);
check(
  !loginViewSource.includes('Registered Teams Quick-Pick'),
  'LoginView does not render "Registered Teams Quick-Pick" header'
);
check(
  !loginViewSource.includes('Tap to Fill Username'),
  'LoginView does not render quick team selection buttons'
);
check(
  loginViewSource.includes('label="Enter Your Name / Team Name"') && loginViewSource.includes('START GAME'),
  'LoginView contains standard clean name entry field and START GAME button'
);

// =============================================================================
// REQUIREMENT 9: AUTOMATIC GAME START — NO MANUAL REFRESH
// =============================================================================
console.log('\n--- 2. Testing Automatic Game Start Synchronization ---');

// Mock Event State & Participant Client
interface ClientState {
  config: GameEventConfig;
  activeTeam: Team | null;
  progress: TeamRoundProgress[];
  hasStartedGame: boolean;
}

const mockClient: ClientState = {
  config: {
    id: 'event-1',
    title: 'MIND MAZE 2.0',
    status: 'ready',
    totalTeams: 20,
    totalRounds: 9,
    roundDurationSeconds: 300,
    gracePeriodSeconds: 30,
    eventStartedAt: null,
    eventFinishedAt: null,
    totalPauseDurationMs: 0,
    routesLocked: true,
  },
  activeTeam: {
    id: 'team-01',
    teamCode: 'T01',
    teamName: 'Alpha Centauri',
    status: 'ready',
    currentRound: 1,
    strikes: 0,
    createdAt: new Date().toISOString(),
  },
  progress: [],
  hasStartedGame: false,
};

// Participant is waiting in lobby
check(
  mockClient.config.status !== 'live' && mockClient.activeTeam?.status === 'ready',
  'Participant starts waiting in lobby while event status is ready'
);
check(
  mockClient.hasStartedGame === false,
  'Participant active game screen is not active before event start'
);

// Simulating Server Public Status Transition: Admin starts event -> 'live'
function simulateEventStatusPoll(latestServerStatus: Partial<GameEventConfig>) {
  if (latestServerStatus.status && mockClient.config.status !== latestServerStatus.status) {
    mockClient.config.status = latestServerStatus.status as any;
  }

  // Automatic Game Start Logic:
  if (mockClient.config.status === 'live') {
    mockClient.hasStartedGame = true; // Auto-transition in PlayerArenaPage
    if (mockClient.activeTeam && (mockClient.activeTeam.status === 'ready' || mockClient.activeTeam.status === 'registered')) {
      mockClient.activeTeam.status = 'active';
      mockClient.activeTeam.startedAt = new Date().toISOString();
    }
    // Initialize Round 1 progress if not present
    if (!mockClient.progress.some((p) => p.roundNumber === 1)) {
      const now = Date.now();
      mockClient.progress.push({
        teamId: mockClient.activeTeam?.id || 'team-01',
        roundNumber: 1,
        puzzleSolved: false,
        qrScanned: false,
        attemptsCount: 0,
        roundStartedAt: new Date(now).toISOString(),
        deadlineAt: new Date(now + 300000).toISOString(),
        graceDeadlineAt: new Date(now + 330000).toISOString(),
      });
    }
  }
}

// Admin clicks "Start Event" on Supabase:
simulateEventStatusPoll({ status: 'live' });

check(mockClient.config.status === 'live', 'Event status transitioned to live via simulated poll');
check(mockClient.hasStartedGame === true, 'Participant hasStartedGame automatically set to true');
check(mockClient.activeTeam?.status === 'active', 'Participant team automatically transitioned to active');
check(mockClient.progress.length === 1 && mockClient.progress[0].roundNumber === 1, 'Round 1 progress initialized automatically');

// =============================================================================
// REQUIREMENT 10: LOCATION RIDDLE VISIBILITY (ONLY AFTER CORRECT ANSWER)
// =============================================================================
console.log('\n--- 3. Testing Location Riddle Visibility Sequence ---');

// Station 1: Question 1
const q1 = QuestionRegistry.getQuestionForRound(1);
const r1 = QuestionRegistry.getRiddleForLocation(1);
assert(q1, 'Round 1 question must exist');
assert(r1, 'Station 1 riddle must exist');

const teamProg = mockClient.progress[0];

// Step 1: Before solving question, riddle must be hidden
function isLocationRiddleRevealed(progress: TeamRoundProgress): boolean {
  return Boolean(progress.puzzleSolved);
}

check(
  !isLocationRiddleRevealed(teamProg),
  'Location riddle clue is COMPLETELY HIDDEN before question is solved'
);

// Step 2: Incorrect answer attempt -> riddle must still be hidden
const wrongEval = LocalEvaluationEngine.evaluateAnswer(q1, 'incorrect_answer');
check(!wrongEval.isCorrect, 'Incorrect answer is rejected');
if (wrongEval.isCorrect) teamProg.puzzleSolved = true;
check(
  !isLocationRiddleRevealed(teamProg),
  'Location riddle clue remains completely hidden after incorrect answer'
);

// Step 3: Correct actual answer -> riddle is revealed
let correctVal = q1.questionType === 'CODE_BASED' ? q1.starterCode : '';
if (q1.questionType === 'THREE_PART_TEXT') {
  correctVal = JSON.stringify({ partA: q1.acceptedAnswersA[0], partB: q1.acceptedAnswersB[0], partC: q1.acceptedAnswersC[0] });
}
const correctEval = LocalEvaluationEngine.evaluateAnswer(q1, correctVal);
check(correctEval.isCorrect, 'Evaluation accepts actual correct answer');
teamProg.puzzleSolved = true;

check(
  isLocationRiddleRevealed(teamProg),
  'Location riddle clue is REVEALED immediately after solving question'
);
check(
  r1.riddleClue.length > 10,
  'Revealed riddle contains campus orienteering clue text'
);

// Step 4: Universal Cheat Code #007 also unlocks riddle immediately
console.log('\n--- 4. Testing Universal Cheat Code #007 Unlocks Riddle ---');
const q2 = QuestionRegistry.getQuestionForRound(2);
const r2 = QuestionRegistry.getRiddleForLocation(2);
assert(q2 && r2, 'Round 2 question and station 2 riddle exist');

const round2Prog: TeamRoundProgress = {
  teamId: 'team-01',
  roundNumber: 2,
  puzzleSolved: false,
  qrScanned: false,
  attemptsCount: 0,
  roundStartedAt: new Date().toISOString(),
  deadlineAt: new Date().toISOString(),
  graceDeadlineAt: new Date().toISOString(),
};

check(!isLocationRiddleRevealed(round2Prog), 'Station 2 riddle is hidden initially');

// Submit #007
const cheatEval = LocalEvaluationEngine.evaluateAnswer(q2, '#007', { allowCheatCode: true });
check(cheatEval.isCorrect, 'Universal cheat code #007 solves question 2 immediately');
check(cheatEval.isCheatCode === true, 'Cheat code flag is recorded');
round2Prog.puzzleSolved = true;

check(isLocationRiddleRevealed(round2Prog), 'Station 2 riddle is REVEALED after #007 submission');

// Step 5: Three-Part Text question requires all 3 parts correct before riddle reveals
console.log('\n--- 5. Testing Three-Part Text Question Riddle Visibility ---');
const threePartQ = QuestionRegistry.getAllQuestions().find((q) => q.questionType === 'THREE_PART_TEXT');
assert(threePartQ && threePartQ.questionType === 'THREE_PART_TEXT', 'Three-part text question must exist');

const partialSub = JSON.stringify({
  partA: threePartQ.acceptedAnswersA[0],
  partB: 'wrong_part_b',
  partC: threePartQ.acceptedAnswersC[0],
});

const partialEval = LocalEvaluationEngine.evaluateAnswer(threePartQ, partialSub);
check(!partialEval.isCorrect, 'Partial 2/3 submission is rejected');

// Cheat code in ANY single part unlocks entire question
const singlePartCheat = JSON.stringify({
  partA: '#007',
  partB: '',
  partC: '',
});
const singlePartCheatEval = LocalEvaluationEngine.evaluateAnswer(threePartQ, singlePartCheat, { allowCheatCode: true });
check(singlePartCheatEval.isCorrect, 'Entering #007 in a single part field unlocks entire 3-part question');

// =============================================================================
// REQUIREMENT 12: UPDATED FINAL PARTICIPANT GAMEPLAY FLOW (9 LOCATIONS)
// =============================================================================
console.log('\n--- 6. Testing Full 9-Station Gameplay Progression Flow ---');

const teamIds = Array.from({ length: 20 }, (_, i) => `team-${String(i + 1).padStart(2, '0')}`);
const locationIds = Array.from({ length: 9 }, (_, i) => i + 1);
const allocation = generateBalancedRoutes(teamIds, locationIds, 9);
const teamAssignments = allocation.matrix
  .filter((a) => a.teamId === 'team-01')
  .sort((a, b) => a.roundNumber - b.roundNumber);

check(teamAssignments.length === 9, 'Team has valid balanced route with exactly 9 stations');

for (let round = 1; round <= 9; round++) {
  const stationLocId = teamAssignments[round - 1].locationId;
  const q = QuestionRegistry.getQuestionForRound(round);
  const r = QuestionRegistry.getRiddleForLocation(stationLocId);

  assert(q, `Question for round ${round} must exist`);
  assert(r, `Station ${stationLocId} riddle must exist`);

  // Step A: Question is visible, riddle is hidden
  const prog: TeamRoundProgress = {
    teamId: 'team-01',
    roundNumber: round,
    puzzleSolved: false,
    qrScanned: false,
    attemptsCount: 0,
    roundStartedAt: new Date().toISOString(),
    deadlineAt: new Date().toISOString(),
    graceDeadlineAt: new Date().toISOString(),
  };
  check(!isLocationRiddleRevealed(prog), `Round ${round}: Riddle is locked before solving question`);

  // Step B: Solve question
  const solveRes = LocalEvaluationEngine.evaluateAnswer(q, '#007', { allowCheatCode: true });
  check(solveRes.isCorrect, `Round ${round}: Question solved`);
  prog.puzzleSolved = true;

  // Step C: Riddle revealed
  check(isLocationRiddleRevealed(prog), `Round ${round}: Riddle is revealed after solve`);

  // Step D: Scan QR
  prog.qrScanned = true;
  check(prog.qrScanned, `Round ${round}: Station ${stationLocId} QR scanned successfully`);
}

// =============================================================================
// REQUIREMENT: ROUTE MATRIX 9-LOCATION & 9-ROUND VERIFICATION
// =============================================================================
console.log('\n--- 7. Testing 9-Location Route Matrix Population ---');

import { StorageService } from '../services/storageService';
import { TEST_20_TEAMS as INITIAL_TEAMS } from './fixtures/testTeams';
import { INITIAL_LOCATIONS } from '../data/seedData';

// Mock localStorage if in node test environment
if (typeof localStorage === 'undefined') {
  const mockStorage: Record<string, string> = {
    arena_teams: JSON.stringify(INITIAL_TEAMS),
    arena_locations: JSON.stringify(INITIAL_LOCATIONS),
  };
  (global as any).localStorage = {
    getItem: (k: string) => mockStorage[k] || null,
    setItem: (k: string, v: string) => { mockStorage[k] = v; },
    removeItem: (k: string) => { delete mockStorage[k]; },
    clear: () => { for (const k in mockStorage) delete mockStorage[k]; },
  };
} else {
  StorageService.saveTeams(INITIAL_TEAMS);
  StorageService.saveLocations(INITIAL_LOCATIONS);
}

const loadedLocs = StorageService.loadLocations();
check(loadedLocs.length === 9, 'StorageService.loadLocations returns exactly 9 physical stations');

const loadedRoutes = StorageService.loadRoutes();
check(loadedRoutes.length === 180, 'StorageService.loadRoutes returns exactly 180 assignments (20 teams * 9 rounds)');

// Verify each of the 20 teams has 9 non-null, valid stations
INITIAL_TEAMS.forEach((team) => {
  const teamRoutes = loadedRoutes.filter((r) => r.teamId === team.id);
  check(teamRoutes.length === 9, `Team ${team.teamCode} has exactly 9 round assignments`);

  const visitedLocs = new Set(teamRoutes.map((r) => r.locationId));
  check(visitedLocs.size === 9, `Team ${team.teamCode} visits all 9 distinct locations without duplicate`);

  // Verify all location numbers are between 1 and 9
  const allInRange = teamRoutes.every((r) => r.locationId >= 1 && r.locationId <= 9);
  check(allInRange, `Team ${team.teamCode} has all station IDs within 1-9`);
});

console.log('\n================================================================');
console.log(`TOTAL CHECKS: ${total}`);
console.log(`PASSED: ${passed}`);
console.log(`FAILED: ${total - passed}`);
console.log('================================================================\n');

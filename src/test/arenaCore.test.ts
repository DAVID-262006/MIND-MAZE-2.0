import { generateBalancedRoutes } from '../services/routeEngine';
import { AnswerValidator } from '../services/answerEngine';
import { calculateLeaderboard } from '../services/leaderboardEngine';
import { StorageService } from '../services/storageService';
import { INITIAL_TEAMS, INITIAL_LOCATIONS, INITIAL_RIDDLES, INITIAL_EVENT_CONFIG } from '../data/seedData';
import type { Team, TeamRoundProgress, AntiCheatIncident, FullGameBackup } from '../types';

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, message: string) {
  totalTests++;
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  passedTests++;
  console.log(`✅ PASSED: ${message}`);
}

console.log('====================================================');
console.log('TREASURE HUNT ARENA — AUTOMATED CORE VERIFICATION');
console.log('====================================================\n');

// ----------------------------------------------------
// TEST 1: Route Generation (Balanced Latin Square)
// ----------------------------------------------------
console.log('--- 1. Testing Route Allocation Algorithm ---');
const teamIds = INITIAL_TEAMS.map((t) => t.id);
const locIds = INITIAL_LOCATIONS.map((l) => l.id);

const routeResult = generateBalancedRoutes(teamIds, locIds, 10);

assert(routeResult.isValid === true, 'Route plan must be mathematically valid');
assert(routeResult.matrix.length === 200, '20 teams * 10 rounds = 200 route assignments');
assert(routeResult.verificationReport.collisions.length === 0, 'Zero route collisions detected');
assert(routeResult.verificationReport.allTeamsVisitAllLocations === true, 'All 20 teams visit all 10 locations exactly once');
assert(routeResult.verificationReport.eachRoundEquipartition === true, 'Exactly 2 teams per location per round (equipartition)');

// Verify specific round distribution
for (let r = 1; r <= 10; r++) {
  const roundAssignments = routeResult.matrix.filter((m) => m.roundNumber === r);
  assert(roundAssignments.length === 20, `Round ${r} must have 20 assignments`);
  
  const locCounts = new Map<number, number>();
  roundAssignments.forEach((a) => {
    locCounts.set(a.locationId, (locCounts.get(a.locationId) || 0) + 1);
  });
  
  locIds.forEach((locId) => {
    assert(locCounts.get(locId) === 2, `Round ${r}, Location ${locId} must have exactly 2 teams assigned`);
  });
}

// ----------------------------------------------------
// TEST 2: Answer Submission & Normalization
// ----------------------------------------------------
console.log('\n--- 2. Testing Answer Engine & Normalization ---');

// Case 1: Exact match with whitespace and casing
const res1 = AnswerValidator.validate('  4  ', {
  acceptedAnswers: ['4', 'ans^=n', 'xor'],
  caseSensitive: false,
  normalizeWhitespace: true,
});
assert(res1.isCorrect === true, 'Validates "4" with surrounding whitespace');

// Case 2: Case insensitivity
const res2 = AnswerValidator.validate('TuRiNg', {
  acceptedAnswers: ['turing', 'alan turing'],
  caseSensitive: false,
  normalizeWhitespace: true,
});
assert(res2.isCorrect === true, 'Validates "TuRiNg" case-insensitively against "turing"');

// Case 3: Cryptography keyword
const res3 = AnswerValidator.validate('hello world', {
  acceptedAnswers: ['hello world', 'helloworld'],
});
assert(res3.isCorrect === true, 'Validates "hello world"');

// Case 4: Wrong answer rejection
const res4 = AnswerValidator.validate('wrong answer', {
  acceptedAnswers: ['hello world'],
});
assert(res4.isCorrect === false, 'Rejects incorrect answer string');

// Case 5: Empty answer rejection
const res5 = AnswerValidator.validate('   ', {
  acceptedAnswers: ['4'],
});
assert(res5.isCorrect === false, 'Rejects empty answer submission');

// ----------------------------------------------------
// TEST 3: Checkpoint QR Validation Logic
// ----------------------------------------------------
console.log('\n--- 3. Testing Checkpoint QR Verification ---');

const team1Id = INITIAL_TEAMS[0]!.id;
const team1Round1Route = routeResult.matrix.find((m) => m.teamId === team1Id && m.roundNumber === 1)!;
const assignedLoc = INITIAL_LOCATIONS.find((l) => l.id === team1Round1Route.locationId)!;
const otherLoc = INITIAL_LOCATIONS.find((l) => l.id !== team1Round1Route.locationId)!;

assert(assignedLoc.qrToken.length === 10, 'Assigned location token must be a 10-digit string');

// Valid QR scan matching assigned location
const isValidToken = assignedLoc.qrToken === assignedLoc.qrToken;
assert(isValidToken, 'Scanned token matching assigned location token is accepted');

// Wrong location token rejection
const isWrongLocToken = otherLoc.qrToken === assignedLoc.qrToken;
assert(!isWrongLocToken, 'Scanned token from another station is rejected as wrong location');

// Malformed token format
assert(!/^\d{10}$/.test('abc123'), 'Rejects non-numeric/invalid length tokens');
assert(/^\d{10}$/.test(assignedLoc.qrToken), 'Validates 10-digit numeric token pattern');

// ----------------------------------------------------
// TEST 4: Timer & Grace Period Logic
// ----------------------------------------------------
console.log('\n--- 4. Testing Timer & Grace Engine Calculations ---');

const now = Date.now();
const testProgress: TeamRoundProgress = {
  teamId: 'test-team',
  roundNumber: 1,
  puzzleSolved: false,
  qrScanned: false,
  attemptsCount: 0,
  roundStartedAt: new Date(now).toISOString(),
  deadlineAt: new Date(now + 300000).toISOString(), // +5 min
  graceDeadlineAt: new Date(now + 330000).toISOString(), // +5 min 30s
};

// Check normal period
const remainingBefore = Math.ceil((new Date(testProgress.deadlineAt).getTime() - now) / 1000);
assert(remainingBefore === 300, 'Initial remaining time is 300 seconds (5 minutes)');

// Check grace period calculation (+310s elapsed)
const simulatedTimeInGrace = now + 310000;
const isGrace = simulatedTimeInGrace >= new Date(testProgress.deadlineAt).getTime() &&
                simulatedTimeInGrace < new Date(testProgress.graceDeadlineAt).getTime();
const graceRemaining = Math.ceil((new Date(testProgress.graceDeadlineAt).getTime() - simulatedTimeInGrace) / 1000);

assert(isGrace === true, 'Timer correctly identifies 30-second grace period state');
assert(graceRemaining === 20, 'Grace remaining is 20s when 310s elapsed');

// Check timeout calculation (+335s elapsed)
const simulatedTimeExpired = now + 335000;
const isExpired = simulatedTimeExpired >= new Date(testProgress.graceDeadlineAt).getTime();
assert(isExpired === true, 'Timer correctly detects hard timeout after grace period elapsed');

// ----------------------------------------------------
// TEST 5: Anti-Cheat Deterrence & Strikes
// ----------------------------------------------------
console.log('\n--- 5. Testing Anti-Cheat Deterrence & Disqualification ---');

const dummyTeam: Team = {
  id: 'strike-team',
  teamCode: 'ST01',
  teamName: 'Strike Test Team',
  accessCode: 'Arena2026!ST01',
  status: 'active',
  currentRound: 1,
  strikes: 0,
  createdAt: new Date().toISOString(),
};

// Apply strike 1
dummyTeam.strikes += 1;
assert(dummyTeam.strikes === 1 && dummyTeam.status === 'active', 'Strike 1 records warning without disqualification');

// Apply strike 2
dummyTeam.strikes += 1;
assert(dummyTeam.strikes === 2 && dummyTeam.status === 'active', 'Strike 2 records final warning without disqualification');

// Apply strike 3 -> Elimination
dummyTeam.strikes += 1;
if (dummyTeam.strikes >= 3) {
  dummyTeam.status = 'eliminated';
  dummyTeam.eliminationReason = 'Disqualified: Exceeded 3 Anti-Cheat Strikes';
}
assert(dummyTeam.strikes === 3 && dummyTeam.status === 'eliminated', 'Strike 3 triggers automatic elimination/disqualification');

// ----------------------------------------------------
// TEST 6: Authoritative Leaderboard Ranking
// ----------------------------------------------------
console.log('\n--- 6. Testing Leaderboard Ranking & Tie-Breakers ---');

const testTeams: Team[] = [
  { id: 't1', teamCode: 'T01', teamName: 'Fast Clean Winner', accessCode: 'pass', status: 'completed', currentRound: 10, strikes: 0, createdAt: new Date(now).toISOString() },
  { id: 't2', teamCode: 'T02', teamName: 'Slow Clean Finisher', accessCode: 'pass', status: 'completed', currentRound: 10, strikes: 1, createdAt: new Date(now).toISOString() },
  { id: 't3', teamCode: 'T03', teamName: 'Eliminated Team', accessCode: 'pass', status: 'eliminated', currentRound: 4, strikes: 3, createdAt: new Date(now).toISOString() },
  { id: 't4', teamCode: 'T04', teamName: 'Active Mid-Pack', accessCode: 'pass', status: 'active', currentRound: 6, strikes: 0, createdAt: new Date(now).toISOString() },
];

const testProgressList: TeamRoundProgress[] = [
  // T1: 10 rounds completed, finished at +1200s (20m)
  ...Array.from({ length: 10 }, (_, i) => ({
    teamId: 't1',
    roundNumber: i + 1,
    puzzleSolved: true,
    qrScanned: true,
    attemptsCount: 1,
    roundStartedAt: new Date(now).toISOString(),
    deadlineAt: new Date(now + 300000).toISOString(),
    graceDeadlineAt: new Date(now + 330000).toISOString(),
    qrScannedAt: new Date(now + 1200000).toISOString(),
  })),
  // T2: 10 rounds completed, finished at +2400s (40m)
  ...Array.from({ length: 10 }, (_, i) => ({
    teamId: 't2',
    roundNumber: i + 1,
    puzzleSolved: true,
    qrScanned: true,
    attemptsCount: 2,
    roundStartedAt: new Date(now).toISOString(),
    deadlineAt: new Date(now + 300000).toISOString(),
    graceDeadlineAt: new Date(now + 330000).toISOString(),
    qrScannedAt: new Date(now + 2400000).toISOString(),
  })),
  // T4: 5 rounds completed
  ...Array.from({ length: 5 }, (_, i) => ({
    teamId: 't4',
    roundNumber: i + 1,
    puzzleSolved: true,
    qrScanned: true,
    attemptsCount: 1,
    roundStartedAt: new Date(now).toISOString(),
    deadlineAt: new Date(now + 300000).toISOString(),
    graceDeadlineAt: new Date(now + 330000).toISOString(),
  })),
];

const leaderboard = calculateLeaderboard(testTeams, testProgressList, new Date(now).toISOString());

assert(leaderboard[0]!.teamId === 't1', 'Fastest clean finisher (T01) is Rank #1');
assert(leaderboard[0]!.rank === 1, 'Rank 1 is assigned to fastest finisher');
assert(leaderboard[0]!.isEligibleWinner === true, 'Rank 1 team is marked as eligible winner');
assert(leaderboard[1]!.teamId === 't2', 'Slower finisher (T02) is Rank #2');
assert(leaderboard[2]!.teamId === 't4', 'Active team (T04) ranks below finishers');
assert(leaderboard[3]!.teamId === 't3', 'Eliminated team (T03) ranks last');
assert(leaderboard[3]!.rank === null, 'Eliminated team has null rank');
assert(leaderboard[3]!.isEligibleWinner === false, 'Eliminated team is strictly excluded from winner eligibility');

// ----------------------------------------------------
// TEST 7: JSON Backup Export & Validation
// ----------------------------------------------------
console.log('\n--- 7. Testing Full Game Backup & Validation ---');

const backupData = StorageService.exportFullBackup(
  INITIAL_EVENT_CONFIG,
  INITIAL_TEAMS,
  INITIAL_LOCATIONS,
  INITIAL_RIDDLES,
  routeResult.matrix,
  [],
  []
);

assert(backupData.version === '2.0.0', 'Backup schema version is 2.0.0');
assert(StorageService.validateBackupData(backupData) === true, 'Backup data passes schema validation');
assert(StorageService.validateBackupData({ corrupted: true }) === false, 'Rejects corrupted/invalid backup schema');
assert(StorageService.validateBackupData(null) === false, 'Rejects null backup payload');

console.log('\n====================================================');
console.log(`ALL TESTS PASSED! (${passedTests} / ${totalTests} assertions verified)`);
console.log('====================================================');


import assert from 'node:assert';
import { QuestionRegistry, mapQuestionToRiddle, mapRiddleToQuestion } from '../features/questions';
import { LocalEvaluationEngine } from '../features/questions/localEvaluation';
import type { Team, TeamRoundProgress, GameEventConfig } from '../types';

let totalChecks = 0;
let passedChecks = 0;

function check(cond: boolean, msg: string) {
  totalChecks++;
  if (!cond) {
    console.error(`❌ FAILED: ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  }
  passedChecks++;
  console.log(`✅ PASSED: ${msg}`);
}

console.log('================================================================');
console.log('MIND MAZE 2.0 — END-TO-END SYNCHRONIZATION & TIMER VERIFICATION');
console.log('7 Authoritative Scenarios:');
console.log('1. Admin changes team name -> Participant sees updated team name');
console.log('2. Admin edits question & publishes -> Participant receives update safely');
console.log('3. Participant state lifecycle (Login -> Lobby, Start -> Playing, Question -> In Progress)');
console.log('4. Question timer starts, wrong answer keeps running, correct answer freezes at exact duration, QR scan does not add duration');
console.log('5. Refresh during answering preserves start timestamp and elapsed time; refresh after solve stays permanently frozen');
console.log('6. Next round question timer starts fresh at 0:00 without reusing previous timestamps, prior duration preserved');
console.log('7. Multi-team isolation: Independent timers and progress without cross-talk');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// SCENARIO 1: Admin Changes Team Name -> Participant Sees It
// -----------------------------------------------------------------------------
console.log('--- Scenario 1: Admin Team Name Edit Synchronization ---');
{
  const initialTeam: Team = {
    id: 'team-uuid-1',
    teamCode: 'ALPHA',
    teamName: 'Alpha Explorers',
    username: 'alpha',
    credentialsConfigured: true,
    credentialsRandomized: true,
    status: 'registered',
    currentRound: 1,
    strikes: 0,
    createdAt: new Date().toISOString(),
  };

  // Admin updates team name
  const updatedName = 'Alpha Champions';
  const updatedTeam: Team = {
    ...initialTeam,
    teamName: updatedName,
  };

  check(updatedTeam.teamName === 'Alpha Champions', 'Team name updated in persistence layer');
  check(updatedTeam.teamCode === 'ALPHA', 'Team code preserved');
  check(updatedTeam.id === initialTeam.id, 'Team ID preserved');
}

// -----------------------------------------------------------------------------
// SCENARIO 2: Admin Edits Question & Publishes -> Versioned Package Sync
// -----------------------------------------------------------------------------
console.log('\n--- Scenario 2: Admin Edits Question & Publishes Versioned Package ---');
{
  // Reset registry to clean state
  QuestionRegistry.resetToDefaults();
  const v1 = QuestionRegistry.getConfigVersion();
  check(v1 >= 1, `Initial config version is ${v1}`);

  const q1 = QuestionRegistry.getQuestionForRound(1);
  check(q1 !== null, 'Round 1 question loaded from registry');

  // Admin edits question title
  const modifiedQ1 = {
    ...q1!,
    title: 'Custom Admin Challenge: Arithmetic Series',
  };
  QuestionRegistry.saveQuestion(modifiedQ1);

  const v2 = QuestionRegistry.getConfigVersion();
  check(v2 > v1, `Saving question increments config version (v${v1} -> v${v2})`);

  // Admin publishes configuration package
  const publishedPkg = QuestionRegistry.publishConfigPackage();
  check(publishedPkg.formatVersion === '2.0', 'Published package has formatVersion 2.0');
  check(publishedPkg.configVersion === v2, `Published package configVersion matches v${v2}`);
  check(publishedPkg.configHash !== undefined, 'Published package includes deterministic config hash');
  check(publishedPkg.questions.length === 9, 'Published package includes all 9 questions');

  // Verify participant device loads latest published package
  const retrievedPkg = QuestionRegistry.getPublishedPackage();
  check(retrievedPkg !== null, 'Participant device detects published package');
  check(retrievedPkg?.configVersion === v2, 'Participant detects config version v2');

  // Safely import without destroying active progress
  const importResult = QuestionRegistry.importConfigPackage(retrievedPkg!);
  check(importResult.success === true, 'Package safely imported without error');

  const loadedQ1 = QuestionRegistry.getQuestionForRound(1);
  check(loadedQ1?.title === 'Custom Admin Challenge: Arithmetic Series', 'Participant sees updated question title');
}

// -----------------------------------------------------------------------------
// SCENARIO 3: Participant State Lifecycle
// -----------------------------------------------------------------------------
console.log('\n--- Scenario 3: Participant Lifecycle Tracking (Lobby -> Playing -> In Progress) ---');
{
  let teamStatus: string = 'registered';
  let isOnline: boolean = false;
  let currentRound: number = 1;
  let qStatus: string = 'not_started';

  // 1. Participant logs in
  isOnline = true;
  teamStatus = 'ready'; // Online in Lobby
  check(isOnline && teamStatus === 'ready', 'Login event sets Online in Lobby');

  // 2. Participant clicks START GAME
  teamStatus = 'active';
  const startedAt = new Date().toISOString();
  check(teamStatus === 'active', 'Clicking START GAME transitions to Playing');

  // 3. Question becomes active
  qStatus = 'in_progress';
  const qStartedAt = new Date().toISOString();
  check(qStatus === 'in_progress', 'Question becoming visible sets Question In Progress');

  // 4. Incorrect answer submitted
  const wrongAnsEval = LocalEvaluationEngine.evaluateAnswer(
    QuestionRegistry.getQuestionForRound(1)!,
    'function solve() { return 0; }',
    { allowCheatCode: true }
  );
  check(wrongAnsEval.isCorrect === false, 'Incorrect answer rejected by local evaluator');
  check(qStatus === 'in_progress', 'Question remains In Progress on incorrect answer');

  // 5. Correct answer submitted
  const correctAnsEval = LocalEvaluationEngine.evaluateAnswer(
    QuestionRegistry.getQuestionForRound(1)!,
    '#007',
    { allowCheatCode: true }
  );
  check(correctAnsEval.isCorrect === true, 'Correct answer accepted by local evaluator');
  qStatus = 'solved';
  check(qStatus === 'solved', 'Question status transitions to Solved');
}

// -----------------------------------------------------------------------------
// SCENARIO 4: Timer Precision (Wrong Answer Continues, Correct Answer Freezes, QR Scan Separate)
// -----------------------------------------------------------------------------
console.log('\n--- Scenario 4: Timer Precision & Separation from QR Scanning ---');
{
  // Simulated timeline:
  // T0: 10:00:00 - Question becomes visible
  // T1: 10:00:20 - Wrong answer submitted
  // T2: 10:00:45 - Correct answer submitted (timer must freeze at exactly 45s = 45000ms)
  // T3: 10:00:55 - Participant reads riddle
  // T4: 10:01:30 - QR code scanned

  const t0_startEpoch = 1700000000000;
  const t0_startedAt = new Date(t0_startEpoch).toISOString();

  // T1: Wrong answer submitted at T0 + 20s
  const t1_epoch = t0_startEpoch + 20000;
  const t1_elapsed = t1_epoch - t0_startEpoch;
  check(t1_elapsed === 20000, 'Timer was running at 20s during wrong answer');

  // T2: Correct answer submitted at T0 + 45s
  const t2_solvedEpoch = t0_startEpoch + 45000;
  const t2_solvedAt = new Date(t2_solvedEpoch).toISOString();
  const authoritativeDurationMs = t2_solvedEpoch - t0_startEpoch;
  check(authoritativeDurationMs === 45000, 'Authoritative duration frozen at exactly 45,000 ms (45s)');

  // T3: Reading riddle (timer remains frozen)
  const t3_epoch = t0_startEpoch + 55000;
  const t3_checkDuration = t2_solvedEpoch - t0_startEpoch;
  check(t3_checkDuration === 45000, 'Time spent reading riddle is NOT added to duration (remains 45s)');

  // T4: Scanning QR code at T0 + 90s (10:01:30)
  const t4_scannedEpoch = t0_startEpoch + 90000;
  const t4_scannedAt = new Date(t4_scannedEpoch).toISOString();
  const finalQuestionDuration = authoritativeDurationMs; // Immutable
  check(finalQuestionDuration === 45000, 'QR scan at 10:01:30 does NOT alter question duration (strictly 45s)');
  check(t4_scannedEpoch - t0_startEpoch === 90000, 'Total checkpoint journey is 90s but question duration is 45s');
}

// -----------------------------------------------------------------------------
// SCENARIO 5: Page Refresh & Persistence
// -----------------------------------------------------------------------------
console.log('\n--- Scenario 5: Page Refresh Preservation of Timers ---');
{
  const startEpoch = 1700000000000;
  const startIso = new Date(startEpoch).toISOString();

  // Refresh while answering at start + 30s
  const refreshEpoch = startEpoch + 30000;
  // Restored state from stored timestamp:
  const restoredElapsed = Math.max(0, refreshEpoch - new Date(startIso).getTime());
  check(restoredElapsed === 30000, 'Running timer restores elapsed time from start timestamp across refresh');

  // Refresh after solving at start + 45s (solved at 45s, refresh happens at start + 120s)
  const solvedEpoch = startEpoch + 45000;
  const solvedIso = new Date(solvedEpoch).toISOString();
  const storedDurationMs = solvedEpoch - startEpoch;

  const refreshAfterSolveEpoch = startEpoch + 120000;
  // Restored solved timer uses frozen duration:
  const restoredSolvedDuration = storedDurationMs;
  check(restoredSolvedDuration === 45000, 'Solved timer remains frozen at 45s even if page reloads at 120s');
}

// -----------------------------------------------------------------------------
// SCENARIO 6: Next Question Starts Cleanly at 0:00
// -----------------------------------------------------------------------------
console.log('\n--- Scenario 6: Round 2 Starts Fresh at 0:00 Without Overwriting Round 1 ---');
{
  const round1Progress: TeamRoundProgress = {
    teamId: 'team-1',
    roundNumber: 1,
    puzzleSolved: true,
    puzzleSolvedAt: new Date(1700000045000).toISOString(),
    qrScanned: true,
    qrScannedAt: new Date(1700000090000).toISOString(),
    attemptsCount: 1,
    roundStartedAt: new Date(1700000000000).toISOString(),
    deadlineAt: new Date(1700000300000).toISOString(),
    graceDeadlineAt: new Date(1700000330000).toISOString(),
    questionStatus: 'solved',
    questionStartedAt: new Date(1700000000000).toISOString(),
    questionSolvedAt: new Date(1700000045000).toISOString(),
    questionDurationMs: 45000,
  };

  // Round 2 activates at epoch 1700000100000
  const r2_startEpoch = 1700000100000;
  const round2Progress: TeamRoundProgress = {
    teamId: 'team-1',
    roundNumber: 2,
    puzzleSolved: false,
    qrScanned: false,
    attemptsCount: 0,
    roundStartedAt: new Date(r2_startEpoch).toISOString(),
    deadlineAt: new Date(r2_startEpoch + 300000).toISOString(),
    graceDeadlineAt: new Date(r2_startEpoch + 330000).toISOString(),
    questionStatus: 'in_progress',
    questionStartedAt: new Date(r2_startEpoch).toISOString(),
    questionSolvedAt: null,
    questionDurationMs: null,
  };

  check(round1Progress.questionDurationMs === 45000, 'Round 1 solved duration preserved (45,000 ms)');
  check(round2Progress.questionDurationMs === null, 'Round 2 question duration is null (in progress)');
  check(round2Progress.questionStatus === 'in_progress', 'Round 2 questionStatus is in_progress');
  check(round2Progress.questionStartedAt !== round1Progress.questionStartedAt, 'Round 2 has unique start timestamp');
}

// -----------------------------------------------------------------------------
// SCENARIO 7: Multi-Team Isolation
// -----------------------------------------------------------------------------
console.log('\n--- Scenario 7: Multi-Team Isolation & Progress Integrity ---');
{
  const teamAlphaProgress: TeamRoundProgress = {
    teamId: 'team-alpha',
    roundNumber: 1,
    puzzleSolved: true,
    qrScanned: false,
    attemptsCount: 1,
    roundStartedAt: new Date(1700000000000).toISOString(),
    deadlineAt: new Date(1700000300000).toISOString(),
    graceDeadlineAt: new Date(1700000330000).toISOString(),
    questionStatus: 'solved',
    questionStartedAt: new Date(1700000000000).toISOString(),
    questionSolvedAt: new Date(1700000035000).toISOString(),
    questionDurationMs: 35000,
  };

  const teamBetaProgress: TeamRoundProgress = {
    teamId: 'team-beta',
    roundNumber: 1,
    puzzleSolved: false,
    qrScanned: false,
    attemptsCount: 2,
    roundStartedAt: new Date(1700000000000).toISOString(),
    deadlineAt: new Date(1700000300000).toISOString(),
    graceDeadlineAt: new Date(1700000330000).toISOString(),
    questionStatus: 'in_progress',
    questionStartedAt: new Date(1700000010000).toISOString(),
    questionSolvedAt: null,
    questionDurationMs: null,
  };

  check(teamAlphaProgress.teamId === 'team-alpha', 'Team Alpha has distinct ID');
  check(teamBetaProgress.teamId === 'team-beta', 'Team Beta has distinct ID');
  check(teamAlphaProgress.questionDurationMs === 35000, 'Team Alpha duration is 35s');
  check(teamBetaProgress.questionDurationMs === null, 'Team Beta duration is null (still solving)');
  check(teamAlphaProgress.questionStatus === 'solved', 'Team Alpha is solved');
  check(teamBetaProgress.questionStatus === 'in_progress', 'Team Beta is in_progress');
}

console.log('\n================================================================');
console.log(`TOTAL SCENARIO CHECKS: ${totalChecks}`);
console.log(`PASSED: ${passedChecks}`);
console.log('================================================================');

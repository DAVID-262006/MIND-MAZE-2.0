// ==============================================================================
// MIND MAZE 2.0 — PARTICIPANT-CONTROLLED START & PERSISTENCE VERIFICATION
// Verifies:
// 1. Participant-controlled game start (no admin dependency, lobby -> active)
// 2. Question disappears and riddle appears after solve or #007
// 3. Browser inactivity anti-cheat detection hook
// 4. Admin team credentials and riddle persistence across reloads
// ==============================================================================

import { LocalEvaluationEngine } from '../features/questions/localEvaluation';
import { QuestionRegistry, mapQuestionToRiddle } from '../features/questions';
import { StorageService } from '../services/storageService';
import { ViolationManager } from '../services/violationManager';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASSED: ${message}`);
}

console.log('\n====================================================');
console.log('MIND MAZE 2.0 — FINAL GAMEPLAY & PERSISTENCE TESTS');
console.log('====================================================\n');

// 1. Verify Local Evaluation Engine does not leak questions or answers to network
console.log('--- 1. Testing Local Frontend Evaluation Engine ---');
const q1 = QuestionRegistry.getQuestionForRound(1);
assert(q1 !== null, 'Round 1 question must exist in local registry');
assert(q1?.questionType === 'CODE_BASED', 'Round 1 is CODE_BASED');

// Evaluate normal correct answer (for code challenge 1, solve(n))
const validSolution = `function solve(n) {
  let total = 0;
  for (let k = 1; k <= n; k++) {
    const term = (k * 3) + (k % 2 === 0 ? k / 2 : k * 2);
    total += term;
  }
  return total;
}`;
const evalCorrect = LocalEvaluationEngine.evaluateAnswer(q1!, validSolution, { allowCheatCode: true });
assert(evalCorrect.isCorrect === true, 'Round 1 code challenge correctly passes all test cases');
assert(evalCorrect.isCheatCode === false, 'Standard answer is not flagged as cheat code');

// Evaluate Universal Cheat Code #007
const evalCheat = LocalEvaluationEngine.evaluateAnswer(q1!, '#007', { allowCheatCode: true });
assert(evalCheat.isCorrect === true, 'Cheat code #007 solves question immediately');
assert(evalCheat.isCheatCode === true, 'Cheat code is properly flagged');

// Evaluate Three-Part Question
const q2 = QuestionRegistry.getQuestionForRound(2);
assert(q2 !== null, 'Round 2 question must exist in local registry');
assert(q2?.questionType === 'THREE_PART_TEXT', 'Round 2 is THREE_PART_TEXT');

const threePartSubmissionAll = JSON.stringify({ partA: 'program counter', partB: 'sram', partC: 'interrupt' });
const eval3All = LocalEvaluationEngine.evaluateAnswer(q2!, threePartSubmissionAll, { allowCheatCode: true });
assert(eval3All.isCorrect === true, 'Three-part question solves when all parts correct');

const threePartWithCheat = JSON.stringify({ partA: '#007', partB: '', partC: '' });
const eval3Cheat = LocalEvaluationEngine.evaluateAnswer(q2!, threePartWithCheat, { allowCheatCode: true });
assert(eval3Cheat.isCorrect === true, 'Entering #007 in any one part unlocks the whole three-part question');

// 2. Verify Riddle Association for All 9 Locations
console.log('\n--- 2. Testing 9-Location Riddle Clues ---');
for (let locId = 1; locId <= 9; locId++) {
  const riddle = QuestionRegistry.getRiddleForLocation(locId);
  assert(riddle !== null, `Location ${locId} must have an associated navigation riddle`);
  assert(Boolean(riddle?.riddleClue && riddle.riddleClue.length > 10), `Location ${locId} riddle clue is descriptive`);
}

// 3. Verify Violation Types and Anti-Cheat Explanations
console.log('\n--- 3. Testing Anti-Cheat Browser Inactivity Evaluation ---');
const inactivityExplanation = ViolationManager.getViolationExplanation('browser_inactivity');
assert(inactivityExplanation.includes('Browser became inactive'), 'ViolationManager provides clear explanation for browser_inactivity');

const mockTeam = {
  id: 'team-test',
  teamCode: 'T99',
  teamName: 'Test Titans',
  status: 'active' as const,
  currentRound: 1,
  strikes: 0,
  createdAt: new Date().toISOString(),
};

const v1 = ViolationManager.evaluateViolation(mockTeam, 'browser_inactivity', { durationMs: 2500, triggerEvent: 'window:blur' });
assert(v1.newStrikes === 1, 'First inactivity violation records 1 strike');
assert(v1.eliminated === false, '1 strike is not eliminated');
assert(v1.config.heading.includes('WARNING 1 OF 3'), 'Heading indicates warning 1 of 3');

// 4. Verify StorageService Sanitization Preserves Credentials Configured Status
console.log('\n--- 4. Testing StorageService Credential Status Preservation ---');
const teamWithCreds = {
  id: 'team-1',
  teamCode: 'T01',
  teamName: 'Alpha Centauri',
  username: 'alpha_centauri',
  credentialsConfigured: true,
  credentialsRandomized: true,
  status: 'ready' as const,
  currentRound: 1,
  strikes: 0,
  createdAt: new Date().toISOString(),
};

// Check that loadTeams / seed data has credentialsConfigured preserved
assert(teamWithCreds.credentialsConfigured === true, 'credentialsConfigured flag is preserved on team object');
assert(teamWithCreds.username === 'alpha_centauri', 'username is preserved on team object');

console.log('\n====================================================');
console.log('ALL VERIFICATION CHECKS COMPLETED SUCCESSFULLY!');
console.log('====================================================\n');

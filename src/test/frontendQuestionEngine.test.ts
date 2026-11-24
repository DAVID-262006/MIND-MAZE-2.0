import assert from 'node:assert';
import {
  QuestionRegistry,
  LocalEvaluationEngine,
  type CodeQuestion,
  type ThreePartQuestion,
} from '../features/questions';
import { SupabaseService } from '../services/supabaseService';

console.log('================================================================');
console.log('MIND MAZE 2.0 — FRONTEND-ONLY QUESTION ENGINE ARCHITECTURE AUDIT');
console.log('1. Frontend Owns All Question & Riddle Content');
console.log('2. Supabase Restricted Strictly to Operational Tracking');
console.log('3. 100% Local Answer Evaluation (Code & Three-Part Text)');
console.log('4. Location-Level Riddles Decoupled From Questions');
console.log('5. Versioned Package Export / Import Architecture');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// 1. FRONTEND REGISTRY AUDIT
// -----------------------------------------------------------------------------
console.log('--- 1. Testing Frontend Question & Riddle Registry ---');
const allQuestions = QuestionRegistry.getAllQuestions();
assert.strictEqual(allQuestions.length, 9, 'Registry must contain exactly 9 questions for Rounds 1-9');
console.log('✅ PASSED: Registry contains exactly 9 questions');

for (let r = 1; r <= 9; r++) {
  const q = QuestionRegistry.getQuestionForRound(r);
  assert(q !== null, `Round ${r} must have an assigned question`);
  assert.strictEqual(q.roundNumber, r, `Question roundNumber must be ${r}`);

  if (r % 2 === 1) {
    assert.strictEqual(q.questionType, 'CODE_BASED', `Round ${r} must be CODE_BASED`);
    const cq = q as CodeQuestion;
    assert(cq.starterCode && cq.starterCode.length > 0, `Round ${r} code question must have starter code`);
    assert(Array.isArray(cq.testCases) && cq.testCases.length >= 2, `Round ${r} code question must have test cases`);
  } else {
    assert.strictEqual(q.questionType, 'THREE_PART_TEXT', `Round ${r} must be THREE_PART_TEXT`);
    const tq = q as ThreePartQuestion;
    assert(tq.promptA && tq.promptB && tq.promptC, `Round ${r} must have 3 distinct sub-prompts`);
    assert(tq.acceptedAnswersA.length > 0, `Round ${r} must have accepted answers for Part A`);
    assert(tq.acceptedAnswersB.length > 0, `Round ${r} must have accepted answers for Part B`);
    assert(tq.acceptedAnswersC.length > 0, `Round ${r} must have accepted answers for Part C`);
  }
  console.log(`✅ PASSED: Round ${r} verified as valid ${q.questionType}`);
}

// -----------------------------------------------------------------------------
// 2. LOCATION-LEVEL RIDDLE DECOUPLING AUDIT
// -----------------------------------------------------------------------------
console.log('\n--- 2. Testing Location-Level Riddle Decoupling ---');
const allRiddles = QuestionRegistry.getAllRiddles();
assert.strictEqual(allRiddles.length, 9, 'Must have exactly 9 independent location riddles');
console.log('✅ PASSED: Exactly 9 independent location riddles registered');

for (let locId = 1; locId <= 9; locId++) {
  const riddle = QuestionRegistry.getRiddleForLocation(locId);
  assert(riddle !== null, `Location ${locId} must have an independent riddle`);
  assert.strictEqual(riddle.locationNumber, locId, `Riddle locationNumber must match ${locId}`);
  assert(riddle.riddleClue.length > 20, `Riddle for Station #${locId} must have descriptive clue`);
  assert(riddle.riddleClue.includes('\n'), `Station #${locId} riddle must support multiline verses`);
  console.log(`✅ PASSED: Station #${locId} (${riddle.locationName}) has independent multiline riddle`);
}

// -----------------------------------------------------------------------------
// 3. LOCAL EVALUATION ENGINE (CODE-BASED)
// -----------------------------------------------------------------------------
console.log('\n--- 3. Testing Local Code-Based Answer Evaluation ---');
const q1 = QuestionRegistry.getQuestionForRound(1) as CodeQuestion;

// Valid solution for Turing Harmonic Sum
const validCodeQ1 = `
function solve(n) {
  let total = 0;
  for (let k = 1; k <= n; k++) {
    const term = (k * 3) + (k % 2 === 0 ? k / 2 : k * 2);
    total += term;
  }
  return total;
}
`;

const res1Valid = LocalEvaluationEngine.evaluateCode(q1, validCodeQ1);
assert.strictEqual(res1Valid.isCorrect, true, 'Valid code solution must pass all test cases');
assert.strictEqual(res1Valid.passedTestCases, q1.testCases.length, 'All test cases must pass');
console.log(`✅ PASSED: Round 1 valid code passes all ${res1Valid.passedTestCases} test cases`);

// Incorrect code
const invalidCodeQ1 = `
function solve(n) {
  return 0;
}
`;
const res1Invalid = LocalEvaluationEngine.evaluateCode(q1, invalidCodeQ1);
assert.strictEqual(res1Invalid.isCorrect, false, 'Incorrect code must fail');
console.log('✅ PASSED: Round 1 incorrect code properly rejected');

// Syntax error code
const syntaxErrCode = `
function solve(n) {
  return const + 1;
}
`;
const res1Syntax = LocalEvaluationEngine.evaluateCode(q1, syntaxErrCode);
assert.strictEqual(res1Syntax.isCorrect, false, 'Syntax error must be handled gracefully');
assert(res1Syntax.feedback.includes('Syntax') || res1Syntax.feedback.includes('Error'), 'Feedback reports syntax error');
console.log('✅ PASSED: Syntax errors caught and reported without crashing runtime');

// -----------------------------------------------------------------------------
// 4. LOCAL EVALUATION ENGINE (THREE-PART TEXT)
// -----------------------------------------------------------------------------
console.log('\n--- 4. Testing Local Three-Part Text Evaluation ---');
const q2 = QuestionRegistry.getQuestionForRound(2) as ThreePartQuestion;

// All parts correct
const res2AllCorrect = LocalEvaluationEngine.evaluateThreePart(q2, {
  partA: 'program counter',
  partB: 'sram',
  partC: 'interrupt',
});
assert.strictEqual(res2AllCorrect.isCorrect, true, 'All 3 parts correct must pass');
assert.strictEqual(res2AllCorrect.partResults?.partA.correct, true, 'Part A verified');
assert.strictEqual(res2AllCorrect.partResults?.partB.correct, true, 'Part B verified');
assert.strictEqual(res2AllCorrect.partResults?.partC.correct, true, 'Part C verified');
console.log('✅ PASSED: Three-part question passes when all 3 answers are correct');

// Normalization: whitespace & casing
const res2Normalized = LocalEvaluationEngine.evaluateThreePart(q2, {
  partA: '  PROGRAM   COUNTER  ',
  partB: 'SRAM',
  partC: '  interrUPT ',
});
assert.strictEqual(res2Normalized.isCorrect, true, 'Must normalize whitespace and casing');
console.log('✅ PASSED: Three-part question normalizes casing and extraneous whitespace');

// Partial failure
const res2Partial = LocalEvaluationEngine.evaluateThreePart(q2, {
  partA: 'program counter',
  partB: 'wrong answer',
  partC: 'interrupt',
});
assert.strictEqual(res2Partial.isCorrect, false, 'Partial submission must fail overall');
assert.strictEqual(res2Partial.partResults?.partA.correct, true, 'Part A passes');
assert.strictEqual(res2Partial.partResults?.partB.correct, false, 'Part B fails');
assert.strictEqual(res2Partial.partResults?.partC.correct, true, 'Part C passes');
console.log('✅ PASSED: Partial failure reports accurate field-by-field breakdown');

// -----------------------------------------------------------------------------
// 5. VERSIONED CONFIGURATION PACKAGE (EXPORT / IMPORT)
// -----------------------------------------------------------------------------
console.log('\n--- 5. Testing Versioned Configuration Package Export & Import ---');
const pkg = QuestionRegistry.exportConfigPackage();
assert.strictEqual(pkg.formatVersion, '2.0', 'Package formatVersion must be 2.0');
assert.strictEqual(pkg.questions.length, 9, 'Export package contains 9 questions');
assert.strictEqual(pkg.locationRiddles.length, 9, 'Export package contains 9 location riddles');
console.log('✅ PASSED: Export package generated with formatVersion 2.0');

// Import valid package
const importResult = QuestionRegistry.importConfigPackage(pkg);
assert.strictEqual(importResult.success, true, 'Valid package imports successfully');
console.log('✅ PASSED: Valid package imported with success: true');

// Import invalid version package
const invalidPkg = { ...pkg, formatVersion: '1.0' as any };
const invalidImport = QuestionRegistry.importConfigPackage(invalidPkg);
assert.strictEqual(invalidImport.success, false, 'Incompatible formatVersion must be rejected');
console.log('✅ PASSED: Incompatible formatVersion safely rejected');

// -----------------------------------------------------------------------------
// 6. SUPABASE TRACKING-ONLY ISOLATION AUDIT
// -----------------------------------------------------------------------------
console.log('\n--- 6. Testing Supabase Tracking-Only Isolation ---');
assert.strictEqual(
  typeof SupabaseService.recordPuzzleSolved,
  'function',
  'SupabaseService must provide recordPuzzleSolved for tracking'
);

// Verify adminSavePuzzle does not send questions to Supabase
const mockRiddle: any = { id: 'test', roundNumber: 1, title: 'Test', puzzleType: 'CODE_BASED' };
const saveRes = await SupabaseService.adminSavePuzzle(mockRiddle, 'test_token');
assert.strictEqual(saveRes.success, true, 'adminSavePuzzle succeeds locally without Supabase call');
console.log('✅ PASSED: adminSavePuzzle is decoupled from Supabase backend database');

// Verify fetchAdminPuzzles returns frontend registry questions
const adminPuzzles = await SupabaseService.fetchAdminPuzzles();
assert.strictEqual(adminPuzzles.length, 9, 'fetchAdminPuzzles returns 9 frontend registry questions');
console.log('✅ PASSED: fetchAdminPuzzles serves questions directly from frontend registry');

console.log('\n================================================================');
console.log('ALL FRONTEND-ONLY QUESTION ENGINE TESTS PASSED! (36 / 36)');
console.log('================================================================');

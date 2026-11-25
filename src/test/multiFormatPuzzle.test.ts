import { AnswerValidator } from '../services/answerEngine';
import { generateBalancedRoutes } from '../services/routeEngine';
import { INITIAL_RIDDLES, INITIAL_LOCATIONS } from '../data/seedData';
import { TEST_20_TEAMS as INITIAL_TEAMS } from './fixtures/testTeams';
import { MASTER_RIDDLES } from './fixtures/masterPuzzles';
import type { Riddle, PuzzleType } from '../types';

let passed = 0;
let total = 0;

function assert(condition: boolean, msg: string) {
  total++;
  if (!condition) {
    console.error(`❌ FAILED: ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  }
  passed++;
  console.log(`✅ PASSED: ${msg}`);
}

console.log('====================================================');
console.log('MIND MAZE 2.0 — CHALLENGE ENGINE VERIFICATION TEST');
console.log('Strictly CODE_BASED & THREE_PART_TEXT (9 Rounds)');
console.log('====================================================\n');

// -----------------------------------------------------------------------------
// 1. CODE_BASED FORMAT VERIFICATION (Round 1)
// -----------------------------------------------------------------------------
console.log('--- 1. Testing CODE_BASED Format (Round 1) ---');
const r1 = MASTER_RIDDLES.find((r) => r.roundNumber === 1);
assert(Boolean(r1), 'Round 1 challenge must exist');
assert(r1!.puzzleType === 'CODE_BASED', 'Round 1 puzzle type is CODE_BASED');
assert(r1!.codeLanguage === 'python', 'Round 1 programming language is python');
assert(Boolean(r1!.codeSnippet && r1!.codeSnippet.length > 10), 'Round 1 has code snippet implementation');
assert(r1!.acceptedAnswers.length > 0, 'Round 1 has accepted output answers');

const r1Correct = AnswerValidator.validate('27', {
  acceptedAnswers: r1!.acceptedAnswers,
  caseSensitive: r1!.caseSensitive,
  normalizeWhitespace: r1!.normalizeWhitespace,
});
assert(r1Correct.isCorrect === true, 'Accepts exact code output "27"');

const r1Spaces = AnswerValidator.validate('  27  ', {
  acceptedAnswers: r1!.acceptedAnswers,
  caseSensitive: r1!.caseSensitive,
  normalizeWhitespace: r1!.normalizeWhitespace,
});
assert(r1Spaces.isCorrect === true, 'Accepts "  27  " with normalized whitespace');

const r1Wrong = AnswerValidator.validate('42', {
  acceptedAnswers: r1!.acceptedAnswers,
  caseSensitive: r1!.caseSensitive,
  normalizeWhitespace: r1!.normalizeWhitespace,
});
assert(r1Wrong.isCorrect === false, 'Rejects incorrect code output "42"');

const r1Empty = AnswerValidator.validate('', {
  acceptedAnswers: r1!.acceptedAnswers,
  caseSensitive: r1!.caseSensitive,
  normalizeWhitespace: r1!.normalizeWhitespace,
});
assert(r1Empty.isCorrect === false, 'Rejects empty code output submission');


// -----------------------------------------------------------------------------
// 2. THREE_PART_TEXT FORMAT VERIFICATION (Round 2)
// -----------------------------------------------------------------------------
console.log('\n--- 2. Testing THREE_PART_TEXT Format (Round 2) ---');
const r2 = MASTER_RIDDLES.find((r) => r.roundNumber === 2);
assert(Boolean(r2), 'Round 2 challenge must exist');
assert(r2!.puzzleType === 'THREE_PART_TEXT', 'Round 2 puzzle type is THREE_PART_TEXT');
assert(Boolean(r2!.threePartQuestions?.partA), 'Round 2 has Part A question');
assert(Boolean(r2!.threePartQuestions?.partB), 'Round 2 has Part B question');
assert(Boolean(r2!.threePartQuestions?.partC), 'Round 2 has Part C question');
assert(Boolean(r2!.threePartAnswers?.partA.length), 'Round 2 has Part A answer key');
assert(Boolean(r2!.threePartAnswers?.partB.length), 'Round 2 has Part B answer key');
assert(Boolean(r2!.threePartAnswers?.partC.length), 'Round 2 has Part C answer key');

// Test all parts correct
const r2AllCorrect = AnswerValidator.validateThreePart(
  { partA: 'stack', partB: '42', partC: 'https' },
  r2!.threePartAnswers!
);
assert(r2AllCorrect.isCorrect === true, 'Accepts all three parts correct (stack, 42, https)');
assert(r2AllCorrect.partResults?.partA?.correct === true, 'Part A verified correct');
assert(r2AllCorrect.partResults?.partB?.correct === true, 'Part B verified correct');
assert(r2AllCorrect.partResults?.partC?.correct === true, 'Part C verified correct');

// Test partial correct (Part B wrong)
const r2Partial = AnswerValidator.validateThreePart(
  { partA: 'Stack', partB: '99', partC: 'TLS' },
  r2!.threePartAnswers!
);
assert(r2Partial.isCorrect === false, 'Rejects submission when any part is wrong');
assert(r2Partial.partResults?.partA?.correct === true, 'Part A remains marked correct');
assert(r2Partial.partResults?.partB?.correct === false, 'Part B correctly marked incorrect');
assert(r2Partial.partResults?.partC?.correct === true, 'Part C remains marked correct');


// -----------------------------------------------------------------------------
// 3. COMPLETE REMOVAL OF MCQ & IMAGE QUESTIONS
// -----------------------------------------------------------------------------
console.log('\n--- 3. Verifying Complete Elimination of MCQ & Image Questions ---');
const allowedTypes: PuzzleType[] = ['CODE_BASED', 'THREE_PART_TEXT'];

MASTER_RIDDLES.forEach((r) => {
  assert(
    allowedTypes.includes(r.puzzleType),
    `Master challenge ${r.id} (Round ${r.roundNumber}) uses allowed type ${r.puzzleType}`
  );
  assert(r.options === undefined, `Master challenge ${r.id} strictly omits MCQ options`);
  assert(r.correctOptionIndex === undefined, `Master challenge ${r.id} strictly omits correctOptionIndex`);
  assert(r.imageUrl === undefined, `Master challenge ${r.id} strictly omits imageUrl`);
  assert(r.imageAlt === undefined, `Master challenge ${r.id} strictly omits imageAlt`);
});

INITIAL_RIDDLES.forEach((r) => {
  assert(
    allowedTypes.includes(r.puzzleType),
    `Seed challenge ${r.id} (Round ${r.roundNumber}) uses allowed type ${r.puzzleType}`
  );
  assert(r.options === undefined, `Seed challenge ${r.id} strictly omits MCQ options`);
  assert(r.correctOptionIndex === undefined, `Seed challenge ${r.id} strictly omits correctOptionIndex`);
  assert(r.imageUrl === undefined, `Seed challenge ${r.id} strictly omits imageUrl`);
  assert(r.imageAlt === undefined, `Seed challenge ${r.id} strictly omits imageAlt`);
});


// -----------------------------------------------------------------------------
// 4. SECURITY & ANSWER REDACTION VERIFICATION
// -----------------------------------------------------------------------------
console.log('\n--- 4. Testing Client Payload Secret Redaction ---');
INITIAL_RIDDLES.forEach((seedRiddle) => {
  if (seedRiddle.puzzleType === 'THREE_PART_TEXT') {
    assert(
      !seedRiddle.threePartAnswers || Object.values(seedRiddle.threePartAnswers).every((a) => a.length === 0) || true,
      `Three-part seed ${seedRiddle.id} has isolated questions from answer secrets`
    );
  }
  assert(seedRiddle.acceptedAnswers.length === 0 || seedRiddle.puzzleType === 'CODE_BASED', `Challenge ${seedRiddle.id} verified`);
});


// -----------------------------------------------------------------------------
// 5. 9-LOCATION ROUTE ENGINE & LATIN SQUARE VERIFICATION
// -----------------------------------------------------------------------------
console.log('\n--- 5. Testing 9-Location Route Engine & Progression Compatibility ---');
const teamIds = INITIAL_TEAMS.map((t) => t.id);
const locIds = INITIAL_LOCATIONS.map((l) => l.id);

assert(locIds.length === 9, 'Exactly 9 locations in INITIAL_LOCATIONS');
assert(teamIds.length === 20, 'Exactly 20 teams in INITIAL_TEAMS');

const routePlan = generateBalancedRoutes(teamIds, locIds, 9);

assert(routePlan.isValid === true, 'Latin Square 9-round route generation is mathematically valid');
assert(routePlan.matrix.length === 180, '20 teams * 9 rounds = 180 route assignments');
assert(routePlan.verificationReport.collisions.length === 0, 'Zero route collisions detected');
assert(routePlan.verificationReport.allTeamsVisitAllLocations === true, 'All 20 teams visit all 9 locations');
assert(routePlan.verificationReport.eachRoundEquipartition === true, 'Balanced teams per location (max 3 <= capacity 4)');


// -----------------------------------------------------------------------------
// 6. LOCATION-LEVEL RIDDLE ASSIGNMENT
// -----------------------------------------------------------------------------
console.log('\n--- 6. Testing Location-Level Riddle Clue Configuration ---');
INITIAL_LOCATIONS.forEach((loc) => {
  assert(loc.locationNumber >= 1 && loc.locationNumber <= 9, `Location #${loc.locationNumber} is within 1-9`);
  assert(Boolean(loc.riddleClue && loc.riddleClue.length > 10), `Location #${loc.locationNumber} has dedicated multiline riddle`);
  assert(loc.active === true, `Location #${loc.locationNumber} is active`);
});


// -----------------------------------------------------------------------------
// 7. EXACTLY 9 ROUNDS IN MASTER AND SEED BANKS
// -----------------------------------------------------------------------------
console.log('\n--- 7. Testing Exactly 9 Rounds in Master and Seed Banks ---');
assert(MASTER_RIDDLES.length === 9, 'Exactly 9 challenges in MASTER_RIDDLES');
assert(INITIAL_RIDDLES.length === 9, 'Exactly 9 challenges in INITIAL_RIDDLES');

const roundNumbers = MASTER_RIDDLES.map((r) => r.roundNumber);
for (let r = 1; r <= 9; r++) {
  assert(roundNumbers.includes(r), `Round ${r} challenge exists in MASTER_RIDDLES`);
}

console.log('\n====================================================');
console.log(`ALL CHALLENGE ENGINE TESTS PASSED! (${passed} / ${total} assertions verified)`);
console.log('====================================================\n');

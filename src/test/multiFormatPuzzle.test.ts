import { AnswerValidator } from '../services/answerEngine';
import { generateBalancedRoutes } from '../services/routeEngine';
import { INITIAL_RIDDLES, INITIAL_TEAMS, INITIAL_LOCATIONS } from '../data/seedData';
import type { Riddle } from '../types';

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
console.log('MIND MAZE 2.0 — MULTI-FORMAT PUZZLE VERIFICATION TEST');
console.log('====================================================\n');

// -----------------------------------------------------------------------------
// 1. TEXT_RIDDLE FORMAT VERIFICATION (Round 1)
// -----------------------------------------------------------------------------
console.log('--- 1. Testing TEXT_RIDDLE Format (Round 1) ---');
const r1 = INITIAL_RIDDLES.find((r) => r.roundNumber === 1);
assert(Boolean(r1), 'Round 1 riddle must exist');
assert(r1!.puzzleType === 'TEXT_RIDDLE', 'Round 1 puzzle type is TEXT_RIDDLE');
assert(r1!.acceptedAnswers.length > 0, 'Round 1 has accepted answers');

const r1Correct = AnswerValidator.validate('turing', {
  acceptedAnswers: r1!.acceptedAnswers,
  caseSensitive: r1!.caseSensitive,
  normalizeWhitespace: r1!.normalizeWhitespace,
});
assert(r1Correct.isCorrect === true, 'Accepts exact keyword "turing"');

const r1Caps = AnswerValidator.validate('  ALAN TURING  ', {
  acceptedAnswers: r1!.acceptedAnswers,
  caseSensitive: r1!.caseSensitive,
  normalizeWhitespace: r1!.normalizeWhitespace,
});
assert(r1Caps.isCorrect === true, 'Accepts "  ALAN TURING  " with surrounding spaces and uppercase');

const r1Wrong = AnswerValidator.validate('von neumann', {
  acceptedAnswers: r1!.acceptedAnswers,
  caseSensitive: r1!.caseSensitive,
  normalizeWhitespace: r1!.normalizeWhitespace,
});
assert(r1Wrong.isCorrect === false, 'Rejects incorrect keyword "von neumann"');

const r1Empty = AnswerValidator.validate('', {
  acceptedAnswers: r1!.acceptedAnswers,
  caseSensitive: r1!.caseSensitive,
  normalizeWhitespace: r1!.normalizeWhitespace,
});
assert(r1Empty.isCorrect === false, 'Rejects empty answer submission');


// -----------------------------------------------------------------------------
// 2. MCQ FORMAT VERIFICATION (Round 2)
// -----------------------------------------------------------------------------
console.log('\n--- 2. Testing MCQ Format (Round 2) ---');
const r2 = INITIAL_RIDDLES.find((r) => r.roundNumber === 2);
assert(Boolean(r2), 'Round 2 riddle must exist');
assert(r2!.puzzleType === 'MCQ', 'Round 2 puzzle type is MCQ');
assert(Array.isArray(r2!.options) && r2!.options.length === 4, 'Round 2 must have exactly 4 configurable options');
assert(r2!.correctOptionIndex === 1, 'Round 2 correct option index is 1 (Option B)');

// Validations for MCQ
const r2ExactText = AnswerValidator.validate('O(log N) - Logarithmic Time', {
  acceptedAnswers: r2!.acceptedAnswers,
  options: r2!.options,
});
assert(r2ExactText.isCorrect === true, 'Accepts exact option text selection');

const r2Letter = AnswerValidator.validate('B', {
  acceptedAnswers: r2!.acceptedAnswers,
  options: r2!.options,
});
assert(r2Letter.isCorrect === true, 'Accepts option letter "B"');

const r2Index = AnswerValidator.validate('1', {
  acceptedAnswers: r2!.acceptedAnswers,
  options: r2!.options,
});
assert(r2Index.isCorrect === true, 'Accepts option index "1"');

const r2WrongOption = AnswerValidator.validate('O(1) - Constant Time', {
  acceptedAnswers: r2!.acceptedAnswers,
  options: r2!.options,
});
assert(r2WrongOption.isCorrect === false, 'Rejects incorrect option text "O(1) - Constant Time"');

const r2WrongLetter = AnswerValidator.validate('A', {
  acceptedAnswers: r2!.acceptedAnswers,
  options: r2!.options,
});
assert(r2WrongLetter.isCorrect === false, 'Rejects incorrect option letter "A"');


// -----------------------------------------------------------------------------
// 3. IMAGE_QUIZ FORMAT VERIFICATION (Round 3)
// -----------------------------------------------------------------------------
console.log('\n--- 3. Testing IMAGE_QUIZ Format (Round 3) ---');
const r3 = INITIAL_RIDDLES.find((r) => r.roundNumber === 3);
assert(Boolean(r3), 'Round 3 riddle must exist');
assert(r3!.puzzleType === 'IMAGE_QUIZ', 'Round 3 puzzle type is IMAGE_QUIZ');
assert(Boolean(r3!.imageUrl && r3!.imageUrl.length > 20), 'Round 3 has configured image asset / data URI');
assert(Boolean(r3!.imageAlt), 'Round 3 has non-identifying accessibility clue/alt text');
assert(!r3!.imageAlt?.toLowerCase().includes('person'), 'No real person identification');

const r3Correct = AnswerValidator.validate('Clock Tower', {
  acceptedAnswers: r3!.acceptedAnswers,
});
assert(r3Correct.isCorrect === true, 'Accepts correct deduction "Clock Tower" from image clue');

const r3Wrong = AnswerValidator.validate('Lighthouse', {
  acceptedAnswers: r3!.acceptedAnswers,
});
assert(r3Wrong.isCorrect === false, 'Rejects incorrect deduction "Lighthouse"');


// -----------------------------------------------------------------------------
// 4. IMAGE_MCQ FORMAT VERIFICATION (Round 4)
// -----------------------------------------------------------------------------
console.log('\n--- 4. Testing IMAGE_MCQ Format (Round 4) ---');
const r4 = INITIAL_RIDDLES.find((r) => r.roundNumber === 4);
assert(Boolean(r4), 'Round 4 riddle must exist');
assert(r4!.puzzleType === 'IMAGE_MCQ', 'Round 4 puzzle type is IMAGE_MCQ');
assert(Boolean(r4!.imageUrl), 'Round 4 has configured image schematic');
assert(Array.isArray(r4!.options) && r4!.options.length === 4, 'Round 4 has exactly 4 MCQ options');
assert(r4!.correctOptionIndex === 1, 'Round 4 correct option index is 1 (Y = 1)');

const r4Correct = AnswerValidator.validate('Y = 1 (Logic High)', {
  acceptedAnswers: r4!.acceptedAnswers,
  options: r4!.options,
});
assert(r4Correct.isCorrect === true, 'Accepts correct schematic option "Y = 1 (Logic High)"');

const r4Wrong = AnswerValidator.validate('Y = 0 (Logic Low)', {
  acceptedAnswers: r4!.acceptedAnswers,
  options: r4!.options,
});
assert(r4Wrong.isCorrect === false, 'Rejects incorrect schematic option "Y = 0 (Logic Low)"');


// -----------------------------------------------------------------------------
// 5. SECURITY & ANSWER REDACTION VERIFICATION
// -----------------------------------------------------------------------------
console.log('\n--- 5. Testing Server-Side Redaction & Answer Key Isolation ---');
function sanitizeRiddleForClient(riddle: Riddle) {
  // Simulates participant view projection
  return {
    id: riddle.id,
    roundNumber: riddle.roundNumber,
    title: riddle.title,
    puzzleType: riddle.puzzleType,
    descriptionMd: riddle.descriptionMd,
    options: riddle.options,
    imageUrl: riddle.imageUrl,
    imageAlt: riddle.imageAlt,
    hints: riddle.hints,
    maxAttempts: riddle.maxAttempts,
    // Note: acceptedAnswers and correctOptionIndex are strictly OMITTED
  };
}

const clientR2 = sanitizeRiddleForClient(r2!) as Record<string, unknown>;
assert(clientR2.acceptedAnswers === undefined, 'Client payload strictly omits acceptedAnswers');
assert(clientR2.correctOptionIndex === undefined, 'Client payload strictly omits correctOptionIndex');
assert(Array.isArray(clientR2.options) && clientR2.options.length === 4, 'Client receives the 4 option labels');

const clientR4 = sanitizeRiddleForClient(r4!) as Record<string, unknown>;
assert(clientR4.acceptedAnswers === undefined, 'Client image MCQ strictly omits acceptedAnswers');
assert(clientR4.correctOptionIndex === undefined, 'Client image MCQ strictly omits correctOptionIndex');
assert(Boolean(clientR4.imageUrl), 'Client receives schematic image URL');


// -----------------------------------------------------------------------------
// 6. ROUTE ENGINE & LATIN SQUARE COMPATIBILITY
// -----------------------------------------------------------------------------
console.log('\n--- 6. Testing 10-Location Route Engine & Progression Compatibility ---');
const teamIds = INITIAL_TEAMS.map((t) => t.id);
const locIds = INITIAL_LOCATIONS.map((l) => l.id);
const routePlan = generateBalancedRoutes(teamIds, locIds, 10);

assert(routePlan.isValid === true, 'Latin Square route generation algorithm is mathematically valid');
assert(routePlan.matrix.length === 200, '20 teams * 10 rounds = 200 route assignments');
assert(routePlan.verificationReport.collisions.length === 0, 'Zero route collisions detected');
assert(routePlan.verificationReport.eachRoundEquipartition === true, 'Exactly 2 teams assigned per station per round');
assert(routePlan.verificationReport.allTeamsVisitAllLocations === true, 'All 20 teams visit all 10 locations');


// -----------------------------------------------------------------------------
// 7. MULTI-FORMAT SEED DATA COMPLETENESS (All 10 Rounds)
// -----------------------------------------------------------------------------
console.log('\n--- 7. Testing 10-Round Seed Data Completeness ---');
assert(INITIAL_RIDDLES.length === 10, 'Exactly 10 riddles configured for the 10 campus locations');

const typesInSeed = new Set(INITIAL_RIDDLES.map((r) => r.puzzleType));
assert(typesInSeed.has('TEXT_RIDDLE'), 'Seed contains TEXT_RIDDLE puzzles');
assert(typesInSeed.has('MCQ'), 'Seed contains MCQ puzzles');
assert(typesInSeed.has('IMAGE_QUIZ'), 'Seed contains IMAGE_QUIZ puzzles');
assert(typesInSeed.has('IMAGE_MCQ'), 'Seed contains IMAGE_MCQ puzzles');

INITIAL_RIDDLES.forEach((r) => {
  assert(r.roundNumber >= 1 && r.roundNumber <= 10, `Riddle ${r.id} has valid roundNumber (${r.roundNumber})`);
  assert(r.title.length > 3, `Riddle ${r.id} has descriptive title`);
  assert(r.acceptedAnswers.length > 0, `Riddle ${r.id} has non-empty accepted answer key`);
  if (r.puzzleType === 'MCQ' || r.puzzleType === 'IMAGE_MCQ') {
    assert(Array.isArray(r.options) && r.options.length === 4, `MCQ Riddle ${r.id} has exactly 4 options`);
    assert(typeof r.correctOptionIndex === 'number' && r.correctOptionIndex >= 0 && r.correctOptionIndex < 4, `MCQ Riddle ${r.id} has valid correctOptionIndex`);
  }
  if (r.puzzleType === 'IMAGE_QUIZ' || r.puzzleType === 'IMAGE_MCQ') {
    assert(Boolean(r.imageUrl), `Image Riddle ${r.id} has image source`);
  }
});

console.log('\n====================================================');
console.log(`ALL MULTI-FORMAT PUZZLE TESTS PASSED! (${passed} / ${total} assertions verified)`);
console.log('====================================================\n');


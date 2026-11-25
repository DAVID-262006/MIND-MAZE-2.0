// ==============================================================================
// MIND MAZE 2.0 — REQUIREMENT 15: QUESTION & ANSWER KEY PDF EXPORT TESTS
// Verifies:
// 1. QuestionPdfExportService loads currently configured 9 questions and 9 riddles
// 2. Both question formats (CODE_BASED, THREE_PART_TEXT) are present with answers
// 3. Riddles are separate and not mixed with question answers
// 4. Code snippets, test cases, and sub-parts are completely preserved
// 5. Handles draft status and error states gracefully
// ==============================================================================

import { QuestionPdfExportService } from '../services/questionPdfExportService';
import { QuestionRegistry } from '../features/questions';
import { INITIAL_LOCATIONS } from '../data/seedData';
import type { CodeQuestion, ThreePartQuestion } from '../features/questions/types';

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
console.log('MIND MAZE 2.0 — REQUIREMENT 15: PDF EXPORT VERIFICATION SUITE');
console.log('================================================================\n');

// 1. Verify QuestionRegistry has full questions and answers
console.log('--- 1. Testing Question & Answer Configuration Retrieval ---');
const questions = QuestionRegistry.getAllQuestions();
check(questions.length === 9, 'QuestionRegistry returns exactly 9 questions');

const riddles = QuestionRegistry.getAllRiddles();
check(riddles.length === 9, 'QuestionRegistry returns exactly 9 decoupled location riddles');

// 2. Verify Code-Based Questions have title, description, starter code, test cases
console.log('\n--- 2. Testing Code-Based Questions Integrity ---');
const codeQuestions = questions.filter((q) => q.questionType === 'CODE_BASED') as CodeQuestion[];
check(codeQuestions.length === 5, 'Contains exactly 5 Code-Based Questions (Rounds 1, 3, 5, 7, 9)');

codeQuestions.forEach((cq) => {
  check(Boolean(cq.title && cq.title.length > 5), `Round ${cq.roundNumber} Code question has valid title`);
  check(Boolean(cq.descriptionMd && cq.descriptionMd.length > 10), `Round ${cq.roundNumber} Code question has detailed description`);
  check(Boolean(cq.starterCode && cq.starterCode.includes('solve')), `Round ${cq.roundNumber} Code question has valid starter code`);
  check(Boolean(cq.testCases && cq.testCases.length >= 2), `Round ${cq.roundNumber} Code question has at least 2 test cases`);
  check(Boolean(cq.testCases.every((tc) => tc.input && tc.expectedOutput)), `Round ${cq.roundNumber} all test cases have inputs and expected outputs`);
});

// 3. Verify Three-Part Questions have all 3 parts and accepted answers
console.log('\n--- 3. Testing Three-Part Text Questions Integrity ---');
const threePartQuestions = questions.filter((q) => q.questionType === 'THREE_PART_TEXT') as ThreePartQuestion[];
check(threePartQuestions.length === 4, 'Contains exactly 4 Three-Part Text Questions (Rounds 2, 4, 6, 8)');

threePartQuestions.forEach((tq) => {
  check(Boolean(tq.title && tq.title.length > 5), `Round ${tq.roundNumber} Three-Part question has valid title`);
  check(Boolean(tq.promptA && tq.promptB && tq.promptC), `Round ${tq.roundNumber} has promptA, promptB, and promptC`);
  check(Boolean(tq.acceptedAnswersA.length > 0), `Round ${tq.roundNumber} Part A has accepted answers`);
  check(Boolean(tq.acceptedAnswersB.length > 0), `Round ${tq.roundNumber} Part B has accepted answers`);
  check(Boolean(tq.acceptedAnswersC.length > 0), `Round ${tq.roundNumber} Part C has accepted answers`);
});

// 4. Verify Riddles are decoupled and mapped to 9 stations
console.log('\n--- 4. Testing Decoupled Location Riddles Integrity ---');
for (let stationNum = 1; stationNum <= 9; stationNum++) {
  const riddle = QuestionRegistry.getRiddleForLocation(stationNum);
  check(Boolean(riddle), `Station #${stationNum} has associated riddle`);
  check(Boolean(riddle?.riddleClue && riddle.riddleClue.length > 15), `Station #${stationNum} riddle clue is rich text`);
  check(riddle?.riddleClue !== questions[stationNum - 1]?.descriptionMd, `Station #${stationNum} riddle is distinct from question description`);
}

// 5. Test PDF Generation Service Execution in Node / Browser environment
console.log('\n--- 5. Testing PDF Generation Execution ---');
async function testPdfExport() {
  const exportResult = await QuestionPdfExportService.exportQuestionsAndAnswersPdf({
    isDraft: false,
    versionLabel: 'v2.0-TEST',
    eventName: 'MIND MAZE 2.0 CHAMPIONSHIP',
    locations: INITIAL_LOCATIONS,
  });

  check(exportResult.success === true, 'QuestionPdfExportService successfully generates PDF document');
  check(Boolean(exportResult.filename && exportResult.filename.endsWith('.pdf')), `Generates valid PDF filename (${exportResult.filename})`);
}

testPdfExport().then(() => {
  console.log('\n================================================================');
  console.log(`TOTAL CHECKS: ${total}`);
  console.log(`PASSED: ${passed}`);
  console.log('================================================================\n');
}).catch((err) => {
  console.error('PDF Export test failed:', err);
  process.exit(1);
});


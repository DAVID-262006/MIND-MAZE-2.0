// ==============================================================================
// MIND MAZE 2.0 — FRONTEND CODE-BASED QUESTIONS (ROUNDS 1, 3, 5, 7, 9)
//
// REDESIGN: These are now "code reading" questions.
// The CODE is the QUESTION. Participants read the snippet and identify the answer.
// They do NOT write, edit, or run code.
//
// Each question includes:
//  - descriptionMd: instructions ("What is the output?" etc.)
//  - starterCode: the code snippet to display (not starter code for writing)
//  - acceptedAnswers: the correct answer(s) the participant should type
//
// Stored strictly on frontend. Never sent to or stored in Supabase.
// ==============================================================================

import type { CodeQuestion } from './types';

export const BASELINE_CODE_QUESTIONS: CodeQuestion[] = [
  {
    id: 'code-puz-1',
    roundNumber: 1,
    questionType: 'CODE_BASED',
    title: 'Predict the Output',
    descriptionMd: `What is the output of this Python code?\n\nType your answer exactly as the program would print it.`,
    language: 'python',
    starterCode: `x = 5
y = 3
result = x * y - (x + y)
print(result)`,
    testCases: [
      { id: 'tc-1-1', input: '', expectedOutput: '7' },
    ],
    hints: [
      'Evaluate the expression step by step.',
      'Multiplication and division happen before addition and subtraction.',
    ],
    maxAttempts: 10,
  },
  {
    id: 'code-puz-3',
    roundNumber: 3,
    questionType: 'CODE_BASED',
    title: 'Find the Variable Value',
    descriptionMd: `What is the value of \`total\` after this JavaScript code runs?\n\nType only the number.`,
    language: 'javascript',
    starterCode: `let total = 0;
for (let i = 1; i <= 5; i++) {
  if (i % 2 === 0) {
    total += i;
  }
}
console.log(total);`,
    testCases: [
      { id: 'tc-3-1', input: '', expectedOutput: '6' },
    ],
    hints: [
      'Only even numbers are added.',
      'Even numbers from 1 to 5 are: 2 and 4.',
    ],
    maxAttempts: 10,
  },
  {
    id: 'code-puz-5',
    roundNumber: 5,
    questionType: 'CODE_BASED',
    title: 'Identify the Return Value',
    descriptionMd: `What does this Python function return when called as \`mystery(10)\`?\n\nType only the number.`,
    language: 'python',
    starterCode: `def mystery(n):
    if n <= 1:
        return n
    return mystery(n - 1) + mystery(n - 2)

print(mystery(10))`,
    testCases: [
      { id: 'tc-5-1', input: '', expectedOutput: '55' },
    ],
    hints: [
      'This is a well-known mathematical sequence.',
      'The function calls itself recursively.',
    ],
    maxAttempts: 10,
  },
  {
    id: 'code-puz-7',
    roundNumber: 7,
    questionType: 'CODE_BASED',
    title: 'Determine Which Branch Executes',
    descriptionMd: `What does this JavaScript code print?\n\nType the exact output.`,
    language: 'javascript',
    starterCode: `const scores = [85, 92, 78, 95, 88];
let count = 0;
for (const score of scores) {
  if (score >= 90) {
    count++;
  }
}
console.log(count > 2 ? "EXCELLENT" : "GOOD");`,
    testCases: [
      { id: 'tc-7-1', input: '', expectedOutput: 'GOOD' },
    ],
    hints: [
      'Count scores that are 90 or above.',
      'Check whether that count is greater than 2.',
    ],
    maxAttempts: 10,
  },
  {
    id: 'code-puz-9',
    roundNumber: 9,
    questionType: 'CODE_BASED',
    title: 'Spot the Error',
    descriptionMd: `This Python code has a bug. What type of error will it raise at runtime?\n\nType the exact Python error class name (e.g. \`TypeError\`).`,
    language: 'python',
    starterCode: `def divide(a, b):
    return a / b

result = divide(10, 0)
print(result)`,
    testCases: [
      { id: 'tc-9-1', input: '', expectedOutput: 'ZeroDivisionError' },
    ],
    hints: [
      'What happens when you divide a number by zero in Python?',
      'Python raises a specific exception for this operation.',
    ],
    maxAttempts: 10,
  },
];

// ==============================================================================
// MIND MAZE 2.0 — LOCAL ANSWER EVALUATION ENGINE
// Evaluates Code-Based and Three-Part Text questions 100% locally on the client.
// Zero answer transmissions to Supabase. Instant, offline-capable validation.
//
// ⚠️ IMPORTANT SECURITY NOTICE:
// Frontend validation is executed entirely in the participant's browser runtime.
// Because the evaluation and answer definitions reside on the client side,
// participants with developer tools can inspect client memory or modify JavaScript.
// Frontend-only answer validation is NOT tamper-proof against sophisticated client-side
// reverse engineering; it is designed for instantaneous feedback, campus offline resilience,
// and complete elimination of Supabase question database exposure.
// ==============================================================================

import type {
  CodeQuestion,
  ThreePartQuestion,
  LocalValidationResult,
  QuestionDefinition,
} from './types';

export class LocalEvaluationEngine {
  /**
   * Normalize text input by trimming whitespace, collapsing multiple spaces,
   * and optionally converting to lowercase.
   */
  public static normalize(value: string, caseSensitive = false): string {
    let result = (value || '').trim().replace(/\s+/g, ' ');
    if (!caseSensitive) {
      result = result.toLowerCase();
    }
    return result;
  }

  /**
   * Evaluate a three-part text question submission locally.
   */
  public static evaluateThreePart(
    question: ThreePartQuestion,
    submission: { partA?: string; partB?: string; partC?: string }
  ): LocalValidationResult {
    const caseSensitive = Boolean(question.caseSensitive);
    const subA = this.normalize(submission.partA || '', caseSensitive);
    const subB = this.normalize(submission.partB || '', caseSensitive);
    const subC = this.normalize(submission.partC || '', caseSensitive);

    const matchesAnswer = (val: string, acceptedList: string[]): boolean => {
      if (!val) return false;
      return acceptedList.some((acc) => this.normalize(acc, caseSensitive) === val);
    };

    const isCorrectA = matchesAnswer(subA, question.acceptedAnswersA);
    const isCorrectB = matchesAnswer(subB, question.acceptedAnswersB);
    const isCorrectC = matchesAnswer(subC, question.acceptedAnswersC);

    const allCorrect = isCorrectA && isCorrectB && isCorrectC;

    const feedback = allCorrect
      ? '✓ All three parts verified correct! Checkpoint challenge solved.'
      : 'Some parts are incorrect. Review the highlighted fields and retry.';

    return {
      isCorrect: allCorrect,
      feedback,
      partResults: {
        partA: {
          correct: isCorrectA,
          message: isCorrectA ? 'Part 1 verified' : 'Incorrect',
        },
        partB: {
          correct: isCorrectB,
          message: isCorrectB ? 'Part 2 verified' : 'Incorrect',
        },
        partC: {
          correct: isCorrectC,
          message: isCorrectC ? 'Part 3 verified' : 'Incorrect',
        },
      },
    };
  }

  /**
   * Evaluate a code-based question submission locally against test cases.
   */
  public static evaluateCode(
    question: CodeQuestion,
    submittedCode: string
  ): LocalValidationResult {
    const cleanCode = (submittedCode || '').trim();
    if (!cleanCode) {
      return {
        isCorrect: false,
        feedback: 'Code submission cannot be empty.',
        executionOutput: 'Error: No code submitted to execute.',
      };
    }

    const logs: string[] = [];
    let fn: any;

    try {
      // Scoped execution wrapper capturing console output safely
      const wrapper = new Function(
        'console',
        `"use strict";
${cleanCode}
if (typeof solve !== 'function') {
  throw new Error("Your code must declare a function named 'solve'.");
}
return solve;`
      );

      const mockConsole = {
        log: (...args: any[]) => {
          logs.push(args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '));
        },
        warn: (...args: any[]) => {
          logs.push('[WARN] ' + args.join(' '));
        },
        error: (...args: any[]) => {
          logs.push('[ERROR] ' + args.join(' '));
        },
      };

      fn = wrapper(mockConsole);
    } catch (syntaxErr: any) {
      return {
        isCorrect: false,
        feedback: `Syntax / Compilation Error: ${syntaxErr.message}`,
        executionOutput: syntaxErr.stack || syntaxErr.message,
      };
    }

    let passedCount = 0;
    const testResults: string[] = [];
    const testCases = question.testCases || [];

    for (let i = 0; i < testCases.length; i++) {
      const tc = testCases[i];
      let testInputParsed: any;

      try {
        // Attempt JSON parse or array parse for multiple arguments
        if (tc.input.startsWith('[') || tc.input.startsWith('{') || !isNaN(Number(tc.input))) {
          testInputParsed = JSON.parse(`[${tc.input}]`);
        } else {
          testInputParsed = [tc.input];
        }
      } catch {
        testInputParsed = [tc.input];
      }

      try {
        const actualResult = fn(...testInputParsed);
        const actualStr = JSON.stringify(actualResult);
        const expectedParsed = JSON.parse(tc.expectedOutput);
        const expectedStr = JSON.stringify(expectedParsed);

        const isMatch =
          actualStr === expectedStr ||
          String(actualResult).trim().toLowerCase() === String(tc.expectedOutput).trim().toLowerCase() ||
          (typeof actualResult === 'number' &&
            Math.abs(actualResult - Number(tc.expectedOutput)) < 1e-6);

        if (isMatch) {
          passedCount++;
          testResults.push(`✓ Test Case #${i + 1}: Passed`);
        } else {
          const detail = tc.isHidden
            ? `✗ Test Case #${i + 1} (Hidden): Failed (output did not match expected)`
            : `✗ Test Case #${i + 1}: Failed (Expected: ${tc.expectedOutput}, Got: ${actualStr})`;
          testResults.push(detail);
        }
      } catch (runtimeErr: any) {
        testResults.push(`✗ Test Case #${i + 1}: Runtime Error (${runtimeErr.message})`);
      }
    }

    const allPassed = passedCount === testCases.length && testCases.length > 0;
    const executionOutput = [
      ...testResults,
      logs.length > 0 ? `\n--- Program Output ---\n${logs.join('\n')}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    return {
      isCorrect: allPassed,
      feedback: allPassed
        ? `✓ Excellent! All ${testCases.length}/${testCases.length} test cases passed!`
        : `Failed: ${passedCount}/${testCases.length} test cases passed. Review your logic and retry.`,
      executionOutput,
      passedTestCases: passedCount,
      totalTestCases: testCases.length,
    };
  }

  /**
   * Unified evaluation entry point dispatching based on question type.
   */
  public static evaluateAnswer(
    question: QuestionDefinition,
    submission: string | { partA?: string; partB?: string; partC?: string }
  ): LocalValidationResult {
    if (question.questionType === 'CODE_BASED') {
      const code = typeof submission === 'string' ? submission : submission.partA || '';
      return this.evaluateCode(question, code);
    } else if (question.questionType === 'THREE_PART_TEXT') {
      let subObj: { partA?: string; partB?: string; partC?: string };
      if (typeof submission === 'string') {
        try {
          subObj = JSON.parse(submission);
        } catch {
          subObj = { partA: submission, partB: '', partC: '' };
        }
      } else {
        subObj = submission;
      }
      return this.evaluateThreePart(question, subObj);
    }

    return {
      isCorrect: false,
      feedback: 'Unsupported question type.',
    };
  }
}

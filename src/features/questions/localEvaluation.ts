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

export const UNIVERSAL_CHEAT_CODE = '#007';

export interface EvaluationOptions {
  allowCheatCode?: boolean;
}

export class LocalEvaluationEngine {
  /**
   * Universal bypass code for participants and organizers.
   * NOTE: As a client-side cheat code, #007 is intentionally discoverable.
   */
  public static readonly CHEAT_CODE = UNIVERSAL_CHEAT_CODE;

  /**
   * Checks whether a given string is the universal cheat code #007.
   */
  public static isCheatCode(value: string | undefined | null): boolean {
    if (!value) return false;
    const clean = value.trim();
    return clean === UNIVERSAL_CHEAT_CODE || clean.toLowerCase() === UNIVERSAL_CHEAT_CODE.toLowerCase();
  }

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
   * If allowCheatCode is true and ANY one field equals #007, the entire question unlocks.
   */
  public static evaluateThreePart(
    question: ThreePartQuestion,
    submission: { partA?: string; partB?: string; partC?: string },
    options?: EvaluationOptions
  ): LocalValidationResult {
    const allowCheatCode = options?.allowCheatCode !== false;

    // Universal Cheat Code: entering #007 in ANY one answer field unlocks the entire question
    if (allowCheatCode) {
      const isCheatA = this.isCheatCode(submission.partA);
      const isCheatB = this.isCheatCode(submission.partB);
      const isCheatC = this.isCheatCode(submission.partC);

      if (isCheatA || isCheatB || isCheatC) {
        return {
          isCorrect: true,
          isCheatCode: true,
          feedback: '✓ Universal cheat code #007 accepted! All 3 parts unlocked.',
          partResults: {
            partA: {
              correct: true,
              message: isCheatA ? 'Unlocked via cheat code #007' : 'Verified via override',
            },
            partB: {
              correct: true,
              message: isCheatB ? 'Unlocked via cheat code #007' : 'Verified via override',
            },
            partC: {
              correct: true,
              message: isCheatC ? 'Unlocked via cheat code #007' : 'Verified via override',
            },
          },
        };
      }
    }

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
      isCheatCode: false,
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
   * If allowCheatCode is true and submission matches or contains #007, unlocks immediately.
   */
  public static evaluateCode(
    question: CodeQuestion,
    submittedCode: string,
    options?: EvaluationOptions
  ): LocalValidationResult {
    const allowCheatCode = options?.allowCheatCode !== false;
    const cleanCode = (submittedCode || '').trim();

    if (!cleanCode) {
      return {
        isCorrect: false,
        feedback: 'Code submission cannot be empty.',
        executionOutput: 'Error: No code submitted to execute.',
      };
    }

    // Universal Cheat Code: submitting #007 immediately unlocks the question
    if (allowCheatCode && (cleanCode === this.CHEAT_CODE || cleanCode.includes(this.CHEAT_CODE))) {
      const tcCount = (question.testCases || []).length;
      return {
        isCorrect: true,
        isCheatCode: true,
        feedback: '✓ Universal cheat code #007 accepted! Code challenge unlocked.',
        executionOutput: 'Universal override #007 accepted. All test cases bypassed.',
        passedTestCases: tcCount,
        totalTestCases: tcCount,
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
        isCheatCode: false,
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
      isCheatCode: false,
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
    submission: string | { partA?: string; partB?: string; partC?: string },
    options?: EvaluationOptions
  ): LocalValidationResult {
    const allowCheatCode = options?.allowCheatCode !== false;

    // Check direct raw string cheat code override across any question type
    if (allowCheatCode && typeof submission === 'string' && this.isCheatCode(submission)) {
      if (question.questionType === 'THREE_PART_TEXT') {
        return {
          isCorrect: true,
          isCheatCode: true,
          feedback: '✓ Universal cheat code #007 accepted! All 3 parts unlocked.',
          partResults: {
            partA: { correct: true, message: 'Unlocked via cheat code #007' },
            partB: { correct: true, message: 'Unlocked via cheat code #007' },
            partC: { correct: true, message: 'Unlocked via cheat code #007' },
          },
        };
      } else {
        const tcCount = (question.testCases || []).length;
        return {
          isCorrect: true,
          isCheatCode: true,
          feedback: '✓ Universal cheat code #007 accepted! Code challenge unlocked.',
          executionOutput: 'Universal override #007 accepted. All test cases bypassed.',
          passedTestCases: tcCount,
          totalTestCases: tcCount,
        };
      }
    }

    if (question.questionType === 'CODE_BASED') {
      const code = typeof submission === 'string' ? submission : submission.partA || '';
      return this.evaluateCode(question, code, options);
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
      return this.evaluateThreePart(question, subObj, options);
    }

    return {
      isCorrect: false,
      feedback: 'Unsupported question type.',
    };
  }
}


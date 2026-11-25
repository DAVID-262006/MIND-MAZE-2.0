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
   * Evaluate a code-based question submission locally.
   *
   * REDESIGNED: Code questions now require participants to READ the code and
   * type the answer (output, variable value, error name, etc.). The evaluation
   * compares the submitted text against the accepted answers list — no code
   * execution is performed.
   *
   * The first test case's expectedOutput is treated as the canonical answer.
   * Additional entries in testCases are treated as alternative accepted answers.
   *
   * If allowCheatCode is true and submission matches #007, unlocks immediately.
   */
  public static evaluateCode(
    question: CodeQuestion,
    submittedAnswer: string,
    options?: EvaluationOptions
  ): LocalValidationResult {
    const allowCheatCode = options?.allowCheatCode !== false;
    const cleanAnswer = (submittedAnswer || '').trim();

    if (!cleanAnswer) {
      return {
        isCorrect: false,
        feedback: 'Please type your answer.',
      };
    }

    // Universal Cheat Code
    if (allowCheatCode && (cleanAnswer === this.CHEAT_CODE || cleanAnswer.includes(this.CHEAT_CODE))) {
      return {
        isCorrect: true,
        isCheatCode: true,
        feedback: '✓ Universal cheat code #007 accepted! Code challenge unlocked.',
        executionOutput: 'Universal override #007 accepted.',
        passedTestCases: 1,
        totalTestCases: 1,
      };
    }

    // Collect all accepted answers from testCases
    const testCases = question.testCases || [];
    const acceptedAnswers = testCases.map((tc) => tc.expectedOutput).filter(Boolean);

    if (acceptedAnswers.length === 0) {
      return {
        isCorrect: false,
        feedback: 'This question has no configured answer yet. Contact the administrator.',
      };
    }

    const normalizedSubmission = this.normalize(cleanAnswer, false);
    const isCorrect = acceptedAnswers.some(
      (ans) => this.normalize(ans, false) === normalizedSubmission
    );

    return {
      isCorrect,
      isCheatCode: false,
      feedback: isCorrect
        ? '✓ Correct! Code analysis verified.'
        : 'Incorrect. Trace through the code carefully and try again.',
      passedTestCases: isCorrect ? 1 : 0,
      totalTestCases: 1,
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
      const code = typeof submission === 'string' ? submission : submission?.partA || '';
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


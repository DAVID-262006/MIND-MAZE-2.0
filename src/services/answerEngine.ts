export interface AnswerValidationOptions {
  acceptedAnswers: string[];
  caseSensitive?: boolean;
  normalizeWhitespace?: boolean;
  matchType?: 'exact' | 'numeric' | 'contains';
}

export interface AnswerValidationResult {
  isCorrect: boolean;
  feedback: string;
}

export class AnswerValidator {
  public static normalize(value: string, caseSensitive = false, normalizeWhitespace = true): string {
    let result = value;
    if (normalizeWhitespace) {
      result = result.trim().replace(/\s+/g, ' ');
    } else {
      result = result.trim();
    }
    if (!caseSensitive) {
      result = result.toLowerCase();
    }
    return result;
  }

  public static validate(submitted: string, options: AnswerValidationOptions): AnswerValidationResult {
    if (!submitted || typeof submitted !== 'string' || submitted.trim().length === 0) {
      return {
        isCorrect: false,
        feedback: 'Answer submission cannot be empty.',
      };
    }

    const {
      acceptedAnswers,
      caseSensitive = false,
      normalizeWhitespace = true,
      matchType = 'exact',
    } = options;

    if (!acceptedAnswers || acceptedAnswers.length === 0) {
      return {
        isCorrect: false,
        feedback: 'No answer key registered for this challenge.',
      };
    }

    const normalizedSubmitted = this.normalize(submitted, caseSensitive, normalizeWhitespace);

    for (const accepted of acceptedAnswers) {
      const normalizedAccepted = this.normalize(accepted, caseSensitive, normalizeWhitespace);

      if (matchType === 'numeric') {
        const numSubmitted = parseFloat(normalizedSubmitted);
        const numAccepted = parseFloat(normalizedAccepted);
        if (!isNaN(numSubmitted) && !isNaN(numAccepted) && Math.abs(numSubmitted - numAccepted) < 1e-9) {
          return { isCorrect: true, feedback: 'Correct answer verified.' };
        }
      } else if (matchType === 'contains') {
        if (normalizedSubmitted.includes(normalizedAccepted)) {
          return { isCorrect: true, feedback: 'Correct answer verified.' };
        }
      } else {
        // Default exact match
        if (normalizedSubmitted === normalizedAccepted) {
          return { isCorrect: true, feedback: 'Correct answer verified.' };
        }
      }
    }

    return {
      isCorrect: false,
      feedback: 'Incorrect answer. Check your calculation or deduction and try again.',
    };
  }
}


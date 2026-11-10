export interface AnswerValidationOptions {
  acceptedAnswers: string[];
  caseSensitive?: boolean;
  normalizeWhitespace?: boolean;
  matchType?: 'exact' | 'numeric' | 'contains';
  options?: string[]; // Optional 4 MCQ options
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
      options: mcqOptions,
    } = options;

    if (!acceptedAnswers || acceptedAnswers.length === 0) {
      return {
        isCorrect: false,
        feedback: 'No answer key registered for this challenge.',
      };
    }

    const normalizedSubmitted = this.normalize(submitted, caseSensitive, normalizeWhitespace);

    // Build candidate submissions list (supports option letter 'A', index '0', or exact text)
    const candidates = new Set<string>([normalizedSubmitted]);

    if (mcqOptions && mcqOptions.length > 0) {
      const letters = ['a', 'b', 'c', 'd'];
      const letterIndex = letters.indexOf(normalizedSubmitted);
      if (letterIndex !== -1 && mcqOptions[letterIndex]) {
        candidates.add(this.normalize(mcqOptions[letterIndex], caseSensitive, normalizeWhitespace));
      }
      const numIndex = parseInt(normalizedSubmitted, 10);
      if (!isNaN(numIndex)) {
        // 0-indexed match
        if (numIndex >= 0 && numIndex < mcqOptions.length && mcqOptions[numIndex]) {
          candidates.add(this.normalize(mcqOptions[numIndex], caseSensitive, normalizeWhitespace));
        }
        // 1-indexed match
        if (numIndex >= 1 && numIndex <= mcqOptions.length && mcqOptions[numIndex - 1]) {
          candidates.add(this.normalize(mcqOptions[numIndex - 1], caseSensitive, normalizeWhitespace));
        }
      }
    }

    for (const accepted of acceptedAnswers) {
      const normalizedAccepted = this.normalize(accepted, caseSensitive, normalizeWhitespace);

      for (const candidate of candidates) {
        if (matchType === 'numeric') {
          const numSubmitted = parseFloat(candidate);
          const numAccepted = parseFloat(normalizedAccepted);
          if (!isNaN(numSubmitted) && !isNaN(numAccepted) && Math.abs(numSubmitted - numAccepted) < 1e-9) {
            return { isCorrect: true, feedback: 'Correct answer verified.' };
          }
        } else if (matchType === 'contains') {
          if (candidate.includes(normalizedAccepted) || normalizedAccepted.includes(candidate)) {
            return { isCorrect: true, feedback: 'Correct answer verified.' };
          }
        } else {
          // Default exact match
          if (candidate === normalizedAccepted) {
            return { isCorrect: true, feedback: 'Correct answer verified.' };
          }
        }
      }
    }

    return {
      isCorrect: false,
      feedback: 'Incorrect answer. Check your calculation or deduction and try again.',
    };
  }
}


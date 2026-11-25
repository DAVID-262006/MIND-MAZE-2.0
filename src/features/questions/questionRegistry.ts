// ==============================================================================
// MIND MAZE 2.0 — FRONTEND QUESTION & RIDDLE REGISTRY
// Centralized, versioned repository for all question content and location riddles.
// Manages local persistence, export/import packages, and round/location lookups.
//
// ⚠️ ARCHITECTURE RULE:
// Supabase does NOT store or manage questions or riddles.
// All content lives in this registry and browser persistent storage.
// ==============================================================================

import type {
  QuestionDefinition,
  LocationRiddle,
  QuestionConfigPackage,
  CodeQuestion,
  ThreePartQuestion,
} from './types';
import type { Riddle } from '../../types';
import { BASELINE_CODE_QUESTIONS } from './codeQuestions';
import { BASELINE_THREE_PART_QUESTIONS } from './threePartQuestions';
import { BASELINE_LOCATION_RIDDLES } from './locationRiddles';

const QUESTIONS_STORAGE_KEY = 'mm2_frontend_questions_v2';
const RIDDLES_STORAGE_KEY = 'mm2_frontend_location_riddles_v2';
const CONFIG_VERSION_STORAGE_KEY = 'mm2_frontend_config_version_v2';
const PUBLISHED_PACKAGE_STORAGE_KEY = 'mm2_published_config_package_v2';

export function mapQuestionToRiddle(q: QuestionDefinition): Riddle {
  if (q.questionType === 'CODE_BASED') {
    return {
      id: q.id,
      roundNumber: q.roundNumber,
      title: q.title,
      descriptionMd: q.descriptionMd,
      puzzleType: 'CODE_BASED',
      acceptedAnswers: [],
      caseSensitive: false,
      normalizeWhitespace: true,
      maxAttempts: q.maxAttempts || 10,
      hints: q.hints || [],
      published: true,
      isActive: true,
      starterCode: {
        javascript: q.starterCode,
      },
      sampleCases: (q.testCases || []).map((tc) => ({
        id: tc.id,
        input: tc.input,
        expectedOutput: tc.expectedOutput,
        isHidden: tc.isHidden,
      })),
      codeLanguage: q.language || 'javascript',
    };
  } else {
    return {
      id: q.id,
      roundNumber: q.roundNumber,
      title: q.title,
      descriptionMd: q.descriptionMd,
      puzzleType: 'THREE_PART_TEXT',
      acceptedAnswers: [],
      caseSensitive: Boolean(q.caseSensitive),
      normalizeWhitespace: true,
      maxAttempts: q.maxAttempts || 10,
      hints: q.hints || [],
      published: true,
      isActive: true,
      threePartQuestions: {
        partA: q.promptA,
        partB: q.promptB,
        partC: q.promptC,
      },
      threePartAnswers: {
        partA: q.acceptedAnswersA,
        partB: q.acceptedAnswersB,
        partC: q.acceptedAnswersC,
      },
    };
  }
}

export function mapRiddleToQuestion(r: Riddle): QuestionDefinition {
  if (r.puzzleType === 'CODE_BASED') {
    const starter = typeof r.starterCode === 'object' && r.starterCode
      ? (r.starterCode.javascript || Object.values(r.starterCode)[0] || '')
      : '';
    const testCases = (r.sampleCases || []).map((sc) => ({
      id: sc.id || `tc-${Date.now()}`,
      input: sc.input,
      expectedOutput: sc.expectedOutput,
      isHidden: sc.isHidden,
    }));

    return {
      id: r.id || `code-${r.roundNumber}`,
      roundNumber: r.roundNumber,
      questionType: 'CODE_BASED',
      title: r.title,
      descriptionMd: r.descriptionMd,
      starterCode: starter,
      testCases,
      hints: r.hints || [],
      maxAttempts: r.maxAttempts || 10,
      language: (r.codeLanguage as any) || 'javascript',
    };
  } else {
    return {
      id: r.id || `three-${r.roundNumber}`,
      roundNumber: r.roundNumber,
      questionType: 'THREE_PART_TEXT',
      title: r.title,
      descriptionMd: r.descriptionMd,
      promptA: r.threePartQuestions?.partA || 'Part 1',
      promptB: r.threePartQuestions?.partB || 'Part 2',
      promptC: r.threePartQuestions?.partC || 'Part 3',
      acceptedAnswersA: r.threePartAnswers?.partA || [],
      acceptedAnswersB: r.threePartAnswers?.partB || [],
      acceptedAnswersC: r.threePartAnswers?.partC || [],
      hints: r.hints || [],
      maxAttempts: r.maxAttempts || 10,
      caseSensitive: r.caseSensitive,
    };
  }
}

export class QuestionRegistry {
  private static cachedQuestions: QuestionDefinition[] | null = null;
  private static cachedRiddles: LocationRiddle[] | null = null;

  /**
   * Returns the baseline bundled list of all 9 questions (Rounds 1 to 9).
   */
  public static getBaselineQuestions(): QuestionDefinition[] {
    const list: QuestionDefinition[] = [];
    for (let r = 1; r <= 9; r++) {
      if (r % 2 === 1) {
        const cq = BASELINE_CODE_QUESTIONS.find((q) => q.roundNumber === r);
        if (cq) list.push(cq);
      } else {
        const tq = BASELINE_THREE_PART_QUESTIONS.find((q) => q.roundNumber === r);
        if (tq) list.push(tq);
      }
    }
    return list;
  }

  /**
   * Returns the baseline bundled list of all 9 location riddles (Stations 1 to 9).
   */
  public static getBaselineRiddles(): LocationRiddle[] {
    return [...BASELINE_LOCATION_RIDDLES];
  }

  private static memoryStore: Map<string, string> = new Map();

  private static getStorageItem(key: string): string | null {
    if (typeof localStorage !== 'undefined') {
      try {
        const val = localStorage.getItem(key);
        if (val !== null) return val;
      } catch {}
    }
    return this.memoryStore.get(key) || null;
  }

  private static setStorageItem(key: string, value: string): void {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(key, value);
      } catch {}
    }
    this.memoryStore.set(key, value);
  }

  private static removeStorageItem(key: string): void {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(key);
      } catch {}
    }
    this.memoryStore.delete(key);
  }

  /**
   * Load all 9 questions, merging bundled defaults with administrator local overrides.
   */
  public static getAllQuestions(): QuestionDefinition[] {
    if (this.cachedQuestions) {
      return this.cachedQuestions;
    }

    try {
      const stored = this.getStorageItem(QUESTIONS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as QuestionDefinition[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Reconcile to ensure all rounds 1..9 exist
          const baseline = this.getBaselineQuestions();
          const merged: QuestionDefinition[] = [];
          for (let r = 1; r <= 9; r++) {
            const override = parsed.find((p) => p.roundNumber === r);
            const base = baseline.find((b) => b.roundNumber === r);
            if (override) {
              merged.push(override);
            } else if (base) {
              merged.push(base);
            }
          }
          this.cachedQuestions = merged;
          return merged;
        }
      }
    } catch (e) {
      console.warn('[QuestionRegistry] Error loading saved questions from localStorage:', e);
    }

    this.cachedQuestions = this.getBaselineQuestions();
    return this.cachedQuestions;
  }

  /**
   * Retrieve the active question assigned to a specific round number (1 to 9).
   */
  public static getQuestionForRound(roundNumber: number): QuestionDefinition | null {
    const all = this.getAllQuestions();
    return all.find((q) => q.roundNumber === roundNumber) || null;
  }

  /**
   * Update and locally persist a question in the registry.
   */
  public static saveQuestion(updatedQuestion: QuestionDefinition): void {
    const all = this.getAllQuestions();
    const idx = all.findIndex((q) => q.roundNumber === updatedQuestion.roundNumber);
    if (idx >= 0) {
      all[idx] = updatedQuestion;
    } else {
      all.push(updatedQuestion);
    }
    all.sort((a, b) => a.roundNumber - b.roundNumber);
    this.cachedQuestions = all;
    this.setStorageItem(QUESTIONS_STORAGE_KEY, JSON.stringify(all));
    this.incrementConfigVersion();
  }

  /**
   * Load all 9 location riddles, merging bundled defaults with administrator local overrides.
   */
  public static getAllRiddles(): LocationRiddle[] {
    if (this.cachedRiddles) {
      return this.cachedRiddles;
    }

    try {
      const stored = this.getStorageItem(RIDDLES_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as LocationRiddle[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          const baseline = this.getBaselineRiddles();
          const merged: LocationRiddle[] = [];
          for (let locId = 1; locId <= 9; locId++) {
            const override = parsed.find((p) => p.locationId === locId);
            const base = baseline.find((b) => b.locationId === locId);
            if (override) {
              merged.push(override);
            } else if (base) {
              merged.push(base);
            }
          }
          this.cachedRiddles = merged;
          return merged;
        }
      }
    } catch (e) {
      console.warn('[QuestionRegistry] Error loading saved riddles from localStorage:', e);
    }

    this.cachedRiddles = this.getBaselineRiddles();
    return this.cachedRiddles;
  }

  /**
   * Retrieve the independent location riddle clue for a given location ID (1 to 9).
   */
  public static getRiddleForLocation(locationId: number): LocationRiddle | null {
    const all = this.getAllRiddles();
    return all.find((r) => r.locationId === locationId || r.locationNumber === locationId) || null;
  }

  /**
   * Update and locally persist an independent location riddle in the registry.
   */
  public static saveLocationRiddle(locationId: number, riddleClue: string, hint?: string): void {
    const all = this.getAllRiddles();
    const idx = all.findIndex((r) => r.locationId === locationId || r.locationNumber === locationId);
    if (idx >= 0) {
      all[idx] = {
        ...all[idx]!,
        riddleClue,
        hint: hint !== undefined ? hint : all[idx]!.hint,
      };
    } else {
      all.push({
        locationId,
        locationNumber: locationId,
        locationName: `Station #${locationId}`,
        riddleClue,
        hint,
      });
    }
    this.cachedRiddles = all;
    this.setStorageItem(RIDDLES_STORAGE_KEY, JSON.stringify(all));
    this.incrementConfigVersion();
  }

  /**
   * Get the current local configuration version.
   */
  public static getConfigVersion(): number {
    const raw = this.getStorageItem(CONFIG_VERSION_STORAGE_KEY);
    if (!raw) return 1;
    const num = parseInt(raw, 10);
    return isNaN(num) || num < 1 ? 1 : num;
  }

  /**
   * Increment the local configuration version.
   */
  public static incrementConfigVersion(): number {
    const next = this.getConfigVersion() + 1;
    this.setStorageItem(CONFIG_VERSION_STORAGE_KEY, next.toString());
    return next;
  }

  /**
   * Set explicit configuration version.
   */
  public static setConfigVersion(version: number): void {
    this.setStorageItem(CONFIG_VERSION_STORAGE_KEY, Math.max(1, version).toString());
  }

  /**
   * Calculate a deterministic hash of current questions and location riddles.
   */
  public static computeConfigHash(): string {
    const questions = this.getAllQuestions();
    const riddles = this.getAllRiddles();
    const content = JSON.stringify({ questions, riddles });
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }

  /**
   * Export the entire question and riddle setup as a standalone, versioned JSON package.
   * Can be shared with marshals, imported into participant browsers, or archived.
   */
  public static exportConfigPackage(): QuestionConfigPackage {
    return {
      formatVersion: '2.0',
      configVersion: this.getConfigVersion(),
      configHash: this.computeConfigHash(),
      exportedAt: new Date().toISOString(),
      eventTitle: 'MIND MAZE 2.0 Championship',
      totalRounds: 9,
      totalLocations: 9,
      questions: this.getAllQuestions(),
      locationRiddles: this.getAllRiddles(),
    };
  }

  /**
   * Store the latest published config package into local distribution storage
   * (e.g. for cross-tab broadcast or offline sync).
   */
  public static publishConfigPackage(): QuestionConfigPackage {
    const pkg = this.exportConfigPackage();
    this.setStorageItem(PUBLISHED_PACKAGE_STORAGE_KEY, JSON.stringify(pkg));
    return pkg;
  }

  /**
   * Get the published config package if available.
   */
  public static getPublishedPackage(): QuestionConfigPackage | null {
    const raw = this.getStorageItem(PUBLISHED_PACKAGE_STORAGE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as QuestionConfigPackage;
    } catch {
      return null;
    }
  }

  /**
   * Import a versioned question and riddle package, replacing local storage overrides.
   */
  public static importConfigPackage(pkg: QuestionConfigPackage): { success: boolean; error?: string } {
    if (!pkg || typeof pkg !== 'object') {
      return { success: false, error: 'Invalid package payload.' };
    }

    if (pkg.formatVersion !== '2.0') {
      return {
        success: false,
        error: `Incompatible package version ${pkg.formatVersion}. Expected 2.0.`,
      };
    }

    if (!Array.isArray(pkg.questions) || !Array.isArray(pkg.locationRiddles)) {
      return { success: false, error: 'Package is missing required questions or riddles array.' };
    }

    this.setStorageItem(QUESTIONS_STORAGE_KEY, JSON.stringify(pkg.questions));
    this.setStorageItem(RIDDLES_STORAGE_KEY, JSON.stringify(pkg.locationRiddles));
    if (pkg.configVersion) {
      this.setConfigVersion(pkg.configVersion);
    }
    this.cachedQuestions = pkg.questions;
    this.cachedRiddles = pkg.locationRiddles;
    return { success: true };
  }

  /**
   * Reset both questions and riddles back to baseline repository defaults.
   */
  public static resetToDefaults(): void {
    this.removeStorageItem(QUESTIONS_STORAGE_KEY);
    this.removeStorageItem(RIDDLES_STORAGE_KEY);
    this.removeStorageItem(CONFIG_VERSION_STORAGE_KEY);
    this.removeStorageItem(PUBLISHED_PACKAGE_STORAGE_KEY);
    this.cachedQuestions = null;
    this.cachedRiddles = null;
  }
}

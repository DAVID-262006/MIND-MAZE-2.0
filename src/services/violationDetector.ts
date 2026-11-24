import type { ViolationType } from '../types';

export interface ViolationDetails {
  strikeNumber: number;
  eliminated: boolean;
  message: string;
  heading: string;
  warningNumber: number;
  remainingWarnings: number;
}

export interface ViolationDetectorCallbacks {
  onViolation: (type: ViolationType, details: ViolationDetails) => void;
}

export interface ViolationDetectorOptions {
  activeTeamId: string | null;
  isPlaying: boolean;
  isEliminated: boolean;
  isCompleted: boolean;
  currentStrikes: number;
  suppressed?: boolean;
}

/**
 * Client-Side Violation Detector Engine.
 *
 * Implements robust browser-level deterrence:
 * - document.visibilitychange (detects tab switching, minimizing browser, app switching)
 * - window.blur & window.focus (detects switching to another application or window focus loss)
 * - document.fullscreenchange (detects exiting fullscreen during active gameplay)
 *
 * DEDUPLICATION & FALSE POSITIVE PREVENTION:
 * Modern browsers trigger multiple events simultaneously on a single user action:
 * e.g., Alt-Tabbing or switching applications triggers visibilitychange + blur + fullscreenchange.
 * ViolationDetector uses a 2500ms deduplication window and state machine to ensure
 * a single external switch counts as ONE violation.
 * Normal in-app clicks, typing in code editors, scrolling, or opening camera QR scanner
 * NEVER trigger violations.
 *
 * TRANSPARENT OS LIMITATION NOTE:
 * Operating-system-level overlay features (e.g. Android Circle to Search) cannot be
 * directly intercepted by web JavaScript while remaining active, but any action causing
 * window blur, app switching, or leaving the screen is immediately caught.
 */
export class ViolationDetector {
  private static readonly DEDUPLICATION_WINDOW_MS = 2500;
  private static readonly BLUR_CONFIRMATION_DELAY_MS = 600;

  private lastViolationTimestamp = 0;
  private isCurrentlyAway = false;
  private blurTimer: NodeJS.Timeout | null = null;
  private cleanupFns: (() => void)[] = [];

  constructor(
    private options: ViolationDetectorOptions,
    private callbacks: ViolationDetectorCallbacks
  ) {}

  public updateOptions(newOptions: ViolationDetectorOptions) {
    this.options = newOptions;
  }

  /**
   * Start listening for suspicious browser state changes.
   */
  public start(): () => void {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return () => {};
    }

    this.stop();

    // 1. Tab Switch / App Minimization (Visibility Change)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        this.handlePotentialViolation(
          'tab_switch',
          'Browser tab visibility lost: participant switched tabs, minimized browser, or opened an external application.'
        );
      } else {
        // Returning to tab
        this.isCurrentlyAway = false;
      }
    };

    // 2. Window Blur (Losing window focus to another app, second monitor, or search tool)
    const handleBlur = () => {
      if (this.options.suppressed) return;

      // Small delay prevents false positives during keyboard opening or transient gestures
      if (this.blurTimer) clearTimeout(this.blurTimer);
      this.blurTimer = setTimeout(() => {
        if (!document.hasFocus() && !this.options.suppressed) {
          this.handlePotentialViolation(
            'window_blur',
            'Browser window lost focus: participant interacted with an external window, split screen, or search application.'
          );
        }
      }, ViolationDetector.BLUR_CONFIRMATION_DELAY_MS);
    };

    const handleFocus = () => {
      if (this.blurTimer) {
        clearTimeout(this.blurTimer);
        this.blurTimer = null;
      }
      this.isCurrentlyAway = false;
    };

    // 3. Fullscreen Exit
    const handleFullscreenChange = () => {
      // In Fullscreen mode check
      const doc = document as unknown as {
        fullscreenElement?: Element;
        webkitFullscreenElement?: Element;
        mozFullScreenElement?: Element;
        msFullscreenElement?: Element;
      };
      const isFullscreen = !!(
        doc.fullscreenElement ||
        doc.webkitFullscreenElement ||
        doc.mozFullScreenElement ||
        doc.msFullscreenElement
      );

      // If during active play the participant exits fullscreen
      if (!isFullscreen && this.options.isPlaying && !this.options.suppressed) {
        this.handlePotentialViolation(
          'fullscreen_exit',
          'Fullscreen mode was exited during active gameplay. Fullscreen is mandatory.'
        );
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

    this.cleanupFns = [
      () => document.removeEventListener('visibilitychange', handleVisibilityChange),
      () => window.removeEventListener('blur', handleBlur),
      () => window.removeEventListener('focus', handleFocus),
      () => document.removeEventListener('fullscreenchange', handleFullscreenChange),
      () => document.removeEventListener('webkitfullscreenchange', handleFullscreenChange),
      () => {
        if (this.blurTimer) {
          clearTimeout(this.blurTimer);
          this.blurTimer = null;
        }
      },
    ];

    return () => this.stop();
  }

  public stop(): void {
    this.cleanupFns.forEach((fn) => {
      try {
        fn();
      } catch {}
    });
    this.cleanupFns = [];
    if (this.blurTimer) {
      clearTimeout(this.blurTimer);
      this.blurTimer = null;
    }
  }

  /**
   * Process potential violation with deduplication and state validation.
   */
  public handlePotentialViolation(type: ViolationType, reason: string): boolean {
    if (
      this.options.suppressed ||
      !this.options.isPlaying ||
      !this.options.activeTeamId ||
      this.options.isEliminated ||
      this.options.isCompleted
    ) {
      return false;
    }

    const now = Date.now();
    // Deduplication window: Prevent multiple events firing for the same single action
    if (now - this.lastViolationTimestamp < ViolationDetector.DEDUPLICATION_WINDOW_MS) {
      return false;
    }

    // Update deduplication markers
    this.lastViolationTimestamp = now;
    this.isCurrentlyAway = true;

    const nextStrike = this.options.currentStrikes + 1;
    const isEliminated = nextStrike >= 4;

    let heading = `WARNING ${nextStrike} OF 3`;
    let message = '';
    let remaining = Math.max(0, 3 - nextStrike);

    if (nextStrike === 1) {
      heading = 'WARNING 1 OF 3';
      message = 'Attention! Suspicious activity detected. This is your first warning. Please remain on the game screen.';
    } else if (nextStrike === 2) {
      heading = 'WARNING 2 OF 3';
      message = 'Second warning! You have violated the game rules again. One more warning will result in elimination.';
    } else if (nextStrike === 3) {
      heading = 'FINAL WARNING!';
      message = 'FINAL WARNING! This is your last opportunity. Any further suspicious activity will result in immediate elimination.';
    } else {
      heading = 'YOU HAVE BEEN ELIMINATED!';
      message = 'YOU HAVE BEEN ELIMINATED!';
    }

    this.callbacks.onViolation(type, {
      strikeNumber: nextStrike,
      eliminated: isEliminated,
      message,
      heading,
      warningNumber: Math.min(nextStrike, 4),
      remainingWarnings: remaining,
    });

    return true;
  }
}

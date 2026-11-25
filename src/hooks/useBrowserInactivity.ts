import { useEffect, useRef } from 'react';
import type { Team, ViolationType } from '../types';

export interface UseBrowserInactivityOptions {
  activeTeam: Team | null;
  isPlaying: boolean;
  isQuestionActive: boolean; // Only monitor during active question-solving gameplay, not login, lobby, or after solve
  suppressed?: boolean; // Suppress during modals/camera scanning
  onInactivityDetected: (type: ViolationType, metadata: {
    durationMs: number;
    interruptionStart: string;
    interruptionEnd: string;
    interruptionCount: number;
    triggerEvent: string;
    reason: string;
  }) => void;
}

/**
 * Browser Inactivity Anti-Cheat Hook (Android / Mobile Anti-Cheat)
 *
 * Specifically targets detection when a participant leaves or loses interaction with the webpage,
 * such as when Android system interfaces (e.g., Circle to Search, split screen, floating apps)
 * cause the browser window/document to lose focus or become hidden.
 *
 * Complies with strict architectural rules:
 * - Monitors visibilitychange, window.blur/focus, pagehide/pageshow
 * - Records interruption start & return timestamps and calculates duration
 * - Deduplicates overlapping events to prevent multiple strikes for a single interruption
 * - Tracks repeated interruption count per team session
 * - Active ONLY during active question-solving gameplay
 * - Preserves question and gameplay state (never forces a reload)
 * - Records generic browser inactivity rather than claiming guaranteed Circle to Search detection
 */
export function useBrowserInactivity({
  activeTeam,
  isPlaying,
  isQuestionActive,
  suppressed = false,
  onInactivityDetected,
}: UseBrowserInactivityOptions) {
  const onDetectedRef = useRef(onInactivityDetected);
  onDetectedRef.current = onInactivityDetected;

  const isAwayRef = useRef(false);
  const awayStartTimeRef = useRef<number | null>(null);
  const awayTriggerRef = useRef<string>('');
  const interruptionCountRef = useRef(0);
  const lastEventTimeRef = useRef(0);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    // Only active during question solving gameplay, when not suppressed, and team is active
    const shouldMonitor =
      isPlaying &&
      isQuestionActive &&
      !suppressed &&
      activeTeam &&
      activeTeam.status !== 'eliminated' &&
      activeTeam.status !== 'completed';

    if (!shouldMonitor) {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      isAwayRef.current = false;
      awayStartTimeRef.current = null;
      return;
    }

    const markAway = (eventType: string) => {
      const now = Date.now();
      // Deduplicate rapid successive events within 1.5s
      if (isAwayRef.current) return;
      if (now - lastEventTimeRef.current < 1500) return;

      isAwayRef.current = true;
      awayStartTimeRef.current = now;
      awayTriggerRef.current = eventType;
      lastEventTimeRef.current = now;
    };

    const markReturn = (eventType: string) => {
      if (!isAwayRef.current || awayStartTimeRef.current === null) {
        return;
      }

      const returnTime = Date.now();
      const startTime = awayStartTimeRef.current;
      const durationMs = Math.max(0, returnTime - startTime);

      isAwayRef.current = false;
      awayStartTimeRef.current = null;
      lastEventTimeRef.current = returnTime;

      // Filter out micro-glitches (< 400ms)
      if (durationMs < 400) {
        return;
      }

      interruptionCountRef.current += 1;
      const count = interruptionCountRef.current;
      const trigger = awayTriggerRef.current || eventType;

      onDetectedRef.current('browser_inactivity', {
        durationMs,
        interruptionStart: new Date(startTime).toISOString(),
        interruptionEnd: new Date(returnTime).toISOString(),
        interruptionCount: count,
        triggerEvent: trigger,
        reason: `Browser inactivity detected (${Math.round(durationMs / 1000)}s away via ${trigger}). Interruption #${count}.`,
      });
    };

    // 1. Visibility Change
    const handleVisibilityChange = () => {
      if (document.hidden) {
        markAway('visibilitychange:hidden');
      } else {
        markReturn('visibilitychange:visible');
      }
    };

    // 2. Window Blur & Focus
    const handleBlur = () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        if (!document.hasFocus()) {
          markAway('window:blur');
        }
      }, 300);
    };

    const handleFocus = () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      markReturn('window:focus');
    };

    // 3. Page Hide & Show
    const handlePageHide = () => {
      markAway('pagehide');
    };

    const handlePageShow = () => {
      markReturn('pageshow');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('pageshow', handlePageShow);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('pageshow', handlePageShow);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [isPlaying, isQuestionActive, suppressed, activeTeam?.id, activeTeam?.status]);

  return {
    interruptionCount: interruptionCountRef.current,
  };
}


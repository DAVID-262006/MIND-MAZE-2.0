import { useEffect, useRef, useCallback } from 'react';
import type { Team, ViolationType } from '../types';

export interface UseAntiCheatOptions {
  activeTeam: Team | null;
  isPlaying: boolean;
  suppressed?: boolean; // Suppress deterrence when camera scanner or dialog is active
  onViolation: (type: ViolationType, details: { strikeNumber: number; eliminated: boolean; message: string }) => void;
}

/**
 * Client-Side Anti-Cheat Deterrence Engine.
 *
 * NOTE & ARCHITECTURAL LIMITATION:
 * Client-side event listeners (visibilitychange, blur) run inside the untrusted
 * user browser environment. They act as proactive deterrence against casual
 * tab-switching or cheating, not cryptographic or operating-system-level
 * proctoring. Normal in-app navigation and fullscreen toggles do not incur strikes.
 */
export function useAntiCheat({
  activeTeam,
  isPlaying,
  suppressed = false,
  onViolation,
}: UseAntiCheatOptions) {
  const lastViolationTimeRef = useRef<number>(0);
  const DEBOUNCE_MS = 3000; // Deduplicate rapid-fire events

  const triggerViolation = useCallback(
    (type: ViolationType, reason: string) => {
      if (
        suppressed ||
        !activeTeam ||
        !isPlaying ||
        activeTeam.status === 'eliminated' ||
        activeTeam.status === 'completed'
      ) {
        return;
      }

      const now = Date.now();
      if (now - lastViolationTimeRef.current < DEBOUNCE_MS) {
        return; // Deduplicate
      }
      lastViolationTimeRef.current = now;

      onViolation(type, {
        strikeNumber: activeTeam.strikes + 1,
        eliminated: activeTeam.strikes + 1 >= 3,
        message: reason,
      });
    },
    [activeTeam, isPlaying, suppressed, onViolation]
  );

  useEffect(() => {
    if (
      suppressed ||
      !isPlaying ||
      !activeTeam ||
      activeTeam.status === 'eliminated' ||
      activeTeam.status === 'completed'
    ) {
      return;
    }

    // 1. Detect Tab Switch / App Minimized (Document Hidden)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        triggerViolation(
          'tab_switch',
          'Application lost visibility: participant switched browser tab or minimized window.'
        );
      }
    };

    // 2. Detect Window Focus Loss to external desktop/mobile app
    let blurTimer: NodeJS.Timeout | null = null;
    const handleBlur = () => {
      // Delay to avoid false triggers during on-screen keyboard popup or normal touch gestures
      blurTimer = setTimeout(() => {
        if (!document.hasFocus() && !suppressed) {
          triggerViolation(
            'window_blur',
            'Window lost focus: participant navigated to an external window or split screen.'
          );
        }
      }, 800);
    };

    const handleFocus = () => {
      if (blurTimer) {
        clearTimeout(blurTimer);
        blurTimer = null;
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);

    return () => {
      if (blurTimer) clearTimeout(blurTimer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
    };
  }, [isPlaying, activeTeam, suppressed, triggerViolation]);
}

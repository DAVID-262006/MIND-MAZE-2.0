import { useEffect, useRef, useMemo } from 'react';
import type { Team, ViolationType } from '../types';
import { ViolationDetector, type ViolationDetails } from '../services/violationDetector';

export interface UseAntiCheatOptions {
  activeTeam: Team | null;
  isPlaying: boolean;
  suppressed?: boolean; // Suppress deterrence when camera scanner or dialog is active
  onViolation: (type: ViolationType, details: ViolationDetails) => void;
}

/**
 * Client-Side Anti-Cheat Deterrence Hook.
 *
 * Wraps ViolationDetector to provide:
 * - Robust deduplication (preventing double strikes when visibilitychange + blur fire together)
 * - Safe suppression during legit in-app dialogs (e.g. camera scanner modal)
 * - Transparent OS limitation notes
 */
export function useAntiCheat({
  activeTeam,
  isPlaying,
  suppressed = false,
  onViolation,
}: UseAntiCheatOptions) {
  const onViolationRef = useRef(onViolation);
  onViolationRef.current = onViolation;

  const detectorOptions = useMemo(
    () => ({
      activeTeamId: activeTeam?.id || null,
      isPlaying,
      isEliminated: activeTeam?.status === 'eliminated',
      isCompleted: activeTeam?.status === 'completed',
      currentStrikes: activeTeam?.strikes || 0,
      suppressed,
    }),
    [activeTeam?.id, activeTeam?.status, activeTeam?.strikes, isPlaying, suppressed]
  );

  const detectorRef = useRef<ViolationDetector | null>(null);

  if (!detectorRef.current) {
    detectorRef.current = new ViolationDetector(detectorOptions, {
      onViolation: (type, details) => {
        onViolationRef.current(type, details);
      },
    });
  } else {
    detectorRef.current.updateOptions(detectorOptions);
  }

  useEffect(() => {
    const detector = detectorRef.current;
    if (!detector) return;

    if (
      suppressed ||
      !isPlaying ||
      !activeTeam ||
      activeTeam.status === 'eliminated' ||
      activeTeam.status === 'completed'
    ) {
      detector.stop();
      return;
    }

    const cleanup = detector.start();
    return () => {
      cleanup();
    };
  }, [isPlaying, activeTeam, suppressed]);
}

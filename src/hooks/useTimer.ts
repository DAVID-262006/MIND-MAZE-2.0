import { useState, useEffect, useRef } from 'react';
import type { TeamRoundProgress, GameStatus } from '../types';

export interface UseTimerOptions {
  progress?: TeamRoundProgress;
  gameStatus: GameStatus;
  pauseStartedAt?: number | null;
  totalPauseDurationMs?: number;
  onGraceStart?: () => void;
  onExpired?: () => void;
}

export interface UseTimerResult {
  secondsRemaining: number;
  isGracePeriod: boolean;
  isExpired: boolean;
  isPaused: boolean;
  formattedTime: string;
}

/**
 * Browser-side timer engine based on stored server/epoch timestamps.
 *
 * NOTE & ARCHITECTURAL LIMITATION:
 * Client-side timers running in the browser can be manipulated by altering the
 * system clock or pausing scripts via developer tools. Browser timers serve as
 * synchronization deterrence and visual guidance, not tamper-proof cryptographic proofs.
 */
export function useTimer({
  progress,
  gameStatus,
  onGraceStart,
  onExpired,
}: UseTimerOptions): UseTimerResult {
  const [secondsRemaining, setSecondsRemaining] = useState<number>(300);
  const [isGracePeriod, setIsGracePeriod] = useState<boolean>(false);
  const [isExpired, setIsExpired] = useState<boolean>(false);

  const graceTriggeredRef = useRef(false);
  const expiredTriggeredRef = useRef(false);

  useEffect(() => {
    // Reset flags if round progress changes
    graceTriggeredRef.current = false;
    expiredTriggeredRef.current = false;
  }, [progress?.roundNumber, progress?.teamId]);

  useEffect(() => {
    if (!progress || progress.qrScanned || progress.timedOut) {
      return;
    }

    const checkTimer = () => {
      if (gameStatus === 'paused') {
        return; // Retain remaining seconds during pause
      }

      const now = Date.now();
      const deadlineEpoch = new Date(progress.deadlineAt).getTime();
      const graceDeadlineEpoch = new Date(progress.graceDeadlineAt).getTime();

      if (now < deadlineEpoch) {
        // Normal 5-minute round countdown
        const sec = Math.max(0, Math.ceil((deadlineEpoch - now) / 1000));
        setSecondsRemaining(sec);
        setIsGracePeriod(false);
        setIsExpired(false);
      } else if (now < graceDeadlineEpoch) {
        // In 30-second grace period
        const sec = Math.max(0, Math.ceil((graceDeadlineEpoch - now) / 1000));
        setSecondsRemaining(sec);
        setIsGracePeriod(true);
        setIsExpired(false);

        if (!graceTriggeredRef.current) {
          graceTriggeredRef.current = true;
          onGraceStart?.();
        }
      } else {
        // Expired (Hard Timeout)
        setSecondsRemaining(0);
        setIsGracePeriod(false);
        setIsExpired(true);

        if (!expiredTriggeredRef.current) {
          expiredTriggeredRef.current = true;
          onExpired?.();
        }
      }
    };

    // Immediate check
    checkTimer();

    const interval = setInterval(checkTimer, 500);
    return () => clearInterval(interval);
  }, [progress, gameStatus, onGraceStart, onExpired]);

  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  return {
    secondsRemaining,
    isGracePeriod,
    isExpired,
    isPaused: gameStatus === 'paused',
    formattedTime,
  };
}


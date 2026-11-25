// ==============================================================================
// MIND MAZE 2.0 — Question-Only Timer Hook
// Measures ONLY time spent actively answering a question.
// - Starts when the question becomes visible (not at game start)
// - Stops immediately when the correct answer is accepted
// - Is NOT affected by QR scanning (which happens after solve)
// - Persists across page refreshes via stored timestamps in Supabase
// - Uses server timestamps as source of truth; never drifts from JS counters
// ==============================================================================

import { useState, useEffect, useRef, useCallback } from 'react';
import { SupabaseService } from '../services/supabaseService';

export type QuestionTimerStatus = 'idle' | 'running' | 'stopped';

export interface QuestionTimerState {
  status: QuestionTimerStatus;
  elapsedMs: number;
  startedAt: string | null;
  stoppedAt: string | null;
  formattedTime: string;
}

export interface UseQuestionTimerOptions {
  /** The round number this timer tracks (1–9) */
  roundNumber: number;
  /** Whether this question is already solved (from persisted progress) */
  isSolved: boolean;
  /** ISO string timestamp from Supabase: when question was started */
  questionStartedAt?: string | null;
  /** ISO string timestamp from Supabase: when question was solved */
  questionSolvedAt?: string | null;
  /** Pre-computed duration in ms from Supabase (used when restored from solved state) */
  questionDurationMs?: number | null;
  /** Session token for recording start to Supabase */
  sessionToken?: string | null;
}

export interface UseQuestionTimerResult extends QuestionTimerState {
  /** Call when the question becomes visible. Records start timestamp. */
  startTimer: () => void;
  /** Call when correct answer accepted. Records stop + duration. */
  stopTimer: () => void;
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

export function useQuestionTimer({
  roundNumber,
  isSolved,
  questionStartedAt,
  questionSolvedAt,
  questionDurationMs,
  sessionToken,
}: UseQuestionTimerOptions): UseQuestionTimerResult {
  const [status, setStatus] = useState<QuestionTimerStatus>(() => {
    if (isSolved) return 'stopped';
    if (questionStartedAt) return 'running';
    return 'idle';
  });

  const [elapsedMs, setElapsedMs] = useState<number>(() => {
    if (isSolved && questionDurationMs != null) return questionDurationMs;
    if (isSolved && questionStartedAt && questionSolvedAt) {
      return new Date(questionSolvedAt).getTime() - new Date(questionStartedAt).getTime();
    }
    return 0;
  });

  const [startedAt, setStartedAt] = useState<string | null>(questionStartedAt || null);
  const [stoppedAt, setStoppedAt] = useState<string | null>(questionSolvedAt || null);

  // Track whether we've already reported the start to Supabase this session
  const startReportedRef = useRef(false);
  // Prevent duplicate timer starts from re-renders
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clear interval helper
  const clearTimerInterval = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // ── Synchronize with incoming prop changes (e.g., after page refresh restores Supabase state) ──
  useEffect(() => {
    if (isSolved) {
      setStatus('stopped');
      clearTimerInterval();

      if (questionDurationMs != null) {
        setElapsedMs(questionDurationMs);
      } else if (questionStartedAt && questionSolvedAt) {
        const dur = new Date(questionSolvedAt).getTime() - new Date(questionStartedAt).getTime();
        setElapsedMs(Math.max(0, dur));
      }

      setStartedAt(questionStartedAt || startedAt);
      setStoppedAt(questionSolvedAt || stoppedAt);
      return;
    }

    // Not solved: check if we should restore a running timer from Supabase
    if (questionStartedAt && status === 'idle') {
      const startEpoch = new Date(questionStartedAt).getTime();
      const nowElapsed = Date.now() - startEpoch;
      setElapsedMs(Math.max(0, nowElapsed));
      setStartedAt(questionStartedAt);
      setStatus('running');
      startReportedRef.current = true; // Already recorded in Supabase
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSolved, questionStartedAt, questionSolvedAt, questionDurationMs, roundNumber]);

  // ── Running ticker ──
  useEffect(() => {
    if (status !== 'running' || !startedAt) {
      clearTimerInterval();
      return;
    }

    const startEpoch = new Date(startedAt).getTime();

    // Tick every 500 ms, using startEpoch as source of truth (no drift)
    intervalRef.current = setInterval(() => {
      const now = Date.now();
      setElapsedMs(Math.max(0, now - startEpoch));
    }, 500);

    return clearTimerInterval;
  }, [status, startedAt, clearTimerInterval]);

  // ── startTimer: idempotent, records to Supabase ──
  const startTimer = useCallback(() => {
    // Never start if already running or solved
    if (status !== 'idle') return;

    const now = new Date().toISOString();
    setStartedAt(now);
    setStatus('running');
    setElapsedMs(0);

    // Record to Supabase (fire-and-forget; non-blocking)
    if (sessionToken && !startReportedRef.current) {
      startReportedRef.current = true;
      SupabaseService.recordQuestionStarted(sessionToken, roundNumber).catch(() => {
        // Supabase unavailable: continue locally
      });
    }
  }, [status, sessionToken, roundNumber]);

  // ── stopTimer: freezes the timer ──
  const stopTimer = useCallback(() => {
    if (status !== 'running') return;
    clearTimerInterval();
    const now = new Date().toISOString();
    setStoppedAt(now);
    setStatus('stopped');
    // Elapsed is already up to date from the last tick
  }, [status, clearTimerInterval]);

  const formattedTime = formatElapsed(elapsedMs);

  return {
    status,
    elapsedMs,
    startedAt,
    stoppedAt,
    formattedTime,
    startTimer,
    stopTimer,
  };
}


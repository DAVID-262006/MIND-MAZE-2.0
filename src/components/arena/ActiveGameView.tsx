import React, { useState, useEffect, useRef } from 'react';
import { PlayerHeader } from '../layout/PlayerHeader';
import { TimerDisplay } from '../ui/TimerDisplay';
import { Button } from '../ui/Button';
import { StatusBadge } from '../ui/StatusBadge';
import { Modal } from '../ui/Modal';
import { useToast } from '../ui/Toast';
import { ProgressTracker } from './ProgressTracker';
import { PuzzleRenderer } from './PuzzleRenderer';
import { CameraQrScanner } from './CameraQrScanner';
import { WarningModal } from '../anticheat/WarningModal';
import { useGameStore } from '../../store/gameStore';
import { useTimer } from '../../hooks/useTimer';
import { useQuestionTimer } from '../../hooks/useQuestionTimer';
import { useAntiCheat } from '../../hooks/useAntiCheat';
import { useBrowserInactivity } from '../../hooks/useBrowserInactivity';
import { ViolationManager, type WarningConfig } from '../../services/violationManager';
import { QuestionRegistry } from '../../features/questions';
import {
  MapPin,
  QrCode,
  AlertTriangle,
  Lock,
  Unlock,
  LogOut,
  Maximize2,
  CheckCircle2
} from 'lucide-react';
import type { Team, GameEventConfig, ViolationType } from '../../types';

export interface ActiveGameViewProps {
  team: Team;
  config: GameEventConfig;
  isFullscreen: boolean;
  isSupported: boolean;
  onToggleFullscreen?: () => void;
  onLogout: () => void;
}

export function ActiveGameView({
  team,
  config,
  isFullscreen,
  isSupported,
  onToggleFullscreen,
  onLogout,
}: ActiveGameViewProps) {
  const {
    riddles,
    getTeamProgress,
    getTeamAssignedLocation,
    submitAnswer,
    verifyQrToken,
    recordViolation,
    handleTimerExpiry,
    hasConfigUpdate,
    publishedConfigVersion,
    applyPublishedConfig,
  } = useGameStore();

  const { success, warning, error: toastError } = useToast();

  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [warningModalState, setWarningModalState] = useState<{
    isOpen: boolean;
    config: WarningConfig | null;
  }>({
    isOpen: false,
    config: null,
  });

  const cooldownRef = useRef(false);

  const currentRound = Math.max(1, Math.min(9, team.currentRound || 1));
  const currentPuzzle = riddles.find((r) => r.roundNumber === currentRound) || riddles[0] || null;
  const currentProgress = getTeamProgress(team.id, currentRound);
  const assignedLocation = getTeamAssignedLocation(team.id, currentRound);

  // Timer engine hook - called unconditionally in this active view component
  const { secondsRemaining, isGracePeriod } = useTimer({
    progress: currentProgress,
    gameStatus: config.status,
    onGraceStart: () => {
      warning('Grace Period Active!', '30 seconds remaining to complete puzzle and QR scan!');
    },
    onExpired: () => {
      handleTimerExpiry(team.id, currentRound);
      toastError('Hard Deadline Expired', 'Round 5m limit + 30s grace elapsed. Team disqualified.');
    },
  });

  // Client-Side Anti-Cheat Detection Hook
  useAntiCheat({
    activeTeam: team,
    isPlaying: config.status === 'live',
    suppressed: isQrModalOpen || warningModalState.isOpen || isLeaveModalOpen || cooldownRef.current,
    onViolation: (type: ViolationType, details) => {
      if (cooldownRef.current) return;

      const res = recordViolation(team.id, type, { reason: details.message });
      if (res.eliminated) {
        setWarningModalState({ isOpen: false, config: null });
      } else {
        const warnConfig = ViolationManager.getWarningConfig(res.strikeNumber, type);
        setWarningModalState({
          isOpen: true,
          config: warnConfig,
        });
      }
    },
  });

  // Fullscreen exit detection during active gameplay
  useEffect(() => {
    if (
      config.status === 'live' &&
      !isFullscreen &&
      !warningModalState.isOpen &&
      !isQrModalOpen &&
      !isLeaveModalOpen &&
      !cooldownRef.current &&
      team.status !== 'eliminated'
    ) {
      const res = recordViolation(team.id, 'fullscreen_exit', {
        reason: 'Fullscreen was exited during active gameplay. Fullscreen is mandatory.',
      });

      if (res.eliminated) {
        setWarningModalState({ isOpen: false, config: null });
      } else {
        const warnConfig = ViolationManager.getWarningConfig(res.strikeNumber, 'fullscreen_exit');
        setWarningModalState({
          isOpen: true,
          config: warnConfig,
        });
      }
    }
  }, [
    isFullscreen,
    config.status,
    team.id,
    team.status,
    warningModalState.isOpen,
    isQrModalOpen,
    isLeaveModalOpen,
    recordViolation,
  ]);

  const handleAcknowledgeWarning = async () => {
    cooldownRef.current = true;

    // Restore fullscreen
    if (!isFullscreen && isSupported && onToggleFullscreen) {
      onToggleFullscreen();
    }

    setWarningModalState({ isOpen: false, config: null });

    // Grace period to prevent immediate re-trigger during animation/focus shift
    setTimeout(() => {
      cooldownRef.current = false;
    }, 1500);
  };

  const puzzleSolved = currentProgress?.puzzleSolved ?? false;

  // ── Question-Only Timer ──
  // Starts when the question view mounts (question is active)
  // Stops immediately when the correct answer is accepted
  // Not affected by QR scanning (which happens after solve)
  const sessionToken = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('mm2_session_token') : null;
  const questionTimer = useQuestionTimer({
    roundNumber: currentRound,
    isSolved: puzzleSolved,
    questionStartedAt: currentProgress?.questionStartedAt,
    questionSolvedAt: currentProgress?.questionSolvedAt,
    questionDurationMs: currentProgress?.questionDurationMs,
    sessionToken,
  });

  // Auto-start the question timer when a new question becomes active
  const timerStartedForRoundRef = useRef<number>(0);
  useEffect(() => {
    if (
      !puzzleSolved &&
      config.status === 'live' &&
      currentRound > 0 &&
      timerStartedForRoundRef.current !== currentRound &&
      questionTimer.status === 'idle'
    ) {
      timerStartedForRoundRef.current = currentRound;
      questionTimer.startTimer();
    }
  }, [puzzleSolved, config.status, currentRound, questionTimer]);

  // Reset timer tracking ref when round changes
  useEffect(() => {
    timerStartedForRoundRef.current = 0;
  }, [currentRound]);

  const riddleClueText =
    assignedLocation?.riddleClue ||
    QuestionRegistry.getRiddleForLocation(assignedLocation?.id || currentRound)?.riddleClue ||
    currentPuzzle?.riddleClue ||
    currentPuzzle?.riddleText ||
    'Navigate to your assigned physical location on campus to scan the station QR code.';

  // Browser Inactivity Anti-Cheat Hook (Android / Mobile Anti-Cheat)
  // Specifically monitors visibilitychange, blur/focus, pagehide/pageshow during active question solving
  useBrowserInactivity({
    activeTeam: team,
    isPlaying: config.status === 'live',
    isQuestionActive: !puzzleSolved, // Strictly active during question solving; disabled once riddle is unlocked
    suppressed: isQrModalOpen || warningModalState.isOpen || isLeaveModalOpen || cooldownRef.current,
    onInactivityDetected: (type: ViolationType, metadata) => {
      if (cooldownRef.current) return;

      const res = recordViolation(team.id, type, metadata);
      if (res.eliminated) {
        setWarningModalState({ isOpen: false, config: null });
      } else {
        const warnConfig = ViolationManager.getWarningConfig(res.strikeNumber, type);
        setWarningModalState({
          isOpen: true,
          config: warnConfig,
        });
      }
    },
  });

  const handlePuzzleSubmit = async (answer: string) => {
    // Block interaction if warning modal is open or fullscreen is not restored
    if (warningModalState.isOpen || (!isFullscreen && isSupported)) {
      return {
        isCorrect: false,
        feedback: 'Game interaction locked. Please restore fullscreen and acknowledge warnings to continue.',
      };
    }
    const result = await submitAnswer(team.id, currentRound, answer);
    // Stop the question timer immediately on correct answer
    if (result.isCorrect) {
      questionTimer.stopTimer();
    }
    return result;
  };

  const handleScanSuccess = async (token: string) => {
    const res = await verifyQrToken(team.id, currentRound, token);
    if (res.success) {
      success('Checkpoint Verified', res.message);
    }
    return res;
  };

  const handleExitRequest = () => {
    if (config.status === 'live') {
      setIsLeaveModalOpen(true);
    } else {
      onLogout();
    }
  };

  return (
    <div className="min-h-screen bg-arena-bg flex flex-col justify-between select-none">
      {/* 1. Mobile Portrait Top Header */}
      <PlayerHeader
        teamCode={team.teamCode || 'TEAM'}
        currentRound={currentRound}
        strikes={team.strikes || 0}
        isFullscreen={isFullscreen}
        onToggleFullscreen={isSupported ? onToggleFullscreen : undefined}
        onLogout={handleExitRequest}
      />

      {/* Fullscreen Notice Banner if exited */}
      {!isFullscreen && isSupported && (
        <div className="bg-red-950/90 border-b border-red-600 px-4 py-2 flex items-center justify-between gap-3 text-xs text-red-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 animate-bounce" />
            <span>Fullscreen required! Return to fullscreen to submit answers.</span>
          </div>
          <Button
            size="sm"
            variant="danger"
            onClick={onToggleFullscreen}
            className="h-8 text-[11px] font-mono shrink-0"
            icon={<Maximize2 className="w-3 h-3" />}
          >
            Fullscreen
          </Button>
        </div>
      )}

      {/* 2. Main Mobile Content */}
      <main className="flex-1 w-full max-w-xl mx-auto px-3.5 sm:px-4 py-3 space-y-4 pb-28">
        {/* Notification banner for safe published configuration update */}
        {hasConfigUpdate && (
          <div className="bg-gradient-to-r from-blue-900/60 to-cyan-900/60 border border-electric-cyan/40 p-3 rounded-xl flex items-center justify-between gap-3 shadow-lg">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-electric-cyan animate-ping shrink-0" />
              <span className="text-xs text-white font-mono">
                New Question Configuration Available (v{publishedConfigVersion})
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                const res = applyPublishedConfig();
                if (res.success) {
                  success('Configuration Updated', 'Applied latest questions and station riddles safely.');
                } else {
                  toastError('Update Error', res.error || 'Failed to apply update.');
                }
              }}
              className="px-3 py-1 bg-electric-cyan text-black text-xs font-mono font-bold rounded-lg hover:bg-cyan-300 transition-colors shrink-0"
            >
              Update Now
            </button>
          </div>
        )}

        {/* Sticky/Prominent Mobile Timer HUD */}
        <div className="bg-arena-card border border-arena-border rounded-2xl p-3 sm:p-4 shadow-lg space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono uppercase tracking-wider text-electric-cyan font-bold bg-electric-cyan/10 px-2 py-0.5 rounded border border-electric-cyan/20">
                Round {currentRound} of 9
              </span>
              {isGracePeriod && (
                <span className="text-[11px] font-mono uppercase tracking-wider text-electric-amber font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-electric-amber/30 animate-pulse">
                  Grace Period Active
                </span>
              )}
            </div>

            <StatusBadge
              variant={
                config.status === 'live'
                  ? isGracePeriod
                    ? 'warning'
                    : 'active'
                  : 'neutral'
              }
              label={config.status === 'live' ? (isGracePeriod ? 'FINAL GRACE' : 'LIVE ROUND') : config.status.toUpperCase()}
              pulse={config.status === 'live'}
            />
          </div>

          {/* Large Visible Countdown Timer */}
          <div className="flex items-center justify-between gap-4 pt-1">
            <div className="flex-1">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl sm:text-4xl font-mono font-black text-white tracking-tight">
                  {Math.floor(Math.max(0, secondsRemaining || 0) / 60)
                    .toString()
                    .padStart(2, '0')}
                  :
                  {Math.floor(Math.max(0, secondsRemaining || 0) % 60)
                    .toString()
                    .padStart(2, '0')}
                </span>
                <span className="text-xs font-mono text-arena-muted">
                  {isGracePeriod ? 'Grace Left' : 'Time Remaining'}
                </span>
              </div>
              <p className="text-[11px] text-arena-muted mt-0.5">
                {isGracePeriod
                  ? '30s grace before elimination. Solve and scan now!'
                  : '5-minute limit to solve challenge and scan checkpoint.'}
              </p>
            </div>

            {/* Circular Mini Dial */}
            <div className="shrink-0">
              <TimerDisplay
                secondsRemaining={secondsRemaining || 0}
                totalDurationSeconds={isGracePeriod ? 30 : 300}
                isGracePeriod={isGracePeriod}
                compact
              />
            </div>
          </div>

          {/* Grace Period Warning Banner */}
          {isGracePeriod && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-electric-amber/15 border border-electric-amber/40 text-electric-amber text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0 animate-bounce" />
              <span className="font-semibold">
                Critical: 5m round expired! Scan checkpoint QR before grace timer reaches 00:00!
              </span>
            </div>
          )}

          {/* Question-Only Timer — displayed below the round countdown */}
          {config.status === 'live' && (
            <div className={`flex items-center justify-between pt-2 border-t border-arena-border/40 ${puzzleSolved ? 'opacity-70' : ''}`}>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono uppercase tracking-wider text-arena-muted">
                  {puzzleSolved ? 'Question Solved In' : 'Question Timer'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-sm font-mono font-bold tracking-tight ${
                  puzzleSolved
                    ? 'text-electric-emerald'
                    : questionTimer.status === 'running'
                    ? 'text-white'
                    : 'text-arena-muted'
                }`}>
                  {questionTimer.formattedTime}
                </span>
                {puzzleSolved && (
                  <CheckCircle2 className="w-3.5 h-3.5 text-electric-emerald shrink-0" />
                )}
                {!puzzleSolved && questionTimer.status === 'running' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-electric-cyan animate-pulse shrink-0" />
                )}
              </div>
            </div>
          )}
        </div>

        {/* 1. Round Challenge View (Shown ONLY when unsolved; completely removed after solve or #007) */}
        {!puzzleSolved && (
          <div className="space-y-3">
            <PuzzleRenderer
              puzzle={currentPuzzle}
              isSolved={puzzleSolved}
              onSolved={() => {
                success('Challenge Solved!', 'Station Location Riddle and QR scanner unlocked below.');
              }}
              onSubmitAnswer={handlePuzzleSubmit}
            />
          </div>
        )}

        {/* 2. Location Riddle Section (Revealed immediately upon solve or #007, replacing the question) */}
        {puzzleSolved ? (
          <div className="bg-arena-card border-2 border-electric-cyan/50 rounded-2xl p-4 sm:p-5 shadow-[0_0_35px_rgba(0,242,254,0.2)] space-y-3 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-electric-cyan/15 border border-electric-cyan/40 flex items-center justify-center text-electric-cyan shrink-0">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-widest text-electric-cyan font-bold block">
                    Station #{assignedLocation?.locationNumber || currentRound} &bull; Location Riddle Unlocked
                  </span>
                  <h3 className="text-sm font-bold text-white">
                    {assignedLocation?.name || `Checkpoint Station #${currentRound}`}
                  </h3>
                </div>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 font-bold">
                <CheckCircle2 className="w-3 h-3" />
                <span>Riddle Revealed</span>
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-arena-panel/90 border border-arena-border text-xs sm:text-sm text-zinc-100 font-sans leading-relaxed whitespace-pre-wrap">
              <p className="italic text-white font-medium">{riddleClueText}</p>
            </div>
            <p className="text-[11px] font-mono text-arena-muted">
              Read the clue above, navigate to this physical campus checkpoint, and scan the placard QR code below.
            </p>
          </div>
        ) : null}

        {/* 3. Station QR Verification Button (Unlocked after solving challenge) */}
        {puzzleSolved && (
          <div className="bg-arena-card border-2 border-electric-emerald/60 rounded-2xl p-4 sm:p-5 shadow-[0_0_35px_rgba(16,185,129,0.2)] space-y-3 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-electric-emerald/30 flex items-center justify-center text-electric-emerald">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-electric-emerald font-bold block">
                    Challenge Verified
                  </span>
                  <h4 className="text-xs font-bold text-white">Scan Station #{assignedLocation?.locationNumber || currentRound} Placard</h4>
                </div>
              </div>
              <span className="text-[10px] font-mono text-arena-muted">Round {currentRound}/9</span>
            </div>

            <button
              type="button"
              onClick={() => setIsQrModalOpen(true)}
              className="w-full h-13 rounded-xl font-mono font-bold text-sm flex items-center justify-center gap-2.5 bg-gradient-to-r from-emerald-400 via-teal-400 to-electric-cyan hover:from-emerald-300 hover:to-cyan-300 text-black shadow-[0_0_25px_rgba(16,185,129,0.4)] active:scale-[0.98] transition-all select-none cursor-pointer"
            >
              <QrCode className="w-5 h-5 text-black" />
              <span>SCAN STATION QR CODE</span>
            </button>
          </div>
        )}
      </main>

      {/* 3. Bottom Progress Bar & Mobile Status Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-arena-bg/95 backdrop-blur-md border-t border-arena-border/80 px-3.5 sm:px-4 py-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-2xl">
        <div className="max-w-xl mx-auto space-y-1.5">
          {/* Quick touch trigger if solved and scrolled past */}
          {puzzleSolved && (
            <button
              type="button"
              onClick={() => setIsQrModalOpen(true)}
              className="w-full h-10 rounded-lg font-mono font-bold text-xs flex items-center justify-center gap-2 bg-electric-cyan/20 border border-electric-cyan/50 text-electric-cyan hover:bg-electric-cyan/30 active:scale-[0.99] transition-all select-none"
            >
              <QrCode className="w-4 h-4" />
              <span>SCAN STATION QR CODE</span>
            </button>
          )}

          {/* Compact Progress Tracker */}
          <div className="pt-0.5">
            <ProgressTracker currentRound={currentRound} totalRounds={config.totalRounds || 9} />
          </div>
        </div>
      </div>

      {/* 4. QR Scanner Modal */}
      <Modal
        isOpen={isQrModalOpen}
        onClose={() => {
          cooldownRef.current = true;
          setIsQrModalOpen(false);
          setTimeout(() => {
            cooldownRef.current = false;
          }, 1500);
        }}
        title="Physical Station QR Verification"
        maxWidth="md"
      >
        {assignedLocation ? (
          <CameraQrScanner
            assignedLocation={assignedLocation}
            riddleClue={riddleClueText}
            onScanSuccess={handleScanSuccess}
            onClose={() => {
              cooldownRef.current = true;
              setIsQrModalOpen(false);
              setTimeout(() => {
                cooldownRef.current = false;
              }, 1500);
            }}
          />
        ) : (
          <div className="p-4 text-center text-arena-muted text-xs font-mono">
            No physical station assigned for this round.
          </div>
        )}
      </Modal>

      {/* 5. Production Anti-Cheat Warning Modal (Dark mystery-themed with Red accents & Remaining Indicators) */}
      {warningModalState.config && (
        <WarningModal
          isOpen={warningModalState.isOpen}
          config={warningModalState.config}
          isFullscreen={isFullscreen}
          onAcknowledge={handleAcknowledgeWarning}
        />
      )}

      {/* 6. Leave Round Confirmation Modal */}
      <Modal
        isOpen={isLeaveModalOpen}
        onClose={() => setIsLeaveModalOpen(false)}
        title="Exit Active Arena Session?"
        maxWidth="sm"
      >
        <div className="space-y-4 py-1">
          <div className="p-3 bg-electric-amber/10 border border-electric-amber/30 rounded-xl text-electric-amber flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <strong className="block text-white">Timer will not pause!</strong>
              <p className="text-arena-muted leading-relaxed">
                The 5-minute round deadline continues running in the background. If the time expires while you are disconnected, your team will be disqualified.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <Button
              variant="outline"
              className="flex-1 h-11"
              onClick={() => setIsLeaveModalOpen(false)}
            >
              Stay in Arena
            </Button>
            <Button
              variant="danger"
              className="flex-1 h-11"
              icon={<LogOut className="w-4 h-4" />}
              onClick={() => {
                setIsLeaveModalOpen(false);
                onLogout();
              }}
            >
              Exit Session
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

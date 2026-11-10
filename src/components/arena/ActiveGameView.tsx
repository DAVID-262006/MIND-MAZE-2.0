import React, { useState } from 'react';
import { PlayerHeader } from '../layout/PlayerHeader';
import { TimerDisplay } from '../ui/TimerDisplay';
import { Button } from '../ui/Button';
import { StatusBadge } from '../ui/StatusBadge';
import { Modal } from '../ui/Modal';
import { useToast } from '../ui/Toast';
import { ProgressTracker } from './ProgressTracker';
import { PuzzleRenderer } from './PuzzleRenderer';
import { CameraQrScanner } from './CameraQrScanner';
import { useGameStore } from '../../store/gameStore';
import { useTimer } from '../../hooks/useTimer';
import { useAntiCheat } from '../../hooks/useAntiCheat';
import { 
  MapPin, 
  QrCode, 
  ShieldAlert, 
  AlertTriangle,
  Lock,
  Unlock,
  LogOut,
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
  } = useGameStore();

  const { success, warning, error: toastError } = useToast();

  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [antiCheatModal, setAntiCheatModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    strikeNumber: number;
  }>({
    isOpen: false,
    title: '',
    message: '',
    strikeNumber: 0,
  });

  const currentRound = Math.max(1, Math.min(10, team.currentRound || 1));
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

  // Anti-cheat hook - called unconditionally in this active view component
  useAntiCheat({
    activeTeam: team,
    isPlaying: config.status === 'live',
    suppressed: isQrModalOpen || antiCheatModal.isOpen || isLeaveModalOpen,
    onViolation: (type: ViolationType, details) => {
      const res = recordViolation(team.id, type, { reason: details.message });
      setAntiCheatModal({
        isOpen: true,
        title: res.eliminated ? 'Disqualified From Arena' : `Anti-Cheat Strike #${res.strikeNumber} Recorded`,
        message: res.message,
        strikeNumber: res.strikeNumber,
      });
    },
  });

  const puzzleSolved = currentProgress?.puzzleSolved ?? false;

  const handlePuzzleSubmit = (answer: string) => {
    return submitAnswer(team.id, currentRound, answer);
  };

  const handleScanSuccess = (token: string) => {
    const res = verifyQrToken(team.id, currentRound, token);
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

      {/* 2. Main Mobile Content */}
      <main className="flex-1 w-full max-w-xl mx-auto px-3.5 sm:px-4 py-3 space-y-4 pb-28">
        {/* Sticky/Prominent Mobile Timer HUD */}
        <div className="bg-arena-card border border-arena-border rounded-2xl p-3 sm:p-4 shadow-lg space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono uppercase tracking-wider text-electric-cyan font-bold bg-electric-cyan/10 px-2 py-0.5 rounded border border-electric-cyan/20">
                Round {currentRound} of 10
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
        </div>

        {/* Checkpoint Target Card */}
        <div className="bg-arena-card border border-arena-border rounded-2xl p-4 shadow-md space-y-2.5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-electric-cyan/10 border border-electric-cyan/30 flex items-center justify-center text-electric-cyan shrink-0">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-electric-cyan font-bold block">
                  Assigned Physical Checkpoint
                </span>
                <h3 className="text-base font-bold text-white leading-tight">
                  {assignedLocation ? assignedLocation.name : 'Resolving checkpoint location...'}
                </h3>
              </div>
            </div>

            <div className="shrink-0">
              {puzzleSolved ? (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-mono font-bold bg-emerald-500/10 text-electric-emerald border border-electric-emerald/30">
                  <Unlock className="w-3 h-3" />
                  UNLOCKED
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-mono font-bold bg-arena-panel text-arena-muted border border-arena-border">
                  <Lock className="w-3 h-3" />
                  LOCKED
                </span>
              )}
            </div>
          </div>

          <p className="text-xs text-arena-muted bg-arena-panel/60 p-2.5 rounded-lg border border-arena-border/50">
            {assignedLocation?.description || 'Navigate to your assigned physical location on campus.'}
          </p>
        </div>

        {/* Puzzle Challenge View */}
        <div className="space-y-3">
          <PuzzleRenderer
            puzzle={currentPuzzle}
            isSolved={puzzleSolved}
            onSolved={() => {
              success('Answer Verified!', 'Proceed to assigned station to scan QR code.');
            }}
            onSubmitAnswer={handlePuzzleSubmit}
          />
        </div>
      </main>

      {/* 3. Bottom Sticky Action & Progress Bar (Mobile-First) */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-arena-bg/95 backdrop-blur-md border-t border-arena-border/80 px-3.5 sm:px-4 py-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-2xl">
        <div className="max-w-xl mx-auto space-y-2">
          {/* Large Touch Scan Button (>= 48px height) */}
          <button
            type="button"
            disabled={!puzzleSolved}
            onClick={() => setIsQrModalOpen(true)}
            className={`w-full h-12 rounded-xl font-mono font-bold text-sm flex items-center justify-center gap-2.5 transition-all select-none ${
              puzzleSolved
                ? 'bg-gradient-to-r from-cyan-400 via-electric-cyan to-emerald-400 text-arena-bg shadow-[0_0_20px_rgba(0,242,254,0.4)] active:scale-[0.98]'
                : 'bg-arena-panel text-arena-muted border border-arena-border cursor-not-allowed opacity-60'
            }`}
          >
            <QrCode className="w-5 h-5" />
            <span>
              {puzzleSolved ? 'SCAN CHECKPOINT QR CODE' : 'SOLVE CHALLENGE TO UNLOCK SCANNER'}
            </span>
          </button>

          {/* Compact 10-Step Progress Tracker */}
          <div className="pt-0.5">
            <ProgressTracker currentRound={currentRound} totalRounds={10} />
          </div>
        </div>
      </div>

      {/* 4. QR Scanner Modal */}
      <Modal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        title="Physical Station QR Verification"
        maxWidth="md"
      >
        {assignedLocation ? (
          <CameraQrScanner
            assignedLocation={assignedLocation}
            onScanSuccess={handleScanSuccess}
            onClose={() => setIsQrModalOpen(false)}
          />
        ) : (
          <div className="p-4 text-center text-arena-muted text-xs font-mono">
            No physical station assigned for this round.
          </div>
        )}
      </Modal>

      {/* 5. Anti-Cheat Warning Modal */}
      <Modal
        isOpen={antiCheatModal.isOpen}
        onClose={() => setAntiCheatModal((prev) => ({ ...prev, isOpen: false }))}
        title={antiCheatModal.title}
        maxWidth="sm"
        showCloseButton={false}
      >
        <div className="space-y-4 text-center py-2">
          <div className="w-14 h-14 rounded-full bg-red-500/10 border border-electric-crimson/40 flex items-center justify-center text-electric-crimson mx-auto animate-pulse">
            <ShieldAlert className="w-8 h-8" />
          </div>

          <div className="space-y-1">
            <p className="text-xs text-arena-muted leading-relaxed">
              {antiCheatModal.message}
            </p>
            <p className="text-xs font-mono font-bold text-white pt-2">
              Current Strike Level: {antiCheatModal.strikeNumber} of 3
            </p>
          </div>

          <Button
            variant={antiCheatModal.strikeNumber >= 3 ? 'danger' : 'primary'}
            className="w-full mt-2 h-11"
            onClick={() => setAntiCheatModal((prev) => ({ ...prev, isOpen: false }))}
          >
            Acknowledge &amp; Return to Arena
          </Button>
        </div>
      </Modal>

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

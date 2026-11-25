import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Compass, User, AlertOctagon, ArrowRight, Play } from 'lucide-react';
import { useGameStore } from '../../store/gameStore';
import { useFullscreen } from '../../hooks/useFullscreen';

export interface LoginViewProps {
  onLoginSuccess?: () => void;
}

export function LoginView({ onLoginSuccess }: LoginViewProps) {
  const { enterAsParticipant, startParticipantGame } = useGameStore();
  const { enterFullscreen } = useFullscreen();

  const [playerName, setPlayerName] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanName = playerName.trim();
    if (!cleanName) {
      setErrorMessage('Please enter your name or team name to continue.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await enterAsParticipant(cleanName);
      if (!res.success || !res.team) {
        setErrorMessage(res.error || 'Could not start game. Please try again.');
        setSubmitting(false);
        return;
      }

      // Immediately start participant game
      try {
        localStorage.setItem(`mm2_team_started_${res.team.id}`, 'true');
      } catch {}
      await startParticipantGame(res.team.id);

      // Attempt Fullscreen directly on user tap
      await enterFullscreen().catch(() => {});
      onLoginSuccess?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[90vh] flex flex-col justify-center items-center px-4 py-6 max-w-md mx-auto w-full select-none">
      {/* Brand Hologram */}
      <div className="text-center space-y-3 mb-6">
        <div className="inline-flex p-3.5 bg-electric-cyan/10 border border-electric-cyan/40 rounded-2xl text-electric-cyan shadow-[0_0_25px_rgba(0,242,254,0.25)] animate-pulse-slow">
          <Compass className="w-10 h-10" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-wider text-white font-mono">
            MIND MAZE 2.0
          </h1>
          <p className="text-[11px] font-mono tracking-widest text-electric-cyan uppercase mt-0.5">
            PARTICIPANT ARENA
          </p>
        </div>
      </div>

      {/* Participant Name Entrance Card */}
      <div className="w-full bg-arena-card border border-electric-cyan/30 rounded-2xl p-5 sm:p-6 shadow-2xl space-y-5">
        <form onSubmit={handleSubmit} className="space-y-4">
          {errorMessage && (
            <div className="p-3 bg-red-500/15 border border-electric-crimson/40 rounded-xl flex items-center gap-2.5 text-xs text-electric-crimson animate-in fade-in duration-200">
              <AlertOctagon className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="space-y-2">
            <Input
              label="Enter Your Name / Team Name"
              placeholder="e.g. Alex, Cyber Titans, Team Alpha"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              leadingIcon={<User className="w-4 h-4" />}
              className="h-12 text-base font-mono"
              autoCapitalize="words"
              autoCorrect="off"
              autoFocus
              required
            />
            <p className="text-[11px] text-arena-muted font-mono">
              No password needed. Enter your name and begin the tournament immediately.
            </p>
          </div>

          {/* Prominent START GAME Button */}
          <Button
            type="submit"
            variant="primary"
            className="w-full h-12 text-sm font-black tracking-wider uppercase shadow-[0_0_20px_rgba(0,242,254,0.35)] mt-3 flex items-center justify-center gap-2"
            loading={submitting}
            icon={<Play className="w-4 h-4 fill-current" />}
          >
            {submitting ? 'STARTING GAME...' : 'START GAME'}
          </Button>
        </form>
      </div>
    </div>
  );
}

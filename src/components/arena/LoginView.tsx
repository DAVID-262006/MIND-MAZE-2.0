import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Compass, Users, AlertOctagon, ArrowRight } from 'lucide-react';
import { useGameStore } from '../../store/gameStore';
import { useFullscreen } from '../../hooks/useFullscreen';
import { mapAuthError } from '../../services/authErrorMapper';

export interface LoginViewProps {
  onLoginSuccess?: () => void;
}

export function LoginView({ onLoginSuccess }: LoginViewProps) {
  const { joinLobbyByTeamName } = useGameStore();
  const { enterFullscreen } = useFullscreen();

  const [teamName, setTeamName] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanName = teamName.trim();
    if (!cleanName) {
      setErrorMessage(mapAuthError('Please enter your team name.'));
      return;
    }

    setSubmitting(true);
    const res = await joinLobbyByTeamName(cleanName);
    setSubmitting(false);

    if (!res.success) {
      setErrorMessage(mapAuthError(res.error));
      return;
    }

    // Attempt Fullscreen directly on user tap
    await enterFullscreen().catch(() => {});
    onLoginSuccess?.();
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
          <p className="text-xs sm:text-sm font-mono tracking-wide text-arena-muted mt-1">
            Enter your team name to join the game.
          </p>
        </div>
      </div>

      {/* Entry Card */}
      <div className="w-full bg-arena-card border border-electric-cyan/30 rounded-2xl p-5 sm:p-6 shadow-2xl space-y-5">
        <form onSubmit={handleSubmit} className="space-y-4">
          {errorMessage && (
            <div className="p-3 bg-red-500/15 border border-electric-crimson/40 rounded-xl flex items-center gap-2.5 text-xs text-electric-crimson animate-in fade-in duration-200">
              <AlertOctagon className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="space-y-3">
            <Input
              label="Enter Team Name"
              placeholder="e.g. TEAM ALPHA"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              leadingIcon={<Users className="w-4 h-4" />}
              className="h-12 text-base font-mono uppercase"
              autoCapitalize="characters"
              autoCorrect="off"
              autoFocus
              required
            />
          </div>

          {/* Prominent JOIN LOBBY Button (min 48px touch target) */}
          <Button
            type="submit"
            variant="primary"
            className="w-full h-12 text-sm font-black tracking-wider uppercase shadow-[0_0_20px_rgba(0,242,254,0.35)] mt-2"
            loading={submitting}
            icon={<ArrowRight className="w-4 h-4" />}
          >
            JOIN LOBBY
          </Button>
        </form>
      </div>
    </div>
  );
}

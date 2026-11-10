import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Compass, KeyRound, User, AlertOctagon, Sparkles, ArrowRight, Maximize2 } from 'lucide-react';
import { useGameStore } from '../../store/gameStore';
import { useFullscreen } from '../../hooks/useFullscreen';

export interface LoginViewProps {
  onLoginSuccess?: () => void;
}

export function LoginView({ onLoginSuccess }: LoginViewProps) {
  const { teams, loginTeam } = useGameStore();
  const { enterFullscreen } = useFullscreen();

  const [teamCode, setTeamCode] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanCode = teamCode.trim().toUpperCase();
    const cleanAccess = accessCode.trim();

    if (!cleanCode) {
      setErrorMessage('Please enter your designated Team ID / Code');
      return;
    }

    if (!cleanAccess) {
      setErrorMessage('Please enter your team access code or password');
      return;
    }

    setSubmitting(true);
    const res = loginTeam(cleanCode, cleanAccess);
    setSubmitting(false);

    if (!res.success) {
      setErrorMessage(res.error || 'Authentication failed. Please verify credentials.');
      return;
    }

    // Attempt Fullscreen directly on user tap
    await enterFullscreen().catch(() => {});
    onLoginSuccess?.();
  };

  const handleQuickConnect = async (code: string, pass: string) => {
    setTeamCode(code);
    setAccessCode(pass);
    setErrorMessage(null);

    const res = loginTeam(code, pass);
    if (res.success) {
      // Attempt Fullscreen directly on user tap
      await enterFullscreen().catch(() => {});
      onLoginSuccess?.();
    } else {
      setErrorMessage(res.error || 'Quick connect failed.');
    }
  };

  // 4 most common quick test teams
  const quickTeams = teams.slice(0, 4);

  return (
    <div className="min-h-[90vh] flex flex-col justify-center items-center px-4 py-6 max-w-md mx-auto w-full">
      {/* Brand Hologram */}
      <div className="text-center space-y-3 mb-6">
        <div className="inline-flex p-3.5 bg-electric-cyan/10 border border-electric-cyan/40 rounded-2xl text-electric-cyan shadow-[0_0_25px_rgba(0,242,254,0.25)] animate-pulse-slow">
          <Compass className="w-10 h-10" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-wider text-white font-mono">
            TREASURE HUNT ARENA
          </h1>
          <p className="text-[11px] font-mono tracking-widest text-electric-cyan uppercase mt-0.5">
            COMPETITOR ARENA ACCESS
          </p>
        </div>
      </div>

      {/* Login Card */}
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
              label="Team Code"
              placeholder="e.g. T01, T02"
              value={teamCode}
              onChange={(e) => setTeamCode(e.target.value)}
              leadingIcon={<User className="w-4 h-4" />}
              className="h-12 text-base font-mono uppercase"
              autoCapitalize="characters"
              required
            />

            <Input
              label="Access Code"
              type="password"
              placeholder="e.g. Arena2026!T01"
              value={accessCode}
              onChange={(e) => setAccessCode(e.target.value)}
              leadingIcon={<KeyRound className="w-4 h-4" />}
              className="h-12 text-base font-mono"
              required
            />
          </div>

          {/* Prominent ENTER ARENA Button (min 48px touch target) */}
          <Button
            type="submit"
            variant="primary"
            className="w-full h-12 text-sm font-black tracking-wider uppercase shadow-[0_0_20px_rgba(0,242,254,0.35)] mt-2"
            loading={submitting}
            icon={<ArrowRight className="w-4 h-4" />}
          >
            ENTER ARENA
          </Button>
        </form>

        {/* Quick Connect Test Credentials */}
        <div className="pt-4 border-t border-arena-border/80 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-arena-muted flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-electric-cyan" />
              <span>Quick-Connect Test Badges</span>
            </span>
            <span className="text-[9px] font-mono text-arena-muted">Tap to Launch</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {quickTeams.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => handleQuickConnect(t.teamCode, t.accessCode)}
                className="p-2.5 text-left bg-arena-panel hover:bg-arena-hover active:scale-[0.98] border border-arena-border hover:border-electric-cyan/50 rounded-xl transition-all"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-electric-cyan">{t.teamCode}</span>
                  <span className="text-[10px] font-mono text-arena-muted">&rarr;</span>
                </div>
                <span className="text-[11px] text-white truncate block font-medium mt-0.5">
                  {t.teamName}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Fullscreen & Single Device Rule Callout */}
        <div className="p-3 bg-arena-panel/50 border border-arena-border/60 rounded-xl flex items-start gap-2.5 text-left text-[11px] text-arena-muted leading-tight">
          <Maximize2 className="w-4 h-4 text-electric-cyan shrink-0 mt-0.5" />
          <span>
            Tapping <strong>ENTER ARENA</strong> requests immersive fullscreen. Leaving this screen or switching tabs records anti-cheat strikes.
          </span>
        </div>
      </div>
    </div>
  );
}

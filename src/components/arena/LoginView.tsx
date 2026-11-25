import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Compass, KeyRound, User, AlertOctagon, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { useGameStore } from '../../store/gameStore';
import { useFullscreen } from '../../hooks/useFullscreen';

export interface LoginViewProps {
  onLoginSuccess?: () => void;
}

export function LoginView({ onLoginSuccess }: LoginViewProps) {
  const { teams, loginTeam } = useGameStore();
  const { enterFullscreen } = useFullscreen();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanUser = username.trim();
    const cleanPass = password.trim();

    if (!cleanUser) {
      setErrorMessage('Please enter your team username or team code.');
      return;
    }

    if (!cleanPass) {
      setErrorMessage('Please enter your designated team password.');
      return;
    }

    setSubmitting(true);
    const res = await loginTeam(cleanUser, cleanPass);
    setSubmitting(false);

    if (!res.success) {
      setErrorMessage(res.error || 'Authentication failed. Please verify credentials.');
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
          <p className="text-[11px] font-mono tracking-widest text-electric-cyan uppercase mt-0.5">
            PARTICIPANT ARENA ACCESS
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
              label="Team Username"
              placeholder="e.g. team01, alpha_centauri"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              leadingIcon={<User className="w-4 h-4" />}
              className="h-12 text-base font-mono"
              autoCapitalize="none"
              autoCorrect="off"
              required
            />

            <div>
              <label className="block text-xs font-mono font-bold text-arena-muted uppercase tracking-wider mb-1">
                Team Password
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter administrator-assigned password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  leadingIcon={<KeyRound className="w-4 h-4" />}
                  className="h-12 text-base font-mono pr-11"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3.5 text-arena-muted hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
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
      </div>
    </div>
  );
}

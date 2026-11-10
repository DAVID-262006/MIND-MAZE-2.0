import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { DashboardCard } from '../ui/DashboardCard';
import { Shield, KeyRound, AlertOctagon, Sparkles } from 'lucide-react';
import { useGameStore } from '../../store/gameStore';

export interface AdminLoginViewProps {
  onLoginSuccess?: () => void;
}

export function AdminLoginView({ onLoginSuccess }: AdminLoginViewProps) {
  const { loginAdmin } = useGameStore();
  const [passphrase, setPassphrase] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const success = loginAdmin(passphrase);
    if (!success) {
      setErrorMessage('Invalid administrator passphrase. (Default: arena2026)');
      return;
    }

    onLoginSuccess?.();
  };

  const handleQuickLogin = () => {
    setPassphrase('arena2026');
    const success = loginAdmin('arena2026');
    if (success) {
      onLoginSuccess?.();
    }
  };

  return (
    <div className="min-h-[80vh] flex flex-col justify-center items-center px-4 py-8">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 bg-electric-violet/10 border border-electric-violet/30 rounded-2xl text-electric-violet mb-2 shadow-[0_0_20px_rgba(139,92,246,0.15)]">
            <Shield className="w-8 h-8 animate-pulse-slow" />
          </div>
          <h2 className="text-2xl font-black tracking-wider text-white">ADMIN CONTROL CENTER</h2>
          <p className="text-xs text-arena-muted font-mono uppercase tracking-widest">
            ORGANIZER &amp; MARSHAL MISSION CONTROL
          </p>
        </div>

        <DashboardCard className="border-electric-violet/30 shadow-[0_0_30px_rgba(0,0,0,0.5)]">
          <form onSubmit={handleSubmit} className="space-y-4">
            {errorMessage && (
              <div className="p-3 bg-red-500/10 border border-electric-crimson/30 rounded-lg flex items-center gap-2.5 text-xs text-electric-crimson animate-in fade-in duration-200">
                <AlertOctagon className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <Input
              label="Master Administrator Passphrase"
              type="password"
              placeholder="Enter admin passphrase..."
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              leadingIcon={<KeyRound className="w-4 h-4" />}
              helperText="Authoritative passphrase for local administration"
              required
            />

            <Button
              type="submit"
              variant="secondary"
              className="w-full h-11 text-xs uppercase tracking-wider font-bold border-electric-violet/50 hover:border-electric-violet text-white"
            >
              Authenticate Admin Session
            </Button>
          </form>

          <div className="mt-5 pt-4 border-t border-arena-border/60 text-center">
            <button
              type="button"
              onClick={handleQuickLogin}
              className="text-xs font-mono text-electric-cyan hover:underline inline-flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Fill Default Passphrase (arena2026)</span>
            </button>
          </div>
        </DashboardCard>
      </div>
    </div>
  );
}


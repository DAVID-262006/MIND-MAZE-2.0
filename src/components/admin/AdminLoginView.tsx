import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { DashboardCard } from '../ui/DashboardCard';
import { Shield, KeyRound, Mail, AlertOctagon, Loader2 } from 'lucide-react';
import { useGameStore } from '../../store/gameStore';

export interface AdminLoginViewProps {
  onLoginSuccess?: () => void;
}

export function AdminLoginView({ onLoginSuccess }: AdminLoginViewProps) {
  const { loginAdmin } = useGameStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email.trim() || !password) {
      setErrorMessage('Please enter both administrator email and password.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await loginAdmin(email, password);
      if (!res.success) {
        setErrorMessage(res.error || 'Authentication failed. Please verify credentials.');
        return;
      }

      onLoginSuccess?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(`Authentication error: ${msg}`);
    } finally {
      setIsLoading(false);
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
              label="Administrator Email"
              type="email"
              placeholder="admin@mindmaze.event"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              leadingIcon={<Mail className="w-4 h-4" />}
              helperText="Authorized Supabase administrator email account"
              required
              disabled={isLoading}
            />

            <Input
              label="Password"
              type="password"
              placeholder="Enter password..."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              leadingIcon={<KeyRound className="w-4 h-4" />}
              helperText="Secure administrator password"
              required
              disabled={isLoading}
            />

            <Button
              type="submit"
              variant="secondary"
              disabled={isLoading}
              className="w-full h-11 text-xs uppercase tracking-wider font-bold border-electric-violet/50 hover:border-electric-violet text-white flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Verifying Credentials...
                </>
              ) : (
                'Authenticate Admin Session'
              )}
            </Button>
          </form>
        </DashboardCard>
      </div>
    </div>
  );
}

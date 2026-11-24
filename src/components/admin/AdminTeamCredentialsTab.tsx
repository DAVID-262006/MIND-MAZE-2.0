import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { 
  KeyRound, 
  Search, 
  Plus, 
  RefreshCw, 
  Download, 
  CheckCircle2, 
  AlertCircle, 
  ShieldCheck, 
  Eye, 
  EyeOff, 
  Lock,
  Sparkles,
  AlertTriangle
} from 'lucide-react';
import { useGameStore } from '../../store/gameStore';
import { useToast } from '../ui/Toast';
import { exportCredentialsCSV } from '../../services/exportService';
import type { Team } from '../../types';

interface GeneratedCred {
  team_id: string;
  team_code: string;
  team_name: string;
  username: string;
  password: string;
}

export function AdminTeamCredentialsTab() {
  const { teams, setTeamCredentials, resetTeamPassword, batchGenerateTeamCredentials, adminRole } = useGameStore();
  const { success, warning, error: toastError } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  
  // Configure / Edit Credentials Modal
  const [configTeam, setConfigTeam] = useState<Team | null>(null);
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset Password Modal
  const [resetTeam, setResetTeam] = useState<Team | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Batch Generation Result Modal
  const [generatedBatch, setGeneratedBatch] = useState<GeneratedCred[] | null>(null);
  const [isBatchGenerating, setIsBatchGenerating] = useState(false);
  const [confirmBatchModal, setConfirmBatchModal] = useState(false);

  const isSuperadminOrAdmin = adminRole === 'superadmin' || adminRole === 'admin';

  // Filter teams by code, name, or username
  const filteredTeams = teams.filter((t) => {
    const q = searchTerm.toLowerCase();
    return (
      t.teamCode.toLowerCase().includes(q) ||
      t.teamName.toLowerCase().includes(q) ||
      (t.username && t.username.toLowerCase().includes(q))
    );
  });

  const configuredCount = teams.filter((t) => t.credentialsConfigured || t.username).length;
  const pendingCount = teams.length - configuredCount;

  // Open Configure Modal
  const handleOpenConfigure = (team: Team) => {
    setConfigTeam(team);
    setUsernameInput(team.username || team.teamCode.toLowerCase());
    setPasswordInput('');
    setShowPassword(false);
  };

  // Submit Configure Credentials
  const handleSaveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!configTeam) return;

    setIsSubmitting(true);
    try {
      const res = await setTeamCredentials(configTeam.id, usernameInput, passwordInput);
      if (res.success) {
        success('Credentials Configured', `Team ${configTeam.teamCode} credentials saved with username "${usernameInput.toLowerCase()}".`);
        setConfigTeam(null);
      } else {
        toastError('Configuration Error', res.error || 'Failed to set team credentials.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Reset Password Modal
  const handleOpenReset = (team: Team) => {
    setResetTeam(team);
    setNewPasswordInput('');
    setShowNewPassword(false);
  };

  // Submit Reset Password
  const handleSaveResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTeam) return;

    setIsSubmitting(true);
    try {
      const res = await resetTeamPassword(resetTeam.id, newPasswordInput);
      if (res.success) {
        success('Password Reset', `Team ${resetTeam.teamCode} password reset successfully. Any active participant session was invalidated.`);
        setResetTeam(null);
      } else {
        toastError('Reset Error', res.error || 'Failed to reset password.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Trigger Batch Generation
  const handleConfirmBatch = async () => {
    setConfirmBatchModal(false);
    setIsBatchGenerating(true);
    try {
      const res = await batchGenerateTeamCredentials();
      if (res.success && res.credentials) {
        setGeneratedBatch(res.credentials);
        success('Batch Generation Complete', `Generated credentials for ${res.count || res.credentials.length} teams.`);
      } else {
        toastError('Generation Failed', res.error || 'Failed to generate credentials.');
      }
    } finally {
      setIsBatchGenerating(false);
    }
  };

  // Download Generated Batch CSV
  const handleDownloadBatchCSV = () => {
    if (!generatedBatch || generatedBatch.length === 0) return;
    const formattedForExport = generatedBatch.map((c) => ({
      team_id: c.team_id,
      team_code: c.team_code,
      team_name: c.team_name,
      passcode: `Username: ${c.username} | Password: ${c.password}`,
    }));
    exportCredentialsCSV(formattedForExport);
    success('CSV Exported', 'Credential manifest file downloaded.');
  };

  return (
    <div className="space-y-4">
      {/* Top Banner / Controls */}
      <div className="bg-arena-card border border-arena-border p-4 sm:p-5 rounded-2xl space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-electric-cyan/15 border border-electric-cyan/30 flex items-center justify-center text-electric-cyan shrink-0">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white font-mono tracking-wide">
                TEAM CREDENTIALS MANAGEMENT
              </h3>
              <p className="text-xs text-arena-muted">
                Admin-managed participant access: configure custom team usernames and secure passwords.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-stretch sm:self-auto">
            {isSuperadminOrAdmin && (
              <Button
                size="sm"
                variant="secondary"
                icon={<Sparkles className="w-3.5 h-3.5 text-electric-amber" />}
                onClick={() => setConfirmBatchModal(true)}
                loading={isBatchGenerating}
                className="text-xs font-mono"
              >
                Auto-Generate All
              </Button>
            )}
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-arena-border/60">
          <div className="p-3 bg-arena-panel rounded-xl border border-arena-border flex items-center justify-between">
            <div>
              <span className="text-[10px] font-mono uppercase text-arena-muted block">Total Teams</span>
              <span className="text-lg font-mono font-bold text-white">{teams.length}</span>
            </div>
            <ShieldCheck className="w-5 h-5 text-electric-cyan" />
          </div>

          <div className="p-3 bg-arena-panel rounded-xl border border-arena-border flex items-center justify-between">
            <div>
              <span className="text-[10px] font-mono uppercase text-arena-muted block">Configured</span>
              <span className="text-lg font-mono font-bold text-electric-emerald">{configuredCount}</span>
            </div>
            <CheckCircle2 className="w-5 h-5 text-electric-emerald" />
          </div>

          <div className="p-3 bg-arena-panel rounded-xl border border-arena-border flex items-center justify-between">
            <div>
              <span className="text-[10px] font-mono uppercase text-arena-muted block">Pending Setup</span>
              <span className="text-lg font-mono font-bold text-electric-amber">{pendingCount}</span>
            </div>
            <AlertCircle className="w-5 h-5 text-electric-amber" />
          </div>

          <div className="p-3 bg-arena-panel rounded-xl border border-arena-border flex items-center justify-between">
            <div>
              <span className="text-[10px] font-mono uppercase text-arena-muted block">Security Engine</span>
              <span className="text-xs font-mono font-bold text-electric-cyan">BCRYPT SALTED</span>
            </div>
            <Lock className="w-5 h-5 text-electric-cyan" />
          </div>
        </div>

        {/* Search Bar */}
        <div className="pt-2">
          <Input
            placeholder="Search teams by code (e.g. T01), name, or username..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            leadingIcon={<Search className="w-4 h-4 text-arena-muted" />}
            className="h-10 text-xs font-mono"
          />
        </div>
      </div>

      {/* Teams Credentials Table */}
      <div className="bg-arena-card border border-arena-border rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-arena-panel text-[11px] font-mono font-bold uppercase tracking-wider text-arena-muted border-b border-arena-border">
              <tr>
                <th className="px-4 py-3">Team Code</th>
                <th className="px-4 py-3">Team Name</th>
                <th className="px-4 py-3">Assigned Username</th>
                <th className="px-4 py-3">Credential Status</th>
                <th className="px-4 py-3">Round</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-arena-border/50 font-mono">
              {filteredTeams.map((team) => {
                const isConfigured = Boolean(team.credentialsConfigured || team.username);
                return (
                  <tr key={team.id} className="hover:bg-arena-panel/40 transition-colors">
                    <td className="px-4 py-3 font-bold text-electric-cyan">
                      {team.teamCode}
                    </td>
                    <td className="px-4 py-3 text-white font-sans font-medium">
                      {team.teamName}
                    </td>
                    <td className="px-4 py-3">
                      {team.username ? (
                        <span className="px-2 py-0.5 rounded bg-arena-panel border border-arena-border text-white text-xs font-mono font-bold">
                          {team.username}
                        </span>
                      ) : (
                        <span className="text-arena-muted italic text-[11px]">Not set</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isConfigured ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-electric-emerald border border-electric-emerald/30">
                          <CheckCircle2 className="w-3 h-3" />
                          Configured
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-electric-amber border border-electric-amber/30">
                          <AlertCircle className="w-3 h-3" />
                          Not Configured
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-arena-muted">
                      R{team.currentRound || 1}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-8 px-2.5 text-[11px]"
                          onClick={() => handleOpenConfigure(team)}
                        >
                          {isConfigured ? 'Edit Login' : 'Configure'}
                        </Button>
                        {isConfigured && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 px-2 text-[11px] text-arena-muted hover:text-white"
                            onClick={() => handleOpenReset(team)}
                            title="Reset password and invalidate active sessions"
                          >
                            Reset Password
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Configure / Edit Modal */}
      <Modal
        isOpen={!!configTeam}
        onClose={() => setConfigTeam(null)}
        title={configTeam?.username ? `Edit Credentials: ${configTeam.teamCode}` : `Configure Credentials: ${configTeam?.teamCode}`}
        maxWidth="sm"
      >
        {configTeam && (
          <form onSubmit={handleSaveCredentials} className="space-y-4 py-1">
            <div className="p-3 bg-arena-panel rounded-xl border border-arena-border text-xs space-y-1">
              <span className="text-arena-muted block text-[10px] uppercase font-mono">Target Team:</span>
              <div className="font-bold text-white text-sm">
                {configTeam.teamCode} &bull; {configTeam.teamName}
              </div>
            </div>

            <Input
              label="Assigned Username"
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
              placeholder="e.g. team_alpha or alpha_centauri"
              helperText="3-30 lowercase characters (letters, numbers, hyphens, underscores)"
              required
              className="font-mono text-sm"
            />

            <div>
              <label className="block text-xs font-mono font-bold text-arena-muted uppercase tracking-wider mb-1">
                {configTeam.username ? 'New Password' : 'Team Password'}
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Minimum 6 characters"
                  required
                  className="font-mono text-sm pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-arena-muted hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[10px] text-arena-muted mt-1 font-mono">
                Stored as a salted bcrypt hash. Never visible in plaintext API responses.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-arena-border/60">
              <Button variant="ghost" size="sm" type="button" onClick={() => setConfigTeam(null)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" type="submit" loading={isSubmitting}>
                Save Credentials
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Reset Password Modal */}
      <Modal
        isOpen={!!resetTeam}
        onClose={() => setResetTeam(null)}
        title={`Reset Password: ${resetTeam?.teamCode}`}
        maxWidth="sm"
      >
        {resetTeam && (
          <form onSubmit={handleSaveResetPassword} className="space-y-4 py-1">
            <div className="p-3 bg-red-950/40 border border-red-500/40 rounded-xl text-red-200 text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <strong className="block text-red-300 font-bold">Session Revocation Notice</strong>
                <p className="text-zinc-300 leading-snug">
                  Resetting this team’s password will immediately invalidate any active participant session on their device.
                </p>
              </div>
            </div>

            <div className="p-3 bg-arena-panel rounded-xl border border-arena-border text-xs space-y-1">
              <span className="text-arena-muted block text-[10px] uppercase font-mono">Team Username:</span>
              <div className="font-mono font-bold text-electric-cyan">
                {resetTeam.username || resetTeam.teamCode.toLowerCase()}
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono font-bold text-arena-muted uppercase tracking-wider mb-1">
                New Team Password
              </label>
              <div className="relative">
                <Input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPasswordInput}
                  onChange={(e) => setNewPasswordInput(e.target.value)}
                  placeholder="Minimum 6 characters"
                  required
                  className="font-mono text-sm pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-2.5 text-arena-muted hover:text-white"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-arena-border/60">
              <Button variant="ghost" size="sm" type="button" onClick={() => setResetTeam(null)}>
                Cancel
              </Button>
              <Button variant="danger" size="sm" type="submit" loading={isSubmitting}>
                Reset Password
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Confirmation Modal for Auto-Generate All */}
      <Modal
        isOpen={confirmBatchModal}
        onClose={() => setConfirmBatchModal(false)}
        title="Auto-Generate All Team Credentials"
        maxWidth="sm"
      >
        <div className="space-y-4 py-1">
          <div className="p-3 bg-amber-500/15 border border-electric-amber/40 rounded-xl text-xs text-amber-200 flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-electric-amber shrink-0 mt-0.5" />
            <div className="space-y-1.5 leading-relaxed">
              <strong className="block text-amber-300 font-bold">Cryptographic Batch Generation</strong>
              <p className="text-zinc-300">
                This will automatically generate randomized credentials for all 20 teams, hash them with bcrypt, and display a manifest with a CSV download button.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-arena-border/60">
            <Button variant="ghost" size="sm" onClick={() => setConfirmBatchModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleConfirmBatch}>
              Confirm Generation
            </Button>
          </div>
        </div>
      </Modal>

      {/* Generated Batch Display Modal */}
      <Modal
        isOpen={!!generatedBatch}
        onClose={() => setGeneratedBatch(null)}
        title="Generated Team Credentials Manifest"
        maxWidth="lg"
      >
        {generatedBatch && (
          <div className="space-y-4 py-1">
            <div className="p-3 bg-emerald-500/15 border border-electric-emerald/40 rounded-xl text-xs text-emerald-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-electric-emerald" />
                <span>Generated credentials for <strong>{generatedBatch.length}</strong> teams. Download CSV now.</span>
              </div>
              <Button
                size="sm"
                variant="primary"
                icon={<Download className="w-3.5 h-3.5" />}
                onClick={handleDownloadBatchCSV}
                className="text-xs font-mono font-bold"
              >
                Download CSV
              </Button>
            </div>

            <div className="max-h-72 overflow-y-auto border border-arena-border rounded-xl">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-arena-panel text-[10px] uppercase text-arena-muted sticky top-0 border-b border-arena-border">
                  <tr>
                    <th className="px-3 py-2">Code</th>
                    <th className="px-3 py-2">Team Name</th>
                    <th className="px-3 py-2">Username</th>
                    <th className="px-3 py-2">Password</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-arena-border/50">
                  {generatedBatch.map((item) => (
                    <tr key={item.team_id} className="hover:bg-arena-panel/40">
                      <td className="px-3 py-2 text-electric-cyan font-bold">{item.team_code}</td>
                      <td className="px-3 py-2 text-white font-sans">{item.team_name}</td>
                      <td className="px-3 py-2 text-electric-emerald">{item.username}</td>
                      <td className="px-3 py-2 text-white font-bold tracking-wider">{item.password}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-2 border-t border-arena-border/60">
              <Button variant="ghost" size="sm" onClick={() => setGeneratedBatch(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}


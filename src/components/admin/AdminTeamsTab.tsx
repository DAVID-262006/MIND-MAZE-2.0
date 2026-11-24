import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { StatusBadge } from '../ui/StatusBadge';
import { Modal } from '../ui/Modal';
import { ConfirmationDialog } from '../ui/Dialog';
import { 
  Users, 
  Plus, 
  Search, 
  KeyRound, 
  Trash2, 
  UserX, 
  UserCheck, 
  Edit3, 
  CheckCircle2, 
  ShieldAlert,
  Download,
  AlertTriangle,
  Loader2,
  Lock,
  EyeOff
} from 'lucide-react';
import { useToast } from '../ui/Toast';
import { useGameStore } from '../../store/gameStore';
import { SupabaseService } from '../../services/supabaseService';
import { exportCredentialsCSV } from '../../services/exportService';
import type { Team } from '../../types';

interface IssuedCredential {
  team_id: string;
  team_code: string;
  team_name: string;
  passcode: string;
}

export function AdminTeamsTab() {
  const { teams, adminRole, adminToken, createTeam, updateTeam, deleteTeam, eliminateTeam, reinstateTeam } = useGameStore();
  const { success, warning, error: toastError } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamCode, setNewTeamCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit Team state
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [editName, setEditName] = useState('');
  const [editCode, setEditCode] = useState('');

  // Eliminate & Delete states
  const [targetTeam, setTargetTeam] = useState<Team | null>(null);
  const [isEliminateOpen, setIsEliminateOpen] = useState(false);
  const [eliminationReason, setEliminationReason] = useState('Manual disqualification by marshal');
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  // Credential generation modal states
  const [isCredentialsModalOpen, setIsCredentialsModalOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [confirmInput, setConfirmInput] = useState('');
  const [generatedCredentials, setGeneratedCredentials] = useState<IssuedCredential[] | null>(null);

  const isSuperadminOrAdmin = adminRole === 'superadmin' || adminRole === 'admin';

  const filteredTeams = teams.filter(
    (t) =>
      t.teamName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.teamCode.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await createTeam(newTeamName, newTeamCode);
      if (res.success) {
        success('Team Created', `Added team ${newTeamCode.toUpperCase()} (${newTeamName}).`);
        setIsCreateOpen(false);
        setNewTeamName('');
        setNewTeamCode('');
      } else {
        toastError('Create Error', res.error || 'Failed to create team.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTeam) return;

    setIsSubmitting(true);
    try {
      const res = await updateTeam(editingTeam.id, {
        teamName: editName.trim(),
        teamCode: editCode.trim().toUpperCase(),
      });

      if (res.success) {
        success('Team Updated', `Details for ${editCode.toUpperCase()} updated.`);
        setEditingTeam(null);
      } else {
        toastError('Update Error', res.error || 'Failed to update team.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEdit = (team: Team) => {
    setEditingTeam(team);
    setEditName(team.teamName);
    setEditCode(team.teamCode);
  };

  const handleGenerateCredentials = async () => {
    if (confirmInput.trim() !== 'CONFIRM') {
      toastError('Confirmation Required', 'Please type CONFIRM to proceed with credential generation.');
      return;
    }

    setIsGenerating(true);
    try {
      const res = await SupabaseService.adminGenerateTeamCredentials('CONFIRM_GENERATE_CREDENTIALS', adminToken || '');
      if (res.success && res.data?.credentials) {
        setGeneratedCredentials(res.data.credentials);
        success('Credentials Generated', `Cryptographically secure credentials generated for ${res.data.count || res.data.credentials.length} teams.`);
      } else {
        toastError('Generation Failed', res.error || res.data?.message || 'Failed to generate credentials.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toastError('Execution Error', msg);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadCSV = () => {
    if (!generatedCredentials || generatedCredentials.length === 0) return;
    exportCredentialsCSV(generatedCredentials);
    success('CSV Downloaded', 'Team credentials exported. Store this file securely.');
  };

  const handleCloseCredentialsModal = () => {
    // Purge plain credentials from component state
    setGeneratedCredentials(null);
    setConfirmInput('');
    setIsCredentialsModalOpen(false);
  };

  return (
    <div className="space-y-4">
      {/* Top Header & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-arena-card border border-arena-border p-4 rounded-xl">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-arena-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by team name or code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-arena-panel border border-arena-border rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-arena-muted outline-none focus:border-electric-cyan font-mono"
            />
          </div>
          <span className="text-xs font-mono text-arena-muted whitespace-nowrap">
            {filteredTeams.length} / {teams.length} Teams
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Deliberate Credential Generation Button */}
          {isSuperadminOrAdmin && (
            <Button
              size="sm"
              variant="outline"
              icon={<KeyRound className="w-3.5 h-3.5 text-electric-amber" />}
              onClick={() => {
                setGeneratedCredentials(null);
                setConfirmInput('');
                setIsCredentialsModalOpen(true);
              }}
              className="text-xs border-electric-amber/40 hover:border-electric-amber"
            >
              Issue Credentials
            </Button>
          )}

          <Button
            size="sm"
            variant="primary"
            icon={<Plus className="w-3.5 h-3.5" />}
            onClick={() => setIsCreateOpen(true)}
            disabled={!isSuperadminOrAdmin}
          >
            Add New Team
          </Button>
        </div>
      </div>

      {/* Teams Table */}
      <div className="bg-arena-card border border-arena-border rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-arena-border bg-arena-panel/50 font-mono text-[11px] text-arena-muted uppercase tracking-wider">
                <th className="py-3 px-4">Code</th>
                <th className="py-3 px-4">Team Name</th>
                <th className="py-3 px-4">Credentials Status</th>
                <th className="py-3 px-4">Round</th>
                <th className="py-3 px-4">Strikes</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-arena-border/50 font-mono">
              {filteredTeams.map((team) => (
                <tr key={team.id} className="hover:bg-arena-panel/30 transition-colors">
                  <td className="py-3 px-4 font-bold text-electric-cyan">{team.teamCode}</td>
                  <td className="py-3 px-4 text-white font-sans font-medium">{team.teamName}</td>
                  <td className="py-3 px-4">
                    {team.credentialsRandomized ? (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-950/60 border border-emerald-500/40 text-emerald-400">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        <span>Issued &amp; Encrypted</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-950/60 border border-amber-500/40 text-amber-400">
                        <ShieldAlert className="w-3 h-3 text-amber-400" />
                        <span>Locked / Unissued</span>
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-white font-bold">Round {team.currentRound}</td>
                  <td className="py-3 px-4">
                    <span
                      className={`font-bold ${
                        team.strikes === 0
                          ? 'text-electric-emerald'
                          : team.strikes === 1
                          ? 'text-electric-amber'
                          : 'text-electric-crimson'
                      }`}
                    >
                      {team.strikes} / 3
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <StatusBadge
                      variant={
                        team.status === 'active'
                          ? 'active'
                          : team.status === 'completed'
                          ? 'completed'
                          : team.status === 'eliminated'
                          ? 'eliminated'
                          : 'ready'
                      }
                      label={team.status.toUpperCase()}
                      pulse={team.status === 'active'}
                    />
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openEdit(team)}
                        className="p-1.5 text-arena-muted hover:text-white"
                        title="Edit team details"
                        disabled={!isSuperadminOrAdmin}
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </Button>

                      {team.status === 'eliminated' ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={async () => {
                            try {
                              await reinstateTeam(team.id);
                              success('Team Reinstated', `${team.teamCode} strikes cleared and reinstated.`);
                            } catch (err: unknown) {
                              const msg = err instanceof Error ? err.message : String(err);
                              toastError('Reinstate Failed', msg);
                            }
                          }}
                          className="p-1.5 text-electric-emerald hover:bg-emerald-500/10"
                          title="Reinstate eliminated team"
                          disabled={!isSuperadminOrAdmin}
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setTargetTeam(team);
                            setIsEliminateOpen(true);
                          }}
                          className="p-1.5 text-electric-amber hover:bg-amber-500/10"
                          title="Disqualify / Eliminate team"
                        >
                          <UserX className="w-3.5 h-3.5" />
                        </Button>
                      )}

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setTargetTeam(team);
                          setIsDeleteOpen(true);
                        }}
                        className="p-1.5 text-electric-crimson hover:bg-red-500/10"
                        title="Delete team"
                        disabled={!isSuperadminOrAdmin}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Create Team */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Register New Competitor Team"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <Input
            label="Team Code"
            placeholder="e.g. T21"
            value={newTeamCode}
            onChange={(e) => setNewTeamCode(e.target.value)}
            required
            disabled={isSubmitting}
            helperText="Unique uppercase identifier (e.g. T01 to T25)"
          />
          <Input
            label="Team Name"
            placeholder="e.g. Orion Navigators"
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.target.value)}
            required
            disabled={isSubmitting}
          />
          <div className="p-3 bg-arena-panel/60 border border-arena-border rounded-lg text-xs text-arena-muted flex items-start gap-2">
            <Lock className="w-4 h-4 text-electric-cyan shrink-0 mt-0.5" />
            <span>
              Passcodes are generated using high-entropy server-side cryptography. When created, the team will be initialized with credentials locked until the administrator runs the credential issuance tool.
            </span>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" type="button" onClick={() => setIsCreateOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Registering...' : 'Register Team'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Edit Team */}
      <Modal
        isOpen={!!editingTeam}
        onClose={() => setEditingTeam(null)}
        title={`Edit Team ${editingTeam?.teamCode}`}
      >
        <form onSubmit={handleSaveEdit} className="space-y-4">
          <Input
            label="Team Code"
            value={editCode}
            onChange={(e) => setEditCode(e.target.value)}
            required
            disabled={isSubmitting}
          />
          <Input
            label="Team Name"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            required
            disabled={isSubmitting}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" type="button" onClick={() => setEditingTeam(null)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Credential Generation & One-Time Display */}
      <Modal
        isOpen={isCredentialsModalOpen}
        onClose={handleCloseCredentialsModal}
        title="Cryptographic Team Credential Generation"
        maxWidth="xl"
      >
        <div className="space-y-4 py-1">
          {!generatedCredentials ? (
            <div className="space-y-4">
              <div className="p-3.5 bg-amber-950/40 border border-amber-500/50 rounded-xl text-amber-200 text-xs space-y-2">
                <div className="flex items-center gap-2 font-bold text-amber-300">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>CRITICAL SECURITY WARNING: ACTIVE SESSIONS WILL BE INVALIDATED</span>
                </div>
                <p className="leading-relaxed">
                  Generating new team credentials will create cryptographically random passcodes on the server, hash them using bcrypt, and invalidate any existing team logins and active sessions.
                </p>
                <p className="leading-relaxed font-semibold text-white">
                  The generated plaintext passcodes will be shown ONCE on the next screen for CSV export. They are NEVER stored in the database or server logs.
                </p>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-semibold text-arena-muted uppercase tracking-wider">
                  Type <span className="text-white font-mono font-bold">CONFIRM</span> to proceed:
                </label>
                <input
                  type="text"
                  placeholder="CONFIRM"
                  value={confirmInput}
                  onChange={(e) => setConfirmInput(e.target.value)}
                  className="w-full bg-arena-panel border border-arena-border rounded-lg px-3 py-2 text-xs text-white placeholder-arena-muted/50 font-mono outline-none focus:border-electric-amber"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-arena-border/60">
                <Button variant="ghost" size="sm" onClick={handleCloseCredentialsModal} disabled={isGenerating}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleGenerateCredentials}
                  disabled={confirmInput.trim() !== 'CONFIRM' || isGenerating}
                  className="bg-electric-amber text-arena-bg hover:bg-amber-400 font-bold"
                  icon={isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5" />}
                >
                  {isGenerating ? 'Generating Cryptographic Keys...' : 'Generate Team Credentials'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-3 bg-emerald-950/40 border border-emerald-500/50 rounded-xl text-xs text-emerald-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Credentials generated for {generatedCredentials.length} teams. Download the CSV now.</span>
                </div>
                <Button
                  size="sm"
                  variant="primary"
                  icon={<Download className="w-3.5 h-3.5" />}
                  onClick={handleDownloadCSV}
                  className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold h-7 text-xs"
                >
                  Download CSV
                </Button>
              </div>

              <div className="max-h-72 overflow-y-auto border border-arena-border rounded-xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-arena-panel sticky top-0 border-b border-arena-border">
                    <tr className="font-mono text-[10px] text-arena-muted uppercase tracking-wider">
                      <th className="py-2 px-3">Code</th>
                      <th className="py-2 px-3">Team Name</th>
                      <th className="py-2 px-3">Generated Passcode (Shown Once)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-arena-border/50 font-mono">
                    {generatedCredentials.map((c) => (
                      <tr key={c.team_id} className="hover:bg-arena-panel/30">
                        <td className="py-2 px-3 font-bold text-electric-cyan">{c.team_code}</td>
                        <td className="py-2 px-3 text-white font-sans">{c.team_name}</td>
                        <td className="py-2 px-3 text-electric-amber font-bold tracking-wider select-all">
                          {c.passcode}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="p-2.5 bg-arena-panel/40 border border-arena-border/60 rounded-lg text-[11px] text-arena-muted flex items-center gap-2">
                <EyeOff className="w-4 h-4 text-arena-muted shrink-0" />
                <span>
                  Closing this modal will permanently clear these plaintext passcodes from browser memory.
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-arena-border/60">
                <Button variant="secondary" size="sm" onClick={handleCloseCredentialsModal}>
                  Dismiss &amp; Clear Credentials
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Modal: Eliminate Team */}
      <Modal
        isOpen={isEliminateOpen}
        onClose={() => setIsEliminateOpen(false)}
        title={`Disqualify Team ${targetTeam?.teamCode}`}
      >
        <div className="space-y-4">
          <p className="text-xs text-arena-muted">
            Eliminating <strong className="text-white">{targetTeam?.teamName}</strong> permanently locks their device arena inputs and excludes them from winner eligibility.
          </p>
          <Input
            label="Disqualification Reason"
            value={eliminationReason}
            onChange={(e) => setEliminationReason(e.target.value)}
            required
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => setIsEliminateOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={async () => {
                if (targetTeam) {
                  try {
                    await eliminateTeam(targetTeam.id, eliminationReason);
                    setIsEliminateOpen(false);
                    warning('Team Eliminated', `${targetTeam.teamCode} disqualified.`);
                  } catch (err: unknown) {
                    const msg = err instanceof Error ? err.message : String(err);
                    toastError('Elimination Failed', msg);
                  }
                }
              }}
            >
              Disqualify Team
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmationDialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={async () => {
          if (targetTeam) {
            try {
              const res = await deleteTeam(targetTeam.id);
              if (res && !res.success) {
                toastError('Delete Failed', res.error || 'Failed to delete team.');
              } else {
                success('Team Deleted', `${targetTeam.teamCode} removed.`);
              }
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : String(err);
              toastError('Delete Failed', msg);
            } finally {
              setIsDeleteOpen(false);
            }
          }
        }}
        title="Delete Team"
        message={`Are you sure you want to delete ${targetTeam?.teamName} (${targetTeam?.teamCode})? This will also remove their progress records.`}
        confirmLabel="Delete Team"
        isDestructive
      />
    </div>
  );
}

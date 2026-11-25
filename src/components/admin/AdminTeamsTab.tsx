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
  Trash2, 
  UserX, 
  UserCheck, 
  Edit3, 
  LogOut,
  Radio,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { useToast } from '../ui/Toast';
import { useGameStore } from '../../store/gameStore';
import type { Team } from '../../types';

export function AdminTeamsTab() {
  const { 
    teams, 
    adminRole, 
    createTeam, 
    updateTeam, 
    deleteTeam, 
    eliminateTeam, 
    reinstateTeam, 
    revokeTeamSession 
  } = useGameStore();
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

  // Eliminate, Revoke & Delete states
  const [targetTeam, setTargetTeam] = useState<Team | null>(null);
  const [isEliminateOpen, setIsEliminateOpen] = useState(false);
  const [eliminationReason, setEliminationReason] = useState('Manual disqualification by marshal');
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isRevokeOpen, setIsRevokeOpen] = useState(false);

  const isSuperadminOrAdmin = adminRole === 'superadmin' || adminRole === 'admin';

  const filteredTeams = teams.filter(
    (t) =>
      t.teamName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.teamCode.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newTeamName.trim();
    if (!cleanName) {
      toastError('Validation Error', 'Team name is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createTeam(cleanName, newTeamCode.trim() || undefined);
      if (res.success) {
        success('Team Registered', `Registered team "${cleanName}". Participants can now join by this team name.`);
        setIsCreateOpen(false);
        setNewTeamName('');
        setNewTeamCode('');
      } else {
        toastError('Registration Error', res.error || 'Failed to register team.');
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
        success('Team Updated', `Details for ${editName.trim()} updated.`);
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

  const handleRevokeSession = async () => {
    if (!targetTeam) return;
    setIsSubmitting(true);
    try {
      const res = await revokeTeamSession(targetTeam.id);
      if (res.success) {
        success('Session Revoked', `Active session for "${targetTeam.teamName}" has been terminated.`);
      } else {
        toastError('Revoke Failed', res.error || 'Could not revoke session.');
      }
    } finally {
      setIsSubmitting(false);
      setIsRevokeOpen(false);
      setTargetTeam(null);
    }
  };

  // Helper to determine fine-grained live lobby/game status
  const getTeamOperationalStatus = (team: Team) => {
    if (team.status === 'eliminated') {
      return { label: 'Eliminated', variant: 'eliminated' as const, dotColor: 'bg-red-500' };
    }
    if (team.status === 'completed') {
      return { label: 'Completed', variant: 'completed' as const, dotColor: 'bg-emerald-400' };
    }

    // Check heartbeat freshness (within 60s)
    const isHeartbeatFresh = team.lastSeenAt && (Date.now() - new Date(team.lastSeenAt).getTime()) < 60000;

    if (team.status === 'active') {
      if (isHeartbeatFresh) {
        return { label: 'Online — Playing', variant: 'active' as const, dotColor: 'bg-cyan-400' };
      }
      return { label: 'Offline', variant: 'neutral' as const, dotColor: 'bg-zinc-500' };
    }

    // Status is 'ready' (in lobby) or idle
    if (team.activeSessionToken || team.lastSeenAt) {
      if (isHeartbeatFresh) {
        return { label: 'Online — Lobby', variant: 'ready' as const, dotColor: 'bg-amber-400' };
      }
      return { label: 'Offline', variant: 'neutral' as const, dotColor: 'bg-zinc-500' };
    }

    return { label: 'Not Joined', variant: 'neutral' as const, dotColor: 'bg-zinc-600' };
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
          <Button
            size="sm"
            variant="primary"
            icon={<Plus className="w-3.5 h-3.5" />}
            onClick={() => setIsCreateOpen(true)}
            disabled={!isSuperadminOrAdmin}
          >
            Register Team
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
                <th className="py-3 px-4">Team Name (Entry Key)</th>
                <th className="py-3 px-4">Live Status</th>
                <th className="py-3 px-4">Round</th>
                <th className="py-3 px-4">Strikes</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-arena-border/50 font-mono">
              {filteredTeams.map((team) => {
                const opStatus = getTeamOperationalStatus(team);
                return (
                  <tr key={team.id} className="hover:bg-arena-panel/30 transition-colors">
                    <td className="py-3 px-4 font-bold text-electric-cyan">{team.teamCode}</td>
                    <td className="py-3 px-4 text-white font-sans font-medium">
                      <div className="flex items-center gap-2">
                        <span>{team.teamName}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-arena-panel border border-arena-border text-white">
                        <span className={`w-2 h-2 rounded-full ${opStatus.dotColor} ${opStatus.variant === 'active' || opStatus.variant === 'ready' ? 'animate-pulse' : ''}`} />
                        <span>{opStatus.label}</span>
                      </span>
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
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Revoke Session Button */}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setTargetTeam(team);
                            setIsRevokeOpen(true);
                          }}
                          className="p-1.5 text-electric-amber hover:bg-amber-500/10"
                          title="Revoke active team session (forces device to rejoin)"
                          disabled={!isSuperadminOrAdmin}
                        >
                          <LogOut className="w-3.5 h-3.5" />
                        </Button>

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
                                success('Team Reinstated', `${team.teamName} strikes cleared and reinstated.`);
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
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Register Team (Only Name & Code) */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Register New Competitor Team"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <Input
            label="Team Name"
            placeholder="e.g. TEAM ALPHA, ORION NAVIGATORS"
            value={newTeamName}
            onChange={(e) => {
              setNewTeamName(e.target.value);
              if (!newTeamCode && e.target.value.trim()) {
                const words = e.target.value.trim().split(/\s+/);
                const code = words.length > 1 
                  ? (words[0][0] + words[1][0]).toUpperCase() 
                  : words[0].slice(0, 3).toUpperCase();
                setNewTeamCode(code);
              }
            }}
            required
            disabled={isSubmitting}
            helperText="Participants enter this exact name to join the lobby."
          />
          <Input
            label="Team Code (Optional)"
            placeholder="e.g. T01, TA"
            value={newTeamCode}
            onChange={(e) => setNewTeamCode(e.target.value)}
            disabled={isSubmitting}
            helperText="Short uppercase tag used on admin dashboards."
          />
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
            label="Team Name"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            required
            disabled={isSubmitting}
            helperText="Changing this updates the team name participants enter to join."
          />
          <Input
            label="Team Code"
            value={editCode}
            onChange={(e) => setEditCode(e.target.value)}
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

      {/* Modal: Revoke Session */}
      <ConfirmationDialog
        isOpen={isRevokeOpen}
        onClose={() => {
          setIsRevokeOpen(false);
          setTargetTeam(null);
        }}
        onConfirm={handleRevokeSession}
        title="Revoke Team Session"
        message={`Are you sure you want to revoke the active session for "${targetTeam?.teamName}"? This frees the team name so a new device or reconnecting participant can join.`}
        confirmLabel="Revoke Session"
      />

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

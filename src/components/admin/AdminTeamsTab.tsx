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
  ShieldAlert 
} from 'lucide-react';
import { useToast } from '../ui/Toast';
import { useGameStore } from '../../store/gameStore';
import type { Team } from '../../types';

export function AdminTeamsTab() {
  const { teams, createTeam, updateTeam, deleteTeam, eliminateTeam, reinstateTeam } = useGameStore();
  const { success, warning, error: toastError } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamCode, setNewTeamCode] = useState('');
  const [newAccessCode, setNewAccessCode] = useState('');

  // Edit Team state
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [editName, setEditName] = useState('');
  const [editCode, setEditCode] = useState('');
  const [editAccess, setEditAccess] = useState('');

  // Eliminate & Delete states
  const [targetTeam, setTargetTeam] = useState<Team | null>(null);
  const [isEliminateOpen, setIsEliminateOpen] = useState(false);
  const [eliminationReason, setEliminationReason] = useState('Manual disqualification by marshal');
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const filteredTeams = teams.filter(
    (t) =>
      t.teamName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.teamCode.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const res = createTeam(newTeamName, newTeamCode, newAccessCode);
    if (res.success) {
      success('Team Created', `Added team ${newTeamCode.toUpperCase()} (${newTeamName}).`);
      setIsCreateOpen(false);
      setNewTeamName('');
      setNewTeamCode('');
      setNewAccessCode('');
    } else {
      toastError('Create Error', res.error || 'Failed to create team.');
    }
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTeam) return;

    updateTeam(editingTeam.id, {
      teamName: editName.trim(),
      teamCode: editCode.trim().toUpperCase(),
      accessCode: editAccess.trim(),
    });

    success('Team Updated', `Credentials for ${editCode.toUpperCase()} updated.`);
    setEditingTeam(null);
  };

  const openEdit = (team: Team) => {
    setEditingTeam(team);
    setEditName(team.teamName);
    setEditCode(team.teamCode);
    setEditAccess(team.accessCode);
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

        <Button
          size="sm"
          variant="primary"
          icon={<Plus className="w-3.5 h-3.5" />}
          onClick={() => setIsCreateOpen(true)}
        >
          Add New Team
        </Button>
      </div>

      {/* Teams Table */}
      <div className="bg-arena-card border border-arena-border rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-arena-border bg-arena-panel/50 font-mono text-[11px] text-arena-muted uppercase tracking-wider">
                <th className="py-3 px-4">Code</th>
                <th className="py-3 px-4">Team Name</th>
                <th className="py-3 px-4">Access Code</th>
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
                  <td className="py-3 px-4 text-arena-muted font-mono">{team.accessCode}</td>
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
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </Button>

                      {team.status === 'eliminated' ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            reinstateTeam(team.id);
                            success('Team Reinstated', `${team.teamCode} strikes cleared and reinstated.`);
                          }}
                          className="p-1.5 text-electric-emerald hover:bg-emerald-500/10"
                          title="Reinstate eliminated team"
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
          />
          <Input
            label="Team Name"
            placeholder="e.g. Orion Navigators"
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.target.value)}
            required
          />
          <Input
            label="Access Code (Optional)"
            placeholder="Defaults to Arena2026!CODE"
            value={newAccessCode}
            onChange={(e) => setNewAccessCode(e.target.value)}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" type="button" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit">
              Register Team
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
          />
          <Input
            label="Team Name"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            required
          />
          <Input
            label="Access Code"
            value={editAccess}
            onChange={(e) => setEditAccess(e.target.value)}
            required
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" type="button" onClick={() => setEditingTeam(null)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit">
              Save Changes
            </Button>
          </div>
        </form>
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
              onClick={() => {
                if (targetTeam) {
                  eliminateTeam(targetTeam.id, eliminationReason);
                  setIsEliminateOpen(false);
                  warning('Team Eliminated', `${targetTeam.teamCode} disqualified.`);
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
        onConfirm={() => {
          if (targetTeam) {
            deleteTeam(targetTeam.id);
            setIsDeleteOpen(false);
            success('Team Deleted', `${targetTeam.teamCode} removed.`);
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


import React, { useState } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  AlertOctagon,
  Search,
  RotateCcw,
  Clock,
  Info,
  Filter,
  Eye,
  ChevronDown,
  ChevronRight,
  UserX,
  UserCheck
} from 'lucide-react';
import { Button } from '../ui/Button';
import { StatusBadge } from '../ui/StatusBadge';
import { Modal } from '../ui/Modal';
import { useToast } from '../ui/Toast';
import { useGameStore } from '../../store/gameStore';
import { ViolationManager } from '../../services/violationManager';
import type { Team, AntiCheatIncident, ViolationType } from '../../types';

export function AdminViolationMonitor() {
  const { teams, incidents, reinstateTeam, eliminateTeam } = useGameStore();
  const { success, warning: toastWarning, error: toastError } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'clean' | 'warned' | 'eliminated'>('all');
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);

  // Statistics
  const totalTeams = teams.length;
  const cleanTeams = teams.filter((t) => (t.strikes || 0) === 0 && t.status !== 'eliminated').length;
  const warnedTeams = teams.filter((t) => (t.strikes || 0) > 0 && t.status !== 'eliminated').length;
  const eliminatedTeams = teams.filter((t) => t.status === 'eliminated' || (t.strikes || 0) >= 4).length;

  // Filtered Teams
  const filteredTeams = teams.filter((t) => {
    const matchesSearch =
      t.teamName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.teamCode.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (filterStatus === 'clean') return (t.strikes || 0) === 0 && t.status !== 'eliminated';
    if (filterStatus === 'warned') return (t.strikes || 0) > 0 && t.status !== 'eliminated';
    if (filterStatus === 'eliminated') return t.status === 'eliminated' || (t.strikes || 0) >= 4;

    return true;
  });

  const handlePardon = async (team: Team) => {
    try {
      await reinstateTeam(team.id);
      success('Strikes Cleared', `Pardoned strikes for ${team.teamName} (${team.teamCode}).`);
      if (selectedTeam?.id === team.id) {
        setSelectedTeam(null);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toastError('Pardon Failed', msg);
    }
  };

  const handleManualEliminate = async (team: Team) => {
    try {
      await eliminateTeam(team.id, 'Disqualified by marshal: Manual Anti-Cheat Elimination.');
      toastWarning('Team Eliminated', `Team ${team.teamCode} disqualified from arena.`);
      if (selectedTeam?.id === team.id) {
        setSelectedTeam(null);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toastError('Elimination Failed', msg);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Overview Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-arena-card border border-arena-border rounded-xl p-3.5 space-y-1">
          <span className="text-[11px] font-mono uppercase text-arena-muted tracking-wider block">
            Monitored Teams
          </span>
          <div className="text-2xl font-mono font-bold text-white">{totalTeams}</div>
        </div>

        <div className="bg-arena-card border border-arena-border rounded-xl p-3.5 space-y-1">
          <span className="text-[11px] font-mono uppercase text-electric-emerald tracking-wider block">
            Clean (0 Strikes)
          </span>
          <div className="text-2xl font-mono font-bold text-electric-emerald">{cleanTeams}</div>
        </div>

        <div className="bg-arena-card border border-arena-border rounded-xl p-3.5 space-y-1">
          <span className="text-[11px] font-mono uppercase text-electric-amber tracking-wider block">
            Warned (1-3 Strikes)
          </span>
          <div className="text-2xl font-mono font-bold text-electric-amber">{warnedTeams}</div>
        </div>

        <div className="bg-arena-card border border-arena-border rounded-xl p-3.5 space-y-1">
          <span className="text-[11px] font-mono uppercase text-electric-crimson tracking-wider block">
            Eliminated (4 Strikes)
          </span>
          <div className="text-2xl font-mono font-bold text-electric-crimson">{eliminatedTeams}</div>
        </div>
      </div>

      {/* 2. Search & Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-arena-card border border-arena-border p-4 rounded-xl">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-arena-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search participants by team name or code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-arena-panel border border-arena-border rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-arena-muted outline-none focus:border-electric-cyan font-mono"
            />
          </div>
        </div>

        {/* Status Filters */}
        <div className="flex items-center gap-1 bg-arena-panel p-1 rounded-lg border border-arena-border text-xs font-mono">
          <button
            type="button"
            onClick={() => setFilterStatus('all')}
            className={`px-2.5 py-1 rounded transition-colors ${
              filterStatus === 'all' ? 'bg-electric-cyan text-arena-bg font-bold' : 'text-arena-muted hover:text-white'
            }`}
          >
            All ({totalTeams})
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus('warned')}
            className={`px-2.5 py-1 rounded transition-colors ${
              filterStatus === 'warned' ? 'bg-electric-amber text-arena-bg font-bold' : 'text-arena-muted hover:text-white'
            }`}
          >
            Warned ({warnedTeams})
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus('eliminated')}
            className={`px-2.5 py-1 rounded transition-colors ${
              filterStatus === 'eliminated' ? 'bg-electric-crimson text-white font-bold' : 'text-arena-muted hover:text-white'
            }`}
          >
            Eliminated ({eliminatedTeams})
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus('clean')}
            className={`px-2.5 py-1 rounded transition-colors ${
              filterStatus === 'clean' ? 'bg-electric-emerald text-arena-bg font-bold' : 'text-arena-muted hover:text-white'
            }`}
          >
            Clean ({cleanTeams})
          </button>
        </div>
      </div>

      {/* 3. Comprehensive Participant Violation Roster */}
      <div className="bg-arena-card border border-arena-border rounded-xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-arena-border bg-arena-panel/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-electric-cyan" />
            <h3 className="text-sm font-bold font-mono text-white uppercase tracking-wider">
              Participant Anti-Cheat Status &amp; Violation Logs
            </h3>
          </div>
          <span className="text-xs font-mono text-arena-muted">
            {filteredTeams.length} participants displayed
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-arena-border bg-arena-panel/60 font-mono text-[11px] text-arena-muted uppercase tracking-wider">
                <th className="py-3 px-4">Participant / Team</th>
                <th className="py-3 px-4">Game Status</th>
                <th className="py-3 px-4">Total Violations</th>
                <th className="py-3 px-4">Warning Level</th>
                <th className="py-3 px-4">Elimination Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-arena-border/50 font-mono">
              {filteredTeams.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-arena-muted italic">
                    No participants match the selected filter.
                  </td>
                </tr>
              ) : (
                filteredTeams.map((team) => {
                  const strikes = team.strikes || 0;
                  const isEliminated = team.status === 'eliminated' || strikes >= 4;
                  const warningBadge = ViolationManager.getWarningLevelBadge(strikes, team.status);
                  const isExpanded = expandedTeamId === team.id;
                  const teamLogs = ViolationManager.formatTeamViolationLogs(incidents, team.id);

                  return (
                    <React.Fragment key={team.id}>
                      <tr className="hover:bg-arena-panel/30 transition-colors">
                        <td className="py-3 px-4">
                          <button
                            type="button"
                            onClick={() => setExpandedTeamId(isExpanded ? null : team.id)}
                            className="flex items-center gap-2 text-left group"
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-3.5 h-3.5 text-electric-cyan shrink-0" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5 text-arena-muted group-hover:text-white shrink-0" />
                            )}
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-electric-cyan">{team.teamCode}</span>
                                <span className="text-white font-sans font-medium">{team.teamName}</span>
                              </div>
                              <span className="text-[10px] text-arena-muted">Round {team.currentRound}</span>
                            </div>
                          </button>
                        </td>

                        <td className="py-3 px-4">
                          <StatusBadge
                            variant={
                              team.status === 'eliminated'
                                ? 'eliminated'
                                : team.status === 'active'
                                ? 'active'
                                : team.status === 'completed'
                                ? 'completed'
                                : 'ready'
                            }
                            label={team.status.toUpperCase()}
                          />
                        </td>

                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span
                              className={`font-bold ${
                                isEliminated
                                  ? 'text-electric-crimson'
                                  : strikes > 0
                                  ? 'text-electric-amber'
                                  : 'text-arena-muted'
                              }`}
                            >
                              {strikes} / 4
                            </span>
                            {/* Visual Strike Dots */}
                            <div className="flex items-center gap-1">
                              {[1, 2, 3, 4].map((slot) => (
                                <div
                                  key={slot}
                                  className={`w-2 h-2 rounded-full ${
                                    slot <= strikes
                                      ? slot >= 4
                                        ? 'bg-red-600'
                                        : 'bg-amber-500'
                                      : 'bg-zinc-800'
                                  }`}
                                />
                              ))}
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold uppercase ${
                              warningBadge.variant === 'eliminated'
                                ? 'bg-red-950/80 text-red-400 border border-red-700/50'
                                : warningBadge.variant === 'final'
                                ? 'bg-red-900/40 text-rose-300 border border-red-500/40'
                                : warningBadge.variant === 'warning'
                                ? 'bg-amber-500/10 text-electric-amber border border-amber-500/30'
                                : 'bg-emerald-500/10 text-electric-emerald border border-emerald-500/20'
                            }`}
                          >
                            {warningBadge.label}
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          {isEliminated ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-electric-crimson uppercase">
                              <AlertOctagon className="w-3.5 h-3.5" />
                              ELIMINATED
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] text-electric-emerald uppercase">
                              <ShieldCheck className="w-3.5 h-3.5" />
                              IN COMPETITION
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setSelectedTeam(team)}
                              className="text-[11px] text-electric-cyan hover:bg-electric-cyan/10"
                              icon={<Eye className="w-3 h-3" />}
                            >
                              Audit Dossier
                            </Button>

                            {strikes > 0 && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handlePardon(team)}
                                className="text-[11px] text-electric-emerald hover:bg-emerald-500/10"
                              >
                                Pardon
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Expandable Detailed Violation Log Row */}
                      {isExpanded && (
                        <tr className="bg-zinc-950/80 border-b border-arena-border/50">
                          <td colSpan={6} className="py-3 px-6">
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-[11px] text-arena-muted uppercase font-bold">
                                <span>Detailed Violation Log for {team.teamName} ({team.teamCode}):</span>
                                <span>Status: <strong className={isEliminated ? 'text-red-400' : 'text-emerald-400'}>{team.status.toUpperCase()}</strong></span>
                              </div>

                              {teamLogs.length === 0 ? (
                                <p className="text-xs text-arena-muted italic">
                                  No recorded violations. Participant operating completely within rules.
                                </p>
                              ) : (
                                <ul className="space-y-1 text-xs">
                                  {teamLogs.map((log, idx) => (
                                    <li key={idx} className="flex items-start gap-2 text-zinc-300 bg-zinc-900/60 p-2 rounded border border-zinc-800">
                                      <span className="text-red-400 font-bold">{log}</span>
                                    </li>
                                  ))}
                                  {isEliminated && (
                                    <li className="text-xs text-red-400 font-bold bg-red-950/60 p-2 rounded border border-red-900">
                                      Status: ELIMINATED.
                                    </li>
                                  )}
                                </ul>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Team Violation Dossier Modal */}
      {selectedTeam && (
        <Modal
          isOpen={!!selectedTeam}
          onClose={() => setSelectedTeam(null)}
          title={`Anti-Cheat Dossier: ${selectedTeam.teamName} (${selectedTeam.teamCode})`}
          maxWidth="lg"
        >
          <div className="space-y-5 text-xs font-mono">
            {/* Summary Header */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-arena-panel p-3 rounded-xl border border-arena-border">
              <div>
                <span className="text-[10px] text-arena-muted block uppercase">Current Round</span>
                <span className="text-sm font-bold text-white">Round {selectedTeam.currentRound}</span>
              </div>
              <div>
                <span className="text-[10px] text-arena-muted block uppercase">Violations</span>
                <span className="text-sm font-bold text-electric-crimson">{selectedTeam.strikes || 0} / 4</span>
              </div>
              <div>
                <span className="text-[10px] text-arena-muted block uppercase">Game Status</span>
                <span className="text-sm font-bold text-white">{selectedTeam.status.toUpperCase()}</span>
              </div>
              <div>
                <span className="text-[10px] text-arena-muted block uppercase">Warning State</span>
                <span className="text-sm font-bold text-electric-amber">
                  {ViolationManager.getWarningLevelBadge(selectedTeam.strikes || 0, selectedTeam.status).label}
                </span>
              </div>
            </div>

            {/* Violation Audit Log */}
            <div className="space-y-2">
              <h4 className="font-bold text-white uppercase text-xs">Chronological Violation Audit Trail</h4>
              {ViolationManager.formatTeamViolationLogs(incidents, selectedTeam.id).length === 0 ? (
                <div className="p-4 bg-zinc-900/50 rounded-xl border border-zinc-800 text-center text-arena-muted italic">
                  No violations on record for this team.
                </div>
              ) : (
                <div className="bg-zinc-950 border border-zinc-800 rounded-xl divide-y divide-zinc-800/80 overflow-hidden">
                  {ViolationManager.formatTeamViolationLogs(incidents, selectedTeam.id).map((entry, idx) => (
                    <div key={idx} className="p-3 flex items-start gap-2.5 text-zinc-300">
                      <span className="text-red-400 font-bold shrink-0">{entry}</span>
                    </div>
                  ))}
                  {selectedTeam.status === 'eliminated' && (
                    <div className="p-3 bg-red-950/60 text-red-400 font-bold">
                      Status: ELIMINATED.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between gap-3 pt-3 border-t border-arena-border">
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handlePardon(selectedTeam)}
                  className="border-emerald-600 text-emerald-400 hover:bg-emerald-950"
                  icon={<UserCheck className="w-3.5 h-3.5" />}
                >
                  Pardon All Strikes
                </Button>

                {selectedTeam.status !== 'eliminated' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleManualEliminate(selectedTeam)}
                    className="border-red-600 text-red-400 hover:bg-red-950"
                    icon={<UserX className="w-3.5 h-3.5" />}
                  >
                    Eliminate Team
                  </Button>
                )}
              </div>

              <Button size="sm" variant="ghost" onClick={() => setSelectedTeam(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

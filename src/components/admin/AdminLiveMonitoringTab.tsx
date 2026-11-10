import React, { useState } from 'react';
import { StatusBadge } from '../ui/StatusBadge';
import { Search, RotateCcw, Clock, CheckCircle2, ShieldAlert, MapPin, XCircle } from 'lucide-react';
import { useGameStore } from '../../store/gameStore';

export function AdminLiveMonitoringTab() {
  const { teams, locations, routes, progress } = useGameStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [roundFilter, setRoundFilter] = useState<string>('all');

  const filteredTeams = teams.filter((t) => {
    const matchesSearch =
      t.teamName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.teamCode.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' ? true : t.status === statusFilter;
    const matchesRound = roundFilter === 'all' ? true : t.currentRound === parseInt(roundFilter, 10);

    return matchesSearch && matchesStatus && matchesRound;
  });

  return (
    <div className="space-y-4">
      {/* Search & Filter Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-arena-card border border-arena-border p-4 rounded-xl">
        <div className="flex flex-wrap items-center gap-2 flex-1 max-w-xl">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-arena-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter by team name or code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-arena-panel border border-arena-border rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-arena-muted outline-none focus:border-electric-cyan font-mono"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-arena-panel border border-arena-border rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-electric-cyan font-mono"
          >
            <option value="all">Status: All</option>
            <option value="ready">Ready (Lobby)</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="eliminated">Eliminated</option>
          </select>

          {/* Round Filter */}
          <select
            value={roundFilter}
            onChange={(e) => setRoundFilter(e.target.value)}
            className="bg-arena-panel border border-arena-border rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-electric-cyan font-mono"
          >
            <option value="all">Round: All (1-10)</option>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((r) => (
              <option key={r} value={r.toString()}>
                Round #{r}
              </option>
            ))}
          </select>
        </div>

        <span className="text-xs font-mono text-arena-muted">
          Showing {filteredTeams.length} of {teams.length} Teams
        </span>
      </div>

      {/* Live Table */}
      <div className="bg-arena-card border border-arena-border rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="border-b border-arena-border bg-arena-panel/50 text-[11px] text-arena-muted uppercase tracking-wider">
                <th className="py-3 px-4">Team</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Current Round</th>
                <th className="py-3 px-4">Assigned Checkpoint</th>
                <th className="py-3 px-4 text-center">Puzzle Solved</th>
                <th className="py-3 px-4 text-center">QR Scanned</th>
                <th className="py-3 px-4">Strikes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-arena-border/50">
              {filteredTeams.map((team) => {
                const assignedRoute = routes.find(
                  (r) => r.teamId === team.id && r.roundNumber === team.currentRound
                );
                const loc = locations.find((l) => l.id === assignedRoute?.locationId);
                const prog = progress.find(
                  (p) => p.teamId === team.id && p.roundNumber === team.currentRound
                );

                return (
                  <tr key={team.id} className="hover:bg-arena-panel/30 transition-colors">
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="font-bold text-electric-cyan mr-1.5">{team.teamCode}</span>
                      <span className="text-white font-sans font-medium">{team.teamName}</span>
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
                    <td className="py-3 px-4 font-bold text-white">
                      Round #{team.currentRound}
                    </td>
                    <td className="py-3 px-4 text-arena-muted">
                      {loc ? (
                        <span className="text-white" title={loc.name}>
                          Loc {loc.id}: {loc.name}
                        </span>
                      ) : (
                        '--'
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {prog?.puzzleSolved ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-electric-emerald font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>SOLVED</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-arena-muted">
                          <XCircle className="w-3.5 h-3.5" />
                          <span>PENDING</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {prog?.qrScanned ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-electric-emerald font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>VERIFIED</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-arena-muted">
                          <XCircle className="w-3.5 h-3.5" />
                          <span>PENDING</span>
                        </span>
                      )}
                    </td>
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
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}


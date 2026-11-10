import React from 'react';
import { Button } from '../ui/Button';
import { Trophy, Medal, Download, ShieldCheck, AlertOctagon } from 'lucide-react';
import { useToast } from '../ui/Toast';
import { useGameStore } from '../../store/gameStore';
import { exportLeaderboardCSV } from '../../services/exportService';

export function AdminLeaderboardTab() {
  const { leaderboard } = useGameStore();
  const { success } = useToast();

  const handleExport = () => {
    exportLeaderboardCSV(leaderboard);
    success('Leaderboard Exported', 'CSV report downloaded with authoritative timestamps.');
  };

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-arena-card border border-arena-border p-4 rounded-xl">
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Trophy className="w-4 h-4 text-electric-amber" />
            <span>Authoritative Championship Standings &amp; Podium</span>
          </h3>
          <p className="text-xs text-arena-muted mt-0.5">
            Formula: completion_time = final_checkpoint_verified_at - event_start_timestamp. Disqualified teams are excluded from winner eligibility.
          </p>
        </div>

        <Button
          size="sm"
          variant="primary"
          icon={<Download className="w-3.5 h-3.5" />}
          onClick={handleExport}
        >
          Export CSV Report
        </Button>
      </div>

      {/* Leaderboard Table */}
      <div className="bg-arena-card border border-arena-border rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="border-b border-arena-border bg-arena-panel/50 text-[11px] text-arena-muted uppercase tracking-wider">
                <th className="py-3 px-4">Rank</th>
                <th className="py-3 px-4">Team</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-center">Rounds Cleared</th>
                <th className="py-3 px-4">Official Time</th>
                <th className="py-3 px-4">Strikes</th>
                <th className="py-3 px-4">Attempts</th>
                <th className="py-3 px-4">Podium Eligible</th>
                <th className="py-3 px-4">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-arena-border/50">
              {leaderboard.map((entry) => {
                const isPodium = entry.rank !== null && entry.rank <= 3 && entry.isEligibleWinner;

                return (
                  <tr
                    key={entry.teamId}
                    className={`transition-colors hover:bg-arena-panel/30 ${
                      entry.rank === 1 && entry.isEligibleWinner ? 'bg-amber-500/5' : ''
                    }`}
                  >
                    <td className="py-3 px-4">
                      {entry.rank === 1 && entry.isEligibleWinner ? (
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded font-black bg-amber-500/20 text-electric-amber border border-amber-500/30">
                          <Medal className="w-3.5 h-3.5" />
                          <span>#1 1ST</span>
                        </div>
                      ) : entry.rank === 2 && entry.isEligibleWinner ? (
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded font-bold bg-slate-400/20 text-slate-200 border border-slate-400/30">
                          <Medal className="w-3.5 h-3.5" />
                          <span>#2 2ND</span>
                        </div>
                      ) : entry.rank === 3 && entry.isEligibleWinner ? (
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded font-bold bg-amber-700/20 text-amber-500 border border-amber-700/30">
                          <Medal className="w-3.5 h-3.5" />
                          <span>#3 3RD</span>
                        </div>
                      ) : entry.rank ? (
                        <span className="font-bold text-arena-muted">#{entry.rank}</span>
                      ) : (
                        <span className="text-electric-crimson font-bold">DISQ</span>
                      )}
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="font-bold text-electric-cyan mr-1.5">{entry.teamCode}</span>
                      <span className="text-white font-sans font-medium">{entry.teamName}</span>
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          entry.status === 'completed'
                            ? 'bg-purple-500/20 text-electric-violet border border-purple-500/30'
                            : entry.status === 'eliminated'
                            ? 'bg-red-500/20 text-electric-crimson border border-red-500/30'
                            : entry.status === 'active'
                            ? 'bg-emerald-500/20 text-electric-emerald border border-emerald-500/30'
                            : 'bg-arena-panel text-arena-muted'
                        }`}
                      >
                        {entry.status}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-center font-bold text-white">
                      {entry.completedRounds} / 10
                    </td>

                    <td className="py-3 px-4 font-bold text-electric-cyan">
                      {entry.completionTimeFormatted || '--'}
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`font-bold ${
                          entry.strikes === 0 ? 'text-electric-emerald' : 'text-electric-amber'
                        }`}
                      >
                        {entry.strikes}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-arena-muted">{entry.totalAttempts}</td>

                    <td className="py-3 px-4">
                      {entry.isEligibleWinner ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-electric-emerald font-bold">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Eligible</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-electric-crimson font-bold">
                          <AlertOctagon className="w-3.5 h-3.5" />
                          <span>Excluded</span>
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-arena-muted text-[11px] font-sans truncate max-w-xs">
                      {entry.tieBreakDetail || '--'}
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


import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Users, 
  Activity, 
  Compass, 
  Play, 
  CheckCircle2, 
  QrCode, 
  Trophy, 
  WifiOff, 
  Wifi, 
  Clock, 
  XCircle,
  AlertTriangle,
  Radio,
  Timer,
  Hourglass
} from 'lucide-react';
import { useGameStore } from '../../store/gameStore';

export type LiveTeamStatus = 
  | 'offline'
  | 'online_lobby'
  | 'playing'
  | 'question_solved'
  | 'location_completed'
  | 'completed'
  | 'eliminated';

const HEARTBEAT_TIMEOUT_MS = 45000; // 45 seconds

function formatDuration(ms: number | null | undefined): string {
  if (ms == null || ms <= 0) return '—';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return '—';
  }
}

export function AdminLiveMonitoringTab() {
  const { teams, locations, routes, progress } = useGameStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [roundFilter, setRoundFilter] = useState<string>('all');

  // Compute live presence and game status for each team
  const teamsWithLiveStatus = useMemo(() => {
    const now = Date.now();

    return teams.map((team) => {
      const assignedRoute = routes.find(
        (r) => r.teamId === team.id && r.roundNumber === team.currentRound
      );
      const loc = locations.find((l) => l.id === assignedRoute?.locationId);
      const prog = progress.find(
        (p) => p.teamId === team.id && p.roundNumber === team.currentRound
      );

      // Heartbeat online presence check
      const lastSeenEpoch = team.lastSeenAt ? new Date(team.lastSeenAt).getTime() : 0;
      const isHeartbeatAlive = lastSeenEpoch > 0 && (now - lastSeenEpoch) < HEARTBEAT_TIMEOUT_MS;

      // Determine distinct live status
      let liveStatus: LiveTeamStatus = 'offline';
      let liveStatusLabel = 'Offline';
      let isOnline = false;

      if (team.status === 'eliminated') {
        liveStatus = 'eliminated';
        liveStatusLabel = 'Eliminated';
        isOnline = isHeartbeatAlive;
      } else if (team.status === 'completed' || team.currentRound > 9) {
        liveStatus = 'completed';
        liveStatusLabel = 'Completed';
        isOnline = isHeartbeatAlive;
      } else if (!isHeartbeatAlive) {
        liveStatus = 'offline';
        liveStatusLabel = 'Offline';
        isOnline = false;
      } else {
        isOnline = true;
        // Online: classify state
        if (prog?.qrScanned) {
          liveStatus = 'location_completed';
          liveStatusLabel = 'Location Completed';
        } else if (prog?.puzzleSolved) {
          liveStatus = 'question_solved';
          liveStatusLabel = 'Question Solved';
        } else if (team.status === 'active' || team.startedAt || prog?.roundStartedAt) {
          liveStatus = 'playing';
          liveStatusLabel = 'Playing';
        } else {
          liveStatus = 'online_lobby';
          liveStatusLabel = 'Online / Lobby';
        }
      }

      // Last activity timestamp formatting
      let lastActivityTime = 'No activity';
      if (team.lastSeenAt) {
        const diffSeconds = Math.max(0, Math.floor((now - new Date(team.lastSeenAt).getTime()) / 1000));
        if (diffSeconds < 60) {
          lastActivityTime = `${diffSeconds}s ago`;
        } else if (diffSeconds < 3600) {
          lastActivityTime = `${Math.floor(diffSeconds / 60)}m ago`;
        } else {
          lastActivityTime = `${Math.floor(diffSeconds / 3600)}h ago`;
        }
      }

      return {
        ...team,
        loc,
        prog,
        liveStatus,
        liveStatusLabel,
        isOnline,
        lastActivityTime,
      };
    });
  }, [teams, locations, routes, progress]);

  // Aggregate Metrics Summary
  const summary = useMemo(() => {
    let total = teamsWithLiveStatus.length;
    let online = 0;
    let inLobby = 0;
    let playing = 0;
    let questionSolved = 0;
    let locationCompleted = 0;
    let completed = 0;
    let offline = 0;
    let eliminated = 0;

    teamsWithLiveStatus.forEach((t) => {
      if (t.isOnline) online++;
      if (t.liveStatus === 'online_lobby') inLobby++;
      if (t.liveStatus === 'playing') playing++;
      if (t.liveStatus === 'question_solved') questionSolved++;
      if (t.liveStatus === 'location_completed') locationCompleted++;
      if (t.liveStatus === 'completed') completed++;
      if (t.liveStatus === 'offline') offline++;
      if (t.liveStatus === 'eliminated') eliminated++;
    });

    return { total, online, inLobby, playing, questionSolved, locationCompleted, completed, offline, eliminated };
  }, [teamsWithLiveStatus]);

  // Filtered teams list
  const filteredTeams = useMemo(() => {
    return teamsWithLiveStatus.filter((t) => {
      const q = searchTerm.toLowerCase();
      const matchesSearch =
        t.teamName.toLowerCase().includes(q) ||
        t.teamCode.toLowerCase().includes(q) ||
        (t.username && t.username.toLowerCase().includes(q));

      let matchesStatus = true;
      if (statusFilter === 'online') {
        matchesStatus = t.isOnline;
      } else if (statusFilter !== 'all') {
        matchesStatus = t.liveStatus === statusFilter;
      }

      let matchesRound = true;
      if (roundFilter !== 'all') {
        matchesRound = t.currentRound === parseInt(roundFilter, 10);
      }

      return matchesSearch && matchesStatus && matchesRound;
    });
  }, [teamsWithLiveStatus, searchTerm, statusFilter, roundFilter]);

  return (
    <div className="space-y-5">
      {/* 1. Live Monitoring Metrics Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
        {/* Total Teams */}
        <div className="bg-arena-card border border-arena-border p-3 rounded-xl flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between text-arena-muted text-[10px] font-mono uppercase tracking-wider">
            <span>Total Teams</span>
            <Users className="w-3.5 h-3.5 text-arena-muted" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-white mt-1 font-mono">{summary.total}</div>
        </div>

        {/* Online Teams */}
        <div className="bg-arena-card border border-emerald-500/30 p-3 rounded-xl flex flex-col justify-between shadow-sm bg-emerald-500/5">
          <div className="flex items-center justify-between text-electric-emerald text-[10px] font-mono uppercase tracking-wider font-bold">
            <span className="flex items-center gap-1">
              <Radio className="w-2.5 h-2.5 animate-pulse text-emerald-400" />
              Online
            </span>
            <Wifi className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-400 mt-1 font-mono">{summary.online}</div>
        </div>

        {/* In Lobby */}
        <div className="bg-arena-card border border-electric-cyan/30 p-3 rounded-xl flex flex-col justify-between shadow-sm bg-electric-cyan/5">
          <div className="flex items-center justify-between text-electric-cyan text-[10px] font-mono uppercase tracking-wider font-bold">
            <span>In Lobby</span>
            <Compass className="w-3.5 h-3.5 text-electric-cyan" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-electric-cyan mt-1 font-mono">{summary.inLobby}</div>
        </div>

        {/* Playing */}
        <div className="bg-arena-card border border-blue-500/30 p-3 rounded-xl flex flex-col justify-between shadow-sm bg-blue-500/5">
          <div className="flex items-center justify-between text-blue-400 text-[10px] font-mono uppercase tracking-wider font-bold">
            <span>Playing</span>
            <Play className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-blue-400 mt-1 font-mono">{summary.playing}</div>
        </div>

        {/* Question Solved */}
        <div className="bg-arena-card border border-amber-500/30 p-3 rounded-xl flex flex-col justify-between shadow-sm bg-amber-500/5">
          <div className="flex items-center justify-between text-amber-400 text-[10px] font-mono uppercase tracking-wider font-bold">
            <span>Solved Q</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-amber-400 mt-1 font-mono">{summary.questionSolved}</div>
        </div>

        {/* Location Completed */}
        <div className="bg-arena-card border border-teal-500/30 p-3 rounded-xl flex flex-col justify-between shadow-sm bg-teal-500/5">
          <div className="flex items-center justify-between text-teal-400 text-[10px] font-mono uppercase tracking-wider font-bold">
            <span>Loc Done</span>
            <QrCode className="w-3.5 h-3.5 text-teal-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-teal-400 mt-1 font-mono">{summary.locationCompleted}</div>
        </div>

        {/* Teams Completed */}
        <div className="bg-arena-card border border-purple-500/30 p-3 rounded-xl flex flex-col justify-between shadow-sm bg-purple-500/5">
          <div className="flex items-center justify-between text-purple-400 text-[10px] font-mono uppercase tracking-wider font-bold">
            <span>Finished</span>
            <Trophy className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-purple-400 mt-1 font-mono">{summary.completed}</div>
        </div>

        {/* Teams Offline */}
        <div className="bg-arena-card border border-arena-border p-3 rounded-xl flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between text-arena-muted text-[10px] font-mono uppercase tracking-wider">
            <span>Offline</span>
            <WifiOff className="w-3.5 h-3.5 text-arena-muted" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-arena-muted mt-1 font-mono">{summary.offline}</div>
        </div>
      </div>

      {/* 2. Search & Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-arena-card border border-arena-border p-3.5 rounded-xl shadow-md">
        <div className="flex flex-wrap items-center gap-2 flex-1 max-w-2xl">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-arena-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter by team name, code, or username..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-arena-panel border border-arena-border rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-arena-muted outline-none focus:border-electric-cyan font-mono"
            />
          </div>

          {/* Status Filters */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-arena-panel border border-arena-border rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-electric-cyan font-mono"
          >
            <option value="all">Status: All Teams</option>
            <option value="online">Status: Online (Any)</option>
            <option value="online_lobby">Status: In Lobby</option>
            <option value="playing">Status: Playing</option>
            <option value="question_solved">Status: Question Solved</option>
            <option value="location_completed">Status: Location Completed</option>
            <option value="completed">Status: Completed Journey</option>
            <option value="offline">Status: Offline</option>
            <option value="eliminated">Status: Eliminated</option>
          </select>

          {/* Round Filter */}
          <select
            value={roundFilter}
            onChange={(e) => setRoundFilter(e.target.value)}
            className="bg-arena-panel border border-arena-border rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-electric-cyan font-mono"
          >
            <option value="all">Round: All (1-9)</option>
            {Array.from({ length: 9 }, (_, i) => i + 1).map((r) => (
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

      {/* 3. Live Team Monitoring Table */}
      <div className="bg-arena-card border border-arena-border rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="border-b border-arena-border bg-arena-panel text-[11px] font-bold text-arena-muted uppercase tracking-wider">
                <th className="py-3 px-4">Team</th>
                <th className="py-3 px-4 text-center">Login Status</th>
                <th className="py-3 px-4">Game Status</th>
                <th className="py-3 px-4">Current Location</th>
                <th className="py-3 px-4 text-center">Question Status</th>
                <th className="py-3 px-4 text-center">Q Started At</th>
                <th className="py-3 px-4 text-center">Q Solved At</th>
                <th className="py-3 px-4 text-center">Solve Duration</th>
                <th className="py-3 px-4">Last Activity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-arena-border/50">
              {filteredTeams.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-arena-muted font-mono text-xs">
                    {teams.length === 0 
                      ? 'No teams registered yet. Use Teams tab or Team Credentials tab to add teams.'
                      : 'No teams match the selected filter criteria.'}
                  </td>
                </tr>
              ) : (
                filteredTeams.map((team) => {
                  return (
                    <tr key={team.id} className="hover:bg-arena-panel/30 transition-colors">
                      {/* Team identifier and name */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-electric-cyan">{team.teamCode}</span>
                          <span className="text-white font-sans font-medium">{team.teamName}</span>
                          {team.username && (
                            <span className="text-[10px] text-arena-muted font-mono">({team.username})</span>
                          )}
                        </div>
                      </td>

                      {/* Login Status (Online / Offline indicator) */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {team.isOnline ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            Online
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-800/80 text-arena-muted border border-arena-border">
                            <span className="w-1.5 h-1.5 rounded-full bg-arena-muted" />
                            Offline
                          </span>
                        )}
                      </td>

                      {/* Detailed Game Status Badge */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {team.liveStatus === 'online_lobby' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                            <Compass className="w-3 h-3" />
                            Online / Lobby
                          </span>
                        )}
                        {team.liveStatus === 'playing' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30">
                            <Play className="w-3 h-3" />
                            Playing (Round {team.currentRound}/9)
                          </span>
                        )}
                        {team.liveStatus === 'question_solved' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                            <CheckCircle2 className="w-3 h-3" />
                            Question Solved
                          </span>
                        )}
                        {team.liveStatus === 'location_completed' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold bg-teal-500/15 text-teal-400 border border-teal-500/30">
                            <QrCode className="w-3 h-3" />
                            Location Completed
                          </span>
                        )}
                        {team.liveStatus === 'completed' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold bg-purple-500/15 text-purple-400 border border-purple-500/30">
                            <Trophy className="w-3 h-3" />
                            Completed
                          </span>
                        )}
                        {team.liveStatus === 'eliminated' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold bg-red-500/15 text-red-400 border border-red-500/30">
                            <AlertTriangle className="w-3 h-3" />
                            Eliminated
                          </span>
                        )}
                        {team.liveStatus === 'offline' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold bg-zinc-800 text-arena-muted border border-arena-border">
                            <WifiOff className="w-3 h-3" />
                            Offline
                          </span>
                        )}
                      </td>

                      {/* Current Location */}
                      <td className="py-3 px-4">
                        {team.loc ? (
                          <div className="flex flex-col">
                            <span className="text-white font-bold">
                              Station #{team.loc.locationNumber}: {team.loc.name}
                            </span>
                            <span className="text-[10px] text-arena-muted truncate max-w-xs">
                              {team.loc.description}
                            </span>
                          </div>
                        ) : (
                          <span className="text-arena-muted italic">Station #{team.currentRound}</span>
                        )}
                      </td>

                      {/* Question Completion Status — two separate concerns */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {/* Overall question status (not_started / in_progress / solved) */}
                        {(() => {
                          const qStatus = (team.prog as any)?.questionStatus || (team.prog?.puzzleSolved ? 'solved' : 'not_started');
                          if (qStatus === 'solved') {
                            return (
                              <div className="flex flex-col items-center gap-1">
                                <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-bold px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30">
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>SOLVED</span>
                                </span>
                                {/* Solve duration */}
                                {(() => {
                                  const durMs = (team.prog as any)?.questionDurationMs;
                                  return durMs != null ? (
                                    <span className="text-[10px] text-emerald-300 font-mono">{formatDuration(durMs)}</span>
                                  ) : null;
                                })()}
                                {/* Started / Solved timestamps */}
                                <div className="text-[9px] text-arena-muted font-mono space-y-0.5">
                                  <div>Start: {formatTimestamp((team.prog as any)?.questionStartedAt)}</div>
                                  <div>Solved: {formatTimestamp((team.prog as any)?.questionSolvedAt)}</div>
                                </div>
                              </div>
                            );
                          } else if (qStatus === 'in_progress') {
                            return (
                              <div className="flex flex-col items-center gap-1">
                                <span className="inline-flex items-center gap-1 text-[11px] text-blue-400 font-bold px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/30 animate-pulse">
                                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                                  <span>IN PROGRESS</span>
                                </span>
                                <div className="text-[9px] text-arena-muted font-mono">
                                  Start: {formatTimestamp((team.prog as any)?.questionStartedAt)}
                                </div>
                              </div>
                            );
                          } else {
                            return (
                              <span className="inline-flex items-center gap-1 text-[11px] text-arena-muted px-2 py-0.5 rounded bg-zinc-800/40 border border-arena-border">
                                <XCircle className="w-3 h-3" />
                                <span>NOT STARTED</span>
                              </span>
                            );
                          }
                        })()}
                      </td>

                      {/* Last Activity Timestamp */}
                      <td className="py-3 px-4 whitespace-nowrap text-arena-muted">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3 h-3 text-arena-muted" />
                          <span>{team.lastActivityTime}</span>
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

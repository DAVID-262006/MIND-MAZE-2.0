import React from 'react';
import { AlertOctagon, ArrowRight, Lock, ShieldAlert, History } from 'lucide-react';
import { Button } from '../ui/Button';
import { StatusBadge } from '../ui/StatusBadge';
import type { Team, AntiCheatIncident } from '../../types';
import { ViolationManager } from '../../services/violationManager';

export interface EliminationViewProps {
  team: Team;
  eliminationReason?: string;
  roundNumber?: number;
  incidents?: AntiCheatIncident[];
  onReturnHome: () => void;
}

export function EliminationView({
  team,
  eliminationReason = 'Disqualified from competition arena.',
  roundNumber = 1,
  incidents = [],
  onReturnHome,
}: EliminationViewProps) {
  const violationLogs = ViolationManager.formatTeamViolationLogs(incidents, team.id);

  return (
    <div className="min-h-[85vh] flex flex-col justify-center items-center px-4 py-8 select-none">
      <div className="w-full max-w-lg bg-zinc-950 border-2 border-red-600 rounded-3xl p-6 sm:p-8 shadow-[0_0_60px_rgba(220,38,38,0.3)] text-center space-y-6 animate-in zoom-in-95 duration-300">
        {/* Warning Icon */}
        <div className="w-20 h-20 rounded-2xl bg-red-950/80 border-2 border-red-600 flex items-center justify-center text-red-500 mx-auto shadow-[0_0_35px_rgba(239,68,68,0.4)] animate-pulse">
          <AlertOctagon className="w-10 h-10" />
        </div>

        {/* Elimination Alert Heading */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-black tracking-widest uppercase bg-red-900/60 text-red-300 border border-red-500/50">
            <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
            <span>DISQUALIFICATION NOTICE</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-wide uppercase font-mono">
            YOU HAVE BEEN ELIMINATED!
          </h1>
          <p className="text-xs font-mono text-zinc-400">
            {team.teamName} ({team.teamCode})
          </p>
        </div>

        {/* Detailed Reason Box */}
        <div className="bg-zinc-900/90 border border-red-900/50 rounded-xl p-4 text-left space-y-3">
          <div className="flex items-center justify-between text-red-400 font-bold text-xs uppercase font-mono">
            <span className="flex items-center gap-1.5">
              <Lock className="w-4 h-4 shrink-0" />
              <span>Elimination Incident Report</span>
            </span>
            <span className="text-zinc-500">Terminal State</span>
          </div>

          <p className="text-xs text-zinc-300 leading-relaxed font-sans">
            {team.eliminationReason || eliminationReason}
          </p>

          <div className="pt-2 border-t border-zinc-800 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-zinc-400">
            <span>Terminal Round: <strong className="text-white">Round {roundNumber}</strong></span>
            <span>Recorded Violations: <strong className="text-red-400">{Math.max(team.strikes, 4)} / 4</strong></span>
          </div>
        </div>

        {/* Chronological Violation History */}
        {violationLogs.length > 0 && (
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 text-left space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-mono text-zinc-300 uppercase font-bold">
              <History className="w-3.5 h-3.5 text-red-400" />
              <span>Violation Audit Trail</span>
            </div>
            <ul className="space-y-1.5 font-mono text-xs text-zinc-400">
              {violationLogs.map((log, index) => (
                <li key={index} className="flex items-start gap-2 bg-zinc-900/80 p-2 rounded border border-zinc-800/80">
                  <span className="text-red-400 font-bold shrink-0">{index + 1}.</span>
                  <span className="text-zinc-300">{log.replace(/^\d+\.\s*/, '')}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Locked Notice */}
        <p className="text-[11px] text-zinc-400 leading-snug">
          Per MIND MAZE 2.0 regulations, participant inputs, puzzle answers, and station verifications are permanently locked on this device. Disqualification is final.
        </p>

        {/* Action Button */}
        <div>
          <Button
            variant="outline"
            className="w-full sm:w-auto border-zinc-700 text-zinc-300 hover:text-white"
            icon={<ArrowRight className="w-4 h-4" />}
            onClick={onReturnHome}
          >
            Exit to Home Portal
          </Button>
        </div>
      </div>
    </div>
  );
}

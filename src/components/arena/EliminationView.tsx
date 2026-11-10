import React from 'react';
import { AlertOctagon, ArrowRight, Lock } from 'lucide-react';
import { Button } from '../ui/Button';
import { StatusBadge } from '../ui/StatusBadge';
import type { Team } from '../../types';

export interface EliminationViewProps {
  team: Team;
  eliminationReason?: string;
  roundNumber?: number;
  onReturnHome: () => void;
}

export function EliminationView({
  team,
  eliminationReason = 'Disqualified from competition arena.',
  roundNumber = 1,
  onReturnHome,
}: EliminationViewProps) {
  return (
    <div className="min-h-[85vh] flex flex-col justify-center items-center px-4 py-8">
      <div className="w-full max-w-lg bg-arena-card border-2 border-electric-crimson/50 rounded-3xl p-6 sm:p-10 shadow-[0_0_50px_rgba(239,68,68,0.2)] text-center space-y-6 animate-in zoom-in-95 duration-300">
        {/* Warning Icon */}
        <div className="w-20 h-20 rounded-2xl bg-red-500/10 border-2 border-electric-crimson/60 flex items-center justify-center text-electric-crimson mx-auto shadow-[0_0_30px_rgba(239,68,68,0.3)] animate-pulse">
          <AlertOctagon className="w-10 h-10" />
        </div>

        {/* Elimination Alert */}
        <div className="space-y-2">
          <StatusBadge variant="eliminated" label="TEAM ELIMINATED" className="mx-auto" />
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            DISQUALIFIED FROM ARENA
          </h1>
          <p className="text-xs font-mono text-arena-muted">
            {team.teamName} ({team.teamCode})
          </p>
        </div>

        {/* Detailed Reason Box */}
        <div className="bg-arena-panel border border-electric-crimson/30 rounded-xl p-4 text-left space-y-3">
          <div className="flex items-center gap-2 text-electric-crimson font-bold text-xs uppercase">
            <Lock className="w-4 h-4 shrink-0" />
            <span>Elimination Incident Report</span>
          </div>
          <p className="text-xs text-arena-muted leading-relaxed">
            {team.eliminationReason || eliminationReason}
          </p>
          <div className="pt-2 border-t border-arena-border/60 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-arena-muted">
            <span>Terminal Round: <strong className="text-white">Round {roundNumber}</strong></span>
            <span>Recorded Strikes: <strong className="text-electric-crimson">{team.strikes} / 3</strong></span>
          </div>
        </div>

        {/* Locked Notice */}
        <p className="text-[11px] text-arena-muted/80 leading-snug">
          Per competition rules, all device inputs and gameplay routes are now permanently locked. You may review the authoritative leaderboard on the main dashboard.
        </p>

        {/* Action Button */}
        <div>
          <Button variant="outline" className="w-full sm:w-auto" icon={<ArrowRight className="w-4 h-4" />} onClick={onReturnHome}>
            Exit to Portal
          </Button>
        </div>
      </div>
    </div>
  );
}


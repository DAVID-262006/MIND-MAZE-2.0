import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { 
  ShieldAlert, 
  Search, 
  Info,
  Clock,
  AlertOctagon
} from 'lucide-react';
import { useToast } from '../ui/Toast';
import { useGameStore } from '../../store/gameStore';
import { AdminViolationMonitor } from './AdminViolationMonitor';
import { ViolationManager } from '../../services/violationManager';

export function AdminAntiCheatTab() {
  const { incidents, reinstateTeam } = useGameStore();
  const { success, error: toastError } = useToast();
  const [searchTerm, setSearchTerm] = useState('');

  const filteredIncidents = incidents.filter(
    (inc) =>
      inc.teamName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inc.teamCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inc.violationType.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* 1. Master Participant Anti-Cheat & Violation Monitor */}
      <AdminViolationMonitor />

      {/* 2. Architecture & Browser Limitations Disclosure */}
      <div className="p-3.5 bg-amber-500/10 border border-electric-amber/30 rounded-xl flex items-start gap-2.5 text-xs text-electric-amber">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="leading-relaxed">
            <strong>Architecture &amp; Anti-Cheat Transparency Notice:</strong> The system enforces standard web lockdown using Fullscreen API, Page Visibility API, and Window Focus monitoring. It is a proactive deterrence engine against casual tab-switching, Google search, and multi-app cheating.
          </p>
          <p className="text-[11px] text-amber-300/80 leading-relaxed font-sans">
            Note: Operating system overlay features (such as Android Circle to Search) cannot be intercepted directly while remaining in-process without losing window focus, but any action shifting window focus or backgrounding the tab is captured immediately.
          </p>
        </div>
      </div>

      {/* 3. Live Telemetry Incident Stream */}
      <div className="bg-arena-card border border-arena-border rounded-xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-arena-border bg-arena-panel/40 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-electric-cyan" />
            <h3 className="text-sm font-bold font-mono text-white uppercase tracking-wider">
              Live Incident Telemetry Stream
            </h3>
          </div>
          <div className="relative w-72">
            <Search className="w-3.5 h-3.5 text-arena-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter incident stream..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-arena-panel border border-arena-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-arena-muted outline-none focus:border-electric-cyan font-mono"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-arena-border bg-arena-panel/50 font-mono text-[11px] text-arena-muted uppercase tracking-wider">
                <th className="py-3 px-4">Time</th>
                <th className="py-3 px-4">Team</th>
                <th className="py-3 px-4">Round</th>
                <th className="py-3 px-4">Violation Type</th>
                <th className="py-3 px-4">Violation Counter</th>
                <th className="py-3 px-4">Details / Metadata</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-arena-border/50 font-mono">
              {filteredIncidents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-arena-muted italic">
                    No anti-cheat deterrence incidents recorded in telemetry.
                  </td>
                </tr>
              ) : (
                filteredIncidents.map((inc) => (
                  <tr key={inc.id} className="hover:bg-arena-panel/30 transition-colors">
                    <td className="py-3 px-4 text-arena-muted whitespace-nowrap">
                      {new Date(inc.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="font-bold text-electric-cyan mr-1.5">{inc.teamCode}</span>
                      <span className="text-white font-sans">{inc.teamName}</span>
                    </td>
                    <td className="py-3 px-4 text-white">Round {inc.roundNumber}</td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-electric-amber uppercase bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                        {inc.violationType.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`font-bold ${
                          inc.strikeNumber >= 4
                            ? 'text-electric-crimson'
                            : inc.strikeNumber === 3
                            ? 'text-rose-400'
                            : 'text-electric-amber'
                        }`}
                      >
                        Violation #{inc.strikeNumber}{' '}
                        {inc.strikeNumber >= 4
                          ? '(ELIMINATED)'
                          : inc.strikeNumber === 3
                          ? '(FINAL WARNING)'
                          : ''}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-arena-muted font-sans text-[11px] max-w-xs truncate">
                      {inc.notes || 'Focus shift or screen switch detected'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          try {
                            await reinstateTeam(inc.teamId);
                            success('Strikes Cleared', `Pardoned strikes for team ${inc.teamCode}.`);
                          } catch (err: unknown) {
                            const msg = err instanceof Error ? err.message : String(err);
                            toastError('Pardon Failed', msg);
                          }
                        }}
                        className="text-[11px] text-electric-emerald hover:bg-emerald-500/10"
                      >
                        Pardon Strikes
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { 
  ShieldAlert, 
  ShieldCheck, 
  Search, 
  RotateCcw, 
  Clock, 
  AlertOctagon,
  Info
} from 'lucide-react';
import { useToast } from '../ui/Toast';
import { useGameStore } from '../../store/gameStore';

export function AdminAntiCheatTab() {
  const { incidents, teams, reinstateTeam } = useGameStore();
  const { success } = useToast();
  const [searchTerm, setSearchTerm] = useState('');

  const filteredIncidents = incidents.filter(
    (inc) =>
      inc.teamName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inc.teamCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inc.violationType.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Top Header & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-arena-card border border-arena-border p-4 rounded-xl">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-arena-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by team, code or violation..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-arena-panel border border-arena-border rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-arena-muted outline-none focus:border-electric-cyan font-mono"
            />
          </div>
          <span className="text-xs font-mono text-arena-muted whitespace-nowrap">
            {filteredIncidents.length} Logged Incidents
          </span>
        </div>
      </div>

      {/* Architecture Disclosure Alert */}
      <div className="p-3 bg-amber-500/10 border border-electric-amber/30 rounded-xl flex items-start gap-2.5 text-xs text-electric-amber">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong>Architecture Transparency Notice:</strong> Client-side anti-cheat (tab visibility, window blur, fullscreen exit) provides proactive deterrence against casual multi-tab usage. It is not an OS-level sandbox or secure enforcement.
        </p>
      </div>

      {/* Incidents Table */}
      <div className="bg-arena-card border border-arena-border rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-arena-border bg-arena-panel/50 font-mono text-[11px] text-arena-muted uppercase tracking-wider">
                <th className="py-3 px-4">Time</th>
                <th className="py-3 px-4">Team</th>
                <th className="py-3 px-4">Round</th>
                <th className="py-3 px-4">Violation Type</th>
                <th className="py-3 px-4">Strike Accumulation</th>
                <th className="py-3 px-4">Details / Metadata</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-arena-border/50 font-mono">
              {filteredIncidents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-arena-muted italic">
                    No anti-cheat deterrence incidents recorded. All teams operating cleanly.
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
                          inc.strikeNumber >= 3 ? 'text-electric-crimson' : 'text-electric-amber'
                        }`}
                      >
                        Strike #{inc.strikeNumber} {inc.strikeNumber >= 3 ? '(ELIMINATED)' : ''}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-arena-muted font-sans text-[11px] max-w-xs truncate">
                      {inc.notes || 'Client focus shift detected'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          reinstateTeam(inc.teamId);
                          success('Strikes Cleared', `Reinstated team ${inc.teamCode}.`);
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


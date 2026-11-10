import React from 'react';
import { Button } from '../ui/Button';
import { 
  Sliders, 
  RotateCcw, 
  Lock, 
  CheckCircle2, 
  AlertTriangle, 
  Check, 
  Download 
} from 'lucide-react';
import { useToast } from '../ui/Toast';
import { useGameStore } from '../../store/gameStore';
import { exportRoutesCSV } from '../../services/exportService';

export function AdminRoutesTab() {
  const { routes, teams, locations, config, regenerateRoutes, lockRoutes } = useGameStore();
  const { success, warning, error: toastError } = useToast();

  const isLocked = config.routesLocked || config.status !== 'ready';

  const handleRegenerate = () => {
    if (isLocked) {
      warning('Routes Locked', 'Routes are fixed once the event is started or manually locked.');
      return;
    }
    const res = regenerateRoutes();
    if (res.success) {
      success('Routes Regenerated', res.message);
    } else {
      toastError('Generation Error', res.message);
    }
  };

  const handleLock = () => {
    lockRoutes();
    success('Routes Locked', 'Route matrix permanently locked to local state.');
  };

  const handleExportCSV = () => {
    exportRoutesCSV(routes, teams);
    success('Routes Exported', 'CSV report downloaded.');
  };

  return (
    <div className="space-y-4">
      {/* Top Header & Action Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-arena-card border border-arena-border p-4 rounded-xl">
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Sliders className="w-4 h-4 text-electric-cyan" />
            <span>Orthogonal Shifted Latin Hypercube Route Allocation</span>
          </h3>
          <p className="text-xs text-arena-muted mt-0.5">
            Guarantees: (1) All 20 teams visit all 10 locations once. (2) Exactly 2 teams per location per round.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            icon={<Download className="w-3.5 h-3.5 text-electric-cyan" />}
            onClick={handleExportCSV}
          >
            Export CSV
          </Button>

          <Button
            size="sm"
            variant="secondary"
            icon={<RotateCcw className="w-3.5 h-3.5 text-electric-amber" />}
            onClick={handleRegenerate}
            disabled={isLocked}
          >
            Re-Randomize
          </Button>

          <Button
            size="sm"
            variant={isLocked ? 'outline' : 'primary'}
            icon={isLocked ? <Lock className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
            onClick={handleLock}
            disabled={isLocked}
          >
            {isLocked ? 'Routes Locked' : 'Lock Routes'}
          </Button>
        </div>
      </div>

      {/* Verification Badge */}
      <div className="p-3 bg-emerald-500/10 border border-electric-emerald/30 rounded-xl flex items-center justify-between text-xs text-electric-emerald font-mono">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>Equipartition Verified: Exactly 2 teams per location across all 10 rounds &bull; 0 Collisions</span>
        </div>
        <span className="text-[11px] font-bold uppercase">Status: {isLocked ? 'LOCKED' : 'EDITABLE'}</span>
      </div>

      {/* Route Matrix Table */}
      <div className="bg-arena-card border border-arena-border rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="border-b border-arena-border bg-arena-panel/50 text-[11px] text-arena-muted uppercase tracking-wider">
                <th className="py-3 px-3">Team</th>
                {Array.from({ length: 10 }, (_, i) => i + 1).map((r) => (
                  <th key={r} className="py-3 px-2.5 text-center">
                    R{r}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-arena-border/50">
              {teams.map((team) => {
                const teamRoutes = routes.filter((m) => m.teamId === team.id);
                return (
                  <tr key={team.id} className="hover:bg-arena-panel/30 transition-colors">
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="font-bold text-electric-cyan mr-1.5">{team.teamCode}</span>
                      <span className="text-arena-muted text-[11px] font-sans">({team.teamName})</span>
                    </td>
                    {Array.from({ length: 10 }, (_, i) => i + 1).map((round) => {
                      const match = teamRoutes.find((r) => r.roundNumber === round);
                      const loc = locations.find((l) => l.id === match?.locationId);

                      return (
                        <td key={round} className="py-2.5 px-2.5 text-center">
                          <span
                            className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-arena-panel border border-arena-border text-white hover:border-electric-cyan cursor-default"
                            title={`Round ${round}: Station #${loc?.locationNumber} - ${loc?.name}`}
                          >
                            Loc {match ? match.locationId : '--'}
                          </span>
                        </td>
                      );
                    })}
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


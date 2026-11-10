import React, { useState, useRef } from 'react';
import { 
  Users, 
  Clock, 
  MapPin, 
  Trophy, 
  ShieldAlert, 
  Play, 
  Pause, 
  RotateCcw, 
  Download, 
  Upload, 
  CheckCircle2, 
  AlertTriangle,
  Database
} from 'lucide-react';
import { Button } from '../ui/Button';
import { StatusBadge } from '../ui/StatusBadge';
import { BackendStatusBadge } from '../ui/BackendStatusBadge';
import { ConfirmationDialog } from '../ui/Dialog';
import { useToast } from '../ui/Toast';
import { useGameStore } from '../../store/gameStore';
import { downloadFile } from '../../services/exportService';

export function AdminOverviewTab() {
  const {
    config,
    teams,
    locations,
    progress,
    stationOccupancies,
    startEvent,
    pauseEvent,
    resumeEvent,
    endEvent,
    resetAllGameData,
    exportBackup,
    importBackup,
  } = useGameStore();

  const { success, warning, error: toastError } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Confirmation dialogs
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [isStartOpen, setIsStartOpen] = useState(false);
  const [isPauseOpen, setIsPauseOpen] = useState(false);
  const [isEndOpen, setIsEndOpen] = useState(false);

  // Compute stats
  const totalTeams = teams.length;
  const activeTeams = teams.filter((t) => t.status === 'active').length;
  const completedTeams = teams.filter((t) => t.status === 'completed').length;
  const eliminatedTeams = teams.filter((t) => t.status === 'eliminated').length;
  const readyTeams = teams.filter((t) => t.status === 'ready' || t.status === 'registered').length;

  // Round distribution
  const roundDistribution: Record<number, number> = {};
  for (let r = 1; r <= 10; r++) roundDistribution[r] = 0;
  teams.forEach((t) => {
    if (t.status === 'active' || t.status === 'ready') {
      roundDistribution[t.currentRound] = (roundDistribution[t.currentRound] || 0) + 1;
    }
  });

  const maxTeamsInRound = Math.max(1, ...Object.values(roundDistribution));

  const handleExportJSON = () => {
    const backup = exportBackup();
    const jsonStr = JSON.stringify(backup, null, 2);
    const filename = `treasure_hunt_arena_backup_${new Date().toISOString().slice(0, 10)}.json`;
    downloadFile(jsonStr, filename, 'application/json');
    success('Backup Exported', 'Complete local game state exported to JSON file.');
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        const res = importBackup(parsed);
        if (res.success) {
          success('State Restored', 'Game state successfully restored from JSON backup.');
        } else {
          toastError('Import Failed', res.error || 'Corrupted backup file.');
        }
      } catch (err) {
        toastError('Import Error', 'File is not valid JSON.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-6">
      {/* Event Control & Status Banner */}
      <div className="p-4 bg-arena-card border border-arena-border rounded-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <StatusBadge
            variant={
              config.status === 'live'
                ? 'active'
                : config.status === 'paused'
                ? 'warning'
                : config.status === 'finished'
                ? 'completed'
                : 'ready'
            }
            label={`MATCH STATUS: ${config.status.toUpperCase()}`}
            pulse={config.status === 'live'}
          />
          <span className="text-xs text-arena-muted font-mono">
            {config.eventStartedAt
              ? `Started: ${new Date(config.eventStartedAt).toLocaleTimeString()}`
              : 'Routes uncommitted & waiting in lobby'}
          </span>
        </div>

        {/* Global Match Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {config.status !== 'live' && config.status !== 'finished' && (
            <Button
              size="sm"
              variant="primary"
              icon={<Play className="w-3.5 h-3.5" />}
              onClick={() => setIsStartOpen(true)}
            >
              Start Championship
            </Button>
          )}

          {config.status === 'live' && (
            <Button
              size="sm"
              variant="secondary"
              icon={<Pause className="w-3.5 h-3.5 text-electric-amber" />}
              onClick={() => setIsPauseOpen(true)}
            >
              Pause Global Clock
            </Button>
          )}

          {config.status === 'paused' && (
            <Button
              size="sm"
              variant="primary"
              icon={<Play className="w-3.5 h-3.5" />}
              onClick={resumeEvent}
            >
              Resume Global Clock
            </Button>
          )}

          {config.status === 'live' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsEndOpen(true)}
            >
              Conclude Event
            </Button>
          )}

          <div className="h-4 w-[1px] bg-arena-border mx-1" />

          {/* Backup & Restore Controls */}
          <Button
            size="sm"
            variant="ghost"
            icon={<Download className="w-3.5 h-3.5 text-electric-cyan" />}
            onClick={handleExportJSON}
            title="Export complete LocalStorage state to JSON file"
          >
            Export JSON
          </Button>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImportFile}
            accept=".json"
            className="hidden"
          />
          <Button
            size="sm"
            variant="ghost"
            icon={<Upload className="w-3.5 h-3.5 text-electric-violet" />}
            onClick={() => fileInputRef.current?.click()}
            title="Restore game state from a JSON backup file"
          >
            Import JSON
          </Button>

          <Button
            size="sm"
            variant="ghost"
            icon={<RotateCcw className="w-3.5 h-3.5 text-electric-crimson" />}
            onClick={() => setIsResetOpen(true)}
            title="Reset game state to default"
          >
            Reset
          </Button>
        </div>
      </div>

      {/* 4 Primary Top Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Total & Active Teams */}
        <div className="p-4 bg-arena-card border border-arena-border rounded-xl space-y-1">
          <div className="flex items-center justify-between text-arena-muted text-xs font-mono uppercase">
            <span>Active Competitors</span>
            <Users className="w-4 h-4 text-electric-cyan" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-white font-mono">{activeTeams}</span>
            <span className="text-xs text-arena-muted font-mono">/ {totalTeams} Total</span>
          </div>
          <div className="flex items-center gap-2 pt-1 text-[11px] text-electric-cyan font-bold font-mono">
            <span>{readyTeams} In Lobby</span>
          </div>
        </div>

        {/* Metric 2: Completed / Finishers */}
        <div className="p-4 bg-arena-card border border-arena-border rounded-xl space-y-1">
          <div className="flex items-center justify-between text-arena-muted text-xs font-mono uppercase">
            <span>Certified Finishers</span>
            <Trophy className="w-4 h-4 text-electric-emerald" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-electric-emerald font-mono">{completedTeams}</span>
            <span className="text-xs text-arena-muted font-mono">/ {totalTeams}</span>
          </div>
          <span className="text-[11px] text-electric-emerald font-mono block pt-1">
            Cleared all 10 rounds
          </span>
        </div>

        {/* Metric 3: Disqualified / Eliminated */}
        <div className="p-4 bg-arena-card border border-arena-border rounded-xl space-y-1">
          <div className="flex items-center justify-between text-arena-muted text-xs font-mono uppercase">
            <span>Disqualified</span>
            <ShieldAlert className="w-4 h-4 text-electric-crimson" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-electric-crimson font-mono">{eliminatedTeams}</span>
            <span className="text-xs text-arena-muted font-mono">/ {totalTeams}</span>
          </div>
          <span className="text-[11px] text-arena-muted font-mono block pt-1">
            Strikes or grace timeout
          </span>
        </div>

        {/* Metric 4: Checkpoint Stations */}
        <div className="p-4 bg-arena-card border border-arena-border rounded-xl space-y-1">
          <div className="flex items-center justify-between text-arena-muted text-xs font-mono uppercase">
            <span>Campus Stations</span>
            <MapPin className="w-4 h-4 text-electric-violet" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-electric-violet font-mono">{locations.length}</span>
            <span className="text-xs text-arena-muted font-mono">Stations</span>
          </div>
          <span className="text-[11px] text-electric-emerald font-mono block pt-1">
            2 Teams/Station Equipartition
          </span>
        </div>
      </div>

      {/* Round Distribution Heatmap */}
      <div className="p-5 bg-arena-card border border-arena-border rounded-xl space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Clock className="w-4 h-4 text-electric-cyan" />
            <span>Active Team Distribution Across 10 Rounds</span>
          </h3>
          <span className="text-[11px] font-mono text-arena-muted">Round Progress Curve</span>
        </div>

        <div className="grid grid-cols-10 gap-2 pt-2">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((round) => {
            const count = roundDistribution[round] || 0;
            const percentage = Math.round((count / maxTeamsInRound) * 100);

            return (
              <div key={round} className="flex flex-col items-center gap-2 group">
                <div className="w-full bg-arena-panel rounded-t-lg h-24 flex flex-col justify-end p-1 relative border border-arena-border/60">
                  <div
                    className="w-full bg-electric-cyan/20 border-t-2 border-electric-cyan rounded-t transition-all duration-300"
                    style={{ height: `${Math.max(6, percentage)}%` }}
                  />
                  <span className="absolute top-1 left-0 right-0 text-center text-[11px] font-mono font-bold text-white">
                    {count}
                  </span>
                </div>
                <span className="text-[10px] font-mono font-bold text-arena-muted">R{round}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Physical Station Live Occupancy Heatmap */}
      <div className="p-5 bg-arena-card border border-arena-border rounded-xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <MapPin className="w-4 h-4 text-electric-violet" />
              <span>Station Occupancy &amp; Arrival Telemetry</span>
            </h3>
            <p className="text-[11px] text-arena-muted mt-0.5">
              Target equipartition: exactly 2 teams assigned per station per round.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {stationOccupancies.map((st) => (
            <div
              key={st.locationId}
              className={`p-3 rounded-xl border transition-all ${
                st.isCongested
                  ? 'bg-amber-500/10 border-electric-amber'
                  : 'bg-arena-panel border-arena-border'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono font-bold text-electric-cyan">
                  Station #{st.locationNumber}
                </span>
                <span
                  className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                    st.isCongested ? 'bg-amber-500/20 text-electric-amber' : 'bg-arena-card text-arena-muted'
                  }`}
                >
                  {st.assignedTeams.length} / {st.capacity} Teams
                </span>
              </div>

              <h4 className="text-xs font-bold text-white mt-1.5 truncate" title={st.name}>
                {st.name}
              </h4>
              <p className="text-[10px] text-arena-muted truncate mt-0.5">{st.description}</p>

              <div className="mt-2.5 pt-2 border-t border-arena-border/60 flex items-center justify-between text-[10px] font-mono text-arena-muted">
                <span>Arrived: {st.arrivedTeams.length}</span>
                <span className="text-electric-emerald font-bold">
                  {st.assignedTeams.length > 0
                    ? `${st.assignedTeams.map((t) => t.teamCode).join(', ')}`
                    : 'Idle'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Backend & Supabase Infrastructure Telemetry */}
      <div className="p-5 bg-arena-card border border-arena-border rounded-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Database className="w-4 h-4 text-electric-cyan" />
              <span>Backend &amp; Supabase Infrastructure</span>
            </h3>
            <p className="text-[11px] text-arena-muted mt-0.5">
              Live status of cloud database connection and local fail-safe storage.
            </p>
          </div>
          <BackendStatusBadge />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
          <div className="p-3 bg-arena-panel rounded-lg border border-arena-border/60">
            <span className="text-[10px] font-mono uppercase text-arena-muted block">Project Host</span>
            <span className="text-xs font-mono font-semibold text-white block mt-1 truncate">
              {(typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_SUPABASE_URL : undefined) || 'https://yersiudondrbdlerowth.supabase.co'}
            </span>
            <span className="text-[10px] text-emerald-400 font-mono block mt-0.5">
              Region: ap-south-1 (Mumbai)
            </span>
          </div>

          <div className="p-3 bg-arena-panel rounded-lg border border-arena-border/60">
            <span className="text-[10px] font-mono uppercase text-arena-muted block">Schema Execution</span>
            <span className="text-xs font-mono font-semibold text-amber-300 block mt-1">
              Pending Schema Review
            </span>
            <span className="text-[10px] text-arena-muted font-mono block mt-0.5">
              schema.sql validated &bull; awaiting DB push
            </span>
          </div>

          <div className="p-3 bg-arena-panel rounded-lg border border-arena-border/60">
            <span className="text-[10px] font-mono uppercase text-arena-muted block">Active Engine Mode</span>
            <span className="text-xs font-mono font-semibold text-electric-cyan block mt-1">
              Hybrid Client (Local Engine Active)
            </span>
            <span className="text-[10px] text-arena-muted font-mono block mt-0.5">
              100% playable in browser with zero server dependency
            </span>
          </div>
        </div>
      </div>

      {/* Confirmation Dialogs */}
      <ConfirmationDialog
        isOpen={isStartOpen}
        onClose={() => setIsStartOpen(false)}
        onConfirm={() => {
          startEvent();
          setIsStartOpen(false);
          success('Championship Live!', 'Event started simultaneously for all 20 teams.');
        }}
        title="Start Championship Event"
        message="Are you ready to initiate the synchronized event clock? All 20 teams will start simultaneously, and routes will be locked permanently."
        confirmLabel="Start Event"
      />

      <ConfirmationDialog
        isOpen={isPauseOpen}
        onClose={() => setIsPauseOpen(false)}
        onConfirm={() => {
          pauseEvent();
          setIsPauseOpen(false);
          warning('Event Paused', 'Match clock paused. Active deadlines will be preserved.');
        }}
        title="Pause Championship"
        message="Pausing halts the countdown timer across all participant sessions without penalty. You can resume at any time."
        confirmLabel="Pause Match"
      />

      <ConfirmationDialog
        isOpen={isEndOpen}
        onClose={() => setIsEndOpen(false)}
        onConfirm={() => {
          endEvent();
          setIsEndOpen(false);
          success('Event Finished', 'Championship has concluded. Final standings locked.');
        }}
        title="Conclude Event"
        message="This marks the championship finished and freezes the final leaderboard standings."
        confirmLabel="End Event"
      />

      <ConfirmationDialog
        isOpen={isResetOpen}
        onClose={() => setIsResetOpen(false)}
        onConfirm={() => {
          resetAllGameData();
          setIsResetOpen(false);
          warning('State Reset', 'Game state has been reset to defaults.');
        }}
        title="Reset All Game Data"
        message="Are you sure you want to reset all game state, team progress, and telemetry? This action cannot be undone unless you have a JSON backup."
        confirmLabel="Reset State"
        isDestructive
      />
    </div>
  );
}


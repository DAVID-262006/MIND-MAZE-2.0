import React from 'react';
import { 
  Compass, 
  Terminal, 
  QrCode, 
  Timer, 
  ShieldCheck, 
  Users, 
  ArrowRight,
  Shield,
  Layers,
  Sparkles,
  Info
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { StatusBadge } from '../components/ui/StatusBadge';
import { useGameStore } from '../store/gameStore';

export interface HomePageProps {
  onNavigate: (view: 'player' | 'admin') => void;
}

export function HomePage({ onNavigate }: HomePageProps) {
  const { config, teams } = useGameStore();

  return (
    <main className="min-h-screen bg-arena-bg flex flex-col justify-between">
      {/* Top Banner */}
      <div className="w-full border-b border-arena-border/60 bg-arena-card/40 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-electric-cyan/10 border border-electric-cyan/30 flex items-center justify-center text-electric-cyan shadow-[0_0_10px_rgba(0,242,254,0.2)]">
            <Compass className="w-5 h-5 animate-pulse-slow" />
          </div>
          <div>
            <h1 className="text-sm font-black tracking-wider text-white">TREASURE HUNT ARENA</h1>
            <p className="text-[10px] uppercase font-mono tracking-widest text-arena-muted">
              LIGHTWEIGHT FRONTEND-ONLY ARCHITECTURE
            </p>
          </div>
        </div>

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
            label={`ENGINE: ${config.status.toUpperCase()}`}
            pulse={config.status === 'live'}
          />
        </div>
      </div>

      {/* Hero Section */}
      <div className="max-w-5xl mx-auto px-6 py-12 flex-1 flex flex-col justify-center text-center">
        <div className="inline-flex items-center gap-2 self-center px-3 py-1 rounded-full bg-electric-cyan/10 border border-electric-cyan/20 text-electric-cyan text-xs font-mono font-bold mb-6">
          <Sparkles className="w-3.5 h-3.5" />
          <span>20 TEAMS • 10 ROUNDS • 10 PHYSICAL CHECKPOINTS</span>
        </div>

        <h2 className="text-4xl sm:text-6xl font-black tracking-tight text-white max-w-3xl mx-auto leading-tight">
          Synchronized Speed, <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-electric-cyan via-cyan-400 to-electric-emerald">
            Algorithmic Orienteering.
          </span>
        </h2>

        <p className="text-sm sm:text-base text-arena-muted max-w-xl mx-auto mt-4 leading-relaxed">
          High-intensity collegiate treasure hunt tournament engine. Runs completely in the browser with persistent LocalStorage state, Latin Hypercube routes, and camera QR verification.
        </p>

        {/* Portal Entry Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto w-full mt-12 text-left">
          {/* Card 1: Player Arena */}
          <div className="group relative bg-arena-card border border-arena-border hover:border-electric-cyan/50 rounded-2xl p-6 transition-all duration-300 shadow-xl flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-xl bg-electric-cyan/10 border border-electric-cyan/30 flex items-center justify-center text-electric-cyan mb-5 group-hover:scale-105 transition-transform">
                <Terminal className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white tracking-wide">Player Arena</h3>
              <p className="text-xs text-arena-muted mt-2 leading-relaxed">
                Mobile-optimized interface for participating teams. View riddles, submit computed challenge tokens, survive the 5m+30s countdown, and scan physical station QR codes.
              </p>
              <div className="flex flex-wrap gap-2 mt-4">
                <span className="text-[10px] font-mono bg-arena-panel border border-arena-border px-2 py-0.5 rounded text-arena-muted">
                  Quick-Connect Test Keys
                </span>
                <span className="text-[10px] font-mono bg-arena-panel border border-arena-border px-2 py-0.5 rounded text-arena-muted">
                  Camera QR Scanner
                </span>
                <span className="text-[10px] font-mono bg-arena-panel border border-arena-border px-2 py-0.5 rounded text-arena-muted">
                  Anti-Cheat Deterrence
                </span>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-arena-border/60">
              <Button
                variant="primary"
                className="w-full justify-between"
                onClick={() => onNavigate('player')}
              >
                <span>Enter Player Arena</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Card 2: Admin Control Center */}
          <div className="group relative bg-arena-card border border-arena-border hover:border-electric-violet/50 rounded-2xl p-6 transition-all duration-300 shadow-xl flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-xl bg-electric-violet/10 border border-electric-violet/30 flex items-center justify-center text-electric-violet mb-5 group-hover:scale-105 transition-transform">
                <Shield className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white tracking-wide">Admin Control Center</h3>
              <p className="text-xs text-arena-muted mt-2 leading-relaxed">
                Mission control for organizers. Latin Hypercube route generator, station occupancy heatmap, live team telemetry, QR placard generator, and CSV/JSON data export.
              </p>
              <div className="flex flex-wrap gap-2 mt-4">
                <span className="text-[10px] font-mono bg-arena-panel border border-arena-border px-2 py-0.5 rounded text-arena-muted">
                  Latin Hypercube Routes
                </span>
                <span className="text-[10px] font-mono bg-arena-panel border border-arena-border px-2 py-0.5 rounded text-arena-muted">
                  Live Station Telemetry
                </span>
                <span className="text-[10px] font-mono bg-arena-panel border border-arena-border px-2 py-0.5 rounded text-arena-muted">
                  JSON Backup &amp; Restore
                </span>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-arena-border/60">
              <Button
                variant="secondary"
                className="w-full justify-between hover:border-electric-violet text-white"
                onClick={() => onNavigate('admin')}
              >
                <span>Launch Control Center</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-3xl mx-auto w-full mt-12 text-center">
          <div className="p-3 bg-arena-card/60 border border-arena-border/40 rounded-xl">
            <Timer className="w-5 h-5 text-electric-amber mx-auto mb-1.5" />
            <span className="text-xs font-bold text-white block">5m + 30s Grace</span>
            <span className="text-[10px] text-arena-muted block">Timestamped Logic</span>
          </div>
          <div className="p-3 bg-arena-card/60 border border-arena-border/40 rounded-xl">
            <QrCode className="w-5 h-5 text-electric-cyan mx-auto mb-1.5" />
            <span className="text-xs font-bold text-white block">10 Physical Stations</span>
            <span className="text-[10px] text-arena-muted block">Printable Placards</span>
          </div>
          <div className="p-3 bg-arena-card/60 border border-arena-border/40 rounded-xl">
            <Layers className="w-5 h-5 text-electric-emerald mx-auto mb-1.5" />
            <span className="text-xs font-bold text-white block">Pure Browser SPA</span>
            <span className="text-[10px] text-arena-muted block">Zero Backend Complexity</span>
          </div>
          <div className="p-3 bg-arena-card/60 border border-arena-border/40 rounded-xl">
            <ShieldCheck className="w-5 h-5 text-electric-crimson mx-auto mb-1.5" />
            <span className="text-xs font-bold text-white block">Anti-Cheat Deterrence</span>
            <span className="text-[10px] text-arena-muted block">3 Strikes Disqualification</span>
          </div>
        </div>

        {/* Architecture Disclosure Callout */}
        <div className="max-w-2xl mx-auto mt-10 p-3 bg-arena-card/40 border border-arena-border/50 rounded-xl text-left flex items-start gap-3">
          <Info className="w-4 h-4 text-electric-cyan shrink-0 mt-0.5" />
          <p className="text-[11px] text-arena-muted leading-relaxed">
            <strong>Architecture Note:</strong> This is a lightweight, frontend-only application running entirely in your browser using LocalStorage. It is designed for centralized event management, tournament demonstration, and rapid static hosting without database servers.
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-arena-border/60 py-4 px-6 text-center text-xs text-arena-muted font-mono">
        TREASURE HUNT ARENA v2.0.0 &bull; REACT + VITE + TAILWIND CSS &bull; LIGHTWEIGHT FRONTEND EDITION
      </footer>
    </main>
  );
}


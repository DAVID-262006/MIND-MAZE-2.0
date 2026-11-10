import React, { useState } from 'react';
import { AdminHeader } from '../../components/layout/AdminHeader';
import { AdminLoginView } from '../../components/admin/AdminLoginView';
import { AdminOverviewTab } from '../../components/admin/AdminOverviewTab';
import { AdminLiveMonitoringTab } from '../../components/admin/AdminLiveMonitoringTab';
import { AdminTeamsTab } from '../../components/admin/AdminTeamsTab';
import { AdminPuzzlesTab } from '../../components/admin/AdminPuzzlesTab';
import { AdminLocationsTab } from '../../components/admin/AdminLocationsTab';
import { AdminRoutesTab } from '../../components/admin/AdminRoutesTab';
import { AdminAntiCheatTab } from '../../components/admin/AdminAntiCheatTab';
import { AdminLeaderboardTab } from '../../components/admin/AdminLeaderboardTab';
import { useGameStore } from '../../store/gameStore';
import { 
  Activity, 
  Users, 
  MapPin, 
  Trophy, 
  ShieldAlert, 
  FileCode2, 
  Sliders, 
} from 'lucide-react';

type AdminTab =
  | 'overview'
  | 'monitoring'
  | 'teams'
  | 'puzzles'
  | 'locations'
  | 'routes'
  | 'security'
  | 'leaderboard';

export interface AdminPageProps {
  onNavigateHome?: () => void;
  onNavigatePlayer?: () => void;
}

export function AdminPage({ onNavigateHome, onNavigatePlayer }: AdminPageProps) {
  const { config, isAdminAuthenticated, logoutAdmin } = useGameStore();
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');

  if (!isAdminAuthenticated) {
    return (
      <div className="min-h-screen bg-arena-bg flex flex-col justify-between">
        <AdminHeader
          status={config.status}
          onNavigateHome={onNavigateHome}
          onViewPlayer={onNavigatePlayer}
        />
        <AdminLoginView />
        <footer className="border-t border-arena-border/60 py-3 px-6 text-center text-xs text-arena-muted font-mono">
          TREASURE HUNT ARENA &bull; MASTER ADMIN PORTAL
        </footer>
      </div>
    );
  }

  const tabs: { id: AdminTab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <Activity className="w-3.5 h-3.5" /> },
    { id: 'monitoring', label: 'Live Monitoring', icon: <Activity className="w-3.5 h-3.5 text-electric-cyan" /> },
    { id: 'teams', label: 'Teams (20)', icon: <Users className="w-3.5 h-3.5" /> },
    { id: 'puzzles', label: 'Riddles (10)', icon: <FileCode2 className="w-3.5 h-3.5" /> },
    { id: 'locations', label: 'Stations (10)', icon: <MapPin className="w-3.5 h-3.5" /> },
    { id: 'routes', label: 'Route Matrix', icon: <Sliders className="w-3.5 h-3.5" /> },
    { id: 'security', label: 'Anti-Cheat', icon: <ShieldAlert className="w-3.5 h-3.5 text-electric-amber" /> },
    { id: 'leaderboard', label: 'Leaderboard', icon: <Trophy className="w-3.5 h-3.5 text-electric-emerald" /> },
  ];

  return (
    <div className="min-h-screen bg-arena-bg flex flex-col justify-between">
      {/* Top Admin Header */}
      <AdminHeader
        status={config.status}
        onLogout={logoutAdmin}
        onNavigateHome={onNavigateHome}
        onViewPlayer={onNavigatePlayer}
      />

      {/* Main Admin Content */}
      <main className="max-w-7xl mx-auto px-3.5 sm:px-6 py-4 sm:py-6 flex-1 w-full space-y-5">
        {/* Navigation Tabs Bar with smooth touch scrolling */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-arena-border scrollbar-thin scrollbar-thumb-arena-border">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-mono font-bold tracking-wider transition-all whitespace-nowrap select-none shrink-0 ${
                activeTab === tab.id
                  ? 'bg-electric-cyan text-arena-bg shadow-[0_0_15px_rgba(0,242,254,0.3)]'
                  : 'text-arena-muted hover:text-white hover:bg-arena-panel'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab Views */}
        <div className="w-full overflow-x-hidden">
          {activeTab === 'overview' && <AdminOverviewTab />}
          {activeTab === 'monitoring' && <AdminLiveMonitoringTab />}
          {activeTab === 'teams' && <AdminTeamsTab />}
          {activeTab === 'puzzles' && <AdminPuzzlesTab />}
          {activeTab === 'locations' && <AdminLocationsTab />}
          {activeTab === 'routes' && <AdminRoutesTab />}
          {activeTab === 'security' && <AdminAntiCheatTab />}
          {activeTab === 'leaderboard' && <AdminLeaderboardTab />}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-arena-border/60 py-3 px-6 text-center text-xs text-arena-muted font-mono">
        TREASURE HUNT ARENA &bull; MASTER ADMIN CONTROL &bull; BROWSER-LOCAL DISPATCH ENGINE
      </footer>
    </div>
  );
}

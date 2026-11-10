import React from 'react';
import { PlayerHeader } from '../../components/layout/PlayerHeader';
import { LoginView } from '../../components/arena/LoginView';
import { LobbyView } from '../../components/arena/LobbyView';
import { ActiveGameView } from '../../components/arena/ActiveGameView';
import { CompletionView } from '../../components/arena/CompletionView';
import { EliminationView } from '../../components/arena/EliminationView';
import { useGameStore } from '../../store/gameStore';
import { useFullscreen } from '../../hooks/useFullscreen';

export interface PlayerArenaPageProps {
  onNavigateHome?: () => void;
}

export function PlayerArenaPage({ onNavigateHome }: PlayerArenaPageProps) {
  const {
    config,
    activeTeam,
    leaderboard,
    logoutTeam,
  } = useGameStore();

  const { isFullscreen, toggleFullscreen, isSupported } = useFullscreen();

  // 1. If not authenticated, render Welcome / Login Screen
  if (!activeTeam) {
    return (
      <div className="min-h-screen bg-arena-bg flex flex-col justify-center">
        <LoginView />
      </div>
    );
  }

  // 2. If eliminated, render Elimination Screen
  if (activeTeam.status === 'eliminated') {
    return (
      <div className="min-h-screen bg-arena-bg flex flex-col">
        <PlayerHeader
          teamCode={activeTeam.teamCode}
          currentRound={activeTeam.currentRound}
          strikes={activeTeam.strikes}
          isFullscreen={isFullscreen}
          onToggleFullscreen={isSupported ? toggleFullscreen : undefined}
          onLogout={logoutTeam}
        />
        <main className="flex-1 flex flex-col justify-center px-4 py-6">
          <EliminationView
            team={activeTeam}
            roundNumber={activeTeam.currentRound}
            onReturnHome={logoutTeam}
          />
        </main>
      </div>
    );
  }

  // 3. If completed championship, render Final Completion Screen
  if (activeTeam.status === 'completed') {
    const leaderEntry = leaderboard.find((l) => l.teamId === activeTeam.id);
    return (
      <div className="min-h-screen bg-arena-bg flex flex-col">
        <PlayerHeader
          teamCode={activeTeam.teamCode}
          currentRound={10}
          strikes={activeTeam.strikes}
          isFullscreen={isFullscreen}
          onToggleFullscreen={isSupported ? toggleFullscreen : undefined}
          onLogout={logoutTeam}
        />
        <main className="flex-1 flex flex-col justify-center px-4 py-6">
          <CompletionView
            team={activeTeam}
            completionTimeFormatted={leaderEntry?.completionTimeFormatted || '42m 18s'}
            rank={leaderEntry?.rank}
            onReturnHome={logoutTeam}
          />
        </main>
      </div>
    );
  }

  // 4. If event is not live (draft, ready, or paused before live) and team is ready, render Player Lobby
  if (config.status !== 'live' && (activeTeam.status === 'ready' || activeTeam.status === 'registered')) {
    return (
      <div className="min-h-screen bg-arena-bg flex flex-col">
        <PlayerHeader
          teamCode={activeTeam.teamCode}
          strikes={activeTeam.strikes}
          isFullscreen={isFullscreen}
          onToggleFullscreen={isSupported ? toggleFullscreen : undefined}
          onLogout={logoutTeam}
        />
        <main className="flex-1 max-w-lg mx-auto w-full px-4 py-6 flex flex-col justify-center">
          <LobbyView team={activeTeam} onLogout={logoutTeam} />
        </main>
      </div>
    );
  }

  // 5. Active In-Game Screen (rendered in dedicated component with its own unconditional hooks)
  return (
    <ActiveGameView
      team={activeTeam}
      config={config}
      isFullscreen={isFullscreen}
      isSupported={isSupported}
      onToggleFullscreen={toggleFullscreen}
      onLogout={logoutTeam}
    />
  );
}

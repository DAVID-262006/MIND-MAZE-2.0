import React, { useState } from 'react';
import { PlayerHeader } from '../../components/layout/PlayerHeader';
import { LoginView } from '../../components/arena/LoginView';
import { LobbyView } from '../../components/arena/LobbyView';
import { ActiveGameView } from '../../components/arena/ActiveGameView';
import { CompletionView } from '../../components/arena/CompletionView';
import { EliminationView } from '../../components/arena/EliminationView';
import { FullscreenActivationScreen } from '../../components/anticheat/FullscreenActivationScreen';
import { useGameStore } from '../../store/gameStore';
import { useFullscreen } from '../../hooks/useFullscreen';
import { SupabaseService } from '../../services/supabaseService';

export interface PlayerArenaPageProps {
  onNavigateHome?: () => void;
}

export function PlayerArenaPage({ onNavigateHome }: PlayerArenaPageProps) {
  const {
    config,
    activeTeam,
    leaderboard,
    incidents,
    logoutTeam,
    startParticipantGame,
    progress,
  } = useGameStore();

  const { isFullscreen, toggleFullscreen, isSupported } = useFullscreen();

  // Check if participant has already started the game:
  // ONLY if the event is already live AND the team has active status or existing progress
  const isTeamStarted = React.useMemo(() => {
    if (!activeTeam) return false;
    if (activeTeam.status === 'completed' || activeTeam.status === 'eliminated') {
      return true;
    }
    // If the event itself has not gone live yet, the team MUST remain in the lobby!
    if (config.status !== 'live') {
      return false;
    }
    if (activeTeam.status === 'active') {
      return true;
    }
    const hasProgress = progress.some((p) => p.teamId === activeTeam.id);
    if (hasProgress) return true;
    try {
      const stored = localStorage.getItem(`mm2_team_started_${activeTeam.id}`);
      if (stored === 'true') return true;
    } catch {}
    return false;
  }, [activeTeam, progress, config.status]);

  const [hasStartedGame, setHasStartedGame] = useState<boolean>(() => {
    return isTeamStarted;
  });

  // Keep state synchronized: participant only enters gameplay when event is live or countdown completes
  React.useEffect(() => {
    if (config.status === 'live') {
      setHasStartedGame(true);
      return;
    }

    if (config.status === 'countdown' && config.countdownStartAt) {
      const remainingMs = new Date(config.countdownStartAt).getTime() - Date.now();
      if (remainingMs <= 0) {
        setHasStartedGame(true);
      } else {
        const timeout = setTimeout(() => {
          setHasStartedGame(true);
        }, remainingMs);
        return () => clearTimeout(timeout);
      }
    }
  }, [config.status, config.countdownStartAt]);

  // Requirement 13D: Participant Heartbeat & Online Presence
  // Sends a lightweight heartbeat every 12 seconds while a participant is logged in
  React.useEffect(() => {
    if (!activeTeam) return;

    let isMounted = true;
    const sendPing = () => {
      if (!isMounted) return;
      const sessionToken = sessionStorage.getItem('mm2_session_token');
      if (sessionToken && SupabaseService.isConfigured()) {
        SupabaseService.sendHeartbeat(sessionToken).catch((err) => {
          // Temporary network failure; do not treat as immediate logout
          console.warn('[Heartbeat] Ping notice:', err);
        });
      }
    };

    // Immediate initial heartbeat upon entry/mount
    sendPing();

    const interval = setInterval(sendPing, 12000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [activeTeam?.id]);

  const handleStartGame = async () => {
    if (!activeTeam) return;
    try {
      localStorage.setItem(`mm2_team_started_${activeTeam.id}`, 'true');
    } catch {}
    setHasStartedGame(true);
    await startParticipantGame(activeTeam.id);
  };

  // 1. If not authenticated, render Welcome / Login Screen
  if (!activeTeam) {
    return (
      <div className="min-h-screen bg-arena-bg flex flex-col justify-center">
        <LoginView />
      </div>
    );
  }

  // 2. If eliminated, render Elimination Screen (Irreversible through player UI)
  if (activeTeam.status === 'eliminated' || (activeTeam.strikes || 0) >= 4) {
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
            incidents={incidents}
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
          currentRound={9}
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

  // 4. If participant has not yet started their game, render Player Lobby with START GAME button
  if (!hasStartedGame && (activeTeam.status === 'ready' || activeTeam.status === 'registered')) {
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

  // 5. Fullscreen Activation Screen: Mandatory before active gameplay begins if not in fullscreen
  if (!isFullscreen && isSupported) {
    return (
      <FullscreenActivationScreen
        team={activeTeam}
        onFullscreenActivated={() => {
          setHasStartedGame(true);
        }}
        onLogout={logoutTeam}
      />
    );
  }

  // 6. Active In-Game Screen
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

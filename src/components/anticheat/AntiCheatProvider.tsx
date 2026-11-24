import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { Team, ViolationType, GameEventConfig } from '../../types';
import { useGameStore } from '../../store/gameStore';
import { useFullscreen } from '../../hooks/useFullscreen';
import { useAntiCheat } from '../../hooks/useAntiCheat';
import { ViolationManager, type WarningConfig } from '../../services/violationManager';
import { WarningModal } from './WarningModal';

interface AntiCheatContextType {
  isFullscreen: boolean;
  isSupported: boolean;
  hasStartedFullscreen: boolean;
  warningModalConfig: WarningConfig | null;
  isWarningModalOpen: boolean;
  isSuppressed: boolean;
  setSuppressed: (suppressed: boolean) => void;
  setHasStartedFullscreen: (started: boolean) => void;
  acknowledgeWarning: () => Promise<void>;
  requestFullscreen: () => Promise<boolean>;
  recordViolationManual: (type: ViolationType, reason?: string) => void;
}

const AntiCheatContext = createContext<AntiCheatContextType | null>(null);

export function useAntiCheatContext() {
  const context = useContext(AntiCheatContext);
  if (!context) {
    throw new Error('useAntiCheatContext must be used within an AntiCheatProvider');
  }
  return context;
}

export interface AntiCheatProviderProps {
  children: React.ReactNode;
  activeTeam: Team | null;
  config: GameEventConfig;
  onEliminated?: () => void;
}

export function AntiCheatProvider({
  children,
  activeTeam,
  config,
  onEliminated,
}: AntiCheatProviderProps) {
  const { recordViolation } = useGameStore();
  const { isFullscreen, isSupported, enterFullscreen } = useFullscreen();

  const [hasStartedFullscreen, setHasStartedFullscreen] = useState<boolean>(() => {
    // If team is already active, resume fullscreen session
    return activeTeam ? isFullscreen : false;
  });

  const [isSuppressed, setSuppressed] = useState(false);
  const [warningModalConfig, setWarningModalConfig] = useState<WarningConfig | null>(null);
  const [isWarningModalOpen, setIsWarningModalOpen] = useState(false);

  // Cooldown ref to avoid race conditions when closing modal & re-entering fullscreen
  const acknowledgementCooldownRef = useRef(false);

  // Keep in sync with active team changes
  useEffect(() => {
    if (!activeTeam) {
      setHasStartedFullscreen(false);
      setIsWarningModalOpen(false);
      setWarningModalConfig(null);
    }
  }, [activeTeam?.id]);

  const handleViolationDetected = useCallback(
    (type: ViolationType, details: { strikeNumber: number; message: string; eliminated: boolean }) => {
      if (!activeTeam || activeTeam.status === 'eliminated' || activeTeam.status === 'completed') {
        return;
      }

      if (acknowledgementCooldownRef.current) {
        return;
      }

      // Record in authoritative store
      const result = recordViolation(activeTeam.id, type, { reason: details.message });

      if (result.eliminated) {
        setIsWarningModalOpen(false);
        setWarningModalConfig(null);
        onEliminated?.();
      } else {
        const warnConfig = ViolationManager.getWarningConfig(result.strikeNumber, type);
        setWarningModalConfig(warnConfig);
        setIsWarningModalOpen(true);
      }
    },
    [activeTeam, recordViolation, onEliminated]
  );

  // Hook up continuous client-side detection
  useAntiCheat({
    activeTeam,
    isPlaying: config.status === 'live' && hasStartedFullscreen,
    suppressed: isSuppressed || isWarningModalOpen || acknowledgementCooldownRef.current,
    onViolation: (type, details) => {
      handleViolationDetected(type, details);
    },
  });

  // Dedicated Fullscreen exit listener during active gameplay
  useEffect(() => {
    if (!hasStartedFullscreen || config.status !== 'live' || !activeTeam || activeTeam.status === 'eliminated') {
      return;
    }

    if (!isFullscreen && !isWarningModalOpen && !isSuppressed && !acknowledgementCooldownRef.current) {
      // Fullscreen exited
      handleViolationDetected('fullscreen_exit', {
        strikeNumber: (activeTeam.strikes || 0) + 1,
        message: 'Fullscreen was exited during active gameplay.',
        eliminated: (activeTeam.strikes || 0) + 1 >= 4,
      });
    }
  }, [isFullscreen, hasStartedFullscreen, config.status, activeTeam?.id, isWarningModalOpen, isSuppressed, handleViolationDetected]);

  const acknowledgeWarning = useCallback(async () => {
    acknowledgementCooldownRef.current = true;

    // Restore fullscreen
    if (!isFullscreen && isSupported) {
      await enterFullscreen().catch(() => {});
    }

    setIsWarningModalOpen(false);
    setWarningModalConfig(null);

    // 1200ms grace cooldown so restoring fullscreen does not trigger an immediate violation
    setTimeout(() => {
      acknowledgementCooldownRef.current = false;
    }, 1200);
  }, [isFullscreen, isSupported, enterFullscreen]);

  const recordViolationManual = useCallback(
    (type: ViolationType, reason?: string) => {
      if (!activeTeam) return;
      handleViolationDetected(type, {
        strikeNumber: (activeTeam.strikes || 0) + 1,
        message: reason || 'Manual violation recorded.',
        eliminated: (activeTeam.strikes || 0) + 1 >= 4,
      });
    },
    [activeTeam, handleViolationDetected]
  );

  return (
    <AntiCheatContext.Provider
      value={{
        isFullscreen,
        isSupported,
        hasStartedFullscreen,
        warningModalConfig,
        isWarningModalOpen,
        isSuppressed,
        setSuppressed,
        setHasStartedFullscreen,
        acknowledgeWarning,
        requestFullscreen: enterFullscreen,
        recordViolationManual,
      }}
    >
      {children}

      {/* Persistent Fullscreen Lockdown Warning Modal */}
      {warningModalConfig && (
        <WarningModal
          isOpen={isWarningModalOpen}
          config={warningModalConfig}
          isFullscreen={isFullscreen}
          onAcknowledge={acknowledgeWarning}
        />
      )}
    </AntiCheatContext.Provider>
  );
}

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type {
  GameEventConfig,
  Team,
  LocationCheckpoint,
  Riddle,
  RouteAssignment,
  TeamRoundProgress,
  AntiCheatIncident,
  LeaderboardEntry,
  StationOccupancy,
  FullGameBackup,
  ViolationType,
} from '../types';
import { StorageService } from '../services/storageService';
import { generateBalancedRoutes } from '../services/routeEngine';
import { AnswerValidator, type AnswerValidationResult } from '../services/answerEngine';
import { calculateLeaderboard } from '../services/leaderboardEngine';

interface GameContextType {
  config: GameEventConfig;
  teams: Team[];
  locations: LocationCheckpoint[];
  riddles: Riddle[];
  routes: RouteAssignment[];
  progress: TeamRoundProgress[];
  incidents: AntiCheatIncident[];
  activeTeam: Team | null;
  isAdminAuthenticated: boolean;
  leaderboard: LeaderboardEntry[];
  stationOccupancies: StationOccupancy[];

  // Event controls
  startEvent: () => void;
  pauseEvent: () => void;
  resumeEvent: () => void;
  endEvent: () => void;
  resetAllGameData: () => void;

  // Admin controls
  loginAdmin: (password: string) => boolean;
  logoutAdmin: () => void;
  createTeam: (name: string, code: string, accessCode?: string) => { success: boolean; error?: string };
  updateTeam: (id: string, updates: Partial<Team>) => void;
  deleteTeam: (id: string) => void;
  eliminateTeam: (id: string, reason: string) => void;
  reinstateTeam: (id: string) => void;
  updateLocation: (id: number, updates: Partial<LocationCheckpoint>) => void;
  regenerateLocationToken: (id: number) => string;
  saveRiddle: (riddle: Riddle) => void;
  regenerateRoutes: () => { success: boolean; message: string };
  lockRoutes: () => void;

  // Player actions
  loginTeam: (teamCode: string, accessCode: string) => { success: boolean; error?: string; team?: Team };
  logoutTeam: () => void;
  getTeamProgress: (teamId: string, roundNumber: number) => TeamRoundProgress | undefined;
  getTeamAssignedLocation: (teamId: string, roundNumber: number) => LocationCheckpoint | undefined;
  submitAnswer: (teamId: string, roundNumber: number, answer: string) => AnswerValidationResult;
  verifyQrToken: (teamId: string, roundNumber: number, scannedToken: string) => { success: boolean; message: string; isCompleted?: boolean };
  recordViolation: (teamId: string, type: ViolationType, metadata?: Record<string, unknown>) => { strikeNumber: number; eliminated: boolean; message: string };
  handleTimerExpiry: (teamId: string, roundNumber: number) => void;

  // Backup & Restore
  exportBackup: () => FullGameBackup;
  importBackup: (backup: unknown) => { success: boolean; error?: string };
}

const GameContext = createContext<GameContextType | null>(null);

export function GameProvider({ children }: { children: React.ReactNode }) {
  // Primary persistent state
  const [config, setConfig] = useState<GameEventConfig>(() => StorageService.loadConfig());
  const [teams, setTeams] = useState<Team[]>(() => StorageService.loadTeams());
  const [locations, setLocations] = useState<LocationCheckpoint[]>(() => StorageService.loadLocations());
  const [riddles, setRiddles] = useState<Riddle[]>(() => StorageService.loadRiddles());
  const [routes, setRoutes] = useState<RouteAssignment[]>(() => StorageService.loadRoutes());
  const [progress, setProgress] = useState<TeamRoundProgress[]>(() => StorageService.loadProgress());
  const [incidents, setIncidents] = useState<AntiCheatIncident[]>(() => StorageService.loadIncidents());

  // Sessions
  const [activeTeamId, setActiveTeamId] = useState<string | null>(() => {
    const loadedTeams = StorageService.loadTeams();
    return StorageService.getActiveTeamId(loadedTeams);
  });
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(() => StorageService.getAdminAuth());

  // Automatically clear stale or non-existent active team ID
  useEffect(() => {
    if (activeTeamId && !teams.some((t) => t.id === activeTeamId)) {
      console.warn('Active team session ID not found in current teams list, resetting active session to null');
      setActiveTeamId(null);
    }
  }, [activeTeamId, teams]);

  // Synchronize state changes to localStorage
  useEffect(() => {
    StorageService.saveConfig(config);
  }, [config]);

  useEffect(() => {
    StorageService.saveTeams(teams);
  }, [teams]);

  useEffect(() => {
    StorageService.saveLocations(locations);
  }, [locations]);

  useEffect(() => {
    StorageService.saveRiddles(riddles);
  }, [riddles]);

  useEffect(() => {
    StorageService.saveRoutes(routes);
  }, [routes]);

  useEffect(() => {
    StorageService.saveProgress(progress);
  }, [progress]);

  useEffect(() => {
    StorageService.saveIncidents(incidents);
  }, [incidents]);

  useEffect(() => {
    StorageService.setActiveTeamId(activeTeamId);
  }, [activeTeamId]);

  useEffect(() => {
    StorageService.setAdminAuth(isAdminAuthenticated);
  }, [isAdminAuthenticated]);

  // Active Team derived
  const activeTeam = useMemo(() => {
    if (!activeTeamId) return null;
    return teams.find((t) => t.id === activeTeamId) || null;
  }, [activeTeamId, teams]);

  // Leaderboard derived
  const leaderboard = useMemo(() => {
    return calculateLeaderboard(teams, progress, config.eventStartedAt || null);
  }, [teams, progress, config.eventStartedAt]);

  // Station Occupancy derived
  const stationOccupancies = useMemo<StationOccupancy[]>(() => {
    return locations.map((loc) => {
      const assigned: { teamId: string; teamCode: string; teamName: string; roundNumber: number }[] = [];
      const arrived: { teamId: string; teamCode: string; teamName: string; roundNumber: number; scannedAt: string }[] = [];

      teams.forEach((team) => {
        // Find assigned location for team's current round
        const assignedRoute = routes.find(
          (r) => r.teamId === team.id && r.roundNumber === team.currentRound
        );
        if (assignedRoute && assignedRoute.locationId === loc.id) {
          assigned.push({
            teamId: team.id,
            teamCode: team.teamCode,
            teamName: team.teamName,
            roundNumber: team.currentRound,
          });

          // Check if arrived / verified
          const p = progress.find(
            (prog) => prog.teamId === team.id && prog.roundNumber === team.currentRound
          );
          if (p?.qrScanned && p.qrScannedAt) {
            arrived.push({
              teamId: team.id,
              teamCode: team.teamCode,
              teamName: team.teamName,
              roundNumber: team.currentRound,
              scannedAt: p.qrScannedAt,
            });
          }
        }
      });

      return {
        locationId: loc.id,
        locationNumber: loc.locationNumber,
        name: loc.name,
        description: loc.description,
        capacity: loc.capacity,
        assignedTeams: assigned,
        arrivedTeams: arrived,
        isCongested: assigned.length > loc.capacity,
      };
    });
  }, [locations, teams, routes, progress]);

  // ==========================================
  // EVENT LIFECYCLE CONTROLS
  // ==========================================

  const startEvent = useCallback(() => {
    const now = new Date().toISOString();
    const durationSeconds = config.roundDurationSeconds || 300;
    const graceSeconds = config.gracePeriodSeconds || 30;

    // Lock routes
    setConfig((prev) => ({
      ...prev,
      status: 'live',
      eventStartedAt: prev.eventStartedAt || now,
      routesLocked: true,
      pauseStartedAt: null,
    }));

    // Initialize Round 1 Progress for all active/ready teams if not already started
    const nowEpoch = Date.now();
    setProgress((prev) => {
      const updated = [...prev];
      teams.forEach((t) => {
        if (t.status === 'ready' || t.status === 'registered') {
          const existing = updated.find((p) => p.teamId === t.id && p.roundNumber === 1);
          if (!existing) {
            updated.push({
              teamId: t.id,
              roundNumber: 1,
              puzzleSolved: false,
              qrScanned: false,
              attemptsCount: 0,
              roundStartedAt: new Date(nowEpoch).toISOString(),
              deadlineAt: new Date(nowEpoch + durationSeconds * 1000).toISOString(),
              graceDeadlineAt: new Date(nowEpoch + (durationSeconds + graceSeconds) * 1000).toISOString(),
            });
          }
        }
      });
      return updated;
    });

    setTeams((prev) =>
      prev.map((t) => (t.status === 'ready' || t.status === 'registered' ? { ...t, status: 'active' } : t))
    );
  }, [config.roundDurationSeconds, config.gracePeriodSeconds, teams]);

  const pauseEvent = useCallback(() => {
    setConfig((prev) => ({
      ...prev,
      status: 'paused',
      pauseStartedAt: Date.now(),
    }));
  }, []);

  const resumeEvent = useCallback(() => {
    const pauseStarted = config.pauseStartedAt;
    const pauseDuration = pauseStarted ? Math.max(0, Date.now() - pauseStarted) : 0;

    setConfig((prev) => ({
      ...prev,
      status: 'live',
      pauseStartedAt: null,
      totalPauseDurationMs: prev.totalPauseDurationMs + pauseDuration,
    }));

    // Extend remaining deadlines by pauseDuration for in-progress rounds
    if (pauseDuration > 0) {
      setProgress((prev) =>
        prev.map((p) => {
          if (!p.qrScanned) {
            const newDeadline = new Date(new Date(p.deadlineAt).getTime() + pauseDuration).toISOString();
            const newGrace = new Date(new Date(p.graceDeadlineAt).getTime() + pauseDuration).toISOString();
            return {
              ...p,
              deadlineAt: newDeadline,
              graceDeadlineAt: newGrace,
            };
          }
          return p;
        })
      );
    }
  }, [config.pauseStartedAt]);

  const endEvent = useCallback(() => {
    setConfig((prev) => ({
      ...prev,
      status: 'finished',
      eventFinishedAt: new Date().toISOString(),
    }));
  }, []);

  const resetAllGameData = useCallback(() => {
    StorageService.clearAllData();
    setConfig(StorageService.loadConfig());
    setTeams(StorageService.loadTeams());
    setLocations(StorageService.loadLocations());
    setRiddles(StorageService.loadRiddles());
    setRoutes(StorageService.loadRoutes());
    setProgress([]);
    setIncidents([]);
    setActiveTeamId(null);
    setIsAdminAuthenticated(false);
  }, []);

  // ==========================================
  // ADMIN ACTIONS
  // ==========================================

  const loginAdmin = useCallback((password: string): boolean => {
    // Authoritative passphrase: arena2026
    if (password.trim() === 'arena2026') {
      setIsAdminAuthenticated(true);
      return true;
    }
    return false;
  }, []);

  const logoutAdmin = useCallback(() => {
    setIsAdminAuthenticated(false);
  }, []);

  const createTeam = useCallback((name: string, code: string, accessCode?: string) => {
    const cleanCode = code.trim().toUpperCase();
    const cleanName = name.trim();
    if (!cleanCode || !cleanName) {
      return { success: false, error: 'Team name and code are required.' };
    }

    if (teams.some((t) => t.teamCode.toUpperCase() === cleanCode)) {
      return { success: false, error: `Team code ${cleanCode} is already taken.` };
    }

    const newTeam: Team = {
      id: `team-${Date.now().toString().slice(-6)}`,
      teamCode: cleanCode,
      teamName: cleanName,
      accessCode: accessCode?.trim() || `Arena2026!${cleanCode}`,
      status: config.status === 'live' ? 'active' : 'ready',
      currentRound: 1,
      strikes: 0,
      createdAt: new Date().toISOString(),
    };

    setTeams((prev) => [...prev, newTeam]);
    return { success: true };
  }, [teams, config.status]);

  const updateTeam = useCallback((id: string, updates: Partial<Team>) => {
    setTeams((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)));
  }, []);

  const deleteTeam = useCallback((id: string) => {
    setTeams((prev) => prev.filter((t) => t.id !== id));
    setProgress((prev) => prev.filter((p) => p.teamId !== id));
    setIncidents((prev) => prev.filter((i) => i.teamId !== id));
    if (activeTeamId === id) {
      setActiveTeamId(null);
    }
  }, [activeTeamId]);

  const eliminateTeam = useCallback((id: string, reason: string) => {
    setTeams((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, status: 'eliminated', eliminationReason: reason } : t
      )
    );
  }, []);

  const reinstateTeam = useCallback((id: string) => {
    setTeams((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, status: 'active', eliminationReason: null, strikes: 0 } : t
      )
    );
  }, []);

  const updateLocation = useCallback((id: number, updates: Partial<LocationCheckpoint>) => {
    setLocations((prev) => prev.map((l) => (l.id === id ? { ...l, ...updates } : l)));
  }, []);

  const regenerateLocationToken = useCallback((id: number): string => {
    let newToken = '';
    do {
      newToken = Math.floor(1000000000 + Math.random() * 9000000000).toString();
    } while (locations.some((l) => l.qrToken === newToken));

    setLocations((prev) =>
      prev.map((l) => (l.id === id ? { ...l, qrToken: newToken } : l))
    );
    return newToken;
  }, [locations]);

  const saveRiddle = useCallback((riddle: Riddle) => {
    setRiddles((prev) => {
      const idx = prev.findIndex((r) => r.roundNumber === riddle.roundNumber || r.id === riddle.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = riddle;
        return copy;
      }
      return [...prev, riddle];
    });
  }, []);

  const regenerateRoutes = useCallback((): { success: boolean; message: string } => {
    if (config.routesLocked) {
      return { success: false, message: 'Routes are locked for the active event.' };
    }
    if (teams.length !== 20) {
      return { success: false, message: `Route generator requires exactly 20 teams (currently ${teams.length}).` };
    }
    if (locations.length !== 10) {
      return { success: false, message: `Route generator requires exactly 10 locations (currently ${locations.length}).` };
    }

    try {
      const teamIds = teams.map((t) => t.id);
      const locIds = locations.map((l) => l.id);
      const res = generateBalancedRoutes(teamIds, locIds, 10, {
        randomizeTeams: true,
        randomizeLocations: true,
      });

      if (!res.isValid) {
        return { success: false, message: `Route collision detected: ${res.verificationReport.collisions.join(', ')}` };
      }

      setRoutes(res.matrix);
      return { success: true, message: 'Generated and verified 100% collision-free Latin Hypercube routes.' };
    } catch (err) {
      return { success: false, message: (err as Error).message };
    }
  }, [config.routesLocked, teams, locations]);

  const lockRoutes = useCallback(() => {
    setConfig((prev) => ({ ...prev, routesLocked: true }));
  }, []);

  // ==========================================
  // PLAYER ACTIONS
  // ==========================================

  const loginTeam = useCallback((teamCode: string, accessCode: string) => {
    const cleanCode = teamCode.trim().toUpperCase();
    const cleanAccess = accessCode.trim();

    const team = teams.find((t) => t.teamCode.toUpperCase() === cleanCode);
    if (!team) {
      return { success: false, error: `Invalid Team ID "${cleanCode}".` };
    }

    if (team.accessCode && team.accessCode !== cleanAccess) {
      return { success: false, error: 'Invalid access code or password.' };
    }

    // Set active team session
    setActiveTeamId(team.id);

    // If game is live and team doesn't have progress initialized for current round, initialize it
    if (config.status === 'live' && team.status !== 'eliminated' && team.status !== 'completed') {
      const nowEpoch = Date.now();
      const dur = config.roundDurationSeconds || 300;
      const grace = config.gracePeriodSeconds || 30;

      setProgress((prev) => {
        const existing = prev.find((p) => p.teamId === team.id && p.roundNumber === team.currentRound);
        if (!existing) {
          return [
            ...prev,
            {
              teamId: team.id,
              roundNumber: team.currentRound,
              puzzleSolved: false,
              qrScanned: false,
              attemptsCount: 0,
              roundStartedAt: new Date(nowEpoch).toISOString(),
              deadlineAt: new Date(nowEpoch + dur * 1000).toISOString(),
              graceDeadlineAt: new Date(nowEpoch + (dur + grace) * 1000).toISOString(),
            },
          ];
        }
        return prev;
      });
    }

    return { success: true, team };
  }, [teams, config.status, config.roundDurationSeconds, config.gracePeriodSeconds]);

  const logoutTeam = useCallback(() => {
    setActiveTeamId(null);
  }, []);

  const getTeamProgress = useCallback((teamId: string, roundNumber: number) => {
    return progress.find((p) => p.teamId === teamId && p.roundNumber === roundNumber);
  }, [progress]);

  const getTeamAssignedLocation = useCallback((teamId: string, roundNumber: number) => {
    const match = routes.find((r) => r.teamId === teamId && r.roundNumber === roundNumber);
    if (!match) return undefined;
    return locations.find((l) => l.id === match.locationId);
  }, [routes, locations]);

  const submitAnswer = useCallback((teamId: string, roundNumber: number, answer: string): AnswerValidationResult => {
    const riddle = riddles.find((r) => r.roundNumber === roundNumber);
    if (!riddle) {
      return { isCorrect: false, feedback: 'Riddle for this round not found.' };
    }

    const validation = AnswerValidator.validate(answer, {
      acceptedAnswers: riddle.acceptedAnswers,
      caseSensitive: riddle.caseSensitive,
      normalizeWhitespace: riddle.normalizeWhitespace,
    });

    const now = new Date().toISOString();

    setProgress((prev) => {
      const idx = prev.findIndex((p) => p.teamId === teamId && p.roundNumber === roundNumber);
      if (idx >= 0) {
        const current = prev[idx]!;
        const updated: TeamRoundProgress = {
          ...current,
          attemptsCount: current.attemptsCount + 1,
          puzzleSolved: validation.isCorrect ? true : current.puzzleSolved,
          puzzleSolvedAt: validation.isCorrect ? (current.puzzleSolvedAt || now) : current.puzzleSolvedAt,
        };
        const copy = [...prev];
        copy[idx] = updated;
        return copy;
      } else {
        const nowEpoch = Date.now();
        const dur = config.roundDurationSeconds || 300;
        const grace = config.gracePeriodSeconds || 30;
        return [
          ...prev,
          {
            teamId,
            roundNumber,
            puzzleSolved: validation.isCorrect,
            puzzleSolvedAt: validation.isCorrect ? now : null,
            qrScanned: false,
            attemptsCount: 1,
            roundStartedAt: new Date(nowEpoch).toISOString(),
            deadlineAt: new Date(nowEpoch + dur * 1000).toISOString(),
            graceDeadlineAt: new Date(nowEpoch + (dur + grace) * 1000).toISOString(),
          },
        ];
      }
    });

    return validation;
  }, [riddles, config.roundDurationSeconds, config.gracePeriodSeconds]);

  const verifyQrToken = useCallback((teamId: string, roundNumber: number, scannedToken: string) => {
    const token = scannedToken.trim();
    const assignedLocation = getTeamAssignedLocation(teamId, roundNumber);

    if (!assignedLocation) {
      return { success: false, message: 'No location assigned for this round.' };
    }

    // Check if token matches assigned location
    if (token !== assignedLocation.qrToken) {
      const anyOtherLoc = locations.find((l) => l.qrToken === token);
      if (anyOtherLoc) {
        return {
          success: false,
          message: `Wrong Location: You scanned ${anyOtherLoc.name} (#${anyOtherLoc.locationNumber}). Your assigned checkpoint is ${assignedLocation.name} (#${assignedLocation.locationNumber}).`,
        };
      }
      return { success: false, message: 'Invalid Checkpoint Token. Ensure you are scanning an authorized Arena station.' };
    }

    const now = new Date().toISOString();
    const isChampionshipComplete = roundNumber >= 10;

    // Mark current round QR as verified
    setProgress((prev) => {
      const idx = prev.findIndex((p) => p.teamId === teamId && p.roundNumber === roundNumber);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = {
          ...copy[idx]!,
          qrScanned: true,
          qrScannedAt: now,
          completedAt: now,
        };
        return copy;
      }
      return prev;
    });

    if (isChampionshipComplete) {
      // Completed tournament!
      setTeams((prev) =>
        prev.map((t) => (t.id === teamId ? { ...t, status: 'completed', completedAt: now } : t))
      );
      return {
        success: true,
        message: '✓ Final Checkpoint Verified! Championship Complete!',
        isCompleted: true,
      };
    } else {
      // Advance to next round
      const nextRound = roundNumber + 1;
      const nowEpoch = Date.now();
      const dur = config.roundDurationSeconds || 300;
      const grace = config.gracePeriodSeconds || 30;

      setTeams((prev) =>
        prev.map((t) => (t.id === teamId ? { ...t, currentRound: nextRound } : t))
      );

      // Initialize next round progress
      setProgress((prev) => [
        ...prev,
        {
          teamId,
          roundNumber: nextRound,
          puzzleSolved: false,
          qrScanned: false,
          attemptsCount: 0,
          roundStartedAt: new Date(nowEpoch).toISOString(),
          deadlineAt: new Date(nowEpoch + dur * 1000).toISOString(),
          graceDeadlineAt: new Date(nowEpoch + (dur + grace) * 1000).toISOString(),
        },
      ]);

      return {
        success: true,
        message: `✓ Checkpoint Verified! Proceeding to Round ${nextRound}.`,
        isCompleted: false,
      };
    }
  }, [getTeamAssignedLocation, locations, config.roundDurationSeconds, config.gracePeriodSeconds]);

  const recordViolation = useCallback((teamId: string, type: ViolationType, metadata?: Record<string, unknown>) => {
    const targetTeam = teams.find((t) => t.id === teamId);
    if (!targetTeam || targetTeam.status === 'eliminated' || targetTeam.status === 'completed') {
      return { strikeNumber: targetTeam?.strikes || 0, eliminated: false, message: '' };
    }

    const newStrikes = targetTeam.strikes + 1;
    const eliminated = newStrikes >= 3;
    const incident: AntiCheatIncident = {
      id: `inc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      teamId,
      teamCode: targetTeam.teamCode,
      teamName: targetTeam.teamName,
      roundNumber: targetTeam.currentRound,
      violationType: type,
      strikeNumber: newStrikes,
      timestamp: new Date().toISOString(),
      metadata,
      status: eliminated ? 'eliminated' : 'warning',
      notes: metadata?.reason ? String(metadata.reason) : `Violation detected: ${type}`,
    };

    setIncidents((prev) => [incident, ...prev]);

    setTeams((prev) =>
      prev.map((t) => {
        if (t.id === teamId) {
          return {
            ...t,
            strikes: newStrikes,
            status: eliminated ? 'eliminated' : t.status,
            eliminationReason: eliminated
              ? `Disqualified: Exceeded 3 Anti-Cheat Strikes (last: ${type})`
              : t.eliminationReason,
          };
        }
        return t;
      })
    );

    const message = eliminated
      ? 'Disqualification: You have accumulated 3 anti-cheat strikes. Device inputs have been permanently locked.'
      : `Warning (Strike ${newStrikes}/3): Leaving the game arena screen triggers anti-cheat deterrence strikes.`;

    return { strikeNumber: newStrikes, eliminated, message };
  }, [teams]);

  const handleTimerExpiry = useCallback((teamId: string, roundNumber: number) => {
    const prog = progress.find((p) => p.teamId === teamId && p.roundNumber === roundNumber);
    const targetTeam = teams.find((t) => t.id === teamId);

    if (!targetTeam || targetTeam.status === 'eliminated' || targetTeam.status === 'completed') {
      return;
    }

    // If both puzzleSolved and qrScanned are true, already safe
    if (prog?.puzzleSolved && prog?.qrScanned) {
      return;
    }

    // Eliminate team due to timeout
    setTeams((prev) =>
      prev.map((t) =>
        t.id === teamId
          ? {
              ...t,
              status: 'eliminated',
              eliminationReason: `Hard deadline expired: 5-minute round limit and 30-second grace period elapsed in Round ${roundNumber} without completing checkpoint verification.`,
            }
          : t
      )
    );

    setProgress((prev) =>
      prev.map((p) =>
        p.teamId === teamId && p.roundNumber === roundNumber ? { ...p, timedOut: true } : p
      )
    );
  }, [progress, teams]);

  // ==========================================
  // BACKUP & RESTORE
  // ==========================================

  const exportBackup = useCallback((): FullGameBackup => {
    return StorageService.exportFullBackup(
      config,
      teams,
      locations,
      riddles,
      routes,
      progress,
      incidents
    );
  }, [config, teams, locations, riddles, routes, progress, incidents]);

  const importBackup = useCallback((backup: unknown) => {
    if (!StorageService.validateBackupData(backup)) {
      return { success: false, error: 'Invalid backup file schema or corrupted JSON.' };
    }

    setConfig(backup.config);
    setTeams(backup.teams);
    setLocations(backup.locations);
    setRiddles(backup.riddles);
    setRoutes(backup.routes);
    setProgress(backup.progress || []);
    setIncidents(backup.incidents || []);

    return { success: true };
  }, []);

  const value = {
    config,
    teams,
    locations,
    riddles,
    routes,
    progress,
    incidents,
    activeTeam,
    isAdminAuthenticated,
    leaderboard,
    stationOccupancies,

    startEvent,
    pauseEvent,
    resumeEvent,
    endEvent,
    resetAllGameData,

    loginAdmin,
    logoutAdmin,
    createTeam,
    updateTeam,
    deleteTeam,
    eliminateTeam,
    reinstateTeam,
    updateLocation,
    regenerateLocationToken,
    saveRiddle,
    regenerateRoutes,
    lockRoutes,

    loginTeam,
    logoutTeam,
    getTeamProgress,
    getTeamAssignedLocation,
    submitAnswer,
    verifyQrToken,
    recordViolation,
    handleTimerExpiry,

    exportBackup,
    importBackup,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGameStore() {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGameStore must be used within a GameProvider');
  }
  return context;
}


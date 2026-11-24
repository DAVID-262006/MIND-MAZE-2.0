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
import { ViolationManager } from '../services/violationManager';
import { supabase } from '../lib/supabase';
import { SupabaseService } from '../services/supabaseService';

interface GameContextType {
  config: GameEventConfig;
  teams: Team[];
  locations: LocationCheckpoint[];
  riddles: Riddle[];
  routes: RouteAssignment[];
  progress: TeamRoundProgress[];
  incidents: AntiCheatIncident[];
  activeTeam: Team | null;
  adminToken: string | null;
  isAdminAuthenticated: boolean;
  adminRole: 'superadmin' | 'admin' | 'marshal' | null;
  leaderboard: LeaderboardEntry[];
  stationOccupancies: StationOccupancy[];

  // Event controls
  startEvent: () => Promise<void> | void;
  pauseEvent: () => Promise<void> | void;
  resumeEvent: () => Promise<void> | void;
  endEvent: () => Promise<void> | void;
  resetAllGameData: () => void;

  // Admin controls
  loginAdmin: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logoutAdmin: () => Promise<void> | void;
  createTeam: (name: string, code: string) => Promise<{ success: boolean; error?: string; team?: Team }>;
  updateTeam: (id: string, updates: Partial<Team>) => Promise<{ success: boolean; error?: string }>;
  deleteTeam: (id: string, force?: boolean) => Promise<{ success: boolean; error?: string }>;
  eliminateTeam: (id: string, reason: string) => Promise<void> | void;
  reinstateTeam: (id: string) => Promise<void> | void;
  issueTeamCredentials: (issued: { team_id: string; team_code: string; passcode: string }[]) => void;
  setTeamCredentials: (teamId: string, username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  resetTeamPassword: (teamId: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  batchGenerateTeamCredentials: () => Promise<{ success: boolean; error?: string; count?: number; credentials?: { team_id: string; team_code: string; team_name: string; username: string; password: string }[] }>;
  updateLocation: (id: number, updates: Partial<LocationCheckpoint>) => void;
  regenerateLocationToken: (id: number) => string;
  saveRiddle: (riddle: Riddle) => void;
  deleteRiddle: (id: string) => void;
  updateConfig: (updates: Partial<GameEventConfig>) => void;
  regenerateRoutes: () => { success: boolean; message: string };
  lockRoutes: () => void;

  // Player actions
  loginTeam: (teamCode: string, accessCode: string) => Promise<{ success: boolean; error?: string; team?: Team }> | { success: boolean; error?: string; team?: Team };
  logoutTeam: () => void;
  getTeamProgress: (teamId: string, roundNumber: number) => TeamRoundProgress | undefined;
  getTeamAssignedLocation: (teamId: string, roundNumber: number) => LocationCheckpoint | undefined;
  submitAnswer: (teamId: string, roundNumber: number, answer: string) => Promise<AnswerValidationResult> | AnswerValidationResult;
  verifyQrToken: (teamId: string, roundNumber: number, scannedToken: string) => Promise<{ success: boolean; message: string; isCompleted?: boolean }> | { success: boolean; message: string; isCompleted?: boolean };
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
  const [adminToken, setAdminToken] = useState<string | null>(() => {
    return sessionStorage.getItem('mm2_admin_token');
  });
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(() => StorageService.getAdminAuth());
  const [adminRole, setAdminRole] = useState<'superadmin' | 'admin' | 'marshal' | null>(null);

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

  // Session restoration for Admin Authentication
  useEffect(() => {
    if (StorageService.getAdminAuth()) {
      setIsAdminAuthenticated(true);
      setAdminRole('superadmin');
      const savedToken = sessionStorage.getItem('mm2_admin_token') || 'mm2_hardcoded_admin_token_2026';
      setAdminToken(savedToken);
    }
  }, []);

  // Initial hydration from Supabase if configured
  useEffect(() => {
    if (!SupabaseService.isConfigured()) return;

    // 1. Fetch public event config
    SupabaseService.fetchPublicEventStatus().then((publicConfig) => {
      if (publicConfig) {
        setConfig((prev) => ({ ...prev, ...publicConfig }));
      }
    }).catch((err) => console.warn('[Supabase] fetchPublicEventStatus failed:', err));

    // 2. Fetch public locations
    SupabaseService.fetchPublicLocations().then((publicLocs) => {
      if (publicLocs && publicLocs.length > 0) {
        setLocations((prev) => {
          return publicLocs.map((pl) => {
            const existing = prev.find((l) => l.id === pl.id);
            return { ...existing, ...pl };
          });
        });
      }
    }).catch((err) => console.warn('[Supabase] fetchPublicLocations failed:', err));

    // 3. Hydrate active team session if stored in sessionStorage
    const storedSessionToken = sessionStorage.getItem('mm2_session_token');
    const storedTeamId = sessionStorage.getItem('mm2_team_id') || activeTeamId;
    if (storedTeamId && storedSessionToken) {
      SupabaseService.getTeamState(storedTeamId, storedSessionToken).then((stateRes) => {
        const teamState = stateRes.data;
        if (teamState?.team) {
          const st = teamState.team;
          setTeams((prev) => {
            const exists = prev.some((t) => t.id === st.id);
            const mappedTeam: Team = {
              id: st.id,
              teamCode: st.team_code,
              teamName: st.team_name,
              status: (st.status as Team['status']) || 'active',
              currentRound: st.current_round || 1,
              strikes: st.total_strikes || 0,
              createdAt: new Date().toISOString(),
              startedAt: st.started_at || undefined,
              completedAt: st.completed_at || undefined,
              totalTimeMs: st.total_time_ms || undefined,
            };
            if (exists) {
              return prev.map((t) => (t.id === st.id ? { ...t, ...mappedTeam } : t));
            }
            return [...prev, mappedTeam];
          });
          setActiveTeamId(st.id);
        }
        if (teamState?.current_progress) {
          const cp = teamState.current_progress;
          const mappedProg: TeamRoundProgress = {
            teamId: storedTeamId,
            roundNumber: cp.round_number,
            puzzleSolved: cp.puzzle_solved,
            puzzleSolvedAt: cp.puzzle_solved_at,
            qrScanned: cp.qr_scanned,
            qrScannedAt: cp.qr_scanned_at,
            attemptsCount: cp.attempts_count,
            roundStartedAt: cp.round_started_at,
            deadlineAt: cp.deadline_at,
            graceDeadlineAt: cp.grace_deadline_at,
          };
          setProgress((prev) => {
            const other = prev.filter((p) => !(p.teamId === storedTeamId && p.roundNumber === cp.round_number));
            return [...other, mappedProg];
          });
        }
      }).catch((err) => console.warn('[Supabase] getTeamState failed:', err));
    }
  }, [activeTeamId]);

  // Hydrate admin data when admin authenticated and Supabase configured
  useEffect(() => {
    if (!isAdminAuthenticated || !adminToken || !SupabaseService.isConfigured()) return;

    const hydrateAdmin = () => {
      SupabaseService.fetchAdminDashboardData(adminToken).then((data) => {
        if (!data.success) {
          console.warn('[Supabase] Admin dashboard hydration rejected:', data.error);
          return;
        }
        setTeams(data.teams ?? []);
        setLocations(data.locations ?? []);
        setRiddles(data.puzzles ?? []);
        setRoutes(data.routes ?? []);
        setProgress(data.progress ?? []);
        setIncidents(data.incidents ?? []);
      }).catch((err) => console.warn('[Supabase] Admin data hydration failed:', err));
    };

    hydrateAdmin();
    const interval = setInterval(hydrateAdmin, 5000);
    return () => clearInterval(interval);
  }, [isAdminAuthenticated, adminToken]);

  // Realtime subscription
  useEffect(() => {
    if (!SupabaseService.isConfigured() || !supabase) return;

    const channel = supabase
      .channel('mm2_live_sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'event_settings' },
        () => {
          SupabaseService.fetchPublicEventStatus().then((status) => {
            if (status) setConfig((prev) => ({ ...prev, ...status }));
          }).catch(() => {});
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'teams' },
        (payload) => {
          if ((payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') && payload.new) {
            const raw = payload.new as Record<string, unknown>;
            setTeams((prev) =>
              prev.map((t) =>
                t.id === raw.id
                  ? {
                      ...t,
                      teamCode: (raw.team_code as string) || t.teamCode,
                      teamName: (raw.team_name as string) || t.teamName,
                      currentRound: typeof raw.current_round === 'number' ? raw.current_round : t.currentRound,
                      strikes: typeof raw.strikes === 'number' ? raw.strikes : t.strikes,
                      status: (raw.status as any) || t.status,
                      eliminationReason: raw.elimination_reason !== undefined ? (raw.elimination_reason as string | null) : t.eliminationReason,
                      completedAt: raw.completed_at !== undefined ? (raw.completed_at as string | null) : t.completedAt,
                    }
                  : t
              )
            );
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'team_progress' },
        (payload) => {
          if (payload.new) {
            const raw = payload.new as Record<string, unknown>;
            const mapped: TeamRoundProgress = {
              teamId: raw.team_id as string,
              roundNumber: raw.round_number as number,
              puzzleSolved: Boolean(raw.puzzle_solved),
              puzzleSolvedAt: (raw.puzzle_solved_at as string) || null,
              qrScanned: Boolean(raw.qr_scanned),
              qrScannedAt: (raw.qr_scanned_at as string) || null,
              attemptsCount: (raw.attempts_count as number) || 0,
              roundStartedAt: raw.round_started_at as string,
              deadlineAt: raw.deadline_at as string,
              graceDeadlineAt: raw.grace_deadline_at as string,
              timedOut: Boolean(raw.timed_out),
              completedAt: (raw.completed_at as string) || null,
            };

            setProgress((prev) => {
              const idx = prev.findIndex(
                (item) => item.teamId === mapped.teamId && item.roundNumber === mapped.roundNumber
              );
              if (idx >= 0) {
                const copy = [...prev];
                copy[idx] = { ...copy[idx]!, ...mapped };
                return copy;
              }
              return [...prev, mapped];
            });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'audit_logs' },
        () => {
          if (isAdminAuthenticated) {
            SupabaseService.fetchIncidents().then((inc) => {
              if (inc) setIncidents(inc);
            }).catch(() => {});
          }
        }
      )
      .subscribe();

    return () => {
      if (supabase) {
        supabase.removeChannel(channel);
      }
    };
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

  const startEvent = useCallback(async () => {
    const now = new Date().toISOString();
    const durationSeconds = config.roundDurationSeconds || 300;
    const graceSeconds = config.gracePeriodSeconds || 30;

    if (SupabaseService.isConfigured() && adminToken) {
      try {
        await SupabaseService.startEvent(adminToken);
      } catch (err) {
        console.warn('[Supabase] startEvent warning:', err);
      }
    }

    // Lock routes and update local state
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
  }, [config.roundDurationSeconds, config.gracePeriodSeconds, teams, adminToken]);

  const pauseEvent = useCallback(async () => {
    if (SupabaseService.isConfigured() && adminToken) {
      try {
        await SupabaseService.pauseEvent(adminToken);
      } catch (err) {
        console.warn('[Supabase] pauseEvent warning:', err);
      }
    }

    setConfig((prev) => ({
      ...prev,
      status: 'paused',
      pauseStartedAt: Date.now(),
    }));
  }, [adminToken]);

  const resumeEvent = useCallback(async () => {
    const pauseStarted = config.pauseStartedAt;
    const pauseDuration = pauseStarted ? Math.max(0, Date.now() - pauseStarted) : 0;

    if (SupabaseService.isConfigured() && adminToken) {
      try {
        await SupabaseService.resumeEvent(adminToken);
      } catch (err) {
        console.warn('[Supabase] resumeEvent warning:', err);
      }
    }

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
  }, [config.pauseStartedAt, adminToken]);

  const endEvent = useCallback(async () => {
    if (SupabaseService.isConfigured() && adminToken) {
      try {
        await SupabaseService.endEvent(adminToken);
      } catch (err) {
        console.warn('[Supabase] endEvent warning:', err);
      }
    }

    setConfig((prev) => ({
      ...prev,
      status: 'finished',
      eventFinishedAt: new Date().toISOString(),
    }));
  }, [adminToken]);

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

  const loginAdmin = useCallback(async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
    const cleanUsername = username.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (cleanUsername === 'mindmaze' && cleanPassword === 'meadmin2026') {
      const token = 'mm2_hardcoded_admin_token_2026';
      sessionStorage.setItem('mm2_admin_token', token);
      sessionStorage.setItem('mm2_admin_authenticated', 'true');
      setAdminToken(token);
      setIsAdminAuthenticated(true);
      setAdminRole('superadmin');
      StorageService.setAdminAuth(true);

      // Best effort background sync with Supabase if deployed, without blocking login
      if (SupabaseService.isConfigured()) {
        SupabaseService.adminLogin(cleanUsername, cleanPassword)
          .then((res) => {
            if (res.success && res.token) {
              sessionStorage.setItem('mm2_admin_token', res.token);
              setAdminToken(res.token);
              if (res.role) setAdminRole(res.role as any);
            }
          })
          .catch(() => {});
      }

      return { success: true };
    } else {
      sessionStorage.removeItem('mm2_admin_token');
      sessionStorage.removeItem('mm2_admin_authenticated');
      setAdminToken(null);
      setIsAdminAuthenticated(false);
      setAdminRole(null);
      StorageService.setAdminAuth(false);
      return { success: false, error: 'Invalid administrator credentials. Access denied.' };
    }
  }, []);

  const logoutAdmin = useCallback(async () => {
    if (SupabaseService.isConfigured() && adminToken && adminToken !== 'mm2_hardcoded_admin_token_2026') {
      await SupabaseService.adminLogout(adminToken).catch(() => {});
    }
    sessionStorage.removeItem('mm2_admin_token');
    sessionStorage.removeItem('mm2_admin_authenticated');
    setAdminToken(null);
    setIsAdminAuthenticated(false);
    setAdminRole(null);
    StorageService.setAdminAuth(false);
  }, [adminToken]);

  const createTeam = useCallback(async (name: string, code: string) => {
    const cleanCode = code.trim().toUpperCase();
    const cleanName = name.trim();
    if (!cleanCode || !cleanName) {
      return { success: false, error: 'Team name and code are required.' };
    }

    if (teams.some((t) => t.teamCode.toUpperCase() === cleanCode)) {
      return { success: false, error: `Team code ${cleanCode} is already taken.` };
    }

    if (SupabaseService.isConfigured()) {
      if (!adminToken) {
        return { success: false, error: 'Administrator session token required.' };
      }
      const res = await SupabaseService.adminCreateTeam(cleanName, cleanCode, adminToken);
      const teamData = res.data?.team;
      if (!res.success || !res.data?.success || !teamData) {
        return { success: false, error: res.data?.error || res.data?.message || res.error || 'Failed to create team in database.' };
      }

      const createdTeam: Team = {
        id: teamData.id,
        teamCode: teamData.team_code,
        teamName: teamData.team_name,
        credentialsRandomized: Boolean(teamData.credentials_randomized),
        status: (teamData.status as Team['status']) || 'ready',
        currentRound: teamData.current_round || 1,
        strikes: teamData.total_strikes || 0,
        createdAt: teamData.created_at,
      };

      setTeams((prev) => [...prev, createdTeam]);
      return { success: true, team: createdTeam };
    }

    const newTeam: Team = {
      id: `team-${Date.now().toString().slice(-6)}`,
      teamCode: cleanCode,
      teamName: cleanName,
      credentialsRandomized: false,
      status: config.status === 'live' ? 'active' : 'ready',
      currentRound: 1,
      strikes: 0,
      createdAt: new Date().toISOString(),
    };

    setTeams((prev) => [...prev, newTeam]);
    return { success: true, team: newTeam };
  }, [teams, config.status, adminToken]);

  const updateTeam = useCallback(async (id: string, updates: Partial<Team>) => {
    if (SupabaseService.isConfigured() && (updates.teamCode || updates.teamName)) {
      if (!adminToken) {
        return { success: false, error: 'Administrator session token required.' };
      }
      const targetTeam = teams.find((t) => t.id === id);
      const code = (updates.teamCode || targetTeam?.teamCode || '').trim().toUpperCase();
      const name = (updates.teamName || targetTeam?.teamName || '').trim();
      const res = await SupabaseService.adminUpdateTeam(id, code, name, adminToken);
      if (!res.success || !res.data?.success) {
        return { success: false, error: res.data?.error || res.data?.message || res.error };
      }
    }

    setTeams((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)));
    return { success: true };
  }, [teams, adminToken]);

  const deleteTeam = useCallback(async (id: string, force = false) => {
    if (SupabaseService.isConfigured()) {
      if (!adminToken) {
        return { success: false, error: 'Administrator session token required.' };
      }
      const res = await SupabaseService.adminDeleteTeam(id, force, adminToken);
      if (!res.success || !res.data?.success) {
        return { success: false, error: res.data?.error || res.data?.message || res.error };
      }
    }

    setTeams((prev) => prev.filter((t) => t.id !== id));
    setProgress((prev) => prev.filter((p) => p.teamId !== id));
    setIncidents((prev) => prev.filter((i) => i.teamId !== id));
    if (activeTeamId === id) {
      setActiveTeamId(null);
    }
    return { success: true };
  }, [activeTeamId, adminToken]);

  const eliminateTeam = useCallback(async (id: string, reason: string) => {
    if (SupabaseService.isConfigured() && adminToken) {
      try {
        await SupabaseService.eliminateTeam(id, reason, adminToken);
      } catch (err) {
        console.warn('[Supabase] eliminateTeam warning:', err);
      }
    }
    setTeams((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, status: 'eliminated', eliminationReason: reason } : t
      )
    );
  }, [adminToken]);

  const reinstateTeam = useCallback(async (id: string) => {
    if (SupabaseService.isConfigured() && adminToken) {
      try {
        await SupabaseService.reinstateTeam(id, adminToken);
      } catch (err) {
        console.warn('[Supabase] reinstateTeam warning:', err);
      }
    }
    setTeams((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, status: 'active', eliminationReason: null, strikes: 0 } : t
      )
    );
  }, [adminToken]);

  const issueTeamCredentials = useCallback((issued: { team_id: string; team_code: string; passcode: string }[]) => {
    const passcodeMap: Record<string, string> = {};
    issued.forEach((c) => {
      passcodeMap[c.team_code.toUpperCase()] = c.passcode;
    });
    localStorage.setItem('mm2_team_passcodes', JSON.stringify(passcodeMap));

    setTeams((prev) =>
      prev.map((t) => {
        const found = issued.find((c) => c.team_id === t.id || c.team_code.toUpperCase() === t.teamCode.toUpperCase());
        return found ? { ...t, credentialsRandomized: true } : t;
      })
    );
  }, []);

  const setTeamCredentials = useCallback(async (teamId: string, username: string, password: string) => {
    const cleanUser = username.trim().toLowerCase();
    const cleanPass = password.trim();

    if (!cleanUser || cleanUser.length < 3 || cleanUser.length > 30) {
      return { success: false, error: 'Username must be between 3 and 30 characters.' };
    }
    if (!/^[a-z0-9_-]+$/.test(cleanUser)) {
      return { success: false, error: 'Username may only contain letters, numbers, underscores, and hyphens.' };
    }
    if (!cleanPass || cleanPass.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters long.' };
    }

    const duplicate = teams.some((t) => t.id !== teamId && t.username?.toLowerCase() === cleanUser);
    if (duplicate) {
      return { success: false, error: 'The requested username is already assigned to another team.' };
    }

    if (SupabaseService.isConfigured() && adminToken) {
      try {
        const res = await SupabaseService.adminSetTeamCredentials(teamId, cleanUser, cleanPass, adminToken);
        if (!res.success && res.error && !res.error.includes('not yet deployed')) {
          return { success: false, error: res.error || 'Failed to update credentials on Supabase.' };
        }
      } catch (err) {
        console.warn('Supabase set credentials notice:', err);
      }
    }

    setTeams((prev) =>
      prev.map((t) =>
        t.id === teamId
          ? { ...t, username: cleanUser, credentialsConfigured: true, credentialsRandomized: true }
          : t
      )
    );

    try {
      const creds = JSON.parse(localStorage.getItem('mm2_custom_team_credentials') || '{}');
      creds[teamId] = { username: cleanUser, password: cleanPass };
      localStorage.setItem('mm2_custom_team_credentials', JSON.stringify(creds));
    } catch (e) {
      console.warn('Storage notice:', e);
    }

    return { success: true };
  }, [teams, adminToken]);

  const resetTeamPassword = useCallback(async (teamId: string, newPassword: string) => {
    const cleanPass = newPassword.trim();
    if (!cleanPass || cleanPass.length < 6) {
      return { success: false, error: 'New password must be at least 6 characters long.' };
    }

    if (SupabaseService.isConfigured() && adminToken) {
      try {
        const res = await SupabaseService.adminResetTeamPassword(teamId, cleanPass, adminToken);
        if (!res.success && res.error && !res.error.includes('not yet deployed')) {
          return { success: false, error: res.error || 'Failed to reset password on Supabase.' };
        }
      } catch (err) {
        console.warn('Supabase reset password notice:', err);
      }
    }

    setTeams((prev) =>
      prev.map((t) =>
        t.id === teamId
          ? { ...t, credentialsConfigured: true, credentialsRandomized: true }
          : t
      )
    );

    try {
      const creds = JSON.parse(localStorage.getItem('mm2_custom_team_credentials') || '{}');
      if (creds[teamId]) {
        creds[teamId].password = cleanPass;
        localStorage.setItem('mm2_custom_team_credentials', JSON.stringify(creds));
      }
    } catch (e) {
      console.warn('Storage notice:', e);
    }

    return { success: true };
  }, [adminToken]);

  const batchGenerateTeamCredentials = useCallback(async () => {
    let credsList: { team_id: string; team_code: string; team_name: string; username: string; password: string }[] = [];

    if (SupabaseService.isConfigured() && adminToken) {
      try {
        const res = await SupabaseService.adminBatchGenerateTeamCredentials(adminToken);
        if (res.success && res.data?.credentials) {
          credsList = res.data.credentials;
        }
      } catch (err) {
        console.warn('Supabase batch generate notice:', err);
      }
    }

    if (credsList.length === 0) {
      credsList = teams.map((t) => {
        const u = t.username || t.teamCode.toLowerCase();
        const p = 'MM2-' + Math.random().toString(36).substring(2, 8).toUpperCase();
        return {
          team_id: t.id,
          team_code: t.teamCode,
          team_name: t.teamName,
          username: u,
          password: p,
        };
      });
    }

    const credsMap: Record<string, { username: string; password: string }> = {};
    credsList.forEach((c) => {
      credsMap[c.team_id] = { username: c.username, password: c.password };
    });
    localStorage.setItem('mm2_custom_team_credentials', JSON.stringify(credsMap));

    setTeams((prev) =>
      prev.map((t) => {
        const gen = credsMap[t.id];
        return gen
          ? { ...t, username: gen.username, credentialsConfigured: true, credentialsRandomized: true }
          : t;
      })
    );

    return { success: true, count: credsList.length, credentials: credsList };
  }, [teams, adminToken]);

  const updateLocation = useCallback((id: number, updates: Partial<LocationCheckpoint>) => {
    setLocations((prev) => prev.map((l) => (l.id === id ? { ...l, ...updates } : l)));
    if (SupabaseService.isConfigured() && adminToken) {
      const targetLoc = locations.find((l) => l.id === id);
      const name = updates.name ?? targetLoc?.name ?? '';
      const description = updates.description ?? targetLoc?.description ?? '';
      const capacity = updates.capacity ?? targetLoc?.capacity ?? 3;
      SupabaseService.adminUpdateLocation(id, name, description, capacity, adminToken).catch((err) => {
        console.warn('[Supabase] adminUpdateLocation error:', err);
      });
    }
  }, [locations, adminToken]);

  const regenerateLocationToken = useCallback((id: number): string => {
    let newToken = '';
    do {
      newToken = Math.floor(1000000000 + Math.random() * 9000000000).toString();
    } while (locations.some((l) => l.qrToken === newToken));

    setLocations((prev) =>
      prev.map((l) => (l.id === id ? { ...l, qrToken: newToken } : l))
    );

    if (SupabaseService.isConfigured() && adminToken) {
      SupabaseService.adminRegenerateLocationToken(id, adminToken).then((tokenRes) => {
        if (tokenRes.data?.qrToken) {
          setLocations((prev) => prev.map((l) => (l.id === id ? { ...l, qrToken: tokenRes.data!.qrToken } : l)));
        }
      }).catch((err) => {
        console.warn('[Supabase] adminRegenerateLocationToken error:', err);
      });
    }

    return newToken;
  }, [locations, adminToken]);

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

    if (SupabaseService.isConfigured() && adminToken) {
      SupabaseService.adminSavePuzzle(riddle, adminToken).catch((err) => {
        console.warn('[Supabase] adminSavePuzzle error:', err);
      });
    }
  }, [adminToken]);

  const deleteRiddle = useCallback((id: string) => {
    setRiddles((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const updateConfig = useCallback((updates: Partial<GameEventConfig>) => {
    setConfig((prev) => ({ ...prev, ...updates }));
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

      if (SupabaseService.isConfigured() && adminToken) {
        SupabaseService.generateTeamRoutes(locations.length, adminToken).then((rpcRes) => {
          if (!rpcRes.success) {
            console.warn('[Supabase] generateTeamRoutes error:', rpcRes.error);
          }
        }).catch((err) => {
          console.warn('[Supabase] generateTeamRoutes error:', err);
        });
      }

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

  const loginTeam = useCallback(async (usernameOrCode: string, passwordOrAccess: string) => {
    const cleanUser = usernameOrCode.trim();
    const cleanLowerUser = cleanUser.toLowerCase();
    const cleanUpperUser = cleanUser.toUpperCase();
    const cleanPass = passwordOrAccess.trim();

    if (!cleanUser || !cleanPass) {
      return { success: false, error: 'Username and password are required.' };
    }

    // 1. Check custom team credentials fallback cache
    const customCredsRaw = localStorage.getItem('mm2_custom_team_credentials');
    if (customCredsRaw) {
      try {
        const customCreds = JSON.parse(customCredsRaw) as Record<string, { username: string; password: string }>;
        const matchedEntry = Object.entries(customCreds).find(([teamId, data]) => {
          const t = teams.find((team) => team.id === teamId);
          return (
            (data.username?.toLowerCase() === cleanLowerUser || t?.teamCode.toUpperCase() === cleanUpperUser) &&
            data.password === cleanPass
          );
        });

        if (matchedEntry) {
          const [teamId] = matchedEntry;
          const targetTeam = teams.find((t) => t.id === teamId);
          if (targetTeam) {
            const sessionToken = `session_${targetTeam.id}_${Date.now()}`;
            sessionStorage.setItem('mm2_session_token', sessionToken);
            sessionStorage.setItem('mm2_team_id', targetTeam.id);
            setActiveTeamId(targetTeam.id);

            if (SupabaseService.isConfigured()) {
              SupabaseService.loginTeam(cleanUser, cleanPass).catch(() => {});
            }

            return { success: true, team: targetTeam };
          }
        }
      } catch (e) {
        console.warn('Error reading custom creds cache', e);
      }
    }

    // 2. Check client-issued passcodes fallback
    const localPasscodesRaw = localStorage.getItem('mm2_team_passcodes');
    if (localPasscodesRaw) {
      try {
        const localPasscodes = JSON.parse(localPasscodesRaw) as Record<string, string>;
        const expectedPasscode = localPasscodes[cleanUpperUser];
        if (expectedPasscode && expectedPasscode === cleanPass) {
          const targetTeam = teams.find((t) => t.teamCode.toUpperCase() === cleanUpperUser);
          if (targetTeam) {
            const sessionToken = `session_${targetTeam.id}_${Date.now()}`;
            sessionStorage.setItem('mm2_session_token', sessionToken);
            sessionStorage.setItem('mm2_team_id', targetTeam.id);
            setActiveTeamId(targetTeam.id);

            // Attempt background sync if Supabase is alive
            if (SupabaseService.isConfigured()) {
              SupabaseService.loginTeam(cleanUser, cleanPass).catch(() => {});
            }

            return { success: true, team: targetTeam };
          }
        }
      } catch (e) {
        console.warn('Error reading local passcodes', e);
      }
    }

    if (SupabaseService.isConfigured()) {
      const rpcRes = await SupabaseService.loginTeam(cleanUser, cleanPass);
      if (rpcRes.error || !rpcRes.data || !rpcRes.data.success) {
        return {
          success: false,
          error: rpcRes.error || rpcRes.data?.error || rpcRes.data?.message || 'Authentication failed. Please verify credentials.',
        };
      }

      const teamData = rpcRes.data;
      const sessionToken = teamData.session_token;
      sessionStorage.setItem('mm2_session_token', sessionToken);
      sessionStorage.setItem('mm2_team_id', teamData.team_id);
      setActiveTeamId(teamData.team_id);

      const mappedTeam: Team = {
        id: teamData.team_id,
        teamCode: teamData.team_code,
        teamName: teamData.team_name,
        status: (teamData.status as Team['status']) || 'active',
        currentRound: teamData.current_round || 1,
        strikes: 0,
        createdAt: new Date().toISOString(),
      };

      setTeams((prev) => {
        const exists = prev.some((t) => t.id === mappedTeam.id);
        if (exists) {
          return prev.map((t) => (t.id === mappedTeam.id ? { ...t, ...mappedTeam } : t));
        }
        return [...prev, mappedTeam];
      });

      // Hydrate authoritative team state
      try {
        const stateRes = await SupabaseService.getTeamState(teamData.team_id, sessionToken);
        if (stateRes.data?.team) {
          const st = stateRes.data.team;
          setTeams((prev) =>
            prev.map((t) =>
              t.id === st.id
                ? {
                    ...t,
                    currentRound: st.current_round,
                    strikes: st.total_strikes,
                    status: (st.status as Team['status']) || t.status,
                    completedAt: st.completed_at || undefined,
                    startedAt: st.started_at || undefined,
                    totalTimeMs: st.total_time_ms || undefined,
                  }
                : t
            )
          );
        }
        if (stateRes.data?.current_progress) {
          const cp = stateRes.data.current_progress;
          const mappedProg: TeamRoundProgress = {
            teamId: teamData.team_id,
            roundNumber: cp.round_number,
            puzzleSolved: cp.puzzle_solved,
            puzzleSolvedAt: cp.puzzle_solved_at,
            qrScanned: cp.qr_scanned,
            qrScannedAt: cp.qr_scanned_at,
            attemptsCount: cp.attempts_count,
            roundStartedAt: cp.round_started_at,
            deadlineAt: cp.deadline_at,
            graceDeadlineAt: cp.grace_deadline_at,
          };
          setProgress((prev) => {
            const idx = prev.findIndex((p) => p.teamId === mappedProg.teamId && p.roundNumber === mappedProg.roundNumber);
            if (idx >= 0) {
              const copy = [...prev];
              copy[idx] = mappedProg;
              return copy;
            }
            return [...prev, mappedProg];
          });
        }
      } catch (e) {
        console.warn('[Supabase] Hydrate team state error:', e);
      }

      return { success: true, team: mappedTeam };
    }

    // Strict Production Gate: Fail closed if Supabase is unconfigured
    if (!import.meta.env.DEV) {
      return {
        success: false,
        error: 'Database unconfigured. Production competition requires active Supabase connectivity.',
      };
    }

    // Isolated local development testing simulation (DEV ONLY)
    const team = teams.find((t) => t.teamCode.toUpperCase() === cleanUpperUser || t.username?.toLowerCase() === cleanLowerUser);
    if (!team) {
      return { success: false, error: `Invalid Team credentials for "${cleanUser}".` };
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
    sessionStorage.removeItem('mm2_session_token');
    sessionStorage.removeItem('mm2_team_id');
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

  const submitAnswer = useCallback(async (teamId: string, roundNumber: number, answer: string): Promise<AnswerValidationResult> => {
    const targetTeam = teams.find((t) => t.id === teamId);
    if (!targetTeam || targetTeam.status === 'eliminated') {
      return { isCorrect: false, feedback: 'Submission rejected: Team has been eliminated.' };
    }

    if (SupabaseService.isConfigured()) {
      const sessionToken = sessionStorage.getItem('mm2_session_token') || '';
      const rpcRes = await SupabaseService.submitPuzzleAnswer(teamId, sessionToken, answer);
      if (rpcRes.error || !rpcRes.data || !rpcRes.data.success) {
        return {
          isCorrect: false,
          feedback: rpcRes.error || rpcRes.data?.message || 'Submission error.',
        };
      }

      const isCorrect = Boolean(rpcRes.data.correct || rpcRes.data.puzzle_solved);
      const now = new Date().toISOString();
      const riddleClue = rpcRes.data.riddle || null;

      setProgress((prev) => {
        const idx = prev.findIndex((p) => p.teamId === teamId && p.roundNumber === roundNumber);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = {
            ...copy[idx]!,
            attemptsCount: rpcRes.data!.attempts_count || (copy[idx]!.attemptsCount + 1),
            puzzleSolved: isCorrect ? true : copy[idx]!.puzzleSolved,
            puzzleSolvedAt: isCorrect ? (copy[idx]!.puzzleSolvedAt || now) : copy[idx]!.puzzleSolvedAt,
            riddleRevealed: isCorrect ? (riddleClue || copy[idx]!.riddleRevealed) : copy[idx]!.riddleRevealed,
          };
          return copy;
        }
        return prev;
      });

      return {
        isCorrect,
        feedback: rpcRes.data.message || (isCorrect ? '✓ Verified Correct!' : 'Incorrect answer. Try again.'),
        partResults: rpcRes.data.part_results as any,
      };
    }

    // Local offline fallback
    const riddle = riddles.find((r) => r.roundNumber === roundNumber);
    if (!riddle) {
      return { isCorrect: false, feedback: 'Riddle for this round not found.' };
    }

    const validation = AnswerValidator.validate(answer, {
      acceptedAnswers: riddle.acceptedAnswers,
      caseSensitive: riddle.caseSensitive,
      normalizeWhitespace: riddle.normalizeWhitespace,
      options: riddle.options,
      threePartAnswers: riddle.threePartAnswers,
    });

    const now = new Date().toISOString();
    const revealedClue = validation.isCorrect ? (riddle.riddleClue || riddle.descriptionMd) : null;

    setProgress((prev) => {
      const idx = prev.findIndex((p) => p.teamId === teamId && p.roundNumber === roundNumber);
      if (idx >= 0) {
        const current = prev[idx]!;
        const updated: TeamRoundProgress = {
          ...current,
          attemptsCount: current.attemptsCount + 1,
          puzzleSolved: validation.isCorrect ? true : current.puzzleSolved,
          puzzleSolvedAt: validation.isCorrect ? (current.puzzleSolvedAt || now) : current.puzzleSolvedAt,
          riddleRevealed: validation.isCorrect ? (revealedClue || current.riddleRevealed) : current.riddleRevealed,
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
            riddleRevealed: revealedClue,
          },
        ];
      }
    });

    return validation;
  }, [teams, riddles, config.roundDurationSeconds, config.gracePeriodSeconds]);

  const verifyQrToken = useCallback(async (teamId: string, roundNumber: number, scannedToken: string) => {
    const targetTeam = teams.find((t) => t.id === teamId);
    if (!targetTeam || targetTeam.status === 'eliminated') {
      return { success: false, message: 'Action rejected: Team has been eliminated.' };
    }

    const token = scannedToken.trim();

    if (SupabaseService.isConfigured()) {
      const sessionToken = sessionStorage.getItem('mm2_session_token') || '';
      const rpcRes = await SupabaseService.verifyLocationQr(teamId, sessionToken, token);
      if (rpcRes.error || !rpcRes.data || !rpcRes.data.success || !rpcRes.data.verified) {
        return {
          success: false,
          message: rpcRes.error || rpcRes.data?.message || 'QR Verification failed.',
        };
      }

      const now = new Date().toISOString();
      const isChampionshipComplete = Boolean(rpcRes.data.is_game_finished || roundNumber >= 9);

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
        setTeams((prev) =>
          prev.map((t) => (t.id === teamId ? { ...t, status: 'completed', completedAt: now } : t))
        );
        return {
          success: true,
          message: rpcRes.data.message || '✓ Final Checkpoint Verified! Championship Complete!',
          isCompleted: true,
        };
      } else {
        const nextRound = roundNumber + 1;
        const nowEpoch = Date.now();
        const dur = config.roundDurationSeconds || 300;
        const grace = config.gracePeriodSeconds || 30;

        setTeams((prev) =>
          prev.map((t) => (t.id === teamId ? { ...t, currentRound: nextRound } : t))
        );

        setProgress((prev) => {
          const exists = prev.some((p) => p.teamId === teamId && p.roundNumber === nextRound);
          if (!exists) {
            return [
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
            ];
          }
          return prev;
        });

        return {
          success: true,
          message: rpcRes.data.message || `✓ Checkpoint Verified! Proceeding to Round ${nextRound}.`,
          isCompleted: false,
        };
      }
    }

    // Local offline fallback
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
    const isChampionshipComplete = roundNumber >= 9;

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
  }, [teams, getTeamAssignedLocation, locations, config.roundDurationSeconds, config.gracePeriodSeconds]);

  const recordViolation = useCallback((teamId: string, type: ViolationType, metadata?: Record<string, unknown>) => {
    const targetTeam = teams.find((t) => t.id === teamId);
    if (!targetTeam || targetTeam.status === 'eliminated' || targetTeam.status === 'completed') {
      return {
        strikeNumber: targetTeam?.strikes || 0,
        eliminated: targetTeam?.status === 'eliminated' || false,
        message: targetTeam?.status === 'eliminated' ? 'YOU HAVE BEEN ELIMINATED!' : '',
      };
    }

    const evaluation = ViolationManager.evaluateViolation(targetTeam, type, metadata);
    const newStrikes = evaluation.newStrikes;
    const eliminated = evaluation.eliminated;
    const incident = evaluation.incident;

    setIncidents((prev) => [incident, ...prev]);

    setTeams((prev) =>
      prev.map((t) => {
        if (t.id === teamId) {
          return {
            ...t,
            strikes: newStrikes,
            status: eliminated ? 'eliminated' : t.status,
            eliminationReason: eliminated
              ? `YOU HAVE BEEN ELIMINATED! Accumulated 4 anti-cheat violations (${evaluation.reasonText})`
              : t.eliminationReason,
          };
        }
        return t;
      })
    );

    // Authoritative server-side sync via Supabase RPC
    if (SupabaseService.isConfigured()) {
      const sessionToken = sessionStorage.getItem('mm2_session_token') || '';
      if (sessionToken) {
        SupabaseService.reportTeamViolation(teamId, sessionToken, type, metadata).catch((err) => {
          console.warn('[Supabase] reportTeamViolation error:', err);
        });
      } else if (isAdminAuthenticated && adminToken) {
        SupabaseService.adminRecordViolation(teamId, type, metadata, adminToken).catch((err) => {
          console.warn('[Supabase] adminRecordViolation error:', err);
        });
      }
    }

    return {
      strikeNumber: newStrikes,
      eliminated,
      message: evaluation.config.message,
    };
  }, [teams, isAdminAuthenticated, adminToken]);

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
    adminToken,
    isAdminAuthenticated,
    adminRole,
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
    issueTeamCredentials,
    setTeamCredentials,
    resetTeamPassword,
    batchGenerateTeamCredentials,
    updateLocation,
    regenerateLocationToken,
    saveRiddle,
    deleteRiddle,
    updateConfig,
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


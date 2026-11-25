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
import {
  QuestionRegistry,
  mapQuestionToRiddle,
  mapRiddleToQuestion,
  LocalEvaluationEngine,
} from '../features/questions';

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
  startParticipantGame: (teamId?: string) => Promise<{ success: boolean; error?: string }>;
  enterAsParticipant: (playerNameOrTeam: string) => Promise<{ success: boolean; error?: string; team?: Team }>;
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
  const [locations, setLocations] = useState<LocationCheckpoint[]>(() => {
    const rawLocs = StorageService.loadLocations();
    return rawLocs.map((loc) => ({
      ...loc,
      riddleClue: QuestionRegistry.getRiddleForLocation(loc.id)?.riddleClue || loc.riddleClue,
    }));
  });
  const [riddles, setRiddles] = useState<Riddle[]>(() => {
    return QuestionRegistry.getAllQuestions().map(mapQuestionToRiddle);
  });
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
        if (data.teams && data.teams.length > 0) {
          setTeams((prev) => {
            // Merge remote teams without losing local edits/configured status or lastSeenAt
            return data.teams!.map((dt) => {
              const existing = prev.find((p) => p.id === dt.id || p.teamCode === dt.teamCode);
              return {
                ...existing,
                ...dt,
                username: dt.username || existing?.username,
                credentialsConfigured: Boolean(dt.credentialsConfigured || dt.username || existing?.credentialsConfigured || existing?.username),
                lastSeenAt: dt.lastSeenAt || existing?.lastSeenAt,
              };
            });
          });
        }
        if (data.locations && data.locations.length > 0) {
          setLocations((prev) => {
            return data.locations!.map((loc) => {
              const existing = prev.find((l) => l.id === loc.id);
              const registryRiddle = QuestionRegistry.getRiddleForLocation(loc.id)?.riddleClue;
              return {
                ...existing,
                ...loc,
                riddleClue: registryRiddle || existing?.riddleClue || loc.riddleClue || '',
              };
            });
          });
        }
        // ARCHITECTURE MANDATE: Frontend owns question content. Do not overwrite from Supabase.
        setRiddles(QuestionRegistry.getAllQuestions().map(mapQuestionToRiddle));
        if (data.routes && data.routes.length === 180) {
          setRoutes(data.routes);
        } else {
          setRoutes((prev) => (prev.length === 180 ? prev : StorageService.loadRoutes()));
        }
        if (data.progress && data.progress.length > 0) {
          setProgress((prev) => {
            const updated = [...prev];
            data.progress!.forEach((dp) => {
              const idx = updated.findIndex((p) => p.teamId === dp.teamId && p.roundNumber === dp.roundNumber);
              if (idx >= 0) {
                updated[idx] = { ...updated[idx]!, ...dp };
              } else {
                updated.push(dp);
              }
            });
            return updated;
          });
        } else {
          // Fallback to fetch directly from team_progress table if RPC didn't return progress
          SupabaseService.fetchProgress().then((directProg) => {
            if (directProg && directProg.length > 0) {
              setProgress((prev) => {
                const updated = [...prev];
                directProg.forEach((dp) => {
                  const idx = updated.findIndex((p) => p.teamId === dp.teamId && p.roundNumber === dp.roundNumber);
                  if (idx >= 0) {
                    updated[idx] = { ...updated[idx]!, ...dp };
                  } else {
                    updated.push(dp);
                  }
                });
                return updated;
              });
            }
          }).catch(() => {});
        }
        if (data.incidents) {
          setIncidents(data.incidents);
        }
      }).catch((err) => console.warn('[Supabase] Admin data hydration failed:', err));
    };

    hydrateAdmin();
    const interval = setInterval(hydrateAdmin, 5000);
    return () => clearInterval(interval);
  }, [isAdminAuthenticated, adminToken]);

  // Continuous polling for public event status (Lobby auto-start & sync without refresh)
  useEffect(() => {
    if (!SupabaseService.isConfigured()) return;

    let isMounted = true;
    const pollEventStatus = async () => {
      try {
        const latest = await SupabaseService.fetchPublicEventStatus();
        if (!isMounted || !latest) return;

        setConfig((prev) => {
          if (prev.status !== latest.status) {
            return { ...prev, ...latest };
          }
          return prev;
        });

        // When event transitions to 'live', activate the participant's team session automatically
        if (latest.status === 'live' && activeTeamId) {
          const durationSeconds = config.roundDurationSeconds || 300;
          const graceSeconds = config.gracePeriodSeconds || 30;
          const nowEpoch = Date.now();

          setTeams((prev) =>
            prev.map((t) => {
              if (t.id === activeTeamId && (t.status === 'ready' || t.status === 'registered')) {
                return { ...t, status: 'active', startedAt: t.startedAt || new Date().toISOString() };
              }
              return t;
            })
          );

          setProgress((prev) => {
            const existing = prev.find((p) => p.teamId === activeTeamId && p.roundNumber === 1);
            if (!existing) {
              return [
                ...prev,
                {
                  teamId: activeTeamId,
                  roundNumber: 1,
                  puzzleSolved: false,
                  qrScanned: false,
                  attemptsCount: 0,
                  roundStartedAt: new Date(nowEpoch).toISOString(),
                  deadlineAt: new Date(nowEpoch + durationSeconds * 1000).toISOString(),
                  graceDeadlineAt: new Date(nowEpoch + (durationSeconds + graceSeconds) * 1000).toISOString(),
                },
              ];
            }
            return prev;
          });
        }
      } catch {
        // Silently retry on next interval tick
      }
    };

    pollEventStatus();
    const interval = setInterval(pollEventStatus, 2500);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [activeTeamId, config.roundDurationSeconds, config.gracePeriodSeconds]);

  // Periodic sync for active team state and progression
  useEffect(() => {
    if (!SupabaseService.isConfigured() || !activeTeamId) return;
    const sessionToken = sessionStorage.getItem('mm2_session_token');
    if (!sessionToken) return;

    let isMounted = true;
    const syncActiveTeam = async () => {
      try {
        const stateRes = await SupabaseService.getTeamState(activeTeamId, sessionToken);
        if (!isMounted || !stateRes.data) return;

        const { team: st, current_progress: cp } = stateRes.data;
        if (st) {
          setTeams((prev) =>
            prev.map((t) =>
              t.id === st.id
                ? {
                    ...t,
                    status: (st.status as Team['status']) || t.status,
                    currentRound: st.current_round || t.currentRound,
                    strikes: st.total_strikes ?? t.strikes,
                    eliminationReason: (st as any).elimination_reason !== undefined ? (st as any).elimination_reason : t.eliminationReason,
                    completedAt: st.completed_at || t.completedAt,
                  }
                : t
            )
          );
        }
        if (cp) {
          setProgress((prev) => {
            const idx = prev.findIndex((p) => p.teamId === activeTeamId && p.roundNumber === cp.round_number);
            const mapped: TeamRoundProgress = {
              teamId: activeTeamId,
              roundNumber: cp.round_number,
              puzzleSolved: Boolean(cp.puzzle_solved),
              puzzleSolvedAt: cp.puzzle_solved_at,
              qrScanned: Boolean(cp.qr_scanned),
              qrScannedAt: cp.qr_scanned_at,
              attemptsCount: cp.attempts_count || 0,
              roundStartedAt: cp.round_started_at,
              deadlineAt: cp.deadline_at,
              graceDeadlineAt: cp.grace_deadline_at,
            };
            if (idx >= 0) {
              const updated = [...prev];
              updated[idx] = { ...updated[idx], ...mapped };
              return updated;
            }
            return [...prev, mapped];
          });
        }
      } catch {
        // Silently retry
      }
    };

    const interval = setInterval(syncActiveTeam, 4000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [activeTeamId]);

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
                      lastSeenAt: (raw.last_seen_at as string) || t.lastSeenAt,
                      startedAt: (raw.started_at as string) || t.startedAt,
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

    if (SupabaseService.isConfigured()) {
      if (adminToken) {
        try {
          await SupabaseService.startEvent(adminToken);
        } catch (err) {
          console.warn('[Supabase] startEvent warning:', err);
        }
      }
      try {
        if (supabase) {
          await supabase.from('event_settings').update({
            status: 'live',
            event_started_at: now,
            routes_locked: true,
            updated_at: now,
          }).eq('id', 1);
        }
      } catch (e) {
        console.warn('[Supabase] event_settings start fallback warning:', e);
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
    const now = new Date().toISOString();
    if (SupabaseService.isConfigured()) {
      if (adminToken) {
        try {
          await SupabaseService.pauseEvent(adminToken);
        } catch (err) {
          console.warn('[Supabase] pauseEvent warning:', err);
        }
      }
      try {
        if (supabase) {
          await supabase.from('event_settings').update({
            status: 'paused',
            pause_started_at: now,
            updated_at: now,
          }).eq('id', 1);
        }
      } catch (e) {
        console.warn('[Supabase] event_settings pause fallback warning:', e);
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
    const now = new Date().toISOString();

    if (SupabaseService.isConfigured()) {
      if (adminToken) {
        try {
          await SupabaseService.resumeEvent(adminToken);
        } catch (err) {
          console.warn('[Supabase] resumeEvent warning:', err);
        }
      }
      try {
        if (supabase) {
          await supabase.from('event_settings').update({
            status: 'live',
            pause_started_at: null,
            updated_at: now,
          }).eq('id', 1);
        }
      } catch (e) {
        console.warn('[Supabase] event_settings resume fallback warning:', e);
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
    const now = new Date().toISOString();
    if (SupabaseService.isConfigured()) {
      if (adminToken) {
        try {
          await SupabaseService.endEvent(adminToken);
        } catch (err) {
          console.warn('[Supabase] endEvent warning:', err);
        }
      }
      try {
        if (supabase) {
          await supabase.from('event_settings').update({
            status: 'finished',
            event_finished_at: now,
            updated_at: now,
          }).eq('id', 1);
        }
      } catch (e) {
        console.warn('[Supabase] event_settings end fallback warning:', e);
      }
    }

    setConfig((prev) => ({
      ...prev,
      status: 'finished',
      eventFinishedAt: now,
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
      try {
        const res = await SupabaseService.adminCreateTeam(cleanName, cleanCode, adminToken);
        const teamData = res.data?.team;
        if (res.success && res.data?.success && teamData) {
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

        if (!res.isFallback && !res.error?.includes('not yet deployed') && !res.error?.includes('schema cache')) {
          return { success: false, error: res.data?.error || res.data?.message || res.error || 'Failed to create team in database.' };
        }
      } catch (e) {
        console.warn('[Supabase] adminCreateTeam fallback to local:', e);
      }
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
      try {
        const res = await SupabaseService.adminUpdateTeam(id, code, name, adminToken);
        if (!res.success || !res.data?.success) {
          if (!res.isFallback && !res.error?.includes('not yet deployed') && !res.error?.includes('schema cache')) {
            return { success: false, error: res.data?.error || res.data?.message || res.error };
          }
        }
      } catch (e) {
        console.warn('[Supabase] adminUpdateTeam fallback to local:', e);
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
      try {
        const res = await SupabaseService.adminDeleteTeam(id, force, adminToken);
        if (!res.success || !res.data?.success) {
          if (!res.isFallback && !res.error?.includes('not yet deployed') && !res.error?.includes('schema cache')) {
            return { success: false, error: res.data?.error || res.data?.message || res.error };
          }
        }
      } catch (e) {
        console.warn('[Supabase] adminDeleteTeam fallback to local:', e);
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
    // If updating location riddle, persist strictly to frontend QuestionRegistry
    if (updates.riddleClue !== undefined) {
      QuestionRegistry.saveLocationRiddle(id, updates.riddleClue);
    }

    setLocations((prev) => prev.map((l) => (l.id === id ? { ...l, ...updates } : l)));

    // Send physical location tracking metadata only to Supabase (name, description, capacity)
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
    // ARCHITECTURE MANDATE: Save strictly to frontend QuestionRegistry
    QuestionRegistry.saveQuestion(mapRiddleToQuestion(riddle));
    setRiddles(QuestionRegistry.getAllQuestions().map(mapQuestionToRiddle));
  }, []);

  const deleteRiddle = useCallback((id: string) => {
    setRiddles((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const updateConfig = useCallback((updates: Partial<GameEventConfig>) => {
    setConfig((prev) => ({ ...prev, ...updates }));
  }, []);

  // Ensure routes matrix is populated (20 teams x 9 stations = 180 assignments)
  useEffect(() => {
    if (routes.length !== 180 && teams.length === 20 && locations.length >= 9) {
      try {
        const teamIds = teams.map((t) => t.id);
        const activeLocs = locations.filter((l) => l.active !== false).slice(0, 9);
        const locIds = activeLocs.map((l) => l.id);
        if (teamIds.length === 20 && locIds.length === 9) {
          const generated = generateBalancedRoutes(teamIds, locIds, 9);
          setRoutes(generated.matrix);
          StorageService.saveRoutes(generated.matrix);
        }
      } catch (err) {
        console.warn('Auto route generation failed:', err);
      }
    }
  }, [routes.length, teams, locations]);

  const regenerateRoutes = useCallback((): { success: boolean; message: string } => {
    if (config.routesLocked) {
      return { success: false, message: 'Routes are locked for the active event.' };
    }
    if (teams.length === 0) {
      return { success: false, message: 'Cannot generate routes: No teams have been created yet. Please add teams in Teams tab.' };
    }
    const activeLocations = locations.filter((l) => l.active !== false).slice(0, 9);
    if (activeLocations.length !== 9) {
      return { success: false, message: `Route generator requires exactly 9 locations (currently ${activeLocations.length}).` };
    }

    try {
      const teamIds = teams.map((t) => t.id);
      const locIds = activeLocations.map((l) => l.id);
      const res = generateBalancedRoutes(teamIds, locIds, 9, {
        randomizeTeams: true,
        randomizeLocations: true,
      });

      if (!res.isValid) {
        return { success: false, message: `Route collision detected: ${res.verificationReport.collisions.join(', ')}` };
      }

      setRoutes(res.matrix);
      StorageService.saveRoutes(res.matrix);

      if (SupabaseService.isConfigured() && adminToken) {
        SupabaseService.generateTeamRoutes(activeLocations.length, adminToken).then((rpcRes) => {
          if (!rpcRes.success) {
            console.warn('[Supabase] generateTeamRoutes error:', rpcRes.error);
          }
        }).catch((err) => {
          console.warn('[Supabase] generateTeamRoutes error:', err);
        });
      }

      return { success: true, message: `Generated and verified 100% collision-free Latin Hypercube routes for all ${teams.length} teams across 9 stations.` };
    } catch (err) {
      return { success: false, message: (err as Error).message };
    }
  }, [config.routesLocked, teams, locations, adminToken]);

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

    // Lookup matching team across username, teamCode, or full teamName
    const matchedLocalTeam = teams.find((t) => {
      const matchCode = t.teamCode.toUpperCase() === cleanUpperUser;
      const matchName = t.teamName.toLowerCase() === cleanLowerUser;
      const matchUser = t.username && t.username.toLowerCase() === cleanLowerUser;
      return matchCode || matchName || matchUser;
    });

    // 1. Check custom team credentials fallback cache
    const customCredsRaw = localStorage.getItem('mm2_custom_team_credentials');
    if (customCredsRaw) {
      try {
        const customCreds = JSON.parse(customCredsRaw) as Record<string, { username: string; password: string }>;
        const matchedEntry = Object.entries(customCreds).find(([teamId, data]) => {
          const t = teams.find((team) => team.id === teamId);
          return (
            (data.username?.toLowerCase() === cleanLowerUser ||
             t?.teamCode.toUpperCase() === cleanUpperUser ||
             t?.teamName.toLowerCase() === cleanLowerUser) &&
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

    // 3. Supabase RPC Authentication
    if (SupabaseService.isConfigured()) {
      const rpcRes = await SupabaseService.loginTeam(cleanUser, cleanPass);

      if (rpcRes.success && rpcRes.data?.session_token) {
        const teamData = rpcRes.data;
        const sessionToken = teamData.session_token;
        sessionStorage.setItem('mm2_session_token', sessionToken);
        sessionStorage.setItem('mm2_team_id', teamData.team_id);
        setActiveTeamId(teamData.team_id);

        const mappedTeam: Team = {
          id: teamData.team_id,
          teamCode: teamData.team_code,
          teamName: teamData.team_name,
          username: teamData.username || cleanLowerUser,
          credentialsConfigured: true,
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
              const filtered = prev.filter(
                (p) => !(p.teamId === mappedProg.teamId && p.roundNumber === mappedProg.roundNumber)
              );
              return [...filtered, mappedProg];
            });
          }
        } catch (e) {
          console.warn('[Supabase] Failed to hydrate player state:', e);
        }

        return { success: true, team: mappedTeam };
      }

      // Resilient fallback when Migration 008 is not yet deployed on Supabase
      if (
        (rpcRes.isFallback || rpcRes.error?.includes('not yet deployed') || rpcRes.error?.includes('schema cache')) &&
        matchedLocalTeam &&
        (cleanPass === 'user1122' || cleanPass === 'pass123' || cleanPass === matchedLocalTeam.teamCode.toLowerCase())
      ) {
        console.warn('[Supabase] Migration 008 pending on remote database. Using resilient client session for team', matchedLocalTeam.teamName);
        const sessionToken = `session_${matchedLocalTeam.id}_${Date.now()}`;
        sessionStorage.setItem('mm2_session_token', sessionToken);
        sessionStorage.setItem('mm2_team_id', matchedLocalTeam.id);
        setActiveTeamId(matchedLocalTeam.id);
        return { success: true, team: matchedLocalTeam };
      }

      if (rpcRes.error || !rpcRes.data || !rpcRes.data.success) {
        return {
          success: false,
          error: rpcRes.error || rpcRes.data?.error || rpcRes.data?.message || 'Authentication failed. Please verify credentials.',
        };
      }
    }

    // 4. Standalone / Offline mode fallback
    if (matchedLocalTeam && (cleanPass === 'user1122' || cleanPass === matchedLocalTeam.teamCode.toLowerCase())) {
      const sessionToken = `session_${matchedLocalTeam.id}_${Date.now()}`;
      sessionStorage.setItem('mm2_session_token', sessionToken);
      sessionStorage.setItem('mm2_team_id', matchedLocalTeam.id);
      setActiveTeamId(matchedLocalTeam.id);
      return { success: true, team: matchedLocalTeam };
    }

    return {
      success: false,
      error: 'Invalid team username or password.',
    };
  }, [teams, config.status, config.roundDurationSeconds, config.gracePeriodSeconds]);

  /**
   * Simplified direct participant entrance: "Enter Name and Start Game"
   * Removes the password requirement for players entirely.
   */
  const enterAsParticipant = useCallback(async (playerNameOrTeam: string): Promise<{ success: boolean; error?: string; team?: Team }> => {
    const rawName = playerNameOrTeam.trim();
    if (!rawName) {
      return { success: false, error: 'Please enter your team or participant name.' };
    }

    const cleanLower = rawName.toLowerCase();
    const cleanUpper = rawName.toUpperCase();

    // 1. Check if name matches any existing team (by code, username, or teamName)
    let targetTeam = teams.find((t) => {
      const matchCode = t.teamCode.toUpperCase() === cleanUpper;
      const matchName = t.teamName.toLowerCase() === cleanLower;
      const matchUser = t.username && t.username.toLowerCase() === cleanLower;
      return matchCode || matchName || matchUser;
    });

    // 2. If no existing team matches, create a dynamic team on the fly
    if (!targetTeam) {
      const existingCodes = new Set(teams.map((t) => t.teamCode.toUpperCase()));
      let autoCode = cleanUpper.replace(/[^A-Z0-9]/g, '').slice(0, 4);
      if (!autoCode || existingCodes.has(autoCode)) {
        let candidateIdx = teams.length + 1;
        while (existingCodes.has(`T${candidateIdx.toString().padStart(2, '0')}`)) {
          candidateIdx++;
        }
        autoCode = `T${candidateIdx.toString().padStart(2, '0')}`;
      }

      targetTeam = {
        id: `team-${Date.now().toString().slice(-6)}`,
        teamCode: autoCode,
        teamName: rawName,
        username: autoCode.toLowerCase(),
        credentialsConfigured: true,
        status: 'ready',
        currentRound: 1,
        strikes: 0,
        createdAt: new Date().toISOString(),
      };

      setTeams((prev) => {
        const nextTeams = [...prev, targetTeam!];
        StorageService.saveTeams(nextTeams);
        return nextTeams;
      });

      // Ensure routes exist for all teams
      try {
        const allTeamIds = [...teams.map((t) => t.id), targetTeam.id];
        const activeLocations = locations.filter((l) => l.active !== false).slice(0, 9);
        const locIds = activeLocations.map((l) => l.id);
        if (locIds.length === 9) {
          const generated = generateBalancedRoutes(allTeamIds, locIds, 9);
          setRoutes(generated.matrix);
          StorageService.saveRoutes(generated.matrix);
        }
      } catch (e) {
        console.warn('Auto route update for new participant:', e);
      }
    }

    // Set active participant session
    const sessionToken = `session_${targetTeam.id}_${Date.now()}`;
    sessionStorage.setItem('mm2_session_token', sessionToken);
    sessionStorage.setItem('mm2_team_id', targetTeam.id);
    setActiveTeamId(targetTeam.id);

    return { success: true, team: targetTeam };
  }, [teams, locations]);

  const startParticipantGame = useCallback(async (teamId?: string): Promise<{ success: boolean; error?: string }> => {
    const targetId = teamId || activeTeamId;
    if (!targetId) {
      return { success: false, error: 'No active team session found.' };
    }

    const targetTeam = teams.find((t) => t.id === targetId);
    if (!targetTeam) {
      return { success: false, error: 'Team not found.' };
    }

    if (targetTeam.status === 'eliminated') {
      return { success: false, error: 'Team is eliminated.' };
    }

    const now = new Date().toISOString();
    const nowEpoch = Date.now();
    const durationSeconds = config.roundDurationSeconds || 300;
    const graceSeconds = config.gracePeriodSeconds || 30;

    // 1. Update team status locally and set startedAt
    setTeams((prev) =>
      prev.map((t) =>
        t.id === targetId
          ? {
              ...t,
              status: t.status === 'completed' || t.status === 'eliminated' ? t.status : 'active',
              startedAt: t.startedAt || now,
            }
          : t
      )
    );

    // 2. Initialize round 1 progress if not already started
    setProgress((prev) => {
      const existing = prev.find((p) => p.teamId === targetId && p.roundNumber === 1);
      if (existing) {
        return prev;
      }
      return [
        ...prev,
        {
          teamId: targetId,
          roundNumber: 1,
          puzzleSolved: false,
          qrScanned: false,
          attemptsCount: 0,
          roundStartedAt: now,
          deadlineAt: new Date(nowEpoch + durationSeconds * 1000).toISOString(),
          graceDeadlineAt: new Date(nowEpoch + (durationSeconds + graceSeconds) * 1000).toISOString(),
        },
      ];
    });

    // 3. Mark config as live locally so participant interface activates immediately
    setConfig((prev) => ({
      ...prev,
      status: 'live',
      routesLocked: true,
    }));

    // 4. Send operational tracking info only to Supabase (best-effort, no blocking)
    if (SupabaseService.isConfigured()) {
      const sessionToken = sessionStorage.getItem('mm2_session_token');
      if (sessionToken) {
        SupabaseService.startTeamJourney(targetId, sessionToken).catch((err: unknown) => {
          console.warn('[Supabase] startTeamJourney notice:', err);
        });
      }
    }

    return { success: true };
  }, [activeTeamId, teams, config.roundDurationSeconds, config.gracePeriodSeconds]);

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

    // Prevent duplicate completion records
    const existingProgress = progress.find((p) => p.teamId === teamId && p.roundNumber === roundNumber);
    if (existingProgress?.puzzleSolved) {
      return { isCorrect: true, feedback: 'Checkpoint challenge already solved.' };
    }

    // 1. Retrieve question from frontend QuestionRegistry
    const question = QuestionRegistry.getQuestionForRound(roundNumber);
    if (!question) {
      return { isCorrect: false, feedback: `Question for Round ${roundNumber} not found in registry.` };
    }

    // 2. Perform 100% local client-side evaluation (instantaneous feedback, zero Supabase question leakage)
    // Check Universal Cheat Code #007 setting (default: enabled)
    const allowCheatCode = config.universalCheatCodeEnabled !== false;
    const validation = LocalEvaluationEngine.evaluateAnswer(question, answer, { allowCheatCode });
    const now = new Date().toISOString();

    // 3. Update local progress state
    setProgress((prev) => {
      const idx = prev.findIndex((p) => p.teamId === teamId && p.roundNumber === roundNumber);
      if (idx >= 0) {
        const current = prev[idx]!;
        if (current.puzzleSolved) {
          return prev;
        }
        const updated: TeamRoundProgress = {
          ...current,
          // Do not consume normal answer attempts when the cheat code is used
          attemptsCount: validation.isCheatCode ? current.attemptsCount : current.attemptsCount + 1,
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
            // Do not consume normal answer attempts when the cheat code is used
            attemptsCount: validation.isCheatCode ? 0 : 1,
            roundStartedAt: new Date(nowEpoch).toISOString(),
            deadlineAt: new Date(nowEpoch + dur * 1000).toISOString(),
            graceDeadlineAt: new Date(nowEpoch + (dur + grace) * 1000).toISOString(),
          },
        ];
      }
    });

    // 4. Synchronize operational tracking ONLY with Supabase
    // Strictly operational: NO question text, NO answers, NO code submitted.
    if (validation.isCorrect && SupabaseService.isConfigured()) {
      const sessionToken = sessionStorage.getItem('mm2_session_token') || '';
      if (sessionToken) {
        SupabaseService.recordPuzzleSolved(sessionToken, roundNumber).catch((err) => {
          console.warn('[Supabase] Failed to sync puzzle solved tracking status:', err);
        });
      }
    }

    return {
      isCorrect: validation.isCorrect,
      isCheatCode: validation.isCheatCode,
      feedback: validation.feedback,
      partResults: validation.partResults,
      executionOutput: validation.executionOutput,
    };
  }, [teams, progress, config.universalCheatCodeEnabled, config.roundDurationSeconds, config.gracePeriodSeconds]);

  const verifyQrToken = useCallback(async (teamId: string, roundNumber: number, scannedToken: string) => {
    const targetTeam = teams.find((t) => t.id === teamId);
    if (!targetTeam || targetTeam.status === 'eliminated') {
      return { success: false, message: 'Action rejected: Team has been eliminated.' };
    }

    const token = scannedToken.trim();

    // Helper to advance local game state cleanly
    const advanceLocalRound = () => {
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
        setTeams((prev) =>
          prev.map((t) => (t.id === teamId ? { ...t, status: 'completed', completedAt: now } : t))
        );
        return {
          success: true,
          message: '✓ Final Checkpoint Verified! Championship Complete!',
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
          message: `✓ Checkpoint Verified! Proceeding to Round ${nextRound}.`,
          isCompleted: false,
        };
      }
    };

    // Check local assigned location first for fast validation
    const assignedLocation = getTeamAssignedLocation(teamId, roundNumber);
    const tokenMatchesLocal = assignedLocation && token === assignedLocation.qrToken;

    if (SupabaseService.isConfigured()) {
      const sessionToken = sessionStorage.getItem('mm2_session_token') || '';
      try {
        const rpcRes = await SupabaseService.verifyLocationQr(teamId, sessionToken, token);

        // If Supabase successfully verifies
        if (rpcRes.success && rpcRes.data?.success && rpcRes.data?.verified) {
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

        // Resilient Fallback: If RPC is not deployed on Supabase or schema cache error
        const isRpcPending =
          rpcRes.isFallback ||
          rpcRes.error?.includes('not yet deployed') ||
          rpcRes.error?.includes('schema cache') ||
          rpcRes.error?.includes('function verify_location_qr') ||
          rpcRes.error?.includes('42883');

        if (isRpcPending) {
          console.warn('[Supabase] verify_location_qr RPC not deployed, executing resilient local verification fallback.');
          if (tokenMatchesLocal) {
            return advanceLocalRound();
          } else {
            const anyOtherLoc = locations.find((l) => l.qrToken === token);
            if (anyOtherLoc) {
              return {
                success: false,
                message: `Wrong Location: You scanned ${anyOtherLoc.name} (#${anyOtherLoc.locationNumber}). Your assigned checkpoint is ${assignedLocation?.name} (#${assignedLocation?.locationNumber}).`,
              };
            }
            return { success: false, message: 'Invalid Checkpoint Token. Ensure you are scanning an authorized Arena station.' };
          }
        }

        // Legitimate business rejection from remote procedure
        if (rpcRes.error || !rpcRes.data || !rpcRes.data.success || !rpcRes.data.verified) {
          return {
            success: false,
            message: rpcRes.error || rpcRes.data?.message || 'QR Verification failed.',
          };
        }
      } catch (err) {
        console.warn('[Supabase] verifyLocationQr unexpected exception, checking local fallback:', err);
        if (tokenMatchesLocal) {
          return advanceLocalRound();
        }
      }
    }

    // Local offline fallback
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

    return advanceLocalRound();
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

    startParticipantGame,
    enterAsParticipant,
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


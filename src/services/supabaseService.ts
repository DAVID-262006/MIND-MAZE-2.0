import { supabase, isSupabaseConfigured, checkSupabaseConnection, type SupabaseConnectionStatus } from '../lib/supabase';
import type { Team, LocationCheckpoint, Riddle, RouteAssignment, TeamRoundProgress, AntiCheatIncident, LeaderboardEntry, GameEventConfig, ViolationType } from '../types';
import { QuestionRegistry, mapQuestionToRiddle } from '../features/questions';

/**
 * Result structure for backend RPC operations.
 */
export interface BackendRpcResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  isFallback?: boolean;
}

/**
 * Service layer coordinating Supabase remote calls and authoritative state.
 */
export class SupabaseService {
  private static cachedStatus: SupabaseConnectionStatus | null = null;
  private static lastCheckTime = 0;
  private static readonly CACHE_TTL_MS = 15000;

  /**
   * Get current connection status with lightweight caching.
   */
  public static async getStatus(forceRefresh = false): Promise<SupabaseConnectionStatus> {
    const now = Date.now();
    if (!forceRefresh && this.cachedStatus && now - this.lastCheckTime < this.CACHE_TTL_MS) {
      return this.cachedStatus;
    }

    const status = await checkSupabaseConnection();
    this.cachedStatus = status;
    this.lastCheckTime = now;
    return status;
  }

  /**
   * Check if Supabase client is configured via environment variables.
   */
  public static isConfigured(): boolean {
    return isSupabaseConfigured;
  }

  /**
   * Safe execution wrapper for Supabase RPC functions.
   */
  public static async callRpc<T = unknown>(
    procedureName: string,
    params: Record<string, unknown> = {}
  ): Promise<BackendRpcResponse<T>> {
    if (!isSupabaseConfigured || !supabase) {
      return {
        success: false,
        error: 'Supabase client is not configured. Please supply credentials in .env.local.',
        isFallback: true,
      };
    }

    try {
      const { data, error } = await supabase.rpc(procedureName, params);

      if (error) {
        console.error(`[Supabase RPC Error] ${procedureName}:`, {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        });

        const isSchemaPending =
          error.code === '42883' ||
          error.code === '42P01' ||
          error.code === 'PGRST125' ||
          error.code === 'PGRST202' ||
          error.message.includes('function') ||
          error.message.includes('relation') ||
          error.message.includes('Invalid path specified in request URL') ||
          error.message.includes('schema cache');

        return {
          success: false,
          error: isSchemaPending
            ? `Remote procedure '${procedureName}' is not yet deployed on Supabase. (Migration pending)`
            : error.message,
          isFallback: isSchemaPending,
        };
      }

      // Check if the RPC returned a JSONB object with success: false
      if (data && typeof data === 'object' && 'success' in data && (data as { success: boolean }).success === false) {
        const errObj = data as { error?: string; message?: string };
        return {
          success: false,
          error: errObj.message || errObj.error || 'Operation unsuccessful',
          data: data as T,
        };
      }

      return {
        success: true,
        data: data as T,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: `Supabase RPC call failed: ${msg}`,
        isFallback: true,
      };
    }
  }

  /* -------------------------------------------------------------------------
   * Player Authentication & State RPCs
   * ------------------------------------------------------------------------- */

  /**
   * Team authentication: login_team(p_username, p_password, p_device_fingerprint)
   * Supports both custom team usernames, team codes, and team names.
   */
  public static async loginTeam(usernameOrCode: string, passwordOrPasscode: string, deviceFingerprint?: string) {
    const cleanUser = usernameOrCode.trim();
    const cleanPass = passwordOrPasscode.trim();

    // 1. Primary call matching Migration 008 signature
    const rpcRes = await this.callRpc<{
      success: boolean;
      team_id: string;
      team_code: string;
      team_name: string;
      username?: string;
      session_token: string;
      current_round: number;
      status: string;
      total_score: number;
      error?: string;
      message?: string;
    }>('login_team', {
      p_username: cleanUser,
      p_password: cleanPass,
      p_device_fingerprint: deviceFingerprint || null,
    });

    if (rpcRes.success) {
      return rpcRes;
    }

    // 2. Legacy fallback if Migration 008 is not yet deployed on Supabase (older migrations 002-006)
    if (rpcRes.isFallback || rpcRes.error?.includes('not yet deployed') || rpcRes.error?.includes('schema cache')) {
      const legacyRes = await this.callRpc<{
        success: boolean;
        team_id: string;
        team_code: string;
        team_name: string;
        username?: string;
        session_token: string;
        current_round: number;
        status: string;
        total_score: number;
        error?: string;
        message?: string;
      }>('login_team', {
        p_team_code: cleanUser.toUpperCase(),
        p_passcode: cleanPass,
        p_device_fingerprint: deviceFingerprint || null,
      });

      if (legacyRes.success) {
        return legacyRes;
      }
    }

    return rpcRes;
  }

  /**
   * Team logout: logout_team(p_team_id, p_session_token)
   */
  public static async logoutTeam(teamId: string, sessionToken: string) {
    return this.callRpc<{ success: boolean; message: string }>('logout_team', {
      p_team_id: teamId,
      p_session_token: sessionToken,
    });
  }

  /**
   * Get authoritative sanitized team state: get_team_state(p_team_id, p_session_token)
   */
  public static async getTeamState(teamId: string, sessionToken: string) {
    return this.callRpc<{
      success: boolean;
      team: {
        id: string;
        team_code: string;
        team_name: string;
        status: string;
        current_round: number;
        total_strikes: number;
        started_at: string | null;
        completed_at: string | null;
        total_time_ms: number | null;
      };
      event: {
        status: string;
        active_locations_count: number;
        round_duration_seconds: number;
        grace_period_seconds: number;
        total_pause_duration_ms: number;
      };
      current_progress: {
        round_number: number;
        puzzle_solved: boolean;
        puzzle_solved_at: string | null;
        qr_scanned: boolean;
        qr_scanned_at: string | null;
        attempts_count: number;
        round_started_at: string;
        deadline_at: string;
        grace_deadline_at: string;
        status: string;
        riddle_revealed: string | null;
      } | null;
      current_puzzle: {
        id: string;
        round_number: number;
        title: string;
        puzzle_type: string;
        description_md: string;
        hints: string[];
        max_attempts: number;
        sample_cases: unknown;
        starter_code: unknown;
        options: string[];
        image_url: string | null;
        image_alt: string | null;
        three_part_questions?: { partA: string; partB: string; partC: string };
        code_language?: string;
        code_snippet?: string;
        is_active?: boolean;
      } | null;
    }>('get_team_state', {
      p_team_id: teamId,
      p_session_token: sessionToken,
    });
  }

  /**
   * Start team journey: start_team_journey(p_team_id, p_session_token, p_starting_qr)
   */
  public static async startTeamJourney(teamId: string, sessionToken: string, startingQr?: string) {
    return this.callRpc<{
      success: boolean;
      team_id: string;
      current_round: number;
      assigned_location_id: number;
      assigned_location_name: string;
      puzzle_id: string;
      puzzle_title: string;
      round_started_at: string;
      deadline_at: string;
      message: string;
    }>('start_team_journey', {
      p_team_id: teamId,
      p_session_token: sessionToken,
      p_starting_qr: startingQr || null,
    });
  }

  /**
   * Operational tracking only: record_puzzle_solved(p_session_token, p_round_number)
   * Informs Supabase that the team has solved the checkpoint puzzle.
   * STRICT ARCHITECTURE RULE: ZERO question content or answers sent to Supabase.
   */
  public static async recordPuzzleSolved(sessionToken: string, roundNumber: number) {
    const res = await this.callRpc<{
      success: boolean;
      puzzle_solved: boolean;
      current_round: number;
      message: string;
    }>('record_puzzle_solved', {
      p_session_token: sessionToken,
      p_round_number: roundNumber,
    });

    if (res.success) return res;

    // Resilient tracking fallback for schemas with legacy submit_puzzle_answer
    if (res.isFallback || res.error?.includes('not yet deployed') || res.error?.includes('schema cache')) {
      const teamId = sessionStorage.getItem('mm2_team_id') || '';
      return this.callRpc<{
        success: boolean;
        puzzle_solved: boolean;
        message: string;
      }>('submit_puzzle_answer', {
        p_team_id: teamId,
        p_session_token: sessionToken,
        p_answer: 'LOCAL_VERIFIED',
      });
    }

    return res;
  }

  /**
   * Operational tracking alias for legacy calls.
   * STRICT ARCHITECTURE RULE: ZERO question content or answers sent to Supabase.
   */
  public static async submitPuzzleAnswer(
    teamId: string,
    sessionToken: string,
    _submittedAnswer?: string
  ) {
    return this.recordPuzzleSolved(sessionToken, 1);
  }

  /**
   * Verify location QR code: verify_location_qr(p_team_id, p_session_token, p_qr_token)
   */
  public static async verifyLocationQr(
    teamId: string,
    sessionToken: string,
    scannedToken: string
  ) {
    return this.callRpc<{
      success: boolean;
      verified: boolean;
      points_awarded?: number;
      round_completed?: number;
      next_round?: number;
      is_game_finished?: boolean;
      message: string;
    }>('verify_location_qr', {
      p_team_id: teamId,
      p_session_token: sessionToken,
      p_qr_token: scannedToken.trim(),
    });
  }

  /**
   * Complete journey: complete_team_journey(p_team_id, p_session_token, p_final_qr)
   */
  public static async completeTeamJourney(teamId: string, sessionToken: string, finalQr?: string) {
    return this.callRpc<{
      success: boolean;
      completed: boolean;
      final_rank?: number;
      total_time_seconds?: number;
      message: string;
    }>('complete_team_journey', {
      p_team_id: teamId,
      p_session_token: sessionToken,
      p_final_qr: finalQr || null,
    });
  }

  /**
   * Participant report violation: report_team_violation(p_team_id, p_session_token, p_violation_type, p_metadata)
   */
  public static async reportTeamViolation(
    teamId: string,
    sessionToken: string,
    violationType: ViolationType,
    metadata?: Record<string, unknown>
  ) {
    return this.callRpc<{
      success: boolean;
      strikeNumber: number;
      eliminated: boolean;
      message: string;
    }>('report_team_violation', {
      p_team_id: teamId,
      p_session_token: sessionToken,
      p_violation_type: violationType,
      p_metadata: metadata || {},
    });
  }

  /**
   * Admin record violation strike: admin_record_violation(p_team_id, p_violation_type, p_metadata)
   */
  public static async adminRecordViolation(
    teamId: string,
    violationType: ViolationType,
    metadata?: Record<string, unknown>,
    adminToken?: string | null
  ) {
    return this.callRpc<{
      success: boolean;
      strikeNumber: number;
      eliminated: boolean;
      message: string;
    }>('admin_record_violation', {
      p_admin_token: adminToken || '',
      p_team_id: teamId,
      p_violation_type: violationType,
      p_metadata: metadata || {},
    });
  }

  /**
   * Record anti-cheat violation strike. Dispatches to reportTeamViolation if sessionToken is provided,
   * otherwise uses adminRecordViolation.
   */
  public static async recordViolation(
    teamId: string,
    violationType: ViolationType,
    metadata?: Record<string, unknown>,
    sessionToken?: string,
    adminToken?: string
  ) {
    if (sessionToken) {
      return this.reportTeamViolation(teamId, sessionToken, violationType, metadata);
    }
    return this.adminRecordViolation(teamId, violationType, metadata, adminToken);
  }

  /* -------------------------------------------------------------------------
   * Admin Authentication & Session Management
   * ------------------------------------------------------------------------- */

  /**
   * Admin custom login (username & password, zero Supabase Auth).
   */
  public static async adminLogin(username: string, password: string): Promise<{
    success: boolean;
    token?: string;
    role?: string;
    username?: string;
    fullName?: string;
    error?: string;
  }> {
    if (!isSupabaseConfigured || !supabase) {
      return {
        success: false,
        error: 'Supabase is not configured. Please configure VITE_SUPABASE_URL and key in .env.local.',
      };
    }

    try {
      const res = await this.callRpc<{
        success: boolean;
        token?: string;
        role?: string;
        username?: string;
        fullName?: string;
        error?: string;
        message?: string;
      }>('admin_custom_login', {
        p_username: username.trim(),
        p_password: password,
      });

      if (!res.success || !res.data?.success || !res.data.token) {
        return {
          success: false,
          error: res.data?.message || res.data?.error || res.error || 'Authentication failed: Invalid credentials.',
        };
      }

      return {
        success: true,
        token: res.data.token,
        role: res.data.role,
        username: res.data.username,
        fullName: res.data.fullName,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: `Login failed: ${msg}`,
      };
    }
  }

  /**
   * Admin custom sign-out.
   */
  public static async adminLogout(adminToken?: string | null): Promise<{ success: boolean; error?: string }> {
    if (!supabase || !adminToken) return { success: true };
    try {
      await this.callRpc('admin_custom_logout', { p_admin_token: adminToken });
      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  }

  /**
   * Check if provided admin token belongs to an active, valid administrator.
   */
  public static async checkAdminSession(adminToken?: string | null): Promise<{
    isAuthenticated: boolean;
    role?: string;
    username?: string;
    fullName?: string;
  }> {
    if (!isSupabaseConfigured || !supabase || !adminToken) {
      return { isAuthenticated: false };
    }

    try {
      const res = await this.callRpc<{
        success: boolean;
        isAuthenticated?: boolean;
        role?: string;
        username?: string;
        fullName?: string;
      }>('admin_custom_verify_session', {
        p_admin_token: adminToken,
      });

      if (res.success && res.data?.isAuthenticated) {
        return {
          isAuthenticated: true,
          role: res.data.role,
          username: res.data.username,
          fullName: res.data.fullName,
        };
      }

      return { isAuthenticated: false };
    } catch {
      return { isAuthenticated: false };
    }
  }

  /**
   * Fetch complete administrative dashboard state via authenticated session token.
   */
  public static async fetchAdminDashboardData(adminToken: string): Promise<{
    success: boolean;
    teams?: Team[];
    locations?: LocationCheckpoint[];
    puzzles?: Riddle[];
    routes?: RouteAssignment[];
    progress?: TeamRoundProgress[];
    incidents?: AntiCheatIncident[];
    error?: string;
  }> {
    if (!isSupabaseConfigured || !supabase) return { success: false, error: 'Database not configured.' };

    try {
      const res = await this.callRpc<{
        success: boolean;
        teams?: Record<string, unknown>[];
        locations?: Record<string, unknown>[];
        puzzles?: Record<string, unknown>[];
        routes?: Record<string, unknown>[];
        progress?: Record<string, unknown>[];
        incidents?: Record<string, unknown>[];
        error?: string;
        message?: string;
      }>('admin_get_dashboard_data', {
        p_admin_token: adminToken,
      });

      if (!res.success || !res.data?.success) {
        return { success: false, error: res.data?.message || res.data?.error || res.error };
      }

      const d = res.data;

      const teams: Team[] = (d.teams || []).map((t) => ({
        id: String(t.id),
        teamCode: String(t.team_code),
        teamName: String(t.team_name),
        username: (t.username as string) || undefined,
        credentialsConfigured: Boolean(t.credentials_configured || t.username),
        credentialsRandomized: Boolean(t.credentials_randomized),
        status: (t.status as Team['status']) || 'ready',
        currentRound: Number(t.current_round || 1),
        strikes: Number(t.total_strikes || 0),
        startedAt: (t.started_at as string) || null,
        completedAt: (t.completed_at as string) || null,
        totalTimeMs: t.total_time_ms !== undefined && t.total_time_ms !== null ? Number(t.total_time_ms) : null,
        eliminationReason: (t.elimination_reason as string) || null,
        createdAt: (t.created_at as string) || new Date().toISOString(),
      }));

      const locations: LocationCheckpoint[] = (d.locations || []).map((l) => ({
        id: Number(l.id),
        locationNumber: Number(l.location_number),
        name: String(l.name),
        description: String(l.description),
        riddleClue: (l.riddle_clue as string) || '',
        capacity: Number(l.capacity || 2),
        active: Boolean(l.active),
        qrToken: '',
      }));

      const puzzles: Riddle[] = (d.puzzles || []).map((p) => ({
        id: String(p.id),
        roundNumber: Number(p.round_number),
        title: String(p.title),
        puzzleType: p.puzzle_type as Riddle['puzzleType'],
        descriptionMd: String(p.description_md || ''),
        acceptedAnswers: Array.isArray(p.accepted_answers) ? p.accepted_answers : [],
        caseSensitive: Boolean(p.case_sensitive),
        normalizeWhitespace: Boolean(p.normalize_whitespace),
        hints: Array.isArray(p.hints) ? p.hints : [],
        maxAttempts: Number(p.max_attempts || 5),
        options: Array.isArray(p.options) ? p.options : undefined,
        correctOptionIndex: p.correct_option_index !== null ? Number(p.correct_option_index) : undefined,
        imageUrl: (p.image_url as string) || undefined,
        imageAlt: (p.image_alt as string) || undefined,
        published: true,
        threePartQuestions: p.three_part_questions as Riddle['threePartQuestions'],
        threePartAnswers: p.three_part_answers as Riddle['threePartAnswers'],
        codeLanguage: (p.code_language as string) || undefined,
        codeSnippet: (p.code_snippet as string) || undefined,
        riddleClue: (p.riddle_clue as string) || undefined,
        isActive: p.is_active !== undefined ? Boolean(p.is_active) : true,
      }));

      const routes: RouteAssignment[] = (d.routes || []).map((r) => ({
        teamId: String(r.team_id),
        roundNumber: Number(r.round_number),
        locationId: Number(r.location_id),
      }));

      const progress: TeamRoundProgress[] = (d.progress || []).map((pr) => ({
        teamId: String(pr.team_id),
        roundNumber: Number(pr.round_number),
        puzzleSolved: Boolean(pr.puzzle_solved),
        puzzleSolvedAt: (pr.puzzle_solved_at as string) || null,
        qrScanned: Boolean(pr.qr_scanned),
        qrScannedAt: (pr.qr_scanned_at as string) || null,
        attemptsCount: Number(pr.attempts_count || 0),
        roundStartedAt: (pr.round_started_at as string) || new Date().toISOString(),
        deadlineAt: (pr.deadline_at as string) || new Date().toISOString(),
        graceDeadlineAt: (pr.grace_deadline_at as string) || new Date().toISOString(),
        completedAt: (pr.qr_scanned_at as string) || null,
        timedOut: pr.status === 'timed_out',
      }));

      const incidents: AntiCheatIncident[] = (d.incidents || []).map((a) => {
        const details = (a.details as Record<string, unknown>) || {};
        const strikeNum = Number(details.strike_number || (a.event_type === 'team_eliminated_anti_cheat' ? 4 : 1));
        return {
          id: String(a.id),
          teamId: String(a.team_id || ''),
          teamCode: String(details.team_code || ''),
          teamName: String(details.team_name || ''),
          roundNumber: Number(details.round_number || 1),
          violationType: (details.violation_type as any) || 'WINDOW_BLUR',
          strikeNumber: strikeNum,
          timestamp: (a.created_at as string) || new Date().toISOString(),
          metadata: details,
          status: a.event_type === 'team_eliminated_anti_cheat' ? 'eliminated' : 'warning',
          notes: String(details.notes || ''),
        };
      });

      return {
        success: true,
        teams,
        locations,
        puzzles,
        routes,
        progress,
        incidents,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  }

  /* -------------------------------------------------------------------------
   * Event Lifecycle RPCs (Admin Controlled - Requires Custom Admin Token)
   * ------------------------------------------------------------------------- */

  public static async setEventStatus(status: 'draft' | 'ready' | 'live' | 'paused' | 'finished', adminToken: string) {
    return this.callRpc<{ success: boolean; status: string; message: string }>('admin_set_event_status', {
      p_admin_token: adminToken,
      p_status: status,
    });
  }

  public static async startEvent(adminToken: string) {
    return this.callRpc<{ success: boolean; status: string; message: string }>('admin_start_event', {
      p_admin_token: adminToken,
    });
  }

  public static async pauseEvent(adminToken: string) {
    return this.callRpc<{ success: boolean; status: string; message: string }>('admin_pause_event', {
      p_admin_token: adminToken,
    });
  }

  public static async resumeEvent(adminToken: string) {
    return this.callRpc<{ success: boolean; status: string; message: string }>('admin_resume_event', {
      p_admin_token: adminToken,
    });
  }

  public static async endEvent(adminToken: string) {
    return this.callRpc<{ success: boolean; status: string; message: string }>('admin_end_event', {
      p_admin_token: adminToken,
    });
  }

  /* -------------------------------------------------------------------------
   * Admin Operations RPCs (Strict Custom Admin Token Enforcement)
   * ------------------------------------------------------------------------- */

  public static async reinstateTeam(teamId: string, adminToken: string) {
    return this.callRpc<{ success: boolean; message: string }>('admin_reinstate_team', {
      p_admin_token: adminToken,
      p_team_id: teamId,
    });
  }

  public static async adminCreateTeam(teamName: string, teamCode: string, adminToken: string) {
    return this.callRpc<{
      success: boolean;
      team?: {
        id: string;
        team_code: string;
        team_name: string;
        status: string;
        current_round: number;
        total_strikes: number;
        credentials_randomized: boolean;
        created_at: string;
      };
      error?: string;
      message: string;
    }>('admin_create_team', {
      p_admin_token: adminToken,
      p_team_code: teamCode.trim().toUpperCase(),
      p_team_name: teamName.trim(),
    });
  }

  public static async adminUpdateTeam(teamId: string, teamCode: string, teamName: string, adminToken: string) {
    return this.callRpc<{ success: boolean; error?: string; message: string }>('admin_update_team', {
      p_admin_token: adminToken,
      p_team_id: teamId,
      p_team_code: teamCode.trim().toUpperCase(),
      p_team_name: teamName.trim(),
    });
  }

  public static async adminDeleteTeam(teamId: string, force = false, adminToken: string) {
    return this.callRpc<{ success: boolean; error?: string; message: string }>('admin_delete_team', {
      p_admin_token: adminToken,
      p_team_id: teamId,
      p_force: force,
    });
  }

  public static async adminGenerateTeamCredentials(confirmationCode: string, adminToken: string) {
    return this.callRpc<{
      success: boolean;
      count?: number;
      credentials?: {
        team_id: string;
        team_code: string;
        team_name: string;
        passcode: string;
      }[];
      error?: string;
      message: string;
    }>('admin_generate_team_credentials', {
      p_admin_token: adminToken,
      p_confirmation_code: confirmationCode,
    });
  }

  public static async adminSetTeamCredentials(teamId: string, username: string, password: string, adminToken: string) {
    return this.callRpc<{
      success: boolean;
      team_id?: string;
      team_code?: string;
      username?: string;
      credentials_configured?: boolean;
      error?: string;
      message?: string;
    }>('admin_set_team_credentials', {
      p_admin_token: adminToken,
      p_team_id: teamId,
      p_username: username.trim().toLowerCase(),
      p_password: password.trim(),
    });
  }

  public static async adminResetTeamPassword(teamId: string, newPassword: string, adminToken: string) {
    return this.callRpc<{
      success: boolean;
      team_id?: string;
      team_code?: string;
      error?: string;
      message?: string;
    }>('admin_reset_team_password', {
      p_admin_token: adminToken,
      p_team_id: teamId,
      p_new_password: newPassword.trim(),
    });
  }

  public static async adminBatchGenerateTeamCredentials(adminToken: string) {
    return this.callRpc<{
      success: boolean;
      count?: number;
      credentials?: {
        team_id: string;
        team_code: string;
        team_name: string;
        username: string;
        password: string;
      }[];
      error?: string;
      message?: string;
    }>('admin_batch_generate_team_credentials', {
      p_admin_token: adminToken,
    });
  }

  public static async eliminateTeam(teamId: string, reason: string, adminToken: string) {
    return this.callRpc<{ success: boolean; message: string }>('admin_eliminate_team', {
      p_admin_token: adminToken,
      p_team_id: teamId,
      p_reason: reason,
    });
  }

  public static async adminResetTeamSession(teamId: string, adminToken: string) {
    return this.callRpc<{ success: boolean; message: string }>('admin_reset_team_session', {
      p_admin_token: adminToken,
      p_team_id: teamId,
    });
  }

  public static async adminResetTeamProgress(teamId: string, adminToken: string) {
    return this.callRpc<{ success: boolean; message: string }>('admin_reset_team_progress', {
      p_admin_token: adminToken,
      p_team_id: teamId,
    });
  }

  public static async adminRegenerateEventQrTokens(confirmationCode: string, adminToken: string) {
    return this.callRpc<{ success: boolean; regenerated_locations: number; timestamp: string; message: string }>(
      'admin_regenerate_event_qr_tokens',
      {
        p_admin_token: adminToken,
        p_confirmation_code: confirmationCode,
      }
    );
  }

  public static async adminUpdateLocation(
    locationId: number,
    name: string,
    description: string,
    capacity: number,
    adminToken: string
  ) {
    return this.callRpc<{ success: boolean; message: string }>('admin_update_location', {
      p_admin_token: adminToken,
      p_location_id: locationId,
      p_name: name,
      p_description: description,
      p_capacity: capacity,
    });
  }

  public static async adminRegenerateLocationToken(locationId: number, adminToken: string) {
    return this.callRpc<{ success: boolean; qrToken: string; message: string }>('admin_regenerate_location_token', {
      p_admin_token: adminToken,
      p_location_id: locationId,
    });
  }

  public static async generateTeamRoutes(activeLocations = 10, adminToken: string) {
    return this.callRpc<{ success: boolean; message: string }>('generate_team_routes', {
      p_admin_token: adminToken,
      p_active_locations: activeLocations,
    });
  }

  /**
   * ARCHITECTURE MANDATE: Frontend owns all question content.
   * No question data is sent to or stored in Supabase.
   */
  public static async adminSavePuzzle(_riddle: Riddle, _adminToken: string) {
    return { success: true, message: 'Question saved in frontend question registry.' };
  }

  /* -------------------------------------------------------------------------
   * Authoritative Views & Table Queries
   * ------------------------------------------------------------------------- */

  /**
   * Fetch sanitized public leaderboard.
   */
  public static async fetchPublicLeaderboard(): Promise<LeaderboardEntry[]> {
    if (!isSupabaseConfigured || !supabase) return [];
    try {
      const { data, error } = await supabase.from('public_leaderboard').select('*');
      if (error || !data) return [];

      return data.map((row: Record<string, unknown>, idx: number) => ({
        rank: idx + 1,
        teamId: String(row.team_id || ''),
        teamCode: String(row.team_code || ''),
        teamName: String(row.team_name || ''),
        status: (row.status as Team['status']) || 'ready',
        currentRound: Number(row.current_round || 1),
        completedRounds: Number(row.completed_locations || 0),
        isEligibleWinner: row.status !== 'eliminated',
        completionTimeMs: row.total_time_ms ? Number(row.total_time_ms) : null,
        strikes: Number(row.total_strikes || 0),
        totalAttempts: Number(row.completed_locations || 0),
        lastActivityAt: (row.last_activity_at as string) || new Date().toISOString(),
      }));
    } catch {
      return [];
    }
  }

  /**
   * Fetch public checkpoints (redacted without qr_token) for participants.
   */
  public static async fetchPublicLocations(): Promise<LocationCheckpoint[]> {
    if (!isSupabaseConfigured || !supabase) return [];
    try {
      const { data, error } = await supabase
        .from('public_locations')
        .select('*')
        .order('location_number');

      if (error || !data) return [];

      return data.map((l: Record<string, unknown>) => ({
        id: Number(l.id),
        locationNumber: Number(l.location_number),
        name: String(l.name),
        description: String(l.description),
        capacity: Number(l.capacity || 2),
        active: Boolean(l.active),
        qrToken: '',
      }));
    } catch {
      return [];
    }
  }

  /**
   * Fetch public event configuration.
   */
  public static async fetchPublicEventStatus(): Promise<Partial<GameEventConfig> | null> {
    if (!isSupabaseConfigured || !supabase) return null;
    try {
      let row: any = null;
      const { data, error } = await supabase.from('public_event_status').select('*').single();
      if (!error && data) {
        row = data;
      } else {
        // Direct table fallback if view is pending or not exposed
        const { data: esData } = await supabase.from('event_settings').select('*').limit(1).maybeSingle();
        if (esData) row = esData;
      }

      if (!row) return null;

      return {
        id: 'event-arena-2026',
        title: (row.event_name as string) || 'MIND MAZE 2.0',
        status: (row.status as GameEventConfig['status']) || 'ready',
        totalTeams: Number(row.total_teams || 20),
        totalRounds: Number(row.active_locations_count || 9),
        roundDurationSeconds: Number(row.round_duration_seconds || 300),
        gracePeriodSeconds: Number(row.grace_period_seconds || 30),
        eventStartedAt: (row.event_started_at as string) || null,
        eventFinishedAt: (row.event_finished_at as string) || null,
        totalPauseDurationMs: Number(row.total_pause_duration_ms || 0),
      };
    } catch {
      return null;
    }
  }

  /**
   * Fetch full teams list for admin panel.
   */
  public static async fetchAdminTeams(): Promise<Team[]> {
    if (!isSupabaseConfigured || !supabase) return [];
    try {
      const { data, error } = await supabase
        .from('teams')
        .select('id, team_code, team_name, username, credentials_configured, credentials_randomized, status, current_round, total_strikes, elimination_reason, started_at, completed_at, total_time_ms, created_at')
        .order('team_code');

      if (error || !data) return [];

      return data.map((t: Record<string, unknown>) => ({
        id: String(t.id),
        teamCode: String(t.team_code),
        teamName: String(t.team_name),
        username: (t.username as string) || null,
        credentialsConfigured: Boolean(t.credentials_configured),
        credentialsRandomized: Boolean(t.credentials_randomized),
        status: (t.status as Team['status']) || 'ready',
        currentRound: Number(t.current_round || 1),
        strikes: Number(t.total_strikes || 0),
        eliminationReason: (t.elimination_reason as string) || undefined,
        startedAt: (t.started_at as string) || undefined,
        completedAt: (t.completed_at as string) || undefined,
        totalTimeMs: t.total_time_ms ? Number(t.total_time_ms) : undefined,
        createdAt: (t.created_at as string) || new Date().toISOString(),
      }));
    } catch {
      return [];
    }
  }

  /**
   * Fetch checkpoints for admin panel.
   */
  public static async fetchAdminLocations(): Promise<LocationCheckpoint[]> {
    if (!isSupabaseConfigured || !supabase) return [];
    try {
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .order('location_number');

      if (error || !data) return [];

      return data.map((l: Record<string, unknown>) => ({
        id: Number(l.id),
        locationNumber: Number(l.location_number),
        name: String(l.name),
        description: String(l.description),
        capacity: Number(l.capacity || 2),
        active: Boolean(l.active),
        qrToken: String(l.qr_token || ''),
      }));
    } catch {
      return [];
    }
  }

  /**
   * ARCHITECTURE MANDATE: Frontend owns question content.
   * Returns questions from the frontend QuestionRegistry.
   */
  public static async fetchAdminPuzzles(): Promise<Riddle[]> {
    return QuestionRegistry.getAllQuestions().map(mapQuestionToRiddle);
  }

  /**
   * Fetch team routes.
   */
  public static async fetchRoutes(): Promise<RouteAssignment[]> {
    if (!isSupabaseConfigured || !supabase) return [];
    try {
      const { data, error } = await supabase.from('team_routes').select('team_id, round_number, location_id');
      if (error || !data) return [];

      return data.map((r: Record<string, unknown>) => ({
        teamId: String(r.team_id),
        roundNumber: Number(r.round_number),
        locationId: Number(r.location_id),
      }));
    } catch {
      return [];
    }
  }

  /**
   * Fetch round progress.
   */
  public static async fetchProgress(): Promise<TeamRoundProgress[]> {
    if (!isSupabaseConfigured || !supabase) return [];
    try {
      const { data, error } = await supabase.from('team_progress').select('*');
      if (error || !data) return [];

      return data.map((p: Record<string, unknown>) => ({
        teamId: String(p.team_id),
        roundNumber: Number(p.round_number),
        puzzleSolved: Boolean(p.puzzle_solved),
        puzzleSolvedAt: (p.puzzle_solved_at as string) || null,
        qrScanned: Boolean(p.qr_scanned),
        qrScannedAt: (p.qr_scanned_at as string) || null,
        attemptsCount: Number(p.attempts_count || 0),
        roundStartedAt: (p.round_started_at as string) || new Date().toISOString(),
        deadlineAt: (p.deadline_at as string) || new Date().toISOString(),
        graceDeadlineAt: (p.grace_deadline_at as string) || new Date().toISOString(),
        completedAt: (p.qr_scanned_at as string) || null,
        timedOut: p.status === 'timed_out',
      }));
    } catch {
      return [];
    }
  }

  /**
   * Fetch anti-cheat incidents.
   */
  public static async fetchIncidents(): Promise<AntiCheatIncident[]> {
    if (!isSupabaseConfigured || !supabase) return [];
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .in('event_type', ['anti_cheat_violation_strike', 'team_eliminated_anti_cheat'])
        .order('created_at', { ascending: false });

      if (error || !data) return [];

      return data.map((a: Record<string, unknown>) => {
        const details = (a.details as Record<string, unknown>) || {};
        const strikeNum = Number(details.strike_number || (a.event_type === 'team_eliminated_anti_cheat' ? 4 : 1));
        return {
          id: String(a.id),
          teamId: String(a.team_id || ''),
          teamCode: String(details.team_code || ''),
          teamName: String(details.team_name || ''),
          roundNumber: Number(details.round_number || 1),
          violationType: (details.violation_type as ViolationType) || 'WINDOW_BLUR',
          strikeNumber: strikeNum,
          timestamp: (a.created_at as string) || new Date().toISOString(),
          metadata: details,
          status: a.event_type === 'team_eliminated_anti_cheat' ? 'eliminated' : 'warning',
          notes: String(details.notes || ''),
        };
      });
    } catch {
      return [];
    }
  }
}

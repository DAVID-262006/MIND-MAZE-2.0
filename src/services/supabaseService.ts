import { supabase, isSupabaseConfigured, checkSupabaseConnection, type SupabaseConnectionStatus } from '../lib/supabase';
import type { Team, LocationCheckpoint, Riddle, RouteAssignment, TeamRoundProgress, AntiCheatIncident, LeaderboardEntry, GameEventConfig, ViolationType } from '../types';

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
        const isSchemaPending =
          error.code === '42883' ||
          error.code === '42P01' ||
          error.message.includes('function') ||
          error.message.includes('relation');

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
   * Team authentication: login_team(p_team_code, p_passcode, p_device_fingerprint)
   */
  public static async loginTeam(teamCode: string, passcode: string, deviceFingerprint?: string) {
    return this.callRpc<{
      success: boolean;
      team_id: string;
      team_code: string;
      team_name: string;
      session_token: string;
      current_round: number;
      status: string;
      total_score: number;
      error?: string;
      message?: string;
    }>('login_team', {
      p_team_code: teamCode.trim().toUpperCase(),
      p_passcode: passcode.trim(),
      p_device_fingerprint: deviceFingerprint || null,
    });
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
   * Submit puzzle answer: submit_puzzle_answer(p_team_id, p_session_token, p_answer)
   */
  public static async submitPuzzleAnswer(
    teamId: string,
    sessionToken: string,
    submittedAnswer: string
  ) {
    return this.callRpc<{
      success: boolean;
      correct: boolean;
      puzzle_solved: boolean;
      attempts_count: number;
      remaining_attempts?: number;
      riddle?: string;
      message: string;
      part_results?: Record<string, { correct: boolean }>;
    }>('submit_puzzle_answer', {
      p_team_id: teamId,
      p_session_token: sessionToken,
      p_answer: submittedAnswer.trim(),
    });
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
    metadata?: Record<string, unknown>
  ) {
    return this.callRpc<{
      success: boolean;
      strikeNumber: number;
      eliminated: boolean;
      message: string;
    }>('admin_record_violation', {
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
    sessionToken?: string
  ) {
    if (sessionToken) {
      return this.reportTeamViolation(teamId, sessionToken, violationType, metadata);
    }
    return this.adminRecordViolation(teamId, violationType, metadata);
  }

  /* -------------------------------------------------------------------------
   * Admin Authentication & Session Management
   * ------------------------------------------------------------------------- */

  /**
   * Admin Supabase Auth sign-in with email & password.
   * Verifies that the authenticated user is listed in admin_profiles with an authorized role.
   */
  public static async adminLogin(email: string, password: string): Promise<{
    success: boolean;
    role?: string;
    error?: string;
  }> {
    if (!isSupabaseConfigured || !supabase) {
      return {
        success: false,
        error: 'Supabase is not configured. Please configure VITE_SUPABASE_URL and key in .env.local.',
      };
    }

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authError || !authData.user) {
        return {
          success: false,
          error: authError?.message || 'Authentication failed: Invalid credentials.',
        };
      }

      // Verify the user exists in admin_profiles
      const { data: profile, error: profileError } = await supabase
        .from('admin_profiles')
        .select('id, email, full_name, role')
        .eq('id', authData.user.id)
        .maybeSingle();

      if (profileError || !profile) {
        // User is not authorized in admin_profiles; immediately terminate session
        await supabase.auth.signOut();
        return {
          success: false,
          error: 'Access Denied: Your account is not registered in admin_profiles.',
        };
      }

      if (!['superadmin', 'admin', 'marshal'].includes(profile.role)) {
        await supabase.auth.signOut();
        return {
          success: false,
          error: `Access Denied: Role "${profile.role}" is not authorized for admin operations.`,
        };
      }

      return {
        success: true,
        role: profile.role,
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
   * Admin Supabase Auth sign-out.
   */
  public static async adminLogout(): Promise<{ success: boolean; error?: string }> {
    if (!supabase) return { success: true };
    try {
      await supabase.auth.signOut();
      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  }

  /**
   * Check if current session belongs to a valid administrator in admin_profiles.
   */
  public static async checkAdminSession(): Promise<{
    isAuthenticated: boolean;
    role?: string;
    userId?: string;
  }> {
    if (!isSupabaseConfigured || !supabase) {
      return { isAuthenticated: false };
    }

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session?.user) {
        return { isAuthenticated: false };
      }

      const userId = sessionData.session.user.id;
      const { data: profile, error: profileError } = await supabase
        .from('admin_profiles')
        .select('id, role')
        .eq('id', userId)
        .maybeSingle();

      if (profileError || !profile || !['superadmin', 'admin', 'marshal'].includes(profile.role)) {
        return { isAuthenticated: false };
      }

      return {
        isAuthenticated: true,
        role: profile.role,
        userId,
      };
    } catch {
      return { isAuthenticated: false };
    }
  }

  /* -------------------------------------------------------------------------
   * Event Lifecycle RPCs (Admin Controlled)
   * ------------------------------------------------------------------------- */

  public static async setEventStatus(status: 'draft' | 'ready' | 'live' | 'paused' | 'finished') {
    return this.callRpc<{ success: boolean; status: string; message: string }>('admin_set_event_status', {
      p_status: status,
    });
  }

  public static async startEvent() {
    return this.callRpc<{ success: boolean; status: string; message: string }>('admin_start_event');
  }

  public static async pauseEvent() {
    return this.callRpc<{ success: boolean; status: string; message: string }>('admin_pause_event');
  }

  public static async resumeEvent() {
    return this.callRpc<{ success: boolean; status: string; message: string }>('admin_resume_event');
  }

  public static async endEvent() {
    return this.callRpc<{ success: boolean; status: string; message: string }>('admin_end_event');
  }

  /* -------------------------------------------------------------------------
   * Admin Operations RPCs
   * ------------------------------------------------------------------------- */

  public static async reinstateTeam(teamId: string) {
    return this.callRpc<{ success: boolean; message: string }>('admin_reinstate_team', {
      p_team_id: teamId,
    });
  }

  public static async eliminateTeam(teamId: string, reason: string) {
    return this.callRpc<{ success: boolean; message: string }>('admin_eliminate_team', {
      p_team_id: teamId,
      p_reason: reason,
    });
  }

  public static async adminResetTeamSession(teamId: string) {
    return this.callRpc<{ success: boolean; message: string }>('admin_reset_team_session', {
      p_team_id: teamId,
    });
  }

  public static async adminResetTeamProgress(teamId: string) {
    return this.callRpc<{ success: boolean; message: string }>('admin_reset_team_progress', {
      p_team_id: teamId,
    });
  }

  public static async adminRegenerateEventQrTokens(confirmationCode?: string) {
    return this.callRpc<{ success: boolean; regenerated_locations: number; timestamp: string; message: string }>(
      'admin_regenerate_event_qr_tokens',
      { p_confirmation_code: confirmationCode || null }
    );
  }

  public static async adminUpdateLocation(
    locationId: number,
    name: string,
    description: string,
    capacity: number
  ) {
    return this.callRpc<{ success: boolean; message: string }>('admin_update_location', {
      p_location_id: locationId,
      p_name: name,
      p_description: description,
      p_capacity: capacity,
    });
  }

  public static async adminRegenerateLocationToken(locationId: number) {
    return this.callRpc<{ success: boolean; qrToken: string; message: string }>('admin_regenerate_location_token', {
      p_location_id: locationId,
    });
  }

  public static async generateTeamRoutes(activeLocations = 10) {
    return this.callRpc<{ success: boolean; message: string }>('generate_team_routes', {
      p_active_locations: activeLocations,
    });
  }

  public static async adminSavePuzzle(riddle: Riddle) {
    return this.callRpc<{ success: boolean; message: string }>('admin_save_puzzle', {
      p_id: riddle.id,
      p_round_number: riddle.roundNumber,
      p_title: riddle.title,
      p_puzzle_type: riddle.puzzleType,
      p_description_md: riddle.descriptionMd,
      p_accepted_answers: riddle.acceptedAnswers || [],
      p_riddle_text: riddle.riddleClue || riddle.descriptionMd,
      p_hints: riddle.hints || [],
      p_options: riddle.options || [],
      p_correct_option_index: riddle.correctOptionIndex ?? null,
      p_image_url: riddle.imageUrl ?? null,
      p_image_alt: riddle.imageAlt ?? null,
      p_three_part_questions: riddle.threePartQuestions || {},
      p_three_part_answers: riddle.threePartAnswers || {},
      p_code_language: riddle.codeLanguage || 'python',
      p_code_snippet: riddle.codeSnippet || '',
      p_is_active: riddle.isActive ?? true,
    });
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
      const { data, error } = await supabase.from('public_event_status').select('*').single();
      if (error || !data) return null;

      return {
        id: 'event-arena-2026',
        title: (data.event_name as string) || 'MIND MAZE 2.0',
        status: (data.status as GameEventConfig['status']) || 'ready',
        totalTeams: Number(data.total_teams || 20),
        totalRounds: Number(data.active_locations_count || 10),
        roundDurationSeconds: Number(data.round_duration_seconds || 300),
        gracePeriodSeconds: Number(data.grace_period_seconds || 30),
        eventStartedAt: (data.event_started_at as string) || null,
        eventFinishedAt: (data.event_finished_at as string) || null,
        totalPauseDurationMs: Number(data.total_pause_duration_ms || 0),
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
        .select('id, team_code, team_name, status, current_round, total_strikes, elimination_reason, started_at, completed_at, total_time_ms, created_at')
        .order('team_code');

      if (error || !data) return [];

      return data.map((t: Record<string, unknown>) => ({
        id: String(t.id),
        teamCode: String(t.team_code),
        teamName: String(t.team_name),
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
   * Fetch puzzles for admin panel.
   */
  public static async fetchAdminPuzzles(): Promise<Riddle[]> {
    if (!isSupabaseConfigured || !supabase) return [];
    try {
      const { data, error } = await supabase
        .from('puzzles')
        .select('*')
        .order('round_number');

      if (error || !data) return [];

      return data.map((p: Record<string, unknown>) => ({
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
        riddleClue: (p.riddle_text as string) || undefined,
        isActive: p.is_active !== undefined ? Boolean(p.is_active) : true,
      }));
    } catch {
      return [];
    }
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

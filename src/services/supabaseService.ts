import { supabase, isSupabaseConfigured, checkSupabaseConnection, type SupabaseConnectionStatus } from '../lib/supabase';

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
 * Service layer coordinating Supabase remote calls and local fallback.
 * Strictly adheres to non-destructive principles:
 * - Does not break if database schema is not yet applied.
 * - Accurately reports connection state.
 */
export class SupabaseService {
  private static cachedStatus: SupabaseConnectionStatus | null = null;
  private static lastCheckTime = 0;
  private static readonly CACHE_TTL_MS = 15000; // 15 seconds cache

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
   * Catches missing table/procedure errors gracefully when database schema
   * is pending deployment, returning structured diagnostics.
   */
  public static async callRpc<T = unknown>(
    procedureName: string,
    params: Record<string, unknown> = {}
  ): Promise<BackendRpcResponse<T>> {
    if (!isSupabaseConfigured || !supabase) {
      return {
        success: false,
        error: 'Supabase client is not configured. Local storage fallback active.',
        isFallback: true,
      };
    }

    try {
      const { data, error } = await supabase.rpc(procedureName, params);

      if (error) {
        // PostgREST code 42883 = function does not exist (schema pending)
        // PostgREST code 42P01 = table does not exist
        const isSchemaPending =
          error.code === '42883' ||
          error.code === '42P01' ||
          error.message.includes('function') ||
          error.message.includes('relation');

        return {
          success: false,
          error: isSchemaPending
            ? `Remote procedure '${procedureName}' is not yet deployed on Supabase. (Schema pending review)`
            : error.message,
          isFallback: isSchemaPending,
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
   * Stored Procedure Wrappers (Matching supabase/schema.sql)
   * When remote schema is applied, these directly execute server-side logic.
   * ------------------------------------------------------------------------- */

  /**
   * Team authentication RPC: login_team(p_team_code, p_passcode)
   */
  public static async loginTeam(teamCode: string, passcode: string) {
    return this.callRpc<{
      team_id: string;
      team_code: string;
      team_name: string;
      session_token: string;
      current_round: number;
      status: string;
      total_score: number;
    }>('login_team', {
      p_team_code: teamCode.trim().toUpperCase(),
      p_passcode: passcode.trim(),
    });
  }

  /**
   * Team logout RPC: logout_team(p_team_id, p_session_token)
   */
  public static async logoutTeam(teamId: string, sessionToken: string) {
    return this.callRpc<{ success: boolean; message: string }>('logout_team', {
      p_team_id: teamId,
      p_session_token: sessionToken,
    });
  }

  /**
   * Start team journey RPC: start_team_journey(p_team_id, p_session_token)
   */
  public static async startTeamJourney(teamId: string, sessionToken: string) {
    return this.callRpc<{
      team_id: string;
      current_round: number;
      assigned_location_id: number;
      assigned_location_name: string;
      puzzle_id: number;
      puzzle_title: string;
      round_started_at: string;
    }>('start_team_journey', {
      p_team_id: teamId,
      p_session_token: sessionToken,
    });
  }

  /**
   * Submit puzzle answer RPC: submit_puzzle_answer(p_team_id, p_session_token, p_round_number, p_submitted_answer)
   */
  public static async submitPuzzleAnswer(
    teamId: string,
    sessionToken: string,
    roundNumber: number,
    submittedAnswer: string
  ) {
    return this.callRpc<{
      correct: boolean;
      attempts_count: number;
      message: string;
      next_step: string;
      checkpoint_name?: string;
    }>('submit_puzzle_answer', {
      p_team_id: teamId,
      p_session_token: sessionToken,
      p_round_number: roundNumber,
      p_submitted_answer: submittedAnswer.trim(),
    });
  }

  /**
   * Verify QR token RPC: verify_location_qr(p_team_id, p_session_token, p_round_number, p_scanned_token)
   */
  public static async verifyLocationQr(
    teamId: string,
    sessionToken: string,
    roundNumber: number,
    scannedToken: string
  ) {
    return this.callRpc<{
      verified: boolean;
      points_awarded: number;
      round_completed: number;
      next_round: number;
      is_game_finished: boolean;
      message: string;
    }>('verify_location_qr', {
      p_team_id: teamId,
      p_session_token: sessionToken,
      p_round_number: roundNumber,
      p_scanned_token: scannedToken.trim(),
    });
  }

  /**
   * Complete journey RPC: complete_team_journey(p_team_id, p_session_token)
   */
  public static async completeTeamJourney(teamId: string, sessionToken: string) {
    return this.callRpc<{
      completed: boolean;
      final_rank?: number;
      total_time_seconds?: number;
      message: string;
    }>('complete_team_journey', {
      p_team_id: teamId,
      p_session_token: sessionToken,
    });
  }

  /**
   * Admin Reset Team Session RPC: admin_reset_team_session(p_team_id)
   */
  public static async adminResetTeamSession(teamId: string) {
    return this.callRpc<{ success: boolean; message: string }>('admin_reset_team_session', {
      p_team_id: teamId,
    });
  }

  /**
   * Admin Reset Team Progress RPC: admin_reset_team_progress(p_team_id)
   */
  public static async adminResetTeamProgress(teamId: string) {
    return this.callRpc<{ success: boolean; message: string }>('admin_reset_team_progress', {
      p_team_id: teamId,
    });
  }

  /**
   * Admin Regenerate Event QR Tokens RPC: admin_regenerate_event_qr_tokens(p_confirmation_code)
   */
  public static async adminRegenerateEventQrTokens(confirmationCode: string) {
    return this.callRpc<{ regenerated_locations: number; timestamp: string }>(
      'admin_regenerate_event_qr_tokens',
      { p_confirmation_code: confirmationCode }
    );
  }
}


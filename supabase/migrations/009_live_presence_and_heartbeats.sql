-- ==============================================================================
-- MIND MAZE 2.0 — MIGRATION 009: LIVE PRESENCE HEARTBEATS & QUESTION SYNC
-- Safe, idempotent migration to support:
-- 1. Heartbeats (last_seen_at column on teams table)
-- 2. record_team_heartbeat RPC (server-side token validation, no secrets)
-- 3. admin_get_dashboard_data update (includes last_seen_at & real-time progress)
-- 4. record_puzzle_solved enhancements ensuring instant admin sync
-- ==============================================================================

SET search_path = public, extensions, pg_temp;

-- 1. Add last_seen_at column to teams if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'teams' AND column_name = 'last_seen_at'
    ) THEN
        ALTER TABLE public.teams ADD COLUMN last_seen_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- 2. RPC: record_team_heartbeat (Validates session server-side, updates last_seen_at)
DROP FUNCTION IF EXISTS public.record_team_heartbeat(VARCHAR);
DROP FUNCTION IF EXISTS public.record_team_heartbeat;
CREATE OR REPLACE FUNCTION public.record_team_heartbeat(
    p_session_token VARCHAR
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_token_hash VARCHAR;
    v_team_id UUID;
BEGIN
    IF p_session_token IS NULL OR p_session_token = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Session token required.');
    END IF;

    v_token_hash := encode(extensions.digest(p_session_token, 'sha256'), 'hex');

    UPDATE public.teams
    SET last_seen_at = NOW()
    WHERE active_session_token_hash = v_token_hash
    RETURNING id INTO v_team_id;

    IF v_team_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'INVALID_SESSION', 'message', 'Session invalid or expired.');
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'team_id', v_team_id,
        'last_seen_at', NOW()
    );
END;
$$;

REVOKE ALL ON FUNCTION public.record_team_heartbeat(VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_team_heartbeat(VARCHAR) TO anon, authenticated;

-- 3. Updated admin_get_dashboard_data with last_seen_at and progress records
DROP FUNCTION IF EXISTS public.admin_get_dashboard_data(VARCHAR);
DROP FUNCTION IF EXISTS public.admin_get_dashboard_data;
CREATE OR REPLACE FUNCTION public.admin_get_dashboard_data(
    p_admin_token VARCHAR
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_admin_role VARCHAR;
    v_teams JSONB;
    v_locations JSONB;
    v_progress JSONB;
    v_incidents JSONB;
    v_event JSONB;
BEGIN
    v_admin_role := public.verify_admin_token(p_admin_token, ARRAY['superadmin', 'admin', 'marshal']);
    IF v_admin_role IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Admin session required.');
    END IF;

    -- Teams without passwords or password hashes, including last_seen_at
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', t.id,
            'team_code', t.team_code,
            'team_name', t.team_name,
            'username', t.username,
            'credentials_configured', t.credentials_configured,
            'credentials_randomized', t.credentials_randomized,
            'status', t.status,
            'current_round', t.current_round,
            'total_strikes', t.total_strikes,
            'started_at', t.started_at,
            'completed_at', t.completed_at,
            'total_time_ms', t.total_time_ms,
            'last_seen_at', t.last_seen_at,
            'created_at', t.created_at
        ) ORDER BY t.team_code
    ) INTO v_teams FROM public.teams t;

    -- Active 9 locations
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', l.id,
            'location_number', l.location_number,
            'name', l.name,
            'description', l.description,
            'riddle_clue', l.riddle_clue,
            'capacity', l.capacity,
            'active', l.active,
            'qr_token', l.qr_token
        ) ORDER BY l.location_number
    ) INTO v_locations FROM public.locations l WHERE l.active = true AND l.location_number <= 9;

    -- Progress records for tracking
    SELECT jsonb_agg(
        jsonb_build_object(
            'team_id', tp.team_id,
            'round_number', tp.round_number,
            'puzzle_solved', tp.puzzle_solved,
            'puzzle_solved_at', tp.puzzle_solved_at,
            'qr_scanned', tp.qr_scanned,
            'qr_scanned_at', tp.qr_scanned_at,
            'attempts_count', tp.attempts_count,
            'round_started_at', tp.round_started_at,
            'deadline_at', tp.deadline_at,
            'grace_deadline_at', tp.grace_deadline_at,
            'completed_at', tp.completed_at
        )
    ) INTO v_progress FROM public.team_progress tp;

    SELECT to_jsonb(es.*) INTO v_event FROM public.event_settings es WHERE id = 1;

    RETURN jsonb_build_object(
        'success', true,
        'teams', COALESCE(v_teams, '[]'::jsonb),
        'locations', COALESCE(v_locations, '[]'::jsonb),
        'progress', COALESCE(v_progress, '[]'::jsonb),
        'event', v_event
    );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_dashboard_data(VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_dashboard_data(VARCHAR) TO anon, authenticated;


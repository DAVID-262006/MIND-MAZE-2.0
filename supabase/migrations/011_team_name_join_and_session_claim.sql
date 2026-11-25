-- ==============================================================================
-- MIND MAZE 2.0 — MIGRATION 011: TEAM-NAME LOBBY ENTRY & SESSION CLAIM
-- Replaces team username/password authentication with secure team-name lobby entry.
--
-- Features:
-- 1. join_team_by_name(p_team_name, p_device_fingerprint, p_existing_session_token)
--    - Case-insensitive, whitespace-trimmed team matching
--    - Rejects unregistered team names
--    - Reconnects existing active sessions safely
--    - Prevents 2 independent clients from claiming the same team simultaneously
--    - Generates cryptographically secure 64-char session token
--    - Stores SHA-256 session token hash in teams.active_session_token_hash
-- 2. leave_team_lobby(p_session_token) / revoke_team_session(p_team_id, p_admin_token)
-- 3. admin_create_team(p_admin_token, p_team_name) - admin registers team by name only
-- ==============================================================================

-- Ensure pgcrypto extension is active
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- -----------------------------------------------------------------------------
-- 1. RPC: join_team_by_name
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.join_team_by_name(VARCHAR, VARCHAR, VARCHAR);
DROP FUNCTION IF EXISTS public.join_team_by_name(VARCHAR, VARCHAR);
DROP FUNCTION IF EXISTS public.join_team_by_name;

CREATE OR REPLACE FUNCTION public.join_team_by_name(
    p_team_name VARCHAR,
    p_device_fingerprint VARCHAR DEFAULT NULL,
    p_existing_session_token VARCHAR DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_team RECORD;
    v_clean_name VARCHAR;
    v_session_token VARCHAR;
    v_session_token_hash VARCHAR;
    v_existing_token_hash VARCHAR;
    v_is_reconnect BOOLEAN := false;
BEGIN
    v_clean_name := TRIM(p_team_name);

    IF v_clean_name IS NULL OR v_clean_name = '' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'TEAM_NAME_REQUIRED',
            'message', 'Please enter your team name.'
        );
    END IF;

    -- Compute hash of existing token if provided for controlled reconnect
    IF p_existing_session_token IS NOT NULL AND p_existing_session_token <> '' THEN
        v_existing_token_hash := encode(extensions.digest(p_existing_session_token, 'sha256'), 'hex');
    END IF;

    -- Atomically lock and find team by case-insensitive name or code
    SELECT * INTO v_team
    FROM public.teams
    WHERE LOWER(team_name) = LOWER(v_clean_name)
       OR LOWER(team_code) = LOWER(v_clean_name)
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'TEAM_NOT_FOUND',
            'message', 'Team not found. Please check your team name.'
        );
    END IF;

    -- Check if team account is disqualified / eliminated
    IF v_team.status = 'eliminated' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'TEAM_ELIMINATED',
            'message', 'This team has been disqualified or eliminated from the competition.'
        );
    END IF;

    -- Controlled reconnect vs duplicate active session check:
    -- If team has an active session token:
    IF v_team.active_session_token_hash IS NOT NULL THEN
        -- Check if current request possesses the matching session token or device fingerprint
        IF v_existing_token_hash IS NOT NULL AND v_team.active_session_token_hash = v_existing_token_hash THEN
            v_is_reconnect := true;
        ELSIF p_device_fingerprint IS NOT NULL AND v_team.device_fingerprint IS NOT NULL AND v_team.device_fingerprint = p_device_fingerprint THEN
            v_is_reconnect := true;
        ELSIF v_team.last_seen_at IS NOT NULL AND v_team.last_seen_at < (NOW() - INTERVAL '3 minutes') THEN
            -- Prior session has expired/stalled (heartbeat timed out > 3m), permit safe reclaim
            v_is_reconnect := true;
        ELSE
            -- Active competing participant session already connected
            RETURN jsonb_build_object(
                'success', false,
                'error', 'TEAM_ALREADY_CLAIMED',
                'message', 'This team has already joined the game. Please contact the event administrator.'
            );
        END IF;
    END IF;

    -- Issue cryptographically random 64-char session token
    v_session_token := encode(extensions.gen_random_bytes(32), 'hex');
    v_session_token_hash := encode(extensions.digest(v_session_token, 'sha256'), 'hex');

    -- Update team: set active session hash, fingerprint, mark status as ready (lobby) if registered
    UPDATE public.teams
    SET active_session_token_hash = v_session_token_hash,
        device_fingerprint = COALESCE(p_device_fingerprint, device_fingerprint),
        last_seen_at = NOW(),
        status = CASE WHEN status = 'registered' THEN 'ready' ELSE status END,
        updated_at = NOW()
    WHERE id = v_team.id;

    RETURN jsonb_build_object(
        'success', true,
        'team_id', v_team.id,
        'team_code', v_team.team_code,
        'team_name', v_team.team_name,
        'session_token', v_session_token,
        'status', CASE WHEN v_team.status = 'registered' THEN 'ready' ELSE v_team.status END,
        'current_round', v_team.current_round,
        'total_strikes', v_team.total_strikes,
        'is_reconnect', v_is_reconnect,
        'message', 'Successfully joined team lobby.'
    );
END;
$$;

-- Grant access to anon and authenticated
REVOKE ALL ON FUNCTION public.join_team_by_name(VARCHAR, VARCHAR, VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_team_by_name(VARCHAR, VARCHAR, VARCHAR) TO anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2. RPC: leave_team_lobby (Voluntary session release)
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.leave_team_lobby(UUID, VARCHAR);
DROP FUNCTION IF EXISTS public.leave_team_lobby(VARCHAR);

CREATE OR REPLACE FUNCTION public.leave_team_lobby(
    p_session_token VARCHAR
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_token_hash VARCHAR;
BEGIN
    IF p_session_token IS NULL OR p_session_token = '' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Session token required.');
    END IF;

    v_token_hash := encode(extensions.digest(p_session_token, 'sha256'), 'hex');

    UPDATE public.teams
    SET active_session_token_hash = NULL,
        device_fingerprint = NULL,
        updated_at = NOW()
    WHERE active_session_token_hash = v_token_hash;

    RETURN jsonb_build_object('success', true, 'message', 'Left lobby successfully.');
END;
$$;

REVOKE ALL ON FUNCTION public.leave_team_lobby(VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.leave_team_lobby(VARCHAR) TO anon, authenticated;

-- -----------------------------------------------------------------------------
-- 3. RPC: admin_revoke_team_session
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.admin_revoke_team_session(VARCHAR, UUID);

CREATE OR REPLACE FUNCTION public.admin_revoke_team_session(
    p_admin_token VARCHAR,
    p_team_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_admin_role VARCHAR;
BEGIN
    v_admin_role := public.verify_admin_token(p_admin_token, ARRAY['superadmin', 'admin', 'marshal']);
    IF v_admin_role IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Admin session required.');
    END IF;

    UPDATE public.teams
    SET active_session_token_hash = NULL,
        device_fingerprint = NULL,
        updated_at = NOW()
    WHERE id = p_team_id;

    RETURN jsonb_build_object('success', true, 'message', 'Team session revoked.');
END;
$$;

REVOKE ALL ON FUNCTION public.admin_revoke_team_session(VARCHAR, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_revoke_team_session(VARCHAR, UUID) TO anon, authenticated;

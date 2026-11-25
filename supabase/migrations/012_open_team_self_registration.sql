-- ==============================================================================
-- MIND MAZE 2.0 — MIGRATION 012: OPEN TEAM-NAME SELF-REGISTRATION & LOBBY ENTRY
-- Allows any participant with the game link to enter ANY team name and join the lobby.
-- If the team does not exist, it is automatically registered atomically on the server.
-- If the team already exists, duplicate claiming by another active device is blocked,
-- while the existing device can safely reconnect.
--
-- Features:
-- 1. join_team_by_name(p_team_name, p_device_fingerprint, p_existing_session_token)
--    - Normalizes team name (TRIM + case-insensitive comparison)
--    - If team exists:
--        * Checks if eliminated
--        * Validates existing session token / fingerprint for controlled reconnect
--        * Rejects duplicate join from another active device ("This team name is already taken. Please choose another name.")
--    - If team does NOT exist:
--        * Automatically registers new team in public.teams
--        * Generates server-side UUID and short uppercase team code (e.g. T-XXXX)
--        * Sets status = 'ready' (in lobby awaiting admin start)
--        * Sets joined_at / created_at = NOW()
--    - Issues cryptographically secure 64-char session token
--    - Stores SHA-256 session token hash in teams.active_session_token_hash
-- 2. Concurrency: Protected with transaction-level advisory locks to prevent
--    race conditions from creating duplicate team records with the same name.
-- ==============================================================================

-- Ensure pgcrypto extension is active
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Ensure public.teams allows dynamic teams and has necessary tracking columns
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'teams' AND column_name = 'active_session_token_hash'
    ) THEN
        ALTER TABLE public.teams ADD COLUMN active_session_token_hash VARCHAR(64);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'teams' AND column_name = 'device_fingerprint'
    ) THEN
        ALTER TABLE public.teams ADD COLUMN device_fingerprint VARCHAR(255);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'teams' AND column_name = 'last_seen_at'
    ) THEN
        ALTER TABLE public.teams ADD COLUMN last_seen_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- Create functional unique index on LOWER(TRIM(team_name)) if not already present
CREATE UNIQUE INDEX IF NOT EXISTS idx_teams_unique_lower_name ON public.teams (LOWER(TRIM(team_name)));

-- -----------------------------------------------------------------------------
-- RPC: join_team_by_name (Self-Registration & Session Claim)
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
    v_new_team_id UUID;
    v_new_team_code VARCHAR;
    v_code_candidate VARCHAR;
    v_counter INT := 0;
    v_session_token VARCHAR;
    v_session_token_hash VARCHAR;
    v_existing_token_hash VARCHAR;
    v_is_reconnect BOOLEAN := false;
    v_lock_key BIGINT;
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

    -- Compute deterministic lock key based on lowercased clean team name
    -- to serialize concurrent join attempts with the exact same name
    v_lock_key := ('x' || substr(md5(LOWER(v_clean_name)), 1, 15))::bit(64)::bigint;
    PERFORM pg_advisory_xact_lock(v_lock_key);

    -- Check if team exists (by name or code)
    SELECT * INTO v_team
    FROM public.teams
    WHERE LOWER(TRIM(team_name)) = LOWER(v_clean_name)
       OR LOWER(TRIM(team_code)) = LOWER(v_clean_name)
    FOR UPDATE;

    IF FOUND THEN
        -- Check if team account is disqualified / eliminated
        IF v_team.status = 'eliminated' THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'TEAM_ELIMINATED',
                'message', 'This team has been disqualified or eliminated from the competition.'
            );
        END IF;

        -- Controlled reconnect vs duplicate active session check
        IF v_team.active_session_token_hash IS NOT NULL THEN
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
                    'error', 'TEAM_ALREADY_TAKEN',
                    'message', 'This team name is already taken. Please choose another name.'
                );
            END IF;
        END IF;

        -- Issue cryptographically random 64-char session token
        v_session_token := encode(extensions.gen_random_bytes(32), 'hex');
        v_session_token_hash := encode(extensions.digest(v_session_token, 'sha256'), 'hex');

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
    ELSE
        -- Automatically register new team in Supabase
        v_new_team_id := gen_random_uuid();
        
        -- Generate a unique team code (e.g. T-A1B2 or based on initials)
        v_counter := 0;
        LOOP
            v_counter := v_counter + 1;
            v_code_candidate := 'T' || UPPER(SUBSTR(MD5(v_clean_name || v_counter::text || NOW()::text), 1, 4));
            EXIT WHEN NOT EXISTS (SELECT 1 FROM public.teams WHERE team_code = v_code_candidate);
            IF v_counter > 50 THEN
                v_code_candidate := 'T' || UPPER(SUBSTR(MD5(gen_random_uuid()::text), 1, 6));
                EXIT;
            END IF;
        END LOOP;
        v_new_team_code := v_code_candidate;

        -- Issue cryptographically random 64-char session token
        v_session_token := encode(extensions.gen_random_bytes(32), 'hex');
        v_session_token_hash := encode(extensions.digest(v_session_token, 'sha256'), 'hex');

        INSERT INTO public.teams (
            id,
            team_code,
            team_name,
            passcode_hash,
            status,
            current_round,
            total_strikes,
            active_session_token_hash,
            device_fingerprint,
            last_seen_at,
            created_at,
            updated_at
        ) VALUES (
            v_new_team_id,
            v_new_team_code,
            v_clean_name,
            encode(extensions.digest(v_session_token, 'sha256'), 'hex'), -- dummy non-reversible hash
            'ready',
            1,
            0,
            v_session_token_hash,
            p_device_fingerprint,
            NOW(),
            NOW(),
            NOW()
        );

        RETURN jsonb_build_object(
            'success', true,
            'team_id', v_new_team_id,
            'team_code', v_new_team_code,
            'team_name', v_clean_name,
            'session_token', v_session_token,
            'status', 'ready',
            'current_round', 1,
            'total_strikes', 0,
            'is_reconnect', false,
            'message', 'Team registered and joined lobby.'
        );
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.join_team_by_name(VARCHAR, VARCHAR, VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_team_by_name(VARCHAR, VARCHAR, VARCHAR) TO anon, authenticated;

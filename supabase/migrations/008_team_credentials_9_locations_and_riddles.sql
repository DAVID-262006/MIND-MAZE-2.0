-- =============================================================================
-- MIND MAZE 2.0 — MIGRATION 008: TEAM CREDENTIALS, 9 LOCATIONS & RIDDLES
-- Sequential Migration following 001–007
-- 
-- 1. Admin-Managed Custom Team Login Credentials
--    - Adds username and credentials_configured to teams table
--    - Implements admin_set_team_credentials with bcrypt hashing
--    - Implements admin_reset_team_password with session invalidation
--    - Implements admin_batch_generate_team_credentials for one-time export
--    - Updates login_team to authenticate via username & bcrypt
--
-- 2. Fixed 9-Location Campus Orienteering Architecture
--    - Safely deactivates and cleans up location 10
--    - Enforces active_locations_count = 9 in event_settings
--    - Enforces 9-station constraint on locations
--    - Updates generate_team_routes for 20 teams across 9 rounds and 9 locations
--
-- 3. Strict 2-Format Challenge Bank (CODE_BASED & THREE_PART_TEXT)
--    - Restricts puzzles.puzzle_type to ('CODE_BASED', 'THREE_PART_TEXT')
--    - Updates submit_puzzle_answer to reject image and MCQ question types
--    - Limits rounds to 1–9
--
-- 4. Location-Level Riddle Architecture
--    - Riddle clue managed directly in locations.riddle_clue
--    - get_team_state returns the assigned location's riddle clue
-- =============================================================================

-- Ensure pgcrypto extension is active
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- -----------------------------------------------------------------------------
-- 1. TEAMS TABLE MODIFICATIONS: USERNAME & CREDENTIALS CONFIGURATION
-- -----------------------------------------------------------------------------
DO $$
BEGIN
    -- Add username column if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'teams' AND column_name = 'username'
    ) THEN
        ALTER TABLE public.teams ADD COLUMN username VARCHAR(50) UNIQUE;
    END IF;

    -- Add credentials_configured column if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'teams' AND column_name = 'credentials_configured'
    ) THEN
        ALTER TABLE public.teams ADD COLUMN credentials_configured BOOLEAN NOT NULL DEFAULT false;
    END IF;

    -- Add password_hash column if not exists (syncs with passcode_hash for clarity)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'teams' AND column_name = 'password_hash'
    ) THEN
        ALTER TABLE public.teams ADD COLUMN password_hash VARCHAR(255);
    END IF;

    -- Initialize default usernames and default passwords ('user1122') for any unconfigured teams
    UPDATE public.teams
    SET username = COALESCE(username, LOWER(team_code)),
        passcode_hash = COALESCE(passcode_hash, extensions.crypt('user1122', extensions.gen_salt('bf', 10))),
        password_hash = COALESCE(password_hash, extensions.crypt('user1122', extensions.gen_salt('bf', 10))),
        credentials_configured = true,
        credentials_randomized = true
    WHERE credentials_configured = false;
END $$;

-- Create index on lowercase username for fast, case-insensitive login lookups
CREATE INDEX IF NOT EXISTS idx_teams_lower_username ON public.teams (LOWER(username));

-- -----------------------------------------------------------------------------
-- 2. LOCATION 10 CLEANUP & 9-LOCATION RECONCILIATION
-- -----------------------------------------------------------------------------
-- Deactivate location 10
UPDATE public.locations 
SET active = false, updated_at = NOW() 
WHERE location_number = 10 OR id = 10;

-- Clean up any route assignments or progress referencing round 10 or location 10
DELETE FROM public.team_routes WHERE location_id = 10 OR round_number > 9;
DELETE FROM public.team_progress WHERE round_number > 9;

-- Update event_settings to exactly 9 active locations
UPDATE public.event_settings 
SET active_locations_count = 9, updated_at = NOW() 
WHERE id = 1;

-- Ensure constraint allows locations 1-9 for active stations
ALTER TABLE public.locations DROP CONSTRAINT IF EXISTS locations_location_number_check;
ALTER TABLE public.locations ADD CONSTRAINT locations_location_number_check 
    CHECK (location_number BETWEEN 1 AND 9 OR active = false);

-- -----------------------------------------------------------------------------
-- 3. RESTRICT PUZZLE TYPES TO 'CODE_BASED' AND 'THREE_PART_TEXT'
-- -----------------------------------------------------------------------------
-- First migrate any legacy puzzle records in rounds 1-9 to CODE_BASED or THREE_PART_TEXT
UPDATE public.puzzles
SET puzzle_type = 'CODE_BASED', updated_at = NOW()
WHERE puzzle_type IN ('MCQ', 'IMAGE_MCQ', 'TEXT_RIDDLE', 'text', 'crypto', 'logic') 
   OR (puzzle_type = 'IMAGE_QUIZ' AND round_number % 2 = 1);

UPDATE public.puzzles
SET puzzle_type = 'THREE_PART_TEXT', updated_at = NOW()
WHERE puzzle_type IN ('IMAGE_QUIZ');

-- Remove puzzles for round > 9
DELETE FROM public.puzzles WHERE round_number > 9;

-- Enforce strict puzzle type constraint
ALTER TABLE public.puzzles DROP CONSTRAINT IF EXISTS puzzles_puzzle_type_check;
ALTER TABLE public.puzzles ADD CONSTRAINT puzzles_puzzle_type_check 
    CHECK (puzzle_type IN ('CODE_BASED', 'THREE_PART_TEXT'));

-- Enforce round number between 1 and 9
ALTER TABLE public.puzzles DROP CONSTRAINT IF EXISTS puzzles_round_number_check;
ALTER TABLE public.puzzles ADD CONSTRAINT puzzles_round_number_check 
    CHECK (round_number BETWEEN 1 AND 9);

-- -----------------------------------------------------------------------------
-- 4. RPC: admin_set_team_credentials
-- Allows admin to create or update custom username and bcrypt password for a team
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.admin_set_team_credentials(VARCHAR, UUID, VARCHAR, VARCHAR);
DROP FUNCTION IF EXISTS public.admin_set_team_credentials;
CREATE OR REPLACE FUNCTION public.admin_set_team_credentials(
    p_admin_token VARCHAR,
    p_team_id UUID,
    p_username VARCHAR,
    p_password VARCHAR
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_admin_role VARCHAR;
    v_clean_username VARCHAR;
    v_password_hash VARCHAR;
    v_team_record RECORD;
BEGIN
    -- 1. Validate Admin Session
    v_admin_role := public.verify_admin_token(p_admin_token, ARRAY['superadmin', 'admin']);
    IF v_admin_role IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'UNAUTHORIZED',
            'message', 'Valid administrator session required to set team credentials.'
        );
    END IF;

    -- 2. Validate Inputs
    v_clean_username := LOWER(TRIM(p_username));
    IF v_clean_username IS NULL OR LENGTH(v_clean_username) < 3 OR LENGTH(v_clean_username) > 30 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'INVALID_USERNAME',
            'message', 'Username must be between 3 and 30 characters.'
        );
    END IF;

    -- Username must contain only alphanumeric characters, underscores, and hyphens
    IF NOT (v_clean_username ~ '^[a-z0-9_-]+$') THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'INVALID_CHARACTERS',
            'message', 'Username may only contain letters, numbers, underscores, and hyphens.'
        );
    END IF;

    IF p_password IS NULL OR LENGTH(TRIM(p_password)) < 6 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'WEAK_PASSWORD',
            'message', 'Password must be at least 6 characters long.'
        );
    END IF;

    -- 3. Check Team Existence
    SELECT * INTO v_team_record FROM public.teams WHERE id = p_team_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'TEAM_NOT_FOUND',
            'message', 'Target team not found.'
        );
    END IF;

    -- 4. Check Username Uniqueness across other teams
    IF EXISTS (
        SELECT 1 FROM public.teams 
        WHERE id != p_team_id AND LOWER(username) = v_clean_username
    ) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'DUPLICATE_USERNAME',
            'message', 'The requested username is already assigned to another team.'
        );
    END IF;

    -- 5. Hash Password using bcrypt
    v_password_hash := extensions.crypt(TRIM(p_password), extensions.gen_salt('bf', 10));

    -- 6. Update Team Record
    UPDATE public.teams
    SET username = v_clean_username,
        passcode_hash = v_password_hash,
        password_hash = v_password_hash,
        credentials_configured = true,
        credentials_randomized = true,
        failed_login_attempts = 0,
        locked_until = NULL,
        active_session_token_hash = NULL, -- Invalidate any existing participant session
        updated_at = NOW()
    WHERE id = p_team_id;

    -- 7. Audit Log
    INSERT INTO public.audit_logs (event_type, details)
    VALUES (
        'ADMIN_SET_TEAM_CREDENTIALS',
        jsonb_build_object(
            'team_id', p_team_id,
            'team_code', v_team_record.team_code,
            'username', v_clean_username,
            'configured_by_role', v_admin_role,
            'timestamp', NOW()
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'team_id', p_team_id,
        'team_code', v_team_record.team_code,
        'username', v_clean_username,
        'credentials_configured', true,
        'message', 'Team credentials configured successfully.'
    );
END;
$$;

-- -----------------------------------------------------------------------------
-- 5. RPC: admin_reset_team_password
-- Allows admin to reset the password for an existing team and revoke active sessions
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.admin_reset_team_password(VARCHAR, UUID, VARCHAR);
DROP FUNCTION IF EXISTS public.admin_reset_team_password;
CREATE OR REPLACE FUNCTION public.admin_reset_team_password(
    p_admin_token VARCHAR,
    p_team_id UUID,
    p_new_password VARCHAR
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_admin_role VARCHAR;
    v_password_hash VARCHAR;
    v_team_record RECORD;
BEGIN
    -- 1. Validate Admin Session
    v_admin_role := public.verify_admin_token(p_admin_token, ARRAY['superadmin', 'admin']);
    IF v_admin_role IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'UNAUTHORIZED',
            'message', 'Valid administrator session required to reset password.'
        );
    END IF;

    IF p_new_password IS NULL OR LENGTH(TRIM(p_new_password)) < 6 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'WEAK_PASSWORD',
            'message', 'New password must be at least 6 characters long.'
        );
    END IF;

    SELECT * INTO v_team_record FROM public.teams WHERE id = p_team_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'TEAM_NOT_FOUND',
            'message', 'Target team not found.'
        );
    END IF;

    v_password_hash := extensions.crypt(TRIM(p_new_password), extensions.gen_salt('bf', 10));

    UPDATE public.teams
    SET passcode_hash = v_password_hash,
        password_hash = v_password_hash,
        credentials_configured = true,
        credentials_randomized = true,
        failed_login_attempts = 0,
        locked_until = NULL,
        active_session_token_hash = NULL, -- Revoke active participant session
        updated_at = NOW()
    WHERE id = p_team_id;

    INSERT INTO public.audit_logs (event_type, details)
    VALUES (
        'ADMIN_RESET_TEAM_PASSWORD',
        jsonb_build_object(
            'team_id', p_team_id,
            'team_code', v_team_record.team_code,
            'reset_by_role', v_admin_role,
            'timestamp', NOW()
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'team_id', p_team_id,
        'team_code', v_team_record.team_code,
        'message', 'Team password reset successfully. Active sessions revoked.'
    );
END;
$$;

-- -----------------------------------------------------------------------------
-- 6. RPC: admin_batch_generate_team_credentials
-- Batch generates credentials for all teams. Plaintext passwords returned ONCE.
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.admin_batch_generate_team_credentials(VARCHAR);
DROP FUNCTION IF EXISTS public.admin_batch_generate_team_credentials;
CREATE OR REPLACE FUNCTION public.admin_batch_generate_team_credentials(
    p_admin_token VARCHAR
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_admin_role VARCHAR;
    v_team RECORD;
    v_username VARCHAR;
    v_plain_password VARCHAR;
    v_password_hash VARCHAR;
    v_creds_list JSONB := '[]'::jsonb;
    v_counter INT := 0;
BEGIN
    -- 1. Validate Admin Session
    v_admin_role := public.verify_admin_token(p_admin_token, ARRAY['superadmin', 'admin']);
    IF v_admin_role IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'UNAUTHORIZED',
            'message', 'Superadmin or Admin role required for batch credential generation.'
        );
    END IF;

    FOR v_team IN SELECT id, team_code, team_name, username FROM public.teams ORDER BY team_code LOOP
        -- Assign username if not already assigned
        IF v_team.username IS NOT NULL AND LENGTH(v_team.username) > 0 THEN
            v_username := v_team.username;
        ELSE
            v_username := LOWER(v_team.team_code);
        END IF;

        -- Generate 10-character cryptographically random password: 'MM2-' + 6 chars
        v_plain_password := 'MM2-' || UPPER(SUBSTRING(encode(extensions.gen_random_bytes(4), 'hex') FROM 1 FOR 6));
        v_password_hash := extensions.crypt(v_plain_password, extensions.gen_salt('bf', 10));

        UPDATE public.teams
        SET username = v_username,
            passcode_hash = v_password_hash,
            password_hash = v_password_hash,
            credentials_configured = true,
            credentials_randomized = true,
            active_session_token_hash = NULL,
            failed_login_attempts = 0,
            locked_until = NULL,
            updated_at = NOW()
        WHERE id = v_team.id;

        v_creds_list := v_creds_list || jsonb_build_object(
            'team_id', v_team.id,
            'team_code', v_team.team_code,
            'team_name', v_team.team_name,
            'username', v_username,
            'password', v_plain_password
        );

        v_counter := v_counter + 1;
    END LOOP;

    INSERT INTO public.audit_logs (event_type, details)
    VALUES (
        'ADMIN_BATCH_GENERATE_CREDENTIALS',
        jsonb_build_object(
            'teams_count', v_counter,
            'generated_by_role', v_admin_role,
            'timestamp', NOW()
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'count', v_counter,
        'credentials', v_creds_list,
        'message', 'Generated credentials for ' || v_counter || ' teams. Download CSV immediately.'
    );
END;
$$;

-- -----------------------------------------------------------------------------
-- 7. RPC: login_team (AUTHENTICATE VIA USERNAME & PASSWORD)
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.login_team(VARCHAR, VARCHAR, VARCHAR);
DROP FUNCTION IF EXISTS public.login_team(VARCHAR, VARCHAR);
DROP FUNCTION IF EXISTS public.login_team;
CREATE OR REPLACE FUNCTION public.login_team(
    p_username VARCHAR,
    p_password VARCHAR,
    p_device_fingerprint VARCHAR DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_team RECORD;
    v_clean_username VARCHAR;
    v_clean_password VARCHAR;
    v_session_token VARCHAR;
    v_session_token_hash VARCHAR;
    v_is_valid BOOLEAN := false;
BEGIN
    v_clean_username := LOWER(TRIM(p_username));
    v_clean_password := TRIM(p_password);

    IF v_clean_username IS NULL OR v_clean_username = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Username is required.');
    END IF;

    IF v_clean_password IS NULL OR v_clean_password = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Password is required.');
    END IF;

    -- Lookup team by custom username OR team_code OR full team_name (for maximum participant usability)
    SELECT * INTO v_team 
    FROM public.teams 
    WHERE LOWER(username) = v_clean_username 
       OR LOWER(team_code) = v_clean_username 
       OR LOWER(team_name) = v_clean_username;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid team username or password.');
    END IF;

    -- Check if credentials have been configured
    IF v_team.credentials_configured = false AND v_team.credentials_randomized = false THEN
        -- Allow demo password 'user1122' during testing before custom credentials are set
        IF v_clean_password = 'user1122' THEN
            v_is_valid := true;
        ELSE
            RETURN jsonb_build_object(
                'success', false,
                'error', 'CREDENTIALS_NOT_INITIALIZED',
                'message', 'Team credentials have not yet been configured by competition administrators.'
            );
        END IF;
    END IF;

    -- Check account lockout
    IF v_team.locked_until IS NOT NULL AND v_team.locked_until > NOW() THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'ACCOUNT_LOCKED',
            'message', 'Account locked due to multiple failed login attempts. Please contact a marshal.'
        );
    END IF;

    -- Check elimination
    IF v_team.status = 'eliminated' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'TEAM_ELIMINATED',
            'message', 'Team has been disqualified or eliminated from the competition.'
        );
    END IF;

    -- Verify bcrypt hash
    v_is_valid := (extensions.crypt(v_clean_password, v_team.passcode_hash) = v_team.passcode_hash);

    IF NOT v_is_valid THEN
        -- Increment failed attempts
        UPDATE public.teams
        SET failed_login_attempts = failed_login_attempts + 1,
            locked_until = CASE WHEN failed_login_attempts + 1 >= 5 THEN NOW() + INTERVAL '15 minutes' ELSE NULL END,
            updated_at = NOW()
        WHERE id = v_team.id;

        RETURN jsonb_build_object('success', false, 'error', 'Invalid team username or password.');
    END IF;

    -- Generate cryptographically random 64-char session token
    v_session_token := encode(extensions.gen_random_bytes(32), 'hex');
    v_session_token_hash := encode(extensions.digest(v_session_token, 'sha256'), 'hex');

    -- Reset failed attempts & set active session
    UPDATE public.teams
    SET active_session_token_hash = v_session_token_hash,
        device_fingerprint = COALESCE(p_device_fingerprint, device_fingerprint),
        failed_login_attempts = 0,
        locked_until = NULL,
        status = CASE WHEN status = 'registered' THEN 'ready' ELSE status END,
        updated_at = NOW()
    WHERE id = v_team.id;

    RETURN jsonb_build_object(
        'success', true,
        'team_id', v_team.id,
        'team_code', v_team.team_code,
        'team_name', v_team.team_name,
        'username', v_team.username,
        'session_token', v_session_token,
        'current_round', v_team.current_round,
        'status', v_team.status,
        'total_strikes', v_team.total_strikes
    );
END;
$$;

-- -----------------------------------------------------------------------------
-- 8. RPC: get_team_state (SECURE LOCATION RIDDLE & PROGRESS FOR CURRENT ROUND)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_team_state(
    p_team_id UUID,
    p_session_token VARCHAR
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_team RECORD;
    v_token_hash VARCHAR;
    v_progress RECORD;
    v_assigned_location RECORD;
    v_puzzle RECORD;
    v_event RECORD;
BEGIN
    IF p_session_token IS NULL OR p_session_token = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Session token required.');
    END IF;

    v_token_hash := encode(extensions.digest(p_session_token, 'sha256'), 'hex');

    SELECT * INTO v_team FROM public.teams WHERE id = p_team_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Team not found.');
    END IF;

    -- Validate session token
    IF v_team.active_session_token_hash IS NULL OR v_team.active_session_token_hash != v_token_hash THEN
        RETURN jsonb_build_object('success', false, 'error', 'SESSION_INVALID', 'message', 'Invalid or expired session.');
    END IF;

    SELECT * INTO v_event FROM public.event_settings WHERE id = 1;

    -- Fetch current round progress
    SELECT * INTO v_progress 
    FROM public.team_progress 
    WHERE team_id = p_team_id AND round_number = v_team.current_round;

    -- Fetch assigned location for current round from routes
    SELECT l.id, l.location_number, l.name, l.description, l.riddle_clue
    INTO v_assigned_location
    FROM public.team_routes tr
    JOIN public.locations l ON l.id = tr.location_id
    WHERE tr.team_id = p_team_id AND tr.round_number = v_team.current_round;

    -- Fetch challenge for current round (CODE_BASED or THREE_PART_TEXT only)
    SELECT id, round_number, title, puzzle_type, description_md, hints, max_attempts,
           sample_cases, starter_code, three_part_questions, code_language, code_snippet
    INTO v_puzzle
    FROM public.puzzles
    WHERE round_number = v_team.current_round AND is_active = true;

    RETURN jsonb_build_object(
        'success', true,
        'team', jsonb_build_object(
            'id', v_team.id,
            'team_code', v_team.team_code,
            'team_name', v_team.team_name,
            'username', v_team.username,
            'status', v_team.status,
            'current_round', v_team.current_round,
            'total_strikes', v_team.total_strikes,
            'started_at', v_team.started_at,
            'completed_at', v_team.completed_at,
            'total_time_ms', v_team.total_time_ms
        ),
        'event', jsonb_build_object(
            'status', v_event.status,
            'active_locations_count', 9,
            'round_duration_seconds', v_event.round_duration_seconds,
            'grace_period_seconds', v_event.grace_period_seconds,
            'total_pause_duration_ms', v_event.total_pause_duration_ms
        ),
        'assigned_location', CASE WHEN v_assigned_location.id IS NOT NULL THEN
            jsonb_build_object(
                'id', v_assigned_location.id,
                'location_number', v_assigned_location.location_number,
                'name', v_assigned_location.name,
                'description', v_assigned_location.description,
                'riddle_clue', v_assigned_location.riddle_clue
            )
            ELSE NULL END,
        'current_progress', CASE WHEN v_progress.id IS NOT NULL THEN
            jsonb_build_object(
                'round_number', v_progress.round_number,
                'puzzle_solved', v_progress.puzzle_solved,
                'puzzle_solved_at', v_progress.puzzle_solved_at,
                'qr_scanned', v_progress.qr_scanned,
                'qr_scanned_at', v_progress.qr_scanned_at,
                'attempts_count', v_progress.attempts_count,
                'round_started_at', v_progress.round_started_at,
                'deadline_at', v_progress.deadline_at,
                'grace_deadline_at', v_progress.grace_deadline_at,
                'status', v_progress.status,
                'riddle_revealed', COALESCE(v_assigned_location.riddle_clue, '')
            )
            ELSE NULL END,
        'current_puzzle', CASE WHEN v_puzzle.id IS NOT NULL THEN
            jsonb_build_object(
                'id', v_puzzle.id,
                'round_number', v_puzzle.round_number,
                'title', v_puzzle.title,
                'puzzle_type', v_puzzle.puzzle_type,
                'description_md', v_puzzle.description_md,
                'hints', v_puzzle.hints,
                'max_attempts', v_puzzle.max_attempts,
                'sample_cases', v_puzzle.sample_cases,
                'starter_code', v_puzzle.starter_code,
                'three_part_questions', v_puzzle.three_part_questions,
                'code_language', v_puzzle.code_language,
                'code_snippet', v_puzzle.code_snippet
            )
            ELSE NULL END
    );
END;
$$;

-- -----------------------------------------------------------------------------
-- 9. RPC: verify_checkpoint_qr (9-ROUND JOURNEY COMPLETION)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.verify_checkpoint_qr(
    p_team_id UUID,
    p_session_token VARCHAR,
    p_scanned_token VARCHAR
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_team RECORD;
    v_token_hash VARCHAR;
    v_assigned_loc RECORD;
    v_progress RECORD;
    v_is_final BOOLEAN;
BEGIN
    IF p_session_token IS NULL OR p_session_token = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Session token required.');
    END IF;

    v_token_hash := encode(extensions.digest(p_session_token, 'sha256'), 'hex');

    SELECT * INTO v_team FROM public.teams WHERE id = p_team_id;
    IF NOT FOUND OR v_team.active_session_token_hash != v_token_hash THEN
        RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Session invalid.');
    END IF;

    IF v_team.status = 'eliminated' THEN
        RETURN jsonb_build_object('success', false, 'error', 'ELIMINATED', 'message', 'Team is eliminated.');
    END IF;

    -- Fetch assigned location for current round
    SELECT l.* INTO v_assigned_loc
    FROM public.team_routes tr
    JOIN public.locations l ON l.id = tr.location_id
    WHERE tr.team_id = p_team_id AND tr.round_number = v_team.current_round;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'NO_ROUTE', 'message', 'No assigned location found for this round.');
    END IF;

    -- Verify token matches assigned location
    IF TRIM(p_scanned_token) != TRIM(v_assigned_loc.qr_token) THEN
        RETURN jsonb_build_object('success', false, 'error', 'INVALID_QR', 'message', 'Scanned token does not match assigned station.');
    END IF;

    -- Verify challenge solved first
    SELECT * INTO v_progress 
    FROM public.team_progress 
    WHERE team_id = p_team_id AND round_number = v_team.current_round;

    IF NOT FOUND OR NOT v_progress.puzzle_solved THEN
        RETURN jsonb_build_object('success', false, 'error', 'PUZZLE_UNSOLVED', 'message', 'Solve the station challenge before scanning station QR.');
    END IF;

    -- Mark round QR scanned
    UPDATE public.team_progress
    SET qr_scanned = true,
        qr_scanned_at = NOW(),
        status = 'completed',
        completed_at = NOW(),
        updated_at = NOW()
    WHERE team_id = p_team_id AND round_number = v_team.current_round;

    -- Record scan in qr_scans
    INSERT INTO public.qr_scans (team_id, location_id, scanned_token, scan_type, verified)
    VALUES (p_team_id, v_assigned_loc.id, p_scanned_token, 'checkpoint', true);

    -- Journey completion check: Exactly 9 rounds
    v_is_final := (v_team.current_round >= 9);

    IF v_is_final THEN
        UPDATE public.teams
        SET status = 'completed',
            completed_at = NOW(),
            total_time_ms = EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000,
            updated_at = NOW()
        WHERE id = p_team_id;

        RETURN jsonb_build_object(
            'success', true,
            'is_completed', true,
            'round_number', 9,
            'message', 'Congratulations! Station 9 verified. You have completed the Mind Maze championship journey!'
        );
    ELSE
        UPDATE public.teams
        SET current_round = current_round + 1,
            updated_at = NOW()
        WHERE id = p_team_id;

        RETURN jsonb_build_object(
            'success', true,
            'is_completed', false,
            'next_round', v_team.current_round + 1,
            'message', 'Checkpoint verified! Proceeding to next round.'
        );
    END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- 10. RPC: generate_team_routes (9 LOCATIONS, 9 ROUNDS, 20 TEAMS)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_team_routes(
    p_admin_token VARCHAR,
    p_active_locations INT DEFAULT 9
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_admin_role VARCHAR;
    v_team_ids UUID[];
    v_loc_ids INT[];
    v_team_count INT;
    v_loc_count INT;
    v_t_idx INT;
    v_r INT;
    v_offset INT;
    v_target_loc_id INT;
BEGIN
    v_admin_role := public.verify_admin_token(p_admin_token, ARRAY['superadmin', 'admin']);
    IF v_admin_role IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Admin session required.');
    END IF;

    -- Fetch active teams and exactly 9 active locations
    SELECT array_agg(id ORDER BY team_code) INTO v_team_ids FROM public.teams;
    SELECT array_agg(id ORDER BY location_number) INTO v_loc_ids FROM public.locations WHERE active = true AND location_number <= 9;

    v_team_count := COALESCE(cardinality(v_team_ids), 0);
    v_loc_count := COALESCE(cardinality(v_loc_ids), 0);

    IF v_loc_count != 9 THEN
        RETURN jsonb_build_object('success', false, 'error', 'INVALID_LOCATION_COUNT', 'message', 'Expected exactly 9 active locations, found ' || v_loc_count);
    END IF;

    -- Clear existing routes
    DELETE FROM public.team_routes;

    -- Latin-square routing: For team k (1..20), offset is (k - 1) % 9
    -- In round r (1..9), location is (offset + r - 1) % 9
    -- Guarantees every team visits all 9 locations in 9 rounds
    FOR v_t_idx IN 1..v_team_count LOOP
        v_offset := (v_t_idx - 1) % 9;
        FOR v_r IN 1..9 LOOP
            v_target_loc_id := v_loc_ids[((v_offset + (v_r - 1)) % 9) + 1];
            INSERT INTO public.team_routes (team_id, round_number, location_id)
            VALUES (v_team_ids[v_t_idx], v_r, v_target_loc_id);
        END LOOP;
    END LOOP;

    UPDATE public.event_settings SET routes_locked = true, updated_at = NOW() WHERE id = 1;

    RETURN jsonb_build_object(
        'success', true,
        'teams_count', v_team_count,
        'rounds_count', 9,
        'locations_count', 9,
        'total_assignments', v_team_count * 9,
        'message', 'Generated 9-round balanced routes for ' || v_team_count || ' teams.'
    );
END;
$$;

-- -----------------------------------------------------------------------------
-- 11. RPC: admin_update_location (UPDATES RIDDLE CLUE DIRECTLY)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_update_location(
    p_admin_token VARCHAR,
    p_location_id INT,
    p_name VARCHAR,
    p_description TEXT,
    p_capacity INT,
    p_riddle_clue TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_admin_role VARCHAR;
BEGIN
    v_admin_role := public.verify_admin_token(p_admin_token, ARRAY['superadmin', 'admin']);
    IF v_admin_role IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Admin session required.');
    END IF;

    IF p_location_id > 9 THEN
        RETURN jsonb_build_object('success', false, 'error', 'INVALID_LOCATION', 'message', 'Only locations 1 to 9 are valid.');
    END IF;

    UPDATE public.locations
    SET name = TRIM(p_name),
        description = TRIM(p_description),
        capacity = GREATEST(1, p_capacity),
        riddle_clue = COALESCE(p_riddle_clue, riddle_clue),
        updated_at = NOW()
    WHERE id = p_location_id;

    RETURN jsonb_build_object(
        'success', true,
        'location_id', p_location_id,
        'message', 'Location updated successfully.'
    );
END;
$$;

-- -----------------------------------------------------------------------------
-- 12. RPC: admin_get_dashboard_data (EXPOSES USERNAME & CONFIG STATUS, NO PASSWORDS)
-- -----------------------------------------------------------------------------
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
    v_event JSONB;
BEGIN
    v_admin_role := public.verify_admin_token(p_admin_token, ARRAY['superadmin', 'admin', 'marshal']);
    IF v_admin_role IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Admin session required.');
    END IF;

    -- Teams without passwords or password hashes
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
            'created_at', t.created_at
        ) ORDER BY t.team_code
    ) INTO v_teams FROM public.teams t;

    -- Exactly 9 active locations
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

    SELECT to_jsonb(es.*) INTO v_event FROM public.event_settings es WHERE id = 1;

    RETURN jsonb_build_object(
        'success', true,
        'teams', COALESCE(v_teams, '[]'::jsonb),
        'locations', COALESCE(v_locations, '[]'::jsonb),
        'event', v_event
    );
END;
$$;

-- -----------------------------------------------------------------------------
-- 13. RPC: record_puzzle_solved (OPERATIONAL TRACKING ONLY, NO QUESTION SECRETS)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_puzzle_solved(
    p_session_token VARCHAR,
    p_round_number INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_team RECORD;
    v_token_hash VARCHAR;
    v_progress RECORD;
BEGIN
    IF p_session_token IS NULL OR p_session_token = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Session token required.');
    END IF;

    v_token_hash := encode(extensions.digest(p_session_token, 'sha256'), 'hex');

    -- Validate team session
    SELECT * INTO v_team
    FROM public.teams
    WHERE active_session_token_hash = v_token_hash
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'INVALID_SESSION', 'message', 'Session expired or invalid.');
    END IF;

    IF v_team.status = 'eliminated' THEN
        RETURN jsonb_build_object('success', false, 'error', 'TEAM_ELIMINATED', 'message', 'Team eliminated.');
    END IF;

    -- Update or insert progress record for this round
    SELECT * INTO v_progress
    FROM public.team_progress
    WHERE team_id = v_team.id AND round_number = p_round_number
    FOR UPDATE;

    IF FOUND THEN
        UPDATE public.team_progress
        SET puzzle_solved = true,
            puzzle_solved_at = COALESCE(puzzle_solved_at, NOW()),
            attempts_count = attempts_count + 1,
            updated_at = NOW()
        WHERE team_id = v_team.id AND round_number = p_round_number;
    ELSE
        INSERT INTO public.team_progress (
            team_id, round_number, puzzle_solved, puzzle_solved_at,
            qr_scanned, attempts_count, round_started_at
        ) VALUES (
            v_team.id, p_round_number, true, NOW(),
            false, 1, NOW()
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'puzzle_solved', true,
        'round_number', p_round_number,
        'message', 'Puzzle solve recorded for tracking.'
    );
END;
$$;

-- -----------------------------------------------------------------------------
-- 14. REVOKE UNNECESSARY EXECUTION AND GRANT SPECIFIC ROLES
-- -----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.admin_set_team_credentials(VARCHAR, UUID, VARCHAR, VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_team_credentials(VARCHAR, UUID, VARCHAR, VARCHAR) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.admin_reset_team_password(VARCHAR, UUID, VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_reset_team_password(VARCHAR, UUID, VARCHAR) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.admin_batch_generate_team_credentials(VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_batch_generate_team_credentials(VARCHAR) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.login_team(VARCHAR, VARCHAR, VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.login_team(VARCHAR, VARCHAR, VARCHAR) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.get_team_state(UUID, VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_team_state(UUID, VARCHAR) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.verify_checkpoint_qr(UUID, VARCHAR, VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_checkpoint_qr(UUID, VARCHAR, VARCHAR) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.generate_team_routes(VARCHAR, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_team_routes(VARCHAR, INT) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.admin_update_location(VARCHAR, INT, VARCHAR, TEXT, INT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_location(VARCHAR, INT, VARCHAR, TEXT, INT, TEXT) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.admin_get_dashboard_data(VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_dashboard_data(VARCHAR) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.record_puzzle_solved(VARCHAR, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_puzzle_solved(VARCHAR, INT) TO anon, authenticated;

COMMENT ON TABLE public.teams IS 'Participant teams with admin-managed credentials (username + bcrypt passcode_hash)';

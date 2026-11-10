-- ==============================================================================
-- MIND MAZE 2.0 — HARDENED POSTGRESQL DATABASE SCHEMA (FINAL AUDIT V3)
-- Platform: Supabase PostgreSQL (ap-south-1)
-- Target: High-Concurrency, Zero-Trust QR Treasure Hunt Platform
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Clean drop views if rebuilding
DROP VIEW IF EXISTS public_leaderboard CASCADE;
DROP VIEW IF EXISTS public_event_status CASCADE;

-- 2. TABLE DEFINITIONS

-- ------------------------------------------------------------------------------
-- Table 1: admin_profiles
-- Mirrors Supabase auth.users for authenticated administrators and marshals.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    role VARCHAR(20) NOT NULL DEFAULT 'admin' CHECK (role IN ('superadmin', 'admin', 'marshal')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- Table 2: event_settings
-- Global event configuration singleton (enforced id = 1).
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS event_settings (
    id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    event_name VARCHAR(150) NOT NULL DEFAULT 'MIND MAZE 2.0',
    status VARCHAR(20) NOT NULL DEFAULT 'ready' CHECK (status IN ('draft', 'ready', 'live', 'paused', 'finished')),
    total_teams INT NOT NULL DEFAULT 25 CHECK (total_teams BETWEEN 1 AND 50),
    active_locations_count INT NOT NULL DEFAULT 10 CHECK (active_locations_count BETWEEN 7 AND 10),
    round_duration_seconds INT NOT NULL DEFAULT 300 CHECK (round_duration_seconds >= 30),
    grace_period_seconds INT NOT NULL DEFAULT 30 CHECK (grace_period_seconds >= 0),
    starting_qr_token VARCHAR(100) NOT NULL DEFAULT 'MM2-START-SEMINAR-2026',
    final_qr_token VARCHAR(100) NOT NULL DEFAULT 'MM2-FINISH-SEMINAR-2026',
    allow_registration BOOLEAN NOT NULL DEFAULT true,
    routes_locked BOOLEAN NOT NULL DEFAULT false,
    qr_tokens_regenerated BOOLEAN NOT NULL DEFAULT false,
    event_started_at TIMESTAMPTZ,
    event_finished_at TIMESTAMPTZ,
    pause_started_at TIMESTAMPTZ,
    total_pause_duration_ms BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- Table 3: teams
-- Hardened: Stores bcrypt passcode hash and SHA-256 session token hash.
-- Includes brute-force protection (failed_attempts, locked_until).
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_code VARCHAR(20) UNIQUE NOT NULL,
    team_name VARCHAR(100) UNIQUE NOT NULL,
    passcode_hash VARCHAR(255) NOT NULL,
    members JSONB NOT NULL DEFAULT '[]'::jsonb,
    status VARCHAR(20) NOT NULL DEFAULT 'registered' CHECK (status IN ('registered', 'ready', 'active', 'completed', 'eliminated')),
    current_round INT NOT NULL DEFAULT 1 CHECK (current_round >= 1),
    total_strikes INT NOT NULL DEFAULT 0 CHECK (total_strikes BETWEEN 0 AND 3),
    active_session_token_hash VARCHAR(64),
    device_fingerprint VARCHAR(255),
    failed_login_attempts INT NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ,
    credentials_randomized BOOLEAN NOT NULL DEFAULT false,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    total_time_ms BIGINT,
    elimination_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Migration safety: ensure new columns exist if running on partially initialized table
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'teams' AND column_name = 'passcode'
    ) THEN
        ALTER TABLE teams RENAME COLUMN passcode TO passcode_hash;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'teams' AND column_name = 'active_session_token_hash'
    ) THEN
        ALTER TABLE teams ADD COLUMN active_session_token_hash VARCHAR(64);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'teams' AND column_name = 'failed_login_attempts'
    ) THEN
        ALTER TABLE teams ADD COLUMN failed_login_attempts INT NOT NULL DEFAULT 0;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'teams' AND column_name = 'locked_until'
    ) THEN
        ALTER TABLE teams ADD COLUMN locked_until TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'teams' AND column_name = 'credentials_randomized'
    ) THEN
        ALTER TABLE teams ADD COLUMN credentials_randomized BOOLEAN NOT NULL DEFAULT false;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'event_settings' AND column_name = 'qr_tokens_regenerated'
    ) THEN
        ALTER TABLE event_settings ADD COLUMN qr_tokens_regenerated BOOLEAN NOT NULL DEFAULT false;
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- Table 4: locations
-- Physical campus checkpoints (1 to 10). Secret qr_token kept behind RLS.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS locations (
    id INT PRIMARY KEY,
    location_number INT UNIQUE NOT NULL CHECK (location_number BETWEEN 1 AND 10),
    name VARCHAR(150) NOT NULL,
    description TEXT NOT NULL,
    riddle_clue TEXT NOT NULL DEFAULT '',
    capacity INT NOT NULL DEFAULT 3 CHECK (capacity > 0),
    active BOOLEAN NOT NULL DEFAULT true,
    qr_token VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'locations' AND column_name = 'riddle_clue'
    ) THEN
        ALTER TABLE locations ADD COLUMN riddle_clue TEXT NOT NULL DEFAULT '';
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- Table 5: puzzles
-- Master questions, accepted answers, and checkpoint riddles (1 to 10).
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS puzzles (
    id VARCHAR(50) PRIMARY KEY,
    round_number INT UNIQUE NOT NULL CHECK (round_number BETWEEN 1 AND 10),
    title VARCHAR(200) NOT NULL,
    puzzle_type VARCHAR(30) NOT NULL DEFAULT 'text' CHECK (puzzle_type IN ('coding', 'text', 'crypto', 'logic')),
    description_md TEXT NOT NULL,
    accepted_answers TEXT[] NOT NULL,
    case_sensitive BOOLEAN NOT NULL DEFAULT false,
    normalize_whitespace BOOLEAN NOT NULL DEFAULT true,
    riddle_text TEXT NOT NULL,
    hints TEXT[] NOT NULL DEFAULT '{}',
    max_attempts INT NOT NULL DEFAULT 5 CHECK (max_attempts > 0),
    sample_cases JSONB NOT NULL DEFAULT '[]'::jsonb,
    hidden_cases JSONB NOT NULL DEFAULT '[]'::jsonb,
    starter_code JSONB NOT NULL DEFAULT '{}'::jsonb,
    published BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- Table 6: team_routes
-- Shifted Latin Hypercube assignments: team_id visits location_id in round_number.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS team_routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    round_number INT NOT NULL CHECK (round_number >= 1),
    location_id INT NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(team_id, round_number)
);

-- ------------------------------------------------------------------------------
-- Table 7: team_progress
-- Granular per-round state tracking for each team.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS team_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    round_number INT NOT NULL CHECK (round_number >= 1),
    puzzle_id VARCHAR(50) NOT NULL REFERENCES puzzles(id) ON DELETE RESTRICT,
    location_id INT NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
    puzzle_solved BOOLEAN NOT NULL DEFAULT false,
    puzzle_solved_at TIMESTAMPTZ,
    qr_scanned BOOLEAN NOT NULL DEFAULT false,
    qr_scanned_at TIMESTAMPTZ,
    attempts_count INT NOT NULL DEFAULT 0,
    round_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deadline_at TIMESTAMPTZ,
    grace_deadline_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    status VARCHAR(30) NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'grace_period', 'solved_pending_qr', 'completed', 'timed_out')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(team_id, round_number)
);

-- ------------------------------------------------------------------------------
-- Table 8: submissions
-- Immutable log of all answer submissions (correct & incorrect).
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    round_number INT NOT NULL CHECK (round_number >= 1),
    puzzle_id VARCHAR(50) NOT NULL REFERENCES puzzles(id) ON DELETE CASCADE,
    submitted_answer TEXT NOT NULL,
    is_correct BOOLEAN NOT NULL,
    attempt_number INT NOT NULL CHECK (attempt_number >= 1),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- Table 9: qr_scans
-- Immutable audit log of all QR scans (starting, checkpoint, final).
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS qr_scans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    round_number INT NOT NULL CHECK (round_number >= 1),
    scanned_token VARCHAR(100) NOT NULL,
    location_id INT REFERENCES locations(id) ON DELETE SET NULL,
    scan_type VARCHAR(30) NOT NULL CHECK (scan_type IN ('start', 'location', 'final')),
    is_valid BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- Table 10: audit_logs
-- Central telemetry and incident log for monitoring and dispute resolution.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    event_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'danger')),
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 3. INDEXES FOR HIGH-CONCURRENCY PERFORMANCE
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_teams_status ON teams(status);
CREATE INDEX IF NOT EXISTS idx_teams_code ON teams(team_code);
CREATE INDEX IF NOT EXISTS idx_teams_session_hash ON teams(active_session_token_hash);
CREATE INDEX IF NOT EXISTS idx_team_routes_lookup ON team_routes(team_id, round_number);
CREATE INDEX IF NOT EXISTS idx_team_progress_active ON team_progress(team_id, round_number, status);
CREATE INDEX IF NOT EXISTS idx_team_progress_team ON team_progress(team_id);
CREATE INDEX IF NOT EXISTS idx_submissions_team ON submissions(team_id, puzzle_id);
CREATE INDEX IF NOT EXISTS idx_qr_scans_rate_limit ON qr_scans(team_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_event ON audit_logs(event_type, created_at DESC);

-- ------------------------------------------------------------------------------
-- 4. VIEWS FOR SAFE PUBLIC DATA CONSUMPTION
-- ------------------------------------------------------------------------------
-- Public Leaderboard View: Safe for public display, omits hashes, passcodes, and tokens
CREATE OR REPLACE VIEW public_leaderboard AS
SELECT 
    t.id AS team_id,
    t.team_code,
    t.team_name,
    t.status,
    t.current_round,
    (SELECT COUNT(*) FROM team_progress tp WHERE tp.team_id = t.id AND tp.status = 'completed') AS completed_locations,
    t.started_at,
    t.completed_at,
    t.total_time_ms,
    t.total_strikes,
    t.updated_at AS last_activity_at,
    CASE 
        WHEN t.status = 'completed' THEN 1
        WHEN t.status = 'active' THEN 2
        WHEN t.status = 'ready' THEN 3
        WHEN t.status = 'registered' THEN 4
        ELSE 5
    END AS sort_priority
FROM teams t
ORDER BY 
    sort_priority ASC,
    completed_locations DESC,
    t.total_time_ms ASC NULLS LAST,
    t.completed_at ASC NULLS LAST,
    t.current_round DESC;

-- Public Event Status View: Safe configuration parameters (EXCLUDES starting_qr_token and final_qr_token)
CREATE OR REPLACE VIEW public_event_status AS
SELECT 
    id,
    event_name,
    status,
    total_teams,
    active_locations_count,
    round_duration_seconds,
    grace_period_seconds,
    allow_registration,
    event_started_at,
    event_finished_at,
    total_pause_duration_ms
FROM event_settings
WHERE id = 1;

-- Grant explicit SELECT on safe views to public/anon
GRANT SELECT ON public_leaderboard TO anon, authenticated;
GRANT SELECT ON public_event_status TO anon, authenticated;

-- ------------------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY (RLS) POLICIES — ZERO DIRECT CLIENT EXPOSURE
-- ------------------------------------------------------------------------------
ALTER TABLE admin_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE puzzles ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE qr_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper Function: Check if the authenticated user is an administrator
-- Strictly validates:
-- 1) Supabase service_role JWT claim (internal backend/Edge Functions)
-- 2) Authenticated user identity in admin_profiles with an authorized role
-- NOTE: Never inspects current_user or session_user, eliminating SECURITY DEFINER identity escalation.
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, extensions, pg_temp
AS $$
    SELECT (
        COALESCE((auth.jwt() ->> 'role') = 'service_role', false)
        OR (
            auth.uid() IS NOT NULL AND EXISTS (
                SELECT 1 FROM admin_profiles
                WHERE id = auth.uid()
                AND role IN ('superadmin', 'admin', 'marshal')
            )
        )
    );
$$;

-- A. admin_profiles Policies
DROP POLICY IF EXISTS admin_profiles_admin_all ON admin_profiles;
CREATE POLICY admin_profiles_admin_all ON admin_profiles
    FOR ALL TO authenticated
    USING (is_admin() OR id = auth.uid())
    WITH CHECK (is_admin() OR id = auth.uid());

-- B. event_settings Policies
-- Direct SELECT on base table is RESTRICTED to admins only.
DROP POLICY IF EXISTS event_settings_admin_all ON event_settings;
CREATE POLICY event_settings_admin_all ON event_settings
    FOR ALL TO authenticated
    USING (is_admin())
    WITH CHECK (is_admin());

DROP POLICY IF EXISTS event_settings_anon_read ON event_settings;

-- C. teams Policies
-- Direct SELECT on base table is RESTRICTED to admins only.
DROP POLICY IF EXISTS teams_admin_all ON teams;
CREATE POLICY teams_admin_all ON teams
    FOR ALL TO authenticated
    USING (is_admin())
    WITH CHECK (is_admin());

DROP POLICY IF EXISTS teams_anon_read ON teams;

-- D. locations Policies
DROP POLICY IF EXISTS locations_admin_all ON locations;
CREATE POLICY locations_admin_all ON locations
    FOR ALL TO authenticated
    USING (is_admin())
    WITH CHECK (is_admin());

DROP POLICY IF EXISTS locations_anon_none ON locations;

-- E. puzzles Policies
DROP POLICY IF EXISTS puzzles_admin_all ON puzzles;
CREATE POLICY puzzles_admin_all ON puzzles
    FOR ALL TO authenticated
    USING (is_admin())
    WITH CHECK (is_admin());

DROP POLICY IF EXISTS puzzles_anon_none ON puzzles;

-- F. team_routes Policies
DROP POLICY IF EXISTS team_routes_admin_all ON team_routes;
CREATE POLICY team_routes_admin_all ON team_routes
    FOR ALL TO authenticated
    USING (is_admin())
    WITH CHECK (is_admin());

DROP POLICY IF EXISTS team_routes_anon_none ON team_routes;

-- G. team_progress Policies
DROP POLICY IF EXISTS team_progress_admin_all ON team_progress;
CREATE POLICY team_progress_admin_all ON team_progress
    FOR ALL TO authenticated
    USING (is_admin())
    WITH CHECK (is_admin());

DROP POLICY IF EXISTS team_progress_anon_read ON team_progress;

-- H. submissions Policies
DROP POLICY IF EXISTS submissions_admin_all ON submissions;
CREATE POLICY submissions_admin_all ON submissions
    FOR ALL TO authenticated
    USING (is_admin())
    WITH CHECK (is_admin());

-- I. qr_scans Policies
DROP POLICY IF EXISTS qr_scans_admin_all ON qr_scans;
CREATE POLICY qr_scans_admin_all ON qr_scans
    FOR ALL TO authenticated
    USING (is_admin())
    WITH CHECK (is_admin());

-- J. audit_logs Policies
DROP POLICY IF EXISTS audit_logs_admin_all ON audit_logs;
CREATE POLICY audit_logs_admin_all ON audit_logs
    FOR ALL TO authenticated
    USING (is_admin())
    WITH CHECK (is_admin());

-- ------------------------------------------------------------------------------
-- 6. AUTHORITATIVE STORED PROCEDURES (SECURITY DEFINER RPC FUNCTIONS)
-- All operations run with search_path = public, extensions, pg_temp.
-- ------------------------------------------------------------------------------

-- ------------------------------------------------------------------------------
-- Operation 1: login_team
-- Authenticates a team using team_code & bcrypt password.
-- Protected against DoS: 10 failed attempts locks for 60 seconds (prevents rival lockouts).
-- Issues a cryptographic 64-char token and stores its SHA-256 hash.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION login_team(
    p_team_code VARCHAR,
    p_passcode VARCHAR,
    p_device_fingerprint VARCHAR DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_team RECORD;
    v_raw_token VARCHAR;
    v_token_hash VARCHAR;
    v_attempts INT;
BEGIN
    SELECT * INTO v_team
    FROM teams
    WHERE LOWER(team_code) = LOWER(TRIM(p_team_code))
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Team code not recognized. Please check your credentials.'
        );
    END IF;

    -- Enforce that production match requires randomized credentials
    IF v_team.credentials_randomized = false THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Default credentials are locked. The event organizer must randomize team passcodes before participant login is enabled.'
        );
    END IF;

    -- Check if account is temporarily locked
    IF v_team.locked_until IS NOT NULL AND v_team.locked_until > NOW() THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Account temporarily throttled due to multiple failed attempts. Please retry in ' || 
                       ROUND(EXTRACT(EPOCH FROM (v_team.locked_until - NOW()))) || ' seconds.'
        );
    END IF;

    -- Verify bcrypt hash
    IF v_team.passcode_hash <> crypt(TRIM(p_passcode), v_team.passcode_hash) THEN
        v_attempts := v_team.failed_login_attempts + 1;

        IF v_attempts >= 10 THEN
            UPDATE teams
            SET 
                failed_login_attempts = v_attempts,
                locked_until = NOW() + INTERVAL '60 seconds',
                updated_at = NOW()
            WHERE id = v_team.id;

            INSERT INTO audit_logs (team_id, event_type, severity, details)
            VALUES (v_team.id, 'LOGIN_LOCKOUT', 'danger', jsonb_build_object('attempts', v_attempts, 'ip_device', p_device_fingerprint));

            RETURN jsonb_build_object(
                'success', false,
                'message', 'Too many failed login attempts. Account throttled for 60 seconds.'
            );
        ELSE
            UPDATE teams
            SET failed_login_attempts = v_attempts, updated_at = NOW()
            WHERE id = v_team.id;

            INSERT INTO audit_logs (team_id, event_type, severity, details)
            VALUES (v_team.id, 'LOGIN_FAILED', 'warning', jsonb_build_object('attempts', v_attempts));

            RETURN jsonb_build_object(
                'success', false,
                'message', 'Invalid passcode. ' || (10 - v_attempts) || ' attempts remaining before 60-second cooldown.'
            );
        END IF;
    END IF;

    IF v_team.status = 'eliminated' THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'This team has been disqualified: ' || COALESCE(v_team.elimination_reason, 'Anti-cheat violation')
        );
    END IF;

    -- Successful authentication: Generate raw 64-character token and store SHA-256 hash
    v_raw_token := encode(gen_random_bytes(32), 'hex');
    v_token_hash := encode(digest(v_raw_token, 'sha256'), 'hex');

    UPDATE teams
    SET 
        active_session_token_hash = v_token_hash,
        device_fingerprint = COALESCE(p_device_fingerprint, device_fingerprint),
        failed_login_attempts = 0,
        locked_until = NULL,
        status = CASE WHEN status = 'registered' THEN 'ready' ELSE status END,
        updated_at = NOW()
    WHERE id = v_team.id;

    -- Telemetry
    INSERT INTO audit_logs (team_id, event_type, severity, details)
    VALUES (
        v_team.id,
        'TEAM_LOGIN_SUCCESS',
        'info',
        jsonb_build_object('team_code', v_team.team_code, 'device', p_device_fingerprint)
    );

    RETURN jsonb_build_object(
        'success', true,
        'team_id', v_team.id,
        'team_code', v_team.team_code,
        'team_name', v_team.team_name,
        'status', CASE WHEN v_team.status = 'registered' THEN 'ready' ELSE v_team.status END,
        'current_round', v_team.current_round,
        'session_token', v_raw_token
    );
END;
$$;

-- ------------------------------------------------------------------------------
-- Operation 2: logout_team
-- Immediately invalidates the team session token hash.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION logout_team(
    p_team_id UUID,
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
    v_token_hash := encode(digest(p_session_token, 'sha256'), 'hex');

    UPDATE teams
    SET 
        active_session_token_hash = NULL,
        device_fingerprint = NULL,
        updated_at = NOW()
    WHERE id = p_team_id AND active_session_token_hash = v_token_hash;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Invalid session or already logged out.');
    END IF;

    INSERT INTO audit_logs (team_id, event_type, severity, details)
    VALUES (p_team_id, 'TEAM_LOGOUT', 'info', '{}'::jsonb);

    RETURN jsonb_build_object('success', true, 'message', 'Logged out successfully.');
END;
$$;

-- ------------------------------------------------------------------------------
-- Operation 3: get_team_state
-- Authoritative state retrieval for participant client (sanitized payload).
-- Validates incoming token using SHA-256 digest comparison.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_team_state(
    p_team_id UUID,
    p_session_token VARCHAR
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_token_hash VARCHAR;
    v_team RECORD;
    v_settings RECORD;
    v_progress RECORD;
    v_puzzle RECORD;
    v_assigned_location_id INT;
BEGIN
    v_token_hash := encode(digest(p_session_token, 'sha256'), 'hex');

    SELECT * INTO v_team
    FROM teams
    WHERE id = p_team_id AND active_session_token_hash = v_token_hash;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'UNAUTHORIZED_SESSION',
            'message', 'Session expired or invalidated. Please sign in again.'
        );
    END IF;

    SELECT * INTO v_settings FROM event_settings WHERE id = 1;

    -- Retrieve active round progress
    SELECT * INTO v_progress
    FROM team_progress
    WHERE team_id = v_team.id AND round_number = v_team.current_round;

    IF v_progress.puzzle_id IS NOT NULL THEN
        SELECT 
            id, round_number, title, puzzle_type, description_md,
            hints, max_attempts, sample_cases, starter_code
        INTO v_puzzle
        FROM puzzles
        WHERE id = v_progress.puzzle_id;
    END IF;

    -- Assigned location for this round
    SELECT location_id INTO v_assigned_location_id
    FROM team_routes
    WHERE team_id = v_team.id AND round_number = v_team.current_round;

    RETURN jsonb_build_object(
        'success', true,
        'team', jsonb_build_object(
            'id', v_team.id,
            'team_code', v_team.team_code,
            'team_name', v_team.team_name,
            'status', v_team.status,
            'current_round', v_team.current_round,
            'total_strikes', v_team.total_strikes,
            'started_at', v_team.started_at,
            'completed_at', v_team.completed_at,
            'total_time_ms', v_team.total_time_ms
        ),
        'event', jsonb_build_object(
            'status', v_settings.status,
            'active_locations_count', v_settings.active_locations_count,
            'round_duration_seconds', v_settings.round_duration_seconds,
            'grace_period_seconds', v_settings.grace_period_seconds,
            'total_pause_duration_ms', v_settings.total_pause_duration_ms
        ),
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
                'riddle_revealed', CASE 
                    WHEN v_progress.puzzle_solved THEN (
                        SELECT COALESCE(NULLIF(l.riddle_clue, ''), (SELECT riddle_text FROM puzzles WHERE id = v_progress.puzzle_id))
                        FROM team_routes tr
                        JOIN locations l ON l.id = tr.location_id
                        WHERE tr.team_id = v_team.id AND tr.round_number = v_team.current_round
                    )
                    ELSE NULL 
                END
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
                'starter_code', v_puzzle.starter_code
            )
            ELSE NULL END
    );
END;
$$;

-- ------------------------------------------------------------------------------
-- Operation 4: start_team_journey
-- Scans the Seminar Hall Starting QR, verifies event is 'live', unlocks Round 1.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION start_team_journey(
    p_team_id UUID,
    p_session_token VARCHAR,
    p_starting_qr VARCHAR
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_token_hash VARCHAR;
    v_team RECORD;
    v_settings RECORD;
    v_first_puzzle RECORD;
    v_first_location_id INT;
    v_round_duration INT;
    v_grace_duration INT;
    v_deadline TIMESTAMPTZ;
    v_grace_deadline TIMESTAMPTZ;
BEGIN
    v_token_hash := encode(digest(p_session_token, 'sha256'), 'hex');

    -- 1. Validate team session with row lock
    SELECT * INTO v_team
    FROM teams
    WHERE id = p_team_id AND active_session_token_hash = v_token_hash
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Unauthorized team session.');
    END IF;

    -- 2. Validate event settings: MUST BE 'live'
    SELECT * INTO v_settings FROM event_settings WHERE id = 1;
    IF v_settings.status <> 'live' THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'The competition is not currently live (Status: ' || v_settings.status || '). Please wait for the master signal.'
        );
    END IF;

    -- Enforce that production match requires regenerated QR tokens
    IF v_settings.qr_tokens_regenerated = false THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Staging QR tokens are active. Event organizer must regenerate production QR codes before match start.'
        );
    END IF;

    -- 3. Verify starting QR token
    IF TRIM(p_starting_qr) <> v_settings.starting_qr_token THEN
        INSERT INTO qr_scans (team_id, round_number, scanned_token, scan_type, is_valid)
        VALUES (v_team.id, 1, p_starting_qr, 'start', false);

        RETURN jsonb_build_object(
            'success', false,
            'message', 'Invalid Starting QR Code. Please scan the official starting banner in the seminar hall.'
        );
    END IF;

    -- 4. Idempotency check: Already started?
    IF v_team.status = 'active' AND EXISTS (SELECT 1 FROM team_progress WHERE team_id = v_team.id AND round_number = 1) THEN
        RETURN jsonb_build_object('success', true, 'message', 'Journey already in progress.', 'already_started', true);
    END IF;

    -- 5. Fetch Round 1 assigned location from team_routes
    SELECT location_id INTO v_first_location_id
    FROM team_routes
    WHERE team_id = v_team.id AND round_number = 1;

    IF v_first_location_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Team route not assigned. Please contact the field marshal.');
    END IF;

    -- 6. Fetch Round 1 puzzle
    SELECT * INTO v_first_puzzle
    FROM puzzles
    WHERE round_number = 1;

    IF v_first_puzzle.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Round 1 puzzle configuration missing.');
    END IF;

    v_round_duration := v_settings.round_duration_seconds;
    v_grace_duration := v_settings.grace_period_seconds;
    v_deadline := NOW() + (v_round_duration * INTERVAL '1 second');
    v_grace_deadline := v_deadline + (v_grace_duration * INTERVAL '1 second');

    -- 7. Initialize Round 1 Progress
    INSERT INTO team_progress (
        team_id, round_number, puzzle_id, location_id,
        puzzle_solved, qr_scanned, attempts_count,
        round_started_at, deadline_at, grace_deadline_at, status
    ) VALUES (
        v_team.id, 1, v_first_puzzle.id, v_first_location_id,
        false, false, 0,
        NOW(), v_deadline, v_grace_deadline, 'in_progress'
    ) ON CONFLICT (team_id, round_number) DO UPDATE
    SET 
        round_started_at = NOW(),
        deadline_at = v_deadline,
        grace_deadline_at = v_grace_deadline,
        status = 'in_progress';

    -- 8. Activate team
    UPDATE teams
    SET 
        status = 'active',
        started_at = COALESCE(started_at, NOW()),
        current_round = 1,
        updated_at = NOW()
    WHERE id = v_team.id;

    -- 9. Log valid scan & telemetry
    INSERT INTO qr_scans (team_id, round_number, scanned_token, scan_type, is_valid)
    VALUES (v_team.id, 1, p_starting_qr, 'start', true);

    INSERT INTO audit_logs (team_id, event_type, severity, details)
    VALUES (v_team.id, 'START_JOURNEY', 'info', jsonb_build_object('round', 1, 'location_id', v_first_location_id));

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Starting QR verified! Round 1 begins now. Good luck!',
        'round_number', 1,
        'puzzle', jsonb_build_object(
            'id', v_first_puzzle.id,
            'title', v_first_puzzle.title,
            'puzzle_type', v_first_puzzle.puzzle_type,
            'description_md', v_first_puzzle.description_md,
            'hints', v_first_puzzle.hints,
            'max_attempts', v_first_puzzle.max_attempts,
            'sample_cases', v_first_puzzle.sample_cases,
            'starter_code', v_first_puzzle.starter_code
        )
    );
END;
$$;

-- ------------------------------------------------------------------------------
-- Operation 5: submit_puzzle_answer
-- Validates answer server-side, checks event status & round deadline.
-- Enforces attempt limits, normalizes whitespace/case, unlocks location riddle.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION submit_puzzle_answer(
    p_team_id UUID,
    p_session_token VARCHAR,
    p_answer TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_token_hash VARCHAR;
    v_team RECORD;
    v_settings RECORD;
    v_progress RECORD;
    v_puzzle RECORD;
    v_submitted_norm TEXT;
    v_target_norm TEXT;
    v_is_correct BOOLEAN := false;
    v_attempt_num INT;
    v_accepted_ans TEXT;
    v_assigned_riddle TEXT;
BEGIN
    v_token_hash := encode(digest(p_session_token, 'sha256'), 'hex');

    -- 1. Validate team session with row lock
    SELECT * INTO v_team
    FROM teams
    WHERE id = p_team_id AND active_session_token_hash = v_token_hash
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Unauthorized team session.');
    END IF;

    IF v_team.status <> 'active' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Team is not active (Status: ' || v_team.status || ').');
    END IF;

    -- 2. Verify event is live
    SELECT * INTO v_settings FROM event_settings WHERE id = 1;
    IF v_settings.status <> 'live' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Competition is paused or not currently live.');
    END IF;

    -- 3. Fetch current round progress
    SELECT * INTO v_progress
    FROM team_progress
    WHERE team_id = v_team.id AND round_number = v_team.current_round
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'No active round in progress.');
    END IF;

    -- Check if round timer has expired (including grace period)
    IF v_progress.grace_deadline_at IS NOT NULL AND NOW() > v_progress.grace_deadline_at THEN
        UPDATE team_progress
        SET status = 'timed_out', updated_at = NOW()
        WHERE id = v_progress.id;

        INSERT INTO audit_logs (team_id, event_type, severity, details)
        VALUES (v_team.id, 'ROUND_TIMEOUT', 'danger', jsonb_build_object('round', v_team.current_round));

        RETURN jsonb_build_object(
            'success', false,
            'message', 'Round time limit and grace period have expired! Contact field marshals.',
            'timed_out', true
        );
    END IF;

    -- Fetch assigned location riddle clue
    SELECT COALESCE(NULLIF(l.riddle_clue, ''), (SELECT riddle_text FROM puzzles WHERE id = v_progress.puzzle_id))
    INTO v_assigned_riddle
    FROM team_routes tr
    JOIN locations l ON l.id = tr.location_id
    WHERE tr.team_id = v_team.id AND tr.round_number = v_team.current_round;

    IF v_assigned_riddle IS NULL THEN
        SELECT riddle_text INTO v_assigned_riddle FROM puzzles WHERE id = v_progress.puzzle_id;
    END IF;

    IF v_progress.puzzle_solved THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Question already solved for this round! Proceed to your physical checkpoint.',
            'already_solved', true,
            'riddle', v_assigned_riddle
        );
    END IF;

    -- 4. Fetch puzzle details
    SELECT * INTO v_puzzle
    FROM puzzles
    WHERE id = v_progress.puzzle_id;

    -- Check attempt limit
    IF v_progress.attempts_count >= v_puzzle.max_attempts THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Maximum attempts limit (' || v_puzzle.max_attempts || ') reached for this round. No further attempts permitted.'
        );
    END IF;

    -- Normalize submitted answer
    v_submitted_norm := TRIM(p_answer);
    IF v_puzzle.normalize_whitespace THEN
        v_submitted_norm := REGEXP_REPLACE(v_submitted_norm, '\s+', ' ', 'g');
    END IF;
    IF NOT v_puzzle.case_sensitive THEN
        v_submitted_norm := LOWER(v_submitted_norm);
    END IF;

    -- Compare against accepted answers array
    FOREACH v_accepted_ans IN ARRAY v_puzzle.accepted_answers
    LOOP
        v_target_norm := TRIM(v_accepted_ans);
        IF v_puzzle.normalize_whitespace THEN
            v_target_norm := REGEXP_REPLACE(v_target_norm, '\s+', ' ', 'g');
        END IF;
        IF NOT v_puzzle.case_sensitive THEN
            v_target_norm := LOWER(v_target_norm);
        END IF;

        IF v_submitted_norm = v_target_norm THEN
            v_is_correct := true;
            EXIT;
        END IF;
    END LOOP;

    v_attempt_num := v_progress.attempts_count + 1;

    -- Record submission record
    INSERT INTO submissions (team_id, round_number, puzzle_id, submitted_answer, is_correct, attempt_number)
    VALUES (v_team.id, v_team.current_round, v_puzzle.id, p_answer, v_is_correct, v_attempt_num);

    IF v_is_correct THEN
        -- Mark question solved
        UPDATE team_progress
        SET 
            puzzle_solved = true,
            puzzle_solved_at = NOW(),
            attempts_count = v_attempt_num,
            status = 'solved_pending_qr',
            updated_at = NOW()
        WHERE id = v_progress.id;

        INSERT INTO audit_logs (team_id, event_type, severity, details)
        VALUES (v_team.id, 'ANSWER_CORRECT', 'info', jsonb_build_object('round', v_team.current_round, 'attempts', v_attempt_num));

        RETURN jsonb_build_object(
            'success', true,
            'message', 'Correct answer! Physical checkpoint riddle unlocked.',
            'puzzle_solved', true,
            'round_number', v_team.current_round,
            'riddle', v_assigned_riddle
        );
    ELSE
        -- Mark attempt
        UPDATE team_progress
        SET 
            attempts_count = v_attempt_num,
            updated_at = NOW()
        WHERE id = v_progress.id;

        INSERT INTO audit_logs (team_id, event_type, severity, details)
        VALUES (v_team.id, 'ANSWER_INCORRECT', 'warning', jsonb_build_object('round', v_team.current_round, 'attempt', v_attempt_num));

        RETURN jsonb_build_object(
            'success', false,
            'message', 'Incorrect answer. Recheck your logic and try again.',
            'attempts_count', v_attempt_num,
            'max_attempts', v_puzzle.max_attempts
        );
    END IF;
END;
$$;

-- ------------------------------------------------------------------------------
-- Operation 6: verify_location_qr
-- Validates physical QR token against the team's assigned route for active round.
-- Includes anti-spam rate limiting (maximum 5 invalid scans per minute).
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION verify_location_qr(
    p_team_id UUID,
    p_session_token VARCHAR,
    p_qr_token VARCHAR
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_token_hash VARCHAR;
    v_team RECORD;
    v_settings RECORD;
    v_progress RECORD;
    v_assigned_location RECORD;
    v_scanned_location RECORD;
    v_next_round INT;
    v_next_puzzle RECORD;
    v_next_location_id INT;
    v_deadline TIMESTAMPTZ;
    v_grace_deadline TIMESTAMPTZ;
    v_active_locations_count INT;
    v_recent_invalid_scans INT;
BEGIN
    v_token_hash := encode(digest(p_session_token, 'sha256'), 'hex');

    -- 1. Validate team session with row lock
    SELECT * INTO v_team
    FROM teams
    WHERE id = p_team_id AND active_session_token_hash = v_token_hash
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Unauthorized team session.');
    END IF;

    IF v_team.status <> 'active' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Team is not active.');
    END IF;

    -- 2. Check event is live
    SELECT * INTO v_settings FROM event_settings WHERE id = 1;
    IF v_settings.status <> 'live' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Competition is paused or not currently live.');
    END IF;

    -- 3. Anti-Spam Rate Limit: Check invalid scans in the last 60 seconds
    SELECT COUNT(*) INTO v_recent_invalid_scans
    FROM qr_scans
    WHERE team_id = v_team.id AND is_valid = false AND created_at > (NOW() - INTERVAL '60 seconds');

    IF v_recent_invalid_scans >= 5 THEN
        INSERT INTO audit_logs (team_id, event_type, severity, details)
        VALUES (v_team.id, 'QR_RATE_LIMITED', 'danger', jsonb_build_object('recent_invalid', v_recent_invalid_scans));

        RETURN jsonb_build_object(
            'success', false,
            'message', 'Scanning temporarily throttled due to multiple invalid scans. Please wait 1 minute before trying again.'
        );
    END IF;

    -- 4. Fetch current round progress
    SELECT * INTO v_progress
    FROM team_progress
    WHERE team_id = v_team.id AND round_number = v_team.current_round
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'No active round found.');
    END IF;

    -- Check timeout
    IF v_progress.grace_deadline_at IS NOT NULL AND NOW() > v_progress.grace_deadline_at THEN
        UPDATE team_progress
        SET status = 'timed_out', updated_at = NOW()
        WHERE id = v_progress.id;

        RETURN jsonb_build_object(
            'success', false,
            'message', 'Round time limit and grace period have expired! Contact field marshals.',
            'timed_out', true
        );
    END IF;

    -- Must have solved puzzle first
    IF NOT v_progress.puzzle_solved THEN
        RETURN jsonb_build_object('success', false, 'message', 'You must solve the question before scanning the checkpoint QR!');
    END IF;

    IF v_progress.qr_scanned THEN
        RETURN jsonb_build_object('success', false, 'message', 'Checkpoint QR has already been verified for this round.');
    END IF;

    -- 5. Retrieve assigned location for this team in this round
    SELECT l.* INTO v_assigned_location
    FROM team_routes tr
    JOIN locations l ON l.id = tr.location_id
    WHERE tr.team_id = v_team.id AND tr.round_number = v_team.current_round;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Assigned route location not found. Contact organizers.');
    END IF;

    -- 6. Check if the scanned token matches ANY location (for audit tracking)
    SELECT * INTO v_scanned_location
    FROM locations
    WHERE qr_token = TRIM(p_qr_token);

    -- 7. Strict Verification: Does the scanned token match the assigned checkpoint?
    IF v_assigned_location.qr_token <> TRIM(p_qr_token) THEN
        INSERT INTO qr_scans (team_id, round_number, scanned_token, location_id, scan_type, is_valid)
        VALUES (v_team.id, v_team.current_round, p_qr_token, v_scanned_location.id, 'location', false);

        INSERT INTO audit_logs (team_id, event_type, severity, details)
        VALUES (v_team.id, 'QR_WRONG_LOCATION', 'danger', jsonb_build_object(
            'expected_location', v_assigned_location.name,
            'scanned_location', COALESCE(v_scanned_location.name, 'UNKNOWN_TOKEN')
        ));

        RETURN jsonb_build_object(
            'success', false,
            'message', 'Wrong checkpoint! This QR code does not belong to your assigned checkpoint for this round.'
        );
    END IF;

    -- 8. Valid Checkpoint Scanned! Complete active round progress
    UPDATE team_progress
    SET 
        qr_scanned = true,
        qr_scanned_at = NOW(),
        completed_at = NOW(),
        status = 'completed',
        updated_at = NOW()
    WHERE id = v_progress.id;

    INSERT INTO qr_scans (team_id, round_number, scanned_token, location_id, scan_type, is_valid)
    VALUES (v_team.id, v_team.current_round, p_qr_token, v_assigned_location.id, 'location', true);

    -- 9. Check if this was the final active checkpoint
    v_active_locations_count := v_settings.active_locations_count;

    IF v_team.current_round < v_active_locations_count THEN
        -- Advance to next round
        v_next_round := v_team.current_round + 1;

        SELECT location_id INTO v_next_location_id
        FROM team_routes
        WHERE team_id = v_team.id AND round_number = v_next_round;

        SELECT * INTO v_next_puzzle
        FROM puzzles
        WHERE round_number = v_next_round;

        v_deadline := NOW() + (v_settings.round_duration_seconds * INTERVAL '1 second');
        v_grace_deadline := v_deadline + (v_settings.grace_period_seconds * INTERVAL '1 second');

        -- Create next round progress record
        INSERT INTO team_progress (
            team_id, round_number, puzzle_id, location_id,
            puzzle_solved, qr_scanned, attempts_count,
            round_started_at, deadline_at, grace_deadline_at, status
        ) VALUES (
            v_team.id, v_next_round, v_next_puzzle.id, v_next_location_id,
            false, false, 0,
            NOW(), v_deadline, v_grace_deadline, 'in_progress'
        ) ON CONFLICT (team_id, round_number) DO UPDATE
        SET 
            round_started_at = NOW(),
            deadline_at = v_deadline,
            grace_deadline_at = v_grace_deadline,
            status = 'in_progress';

        UPDATE teams
        SET 
            current_round = v_next_round,
            updated_at = NOW()
        WHERE id = v_team.id;

        INSERT INTO audit_logs (team_id, event_type, severity, details)
        VALUES (v_team.id, 'ROUND_ADVANCED', 'info', jsonb_build_object('completed_round', v_team.current_round, 'new_round', v_next_round));

        RETURN jsonb_build_object(
            'success', true,
            'message', 'Checkpoint verified! Round ' || v_team.current_round || ' completed. Round ' || v_next_round || ' unlocked.',
            'round_completed', v_team.current_round,
            'next_round', v_next_round,
            'all_rounds_complete', false,
            'puzzle', jsonb_build_object(
                'id', v_next_puzzle.id,
                'title', v_next_puzzle.title,
                'puzzle_type', v_next_puzzle.puzzle_type,
                'description_md', v_next_puzzle.description_md,
                'hints', v_next_puzzle.hints,
                'max_attempts', v_next_puzzle.max_attempts,
                'sample_cases', v_next_puzzle.sample_cases,
                'starter_code', v_next_puzzle.starter_code
            )
        );
    ELSE
        -- All active checkpoints completed! Direct to Seminar Hall
        INSERT INTO audit_logs (team_id, event_type, severity, details)
        VALUES (v_team.id, 'ALL_CHECKPOINTS_COMPLETED', 'info', jsonb_build_object('total_completed', v_active_locations_count));

        RETURN jsonb_build_object(
            'success', true,
            'message', 'Spectacular work! You have completed all ' || v_active_locations_count || ' checkpoints! Sprint back to the Seminar Hall and scan the Final Victory QR Code!',
            'round_completed', v_team.current_round,
            'all_rounds_complete', true
        );
    END IF;
END;
$$;

-- ------------------------------------------------------------------------------
-- Operation 7: complete_team_journey
-- Scans the Seminar Hall Final QR, verifies all active rounds, logs authoritative timestamp.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION complete_team_journey(
    p_team_id UUID,
    p_session_token VARCHAR,
    p_final_qr VARCHAR
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_token_hash VARCHAR;
    v_team RECORD;
    v_settings RECORD;
    v_completed_count INT;
    v_total_ms BIGINT;
    v_rank INT;
BEGIN
    v_token_hash := encode(digest(p_session_token, 'sha256'), 'hex');

    -- 1. Validate team session with row lock
    SELECT * INTO v_team
    FROM teams
    WHERE id = p_team_id AND active_session_token_hash = v_token_hash
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Unauthorized team session.');
    END IF;

    IF v_team.status = 'completed' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Team has already completed the hunt and recorded final time.');
    END IF;

    -- 2. Fetch event settings: MUST BE 'live'
    SELECT * INTO v_settings FROM event_settings WHERE id = 1;
    IF v_settings.status <> 'live' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Competition is paused or not currently live.');
    END IF;

    -- 3. Verify Final QR Code
    IF TRIM(p_final_qr) <> v_settings.final_qr_token THEN
        INSERT INTO qr_scans (team_id, round_number, scanned_token, scan_type, is_valid)
        VALUES (v_team.id, v_team.current_round, p_final_qr, 'final', false);

        RETURN jsonb_build_object('success', false, 'message', 'Invalid Final Seminar Hall QR Code.');
    END IF;

    -- 4. Verify all active rounds were genuinely completed
    SELECT COUNT(*) INTO v_completed_count
    FROM team_progress
    WHERE team_id = v_team.id AND status = 'completed';

    IF v_completed_count < v_settings.active_locations_count THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Incomplete hunt! You have only completed ' || v_completed_count || ' of ' || v_settings.active_locations_count || ' checkpoints.'
        );
    END IF;

    -- 5. Calculate official elapsed time in milliseconds
    v_total_ms := ROUND(EXTRACT(EPOCH FROM (NOW() - v_team.started_at)) * 1000) - v_settings.total_pause_duration_ms;
    IF v_total_ms < 0 THEN
        v_total_ms := 0;
    END IF;

    -- 6. Finalize team completion
    UPDATE teams
    SET 
        status = 'completed',
        completed_at = NOW(),
        total_time_ms = v_total_ms,
        updated_at = NOW()
    WHERE id = v_team.id;

    INSERT INTO qr_scans (team_id, round_number, scanned_token, scan_type, is_valid)
    VALUES (v_team.id, v_team.current_round, p_final_qr, 'final', true);

    -- Calculate current rank among completed teams
    SELECT COUNT(*) + 1 INTO v_rank
    FROM teams
    WHERE status = 'completed' AND total_time_ms < v_total_ms;

    INSERT INTO audit_logs (team_id, event_type, severity, details)
    VALUES (v_team.id, 'TEAM_COMPLETED', 'info', jsonb_build_object('rank', v_rank, 'total_time_ms', v_total_ms));

    RETURN jsonb_build_object(
        'success', true,
        'message', 'VICTORY! MIND MAZE 2.0 successfully finished! Report to the organizers.',
        'rank', v_rank,
        'completed_at', NOW(),
        'total_time_ms', v_total_ms
    );
END;
$$;

-- ------------------------------------------------------------------------------
-- Operation 8: generate_team_routes
-- Generates balanced Latin Square route allocation matrix for all teams.
-- Accessible to administrators only.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION generate_team_routes(p_active_locations INT DEFAULT 10)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_team_ids UUID[];
    v_location_ids INT[];
    v_num_teams INT;
    v_t_idx INT;
    v_round INT;
    v_loc_offset INT;
    v_count INT := 0;
BEGIN
    IF NOT is_admin() THEN
        RETURN jsonb_build_object('success', false, 'message', 'Unauthorized: Admin privileges required.');
    END IF;

    IF p_active_locations NOT BETWEEN 7 AND 10 THEN
        RETURN jsonb_build_object('success', false, 'message', 'Active locations must be between 7 and 10.');
    END IF;

    -- Collect all active teams ordered deterministically
    SELECT ARRAY_AGG(id ORDER BY team_code) INTO v_team_ids FROM teams;
    v_num_teams := COALESCE(ARRAY_LENGTH(v_team_ids, 1), 0);

    IF v_num_teams = 0 THEN
        RETURN jsonb_build_object('success', false, 'message', 'No teams found to allocate routes.');
    END IF;

    -- Collect location IDs (1 to p_active_locations)
    SELECT ARRAY_AGG(id ORDER BY location_number) INTO v_location_ids
    FROM locations
    WHERE location_number <= p_active_locations;

    -- Wipe existing unlocked routes
    DELETE FROM team_routes;

    -- Shifted Latin Square generation:
    -- For team index i (0-based) and round r (1 to N):
    -- location_index = (i + (r - 1)) mod N
    FOR v_t_idx IN 1..v_num_teams LOOP
        FOR v_round IN 1..p_active_locations LOOP
            v_loc_offset := ((v_t_idx - 1) + (v_round - 1)) % p_active_locations;
            
            INSERT INTO team_routes (team_id, round_number, location_id)
            VALUES (
                v_team_ids[v_t_idx],
                v_round,
                v_location_ids[v_loc_offset + 1]
            );
            v_count := v_count + 1;
        END LOOP;
    END LOOP;

    -- Update event settings & location active states
    UPDATE event_settings
    SET 
        active_locations_count = p_active_locations,
        routes_locked = true,
        updated_at = NOW()
    WHERE id = 1;

    UPDATE locations
    SET active = (location_number <= p_active_locations);

    INSERT INTO audit_logs (event_type, severity, details)
    VALUES ('ROUTES_GENERATED', 'info', jsonb_build_object('teams_count', v_num_teams, 'active_locations', p_active_locations, 'total_allocations', v_count));

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Balanced Latin Square routes successfully generated and locked.',
        'total_teams', v_num_teams,
        'active_locations', p_active_locations,
        'routes_created', v_count
    );
END;
$$;

-- ------------------------------------------------------------------------------
-- Operation 9: Admin Helper Operations
-- ------------------------------------------------------------------------------

-- Admin: Reset team device session (for hardware/battery failures)
CREATE OR REPLACE FUNCTION admin_reset_team_session(p_team_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
    IF NOT is_admin() THEN
        RETURN jsonb_build_object('success', false, 'message', 'Unauthorized: Admin privileges required.');
    END IF;

    UPDATE teams
    SET 
        active_session_token_hash = NULL,
        device_fingerprint = NULL,
        failed_login_attempts = 0,
        locked_until = NULL,
        updated_at = NOW()
    WHERE id = p_team_id;

    INSERT INTO audit_logs (team_id, event_type, severity, details)
    VALUES (p_team_id, 'ADMIN_RESET_SESSION', 'warning', jsonb_build_object('admin_id', auth.uid()));

    RETURN jsonb_build_object('success', true, 'message', 'Team session unlocked successfully.');
END;
$$;

-- Admin: Reset team progress (with audit logging)
CREATE OR REPLACE FUNCTION admin_reset_team_progress(p_team_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
    IF NOT is_admin() THEN
        RETURN jsonb_build_object('success', false, 'message', 'Unauthorized: Admin privileges required.');
    END IF;

    DELETE FROM submissions WHERE team_id = p_team_id;
    DELETE FROM qr_scans WHERE team_id = p_team_id;
    DELETE FROM team_progress WHERE team_id = p_team_id;

    UPDATE teams
    SET 
        status = 'ready',
        current_round = 1,
        total_strikes = 0,
        started_at = NULL,
        completed_at = NULL,
        total_time_ms = NULL,
        elimination_reason = NULL,
        updated_at = NOW()
    WHERE id = p_team_id;

    INSERT INTO audit_logs (team_id, event_type, severity, details)
    VALUES (p_team_id, 'ADMIN_RESET_PROGRESS', 'danger', jsonb_build_object('admin_id', auth.uid()));

    RETURN jsonb_build_object('success', true, 'message', 'Team progress reset to clean initial state.');
END;
$$;

-- Admin: Regenerate all event QR tokens (Generates fresh random cryptographic tokens before match day)
-- Guarantees 100% token uniqueness across all locations
CREATE OR REPLACE FUNCTION admin_regenerate_event_qr_tokens()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_loc RECORD;
    v_new_token VARCHAR;
    v_used_tokens TEXT[] := '{}';
BEGIN
    IF NOT is_admin() THEN
        RETURN jsonb_build_object('success', false, 'message', 'Unauthorized: Admin privileges required.');
    END IF;

    -- Regenerate each location's 10-digit random token using pgcrypto bytes with collision check
    FOR v_loc IN SELECT id FROM locations ORDER BY id LOOP
        LOOP
            v_new_token := LPAD((abs(('x' || encode(gen_random_bytes(4), 'hex'))::bit(32)::bigint) % 9000000000 + 1000000000)::TEXT, 10, '0');
            EXIT WHEN NOT (v_new_token = ANY(v_used_tokens));
        END LOOP;
        
        v_used_tokens := array_append(v_used_tokens, v_new_token);
        UPDATE locations SET qr_token = v_new_token, updated_at = NOW() WHERE id = v_loc.id;
    END LOOP;

    -- Regenerate start and final tokens
    UPDATE event_settings
    SET 
        starting_qr_token = 'MM2-START-' || UPPER(encode(gen_random_bytes(4), 'hex')),
        final_qr_token = 'MM2-FINISH-' || UPPER(encode(gen_random_bytes(4), 'hex')),
        qr_tokens_regenerated = true,
        updated_at = NOW()
    WHERE id = 1;

    INSERT INTO audit_logs (event_type, severity, details)
    VALUES ('QR_TOKENS_REGENERATED', 'danger', jsonb_build_object('admin_id', auth.uid()));

    RETURN jsonb_build_object(
        'success', true,
        'message', 'All event QR tokens regenerated successfully with unique cryptographic values.'
    );
END;
$$;

-- Admin: Randomize and Output Secure Team Credentials (For event badge printing)
-- Generates 8-character cryptographic alphanumeric passcodes (e.g. MM2-A7F9B2C4)
CREATE OR REPLACE FUNCTION admin_randomize_team_credentials()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_team RECORD;
    v_new_pass VARCHAR;
    v_results JSONB := '[]'::jsonb;
BEGIN
    IF NOT is_admin() THEN
        RETURN jsonb_build_object('success', false, 'message', 'Unauthorized: Admin privileges required.');
    END IF;

    FOR v_team IN SELECT id, team_code, team_name FROM teams ORDER BY team_code LOOP
        v_new_pass := 'MM2-' || UPPER(encode(gen_random_bytes(4), 'hex'));
        
        UPDATE teams
        SET 
            passcode_hash = crypt(v_new_pass, gen_salt('bf', 10)),
            active_session_token_hash = NULL,
            failed_login_attempts = 0,
            locked_until = NULL,
            credentials_randomized = true,
            updated_at = NOW()
        WHERE id = v_team.id;

        v_results := v_results || jsonb_build_object(
            'team_code', v_team.team_code,
            'team_name', v_team.team_name,
            'passcode', v_new_pass
        );
    END LOOP;

    -- Audit log records that credentials were randomized without exposing the passcodes
    INSERT INTO audit_logs (event_type, severity, details)
    VALUES ('CREDENTIALS_RANDOMIZED', 'danger', jsonb_build_object('admin_id', auth.uid()));

    RETURN jsonb_build_object(
        'success', true,
        'message', 'All team passcodes randomized successfully. Distribute securely to team leads.',
        'credentials', v_results
    );
END;
$$;

-- ------------------------------------------------------------------------------
-- Operation 10: Dedicated Setup Bootstrap Functions
-- Strictly restricted to postgres (SQL Editor) and service_role.
-- Completely inaccessible to anon and authenticated application roles.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION bootstrap_randomize_team_credentials()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_team RECORD;
    v_new_pass VARCHAR;
    v_results JSONB := '[]'::jsonb;
BEGIN
    FOR v_team IN SELECT id, team_code, team_name FROM teams ORDER BY team_code LOOP
        v_new_pass := 'MM2-' || UPPER(encode(gen_random_bytes(4), 'hex'));
        
        UPDATE teams
        SET 
            passcode_hash = crypt(v_new_pass, gen_salt('bf', 10)),
            active_session_token_hash = NULL,
            failed_login_attempts = 0,
            locked_until = NULL,
            credentials_randomized = true,
            updated_at = NOW()
        WHERE id = v_team.id;

        v_results := v_results || jsonb_build_object(
            'team_code', v_team.team_code,
            'team_name', v_team.team_name,
            'passcode', v_new_pass
        );
    END LOOP;

    INSERT INTO audit_logs (event_type, severity, details)
    VALUES ('CREDENTIALS_BOOTSTRAPPED', 'danger', jsonb_build_object('executor', current_user));

    RETURN jsonb_build_object(
        'success', true,
        'message', 'All team passcodes bootstrapped successfully.',
        'credentials', v_results
    );
END;
$$;

CREATE OR REPLACE FUNCTION bootstrap_regenerate_event_qr_tokens()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_loc RECORD;
    v_new_token VARCHAR;
    v_used_tokens TEXT[] := '{}';
BEGIN
    FOR v_loc IN SELECT id FROM locations ORDER BY id LOOP
        LOOP
            v_new_token := LPAD((abs(('x' || encode(gen_random_bytes(4), 'hex'))::bit(32)::bigint) % 9000000000 + 1000000000)::TEXT, 10, '0');
            EXIT WHEN NOT (v_new_token = ANY(v_used_tokens));
        END LOOP;
        
        v_used_tokens := array_append(v_used_tokens, v_new_token);
        UPDATE locations SET qr_token = v_new_token, updated_at = NOW() WHERE id = v_loc.id;
    END LOOP;

    UPDATE event_settings
    SET 
        starting_qr_token = 'MM2-START-' || UPPER(encode(gen_random_bytes(4), 'hex')),
        final_qr_token = 'MM2-FINISH-' || UPPER(encode(gen_random_bytes(4), 'hex')),
        qr_tokens_regenerated = true,
        updated_at = NOW()
    WHERE id = 1;

    INSERT INTO audit_logs (event_type, severity, details)
    VALUES ('QR_TOKENS_BOOTSTRAPPED', 'danger', jsonb_build_object('executor', current_user));

    RETURN jsonb_build_object(
        'success', true,
        'message', 'All event QR tokens bootstrapped successfully with unique values.'
    );
END;
$$;

-- ------------------------------------------------------------------------------
-- 7. SUPABASE REALTIME REPLICATION CONFIGURATION
-- Replicates core game state changes strictly to the authenticated admin dashboard.
-- ------------------------------------------------------------------------------
ALTER TABLE teams REPLICA IDENTITY FULL;
ALTER TABLE team_progress REPLICA IDENTITY FULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'teams'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE teams;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'team_progress'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE team_progress;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'event_settings'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE event_settings;
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 8. EXPLICIT FUNCTION EXECUTION PRIVILEGES
-- Grant execution permissions strictly to required roles.
-- ------------------------------------------------------------------------------
REVOKE ALL ON FUNCTION is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;

REVOKE ALL ON FUNCTION login_team(VARCHAR, VARCHAR, VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION login_team(VARCHAR, VARCHAR, VARCHAR) TO anon, authenticated;

REVOKE ALL ON FUNCTION logout_team(UUID, VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION logout_team(UUID, VARCHAR) TO anon, authenticated;

REVOKE ALL ON FUNCTION get_team_state(UUID, VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_team_state(UUID, VARCHAR) TO anon, authenticated;

REVOKE ALL ON FUNCTION start_team_journey(UUID, VARCHAR, VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION start_team_journey(UUID, VARCHAR, VARCHAR) TO anon, authenticated;

REVOKE ALL ON FUNCTION submit_puzzle_answer(UUID, VARCHAR, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION submit_puzzle_answer(UUID, VARCHAR, TEXT) TO anon, authenticated;

REVOKE ALL ON FUNCTION verify_location_qr(UUID, VARCHAR, VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION verify_location_qr(UUID, VARCHAR, VARCHAR) TO anon, authenticated;

REVOKE ALL ON FUNCTION complete_team_journey(UUID, VARCHAR, VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION complete_team_journey(UUID, VARCHAR, VARCHAR) TO anon, authenticated;

REVOKE ALL ON FUNCTION generate_team_routes(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION generate_team_routes(INT) TO authenticated;

REVOKE ALL ON FUNCTION admin_reset_team_session(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_reset_team_session(UUID) TO authenticated;

REVOKE ALL ON FUNCTION admin_reset_team_progress(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_reset_team_progress(UUID) TO authenticated;

REVOKE ALL ON FUNCTION admin_regenerate_event_qr_tokens() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_regenerate_event_qr_tokens() TO authenticated;

REVOKE ALL ON FUNCTION admin_randomize_team_credentials() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_randomize_team_credentials() TO authenticated;

-- Bootstrap operations: Strictly restricted to postgres (SQL Editor) and service_role.
-- Denied to all public and application roles (anon, authenticated).
REVOKE ALL ON FUNCTION bootstrap_randomize_team_credentials() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION bootstrap_randomize_team_credentials() TO postgres, service_role;

REVOKE ALL ON FUNCTION bootstrap_regenerate_event_qr_tokens() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION bootstrap_regenerate_event_qr_tokens() TO postgres, service_role;


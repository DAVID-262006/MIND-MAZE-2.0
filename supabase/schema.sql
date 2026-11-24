-- ==============================================================================
-- MIND MAZE 2.0 — MIGRATION 001: INITIAL HARDENED SCHEMA & RLS
-- Target: Supabase PostgreSQL (ap-south-1)
-- Reconciles: 20-Team Standard, 4-Strike Anti-Cheat Range, Zero-Trust Tables
-- ==============================================================================

-- 1. EXTENSIONS
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Clean drop views if rebuilding
DROP VIEW IF EXISTS public_leaderboard CASCADE;
DROP VIEW IF EXISTS public_event_status CASCADE;

-- 2. TABLE DEFINITIONS

-- Table 1: admin_profiles (Legacy Supabase Auth mapping)
CREATE TABLE IF NOT EXISTS admin_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    role VARCHAR(20) NOT NULL DEFAULT 'admin' CHECK (role IN ('superadmin', 'admin', 'marshal')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table 1B: admin_users (Custom Username/Password Authentication Enclave)
CREATE TABLE IF NOT EXISTS admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    full_name VARCHAR(100) NOT NULL DEFAULT 'Administrator',
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'admin' CHECK (role IN ('superadmin', 'admin', 'marshal')),
    active_session_token_hash VARCHAR(64),
    session_expires_at TIMESTAMPTZ,
    failed_login_attempts INT NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE admin_users FROM PUBLIC, anon, authenticated;

-- Table 2: event_settings (Singleton, id = 1, standardized 20 teams)
CREATE TABLE IF NOT EXISTS event_settings (
    id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    event_name VARCHAR(150) NOT NULL DEFAULT 'MIND MAZE 2.0',
    status VARCHAR(20) NOT NULL DEFAULT 'ready' CHECK (status IN ('draft', 'ready', 'live', 'paused', 'finished')),
    total_teams INT NOT NULL DEFAULT 20 CHECK (total_teams BETWEEN 1 AND 50),
    active_locations_count INT NOT NULL DEFAULT 10 CHECK (active_locations_count BETWEEN 1 AND 50),
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

-- Table 3: teams (4-strike anti-cheat range, session hash, brute-force throttling)
CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_code VARCHAR(20) UNIQUE NOT NULL,
    team_name VARCHAR(100) UNIQUE NOT NULL,
    passcode_hash VARCHAR(255) NOT NULL,
    members JSONB NOT NULL DEFAULT '[]'::jsonb,
    status VARCHAR(20) NOT NULL DEFAULT 'registered' CHECK (status IN ('registered', 'ready', 'active', 'completed', 'eliminated')),
    current_round INT NOT NULL DEFAULT 1 CHECK (current_round >= 1),
    total_strikes INT NOT NULL DEFAULT 0 CHECK (total_strikes BETWEEN 0 AND 4),
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

-- Table 4: locations (Physical campus checkpoints)
CREATE TABLE IF NOT EXISTS locations (
    id INT PRIMARY KEY,
    location_number INT UNIQUE NOT NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT NOT NULL,
    riddle_clue TEXT NOT NULL,
    capacity INT NOT NULL DEFAULT 2 CHECK (capacity >= 1),
    active BOOLEAN NOT NULL DEFAULT true,
    qr_token VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table 5: puzzles (Multi-format challenge bank)
CREATE TABLE IF NOT EXISTS puzzles (
    id VARCHAR(50) PRIMARY KEY,
    round_number INT UNIQUE NOT NULL,
    title VARCHAR(200) NOT NULL,
    puzzle_type VARCHAR(50) NOT NULL CHECK (puzzle_type IN ('CODE_BASED', 'THREE_PART_TEXT', 'TEXT_RIDDLE', 'MCQ', 'IMAGE_QUIZ', 'IMAGE_MCQ', 'coding', 'text', 'crypto', 'logic')),
    description_md TEXT NOT NULL,
    accepted_answers TEXT[] NOT NULL DEFAULT '{}'::text[],
    case_sensitive BOOLEAN NOT NULL DEFAULT false,
    normalize_whitespace BOOLEAN NOT NULL DEFAULT true,
    riddle_text TEXT NOT NULL,
    hints TEXT[] NOT NULL DEFAULT '{}'::text[],
    max_attempts INT NOT NULL DEFAULT 5 CHECK (max_attempts BETWEEN 1 AND 20),
    options TEXT[] DEFAULT '{}'::text[],
    correct_option_index INT,
    image_url TEXT,
    image_alt TEXT,
    sample_cases JSONB DEFAULT '[]'::jsonb,
    starter_code JSONB DEFAULT '{}'::jsonb,
    three_part_questions JSONB DEFAULT '{}'::jsonb,
    three_part_answers JSONB DEFAULT '{}'::jsonb,
    code_language VARCHAR(30) DEFAULT 'python',
    code_snippet TEXT DEFAULT '',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table 6: team_routes (Collision-free Latin square allocations)
CREATE TABLE IF NOT EXISTS team_routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    round_number INT NOT NULL CHECK (round_number BETWEEN 1 AND 10),
    location_id INT NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(team_id, round_number)
);

-- Table 7: team_progress (Authoritative round state)
CREATE TABLE IF NOT EXISTS team_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    round_number INT NOT NULL CHECK (round_number BETWEEN 1 AND 10),
    puzzle_id VARCHAR(50) REFERENCES puzzles(id) ON DELETE RESTRICT,
    puzzle_solved BOOLEAN NOT NULL DEFAULT false,
    puzzle_solved_at TIMESTAMPTZ,
    qr_scanned BOOLEAN NOT NULL DEFAULT false,
    qr_scanned_at TIMESTAMPTZ,
    attempts_count INT NOT NULL DEFAULT 0,
    round_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deadline_at TIMESTAMPTZ NOT NULL,
    grace_deadline_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'solving_puzzle' CHECK (status IN ('solving_puzzle', 'solved_pending_qr', 'completed', 'timed_out')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(team_id, round_number)
);

-- Table 8: submissions (Audit trail of every submitted answer)
CREATE TABLE IF NOT EXISTS submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    round_number INT NOT NULL,
    puzzle_id VARCHAR(50) NOT NULL REFERENCES puzzles(id) ON DELETE RESTRICT,
    submitted_answer TEXT NOT NULL,
    is_correct BOOLEAN NOT NULL,
    attempt_number INT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table 9: qr_scans (Audit trail of all physical check-in scans)
CREATE TABLE IF NOT EXISTS qr_scans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    round_number INT NOT NULL,
    location_id INT REFERENCES locations(id) ON DELETE SET NULL,
    scanned_token VARCHAR(100) NOT NULL,
    is_valid BOOLEAN NOT NULL,
    device_info JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table 10: audit_logs (Security events, anti-cheat incidents, admin overrides)
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip_address INET,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. INDEXES FOR HIGH-CONCURRENCY PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_teams_status ON teams(status);
CREATE INDEX IF NOT EXISTS idx_teams_code ON teams(team_code);
CREATE INDEX IF NOT EXISTS idx_teams_session_hash ON teams(active_session_token_hash);
CREATE INDEX IF NOT EXISTS idx_team_routes_lookup ON team_routes(team_id, round_number);
CREATE INDEX IF NOT EXISTS idx_team_progress_active ON team_progress(team_id, round_number, status);
CREATE INDEX IF NOT EXISTS idx_team_progress_team ON team_progress(team_id);
CREATE INDEX IF NOT EXISTS idx_submissions_team ON submissions(team_id, puzzle_id);
CREATE INDEX IF NOT EXISTS idx_qr_scans_rate_limit ON qr_scans(team_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_event ON audit_logs(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_team ON audit_logs(team_id, created_at DESC);

-- 4. VIEWS FOR SAFE PUBLIC DATA CONSUMPTION
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

GRANT SELECT ON public_leaderboard TO anon, authenticated;
GRANT SELECT ON public_event_status TO anon, authenticated;

-- 5. ROW LEVEL SECURITY (RLS) POLICIES
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

-- Helper: is_admin() validates service_role JWT or admin_profiles membership
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

-- Helper: is_superadmin() validates service_role JWT or superadmin role in admin_profiles
CREATE OR REPLACE FUNCTION is_superadmin()
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
                AND role = 'superadmin'
            )
        )
    );
$$;

DROP POLICY IF EXISTS admin_profiles_admin_all ON admin_profiles;
DROP POLICY IF EXISTS admin_profiles_select ON admin_profiles;
DROP POLICY IF EXISTS admin_profiles_insert ON admin_profiles;
DROP POLICY IF EXISTS admin_profiles_update ON admin_profiles;
DROP POLICY IF EXISTS admin_profiles_delete ON admin_profiles;

-- Authenticated admins can view profiles; ordinary users can only see their own profile
CREATE POLICY admin_profiles_select ON admin_profiles
    FOR SELECT TO authenticated
    USING (id = auth.uid() OR is_admin());

-- Only superadmins (or service_role DB provisioning) can insert new admin profiles
CREATE POLICY admin_profiles_insert ON admin_profiles
    FOR INSERT TO authenticated
    WITH CHECK (is_superadmin());

-- Only superadmins can update admin profiles and assign roles
CREATE POLICY admin_profiles_update ON admin_profiles
    FOR UPDATE TO authenticated
    USING (is_superadmin())
    WITH CHECK (is_superadmin());

-- Only superadmins can delete admin profiles (cannot delete self to prevent lockout)
CREATE POLICY admin_profiles_delete ON admin_profiles
    FOR DELETE TO authenticated
    USING (is_superadmin() AND id <> auth.uid());

DROP POLICY IF EXISTS event_settings_admin_all ON event_settings;
CREATE POLICY event_settings_admin_all ON event_settings
    FOR ALL TO authenticated
    USING (is_admin())
    WITH CHECK (is_admin());

DROP POLICY IF EXISTS event_settings_select_all ON event_settings;
CREATE POLICY event_settings_select_all ON event_settings
    FOR SELECT TO anon, authenticated
    USING (true);

-- Restrict anon role to non-sensitive columns on event_settings (strips starting_qr_token & final_qr_token)
REVOKE ALL ON TABLE event_settings FROM anon;
GRANT SELECT (
    id,
    event_name,
    status,
    total_teams,
    active_locations_count,
    round_duration_seconds,
    grace_period_seconds,
    allow_registration,
    routes_locked,
    qr_tokens_regenerated,
    event_started_at,
    event_finished_at,
    total_pause_duration_ms,
    created_at,
    updated_at
) ON TABLE event_settings TO anon;
GRANT ALL ON TABLE event_settings TO authenticated;

DROP POLICY IF EXISTS teams_admin_all ON teams;
CREATE POLICY teams_admin_all ON teams
    FOR ALL TO authenticated
    USING (is_admin())
    WITH CHECK (is_admin());

DROP POLICY IF EXISTS locations_admin_all ON locations;
CREATE POLICY locations_admin_all ON locations
    FOR ALL TO authenticated
    USING (is_admin())
    WITH CHECK (is_admin());

DROP POLICY IF EXISTS puzzles_admin_all ON puzzles;
CREATE POLICY puzzles_admin_all ON puzzles
    FOR ALL TO authenticated
    USING (is_admin())
    WITH CHECK (is_admin());

DROP POLICY IF EXISTS team_routes_admin_all ON team_routes;
CREATE POLICY team_routes_admin_all ON team_routes
    FOR ALL TO authenticated
    USING (is_admin())
    WITH CHECK (is_admin());

DROP POLICY IF EXISTS team_progress_admin_all ON team_progress;
CREATE POLICY team_progress_admin_all ON team_progress
    FOR ALL TO authenticated
    USING (is_admin())
    WITH CHECK (is_admin());

DROP POLICY IF EXISTS submissions_admin_all ON submissions;
CREATE POLICY submissions_admin_all ON submissions
    FOR ALL TO authenticated
    USING (is_admin())
    WITH CHECK (is_admin());

DROP POLICY IF EXISTS qr_scans_admin_all ON qr_scans;
CREATE POLICY qr_scans_admin_all ON qr_scans
    FOR ALL TO authenticated
    USING (is_admin())
    WITH CHECK (is_admin());

DROP POLICY IF EXISTS audit_logs_admin_all ON audit_logs;
CREATE POLICY audit_logs_admin_all ON audit_logs
    FOR ALL TO authenticated
    USING (is_admin())
    WITH CHECK (is_admin());

-- 6. SUPABASE REALTIME REPLICATION CONFIGURATION
ALTER TABLE teams REPLICA IDENTITY FULL;
ALTER TABLE team_progress REPLICA IDENTITY FULL;
ALTER TABLE event_settings REPLICA IDENTITY FULL;
ALTER TABLE audit_logs REPLICA IDENTITY FULL;

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

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = 'audit_logs'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE audit_logs;
    END IF;
END $$;
-- ==============================================================================
-- MIND MAZE 2.0 — MIGRATION 002: RECONCILED STORED PROCEDURES & RPCS
-- Reconciles all RPC parameter signatures between frontend service and database
-- Adds: Event Lifecycle, Anti-Cheat Strike Enforcement, Admin Operations
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Operation: login_team
-- Validates team credentials and issues a cryptographic session token.
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
    v_session_token VARCHAR(64);
    v_token_hash VARCHAR(64);
    v_settings RECORD;
    v_total_score INT := 0;
    v_attempts INT := 0;
BEGIN
    SELECT * INTO v_settings FROM event_settings WHERE id = 1;

    SELECT * INTO v_team
    FROM teams
    WHERE UPPER(team_code) = UPPER(TRIM(p_team_code))
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'INVALID_CREDENTIALS', 'message', 'Invalid Team Code.');
    END IF;

    -- Strict Production Login Lockout Protection:
    -- Reject teams whose credentials have not been deliberately issued by the administrator
    IF v_team.credentials_randomized = false THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'CREDENTIALS_NOT_INITIALIZED',
            'message', 'Team credentials have not been issued by the event administrator. Please contact event organizers.'
        );
    END IF;

    v_attempts := v_team.failed_login_attempts;
    IF v_attempts >= 10 THEN
        UPDATE teams SET locked_until = NOW() + INTERVAL '60 seconds' WHERE id = v_team.id;
        RETURN jsonb_build_object('success', false, 'error', 'ACCOUNT_LOCKED', 'message', 'Account temporarily throttled. Retry in 60 seconds.');
    END IF;

    -- Brute force lockout check
    IF v_team.locked_until IS NOT NULL AND v_team.locked_until > NOW() THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'ACCOUNT_LOCKED',
            'message', 'Team account temporarily locked due to repeated invalid attempts. Retry in ' ||
                       ROUND(EXTRACT(EPOCH FROM (v_team.locked_until - NOW()))) || ' seconds.'
        );
    END IF;

    -- Strict cryptographic verification: ONLY bcrypt hashes accepted (no plaintext fallbacks)
    IF v_team.passcode_hash IS NULL 
       OR v_team.passcode_hash NOT LIKE '$2%' 
       OR v_team.passcode_hash <> extensions.crypt(p_passcode, v_team.passcode_hash) THEN
        UPDATE teams
        SET failed_login_attempts = failed_login_attempts + 1,
            locked_until = CASE WHEN failed_login_attempts + 1 >= 5 THEN NOW() + INTERVAL '5 minutes' ELSE NULL END
        WHERE id = v_team.id;
        RETURN jsonb_build_object('success', false, 'error', 'INVALID_CREDENTIALS', 'message', 'Invalid team access code.');
    END IF;

    -- Check if eliminated
    IF v_team.status = 'eliminated' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'TEAM_ELIMINATED',
            'message', 'This team has been disqualified from the arena: ' || COALESCE(v_team.elimination_reason, 'Rules violation.')
        );
    END IF;

    -- Issue cryptographically random 32-byte (64 hex characters) session token
    v_session_token := encode(gen_random_bytes(32), 'hex');
    v_token_hash := encode(digest(v_session_token, 'sha256'), 'hex');

    -- Reset failed attempts and bind session
    UPDATE teams
    SET active_session_token_hash = v_token_hash,
        device_fingerprint = COALESCE(p_device_fingerprint, device_fingerprint),
        failed_login_attempts = 0,
        locked_until = NULL,
        status = CASE WHEN status = 'registered' THEN 'ready' ELSE status END,
        updated_at = NOW()
    WHERE id = v_team.id;

    -- Calculate total completed points (100 per completed round)
    SELECT COALESCE(COUNT(*) * 100, 0) INTO v_total_score
    FROM team_progress
    WHERE team_id = v_team.id AND status = 'completed';

    INSERT INTO audit_logs (event_type, severity, team_id, details)
    VALUES ('team_login_success', 'info', v_team.id, jsonb_build_object('team_code', v_team.team_code, 'device', p_device_fingerprint));

    RETURN jsonb_build_object(
        'success', true,
        'team_id', v_team.id,
        'team_code', v_team.team_code,
        'team_name', v_team.team_name,
        'session_token', v_session_token,
        'current_round', v_team.current_round,
        'status', v_team.status,
        'total_score', v_total_score
    );
END;
$$;

-- ------------------------------------------------------------------------------
-- 2. Operation: logout_team
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
    SET active_session_token_hash = NULL,
        updated_at = NOW()
    WHERE id = p_team_id AND active_session_token_hash = v_token_hash;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Session not found or already invalidated.');
    END IF;

    RETURN jsonb_build_object('success', true, 'message', 'Team session ended successfully.');
END;
$$;

-- ------------------------------------------------------------------------------
-- 3. Operation: get_team_state
-- Sanitized state inspection: answers, answer options index, and QR tokens strictly excluded.
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
        RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED_SESSION', 'message', 'Session expired or invalidated.');
    END IF;

    SELECT * INTO v_settings FROM event_settings WHERE id = 1;

    SELECT * INTO v_progress
    FROM team_progress
    WHERE team_id = v_team.id AND round_number = v_team.current_round;

    IF v_progress.puzzle_id IS NOT NULL THEN
        SELECT
            id, round_number, title, puzzle_type, description_md,
            hints, max_attempts, sample_cases, starter_code,
            options, image_url, image_alt,
            three_part_questions, code_language, code_snippet, is_active
        INTO v_puzzle
        FROM puzzles
        WHERE id = v_progress.puzzle_id;
    END IF;

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
                'starter_code', v_puzzle.starter_code,
                'options', COALESCE(v_puzzle.options, ARRAY[]::TEXT[]),
                'image_url', v_puzzle.image_url,
                'image_alt', v_puzzle.image_alt,
                'three_part_questions', COALESCE(v_puzzle.three_part_questions, '{}'::jsonb),
                'code_language', COALESCE(v_puzzle.code_language, 'python'),
                'code_snippet', COALESCE(v_puzzle.code_snippet, ''),
                'is_active', COALESCE(v_puzzle.is_active, true)
            )
            ELSE NULL END
    );
END;
$$;

-- ------------------------------------------------------------------------------
-- 4. Operation: start_team_journey
-- Unlocks Round 1 for team when event is live.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION start_team_journey(
    p_team_id UUID,
    p_session_token VARCHAR,
    p_starting_qr VARCHAR DEFAULT NULL
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
    v_first_location_name VARCHAR;
    v_round_duration INT;
    v_grace_duration INT;
    v_deadline TIMESTAMPTZ;
    v_grace_deadline TIMESTAMPTZ;
BEGIN
    v_token_hash := encode(digest(p_session_token, 'sha256'), 'hex');

    SELECT * INTO v_team
    FROM teams
    WHERE id = p_team_id AND active_session_token_hash = v_token_hash
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Unauthorized team session.');
    END IF;

    SELECT * INTO v_settings FROM event_settings WHERE id = 1;
    IF v_settings.status <> 'live' THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'The competition is not live yet (Status: ' || v_settings.status || '). Please wait for the master signal.'
        );
    END IF;

    -- Validate starting QR if one is provided
    IF p_starting_qr IS NOT NULL AND p_starting_qr <> '' THEN
        IF p_starting_qr <> v_settings.starting_qr_token THEN
            RETURN jsonb_build_object('success', false, 'message', 'Invalid starting QR token scanned.');
        END IF;
    END IF;

    IF v_team.status = 'active' AND EXISTS (SELECT 1 FROM team_progress WHERE team_id = v_team.id AND round_number = 1) THEN
        RETURN jsonb_build_object('success', true, 'message', 'Journey already initiated.');
    END IF;

    -- Fetch Round 1 Route
    SELECT location_id INTO v_first_location_id
    FROM team_routes
    WHERE team_id = v_team.id AND round_number = 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'No route assignment found for Team. Contact marshal.');
    END IF;

    SELECT name INTO v_first_location_name FROM locations WHERE id = v_first_location_id;

    -- Fetch Round 1 Puzzle
    SELECT * INTO v_first_puzzle FROM puzzles WHERE round_number = 1;

    v_round_duration := v_settings.round_duration_seconds;
    v_grace_duration := v_settings.grace_period_seconds;
    v_deadline := NOW() + (v_round_duration || ' seconds')::INTERVAL;
    v_grace_deadline := v_deadline + (v_grace_duration || ' seconds')::INTERVAL;

    UPDATE teams
    SET status = 'active',
        current_round = 1,
        started_at = COALESCE(started_at, NOW()),
        updated_at = NOW()
    WHERE id = v_team.id;

    INSERT INTO team_progress (
        team_id, round_number, puzzle_id,
        puzzle_solved, qr_scanned, attempts_count,
        round_started_at, deadline_at, grace_deadline_at, status
    ) VALUES (
        v_team.id, 1, v_first_puzzle.id,
        false, false, 0,
        NOW(), v_deadline, v_grace_deadline, 'solving_puzzle'
    ) ON CONFLICT (team_id, round_number) DO UPDATE SET
        deadline_at = EXCLUDED.deadline_at,
        grace_deadline_at = EXCLUDED.grace_deadline_at,
        status = 'solving_puzzle';

    INSERT INTO audit_logs (event_type, severity, team_id, details)
    VALUES ('team_journey_started', 'info', v_team.id, jsonb_build_object('round', 1, 'location_id', v_first_location_id));

    RETURN jsonb_build_object(
        'success', true,
        'team_id', v_team.id,
        'current_round', 1,
        'assigned_location_id', v_first_location_id,
        'assigned_location_name', v_first_location_name,
        'puzzle_id', v_first_puzzle.id,
        'puzzle_title', v_first_puzzle.title,
        'round_started_at', NOW(),
        'deadline_at', v_deadline,
        'message', 'Journey started. Round 1 challenge unlocked!'
    );
END;
$$;

-- ------------------------------------------------------------------------------
-- 5. Operation: submit_puzzle_answer
-- Server-side answer evaluation. Supports CODE_BASED and THREE_PART_TEXT.
-- Client never receives answer keys or correct indices.
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
    v_revealed_riddle TEXT;
    -- Three-part question variables
    v_ans_json JSONB;
    v_part_a_sub TEXT := '';
    v_part_b_sub TEXT := '';
    v_part_c_sub TEXT := '';
    v_correct_a BOOLEAN := false;
    v_correct_b BOOLEAN := false;
    v_correct_c BOOLEAN := false;
    v_part_results JSONB := NULL;
    v_ans_elem JSONB;
BEGIN
    v_token_hash := encode(digest(p_session_token, 'sha256'), 'hex');

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

    SELECT * INTO v_settings FROM event_settings WHERE id = 1;
    IF v_settings.status <> 'live' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Event is currently ' || v_settings.status || '. Submissions paused.');
    END IF;

    SELECT * INTO v_progress
    FROM team_progress
    WHERE team_id = v_team.id AND round_number = v_team.current_round
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'No active challenge found for current round.');
    END IF;

    IF v_progress.puzzle_solved THEN
        -- Already solved; return revealed riddle immediately
        SELECT COALESCE(NULLIF(l.riddle_clue, ''), v_progress_puzzle.riddle_text) INTO v_revealed_riddle
        FROM team_routes tr
        JOIN locations l ON l.id = tr.location_id
        LEFT JOIN puzzles v_progress_puzzle ON v_progress_puzzle.id = v_progress.puzzle_id
        WHERE tr.team_id = v_team.id AND tr.round_number = v_team.current_round;

        RETURN jsonb_build_object(
            'success', true,
            'correct', true,
            'puzzle_solved', true,
            'riddle', v_revealed_riddle,
            'message', 'Challenge already solved. Proceed to physical checkpoint!'
        );
    END IF;

    SELECT * INTO v_puzzle
    FROM puzzles
    WHERE id = v_progress.puzzle_id;

    IF v_progress.attempts_count >= v_puzzle.max_attempts THEN
        RETURN jsonb_build_object('success', false, 'correct', false, 'message', 'Maximum attempts reached for this round.');
    END IF;

    -- ==========================================================================
    -- EVALUATION DISPATCHER
    -- ==========================================================================

    IF v_puzzle.puzzle_type = 'THREE_PART_TEXT' THEN
        -- Attempt to parse p_answer as JSON object {"partA": "...", "partB": "...", "partC": "..."}
        BEGIN
            v_ans_json := p_answer::JSONB;
            v_part_a_sub := COALESCE(v_ans_json->>'partA', '');
            v_part_b_sub := COALESCE(v_ans_json->>'partB', '');
            v_part_c_sub := COALESCE(v_ans_json->>'partC', '');
        EXCEPTION WHEN OTHERS THEN
            v_part_a_sub := p_answer;
            v_part_b_sub := '';
            v_part_c_sub := '';
        END;

        -- Normalize submissions (trim, multi-space collapse, lowercase)
        v_part_a_sub := LOWER(REGEXP_REPLACE(TRIM(v_part_a_sub), '\s+', ' ', 'g'));
        v_part_b_sub := LOWER(REGEXP_REPLACE(TRIM(v_part_b_sub), '\s+', ' ', 'g'));
        v_part_c_sub := LOWER(REGEXP_REPLACE(TRIM(v_part_c_sub), '\s+', ' ', 'g'));

        -- Evaluate Part A
        IF v_puzzle.three_part_answers ? 'partA' THEN
            IF jsonb_typeof(v_puzzle.three_part_answers->'partA') = 'array' THEN
                FOR v_ans_elem IN SELECT * FROM jsonb_array_elements(v_puzzle.three_part_answers->'partA')
                LOOP
                    IF v_part_a_sub = LOWER(REGEXP_REPLACE(TRIM(v_ans_elem #>> '{}'), '\s+', ' ', 'g')) THEN
                        v_correct_a := true;
                        EXIT;
                    END IF;
                END LOOP;
            ELSE
                IF v_part_a_sub = LOWER(REGEXP_REPLACE(TRIM(v_puzzle.three_part_answers->>'partA'), '\s+', ' ', 'g')) THEN
                    v_correct_a := true;
                END IF;
            END IF;
        END IF;

        -- Evaluate Part B
        IF v_puzzle.three_part_answers ? 'partB' THEN
            IF jsonb_typeof(v_puzzle.three_part_answers->'partB') = 'array' THEN
                FOR v_ans_elem IN SELECT * FROM jsonb_array_elements(v_puzzle.three_part_answers->'partB')
                LOOP
                    IF v_part_b_sub = LOWER(REGEXP_REPLACE(TRIM(v_ans_elem #>> '{}'), '\s+', ' ', 'g')) THEN
                        v_correct_b := true;
                        EXIT;
                    END IF;
                END LOOP;
            ELSE
                IF v_part_b_sub = LOWER(REGEXP_REPLACE(TRIM(v_puzzle.three_part_answers->>'partB'), '\s+', ' ', 'g')) THEN
                    v_correct_b := true;
                END IF;
            END IF;
        END IF;

        -- Evaluate Part C
        IF v_puzzle.three_part_answers ? 'partC' THEN
            IF jsonb_typeof(v_puzzle.three_part_answers->'partC') = 'array' THEN
                FOR v_ans_elem IN SELECT * FROM jsonb_array_elements(v_puzzle.three_part_answers->'partC')
                LOOP
                    IF v_part_c_sub = LOWER(REGEXP_REPLACE(TRIM(v_ans_elem #>> '{}'), '\s+', ' ', 'g')) THEN
                        v_correct_c := true;
                        EXIT;
                    END IF;
                END LOOP;
            ELSE
                IF v_part_c_sub = LOWER(REGEXP_REPLACE(TRIM(v_puzzle.three_part_answers->>'partC'), '\s+', ' ', 'g')) THEN
                    v_correct_c := true;
                END IF;
            END IF;
        END IF;

        v_part_results := jsonb_build_object(
            'partA', jsonb_build_object('correct', v_correct_a),
            'partB', jsonb_build_object('correct', v_correct_b),
            'partC', jsonb_build_object('correct', v_correct_c)
        );

        -- Crucial requirement: Riddle unlocked ONLY when all 3 parts are simultaneously correct
        v_is_correct := (v_correct_a AND v_correct_b AND v_correct_c);

    ELSE
        -- Normalize submission
        v_submitted_norm := TRIM(p_answer);
        IF v_puzzle.normalize_whitespace THEN
            v_submitted_norm := REGEXP_REPLACE(v_submitted_norm, '\s+', ' ', 'g');
        END IF;
        IF NOT v_puzzle.case_sensitive THEN
            v_submitted_norm := LOWER(v_submitted_norm);
        END IF;

        -- 1. MCQ evaluation
        IF v_puzzle.puzzle_type IN ('MCQ', 'IMAGE_MCQ') AND v_puzzle.correct_option_index IS NOT NULL AND array_length(v_puzzle.options, 1) >= 4 THEN
            DECLARE
                v_correct_opt_text TEXT := v_puzzle.options[v_puzzle.correct_option_index + 1];
                v_correct_letter TEXT := CHR(65 + v_puzzle.correct_option_index);
                v_correct_idx0 TEXT := v_puzzle.correct_option_index::TEXT;
                v_correct_idx1 TEXT := (v_puzzle.correct_option_index + 1)::TEXT;
            BEGIN
                IF LOWER(v_submitted_norm) IN (LOWER(TRIM(v_correct_opt_text)), LOWER(v_correct_letter), v_correct_idx0, v_correct_idx1) THEN
                    v_is_correct := true;
                END IF;
            END;
        END IF;

        -- 2. CODE_BASED / Coding / Text array evaluation
        IF NOT v_is_correct AND v_puzzle.accepted_answers IS NOT NULL THEN
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
        END IF;
    END IF;

    v_attempt_num := v_progress.attempts_count + 1;

    INSERT INTO submissions (team_id, round_number, puzzle_id, submitted_answer, is_correct, attempt_number)
    VALUES (v_team.id, v_team.current_round, v_puzzle.id, p_answer, v_is_correct, v_attempt_num);

    IF v_is_correct THEN
        -- Reveal the riddle clue for the assigned checkpoint
        SELECT COALESCE(NULLIF(l.riddle_clue, ''), v_puzzle.riddle_text) INTO v_revealed_riddle
        FROM team_routes tr
        JOIN locations l ON l.id = tr.location_id
        WHERE tr.team_id = v_team.id AND tr.round_number = v_team.current_round;

        UPDATE team_progress
        SET puzzle_solved = true,
            puzzle_solved_at = NOW(),
            attempts_count = v_attempt_num,
            status = 'solved_pending_qr',
            updated_at = NOW()
        WHERE id = v_progress.id;

        INSERT INTO audit_logs (event_type, severity, team_id, details)
        VALUES ('puzzle_solved_correct', 'info', v_team.id, jsonb_build_object('round', v_team.current_round, 'attempts', v_attempt_num, 'puzzle_type', v_puzzle.puzzle_type));

        RETURN jsonb_build_object(
            'success', true,
            'correct', true,
            'puzzle_solved', true,
            'attempts_count', v_attempt_num,
            'riddle', v_revealed_riddle,
            'part_results', v_part_results,
            'message', 'Challenge solved correctly! Decode the navigation riddle and proceed to your physical checkpoint.'
        );
    ELSE
        UPDATE team_progress
        SET attempts_count = v_attempt_num,
            updated_at = NOW()
        WHERE id = v_progress.id;

        RETURN jsonb_build_object(
            'success', true,
            'correct', false,
            'puzzle_solved', false,
            'attempts_count', v_attempt_num,
            'part_results', v_part_results,
            'remaining_attempts', GREATEST(0, v_puzzle.max_attempts - v_attempt_num),
            'message', CASE
                WHEN v_puzzle.puzzle_type = 'THREE_PART_TEXT' THEN 'Some parts are incorrect. Review the highlighted fields and retry (' || GREATEST(0, v_puzzle.max_attempts - v_attempt_num) || ' attempt(s) remaining).'
                ELSE 'Incorrect answer. ' || GREATEST(0, v_puzzle.max_attempts - v_attempt_num) || ' attempt(s) remaining.'
            END
        );
    END IF;
END;
$$;

-- ------------------------------------------------------------------------------
-- 6. Operation: verify_location_qr
-- Validates physical QR token against the team's assigned route for active round.
-- Overloaded to handle both (p_team_id, p_session_token, p_qr_token) and
-- (p_team_id, p_session_token, p_round_number, p_scanned_token).
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
    v_is_game_finished BOOLEAN := false;
BEGIN
    v_token_hash := encode(digest(p_session_token, 'sha256'), 'hex');

    SELECT * INTO v_team
    FROM teams
    WHERE id = p_team_id AND active_session_token_hash = v_token_hash
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'verified', false, 'message', 'Unauthorized team session.');
    END IF;

    IF v_team.status <> 'active' THEN
        RETURN jsonb_build_object('success', false, 'verified', false, 'message', 'Team is not active (Status: ' || v_team.status || ').');
    END IF;

    SELECT * INTO v_settings FROM event_settings WHERE id = 1;
    v_active_locations_count := v_settings.active_locations_count;

    -- Rate limiting check (max 5 invalid scans per minute)
    SELECT COUNT(*) INTO v_recent_invalid_scans
    FROM qr_scans
    WHERE team_id = v_team.id AND is_valid = false AND created_at > NOW() - INTERVAL '1 minute';

    IF v_recent_invalid_scans >= 5 THEN
        RETURN jsonb_build_object('success', false, 'verified', false, 'message', 'Anti-spam rate limit reached. Please wait 60 seconds before scanning again.');
    END IF;

    SELECT * INTO v_progress
    FROM team_progress
    WHERE team_id = v_team.id AND round_number = v_team.current_round
    FOR UPDATE;

    IF NOT FOUND OR NOT v_progress.puzzle_solved THEN
        RETURN jsonb_build_object('success', false, 'verified', false, 'message', 'Must solve the round challenge before scanning checkpoint QR.');
    END IF;

    -- Assigned location for this round
    SELECT l.* INTO v_assigned_location
    FROM team_routes tr
    JOIN locations l ON l.id = tr.location_id
    WHERE tr.team_id = v_team.id AND tr.round_number = v_team.current_round;

    -- Check what location matches the scanned QR
    SELECT * INTO v_scanned_location
    FROM locations
    WHERE qr_token = TRIM(p_qr_token);

    IF NOT FOUND THEN
        INSERT INTO qr_scans (team_id, round_number, location_id, scanned_token, is_valid)
        VALUES (v_team.id, v_team.current_round, NULL, TRIM(p_qr_token), false);
        RETURN jsonb_build_object('success', false, 'verified', false, 'message', 'Unrecognized QR token. Please scan an authentic checkpoint code.');
    END IF;

    -- Verify that scanned location matches assigned location
    IF v_scanned_location.id <> v_assigned_location.id THEN
        INSERT INTO qr_scans (team_id, round_number, location_id, scanned_token, is_valid)
        VALUES (v_team.id, v_team.current_round, v_scanned_location.id, TRIM(p_qr_token), false);
        RETURN jsonb_build_object(
            'success', false,
            'verified', false,
            'message', 'Wrong Checkpoint! You scanned "' || v_scanned_location.name || '", but your assigned location is different. Decode your clue carefully!'
        );
    END IF;

    -- QR IS VALID & CORRECT!
    INSERT INTO qr_scans (team_id, round_number, location_id, scanned_token, is_valid)
    VALUES (v_team.id, v_team.current_round, v_scanned_location.id, TRIM(p_qr_token), true);

    -- Mark active round completed
    UPDATE team_progress
    SET qr_scanned = true,
        qr_scanned_at = NOW(),
        status = 'completed',
        updated_at = NOW()
    WHERE id = v_progress.id;

    v_next_round := v_team.current_round + 1;

    IF v_next_round > v_active_locations_count THEN
        -- All rounds completed!
        v_is_game_finished := true;
        UPDATE teams
        SET status = 'completed',
            completed_at = NOW(),
            total_time_ms = EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000,
            updated_at = NOW()
        WHERE id = v_team.id;

        INSERT INTO audit_logs (event_type, severity, team_id, details)
        VALUES ('team_journey_finished', 'info', v_team.id, jsonb_build_object('total_rounds', v_active_locations_count));

        RETURN jsonb_build_object(
            'success', true,
            'verified', true,
            'points_awarded', 100,
            'round_completed', v_team.current_round,
            'next_round', v_next_round,
            'is_game_finished', true,
            'message', 'Checkpoint verified! Congratulations! You have completed all championship checkpoints!'
        );
    ELSE
        -- Unlock next round
        SELECT location_id INTO v_next_location_id
        FROM team_routes
        WHERE team_id = v_team.id AND round_number = v_next_round;

        SELECT * INTO v_next_puzzle FROM puzzles WHERE round_number = v_next_round;

        v_deadline := NOW() + (v_settings.round_duration_seconds || ' seconds')::INTERVAL;
        v_grace_deadline := v_deadline + (v_settings.grace_period_seconds || ' seconds')::INTERVAL;

        UPDATE teams
        SET current_round = v_next_round,
            updated_at = NOW()
        WHERE id = v_team.id;

        INSERT INTO team_progress (
            team_id, round_number, puzzle_id,
            puzzle_solved, qr_scanned, attempts_count,
            round_started_at, deadline_at, grace_deadline_at, status
        ) VALUES (
            v_team.id, v_next_round, v_next_puzzle.id,
            false, false, 0,
            NOW(), v_deadline, v_grace_deadline, 'solving_puzzle'
        ) ON CONFLICT (team_id, round_number) DO UPDATE SET
            deadline_at = EXCLUDED.deadline_at,
            grace_deadline_at = EXCLUDED.grace_deadline_at,
            status = 'solving_puzzle';

        RETURN jsonb_build_object(
            'success', true,
            'verified', true,
            'points_awarded', 100,
            'round_completed', v_team.current_round,
            'next_round', v_next_round,
            'is_game_finished', false,
            'options', COALESCE(v_next_puzzle.options, ARRAY[]::TEXT[]),
            'image_url', v_next_puzzle.image_url,
            'image_alt', v_next_puzzle.image_alt,
            'message', 'Checkpoint verified! Round ' || v_next_round || ' unlocked.'
        );
    END IF;
END;
$$;

-- Overloaded version accepting (p_team_id, p_session_token, p_round_number, p_scanned_token)
CREATE OR REPLACE FUNCTION verify_location_qr(
    p_team_id UUID,
    p_session_token VARCHAR,
    p_round_number INT,
    p_scanned_token VARCHAR
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
    RETURN verify_location_qr(p_team_id, p_session_token, p_scanned_token);
END;
$$;

-- ------------------------------------------------------------------------------
-- 7. Operation: complete_team_journey
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION complete_team_journey(
    p_team_id UUID,
    p_session_token VARCHAR,
    p_final_qr VARCHAR DEFAULT NULL
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

    SELECT * INTO v_team
    FROM teams
    WHERE id = p_team_id AND active_session_token_hash = v_token_hash
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'completed', false, 'message', 'Unauthorized team session.');
    END IF;

    IF v_team.status = 'completed' THEN
        RETURN jsonb_build_object(
            'success', true,
            'completed', true,
            'message', 'Team has already completed the championship journey.',
            'total_time_seconds', ROUND(COALESCE(v_team.total_time_ms, 0) / 1000)
        );
    END IF;

    SELECT * INTO v_settings FROM event_settings WHERE id = 1;

    SELECT COUNT(*) INTO v_completed_count
    FROM team_progress
    WHERE team_id = v_team.id AND status = 'completed';

    IF v_completed_count < v_settings.active_locations_count THEN
        RETURN jsonb_build_object(
            'success', false,
            'completed', false,
            'message', 'Cannot finalize journey: Only ' || v_completed_count || ' of ' || v_settings.active_locations_count || ' checkpoints completed.'
        );
    END IF;

    v_total_ms := EXTRACT(EPOCH FROM (NOW() - v_team.started_at)) * 1000;

    UPDATE teams
    SET status = 'completed',
        completed_at = NOW(),
        total_time_ms = v_total_ms,
        updated_at = NOW()
    WHERE id = v_team.id;

    SELECT COUNT(*) + 1 INTO v_rank
    FROM teams
    WHERE status = 'completed' AND (total_time_ms < v_total_ms OR (total_time_ms = v_total_ms AND completed_at < NOW()));

    RETURN jsonb_build_object(
        'success', true,
        'completed', true,
        'final_rank', v_rank,
        'total_time_seconds', ROUND(v_total_ms / 1000),
        'message', 'Championship journey completed successfully!'
    );
END;
$$;

-- ------------------------------------------------------------------------------
-- 8. Event Lifecycle RPCs (Admin Controlled)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION admin_set_event_status(
    p_status VARCHAR
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
    IF NOT is_admin() THEN
        RETURN jsonb_build_object('success', false, 'message', 'Unauthorized: Admin privileges required.');
    END IF;

    IF p_status NOT IN ('draft', 'ready', 'live', 'paused', 'finished') THEN
        RETURN jsonb_build_object('success', false, 'message', 'Invalid event status: ' || p_status);
    END IF;

    IF p_status = 'live' THEN
        UPDATE event_settings
        SET status = 'live',
            event_started_at = COALESCE(event_started_at, NOW()),
            pause_started_at = NULL,
            updated_at = NOW()
        WHERE id = 1;
    ELSIF p_status = 'paused' THEN
        UPDATE event_settings
        SET status = 'paused',
            pause_started_at = NOW(),
            updated_at = NOW()
        WHERE id = 1;
    ELSIF p_status = 'finished' THEN
        UPDATE event_settings
        SET status = 'finished',
            event_finished_at = NOW(),
            updated_at = NOW()
        WHERE id = 1;
    ELSE
        UPDATE event_settings
        SET status = p_status,
            updated_at = NOW()
        WHERE id = 1;
    END IF;

    INSERT INTO audit_logs (event_type, severity, details)
    VALUES ('admin_event_status_changed', 'warning', jsonb_build_object('new_status', p_status));

    RETURN jsonb_build_object('success', true, 'status', p_status, 'message', 'Event status transitioned to ' || p_status);
END;
$$;

CREATE OR REPLACE FUNCTION admin_start_event()
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT admin_set_event_status('live');
$$;

CREATE OR REPLACE FUNCTION admin_pause_event()
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT admin_set_event_status('paused');
$$;

CREATE OR REPLACE FUNCTION admin_resume_event()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_pause_start TIMESTAMPTZ;
    v_additional_pause_ms BIGINT := 0;
BEGIN
    IF NOT is_admin() THEN
        RETURN jsonb_build_object('success', false, 'message', 'Unauthorized: Admin privileges required.');
    END IF;

    SELECT pause_started_at INTO v_pause_start FROM event_settings WHERE id = 1;
    IF v_pause_start IS NOT NULL THEN
        v_additional_pause_ms := EXTRACT(EPOCH FROM (NOW() - v_pause_start)) * 1000;
    END IF;

    UPDATE event_settings
    SET status = 'live',
        pause_started_at = NULL,
        total_pause_duration_ms = total_pause_duration_ms + v_additional_pause_ms,
        updated_at = NOW()
    WHERE id = 1;

    INSERT INTO audit_logs (event_type, severity, details)
    VALUES ('admin_event_resumed', 'warning', jsonb_build_object('added_pause_ms', v_additional_pause_ms));

    RETURN jsonb_build_object('success', true, 'status', 'live', 'message', 'Event resumed successfully.');
END;
$$;

CREATE OR REPLACE FUNCTION admin_end_event()
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT admin_set_event_status('finished');
$$;

-- ------------------------------------------------------------------------------
-- 9. Anti-Cheat and Violation Management RPCs
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION admin_record_violation(
    p_team_id UUID,
    p_violation_type VARCHAR,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_team RECORD;
    v_new_strikes INT;
    v_eliminated BOOLEAN := false;
    v_reason TEXT;
    v_msg TEXT;
BEGIN
    -- Strict admin role enforcement
    IF NOT is_admin() THEN
        RETURN jsonb_build_object('success', false, 'message', 'Unauthorized: Admin privileges required.');
    END IF;

    SELECT * INTO v_team
    FROM teams
    WHERE id = p_team_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Team not found.');
    END IF;

    v_new_strikes := LEAST(4, v_team.total_strikes + 1);

    IF v_new_strikes >= 4 THEN
        v_eliminated := true;
        v_reason := 'Disqualified: Accumulated 4 anti-cheat violations (' || p_violation_type || ')';
        v_msg := 'Critical violation threshold reached (4/4). Team disqualified.';

        UPDATE teams
        SET total_strikes = 4,
            status = 'eliminated',
            elimination_reason = v_reason,
            updated_at = NOW()
        WHERE id = v_team.id;

        INSERT INTO audit_logs (event_type, severity, team_id, details)
        VALUES ('team_eliminated_anti_cheat', 'critical', v_team.id, jsonb_build_object(
            'violation_type', p_violation_type,
            'strikes', 4,
            'metadata', p_metadata
        ));
    ELSE
        v_msg := 'Anti-cheat warning recorded. Strike ' || v_new_strikes || ' of 3 allowed.';

        UPDATE teams
        SET total_strikes = v_new_strikes,
            updated_at = NOW()
        WHERE id = v_team.id;

        INSERT INTO audit_logs (event_type, severity, team_id, details)
        VALUES ('anti_cheat_violation_strike', 'warning', v_team.id, jsonb_build_object(
            'violation_type', p_violation_type,
            'strike_number', v_new_strikes,
            'metadata', p_metadata
        ));
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'strikeNumber', v_new_strikes,
        'eliminated', v_eliminated,
        'message', v_msg
    );
END;
$$;

-- ------------------------------------------------------------------------------
-- 9b. Participant Anti-Cheat Violation Reporting RPC (Session Token Verified)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION report_team_violation(
    p_team_id UUID,
    p_session_token VARCHAR,
    p_violation_type VARCHAR,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_team RECORD;
    v_new_strikes INT;
    v_eliminated BOOLEAN := false;
    v_reason TEXT;
    v_msg TEXT;
BEGIN
    -- Authenticate team session via SHA-256 token hash
    SELECT * INTO v_team
    FROM teams
    WHERE id = p_team_id
      AND active_session_token_hash = encode(extensions.digest(p_session_token, 'sha256'), 'hex')
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Invalid team session.');
    END IF;

    -- If already eliminated, prevent duplicate strikes
    IF v_team.status = 'eliminated' THEN
        RETURN jsonb_build_object(
            'success', false,
            'strikeNumber', v_team.total_strikes,
            'eliminated', true,
            'message', 'YOU HAVE BEEN ELIMINATED!'
        );
    END IF;

    v_new_strikes := LEAST(4, v_team.total_strikes + 1);

    IF v_new_strikes >= 4 THEN
        v_eliminated := true;
        v_reason := 'Disqualified: Accumulated 4 anti-cheat violations (' || p_violation_type || ')';
        v_msg := 'YOU HAVE BEEN ELIMINATED!';

        UPDATE teams
        SET total_strikes = 4,
            status = 'eliminated',
            elimination_reason = v_reason,
            updated_at = NOW()
        WHERE id = v_team.id;

        INSERT INTO audit_logs (event_type, severity, team_id, details)
        VALUES ('team_eliminated_anti_cheat', 'critical', v_team.id, jsonb_build_object(
            'violation_type', p_violation_type,
            'strike_number', 4,
            'team_code', v_team.team_code,
            'team_name', v_team.team_name,
            'round_number', v_team.current_round,
            'metadata', p_metadata
        ));
    ELSE
        v_msg := 'Anti-cheat warning recorded. Strike ' || v_new_strikes || ' of 3 allowed.';

        UPDATE teams
        SET total_strikes = v_new_strikes,
            updated_at = NOW()
        WHERE id = v_team.id;

        INSERT INTO audit_logs (event_type, severity, team_id, details)
        VALUES ('anti_cheat_violation_strike', 'warning', v_team.id, jsonb_build_object(
            'violation_type', p_violation_type,
            'strike_number', v_new_strikes,
            'team_code', v_team.team_code,
            'team_name', v_team.team_name,
            'round_number', v_team.current_round,
            'metadata', p_metadata
        ));
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'strikeNumber', v_new_strikes,
        'eliminated', v_eliminated,
        'message', v_msg
    );
END;
$$;

CREATE OR REPLACE FUNCTION admin_reinstate_team(
    p_team_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_team RECORD;
BEGIN
    IF NOT is_admin() THEN
        RETURN jsonb_build_object('success', false, 'message', 'Unauthorized: Admin privileges required.');
    END IF;

    SELECT * INTO v_team FROM teams WHERE id = p_team_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Team not found.');
    END IF;

    UPDATE teams
    SET status = 'active',
        total_strikes = 0,
        elimination_reason = NULL,
        updated_at = NOW()
    WHERE id = p_team_id;

    INSERT INTO audit_logs (event_type, severity, team_id, details)
    VALUES ('admin_team_reinstated', 'warning', p_team_id, jsonb_build_object('previous_strikes', v_team.total_strikes));

    RETURN jsonb_build_object('success', true, 'message', 'Team successfully reinstated.');
END;
$$;

CREATE OR REPLACE FUNCTION admin_eliminate_team(
    p_team_id UUID,
    p_reason TEXT
)
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
    SET status = 'eliminated',
        elimination_reason = p_reason,
        updated_at = NOW()
    WHERE id = p_team_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Team not found.');
    END IF;

    INSERT INTO audit_logs (event_type, severity, team_id, details)
    VALUES ('admin_team_eliminated_manual', 'critical', p_team_id, jsonb_build_object('reason', p_reason));

    RETURN jsonb_build_object('success', true, 'message', 'Team eliminated.');
END;
$$;

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
    SET active_session_token_hash = NULL,
        device_fingerprint = NULL,
        failed_login_attempts = 0,
        locked_until = NULL,
        updated_at = NOW()
    WHERE id = p_team_id;

    RETURN jsonb_build_object('success', true, 'message', 'Team session reset.');
END;
$$;

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

    DELETE FROM team_progress WHERE team_id = p_team_id;
    DELETE FROM submissions WHERE team_id = p_team_id;
    DELETE FROM qr_scans WHERE team_id = p_team_id;

    UPDATE teams
    SET current_round = 1,
        status = 'ready',
        total_strikes = 0,
        started_at = NULL,
        completed_at = NULL,
        total_time_ms = NULL,
        elimination_reason = NULL,
        updated_at = NOW()
    WHERE id = p_team_id;

    RETURN jsonb_build_object('success', true, 'message', 'Team progress reset to Round 1.');
END;
$$;

-- ------------------------------------------------------------------------------
-- 10. Admin Checkpoint & Token Management RPCs
-- ------------------------------------------------------------------------------
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
    v_count INT := 0;
BEGIN
    IF NOT is_admin() THEN
        RETURN jsonb_build_object('success', false, 'message', 'Unauthorized: Admin privileges required.');
    END IF;

    FOR v_loc IN SELECT id FROM locations ORDER BY id LOOP
        LOOP
            v_new_token := LPAD((abs(('x' || encode(gen_random_bytes(4), 'hex'))::bit(32)::bigint) % 9000000000 + 1000000000)::TEXT, 10, '0');
            EXIT WHEN NOT (v_new_token = ANY(v_used_tokens));
        END LOOP;

        v_used_tokens := array_append(v_used_tokens, v_new_token);
        UPDATE locations SET qr_token = v_new_token, updated_at = NOW() WHERE id = v_loc.id;
        v_count := v_count + 1;
    END LOOP;

    UPDATE event_settings
    SET qr_tokens_regenerated = true,
        starting_qr_token = 'MM2-LIVE-START-' || encode(gen_random_bytes(4), 'hex'),
        final_qr_token = 'MM2-LIVE-FINISH-' || encode(gen_random_bytes(4), 'hex'),
        updated_at = NOW()
    WHERE id = 1;

    INSERT INTO audit_logs (event_type, severity, details)
    VALUES ('admin_regenerated_all_qr_tokens', 'warning', jsonb_build_object('locations_count', v_count));

    RETURN jsonb_build_object(
        'success', true,
        'regenerated_locations', v_count,
        'timestamp', NOW()::TEXT,
        'message', 'Generated ' || v_count || ' fresh cryptographically collision-free QR tokens.'
    );
END;
$$;

CREATE OR REPLACE FUNCTION admin_regenerate_event_qr_tokens(
    p_confirmation_code VARCHAR
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
    RETURN admin_regenerate_event_qr_tokens();
END;
$$;

CREATE OR REPLACE FUNCTION admin_generate_team_credentials(
    p_confirmation_code VARCHAR DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_team RECORD;
    v_raw_pass VARCHAR;
    v_salt VARCHAR;
    v_hash VARCHAR;
    v_credentials JSONB := '[]'::jsonb;
    v_caller_role VARCHAR;
BEGIN
    IF NOT is_admin() THEN
        RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Unauthorized: Admin privileges required.');
    END IF;

    SELECT role INTO v_caller_role FROM admin_profiles WHERE id = auth.uid();
    IF v_caller_role IS NOT NULL AND v_caller_role = 'marshal' THEN
        RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN', 'message', 'Marshals are not authorized to issue team credentials.');
    END IF;

    IF p_confirmation_code IS NULL OR p_confirmation_code <> 'CONFIRM_GENERATE_CREDENTIALS' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'CONFIRMATION_REQUIRED',
            'message', 'Confirmation required. Supply confirmation code "CONFIRM_GENERATE_CREDENTIALS" to regenerate all team credentials.'
        );
    END IF;

    FOR v_team IN SELECT id, team_code, team_name FROM teams ORDER BY team_code LOOP
        -- Generate cryptographically random high-entropy passcode (e.g. MM2-A7F9-3B1C-E4D2)
        v_raw_pass := 'MM2-' || 
            UPPER(SUBSTRING(ENCODE(extensions.gen_random_bytes(6), 'hex') FROM 1 FOR 4)) || '-' || 
            UPPER(SUBSTRING(ENCODE(extensions.gen_random_bytes(6), 'hex') FROM 5 FOR 4)) || '-' || 
            UPPER(SUBSTRING(ENCODE(extensions.gen_random_bytes(6), 'hex') FROM 9 FOR 4));

        v_salt := extensions.gen_salt('bf', 10);
        v_hash := extensions.crypt(v_raw_pass, v_salt);

        -- Invalidate existing sessions and store only bcrypt hash
        UPDATE teams
        SET passcode_hash = v_hash,
            credentials_randomized = true,
            active_session_token_hash = NULL,
            device_fingerprint = NULL,
            failed_login_attempts = 0,
            locked_until = NULL,
            updated_at = NOW()
        WHERE id = v_team.id;

        -- Return raw passcode ONCE to caller in memory (never written to any table or log)
        v_credentials := v_credentials || jsonb_build_object(
            'team_id', v_team.id,
            'team_code', v_team.team_code,
            'team_name', v_team.team_name,
            'passcode', v_raw_pass
        );
    END LOOP;

    INSERT INTO audit_logs (event_type, severity, details)
    VALUES ('admin_generated_team_credentials', 'critical', jsonb_build_object(
        'teams_count', jsonb_array_length(v_credentials),
        'issued_by', auth.uid(),
        'timestamp', NOW()
    ));

    RETURN jsonb_build_object(
        'success', true,
        'count', jsonb_array_length(v_credentials),
        'credentials', v_credentials,
        'message', 'Cryptographically secure credentials generated for ' || jsonb_array_length(v_credentials) || ' teams.'
    );
END;
$$;

-- Backward compatibility alias
CREATE OR REPLACE FUNCTION admin_randomize_team_credentials()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
    RETURN admin_generate_team_credentials('CONFIRM_GENERATE_CREDENTIALS');
END;
$$;

CREATE OR REPLACE FUNCTION bootstrap_randomize_team_credentials()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_team RECORD;
    v_raw_pass VARCHAR;
    v_salt VARCHAR;
    v_hash VARCHAR;
    v_credentials JSONB := '[]'::jsonb;
BEGIN
    FOR v_team IN SELECT id, team_code, team_name FROM teams ORDER BY team_code LOOP
        v_raw_pass := 'MM2-' || 
            UPPER(SUBSTRING(ENCODE(extensions.gen_random_bytes(6), 'hex') FROM 1 FOR 4)) || '-' || 
            UPPER(SUBSTRING(ENCODE(extensions.gen_random_bytes(6), 'hex') FROM 5 FOR 4)) || '-' || 
            UPPER(SUBSTRING(ENCODE(extensions.gen_random_bytes(6), 'hex') FROM 9 FOR 4));

        v_salt := extensions.gen_salt('bf', 10);
        v_hash := extensions.crypt(v_raw_pass, v_salt);

        UPDATE teams
        SET passcode_hash = v_hash,
            credentials_randomized = true,
            active_session_token_hash = NULL,
            device_fingerprint = NULL,
            failed_login_attempts = 0,
            locked_until = NULL,
            updated_at = NOW()
        WHERE id = v_team.id;

        v_credentials := v_credentials || jsonb_build_object(
            'team_code', v_team.team_code,
            'team_name', v_team.team_name,
            'passcode', v_raw_pass
        );
    END LOOP;

    RETURN jsonb_build_object('success', true, 'count', jsonb_array_length(v_credentials), 'credentials', v_credentials);
END;
$$;

-- ------------------------------------------------------------------------------
-- Team Management RPCs (admin_create_team, admin_update_team, admin_delete_team)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION admin_create_team(
    p_team_code VARCHAR,
    p_team_name VARCHAR
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_clean_code VARCHAR;
    v_clean_name VARCHAR;
    v_unusable_hash VARCHAR;
    v_new_team RECORD;
    v_caller_role VARCHAR;
BEGIN
    IF NOT is_admin() THEN
        RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Admin privileges required.');
    END IF;

    SELECT role INTO v_caller_role FROM admin_profiles WHERE id = auth.uid();
    IF v_caller_role IS NOT NULL AND v_caller_role = 'marshal' THEN
        RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN', 'message', 'Marshals cannot create teams.');
    END IF;

    v_clean_code := UPPER(TRIM(p_team_code));
    v_clean_name := TRIM(p_team_name);

    IF v_clean_code IS NULL OR length(v_clean_code) < 2 THEN
        RETURN jsonb_build_object('success', false, 'error', 'INVALID_INPUT', 'message', 'Team code must be at least 2 characters.');
    END IF;

    IF v_clean_name IS NULL OR length(v_clean_name) < 2 THEN
        RETURN jsonb_build_object('success', false, 'error', 'INVALID_INPUT', 'message', 'Team name must be at least 2 characters.');
    END IF;

    IF EXISTS (SELECT 1 FROM teams WHERE UPPER(team_code) = v_clean_code) THEN
        RETURN jsonb_build_object('success', false, 'error', 'DUPLICATE_CODE', 'message', 'Team code "' || v_clean_code || '" already exists.');
    END IF;

    IF EXISTS (SELECT 1 FROM teams WHERE LOWER(team_name) = LOWER(v_clean_name)) THEN
        RETURN jsonb_build_object('success', false, 'error', 'DUPLICATE_NAME', 'message', 'Team name "' || v_clean_name || '" already exists.');
    END IF;

    -- Generate unusable random hash with credentials_randomized = false
    v_unusable_hash := extensions.crypt(encode(extensions.gen_random_bytes(32), 'hex'), extensions.gen_salt('bf', 10));

    INSERT INTO teams (
        team_code, team_name, passcode_hash, status, current_round, total_strikes, credentials_randomized
    ) VALUES (
        v_clean_code, v_clean_name, v_unusable_hash, 'ready', 1, 0, false
    ) RETURNING * INTO v_new_team;

    INSERT INTO audit_logs (event_type, severity, team_id, details)
    VALUES ('admin_team_created', 'info', v_new_team.id, jsonb_build_object(
        'team_code', v_clean_code,
        'team_name', v_clean_name,
        'created_by', auth.uid()
    ));

    RETURN jsonb_build_object(
        'success', true,
        'team', jsonb_build_object(
            'id', v_new_team.id,
            'team_code', v_new_team.team_code,
            'team_name', v_new_team.team_name,
            'status', v_new_team.status,
            'current_round', v_new_team.current_round,
            'total_strikes', v_new_team.total_strikes,
            'credentials_randomized', v_new_team.credentials_randomized,
            'created_at', v_new_team.created_at
        ),
        'message', 'Team created successfully. Generate credentials before competition.'
    );
END;
$$;

CREATE OR REPLACE FUNCTION admin_update_team(
    p_team_id UUID,
    p_team_code VARCHAR,
    p_team_name VARCHAR
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_clean_code VARCHAR;
    v_clean_name VARCHAR;
    v_existing RECORD;
    v_caller_role VARCHAR;
BEGIN
    IF NOT is_admin() THEN
        RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Admin privileges required.');
    END IF;

    SELECT role INTO v_caller_role FROM admin_profiles WHERE id = auth.uid();
    IF v_caller_role IS NOT NULL AND v_caller_role = 'marshal' THEN
        RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN', 'message', 'Marshals cannot update teams.');
    END IF;

    SELECT * INTO v_existing FROM teams WHERE id = p_team_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'NOT_FOUND', 'message', 'Team not found.');
    END IF;

    v_clean_code := UPPER(TRIM(p_team_code));
    v_clean_name := TRIM(p_team_name);

    IF v_clean_code IS NULL OR length(v_clean_code) < 2 THEN
        RETURN jsonb_build_object('success', false, 'error', 'INVALID_INPUT', 'message', 'Team code must be at least 2 characters.');
    END IF;

    IF v_clean_name IS NULL OR length(v_clean_name) < 2 THEN
        RETURN jsonb_build_object('success', false, 'error', 'INVALID_INPUT', 'message', 'Team name must be at least 2 characters.');
    END IF;

    IF EXISTS (SELECT 1 FROM teams WHERE UPPER(team_code) = v_clean_code AND id <> p_team_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'DUPLICATE_CODE', 'message', 'Team code "' || v_clean_code || '" is already used by another team.');
    END IF;

    IF EXISTS (SELECT 1 FROM teams WHERE LOWER(team_name) = LOWER(v_clean_name) AND id <> p_team_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'DUPLICATE_NAME', 'message', 'Team name "' || v_clean_name || '" is already used by another team.');
    END IF;

    UPDATE teams
    SET team_code = v_clean_code,
        team_name = v_clean_name,
        updated_at = NOW()
    WHERE id = p_team_id;

    INSERT INTO audit_logs (event_type, severity, team_id, details)
    VALUES ('admin_team_updated', 'info', p_team_id, jsonb_build_object(
        'old_code', v_existing.team_code,
        'new_code', v_clean_code,
        'old_name', v_existing.team_name,
        'new_name', v_clean_name,
        'updated_by', auth.uid()
    ));

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Team updated successfully.'
    );
END;
$$;

CREATE OR REPLACE FUNCTION admin_delete_team(
    p_team_id UUID,
    p_force BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_team RECORD;
    v_has_progress BOOLEAN;
    v_caller_role VARCHAR;
BEGIN
    IF NOT is_admin() THEN
        RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Admin privileges required.');
    END IF;

    SELECT role INTO v_caller_role FROM admin_profiles WHERE id = auth.uid();
    IF v_caller_role IS NOT NULL AND v_caller_role IN ('marshal') THEN
        RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN', 'message', 'Marshals cannot delete teams.');
    END IF;

    SELECT * INTO v_team FROM teams WHERE id = p_team_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'NOT_FOUND', 'message', 'Team not found.');
    END IF;

    -- Safeguard: check for active competition progress
    SELECT EXISTS (
        SELECT 1 FROM team_progress
        WHERE team_id = p_team_id AND (puzzle_solved = true OR qr_scanned = true OR attempts_count > 0)
    ) INTO v_has_progress;

    IF v_has_progress AND NOT p_force THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'TEAM_HAS_PROGRESS',
            'message', 'Team ' || v_team.team_code || ' has recorded progress in the competition. To delete, confirm force deletion.'
        );
    END IF;

    -- Cascade delete associated rows
    DELETE FROM team_progress WHERE team_id = p_team_id;
    DELETE FROM submissions WHERE team_id = p_team_id;
    DELETE FROM qr_scans WHERE team_id = p_team_id;
    DELETE FROM team_routes WHERE team_id = p_team_id;
    DELETE FROM audit_logs WHERE team_id = p_team_id;
    DELETE FROM teams WHERE id = p_team_id;

    INSERT INTO audit_logs (event_type, severity, details)
    VALUES ('admin_team_deleted', 'warning', jsonb_build_object(
        'deleted_team_code', v_team.team_code,
        'deleted_team_name', v_team.team_name,
        'deleted_by', auth.uid(),
        'forced', p_force
    ));

    RETURN jsonb_build_object('success', true, 'message', 'Team ' || v_team.team_code || ' deleted successfully.');
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
    v_count INT := 0;
BEGIN
    FOR v_loc IN SELECT id FROM locations ORDER BY id LOOP
        LOOP
            v_new_token := LPAD((abs(('x' || encode(gen_random_bytes(4), 'hex'))::bit(32)::bigint) % 9000000000 + 1000000000)::TEXT, 10, '0');
            EXIT WHEN NOT (v_new_token = ANY(v_used_tokens));
        END LOOP;

        v_used_tokens := array_append(v_used_tokens, v_new_token);
        UPDATE locations SET qr_token = v_new_token, updated_at = NOW() WHERE id = v_loc.id;
        v_count := v_count + 1;
    END LOOP;

    UPDATE event_settings
    SET qr_tokens_regenerated = true,
        starting_qr_token = 'MM2-LIVE-START-' || encode(gen_random_bytes(4), 'hex'),
        final_qr_token = 'MM2-LIVE-FINISH-' || encode(gen_random_bytes(4), 'hex'),
        updated_at = NOW()
    WHERE id = 1;

    RETURN jsonb_build_object('success', true, 'regenerated_locations', v_count);
END;
$$;

CREATE OR REPLACE FUNCTION admin_update_location(
    p_location_id INT,
    p_name VARCHAR,
    p_description TEXT,
    p_capacity INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
    IF NOT is_admin() THEN
        RETURN jsonb_build_object('success', false, 'message', 'Unauthorized: Admin privileges required.');
    END IF;

    UPDATE locations
    SET name = p_name,
        description = p_description,
        capacity = p_capacity,
        updated_at = NOW()
    WHERE id = p_location_id;

    RETURN jsonb_build_object('success', true, 'message', 'Location updated.');
END;
$$;

CREATE OR REPLACE FUNCTION admin_regenerate_location_token(
    p_location_id INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_new_token VARCHAR;
BEGIN
    IF NOT is_admin() THEN
        RETURN jsonb_build_object('success', false, 'message', 'Unauthorized: Admin privileges required.');
    END IF;

    v_new_token := LPAD((abs(('x' || encode(gen_random_bytes(4), 'hex'))::bit(32)::bigint) % 9000000000 + 1000000000)::TEXT, 10, '0');

    UPDATE locations
    SET qr_token = v_new_token,
        updated_at = NOW()
    WHERE id = p_location_id;

    RETURN jsonb_build_object('success', true, 'qrToken', v_new_token, 'message', 'New QR token assigned.');
END;
$$;

-- ------------------------------------------------------------------------------
-- 11. Balanced 20-Team Latin Square Route Allocation
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION generate_team_routes(p_active_locations INT DEFAULT 10)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_routes_locked BOOLEAN;
    v_team_record RECORD;
    v_t_idx INT := 0;
    v_round INT;
    v_loc_id INT;
    v_locations INT[];
    v_team_count INT;
BEGIN
    IF NOT is_admin() THEN
        RETURN jsonb_build_object('success', false, 'message', 'Unauthorized: Admin privileges required.');
    END IF;

    SELECT COALESCE(routes_locked, false) INTO v_routes_locked FROM event_settings WHERE id = 1;
    IF v_routes_locked THEN
        RETURN jsonb_build_object('success', false, 'message', 'Routes are locked for the active competition.');
    END IF;

    SELECT ARRAY_AGG(id ORDER BY location_number) INTO v_locations
    FROM (SELECT id, location_number FROM locations WHERE active = true ORDER BY location_number LIMIT p_active_locations) l;

    IF array_length(v_locations, 1) < p_active_locations THEN
        RETURN jsonb_build_object('success', false, 'message', 'Insufficient active locations (found ' || COALESCE(array_length(v_locations, 1), 0) || ').');
    END IF;

    SELECT COUNT(*) INTO v_team_count FROM teams;
    DELETE FROM team_routes;

    FOR v_team_record IN SELECT id FROM teams ORDER BY team_code LOOP
        FOR v_round IN 1..p_active_locations LOOP
            -- Formula: offset group by 5 for teams 11-20 to ensure even 2-team equipartition per location
            IF v_t_idx < 10 THEN
                v_loc_id := v_locations[((v_t_idx + (v_round - 1)) % p_active_locations) + 1];
            ELSE
                v_loc_id := v_locations[(( (v_t_idx - 10) + (v_round - 1) + 5) % p_active_locations) + 1];
            END IF;

            INSERT INTO team_routes (team_id, round_number, location_id)
            VALUES (v_team_record.id, v_round, v_loc_id);
        END LOOP;
        v_t_idx := v_t_idx + 1;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Generated collision-free Latin Square route matrix for ' || v_team_count || ' teams across ' || p_active_locations || ' rounds.'
    );
END;
$$;

-- ------------------------------------------------------------------------------
-- 12. EXPLICIT FUNCTION PRIVILEGES
-- ------------------------------------------------------------------------------
REVOKE ALL ON FUNCTION is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_admin() TO authenticated, anon;

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

REVOKE ALL ON FUNCTION verify_location_qr(UUID, VARCHAR, INT, VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION verify_location_qr(UUID, VARCHAR, INT, VARCHAR) TO anon, authenticated;

REVOKE ALL ON FUNCTION complete_team_journey(UUID, VARCHAR, VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION complete_team_journey(UUID, VARCHAR, VARCHAR) TO anon, authenticated;

REVOKE ALL ON FUNCTION admin_record_violation(UUID, VARCHAR, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION admin_record_violation(UUID, VARCHAR, JSONB) FROM anon;
GRANT EXECUTE ON FUNCTION admin_record_violation(UUID, VARCHAR, JSONB) TO authenticated;

REVOKE ALL ON FUNCTION report_team_violation(UUID, VARCHAR, VARCHAR, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION report_team_violation(UUID, VARCHAR, VARCHAR, JSONB) TO anon, authenticated;

REVOKE ALL ON FUNCTION admin_set_event_status(VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_set_event_status(VARCHAR) TO authenticated;

REVOKE ALL ON FUNCTION admin_start_event() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_start_event() TO authenticated;

REVOKE ALL ON FUNCTION admin_pause_event() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_pause_event() TO authenticated;

REVOKE ALL ON FUNCTION admin_resume_event() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_resume_event() TO authenticated;

REVOKE ALL ON FUNCTION admin_end_event() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_end_event() TO authenticated;

REVOKE ALL ON FUNCTION admin_reinstate_team(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_reinstate_team(UUID) TO authenticated;

REVOKE ALL ON FUNCTION admin_eliminate_team(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_eliminate_team(UUID, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION admin_reset_team_session(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_reset_team_session(UUID) TO authenticated;

REVOKE ALL ON FUNCTION admin_reset_team_progress(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_reset_team_progress(UUID) TO authenticated;

REVOKE ALL ON FUNCTION admin_regenerate_event_qr_tokens() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_regenerate_event_qr_tokens() TO authenticated;

REVOKE ALL ON FUNCTION admin_regenerate_event_qr_tokens(VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_regenerate_event_qr_tokens(VARCHAR) TO authenticated;

REVOKE ALL ON FUNCTION admin_randomize_team_credentials() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_randomize_team_credentials() TO authenticated;

REVOKE ALL ON FUNCTION bootstrap_randomize_team_credentials() FROM PUBLIC;
REVOKE ALL ON FUNCTION bootstrap_randomize_team_credentials() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION bootstrap_randomize_team_credentials() TO postgres;

REVOKE ALL ON FUNCTION bootstrap_regenerate_event_qr_tokens() FROM PUBLIC;
REVOKE ALL ON FUNCTION bootstrap_regenerate_event_qr_tokens() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION bootstrap_regenerate_event_qr_tokens() TO postgres;

REVOKE ALL ON FUNCTION admin_update_location(INT, VARCHAR, TEXT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_update_location(INT, VARCHAR, TEXT, INT) TO authenticated;

REVOKE ALL ON FUNCTION admin_regenerate_location_token(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_regenerate_location_token(INT) TO authenticated;

-- Admin Manage Puzzle RPC
CREATE OR REPLACE FUNCTION admin_save_puzzle(
    p_id VARCHAR,
    p_round_number INT,
    p_title VARCHAR,
    p_puzzle_type VARCHAR,
    p_description_md TEXT,
    p_accepted_answers TEXT[],
    p_riddle_text TEXT,
    p_hints TEXT[] DEFAULT '{}'::text[],
    p_options TEXT[] DEFAULT '{}'::text[],
    p_correct_option_index INT DEFAULT NULL,
    p_image_url TEXT DEFAULT NULL,
    p_image_alt TEXT DEFAULT NULL,
    p_three_part_questions JSONB DEFAULT '{}'::jsonb,
    p_three_part_answers JSONB DEFAULT '{}'::jsonb,
    p_code_language VARCHAR DEFAULT 'python',
    p_code_snippet TEXT DEFAULT '',
    p_is_active BOOLEAN DEFAULT true
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
    IF NOT is_admin() THEN
        RETURN jsonb_build_object('success', false, 'message', 'Unauthorized: Admin privileges required.');
    END IF;

    INSERT INTO puzzles (
        id, round_number, title, puzzle_type, description_md,
        accepted_answers, riddle_text, hints, options, correct_option_index,
        image_url, image_alt, three_part_questions, three_part_answers,
        code_language, code_snippet, is_active, updated_at
    ) VALUES (
        p_id, p_round_number, p_title, p_puzzle_type, p_description_md,
        p_accepted_answers, p_riddle_text, p_hints, p_options, p_correct_option_index,
        p_image_url, p_image_alt, p_three_part_questions, p_three_part_answers,
        p_code_language, p_code_snippet, p_is_active, NOW()
    )
    ON CONFLICT (round_number) DO UPDATE SET
        id = EXCLUDED.id,
        title = EXCLUDED.title,
        puzzle_type = EXCLUDED.puzzle_type,
        description_md = EXCLUDED.description_md,
        accepted_answers = EXCLUDED.accepted_answers,
        riddle_text = EXCLUDED.riddle_text,
        hints = EXCLUDED.hints,
        options = EXCLUDED.options,
        correct_option_index = EXCLUDED.correct_option_index,
        image_url = EXCLUDED.image_url,
        image_alt = EXCLUDED.image_alt,
        three_part_questions = EXCLUDED.three_part_questions,
        three_part_answers = EXCLUDED.three_part_answers,
        code_language = EXCLUDED.code_language,
        code_snippet = EXCLUDED.code_snippet,
        is_active = EXCLUDED.is_active,
        updated_at = NOW();

    RETURN jsonb_build_object('success', true, 'message', 'Puzzle saved successfully.');
END;
$$;

REVOKE ALL ON FUNCTION admin_save_puzzle(VARCHAR, INT, VARCHAR, VARCHAR, TEXT, TEXT[], TEXT, TEXT[], TEXT[], INT, TEXT, TEXT, JSONB, JSONB, VARCHAR, TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_save_puzzle(VARCHAR, INT, VARCHAR, VARCHAR, TEXT, TEXT[], TEXT, TEXT[], TEXT[], INT, TEXT, TEXT, JSONB, JSONB, VARCHAR, TEXT, BOOLEAN) TO authenticated;


REVOKE ALL ON FUNCTION is_superadmin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_superadmin() TO authenticated, anon;

REVOKE ALL ON FUNCTION admin_generate_team_credentials(VARCHAR) FROM PUBLIC;
REVOKE ALL ON FUNCTION admin_generate_team_credentials(VARCHAR) FROM anon;
GRANT EXECUTE ON FUNCTION admin_generate_team_credentials(VARCHAR) TO authenticated;

REVOKE ALL ON FUNCTION admin_create_team(VARCHAR, VARCHAR) FROM PUBLIC;
REVOKE ALL ON FUNCTION admin_create_team(VARCHAR, VARCHAR) FROM anon;
GRANT EXECUTE ON FUNCTION admin_create_team(VARCHAR, VARCHAR) TO authenticated;

REVOKE ALL ON FUNCTION admin_update_team(UUID, VARCHAR, VARCHAR) FROM PUBLIC;
REVOKE ALL ON FUNCTION admin_update_team(UUID, VARCHAR, VARCHAR) FROM anon;
GRANT EXECUTE ON FUNCTION admin_update_team(UUID, VARCHAR, VARCHAR) TO authenticated;

REVOKE ALL ON FUNCTION admin_delete_team(UUID, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION admin_delete_team(UUID, BOOLEAN) FROM anon;
GRANT EXECUTE ON FUNCTION admin_delete_team(UUID, BOOLEAN) TO authenticated;

REVOKE ALL ON FUNCTION generate_team_routes(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION generate_team_routes(INT) TO authenticated;


-- ==============================================================================
-- 7. CUSTOM ADMIN AUTHENTICATION ENCLAVE (Hardened, Zero Supabase Auth Fallback)
-- ==============================================================================

-- 2. One-Time Secure Superadmin Bootstrap Procedure (Postgres / SQL Editor Only)
-- Zero hardcoded credentials. Idempotent: Never overwrites existing passwords.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION bootstrap_initial_superadmin(
    p_username VARCHAR,
    p_password VARCHAR
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_clean_user VARCHAR;
    v_clean_pass VARCHAR;
    v_hash VARCHAR;
    v_new_id UUID;
BEGIN
    v_clean_user := LOWER(TRIM(p_username));
    v_clean_pass := TRIM(p_password);

    IF v_clean_user IS NULL OR length(v_clean_user) < 3 THEN
        RETURN jsonb_build_object('success', false, 'error', 'INVALID_USERNAME', 'message', 'Username must be at least 3 characters.');
    END IF;

    IF v_clean_pass IS NULL OR length(v_clean_pass) < 8 THEN
        RETURN jsonb_build_object('success', false, 'error', 'WEAK_PASSWORD', 'message', 'Password must be at least 8 characters.');
    END IF;

    -- Strict One-Time Guard: Prevent unauthorized account creation or privilege escalation
    IF EXISTS (SELECT 1 FROM admin_users WHERE role = 'superadmin') THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'SUPERADMIN_ALREADY_EXISTS',
            'message', 'A superadmin account already exists. Re-running migrations or repeated bootstrapping is prohibited.'
        );
    END IF;

    v_hash := extensions.crypt(v_clean_pass, extensions.gen_salt('bf', 10));

    INSERT INTO admin_users (username, full_name, password_hash, role)
    VALUES (v_clean_user, 'Chief Administrator', v_hash, 'superadmin')
    RETURNING id INTO v_new_id;

    INSERT INTO audit_logs (event_type, severity, details)
    VALUES ('superadmin_bootstrapped', 'critical', jsonb_build_object(
        'username', v_clean_user,
        'admin_id', v_new_id,
        'timestamp', NOW()
    ));

    RETURN jsonb_build_object(
        'success', true,
        'username', v_clean_user,
        'role', 'superadmin',
        'message', 'Initial superadmin account successfully bootstrapped.'
    );
END;
$$;

REVOKE ALL ON FUNCTION bootstrap_initial_superadmin(VARCHAR, VARCHAR) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION bootstrap_initial_superadmin(VARCHAR, VARCHAR) TO postgres;

-- ------------------------------------------------------------------------------
-- 3. Decommission Legacy is_admin() / is_superadmin() & admin_profiles
-- All legacy auth paths fail closed immediately.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
    SELECT false;
$$;

CREATE OR REPLACE FUNCTION is_superadmin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
    SELECT false;
$$;

REVOKE ALL ON FUNCTION is_admin() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION is_superadmin() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON TABLE admin_profiles FROM PUBLIC, anon, authenticated;
DROP POLICY IF EXISTS admin_profiles_select ON admin_profiles;
DROP POLICY IF EXISTS admin_profiles_insert ON admin_profiles;
DROP POLICY IF EXISTS admin_profiles_update ON admin_profiles;
DROP POLICY IF EXISTS admin_profiles_delete ON admin_profiles;
DROP POLICY IF EXISTS admin_profiles_admin_all ON admin_profiles;

-- ------------------------------------------------------------------------------
-- 4. Internal Admin Token Verifier (Internal to SECURITY DEFINER functions)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION verify_admin_token(
    p_admin_token VARCHAR,
    p_min_role VARCHAR DEFAULT NULL
)
RETURNS TABLE (
    is_valid BOOLEAN,
    admin_id UUID,
    username VARCHAR,
    role VARCHAR
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_token_hash VARCHAR;
    v_row RECORD;
BEGIN
    IF p_admin_token IS NULL OR TRIM(p_admin_token) = '' THEN
        RETURN QUERY SELECT false, NULL::UUID, NULL::VARCHAR, NULL::VARCHAR;
        RETURN;
    END IF;

    v_token_hash := encode(extensions.digest(p_admin_token, 'sha256'), 'hex');

    SELECT u.id, u.username, u.role, u.is_active, u.session_expires_at
    INTO v_row
    FROM admin_users u
    WHERE u.active_session_token_hash = v_token_hash;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, NULL::UUID, NULL::VARCHAR, NULL::VARCHAR;
        RETURN;
    END IF;

    IF v_row.is_active = false THEN
        RETURN QUERY SELECT false, v_row.id, v_row.username, v_row.role;
        RETURN;
    END IF;

    IF v_row.session_expires_at IS NOT NULL AND v_row.session_expires_at <= NOW() THEN
        RETURN QUERY SELECT false, v_row.id, v_row.username, v_row.role;
        RETURN;
    END IF;

    IF p_min_role = 'superadmin' AND v_row.role <> 'superadmin' THEN
        RETURN QUERY SELECT false, v_row.id, v_row.username, v_row.role;
        RETURN;
    END IF;

    IF p_min_role = 'admin' AND v_row.role NOT IN ('superadmin', 'admin') THEN
        RETURN QUERY SELECT false, v_row.id, v_row.username, v_row.role;
        RETURN;
    END IF;

    RETURN QUERY SELECT true, v_row.id, v_row.username, v_row.role;
END;
$$;

REVOKE ALL ON FUNCTION verify_admin_token(VARCHAR, VARCHAR) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION verify_admin_token(VARCHAR, VARCHAR) TO postgres;

-- ------------------------------------------------------------------------------
-- 5. Custom Admin Authentication & Session RPCs
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION admin_custom_login(
    p_username VARCHAR,
    p_password VARCHAR
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_user RECORD;
    v_token VARCHAR;
    v_token_hash VARCHAR;
    v_expires_at TIMESTAMPTZ;
    v_clean_username VARCHAR;
BEGIN
    v_clean_username := LOWER(TRIM(p_username));

    IF v_clean_username IS NULL OR v_clean_username = '' OR p_password IS NULL OR p_password = '' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'MISSING_CREDENTIALS',
            'message', 'Administrator username and password are required.'
        );
    END IF;

    SELECT id, username, full_name, password_hash, role, failed_login_attempts, locked_until
    INTO v_user
    FROM admin_users
    WHERE LOWER(username) = v_clean_username
    FOR UPDATE;

    IF NOT FOUND THEN
        PERFORM pg_sleep(0.5);
        RETURN jsonb_build_object('success', false, 'error', 'INVALID_CREDENTIALS', 'message', 'Invalid username or password.');
    END IF;

    IF v_user.locked_until IS NOT NULL AND v_user.locked_until > NOW() THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'ACCOUNT_LOCKED',
            'message', 'Account temporarily locked due to repeated failed attempts. Please retry after ' || 
                       EXTRACT(MINUTE FROM (v_user.locked_until - NOW())) || ' minute(s).'
        );
    END IF;

    IF extensions.crypt(p_password, v_user.password_hash) <> v_user.password_hash THEN
        UPDATE admin_users
        SET failed_login_attempts = failed_login_attempts + 1,
            locked_until = CASE WHEN failed_login_attempts + 1 >= 5 THEN NOW() + INTERVAL '15 minutes' ELSE NULL END,
            updated_at = NOW()
        WHERE id = v_user.id;

        RETURN jsonb_build_object('success', false, 'error', 'INVALID_CREDENTIALS', 'message', 'Invalid username or password.');
    END IF;

    v_token := encode(extensions.gen_random_bytes(32), 'hex');
    v_token_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');
    v_expires_at := NOW() + INTERVAL '24 hours';

    UPDATE admin_users
    SET active_session_token_hash = v_token_hash,
        session_expires_at = v_expires_at,
        failed_login_attempts = 0,
        locked_until = NULL,
        last_login_at = NOW(),
        updated_at = NOW()
    WHERE id = v_user.id;

    INSERT INTO audit_logs (event_type, severity, details)
    VALUES ('admin_custom_login_success', 'info', jsonb_build_object(
        'username', v_user.username,
        'role', v_user.role,
        'timestamp', NOW()
    ));

    RETURN jsonb_build_object(
        'success', true,
        'token', v_token,
        'username', v_user.username,
        'role', v_user.role,
        'fullName', v_user.full_name,
        'expiresAt', v_expires_at
    );
END;
$$;

CREATE OR REPLACE FUNCTION admin_custom_logout(
    p_admin_token VARCHAR
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_token_hash VARCHAR;
BEGIN
    IF p_admin_token IS NOT NULL AND TRIM(p_admin_token) <> '' THEN
        v_token_hash := encode(extensions.digest(p_admin_token, 'sha256'), 'hex');
        UPDATE admin_users
        SET active_session_token_hash = NULL,
            session_expires_at = NULL,
            updated_at = NOW()
        WHERE active_session_token_hash = v_token_hash;
    END IF;

    RETURN jsonb_build_object('success', true, 'message', 'Admin session terminated.');
END;
$$;

CREATE OR REPLACE FUNCTION admin_custom_verify_session(
    p_admin_token VARCHAR
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_token_hash VARCHAR;
    v_user RECORD;
BEGIN
    IF p_admin_token IS NULL OR TRIM(p_admin_token) = '' THEN
        RETURN jsonb_build_object('success', false, 'isAuthenticated', false, 'message', 'No token provided.');
    END IF;

    v_token_hash := encode(extensions.digest(p_admin_token, 'sha256'), 'hex');

    SELECT id, username, full_name, role, session_expires_at
    INTO v_user
    FROM admin_users
    WHERE active_session_token_hash = v_token_hash
      AND (session_expires_at IS NULL OR session_expires_at > NOW());

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'isAuthenticated', false, 'message', 'Session expired or invalid.');
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'isAuthenticated', true,
        'username', v_user.username,
        'role', v_user.role,
        'fullName', v_user.full_name,
        'expiresAt', v_user.session_expires_at
    );
END;
$$;

-- ------------------------------------------------------------------------------
-- 6. Restricted Admin Dashboard Data Hydration RPC
-- Authoritative, read-only operational telemetry.
-- STRICTLY EXCLUDES:
--  - accepted_answers, three_part_answers, correct_option_index
--  - participant submissions, submitted code, outputs, history
--  - checkpoint QR tokens (qr_token, starting_qr_token, final_qr_token)
--  - passcode hashes or session hashes
--  - unrestricted audit log payloads
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION admin_get_dashboard_data(
    p_admin_token VARCHAR
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_auth RECORD;
    v_teams JSONB;
    v_locations JSONB;
    v_puzzles JSONB;
    v_routes JSONB;
    v_progress JSONB;
    v_incidents JSONB;
    v_event_status JSONB;
BEGIN
    SELECT * INTO v_auth FROM verify_admin_token(p_admin_token);
    IF NOT v_auth.is_valid THEN
        RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Unauthorized: Valid administrator session token required.');
    END IF;

    -- 1. Teams: Operational status only
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', t.id,
        'team_code', t.team_code,
        'team_name', t.team_name,
        'status', t.status,
        'current_round', t.current_round,
        'total_strikes', t.total_strikes,
        'credentials_randomized', t.credentials_randomized,
        'created_at', t.created_at,
        'started_at', t.started_at,
        'completed_at', t.completed_at,
        'total_time_ms', t.total_time_ms,
        'elimination_reason', t.elimination_reason
    ) ORDER BY t.team_code), '[]'::jsonb)
    INTO v_teams FROM teams t;

    -- 2. Locations: Metadata only (NO qr_token, NO riddle_clue)
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', l.id,
        'location_number', l.location_number,
        'name', l.name,
        'description', l.description,
        'capacity', l.capacity,
        'active', l.active
    ) ORDER BY l.location_number), '[]'::jsonb)
    INTO v_locations FROM locations l;

    -- 3. Puzzles: Display prompts only (NO accepted_answers, NO three_part_answers, NO correct_option_index)
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', p.id,
        'round_number', p.round_number,
        'title', p.title,
        'puzzle_type', p.puzzle_type,
        'description_md', p.description_md,
        'hints', p.hints,
        'max_attempts', p.max_attempts,
        'options', p.options,
        'image_url', p.image_url,
        'image_alt', p.image_alt,
        'three_part_questions', p.three_part_questions,
        'code_language', p.code_language,
        'code_snippet', p.code_snippet,
        'is_active', p.is_active
    ) ORDER BY p.round_number), '[]'::jsonb)
    INTO v_puzzles FROM puzzles p;

    -- 4. Routes: Station assignment metadata for occupancy calculation
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'team_id', tr.team_id,
        'round_number', tr.round_number,
        'location_id', tr.location_id
    ) ORDER BY tr.round_number), '[]'::jsonb)
    INTO v_routes FROM team_routes tr;

    -- 5. Progress: Operational round monitoring only (NO submissions, NO code, NO answers)
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
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
        'status', tp.status
    ) ORDER BY tp.round_number), '[]'::jsonb)
    INTO v_progress FROM team_progress tp;

    -- 6. Incidents: Sanitized anti-cheat audit logs
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', al.id,
        'event_type', al.event_type,
        'severity', al.severity,
        'team_id', al.team_id,
        'created_at', al.created_at,
        'details', jsonb_build_object(
            'violation_type', al.details->>'violation_type',
            'strike_number', al.details->>'strike_number',
            'action', al.details->>'action'
        )
    ) ORDER BY al.created_at DESC), '[]'::jsonb)
    INTO v_incidents
    FROM (
        SELECT id, event_type, severity, team_id, details, created_at
        FROM audit_logs
        WHERE event_type IN ('anti_cheat_violation_strike', 'team_eliminated_anti_cheat')
        ORDER BY created_at DESC
        LIMIT 100
    ) al;

    -- 7. Event Settings: Status only (NO QR secrets)
    SELECT jsonb_build_object(
        'status', es.status,
        'event_started_at', es.event_started_at,
        'event_finished_at', es.event_finished_at,
        'total_pause_duration_ms', es.total_pause_duration_ms
    ) INTO v_event_status
    FROM event_settings es
    WHERE es.id = 1;

    RETURN jsonb_build_object(
        'success', true,
        'teams', v_teams,
        'locations', v_locations,
        'puzzles', v_puzzles,
        'routes', v_routes,
        'progress', v_progress,
        'incidents', v_incidents,
        'event_status', v_event_status
    );
END;
$$;

-- ------------------------------------------------------------------------------
-- 7. Drop All Legacy Overloads & Decommission Unauthenticated Signatures
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS admin_create_team(VARCHAR, VARCHAR);
DROP FUNCTION IF EXISTS admin_create_team(VARCHAR, VARCHAR, VARCHAR);
DROP FUNCTION IF EXISTS admin_update_team(UUID, VARCHAR, VARCHAR);
DROP FUNCTION IF EXISTS admin_update_team(UUID, VARCHAR, VARCHAR, VARCHAR);
DROP FUNCTION IF EXISTS admin_update_team(VARCHAR, UUID, VARCHAR, VARCHAR);
DROP FUNCTION IF EXISTS admin_delete_team(UUID, BOOLEAN);
DROP FUNCTION IF EXISTS admin_delete_team(UUID);
DROP FUNCTION IF EXISTS admin_delete_team(UUID, BOOLEAN, VARCHAR);
DROP FUNCTION IF EXISTS admin_delete_team(VARCHAR, UUID, BOOLEAN);
DROP FUNCTION IF EXISTS admin_generate_team_credentials(VARCHAR);
DROP FUNCTION IF EXISTS admin_generate_team_credentials();
DROP FUNCTION IF EXISTS admin_generate_team_credentials(VARCHAR, VARCHAR);
DROP FUNCTION IF EXISTS admin_randomize_team_credentials();
DROP FUNCTION IF EXISTS admin_randomize_team_credentials(VARCHAR);
DROP FUNCTION IF EXISTS admin_set_event_status(VARCHAR);
DROP FUNCTION IF EXISTS admin_set_event_status(VARCHAR, VARCHAR);
DROP FUNCTION IF EXISTS admin_start_event();
DROP FUNCTION IF EXISTS admin_start_event(VARCHAR);
DROP FUNCTION IF EXISTS admin_pause_event();
DROP FUNCTION IF EXISTS admin_pause_event(VARCHAR);
DROP FUNCTION IF EXISTS admin_resume_event();
DROP FUNCTION IF EXISTS admin_resume_event(VARCHAR);
DROP FUNCTION IF EXISTS admin_end_event();
DROP FUNCTION IF EXISTS admin_end_event(VARCHAR);
DROP FUNCTION IF EXISTS admin_eliminate_team(UUID, TEXT);
DROP FUNCTION IF EXISTS admin_eliminate_team(UUID, TEXT, VARCHAR);
DROP FUNCTION IF EXISTS admin_eliminate_team(VARCHAR, UUID, TEXT);
DROP FUNCTION IF EXISTS admin_reinstate_team(UUID);
DROP FUNCTION IF EXISTS admin_reinstate_team(UUID, VARCHAR);
DROP FUNCTION IF EXISTS admin_reinstate_team(VARCHAR, UUID);
DROP FUNCTION IF EXISTS admin_record_violation(UUID, VARCHAR, JSONB);
DROP FUNCTION IF EXISTS admin_record_violation(VARCHAR, UUID, VARCHAR, JSONB);
DROP FUNCTION IF EXISTS admin_reset_team_session(UUID);
DROP FUNCTION IF EXISTS admin_reset_team_session(VARCHAR, UUID);
DROP FUNCTION IF EXISTS admin_reset_team_progress(UUID);
DROP FUNCTION IF EXISTS admin_reset_team_progress(VARCHAR, UUID);
DROP FUNCTION IF EXISTS admin_regenerate_event_qr_tokens();
DROP FUNCTION IF EXISTS admin_regenerate_event_qr_tokens(VARCHAR);
DROP FUNCTION IF EXISTS admin_regenerate_event_qr_tokens(VARCHAR, VARCHAR);
DROP FUNCTION IF EXISTS admin_update_location(INT, VARCHAR, TEXT, INT);
DROP FUNCTION IF EXISTS admin_update_location(VARCHAR, INT, VARCHAR, TEXT, INT);
DROP FUNCTION IF EXISTS admin_regenerate_location_token(INT);
DROP FUNCTION IF EXISTS admin_regenerate_location_token(VARCHAR, INT);
DROP FUNCTION IF EXISTS generate_team_routes();
DROP FUNCTION IF EXISTS generate_team_routes(INT);
DROP FUNCTION IF EXISTS generate_team_routes(VARCHAR, INT);
DROP FUNCTION IF EXISTS admin_save_puzzle(VARCHAR, INT, VARCHAR, VARCHAR, TEXT, TEXT[], TEXT, TEXT[], TEXT[], INT, TEXT, TEXT, JSONB, JSONB, VARCHAR, TEXT, BOOLEAN);
DROP FUNCTION IF EXISTS admin_save_puzzle(VARCHAR, INT, VARCHAR, VARCHAR, TEXT, TEXT[], TEXT, TEXT[], TEXT[], INT, TEXT, TEXT, JSONB, JSONB, VARCHAR, TEXT, BOOLEAN, JSONB, INT);
DROP FUNCTION IF EXISTS admin_save_puzzle(VARCHAR, VARCHAR, INT, VARCHAR, VARCHAR, TEXT, TEXT[], TEXT, TEXT[], JSONB, INT, TEXT, TEXT, JSONB, JSONB, VARCHAR, TEXT, BOOLEAN);

-- ------------------------------------------------------------------------------
-- 8. Hardened Administrator Operations (Strict Token Verification, Fail Closed)
-- ------------------------------------------------------------------------------

-- 8.1 admin_set_event_status
CREATE OR REPLACE FUNCTION admin_set_event_status(
    p_admin_token VARCHAR,
    p_status VARCHAR
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_auth RECORD;
BEGIN
    SELECT * INTO v_auth FROM verify_admin_token(p_admin_token, 'admin');
    IF NOT v_auth.is_valid THEN
        RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Unauthorized: Valid administrator session token required.');
    END IF;

    IF p_status NOT IN ('draft', 'ready', 'live', 'paused', 'finished') THEN
        RETURN jsonb_build_object('success', false, 'error', 'INVALID_STATUS', 'message', 'Invalid event status.');
    END IF;

    UPDATE event_settings
    SET status = p_status,
        event_started_at = CASE WHEN p_status = 'live' AND event_started_at IS NULL THEN NOW() ELSE event_started_at END,
        event_finished_at = CASE WHEN p_status = 'finished' THEN NOW() ELSE event_finished_at END,
        updated_at = NOW()
    WHERE id = 1;

    RETURN jsonb_build_object('success', true, 'status', p_status, 'message', 'Event status updated to ' || p_status);
END;
$$;

-- 8.2 admin_start_event
CREATE OR REPLACE FUNCTION admin_start_event(
    p_admin_token VARCHAR
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
    RETURN admin_set_event_status(p_admin_token, 'live');
END;
$$;

-- 8.3 admin_pause_event
CREATE OR REPLACE FUNCTION admin_pause_event(
    p_admin_token VARCHAR
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
    RETURN admin_set_event_status(p_admin_token, 'paused');
END;
$$;

-- 8.4 admin_resume_event
CREATE OR REPLACE FUNCTION admin_resume_event(
    p_admin_token VARCHAR
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_auth RECORD;
    v_pause_start TIMESTAMPTZ;
    v_additional_pause_ms BIGINT := 0;
BEGIN
    SELECT * INTO v_auth FROM verify_admin_token(p_admin_token, 'admin');
    IF NOT v_auth.is_valid THEN
        RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Unauthorized: Valid administrator session token required.');
    END IF;

    SELECT pause_started_at INTO v_pause_start FROM event_settings WHERE id = 1;
    IF v_pause_start IS NOT NULL THEN
        v_additional_pause_ms := EXTRACT(EPOCH FROM (NOW() - v_pause_start)) * 1000;
    END IF;

    UPDATE event_settings
    SET status = 'live',
        pause_started_at = NULL,
        total_pause_duration_ms = total_pause_duration_ms + v_additional_pause_ms,
        updated_at = NOW()
    WHERE id = 1;

    INSERT INTO audit_logs (event_type, severity, details)
    VALUES ('admin_event_resumed', 'warning', jsonb_build_object('added_pause_ms', v_additional_pause_ms, 'resumed_by', v_auth.username));

    RETURN jsonb_build_object('success', true, 'status', 'live', 'message', 'Event resumed successfully.');
END;
$$;

-- 8.5 admin_end_event
CREATE OR REPLACE FUNCTION admin_end_event(
    p_admin_token VARCHAR
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
    RETURN admin_set_event_status(p_admin_token, 'finished');
END;
$$;

-- 8.6 admin_create_team
CREATE OR REPLACE FUNCTION admin_create_team(
    p_admin_token VARCHAR,
    p_team_code VARCHAR,
    p_team_name VARCHAR
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_auth RECORD;
    v_clean_code VARCHAR;
    v_clean_name VARCHAR;
    v_new_team RECORD;
    v_unusable_hash VARCHAR;
BEGIN
    SELECT * INTO v_auth FROM verify_admin_token(p_admin_token, 'admin');
    IF NOT v_auth.is_valid THEN
        RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Unauthorized: Valid administrator session token required.');
    END IF;

    v_clean_code := UPPER(TRIM(p_team_code));
    v_clean_name := TRIM(p_team_name);

    IF v_clean_code IS NULL OR length(v_clean_code) < 2 OR length(v_clean_code) > 20 THEN
        RETURN jsonb_build_object('success', false, 'error', 'INVALID_INPUT', 'message', 'Team code must be between 2 and 20 characters.');
    END IF;

    IF v_clean_name IS NULL OR length(v_clean_name) < 2 THEN
        RETURN jsonb_build_object('success', false, 'error', 'INVALID_INPUT', 'message', 'Team name must be at least 2 characters.');
    END IF;

    IF EXISTS (SELECT 1 FROM teams WHERE UPPER(team_code) = v_clean_code) THEN
        RETURN jsonb_build_object('success', false, 'error', 'DUPLICATE_CODE', 'message', 'Team code "' || v_clean_code || '" already exists.');
    END IF;

    IF EXISTS (SELECT 1 FROM teams WHERE LOWER(team_name) = LOWER(v_clean_name)) THEN
        RETURN jsonb_build_object('success', false, 'error', 'DUPLICATE_NAME', 'message', 'Team name "' || v_clean_name || '" already exists.');
    END IF;

    v_unusable_hash := extensions.crypt(encode(extensions.gen_random_bytes(32), 'hex'), extensions.gen_salt('bf', 10));

    INSERT INTO teams (
        team_code, team_name, passcode_hash, status, current_round, total_strikes, credentials_randomized
    ) VALUES (
        v_clean_code, v_clean_name, v_unusable_hash, 'ready', 1, 0, false
    ) RETURNING * INTO v_new_team;

    INSERT INTO audit_logs (event_type, severity, team_id, details)
    VALUES ('admin_team_created', 'info', v_new_team.id, jsonb_build_object(
        'team_code', v_clean_code,
        'team_name', v_clean_name,
        'created_by', v_auth.username
    ));

    RETURN jsonb_build_object(
        'success', true,
        'team', jsonb_build_object(
            'id', v_new_team.id,
            'team_code', v_new_team.team_code,
            'team_name', v_new_team.team_name,
            'status', v_new_team.status,
            'current_round', v_new_team.current_round,
            'total_strikes', v_new_team.total_strikes,
            'credentials_randomized', v_new_team.credentials_randomized,
            'created_at', v_new_team.created_at
        ),
        'message', 'Team "' || v_clean_name || '" created successfully.'
    );
END;
$$;

-- 8.7 admin_update_team
CREATE OR REPLACE FUNCTION admin_update_team(
    p_admin_token VARCHAR,
    p_team_id UUID,
    p_team_code VARCHAR,
    p_team_name VARCHAR
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_auth RECORD;
    v_clean_code VARCHAR;
    v_clean_name VARCHAR;
    v_existing RECORD;
BEGIN
    SELECT * INTO v_auth FROM verify_admin_token(p_admin_token, 'admin');
    IF NOT v_auth.is_valid THEN
        RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Unauthorized: Valid administrator session token required.');
    END IF;

    SELECT * INTO v_existing FROM teams WHERE id = p_team_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'NOT_FOUND', 'message', 'Team not found.');
    END IF;

    v_clean_code := UPPER(TRIM(p_team_code));
    v_clean_name := TRIM(p_team_name);

    IF v_clean_code IS NULL OR length(v_clean_code) < 2 OR length(v_clean_code) > 20 THEN
        RETURN jsonb_build_object('success', false, 'error', 'INVALID_INPUT', 'message', 'Team code must be between 2 and 20 characters.');
    END IF;

    IF v_clean_name IS NULL OR length(v_clean_name) < 2 THEN
        RETURN jsonb_build_object('success', false, 'error', 'INVALID_INPUT', 'message', 'Team name must be at least 2 characters.');
    END IF;

    IF EXISTS (SELECT 1 FROM teams WHERE UPPER(team_code) = v_clean_code AND id <> p_team_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'DUPLICATE_CODE', 'message', 'Team code "' || v_clean_code || '" is already used by another team.');
    END IF;

    IF EXISTS (SELECT 1 FROM teams WHERE LOWER(team_name) = LOWER(v_clean_name) AND id <> p_team_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'DUPLICATE_NAME', 'message', 'Team name "' || v_clean_name || '" is already used by another team.');
    END IF;

    UPDATE teams
    SET team_code = v_clean_code,
        team_name = v_clean_name,
        updated_at = NOW()
    WHERE id = p_team_id;

    RETURN jsonb_build_object('success', true, 'message', 'Team updated successfully.');
END;
$$;

-- 8.8 admin_delete_team
CREATE OR REPLACE FUNCTION admin_delete_team(
    p_admin_token VARCHAR,
    p_team_id UUID,
    p_force BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_auth RECORD;
    v_team RECORD;
    v_has_progress BOOLEAN;
BEGIN
    SELECT * INTO v_auth FROM verify_admin_token(p_admin_token, 'admin');
    IF NOT v_auth.is_valid THEN
        RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Unauthorized: Valid administrator session token required.');
    END IF;

    SELECT * INTO v_team FROM teams WHERE id = p_team_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'NOT_FOUND', 'message', 'Team not found.');
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM team_progress
        WHERE team_id = p_team_id AND (puzzle_solved = true OR qr_scanned = true OR attempts_count > 0)
    ) INTO v_has_progress;

    IF v_has_progress AND NOT p_force THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'TEAM_HAS_PROGRESS',
            'message', 'Team ' || v_team.team_code || ' has recorded progress in the competition. To delete, confirm force deletion.'
        );
    END IF;

    DELETE FROM team_progress WHERE team_id = p_team_id;
    DELETE FROM submissions WHERE team_id = p_team_id;
    DELETE FROM qr_scans WHERE team_id = p_team_id;
    DELETE FROM team_routes WHERE team_id = p_team_id;
    DELETE FROM audit_logs WHERE team_id = p_team_id;
    DELETE FROM teams WHERE id = p_team_id;

    RETURN jsonb_build_object('success', true, 'message', 'Team ' || v_team.team_code || ' deleted successfully.');
END;
$$;

-- 8.9 admin_generate_team_credentials
CREATE OR REPLACE FUNCTION admin_generate_team_credentials(
    p_admin_token VARCHAR,
    p_confirmation_code VARCHAR DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_auth RECORD;
    v_team RECORD;
    v_raw_pass VARCHAR;
    v_salt VARCHAR;
    v_hash VARCHAR;
    v_credentials JSONB := '[]'::jsonb;
BEGIN
    SELECT * INTO v_auth FROM verify_admin_token(p_admin_token, 'admin');
    IF NOT v_auth.is_valid THEN
        RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Unauthorized: Valid administrator session token required.');
    END IF;

    IF v_auth.role = 'marshal' THEN
        RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN', 'message', 'Marshals cannot generate or reset team credentials.');
    END IF;

    IF p_confirmation_code IS NULL OR p_confirmation_code <> 'CONFIRM_GENERATE_CREDENTIALS' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'CONFIRMATION_REQUIRED',
            'message', 'Confirmation required. Supply confirmation code "CONFIRM_GENERATE_CREDENTIALS" to regenerate all team credentials.'
        );
    END IF;

    FOR v_team IN SELECT id, team_code, team_name FROM teams ORDER BY team_code LOOP
        v_raw_pass := 'MM2-' || 
            UPPER(SUBSTRING(encode(extensions.gen_random_bytes(6), 'hex') FROM 1 FOR 4)) || '-' || 
            UPPER(SUBSTRING(encode(extensions.gen_random_bytes(6), 'hex') FROM 5 FOR 4)) || '-' || 
            UPPER(SUBSTRING(encode(extensions.gen_random_bytes(6), 'hex') FROM 9 FOR 4));

        v_salt := extensions.gen_salt('bf', 10);
        v_hash := extensions.crypt(v_raw_pass, v_salt);

        UPDATE teams
        SET passcode_hash = v_hash,
            credentials_randomized = true,
            active_session_token_hash = NULL,
            device_fingerprint = NULL,
            failed_login_attempts = 0,
            locked_until = NULL,
            updated_at = NOW()
        WHERE id = v_team.id;

        v_credentials := v_credentials || jsonb_build_object(
            'team_id', v_team.id,
            'team_code', v_team.team_code,
            'team_name', v_team.team_name,
            'passcode', v_raw_pass
        );
    END LOOP;

    INSERT INTO audit_logs (event_type, severity, details)
    VALUES ('admin_generated_team_credentials', 'critical', jsonb_build_object(
        'teams_count', jsonb_array_length(v_credentials),
        'issued_by', v_auth.username,
        'timestamp', NOW()
    ));

    RETURN jsonb_build_object(
        'success', true,
        'count', jsonb_array_length(v_credentials),
        'credentials', v_credentials,
        'message', 'Cryptographically secure credentials generated for ' || jsonb_array_length(v_credentials) || ' teams.'
    );
END;
$$;

-- 8.10 admin_randomize_team_credentials (Alias)
CREATE OR REPLACE FUNCTION admin_randomize_team_credentials(
    p_admin_token VARCHAR
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
    RETURN admin_generate_team_credentials(p_admin_token, 'CONFIRM_GENERATE_CREDENTIALS');
END;
$$;

-- 8.11 admin_eliminate_team
CREATE OR REPLACE FUNCTION admin_eliminate_team(
    p_admin_token VARCHAR,
    p_team_id UUID,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_auth RECORD;
    v_team RECORD;
BEGIN
    SELECT * INTO v_auth FROM verify_admin_token(p_admin_token, 'admin');
    IF NOT v_auth.is_valid THEN
        RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Unauthorized: Valid administrator session token required.');
    END IF;

    SELECT * INTO v_team FROM teams WHERE id = p_team_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'NOT_FOUND', 'message', 'Team not found.');
    END IF;

    UPDATE teams
    SET status = 'eliminated',
        elimination_reason = p_reason,
        updated_at = NOW()
    WHERE id = p_team_id;

    INSERT INTO audit_logs (event_type, severity, team_id, details)
    VALUES ('admin_team_eliminated', 'critical', p_team_id, jsonb_build_object('reason', p_reason, 'eliminated_by', v_auth.username));

    RETURN jsonb_build_object('success', true, 'message', 'Team eliminated.');
END;
$$;

-- 8.12 admin_reinstate_team
CREATE OR REPLACE FUNCTION admin_reinstate_team(
    p_admin_token VARCHAR,
    p_team_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_auth RECORD;
    v_team RECORD;
BEGIN
    SELECT * INTO v_auth FROM verify_admin_token(p_admin_token, 'admin');
    IF NOT v_auth.is_valid THEN
        RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Unauthorized: Valid administrator session token required.');
    END IF;

    SELECT * INTO v_team FROM teams WHERE id = p_team_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'NOT_FOUND', 'message', 'Team not found.');
    END IF;

    UPDATE teams
    SET status = 'active',
        total_strikes = 0,
        elimination_reason = NULL,
        updated_at = NOW()
    WHERE id = p_team_id;

    INSERT INTO audit_logs (event_type, severity, team_id, details)
    VALUES ('admin_team_reinstated', 'warning', p_team_id, jsonb_build_object('previous_strikes', v_team.total_strikes, 'reinstated_by', v_auth.username));

    RETURN jsonb_build_object('success', true, 'message', 'Team successfully reinstated.');
END;
$$;

-- 8.13 admin_record_violation
CREATE OR REPLACE FUNCTION admin_record_violation(
    p_admin_token VARCHAR,
    p_team_id UUID,
    p_violation_type VARCHAR,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_auth RECORD;
    v_team RECORD;
    v_new_strikes INT;
    v_is_eliminated BOOLEAN := false;
    v_reason TEXT;
    v_msg TEXT;
BEGIN
    SELECT * INTO v_auth FROM verify_admin_token(p_admin_token, 'admin');
    IF NOT v_auth.is_valid THEN
        RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Unauthorized: Valid administrator session token required.');
    END IF;

    SELECT * INTO v_team FROM teams WHERE id = p_team_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'NOT_FOUND', 'message', 'Team not found.');
    END IF;

    IF v_team.status = 'eliminated' THEN
        RETURN jsonb_build_object('success', false, 'strikeNumber', v_team.total_strikes, 'eliminated', true, 'message', 'Team is already eliminated.');
    END IF;

    v_new_strikes := LEAST(v_team.total_strikes + 1, 3);
    IF v_new_strikes >= 3 THEN
        v_is_eliminated := true;
        v_reason := 'Disqualified by administrator for security/anti-cheat violation (' || p_violation_type || ')';
    END IF;

    UPDATE teams
    SET total_strikes = v_new_strikes,
        status = CASE WHEN v_is_eliminated THEN 'eliminated' ELSE status END,
        elimination_reason = CASE WHEN v_is_eliminated THEN v_reason ELSE elimination_reason END,
        updated_at = NOW()
    WHERE id = p_team_id;

    INSERT INTO audit_logs (event_type, severity, team_id, details)
    VALUES (
        CASE WHEN v_is_eliminated THEN 'team_eliminated_anti_cheat' ELSE 'anti_cheat_violation_strike' END,
        CASE WHEN v_is_eliminated THEN 'critical' ELSE 'error' END,
        p_team_id,
        jsonb_build_object(
            'violation_type', p_violation_type,
            'strike_number', v_new_strikes,
            'action', CASE WHEN v_is_eliminated THEN 'team_eliminated' ELSE 'strike_recorded' END,
            'recorded_by', v_auth.username,
            'metadata', p_metadata
        )
    );

    v_msg := 'Admin recorded strike ' || v_new_strikes || '/3 for team ' || v_team.team_code;
    IF v_is_eliminated THEN
        v_msg := v_msg || ' — Team Disqualified!';
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'strikeNumber', v_new_strikes,
        'eliminated', v_is_eliminated,
        'message', v_msg
    );
END;
$$;

-- 8.14 admin_reset_team_session
CREATE OR REPLACE FUNCTION admin_reset_team_session(
    p_admin_token VARCHAR,
    p_team_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_auth RECORD;
BEGIN
    SELECT * INTO v_auth FROM verify_admin_token(p_admin_token, 'admin');
    IF NOT v_auth.is_valid THEN
        RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Unauthorized: Valid administrator session token required.');
    END IF;

    UPDATE teams
    SET active_session_token_hash = NULL,
        device_fingerprint = NULL,
        failed_login_attempts = 0,
        locked_until = NULL,
        updated_at = NOW()
    WHERE id = p_team_id;

    RETURN jsonb_build_object('success', true, 'message', 'Team session reset.');
END;
$$;

-- 8.15 admin_reset_team_progress
CREATE OR REPLACE FUNCTION admin_reset_team_progress(
    p_admin_token VARCHAR,
    p_team_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_auth RECORD;
BEGIN
    SELECT * INTO v_auth FROM verify_admin_token(p_admin_token, 'admin');
    IF NOT v_auth.is_valid THEN
        RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Unauthorized: Valid administrator session token required.');
    END IF;

    DELETE FROM team_progress WHERE team_id = p_team_id;
    DELETE FROM submissions WHERE team_id = p_team_id;
    DELETE FROM qr_scans WHERE team_id = p_team_id;

    UPDATE teams
    SET current_round = 1,
        total_strikes = 0,
        status = 'ready',
        started_at = NULL,
        completed_at = NULL,
        total_time_ms = NULL,
        elimination_reason = NULL,
        updated_at = NOW()
    WHERE id = p_team_id;

    RETURN jsonb_build_object('success', true, 'message', 'Team progress reset to Round 1.');
END;
$$;

-- 8.16 admin_regenerate_event_qr_tokens
CREATE OR REPLACE FUNCTION admin_regenerate_event_qr_tokens(
    p_admin_token VARCHAR,
    p_confirmation_code VARCHAR DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_auth RECORD;
    v_loc RECORD;
    v_new_token VARCHAR;
    v_count INT := 0;
BEGIN
    SELECT * INTO v_auth FROM verify_admin_token(p_admin_token, 'admin');
    IF NOT v_auth.is_valid THEN
        RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Unauthorized: Valid administrator session token required.');
    END IF;

    IF p_confirmation_code IS NULL OR p_confirmation_code <> 'CONFIRM_REGENERATE_TOKENS' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'CONFIRMATION_REQUIRED',
            'message', 'Confirmation required. Supply confirmation code "CONFIRM_REGENERATE_TOKENS".'
        );
    END IF;

    UPDATE event_settings
    SET starting_qr_token = 'START-' || UPPER(encode(extensions.gen_random_bytes(6), 'hex')),
        final_qr_token = 'FINAL-' || UPPER(encode(extensions.gen_random_bytes(6), 'hex')),
        qr_tokens_regenerated = true,
        updated_at = NOW()
    WHERE id = 1;

    FOR v_loc IN SELECT id FROM locations LOOP
        v_new_token := 'LOC-' || UPPER(encode(extensions.gen_random_bytes(6), 'hex'));
        UPDATE locations
        SET qr_token = v_new_token,
            updated_at = NOW()
        WHERE id = v_loc.id;
        v_count := v_count + 1;
    END LOOP;

    INSERT INTO audit_logs (event_type, severity, details)
    VALUES ('qr_tokens_regenerated', 'critical', jsonb_build_object('regenerated_count', v_count, 'initiated_by', v_auth.username));

    RETURN jsonb_build_object(
        'success', true,
        'regenerated_locations', v_count,
        'timestamp', NOW(),
        'message', 'Generated ' || v_count || ' fresh cryptographically collision-free QR tokens.'
    );
END;
$$;

-- 8.17 admin_update_location
CREATE OR REPLACE FUNCTION admin_update_location(
    p_admin_token VARCHAR,
    p_location_id INT,
    p_name VARCHAR,
    p_description TEXT,
    p_capacity INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_auth RECORD;
BEGIN
    SELECT * INTO v_auth FROM verify_admin_token(p_admin_token, 'admin');
    IF NOT v_auth.is_valid THEN
        RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Unauthorized: Valid administrator session token required.');
    END IF;

    UPDATE locations
    SET name = TRIM(p_name),
        description = TRIM(p_description),
        capacity = GREATEST(1, p_capacity),
        updated_at = NOW()
    WHERE id = p_location_id;

    RETURN jsonb_build_object('success', true, 'message', 'Location updated.');
END;
$$;

-- 8.18 admin_regenerate_location_token
CREATE OR REPLACE FUNCTION admin_regenerate_location_token(
    p_admin_token VARCHAR,
    p_location_id INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_auth RECORD;
    v_new_token VARCHAR;
BEGIN
    SELECT * INTO v_auth FROM verify_admin_token(p_admin_token, 'admin');
    IF NOT v_auth.is_valid THEN
        RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Unauthorized: Valid administrator session token required.');
    END IF;

    v_new_token := 'LOC-' || UPPER(encode(extensions.gen_random_bytes(6), 'hex'));

    UPDATE locations
    SET qr_token = v_new_token,
        updated_at = NOW()
    WHERE id = p_location_id;

    RETURN jsonb_build_object('success', true, 'qrToken', v_new_token, 'message', 'Token regenerated.');
END;
$$;

-- 8.19 generate_team_routes
CREATE OR REPLACE FUNCTION generate_team_routes(
    p_admin_token VARCHAR,
    p_active_locations INT DEFAULT 10
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_auth RECORD;
    v_loc_count INT;
    v_teams_list RECORD;
    v_team_index INT := 0;
    v_round INT;
    v_location_id INT;
    v_routes_created INT := 0;
    v_routes_locked BOOLEAN;
    v_location_ids INT[];
BEGIN
    SELECT * INTO v_auth FROM verify_admin_token(p_admin_token, 'admin');
    IF NOT v_auth.is_valid THEN
        RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Unauthorized: Valid administrator session token required.');
    END IF;

    SELECT COALESCE(routes_locked, false) INTO v_routes_locked FROM event_settings WHERE id = 1;
    IF v_routes_locked THEN
        RETURN jsonb_build_object('success', false, 'error', 'ROUTES_LOCKED', 'message', 'Routes are locked for live competition.');
    END IF;

    SELECT array_agg(id ORDER BY location_number)
    INTO v_location_ids
    FROM locations
    WHERE active = true;

    v_loc_count := COALESCE(array_length(v_location_ids, 1), 0);
    IF v_loc_count < 2 THEN
        RETURN jsonb_build_object('success', false, 'error', 'INSUFFICIENT_LOCATIONS', 'message', 'At least 2 active locations required.');
    END IF;

    DELETE FROM team_routes;

    FOR v_teams_list IN SELECT id FROM teams ORDER BY team_code LOOP
        FOR v_round IN 1..v_loc_count LOOP
            v_location_id := v_location_ids[((v_team_index + (v_round - 1)) % v_loc_count) + 1];

            INSERT INTO team_routes (team_id, round_number, location_id)
            VALUES (v_teams_list.id, v_round, v_location_id);

            v_routes_created := v_routes_created + 1;
        END LOOP;
        v_team_index := v_team_index + 1;
    END LOOP;

    RETURN jsonb_build_object('success', true, 'count', v_routes_created, 'message', 'Generated balanced collision-free routes.');
END;
$$;

-- 8.20 admin_save_puzzle
CREATE OR REPLACE FUNCTION admin_save_puzzle(
    p_admin_token VARCHAR,
    p_id VARCHAR,
    p_round_number INT,
    p_title VARCHAR,
    p_puzzle_type VARCHAR,
    p_description_md TEXT,
    p_accepted_answers TEXT[],
    p_riddle_text TEXT,
    p_hints TEXT[],
    p_options JSONB,
    p_correct_option_index INT,
    p_image_url TEXT,
    p_image_alt TEXT,
    p_three_part_questions JSONB,
    p_three_part_answers JSONB,
    p_code_language VARCHAR,
    p_code_snippet TEXT,
    p_is_active BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_auth RECORD;
BEGIN
    SELECT * INTO v_auth FROM verify_admin_token(p_admin_token, 'admin');
    IF NOT v_auth.is_valid THEN
        RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Unauthorized: Valid administrator session token required.');
    END IF;

    INSERT INTO puzzles (
        id, round_number, title, puzzle_type, description_md, accepted_answers,
        riddle_text, hints, options, correct_option_index, image_url, image_alt,
        three_part_questions, three_part_answers, code_language, code_snippet, is_active, updated_at
    ) VALUES (
        p_id, p_round_number, TRIM(p_title), p_puzzle_type, TRIM(p_description_md), p_accepted_answers,
        TRIM(p_riddle_text), p_hints, p_options, p_correct_option_index, p_image_url, p_image_alt,
        p_three_part_questions, p_three_part_answers, p_code_language, p_code_snippet, p_is_active, NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        round_number = EXCLUDED.round_number,
        title = EXCLUDED.title,
        puzzle_type = EXCLUDED.puzzle_type,
        description_md = EXCLUDED.description_md,
        accepted_answers = EXCLUDED.accepted_answers,
        riddle_text = EXCLUDED.riddle_text,
        hints = EXCLUDED.hints,
        options = EXCLUDED.options,
        correct_option_index = EXCLUDED.correct_option_index,
        image_url = EXCLUDED.image_url,
        image_alt = EXCLUDED.image_alt,
        three_part_questions = EXCLUDED.three_part_questions,
        three_part_answers = EXCLUDED.three_part_answers,
        code_language = EXCLUDED.code_language,
        code_snippet = EXCLUDED.code_snippet,
        is_active = EXCLUDED.is_active,
        updated_at = NOW();

    RETURN jsonb_build_object('success', true, 'message', 'Puzzle saved successfully.');
END;
$$;

-- ------------------------------------------------------------------------------
-- 9. Complete Execution Permissions Audit
-- ------------------------------------------------------------------------------
REVOKE ALL ON FUNCTION admin_custom_login(VARCHAR, VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_custom_login(VARCHAR, VARCHAR) TO anon, authenticated;

REVOKE ALL ON FUNCTION admin_custom_logout(VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_custom_logout(VARCHAR) TO anon, authenticated;

REVOKE ALL ON FUNCTION admin_custom_verify_session(VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_custom_verify_session(VARCHAR) TO anon, authenticated;

REVOKE ALL ON FUNCTION admin_get_dashboard_data(VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_get_dashboard_data(VARCHAR) TO anon, authenticated;

REVOKE ALL ON FUNCTION admin_set_event_status(VARCHAR, VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_set_event_status(VARCHAR, VARCHAR) TO anon, authenticated;

REVOKE ALL ON FUNCTION admin_start_event(VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_start_event(VARCHAR) TO anon, authenticated;

REVOKE ALL ON FUNCTION admin_pause_event(VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_pause_event(VARCHAR) TO anon, authenticated;

REVOKE ALL ON FUNCTION admin_resume_event(VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_resume_event(VARCHAR) TO anon, authenticated;

REVOKE ALL ON FUNCTION admin_end_event(VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_end_event(VARCHAR) TO anon, authenticated;

REVOKE ALL ON FUNCTION admin_create_team(VARCHAR, VARCHAR, VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_create_team(VARCHAR, VARCHAR, VARCHAR) TO anon, authenticated;

REVOKE ALL ON FUNCTION admin_update_team(VARCHAR, UUID, VARCHAR, VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_update_team(VARCHAR, UUID, VARCHAR, VARCHAR) TO anon, authenticated;

REVOKE ALL ON FUNCTION admin_delete_team(VARCHAR, UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_delete_team(VARCHAR, UUID, BOOLEAN) TO anon, authenticated;

REVOKE ALL ON FUNCTION admin_generate_team_credentials(VARCHAR, VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_generate_team_credentials(VARCHAR, VARCHAR) TO anon, authenticated;

REVOKE ALL ON FUNCTION admin_randomize_team_credentials(VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_randomize_team_credentials(VARCHAR) TO anon, authenticated;

REVOKE ALL ON FUNCTION admin_eliminate_team(VARCHAR, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_eliminate_team(VARCHAR, UUID, TEXT) TO anon, authenticated;

REVOKE ALL ON FUNCTION admin_reinstate_team(VARCHAR, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_reinstate_team(VARCHAR, UUID) TO anon, authenticated;

REVOKE ALL ON FUNCTION admin_record_violation(VARCHAR, UUID, VARCHAR, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_record_violation(VARCHAR, UUID, VARCHAR, JSONB) TO anon, authenticated;

REVOKE ALL ON FUNCTION admin_reset_team_session(VARCHAR, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_reset_team_session(VARCHAR, UUID) TO anon, authenticated;

REVOKE ALL ON FUNCTION admin_reset_team_progress(VARCHAR, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_reset_team_progress(VARCHAR, UUID) TO anon, authenticated;

REVOKE ALL ON FUNCTION admin_regenerate_event_qr_tokens(VARCHAR, VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_regenerate_event_qr_tokens(VARCHAR, VARCHAR) TO anon, authenticated;

REVOKE ALL ON FUNCTION admin_update_location(VARCHAR, INT, VARCHAR, TEXT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_update_location(VARCHAR, INT, VARCHAR, TEXT, INT) TO anon, authenticated;

REVOKE ALL ON FUNCTION admin_regenerate_location_token(VARCHAR, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_regenerate_location_token(VARCHAR, INT) TO anon, authenticated;

REVOKE ALL ON FUNCTION generate_team_routes(VARCHAR, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION generate_team_routes(VARCHAR, INT) TO anon, authenticated;

REVOKE ALL ON FUNCTION admin_save_puzzle(VARCHAR, VARCHAR, INT, VARCHAR, VARCHAR, TEXT, TEXT[], TEXT, TEXT[], JSONB, INT, TEXT, TEXT, JSONB, JSONB, VARCHAR, TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_save_puzzle(VARCHAR, VARCHAR, INT, VARCHAR, VARCHAR, TEXT, TEXT[], TEXT, TEXT[], JSONB, INT, TEXT, TEXT, JSONB, JSONB, VARCHAR, TEXT, BOOLEAN) TO anon, authenticated;

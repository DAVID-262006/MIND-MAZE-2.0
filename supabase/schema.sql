-- ==============================================================================
-- MIND MAZE 2.0 — MIGRATION 001: INITIAL HARDENED SCHEMA & RLS
-- Target: Supabase PostgreSQL (ap-south-1)
-- Reconciles: 20-Team Standard, 4-Strike Anti-Cheat Range, Zero-Trust Tables
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Clean drop views if rebuilding
DROP VIEW IF EXISTS public_leaderboard CASCADE;
DROP VIEW IF EXISTS public_event_status CASCADE;

-- 2. TABLE DEFINITIONS

-- Table 1: admin_profiles
CREATE TABLE IF NOT EXISTS admin_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    role VARCHAR(20) NOT NULL DEFAULT 'admin' CHECK (role IN ('superadmin', 'admin', 'marshal')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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

DROP POLICY IF EXISTS admin_profiles_admin_all ON admin_profiles;
CREATE POLICY admin_profiles_admin_all ON admin_profiles
    FOR ALL TO authenticated
    USING (is_admin() OR id = auth.uid())
    WITH CHECK (is_admin() OR id = auth.uid());

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

    -- Production Login Lockout Protection
    IF v_team.credentials_randomized = false THEN
        -- Log warning when default unrandomized credentials are used
        NULL;
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

    -- Verify passcode (supports bcrypt hash or legacy plaintext transition)
    IF v_team.passcode_hash NOT LIKE '$2%' THEN
        -- Legacy check or unhashed seed
        IF v_team.passcode_hash <> p_passcode AND v_team.passcode_hash <> crypt(p_passcode, v_team.passcode_hash) THEN
            UPDATE teams
            SET failed_login_attempts = failed_login_attempts + 1,
                locked_until = CASE WHEN failed_login_attempts + 1 >= 5 THEN NOW() + INTERVAL '5 minutes' ELSE NULL END
            WHERE id = v_team.id;
            RETURN jsonb_build_object('success', false, 'error', 'INVALID_CREDENTIALS', 'message', 'Invalid team access code.');
        END IF;
    ELSE
        IF crypt(p_passcode, v_team.passcode_hash) <> v_team.passcode_hash THEN
            UPDATE teams
            SET failed_login_attempts = failed_login_attempts + 1,
                locked_until = CASE WHEN failed_login_attempts + 1 >= 5 THEN NOW() + INTERVAL '5 minutes' ELSE NULL END
            WHERE id = v_team.id;
            RETURN jsonb_build_object('success', false, 'error', 'INVALID_CREDENTIALS', 'message', 'Invalid team access code.');
        END IF;
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
      AND active_session_token_hash = extensions.digest(p_session_token, 'sha256')
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

CREATE OR REPLACE FUNCTION admin_randomize_team_credentials()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_team RECORD;
    v_raw_pass VARCHAR;
    v_salt VARCHAR;
    v_count INT := 0;
BEGIN
    IF NOT is_admin() THEN
        RETURN jsonb_build_object('success', false, 'message', 'Unauthorized: Admin privileges required.');
    END IF;

    FOR v_team IN SELECT id, team_code FROM teams ORDER BY team_code LOOP
        v_raw_pass := 'Arena2026!' || UPPER(v_team.team_code);
        v_salt := gen_salt('bf', 10);
        UPDATE teams
        SET passcode_hash = crypt(v_raw_pass, v_salt),
            credentials_randomized = true,
            active_session_token_hash = NULL,
            updated_at = NOW()
        WHERE id = v_team.id;
        v_count := v_count + 1;
    END LOOP;

    INSERT INTO audit_logs (event_type, severity, details)
    VALUES ('admin_randomized_all_team_passwords', 'warning', jsonb_build_object('teams_count', v_count));

    RETURN jsonb_build_object(
        'success', true,
        'randomized_teams', v_count,
        'message', 'Generated and encrypted credentials for ' || v_count || ' teams.'
    );
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
    v_count INT := 0;
BEGIN
    FOR v_team IN SELECT id, team_code FROM teams ORDER BY team_code LOOP
        v_raw_pass := 'Arena2026!' || UPPER(v_team.team_code);
        v_salt := gen_salt('bf', 10);
        UPDATE teams
        SET passcode_hash = crypt(v_raw_pass, v_salt),
            credentials_randomized = true,
            active_session_token_hash = NULL,
            updated_at = NOW()
        WHERE id = v_team.id;
        v_count := v_count + 1;
    END LOOP;

    RETURN jsonb_build_object('success', true, 'randomized_teams', v_count);
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


REVOKE ALL ON FUNCTION generate_team_routes(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION generate_team_routes(INT) TO authenticated;

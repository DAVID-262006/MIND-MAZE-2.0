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
    puzzle_type VARCHAR(20) NOT NULL CHECK (puzzle_type IN ('TEXT_RIDDLE', 'MCQ', 'IMAGE_QUIZ', 'IMAGE_MCQ')),
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

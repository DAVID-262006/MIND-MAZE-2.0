# DATABASE DESIGN & SCHEMA — TREASURE HUNT ARENA

## 1. Relational Entity Relationship (ER) Diagram

```
┌──────────────────┐            ┌──────────────────┐            ┌──────────────────┐
│      users       │            │      teams       │            │  game_sessions   │
├──────────────────┤            ├──────────────────┤            ├──────────────────┤
│ id (PK, UUID)    │◄──1:1──────│ id (PK, UUID)    │◄──1:M──────│ id (PK, UUID)    │
│ username (UQ)    │            │ team_name (UQ)   │            │ status (ENUM)    │
│ role (ENUM)      │            │ user_id (FK)     │            │ start_time       │
│ password_hash    │            │ team_code (UQ)   │            │ end_time         │
│ created_at       │            │ status (ENUM)    │            │ total_rounds     │
└──────────────────┘            │ current_round    │            │ created_by (FK)  │
                                │ total_strikes    │            └──────────────────┘
                                │ session_token    │                      │
                                │ completed_at     │                      │
                                └─────────┬────────┘                      │
                                          │                               │
                                          │ 1:M                           │ 1:M
                                          ▼                               ▼
┌──────────────────┐            ┌──────────────────┐            ┌──────────────────┐
│    locations     │            │   team_routes    │            │     puzzles      │
├──────────────────┤            ├──────────────────┤            ├──────────────────┤
│ id (PK, INT)     │◄──1:M──────│ id (PK, UUID)    │            │ id (PK, UUID)    │
│ location_number  │            │ team_id (FK)     │            │ round_number     │
│ name             │            │ round_number     │            │ title            │
│ description      │            │ location_id (FK) │            │ description_md   │
│ qr_hash (UQ)     │            │ unique(team, rnd)│            │ puzzle_type      │
│ qr_salt          │            └──────────────────┘            │ allowed_langs[]  │
│ coordinates      │                                            │ time_limit_ms    │
└─────────┬────────┘                                            │ memory_limit_kb  │
          │                                                     └────────┬─────────┘
          │                                                              │
          │                                                              │ 1:M
          │                     ┌──────────────────┐                     ▼
          │                     │   round_states   │            ┌──────────────────┐
          │                     ├──────────────────┤            │    test_cases    │
          └────────1:M─────────►│ id (PK, UUID)    │            ├──────────────────┤
                                │ team_id (FK)     │            │ id (PK, UUID)    │
                                │ round_number     │◄──1:M──────│ puzzle_id (FK)   │
                                │ puzzle_id (FK)   │            │ is_sample (BOOL) │
                                │ location_id (FK) │            │ input_data       │
                                │ started_at       │            │ expected_output  │
                                │ puzzle_solved_at │            │ explanation      │
                                │ qr_scanned_at    │            └──────────────────┘
                                │ completed_at     │
                                │ status (ENUM)    │
                                └─────────┬────────┘
                                          │
                                          │ 1:M
                                          ▼
┌────────────────────────────────────────────────────────┐
│                   audit_violations                     │
├────────────────────────────────────────────────────────┤
│ id (PK, UUID)                                          │
│ team_id (FK)                                           │
│ violation_type (ENUM: blur, tab_switch, fullscreen, etc│
│ round_number                                           │
│ strike_number                                          │
│ payload_json                                           │
│ created_at                                             │
└────────────────────────────────────────────────────────┘
```

---

## 2. PostgreSQL DDL Specification

```sql
-- Enums
CREATE TYPE user_role AS ENUM ('admin', 'marshal', 'team');
CREATE TYPE team_status AS ENUM ('registered', 'ready', 'active', 'completed', 'eliminated');
CREATE TYPE game_status AS ENUM ('draft', 'ready', 'live', 'paused', 'finished');
CREATE TYPE round_status AS ENUM ('in_progress', 'grace_period', 'solved_pending_qr', 'completed', 'timed_out');
CREATE TYPE puzzle_type AS ENUM ('coding', 'mcq', 'logic');
CREATE TYPE violation_type AS ENUM ('tab_switch', 'window_blur', 'fullscreen_exit', 'duplicate_session', 'rate_limit', 'suspicious_api');

-- Users & Authentication
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'team',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Teams (Exactly 20 teams)
CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    team_name VARCHAR(100) UNIQUE NOT NULL,
    team_code VARCHAR(20) UNIQUE NOT NULL, -- Short credential/badge ID
    status team_status NOT NULL DEFAULT 'registered',
    current_round INT NOT NULL DEFAULT 1 CHECK (current_round BETWEEN 1 AND 10),
    total_strikes INT NOT NULL DEFAULT 0 CHECK (total_strikes BETWEEN 0 AND 3),
    active_session_token VARCHAR(255),     -- Enforces single device/login per team
    device_fingerprint VARCHAR(255),
    completed_at TIMESTAMPTZ,              -- Used for final tie-break/podium
    elimination_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Game Sessions
CREATE TABLE game_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(150) NOT NULL,
    status game_status NOT NULL DEFAULT 'draft',
    total_rounds INT NOT NULL DEFAULT 10,
    round_duration_seconds INT NOT NULL DEFAULT 300,
    grace_period_seconds INT NOT NULL DEFAULT 30,
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    routes_locked BOOLEAN NOT NULL DEFAULT FALSE,
    created_by UUID REFERENCES users(id)
);

-- Physical Locations (Exactly 10 locations)
CREATE TABLE locations (
    id SERIAL PRIMARY KEY,
    location_number INT UNIQUE NOT NULL CHECK (location_number BETWEEN 1 AND 10),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    qr_hash CHAR(64) UNIQUE NOT NULL,   -- SHA-256 of 10-digit numeric token + salt
    qr_salt VARCHAR(32) NOT NULL,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Team Routes (Pre-computed Latin Square balanced allocation)
CREATE TABLE team_routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_session_id UUID NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    round_number INT NOT NULL CHECK (round_number BETWEEN 1 AND 10),
    location_id INT NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
    CONSTRAINT uq_team_round UNIQUE (team_id, round_number),
    CONSTRAINT uq_team_location UNIQUE (team_id, location_id)
);

-- Puzzles (10 rounds)
CREATE TABLE puzzles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    round_number INT UNIQUE NOT NULL CHECK (round_number BETWEEN 1 AND 10),
    title VARCHAR(150) NOT NULL,
    description_md TEXT NOT NULL,
    puzzle_type puzzle_type NOT NULL DEFAULT 'coding',
    allowed_languages TEXT[] NOT NULL DEFAULT '{"c", "cpp", "python", "java"}',
    time_limit_ms INT NOT NULL DEFAULT 2000,
    memory_limit_kb INT NOT NULL DEFAULT 131072,
    starter_code JSONB NOT NULL DEFAULT '{}', -- { "python": "...", "cpp": "..." }
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Test Cases (Sample and Hidden)
CREATE TABLE test_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    puzzle_id UUID NOT NULL REFERENCES puzzles(id) ON DELETE CASCADE,
    is_sample BOOLEAN NOT NULL DEFAULT FALSE,
    input_data TEXT NOT NULL,
    expected_output TEXT NOT NULL,
    explanation TEXT,
    order_index INT NOT NULL DEFAULT 0
);

-- Team Round States (Authoritative State Tracking)
CREATE TABLE round_states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_session_id UUID NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    round_number INT NOT NULL CHECK (round_number BETWEEN 1 AND 10),
    puzzle_id UUID NOT NULL REFERENCES puzzles(id) ON DELETE RESTRICT,
    location_id INT NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
    status round_status NOT NULL DEFAULT 'in_progress',
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deadline_at TIMESTAMPTZ NOT NULL,       -- started_at + 300s
    grace_deadline_at TIMESTAMPTZ NOT NULL, -- started_at + 330s
    puzzle_solved_at TIMESTAMPTZ,
    qr_scanned_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    CONSTRAINT uq_round_state UNIQUE (team_id, round_number)
);

-- Code Submissions
CREATE TABLE code_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    puzzle_id UUID NOT NULL REFERENCES puzzles(id) ON DELETE CASCADE,
    round_number INT NOT NULL,
    language VARCHAR(20) NOT NULL,
    source_code TEXT NOT NULL,
    is_run_sample BOOLEAN NOT NULL DEFAULT FALSE,
    judge0_token VARCHAR(100),
    status VARCHAR(50) NOT NULL, -- 'Accepted', 'Wrong Answer', 'Time Limit Exceeded', etc.
    passed_cases INT NOT NULL DEFAULT 0,
    total_cases INT NOT NULL DEFAULT 0,
    compile_output TEXT,
    stderr TEXT,
    execution_time_ms INT,
    memory_used_kb INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- QR Verification Scans
CREATE TABLE qr_scans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    round_number INT NOT NULL,
    location_id INT NOT NULL REFERENCES locations(id),
    scanned_token_hash CHAR(64) NOT NULL,
    is_valid BOOLEAN NOT NULL,
    rejection_reason VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Anti-Cheat Telemetry & Strikes
CREATE TABLE audit_violations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    round_number INT NOT NULL,
    violation_type violation_type NOT NULL,
    strike_number INT NOT NULL CHECK (strike_number BETWEEN 1 AND 3),
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance Indexes
CREATE INDEX idx_teams_status ON teams(status);
CREATE INDEX idx_round_states_team_status ON round_states(team_id, status);
CREATE INDEX idx_round_states_deadlines ON round_states(status, grace_deadline_at) WHERE status IN ('in_progress', 'grace_period', 'solved_pending_qr');
CREATE INDEX idx_team_routes_lookup ON team_routes(game_session_id, round_number, location_id);
CREATE INDEX idx_test_cases_puzzle ON test_cases(puzzle_id, is_sample);
CREATE INDEX idx_audit_violations_team ON audit_violations(team_id, strike_number);
```

---

## 3. Atomic State Transition Stored Procedure

To ensure race-free advancement even under multiple concurrent packet arrivals:

```sql
CREATE OR REPLACE FUNCTION verify_qr_and_advance_round(
    p_team_id UUID,
    p_scanned_hash CHAR(64),
    p_current_time TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_team RECORD;
    v_round_state RECORD;
    v_expected_route RECORD;
    v_location RECORD;
    v_next_puzzle_id UUID;
    v_next_location_id INT;
BEGIN
    -- 1. Lock team record
    SELECT * INTO v_team FROM teams WHERE id = p_team_id FOR UPDATE;
    IF v_team.status != 'active' THEN
        RETURN jsonb_build_object('success', false, 'reason', 'Team is not active or eliminated');
    END IF;

    -- 2. Lock current round state
    SELECT * INTO v_round_state 
    FROM round_states 
    WHERE team_id = p_team_id AND round_number = v_team.current_round 
    FOR UPDATE;

    IF v_round_state IS NULL THEN
        RETURN jsonb_build_object('success', false, 'reason', 'Round state not found');
    END IF;

    -- 3. Verify puzzle solved
    IF v_round_state.puzzle_solved_at IS NULL THEN
        RETURN jsonb_build_object('success', false, 'reason', 'Puzzle has not been solved yet');
    END IF;

    -- 4. Verify deadline
    IF p_current_time > v_round_state.grace_deadline_at THEN
        -- Auto-eliminate
        UPDATE teams SET status = 'eliminated', elimination_reason = 'Grace period timeout on QR scan' WHERE id = p_team_id;
        UPDATE round_states SET status = 'timed_out' WHERE id = v_round_state.id;
        RETURN jsonb_build_object('success', false, 'reason', 'Deadline exceeded. Team eliminated.');
    END IF;

    -- 5. Match QR with expected location
    SELECT * INTO v_location FROM locations WHERE qr_hash = p_scanned_hash;
    IF v_location IS NULL THEN
        RETURN jsonb_build_object('success', false, 'reason', 'Invalid QR code token');
    END IF;

    IF v_location.id != v_round_state.location_id THEN
        RETURN jsonb_build_object('success', false, 'reason', 'Wrong location for this round');
    END IF;

    -- 6. Mark round complete
    UPDATE round_states 
    SET status = 'completed', qr_scanned_at = p_current_time, completed_at = p_current_time 
    WHERE id = v_round_state.id;

    -- 7. If Round 10: Competition Complete!
    IF v_team.current_round = 10 THEN
        UPDATE teams 
        SET status = 'completed', completed_at = p_current_time 
        WHERE id = p_team_id;
        RETURN jsonb_build_object('success', true, 'game_completed', true, 'final_round', 10);
    END IF;

    -- 8. Prepare Next Round (Round N+1)
    SELECT puzzle_id INTO v_next_puzzle_id FROM puzzles WHERE round_number = v_team.current_round + 1;
    SELECT location_id INTO v_next_location_id FROM team_routes 
    WHERE team_id = p_team_id AND round_number = v_team.current_round + 1;

    INSERT INTO round_states (
        game_session_id, team_id, round_number, puzzle_id, location_id,
        status, started_at, deadline_at, grace_deadline_at
    ) VALUES (
        v_round_state.game_session_id, p_team_id, v_team.current_round + 1,
        v_next_puzzle_id, v_next_location_id,
        'in_progress', p_current_time,
        p_current_time + INTERVAL '300 seconds',
        p_current_time + INTERVAL '330 seconds'
    );

    UPDATE teams 
    SET current_round = current_round + 1 
    WHERE id = p_team_id;

    RETURN jsonb_build_object('success', true, 'game_completed', false, 'new_round', v_team.current_round + 1);
END;
$$;
```

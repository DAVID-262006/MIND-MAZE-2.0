-- ============================================================
-- MIND MAZE 2.0 — Migration 010
-- Question-Only Timer Tracking + Enhanced Admin Sync
-- ============================================================
-- Adds:
--   • question_started_at   : when question display began (timer start)
--   • question_solved_at    : when correct answer was accepted (timer stop)
--   • question_duration_ms  : final solving duration in milliseconds
--   • question_status       : 'not_started' | 'in_progress' | 'solved'
--
-- Architecture rules strictly upheld:
--   • NO question content, answers, code snippets or riddles stored here
--   • Only operational timestamps and status flags
-- ============================================================

-- Add question timer columns to team_progress (idempotent)
ALTER TABLE public.team_progress
  ADD COLUMN IF NOT EXISTS question_started_at   TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS question_solved_at    TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS question_duration_ms  BIGINT      DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS question_status       TEXT        NOT NULL DEFAULT 'not_started'
    CHECK (question_status IN ('not_started', 'in_progress', 'solved'));

-- Index for fast admin dashboard lookups on question_status
CREATE INDEX IF NOT EXISTS idx_team_progress_question_status
  ON public.team_progress (team_id, round_number, question_status);

-- ============================================================
-- RPC: record_question_started(p_session_token, p_round_number)
-- Called by participant when a question first becomes visible.
-- Idempotent: does NOT reset the timer if already in_progress.
-- ============================================================
CREATE OR REPLACE FUNCTION public.record_question_started(
  p_session_token TEXT,
  p_round_number  INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team_id  UUID;
  v_now      TIMESTAMPTZ := now();
  v_existing RECORD;
BEGIN
  -- Validate session
  SELECT team_id INTO v_team_id
  FROM   public.team_sessions
  WHERE  session_token = p_session_token
    AND  expires_at > v_now;

  IF v_team_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired session');
  END IF;

  -- Check existing progress row
  SELECT question_status, question_started_at
  INTO   v_existing
  FROM   public.team_progress
  WHERE  team_id = v_team_id AND round_number = p_round_number;

  -- Only set started_at if not already started / solved
  IF v_existing IS NULL THEN
    -- Upsert progress row with question timer start
    INSERT INTO public.team_progress
      (team_id, round_number, question_status, question_started_at,
       puzzle_solved, qr_scanned, attempts_count,
       round_started_at, deadline_at, grace_deadline_at)
    VALUES
      (v_team_id, p_round_number, 'in_progress', v_now,
       false, false, 0,
       v_now, v_now + INTERVAL '5 minutes', v_now + INTERVAL '5 minutes 30 seconds')
    ON CONFLICT (team_id, round_number)
    DO UPDATE SET
      question_status    = 'in_progress',
      question_started_at = EXCLUDED.question_started_at
    WHERE team_progress.question_status = 'not_started';
  ELSIF v_existing.question_status = 'not_started' THEN
    UPDATE public.team_progress
    SET question_status     = 'in_progress',
        question_started_at = v_now
    WHERE team_id = v_team_id AND round_number = p_round_number;
  END IF;
  -- If already in_progress or solved: no-op (idempotent)

  RETURN jsonb_build_object(
    'success', true,
    'question_started_at', v_now,
    'team_id', v_team_id
  );
END;
$$;

-- ============================================================
-- RPC: record_question_solved(p_session_token, p_round_number)
-- Updated to also stamp question_solved_at and duration.
-- ============================================================
CREATE OR REPLACE FUNCTION public.record_puzzle_solved(
  p_session_token TEXT,
  p_round_number  INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team_id       UUID;
  v_now           TIMESTAMPTZ := now();
  v_started_at    TIMESTAMPTZ;
  v_duration_ms   BIGINT;
BEGIN
  SELECT team_id INTO v_team_id
  FROM   public.team_sessions
  WHERE  session_token = p_session_token
    AND  expires_at > v_now;

  IF v_team_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired session');
  END IF;

  -- Get question_started_at for duration calculation
  SELECT question_started_at INTO v_started_at
  FROM   public.team_progress
  WHERE  team_id = v_team_id AND round_number = p_round_number;

  IF v_started_at IS NOT NULL THEN
    v_duration_ms := EXTRACT(EPOCH FROM (v_now - v_started_at)) * 1000;
  END IF;

  INSERT INTO public.team_progress
    (team_id, round_number, puzzle_solved, puzzle_solved_at,
     question_status, question_started_at, question_solved_at, question_duration_ms,
     attempts_count, qr_scanned,
     round_started_at, deadline_at, grace_deadline_at)
  VALUES
    (v_team_id, p_round_number, true, v_now,
     'solved', COALESCE(v_started_at, v_now), v_now, v_duration_ms,
     0, false,
     v_now, v_now + INTERVAL '5 minutes', v_now + INTERVAL '5 minutes 30 seconds')
  ON CONFLICT (team_id, round_number)
  DO UPDATE SET
    puzzle_solved        = true,
    puzzle_solved_at     = v_now,
    question_status      = 'solved',
    question_solved_at   = v_now,
    question_duration_ms = v_duration_ms,
    question_started_at  = COALESCE(team_progress.question_started_at, v_started_at, v_now);

  RETURN jsonb_build_object(
    'success', true,
    'puzzle_solved', true,
    'question_solved_at', v_now,
    'question_duration_ms', v_duration_ms,
    'current_round', p_round_number
  );
END;
$$;

-- ============================================================
-- Update get_team_state to return question timer fields
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_team_state(
  p_team_id      UUID,
  p_session_token TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team      RECORD;
  v_progress  RECORD;
  v_event     RECORD;
  v_now       TIMESTAMPTZ := now();
BEGIN
  -- Validate session
  IF NOT EXISTS (
    SELECT 1 FROM public.team_sessions
    WHERE team_id = p_team_id
      AND session_token = p_session_token
      AND expires_at > v_now
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired session');
  END IF;

  SELECT id, team_code, team_name, status, current_round,
         COALESCE(total_strikes, strikes, 0) AS total_strikes,
         started_at, completed_at, total_time_ms
  INTO   v_team
  FROM   public.teams
  WHERE  id = p_team_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Team not found');
  END IF;

  SELECT status, event_started_at, round_duration_seconds,
         COALESCE(grace_period_seconds, 30) AS grace_period_seconds,
         COALESCE(total_pause_duration_ms, 0) AS total_pause_duration_ms,
         (SELECT COUNT(*) FROM public.locations WHERE active = true) AS active_locations_count
  INTO   v_event
  FROM   public.event_settings
  LIMIT  1;

  SELECT round_number, puzzle_solved, puzzle_solved_at,
         qr_scanned, qr_scanned_at, attempts_count,
         round_started_at, deadline_at, grace_deadline_at,
         status, riddle_revealed,
         question_status, question_started_at, question_solved_at, question_duration_ms
  INTO   v_progress
  FROM   public.team_progress
  WHERE  team_id = p_team_id
    AND  round_number = v_team.current_round;

  RETURN jsonb_build_object(
    'success', true,
    'team', jsonb_build_object(
      'id',            v_team.id,
      'team_code',     v_team.team_code,
      'team_name',     v_team.team_name,
      'status',        v_team.status,
      'current_round', v_team.current_round,
      'total_strikes', v_team.total_strikes,
      'started_at',    v_team.started_at,
      'completed_at',  v_team.completed_at,
      'total_time_ms', v_team.total_time_ms
    ),
    'event', jsonb_build_object(
      'status',                  COALESCE(v_event.status, 'draft'),
      'active_locations_count',  COALESCE(v_event.active_locations_count, 9),
      'round_duration_seconds',  COALESCE(v_event.round_duration_seconds, 300),
      'grace_period_seconds',    COALESCE(v_event.grace_period_seconds, 30),
      'total_pause_duration_ms', COALESCE(v_event.total_pause_duration_ms, 0)
    ),
    'current_progress', CASE WHEN v_progress IS NULL THEN NULL ELSE
      jsonb_build_object(
        'round_number',       v_progress.round_number,
        'puzzle_solved',      v_progress.puzzle_solved,
        'puzzle_solved_at',   v_progress.puzzle_solved_at,
        'qr_scanned',         v_progress.qr_scanned,
        'qr_scanned_at',      v_progress.qr_scanned_at,
        'attempts_count',     v_progress.attempts_count,
        'round_started_at',   v_progress.round_started_at,
        'deadline_at',        v_progress.deadline_at,
        'grace_deadline_at',  v_progress.grace_deadline_at,
        'status',             COALESCE(v_progress.status, 'in_progress'),
        'riddle_revealed',    v_progress.riddle_revealed,
        'question_status',    COALESCE(v_progress.question_status, 'not_started'),
        'question_started_at', v_progress.question_started_at,
        'question_solved_at',  v_progress.question_solved_at,
        'question_duration_ms', v_progress.question_duration_ms
      )
    END
  );
END;
$$;

-- ============================================================
-- Update admin_get_dashboard_data to include question timer fields
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_get_dashboard_data(
  p_admin_token TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin RECORD;
BEGIN
  SELECT id, role INTO v_admin
  FROM   public.admin_sessions
  WHERE  session_token = p_admin_token
    AND  expires_at > now()
    AND  is_active = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Invalid admin token');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'teams', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id',                     t.id,
          'team_code',              t.team_code,
          'team_name',              t.team_name,
          'username',               tc.username,
          'credentials_configured', (tc.username IS NOT NULL),
          'credentials_randomized', t.credentials_randomized,
          'status',                 t.status,
          'current_round',          t.current_round,
          'total_strikes',          COALESCE(t.total_strikes, t.strikes, 0),
          'started_at',             t.started_at,
          'completed_at',           t.completed_at,
          'total_time_ms',          t.total_time_ms,
          'last_seen_at',           t.last_seen_at,
          'elimination_reason',     t.elimination_reason,
          'created_at',             t.created_at
        )
      )
      FROM public.teams t
      LEFT JOIN public.team_credentials tc ON tc.team_id = t.id
    ),
    'locations', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id',              l.id,
          'location_number', l.location_number,
          'name',            l.name,
          'description',     l.description,
          'capacity',        l.capacity,
          'active',          l.active
        )
      )
      FROM public.locations l
      ORDER BY l.location_number
    ),
    'routes', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'team_id',      r.team_id,
          'round_number', r.round_number,
          'location_id',  r.location_id
        )
      )
      FROM public.team_routes r
    ),
    'progress', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'team_id',             tp.team_id,
          'round_number',        tp.round_number,
          'puzzle_solved',       tp.puzzle_solved,
          'puzzle_solved_at',    tp.puzzle_solved_at,
          'qr_scanned',          tp.qr_scanned,
          'qr_scanned_at',       tp.qr_scanned_at,
          'attempts_count',      tp.attempts_count,
          'round_started_at',    tp.round_started_at,
          'deadline_at',         tp.deadline_at,
          'grace_deadline_at',   tp.grace_deadline_at,
          'status',              tp.status,
          'question_status',     COALESCE(tp.question_status, 'not_started'),
          'question_started_at', tp.question_started_at,
          'question_solved_at',  tp.question_solved_at,
          'question_duration_ms',tp.question_duration_ms
        )
      )
      FROM public.team_progress tp
    ),
    'incidents', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id',         al.id,
          'team_id',    al.team_id,
          'event_type', al.event_type,
          'details',    al.details,
          'created_at', al.created_at
        )
      )
      FROM public.audit_logs al
      ORDER BY al.created_at DESC
      LIMIT 500
    )
  );
END;
$$;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION public.record_question_started(TEXT, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_puzzle_solved(TEXT, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_team_state(UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_dashboard_data(TEXT) TO anon, authenticated;


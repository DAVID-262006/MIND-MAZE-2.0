-- ==============================================================================
-- MIND MAZE 2.0: Migration 005 - Question Engine & Dynamic Stations Upgrade
-- Supports CODE_BASED and THREE_PART_TEXT question types.
-- Dynamic station counts, independent 3-part answer evaluation, secure riddle gating.
-- ==============================================================================

-- 1. Relax active_locations_count check constraint on event_settings
ALTER TABLE event_settings
    DROP CONSTRAINT IF EXISTS event_settings_active_locations_count_check;

ALTER TABLE event_settings
    ADD CONSTRAINT event_settings_active_locations_count_check
    CHECK (active_locations_count BETWEEN 1 AND 50);

-- 2. Expand puzzles table schema
ALTER TABLE puzzles
    ALTER COLUMN puzzle_type TYPE VARCHAR(50);

ALTER TABLE puzzles
    DROP CONSTRAINT IF EXISTS puzzles_puzzle_type_check;

ALTER TABLE puzzles
    ADD CONSTRAINT puzzles_puzzle_type_check
    CHECK (puzzle_type IN (
        'CODE_BASED',
        'THREE_PART_TEXT',
        'TEXT_RIDDLE',
        'MCQ',
        'IMAGE_QUIZ',
        'IMAGE_MCQ',
        'coding',
        'text',
        'crypto',
        'logic'
    ));

ALTER TABLE puzzles
    ADD COLUMN IF NOT EXISTS three_part_questions JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS three_part_answers JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS code_language VARCHAR(30) DEFAULT 'python',
    ADD COLUMN IF NOT EXISTS code_snippet TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- 3. Upgrade submit_puzzle_answer RPC with 3-part & code validation
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

-- 4. Upgrade get_team_state to include question engine properties without leaking answers
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

-- 5. Admin Manage Puzzle RPC
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

-- 6. Permissions
REVOKE ALL ON FUNCTION submit_puzzle_answer(UUID, VARCHAR, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION submit_puzzle_answer(UUID, VARCHAR, TEXT) TO anon, authenticated;

REVOKE ALL ON FUNCTION get_team_state(UUID, VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_team_state(UUID, VARCHAR) TO anon, authenticated;

REVOKE ALL ON FUNCTION admin_save_puzzle(VARCHAR, INT, VARCHAR, VARCHAR, TEXT, TEXT[], TEXT, TEXT[], TEXT[], INT, TEXT, TEXT, JSONB, JSONB, VARCHAR, TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_save_puzzle(VARCHAR, INT, VARCHAR, VARCHAR, TEXT, TEXT[], TEXT, TEXT[], TEXT[], INT, TEXT, TEXT, JSONB, JSONB, VARCHAR, TEXT, BOOLEAN) TO authenticated;

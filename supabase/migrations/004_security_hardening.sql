-- ==============================================================================
-- MIND MAZE 2.0 — MIGRATION 004: SECURITY HARDENING & REALTIME SYNCHRONIZATION
-- 1. Restrict admin_record_violation strictly to authenticated admins (is_admin())
-- 2. Provide report_team_violation RPC for participant client violations (session_token protected)
-- 3. Enable event_settings SELECT for anon role to receive Realtime state broadcasts
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Realtime Synchronization Policy for event_settings
-- ------------------------------------------------------------------------------
-- Allows anon participants to receive Realtime change broadcasts for event lifecycle (live/paused/finished)
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

-- ------------------------------------------------------------------------------
-- 2. Hardened admin_record_violation RPC (Admin only)
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

REVOKE ALL ON FUNCTION admin_record_violation(UUID, VARCHAR, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION admin_record_violation(UUID, VARCHAR, JSONB) FROM anon;
GRANT EXECUTE ON FUNCTION admin_record_violation(UUID, VARCHAR, JSONB) TO authenticated;

-- ------------------------------------------------------------------------------
-- 3. Participant report_team_violation RPC (Session token verified)
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

REVOKE ALL ON FUNCTION report_team_violation(UUID, VARCHAR, VARCHAR, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION report_team_violation(UUID, VARCHAR, VARCHAR, JSONB) TO anon, authenticated;

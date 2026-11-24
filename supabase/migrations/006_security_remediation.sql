-- ==============================================================================
-- MIND MAZE 2.0 — MIGRATION 006: SECURITY REMEDIATION & PRODUCTION HARDENING
-- Addresses:
-- 1. admin_profiles privilege escalation: Drops unsafe self-assignment policy;
--    restricts creation/modification to is_superadmin() and service_role.
-- 2. Team credentials: Cryptographically secure random passcodes via pgcrypto;
--    stores only bcrypt hashes; login_team rejects unrandomized credentials;
--    removes legacy plaintext fallback; deliberate admin issuance RPC returning
--    passcodes once for CSV download.
-- 3. Team management backend RPCs: admin_create_team, admin_update_team, admin_delete_team
--    with duplicate validation and progress safeguards.
-- 4. Search path & execution permission hardening across all procedures.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Helper: is_superadmin()
-- ------------------------------------------------------------------------------
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

REVOKE ALL ON FUNCTION is_superadmin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_superadmin() TO authenticated, anon;

-- ------------------------------------------------------------------------------
-- 2. Fix admin_profiles RLS Policies (Zero Self-Elevation)
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------
-- 3. Deliberate Cryptographic Team Credential Generation & Issuance
-- ------------------------------------------------------------------------------
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

REVOKE ALL ON FUNCTION admin_generate_team_credentials(VARCHAR) FROM PUBLIC;
REVOKE ALL ON FUNCTION admin_generate_team_credentials(VARCHAR) FROM anon;
GRANT EXECUTE ON FUNCTION admin_generate_team_credentials(VARCHAR) TO authenticated;

-- Also update bootstrap_randomize_team_credentials to use real cryptographic passcodes
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

REVOKE ALL ON FUNCTION bootstrap_randomize_team_credentials() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION bootstrap_randomize_team_credentials() TO postgres;

-- ------------------------------------------------------------------------------
-- 4. Hardened login_team (Rejects unrandomized teams & enforces bcrypt)
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

    -- Reset failed login attempts on successful authentication
    UPDATE teams
    SET failed_login_attempts = 0,
        locked_until = NULL
    WHERE id = v_team.id;

    -- Generate cryptographic 64-character session token
    v_session_token := encode(extensions.gen_random_bytes(32), 'hex');
    v_token_hash := encode(extensions.digest(v_session_token, 'sha256'), 'hex');

    UPDATE teams
    SET active_session_token_hash = v_token_hash,
        device_fingerprint = p_device_fingerprint,
        updated_at = NOW()
    WHERE id = v_team.id;

    -- Audit login event
    INSERT INTO audit_logs (event_type, severity, team_id, details)
    VALUES ('team_login_authenticated', 'info', v_team.id, jsonb_build_object(
        'team_code', v_team.team_code,
        'device_fingerprint', p_device_fingerprint,
        'ip_address', NULL
    ));

    RETURN jsonb_build_object(
        'success', true,
        'team_id', v_team.id,
        'team_code', v_team.team_code,
        'team_name', v_team.team_name,
        'current_round', v_team.current_round,
        'status', v_team.status,
        'session_token', v_session_token,
        'event_status', v_settings.status,
        'message', 'Team authenticated successfully.'
    );
END;
$$;

REVOKE ALL ON FUNCTION login_team(VARCHAR, VARCHAR, VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION login_team(VARCHAR, VARCHAR, VARCHAR) TO anon, authenticated;

-- ------------------------------------------------------------------------------
-- 5. Team Management RPCs (Create, Update, Delete with duplicate validation)
-- ------------------------------------------------------------------------------

-- Operation: admin_create_team
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

REVOKE ALL ON FUNCTION admin_create_team(VARCHAR, VARCHAR) FROM PUBLIC;
REVOKE ALL ON FUNCTION admin_create_team(VARCHAR, VARCHAR) FROM anon;
GRANT EXECUTE ON FUNCTION admin_create_team(VARCHAR, VARCHAR) TO authenticated;

-- Operation: admin_update_team
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

REVOKE ALL ON FUNCTION admin_update_team(UUID, VARCHAR, VARCHAR) FROM PUBLIC;
REVOKE ALL ON FUNCTION admin_update_team(UUID, VARCHAR, VARCHAR) FROM anon;
GRANT EXECUTE ON FUNCTION admin_update_team(UUID, VARCHAR, VARCHAR) TO authenticated;

-- Operation: admin_delete_team
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

REVOKE ALL ON FUNCTION admin_delete_team(UUID, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION admin_delete_team(UUID, BOOLEAN) FROM anon;
GRANT EXECUTE ON FUNCTION admin_delete_team(UUID, BOOLEAN) TO authenticated;


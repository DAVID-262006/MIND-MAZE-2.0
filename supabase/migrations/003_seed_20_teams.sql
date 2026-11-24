-- ==============================================================================
-- MIND MAZE 2.0 — HARDENED SEED DATA INITIALIZATION (20-TEAM STANDARD)
-- Pre-populates Event Settings (20 teams), 10 Locations, 10 Puzzles, 20 Teams, Balanced Latin Square
-- ==============================================================================

SET search_path = public, extensions, pg_temp;

-- 1. GLOBAL EVENT SETTINGS (20 Teams Standard)
INSERT INTO event_settings (
    id, event_name, status, total_teams, active_locations_count,
    round_duration_seconds, grace_period_seconds,
    starting_qr_token, final_qr_token, allow_registration, routes_locked, qr_tokens_regenerated
) VALUES (
    1, 'MIND MAZE 2.0 Championship', 'ready', 20, 10,
    300, 30, 'MM2-START-SEMINAR-2026', 'MM2-FINISH-SEMINAR-2026', true, true, false
) ON CONFLICT (id) DO UPDATE SET
    total_teams = 20,
    active_locations_count = 10,
    round_duration_seconds = EXCLUDED.round_duration_seconds,
    grace_period_seconds = EXCLUDED.grace_period_seconds,
    starting_qr_token = CASE WHEN event_settings.qr_tokens_regenerated THEN event_settings.starting_qr_token ELSE EXCLUDED.starting_qr_token END,
    final_qr_token = CASE WHEN event_settings.qr_tokens_regenerated THEN event_settings.final_qr_token ELSE EXCLUDED.final_qr_token END,
    routes_locked = EXCLUDED.routes_locked;

-- 2. MASTER CAMPUS CHECKPOINT LOCATIONS (1 to 10)
INSERT INTO locations (id, location_number, name, description, riddle_clue, capacity, active, qr_token) VALUES
(1, 1, 'Main Library - Atrium',
 'Ground floor entrance near digital catalog kiosk',
 'Where silent knowledge sleeps in thousands of bound pages, seek the digital kiosk on the ground floor atrium.',
 2, true, '8492019481'),

(2, 2, 'Computer Science Building - Hallway A',
 'First floor beside Robotics Laboratory',
 'Where silicon brains learn to walk and robotic arms hum, seek Hallway A on the first floor beside the Robotics Lab.',
 2, true, '7201948293'),

(3, 3, 'Engineering Block - West Entrance',
 'Beside the solar cell showcase display',
 'Where clean energy catches the sky, look beside the solar cell showcase display near the west entrance.',
 2, true, '9182736452'),

(4, 4, 'Student Center - Quad Steps',
 'Exterior pillar facing the amphitheater',
 'Where voices gather on stone tiers, find the exterior pillar facing the outdoor amphitheater steps.',
 2, true, '6392018475'),

(5, 5, 'Innovation Hub - 3rd Floor Mezzanine',
 'Beside the 3D printing workshop glass wall',
 'Where filament becomes structure layer by layer, search the glass walls of the 3D printing workshop on the 3rd floor mezzanine.',
 2, true, '4820193847'),

(6, 6, 'Science Complex - South Courtyard',
 'Underneath the sundial monument',
 'Where shadows cast by the sun tell the exact hour of midday, stand beneath the courtyard sundial monument.',
 2, true, '5920184729'),

(7, 7, 'Auditorium - Foyer South',
 'Right wing lobby adjacent to the trophy cabinet',
 'Where championship honors gleam behind glass, check the right wing foyer adjacent to the historic trophy cabinet.',
 2, true, '3820194821'),

(8, 8, 'Sports Complex - Pavilion Deck',
 'Upper gallery overlooking the athletic track',
 'Where athletes race against the clock on the oval track, scan from the upper gallery pavilion deck.',
 2, true, '8192038475'),

(9, 9, 'Academic Tower - Central Arcade',
 'Archway between Tower 1 and Tower 2',
 'Where twin monolithic towers connect under high arches, walk through the central covered arcade corridor.',
 2, true, '2938472019'),

(10, 10, 'Administration Lawn - Clock Tower Base',
 'North face of the historic clock tower',
 'Where four monumental clock faces chimed every hour since 1928, reach the northern base of the historic stone tower.',
 2, true, '1928374650')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    riddle_clue = EXCLUDED.riddle_clue,
    capacity = EXCLUDED.capacity,
    active = EXCLUDED.active,
    qr_token = CASE WHEN (SELECT qr_tokens_regenerated FROM event_settings WHERE id = 1) THEN locations.qr_token ELSE EXCLUDED.qr_token END;

-- 3. MASTER PUZZLES (1 to 10)
INSERT INTO puzzles (
    id, round_number, title, puzzle_type, description_md,
    accepted_answers, case_sensitive, normalize_whitespace,
    riddle_text, hints, max_attempts, options, correct_option_index, image_url, image_alt, sample_cases, starter_code
) VALUES
(
    'puz-1', 1, 'Historical Computing Pioneer', 'TEXT_RIDDLE',
    'In 1936, which British mathematician and logician introduced the universal computing machine model and subsequently decrypted Naval Enigma signals at Bletchley Park?

Enter the scientist''s surname.',
    ARRAY['turing', 'alan turing', 'alan mathison turing'],
    false, true,
    'Where silent knowledge sleeps in thousands of bound pages, seek the digital kiosk on the ground floor atrium.',
    ARRAY['Namesake of the prestigious ACM award often referred to as the Nobel Prize of Computing.'],
    5,
    '{}'::text[],
    NULL,
    NULL,
    NULL,
    '[]'::jsonb,
    '{}'::jsonb
),
(
    'puz-2', 2, 'Algorithmic Time Complexity', 'MCQ',
    'What is the asymptotic worst-case time complexity of binary search executed on a sorted array of $N$ elements?',
    ARRAY['O(log N) - Logarithmic Time', 'B', '1', 'o(log n)', 'ologn'],
    false, true,
    'Where silicon brains learn to walk and robotic arms hum, seek Hallway A on the first floor beside the Robotics Lab.',
    ARRAY['At each comparison step, the search range is partitioned strictly in half.'],
    5,
    ARRAY['O(1) - Constant Time', 'O(log N) - Logarithmic Time', 'O(N) - Linear Time', 'O(N log N) - Linearithmic Time'],
    1,
    NULL,
    NULL,
    '[]'::jsonb,
    '{}'::jsonb
),
(
    'puz-3', 3, 'Historic Campus Monument Architecture', 'IMAGE_QUIZ',
    'Examine the architectural silhouette schematic below. Built in 1928, this monumental four-faced timekeeping structure marks Checkpoint #10 overlooking the Administration Lawn.

What is the two-word architectural term for this landmark?',
    ARRAY['clock tower', 'the clock tower', 'clocktower'],
    false, true,
    'Where clean energy catches the sky, look beside the solar cell showcase display near the west entrance.',
    ARRAY['It chimes at every hour overlooking the Administration Lawn at Location #10.'],
    5,
    '{}'::text[],
    NULL,
    '/assets/puzzles/clock_tower.svg',
    'Blueprint elevation schematic of historical campus architectural landmark',
    '[]'::jsonb,
    '{}'::jsonb
),
(
    'puz-4', 4, 'Digital Logic Gate Analysis', 'IMAGE_MCQ',
    'Examine the digital logic schematic below. When input signals $A = 1$ and $B = 0$ are applied to this standard Exclusive-OR (XOR) gate, what is the resulting output state $Y$?',
    ARRAY['Y = 1 (Logic High)', 'B', '1', '1', 'y = 1', 'high'],
    false, true,
    'Where voices gather on stone tiers, find the exterior pillar facing the outdoor amphitheater steps.',
    ARRAY['XOR outputs 1 if and only if the two binary inputs are strictly different.'],
    5,
    ARRAY['Y = 0 (Logic Low)', 'Y = 1 (Logic High)', 'High Impedance (Floating)', 'Oscillating Undefined'],
    1,
    '/assets/puzzles/xor_gate.svg',
    'Logic diagram of a 2-input XOR gate with inputs A=1 and B=0',
    '[]'::jsonb,
    '{}'::jsonb
),
(
    'puz-5', 5, 'Hexadecimal ASCII Memory Stream', 'TEXT_RIDDLE',
    'A sensor beacon transmitted this hexadecimal byte array:
`54 72 65 61 73 75 72 65`

Convert the hexadecimal ASCII bytes into human-readable text.',
    ARRAY['treasure', 'Treasure'],
    false, true,
    'Where filament becomes structure layer by layer, search the glass walls of the 3D printing workshop on the 3rd floor mezzanine.',
    ARRAY['0x54 = ''T'', 0x72 = ''r'', 0x65 = ''e''...'],
    5,
    '{}'::text[],
    NULL,
    NULL,
    NULL,
    '[]'::jsonb,
    '{}'::jsonb
),
(
    'puz-6', 6, 'Eulerian Graph Connectivity', 'MCQ',
    'In graph theory, a connected undirected graph contains a closed Eulerian trail (visiting every edge exactly once and returning to the start) if and only if:',
    ARRAY['Every vertex has an even degree', 'B', '1', 'even degree', 'even'],
    false, true,
    'Where shadows cast by the sun tell the exact hour of midday, stand beneath the courtyard sundial monument.',
    ARRAY['Consider the famous Seven Bridges of Königsberg problem solved by Leonhard Euler.'],
    5,
    ARRAY['The graph is a bipartite tree', 'Every vertex has an even degree', 'The graph contains an odd number of vertices', 'The chromatic number equals 2'],
    1,
    NULL,
    NULL,
    '[]'::jsonb,
    '{}'::jsonb
),
(
    'puz-7', 7, 'Photovoltaic Renewable Physics', 'IMAGE_QUIZ',
    'Examine the clean-energy diagram below. Which physical phenomenon describes the creation of voltage and electric current in semiconductor materials upon exposure to incident photons?',
    ARRAY['photovoltaic effect', 'the photovoltaic effect', 'photoelectric effect', 'photovoltaic'],
    false, true,
    'Where championship honors gleam behind glass, check the right wing foyer adjacent to the historic trophy cabinet.',
    ARRAY['It was first observed by French physicist Edmond Becquerel in 1839.'],
    5,
    '{}'::text[],
    NULL,
    '/assets/puzzles/solar_panel.svg',
    'Semiconductor P-N junction solar panel receiving incident photons',
    '[]'::jsonb,
    '{}'::jsonb
),
(
    'puz-8', 8, 'Polyalphabetic Vigenère Decryption', 'MCQ',
    'Decrypt the polyalphabetic ciphertext `KSVRR` encoded using the standard 26-letter Vigenère cipher with the secret keyword `ARENA`.',
    ARRAY['KUDOS', 'B', '1', 'kudos'],
    false, true,
    'Where athletes race against the clock on the oval track, scan from the upper gallery pavilion deck.',
    ARRAY['Plaintext = (Ciphertext - Key) mod 26. K - A = K, S - R = U, V - E = D, R - N = O, R - A = S.'],
    5,
    ARRAY['ATLAS', 'KUDOS', 'RADAR', 'CYBER'],
    1,
    NULL,
    NULL,
    '[]'::jsonb,
    '{}'::jsonb
),
(
    'puz-9', 9, 'The Monty Hall Probability Enigma', 'MCQ',
    'In the classic 3-door Monty Hall problem (1 prize, 2 goats), after you choose Door 1, the host opens Door 3 revealing a goat and offers you the chance to switch to Door 2.

What is your probability of winning if you switch?',
    ARRAY['2/3 (66.7% chance)', 'C', '2', '2/3', '0.667', '66.7%'],
    false, true,
    'Where twin monolithic towers connect under high arches, walk through the central covered arcade corridor.',
    ARRAY['Your initial choice had a 1/3 probability. The remaining 2/3 probability shifts entirely to Door 2.'],
    5,
    ARRAY['1/3 (33.3% chance)', '1/2 (50.0% chance)', '2/3 (66.7% chance)', '3/4 (75.0% chance)'],
    2,
    NULL,
    NULL,
    '[]'::jsonb,
    '{}'::jsonb
),
(
    'puz-10', 10, 'Championship Orienteering Finale Hub', 'IMAGE_MCQ',
    'Review the campus topological graph below. Which campus checkpoint serves as the central hub (#10) at the base of the clock tower where all finalists converge?',
    ARRAY['Station #10 - Administration Lawn (Clock Tower Base)', 'A', '0', '10', 'clock tower base'],
    false, true,
    'Where four monumental clock faces chimed every hour since 1928, reach the northern base of the historic stone tower.',
    ARRAY['Look at the green highlighted circular node labeled "10" at the central convergence point.'],
    5,
    ARRAY['Station #10 - Administration Lawn (Clock Tower Base)', 'Station #4 - Student Center (Quad Steps)', 'Station #1 - Main Library (Atrium)', 'Station #8 - Sports Complex (Pavilion Deck)'],
    0,
    '/assets/puzzles/campus_map.svg',
    'Campus topological orienteering map showing numbered stations with node 10 highlighted',
    '[]'::jsonb,
    '{}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
    title = CASE WHEN puzzles.puzzle_type IN ('CODE_BASED', 'THREE_PART_TEXT') THEN puzzles.title ELSE EXCLUDED.title END,
    puzzle_type = CASE WHEN puzzles.puzzle_type IN ('CODE_BASED', 'THREE_PART_TEXT') THEN puzzles.puzzle_type ELSE EXCLUDED.puzzle_type END,
    description_md = CASE WHEN puzzles.puzzle_type IN ('CODE_BASED', 'THREE_PART_TEXT') THEN puzzles.description_md ELSE EXCLUDED.description_md END,
    accepted_answers = CASE WHEN puzzles.puzzle_type IN ('CODE_BASED', 'THREE_PART_TEXT') THEN puzzles.accepted_answers ELSE EXCLUDED.accepted_answers END,
    case_sensitive = EXCLUDED.case_sensitive,
    normalize_whitespace = EXCLUDED.normalize_whitespace,
    riddle_text = EXCLUDED.riddle_text,
    hints = CASE WHEN puzzles.puzzle_type IN ('CODE_BASED', 'THREE_PART_TEXT') THEN puzzles.hints ELSE EXCLUDED.hints END,
    max_attempts = EXCLUDED.max_attempts,
    options = EXCLUDED.options,
    correct_option_index = EXCLUDED.correct_option_index,
    image_url = EXCLUDED.image_url,
    image_alt = EXCLUDED.image_alt,
    sample_cases = EXCLUDED.sample_cases,
    starter_code = EXCLUDED.starter_code;

-- Populate CODE_BASED and THREE_PART_TEXT challenge examples dynamically if columns exist (safe for 001/002 schemas & subsequent upgrades)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'puzzles' AND column_name = 'code_language'
    ) THEN
        EXECUTE $dyn$
            UPDATE puzzles
            SET puzzle_type = 'CODE_BASED',
                title = 'Cumulative Subarray Range Sum',
                description_md = 'Analyze the Python code below. When executed with range `left = 1` and `right = 4` (inclusive) on list `[3, 8, 2, 5, 12, 7]`, what exact integer value is printed?',
                accepted_answers = ARRAY['27'],
                hints = ARRAY['Compute the sum of elements at indices 1, 2, 3, and 4: 8 + 2 + 5 + 12.'],
                code_language = 'python',
                code_snippet = 'def range_sum(arr, left, right):
    return sum(arr[left:right + 1])

data = [3, 8, 2, 5, 12, 7]
print(range_sum(data, 1, 4))'
            WHERE id = 'puz-1';

            UPDATE puzzles
            SET puzzle_type = 'THREE_PART_TEXT',
                title = 'Computer Science Fundamentals Triad',
                description_md = 'Answer all three fundamental computer science questions below. Each sub-question is evaluated independently. Correct answers lock in green.',
                three_part_questions = '{"partA": "What fundamental data structure operates on a Last-In, First-Out (LIFO) order?", "partB": "What is the base-10 integer value of the binary byte 00101010?", "partC": "What cryptographic network protocol secures HTTP traffic across the Internet?"}'::jsonb,
                three_part_answers = '{"partA": ["stack", "call stack"], "partB": ["42"], "partC": ["https", "tls", "ssl"]}'::jsonb,
                hints = ARRAY['Part A: Utilized in recursion call frames.', 'Part B: Sum powers 32 + 8 + 2.', 'Part C: HTTPS standard security protocol.']
            WHERE id = 'puz-5';
        $dyn$;
    END IF;
END $$;

-- 4. EXACTLY 20 COMPETITION TEAMS (T01 - T20) WITH UNUSABLE INITIAL HASHES
-- Requires explicit admin_generate_team_credentials() invocation before login is permitted
INSERT INTO teams (team_code, team_name, passcode_hash, status, current_round, total_strikes, credentials_randomized, members) VALUES
('T01', 'Alpha Centauri', crypt(encode(gen_random_bytes(32), 'hex'), gen_salt('bf', 10)), 'ready', 1, 0, false, '[{"name": "Lead", "role": "Lead"}]'::jsonb),
('T02', 'Bravo Vanguards', crypt(encode(gen_random_bytes(32), 'hex'), gen_salt('bf', 10)), 'ready', 1, 0, false, '[{"name": "Lead", "role": "Lead"}]'::jsonb),
('T03', 'Charlie Cyphers', crypt(encode(gen_random_bytes(32), 'hex'), gen_salt('bf', 10)), 'ready', 1, 0, false, '[{"name": "Lead", "role": "Lead"}]'::jsonb),
('T04', 'Delta Drifters', crypt(encode(gen_random_bytes(32), 'hex'), gen_salt('bf', 10)), 'ready', 1, 0, false, '[{"name": "Lead", "role": "Lead"}]'::jsonb),
('T05', 'Echo Enigmas', crypt(encode(gen_random_bytes(32), 'hex'), gen_salt('bf', 10)), 'ready', 1, 0, false, '[{"name": "Lead", "role": "Lead"}]'::jsonb),
('T06', 'Foxtrot Falcons', crypt(encode(gen_random_bytes(32), 'hex'), gen_salt('bf', 10)), 'ready', 1, 0, false, '[{"name": "Lead", "role": "Lead"}]'::jsonb),
('T07', 'Golf Griffins', crypt(encode(gen_random_bytes(32), 'hex'), gen_salt('bf', 10)), 'ready', 1, 0, false, '[{"name": "Lead", "role": "Lead"}]'::jsonb),
('T08', 'Hotel Hawks', crypt(encode(gen_random_bytes(32), 'hex'), gen_salt('bf', 10)), 'ready', 1, 0, false, '[{"name": "Lead", "role": "Lead"}]'::jsonb),
('T09', 'India Igniters', crypt(encode(gen_random_bytes(32), 'hex'), gen_salt('bf', 10)), 'ready', 1, 0, false, '[{"name": "Lead", "role": "Lead"}]'::jsonb),
('T10', 'Juliet Juggernauts', crypt(encode(gen_random_bytes(32), 'hex'), gen_salt('bf', 10)), 'ready', 1, 0, false, '[{"name": "Lead", "role": "Lead"}]'::jsonb),
('T11', 'Kilo Krakens', crypt(encode(gen_random_bytes(32), 'hex'), gen_salt('bf', 10)), 'ready', 1, 0, false, '[{"name": "Lead", "role": "Lead"}]'::jsonb),
('T12', 'Lima Lancers', crypt(encode(gen_random_bytes(32), 'hex'), gen_salt('bf', 10)), 'ready', 1, 0, false, '[{"name": "Lead", "role": "Lead"}]'::jsonb),
('T13', 'Mike Mavericks', crypt(encode(gen_random_bytes(32), 'hex'), gen_salt('bf', 10)), 'ready', 1, 0, false, '[{"name": "Lead", "role": "Lead"}]'::jsonb),
('T14', 'November Navigators', crypt(encode(gen_random_bytes(32), 'hex'), gen_salt('bf', 10)), 'ready', 1, 0, false, '[{"name": "Lead", "role": "Lead"}]'::jsonb),
('T15', 'Oscar Oracles', crypt(encode(gen_random_bytes(32), 'hex'), gen_salt('bf', 10)), 'ready', 1, 0, false, '[{"name": "Lead", "role": "Lead"}]'::jsonb),
('T16', 'Papa Phantoms', crypt(encode(gen_random_bytes(32), 'hex'), gen_salt('bf', 10)), 'ready', 1, 0, false, '[{"name": "Lead", "role": "Lead"}]'::jsonb),
('T17', 'Quebec Quasars', crypt(encode(gen_random_bytes(32), 'hex'), gen_salt('bf', 10)), 'ready', 1, 0, false, '[{"name": "Lead", "role": "Lead"}]'::jsonb),
('T18', 'Romeo Rangers', crypt(encode(gen_random_bytes(32), 'hex'), gen_salt('bf', 10)), 'ready', 1, 0, false, '[{"name": "Lead", "role": "Lead"}]'::jsonb),
('T19', 'Sierra Spectres', crypt(encode(gen_random_bytes(32), 'hex'), gen_salt('bf', 10)), 'ready', 1, 0, false, '[{"name": "Lead", "role": "Lead"}]'::jsonb),
('T20', 'Tango Titans', crypt(encode(gen_random_bytes(32), 'hex'), gen_salt('bf', 10)), 'ready', 1, 0, false, '[{"name": "Lead", "role": "Lead"}]'::jsonb)
ON CONFLICT (team_code) DO UPDATE SET
    team_name = EXCLUDED.team_name,
    passcode_hash = CASE WHEN teams.credentials_randomized THEN teams.passcode_hash ELSE EXCLUDED.passcode_hash END,
    status = CASE WHEN teams.status IN ('active', 'completed', 'eliminated') THEN teams.status ELSE EXCLUDED.status END,
    current_round = CASE WHEN teams.current_round > 1 THEN teams.current_round ELSE EXCLUDED.current_round END,
    total_strikes = CASE WHEN teams.total_strikes > 0 THEN teams.total_strikes ELSE EXCLUDED.total_strikes END;

-- 5. BALANCED 20-TEAM LATIN SQUARE ROUTE ALLOCATION
DO $$
DECLARE
    v_team_record RECORD;
    v_t_idx INT := 0;
    v_round INT;
    v_loc_id INT;
    v_routes_locked BOOLEAN;
BEGIN
    SELECT COALESCE(routes_locked, false) INTO v_routes_locked FROM event_settings WHERE id = 1;

    IF NOT v_routes_locked OR (SELECT COUNT(*) FROM team_routes) = 0 THEN
        DELETE FROM team_routes;

        FOR v_team_record IN SELECT id FROM teams ORDER BY team_code LOOP
            FOR v_round IN 1..10 LOOP
                IF v_t_idx < 10 THEN
                    v_loc_id := ((v_t_idx + (v_round - 1)) % 10) + 1;
                ELSE
                    v_loc_id := (((v_t_idx - 10) + (v_round - 1) + 5) % 10) + 1;
                END IF;

                INSERT INTO team_routes (team_id, round_number, location_id)
                VALUES (v_team_record.id, v_round, v_loc_id);
            END LOOP;
            v_t_idx := v_t_idx + 1;
        END LOOP;
    END IF;
END $$;

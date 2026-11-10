-- ==============================================================================
-- MIND MAZE 2.0 — HARDENED SEED DATA INITIALIZATION
-- Pre-populates Event Settings, 25 Teams (with bcrypt hashes), 10 Locations, 10 Puzzles
-- ==============================================================================

-- 1. GLOBAL EVENT SETTINGS
INSERT INTO event_settings (
    id,
    event_name,
    status,
    total_teams,
    active_locations_count,
    round_duration_seconds,
    grace_period_seconds,
    starting_qr_token,
    final_qr_token,
    allow_registration,
    routes_locked,
    qr_tokens_regenerated
) VALUES (
    1,
    'MIND MAZE 2.0 Championship',
    'ready',
    25,
    10,
    300,
    30,
    'MM2-START-SEMINAR-2026',
    'MM2-FINISH-SEMINAR-2026',
    true,
    true,
    false
) ON CONFLICT (id) DO UPDATE SET
    event_name = EXCLUDED.event_name,
    status = EXCLUDED.status,
    total_teams = EXCLUDED.total_teams,
    active_locations_count = EXCLUDED.active_locations_count,
    round_duration_seconds = EXCLUDED.round_duration_seconds,
    grace_period_seconds = EXCLUDED.grace_period_seconds,
    starting_qr_token = EXCLUDED.starting_qr_token,
    final_qr_token = EXCLUDED.final_qr_token,
    routes_locked = EXCLUDED.routes_locked;

-- 2. MASTER CAMPUS CHECKPOINT LOCATIONS (1 to 10)
INSERT INTO locations (id, location_number, name, description, riddle_clue, capacity, active, qr_token) VALUES
(1, 1, 'Main Library - Atrium', 
 'Ground floor entrance near digital catalog kiosk', 
 'Where silent knowledge sleeps in thousands of bound pages, seek the digital kiosk on the ground floor atrium.', 
 3, true, '8492019481'),

(2, 2, 'Computer Science Building - Hallway A', 
 'First floor beside Robotics Laboratory', 
 'Where silicon brains learn to walk and robotic arms hum, seek Hallway A on the first floor beside the Robotics Lab.', 
 3, true, '7201948293'),

(3, 3, 'Engineering Block - West Entrance', 
 'Beside the solar cell showcase display', 
 'Where clean energy catches the sky, look beside the solar cell showcase display near the west entrance.', 
 3, true, '9182736452'),

(4, 4, 'Student Center - Quad Steps', 
 'Exterior pillar facing the amphitheater', 
 'Where voices gather on stone tiers, find the exterior pillar facing the outdoor amphitheater steps.', 
 3, true, '6392018475'),

(5, 5, 'Innovation Hub - 3rd Floor Mezzanine', 
 'Beside the 3D printing workshop glass wall', 
 'Where filament becomes structure layer by layer, search the glass walls of the 3D printing workshop on the 3rd floor mezzanine.', 
 3, true, '4820193847'),

(6, 6, 'Science Complex - South Courtyard', 
 'Underneath the sundial monument', 
 'Where shadows cast by the sun tell the exact hour of midday, stand beneath the courtyard sundial monument.', 
 3, true, '5920184729'),

(7, 7, 'Auditorium - Foyer South', 
 'Right wing lobby adjacent to the trophy cabinet', 
 'Where championship honors gleam behind glass, check the right wing foyer adjacent to the historic trophy cabinet.', 
 3, true, '3820194821'),

(8, 8, 'Sports Complex - Pavilion Deck', 
 'Upper gallery overlooking the athletic track', 
 'Where athletes race against the clock on the oval track, scan from the upper gallery pavilion deck.', 
 3, true, '8192038475'),

(9, 9, 'Academic Tower - Central Arcade', 
 'Archway between Tower 1 and Tower 2', 
 'Where twin monolithic towers connect under high arches, walk through the central covered arcade corridor.', 
 3, true, '2938472019'),

(10, 10, 'Administration Lawn - Clock Tower Base', 
 'North face of the historic clock tower', 
 'Where four monumental clock faces chimed every hour since 1928, reach the northern base of the historic stone tower.', 
 3, true, '1928374650')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    riddle_clue = EXCLUDED.riddle_clue,
    capacity = EXCLUDED.capacity,
    active = EXCLUDED.active,
    qr_token = EXCLUDED.qr_token;

-- 3. MASTER PUZZLES (1 to 10)
INSERT INTO puzzles (
    id, round_number, title, puzzle_type, description_md,
    accepted_answers, case_sensitive, normalize_whitespace,
    riddle_text, hints, max_attempts, sample_cases, starter_code
) VALUES
(
    'puz-1', 1, 'Array Anomaly Scanner', 'coding',
    'Given an array of integers `nums`, find the single element that appears exactly once where every other element appears twice.

### Sample Input
`nums = [4, 1, 2, 1, 2]`

### Question
What is the exact value of the unique anomaly element in the sample array?',
    ARRAY['4', 'xor', 'ans^=n', 'bit_xor'],
    false, true,
    'Where silent knowledge sleeps in thousands of bound pages, seek the digital kiosk on the ground floor atrium.',
    ARRAY['Consider bitwise XOR (^). Any number XORed with itself is zero (A ^ A = 0), and 0 ^ A = A.'],
    5,
    '[{"input": "4 1 2 1 2", "expectedOutput": "4", "explanation": "4 is unique, while 1 and 2 appear twice"}]'::jsonb,
    '{"python": "# Python 3\\ndef solve(nums):\\n    ans = 0\\n    for n in nums: ans ^= n\\n    return ans"}'::jsonb
),
(
    'puz-2', 2, 'The Enigma of Caesar + 7', 'crypto',
    'An intercepted operational dispatch on the campus radio is encrypted with Caesar shift key 7:

`OLSSV DVYSK`

Decrypt the ciphertext to recover the plaintext authentication passphrase.',
    ARRAY['hello world', 'helloworld'],
    false, true,
    'Where silicon brains learn to walk and robotic arms hum, seek Hallway A on the first floor beside the Robotics Lab.',
    ARRAY['Shift each letter backward by 7 positions in the alphabet: O - 7 = H, L - 7 = E, S - 7 = L...'],
    5,
    '[{"input": "OLSSV DVYSK", "expectedOutput": "HELLO WORLD", "explanation": "Caesar shift -7"}]'::jsonb,
    '{}'::jsonb
),
(
    'puz-3', 3, 'Recursive Fibonacci Modulo', 'logic',
    'A campus router transmits packets according to the standard Fibonacci sequence:
$$F(0) = 0,\quad F(1) = 1,\quad F(n) = F(n-1) + F(n-2)$$

What is the exact value of $F(10) \pmod{10}$?',
    ARRAY['5', '5.0', '55 mod 10 = 5', 'f(10) = 55'],
    false, true,
    'Where clean energy catches the sky, look beside the solar cell showcase display near the west entrance.',
    ARRAY['Compute sequence: 0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55. What is 55 modulo 10?'],
    5,
    '[]'::jsonb,
    '{}'::jsonb
),
(
    'puz-4', 4, 'Historical Computing Pioneer', 'text',
    'In 1936, which British mathematician and logician introduced the universal computing machine model and subsequently decrypted Naval Enigma signals at Bletchley Park?

Enter the scientist''s surname.',
    ARRAY['turing', 'alan turing', 'alan mathison turing'],
    false, true,
    'Where voices gather on stone tiers, find the exterior pillar facing the outdoor amphitheater steps.',
    ARRAY['Namesake of the prestigious ACM award often referred to as the Nobel Prize of Computing.'],
    5,
    '[]'::jsonb,
    '{}'::jsonb
),
(
    'puz-5', 5, 'Hexadecimal ASCII Memory Stream', 'crypto',
    'A sensor beacon transmitted this hexadecimal byte array:
`54 72 65 61 73 75 72 65`

Convert the hexadecimal ASCII bytes into human-readable text.',
    ARRAY['treasure', 'Treasure'],
    false, true,
    'Where filament becomes structure layer by layer, search the glass walls of the 3D printing workshop on the 3rd floor mezzanine.',
    ARRAY['0x54 = 84 = "T", 0x72 = 114 = "r", 0x65 = 101 = "e"...'],
    5,
    '[{"input": "54 72 65 61 73 75 72 65", "expectedOutput": "Treasure", "explanation": "Hex ASCII decoding"}]'::jsonb,
    '{}'::jsonb
),
(
    'puz-6', 6, 'Knights, Knaves, and the Fork in the Trail', 'logic',
    'Two guards stand at a fork in the trail. One always tells the truth; the other always lies.

To find the correct checkpoint, you ask: *"Which road would the other guard say is the right one?"*

If the guard answers "Left", which road must you take? (Enter "Left" or "Right")',
    ARRAY['right', 'take right', 'the right road', 'right path'],
    false, true,
    'Where shadows cast by the sun tell the exact hour of midday, stand beneath the courtyard sundial monument.',
    ARRAY['Both the truth-teller and the liar will point you to the incorrect road! Therefore, choose the opposite.'],
    5,
    '[]'::jsonb,
    '{}'::jsonb
),
(
    'puz-7', 7, 'Historic Campus Monument Architecture', 'text',
    'The campus centerpiece was constructed in 1928 with a monumental four-faced timekeeping structure overlooking the Administration Lawn.

What is the two-word architectural term for this central historical tower?',
    ARRAY['clock tower', 'the clock tower', 'clocktower'],
    false, true,
    'Where championship honors gleam behind glass, check the right wing foyer adjacent to the historic trophy cabinet.',
    ARRAY['It chimes at every hour overlooking the Administration Lawn at Location #10.'],
    5,
    '[]'::jsonb,
    '{}'::jsonb
),
(
    'puz-8', 8, 'Polyalphabetic Vigenère Decryption', 'crypto',
    'Decrypt the polyalphabetic ciphertext `KSVRR` encoded using the standard 26-letter Vigenère cipher with the secret keyword `ARENA`.',
    ARRAY['kudos', 'KUDOS'],
    false, true,
    'Where athletes race against the clock on the oval track, scan from the upper gallery pavilion deck.',
    ARRAY['Plaintext = (Ciphertext - Key) mod 26. K - A = K, S - R = U, V - E = D, R - N = O, R - A = S.'],
    5,
    '[{"input": "Ciphertext: KSVRR, Key: ARENA", "expectedOutput": "KUDOS", "explanation": "Vigenere shift subtraction"}]'::jsonb,
    '{}'::jsonb
),
(
    'puz-9', 9, 'The Monty Hall Probability Enigma', 'logic',
    'In the classic 3-door Monty Hall problem (1 prize, 2 goats), after you choose Door 1, the host opens Door 3 revealing a goat and offers you the chance to switch to Door 2.

What is your probability of winning if you switch? Express your answer as a simplified fraction (e.g. `2/3`).',
    ARRAY['2/3', '2 / 3', '0.667', '0.67', '66.7%'],
    false, true,
    'Where twin monolithic towers connect under high arches, walk through the central covered arcade corridor.',
    ARRAY['Your initial door has a 1/3 chance of winning. Switching gives you the remaining 2/3 probability!'],
    5,
    '[]'::jsonb,
    '{}'::jsonb
),
(
    'puz-10', 10, 'Championship Target Checkpoint Pair', 'coding',
    'Given an array of integers `nums = [2, 7, 11, 15]` and an integer `target = 9`, return the space-separated 0-indexed positions of the two numbers that add up to `target`.',
    ARRAY['0 1', '1 0', '0, 1', '[0, 1]', '0,1'],
    false, true,
    'Where four monumental clock faces chimed every hour since 1928, reach the northern base of the historic stone tower.',
    ARRAY['Use a hash map to look up complements in linear O(N) time: 9 - 2 = 7.'],
    5,
    '[{"input": "2 7 11 15\\n9", "expectedOutput": "0 1", "explanation": "nums[0] + nums[1] = 2 + 7 = 9"}]'::jsonb,
    '{"python": "# Python 3\\ndef two_sum(nums, target):\\n    lookup = {}\\n    for i, n in enumerate(nums):\\n        diff = target - n\\n        if diff in lookup: return [lookup[diff], i]\\n        lookup[n] = i\\n    return []"}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    puzzle_type = EXCLUDED.puzzle_type,
    description_md = EXCLUDED.description_md,
    accepted_answers = EXCLUDED.accepted_answers,
    case_sensitive = EXCLUDED.case_sensitive,
    normalize_whitespace = EXCLUDED.normalize_whitespace,
    riddle_text = EXCLUDED.riddle_text,
    hints = EXCLUDED.hints,
    sample_cases = EXCLUDED.sample_cases,
    starter_code = EXCLUDED.starter_code;

-- 4. 25 REGISTERED COMPETITION TEAMS (Bcrypt Passcode Hashes, Default Locked)
INSERT INTO teams (team_code, team_name, passcode_hash, status, current_round, total_strikes, credentials_randomized, members) VALUES
('T01', 'Alpha Centauri', crypt('Maze2026!T01', gen_salt('bf', 10)), 'ready', 1, 0, false, '[{"name": "Participant 1", "role": "Lead"}, {"name": "Participant 2", "role": "Coder"}, {"name": "Participant 3", "role": "Navigator"}, {"name": "Participant 4", "role": "Strategist"}]'::jsonb),
('T02', 'Bravo Vanguards', crypt('Maze2026!T02', gen_salt('bf', 10)), 'ready', 1, 0, false, '[{"name": "Participant 1", "role": "Lead"}, {"name": "Participant 2", "role": "Coder"}, {"name": "Participant 3", "role": "Navigator"}, {"name": "Participant 4", "role": "Strategist"}]'::jsonb),
('T03', 'Charlie Cyphers', crypt('Maze2026!T03', gen_salt('bf', 10)), 'ready', 1, 0, false, '[{"name": "Participant 1", "role": "Lead"}, {"name": "Participant 2", "role": "Coder"}, {"name": "Participant 3", "role": "Navigator"}, {"name": "Participant 4", "role": "Strategist"}]'::jsonb),
('T04', 'Delta Drifters', crypt('Maze2026!T04', gen_salt('bf', 10)), 'ready', 1, 0, false, '[{"name": "Participant 1", "role": "Lead"}, {"name": "Participant 2", "role": "Coder"}, {"name": "Participant 3", "role": "Navigator"}, {"name": "Participant 4", "role": "Strategist"}]'::jsonb),
('T05', 'Echo Enigmas', crypt('Maze2026!T05', gen_salt('bf', 10)), 'ready', 1, 0, false, '[{"name": "Participant 1", "role": "Lead"}, {"name": "Participant 2", "role": "Coder"}, {"name": "Participant 3", "role": "Navigator"}, {"name": "Participant 4", "role": "Strategist"}]'::jsonb),
('T06', 'Foxtrot Falcons', crypt('Maze2026!T06', gen_salt('bf', 10)), 'ready', 1, 0, false, '[{"name": "Participant 1", "role": "Lead"}, {"name": "Participant 2", "role": "Coder"}, {"name": "Participant 3", "role": "Navigator"}, {"name": "Participant 4", "role": "Strategist"}]'::jsonb),
('T07', 'Golf Griffins', crypt('Maze2026!T07', gen_salt('bf', 10)), 'ready', 1, 0, false, '[{"name": "Participant 1", "role": "Lead"}, {"name": "Participant 2", "role": "Coder"}, {"name": "Participant 3", "role": "Navigator"}, {"name": "Participant 4", "role": "Strategist"}]'::jsonb),
('T08', 'Hotel Hawks', crypt('Maze2026!T08', gen_salt('bf', 10)), 'ready', 1, 0, false, '[{"name": "Participant 1", "role": "Lead"}, {"name": "Participant 2", "role": "Coder"}, {"name": "Participant 3", "role": "Navigator"}, {"name": "Participant 4", "role": "Strategist"}]'::jsonb),
('T09', 'India Igniters', crypt('Maze2026!T09', gen_salt('bf', 10)), 'ready', 1, 0, false, '[{"name": "Participant 1", "role": "Lead"}, {"name": "Participant 2", "role": "Coder"}, {"name": "Participant 3", "role": "Navigator"}, {"name": "Participant 4", "role": "Strategist"}]'::jsonb),
('T10', 'Juliet Juggernauts', crypt('Maze2026!T10', gen_salt('bf', 10)), 'ready', 1, 0, false, '[{"name": "Participant 1", "role": "Lead"}, {"name": "Participant 2", "role": "Coder"}, {"name": "Participant 3", "role": "Navigator"}, {"name": "Participant 4", "role": "Strategist"}]'::jsonb),
('T11', 'Kilo Krakens', crypt('Maze2026!T11', gen_salt('bf', 10)), 'ready', 1, 0, false, '[{"name": "Participant 1", "role": "Lead"}, {"name": "Participant 2", "role": "Coder"}, {"name": "Participant 3", "role": "Navigator"}, {"name": "Participant 4", "role": "Strategist"}]'::jsonb),
('T12', 'Lima Lancers', crypt('Maze2026!T12', gen_salt('bf', 10)), 'ready', 1, 0, false, '[{"name": "Participant 1", "role": "Lead"}, {"name": "Participant 2", "role": "Coder"}, {"name": "Participant 3", "role": "Navigator"}, {"name": "Participant 4", "role": "Strategist"}]'::jsonb),
('T13', 'Mike Mavericks', crypt('Maze2026!T13', gen_salt('bf', 10)), 'ready', 1, 0, false, '[{"name": "Participant 1", "role": "Lead"}, {"name": "Participant 2", "role": "Coder"}, {"name": "Participant 3", "role": "Navigator"}, {"name": "Participant 4", "role": "Strategist"}]'::jsonb),
('T14', 'November Navigators', crypt('Maze2026!T14', gen_salt('bf', 10)), 'ready', 1, 0, false, '[{"name": "Participant 1", "role": "Lead"}, {"name": "Participant 2", "role": "Coder"}, {"name": "Participant 3", "role": "Navigator"}, {"name": "Participant 4", "role": "Strategist"}]'::jsonb),
('T15', 'Oscar Oracles', crypt('Maze2026!T15', gen_salt('bf', 10)), 'ready', 1, 0, false, '[{"name": "Participant 1", "role": "Lead"}, {"name": "Participant 2", "role": "Coder"}, {"name": "Participant 3", "role": "Navigator"}, {"name": "Participant 4", "role": "Strategist"}]'::jsonb),
('T16', 'Papa Phantoms', crypt('Maze2026!T16', gen_salt('bf', 10)), 'ready', 1, 0, false, '[{"name": "Participant 1", "role": "Lead"}, {"name": "Participant 2", "role": "Coder"}, {"name": "Participant 3", "role": "Navigator"}, {"name": "Participant 4", "role": "Strategist"}]'::jsonb),
('T17', 'Quebec Quasars', crypt('Maze2026!T17', gen_salt('bf', 10)), 'ready', 1, 0, false, '[{"name": "Participant 1", "role": "Lead"}, {"name": "Participant 2", "role": "Coder"}, {"name": "Participant 3", "role": "Navigator"}, {"name": "Participant 4", "role": "Strategist"}]'::jsonb),
('T18', 'Romeo Rangers', crypt('Maze2026!T18', gen_salt('bf', 10)), 'ready', 1, 0, false, '[{"name": "Participant 1", "role": "Lead"}, {"name": "Participant 2", "role": "Coder"}, {"name": "Participant 3", "role": "Navigator"}, {"name": "Participant 4", "role": "Strategist"}]'::jsonb),
('T19', 'Sierra Spectres', crypt('Maze2026!T19', gen_salt('bf', 10)), 'ready', 1, 0, false, '[{"name": "Participant 1", "role": "Lead"}, {"name": "Participant 2", "role": "Coder"}, {"name": "Participant 3", "role": "Navigator"}, {"name": "Participant 4", "role": "Strategist"}]'::jsonb),
('T20', 'Tango Titans', crypt('Maze2026!T20', gen_salt('bf', 10)), 'ready', 1, 0, false, '[{"name": "Participant 1", "role": "Lead"}, {"name": "Participant 2", "role": "Coder"}, {"name": "Participant 3", "role": "Navigator"}, {"name": "Participant 4", "role": "Strategist"}]'::jsonb),
('T21', 'Uniform Umbras', crypt('Maze2026!T21', gen_salt('bf', 10)), 'ready', 1, 0, false, '[{"name": "Participant 1", "role": "Lead"}, {"name": "Participant 2", "role": "Coder"}, {"name": "Participant 3", "role": "Navigator"}, {"name": "Participant 4", "role": "Strategist"}]'::jsonb),
('T22', 'Victor Voyagers', crypt('Maze2026!T22', gen_salt('bf', 10)), 'ready', 1, 0, false, '[{"name": "Participant 1", "role": "Lead"}, {"name": "Participant 2", "role": "Coder"}, {"name": "Participant 3", "role": "Navigator"}, {"name": "Participant 4", "role": "Strategist"}]'::jsonb),
('T23', 'Whiskey Wizards', crypt('Maze2026!T23', gen_salt('bf', 10)), 'ready', 1, 0, false, '[{"name": "Participant 1", "role": "Lead"}, {"name": "Participant 2", "role": "Coder"}, {"name": "Participant 3", "role": "Navigator"}, {"name": "Participant 4", "role": "Strategist"}]'::jsonb),
('T24', 'X-Ray Xebecs', crypt('Maze2026!T24', gen_salt('bf', 10)), 'ready', 1, 0, false, '[{"name": "Participant 1", "role": "Lead"}, {"name": "Participant 2", "role": "Coder"}, {"name": "Participant 3", "role": "Navigator"}, {"name": "Participant 4", "role": "Strategist"}]'::jsonb),
('T25', 'Yankee Yetis', crypt('Maze2026!T25', gen_salt('bf', 10)), 'ready', 1, 0, false, '[{"name": "Participant 1", "role": "Lead"}, {"name": "Participant 2", "role": "Coder"}, {"name": "Participant 3", "role": "Navigator"}, {"name": "Participant 4", "role": "Strategist"}]'::jsonb)
ON CONFLICT (team_code) DO UPDATE SET
    team_name = EXCLUDED.team_name,
    passcode_hash = EXCLUDED.passcode_hash,
    members = EXCLUDED.members;

-- 5. BALANCED LATIN SQUARE ROUTE ALLOCATION
-- Pre-generates the complete 25-team x 10-round route matrix (Zero Station Collisions)
DO $$
DECLARE
    v_team_record RECORD;
    v_t_idx INT := 0;
    v_round INT;
    v_loc_id INT;
BEGIN
    DELETE FROM team_routes;

    FOR v_team_record IN SELECT id FROM teams ORDER BY team_code LOOP
        FOR v_round IN 1..10 LOOP
            -- Formula: (team_index + (round_number - 1)) mod 10 + 1
            v_loc_id := ((v_t_idx + (v_round - 1)) % 10) + 1;

            INSERT INTO team_routes (team_id, round_number, location_id)
            VALUES (v_team_record.id, v_round, v_loc_id);
        END LOOP;
        v_t_idx := v_t_idx + 1;
    END LOOP;
END $$;

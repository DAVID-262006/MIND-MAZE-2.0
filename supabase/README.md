# MIND MAZE 2.0 — SUPABASE DATABASE SETUP & SECURITY MANUAL

## 1. Supabase Project Information

* **Project Name**: `MIND MAZE 2.0`
* **Project URL**: `https://yersiudondrbdlerowth.supabase.co`
* **Region**: `ap-south-1` (Mumbai, India)
* **Publishable API Key**: `sb_publishable_KMPaBMpFnETgBpWyMip0cA_onMXC9SI`

---

## 2. Execution Order in Supabase SQL Editor

Follow these exact steps in your browser:

1. Open your Supabase Project Dashboard:
   `https://supabase.com/dashboard/project/yersiudondrbdlerowth`
2. Navigate to **SQL Editor** in the left sidebar.
3. Click **New query**.
4. Open [supabase/schema.sql](file:///C:/Users/S.DAVID/OneDrive/Desktop/DAVID/supabase/schema.sql), copy its entire content, paste it into the SQL Editor, and click **Run**.
5. Once `schema.sql` completes with `Success`, create another new query tab.
6. Open [supabase/seed.sql](file:///C:/Users/S.DAVID/OneDrive/Desktop/DAVID/supabase/seed.sql), copy its entire content, paste it into the SQL Editor, and click **Run**.

---

## 3. Initial Administrator Account Setup

To enable administrative access to the Admin Dashboard:

1. In the Supabase Dashboard, click **Authentication** -> **Users** -> **Add user** -> **Create user**.
2. Provide:
   * **Email**: e.g., `admin@mindmaze.arena`
   * **Password**: Create a secure administrative password
   * **Auto Confirm User**: Checked (Enabled)
3. Copy the generated `User UID` from the user table.
4. Run this query in the SQL Editor to link the profile:

```sql
INSERT INTO admin_profiles (id, email, full_name, role)
VALUES (
    '<PASTE_USER_UID_HERE>',
    'admin@mindmaze.arena',
    'Lead Administrator',
    'superadmin'
) ON CONFLICT (id) DO UPDATE SET role = 'superadmin';
```

---

## 4. Hardened Security & Zero-Trust Defense Model

1. **Bcrypt Password Storage**:
   * Team passcodes are salted and hashed using `crypt(..., gen_salt('bf', 10))`. Plaintext passcodes are never stored.
2. **SHA-256 Session Token Enclave**:
   * The database stores only the SHA-256 hash (`active_session_token_hash`) of issued session tokens. Even a database snapshot cannot be used to hijack active team sessions.
3. **Anti-DoS Throttling & Lockout Defense**:
   * 10 consecutive failed attempts triggers a 60-second cooldown (`locked_until`). Active sessions are immune to login endpoint hammering.
4. **Zero Client Trust RLS Policies**:
   * Base tables `teams`, `event_settings`, `locations`, `puzzles`, and `team_routes` deny all direct `SELECT` queries to anonymous users.
   * Public data is strictly served via sanitized views (`public_leaderboard`, `public_event_status`) or `SECURITY DEFINER` RPC functions with `SET search_path = public, extensions, pg_temp;`.
5. **State & Deadline Enforcement**:
   * `submit_puzzle_answer` and `verify_location_qr` strictly require `event_settings.status = 'live'` and enforce round grace deadlines (`NOW() <= grace_deadline_at`).
   * Attempt limits (`max_attempts`) are strictly guarded.
6. **QR Anti-Spam Throttling**:
   * More than 5 invalid checkpoint scans within 60 seconds triggers a 1-minute scanning cooldown.

---

## 5. Verification & Testing Test Suite

Execute these test queries in your Supabase SQL Editor to verify every security boundary:

### Test 1: Verify Direct Table Access is Blocked
```sql
-- Simulate an anonymous participant query:
SET ROLE anon;

-- Expectation: ALL return 0 rows (direct access blocked by RLS)
SELECT * FROM teams;
SELECT * FROM event_settings;
SELECT * FROM puzzles;
SELECT * FROM locations;
SELECT * FROM team_routes;

-- Safe views DO work:
SELECT * FROM public_leaderboard;
SELECT * FROM public_event_status;

-- Reset role
RESET ROLE;
```

### Test 2: Test Team Authentication & Session Token Issuance
```sql
SELECT login_team('T01', 'Maze2026!T01', 'browser-device-test-01');
```
*Expected Output*: Returns JSON containing `success: true`, `team_id`, and raw `session_token`. Notice `teams` table only stores the SHA-256 hash of this token.

### Test 3: Test Starting Journey when Event is NOT Live
```sql
-- Update status to ready (if live):
UPDATE event_settings SET status = 'ready' WHERE id = 1;

-- Attempt starting QR:
SELECT start_team_journey(
    '<TEAM_ID>'::uuid,
    '<SESSION_TOKEN>',
    'MM2-START-SEMINAR-2026'
);
-- Expected Output: Rejects with "The competition is not currently live"
```

### Test 4: Test Valid Start, Answering & Checkpoint Verification
```sql
-- Set event live:
UPDATE event_settings SET status = 'live' WHERE id = 1;

-- 4a. Start Journey:
SELECT start_team_journey('<TEAM_ID>'::uuid, '<SESSION_TOKEN>', 'MM2-START-SEMINAR-2026');

-- 4b. Submit Answer:
SELECT submit_puzzle_answer('<TEAM_ID>'::uuid, '<SESSION_TOKEN>', '4');

-- 4c. Scan Checkpoint:
SELECT verify_location_qr('<TEAM_ID>'::uuid, '<SESSION_TOKEN>', '8492019481');
```

---

## 6. Pre-Match Day Master Setup Sequence

Before the official event begins, perform these two one-click security updates directly in the Supabase SQL Editor:

### Step A: Randomize All Team Passcodes & Print Badges
```sql
-- Generates unique 8-character cryptographic passcodes for all 25 teams (e.g. MM2-A7F9B2C4),
-- unlocks login for participants, and returns credentials directly in query output for printing:
SELECT bootstrap_randomize_team_credentials();
```
*(Note: These passcodes are NOT recorded in logs or public tables; they are only returned to the administrator running the query. Until this is run, default passwords are locked and cannot be used).*

### Step B: Regenerate All Event QR Tokens & Print Placards
```sql
-- Generates fresh, random, collision-free 10-digit codes for all 10 locations,
-- plus new seminar hall starting and final tokens:
SELECT bootstrap_regenerate_event_qr_tokens();
```
*(Organizers can print the placards immediately for campus posting. Until this is run, staging QR codes will be rejected).*



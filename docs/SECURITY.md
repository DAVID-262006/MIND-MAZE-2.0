# SECURITY ARCHITECTURE & THREAT MODEL — TREASURE HUNT ARENA

## 1. Threat Modeling & Attack Surfaces

The Treasure Hunt Arena handles physical orienteering, live competition rankings, and arbitrary code compilation. The threat model accounts for five distinct adversary classes:
1. **Colluding Participants**: Teams attempting to share QR codes or pre-scan physical checkpoints remotely.
2. **Reverse Engineers**: Participants inspecting client JavaScript, network payloads, or WebSocket frames to extract puzzle solutions, future route schedules, or raw QR hashes.
3. **Multi-Device / Session Hijackers**: Teams logging into multiple devices simultaneously to divide coding and physical running labor.
4. **Malicious Code Submissions**: Participants attempting privilege escalation, container escapes, fork bombs, network scans, or infinite loops inside the coding sandbox.
5. **Denial of Service (DoS)**: Submitting rapid floods of API requests or spamming telemetry endpoints to degrade system response times for competitors.

---

## 2. QR Checkpoint Security Architecture

### 2.1 Cryptographic Storage of QR Tokens
- Physical checkpoints display a 10-digit randomly generated numeric string (entropy: $10^{10} \approx 33.2$ bits of space per round, with short 5-minute active windows).
- The raw 10-digit value is **never stored** in the database and **never transmitted** in any API response or frontend bundle.
- The database stores:
  $$\text{QR\_Hash} = \text{HMAC-SHA256}(\text{RawToken}, \text{SecretSalt})$$
- When a player scans the QR code with their device camera:
  1. The client sends the scanned numeric string over TLS directly to `/api/v1/arena/checkpoint/scan`.
  2. The server computes $\text{HMAC-SHA256}(\text{ReceivedToken}, \text{SecretSalt})$ in constant-time.
  3. The resulting hash is looked up against the database and compared with the team's expected location for their current round.

### 2.2 Replay & Remote-Sharing Mitigation
- If Team A scans Checkpoint 4 and tries to message the 10-digit number to Team B:
  - If Team B is on a different round or assigned to a different location, the submission fails with a `LOCATION_MISMATCH` rejection and logs an audit record.
  - If Team B happens to be assigned to Checkpoint 4 at that exact moment: to mitigate manual proxy-scanning, checkpoints can require physical proximity verification or fast single-shot scan timeouts.

---

## 3. Single-Device Session Enforcement

The competition rule mandates: **One device per team, one login per team.**

### 3.1 Session Binding Mechanism
1. Upon successful team login at `/api/v1/auth/team/login`:
   - The server generates a cryptographically random `session_token` (UUIDv4) and stores it in the `teams.active_session_token` column.
   - A signed JWT containing `{ team_id, session_token, role: 'team' }` is returned to the client.
2. Every subsequent API request and WebSocket connection validates that `jwt.session_token == teams.active_session_token`.
3. If a team attempts to log in on a second device:
   - The login attempt is blocked (`409 Conflict: DUPLICATE_SESSION_DETECTED`), OR
   - If an admin authorizes a hardware swap, the old `session_token` is invalidated, instantly severing the previous device's WebSocket connection and rejecting all subsequent API requests.

---

## 4. Judge0 Code Sandbox Isolation

Executing user-supplied C, C++, Python, and Java code carries inherent security risks. We enforce strict containment:

```
[User Source Code] ──► [App Server Validation] ──► [Judge0 API with TLS & Auth Token]
                                                              │
                                                              ▼
                                                   [Isolated Docker Worker]
                                                   ├── Non-root user (nobody/judge)
                                                   ├── Read-only root filesystem
                                                   ├── /tmp mounted with noexec
                                                   ├── Network stack disabled (--net=none)
                                                   ├── Memory limit: 128 MB (cgroups)
                                                   ├── CPU quota: 2.0s limit (cgroups)
                                                   ├── Process limit (pids_limit: 30)
                                                   └── System call filters (seccomp)
```

1. **Compilation Guardrails**:
   - Compiler memory capped at 256 MB.
   - Max compilation time: 10 seconds.
2. **Execution Restrictions**:
   - Time limit: 2000 ms.
   - Memory limit: 128 MB.
   - Max output size: 64 KB (prevents stdout memory flooding).
   - Syscall restrictions: Prevent fork bombs (`fork()`), raw socket manipulation, file writes outside ephemeral temp space.
3. **Hidden Test Suite Secrecy**:
   - Test cases flagged with `is_sample = false` are never exposed through any player-facing API.
   - The server fetches hidden test cases directly from PostgreSQL, dispatches them to Judge0, compares outputs server-side, and only returns boolean pass/fail counts to the player.

---

## 5. Anti-Cheat & Browser Integrity Monitoring

### 5.1 Monitored Client Events
- **Document Visibility**: `document.addEventListener('visibilitychange')`.
- **Window Blur**: `window.addEventListener('blur')`.
- **Fullscreen Enforcement**: `document.addEventListener('fullscreenchange')`.
- **DevTools Open Detection**: Resize thresholds and debug breakpoint traps.

### 5.2 Server-Side Integrity & Rate Limiting
- **Debounced Reporting**: Anti-cheat events are timestamped and signed. The server debounces identical signals received within 3000ms.
- **Rate Limiting**:
  - Code runs: Max 1 submission per 5 seconds per team.
  - QR scans: Max 1 scan submission per 3 seconds per team (prevents brute-force guessing of 10-digit codes).
  - Telemetry: Max 10 reports per minute per team.

---

## 6. Role-Based Access Control (RBAC) & Database Security

- **Admin Role**: Full read/write access to games, questions, hidden test cases, routes, telemetry, and manual overrides.
- **Marshal Role**: Read access to station occupancy, read access to team statuses, write access to verified QR override bypass.
- **Team Role**: Read access strictly to own team status, current round puzzle (without hidden test cases), and own strike history. Write access strictly to own code submissions and QR scan submissions.
- **Supabase Row Level Security (RLS)**: Enforced at the PostgreSQL level to guarantee that even if an API route had a parameter injection flaw, the database engine would reject cross-tenant reads or writes.

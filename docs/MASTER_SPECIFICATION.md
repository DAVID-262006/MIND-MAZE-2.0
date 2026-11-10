# MASTER SPECIFICATION — TREASURE HUNT ARENA

## 1. Executive Summary & Purpose

**Treasure Hunt Arena** is an enterprise-grade, high-concurrency, real-time multiplayer competition management and gameplay platform designed for timed campus or organizational treasure hunts. The competition blends intellectual challenges (multi-language algorithmic coding questions and logic puzzles) with physical orienteering across designated campus checkpoints.

The platform comprises two core software products:
1. **Player Arena**: A locked-down, real-time mobile/desktop web client used by 20 competing teams to receive puzzles, code in Monaco Editor, execute test cases, scan physical QR checkpoints, and track team status.
2. **Admin Control Center**: A mission-control dashboard for event organizers and marshals to configure rounds, manage puzzles and test suites, generate balanced round-robin route matrices, monitor real-time station occupancy, track live team health, manage anti-cheat alerts, manually intervene if needed, and view the live leaderboard.

---

## 2. Core Game Rules & Constraints Matrix

| Parameter | Specification | Enforcement Mechanism |
| :--- | :--- | :--- |
| **Participating Teams** | Exactly 20 teams | Database unique credentials, pre-registered team records |
| **Physical Locations** | Exactly 10 physical checkpoints | Pre-configured location records with coordinates & physical markers |
| **Game Rounds** | Exactly 10 rounds per match | State-machine progression (Round 1 to 10) |
| **Physical QR Codes** | 10 unique 10-digit numeric QR tokens | SHA-256 hashed QR tokens with salt stored server-side |
| **Concurrent Start** | All 20 teams start simultaneously | Admin triggers synchronized global game state transition |
| **Device & Session Limit** | Exactly 1 active device/session per team | Single-session token binding + WebSocket heartbeat heartbeat eviction |
| **Round Duration** | 5 minutes (300 seconds) | Authoritative server countdown initialized per round |
| **Grace Period** | 30 seconds immediately post-deadline | Server-enforced transition; both answer & QR must complete |
| **Elimination Condition: Timeout** | Exceeding 5 min + 30s grace without completion | Server scheduler auto-eliminates team and closes socket session |
| **Elimination Condition: Anti-Cheat**| 3 accumulated violation strikes | Real-time telemetry engine + server strike counter |
| **Coding Question Support** | C (GCC), C++ (G++), Python 3, Java (OpenJDK) | Judge0 sandbox integration with strict memory/time bounds |
| **Win Condition** | Fastest eligible completion time of Round 10 | Cumulative server-recorded timestamp calculation |
| **Network Dependency** | Continuous Internet connectivity required | Client offline-detection + reconnect state recovery |

---

## 3. Gameplay Loop & Lifecycle

For each team, the competition follows a strict 8-step iterative cycle per round:

```
[Round Start]
      │
      ▼
1. Fetch Question & Puzzles (Server sends sanitized payload, hidden test cases withheld)
      │
      ▼
2. Code/Solve Solution (Monaco Editor with local compilation & sample test validation)
      │
      ▼
3. Submit Answer to Backend (Backend evaluates logic / runs Judge0 on hidden test cases)
      │
      ├────────► [Incorrect] ──► Retry penalty/cooldown (within 5m+30s window)
      │
      ▼ [Passed]
4. Answer Validated State Reached (Database locks puzzle status as SOLVED)
      │
      ▼
5. QR Scanner Activated on Client (Client camera activates; scanner ready)
      │
      ▼
6. Physical Transit & Checkpoint Scan (Team reaches assigned location & scans physical QR)
      │
      ▼
7. Server QR Validation (Token validity, team route assignment, round matching, timestamp)
      │
      ├────────► [Invalid QR / Wrong Location] ──► Reject with penalty alert
      │
      ▼ [Valid QR Match]
8. Round Complete ──► Transition to Round N+1 (or Finish Game if Round 10)
```

---

## 4. Balanced Route Allocation Algorithm

### 4.1 Theoretical Formulation
- Let $T = \{T_1, T_2, \dots, T_{20}\}$ be the set of 20 teams.
- Let $L = \{L_1, L_2, \dots, L_{10}\}$ be the set of 10 locations.
- Let $R = \{1, 2, \dots, 10\}$ be the set of 10 rounds.

A valid route allocation is a mapping $M: T \times R \to L$ satisfying:
1. **Completeness (Latin Hypercube / Round-Robin)**: Each team visits every location exactly once:
   $$\forall t \in T, \; \{M(t, r) \mid r \in R\} = L$$
2. **Station Capacity Equipartition**: In every round $r$, exactly two teams occupy each location:
   $$\forall r \in R, \forall l \in L, \; |\{t \in T \mid M(t, r) = l\}| = 2$$
3. **Randomized Permutations**: Team indices and location labels are randomly shuffled using cryptographic pseudo-random seed before generation to eliminate predictable traversal paths.

### 4.2 Handling Real-World Stagger & Live Occupancy
While the mathematical matrix allocates exactly 2 teams per station per round under synchronized progression, teams will solve puzzles at varied speeds in practice. Therefore:
- The system **never assumes** uniform arrival times.
- The Admin Control Center features a **Live Station Occupancy Monitor** showing actual live presence (teams currently in QR scanning phase for that location) versus theoretical round assignment.
- QR checkpoints are designed for fast single-action scanning (<1 sec) to prevent physical queuing.

---

## 5. Security & Verification Guardrails

### 5.1 QR Cryptographic Verification
- Physical QR codes display a 10-digit numeric token (e.g., `8492019483`).
- The database stores `sha256(token + salt)`.
- Client transmits scanned string over TLS with active session JWT.
- Backend verification steps:
  1. Team is active and not eliminated.
  2. Round answer has been verified (`puzzle_solved == true`).
  3. Server current time $\le$ `round_start_time + 300s + 30s`.
  4. Scanned token matches `expected_location_id` for team's current round in pre-generated route matrix.
  5. Scan has not already been used for this round (idempotency guard).

### 5.2 Anti-Cheat Enforcement
- Client monitors:
  - `document.visibilitychange` (tab switching, browser minimization).
  - `window.blur` (alt-tab, floating overlays, system app switching).
  - Fullscreen exit events (Player Arena requests full-screen lock on start).
  - Multiple simultaneous active session connections.
  - Rate-limiting violations and unauthorized endpoint probes.
- Three-Strike Escalation Policy:
  - **Strike 1**: Warning modal dialog, immediate UI re-focus prompt, telemetry logged.
  - **Strike 2**: Final warning modal, audible alert, marshal notified on Admin dashboard.
  - **Strike 3**: Automatic team elimination, persistent disqualification in database, instant session termination.

### 5.3 Remote Sandbox Execution (Judge0)
- User submitted code is forwarded securely from backend to a dedicated Judge0 instance via API keys.
- Sandbox constraints:
  - CPU time limit: 2.0 seconds.
  - Wall time limit: 5.0 seconds.
  - Memory limit: 128 MB (131,072 KB).
  - Process/thread limit: 30.
  - Network access: Disabled inside sandbox.
  - Disallowed syscalls: Fork bombs, raw socket creation, disk writes outside `/tmp`.

---

## 6. Functional Roles & Permissions

1. **System Administrator (Admin)**: Full system access; configure questions, seed routes, trigger match start/pause/end, manually override team states, view security telemetry and live metrics.
2. **Field Marshal**: Read-only station occupancy access, ability to scan bypass QR if physical marker is vandalized/damaged (audit logged).
3. **Player Team**: Single active session, solve assigned puzzles, execute test cases, scan location QRs, view own timer and strike status.

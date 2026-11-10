# Admin Control Center Guide — Treasure Hunt Arena

The Admin Control Center (`/admin`) is the central command interface for competition marshals, judges, and system administrators.

---

## 1. Authentication & Access Control

- **URL Route**: `/admin`
- **Default Organizer Credentials** (Development/Staging):
  - **Username**: `admin`
  - **Password**: `arena2026`
- **Role Permissions**:
  - `admin`: Full authority across match lifecycle, routes, puzzles, station tokens, strike management, and team reinstatements.
  - Team player accounts are strictly forbidden from accessing `/admin` or administrative API endpoints.

---

## 2. Master Event Controls (Lifecycle Management)

The top header of the Admin interface contains the authoritative event lifecycle buttons:

1. **Start Championship Event**:
   - Simultaneously starts all 20 teams.
   - Synchronizes Round 1 clocks across all active devices.
   - Locks randomized routes to prevent regeneration during active play.
2. **Pause Competition**:
   - Temporarily freezes all active countdown timers.
   - Blocks incoming answer submissions and QR scans with `403 GAME_PAUSED`.
   - Used for weather events, campus safety holds, or technical pauses.
3. **Resume Competition**:
   - Automatically extends round deadlines by the exact elapsed pause duration.
   - Unfreezes submissions and restores active player HUDs.
4. **End Event / Emergency Halt**:
   - Concludes active match, freezes final leaderboard standings, and generates permanent audit records.

---

## 3. Navigation Tabs & Operational Workflows

### Tab 1: Live Overview Dashboard
- **Active Telemetry**: Total teams (20), active in-transit teams, completed teams, eliminated teams.
- **Round Distribution**: Live histogram tracking the real-time location of all 20 teams across Rounds 1–10.
- **System Pulse**: Visual heartbeat indicator tracking WebSocket connected clients and memory health.

### Tab 2: Live Team Monitoring
- Real-time tabular tracking of all 20 competing teams.
- Columns: Team Identity, Current Round, Assigned Location, Remaining Time (with grace period indicators), Answer State, Strike Count, Status Badge.
- **Marshal Quick Actions**:
  - Reset Device Session (unlocks a stuck device if a phone battery dies).
  - Manual Strike Warning.
  - Manual Disqualification / Reinstatement.

### Tab 3: Station Occupancy & QR Placards
- **Station Occupancy Sub-view**:
  - Live occupancy across all 10 campus checkpoints.
  - Arrived teams (confirmed strictly by physical QR scan).
  - Approaching teams (teams assigned to station who have not yet scanned).
  - Congestion alerts (`>= 100%` capacity warnings).
- **Field Placards Sub-view**:
  - 10-digit non-sequential QR token inspector with SVG visual matrix preview.
  - Printable Field Placard Manifest (`window.print()` layout for campus physical posting).
  - Revoke & Regenerate QR token (in case a physical station placard is damaged or compromised).

### Tab 4: Shifted Latin Hypercube Route Allocation
- **Matrix View**: 20-team × 10-round route assignment matrix.
- **Invariants Checked**:
  - Every team visits all 10 locations exactly once (100% round coverage).
  - Exactly 2 teams assigned to every station per round (zero bottlenecks).
- **Controls**:
  - Generate & Preview Routes (before event start).
  - Lock Routes (permanently freezes route matrix).
  - Export Route Matrix as CSV.

### Tab 5: Riddle & Challenge Management (CRUD)
- View and edit all 10 championship rounds across all 4 challenge categories:
  - **Coding**: Language selections (C, C++, Python, Java), starter templates, sample test cases, hidden test suites.
  - **Cryptography**: Encrypted ciphertext, cipher algorithms, plaintext answers.
  - **Logic**: Deductions, choices, math problems, numeric answers.
  - **Text**: Riddles, normalization rules (case-insensitive, whitespace trim).
- Attempt limits and progressive hint disclosures.
- Live puzzle preview drawer with immediate validation testing.

### Tab 6: Anti-Cheat Incident Tribunal
- Real-time audit log of all browser security violations:
  - Tab switching (`visibilitychange` / hidden document).
  - Window focus loss (`window.onblur`).
  - Fullscreen exits.
  - Concurrent multi-device login attempts.
- Strike count review:
  - Strike 1: Warning issued.
  - Strike 2: Final Warning.
  - Strike 3: Automatic elimination.
- **Incident Investigation & Strike Reversal**:
  - Marshals can review violation metadata and client timestamps.
  - Authorized strike reset or team reinstatement with mandatory audit note.

### Tab 7: Authoritative Leaderboard
- Authoritative calculation:
  $$\text{duration} = \text{final\_checkpoint\_verified\_at} - \text{event\_start\_timestamp}$$
- Podium styling: Gold Trophy (#1), Silver Medal (#2), Bronze Medal (#3).
- Tie-Break breakdown badges: Elapsed milliseconds $\rightarrow$ Strikes incurred $\rightarrow$ Total attempts $\rightarrow$ Team code.
- Disqualification filtering: Eliminated teams are excluded from podium winners.
- One-click CSV Export for official awards and university archives.

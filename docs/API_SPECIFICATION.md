# REST & REALTIME API SPECIFICATION — TREASURE HUNT ARENA

## 1. Authentication & Security Conventions

- **Transport**: All traffic must use TLS (HTTPS/WSS).
- **Authentication**: Bearer Token using signed JWT in `Authorization: Bearer <JWT>` header.
- **Payload Format**: Standard JSON (`Content-Type: application/json`).
- **Standard Error Envelope**:
```json
{
  "success": false,
  "error": {
    "code": "DEADLINE_EXCEEDED",
    "message": "Round grace period has elapsed. Team eliminated.",
    "details": null
  },
  "server_timestamp": "2026-11-01T14:15:00.000Z"
}
```

---

## 2. Authentication Endpoints

### 2.1 Team Login (`POST /api/v1/auth/team/login`)
- **Description**: Authenticates team credentials and binds the active session to one unique device.
- **Request Body**:
```json
{
  "team_code": "ALPHA-01",
  "password": "SecurePassword123!",
  "device_fingerprint": "fp_98a7sd8f7a6sdf"
}
```
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGciOi...",
    "session_token": "sess_89f72b...",
    "team": {
      "id": "c7a8b9d0-1234-5678-90ab-cdef12345678",
      "team_name": "Byte Brawlers",
      "team_code": "ALPHA-01",
      "current_round": 1,
      "status": "ready",
      "strikes": 0
    }
  }
}
```
- **Error `409 Conflict`**: If an active session is currently registered on another device.
```json
{
  "success": false,
  "error": {
    "code": "DUPLICATE_SESSION_DETECTED",
    "message": "Team is already logged in on another device. Contact event marshal for reset."
  }
}
```

### 2.2 Admin Login (`POST /api/v1/auth/admin/login`)
- **Description**: Admin authentication with MFA / Role validation.

---

## 3. Player Arena Endpoints

### 3.1 Get Current Round State (`GET /api/v1/arena/current-round`)
- **Headers**: `Authorization: Bearer <JWT>`
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "game_status": "live",
    "round_number": 3,
    "status": "in_progress",
    "server_time": "2026-11-01T14:15:20.120Z",
    "round_started_at": "2026-11-01T14:12:00.000Z",
    "deadline_at": "2026-11-01T14:17:00.000Z",
    "grace_deadline_at": "2026-11-01T14:17:30.000Z",
    "seconds_remaining": 100,
    "is_grace_period": false,
    "puzzle": {
      "id": "e5b6c7d8-...",
      "title": "Optimal Checkpoint Routing",
      "description_md": "Given an array of integers representing energy consumption...",
      "puzzle_type": "coding",
      "allowed_languages": ["c", "cpp", "python", "java"],
      "starter_code": {
        "python": "def solve(energy_arr):\n    # Write your solution\n    pass",
        "cpp": "#include <iostream>\nusing namespace std;\nint main() {\n    return 0;\n}"
      },
      "sample_test_cases": [
        {
          "id": "sample-1",
          "input_data": "[10, 20, 15, 30]",
          "expected_output": "45",
          "explanation": "Jump from index 0 to index 2..."
        }
      ]
    },
    "puzzle_solved": false,
    "qr_scanned": false,
    "qr_scanner_unlocked": false,
    "assigned_location": {
      "id": 4,
      "name": "Tower A - 2nd Floor Lobby",
      "description": "Proceed to the main bulletin board beside elevator 2."
    },
    "team_strikes": 1
  }
}
```

### 3.2 Run Sample Test Cases (`POST /api/v1/arena/code/run-sample`)
- **Description**: Compiles and executes code against public sample cases only.
- **Request Body**:
```json
{
  "language": "python",
  "source_code": "import sys\n# code here"
}
```
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "status": "Sample Cases Evaluated",
    "all_samples_passed": true,
    "results": [
      {
        "sample_id": "sample-1",
        "passed": true,
        "input": "[10, 20, 15, 30]",
        "expected_output": "45",
        "actual_output": "45\n",
        "execution_time_ms": 32,
        "memory_used_kb": 8192
      }
    ]
  }
}
```

### 3.3 Submit Final Solution (`POST /api/v1/arena/code/submit`)
- **Description**: Runs code against all private test cases via Judge0.
- **Request Body**:
```json
{
  "language": "python",
  "source_code": "import sys\n# complete code"
}
```
- **Response `200 OK` (Accepted)**:
```json
{
  "success": true,
  "data": {
    "status": "Accepted",
    "passed_cases": 8,
    "total_cases": 8,
    "puzzle_solved": true,
    "qr_scanner_unlocked": true,
    "assigned_location": {
      "id": 4,
      "name": "Tower A - 2nd Floor Lobby",
      "hint": "Proceed immediately to Tower A - 2nd Floor Lobby to scan physical QR #4."
    }
  }
}
```
- **Response `200 OK` (Wrong Answer / Compile Error / TLE)**:
```json
{
  "success": true,
  "data": {
    "status": "Wrong Answer",
    "passed_cases": 4,
    "total_cases": 8,
    "puzzle_solved": false,
    "qr_scanner_unlocked": false,
    "error_summary": "Failed on hidden test case 5"
  }
}
```

### 3.4 Scan Checkpoint QR (`POST /api/v1/arena/checkpoint/scan`)
- **Description**: Validates the scanned 10-digit numeric QR against the current expected location.
- **Request Body**:
```json
{
  "qr_numeric_token": "9827104928"
}
```
- **Response `200 OK` (Valid & Round Advanced)**:
```json
{
  "success": true,
  "data": {
    "verified": true,
    "location_matched": true,
    "round_completed": 3,
    "next_round": 4,
    "game_completed": false,
    "message": "Checkpoint verified! Round 4 has unlocked. New 5-minute timer started."
  }
}
```
- **Response `400 Bad Request` (Invalid Location / Invalid Token)**:
```json
{
  "success": false,
  "error": {
    "code": "CHECKPOINT_LOCATION_MISMATCH",
    "message": "Scanned QR belongs to Location 7. Your assigned checkpoint for Round 3 is Location 4."
  }
}
```

### 3.5 Anti-Cheat Telemetry Event (`POST /api/v1/arena/anticheat/report`)
- **Request Body**:
```json
{
  "violation_type": "tab_switch",
  "event_timestamp": "2026-11-01T14:16:10.000Z",
  "client_details": {
    "hidden": true,
    "visibility_state": "hidden"
  }
}
```
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "strike_count": 2,
    "status": "warning",
    "message": "Violation recorded: Tab switch detected. Strike 2 of 3."
  }
}
```

---

## 4. Admin Control Center Endpoints

### 4.1 Match Controls
- `POST /api/v1/admin/game/start` — Triggers simultaneous global match start for all 20 teams.
- `POST /api/v1/admin/game/pause` — Pauses official clocks (in case of venue emergency).
- `POST /api/v1/admin/game/resume` — Resumes official game clocks.
- `POST /api/v1/admin/game/end` — Concludes match and finalizes podium.

### 4.2 Route Management & Preview
- `POST /api/v1/admin/routes/generate` — Computes 20x10 balanced route matrix.
- `GET /api/v1/admin/routes/matrix` — Retrieves full routing grid with collision analytics.
- `POST /api/v1/admin/routes/lock` — Locks routes before competition start.

### 4.3 Live Telemetry & Monitoring
- `GET /api/v1/admin/stations/occupancy` — Real-time count of teams at each of the 10 locations.
- `GET /api/v1/admin/teams/live-status` — Detailed status of all 20 teams.
- `POST /api/v1/admin/teams/:id/strike` — Manually apply or revoke strikes.
- `POST /api/v1/admin/teams/:id/reset-session` — Clear duplicate device lock for team.
- `POST /api/v1/admin/teams/:id/bypass-qr` — Field marshal bypass if physical QR damaged.

---

## 5. Real-Time WebSocket / SSE Events

### 5.1 Channels
1. `team:{team_id}` (Private Team Socket)
2. `admin:telemetry` (Admin Dashboard Stream)
3. `public:leaderboard` (Projector / Hall Leaderboard Display)

### 5.2 Server-to-Client Event Payloads
- `game:started` — All teams transition to Round 1 immediately.
- `round:tick` — Server epoch broadcast every 1s for clock sync.
- `round:grace_started` — Broadcast when 5m mark passed, entering 30s grace period.
- `team:eliminated` — Sent when a team timeouts or hits 3 strikes.
- `station:occupancy_update` — Admin telemetry updates when teams transition to QR phase.
- `leaderboard:update` — Updated completion times and current round standings.

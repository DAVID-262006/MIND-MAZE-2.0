# SYSTEM ARCHITECTURE — TREASURE HUNT ARENA

## 1. Architectural Philosophy & Core Tenets

Treasure Hunt Arena operates under six non-negotiable architectural tenets:
1. **Authoritative Backend Truth**: The client is considered an untrusted rendering surface. All game state transitions, timer evaluations, question validations, and checkpoint acknowledgments originate from and are enforced by the backend server.
2. **Deterministic State Machine**: Every team is modeled as a state machine where state mutations happen strictly through verified database transactions.
3. **Sub-second Realtime Synchronization**: Dynamic game events (timer ticks, strike increments, eliminations, station crowding, leaderboard positions) are broadcast via low-latency WebSockets / Supabase Realtime.
4. **Isolated Sandboxed Execution**: User code is never compiled or executed on the application server. All code evaluation occurs in isolated containerized Judge0 workers with strict resource quotas.
5. **Fail-Safe & Idempotent Transactions**: All critical write operations (answer submission, QR verification, strike assignment, round advancement) utilize PostgreSQL transactional locks (`FOR UPDATE`) to prevent race conditions and double-submits.
6. **Graceful Degraded Performance**: If real-time sockets disconnect due to campus cellular deadzones, the client automatically falls back to authenticated HTTP polling with backoff while maintaining local countdown synchronization anchored to server reference epochs.

---

## 2. High-Level System Architecture Diagram

```
                              ┌────────────────────────────────────────┐
                              │         CLIENT LAYER (Next.js)         │
                              └────────────────────────────────────────┘
                                      │                        │
                      HTTPS / REST    │                        │ WebSocket / SSE
                                      ▼                        ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                APPLICATION SERVER (Node.js)                            │
│                                                                                        │
│  ┌───────────────────────┐  ┌───────────────────────┐  ┌────────────────────────────┐  │
│  │   Auth & Session      │  │  Game Engine Subsystem│  │ Anti-Cheat & Telemetry     │  │
│  │   - JWT / Device Bind │  │  - State Machine      │  │ - Blur/Visibility Listener │  │
│  │   - Single-device Lock│  │  - Timer Scheduler    │  │ - Strike Accumulator       │  │
│  │   - Role Guards       │  │  - Round Transitions  │  │ - Device Conflict Resolver │  │
│  └───────────────────────┘  └───────────────────────┘  └────────────────────────────┘  │
│                                                                                        │
│  ┌───────────────────────┐  ┌───────────────────────┐  ┌────────────────────────────┐  │
│  │ Route Allocation      │  │ Question Evaluator    │  │ Realtime Dispatcher        │  │
│  │ - Latin Square Matrix │  │ - Multiple Choice/Code│  │ - Socket.io / Supabase     │  │
│  │ - Station Balancer    │  │ - Judge0 Dispatcher   │  │ - Broadcast Leaderboard    │  │
│  │ - Occupancy Engine    │  │ - Hidden Case Checker │  │ - Event Streaming          │  │
│  └───────────────────────┘  └───────────────────────┘  └────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────────────────┘
          │                                │                                │
          ▼                                ▼                                ▼
┌──────────────────┐             ┌───────────────────┐            ┌───────────────────┐
│ JUDGE0 SANDBOX   │             │   DATABASE LAYER  │            │ CACHE & PERSIST   │
│ - Isolated Docker│             │   (PostgreSQL /   │            │ - In-memory Timer │
│ - GCC / G++      │             │    Supabase DB)   │            │   State Tracker   │
│ - Python / Java  │             │   - Row-level Lock│            │ - Connection Map  │
│ - No Net Access  │             │   - Audit Traces  │            │ - Rate Limit Map  │
└──────────────────┘             └───────────────────┘            └───────────────────┘
```

---

## 3. Subsystem Breakdown

### 3.1 Client Layer (Next.js 14 App Router)
- **Monorepo / Unified Application**: Built with Next.js, TypeScript, and Tailwind CSS.
- **Player Arena (`/arena/*`)**:
  - Protected layout with fullscreen lock hooks, blur/visibility change detection, and device fingerprint validation.
  - Interactive Monaco Editor component with syntax highlighting, language selector (C, C++, Python 3, Java), sample input/output runners, and submission console.
  - Real-time synchronized SVG countdown ring (5 min + 30s grace mode indicator).
  - WebRTC / HTML5 Canvas QR Scanner component (`html5-qrcode` or `@zxing/library`) with instant camera feedback and rear-camera auto-selection.
- **Admin Control Center (`/admin/*`)**:
  - Real-time station occupancy heat map (10 physical locations showing allocated vs. present teams).
  - 20-team live status board: Current round, puzzle state, QR state, remaining time, strikes, connectivity status.
  - Game controller: Start Match, Pause Match, Emergency Stop, Broadcast Global Announcement.
  - Route matrix generator & visualizer with export (PDF/CSV) for field marshals.
  - Puzzle & test suite authoring interface with markdown support and hidden test case upload.

### 3.2 Application Server Layer (Node.js + Express / Fastify + TypeScript)
- **Modular Monolith Architecture**:
  - `src/modules/auth`: Session issuance, single-device binding, JWT signature, role authorization.
  - `src/modules/game`: State machine, round transitions, timer clock, elimination triggers.
  - `src/modules/routes`: Balanced route allocation generator, location occupancy calculator.
  - `src/modules/puzzles`: Question retrieval (sanitized), logic validation, submission queueing.
  - `src/modules/judge`: Judge0 client wrapper, payload formatting, hidden test suite evaluation.
  - `src/modules/checkpoints`: 10-digit QR hash validation, route validation, idempotency checks.
  - `src/modules/anticheat`: Event debouncing, strike evaluation, automatic disqualification dispatch.
  - `src/modules/realtime`: WebSocket gateway, channel management (`team:{id}`, `admin:telemetry`, `public:leaderboard`).

### 3.3 Database Layer (PostgreSQL via Supabase)
- ACID-compliant relational storage.
- Strict foreign keys and cascading restrictions.
- Partial indexes on active games and team rounds for sub-10ms lookup latencies.
- Postgres functions / stored procedures for atomic `advance_round_if_valid` logic to eliminate race conditions under high network jitter.

### 3.4 Code Execution Layer (Judge0)
- REST API communication over secure internal network or API key-authenticated cloud endpoint.
- Asynchronous polling or webhook callback for execution results (`stdout`, `stderr`, `status`, `compile_output`, `time`, `memory`).
- Two-tier evaluation:
  1. **Run Sample**: Evaluates user code against public sample cases only.
  2. **Submit**: Evaluates against all private hidden test cases. Only if 100% pass does the answer transition to `SOLVED`.

---

## 4. Hardware & Network Topology

```
[Vercel Global Edge CDN]
          │
          ▼
[Custom Domain: arena.domain.com / admin.domain.com]
          │
          ├──► Next.js Frontend Static & SSR Assets
          │
          └──► API Proxy (api.domain.com) ──► [Render / Railway Production Container]
                                                        │
                                                        ├──► [Supabase Managed PostgreSQL]
                                                        │
                                                        └──► [Self-Hosted / Managed Judge0 CE]
```

---

## 5. Fault Tolerance & Campus Network Recovery

Campus physical events frequently encounter intermittent Wi-Fi drops or cellular congestion:
1. **Network Disconnection Buffer**:
   - The client caches the current round question and starter code in `localStorage` upon round start.
   - If the connection drops during coding, the editor remains fully functional.
2. **Server-Side Authoritative Expiry**:
   - The round clock is indexed by `round_end_at = started_at + 330 seconds`.
   - If a client disconnects and reconnects 2 minutes later, the client pulls current server time and resumes the exact remaining countdown without drift.
3. **Idempotent Retries**:
   - Answer and QR submissions include an idempotent `client_submission_id` UUID. Duplicate clicks or network packet replays do not trigger duplicate penalties or invalid state transitions.

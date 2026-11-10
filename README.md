# Treasure Hunt Arena — Lightweight Frontend Edition

Treasure Hunt Arena is a high-speed, competitive collegiate tournament platform. It simulates a synchronized multi-team event combining algorithmic challenge deduction with physical campus checkpoint navigation.

This version has been refactored into a **lightweight, frontend-only browser application** built with **React, Vite, TypeScript, and Tailwind CSS**, persisting game state in **Browser LocalStorage**. It requires zero backends, zero external databases, and zero cloud dependencies.

---

## 1. System Overview

- **Player Arena (`/#/player`)**: Mobile-first interface for participating teams. Features live synchronized countdown timers (5m normal + 30s grace), challenge deduction views, answer submission, browser camera QR code scanner, manual token verification, and anti-cheat deterrence.
- **Admin Control Center (`/#/admin`)**: Desktop-first mission control dashboard for organizers. Features live event lifecycle controls (Start / Pause / Resume / Reset), Orthogonal Shifted Latin Hypercube route generator, printable QR station generator, team management, riddle manager, and CSV/JSON export.
- **Central Browser Store**: Reactive state manager with automatic LocalStorage persistence and full JSON backup/restore.

---

## 2. Technology Stack

- **Framework**: React 18 & Vite 5
- **Language**: TypeScript 5 (Strict Mode)
- **Styling**: Tailwind CSS 3 (Dark Futuristic Theme: Navy `#080B13`, Electric Cyan `#00F2FE`, Violet `#8B5CF6`)
- **Persistence**: Browser LocalStorage & JSON Backup Engine
- **QR Code Engine**: `qrcode` (Placard Generation) & `html5-qrcode` (Lightweight Camera Scanner)
- **Icons**: Lucide React

---

## 3. Architecture & Project Layout

```
├── index.html                  # Single SPA entrypoint
├── vite.config.ts              # Vite configuration & optimized chunk splitting
├── tailwind.config.ts          # Dark futuristic arena color scheme
├── tsconfig.json               # Strict TypeScript configuration with alias (@/*)
├── package.json                # Lightweight single-app dependencies & scripts
├── src/
│   ├── main.tsx                # React DOM root mounting
│   ├── App.tsx                 # View router (Home, Player Arena, Admin Panel)
│   ├── index.css               # Global Tailwind CSS and custom scrollbars
│   ├── types/
│   │   └── index.ts            # Domain entities, DTOs, and event configurations
│   ├── store/
│   │   └── gameStore.tsx       # Central game state manager with LocalStorage sync
│   ├── services/
│   │   ├── storageService.ts   # LocalStorage persistence, export & import validation
│   │   ├── routeEngine.ts      # Orthogonal Shifted Latin Hypercube algorithm
│   │   ├── answerEngine.ts     # String normalization & answer validation
│   │   ├── leaderboardEngine.ts# Authoritative ranking & tie-break calculation
│   │   └── exportService.ts    # CSV & JSON file generation
│   ├── hooks/
│   │   ├── useTimer.ts         # Epoch timestamp-based countdown with grace period
│   │   ├── useAntiCheat.ts     # Tab switch, blur, and fullscreen deterrence
│   │   └── useGameState.ts     # Convenience hook re-exporting useGameStore
│   ├── data/
│   │   └── seedData.ts         # 20 seeded teams, 10 locations, 10 curated riddles
│   ├── utils/
│   │   ├── cn.ts               # Tailwind merge & clsx utility
│   │   └── formatters.ts       # Time and duration formatters
│   ├── components/
│   │   ├── ui/                 # Reusable UI library (Button, Modal, Toast, Input, TimerDisplay)
│   │   ├── layout/             # Responsive Navigation bar
│   │   ├── arena/              # Player Arena views (Login, Lobby, Puzzles, QR Scanner)
│   │   └── admin/              # Admin dashboard tabs (Overview, Teams, Routes, Standings)
│   ├── pages/
│   │   ├── HomePage.tsx        # Portal landing hub
│   │   ├── player/
│   │   │   └── PlayerArenaPage.tsx # Complete player lifecycle state machine
│   │   └── admin/
│   │       └── AdminPage.tsx   # Master admin mission control
│   └── test/
│       └── arenaCore.test.ts   # 144 automated unit & mathematical assertions
```

---

## 4. Quickstart & Local Development

### Prerequisites
- Node.js v20+ (Node.js 22 LTS tested)
- npm v10+

### Run Locally

```bash
# Install dependencies
npm install

# Start Vite development server (port 3000)
npm run dev

# Open in browser:
# http://localhost:3000
```

### Static Production Build

```bash
# Type check and build static assets to dist/
npm run build

# Preview production build locally
npm run preview
```

The resulting `dist/` folder is a purely static bundle compatible with any static web server or CDN (GitHub Pages, Vercel, Netlify, Cloudflare Pages, AWS S3, etc.).

---

## 5. Credentials & Default Access

- **Master Admin Passphrase**: `arena2026`
- **Seeded Competitor Teams**: Exactly 20 teams (`T01` to `T20`) with passwords `Arena2026!T01` to `Arena2026!T20`.
  - Quick-connect test buttons on the login screen automatically populate valid credentials for instant testing.

---

## 6. Automated Test Suite

Run the automated test suite with:

```bash
npm test
```

Verifies **144 test assertions**:
1. Latin Hypercube equipartition (20 teams, 10 locations, 10 rounds, 0 collisions).
2. Answer validation, case-insensitivity, and whitespace normalization.
3. Checkpoint QR token matching and wrong location rejection.
4. Timestamp-based 5m countdown and 30s grace period calculations.
5. Anti-cheat 3-strike escalation and disqualification.
6. Leaderboard ranking, tie-breaking, and winner eligibility.
7. JSON backup export and schema validation.

---

## 7. Architectural Limitations & Transparency

1. **Frontend-Only Architecture**: All application state resides exclusively in browser `localStorage`. There is no central database or WebSocket cluster.
2. **Device Synchronization**: The application is designed for local testing, demonstration, and centrally managed tournament coordination. It does not provide real-time sync across 20 independent client devices without a backend.
3. **Browser Timers**: Timers are computed using stored timestamps (`deadlineAt` and `graceDeadlineAt`). They provide a realistic user experience but are subject to local clock manipulation.
4. **Anti-Cheat Enforcement**: Client-side event listeners (`visibilitychange`, `blur`, `fullscreenchange`) serve as proactive deterrence against casual multi-tabbing. They do not constitute operating-system-level proctoring.
5. **Static QR Verification**: QR codes verify that the scanned 10-digit token matches the assigned station. They do not prove physical geographic presence.
6. **Code Compilation**: Server-side Judge0 sandboxes have been removed. Coding challenges retain descriptions, sample I/O, and starter code, but accept computed output submissions.

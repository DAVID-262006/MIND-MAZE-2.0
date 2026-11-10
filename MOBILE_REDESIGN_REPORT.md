# Treasure Hunt Arena — Mobile-First Redesign & Interface Separation Report

**Architectural Specification & Implementation Documentation**  
*Version 2.1.0 • Mobile-First Single-Page Application (SPA) • Zero Backend / Static Deployment*

---

## Executive Summary

The **Treasure Hunt Arena** application has been comprehensively refactored into a **mobile-first, portrait-optimized progressive web application** with **strict architectural separation** between the **Player Arena (`/#/player`)** and the **Admin Control Center (`/#/admin`)**.

All server-side code (Express, Node.js API, PostgreSQL, Supabase, Judge0 compilation, and WebSocket infrastructure) was removed in previous phases. This release builds upon that lightweight foundation to deliver an immersive smartphone experience engineered specifically for campus orienteering and competitive hackathon treasure hunts.

---

## 1. Core Architecture & Route Isolation

### Route Hierarchy
| Route | Target Audience | Primary Device | Admin Controls Present? |
| :--- | :--- | :--- | :--- |
| `/#/` & `/#/player` | Participating Teams | Mobile Smartphones (360px–430px) | **Strictly NEVER (Zero Admin Links)** |
| `/#/admin` | Marshals & Event Directors | Tablet / Laptop / Desktop | **Full Administrative Suite** |
| `/#/home` | General Audience | Any Browser | Portal hub link to Player / Admin |

### Route Protection & Browser History (`src/App.tsx`)
- Native hash-based client routing (`window.addEventListener('hashchange')`) enables complete compatibility with static hosting (Vercel, Netlify, GitHub Pages, Cloudflare Pages).
- Browser back and forward buttons work seamlessly without page reloads or blank states.
- The default route immediately boots participants directly into the mobile Player Arena.

---

## 2. Mobile-First & Portrait Touch Optimization

### Viewport & Safe-Area Configuration (`index.html` & `src/index.css`)
- **Viewport Meta:**
  ```html
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <meta name="theme-color" content="#080b13" />
  ```
- **CSS Safe Areas:**
  - `pt-safe`: `padding-top: env(safe-area-inset-top, 0px)` prevents content overlap with camera notches and dynamic islands.
  - `pb-safe`: `padding-bottom: env(safe-area-inset-bottom, 0px)` ensures sticky bottom controls do not collide with Android gesture bars or iOS home indicator bars.
  - `touch-action: manipulation` eliminates double-tap zoom delay for instant button tap response.

### Touch Target Standard
- Every interactive element (inputs, answer submission, QR station scan trigger, modal controls) has a **minimum touch height of 48px** (`h-12`).
- Spacing between adjacent interactive buttons is maintained at a minimum of 8px to prevent accidental taps while running outdoors.

---

## 3. Fullscreen Player Experience (`src/hooks/useFullscreen.ts`)

### Browser Constraint Handling
Mobile browsers (Safari iOS and Chrome Android) strictly forbid programmatic fullscreen requests on initial page load. Fullscreen can only be granted via a **direct user gesture** (`click` or `touchend`).

### Implementation Flow
1. **Welcome Screen (`LoginView.tsx`):**
   - Prominent, high-contrast **"ENTER ARENA"** button.
   - When tapped, `handleSubmit()` or `handleQuickConnect()` immediately requests `document.documentElement.requestFullscreen()`.
   - Cross-browser vendor prefixes supported (`webkitRequestFullscreen`, `mozRequestFullScreen`, `msRequestFullscreen`).
   - If unsupported (e.g. standard iOS Safari webview), the app degrades gracefully without throwing unhandled exceptions.
2. **Subtle Fullscreen Re-Entry:**
   - If a participant exits fullscreen or uses the native Android system bar, a subtle fullscreen toggle icon is provided in `PlayerHeader.tsx` and `LobbyView.tsx`.
   - The user is **never trapped or forced** into an inescapable fullscreen lock.
   - Fullscreen exit is **never penalized as an anti-cheat strike**.

---

## 4. Mobile Game Screen Layout Hierarchy

The active game screen (`src/pages/player/PlayerArenaPage.tsx`) is arranged in a strict top-to-bottom portrait hierarchy:

```
┌────────────────────────────────────────────────────────┐
│  TOP HUD (PlayerHeader):                               │
│  [Logo] ARENA   [Team T01 • R3/10]   [Strikes 0/3] [FS]│
├────────────────────────────────────────────────────────┤
│  STICKY ROUND & COUNTDOWN TIMER HUD:                   │
│  Round 3 of 10                       [ LIVE ROUND ]    │
│  04:18 Time Remaining                                 │
│  (Amber warning banner when 30s Grace Period active)   │
├────────────────────────────────────────────────────────┤
│  ASSIGNED PHYSICAL CHECKPOINT CARD:                    │
│  📍 Computer Science Atrium (#4)        [ UNLOCKED ]   │
│  "Near the central trophy showcase, north entrance."   │
├────────────────────────────────────────────────────────┤
│  PUZZLE CHALLENGE (PuzzleRenderer):                    │
│  - Challenge Title & Problem Statement                 │
│  - Code snippet / Clue / Sample input & output         │
│  - Text input (48px)                                   │
│  - [SUBMIT SOLUTION] button (48px)                     │
├────────────────────────────────────────────────────────┤
│  FIXED BOTTOM MOBILE BAR:                              │
│  [ SCAN CHECKPOINT QR CODE ] (48px touch target)       │
│  [ • • • • • • • • • • ] (Compact 10-Round Pills)      │
└────────────────────────────────────────────────────────┘
```

### Dynamic Component States
1. **Before Challenge Solved:**
   - Station QR button is in a disabled state with clear instruction: *"SOLVE CHALLENGE TO UNLOCK SCANNER"*.
   - Checkpoint badge displays *"LOCKED"*.
2. **Challenge Solved:**
   - Instant green confirmation toast: *"Answer Verified! Proceed to assigned station to scan QR code."*
   - Checkpoint badge toggles to *"UNLOCKED"*.
   - Scan button pulses with cyan/emerald gradient: *"SCAN CHECKPOINT QR CODE"*.
3. **Grace Period (00:00 reached):**
   - Distinct amber alert border and pulsing banner: *"⚠️ Grace Period Active! 30 seconds remaining to complete puzzle and QR scan!"*
   - Timer counts down from 30 to 0.

---

## 5. Phone Navigation & Anti-Cheat Safeguards

### Fair Anti-Cheat Deterrence (`src/hooks/useAntiCheat.ts`)
- **Deterrence, Not Hostility:** Anti-cheat is client-side deterrence.
- **Suppression Mechanism:** Anti-cheat event listeners are automatically suppressed when:
  - The physical QR camera scanner modal is open (`isQrModalOpen`).
  - An anti-cheat warning modal is open (`antiCheatModal.isOpen`).
  - The exit confirmation modal is open (`isLeaveModalOpen`).
- **Debounced Focus Loss:** A 400ms debounce prevents false triggers when mobile virtual keyboards slide into view.
- **Back Button & Refresh Safety:**
  - Back navigation does not eliminate teams.
  - Tapping "Exit Session" prompts an explicit confirmation modal explaining that the 5-minute round timer continues in the background.
  - Browser refresh (`F5` or swipe-to-refresh) restores the exact active round state, timer timestamps, and solved flags from `localStorage`.

---

## 6. Admin Control Center Isolation (`src/pages/admin/AdminPage.tsx`)

- **Strict URL Separation:** Accessible exclusively at `/#/admin`.
- **Zero Player Contamination:** The player interface contains no links, buttons, or indicators pointing to the admin panel.
- **Mobile-Responsive Admin Controls:**
  - Header (`AdminHeader.tsx`) features quick view toggle to Player Arena and sign out.
  - Horizontal scrolling tab navigation with smooth touch scrollbar (`Overview`, `Live Monitoring`, `Teams`, `Riddles`, `Stations`, `Route Matrix`, `Anti-Cheat`, `Leaderboard`).
  - Table views feature container-level horizontal scroll (`overflow-x-auto`) to prevent layout distortion on tablet and mobile viewports.

---

## 7. Verification & Production Build Metrics

### 1. Automated Verification Suite (`npm test`)
- 144 out of 144 unit tests passing:
  - Route Equipartition & Latin Hypercube: 20 teams, 10 rounds, 0 collisions, 2 teams/station/round.
  - Answer Normalization: Whitespace trim, case-insensitivity, regex matching.
  - QR Verification: 10-digit numeric token validation, station mismatch rejection.
  - Timer Engine: 300s initial limit, 30s grace period trigger, hard timeout expiry.
  - Anti-Cheat: Warning strike 1, warning strike 2, disqualification strike 3.
  - Leaderboard Ranking: Fastest clean finisher first, eliminated teams disqualified from podium.
  - Backup Validation: Schema 2.0.0 JSON export/import.

### 2. Static Production Build (`npm run build`)
```
vite v5.4.21 building for production...
✓ 1724 modules transformed.
dist/index.html                         1.40 kB │ gzip:   0.69 kB
dist/assets/index-B3nlnCrY.css         38.33 kB │ gzip:   6.84 kB
dist/assets/vendor-icons-CLpRLkYQ.js   31.11 kB │ gzip:   7.63 kB
dist/assets/vendor-react-B-6hPgX3.js  133.93 kB │ gzip:  43.13 kB
dist/assets/index-CNQAbjzf.js         179.70 kB │ gzip:  44.85 kB
dist/assets/vendor-qr-ArUEz-lO.js     358.77 kB │ gzip: 109.27 kB
✓ built in 2.82s
```

### 3. Dev Server Smoke Verification (`npm run dev`)
- Vite dev server initializes in **191 ms** with zero runtime warnings or errors.

---

## 8. Summary of Created & Refactored Files

| File | Role |
| :--- | :--- |
| `src/hooks/useFullscreen.ts` | Cross-browser Fullscreen API with user-gesture activation |
| `src/hooks/useAntiCheat.ts` | Fair deterrence with modal suppression & blur debouncing |
| `src/components/layout/PlayerHeader.tsx` | Mobile-first header with notch padding, strikes, fullscreen toggle (0 admin links) |
| `src/components/layout/AdminHeader.tsx` | Independent admin header with game status and quick-switch action |
| `src/components/arena/LoginView.tsx` | Welcome screen with prominent "ENTER ARENA" and instant quick-connect credentials |
| `src/components/arena/LobbyView.tsx` | Mobile card lobby with rules and waiting status |
| `src/components/arena/ProgressTracker.tsx` | Compact 10-step horizontal round tracker fitting 360px screens |
| `src/components/arena/CameraQrScanner.tsx` | Mobile rear-camera QR scanner with manual token fallback and simulation button |
| `src/components/arena/PuzzleRenderer.tsx` | Responsive puzzle card renderer |
| `src/components/arena/CodingPuzzleView.tsx` | Simplified mobile coding challenge view with computed output verification |
| `src/pages/player/PlayerArenaPage.tsx` | Dedicated mobile portrait game screen (Top HUD, Timer, Checkpoint, Puzzle, Bottom Scan) |
| `src/pages/admin/AdminPage.tsx` | Dedicated administrative dashboard isolated at `/#/admin` |
| `src/App.tsx` | Hash-based router defaulting to `/#/player` for participants |
| `index.html` & `src/index.css` | Mobile meta tags (`viewport-fit=cover`), touch optimization, and safe-area utilities |


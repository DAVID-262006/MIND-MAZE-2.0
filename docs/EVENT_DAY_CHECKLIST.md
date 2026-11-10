# Event Day Operational Checklist — Treasure Hunt Arena

Use this chronological checklist to orchestrate the competition on match day with zero technical hitches.

---

## 1. T-Minus 24 Hours (Pre-Event Staging)

- [ ] **Infrastructure Health Check**:
  - Verify API server responds with HTTP 200: `curl -I https://<api-domain>/api/v1/health`
  - Verify WebSocket endpoint establishes TLS handshake.
  - Verify database pool connectivity on Supabase.
  - Verify Judge0 code execution service executes C, C++, Python, and Java programs within 2.0s.
- [ ] **Physical Checkpoint Preparation**:
  - Open `/admin` > **Station Occupancy & QR Placards**.
  - Review all 10 physical station assignments.
  - Click **"Print All Placards"** to generate high-contrast waterproof checkpoint sheets.
  - Laminate or encase the 10 placard sheets in weatherproof sleeves.
- [ ] **Team Credentials Distribution**:
  - Print or distribute credentials for all 20 teams (`T01` to `T20`) with unique badge codes and access passphrases.

---

## 2. T-Minus 3 Hours (Field Marshal Station Deployment)

- [ ] Station 1: Main Library — Atrium (Placard #1 posted securely)
- [ ] Station 2: Computer Science Building — Hallway A (Placard #2 posted securely)
- [ ] Station 3: Engineering Block — West Entrance (Placard #3 posted securely)
- [ ] Station 4: Student Center — Quad Steps (Placard #4 posted securely)
- [ ] Station 5: Innovation Hub — 3rd Floor Mezzanine (Placard #5 posted securely)
- [ ] Station 6: Science Complex — South Courtyard (Placard #6 posted securely)
- [ ] Station 7: Auditorium — Foyer South (Placard #7 posted securely)
- [ ] Station 8: Sports Complex — Pavilion Deck (Placard #8 posted securely)
- [ ] Station 9: Academic Tower — Central Arcade (Placard #9 posted securely)
- [ ] Station 10: Administration Lawn — Clock Tower Base (Placard #10 posted securely)
- [ ] Verify each physical QR code with a field marshal test phone camera to ensure barcode contrast and readability under natural sunlight.

---

## 3. T-Minus 45 Minutes (Team Check-In & Device Binding)

- [ ] Instruct all 20 team captains to assemble at the central assembly hall.
- [ ] Direct captains to navigate to `/arena` on their single designated competition phone.
- [ ] Instruct teams to log in with their assigned `T01`–`T20` credentials.
- [ ] Monitor the **Overview Dashboard** on `/admin` to verify that all 20 teams are logged in and in **"WAITING"** state.
- [ ] Verify that every device has rear camera access granted for WebRTC scanning.

---

## 4. T-Minus 15 Minutes (Route Verification & Rules Briefing)

- [ ] Open `/admin` > **Route Allocation**.
- [ ] Verify that 200 balanced routes are generated with zero collisions (strictly 2 teams per station per round).
- [ ] Click **"Lock Routes"** to freeze route assignments permanently.
- [ ] Deliver the mandatory competition briefing:
  - 10 sequential rounds.
  - 5-minute normal period + 30-second grace period per round.
  - 3-strike anti-cheat regulation for tab switching or window blur.
  - Physical QR token scan required to unlock subsequent rounds.

---

## 5. T-Zero: Event Kickoff

- [ ] In the Admin Control Center, click **"Start Championship Event"**.
- [ ] Confirm that all 20 team screens instantly transition from the Waiting Lobby to Round 1 without requiring page refreshes.
- [ ] Confirm synchronized Round 1 countdown clocks begin at 05:00.

---

## 6. Live In-Flight Monitoring (During Play)

- [ ] **Tab 2 (Live Monitoring)**: Observe team round progressions, answer attempts, and remaining timers.
- [ ] **Tab 3 (Station Occupancy)**: Monitor station arrival rates and watch for any crowding flags (`utilization >= 100%`).
- [ ] **Tab 6 (Anti-Cheat)**: Review any tab switch or window focus loss warnings. Conduct marshal spot-checks if a team incurs Strike 2.
- [ ] **Handling Device Failures**:
  - If a team's phone runs out of battery, the captain may report to the Marshal desk.
  - Marshal clicks **"Reset Session"** in Team Management, allowing the team to immediately bind a backup device.

---

## 7. Post-Match (Award Ceremony & Archive)

- [ ] Confirm the 1st, 2nd, and 3rd place teams on the **Live Leaderboard Tab**.
- [ ] Verify tie-breaker metrics (completion duration ms $\rightarrow$ strikes $\rightarrow$ attempts).
- [ ] Click **"Export Official CSV"** to archive the verified match standings.
- [ ] Click **"End Event"** in master controls to seal the final competition state.
- [ ] Present championship trophies and medals to podium winners.

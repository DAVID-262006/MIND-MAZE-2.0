# Competitor & Player Arena Guide — Treasure Hunt Arena

Welcome to **Treasure Hunt Arena 2026**! This guide explains everything competing teams need to know to log in, navigate the 10-round campus challenge, and compete fairly.

---

## 1. System Requirements & Device Policy

- **One Device Per Team**: Only one smartphone, tablet, or laptop may be bound to a team session at a time.
- **Modern Web Browser**: Google Chrome, Mozilla Firefox, Safari, or Microsoft Edge.
- **Hardware Access**:
  - Rear camera access (`getUserMedia`) is required for scanning physical campus checkpoint QR tokens.
  - Active internet connectivity (Wi-Fi or cellular data).

---

## 2. Login & Waiting Lobby

1. Open the Player Arena at `/arena`.
2. Enter your **Team Code** (e.g. `T01`, `T02` ... `T20`) and assigned password.
3. Upon authentication, your hardware device fingerprint is locked to your team session.
4. **Waiting Lobby**:
   - Displays your team name, roster, and current competition guidelines.
   - Live radar animation shows **"MARSHAL HOLD"** until the event starts.
   - Puzzles remain sealed until marshals officially start the match simultaneously for all teams.

---

## 3. Gameplay Loop (10 Championship Rounds)

Each of the 10 rounds follows an authoritative 4-step sequence:

```
+-------------------------------------------------------------+
| Step 1: Solve Active Puzzle                                |
| (Coding, Cryptography, Logic, or Text Riddle)              |
+------------------------------+------------------------------+
                               |
                               v
+-------------------------------------------------------------+
| Step 2: Receive Verification & Checkpoint Dispatch          |
| (Reveals assigned campus station name & physical hints)     |
+------------------------------+------------------------------+
                               |
                               v
+-------------------------------------------------------------+
| Step 3: Travel to Physical Station                         |
| (Navigate across campus to the assigned location)           |
+------------------------------+------------------------------+
                               |
                               v
+-------------------------------------------------------------+
| Step 4: Scan Physical Checkpoint QR Token                  |
| (Camera scan validates arrival and unlocks next round!)    |
+-------------------------------------------------------------+
```

---

## 4. The 4 Puzzle Types

### A. Coding Challenges
- Integrated **Monaco Code Editor** with syntax highlighting.
- Supported Languages: **C**, **C++**, **Python 3**, and **Java**.
- Select your language from the dropdown menu to load a starter code template.
- Click **"Run Sample Tests"** to test your program against visible test cases and inspect compilation/runtime output.
- Click **"Submit Final Solution"** to evaluate your code against hidden test cases. 100% test pass is required to proceed.

### B. Cryptography Puzzles
- Read the encrypted ciphertext from the secure vault.
- Use the built-in decryption scratchpad to analyze ciphers (Caesar, Vigenère, Substitution, Base64, etc.).
- Submit the decrypted plaintext message.

### C. Logic Puzzles
- Multi-step combinatorial, probabilistic, or deductive reasoning problems.
- Enter the exact solution in fractional, numeric, or keyword format.

### D. Text Riddles
- Thematic campus clues, historical references, and lateral thinking riddles.
- Normalization automatically handles capitalization and extra spaces.

---

## 5. Authoritative Round Timer & Grace Period

- **Normal Period**: You have **5 minutes (300 seconds)** per round to solve the puzzle, reach the station, and scan the physical token.
- **Grace Period**: If the 5-minute timer expires, an amber/red countdown dial grants a **30-second Grace Extension**.
- **Hard Timeout**: If the physical QR token is not successfully verified by the end of the 30-second grace period, your team is **automatically eliminated** from the competition.

---

## 6. Anti-Cheat Regulations & The Three-Strike Policy

The arena runs in a secure, monitored environment to guarantee fair competition:

1. **Tab Switching**: Leaving the arena tab or minimizing your browser window triggers an automated security alert.
2. **Window Focus Loss**: Clicking outside the arena window is recorded as focus loss.
3. **Fullscreen Exits**: Exiting fullscreen mode triggers a security alert.
4. **Three-Strike Policy**:
   - **Strike 1**: First Warning banner displayed on screen.
   - **Strike 2**: Final Warning banner displayed on screen.
   - **Strike 3**: Immediate team disqualification. Gameplay is halted, submissions are blocked, and event marshals are notified.

---

## 7. Victory & Podium Standings

The competition concludes once your team successfully verifies the 10th checkpoint.

- Official finish times are calculated authoritatively:
  $$\text{Finish Time} = \text{10th Checkpoint Verification Timestamp} - \text{Event Start Timestamp}$$
- Only eligible teams with clean disciplinary records qualify for championship trophies and medals.

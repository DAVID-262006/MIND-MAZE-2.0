import type { Team, LocationCheckpoint, Riddle, GameEventConfig } from '../types';

export const INITIAL_EVENT_CONFIG: GameEventConfig = {
  id: 'event-arena-2026',
  title: 'Treasure Hunt Arena 2026 Championship',
  status: 'ready',
  totalTeams: 20,
  totalRounds: 10,
  roundDurationSeconds: 300, // 5 minutes
  gracePeriodSeconds: 30, // 30 seconds
  eventStartedAt: null,
  eventFinishedAt: null,
  pauseStartedAt: null,
  totalPauseDurationMs: 0,
  routesLocked: false,
};

export const INITIAL_TEAMS: Team[] = [
  { id: 'team-1', teamCode: 'T01', teamName: 'Alpha Centauri', accessCode: 'Arena2026!T01', status: 'ready', currentRound: 1, strikes: 0, createdAt: new Date().toISOString() },
  { id: 'team-2', teamCode: 'T02', teamName: 'Bravo Vanguards', accessCode: 'Arena2026!T02', status: 'ready', currentRound: 1, strikes: 0, createdAt: new Date().toISOString() },
  { id: 'team-3', teamCode: 'T03', teamName: 'Charlie Cyphers', accessCode: 'Arena2026!T03', status: 'ready', currentRound: 1, strikes: 0, createdAt: new Date().toISOString() },
  { id: 'team-4', teamCode: 'T04', teamName: 'Delta Drifters', accessCode: 'Arena2026!T04', status: 'ready', currentRound: 1, strikes: 0, createdAt: new Date().toISOString() },
  { id: 'team-5', teamCode: 'T05', teamName: 'Echo Enigmas', accessCode: 'Arena2026!T05', status: 'ready', currentRound: 1, strikes: 0, createdAt: new Date().toISOString() },
  { id: 'team-6', teamCode: 'T06', teamName: 'Foxtrot Falcons', accessCode: 'Arena2026!T06', status: 'ready', currentRound: 1, strikes: 0, createdAt: new Date().toISOString() },
  { id: 'team-7', teamCode: 'T07', teamName: 'Golf Griffins', accessCode: 'Arena2026!T07', status: 'ready', currentRound: 1, strikes: 0, createdAt: new Date().toISOString() },
  { id: 'team-8', teamCode: 'T08', teamName: 'Hotel Hawks', accessCode: 'Arena2026!T08', status: 'ready', currentRound: 1, strikes: 0, createdAt: new Date().toISOString() },
  { id: 'team-9', teamCode: 'T09', teamName: 'India Igniters', accessCode: 'Arena2026!T09', status: 'ready', currentRound: 1, strikes: 0, createdAt: new Date().toISOString() },
  { id: 'team-10', teamCode: 'T10', teamName: 'Juliet Juggernauts', accessCode: 'Arena2026!T10', status: 'ready', currentRound: 1, strikes: 0, createdAt: new Date().toISOString() },
  { id: 'team-11', teamCode: 'T11', teamName: 'Kilo Krakens', accessCode: 'Arena2026!T11', status: 'ready', currentRound: 1, strikes: 0, createdAt: new Date().toISOString() },
  { id: 'team-12', teamCode: 'T12', teamName: 'Lima Lancers', accessCode: 'Arena2026!T12', status: 'ready', currentRound: 1, strikes: 0, createdAt: new Date().toISOString() },
  { id: 'team-13', teamCode: 'T13', teamName: 'Mike Mavericks', accessCode: 'Arena2026!T13', status: 'ready', currentRound: 1, strikes: 0, createdAt: new Date().toISOString() },
  { id: 'team-14', teamCode: 'T14', teamName: 'November Navigators', accessCode: 'Arena2026!T14', status: 'ready', currentRound: 1, strikes: 0, createdAt: new Date().toISOString() },
  { id: 'team-15', teamCode: 'T15', teamName: 'Oscar Oracles', accessCode: 'Arena2026!T15', status: 'ready', currentRound: 1, strikes: 0, createdAt: new Date().toISOString() },
  { id: 'team-16', teamCode: 'T16', teamName: 'Papa Phantoms', accessCode: 'Arena2026!T16', status: 'ready', currentRound: 1, strikes: 0, createdAt: new Date().toISOString() },
  { id: 'team-17', teamCode: 'T17', teamName: 'Quebec Quasars', accessCode: 'Arena2026!T17', status: 'ready', currentRound: 1, strikes: 0, createdAt: new Date().toISOString() },
  { id: 'team-18', teamCode: 'T18', teamName: 'Romeo Rangers', accessCode: 'Arena2026!T18', status: 'ready', currentRound: 1, strikes: 0, createdAt: new Date().toISOString() },
  { id: 'team-19', teamCode: 'T19', teamName: 'Sierra Spectres', accessCode: 'Arena2026!T19', status: 'ready', currentRound: 1, strikes: 0, createdAt: new Date().toISOString() },
  { id: 'team-20', teamCode: 'T20', teamName: 'Tango Titans', accessCode: 'Arena2026!T20', status: 'ready', currentRound: 1, strikes: 0, createdAt: new Date().toISOString() },
];

export const INITIAL_LOCATIONS: LocationCheckpoint[] = [
  { id: 1, locationNumber: 1, name: 'Main Library - Atrium', description: 'Ground floor entrance near digital catalog kiosk', capacity: 2, active: true, qrToken: '8492019481' },
  { id: 2, locationNumber: 2, name: 'Computer Science Building - Hallway A', description: 'First floor beside Robotics Laboratory', capacity: 2, active: true, qrToken: '7201948293' },
  { id: 3, locationNumber: 3, name: 'Engineering Block - West Entrance', description: 'Beside the solar cell showcase display', capacity: 2, active: true, qrToken: '9182736452' },
  { id: 4, locationNumber: 4, name: 'Student Center - Quad Steps', description: 'Exterior pillar facing the amphitheater', capacity: 2, active: true, qrToken: '6392018475' },
  { id: 5, locationNumber: 5, name: 'Innovation Hub - 3rd Floor Mezzanine', description: 'Beside the 3D printing workshop glass wall', capacity: 2, active: true, qrToken: '4820193847' },
  { id: 6, locationNumber: 6, name: 'Science Complex - South Courtyard', description: 'Underneath the sundial monument', capacity: 2, active: true, qrToken: '5920184729' },
  { id: 7, locationNumber: 7, name: 'Auditorium - Foyer South', description: 'Right wing lobby adjacent to the trophy cabinet', capacity: 2, active: true, qrToken: '3820194821' },
  { id: 8, locationNumber: 8, name: 'Sports Complex - Pavilion Deck', description: 'Upper gallery overlooking the athletic track', capacity: 2, active: true, qrToken: '8192038475' },
  { id: 9, locationNumber: 9, name: 'Academic Tower - Central Arcade', description: 'Archway between Tower 1 and Tower 2', capacity: 2, active: true, qrToken: '2938472019' },
  { id: 10, locationNumber: 10, name: 'Administration Lawn - Clock Tower Base', description: 'North face of the historic clock tower', capacity: 2, active: true, qrToken: '1928374650' },
];

/**
 * Clean, self-contained SVG visual illustrations for Image Puzzles.
 * Uses non-identifying landmarks, logic diagrams, and schematics.
 */
const CLOCK_TOWER_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 260" width="100%" height="100%">
  <rect width="400" height="260" fill="#0B0F19"/>
  <defs>
    <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#00F2FE" stop-opacity="0.8"/>
      <stop offset="100%" stop-color="#4FACFE" stop-opacity="0.2"/>
    </linearGradient>
    <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
      <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#1E293B" stroke-width="0.8"/>
    </pattern>
  </defs>
  <rect width="400" height="260" fill="url(#grid)" />
  <!-- Ground -->
  <line x1="40" y1="230" x2="360" y2="230" stroke="#334155" stroke-width="2"/>
  <!-- Tower Base -->
  <rect x="160" y="140" width="80" height="90" fill="#1E293B" stroke="#00F2FE" stroke-width="1.5"/>
  <rect x="175" y="170" width="50" height="60" fill="#0B0F19" stroke="#38BDF8" stroke-width="1"/>
  <path d="M 175 170 Q 200 145 225 170" fill="#0B0F19" stroke="#38BDF8" stroke-width="1"/>
  <!-- Tower Midsection -->
  <rect x="168" y="70" width="64" height="70" fill="#1E293B" stroke="#00F2FE" stroke-width="1.5"/>
  <!-- Clock Dial -->
  <circle cx="200" cy="105" r="22" fill="#0B0F19" stroke="#F59E0B" stroke-width="2"/>
  <circle cx="200" cy="105" r="2" fill="#F59E0B"/>
  <line x1="200" y1="105" x2="200" y2="92" stroke="#F59E0B" stroke-width="2"/>
  <line x1="200" y1="105" x2="212" y2="105" stroke="#F59E0B" stroke-width="1.5"/>
  <!-- Tower Spire -->
  <polygon points="200,20 160,70 240,70" fill="url(#g1)" stroke="#00F2FE" stroke-width="1.5"/>
  <line x1="200" y1="10" x2="200" y2="20" stroke="#00F2FE" stroke-width="2"/>
  <circle cx="200" cy="8" r="3" fill="#00F2FE"/>
  <!-- Blueprint Annotation -->
  <text x="200" y="250" text-anchor="middle" fill="#94A3B8" font-family="monospace" font-size="11">ARCHITECTURAL SILHOUETTE • REF #LOC-10</text>
</svg>
`)}`;

const LOGIC_GATE_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 240" width="100%" height="100%">
  <rect width="400" height="240" fill="#0B0F19"/>
  <!-- Grid -->
  <defs>
    <pattern id="circgrid" width="20" height="20" patternUnits="userSpaceOnUse">
      <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#1E293B" stroke-width="0.8"/>
    </pattern>
  </defs>
  <rect width="400" height="240" fill="url(#circgrid)" />
  <!-- Input A Line -->
  <line x1="60" y1="90" x2="160" y2="90" stroke="#38BDF8" stroke-width="2.5"/>
  <circle cx="60" cy="90" r="5" fill="#38BDF8"/>
  <text x="50" y="95" text-anchor="end" fill="#38BDF8" font-family="monospace" font-size="14" font-weight="bold">A = 1</text>
  <!-- Input B Line -->
  <line x1="60" y1="150" x2="160" y2="150" stroke="#38BDF8" stroke-width="2.5"/>
  <circle cx="60" cy="150" r="5" fill="#38BDF8"/>
  <text x="50" y="155" text-anchor="end" fill="#38BDF8" font-family="monospace" font-size="14" font-weight="bold">B = 0</text>
  <!-- XOR Arc 1 (Back arc) -->
  <path d="M 145 70 Q 170 120 145 170" fill="none" stroke="#A855F7" stroke-width="3"/>
  <!-- XOR Body -->
  <path d="M 155 70 Q 180 120 155 170 Q 220 168 265 120 Q 220 72 155 70 Z" fill="#1E1B4B" stroke="#A855F7" stroke-width="3"/>
  <!-- Output Line -->
  <line x1="265" y1="120" x2="330" y2="120" stroke="#10B981" stroke-width="2.5"/>
  <circle cx="330" cy="120" r="5" fill="#10B981"/>
  <text x="345" y="125" text-anchor="start" fill="#10B981" font-family="monospace" font-size="14" font-weight="bold">Y = ?</text>
  <text x="200" y="215" text-anchor="middle" fill="#94A3B8" font-family="monospace" font-size="11">EXCLUSIVE-OR (XOR) BOOLEAN GATE ANALYSIS</text>
</svg>
`)}`;

const SOLAR_PANEL_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 240" width="100%" height="100%">
  <rect width="400" height="240" fill="#0B0F19"/>
  <!-- Sunlight Rays -->
  <line x1="70" y1="30" x2="130" y2="90" stroke="#F59E0B" stroke-width="2" stroke-dasharray="4,4"/>
  <line x1="100" y1="20" x2="160" y2="80" stroke="#F59E0B" stroke-width="2" stroke-dasharray="4,4"/>
  <line x1="130" y1="10" x2="190" y2="70" stroke="#F59E0B" stroke-width="2" stroke-dasharray="4,4"/>
  <circle cx="60" cy="20" r="18" fill="#F59E0B" opacity="0.8"/>
  <text x="75" y="55" fill="#F59E0B" font-family="monospace" font-size="10">Photons (hν)</text>
  <!-- Solar Array Matrix -->
  <g transform="translate(110, 80)">
    <polygon points="0,60 140,20 200,80 60,120" fill="#1E293B" stroke="#00F2FE" stroke-width="2"/>
    <!-- Grid lines -->
    <line x1="70" y1="40" x2="130" y2="100" stroke="#38BDF8" stroke-width="1"/>
    <line x1="30" y1="90" x2="170" y2="50" stroke="#38BDF8" stroke-width="1"/>
    <!-- Pillar -->
    <rect x="95" y="95" width="10" height="40" fill="#334155"/>
  </g>
  <text x="200" y="215" text-anchor="middle" fill="#94A3B8" font-family="monospace" font-size="11">SEMICONDUCTOR P-N JUNCTION • CHECKPOINT #3</text>
</svg>
`)}`;

const CAMPUS_MAP_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 240" width="100%" height="100%">
  <rect width="400" height="240" fill="#0B0F19"/>
  <!-- Paths -->
  <polyline points="70,70 140,50 200,90 280,60 330,110 290,170 200,150 120,180 70,70" fill="none" stroke="#1E293B" stroke-width="3" stroke-dasharray="6,4"/>
  <line x1="200" y1="90" x2="200" y2="150" stroke="#00F2FE" stroke-width="1.5" stroke-opacity="0.4"/>
  <!-- Stations -->
  <circle cx="70" cy="70" r="8" fill="#1E293B" stroke="#38BDF8" stroke-width="2"/>
  <text x="70" y="74" text-anchor="middle" fill="#38BDF8" font-family="monospace" font-size="9" font-weight="bold">1</text>
  <circle cx="140" cy="50" r="8" fill="#1E293B" stroke="#38BDF8" stroke-width="2"/>
  <text x="140" y="54" text-anchor="middle" fill="#38BDF8" font-family="monospace" font-size="9" font-weight="bold">2</text>
  <circle cx="280" cy="60" r="8" fill="#1E293B" stroke="#38BDF8" stroke-width="2"/>
  <text x="280" y="64" text-anchor="middle" fill="#38BDF8" font-family="monospace" font-size="9" font-weight="bold">4</text>
  <circle cx="330" cy="110" r="8" fill="#1E293B" stroke="#38BDF8" stroke-width="2"/>
  <text x="330" y="114" text-anchor="middle" fill="#38BDF8" font-family="monospace" font-size="9" font-weight="bold">6</text>
  <circle cx="290" cy="170" r="8" fill="#1E293B" stroke="#38BDF8" stroke-width="2"/>
  <text x="290" y="174" text-anchor="middle" fill="#38BDF8" font-family="monospace" font-size="9" font-weight="bold">8</text>
  <!-- Station 10 Highlight (Target) -->
  <circle cx="200" cy="120" r="16" fill="#10B981" fill-opacity="0.2" stroke="#10B981" stroke-width="2"/>
  <circle cx="200" cy="120" r="9" fill="#10B981"/>
  <text x="200" y="124" text-anchor="middle" fill="#000" font-family="monospace" font-size="9" font-weight="bold">10</text>
  <text x="200" y="215" text-anchor="middle" fill="#94A3B8" font-family="monospace" font-size="11">CAMPUS TOPOLOGICAL ORIENTEERING GRAPH</text>
</svg>
`)}`;

export const INITIAL_RIDDLES: Riddle[] = [
  // Round 1: TEXT_RIDDLE (Question & Text Answer)
  {
    id: 'puz-1',
    roundNumber: 1,
    title: 'Historical Computing Pioneer',
    puzzleType: 'TEXT_RIDDLE',
    descriptionMd: 'In 1936, which British mathematician and logician introduced the universal computing machine model and subsequently decrypted Naval Enigma signals at Bletchley Park?\n\nEnter the scientist\'s surname.',
    acceptedAnswers: ['turing', 'alan turing', 'alan mathison turing'],
    caseSensitive: false,
    normalizeWhitespace: true,
    maxAttempts: 5,
    hints: ['Namesake of the prestigious ACM award often referred to as the Nobel Prize of Computing.'],
    published: true,
  },

  // Round 2: MCQ (Question & 4 Single-Choice Options)
  {
    id: 'puz-2',
    roundNumber: 2,
    title: 'Algorithmic Time Complexity',
    puzzleType: 'MCQ',
    descriptionMd: 'What is the asymptotic worst-case time complexity of binary search executed on a sorted array of $N$ elements?',
    options: [
      'O(1) - Constant Time',
      'O(log N) - Logarithmic Time',
      'O(N) - Linear Time',
      'O(N log N) - Linearithmic Time',
    ],
    correctOptionIndex: 1,
    acceptedAnswers: ['O(log N) - Logarithmic Time', 'B', '1', 'o(log n)', 'ologn'],
    caseSensitive: false,
    normalizeWhitespace: true,
    maxAttempts: 5,
    hints: ['At each comparison step, the search range is partitioned strictly in half.'],
    published: true,
  },

  // Round 3: IMAGE_QUIZ (Image & Text Answer)
  {
    id: 'puz-3',
    roundNumber: 3,
    title: 'Historic Campus Monument Architecture',
    puzzleType: 'IMAGE_QUIZ',
    descriptionMd: 'Examine the architectural silhouette schematic below. Built in 1928, this monumental four-faced timekeeping structure marks Checkpoint #10 overlooking the Administration Lawn.\n\nWhat is the two-word architectural term for this landmark?',
    imageUrl: CLOCK_TOWER_SVG,
    imageAlt: 'Blueprint elevation schematic of historical four-faced campus clock tower',
    acceptedAnswers: ['clock tower', 'the clock tower', 'clocktower'],
    caseSensitive: false,
    normalizeWhitespace: true,
    maxAttempts: 5,
    hints: ['It chimes at every hour overlooking the Administration Lawn at Location #10.'],
    published: true,
  },

  // Round 4: IMAGE_MCQ (Image & 4 Options)
  {
    id: 'puz-4',
    roundNumber: 4,
    title: 'Digital Logic Gate Analysis',
    puzzleType: 'IMAGE_MCQ',
    descriptionMd: 'Examine the digital logic schematic below. When input signals $A = 1$ and $B = 0$ are applied to this standard Exclusive-OR (XOR) gate, what is the resulting output state $Y$?',
    imageUrl: LOGIC_GATE_SVG,
    imageAlt: 'Logic diagram of a 2-input XOR gate with inputs A=1 and B=0',
    options: [
      'Y = 0 (Logic Low)',
      'Y = 1 (Logic High)',
      'High Impedance (Floating)',
      'Oscillating Undefined',
    ],
    correctOptionIndex: 1,
    acceptedAnswers: ['Y = 1 (Logic High)', 'B', '1', '1', 'y = 1', 'high'],
    caseSensitive: false,
    normalizeWhitespace: true,
    maxAttempts: 5,
    hints: ['XOR outputs 1 if and only if the two binary inputs are strictly different.'],
    published: true,
  },

  // Round 5: TEXT_RIDDLE (Hexadecimal ASCII Decoding)
  {
    id: 'puz-5',
    roundNumber: 5,
    title: 'Hexadecimal ASCII Memory Stream',
    puzzleType: 'TEXT_RIDDLE',
    descriptionMd: 'A sensor beacon at Checkpoint 5 transmitted this hexadecimal byte array:\n`54 72 65 61 73 75 72 65`\n\nConvert the hexadecimal ASCII bytes into human-readable text.',
    acceptedAnswers: ['treasure', 'Treasure'],
    caseSensitive: false,
    normalizeWhitespace: true,
    maxAttempts: 5,
    hints: ['0x54 = 84 = "T", 0x72 = 114 = "r", 0x65 = 101 = "e"...'],
    published: true,
  },

  // Round 6: MCQ (Logic & Deduction)
  {
    id: 'puz-6',
    roundNumber: 6,
    title: 'Knights, Knaves, and the Fork in the Trail',
    puzzleType: 'MCQ',
    descriptionMd: 'Two guards stand at a fork in the trail. One always tells the truth; the other always lies.\n\nYou ask: *"Which road would the other guard say is the right one?"*\n\nIf the guard answers "Left", which path must you take?',
    options: [
      'Take the Left Road',
      'Take the Right Road',
      'Stay at the fork and wait',
      'Turn around back to Quad',
    ],
    correctOptionIndex: 1,
    acceptedAnswers: ['Take the Right Road', 'B', '1', 'right', 'the right road', 'right path'],
    caseSensitive: false,
    normalizeWhitespace: true,
    maxAttempts: 5,
    hints: ['Both the truth-teller and the liar will point you to the false road. Therefore, pick the opposite.'],
    published: true,
  },

  // Round 7: IMAGE_QUIZ (Engineering Schematic)
  {
    id: 'puz-7',
    roundNumber: 7,
    title: 'Solar Showcase Semiconductor Effect',
    puzzleType: 'IMAGE_QUIZ',
    descriptionMd: 'Examine the technical schematic of Checkpoint #3. What fundamental physical effect enables these semiconductor P-N junction panels to convert incident solar photons directly into electrical voltage?',
    imageUrl: SOLAR_PANEL_SVG,
    imageAlt: 'Semiconductor P-N junction solar panel receiving incident photons',
    acceptedAnswers: ['photovoltaic', 'photovoltaic effect', 'photoelectric', 'photoelectric effect'],
    caseSensitive: false,
    normalizeWhitespace: true,
    maxAttempts: 5,
    hints: ['Often abbreviated as the "PV" effect.'],
    published: true,
  },

  // Round 8: MCQ (Cipher Decryption)
  {
    id: 'puz-8',
    roundNumber: 8,
    title: 'Polyalphabetic Vigenère Decryption',
    puzzleType: 'MCQ',
    descriptionMd: 'Decrypt the polyalphabetic ciphertext `KSVRR` encoded using the standard 26-letter Vigenère cipher with the secret keyword `ARENA`.',
    options: [
      'ATLAS',
      'KUDOS',
      'RADAR',
      'CYBER',
    ],
    correctOptionIndex: 1,
    acceptedAnswers: ['KUDOS', 'B', '1', 'kudos'],
    caseSensitive: false,
    normalizeWhitespace: true,
    maxAttempts: 5,
    hints: ['Plaintext = (Ciphertext - Key) mod 26. K - A = K, S - R = U, V - E = D, R - N = O, R - A = S.'],
    published: true,
  },

  // Round 9: MCQ (Probability Enigma)
  {
    id: 'puz-9',
    roundNumber: 9,
    title: 'The Monty Hall Probability Enigma',
    puzzleType: 'MCQ',
    descriptionMd: 'In the classic 3-door Monty Hall problem (1 car prize, 2 goats), after you choose Door 1, the host opens Door 3 revealing a goat and offers you the chance to switch to Door 2.\n\nWhat is your probability of winning if you switch?',
    options: [
      '1/3 (33.3% chance)',
      '1/2 (50.0% chance)',
      '2/3 (66.7% chance)',
      '3/4 (75.0% chance)',
    ],
    correctOptionIndex: 2,
    acceptedAnswers: ['2/3 (66.7% chance)', 'C', '2', '2/3', '0.667', '66.7%'],
    caseSensitive: false,
    normalizeWhitespace: true,
    maxAttempts: 5,
    hints: ['Your initial choice had a 1/3 probability. The remaining 2/3 probability shifts entirely to Door 2.'],
    published: true,
  },

  // Round 10: IMAGE_MCQ (Campus Orienteering Finale)
  {
    id: 'puz-10',
    roundNumber: 10,
    title: 'Championship Orienteering Finale Hub',
    puzzleType: 'IMAGE_MCQ',
    descriptionMd: 'Review the campus topological graph below. Which campus checkpoint serves as the central hub (#10) at the base of the clock tower where all finalists converge?',
    imageUrl: CAMPUS_MAP_SVG,
    imageAlt: 'Campus topological orienteering map showing numbered stations with node 10 highlighted',
    options: [
      'Station #10 - Administration Lawn (Clock Tower Base)',
      'Station #4 - Student Center (Quad Steps)',
      'Station #1 - Main Library (Atrium)',
      'Station #8 - Sports Complex (Pavilion Deck)',
    ],
    correctOptionIndex: 0,
    acceptedAnswers: ['Station #10 - Administration Lawn (Clock Tower Base)', 'A', '0', '10', 'clock tower base'],
    caseSensitive: false,
    normalizeWhitespace: true,
    maxAttempts: 5,
    hints: ['Look at the green highlighted circular node labeled "10" at the central convergence point.'],
    published: true,
  },
];

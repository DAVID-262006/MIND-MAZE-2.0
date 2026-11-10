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

export const INITIAL_RIDDLES: Riddle[] = [
  {
    id: 'puz-1',
    roundNumber: 1,
    title: 'Array Anomaly Scanner',
    puzzleType: 'coding',
    descriptionMd: 'Given an array of integers `nums`, find the single element that appears exactly once where every other element appears twice.\n\n### Constraints\n- $1 \\le nums.length \\le 3 \\times 10^4$\n- $-3 \\times 10^4 \\le nums[i] \\le 3 \\times 10^4$\n- Solution must execute with linear O(N) runtime and constant extra space.',
    acceptedAnswers: ['4', 'ans^=n', 'xor'],
    caseSensitive: false,
    normalizeWhitespace: true,
    maxAttempts: 5,
    hints: ['Consider bitwise XOR (`^`). Any number XORed with itself is zero (A ^ A = 0), and 0 ^ A = A.'],
    published: true,
    allowedLanguages: ['c', 'cpp', 'python', 'java'],
    sampleCases: [
      { input: '4 1 2 1 2', expectedOutput: '4', explanation: '4 is unique, while 1 and 2 appear twice' }
    ],
    hiddenCases: [
      { input: '2 2 1', expectedOutput: '1' },
      { input: '99', expectedOutput: '99' }
    ],
    starterCode: {
      python: `# Python 3\n# Given nums = [4, 1, 2, 1, 2], return single element\ndef solve(nums):\n    ans = 0\n    for n in nums:\n        ans ^= n\n    return ans`,
      cpp: `// C++20\n#include <vector>\nusing namespace std;\n\nint solve(vector<int>& nums) {\n    int ans = 0;\n    for (int n : nums) ans ^= n;\n    return ans;\n}`,
      java: `// Java 17\npublic class Solution {\n    public int solve(int[] nums) {\n        int ans = 0;\n        for (int n : nums) ans ^= n;\n        return ans;\n    }\n}`,
      c: `// C11\nint solve(int* nums, int numsSize) {\n    int ans = 0;\n    for (int i = 0; i < numsSize; i++) ans ^= nums[i];\n    return ans;\n}`
    }
  },
  {
    id: 'puz-2',
    roundNumber: 2,
    title: 'The Enigma of Caesar + 7',
    puzzleType: 'crypto',
    descriptionMd: 'An intercepted operational dispatch on the campus radio is encrypted with Caesar shift key 7: `OLSSV DVYSK`.\n\nDecrypt the ciphertext to recover the plaintext authentication passphrase.',
    acceptedAnswers: ['hello world', 'helloworld'],
    caseSensitive: false,
    normalizeWhitespace: true,
    maxAttempts: 5,
    hints: ['Shift each letter backward by 7 positions in the alphabet: O - 7 = H, L - 7 = E, S - 7 = L...'],
    published: true,
    sampleCases: [
      { input: 'OLSSV DVYSK', expectedOutput: 'HELLO WORLD', explanation: 'Caesar shift -7' }
    ]
  },
  {
    id: 'puz-3',
    roundNumber: 3,
    title: 'Recursive Fibonacci Modulo',
    puzzleType: 'logic',
    descriptionMd: 'A campus router transmits packets according to the standard Fibonacci sequence:\n$$F(0) = 0,\\quad F(1) = 1,\\quad F(n) = F(n-1) + F(n-2)$$\n\nWhat is the exact value of $F(10) \\pmod{10}$?',
    acceptedAnswers: ['5', '5.0', '55 mod 10 = 5', 'f(10) = 55'],
    caseSensitive: false,
    normalizeWhitespace: true,
    maxAttempts: 5,
    hints: ['Compute sequence: 0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55. What is 55 modulo 10?'],
    published: true
  },
  {
    id: 'puz-4',
    roundNumber: 4,
    title: 'Historical Computing Pioneer',
    puzzleType: 'text',
    descriptionMd: 'In 1936, which British mathematician and logician introduced the universal computing machine model and subsequently decrypted Naval Enigma signals at Bletchley Park?\n\nEnter the scientist\'s surname.',
    acceptedAnswers: ['turing', 'alan turing', 'alan mathison turing'],
    caseSensitive: false,
    normalizeWhitespace: true,
    maxAttempts: 5,
    hints: ['Namesake of the prestigious ACM award often referred to as the Nobel Prize of Computing.'],
    published: true
  },
  {
    id: 'puz-5',
    roundNumber: 5,
    title: 'Hexadecimal ASCII Memory Stream',
    puzzleType: 'crypto',
    descriptionMd: 'A sensor beacon at Checkpoint 5 transmitted this hexadecimal byte array:\n`54 72 65 61 73 75 72 65`\n\nConvert the hexadecimal ASCII bytes into human-readable text.',
    acceptedAnswers: ['treasure', 'Treasure'],
    caseSensitive: false,
    normalizeWhitespace: true,
    maxAttempts: 5,
    hints: ['0x54 = 84 = "T", 0x72 = 114 = "r", 0x65 = 101 = "e"...'],
    published: true,
    sampleCases: [
      { input: '54 72 65 61 73 75 72 65', expectedOutput: 'Treasure', explanation: 'Hex ASCII decoding' }
    ]
  },
  {
    id: 'puz-6',
    roundNumber: 6,
    title: 'Knights, Knaves, and the Fork in the Trail',
    puzzleType: 'logic',
    descriptionMd: 'Two guards stand at a fork in the trail. One always tells the truth; the other always lies.\n\nTo find the correct checkpoint, you ask: *"Which road would the other guard say is the right one?"*\n\nIf the guard answers "Left", which road must you take? (Enter "Left" or "Right")',
    acceptedAnswers: ['right', 'take right', 'the right road', 'right path'],
    caseSensitive: false,
    normalizeWhitespace: true,
    maxAttempts: 5,
    hints: ['Both the truth-teller and the liar will point you to the incorrect road! Therefore, choose the opposite.'],
    published: true
  },
  {
    id: 'puz-7',
    roundNumber: 7,
    title: 'Historic Campus Monument Architecture',
    puzzleType: 'text',
    descriptionMd: 'The campus centerpiece was constructed in 1928 with a monumental four-faced timekeeping structure overlooking the Administration Lawn.\n\nWhat is the two-word architectural term for this central historical tower?',
    acceptedAnswers: ['clock tower', 'the clock tower', 'clocktower'],
    caseSensitive: false,
    normalizeWhitespace: true,
    maxAttempts: 5,
    hints: ['It chimes at every hour overlooking the Administration Lawn at Location #10.'],
    published: true
  },
  {
    id: 'puz-8',
    roundNumber: 8,
    title: 'Polyalphabetic Vigenère Decryption',
    puzzleType: 'crypto',
    descriptionMd: 'Decrypt the polyalphabetic ciphertext `KSVRR` encoded using the standard 26-letter Vigenère cipher with the secret keyword `ARENA`.',
    acceptedAnswers: ['kudos', 'KUDOS'],
    caseSensitive: false,
    normalizeWhitespace: true,
    maxAttempts: 5,
    hints: ['Plaintext = (Ciphertext - Key) mod 26. K - A = K, S - R = U, V - E = D, R - N = O, R - A = S.'],
    published: true,
    sampleCases: [
      { input: 'Ciphertext: KSVRR, Key: ARENA', expectedOutput: 'KUDOS', explanation: 'Vigenere shift subtraction' }
    ]
  },
  {
    id: 'puz-9',
    roundNumber: 9,
    title: 'The Monty Hall Probability Enigma',
    puzzleType: 'logic',
    descriptionMd: 'In the classic 3-door Monty Hall problem (1 prize, 2 goats), after you choose Door 1, the host opens Door 3 revealing a goat and offers you the chance to switch to Door 2.\n\nWhat is your probability of winning if you switch? Express your answer as a simplified fraction (e.g. `2/3`).',
    acceptedAnswers: ['2/3', '2 / 3', '0.667', '0.67', '66.7%'],
    caseSensitive: false,
    normalizeWhitespace: true,
    maxAttempts: 5,
    hints: ['Your initial door has a 1/3 chance of winning. Switching gives you the remaining 2/3 probability!'],
    published: true
  },
  {
    id: 'puz-10',
    roundNumber: 10,
    title: 'Championship Target Checkpoint Pair',
    puzzleType: 'coding',
    descriptionMd: 'Given an array of integers `nums` and an integer `target`, return indices of the two numbers such that they add up to `target`. Exactly one solution exists. Output space-separated 0-indexed integers.\n\n### Sample Input\n`2 7 11 15`\n`9`\n\n### Expected Output\n`0 1` (since nums[0] + nums[1] = 2 + 7 = 9)',
    acceptedAnswers: ['0 1', '1 0', '0, 1', '[0, 1]', '0,1'],
    caseSensitive: false,
    normalizeWhitespace: true,
    maxAttempts: 5,
    hints: ['Use a hash map to look up complements in linear O(N) time.'],
    published: true,
    allowedLanguages: ['c', 'cpp', 'python', 'java'],
    sampleCases: [
      { input: '2 7 11 15\n9', expectedOutput: '0 1', explanation: 'nums[0] + nums[1] = 2 + 7 = 9' }
    ],
    hiddenCases: [
      { input: '3 2 4\n6', expectedOutput: '1 2' },
      { input: '3 3\n6', expectedOutput: '0 1' }
    ],
    starterCode: {
      python: `# Python 3\ndef two_sum(nums, target):\n    lookup = {}\n    for i, n in enumerate(nums):\n        diff = target - n\n        if diff in lookup:\n            return [lookup[diff], i]\n        lookup[n] = i\n    return []`,
      cpp: `// C++20\n#include <vector>\n#include <unordered_map>\nusing namespace std;\n\nvector<int> twoSum(vector<int>& nums, int target) {\n    unordered_map<int, int> m;\n    for (int i = 0; i < nums.size(); i++) {\n        int comp = target - nums[i];\n        if (m.count(comp)) return {m[comp], i};\n        m[nums[i]] = i;\n    }\n    return {};\n}`,
      java: `// Java 17\nimport java.util.HashMap;\npublic class Solution {\n    public int[] twoSum(int[] nums, int target) {\n        HashMap<Integer, Integer> map = new HashMap<>();\n        for (int i = 0; i < nums.length; i++) {\n            int comp = target - nums[i];\n            if (map.containsKey(comp)) return new int[] { map.get(comp), i };\n            map.put(nums[i], i);\n        }\n        return new int[0];\n    }\n}`
    }
  }
];


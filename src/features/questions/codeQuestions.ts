// ==============================================================================
// MIND MAZE 2.0 — FRONTEND CODE-BASED QUESTIONS (ROUNDS 1, 3, 5, 7, 9)
// Stored strictly on frontend. Never sent to or stored in Supabase.
// ==============================================================================

import type { CodeQuestion } from './types';

export const BASELINE_CODE_QUESTIONS: CodeQuestion[] = [
  {
    id: 'code-puz-1',
    roundNumber: 1,
    questionType: 'CODE_BASED',
    title: 'The Turing Harmonic Sequence',
    descriptionMd: `### Challenge: The Turing Harmonic Sum
Alan Turing's experimental cipher machine generates key indices using a sequence defined as:
\`\`\`
T(n) = (n * 3) + (n % 2 === 0 ? n / 2 : n * 2)
\`\`\`

Write a function \`solve(n)\` that computes the sum of $T(k)$ for all integers $k$ from $1$ up to $n$ inclusive.

**Example:**
* Input: \`3\`
* Calculation:
  * $k=1$: $(1 \\times 3) + (1 \\times 2) = 5$
  * $k=2$: $(2 \\times 3) + (2 / 2) = 7$
  * $k=3$: $(3 \\times 3) + (3 \\times 2) = 15$
  * Total Sum: $5 + 7 + 15 = 27$
* Output: \`27\``,
    language: 'javascript',
    starterCode: `function solve(n) {
  // Your code here
  let total = 0;
  for (let k = 1; k <= n; k++) {
    const term = (k * 3) + (k % 2 === 0 ? k / 2 : k * 2);
    total += term;
  }
  return total;
}`,
    testCases: [
      { id: 'tc-1-1', input: '3', expectedOutput: '27' },
      { id: 'tc-1-2', input: '1', expectedOutput: '5' },
      { id: 'tc-1-3', input: '5', expectedOutput: '66', isHidden: true },
    ],
    hints: [
      'Iterate k from 1 to n.',
      'Check whether k is even using k % 2 === 0.',
      'Accumulate each term into a total variable.',
    ],
    maxAttempts: 10,
  },
  {
    id: 'code-puz-3',
    roundNumber: 3,
    questionType: 'CODE_BASED',
    title: 'Solar Grid Matrix Balancer',
    descriptionMd: `### Challenge: Solar Cell Voltage Matrix
The Engineering Block solar array monitors panels in a square grid of size $N \\times N$.
Due to shadow occlusions, panel readings must be balanced by calculating the sum of values on both primary and secondary diagonals.

Write a function \`solve(grid)\` that takes an $N \\times N$ 2D array of numbers and returns the sum of all elements lying on either the main diagonal or the anti-diagonal. If an element lies at the center intersection (odd $N$), count it only once.

**Example:**
\`\`\`json
[[1, 2, 3],
 [4, 5, 6],
 [7, 8, 9]]
\`\`\`
* Main diagonal: 1, 5, 9
* Anti-diagonal: 3, 5, 7
* Sum (5 counted once): $1 + 5 + 9 + 3 + 7 = 25$`,
    language: 'javascript',
    starterCode: `function solve(grid) {
  // Your code here
  const n = grid.length;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    sum += grid[i][i]; // Main diagonal
    if (i !== n - 1 - i) {
      sum += grid[i][n - 1 - i]; // Anti-diagonal
    }
  }
  return sum;
}`,
    testCases: [
      {
        id: 'tc-3-1',
        input: '[[1,2,3],[4,5,6],[7,8,9]]',
        expectedOutput: '25',
      },
      {
        id: 'tc-3-2',
        input: '[[5]]',
        expectedOutput: '5',
      },
      {
        id: 'tc-3-3',
        input: '[[1,1,1,1],[1,1,1,1],[1,1,1,1],[1,1,1,1]]',
        expectedOutput: '8',
        isHidden: true,
      },
    ],
    hints: [
      'A single loop over i from 0 to n-1 is sufficient.',
      'Main diagonal coordinate is grid[i][i].',
      'Anti-diagonal coordinate is grid[i][n - 1 - i].',
    ],
    maxAttempts: 10,
  },
  {
    id: 'code-puz-5',
    roundNumber: 5,
    questionType: 'CODE_BASED',
    title: 'G-Code Layer Perimeter Calculator',
    descriptionMd: `### Challenge: 3D Print Extrusion Perimeter
The Innovation Hub 3D printer executes coordinates along a polygonal boundary for each layer.
Write a function \`solve(coords)\` that takes an array of 2D points \`[[x1, y1], [x2, y2], ..., [xn, yn]]\` forming a closed polygon (with consecutive points connected, plus the last connected back to the first), and calculates the total Euclidean perimeter rounded to two decimal places.

**Formula:**
$$\\text{Distance} = \\sqrt{(x_2 - x_1)^2 + (y_2 - y_1)^2}$$`,
    language: 'javascript',
    starterCode: `function solve(coords) {
  // Your code here
  let perimeter = 0;
  const n = coords.length;
  for (let i = 0; i < n; i++) {
    const next = (i + 1) % n;
    const dx = coords[next][0] - coords[i][0];
    const dy = coords[next][1] - coords[i][1];
    perimeter += Math.sqrt(dx * dx + dy * dy);
  }
  return Math.round(perimeter * 100) / 100;
}`,
    testCases: [
      {
        id: 'tc-5-1',
        input: '[[0,0],[3,0],[3,4],[0,4]]',
        expectedOutput: '14',
      },
      {
        id: 'tc-5-2',
        input: '[[0,0],[0,3],[4,0]]',
        expectedOutput: '12',
      },
      {
        id: 'tc-5-3',
        input: '[[1,1],[4,5],[7,1]]',
        expectedOutput: '16',
        isHidden: true,
      },
    ],
    hints: [
      'Use Euclidean distance formula between consecutive vertex pairs.',
      'Connect the last point back to the first point using index (i + 1) % n.',
      'Round the final sum using Math.round(val * 100) / 100.',
    ],
    maxAttempts: 10,
  },
  {
    id: 'code-puz-7',
    roundNumber: 7,
    questionType: 'CODE_BASED',
    title: 'Acoustic Frequency Decibel Normalizer',
    descriptionMd: `### Challenge: Auditorium Audio Filter
The auditorium digital audio console registers sound pressure waveforms. In acoustic analysis, peaks above a noise floor threshold $T$ must be normalized.

Write a function \`solve(readings, threshold)\` that accepts an array of positive decibel numbers and a threshold $T$:
1. Filters out all readings strictly below threshold $T$.
2. For all remaining readings, scales them: $\\text{scaled} = (v - T)^2$.
3. Returns the integer sum of all scaled values.

**Example:**
* Input: \`([40, 65, 80, 50, 95], 60)\`
* Filtered ($\\ge 60$): \`[65, 80, 95]\`
* Scaled:
  * $(65 - 60)^2 = 25$
  * $(80 - 60)^2 = 400$
  * $(95 - 60)^2 = 1225$
* Sum: $25 + 400 + 1225 = 1650$`,
    language: 'javascript',
    starterCode: `function solve(readings, threshold) {
  // Your code here
  return readings
    .filter((v) => v >= threshold)
    .map((v) => Math.pow(v - threshold, 2))
    .reduce((acc, curr) => acc + curr, 0);
}`,
    testCases: [
      {
        id: 'tc-7-1',
        input: '[40, 65, 80, 50, 95], 60',
        expectedOutput: '1650',
      },
      {
        id: 'tc-7-2',
        input: '[10, 20, 30], 50',
        expectedOutput: '0',
      },
      {
        id: 'tc-7-3',
        input: '[70, 75, 85], 70',
        expectedOutput: '250',
        isHidden: true,
      },
    ],
    hints: [
      'Filter readings where reading >= threshold.',
      'Compute (v - threshold) squared for each filtered element.',
      'Sum the values.',
    ],
    maxAttempts: 10,
  },
  {
    id: 'code-puz-9',
    roundNumber: 9,
    questionType: 'CODE_BASED',
    title: 'The Master Mind Maze Arc Optimization',
    descriptionMd: `### Challenge: Championship Graph Flow
Connecting Tower 1 and Tower 2 across the central arcade requires routing data packets across $K$ gateway routers.

Write a function \`solve(hops)\` that takes an array of integers representing the bandwidth capacity of each consecutive link in a route, and returns the maximum single-hop drop:
$$\\text{drop} = \\max_{0 \\le i < n - 1} (hops[i] - hops[i+1])$$
If bandwidth never decreases from one hop to the next, return \`0\`.

**Example:**
* Input: \`[100, 85, 90, 60, 40]\`
* Drops:
  * $100 - 85 = 15$
  * $85 - 90 = -5$
  * $90 - 60 = 30$
  * $60 - 40 = 20$
* Maximum drop: \`30\``,
    language: 'javascript',
    starterCode: `function solve(hops) {
  // Your code here
  let maxDrop = 0;
  for (let i = 0; i < hops.length - 1; i++) {
    const drop = hops[i] - hops[i + 1];
    if (drop > maxDrop) {
      maxDrop = drop;
    }
  }
  return maxDrop;
}`,
    testCases: [
      {
        id: 'tc-9-1',
        input: '[100, 85, 90, 60, 40]',
        expectedOutput: '30',
      },
      {
        id: 'tc-9-2',
        input: '[10, 20, 30, 40]',
        expectedOutput: '0',
      },
      {
        id: 'tc-9-3',
        input: '[500, 100, 50, 20]',
        expectedOutput: '400',
        isHidden: true,
      },
    ],
    hints: [
      'Loop from index 0 to length - 2.',
      'Compare hops[i] - hops[i+1].',
      'Track the running maximum difference, starting at 0.',
    ],
    maxAttempts: 10,
  },
];

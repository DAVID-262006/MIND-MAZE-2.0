// ==============================================================================
// MIND MAZE 2.0 — FRONTEND THREE-PART TEXT QUESTIONS (ROUNDS 2, 4, 6, 8)
// Stored strictly on frontend. Never sent to or stored in Supabase.
// ==============================================================================

import type { ThreePartQuestion } from './types';

export const BASELINE_THREE_PART_QUESTIONS: ThreePartQuestion[] = [
  {
    id: 'three-puz-2',
    roundNumber: 2,
    questionType: 'THREE_PART_TEXT',
    title: 'Computer Architecture & Von Neumann Triad',
    descriptionMd: `### Challenge: The Von Neumann Architecture Triad
Identify the three fundamental architectural components of the classical computer system. Provide the concise technical terms for each prompt.`,
    promptA: 'Part 1: The register in the CPU that holds the address of the next instruction to be fetched from memory.',
    acceptedAnswersA: ['program counter', 'pc', 'instruction pointer', 'ip'],
    promptB: 'Part 2: The high-speed volatile storage technology fabricated with flip-flops directly on the CPU die (L1/L2/L3).',
    acceptedAnswersB: ['sram', 'static ram', 'cache', 'static random access memory', 'cpu cache'],
    promptC: 'Part 3: The hardware signal line that temporarily suspends the CPU execution stream to handle an asynchronous I/O event.',
    acceptedAnswersC: ['interrupt', 'irq', 'interrupt request'],
    hints: [
      'Part 1: Often abbreviated PC in processor block diagrams.',
      'Part 2: Faster than DRAM because it does not require periodic capacitor refreshing.',
      'Part 3: A hardware notification that triggers an Interrupt Service Routine (ISR).',
    ],
    maxAttempts: 10,
    caseSensitive: false,
  },
  {
    id: 'three-puz-4',
    roundNumber: 4,
    questionType: 'THREE_PART_TEXT',
    title: 'Internet Protocol Suite & Networking Triad',
    descriptionMd: `### Challenge: Network Protocols & Port Architecture
Identify the core protocol standards and default port assignments governing TCP/IP communications.`,
    promptA: 'Part 1: What is the default transport-layer port number allocated for encrypted DNS over HTTPS (DoH)?',
    acceptedAnswersA: ['443', 'port 443'],
    promptB: 'Part 2: Which link-state routing protocol calculates shortest path trees within an Autonomous System using Dijkstra’s algorithm?',
    acceptedAnswersB: ['ospf', 'open shortest path first'],
    promptC: 'Part 3: Which security protocol operating at OSI Layer 4 provides session encryption using TLS record and handshake subprotocols?',
    acceptedAnswersC: ['tls', 'transport layer security', 'ssl/tls'],
    hints: [
      'Part 1: DoH multiplexes across standard HTTPS port traffic.',
      'Part 2: Open Shortest Path First.',
      'Part 3: Successor to Secure Sockets Layer (SSL).',
    ],
    maxAttempts: 10,
    caseSensitive: false,
  },
  {
    id: 'three-puz-6',
    roundNumber: 6,
    questionType: 'THREE_PART_TEXT',
    title: 'Computational Complexity & Algorithms Triad',
    descriptionMd: `### Challenge: Complexity Classes & Algorithmic Bounds
Identify the formal theoretical properties that characterize algorithmic efficiency and intractability.`,
    promptA: 'Part 1: What is the tight asymptotic lower bound (Big-Omega) for comparison-based sorting of n arbitrary elements?',
    acceptedAnswersA: ['omega(n log n)', 'n log n', 'o(n log n)', 'omega(nlogn)', 'nlogn'],
    promptB: 'Part 2: What complexity class contains decision problems solvable in polynomial time on a deterministic Turing machine?',
    acceptedAnswersB: ['p', 'class p', 'polynomial time'],
    promptC: 'Part 3: What fundamental data structure paradigm stores keys using a hash function, resolving collisions via linked buckets or open addressing?',
    acceptedAnswersC: ['hash table', 'hash map', 'hashmap', 'hashtable', 'hash table data structure'],
    hints: [
      'Part 1: Derived from Stirling’s approximation of log(n!).',
      'Part 2: The polynomial class in the P versus NP millennium prize problem.',
      'Part 3: Provides average-case O(1) key lookup.',
    ],
    maxAttempts: 10,
    caseSensitive: false,
  },
  {
    id: 'three-puz-8',
    roundNumber: 8,
    questionType: 'THREE_PART_TEXT',
    title: 'Modern Cryptography & Security Triad',
    descriptionMd: `### Challenge: Cryptographic Primitives & Key Exchange
Identify the mathematical structures and algorithms underlying public-key cryptography and secure communications.`,
    promptA: 'Part 1: What is the mathematical problem whose intractability secures the standard Diffie-Hellman and ElGamal schemes?',
    acceptedAnswersA: ['discrete logarithm', 'discrete log', 'dlp', 'discrete logarithm problem'],
    promptB: 'Part 2: In asymmetric RSA encryption, what arithmetic operation is performed with the private exponent d and ciphertext c modulo n?',
    acceptedAnswersB: ['modular exponentiation', 'exponentiation', 'power mod', 'modular power'],
    promptC: 'Part 3: What secure cryptographic hash standard developed by NIST in 2015 uses the sponge construction based on Keccak?',
    acceptedAnswersC: ['sha-3', 'sha3', 'keccak'],
    hints: [
      'Part 1: Solving g^x = y mod p for unknown x.',
      'Part 2: Computing c^d mod n.',
      'Part 3: SHA-3 (FIPS 202).',
    ],
    maxAttempts: 10,
    caseSensitive: false,
  },
];

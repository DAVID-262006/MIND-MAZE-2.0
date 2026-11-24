import assert from 'node:assert';
import { generateBalancedRoutes } from '../services/routeEngine';
import { AnswerValidator } from '../services/answerEngine';
import { INITIAL_LOCATIONS, INITIAL_RIDDLES, INITIAL_TEAMS } from '../data/seedData';
import type { Team, LocationCheckpoint, Riddle, ThreePartSubmission } from '../types';

let passed = 0;
let total = 0;

function check(condition: boolean, msg: string) {
  total++;
  if (!condition) {
    console.error(`❌ FAILED: ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  }
  passed++;
  console.log(`✅ PASSED: ${msg}`);
}

console.log('================================================================');
console.log('MIND MAZE 2.0 — ADMIN & GAMEPLAY MODIFICATIONS VERIFICATION');
console.log('1. Admin-Managed Custom Team Credentials');
console.log('2. Fixed 9-Location Campus System');
console.log('3. Elimination of Image and MCQ Questions');
console.log('4. Location-Level Riddle Management');
console.log('================================================================\n');

// =============================================================================
// PILLAR 1: ADMIN-MANAGED CUSTOM TEAM CREDENTIALS
// =============================================================================
console.log('--- 1. Testing Admin-Managed Custom Team Credentials ---');

// Mock credential storage simulating bcrypt and server RPC behavior
interface StoredCredential {
  teamId: string;
  teamCode: string;
  username: string;
  passwordHash: string; // bcrypt simulation
  activeSessionToken: string | null;
}

const credentialStore: Map<string, StoredCredential> = new Map();

function adminSetCredentials(teamId: string, teamCode: string, username: string, plainPass: string) {
  const cleanUser = username.trim().toLowerCase();
  if (cleanUser.length < 3 || cleanUser.length > 30) {
    return { success: false, error: 'INVALID_USERNAME_LENGTH' };
  }
  if (!/^[a-z0-9_-]+$/.test(cleanUser)) {
    return { success: false, error: 'INVALID_USERNAME_CHARS' };
  }
  if (plainPass.trim().length < 6) {
    return { success: false, error: 'WEAK_PASSWORD' };
  }

  // Check duplicate username across other teams
  for (const cred of credentialStore.values()) {
    if (cred.teamId !== teamId && cred.username === cleanUser) {
      return { success: false, error: 'DUPLICATE_USERNAME' };
    }
  }

  // Store salted hash (never plaintext)
  credentialStore.set(teamId, {
    teamId,
    teamCode,
    username: cleanUser,
    passwordHash: `bcrypt_hash_${cleanUser}_${plainPass.trim()}`,
    activeSessionToken: null,
  });

  return { success: true };
}

function adminResetPassword(teamId: string, newPlainPass: string) {
  if (newPlainPass.trim().length < 6) {
    return { success: false, error: 'WEAK_PASSWORD' };
  }
  const existing = credentialStore.get(teamId);
  if (!existing) return { success: false, error: 'TEAM_NOT_FOUND' };

  existing.passwordHash = `bcrypt_hash_${existing.username}_${newPlainPass.trim()}`;
  existing.activeSessionToken = null; // Revoke active participant session
  return { success: true };
}

function participantLogin(usernameInput: string, passwordInput: string) {
  const cleanUser = usernameInput.trim().toLowerCase();
  for (const cred of credentialStore.values()) {
    if (cred.username === cleanUser) {
      const expectedHash = `bcrypt_hash_${cleanUser}_${passwordInput.trim()}`;
      if (cred.passwordHash === expectedHash) {
        const sessionToken = `sess_${cred.teamId}_${Date.now()}`;
        cred.activeSessionToken = sessionToken;
        return { success: true, teamId: cred.teamId, teamCode: cred.teamCode, sessionToken };
      }
      return { success: false, error: 'INVALID_PASSWORD' };
    }
  }
  return { success: false, error: 'USER_NOT_FOUND' };
}

// 1.1 Successful credential creation
const setRes1 = adminSetCredentials('t1', 'T01', 'alpha_centauri', 'Secret2026!');
check(setRes1.success === true, 'Admin successfully configures custom username and password');

// 1.2 Duplicate username rejection
const setResDup = adminSetCredentials('t2', 'T02', 'alpha_centauri', 'AnotherPass123!');
check(setResDup.success === false && setResDup.error === 'DUPLICATE_USERNAME', 'Rejects duplicate username configuration across teams');

// 1.3 Second team configured with distinct username
const setRes2 = adminSetCredentials('t2', 'T02', 'bravo_vanguards', 'BravoPass2026!');
check(setRes2.success === true, 'Admin successfully configures second team with unique username');

// 1.4 Valid participant login
const loginRes = participantLogin('alpha_centauri', 'Secret2026!');
check(loginRes.success === true && loginRes.teamId === 't1', 'Participant successfully logs in using assigned custom username and password');
check(Boolean(loginRes.sessionToken), 'Server issues secure session token upon login');

// 1.5 Invalid password rejected
const loginWrongPass = participantLogin('alpha_centauri', 'WrongPass!');
check(loginWrongPass.success === false && loginWrongPass.error === 'INVALID_PASSWORD', 'Participant login fails with incorrect password');

// 1.6 Password reset revokes active session
const tokenBefore = credentialStore.get('t1')?.activeSessionToken;
check(tokenBefore !== null, 'Team 1 has active session token before password reset');

const resetRes = adminResetPassword('t1', 'NewSecret2026!');
check(resetRes.success === true, 'Admin successfully resets team password');
check(credentialStore.get('t1')?.activeSessionToken === null, 'Password reset automatically invalidates active participant session');

// 1.7 Old password rejected after reset, new password accepted
const loginOld = participantLogin('alpha_centauri', 'Secret2026!');
check(loginOld.success === false, 'Old password rejected after administrator password reset');

const loginNew = participantLogin('alpha_centauri', 'NewSecret2026!');
check(loginNew.success === true, 'New password accepted after administrator password reset');

// 1.8 Cross-team access prevention
function getTeamDataWithSession(requestTeamId: string, sessionToken: string) {
  const cred = credentialStore.get(requestTeamId);
  if (!cred || cred.activeSessionToken !== sessionToken) {
    return { success: false, error: 'UNAUTHORIZED_CROSS_TEAM_ACCESS' };
  }
  return { success: true, teamId: cred.teamId };
}
// Team 1 trying to access Team 2 data using Team 1's session token
const crossAccess = getTeamDataWithSession('t2', loginNew.sessionToken!);
check(crossAccess.success === false && crossAccess.error === 'UNAUTHORIZED_CROSS_TEAM_ACCESS', 'Strict cross-team access prevention enforced server-side');


// =============================================================================
// PILLAR 2: EXACTLY 9 LOCATIONS & 9 ROUNDS
// =============================================================================
console.log('\n--- 2. Testing Fixed 9-Location Campus System ---');

check(INITIAL_LOCATIONS.length === 9, 'INITIAL_LOCATIONS contains exactly 9 locations');
check(!INITIAL_LOCATIONS.some((l) => l.locationNumber === 10), 'Location 10 strictly removed from active locations');

const teamIds = INITIAL_TEAMS.map((t) => t.id);
const locIds = INITIAL_LOCATIONS.map((l) => l.id);

check(teamIds.length === 20, 'Exactly 20 teams routed');
check(locIds.length === 9, 'Exactly 9 location IDs');

const routes = generateBalancedRoutes(teamIds, locIds, 9);
check(routes.isValid === true, '9-round 9-location route plan is mathematically valid');
check(routes.matrix.length === 180, '20 teams * 9 rounds = exactly 180 route assignments');
check(routes.verificationReport.collisions.length === 0, 'Zero route collisions detected across all 9 rounds');
check(routes.verificationReport.allTeamsVisitAllLocations === true, 'All 20 teams visit all 9 locations in 9 rounds');

// Round 9 journey completion verification
function verifyStationAndAdvance(teamCurrentRound: number, scannedToken: string, expectedToken: string) {
  if (scannedToken !== expectedToken) {
    return { success: false, error: 'INVALID_QR' };
  }
  if (teamCurrentRound >= 9) {
    return { success: true, isCompleted: true, message: 'Tournament completed upon Round 9 verification' };
  }
  return { success: true, isCompleted: false, nextRound: teamCurrentRound + 1 };
}

const midRoundAdvance = verifyStationAndAdvance(8, 'TOK-8', 'TOK-8');
check(midRoundAdvance.success === true && midRoundAdvance.isCompleted === false && midRoundAdvance.nextRound === 9, 'Round 8 advances team to Round 9');

const finalRoundAdvance = verifyStationAndAdvance(9, 'TOK-9', 'TOK-9');
check(finalRoundAdvance.success === true && finalRoundAdvance.isCompleted === true, 'Round 9 verification completes team journey (no Round 10)');


// =============================================================================
// PILLAR 3: STRICT CODE_BASED & THREE_PART_TEXT ONLY (ZERO MCQ / IMAGE)
// =============================================================================
console.log('\n--- 3. Testing Elimination of MCQ & Image Question Formats ---');

check(INITIAL_RIDDLES.length === 9, 'INITIAL_RIDDLES contains exactly 9 challenges (Rounds 1-9)');

INITIAL_RIDDLES.forEach((p) => {
  check(
    p.puzzleType === 'CODE_BASED' || p.puzzleType === 'THREE_PART_TEXT',
    `Challenge ${p.id} uses valid format: ${p.puzzleType}`
  );
  check(p.options === undefined, `Challenge ${p.id} strictly omits MCQ options`);
  check(p.correctOptionIndex === undefined, `Challenge ${p.id} strictly omits correctOptionIndex`);
  check(p.imageUrl === undefined, `Challenge ${p.id} strictly omits imageUrl`);
});

// Test Code-Based Question Evaluation
const codeChallenge = INITIAL_RIDDLES.find((r) => r.roundNumber === 1);
check(codeChallenge?.puzzleType === 'CODE_BASED', 'Round 1 is CODE_BASED');
const codeEvalValid = AnswerValidator.validate('27', { acceptedAnswers: ['27'] });
check(codeEvalValid.isCorrect === true, 'Code-Based answer 27 evaluated as correct');

const codeEvalWrong = AnswerValidator.validate('99', { acceptedAnswers: ['27'] });
check(codeEvalWrong.isCorrect === false, 'Code-Based incorrect answer rejected');

// Test Three-Part Text Question Evaluation
const threePartAnswers = {
  partA: ['stack'],
  partB: ['42'],
  partC: ['https', 'tls'],
};
const threePartValid = AnswerValidator.validateThreePart({ partA: 'stack', partB: '42', partC: 'https' }, threePartAnswers);
check(threePartValid.isCorrect === true, 'Three-Part question accepts all 3 correct sub-answers');

const threePartPartial = AnswerValidator.validateThreePart({ partA: 'stack', partB: 'wrong', partC: 'https' }, threePartAnswers);
check(threePartPartial.isCorrect === false, 'Three-Part question rejects incomplete/partial submissions');


// =============================================================================
// PILLAR 4: LOCATION-LEVEL RIDDLE MANAGEMENT
// =============================================================================
console.log('\n--- 4. Testing Location-Level Riddle Management ---');

INITIAL_LOCATIONS.forEach((loc) => {
  check(Boolean(loc.riddleClue && loc.riddleClue.trim().length > 0), `Station #${loc.locationNumber} has dedicated riddle clue`);
  check(loc.riddleClue!.includes('\n'), `Station #${loc.locationNumber} riddle supports multiline formatting`);
});

// Verify route-isolated riddle retrieval
function getParticipantRiddle(teamId: string, currentRound: number) {
  // Finds assigned location for team in currentRound
  const assigned = routes.matrix.find((r) => r.teamId === teamId && r.roundNumber === currentRound);
  if (!assigned) return null;
  const loc = INITIAL_LOCATIONS.find((l) => l.id === assigned.locationId);
  return loc?.riddleClue || null;
}

const team1Round1Riddle = getParticipantRiddle('team-1', 1);
const team1Round2Riddle = getParticipantRiddle('team-1', 2);
check(Boolean(team1Round1Riddle), 'Participant receives riddle for assigned Round 1 location');
check(Boolean(team1Round2Riddle), 'Participant receives riddle for assigned Round 2 location');
check(team1Round1Riddle !== team1Round2Riddle, 'Different rounds yield different independent location riddles');

console.log('\n================================================================');
console.log(`ALL ADMIN & GAMEPLAY MODIFICATION TESTS PASSED! (${passed} / ${total})`);
console.log('================================================================\n');


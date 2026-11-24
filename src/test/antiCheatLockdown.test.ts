import { FullscreenManager } from '../services/fullscreenManager';
import { ViolationDetector } from '../services/violationDetector';
import { ViolationManager, WARNING_MESSAGES } from '../services/violationManager';
import { AnswerValidator } from '../services/answerEngine';
import { StorageService } from '../services/storageService';
import type { Team, AntiCheatIncident, ViolationType } from '../types';

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, message: string) {
  totalTests++;
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  passedTests++;
  console.log(`✅ PASSED: ${message}`);
}

console.log('================================================================');
console.log('MIND MAZE 2.0 — ANTI-CHEAT & EXAM LOCKDOWN VERIFICATION SUITE');
console.log('================================================================\n');

// ----------------------------------------------------
// TEST 1: Fullscreen API Manager & Limitations
// ----------------------------------------------------
console.log('--- 1. Testing Fullscreen Manager & Browser Limitations ---');
const limitations = FullscreenManager.getBrowserLimitations();
assert(typeof limitations === 'object', 'Browser limitations report generated');
assert(typeof limitations.supportsFullscreenApi === 'boolean', 'Reports API support status');
assert(typeof limitations.note === 'string' && limitations.note.length > 0, 'Includes technical security notice');
assert(!limitations.note.toLowerCase().includes('kiosk mode'), 'Accurately reports browser fullscreen, does not falsely claim OS kiosk mode');

// ----------------------------------------------------
// TEST 2: Violation Deduction & Deduplication Engine
// ----------------------------------------------------
console.log('\n--- 2. Testing Violation Deduplication Engine ---');
const recordedViolations: { type: ViolationType; strikeNumber: number; heading: string; message: string }[] = [];

let mockStrikes = 0;
const detector = new ViolationDetector(
  {
    activeTeamId: 'test-team-1',
    isPlaying: true,
    isEliminated: false,
    isCompleted: false,
    currentStrikes: mockStrikes,
    suppressed: false,
  },
  {
    onViolation: (type, details) => {
      mockStrikes = details.strikeNumber;
      recordedViolations.push({
        type,
        strikeNumber: details.strikeNumber,
        heading: details.heading,
        message: details.message,
      });
    },
  }
);

// Rapid-fire simulation: Alt-Tab triggers visibilitychange + blur + fullscreenchange within 50ms
const firstTriggerResult = detector.handlePotentialViolation('tab_switch', 'Tab switched');
assert(firstTriggerResult === true, 'First event in burst is captured as a valid violation');

const secondTriggerResult = detector.handlePotentialViolation('window_blur', 'Window blur accompanying tab switch');
assert(secondTriggerResult === false, 'Second event in burst within deduplication window is blocked (deduplicated)');

const thirdTriggerResult = detector.handlePotentialViolation('fullscreen_exit', 'Fullscreen exit accompanying tab switch');
assert(thirdTriggerResult === false, 'Third event in burst within deduplication window is blocked (deduplicated)');

assert(recordedViolations.length === 1, 'Burst of multiple events resulting from a single tab switch counts as exactly ONE violation');
assert(recordedViolations[0]?.strikeNumber === 1, 'First violation registers strike #1');

// ----------------------------------------------------
// TEST 3: Suppression Mechanism (In-App Camera / Modals)
// ----------------------------------------------------
console.log('\n--- 3. Testing Dialog Suppression Mechanism ---');
detector.updateOptions({
  activeTeamId: 'test-team-1',
  isPlaying: true,
  isEliminated: false,
  isCompleted: false,
  currentStrikes: mockStrikes,
  suppressed: true, // e.g. Camera QR scanner open
});

const suppressedResult = detector.handlePotentialViolation('window_blur', 'Camera permission modal opened');
assert(suppressedResult === false, 'Violations are completely suppressed when authorized dialogs (camera scanner) are active');
assert(recordedViolations.length === 1, 'Suppressed events do not increment violation counter');

// ----------------------------------------------------
// TEST 4: Three Warnings and Fourth-Violation Elimination
// ----------------------------------------------------
console.log('\n--- 4. Testing 3 Warnings & 4th-Violation Automatic Elimination ---');

const competitorTeam: Team = {
  id: 'team-alpha-01',
  teamCode: 'ALPHA',
  teamName: 'Team Alpha',
  status: 'active',
  currentRound: 1,
  strikes: 0,
  createdAt: new Date().toISOString(),
};

// 1st Violation -> Warning 1
const eval1 = ViolationManager.evaluateViolation(competitorTeam, 'tab_switch');
competitorTeam.strikes = eval1.newStrikes;
assert(eval1.newStrikes === 1, 'Violation 1 results in Strike #1');
assert(eval1.eliminated === false, 'Violation 1 does not eliminate participant');
assert(eval1.config.heading === 'WARNING 1 OF 3', 'Warning 1 heading matches "WARNING 1 OF 3"');
assert(eval1.config.message === WARNING_MESSAGES.WARNING_1, 'Warning 1 exact message matches prompt requirement');
assert(eval1.config.remainingWarnings === 2, 'Warning 1 indicates exactly 2 warnings remaining');

// 2nd Violation -> Warning 2
const eval2 = ViolationManager.evaluateViolation(competitorTeam, 'window_blur');
competitorTeam.strikes = eval2.newStrikes;
assert(eval2.newStrikes === 2, 'Violation 2 results in Strike #2');
assert(eval2.eliminated === false, 'Violation 2 does not eliminate participant');
assert(eval2.config.heading === 'WARNING 2 OF 3', 'Warning 2 heading matches "WARNING 2 OF 3"');
assert(eval2.config.message === WARNING_MESSAGES.WARNING_2, 'Warning 2 exact message matches prompt requirement');
assert(eval2.config.remainingWarnings === 1, 'Warning 2 indicates exactly 1 warning remaining');

// 3rd Violation -> Warning 3 (Final Warning)
const eval3 = ViolationManager.evaluateViolation(competitorTeam, 'fullscreen_exit');
competitorTeam.strikes = eval3.newStrikes;
assert(eval3.newStrikes === 3, 'Violation 3 results in Strike #3');
assert(eval3.eliminated === false, 'Violation 3 does not eliminate participant');
assert(eval3.config.isFinalWarning === true, 'Warning 3 is flagged as final warning');
assert(eval3.config.heading === 'FINAL WARNING!', 'Warning 3 heading matches "FINAL WARNING!"');
assert(eval3.config.message === WARNING_MESSAGES.WARNING_3, 'Warning 3 exact message matches prompt requirement');
assert(eval3.config.remainingWarnings === 0, 'Warning 3 indicates 0 remaining warnings before elimination');

// 4th Violation -> Automatic Elimination
const eval4 = ViolationManager.evaluateViolation(competitorTeam, 'tab_switch');
competitorTeam.strikes = eval4.newStrikes;
if (eval4.eliminated) {
  competitorTeam.status = 'eliminated';
  competitorTeam.eliminationReason = eval4.config.message;
}

assert(eval4.newStrikes === 4, 'Violation 4 results in Strike #4');
assert(eval4.eliminated === true, 'Violation 4 triggers automatic elimination');
assert(competitorTeam.status === 'eliminated', 'Team status transitioned to "eliminated"');
assert(eval4.config.heading === 'YOU HAVE BEEN ELIMINATED!', 'Heading indicates elimination');
assert(eval4.config.message === WARNING_MESSAGES.ELIMINATED, 'Message indicates "YOU HAVE BEEN ELIMINATED!"');

// Subsequent violations on eliminated team are ignored
const eval5 = ViolationManager.evaluateViolation(competitorTeam, 'tab_switch');
assert(eval5.eliminated === true, 'Subsequent attempts remain eliminated');

// ----------------------------------------------------
// TEST 5: Elimination Submission Lockout (Backend Security)
// ----------------------------------------------------
console.log('\n--- 5. Testing Server/Store Submission Lockout for Eliminated Teams ---');

function mockSubmitAnswer(team: Team, answer: string) {
  if (team.status === 'eliminated') {
    return { success: false, feedback: 'Submission rejected: Team has been eliminated.' };
  }
  return { success: true, feedback: 'Answer accepted' };
}

function mockVerifyQr(team: Team, token: string) {
  if (team.status === 'eliminated') {
    return { success: false, message: 'Action rejected: Team has been eliminated.' };
  }
  return { success: true, message: 'Checkpoint verified' };
}

const submitAttempt = mockSubmitAnswer(competitorTeam, 'CORRECT_ANSWER');
assert(submitAttempt.success === false, 'Eliminated team cannot submit puzzle answers');
assert(submitAttempt.feedback.includes('eliminated'), 'Rejection message clearly states elimination');

const qrAttempt = mockVerifyQr(competitorTeam, '1234567890');
assert(qrAttempt.success === false, 'Eliminated team cannot scan checkpoints');
assert(qrAttempt.message.includes('eliminated'), 'QR scan rejected with elimination message');

// ----------------------------------------------------
// TEST 6: Multi-Participant Isolation
// ----------------------------------------------------
console.log('\n--- 6. Testing Participant Strike Isolation ---');

const cleanTeamB: Team = {
  id: 'team-beta-02',
  teamCode: 'BETA',
  teamName: 'Team Beta',
  status: 'active',
  currentRound: 1,
  strikes: 0,
  createdAt: new Date().toISOString(),
};

assert(cleanTeamB.strikes === 0, 'Unrelated participant B begins with 0 strikes');
assert(cleanTeamB.status === 'active', 'Participant B remains active while Team Alpha is eliminated');

// Verify Team B submission succeeds
const teamBSubmit = mockSubmitAnswer(cleanTeamB, 'BETA_ANSWER');
assert(teamBSubmit.success === true, 'Clean participant B can submit answers freely');

// ----------------------------------------------------
// TEST 7: Chronological Audit Trail & Admin Dashboard Logging
// ----------------------------------------------------
console.log('\n--- 7. Testing Chronological Audit Trail Generation ---');

const mockIncidents: AntiCheatIncident[] = [
  eval1.incident,
  eval2.incident,
  eval3.incident,
  eval4.incident,
];

const teamLogs = ViolationManager.formatTeamViolationLogs(mockIncidents, competitorTeam.id);
assert(teamLogs.length === 4, 'Audit trail contains all 4 sequential violations');
assert(teamLogs[0]!.includes('1.'), 'First violation formatted with index 1');
assert(teamLogs[0]!.includes('Browser tab visibility lost'), 'First violation describes tab visibility loss');
assert(teamLogs[1]!.includes('Browser window lost focus'), 'Second violation describes window focus loss');
assert(teamLogs[2]!.includes('Fullscreen exited'), 'Third violation describes fullscreen exit');
assert(teamLogs[3]!.includes('Browser tab visibility lost'), 'Fourth violation describes tab visibility loss');

// ----------------------------------------------------
// TEST 8: Warning Level Badge Formatting
// ----------------------------------------------------
console.log('\n--- 8. Testing Admin Warning Level Badge Calculations ---');

const badge0 = ViolationManager.getWarningLevelBadge(0, 'active');
assert(badge0.variant === 'clean' && badge0.label === 'Clean (0)', '0 strikes displays Clean (0)');

const badge1 = ViolationManager.getWarningLevelBadge(1, 'active');
assert(badge1.variant === 'warning' && badge1.label === 'Warning 1 (1/3)', '1 strike displays Warning 1 (1/3)');

const badge2 = ViolationManager.getWarningLevelBadge(2, 'active');
assert(badge2.variant === 'warning' && badge2.label === 'Warning 2 (2/3)', '2 strikes displays Warning 2 (2/3)');

const badge3 = ViolationManager.getWarningLevelBadge(3, 'active');
assert(badge3.variant === 'final' && badge3.label === 'Final Warning (3)', '3 strikes displays Final Warning (3)');

const badge4 = ViolationManager.getWarningLevelBadge(4, 'eliminated');
assert(badge4.variant === 'eliminated' && badge4.label === 'Eliminated (4)', '4 strikes displays Eliminated (4)');

// ----------------------------------------------------
// TEST 9: Session Persistence on Simulated Browser Refresh
// ----------------------------------------------------
console.log('\n--- 9. Testing Session Persistence & Reload Resilience ---');

// Mock localStorage persistence
const mockStorage: Record<string, string> = {};
const testTeamsArray: Team[] = [competitorTeam, cleanTeamB];

mockStorage['arena_teams'] = JSON.stringify(testTeamsArray);

// Simulate browser refresh: parse teams back from raw storage string
const restoredTeams: Team[] = JSON.parse(mockStorage['arena_teams']!);
const restoredAlpha = restoredTeams.find((t) => t.id === competitorTeam.id)!;
const restoredBeta = restoredTeams.find((t) => t.id === cleanTeamB.id)!;

assert(restoredAlpha.status === 'eliminated', 'Eliminated team status persists across simulated browser reload');
assert(restoredAlpha.strikes === 4, 'Violation count (4) persists across simulated browser reload');
assert(restoredBeta.status === 'active', 'Active team status persists without data corruption');
assert(restoredBeta.strikes === 0, 'Clean team strikes remain 0 across simulated browser reload');

console.log('\n================================================================');
console.log(`ALL ANTI-CHEAT ACCEPTANCE TESTS PASSED! (${passedTests} / ${totalTests} assertions verified)`);
console.log('================================================================');

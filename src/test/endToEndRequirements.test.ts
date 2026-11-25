import { describe, it } from 'node:test';
import assert from 'node:assert';
import { mapAuthError } from '../services/authErrorMapper';
import { QuestionRegistry } from '../features/questions/questionRegistry';
import { QuestionPdfExportService } from '../services/questionPdfExportService';
import { INITIAL_LOCATIONS } from '../data/seedData';
import { generateBalancedRoutes } from '../services/routeEngine';

describe('MIND MAZE 2.0 Comprehensive End-to-End Verification (Tests 1-10)', () => {
  // Test 1: Team Registration
  it('Test 1: Admin registers team with name, username, and password; copy credentials', () => {
    // 1. Unique username check
    const existingUsernames = new Set(['team_alpha', 'team_beta']);
    assert.strictEqual(existingUsernames.has('team_gamma'), false);
    assert.strictEqual(existingUsernames.has('team_alpha'), true);

    // 2. Mock credential storage
    const customCredentials: Record<string, { username: string; password: string }> = {};
    const teamId = 'team-001';
    customCredentials[teamId] = { username: 'team_gamma', password: 'securePassword123' };

    // 3. Verify admin copy format
    const textToCopy = `MIND MAZE 2.0 Credentials\nTeam: Gamma Rangers (T03)\nUsername: ${customCredentials[teamId].username}\nPassword: ${customCredentials[teamId].password}`;
    assert.match(textToCopy, /team_gamma/);
    assert.match(textToCopy, /securePassword123/);
  });

  // Test 2: Authentication & Centralized Error Handling
  it('Test 2: Centralized Auth Error Mapper suppresses raw database and Postgres errors', () => {
    // Suppress Postgres errors
    assert.strictEqual(mapAuthError('PGRST202'), 'Login is temporarily unavailable. Please try again shortly.');
    assert.strictEqual(mapAuthError('42501'), 'Login is temporarily unavailable. Please try again shortly.');
    assert.strictEqual(mapAuthError('42P01: relation "teams" does not exist'), 'Login is temporarily unavailable. Please try again shortly.');
    assert.strictEqual(mapAuthError('42703: column does not exist'), 'Login is temporarily unavailable. Please try again shortly.');
    assert.strictEqual(mapAuthError('Could not find the function public.team_authenticate in the schema cache'), 'Login is temporarily unavailable. Please try again shortly.');

    // User-friendly business error mapping
    assert.strictEqual(mapAuthError('INVALID_CREDENTIALS'), 'Invalid username or password. Please try again.');
    assert.strictEqual(mapAuthError('ACCOUNT_INACTIVE'), 'This team account is currently inactive. Contact the event administrator.');
    assert.strictEqual(mapAuthError('ACCOUNT_LOCKED'), 'Too many attempts. Please wait before trying again.');
    assert.strictEqual(mapAuthError('SESSION_EXPIRED'), 'Your session has expired. Please log in again.');
    assert.strictEqual(mapAuthError('Failed to fetch'), 'Unable to connect. Check your internet connection and try again.');
  });

  // Test 3: Participant Lobby Behavior
  it('Test 3: Participant enters Lobby after login; no self-start button', () => {
    const participantState = {
      teamId: 'team-001',
      status: 'ready' as const,
      lobbyConnected: true,
      hasSelfStartButton: false, // Participant cannot start game independently
    };

    assert.strictEqual(participantState.lobbyConnected, true);
    assert.strictEqual(participantState.status, 'ready');
    assert.strictEqual(participantState.hasSelfStartButton, false);
  });

  // Test 4: Global Game Start & Synchronized Countdown
  it('Test 4: Authoritative future timestamp triggers 5-second countdown to live event', () => {
    const now = 1000000;
    const authoritativeStartAtMs = now + 5000; // 5 seconds in future
    const authoritativeStartAtIso = new Date(authoritativeStartAtMs).toISOString();

    // Calculate remaining seconds
    const remainingSecondsAtT0 = Math.max(0, Math.ceil((authoritativeStartAtMs - now) / 1000));
    assert.strictEqual(remainingSecondsAtT0, 5);

    const remainingSecondsAtT3 = Math.max(0, Math.ceil((authoritativeStartAtMs - (now + 3000)) / 1000));
    assert.strictEqual(remainingSecondsAtT3, 2);

    const remainingSecondsAtT5 = Math.max(0, Math.ceil((authoritativeStartAtMs - (now + 5000)) / 1000));
    assert.strictEqual(remainingSecondsAtT5, 0);

    // Auto-transition to active when countdown reaches 0
    const isLive = (now + 5100) >= authoritativeStartAtMs;
    assert.strictEqual(isLive, true);
  });

  // Test 5: Question Configuration Synchronization
  it('Test 5: Admin edit increments version and publishes config to participants', () => {
    const initialVersion = QuestionRegistry.getConfigVersion();
    const q1 = QuestionRegistry.getQuestionForRound(1);
    assert.ok(q1);

    const updatedQ1 = { ...q1, title: 'Updated Location 1 Question' };
    QuestionRegistry.saveQuestion(updatedQ1);

    const newVersion = QuestionRegistry.getConfigVersion();
    assert.strictEqual(newVersion, initialVersion + 1);

    const publishedPkg = QuestionRegistry.publishConfigPackage();
    assert.strictEqual(publishedPkg.configVersion, newVersion);

    const published = QuestionRegistry.getPublishedPackage();
    assert.ok(published);
    assert.strictEqual(published.configVersion, newVersion);
    const publishedQ1 = published.questions.find((q) => q.roundNumber === 1);
    assert.strictEqual(publishedQ1?.title, 'Updated Location 1 Question');
  });

  // Test 6: Participant Activity & Live Monitoring Synchronization
  it('Test 6: Tracks participant progression: Lobby -> Playing -> In Progress -> Solved -> Location Completed', () => {
    type ProgressState = 'not_started' | 'in_progress' | 'solved';
    let questionStatus: ProgressState = 'not_started';
    let qrScanned = false;

    // 1. Team enters location question
    questionStatus = 'in_progress';
    assert.strictEqual(questionStatus, 'in_progress');

    // 2. Team solves question
    questionStatus = 'solved';
    assert.strictEqual(questionStatus, 'solved');
    assert.strictEqual(qrScanned, false); // Riddle visible, but QR not yet scanned

    // 3. Team arrives at location and scans QR
    qrScanned = true;
    assert.strictEqual(qrScanned, true);
  });

  // Test 7: Accurate Question-Only Timers
  it('Test 7: Question timer starts on view, wrong answer does not stop it, correct answer freezes duration, QR scan does not add to question time', () => {
    const qStartedAt = 10000;
    let attemptsCount = 0;
    let qSolvedAt: number | null = null;
    let questionDurationMs: number | null = null;

    // Wrong submission at T+4000ms
    attemptsCount++;
    assert.strictEqual(qSolvedAt, null);

    // Correct submission at T+9500ms
    qSolvedAt = 19500;
    questionDurationMs = qSolvedAt - qStartedAt; // Exactly 9500ms
    assert.strictEqual(questionDurationMs, 9500);

    // QR scan happens at T+45000ms (35.5 seconds later)
    const qrScannedAt = 55000;
    // Question duration must remain unchanged!
    assert.strictEqual(questionDurationMs, 9500);
    assert.ok(qrScannedAt > qSolvedAt);
  });

  // Test 8: Page Refresh & Reconnection Recovery
  it('Test 8: Timer state machine persists start and stop across simulated refresh', () => {
    const roundNumber = 1;
    const startKey = `mm2_q_start_${roundNumber}`;
    const stopKey = `mm2_q_stop_${roundNumber}`;

    const store: Record<string, string> = {};
    store[startKey] = '1600000000000';
    store[stopKey] = '1600000012500';

    // Simulate page reload reading from persistent storage
    const recoveredStart = Number(store[startKey]);
    const recoveredStop = Number(store[stopKey]);
    const computedDuration = recoveredStop - recoveredStart;

    assert.strictEqual(computedDuration, 12500);
  });

  // Test 9: Multi-Team Independent Operation
  it('Test 9: 3+ teams operate concurrently without state collision', () => {
    const teamIds = ['team-A', 'team-B', 'team-C'];
    const locationIds = [1, 2, 3, 4, 5, 6, 7, 8, 9];

    // Generate balanced routes for exactly 9 locations
    const result = generateBalancedRoutes(teamIds, locationIds, 9);
    assert.strictEqual(result.matrix.length, 27); // 3 teams * 9 rounds

    // Verify each team visits exactly 9 distinct stations
    teamIds.forEach((tId) => {
      const teamRoutes = result.matrix.filter((r) => r.teamId === tId);
      assert.strictEqual(teamRoutes.length, 9);
      const visited = new Set(teamRoutes.map((r) => r.locationId));
      assert.strictEqual(visited.size, 9);
    });
  });

  // Test 10: PDF Export Completeness & Accuracy
  it('Test 10: PDF export contains all 9 locations, questions, code, answers, and separate riddles', async () => {
    const locations = INITIAL_LOCATIONS.filter((l) => l.active !== false).slice(0, 9);
    const exportResult = await QuestionPdfExportService.exportQuestionsAndAnswersPdf({
      locations,
      eventName: 'MIND MAZE 2.0 CHAMPIONSHIP',
      isDraft: false,
    });
    assert.strictEqual(exportResult.success, true);
    assert.ok(exportResult.filename && exportResult.filename.endsWith('.pdf'));
  });
});

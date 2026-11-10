import type { Team, TeamRoundProgress, LeaderboardEntry } from '../types';
import { formatDuration } from '../utils/formatters';

export function calculateLeaderboard(
  teams: Team[],
  progressList: TeamRoundProgress[],
  eventStartedAt: string | null
): LeaderboardEntry[] {
  const startEpoch = eventStartedAt ? new Date(eventStartedAt).getTime() : Date.now();

  const entries: LeaderboardEntry[] = teams.map((team) => {
    // Find all progress items for this team
    const teamProgress = progressList.filter((p) => p.teamId === team.id);

    // Completed rounds count (both puzzle solved and QR scanned)
    const completedRounds = teamProgress.filter((p) => p.puzzleSolved && p.qrScanned).length;

    // Total attempts across all rounds
    const totalAttempts = teamProgress.reduce((sum, p) => sum + p.attemptsCount, 0);

    // Final round progress (Round 10)
    const round10 = teamProgress.find((p) => p.roundNumber === 10);
    const finalVerifiedAt = team.status === 'completed'
      ? (round10?.qrScannedAt || team.completedAt || null)
      : null;

    let completionTimeMs: number | null = null;
    let completionTimeFormatted: string | null = null;

    if (finalVerifiedAt) {
      const finishEpoch = new Date(finalVerifiedAt).getTime();
      completionTimeMs = Math.max(0, finishEpoch - startEpoch);
      completionTimeFormatted = formatDuration(completionTimeMs);
    }

    const isEligibleWinner =
      team.status === 'completed' &&
      team.strikes < 3 &&
      completedRounds === 10;

    let lastActivityAt = team.createdAt;
    for (const p of teamProgress) {
      if (p.qrScannedAt && p.qrScannedAt > lastActivityAt) {
        lastActivityAt = p.qrScannedAt;
      } else if (p.puzzleSolvedAt && p.puzzleSolvedAt > lastActivityAt) {
        lastActivityAt = p.puzzleSolvedAt;
      }
    }

    return {
      rank: null,
      teamId: team.id,
      teamCode: team.teamCode,
      teamName: team.teamName,
      status: team.status,
      currentRound: team.currentRound,
      completedRounds,
      isEligibleWinner,
      completionTimeMs,
      completionTimeFormatted,
      strikes: team.strikes,
      totalAttempts,
      lastActivityAt,
    };
  });

  // Sorting hierarchy:
  // 1. Eligible winners first, ordered by completionTimeMs ascending
  // 2. Completed teams not eligible
  // 3. Active teams ordered by completedRounds descending, then currentRound descending, then fewer strikes, then fewer attempts
  // 4. Eliminated teams last
  entries.sort((a, b) => {
    // Eliminated teams always rank lower
    if (a.status === 'eliminated' && b.status !== 'eliminated') return 1;
    if (a.status !== 'eliminated' && b.status === 'eliminated') return -1;

    // Eligible winners with fastest time
    if (a.isEligibleWinner && b.isEligibleWinner) {
      const timeA = a.completionTimeMs ?? Infinity;
      const timeB = b.completionTimeMs ?? Infinity;
      if (timeA !== timeB) return timeA - timeB;
      if (a.strikes !== b.strikes) return a.strikes - b.strikes;
      if (a.totalAttempts !== b.totalAttempts) return a.totalAttempts - b.totalAttempts;
      return a.teamCode.localeCompare(b.teamCode);
    }

    if (a.isEligibleWinner) return -1;
    if (b.isEligibleWinner) return 1;

    // By completed rounds descending
    if (a.completedRounds !== b.completedRounds) {
      return b.completedRounds - a.completedRounds;
    }

    // By current round descending
    if (a.currentRound !== b.currentRound) {
      return b.currentRound - a.currentRound;
    }

    // By strikes ascending (fewer is better)
    if (a.strikes !== b.strikes) {
      return a.strikes - b.strikes;
    }

    // By total attempts ascending (fewer is better)
    if (a.totalAttempts !== b.totalAttempts) {
      return a.totalAttempts - b.totalAttempts;
    }

    return a.teamCode.localeCompare(b.teamCode);
  });

  // Assign ranks
  let currentRank = 1;
  entries.forEach((entry, index) => {
    if (entry.status === 'eliminated') {
      entry.rank = null;
      entry.tieBreakDetail = 'Disqualified';
    } else {
      entry.rank = currentRank++;
      if (index === 0 && entry.isEligibleWinner) {
        entry.tieBreakDetail = 'Championship Leader (Fastest Clean Completion)';
      }
    }
  });

  return entries;
}


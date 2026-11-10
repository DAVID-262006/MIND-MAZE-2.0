import type { LeaderboardEntry, RouteAssignment, Team } from '../types';

export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportLeaderboardCSV(leaderboard: LeaderboardEntry[]): void {
  let csv = 'Rank,TeamCode,TeamName,Status,CurrentRound,CompletedRounds,OfficialTime,Strikes,TotalAttempts,WinnerEligible,Notes\n';
  leaderboard.forEach((t) => {
    const rankStr = t.rank ? `#${t.rank}` : 'UNRANKED';
    const timeStr = t.completionTimeFormatted || '--';
    const cleanName = t.teamName.replace(/"/g, '""');
    csv += `${rankStr},${t.teamCode},"${cleanName}",${t.status},${t.currentRound},${t.completedRounds},"${timeStr}",${t.strikes},${t.totalAttempts},${t.isEligibleWinner},"${t.tieBreakDetail || ''}"\n`;
  });

  const filename = `treasure_hunt_arena_leaderboard_${new Date().toISOString().slice(0, 10)}.csv`;
  downloadFile(csv, filename, 'text/csv;charset=utf-8;');
}

export function exportRoutesCSV(routes: RouteAssignment[], teams: Team[]): void {
  let csv = 'TeamCode,TeamName,Round1,Round2,Round3,Round4,Round5,Round6,Round7,Round8,Round9,Round10\n';

  teams.forEach((t) => {
    const teamRoutes = routes.filter((r) => r.teamId === t.id);
    const locCols: string[] = [];
    for (let round = 1; round <= 10; round++) {
      const match = teamRoutes.find((r) => r.roundNumber === round);
      locCols.push(match ? `Loc ${match.locationId}` : '--');
    }
    const cleanName = t.teamName.replace(/"/g, '""');
    csv += `${t.teamCode},"${cleanName}",${locCols.join(',')}\n`;
  });

  const filename = `treasure_hunt_arena_routes_${new Date().toISOString().slice(0, 10)}.csv`;
  downloadFile(csv, filename, 'text/csv;charset=utf-8;');
}


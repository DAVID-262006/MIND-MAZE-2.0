import type { RouteAssignment, RouteAllocationResult } from '../types';

/**
 * Generates a balanced randomized route matrix for 20 teams and 9 locations across 9 rounds.
 * Satisfies:
 * 1. Every team visits all 9 locations exactly once in 9 rounds.
 * 2. Every round assigns teams balanced across all 9 locations (7 stations have 2 teams, 2 stations have 3 teams, max 3 <= station capacity 4).
 * 3. Zero collisions / duplicate station visits.
 */
export function generateBalancedRoutes(
  teamIds: string[],
  locationIds: number[],
  roundCount = 9,
  options?: { randomizeTeams?: boolean; randomizeLocations?: boolean }
): RouteAllocationResult {
  if (teamIds.length === 0) {
    return {
      matrix: [],
      isValid: true,
      verificationReport: {
        totalTeams: 0,
        totalLocations: locationIds.length,
        totalRounds: roundCount,
        allTeamsVisitAllLocations: true,
        eachRoundEquipartition: true,
        collisions: [],
      },
    };
  }
  if (locationIds.length !== 9) {
    throw new Error(`Expected exactly 9 locations, received ${locationIds.length}`);
  }
  if (roundCount !== 9) {
    throw new Error(`Expected exactly 9 rounds, received ${roundCount}`);
  }

  // 1. Optional random shuffle of locations
  const shuffledLocations = [...locationIds];
  if (options?.randomizeLocations !== false) {
    for (let i = shuffledLocations.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = shuffledLocations[i]!;
      shuffledLocations[i] = shuffledLocations[j]!;
      shuffledLocations[j] = temp;
    }
  }

  // 2. Optional random shuffle of teams
  const shuffledTeams = [...teamIds];
  if (options?.randomizeTeams !== false) {
    for (let i = shuffledTeams.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = shuffledTeams[i]!;
      shuffledTeams[i] = shuffledTeams[j]!;
      shuffledTeams[j] = temp;
    }
  }

  const matrix: RouteAssignment[] = [];
  const locationCount = 9;

  // 3. Latin Square Cyclic Shift Routing
  // For team index i (0..19), offset = i % 9.
  // In round r (1..9), locIndex = (offset + (r - 1)) % 9.
  // Guarantees:
  // - Each team visits all 9 locations in 9 rounds.
  // - In every round, 7 locations have exactly 2 teams and 2 locations have exactly 3 teams.
  shuffledTeams.forEach((teamId, i) => {
    const offset = i % locationCount;
    for (let r = 1; r <= roundCount; r++) {
      const locIndex = (offset + (r - 1)) % locationCount;
      matrix.push({
        teamId,
        roundNumber: r,
        locationId: shuffledLocations[locIndex]!,
      });
    }
  });

  // 4. Verification Assertions
  const collisions: string[] = [];
  let allTeamsVisitAllLocations = true;
  let eachRoundEquipartition = true;

  // Check 1: Each team visits all locations exactly once
  teamIds.forEach((tId) => {
    const visited = new Set<number>();
    matrix
      .filter((m) => m.teamId === tId)
      .forEach((m) => visited.add(m.locationId));
    if (visited.size !== locationCount) {
      allTeamsVisitAllLocations = false;
      collisions.push(`Team ${tId} only visits ${visited.size} distinct locations`);
    }
  });

  // Check 2: Balanced distribution across locations
  const expectedMin = Math.floor(teamIds.length / locationCount);
  const expectedMax = Math.ceil(teamIds.length / locationCount);
  for (let r = 1; r <= roundCount; r++) {
    const counts = new Map<number, number>();
    matrix
      .filter((m) => m.roundNumber === r)
      .forEach((m) => {
        counts.set(m.locationId, (counts.get(m.locationId) || 0) + 1);
      });

    locationIds.forEach((locId) => {
      const count = counts.get(locId) || 0;
      if (count < expectedMin || count > expectedMax) {
        eachRoundEquipartition = false;
        collisions.push(`Round ${r}, Location ${locId} has ${count} teams (expected ${expectedMin} to ${expectedMax})`);
      }
    });
  }

  return {
    matrix,
    isValid: allTeamsVisitAllLocations && eachRoundEquipartition,
    verificationReport: {
      totalTeams: teamIds.length,
      totalLocations: locationIds.length,
      totalRounds: roundCount,
      allTeamsVisitAllLocations,
      eachRoundEquipartition,
      collisions,
    },
  };
}

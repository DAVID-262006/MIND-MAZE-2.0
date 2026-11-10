import type { RouteAssignment, RouteAllocationResult } from '../types';

/**
 * Generates a balanced randomized route matrix for 20 teams and 10 locations across 10 rounds.
 * Satisfies:
 * 1. Every team visits all 10 locations exactly once.
 * 2. Every round assigns exactly 2 teams to each location (20 / 10 = 2).
 */
export function generateBalancedRoutes(
  teamIds: string[],
  locationIds: number[],
  roundCount = 10,
  options?: { randomizeTeams?: boolean; randomizeLocations?: boolean }
): RouteAllocationResult {
  if (teamIds.length !== 20) {
    throw new Error(`Expected exactly 20 teams, received ${teamIds.length}`);
  }
  if (locationIds.length !== 10) {
    throw new Error(`Expected exactly 10 locations, received ${locationIds.length}`);
  }

  // 1. Randomize the order of locations
  const shuffledLocations = [...locationIds];
  if (options?.randomizeLocations !== false) {
    for (let i = shuffledLocations.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = shuffledLocations[i]!;
      shuffledLocations[i] = shuffledLocations[j]!;
      shuffledLocations[j] = temp;
    }
  }

  // 2. Randomize the order of teams
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
  const groupA = shuffledTeams.slice(0, 10);
  const groupB = shuffledTeams.slice(10, 20);

  // Group A uses shift offset 1: locIndex = (i + (r - 1)) mod 10
  groupA.forEach((teamId, i) => {
    for (let r = 1; r <= roundCount; r++) {
      const locIndex = (i + (r - 1)) % 10;
      matrix.push({
        teamId,
        roundNumber: r,
        locationId: shuffledLocations[locIndex]!,
      });
    }
  });

  // Group B uses shift offset: locIndex = (j + (r - 1) + 5) mod 10 (half-period orthogonal shift)
  // This guarantees that in round r, Group A covers all 10 locations (indices 0..9)
  // and Group B covers all 10 locations (indices 5,6,7,8,9,0,1,2,3,4)
  // Therefore, for every location in round r, exactly 1 team from Group A and 1 team from Group B attend it => exactly 2 teams!
  groupB.forEach((teamId, j) => {
    for (let r = 1; r <= roundCount; r++) {
      const locIndex = (j + (r - 1) + 5) % 10;
      matrix.push({
        teamId,
        roundNumber: r,
        locationId: shuffledLocations[locIndex]!,
      });
    }
  });

  // Verification Assertions
  const collisions: string[] = [];
  let allTeamsVisitAllLocations = true;
  let eachRoundEquipartition = true;

  // Check 1: Each team visits all locations exactly once
  teamIds.forEach((tId) => {
    const visited = new Set<number>();
    matrix
      .filter((m) => m.teamId === tId)
      .forEach((m) => visited.add(m.locationId));
    if (visited.size !== locationIds.length) {
      allTeamsVisitAllLocations = false;
      collisions.push(`Team ${tId} only visits ${visited.size} distinct locations`);
    }
  });

  // Check 2: Exactly 2 teams per location per round
  for (let r = 1; r <= roundCount; r++) {
    const counts = new Map<number, number>();
    matrix
      .filter((m) => m.roundNumber === r)
      .forEach((m) => {
        counts.set(m.locationId, (counts.get(m.locationId) || 0) + 1);
      });

    locationIds.forEach((locId) => {
      const count = counts.get(locId) || 0;
      if (count !== 2) {
        eachRoundEquipartition = false;
        collisions.push(`Round ${r}, Location ${locId} has ${count} teams (expected 2)`);
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


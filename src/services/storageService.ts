import type {
  GameEventConfig,
  Team,
  LocationCheckpoint,
  Riddle,
  RouteAssignment,
  TeamRoundProgress,
  AntiCheatIncident,
  FullGameBackup
} from '../types';
import {
  INITIAL_EVENT_CONFIG,
  INITIAL_TEAMS,
  INITIAL_LOCATIONS,
  INITIAL_RIDDLES,
} from '../data/seedData';
import { generateBalancedRoutes } from './routeEngine';

export const STORAGE_KEYS = {
  CONFIG: 'arena_event_config',
  TEAMS: 'arena_teams',
  LOCATIONS: 'arena_locations',
  RIDDLES: 'arena_riddles',
  ROUTES: 'arena_routes',
  PROGRESS: 'arena_progress',
  INCIDENTS: 'arena_incidents',
  ACTIVE_TEAM_ID: 'arena_active_team_id',
  ADMIN_AUTH: 'arena_admin_auth',
};

const VALID_GAME_STATUSES = ['draft', 'ready', 'live', 'paused', 'finished'];
const VALID_TEAM_STATUSES = ['ready', 'active', 'eliminated', 'completed', 'registered'];

export class StorageService {
  /**
   * Safely load and validate event configuration.
   */
  public static loadConfig(): GameEventConfig {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.CONFIG);
      if (raw && raw !== 'undefined' && raw !== 'null') {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && parsed.id) {
          return {
            ...INITIAL_EVENT_CONFIG,
            ...parsed,
            status: VALID_GAME_STATUSES.includes(parsed.status) ? parsed.status : 'ready',
            roundDurationSeconds: typeof parsed.roundDurationSeconds === 'number' && parsed.roundDurationSeconds > 0
              ? parsed.roundDurationSeconds
              : 300,
            gracePeriodSeconds: typeof parsed.gracePeriodSeconds === 'number' && parsed.gracePeriodSeconds >= 0
              ? parsed.gracePeriodSeconds
              : 30,
            totalTeams: typeof parsed.totalTeams === 'number' ? parsed.totalTeams : 20,
            totalRounds: typeof parsed.totalRounds === 'number' ? parsed.totalRounds : 10,
            totalPauseDurationMs: typeof parsed.totalPauseDurationMs === 'number' ? parsed.totalPauseDurationMs : 0,
            routesLocked: Boolean(parsed.routesLocked),
          };
        }
      }
    } catch (e) {
      console.warn('Corrupted config in storage, resetting to initial seed', e);
    }
    return INITIAL_EVENT_CONFIG;
  }

  public static saveConfig(config: GameEventConfig): void {
    try {
      localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(config));
    } catch (e) {
      console.error('Failed to save config to storage', e);
    }
  }

  /**
   * Safely load and validate teams array.
   */
  public static loadTeams(): Team[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.TEAMS);
      if (raw && raw !== 'undefined' && raw !== 'null') {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Validate and sanitize each team
          const sanitized: Team[] = parsed
            .filter((t) => t && typeof t === 'object' && t.id && t.teamCode)
            .map((t) => ({
              id: String(t.id),
              teamCode: String(t.teamCode).toUpperCase(),
              teamName: String(t.teamName || `Team ${t.teamCode}`),
              accessCode: String(t.accessCode || `Arena2026!${t.teamCode}`),
              status: VALID_TEAM_STATUSES.includes(t.status) ? t.status : 'ready',
              currentRound: typeof t.currentRound === 'number' && t.currentRound >= 1 && t.currentRound <= 10
                ? t.currentRound
                : 1,
              strikes: typeof t.strikes === 'number' && t.strikes >= 0 ? t.strikes : 0,
              createdAt: t.createdAt || new Date().toISOString(),
              eliminationReason: t.eliminationReason || undefined,
              completedAt: t.completedAt || undefined,
            }));

          if (sanitized.length > 0) {
            return sanitized;
          }
        }
      }
    } catch (e) {
      console.warn('Corrupted teams in storage, resetting to initial seed', e);
    }
    return INITIAL_TEAMS;
  }

  public static saveTeams(teams: Team[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.TEAMS, JSON.stringify(teams));
    } catch (e) {
      console.error('Failed to save teams to storage', e);
    }
  }

  /**
   * Safely load and validate locations array.
   */
  public static loadLocations(): LocationCheckpoint[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.LOCATIONS);
      if (raw && raw !== 'undefined' && raw !== 'null') {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const sanitized: LocationCheckpoint[] = parsed
            .filter((l) => l && typeof l === 'object' && typeof l.id === 'number')
            .map((l) => ({
              id: Number(l.id),
              locationNumber: typeof l.locationNumber === 'number' ? l.locationNumber : Number(l.id),
              name: String(l.name || `Station #${l.id}`),
              description: String(l.description || 'Designated checkpoint area'),
              capacity: typeof l.capacity === 'number' ? l.capacity : 2,
              active: l.active !== false,
              qrToken: String(l.qrToken || '1000000000'),
            }));

          if (sanitized.length === 10) {
            return sanitized;
          }
        }
      }
    } catch (e) {
      console.warn('Corrupted locations in storage, resetting to initial seed', e);
    }
    return INITIAL_LOCATIONS;
  }

  public static saveLocations(locations: LocationCheckpoint[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.LOCATIONS, JSON.stringify(locations));
    } catch (e) {
      console.error('Failed to save locations to storage', e);
    }
  }

  /**
   * Safely load and validate riddles array.
   */
  public static loadRiddles(): Riddle[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.RIDDLES);
      if (raw && raw !== 'undefined' && raw !== 'null') {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const sanitized: Riddle[] = parsed
            .filter((r) => r && typeof r === 'object' && r.id && typeof r.roundNumber === 'number')
            .map((r) => ({
              id: String(r.id),
              roundNumber: Number(r.roundNumber),
              title: String(r.title || `Challenge Round ${r.roundNumber}`),
              puzzleType: r.puzzleType || 'coding',
              descriptionMd: String(r.descriptionMd || 'Solve the challenge to proceed.'),
              acceptedAnswers: Array.isArray(r.acceptedAnswers) ? r.acceptedAnswers.map(String) : [],
              caseSensitive: Boolean(r.caseSensitive),
              normalizeWhitespace: r.normalizeWhitespace !== false,
              maxAttempts: typeof r.maxAttempts === 'number' ? r.maxAttempts : 5,
              hints: Array.isArray(r.hints) ? r.hints.map(String) : [],
              published: r.published !== false,
              allowedLanguages: r.allowedLanguages || ['python', 'cpp', 'java', 'c'],
              sampleCases: r.sampleCases || [],
              hiddenCases: r.hiddenCases || [],
              starterCode: r.starterCode || undefined,
            }));

          if (sanitized.length >= 10) {
            return sanitized;
          }
        }
      }
    } catch (e) {
      console.warn('Corrupted riddles in storage, resetting to initial seed', e);
    }
    return INITIAL_RIDDLES;
  }

  public static saveRiddles(riddles: Riddle[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.RIDDLES, JSON.stringify(riddles));
    } catch (e) {
      console.error('Failed to save riddles to storage', e);
    }
  }

  /**
   * Safely load and validate routes array.
   */
  public static loadRoutes(): RouteAssignment[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.ROUTES);
      if (raw && raw !== 'undefined' && raw !== 'null') {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length === 200) {
          const valid = parsed.every(
            (r) => r && typeof r === 'object' && r.teamId && typeof r.roundNumber === 'number' && typeof r.locationId === 'number'
          );
          if (valid) {
            return parsed;
          }
        }
      }
    } catch (e) {
      console.warn('Corrupted routes in storage, regenerating', e);
    }

    // Generate default routes if none exist or corrupted
    try {
      const teamIds = INITIAL_TEAMS.map((t) => t.id);
      const locIds = INITIAL_LOCATIONS.map((l) => l.id);
      const generated = generateBalancedRoutes(teamIds, locIds, 10);
      return generated.matrix;
    } catch (err) {
      console.error('Failed to generate initial routes:', err);
      return [];
    }
  }

  public static saveRoutes(routes: RouteAssignment[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.ROUTES, JSON.stringify(routes));
    } catch (e) {
      console.error('Failed to save routes to storage', e);
    }
  }

  /**
   * Safely load progress.
   */
  public static loadProgress(): TeamRoundProgress[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.PROGRESS);
      if (raw && raw !== 'undefined' && raw !== 'null') {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.filter(
            (p) => p && typeof p === 'object' && p.teamId && typeof p.roundNumber === 'number'
          );
        }
      }
    } catch (e) {
      console.warn('Failed to parse progress from storage', e);
    }
    return [];
  }

  public static saveProgress(progress: TeamRoundProgress[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.PROGRESS, JSON.stringify(progress));
    } catch (e) {
      console.error('Failed to save progress to storage', e);
    }
  }

  /**
   * Safely load anti-cheat incidents.
   */
  public static loadIncidents(): AntiCheatIncident[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.INCIDENTS);
      if (raw && raw !== 'undefined' && raw !== 'null') {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.filter((i) => i && typeof i === 'object' && i.id && i.teamId);
        }
      }
    } catch (e) {
      console.warn('Failed to parse incidents from storage', e);
    }
    return [];
  }

  public static saveIncidents(incidents: AntiCheatIncident[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.INCIDENTS, JSON.stringify(incidents));
    } catch (e) {
      console.error('Failed to save incidents to storage', e);
    }
  }

  /**
   * Safely load active team ID, ensuring it matches an existing team.
   */
  public static getActiveTeamId(validTeams?: Team[]): string | null {
    try {
      const teamId = localStorage.getItem(STORAGE_KEYS.ACTIVE_TEAM_ID);
      if (!teamId || teamId === 'undefined' || teamId === 'null') {
        return null;
      }
      if (validTeams && validTeams.length > 0) {
        const match = validTeams.find((t) => t.id === teamId);
        if (!match) {
          // Stale or invalid session - clear it immediately
          localStorage.removeItem(STORAGE_KEYS.ACTIVE_TEAM_ID);
          return null;
        }
      }
      return teamId;
    } catch {
      return null;
    }
  }

  public static setActiveTeamId(teamId: string | null): void {
    try {
      if (teamId) {
        localStorage.setItem(STORAGE_KEYS.ACTIVE_TEAM_ID, teamId);
      } else {
        localStorage.removeItem(STORAGE_KEYS.ACTIVE_TEAM_ID);
      }
    } catch (e) {
      console.error('Failed to set active team ID', e);
    }
  }

  public static getAdminAuth(): boolean {
    try {
      return localStorage.getItem(STORAGE_KEYS.ADMIN_AUTH) === 'true';
    } catch {
      return false;
    }
  }

  public static setAdminAuth(authenticated: boolean): void {
    try {
      localStorage.setItem(STORAGE_KEYS.ADMIN_AUTH, authenticated ? 'true' : 'false');
    } catch (e) {
      console.error('Failed to set admin auth', e);
    }
  }

  public static exportFullBackup(
    config: GameEventConfig,
    teams: Team[],
    locations: LocationCheckpoint[],
    riddles: Riddle[],
    routes: RouteAssignment[],
    progress: TeamRoundProgress[],
    incidents: AntiCheatIncident[]
  ): FullGameBackup {
    return {
      version: '2.0.0',
      exportedAt: new Date().toISOString(),
      config,
      teams,
      locations,
      riddles,
      routes,
      progress,
      incidents,
    };
  }

  public static clearAll(): void {
    try {
      Object.values(STORAGE_KEYS).forEach((k) => localStorage.removeItem(k));
    } catch (e) {
      console.error('Failed to clear storage keys', e);
    }
  }

  public static clearAllData(): void {
    StorageService.clearAll();
  }

  /**
   * Validate full backup data structure against schema
   */
  public static validateBackupData(backup: unknown): backup is FullGameBackup {
    if (!backup || typeof backup !== 'object') {
      return false;
    }
    const b = backup as Record<string, unknown>;
    return (
      b.version === '2.0.0' &&
      typeof b.exportedAt === 'string' &&
      b.config !== null &&
      typeof b.config === 'object' &&
      Array.isArray(b.teams) &&
      Array.isArray(b.locations) &&
      Array.isArray(b.riddles) &&
      Array.isArray(b.routes)
    );
  }
}

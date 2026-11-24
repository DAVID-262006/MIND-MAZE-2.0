import type { ViolationType, AntiCheatIncident, Team } from '../types';

export const WARNING_MESSAGES = {
  WARNING_1:
    'Attention! Suspicious activity detected. This is your first warning. Please remain on the game screen.',
  WARNING_2:
    'Second warning! You have violated the game rules again. One more warning will result in elimination.',
  WARNING_3:
    'FINAL WARNING! This is your last opportunity. Any further suspicious activity will result in immediate elimination.',
  ELIMINATED: 'YOU HAVE BEEN ELIMINATED!',
} as const;

export interface WarningConfig {
  warningNumber: number; // 1, 2, 3, or 4
  maxWarnings: number; // 3 warnings before 4th elimination
  heading: string;
  message: string;
  explanation: string;
  remainingWarnings: number;
  isFinalWarning: boolean;
  isEliminated: boolean;
}

export interface EvaluatedViolationResult {
  newStrikes: number;
  eliminated: boolean;
  config: WarningConfig;
  incident: AntiCheatIncident;
  reasonText: string;
}

export class ViolationManager {
  public static readonly MAX_WARNINGS = 3;
  public static readonly ELIMINATION_THRESHOLD = 4;

  /**
   * Return standardized warning UI text and badges for a given strike count.
   */
  public static getWarningConfig(strikeCount: number, violationType?: ViolationType): WarningConfig {
    const isEliminated = strikeCount >= this.ELIMINATION_THRESHOLD;
    const remainingWarnings = Math.max(0, this.MAX_WARNINGS - strikeCount);
    const isFinalWarning = strikeCount === 3;

    let heading = `WARNING ${strikeCount} OF 3`;
    let message: string = WARNING_MESSAGES.WARNING_1;

    if (strikeCount === 1) {
      heading = 'WARNING 1 OF 3';
      message = WARNING_MESSAGES.WARNING_1;
    } else if (strikeCount === 2) {
      heading = 'WARNING 2 OF 3';
      message = WARNING_MESSAGES.WARNING_2;
    } else if (strikeCount === 3) {
      heading = 'FINAL WARNING!';
      message = WARNING_MESSAGES.WARNING_3;
    } else if (strikeCount >= 4) {
      heading = 'YOU HAVE BEEN ELIMINATED!';
      message = WARNING_MESSAGES.ELIMINATED;
    }

    const explanation = this.getViolationExplanation(violationType);

    return {
      warningNumber: Math.min(strikeCount, 4),
      maxWarnings: this.MAX_WARNINGS,
      heading,
      message,
      explanation,
      remainingWarnings,
      isFinalWarning,
      isEliminated,
    };
  }

  /**
   * Return clear, human-readable description of the violation trigger.
   */
  public static getViolationExplanation(type?: ViolationType): string {
    switch (type) {
      case 'tab_switch':
        return 'Browser tab switch or app minimization detected. You left the active game screen.';
      case 'window_blur':
        return 'Browser window lost focus. Interaction with an external application or window detected.';
      case 'fullscreen_exit':
        return 'Fullscreen mode was exited. Fullscreen is strictly mandatory during active gameplay.';
      default:
        return 'Suspicious screen transition or navigation detected.';
    }
  }

  /**
   * Evaluates a violation attempt against a team's current state.
   */
  public static evaluateViolation(
    team: Team,
    type: ViolationType,
    metadata?: Record<string, unknown>
  ): EvaluatedViolationResult {
    const newStrikes = (team.strikes || 0) + 1;
    const eliminated = newStrikes >= this.ELIMINATION_THRESHOLD;
    const config = this.getWarningConfig(newStrikes, type);
    const reasonText = metadata?.reason
      ? String(metadata.reason)
      : this.getViolationExplanation(type);

    const incident: AntiCheatIncident = {
      id: `inc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      teamId: team.id,
      teamCode: team.teamCode,
      teamName: team.teamName,
      roundNumber: team.currentRound,
      violationType: type,
      strikeNumber: newStrikes,
      timestamp: new Date().toISOString(),
      metadata,
      status: eliminated ? 'eliminated' : 'warning',
      notes: reasonText,
    };

    return {
      newStrikes,
      eliminated,
      config,
      incident,
      reasonText,
    };
  }

  /**
   * Format chronological violation logs for a specific participant/team.
   */
  public static formatTeamViolationLogs(incidents: AntiCheatIncident[], teamId: string): string[] {
    const teamIncidents = incidents
      .filter((inc) => inc.teamId === teamId)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    return teamIncidents.map((inc, index) => {
      const timeStr = new Date(inc.timestamp).toLocaleTimeString();
      let eventDesc = 'Suspicious activity detected';
      if (inc.violationType === 'tab_switch') {
        eventDesc = 'Browser tab visibility lost';
      } else if (inc.violationType === 'window_blur') {
        eventDesc = 'Browser window lost focus';
      } else if (inc.violationType === 'fullscreen_exit') {
        eventDesc = 'Fullscreen exited';
      }
      return `${index + 1}. ${timeStr} – ${eventDesc}.`;
    });
  }

  /**
   * Return human-readable warning level label for admin monitoring.
   */
  public static getWarningLevelBadge(strikes: number, status: string): {
    label: string;
    variant: 'clean' | 'warning' | 'final' | 'eliminated';
  } {
    if (status === 'eliminated' || strikes >= 4) {
      return { label: 'Eliminated (4)', variant: 'eliminated' };
    }
    if (strikes === 3) {
      return { label: 'Final Warning (3)', variant: 'final' };
    }
    if (strikes === 2) {
      return { label: 'Warning 2 (2/3)', variant: 'warning' };
    }
    if (strikes === 1) {
      return { label: 'Warning 1 (1/3)', variant: 'warning' };
    }
    return { label: 'Clean (0)', variant: 'clean' };
  }
}

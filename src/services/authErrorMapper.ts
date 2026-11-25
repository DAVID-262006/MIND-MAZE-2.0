/**
 * MIND MAZE 2.0 — Centralized Participant Error Mapping Service
 * 
 * Invariant: The Participant Panel must never expose raw database, SQL,
 * Supabase, or migration errors (e.g. PGRST202, 42501, 42P01, 42703, relation does not exist).
 * Converts technical and backend errors into safe, consistent, friendly user-facing messages.
 */

export function mapAuthError(rawError: unknown): string {
  if (!rawError) {
    return 'Team not found. Please check your team name.';
  }

  const errStr = typeof rawError === 'string'
    ? rawError
    : typeof rawError === 'object' && rawError !== null && 'message' in rawError
    ? String((rawError as any).message || (rawError as any).error || '')
    : String(rawError);

  const clean = errStr.trim();
  const lower = clean.toLowerCase();

  // Missing team name
  if (
    lower.includes('team name is required') ||
    lower.includes('team_name_required') ||
    lower.includes('enter your team name') ||
    lower.includes('please enter')
  ) {
    return 'Please enter your team name.';
  }

  // Team already claimed / duplicate active session
  if (
    lower.includes('already taken') ||
    lower.includes('already_taken') ||
    lower.includes('team_already_taken') ||
    lower.includes('already claimed') ||
    lower.includes('already_claimed') ||
    lower.includes('already joined') ||
    lower.includes('team_already_claimed') ||
    lower.includes('already in game')
  ) {
    return 'This team name is already taken. Please choose another name.';
  }

  // Disqualified or eliminated team account
  if (
    lower.includes('inactive') ||
    lower.includes('disabled') ||
    lower.includes('team_eliminated') ||
    lower.includes('disqualified') ||
    lower.includes('eliminated')
  ) {
    return 'This team has been disqualified from the event.';
  }

  // Expired or invalid session
  if (
    lower.includes('expired') ||
    lower.includes('invalid_session') ||
    lower.includes('session invalid') ||
    lower.includes('session expired')
  ) {
    return 'Your session has expired. Please enter your team name to rejoin.';
  }

  // Network failure / Offline
  if (
    lower.includes('network') ||
    lower.includes('failed to fetch') ||
    lower.includes('offline') ||
    lower.includes('connection') ||
    lower.includes('econnrefused')
  ) {
    return 'Unable to join right now. Please try again.';
  }

  // Unregistered team / Team not found
  if (
    lower.includes('not found') ||
    lower.includes('team_not_found') ||
    lower.includes('unregistered') ||
    lower.includes('unknown team') ||
    lower.includes('invalid')
  ) {
    return 'Team not found. Please check your team name.';
  }

  // Database, SQL, Migration, or Supabase internal error codes
  if (
    lower.includes('pgrst') ||
    lower.includes('schema cache') ||
    lower.includes('relation') ||
    lower.includes('column') ||
    lower.includes('could not find the function') ||
    lower.includes('migration') ||
    lower.includes('42p01') ||
    lower.includes('42703') ||
    lower.includes('42501') ||
    lower.includes('syntax error') ||
    lower.includes('postgres') ||
    lower.includes('internal') ||
    lower.includes('stack')
  ) {
    console.warn('[AuthErrorMapper] Handled technical backend error safely:', clean.substring(0, 100));
    return 'The game is currently unavailable. Please contact the administrator.';
  }

  return 'Team not found. Please check your team name.';
}

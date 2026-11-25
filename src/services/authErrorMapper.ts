/**
 * MIND MAZE 2.0 — Centralized Authentication Error Mapping Service
 * 
 * Invariant: The Participant Panel must never expose raw database, SQL,
 * Supabase, or migration errors (e.g. PGRST202, 42501, 42P01, 42703, relation does not exist).
 * Converts technical and backend errors into safe, consistent user-facing messages.
 */

export function mapAuthError(rawError: unknown): string {
  if (!rawError) {
    return 'Invalid username or password. Please try again.';
  }

  const errStr = typeof rawError === 'string'
    ? rawError
    : typeof rawError === 'object' && rawError !== null && 'message' in rawError
    ? String((rawError as any).message || (rawError as any).error || '')
    : String(rawError);

  const clean = errStr.trim();
  const lower = clean.toLowerCase();

  // Missing credentials
  if (
    lower.includes('both username and password') ||
    lower.includes('username is required') ||
    lower.includes('password is required') ||
    lower.includes('missing credentials')
  ) {
    return 'Please enter both username and password.';
  }

  // Disabled or inactive team account
  if (
    lower.includes('inactive') ||
    lower.includes('disabled') ||
    lower.includes('team_eliminated') ||
    lower.includes('disqualified')
  ) {
    return 'This team account is currently inactive. Contact the event administrator.';
  }

  // Rate limiting / Account Lockout
  if (
    lower.includes('too many') ||
    lower.includes('rate limit') ||
    lower.includes('account_locked') ||
    lower.includes('locked until') ||
    lower.includes('locked')
  ) {
    return 'Too many attempts. Please wait before trying again.';
  }

  // Expired session
  if (
    lower.includes('expired') ||
    lower.includes('invalid_session') ||
    lower.includes('session invalid')
  ) {
    return 'Your session has expired. Please log in again.';
  }

  // Network failure / Offline
  if (
    lower.includes('network') ||
    lower.includes('failed to fetch') ||
    lower.includes('offline') ||
    lower.includes('connection') ||
    lower.includes('econnrefused')
  ) {
    return 'Unable to connect. Check your internet connection and try again.';
  }

  // Unregistered team / Invalid credentials
  if (
    lower.includes('invalid team username or password') ||
    lower.includes('invalid credentials') ||
    lower.includes('invalid username or password') ||
    lower.includes('not found') ||
    lower.includes('team not found') ||
    lower.includes('unregistered') ||
    lower.includes('credentials_not_initialized')
  ) {
    return 'Invalid username or password. Please check your credentials.';
  }

  // Database, SQL, Migration, or Supabase internal error codes (PGRST202, 42501, 42P01, 42703, etc.)
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
    // Log securely for dev/admin telemetry without leaking passwords or tokens
    console.warn('[AuthErrorMapper] Handled technical backend error safely:', clean.substring(0, 100));
    return 'Login is temporarily unavailable. Please try again shortly.';
  }

  // Default safe generic message (does not reveal username existence)
  return 'Invalid username or password. Please try again.';
}

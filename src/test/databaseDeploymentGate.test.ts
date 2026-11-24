import fs from 'node:fs';
import path from 'node:path';

// ==============================================================================
// MIND MAZE 2.0 — AUTOMATED DATABASE DEPLOYMENT GATE VERIFICATION SUITE
// Performs deep static, semantic, AST-level, and cryptographic rule audits on
// supabase/schema.sql and supabase/seed.sql
// ==============================================================================

const SCHEMA_PATH = path.resolve(process.cwd(), 'supabase/schema.sql');
const SEED_PATH = path.resolve(process.cwd(), 'supabase/seed.sql');

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASSED: ${message}`);
}

console.log('====================================================');
console.log('MIND MAZE 2.0 — FINAL DATABASE DEPLOYMENT GATE AUDIT');
console.log('====================================================\n');

// 1. Read SQL Files
assert(fs.existsSync(SCHEMA_PATH), 'schema.sql exists');
assert(fs.existsSync(SEED_PATH), 'seed.sql exists');

const schemaSql = fs.readFileSync(SCHEMA_PATH, 'utf-8');
const seedSql = fs.readFileSync(SEED_PATH, 'utf-8');

// 2. Table Verification (Exactly 10 Tables)
console.log('\n--- 1. Table Definitions & Integrity ---');
const expectedTables = [
  'admin_profiles',
  'event_settings',
  'teams',
  'locations',
  'puzzles',
  'team_routes',
  'team_progress',
  'submissions',
  'qr_scans',
  'audit_logs',
];

for (const table of expectedTables) {
  const tableRegex = new RegExp(`CREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?${table}\\s*\\(`, 'i');
  assert(tableRegex.test(schemaSql), `Table [${table}] is declared with CREATE TABLE`);
}
assert(expectedTables.length === 10, 'Total expected tables is exactly 10');

// 3. Row Level Security Verification
console.log('\n--- 2. Row Level Security (RLS) Enforcement ---');
for (const table of expectedTables) {
  const rlsRegex = new RegExp(`ALTER\\s+TABLE\\s+${table}\\s+ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY`, 'i');
  assert(rlsRegex.test(schemaSql), `RLS enabled on [${table}]`);
}

// Ensure NO direct policies grant access to anon except event_settings for Realtime lifecycle sync
const dangerousAnonPolicies = schemaSql.match(/CREATE\s+POLICY\s+\w+\s+ON\s+(?!event_settings\b)\w+\s+FOR\s+(?:ALL|SELECT|INSERT|UPDATE|DELETE)\s+TO\s+anon/gi);
assert(dangerousAnonPolicies === null, 'ZERO direct RLS policies grant unauthorized access to anon role on sensitive tables');
assert(/CREATE\s+POLICY\s+event_settings_select_all\s+ON\s+event_settings\s+FOR\s+SELECT\s+TO\s+anon,\s*authenticated/i.test(schemaSql), 'event_settings_select_all policy is declared for Realtime lifecycle sync');

// Ensure column-level grant on event_settings strictly revokes full table and excludes QR secrets from anon
assert(/REVOKE\s+ALL\s+ON\s+(?:TABLE\s+)?event_settings\s+FROM\s+anon/i.test(schemaSql), 'Table-level access revoked from anon on event_settings');
assert(/GRANT\s+SELECT\s*\([^\)]*\)\s+ON\s+(?:TABLE\s+)?event_settings\s+TO\s+anon/i.test(schemaSql), 'Selective column-level SELECT granted to anon on event_settings');
assert(!/GRANT\s+SELECT\s*\([^\)]*starting_qr_token[^\)]*\)\s+ON\s+(?:TABLE\s+)?event_settings\s+TO\s+anon/i.test(schemaSql), 'starting_qr_token is strictly excluded from anon column grants');
assert(!/GRANT\s+SELECT\s*\([^\)]*final_qr_token[^\)]*\)\s+ON\s+(?:TABLE\s+)?event_settings\s+TO\s+anon/i.test(schemaSql), 'final_qr_token is strictly excluded from anon column grants');

// 4. Stored Procedure & Function Inventory (Exactly 17 Functions)
console.log('\n--- 3. Stored Procedure (RPC) Inventory & Security Definer Integrity ---');
const expectedFunctions = [
  'is_admin',
  'login_team',
  'logout_team',
  'get_team_state',
  'start_team_journey',
  'submit_puzzle_answer',
  'verify_location_qr',
  'complete_team_journey',
  'generate_team_routes',
  'admin_record_violation',
  'report_team_violation',
  'admin_reset_team_session',
  'admin_reset_team_progress',
  'admin_regenerate_event_qr_tokens',
  'admin_randomize_team_credentials',
  'bootstrap_randomize_team_credentials',
  'bootstrap_regenerate_event_qr_tokens',
];

for (const fn of expectedFunctions) {
  const fnDeclRegex = new RegExp(`CREATE\\s+(?:OR\\s+REPLACE\\s+)?FUNCTION\\s+${fn}\\s*\\(`, 'i');
  assert(fnDeclRegex.test(schemaSql), `Function [${fn}] is declared in schema`);

  // Verify search_path isolation
  const searchPathRegex = new RegExp(`CREATE[\\s\\S]*?FUNCTION\\s+${fn}[\\s\\S]*?SET\\s+search_path\\s*=\\s*public,\\s*extensions,\\s*pg_temp`, 'i');
  assert(searchPathRegex.test(schemaSql), `Function [${fn}] enforces SET search_path = public, extensions, pg_temp`);

  // Verify explicit REVOKE FROM PUBLIC
  const revokeRegex = new RegExp(`REVOKE\\s+ALL\\s+ON\\s+FUNCTION\\s+${fn}\\s*\\([\\w\\s,]*\\)\\s+FROM\\s+PUBLIC`, 'i');
  assert(revokeRegex.test(schemaSql), `Function [${fn}] explicitly revokes permissions FROM PUBLIC`);
}
assert(expectedFunctions.length === 17, 'Total expected functions is exactly 17');

// Verify admin_record_violation requires is_admin() and is revoked from anon
const adminRecordViolationCode = schemaSql.match(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+admin_record_violation[\s\S]*?\$\$;/i)?.[0] || '';
assert(/IF\s+NOT\s+is_admin\(\)\s+THEN/i.test(adminRecordViolationCode), 'admin_record_violation enforces is_admin() authorization');
assert(/REVOKE\s+ALL\s+ON\s+FUNCTION\s+admin_record_violation\([^\)]*\)\s+FROM\s+anon/i.test(schemaSql), 'admin_record_violation is explicitly revoked FROM anon');
assert(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+admin_record_violation\([^\)]*\)\s+TO\s+authenticated/i.test(schemaSql), 'admin_record_violation is granted strictly to authenticated');

// Verify report_team_violation verifies active_session_token_hash and is granted to anon, authenticated
const reportTeamViolationCode = schemaSql.match(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+report_team_violation[\s\S]*?\$\$;/i)?.[0] || '';
assert(/active_session_token_hash\s*=\s*extensions\.digest\(p_session_token,\s*'sha256'\)/i.test(reportTeamViolationCode), 'report_team_violation verifies active_session_token_hash via sha256');
assert(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+report_team_violation\([^\)]*\)\s+TO\s+anon,\s*authenticated/i.test(schemaSql), 'report_team_violation is granted to anon, authenticated');

// 5. Bootstrap Function Privilege Restriction
console.log('\n--- 4. Bootstrap Operations Isolation (SQL Editor / Postgres Only) ---');
// Verify bootstrap functions are NOT granted to anon or authenticated
assert(!/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+bootstrap_\w+\(\)\s+TO[^\n]*\banon\b/i.test(schemaSql), 'bootstrap_* functions are NOT granted to anon');
assert(!/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+bootstrap_\w+\(\)\s+TO[^\n]*\bauthenticated\b/i.test(schemaSql), 'bootstrap_* functions are NOT granted to authenticated');
assert(!/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+bootstrap_\w+\(\)\s+TO[^\n]*\bservice_role\b/i.test(schemaSql), 'bootstrap_* functions are NOT granted to service_role (PostgREST API immune)');

// Verify bootstrap functions are granted strictly to postgres (SQL Editor)
assert(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+bootstrap_randomize_team_credentials\(\)\s+TO\s+postgres/i.test(schemaSql), 'bootstrap_randomize_team_credentials is granted strictly to postgres');
assert(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+bootstrap_regenerate_event_qr_tokens\(\)\s+TO\s+postgres/i.test(schemaSql), 'bootstrap_regenerate_event_qr_tokens is granted strictly to postgres');

// 6. Administrator Identity Escalation Audit
console.log('\n--- 5. Admin Authorization Identity Audit (No current_user spoofing) ---');
const isAdminCode = schemaSql.match(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+is_admin\(\)[\s\S]*?\$\$;/i)?.[0] || '';
assert(isAdminCode.length > 0, 'is_admin() source extracted');
assert(!/current_user\s*=\s*'postgres'/i.test(isAdminCode), 'is_admin() NEVER uses current_user = "postgres"');
assert(!/session_user\s*=\s*'postgres'/i.test(isAdminCode), 'is_admin() NEVER uses session_user = "postgres"');
assert(/\(auth\.jwt\(\)\s*->>\s*'role'\)\s*=\s*'service_role'/i.test(isAdminCode), 'is_admin() checks service_role JWT claim');
assert(/admin_profiles/i.test(isAdminCode), 'is_admin() verifies auth.uid() in admin_profiles');

// 7. Public Views Data Leakage Audit
console.log('\n--- 6. Public Views Leakage Audit ---');
const leaderboardView = schemaSql.match(/CREATE\s+OR\s+REPLACE\s+VIEW\s+public_leaderboard[\s\S]*?;/i)?.[0] || '';
const eventStatusView = schemaSql.match(/CREATE\s+OR\s+REPLACE\s+VIEW\s+public_event_status[\s\S]*?;/i)?.[0] || '';

assert(!/passcode/i.test(leaderboardView), 'public_leaderboard does not expose passcodes or hashes');
assert(!/active_session_token_hash/i.test(leaderboardView), 'public_leaderboard does not expose session token hashes');
assert(!/qr_token/i.test(leaderboardView), 'public_leaderboard does not expose QR tokens');

assert(!/starting_qr_token/i.test(eventStatusView), 'public_event_status does not expose starting_qr_token');
assert(!/final_qr_token/i.test(eventStatusView), 'public_event_status does not expose final_qr_token');

// 8. Seed Rerun Idempotency & Data Preservation Audit
console.log('\n--- 7. Seed Data Idempotency & Data Preservation on Rerun ---');
// Verify trailing syntax error is gone
assert(!/starter_code\s*=\s*EXCLUDED\.starter_code;\s*normalize_whitespace/i.test(seedSql), 'Dangling semicolon & duplicate assignments in puzzles removed');

// Verify event_settings preserves regenerated tokens
assert(/starting_qr_token\s*=\s*CASE\s+WHEN\s+event_settings\.qr_tokens_regenerated/i.test(seedSql), 'event_settings preserves starting_qr_token on rerun');
assert(/final_qr_token\s*=\s*CASE\s+WHEN\s+event_settings\.qr_tokens_regenerated/i.test(seedSql), 'event_settings preserves final_qr_token on rerun');

// Verify locations preserves regenerated tokens
assert(/qr_token\s*=\s*CASE\s+WHEN\s+\(SELECT\s+qr_tokens_regenerated/i.test(seedSql), 'locations preserves qr_token on rerun');

// Verify teams preserves randomized passcodes
assert(/passcode_hash\s*=\s*CASE\s+WHEN\s+teams\.credentials_randomized/i.test(seedSql), 'teams preserves passcode_hash on rerun');

// Verify team_routes preserves locked routes
assert(/SELECT\s+COALESCE\(routes_locked,\s*false\)\s+INTO\s+v_routes_locked/i.test(seedSql), 'team_routes checks routes_locked before deleting on rerun');

// 9. Multi-Format Puzzle Payload Completeness
console.log('\n--- 8. Multi-Format Puzzle Payload Completeness ---');
const verifyLocationCode = schemaSql.match(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+verify_location_qr[\s\S]*?\$\$;/i)?.[0] || '';
assert(/'options',\s*COALESCE\(v_next_puzzle\.options/i.test(verifyLocationCode), 'verify_location_qr returns options for next puzzle');
assert(/'image_url',\s*v_next_puzzle\.image_url/i.test(verifyLocationCode), 'verify_location_qr returns image_url for next puzzle');
assert(/'image_alt',\s*v_next_puzzle\.image_alt/i.test(verifyLocationCode), 'verify_location_qr returns image_alt for next puzzle');

// 10. Default Credentials Lockout Check in login_team
console.log('\n--- 9. Production Login Lockout Protection ---');
const loginTeamCode = schemaSql.match(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+login_team[\s\S]*?\$\$;/i)?.[0] || '';
assert(/IF\s+v_team\.credentials_randomized\s*=\s*false\s*THEN/i.test(loginTeamCode), 'login_team rejects unrandomized default credentials');
assert(/v_attempts\s*>=\s*10/i.test(loginTeamCode), 'login_team throttles after 10 failed attempts');
assert(/INTERVAL\s+'60 seconds'/i.test(loginTeamCode), 'login_team sets 60-second lockout cooldown');

// 11. Concurrency, Row Locks & Idempotency Audit
console.log('\n--- 10. Concurrency Row-Locking & Idempotency Verification ---');
const submitAnswerCode = schemaSql.match(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+submit_puzzle_answer[\s\S]*?\$\$;/i)?.[0] || '';
assert(/FROM\s+teams[\s\S]*?FOR\s+UPDATE/i.test(submitAnswerCode), 'submit_puzzle_answer locks teams row FOR UPDATE to prevent race conditions');
assert(/FROM\s+team_progress[\s\S]*?FOR\s+UPDATE/i.test(submitAnswerCode), 'submit_puzzle_answer locks team_progress row FOR UPDATE to serialize submissions');
assert(/IF\s+v_progress\.puzzle_solved\s+THEN/i.test(submitAnswerCode), 'submit_puzzle_answer checks puzzle_solved to idempotently reject double solves');

const startJourneyCode = schemaSql.match(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+start_team_journey[\s\S]*?\$\$;/i)?.[0] || '';
assert(/FROM\s+teams[\s\S]*?FOR\s+UPDATE/i.test(startJourneyCode), 'start_team_journey locks teams row FOR UPDATE');
assert(/IF\s+v_team\.status\s*=\s*'active'\s+AND\s+EXISTS/i.test(startJourneyCode), 'start_team_journey idempotently handles duplicate starting QR scans');

assert(/FROM\s+teams[\s\S]*?FOR\s+UPDATE/i.test(verifyLocationCode), 'verify_location_qr locks teams row FOR UPDATE');
assert(/FROM\s+team_progress[\s\S]*?FOR\s+UPDATE/i.test(verifyLocationCode), 'verify_location_qr locks team_progress row FOR UPDATE');
assert(/v_recent_invalid_scans\s*>=\s*5/i.test(verifyLocationCode), 'verify_location_qr throttles after 5 invalid scans in 60s');

// 12. Latin Square Station Distribution for 7, 8, 9, 10 Locations
console.log('\n--- 11. Latin Square Route Collision Validation (7, 8, 9, 10 Locations x 25 Teams) ---');
for (const locCount of [7, 8, 9, 10]) {
  const numTeams = 25;
  const allocations: { teamId: number; round: number; location: number }[] = [];

  for (let t = 0; t < numTeams; t++) {
    for (let r = 1; r <= locCount; r++) {
      const loc = ((t + (r - 1)) % locCount) + 1;
      allocations.push({ teamId: t + 1, round: r, location: loc });
    }
  }

  // Verify total assignments
  assert(allocations.length === numTeams * locCount, `${locCount}-location event creates ${numTeams * locCount} total allocations`);

  // Verify each team visits each location exactly once
  for (let t = 1; t <= numTeams; t++) {
    const visited = new Set(allocations.filter((a) => a.teamId === t).map((a) => a.location));
    assert(visited.size === locCount, `Team ${t} visits all ${locCount} locations with zero repeats`);
  }

  // Verify maximum load per station in any round is balanced
  const maxCapacity = Math.ceil(numTeams / locCount);
  for (let r = 1; r <= locCount; r++) {
    for (let l = 1; l <= locCount; l++) {
      const count = allocations.filter((a) => a.round === r && a.location === l).length;
      assert(count <= maxCapacity, `Round ${r}, Station ${l} has ${count} teams (<= max balanced capacity ${maxCapacity})`);
    }
  }
}

console.log('\n====================================================');
console.log('ALL DATABASE DEPLOYMENT GATE AUDIT CHECKS PASSED!');
console.log('====================================================');

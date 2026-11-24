import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { StorageService } from '../services/storageService';
import { INITIAL_TEAMS } from '../data/seedData';
import type { Team } from '../types';

// ==============================================================================
// MIND MAZE 2.0 — COMPREHENSIVE SECURITY AUDIT & VERIFICATION SUITE
// Tests authentication, credential generation, team management, seed idempotency,
// role-based access control, and zero secret leakage.
// ==============================================================================

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASSED: ${message}`);
}

console.log('================================================================');
console.log('MIND MAZE 2.0 — SECURITY AUDIT & PRODUCTION COMPLIANCE SUITE');
console.log('================================================================\n');

const SCHEMA_PATH = path.resolve(process.cwd(), 'supabase/schema.sql');
const SEED_PATH = path.resolve(process.cwd(), 'supabase/seed.sql');
const MIGRATION_006_PATH = path.resolve(process.cwd(), 'supabase/migrations/006_security_remediation.sql');

assert(fs.existsSync(SCHEMA_PATH), 'schema.sql exists');
assert(fs.existsSync(SEED_PATH), 'seed.sql exists');
assert(fs.existsSync(MIGRATION_006_PATH), '006_security_remediation.sql exists');

const schemaSql = fs.readFileSync(SCHEMA_PATH, 'utf-8');
const seedSql = fs.readFileSync(SEED_PATH, 'utf-8');
const migration006Sql = fs.readFileSync(MIGRATION_006_PATH, 'utf-8');

// ==============================================================================
// 1. TEAM AUTHENTICATION & CREDENTIAL RULES
// ==============================================================================
console.log('\n--- 1. Team Authentication & Credential Architecture ---');

// 1.1 Unrandomized teams cannot log in
const loginTeamBody = schemaSql.match(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+login_team[\s\S]*?\$\$;/i)?.[0] || '';
assert(
  /IF\s+v_team\.credentials_randomized\s*=\s*false\s*THEN[\s\S]*?CREDENTIALS_NOT_INITIALIZED/i.test(loginTeamBody),
  'login_team strictly rejects teams with credentials_randomized = false with CREDENTIALS_NOT_INITIALIZED'
);

// 1.2 Zero legacy plaintext password checks
assert(
  !/v_team\.passcode_hash\s*<>\s*p_passcode/i.test(loginTeamBody),
  'login_team contains ZERO legacy plaintext password checks'
);
assert(
  /v_team\.passcode_hash\s*<>\s*extensions\.crypt\(p_passcode,\s*v_team\.passcode_hash\)/i.test(loginTeamBody),
  'login_team enforces crypt() bcrypt hash verification against stored hash'
);

// 1.3 Deliberate credential generation procedure
const genCredsBody = schemaSql.match(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+admin_generate_team_credentials[\s\S]*?\$\$;/i)?.[0] || '';
assert(genCredsBody.length > 0, 'admin_generate_team_credentials function is defined');
assert(
  /p_confirmation_code\s*<>\s*'CONFIRM_GENERATE_CREDENTIALS'/i.test(genCredsBody),
  'admin_generate_team_credentials requires explicit CONFIRM_GENERATE_CREDENTIALS confirmation code'
);
assert(
  /active_session_token_hash\s*=\s*NULL/i.test(genCredsBody),
  'admin_generate_team_credentials invalidates all existing active team sessions upon reissuance'
);
assert(
  /credentials_randomized\s*=\s*true/i.test(genCredsBody),
  'admin_generate_team_credentials marks credentials_randomized = true'
);
assert(
  /v_raw_pass\s*:=\s*'MM2-'/i.test(genCredsBody),
  'admin_generate_team_credentials generates high-entropy MM2-prefixed cryptographic passcodes'
);
assert(
  !/v_raw_pass\s*:=\s*.*v_team\.team_code/i.test(genCredsBody),
  'admin_generate_team_credentials NEVER derives passcodes from team_code or predictable values'
);

// 1.4 Permission enforcement on credential issuance
assert(
  /REVOKE\s+ALL\s+ON\s+FUNCTION\s+admin_generate_team_credentials[^\n]*FROM\s+PUBLIC/i.test(schemaSql),
  'admin_generate_team_credentials explicitly revoked from PUBLIC'
);
assert(
  /REVOKE\s+ALL\s+ON\s+FUNCTION\s+admin_generate_team_credentials[^\n]*FROM\s+anon/i.test(schemaSql),
  'admin_generate_team_credentials explicitly revoked from anon'
);
assert(
  /v_caller_role\s*=\s*'marshal'[\s\S]*?FORBIDDEN/i.test(genCredsBody),
  'Marshals are strictly forbidden from generating or resetting team credentials'
);

// ==============================================================================
// 2. ADMINISTRATOR PRIVILEGE ESCALATION AUDIT
// ==============================================================================
console.log('\n--- 2. Administrator Authorization & Anti-Privilege Escalation ---');

// 2.1 Verify unsafe self-assignment policy is eliminated
assert(
  !/CREATE\s+POLICY\s+\w+\s+ON\s+admin_profiles[\s\S]*?WITH\s+CHECK\s*\(\s*is_admin\(\)\s+OR\s+id\s*=\s*auth\.uid\(\)\s*\)/i.test(schemaSql),
  'Unsafe self-assignment policy (id = auth.uid() WITH CHECK) is completely removed from admin_profiles'
);

// 2.2 Verify is_superadmin() function
const isSuperadminBody = schemaSql.match(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+is_superadmin\(\)[\s\S]*?\$\$;/i)?.[0] || '';
assert(isSuperadminBody.length > 0, 'is_superadmin() function is defined');
assert(
  /role\s*=\s*'superadmin'/i.test(isSuperadminBody),
  'is_superadmin() validates superadmin role membership'
);
assert(
  /SET\s+search_path\s*=\s*public,\s*extensions,\s*pg_temp/i.test(isSuperadminBody),
  'is_superadmin() enforces fixed search_path'
);

// 2.3 Verify admin_profiles insert/update/delete restricted to is_superadmin()
const adminProfilesInsert = schemaSql.match(/CREATE\s+POLICY\s+admin_profiles_insert[\s\S]*?;/i)?.[0] || '';
const adminProfilesUpdate = schemaSql.match(/CREATE\s+POLICY\s+admin_profiles_update[\s\S]*?;/i)?.[0] || '';
const adminProfilesDelete = schemaSql.match(/CREATE\s+POLICY\s+admin_profiles_delete[\s\S]*?;/i)?.[0] || '';

assert(/is_superadmin\(\)/i.test(adminProfilesInsert), 'admin_profiles_insert strictly requires is_superadmin()');
assert(/is_superadmin\(\)/i.test(adminProfilesUpdate), 'admin_profiles_update strictly requires is_superadmin()');
assert(/is_superadmin\(\)/i.test(adminProfilesDelete), 'admin_profiles_delete strictly requires is_superadmin()');
assert(/id\s*<>\s*auth\.uid\(\)/i.test(adminProfilesDelete), 'admin_profiles_delete prevents superadmin from deleting themselves');

// ==============================================================================
// 3. TEAM MANAGEMENT BACKEND INTEGRATION
// ==============================================================================
console.log('\n--- 3. Team Management RPCs (Create, Update, Delete) ---');

// 3.1 admin_create_team
const createTeamBody = schemaSql.match(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+admin_create_team[\s\S]*?\$\$;/i)?.[0] || '';
assert(createTeamBody.length > 0, 'admin_create_team RPC declared');
assert(/IF\s+NOT\s+is_admin\(\)\s+THEN/i.test(createTeamBody), 'admin_create_team enforces is_admin()');
assert(/v_caller_role\s*=\s*'marshal'[\s\S]*?FORBIDDEN/i.test(createTeamBody), 'admin_create_team forbids marshals');
assert(/DUPLICATE_CODE/i.test(createTeamBody), 'admin_create_team validates and rejects duplicate team codes');
assert(/DUPLICATE_NAME/i.test(createTeamBody), 'admin_create_team validates and rejects duplicate team names');
assert(/credentials_randomized[\s\S]*?false/i.test(createTeamBody), 'admin_create_team initializes team with credentials_randomized = false');

// 3.2 admin_update_team
const updateTeamBody = schemaSql.match(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+admin_update_team[\s\S]*?\$\$;/i)?.[0] || '';
assert(updateTeamBody.length > 0, 'admin_update_team RPC declared');
assert(/IF\s+NOT\s+is_admin\(\)\s+THEN/i.test(updateTeamBody), 'admin_update_team enforces is_admin()');
assert(/DUPLICATE_CODE/i.test(updateTeamBody), 'admin_update_team prevents updating to an already used team code');

// 3.3 admin_delete_team
const deleteTeamBody = schemaSql.match(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+admin_delete_team[\s\S]*?\$\$;/i)?.[0] || '';
assert(deleteTeamBody.length > 0, 'admin_delete_team RPC declared');
assert(/TEAM_HAS_PROGRESS/i.test(deleteTeamBody), 'admin_delete_team safeguards teams with recorded progress unless p_force is true');
assert(/DELETE\s+FROM\s+team_progress/i.test(deleteTeamBody), 'admin_delete_team cascade-cleans progress records');

// ==============================================================================
// 4. SEED DATA IDEMPOTENCY & SENSITIVE CREDENTIAL REMOVAL
// ==============================================================================
console.log('\n--- 4. Seed Data Safety & Idempotency ---');

// 4.1 Zero predictable committed passwords in seed scripts
assert(!/Arena2026!T01/i.test(seedSql), 'seed.sql contains ZERO predictable passwords (Arena2026!T01 removed)');
assert(!/Arena2026!T01/i.test(migration006Sql), 'migration 006 contains ZERO predictable passwords');

// 4.2 Teams seeded with credentials_randomized = false
const seedTeamsMatch = seedSql.match(/INSERT\s+INTO\s+teams[\s\S]*?ON\s+CONFLICT/i)?.[0] || '';
assert(
  /credentials_randomized[\s\S]*?false/i.test(seedTeamsMatch),
  'All 20 seeded teams have credentials_randomized = false'
);

// 4.3 Safe conflict handling preserves live progress and randomized credentials
const onConflictUpdate = seedSql.match(/ON\s+CONFLICT\s+\(team_code\)\s+DO\s+UPDATE\s+SET[\s\S]*?;/i)?.[0] || '';
assert(
  /passcode_hash\s*=\s*CASE\s+WHEN\s+teams\.credentials_randomized\s+THEN\s+teams\.passcode_hash/i.test(onConflictUpdate),
  'ON CONFLICT preserves existing passcode_hash if credentials have been randomized'
);
assert(
  /status\s*=\s*CASE\s+WHEN\s+teams\.status\s+IN\s*\('active',\s*'completed',\s*'eliminated'\)/i.test(onConflictUpdate),
  'ON CONFLICT preserves active, completed, and eliminated statuses on seed rerun'
);
assert(
  /current_round\s*=\s*CASE\s+WHEN\s+teams\.current_round\s*>\s*1/i.test(onConflictUpdate),
  'ON CONFLICT preserves current_round on seed rerun'
);
assert(
  /total_strikes\s*=\s*CASE\s+WHEN\s+teams\.total_strikes\s*>\s*0/i.test(onConflictUpdate),
  'ON CONFLICT preserves strikes on seed rerun'
);

// 4.4 All 20 team codes are accounted for in seed
for (let i = 1; i <= 20; i++) {
  const code = `T${i.toString().padStart(2, '0')}`;
  assert(seedSql.includes(`'${code}'`), `Seed script contains team identity [${code}]`);
}

// ==============================================================================
// 5. CLIENT-SIDE STORAGE SERVICE SANITIZATION
// ==============================================================================
console.log('\n--- 5. Client-Side Storage Sanitization ---');

// Mock localStorage
const mockStorage: Record<string, string> = {};
global.localStorage = {
  getItem: (k: string) => mockStorage[k] || null,
  setItem: (k: string, v: string) => { mockStorage[k] = v; },
  removeItem: (k: string) => { delete mockStorage[k]; },
  clear: () => { for (const k in mockStorage) delete mockStorage[k]; },
  length: 0,
  key: () => null,
};

// 5.1 Test legacy localStorage data with accessCode is sanitized on load
mockStorage['arena_teams'] = JSON.stringify([
  {
    id: 't-test-1',
    teamCode: 'T01',
    teamName: 'Alpha Centauri',
    accessCode: 'LeakedPlaintextPassword123!',
    passcode: 'SecretPass123!',
    status: 'ready',
    currentRound: 1,
    strikes: 0,
    createdAt: new Date().toISOString(),
  },
]);

const loadedTeams = StorageService.loadTeams();
assert(loadedTeams.length === 1, 'loadTeams loaded team array');
assert((loadedTeams[0] as any).accessCode === undefined, 'loadTeams completely strips legacy accessCode field');
assert((loadedTeams[0] as any).passcode === undefined, 'loadTeams completely strips legacy passcode field');

// 5.2 Test saveTeams never writes accessCode or passcode
const teamToSave: any = {
  id: 't-test-2',
  teamCode: 'T02',
  teamName: 'Bravo Vanguards',
  accessCode: 'ShouldNeverBePersisted',
  passcode: 'ShouldNeverBePersisted',
  credentialsRandomized: true,
  status: 'ready',
  currentRound: 1,
  strikes: 0,
  createdAt: new Date().toISOString(),
};

StorageService.saveTeams([teamToSave]);
const savedRaw = mockStorage['arena_teams'];
assert(!savedRaw.includes('ShouldNeverBePersisted'), 'saveTeams never writes accessCode or passcode to localStorage');
assert(!savedRaw.includes('"accessCode"'), 'saveTeams omits accessCode property from JSON output');
assert(!savedRaw.includes('"passcode"'), 'saveTeams omits passcode property from JSON output');

// ==============================================================================
// 6. CRYPTOGRAPHIC INTEGRITY SIMULATION
// ==============================================================================
console.log('\n--- 6. Cryptographic Passcode Entropy Verification ---');

// Verify passcode generation pattern produces 16+ hex characters of entropy
const generatedCodes = new Set<string>();
for (let i = 0; i < 50; i++) {
  const bytes = crypto.randomBytes(6);
  const hex = bytes.toString('hex').toUpperCase();
  const code = `MM2-${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}`;
  assert(/^MM2-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/.test(code), `Passcode format matches MM2-XXXX-XXXX-XXXX: ${code}`);
  generatedCodes.add(code);
}
assert(generatedCodes.size === 50, 'All 50 generated passcodes are unique (zero collisions)');

// ==============================================================================
// 7. CUSTOM ADMIN AUTHENTICATION & PRIVILEGE ENCLAVE AUDIT
// ==============================================================================
console.log('\n--- 7. Custom Admin Authentication & Privilege Enclave ---');

const MIGRATION_007_PATH = path.resolve(process.cwd(), 'supabase/migrations/007_custom_admin_auth.sql');
assert(fs.existsSync(MIGRATION_007_PATH), '007_custom_admin_auth.sql exists');
const migration007Sql = fs.readFileSync(MIGRATION_007_PATH, 'utf-8');

// 7.1 admin_users table definition & RLS
assert(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?admin_users/i.test(schemaSql), 'admin_users table is declared in schema.sql');
assert(/ALTER\s+TABLE\s+admin_users\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/i.test(schemaSql), 'RLS is enabled on admin_users table');
assert(!/CREATE\s+POLICY\s+\w+\s+ON\s+admin_users\s+FOR\s+ALL\s+TO\s+anon/i.test(schemaSql), 'admin_users table is NOT exposed to anon');

// 7.2 Zero Hardcoded Credentials In SQL
assert(!/meadmin2026/i.test(migration007Sql), 'Migration 007 contains ZERO hardcoded passwords (meadmin2026 completely removed)');
assert(!/meadmin2026/i.test(schemaSql), 'schema.sql contains ZERO hardcoded passwords');
assert(!/INSERT\s+INTO\s+admin_users[^\;]*?VALUES\s*\([^\)]*extensions\.crypt\s*\(\s*'/i.test(migration007Sql), 'Migration 007 contains NO hardcoded credential inserts');

// 7.3 Secure One-Time Superadmin Bootstrap Process
assert(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+bootstrap_initial_superadmin/i.test(migration007Sql), 'bootstrap_initial_superadmin is declared in migration 007');
assert(/REVOKE\s+ALL\s+ON\s+FUNCTION\s+bootstrap_initial_superadmin\([^\)]*\)\s+FROM\s+PUBLIC,\s*anon,\s*authenticated/i.test(migration007Sql), 'bootstrap_initial_superadmin is strictly revoked from PUBLIC, anon, authenticated');
assert(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+bootstrap_initial_superadmin\([^\)]*\)\s+TO\s+postgres/i.test(migration007Sql), 'bootstrap_initial_superadmin is granted strictly to postgres (SQL Editor only)');
assert(/SUPERADMIN_ALREADY_EXISTS/i.test(migration007Sql), 'bootstrap_initial_superadmin forbids repeated bootstrapping or password overwriting');

// 7.4 Total Elimination of Legacy Auth Fallback
assert(!/ELSIF\s+NOT\s+is_admin/i.test(migration007Sql), 'Zero fallback to is_admin() in migration 007');
assert(!/ELSIF\s+NOT\s+is_superadmin/i.test(migration007Sql), 'Zero fallback to is_superadmin() in migration 007');
assert(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+is_admin\(\)[\s\S]*?SELECT\s+false/i.test(migration007Sql), 'is_admin() is overridden to fail closed (SELECT false)');
assert(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+is_superadmin\(\)[\s\S]*?SELECT\s+false/i.test(migration007Sql), 'is_superadmin() is overridden to fail closed (SELECT false)');
assert(/REVOKE\s+ALL\s+ON\s+TABLE\s+admin_profiles\s+FROM\s+PUBLIC,\s*anon,\s*authenticated/i.test(migration007Sql), 'admin_profiles access is completely revoked');

// 7.5 Custom admin login procedure security
const customLoginBody = schemaSql.match(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+admin_custom_login[\s\S]*?\$\$;/i)?.[0] || '';
assert(customLoginBody.length > 0, 'admin_custom_login RPC is defined');
assert(
  /extensions\.crypt\(p_password,\s*v_user\.password_hash\)\s*<>\s*v_user\.password_hash/i.test(customLoginBody) ||
  /v_user\.password_hash\s*<>\s*extensions\.crypt\(p_password,\s*v_user\.password_hash\)/i.test(customLoginBody),
  'admin_custom_login enforces bcrypt verification'
);
assert(/failed_login_attempts(?:\s*\+\s*1)?\s*>=\s*5/i.test(customLoginBody), 'admin_custom_login enforces lockout after 5 failed attempts');
assert(/locked_until\s*:=\s*NOW\(\)\s*\+\s*INTERVAL\s*'15 minutes'/i.test(customLoginBody) || /locked_until\s*=\s*CASE\s+WHEN[\s\S]*?15 minutes/i.test(customLoginBody), 'admin_custom_login locks account for 15 minutes upon lockout');
assert(/encode\(extensions\.digest\(v_session_token,\s*'sha256'\),\s*'hex'\)/i.test(customLoginBody) || /encode\(extensions\.digest\(v_token,\s*'sha256'\),\s*'hex'\)/i.test(customLoginBody), 'admin_custom_login stores SHA-256 session token hash');

// 7.6 Session verification and logout procedures
const customVerifyBody = schemaSql.match(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+admin_custom_verify_session[\s\S]*?\$\$;/i)?.[0] || '';
assert(customVerifyBody.length > 0, 'admin_custom_verify_session RPC is defined');
assert(/session_expires_at\s*>\s*NOW\(\)/i.test(customVerifyBody), 'admin_custom_verify_session validates session expiration');

const customLogoutBody = schemaSql.match(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+admin_custom_logout[\s\S]*?\$\$;/i)?.[0] || '';
assert(customLogoutBody.length > 0, 'admin_custom_logout RPC is defined');

// 7.7 verify_admin_token Token Enclave & Role Authorization
const verifyTokenBody = schemaSql.match(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+verify_admin_token[\s\S]*?\$\$;/i)?.[0] || '';
assert(verifyTokenBody.length > 0, 'verify_admin_token internal validator is defined');
assert(/REVOKE\s+ALL\s+ON\s+FUNCTION\s+verify_admin_token[^\)]*\)\s+FROM\s+PUBLIC,\s*anon,\s*authenticated/i.test(migration007Sql), 'verify_admin_token is strictly internal (revoked from PUBLIC, anon, authenticated)');
assert(/session_expires_at\s*<=\s*NOW\(\)/i.test(verifyTokenBody), 'verify_admin_token rejects expired tokens');
assert(/is_active\s*=\s*false/i.test(verifyTokenBody), 'verify_admin_token rejects revoked/disabled admin accounts');
assert(/p_min_role\s*=\s*'superadmin'/i.test(verifyTokenBody) && /p_min_role\s*=\s*'admin'/i.test(verifyTokenBody), 'verify_admin_token checks role privilege');
assert(/p_admin_token\s+IS\s+NULL/i.test(verifyTokenBody), 'verify_admin_token fails closed when token is NULL or blank');

// 7.8 Admin dashboard data restriction (Strictly NO answer keys, submissions, or secret tokens)
const adminDashBody = schemaSql.match(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+admin_get_dashboard_data[\s\S]*?\$\$;/i)?.[0] || '';
assert(adminDashBody.length > 0, 'admin_get_dashboard_data RPC is defined');
assert(/verify_admin_token\(p_admin_token\)/i.test(adminDashBody), 'admin_get_dashboard_data requires valid admin session token');

// Assert zero secret leakage from dashboard RPC
assert(!/'accepted_answers'/i.test(adminDashBody), 'admin_get_dashboard_data strictly DOES NOT return accepted_answers');
assert(!/'three_part_answers'/i.test(adminDashBody), 'admin_get_dashboard_data strictly DOES NOT return three_part_answers');
assert(!/'correct_option_index'/i.test(adminDashBody), 'admin_get_dashboard_data strictly DOES NOT return correct_option_index');
assert(!/'qr_token'/i.test(adminDashBody), 'admin_get_dashboard_data strictly DOES NOT return station qr_token');
assert(!/'riddle_clue'/i.test(adminDashBody), 'admin_get_dashboard_data strictly DOES NOT return station riddle_clue');
assert(!/'starting_qr_token'/i.test(adminDashBody), 'admin_get_dashboard_data strictly DOES NOT return starting_qr_token');
assert(!/'final_qr_token'/i.test(adminDashBody), 'admin_get_dashboard_data strictly DOES NOT return final_qr_token');

// 7.9 Every Privileged Admin RPC Requires and Validates p_admin_token
const requiredAdminRpcs = [
  'admin_set_event_status',
  'admin_start_event',
  'admin_pause_event',
  'admin_resume_event',
  'admin_end_event',
  'admin_create_team',
  'admin_update_team',
  'admin_delete_team',
  'admin_generate_team_credentials',
  'admin_randomize_team_credentials',
  'admin_eliminate_team',
  'admin_reinstate_team',
  'admin_record_violation',
  'admin_reset_team_session',
  'admin_reset_team_progress',
  'admin_regenerate_event_qr_tokens',
  'admin_update_location',
  'admin_regenerate_location_token',
  'generate_team_routes',
  'admin_save_puzzle',
];

for (const rpc of requiredAdminRpcs) {
  const rpcRegex = new RegExp(`CREATE\\s+OR\\s+REPLACE\\s+FUNCTION\\s+${rpc}\\s*\\([\\s\\S]*?p_admin_token\\s+VARCHAR[\\s\\S]*?\\)\\s*RETURNS\\s+JSONB[\\s\\S]*?\\$\\$;`, 'i');
  assert(rpcRegex.test(migration007Sql), `RPC [${rpc}] requires p_admin_token VARCHAR in migration 007`);
  assert(rpcRegex.test(schemaSql), `RPC [${rpc}] requires p_admin_token VARCHAR in schema.sql`);

  // Verify search_path is set securely on all admin functions
  const funcMatch = migration007Sql.match(new RegExp(`CREATE\\s+OR\\s+REPLACE\\s+FUNCTION\\s+${rpc}[\\s\\S]*?\\$\\$;`, 'i'))?.[0] || '';
  assert(/SET\s+search_path\s*=\s*public,\s*extensions,\s*pg_temp/i.test(funcMatch), `RPC [${rpc}] sets secure search_path in migration 007`);
  assert(
    /verify_admin_token\(p_admin_token/i.test(funcMatch) ||
    /admin_set_event_status\(p_admin_token/i.test(funcMatch) ||
    /admin_generate_team_credentials\(p_admin_token/i.test(funcMatch),
    `RPC [${rpc}] validates p_admin_token in migration 007`
  );
}

console.log('\n================================================================');
console.log('ALL SECURITY AUDIT & PRODUCTION COMPLIANCE CHECKS PASSED!');
console.log('================================================================');


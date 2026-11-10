import { resolveViewFromLocation } from '../App';
import fs from 'fs';
import path from 'path';

let passed = 0;
let total = 0;

function assert(condition: boolean, msg: string) {
  total++;
  if (!condition) {
    console.error(`❌ FAILED: ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  }
  passed++;
  console.log(`✅ PASSED: ${msg}`);
}

console.log('====================================================');
console.log('MIND MAZE 2.0 — SPA CLIENT-SIDE ROUTING & 404 TEST');
console.log('====================================================\n');

// 1. Test Routing Resolver for Admin path variants
console.log('--- 1. Testing Route Resolver for Admin Paths ---');
const originalLocation = globalThis.window?.location;

function mockLocation(pathname: string, hash = '', search = '') {
  // @ts-ignore
  globalThis.window = {
    location: {
      pathname,
      hash,
      search,
    } as unknown as Location,
  } as unknown as Window & typeof globalThis;
}

mockLocation('/MIND-MAZE-2.0/admin');
assert(resolveViewFromLocation() === 'admin', 'Resolves /MIND-MAZE-2.0/admin to admin view');

mockLocation('/MIND-MAZE-2.0/admin/');
assert(resolveViewFromLocation() === 'admin', 'Resolves /MIND-MAZE-2.0/admin/ with trailing slash to admin view');

mockLocation('/admin');
assert(resolveViewFromLocation() === 'admin', 'Resolves root /admin to admin view');

mockLocation('/MIND-MAZE-2.0/admin', '', '?session=test&tab=puzzles');
assert(resolveViewFromLocation() === 'admin', 'Preserves query string and resolves to admin view');

mockLocation('/MIND-MAZE-2.0/', '#/admin');
assert(resolveViewFromLocation() === 'admin', 'Resolves hash #/admin to admin view');

mockLocation('/MIND-MAZE-2.0/', '#admin');
assert(resolveViewFromLocation() === 'admin', 'Resolves hash #admin to admin view');


// 2. Test Routing Resolver for Home & Player paths
console.log('\n--- 2. Testing Route Resolver for Home & Player Paths ---');
mockLocation('/MIND-MAZE-2.0/home');
assert(resolveViewFromLocation() === 'home', 'Resolves /MIND-MAZE-2.0/home to home view');

mockLocation('/MIND-MAZE-2.0/', '#/home');
assert(resolveViewFromLocation() === 'home', 'Resolves hash #/home to home view');

mockLocation('/MIND-MAZE-2.0/');
assert(resolveViewFromLocation() === 'player', 'Resolves root /MIND-MAZE-2.0/ to player arena view (default)');

mockLocation('/');
assert(resolveViewFromLocation() === 'player', 'Resolves root / to player arena view');


// 3. Test Build Artifacts (index.html & 404.html)
console.log('\n--- 3. Testing Build Output Artifacts & Base Paths ---');
const distDir = path.resolve(process.cwd(), 'dist');
const indexPath = path.join(distDir, 'index.html');
const notFoundPath = path.join(distDir, '404.html');

assert(fs.existsSync(indexPath), 'dist/index.html exists in build output');
assert(fs.existsSync(notFoundPath), 'dist/404.html exists in build output');

const indexHtml = fs.readFileSync(indexPath, 'utf-8');
const notFoundHtml = fs.readFileSync(notFoundPath, 'utf-8');

assert(indexHtml === notFoundHtml, 'dist/404.html is an exact replica of dist/index.html');
assert(indexHtml.includes('/MIND-MAZE-2.0/assets/'), 'dist/index.html references assets using /MIND-MAZE-2.0/ base path');
assert(notFoundHtml.includes('/MIND-MAZE-2.0/assets/'), 'dist/404.html references assets using /MIND-MAZE-2.0/ base path');
assert(!notFoundHtml.includes('./assets/'), 'dist/404.html does not use ambiguous relative asset paths (./assets/)');

console.log('\n====================================================');
console.log(`ALL SPA ROUTING TESTS PASSED! (${passed} / ${total} assertions verified)`);
console.log('====================================================\n');

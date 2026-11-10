import React from 'react';
import { renderToString } from 'react-dom/server';

// Mock browser globals
const storage: Record<string, string> = {};
const mockLocalStorage = {
  getItem: (key: string) => storage[key] !== undefined ? storage[key] : null,
  setItem: (key: string, val: string) => { storage[key] = String(val); },
  removeItem: (key: string) => { delete storage[key]; },
  clear: () => { Object.keys(storage).forEach(k => delete storage[k]); }
};

(global as any).window = {
  location: {
    hash: '',
    pathname: '/',
    reload: () => {}
  },
  localStorage: mockLocalStorage,
  addEventListener: () => {},
  removeEventListener: () => {},
  matchMedia: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} })
};
(global as any).localStorage = mockLocalStorage;
(global as any).document = {
  documentElement: {
    requestFullscreen: async () => {}
  },
  fullscreenElement: null,
  addEventListener: () => {},
  removeEventListener: () => {}
};

async function run() {
  console.log('--- Step 1: Test Storage Service & Seed Data ---');
  const { StorageService } = await import('../services/storageService');
  const config = StorageService.loadConfig();
  const teams = StorageService.loadTeams();
  const locations = StorageService.loadLocations();
  const riddles = StorageService.loadRiddles();
  const routes = StorageService.loadRoutes();
  const progress = StorageService.loadProgress();
  const incidents = StorageService.loadIncidents();
  console.log('Config loaded:', config.id, config.status);
  console.log('Teams count:', teams.length);
  console.log('Locations count:', locations.length);
  console.log('Riddles count:', riddles.length);
  console.log('Routes count:', routes.length);
  console.log('Progress count:', progress.length);
  console.log('Incidents count:', incidents.length);

  console.log('\n--- Step 2: Test Leaderboard calculation ---');
  const { calculateLeaderboard } = await import('../services/leaderboardEngine');
  const lb = calculateLeaderboard(teams, progress, config.eventStartedAt);
  console.log('Leaderboard calculated successfully, entries:', lb.length);

  console.log('\n--- Step 3: Test App component with default hash ---');
  const { App } = await import('../App');
  let html = renderToString(React.createElement(App));
  if (html.includes('Application Runtime Anomaly')) {
    console.error('FAIL: App rendered ErrorBoundary fallback!');
  } else {
    console.log('PASS: App rendered cleanly without ErrorBoundary fallback.');
  }

  console.log('\n--- Step 4: Test App component with #/admin hash ---');
  (global as any).window.location.hash = '#/admin';
  html = renderToString(React.createElement(App));
  if (html.includes('Application Runtime Anomaly')) {
    console.error('FAIL: App with #/admin rendered ErrorBoundary fallback!');
  } else {
    console.log('PASS: App with #/admin rendered cleanly.');
  }

  console.log('\n--- Step 5: Test App component with #/home hash ---');
  (global as any).window.location.hash = '#/home';
  html = renderToString(React.createElement(App));
  if (html.includes('Application Runtime Anomaly')) {
    console.error('FAIL: App with #/home rendered ErrorBoundary fallback!');
  } else {
    console.log('PASS: App with #/home rendered cleanly.');
  }

  console.log('\n--- Step 6: Test Admin tabs when authenticated ---');
  mockLocalStorage.setItem('arena_admin_auth', 'true');
  const { AdminPage } = await import('../pages/admin/AdminPage');
  const { GameProvider } = await import('../store/gameStore');
  const { ToastProvider } = await import('../components/ui/Toast');
  
  html = renderToString(
    React.createElement(ToastProvider, null,
      React.createElement(GameProvider, null,
        React.createElement(AdminPage, null)
      )
    )
  );
  if (html.includes('Application Runtime Anomaly')) {
    console.error('FAIL: Authenticated AdminPage rendered ErrorBoundary fallback!');
  } else {
    console.log('PASS: Authenticated AdminPage rendered cleanly.');
  }
}

run().catch(console.error);

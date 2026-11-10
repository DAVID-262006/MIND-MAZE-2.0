import React, { useState, useEffect, useCallback } from 'react';
import { GameProvider } from './store/gameStore';
import { ToastProvider } from './components/ui/Toast';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { HomePage } from './pages/HomePage';
import { PlayerArenaPage } from './pages/player/PlayerArenaPage';
import { AdminPage } from './pages/admin/AdminPage';

export type AppView = 'home' | 'player' | 'admin';

/**
 * Resolve current view from browser window location.
 * Accurately handles:
 * - Direct pathname: /MIND-MAZE-2.0/admin, /admin
 * - Direct pathname: /MIND-MAZE-2.0/home, /home
 * - Hash fallback: #/admin, #admin, #/home, #home
 * - Default root: /MIND-MAZE-2.0/ -> player
 */
export function resolveViewFromLocation(): AppView {
  if (typeof window === 'undefined') return 'player';

  const pathname = window.location.pathname.toLowerCase();
  const hash = window.location.hash.toLowerCase();

  // Check Admin route
  if (
    pathname.endsWith('/admin') ||
    pathname.endsWith('/admin/') ||
    pathname.includes('/admin/') ||
    hash.includes('admin')
  ) {
    return 'admin';
  }

  // Check Home route
  if (
    pathname.endsWith('/home') ||
    pathname.endsWith('/home/') ||
    pathname.includes('/home/') ||
    hash.includes('home')
  ) {
    return 'home';
  }

  // Default view is participant player arena
  return 'player';
}

export function App() {
  const [currentView, setCurrentView] = useState<AppView>(() => resolveViewFromLocation());

  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentView(resolveViewFromLocation());
    };

    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
    };
  }, []);

  const navigateTo = useCallback((view: AppView) => {
    setCurrentView(view);
    if (typeof window === 'undefined') return;

    // Detect GitHub Pages repo subpath
    const pathname = window.location.pathname;
    const isGhPages = pathname.toLowerCase().includes('/mind-maze-2.0');
    const base = isGhPages ? '/MIND-MAZE-2.0/' : '/';
    const search = window.location.search || '';

    let targetPath = base;
    if (view === 'admin') {
      targetPath = `${base}admin`;
    } else if (view === 'home') {
      targetPath = `${base}home`;
    }

    const fullUrl = `${targetPath}${search}`;

    if (window.location.pathname !== targetPath) {
      window.history.pushState(null, '', fullUrl);
    }
  }, []);

  return (
    <ErrorBoundary>
      <ToastProvider>
        <GameProvider>
          {currentView === 'home' && (
            <HomePage
              onNavigate={(v) => navigateTo(v)}
            />
          )}
          {currentView === 'player' && (
            <PlayerArenaPage
              onNavigateHome={() => navigateTo('home')}
            />
          )}
          {currentView === 'admin' && (
            <AdminPage
              onNavigateHome={() => navigateTo('home')}
              onNavigatePlayer={() => navigateTo('player')}
            />
          )}
        </GameProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}
export default App;

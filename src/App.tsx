import React, { useState, useEffect } from 'react';
import { GameProvider } from './store/gameStore';
import { ToastProvider } from './components/ui/Toast';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { HomePage } from './pages/HomePage';
import { PlayerArenaPage } from './pages/player/PlayerArenaPage';
import { AdminPage } from './pages/admin/AdminPage';

export type AppView = 'home' | 'player' | 'admin';

export function App() {
  const [currentView, setCurrentView] = useState<AppView>(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.toLowerCase();
      if (hash.includes('admin')) return 'admin';
      if (hash.includes('home')) return 'home';
      // Default to mobile-first player arena for participants
      return 'player';
    }
    return 'player';
  });

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.toLowerCase();
      if (hash.includes('admin')) {
        setCurrentView('admin');
      } else if (hash.includes('home')) {
        setCurrentView('home');
      } else {
        setCurrentView('player');
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigateTo = (view: AppView) => {
    setCurrentView(view);
    if (view === 'admin') {
      window.location.hash = '/admin';
    } else if (view === 'home') {
      window.location.hash = '/home';
    } else {
      window.location.hash = '/player';
    }
  };

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

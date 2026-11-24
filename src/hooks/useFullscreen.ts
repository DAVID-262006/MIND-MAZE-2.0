import { useState, useEffect, useCallback } from 'react';
import { FullscreenManager, type BrowserLimitations } from '../services/fullscreenManager';

export interface UseFullscreenResult {
  isFullscreen: boolean;
  isSupported: boolean;
  error: string | null;
  browserLimitations: BrowserLimitations;
  enterFullscreen: (element?: HTMLElement) => Promise<boolean>;
  exitFullscreen: () => Promise<boolean>;
  toggleFullscreen: () => Promise<boolean>;
  clearError: () => void;
}

export function useFullscreen(): UseFullscreenResult {
  const [isFullscreen, setIsFullscreen] = useState<boolean>(() => FullscreenManager.isFullscreen());
  const [isSupported] = useState<boolean>(() => FullscreenManager.isSupported());
  const [error, setError] = useState<string | null>(null);
  const [browserLimitations] = useState<BrowserLimitations>(() => FullscreenManager.getBrowserLimitations());

  useEffect(() => {
    // Initial sync
    setIsFullscreen(FullscreenManager.isFullscreen());

    // Listen to fullscreen changes across vendor prefixes
    const unsubscribe = FullscreenManager.onFullscreenChange((active) => {
      setIsFullscreen(active);
      if (active) {
        setError(null);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const enterFullscreen = useCallback(async (element?: HTMLElement): Promise<boolean> => {
    const res = await FullscreenManager.requestFullscreen(element);
    if (!res.success) {
      setError(res.error || 'Failed to enter fullscreen');
      return false;
    }
    setError(null);
    setIsFullscreen(true);
    return true;
  }, []);

  const exitFullscreen = useCallback(async (): Promise<boolean> => {
    const res = await FullscreenManager.exitFullscreen();
    if (!res.success) {
      setError(res.error || 'Failed to exit fullscreen');
      return false;
    }
    setError(null);
    setIsFullscreen(false);
    return true;
  }, []);

  const toggleFullscreen = useCallback(async (): Promise<boolean> => {
    if (isFullscreen) {
      return await exitFullscreen();
    } else {
      return await enterFullscreen();
    }
  }, [isFullscreen, enterFullscreen, exitFullscreen]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    isFullscreen,
    isSupported,
    error,
    browserLimitations,
    enterFullscreen,
    exitFullscreen,
    toggleFullscreen,
    clearError,
  };
}

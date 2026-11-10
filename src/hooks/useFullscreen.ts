import { useState, useEffect, useCallback } from 'react';

export interface UseFullscreenResult {
  isFullscreen: boolean;
  isSupported: boolean;
  enterFullscreen: () => Promise<boolean>;
  exitFullscreen: () => Promise<boolean>;
  toggleFullscreen: () => Promise<boolean>;
}

export function useFullscreen(): UseFullscreenResult {
  const [isFullscreen, setIsFullscreen] = useState<boolean>(() => {
    try {
      if (typeof document === 'undefined') return false;
      return !!(
        document.fullscreenElement ||
        (document as unknown as { webkitFullscreenElement?: Element }).webkitFullscreenElement ||
        (document as unknown as { mozFullScreenElement?: Element }).mozFullScreenElement ||
        (document as unknown as { msFullscreenElement?: Element }).msFullscreenElement
      );
    } catch {
      return false;
    }
  });

  const [isSupported, setIsSupported] = useState<boolean>(() => {
    try {
      if (typeof document === 'undefined') return false;
      return !!(
        document.fullscreenEnabled ||
        (document as unknown as { webkitFullscreenEnabled?: boolean }).webkitFullscreenEnabled ||
        (document as unknown as { mozFullScreenEnabled?: boolean }).mozFullScreenEnabled ||
        (document as unknown as { msFullscreenEnabled?: boolean }).msFullscreenEnabled
      );
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const handleFullscreenChange = () => {
      try {
        const active = !!(
          document.fullscreenElement ||
          (document as unknown as { webkitFullscreenElement?: Element }).webkitFullscreenElement ||
          (document as unknown as { mozFullScreenElement?: Element }).mozFullScreenElement ||
          (document as unknown as { msFullscreenElement?: Element }).msFullscreenElement
        );
        setIsFullscreen(active);
      } catch {
        setIsFullscreen(false);
      }
    };

    try {
      document.addEventListener('fullscreenchange', handleFullscreenChange);
      document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.addEventListener('mozfullscreenchange', handleFullscreenChange);
      document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    } catch (e) {
      console.warn('Fullscreen event listener registration not permitted:', e);
    }

    return () => {
      try {
        document.removeEventListener('fullscreenchange', handleFullscreenChange);
        document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
        document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
        document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
      } catch {}
    };
  }, []);

  const enterFullscreen = useCallback(async (): Promise<boolean> => {
    try {
      const docEl = document.documentElement as unknown as {
        requestFullscreen?: () => Promise<void>;
        webkitRequestFullscreen?: () => Promise<void>;
        mozRequestFullScreen?: () => Promise<void>;
        msRequestFullscreen?: () => Promise<void>;
      };

      if (docEl.requestFullscreen) {
        await docEl.requestFullscreen();
        return true;
      } else if (docEl.webkitRequestFullscreen) {
        await docEl.webkitRequestFullscreen();
        return true;
      } else if (docEl.mozRequestFullScreen) {
        await docEl.mozRequestFullScreen();
        return true;
      } else if (docEl.msRequestFullscreen) {
        await docEl.msRequestFullscreen();
        return true;
      }
      return false;
    } catch (err) {
      console.warn('Fullscreen request bypassed or not allowed by browser policy:', err);
      return false;
    }
  }, []);

  const exitFullscreen = useCallback(async (): Promise<boolean> => {
    try {
      const doc = document as unknown as {
        exitFullscreen?: () => Promise<void>;
        webkitExitFullscreen?: () => Promise<void>;
        mozCancelFullScreen?: () => Promise<void>;
        msExitFullscreen?: () => Promise<void>;
      };

      if (doc.exitFullscreen) {
        await doc.exitFullscreen();
        return true;
      } else if (doc.webkitExitFullscreen) {
        await doc.webkitExitFullscreen();
        return true;
      } else if (doc.mozCancelFullScreen) {
        await doc.mozCancelFullScreen();
        return true;
      } else if (doc.msExitFullscreen) {
        await doc.msExitFullscreen();
        return true;
      }
      return false;
    } catch (err) {
      console.warn('Exit fullscreen bypassed:', err);
      return false;
    }
  }, []);

  const toggleFullscreen = useCallback(async (): Promise<boolean> => {
    if (isFullscreen) {
      return await exitFullscreen();
    } else {
      return await enterFullscreen();
    }
  }, [isFullscreen, enterFullscreen, exitFullscreen]);

  return {
    isFullscreen,
    isSupported,
    enterFullscreen,
    exitFullscreen,
    toggleFullscreen,
  };
}


/**
 * MIND MAZE 2.0 — FULLSCREEN MANAGER SERVICE
 * Standard Fullscreen API orchestration across modern desktop and mobile browsers.
 *
 * ARCHITECTURAL TRANSPARENCY:
 * Browser fullscreen utilizes the standard W3C Fullscreen API (Element.requestFullscreen()).
 * It provides a controlled, focused interface for competitive gameplay.
 * It does NOT claim to be operating-system-level kiosk mode or hardware-locked proctoring.
 */

export interface FullscreenOperationResult {
  success: boolean;
  error?: string;
  isSupported: boolean;
}

export interface BrowserLimitations {
  isMobile: boolean;
  isIosSafari: boolean;
  supportsFullscreenApi: boolean;
  note: string;
}

export class FullscreenManager {
  /**
   * Check if Fullscreen API is supported in the current runtime environment.
   */
  public static isSupported(): boolean {
    if (typeof document === 'undefined') return false;
    const doc = document as unknown as {
      fullscreenEnabled?: boolean;
      webkitFullscreenEnabled?: boolean;
      mozFullScreenEnabled?: boolean;
      msFullscreenEnabled?: boolean;
    };
    return !!(
      doc.fullscreenEnabled ||
      doc.webkitFullscreenEnabled ||
      doc.mozFullScreenEnabled ||
      doc.msFullscreenEnabled
    );
  }

  /**
   * Check if document is currently in fullscreen mode.
   */
  public static isFullscreen(): boolean {
    if (typeof document === 'undefined') return false;
    const doc = document as unknown as {
      fullscreenElement?: Element;
      webkitFullscreenElement?: Element;
      mozFullScreenElement?: Element;
      msFullscreenElement?: Element;
    };
    return !!(
      doc.fullscreenElement ||
      doc.webkitFullscreenElement ||
      doc.mozFullScreenElement ||
      doc.msFullscreenElement
    );
  }

  /**
   * Request fullscreen mode on the document element.
   * MUST be called synchronously within a direct user gesture (click/touch tap).
   */
  public static async requestFullscreen(element?: HTMLElement): Promise<FullscreenOperationResult> {
    if (typeof document === 'undefined') {
      return { success: false, error: 'Document not available.', isSupported: false };
    }

    if (!this.isSupported()) {
      return {
        success: false,
        error: 'Fullscreen API is not supported by your current browser. If using iOS Safari, add to Home Screen for fullscreen mode.',
        isSupported: false,
      };
    }

    const targetEl = (element || document.documentElement) as unknown as {
      requestFullscreen?: () => Promise<void>;
      webkitRequestFullscreen?: () => Promise<void>;
      mozRequestFullScreen?: () => Promise<void>;
      msRequestFullscreen?: () => Promise<void>;
    };

    try {
      if (targetEl.requestFullscreen) {
        await targetEl.requestFullscreen();
        return { success: true, isSupported: true };
      } else if (targetEl.webkitRequestFullscreen) {
        await targetEl.webkitRequestFullscreen();
        return { success: true, isSupported: true };
      } else if (targetEl.mozRequestFullScreen) {
        await targetEl.mozRequestFullScreen();
        return { success: true, isSupported: true };
      } else if (targetEl.msRequestFullscreen) {
        await targetEl.msRequestFullscreen();
        return { success: true, isSupported: true };
      }

      return {
        success: false,
        error: 'Fullscreen request method not found on target element.',
        isSupported: false,
      };
    } catch (err: unknown) {
      const errorObj = err as Error;
      let userFriendlyMessage = 'Failed to enter fullscreen.';

      if (errorObj?.name === 'NotAllowedError') {
        userFriendlyMessage =
          'Fullscreen request was blocked. Modern browsers require direct interaction (button tap) to enter fullscreen.';
      } else if (errorObj?.name === 'SecurityError') {
        userFriendlyMessage =
          'Fullscreen permission is restricted by your browser security settings or embedded frame.';
      } else if (errorObj?.message) {
        userFriendlyMessage = `Fullscreen request failed: ${errorObj.message}`;
      }

      return {
        success: false,
        error: userFriendlyMessage,
        isSupported: true,
      };
    }
  }

  /**
   * Exit fullscreen mode.
   */
  public static async exitFullscreen(): Promise<FullscreenOperationResult> {
    if (typeof document === 'undefined' || !this.isFullscreen()) {
      return { success: true, isSupported: this.isSupported() };
    }

    const doc = document as unknown as {
      exitFullscreen?: () => Promise<void>;
      webkitExitFullscreen?: () => Promise<void>;
      mozCancelFullScreen?: () => Promise<void>;
      msExitFullscreen?: () => Promise<void>;
    };

    try {
      if (doc.exitFullscreen) {
        await doc.exitFullscreen();
        return { success: true, isSupported: true };
      } else if (doc.webkitExitFullscreen) {
        await doc.webkitExitFullscreen();
        return { success: true, isSupported: true };
      } else if (doc.mozCancelFullScreen) {
        await doc.mozCancelFullScreen();
        return { success: true, isSupported: true };
      } else if (doc.msExitFullscreen) {
        await doc.msExitFullscreen();
        return { success: true, isSupported: true };
      }
      return { success: false, error: 'Exit fullscreen not supported.', isSupported: false };
    } catch (err: unknown) {
      return {
        success: false,
        error: (err as Error)?.message || 'Failed to exit fullscreen.',
        isSupported: true,
      };
    }
  }

  /**
   * Subscribe to fullscreen changes across vendor prefixes.
   * Returns an unsubscribe cleanup callback.
   */
  public static onFullscreenChange(callback: (active: boolean) => void): () => void {
    if (typeof document === 'undefined') return () => {};

    const handleChange = () => {
      callback(this.isFullscreen());
    };

    const events = [
      'fullscreenchange',
      'webkitfullscreenchange',
      'mozfullscreenchange',
      'MSFullscreenChange',
    ];

    events.forEach((evt) => {
      document.addEventListener(evt, handleChange);
    });

    return () => {
      events.forEach((evt) => {
        document.removeEventListener(evt, handleChange);
      });
    };
  }

  /**
   * Report browser limitations transparently.
   */
  public static getBrowserLimitations(): BrowserLimitations {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      return {
        isMobile: false,
        isIosSafari: false,
        supportsFullscreenApi: false,
        note: 'Server-side or non-DOM environment.',
      };
    }

    const ua = navigator.userAgent;
    const isIos = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isSafari = /Safari/.test(ua) && !/Chrome|CriOS|FxiOS|EdgiOS/.test(ua);
    const isIosSafari = isIos && isSafari;
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
    const supportsFullscreen = this.isSupported();

    let note = 'Standard W3C Fullscreen supported.';
    if (isIosSafari) {
      note =
        'iOS Safari does not permit DOM element requestFullscreen on iPhone. For the best exam experience, use Add to Home Screen (PWA mode) or Chrome on Android / Desktop.';
    } else if (!supportsFullscreen) {
      note = 'Fullscreen API is disabled or not supported in this browser version.';
    }

    return {
      isMobile,
      isIosSafari,
      supportsFullscreenApi: supportsFullscreen,
      note,
    };
  }
}

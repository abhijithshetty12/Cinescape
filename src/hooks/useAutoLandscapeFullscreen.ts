import { useEffect } from 'react';

/**
 * Hook to automatically lock screen orientation to landscape when entering fullscreen
 * on mobile devices, and unlock it when exiting.
 */
export function useAutoLandscapeFullscreen() {
  useEffect(() => {
    const handleFullscreenChange = async () => {
      // document.fullscreenElement tells us which element is currently in fullscreen
      const isFullscreen = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );
      
      if (isFullscreen) {
        // Attempt to lock to landscape
        if (window.screen.orientation && typeof window.screen.orientation.lock === 'function') {
          try {
            await window.screen.orientation.lock('landscape-primary').catch(() => {
              // Fallback for browsers that might not support 'landscape-primary' but support 'landscape'
              return window.screen.orientation.lock('landscape');
            }).catch(() => {
              // Silently fail if both attempts fail (e.g. on desktop or unprivileged context)
            });
          } catch (err) {
            // Screen orientation lock might fail on desktop or unsupported devices
          }
        }
      } else {
        // Unlock when exiting fullscreen
        if (window.screen.orientation && typeof window.screen.orientation.unlock === 'function') {
          try {
            window.screen.orientation.unlock();
          } catch (err) {
            // Handle cases where unlock might throw
          }
        }
      }
    };

    // Standard event
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    // Prefixed events for older browsers/iOS
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);
}

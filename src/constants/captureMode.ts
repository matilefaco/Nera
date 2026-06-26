import { useEffect, useState } from 'react';

/**
 * Checks if Capture Mode (or marketing mode) is active based on the URL query string.
 */
export function isCaptureMode(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return params.get('capture') === 'true' || params.get('marketing') === 'true';
}

/**
 * React hook that returns whether Capture Mode is active, and automatically
 * adds the `.capture-mode` class to document.body when enabled.
 */
export function useCaptureMode(): boolean {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const isCapture = isCaptureMode();
    setActive(isCapture);

    if (isCapture) {
      document.body.classList.add('capture-mode');
      document.documentElement.classList.add('capture-mode');
    } else {
      document.body.classList.remove('capture-mode');
      document.documentElement.classList.remove('capture-mode');
    }
  }, []);

  return active;
}

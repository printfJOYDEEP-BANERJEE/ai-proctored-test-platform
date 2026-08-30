// useAutosave — fires every 30 seconds (NFR §13 Availability)
import { useEffect, useRef } from 'react';

/**
 * Autosave hook — calls saveFn every intervalMs (default 30s).
 * @param {Function} saveFn - async function to call
 * @param {number} intervalMs - default 30000
 * @param {boolean} enabled - whether autosave is active
 */
export function useAutosave(saveFn, intervalMs = 30000, enabled = true) {
  const saveFnRef = useRef(saveFn);
  saveFnRef.current = saveFn;

  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => {
      saveFnRef.current?.();
    }, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, enabled]);
}

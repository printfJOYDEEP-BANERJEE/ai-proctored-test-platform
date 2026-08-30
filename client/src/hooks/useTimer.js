// useTimer — server-synced countdown timer (FR-5.1)
// Timer is calculated client-side from server-issued timestamps (candidateStartTime/candidateEndTime)
// NFR: 60fps animations via CSS, no jitter; timer shown as HH:MM:SS
import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * @param {Date|string|null} candidateEndTime - Server-issued end time (ISO string or Date)
 * @param {Function} onExpire - Called when timer reaches 0
 * @returns {{ timeRemainingMs: number, formatted: string, urgency: 'normal'|'warning'|'danger' }}
 */
export function useTimer(candidateEndTime, onExpire) {
  const [timeRemainingMs, setTimeRemainingMs] = useState(0);
  const rafRef = useRef(null);
  const endTimeRef = useRef(null);
  const expiredRef = useRef(false);

  useEffect(() => {
    if (!candidateEndTime) return;
    endTimeRef.current = new Date(candidateEndTime).getTime();
    expiredRef.current = false;

    const tick = () => {
      const now = Date.now();
      const remaining = Math.max(0, endTimeRef.current - now);
      setTimeRemainingMs(remaining);

      if (remaining <= 0 && !expiredRef.current) {
        expiredRef.current = true;
        onExpire?.();
        return; // stop RAF loop
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [candidateEndTime, onExpire]);

  // Format as HH:MM:SS
  const totalSeconds = Math.floor(timeRemainingMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const formatted = [
    hours > 0 ? String(hours).padStart(2, '0') : null,
    String(minutes).padStart(2, '0'),
    String(seconds).padStart(2, '0'),
  ]
    .filter(Boolean)
    .join(':');

  // Urgency thresholds for timer color changes
  const urgency =
    timeRemainingMs <= 5 * 60 * 1000
      ? 'danger'
      : timeRemainingMs <= 15 * 60 * 1000
      ? 'warning'
      : 'normal';

  return { timeRemainingMs, formatted, urgency };
}

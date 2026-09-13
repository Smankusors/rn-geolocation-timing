import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import Geolocation, {
  GeolocationError,
  GeolocationResponse,
} from '@react-native-community/geolocation';

type TimingEntry = {
  id: string;
  startTime: number;
  endTime: number;
  durationMs: number;
  position: GeolocationResponse | null;
  error: GeolocationError | null;
};

type WatchEntry = {
  id: string;
  timestamp: number;
  durationSinceStartMs: number;
  position: GeolocationResponse | null;
  error: GeolocationError | null;
};

export const DEFAULT_TIMEOUT_MS = 15000;
export const DEFAULT_MAXIMUM_AGE_MS = 0;
export const DEFAULT_SKIP_PERMISSION_REQUESTS = false;

const BASE_GET_CURRENT_OPTIONS = {
  enableHighAccuracy: true,
} as const;

const BASE_WATCH_OPTIONS = {
  enableHighAccuracy: true,
  distanceFilter: 0,
  interval: 1000,
  fastestInterval: 1000,
} as const;

export function clampTimeout(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_TIMEOUT_MS;
  return Math.max(0, Math.min(600_000, Math.round(value)));
}

export function clampMaximumAge(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_MAXIMUM_AGE_MS;
  return Math.max(0, Math.min(86_400_000, Math.round(value)));
}

function configureFusedProvider(skipPermissionRequests: boolean) {
  if (Platform.OS === 'android') {
    Geolocation.setRNConfiguration({
      skipPermissionRequests,
      locationProvider: 'playServices',
    });
  }
}

function nowMs(): number {
  if (typeof globalThis.performance !== 'undefined' && typeof globalThis.performance.now === 'function') {
    return globalThis.performance.now();
  }
  return Date.now();
}

export type UseGeolocationTimingOptions = {
  defaultTimeoutMs?: number;
  defaultMaximumAgeMs?: number;
  defaultSkipPermissionRequests?: boolean;
};

export function useGeolocationTiming(options?: UseGeolocationTimingOptions) {
  const [timeoutMs, setTimeoutMs] = useState(() =>
    clampTimeout(options?.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS)
  );
  const [maximumAgeMs, setMaximumAgeMs] = useState(() =>
    clampMaximumAge(options?.defaultMaximumAgeMs ?? DEFAULT_MAXIMUM_AGE_MS)
  );
  const [skipPermissionRequests, setSkipPermissionRequests] = useState(
    options?.defaultSkipPermissionRequests ?? DEFAULT_SKIP_PERMISSION_REQUESTS
  );

  const [entries, setEntries] = useState<TimingEntry[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const isMeasuring = pendingCount > 0;

  const [watchEntries, setWatchEntries] = useState<WatchEntry[]>([]);
  const [isWatching, setIsWatching] = useState(false);
  const [watchError, setWatchError] = useState<GeolocationError | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const watchStartMsRef = useRef<number | null>(null);

  useEffect(() => {
    configureFusedProvider(skipPermissionRequests);
    return () => {
      if (watchIdRef.current !== null) {
        Geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [skipPermissionRequests]);

  const measureGetCurrentPosition = useCallback(
    async (override?: { timeoutMs?: number; maximumAgeMs?: number }): Promise<TimingEntry> => {
      configureFusedProvider(skipPermissionRequests);
      setPendingCount((c) => c + 1);
      const start = nowMs();
      const timeout = clampTimeout(override?.timeoutMs ?? timeoutMs);
      const maximumAge = clampMaximumAge(override?.maximumAgeMs ?? maximumAgeMs);

      const entry = await new Promise<TimingEntry>((resolve) => {
        Geolocation.getCurrentPosition(
          (position) => {
            const end = nowMs();
            const e: TimingEntry = {
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              startTime: start,
              endTime: end,
              durationMs: end - start,
              position,
              error: null,
            };
            setEntries((prev) => [e, ...prev]);
            setPendingCount((c) => Math.max(0, c - 1));
            resolve(e);
          },
          (error) => {
            const end = nowMs();
            const e: TimingEntry = {
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              startTime: start,
              endTime: end,
              durationMs: end - start,
              position: null,
              error,
            };
            setEntries((prev) => [e, ...prev]);
            setPendingCount((c) => Math.max(0, c - 1));
            resolve(e);
          },
          { ...BASE_GET_CURRENT_OPTIONS, timeout, maximumAge }
        );
      });

      return entry;
    },
    [timeoutMs, maximumAgeMs, skipPermissionRequests]
  );

  const clearEntries = useCallback(() => setEntries([]), []);

  const startWatchPosition = useCallback(() => {
    if (watchIdRef.current !== null) return;
    configureFusedProvider(skipPermissionRequests);
    setWatchError(null);
    const startMs = nowMs();
    watchStartMsRef.current = startMs;
    setIsWatching(true);

    const watchId = Geolocation.watchPosition(
      (position) => {
        const now = nowMs();
        const durationSinceStartMs = startMs !== null ? now - startMs : 0;
        const e: WatchEntry = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          timestamp: Date.now(),
          durationSinceStartMs,
          position,
          error: null,
        };
        setWatchEntries((prev) => [e, ...prev]);
        setWatchError(null);
      },
      (error) => {
        const now = nowMs();
        const durationSinceStartMs = startMs !== null ? now - startMs : 0;
        const e: WatchEntry = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          timestamp: Date.now(),
          durationSinceStartMs,
          position: null,
          error,
        };
        setWatchEntries((prev) => [e, ...prev]);
        setWatchError(error);
      },
      { ...BASE_WATCH_OPTIONS, timeout: DEFAULT_TIMEOUT_MS, maximumAge: DEFAULT_MAXIMUM_AGE_MS }
    );
    watchIdRef.current = watchId;
  }, [skipPermissionRequests]);

  const stopWatchPosition = useCallback(() => {
    if (watchIdRef.current !== null) {
      Geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsWatching(false);
  }, []);

  const clearWatchEntries = useCallback(() => setWatchEntries([]), []);

  const setTimeoutMsClamped = useCallback((value: number) => {
    setTimeoutMs(clampTimeout(value));
  }, []);

  const setMaximumAgeMsClamped = useCallback((value: number) => {
    setMaximumAgeMs(clampMaximumAge(value));
  }, []);

  return {
    entries,
    isMeasuring,
    pendingCount,
    measureGetCurrentPosition,
    clearEntries,
    lastEntry: entries[0] ?? null,
    watchEntries,
    isWatching,
    watchError,
    startWatchPosition,
    stopWatchPosition,
    clearWatchEntries,
    lastWatchEntry: watchEntries[0] ?? null,
    timeoutMs,
    setTimeoutMs: setTimeoutMsClamped,
    maximumAgeMs,
    setMaximumAgeMs: setMaximumAgeMsClamped,
    skipPermissionRequests,
    setSkipPermissionRequests,
  };
}

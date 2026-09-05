import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import Geolocation, {
  GeolocationError,
  GeolocationResponse,
} from '@react-native-community/geolocation';

export type TimingEntry = {
  id: string;
  startTime: number;
  endTime: number;
  durationMs: number;
  position: GeolocationResponse | null;
  error: GeolocationError | null;
};

export type WatchEntry = {
  id: string;
  timestamp: number;
  durationSinceStartMs: number;
  position: GeolocationResponse | null;
  error: GeolocationError | null;
};

const DEFAULT_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 15000,
  maximumAge: 0,
} as const;

const WATCH_OPTIONS = {
  enableHighAccuracy: true,
  distanceFilter: 0,
  interval: 1000,
  fastestInterval: 1000,
  timeout: 15000,
  maximumAge: 0,
} as const;

function configureFusedProvider() {
  if (Platform.OS === 'android') {
    Geolocation.setRNConfiguration({
      skipPermissionRequests: false,
      locationProvider: 'playServices',
    });
  } else if (Platform.OS === 'ios') {
    Geolocation.setRNConfiguration({
      skipPermissionRequests: false,
      authorizationLevel: 'whenInUse',
    });
  }
}

function nowMs(): number {
  if (typeof globalThis.performance !== 'undefined' && typeof globalThis.performance.now === 'function') {
    return globalThis.performance.now();
  }
  return Date.now();
}

export function useGeolocationTiming() {
  const [entries, setEntries] = useState<TimingEntry[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const isMeasuring = pendingCount > 0;

  const [watchEntries, setWatchEntries] = useState<WatchEntry[]>([]);
  const [isWatching, setIsWatching] = useState(false);
  const [watchError, setWatchError] = useState<GeolocationError | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const watchStartMsRef = useRef<number | null>(null);

  useEffect(() => {
    configureFusedProvider();
    return () => {
      if (watchIdRef.current !== null) {
        Geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  const measureGetCurrentPosition = useCallback(async (): Promise<TimingEntry> => {
    configureFusedProvider();
    setPendingCount((c) => c + 1);
    const start = nowMs();

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
        DEFAULT_OPTIONS
      );
    });

    return entry;
  }, []);

  const measureConcurrentGetCurrentPosition = useCallback(
    async (count: number = 5): Promise<TimingEntry[]> => {
      const promises = Array.from({ length: count }, () => measureGetCurrentPosition());
      return Promise.all(promises);
    },
    [measureGetCurrentPosition]
  );

  const clearEntries = useCallback(() => setEntries([]), []);

  const startWatchPosition = useCallback(() => {
    if (watchIdRef.current !== null) return;
    configureFusedProvider();
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
      WATCH_OPTIONS
    );
    watchIdRef.current = watchId;
  }, []);

  const stopWatchPosition = useCallback(() => {
    if (watchIdRef.current !== null) {
      Geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsWatching(false);
  }, []);

  const clearWatchEntries = useCallback(() => setWatchEntries([]), []);

  return {
    entries,
    isMeasuring,
    pendingCount,
    measureGetCurrentPosition,
    measureConcurrentGetCurrentPosition,
    clearEntries,
    lastEntry: entries[0] ?? null,
    watchEntries,
    isWatching,
    watchError,
    startWatchPosition,
    stopWatchPosition,
    clearWatchEntries,
    lastWatchEntry: watchEntries[0] ?? null,
  };
}

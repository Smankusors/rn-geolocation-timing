import { useCallback, useEffect, useRef, useState } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
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

  const requestAuthorization = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === 'android') {
      try {
        const fine = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
        const coarse = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION);
        if (fine || coarse) return true;
        const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION, {
          title: 'Location Permission',
          message: 'This app needs access to your location to measure getCurrentPosition timing with the fused provider.',
          buttonPositive: 'OK',
          buttonNegative: 'Cancel',
          buttonNeutral: 'Ask Me Later',
        });
        return result === PermissionsAndroid.RESULTS.GRANTED;
      } catch {
        return false;
      }
    }

    if (Platform.OS === 'ios') {
      return new Promise((resolve) => {
        Geolocation.requestAuthorization(
          () => resolve(true),
          () => resolve(false)
        );
      });
    }

    return true;
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
      // Fire `count` getCurrentPosition calls concurrently without awaiting
      // each other – this is the reproduction for
      // https://github.com/michalchudziak/react-native-geolocation/issues/357
      // where PlayServicesLocationManager stored only the latest
      // mSingleLocationCallback and the first callback nulled it before the
      // second could call removeLocationUpdates(null).
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
    requestAuthorization,
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

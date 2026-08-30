import { useCallback, useEffect, useRef, useState } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import Geolocation, {
  GeolocationError,
  GeolocationResponse,
} from '@react-native-community/geolocation';

export type LocationProvider = 'playServices' | 'android' | 'auto';

export type TimingOptions = {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
};

export type TimingEntry = {
  id: string;
  startTime: number;
  endTime: number;
  durationMs: number;
  position: GeolocationResponse | null;
  error: GeolocationError | null;
  options: Required<TimingOptions>;
  locationProvider: LocationProvider;
};

const DEFAULT_OPTIONS: Required<TimingOptions> = {
  enableHighAccuracy: true,
  timeout: 15000,
  maximumAge: 0,
};

// Configure once – fused location provider (Google Play Services) on Android.
// See https://github.com/michalchudziak/react-native-geolocation#details
function configureFusedProvider(provider: LocationProvider) {
  if (Platform.OS === 'android') {
    Geolocation.setRNConfiguration({
      skipPermissionRequests: false,
      locationProvider: provider,
    });
  } else if (Platform.OS === 'ios') {
    Geolocation.setRNConfiguration({
      skipPermissionRequests: false,
      authorizationLevel: 'whenInUse',
    });
  }
}

function nowMs(): number {
  // performance.now() gives sub-ms monotonic time; fallback to Date.now()
  if (typeof globalThis.performance !== 'undefined' && typeof globalThis.performance.now === 'function') {
    return globalThis.performance.now();
  }
  return Date.now();
}

export function useGeolocationTiming(initialProvider: LocationProvider = 'playServices') {
  const [provider, setProvider] = useState<LocationProvider>(initialProvider);
  const [entries, setEntries] = useState<TimingEntry[]>([]);
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<string>('unknown');
  const configuredProviderRef = useRef<LocationProvider | null>(null);

  // Keep native module configured to requested provider.
  useEffect(() => {
    if (configuredProviderRef.current !== provider) {
      configureFusedProvider(provider);
      configuredProviderRef.current = provider;
    }
  }, [provider]);

  const requestAuthorization = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === 'android') {
      try {
        const fine = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
        const coarse = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION);
        if (fine || coarse) {
          setPermissionStatus(fine ? 'granted_fine' : 'granted_coarse');
          return true;
        }
        const result = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location Permission',
            message: 'This app needs access to your location to measure getCurrentPosition timing with the fused provider.',
            buttonPositive: 'OK',
            buttonNegative: 'Cancel',
            buttonNeutral: 'Ask Me Later',
          }
        );
        const granted = result === PermissionsAndroid.RESULTS.GRANTED;
        setPermissionStatus(granted ? 'granted_fine' : result);
        return granted;
      } catch (e) {
        setPermissionStatus(`error: ${String(e)}`);
        return false;
      }
    }

    if (Platform.OS === 'ios') {
      return new Promise((resolve) => {
        Geolocation.requestAuthorization(
          () => {
            setPermissionStatus('granted');
            resolve(true);
          },
          (err) => {
            setPermissionStatus(`denied: ${err.message}`);
            resolve(false);
          }
        );
      });
    }

    // web – browser will prompt on getCurrentPosition
    setPermissionStatus('web_prompt');
    return true;
  }, []);

  const measureGetCurrentPosition = useCallback(
    async (overrides: TimingOptions = {}): Promise<TimingEntry> => {
      const options: Required<TimingOptions> = { ...DEFAULT_OPTIONS, ...overrides };

      // Ensure fused provider is active before each call (in case user switched).
      configureFusedProvider(provider);

      setIsMeasuring(true);
      const start = nowMs();

      const entry = await new Promise<TimingEntry>((resolve) => {
        Geolocation.getCurrentPosition(
          (position) => {
            const end = nowMs();
            const durationMs = end - start;
            const e: TimingEntry = {
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              startTime: start,
              endTime: end,
              durationMs,
              position,
              error: null,
              options,
              locationProvider: provider,
            };
            setEntries((prev) => [e, ...prev]);
            setIsMeasuring(false);
            resolve(e);
          },
          (error) => {
            const end = nowMs();
            const durationMs = end - start;
            const e: TimingEntry = {
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              startTime: start,
              endTime: end,
              durationMs,
              position: null,
              error,
              options,
              locationProvider: provider,
            };
            setEntries((prev) => [e, ...prev]);
            setIsMeasuring(false);
            resolve(e);
          },
          options
        );
      });

      return entry;
    },
    [provider]
  );

  const clearEntries = useCallback(() => setEntries([]), []);

  const changeProvider = useCallback((next: LocationProvider) => {
    setProvider(next);
  }, []);

  return {
    provider,
    setProvider: changeProvider,
    entries,
    isMeasuring,
    permissionStatus,
    requestAuthorization,
    measureGetCurrentPosition,
    clearEntries,
    lastEntry: entries[0] ?? null,
  };
}

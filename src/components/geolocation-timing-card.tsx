import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { LocationProvider, useGeolocationTiming } from '@/hooks/useGeolocationTiming';

const PROVIDERS: LocationProvider[] = ['playServices', 'android', 'auto'];

export function GeolocationTimingCard() {
  const theme = useTheme();
  const {
    provider,
    setProvider,
    entries,
    isMeasuring,
    permissionStatus,
    requestAuthorization,
    measureGetCurrentPosition,
    clearEntries,
    lastEntry,
  } = useGeolocationTiming('playServices');

  const [authBusy, setAuthBusy] = useState(false);

  const onRequestPermission = async () => {
    setAuthBusy(true);
    try {
      await requestAuthorization();
    } finally {
      setAuthBusy(false);
    }
  };

  const onMeasure = async () => {
    await measureGetCurrentPosition({ enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  };

  const onMeasureCached = async () => {
    await measureGetCurrentPosition({ enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 });
  };

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="subtitle">Geolocation timing</ThemedText>
      <ThemedText type="small" style={{ color: theme.textSecondary }}>
        @react-native-community/geolocation · getCurrentPosition with fused provider
      </ThemedText>

      {Platform.OS === 'android' && (
        <ThemedView style={[styles.row, { backgroundColor: 'transparent' }]}>
          <ThemedText type="small">Location provider:</ThemedText>
          <ThemedView style={[styles.providerRow, { backgroundColor: 'transparent' }]}>
            {PROVIDERS.map((p) => {
              const active = p === provider;
              return (
                <Pressable
                  key={p}
                  onPress={() => setProvider(p)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: active ? theme.backgroundSelected : theme.background,
                      borderColor: active ? theme.text : theme.backgroundSelected,
                    },
                  ]}
                >
                  <Text style={[styles.chipText, { color: theme.text }]}>{p}</Text>
                  {active && provider === 'playServices' && (
                    <Text style={[styles.chipSub, { color: theme.textSecondary }]}> (Fused)</Text>
                  )}
                </Pressable>
              );
            })}
          </ThemedView>
        </ThemedView>
      )}

      {Platform.OS === 'android' && provider !== 'playServices' && (
        <ThemedText type="small" style={{ color: theme.textSecondary }}>
          Tip: select <ThemedText type="code">playServices</ThemedText> to force the Fused Location Provider (Google Play Services).
        </ThemedText>
      )}

      <ThemedView style={[styles.row, { backgroundColor: 'transparent' }]}>
        <ThemedText type="small">Permission: </ThemedText>
        <ThemedText type="code">{permissionStatus}</ThemedText>
      </ThemedView>

      <ThemedView style={[styles.buttonRow, { backgroundColor: 'transparent' }]}>
        <Pressable
          onPress={onRequestPermission}
          disabled={authBusy}
          style={[styles.button, { backgroundColor: theme.backgroundSelected, opacity: authBusy ? 0.6 : 1 }]}
        >
          <ThemedText type="small">{authBusy ? 'Requesting…' : 'Request permission'}</ThemedText>
        </Pressable>

        <Pressable
          onPress={onMeasure}
          disabled={isMeasuring}
          style={[styles.buttonPrimary, { opacity: isMeasuring ? 0.6 : 1 }]}
        >
          {isMeasuring ? <ActivityIndicator size="small" color="#fff" /> : null}
          <Text style={styles.buttonPrimaryText}>{isMeasuring ? ' Measuring…' : 'getCurrentPosition'}</Text>
        </Pressable>
      </ThemedView>

      <ThemedView style={[styles.buttonRow, { backgroundColor: 'transparent' }]}>
        <Pressable onPress={onMeasureCached} disabled={isMeasuring} style={[styles.button, { backgroundColor: theme.background, opacity: isMeasuring ? 0.6 : 1 }]}>
          <ThemedText type="small">with maximumAge 10s</ThemedText>
        </Pressable>
        <Pressable onPress={clearEntries} style={[styles.button, { backgroundColor: theme.background }]}>
          <ThemedText type="small">Clear</ThemedText>
        </Pressable>
      </ThemedView>

      {lastEntry && (
        <ThemedView style={[styles.lastBox, { borderColor: theme.backgroundSelected, backgroundColor: theme.background }]}>
          <ThemedText type="small">
            Last call: <ThemedText type="code">{lastEntry.durationMs.toFixed(1)} ms</ThemedText>
            {' · '}
            provider <ThemedText type="code">{lastEntry.locationProvider}</ThemedText>
          </ThemedText>
          {lastEntry.position ? (
            <ThemedText type="small">
              {lastEntry.position.coords.latitude.toFixed(6)}, {lastEntry.position.coords.longitude.toFixed(6)} · ±{lastEntry.position.coords.accuracy.toFixed(1)} m
            </ThemedText>
          ) : (
            <ThemedText type="small" style={{ color: '#d73a49' }}>
              Error {lastEntry.error?.code}: {lastEntry.error?.message}
            </ThemedText>
          )}
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            enableHighAccuracy={String(lastEntry.options.enableHighAccuracy)} · timeout={lastEntry.options.timeout} · maxAge={lastEntry.options.maximumAge}
          </ThemedText>
        </ThemedView>
      )}

      {entries.length > 0 ? (
        <ThemedView style={{ backgroundColor: 'transparent', gap: Spacing.two }}>
          <ThemedText type="small">History ({entries.length}) – timing includes JS → native → fused provider → callback</ThemedText>
          <ScrollView style={styles.historyScroll} nestedScrollEnabled>
            {entries.map((e) => (
              <ThemedView key={e.id} style={[styles.historyRow, { borderColor: theme.backgroundSelected, backgroundColor: theme.background }]}>
                <ThemedText type="code" style={styles.mono}>
                  {e.durationMs.toFixed(1).padStart(8, ' ')} ms
                </ThemedText>
                <ThemedText type="small" style={{ flex: 1 }}>
                  {e.position ? `✓ ${e.position.coords.accuracy.toFixed(0)}m` : `✗ ${e.error?.code}`}
                  {' · '}
                  {e.locationProvider}
                  {e.error ? ` · ${e.error.message.slice(0, 60)}` : ''}
                </ThemedText>
              </ThemedView>
            ))}
          </ScrollView>
        </ThemedView>
      ) : (
        <ThemedText type="small" style={{ color: theme.textSecondary }}>
          No measurements yet. Tap getCurrentPosition to record timing. Timing is measured with performance.now() around the native call – start immediately before invoking Geolocation.getCurrentPosition and end inside the success/error callback.
        </ThemedText>
      )}

      <ThemedText type="small" style={{ color: theme.textSecondary }}>
        Android note: <ThemedText type="code">playServices</ThemedText> uses FusedLocationProviderClient (Google Play Services). Requires a development build – this module does not work in Expo Go. Run{' '}
        <ThemedText type="code">npx expo prebuild</ThemedText> + <ThemedText type="code">npx expo run:android</ThemedText> or{' '}
        <ThemedText type="code">eas build</ThemedText>.
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    alignSelf: 'stretch',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.four,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  providerRow: {
    flexDirection: 'row',
    gap: Spacing.one,
    flexWrap: 'wrap',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  chipSub: {
    fontSize: 11,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPrimary: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#208AEF',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPrimaryText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  lastBox: {
    gap: 4,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  historyScroll: {
    maxHeight: 180,
  },
  historyRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 6,
  },
  mono: {
    fontSize: 12,
    minWidth: 90,
    textAlign: 'right',
  },
});

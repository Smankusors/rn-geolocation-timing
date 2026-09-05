import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useGeolocationTiming } from '@/hooks/useGeolocationTiming';

export function GeolocationTimingCard() {
  const theme = useTheme();
  const {
    entries,
    isMeasuring,
    pendingCount,
    measureGetCurrentPosition,
    clearEntries,
    lastEntry,
    watchEntries,
    isWatching,
    watchError,
    startWatchPosition,
    stopWatchPosition,
    clearWatchEntries,
    lastWatchEntry,
  } = useGeolocationTiming();

  const onMeasure = async () => {
    await measureGetCurrentPosition();
  };

  const toggleWatch = () => {
    if (isWatching) {
      stopWatchPosition();
    } else {
      startWatchPosition();
    }
  };

  const openMaps = async (lat: number, lng: number, label?: string) => {
    const q = `${lat},${lng}`;
    const encodedLabel = label ? encodeURIComponent(label) : undefined;
    let url: string;

    if (Platform.OS === 'ios') {
      url = `http://maps.apple.com/?q=${encodedLabel ?? q}&ll=${q}`;
    } else if (Platform.OS === 'android') {
      url = `geo:${q}?q=${q}${label ? `(${encodedLabel})` : ''}`;
      const can = await Linking.canOpenURL(url);
      if (!can) {
        url = `https://www.google.com/maps/search/?api=1&query=${q}`;
      }
    } else {
      url = `https://www.google.com/maps/search/?api=1&query=${q}`;
    }

    try {
      await Linking.openURL(url);
    } catch (e) {
      Alert.alert('Cannot open maps', String(e));
    }
  };

  const timeToFirstFixMs = watchEntries.length > 0 ? watchEntries[watchEntries.length - 1].durationSinceStartMs : null;

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="subtitle">Geolocation timing</ThemedText>
      <ThemedText type="small" style={{ color: theme.textSecondary }}>
        @react-native-community/geolocation · fused provider
      </ThemedText>

      <Pressable
        onPress={onMeasure}
        style={[styles.buttonPrimary, { opacity: isMeasuring ? 0.9 : 1 }]}
      >
        {isMeasuring ? <ActivityIndicator size="small" color="#fff" /> : null}
        <Text style={styles.buttonPrimaryText}>
          {isMeasuring ? `Measuring… (${pendingCount})` : 'getCurrentPosition'}
        </Text>
      </Pressable>

      <Pressable onPress={clearEntries} style={[styles.clearButton, { backgroundColor: theme.background }]}>
        <ThemedText type="small">Clear getCurrentPosition</ThemedText>
      </Pressable>

      {isMeasuring && pendingCount > 1 && (
        <ThemedText type="small" style={{ color: theme.textSecondary }}>
          {pendingCount} concurrent getCurrentPosition requests in flight – reproduces
          <ThemedText type="code"> issue #357</ThemedText> (NullPointerException Listener must not be null)
        </ThemedText>
      )}

      {lastEntry && (
        <ThemedView style={[styles.lastBox, { borderColor: theme.backgroundSelected, backgroundColor: theme.background }]}>
          <ThemedText type="small">
            Last getCurrentPosition: <ThemedText type="code">{lastEntry.durationMs.toFixed(1)} ms</ThemedText>
          </ThemedText>
          {lastEntry.position ? (
            <>
              <ThemedText type="small">
                {lastEntry.position.coords.latitude.toFixed(6)}, {lastEntry.position.coords.longitude.toFixed(6)} · ±{lastEntry.position.coords.accuracy.toFixed(1)} m
              </ThemedText>
              <Pressable
                onPress={() =>
                  openMaps(
                    lastEntry.position!.coords.latitude,
                    lastEntry.position!.coords.longitude,
                    'Measured location'
                  )
                }
                style={[styles.mapsButton, { backgroundColor: theme.backgroundSelected }]}
              >
                <Text style={[styles.mapsButtonText, { color: theme.text }]}>
                  {Platform.OS === 'ios' ? 'Open in Apple Maps' : Platform.OS === 'android' ? 'Open in Google Maps' : 'Open in Maps'}
                </Text>
              </Pressable>
            </>
          ) : (
            <ThemedText type="small" style={{ color: '#d73a49' }}>
              Error {lastEntry.error?.code}: {lastEntry.error?.message}
            </ThemedText>
          )}
        </ThemedView>
      )}

      {entries.length > 0 ? (
        <ThemedView style={{ backgroundColor: 'transparent', gap: Spacing.two }}>
          <ThemedText type="small">History ({entries.length}) – JS → native → fused → callback</ThemedText>
          <ScrollView style={styles.historyScroll} nestedScrollEnabled>
            {entries.map((e) => (
              <ThemedView key={e.id} style={[styles.historyRow, { borderColor: theme.backgroundSelected, backgroundColor: theme.background }]}>
                <ThemedText type="code" style={styles.mono}>
                  {e.durationMs.toFixed(1).padStart(8, ' ')} ms
                </ThemedText>
                <ThemedText type="small" style={{ flex: 1 }}>
                  {e.position ? `✓ ${e.position.coords.accuracy.toFixed(0)}m` : `✗ ${e.error?.code}`}
                  {e.error ? ` · ${e.error.message.slice(0, 60)}` : ''}
                </ThemedText>
                {e.position && (
                  <Pressable
                    onPress={() => openMaps(e.position!.coords.latitude, e.position!.coords.longitude)}
                    style={[styles.smallMapsButton, { backgroundColor: theme.backgroundSelected }]}
                    hitSlop={8}
                  >
                    <Text style={[styles.smallMapsButtonText, { color: theme.text }]}>Maps</Text>
                  </Pressable>
                )}
              </ThemedView>
            ))}
          </ScrollView>
        </ThemedView>
      ) : (
        <ThemedText type="small" style={{ color: theme.textSecondary }}>
          No getCurrentPosition measurements yet.
        </ThemedText>
      )}

      <ThemedView style={[styles.divider, { backgroundColor: theme.backgroundSelected }]} />

      <ThemedText type="subtitle">watchPosition</ThemedText>
      <ThemedText type="small" style={{ color: theme.textSecondary }}>
        Continuous updates via Fused Location Provider (interval 1s, distanceFilter 0, maximumAge 0)
      </ThemedText>

      <ThemedView style={[styles.buttonRow, { backgroundColor: 'transparent' }]}>
        <Pressable
          onPress={toggleWatch}
          style={[
            styles.buttonPrimary,
            { backgroundColor: isWatching ? '#d73a49' : '#208AEF' },
          ]}
        >
          {isWatching ? <ActivityIndicator size="small" color="#fff" /> : null}
          <Text style={styles.buttonPrimaryText}>{isWatching ? 'Stop watching' : 'Start watching'}</Text>
        </Pressable>
        <Pressable onPress={clearWatchEntries} style={[styles.button, { backgroundColor: theme.background }]}>
          <ThemedText type="small">Clear</ThemedText>
        </Pressable>
      </ThemedView>

      {isWatching && (
        <ThemedText type="small" style={{ color: theme.textSecondary }}>
          Watching… {watchEntries.length} update{watchEntries.length === 1 ? '' : 's'}
          {timeToFirstFixMs !== null ? ` · first fix ${timeToFirstFixMs.toFixed(1)} ms` : ''}
        </ThemedText>
      )}

      {watchError && (
        <ThemedText type="small" style={{ color: '#d73a49' }}>
          Watch error {watchError.code}: {watchError.message}
        </ThemedText>
      )}

      {lastWatchEntry?.position ? (
        <ThemedView style={[styles.lastBox, { borderColor: theme.backgroundSelected, backgroundColor: theme.background }]}>
          <ThemedText type="small">
            Last watch: <ThemedText type="code">{lastWatchEntry.durationSinceStartMs.toFixed(1)} ms since start</ThemedText>
          </ThemedText>
          <ThemedText type="small">
            {lastWatchEntry.position.coords.latitude.toFixed(6)}, {lastWatchEntry.position.coords.longitude.toFixed(6)} · ±{lastWatchEntry.position.coords.accuracy.toFixed(1)} m
          </ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            {new Date(lastWatchEntry.timestamp).toLocaleTimeString()} · speed {lastWatchEntry.position.coords.speed ?? '–'} · heading {lastWatchEntry.position.coords.heading ?? '–'}
          </ThemedText>
          <Pressable
            onPress={() =>
              openMaps(lastWatchEntry.position!.coords.latitude, lastWatchEntry.position!.coords.longitude, 'Watch location')
            }
            style={[styles.mapsButton, { backgroundColor: theme.backgroundSelected }]}
          >
            <Text style={[styles.mapsButtonText, { color: theme.text }]}>
              {Platform.OS === 'ios' ? 'Open in Apple Maps' : Platform.OS === 'android' ? 'Open in Google Maps' : 'Open in Maps'}
            </Text>
          </Pressable>
        </ThemedView>
      ) : isWatching && watchEntries.length === 0 ? (
        <ThemedText type="small" style={{ color: theme.textSecondary }}>
          Waiting for first fix…
        </ThemedText>
      ) : null}

      {watchEntries.length > 0 ? (
        <ThemedView style={{ backgroundColor: 'transparent', gap: Spacing.two }}>
          <ThemedText type="small">Watch history ({watchEntries.length})</ThemedText>
          <ScrollView style={styles.historyScroll} nestedScrollEnabled>
            {watchEntries.map((e) => (
              <ThemedView key={e.id} style={[styles.historyRow, { borderColor: theme.backgroundSelected, backgroundColor: theme.background }]}>
                <ThemedText type="code" style={styles.mono}>
                  +{e.durationSinceStartMs.toFixed(0).padStart(6, ' ')} ms
                </ThemedText>
                <ThemedText type="small" style={{ flex: 1 }}>
                  {e.position ? `✓ ${e.position.coords.accuracy.toFixed(0)}m` : `✗ ${e.error?.code}`}
                  {e.error ? ` · ${e.error.message.slice(0, 50)}` : ''}
                </ThemedText>
                {e.position && (
                  <Pressable
                    onPress={() => openMaps(e.position!.coords.latitude, e.position!.coords.longitude)}
                    style={[styles.smallMapsButton, { backgroundColor: theme.backgroundSelected }]}
                    hitSlop={8}
                  >
                    <Text style={[styles.smallMapsButtonText, { color: theme.text }]}>Maps</Text>
                  </Pressable>
                )}
              </ThemedView>
            ))}
          </ScrollView>
        </ThemedView>
      ) : null}

      <ThemedText type="small" style={{ color: theme.textSecondary }}>
        Android uses FusedLocationProviderClient (Google Play Services). Requires a development build – this module does not work in Expo Go. Run{' '}
        <ThemedText type="code">npx expo prebuild</ThemedText> + <ThemedText type="code">npx expo run:android</ThemedText>.
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
  clearButton: {
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
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
  mapsButton: {
    marginTop: 6,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapsButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  smallMapsButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  smallMapsButtonText: {
    fontSize: 11,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    alignSelf: 'stretch',
    marginVertical: Spacing.one,
  },
});

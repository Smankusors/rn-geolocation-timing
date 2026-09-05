# rn-geolocation-timing

Minimal Expo app to reproduce two Android issues with `@react-native-community/geolocation` using the Fused Location Provider.

## What this reproduces

**1. Crash on concurrent `getCurrentPosition`** - calling `Geolocation.getCurrentPosition` concurrently crashes the app with `NullPointerException: Listener must not be null`. The library keeps only the latest `LocationCallback` in an instance variable (`mSingleLocationCallback` in `PlayServicesLocationManager`), so the second call overwrites the first. Whichever finishes first clears the variable to `null`, and the other then calls `removeLocationUpdates(null)` and crashes.

Original issue: https://github.com/michalchudziak/react-native-geolocation/issues/357

**2. Slow `getCurrentPosition`** - a single `getCurrentPosition` with `enableHighAccuracy: true` resolves in ~10 seconds on the Fused provider, compared to ~5 seconds for the same request in the browser Geolocation API on the same device.

## Android only

This repro is Android only. It requires a development build (Fused Location Provider via Google Play Services) and does not work in Expo Go.

- Android permissions are declared in `app.json`: `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`, `FOREGROUND_SERVICE`.
- Location provider is set to `playServices` in `src/hooks/useGeolocationTiming.ts`.

## Prebuilt APK

A ready-to-install Release APK (signed with the debug keystore, `arm64-v8a` only) is built by GitHub Actions.

1. Open **Actions → Android APK →** latest successful run.
2. Download the artifact **rn-geolocation-timing-arm64-v8a-release** (under *Artifacts*).
3. Install on a device/emulator with Play Services: `adb install app-release.apk`.

> GitHub artifacts expire after 90 days. If no artifact is listed (expired or no run yet), trigger a new build via **Actions → Android APK → Run workflow** or build locally (see Getting started).

## Project structure

- `src/app/index.tsx` - single screen with `GeolocationTimingCard`
- `src/hooks/useGeolocationTiming.ts` - `getCurrentPosition` / `watchPosition` harness with concurrency support
- `src/components/geolocation-timing-card.tsx` - UI for triggering measurements and viewing history
- `patches/@react-native-community+geolocation+3.4.0.patch` - local patch (see below)
- `app.json` - Expo config, Android package `com.rngeolocationtiming.app`

## Getting started

```bash
npm install
npx expo prebuild
npx expo run:android
```

Requires an Android emulator or device with Google Play Services, location enabled, and location permission granted at runtime. `npm install` applies the patch via `patch-package`.

## How to reproduce

### Crash (concurrent requests)

1. Build and launch on Android.
2. Tap **getCurrentPosition** rapidly so 2+ requests are in flight at once (the card shows the in-flight count).
3. On the unpatched library, the app crashes. Check logcat for:

```
java.lang.NullPointerException: Listener must not be null
  at FusedLocationProviderClient.removeLocationUpdates
  at com.reactnativecommunity.geolocation.PlayServicesLocationManager
```

### Slowness

1. Tap **getCurrentPosition** once.
2. Observe the reported duration - typically ~10s on this app vs ~5s in Chrome on the same device with the same high-accuracy request.

## Patch in this repo

`patches/@react-native-community+geolocation+3.4.0.patch` is unrelated to the crash or the slowness above. It suppresses spurious `POSITION_UNAVAILABLE` errors when `FusedLocationProvider` returns a null `lastLocation` or transient unavailability before the first fix. It is currently needed to get `getCurrentPosition` to actually resolve instead of erroring immediately on some devices/emulators. Remove it to reproduce the upstream behavior without the workaround.

## Scripts

```bash
npm start        # expo start
npm run android  # expo run:android
npm run ios      # expo run:ios (not the focus of this repro)
npm run lint     # expo lint
```

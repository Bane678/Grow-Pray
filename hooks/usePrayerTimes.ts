import { useState, useEffect, useRef, useCallback } from 'react';
import { AppState } from 'react-native';
import * as Location from 'expo-location';
import {
    computePrayerDay,
    nextPrayerFrom,
    localDayKey,
    getMethodKeyForCountry,
    FALLBACK_TIMINGS,
    FALLBACK_DEADLINES,
    type Timings,
    type PrayerDeadlines,
    type PrayerMethodKey,
    type Madhab,
} from '../lib/prayerCalc';

// The calculation core lives in lib/prayerCalc.ts so it can be unit-tested under
// plain Node (`npm test`) without React Native. Re-exported here so every existing
// import site keeps working unchanged.
export {
    PRAYER_METHODS,
    DEFAULT_PRAYER_OFFSETS,
    MAX_RELIABLE_LATITUDE,
    getMethodKeyForCountry,
    localDayKey,
    tzMinutes,
    timeToMinutes,
    nextPrayerFrom,
} from '../lib/prayerCalc';
export type {
    Timings,
    PrayerDeadlines,
    PrayerMethod,
    PrayerMethodKey,
    Madhab,
    PrayerOffsets,
} from '../lib/prayerCalc';

/**
 * How long a GPS fix stays good enough to reuse.
 *
 * The day-rollover refresh below is free (pure maths on cached coordinates), so
 * this only governs how often we go back to the GPS hardware to catch the user
 * having travelled. Six hours keeps it to a handful of fixes a day.
 */
const LOCATION_MAX_AGE_MS = 6 * 60 * 60 * 1000;

/** How often to check whether the local calendar day has rolled over. */
const DAY_WATCH_INTERVAL_MS = 30 * 1000;

export interface PrayerTimesConfig {
    madhab: Madhab;
    methodKey: PrayerMethodKey | null;  // null = auto-detect from country
    manualCoords?: { lat: number; lng: number; countryCode?: string; timezone?: string };
    locationReady?: boolean;  // must be true before location permission is requested
}

interface ResolvedLocation {
    lat: number;
    lng: number;
    methodKey: PrayerMethodKey;
    timezone?: string;
    /** When the underlying position fix was obtained. */
    resolvedAt: number;
}

export function usePrayerTimes(config: PrayerTimesConfig = { madhab: 'standard', methodKey: null }) {
    const [timings, setTimings] = useState<Timings | null>(null);
    const [deadlines, setDeadlines] = useState<PrayerDeadlines | null>(null);
    const [nextPrayer, setNextPrayer] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [locationError, setLocationError] = useState<string | null>(null);
    const [detectedMethodKey, setDetectedMethodKey] = useState<PrayerMethodKey>('MWL');
    const [approximatedFromLatitude, setApproximatedFromLatitude] = useState<number | null>(null);

    const { madhab, methodKey, manualCoords, locationReady = true } = config;

    // The last successfully resolved location, so a day-rollover refresh can
    // recompute without touching the GPS hardware again.
    const locationRef = useRef<ResolvedLocation | null>(null);
    // The calendar day (at the prayer location) the current timings describe.
    // This is the staleness guard: when the real day no longer matches this, the
    // displayed times are yesterday's and must be recomputed.
    const dayKeyRef = useRef<string | null>(null);
    // Bumped on unmount / config change to abandon in-flight async work.
    const tokenRef = useRef({ alive: true });

    // ── Compute from an already-resolved location (cheap, synchronous) ─────────
    const computeFromLocation = useCallback((loc: ResolvedLocation) => {
        try {
            const result = computePrayerDay({
                lat: loc.lat,
                lng: loc.lng,
                methodKey: loc.methodKey,
                madhab,
                timezone: loc.timezone,
            });
            dayKeyRef.current = result.dayKey;
            setTimings(result.timings);
            setDeadlines(result.deadlines);
            setApproximatedFromLatitude(result.approximatedFromLatitude);
            setNextPrayer(nextPrayerFrom(result.timings, new Date(), loc.timezone));
            setLoading(false);
        } catch (err) {
            console.error('[Prayer] computation failed, using fallback:', err);
            dayKeyRef.current = localDayKey(new Date(), loc.timezone);
            setTimings(FALLBACK_TIMINGS);
            setDeadlines(FALLBACK_DEADLINES);
            setApproximatedFromLatitude(null);
            setLoading(false);
        }
    }, [madhab]);

    // ── Resolve the location (GPS or manual), then compute ────────────────────
    const resolveAndCompute = useCallback(async (token: { alive: boolean }) => {
        const applyLocation = (loc: ResolvedLocation) => {
            if (!token.alive) return;
            locationRef.current = loc;
            computeFromLocation(loc);
        };

        try {
            // An explicitly chosen city wins unconditionally, GPS permission or not.
            if (manualCoords) {
                const autoKey = manualCoords.countryCode
                    ? getMethodKeyForCountry(manualCoords.countryCode)
                    : 'MWL';
                if (token.alive) setDetectedMethodKey(autoKey);
                applyLocation({
                    lat: manualCoords.lat,
                    lng: manualCoords.lng,
                    methodKey: methodKey || autoKey,
                    timezone: manualCoords.timezone,
                    resolvedAt: Date.now(),
                });
                return;
            }

            const { status } = await Location.requestForegroundPermissionsAsync();
            if (!token.alive) return;

            if (status !== 'granted') {
                setLocationError('Location permission denied');
                // No manual city and no GPS - last resort is London.
                applyLocation({ lat: 51.5074, lng: -0.1278, methodKey: 'UK', resolvedAt: Date.now() });
                return;
            }
            setLocationError(null);

            const location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
            });
            if (!token.alive) return;

            const { latitude, longitude } = location.coords;

            let autoKey: PrayerMethodKey = 'MWL';
            try {
                const geocode = await Location.reverseGeocodeAsync({ latitude, longitude });
                if (geocode.length > 0 && geocode[0].isoCountryCode) {
                    autoKey = getMethodKeyForCountry(geocode[0].isoCountryCode);
                }
            } catch {
                // Reverse geocode is best-effort; MWL is a safe default.
            }
            if (!token.alive) return;
            setDetectedMethodKey(autoKey);

            applyLocation({
                lat: latitude,
                lng: longitude,
                methodKey: methodKey || autoKey,
                // GPS mode: the device is AT the prayer location, so its own clock
                // and timezone are authoritative. Passing no timezone is correct
                // here and keeps working when the user crosses a timezone.
                timezone: undefined,
                resolvedAt: Date.now(),
            });
        } catch (error) {
            if (!token.alive) return;
            console.error('[Prayer] location error:', error);
            setLocationError('Failed to get location');
            applyLocation({ lat: 51.5074, lng: -0.1278, methodKey: 'UK', resolvedAt: Date.now() });
        }
    }, [manualCoords, methodKey, computeFromLocation]);

    // ── Initial load, and whenever the user changes a prayer setting ──────────
    useEffect(() => {
        if (!locationReady) return;

        tokenRef.current.alive = false;          // abandon any previous run
        const token = { alive: true };
        tokenRef.current = token;

        setLoading(true);
        resolveAndCompute(token);

        return () => { token.alive = false; };
    }, [locationReady, resolveAndCompute]);

    // ── Staleness guard ───────────────────────────────────────────────────────
    //
    // This is the fix for the bug where the app showed an 11-day-old Maghrib.
    // Previously the times were computed once on mount and never again: iOS
    // suspends rather than kills an app, so a user who never force-quits kept
    // whatever times were calculated the first time they opened it, drifting
    // further from reality every day.
    //
    // Two triggers, deliberately different in cost:
    //   - the local calendar day changed  → recompute from cached coordinates.
    //     Free, no GPS, so it can run on a timer and the instant we foreground.
    //   - the position fix has gone stale → re-resolve location as well, which
    //     also picks up the user having travelled.
    useEffect(() => {
        if (!locationReady) return;

        const check = () => {
            const loc = locationRef.current;
            if (!loc) return;

            const now = new Date();
            const currentDayKey = localDayKey(now, loc.timezone);
            const dayChanged = dayKeyRef.current !== null && dayKeyRef.current !== currentDayKey;
            const fixStale = Date.now() - loc.resolvedAt > LOCATION_MAX_AGE_MS;

            if (dayChanged && fixStale) {
                // New day AND we have not looked at the GPS in hours: do the full
                // refresh so a user who travelled overnight gets the right city.
                const token = { alive: true };
                tokenRef.current.alive = false;
                tokenRef.current = token;
                resolveAndCompute(token);
            } else if (dayChanged) {
                computeFromLocation(loc);
            } else if (timings) {
                // Same day - just keep the countdown target honest.
                setNextPrayer(nextPrayerFrom(timings, now, loc.timezone));
            }
        };

        check();
        const interval = setInterval(check, DAY_WATCH_INTERVAL_MS);
        const sub = AppState.addEventListener('change', (s) => {
            if (s !== 'active') return;
            const loc = locationRef.current;
            // Returning to the app after a long absence is the single most likely
            // moment for the cached times to be wrong, so re-resolve rather than
            // waiting for the timer.
            if (loc && Date.now() - loc.resolvedAt > LOCATION_MAX_AGE_MS) {
                const token = { alive: true };
                tokenRef.current.alive = false;
                tokenRef.current = token;
                resolveAndCompute(token);
            } else {
                check();
            }
        });

        return () => {
            clearInterval(interval);
            sub.remove();
        };
    }, [locationReady, timings, resolveAndCompute, computeFromLocation]);

    useEffect(() => () => { tokenRef.current.alive = false; }, []);

    return {
        timings,
        deadlines,
        nextPrayer,
        loading,
        locationError,
        detectedMethodKey,
        /** Non-null only above 65° latitude - see MAX_RELIABLE_LATITUDE. */
        approximatedFromLatitude,
    };
}

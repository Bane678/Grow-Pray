import { useState, useEffect } from 'react';
import { AppState } from 'react-native';
import * as Location from 'expo-location';
import {
    Coordinates,
    CalculationMethod,
    CalculationParameters,
    PrayerTimes,
    Madhab as AdhanMadhab,
    HighLatitudeRule,
    PolarCircleResolution,
} from 'adhan';

export type Timings = {
    Fajr: string;
    Dhuhr: string;
    Asr: string;
    Maghrib: string;
    Isha: string;
    [key: string]: string;
};

export type PrayerDeadlines = {
    Fajr: string;      // Sunrise
    Dhuhr: string;     // Asr start
    Asr: string;       // Sunset
    Maghrib: string;   // Isha start
    Isha: string;      // Next day's Fajr
};

// ─── Calculation Methods ────────────────────────────────────────────────────────
// Each method maps to an adhan CalculationMethod. The fajrAngle/ishaAngle fields
// are stored for reference; the actual computation is done on-device by adhan.

export interface PrayerMethod {
    name: string;
    fajrAngle: number;        // degrees below horizon (negative), e.g. -18
    ishaAngle: number;        // degrees below horizon (negative), e.g. -17
    aladhanMethod: number;    // kept for backward compatibility only
    highLatitude?: boolean;   // signals that MoonsightingCommittee method is used
}

export const PRAYER_METHODS: Record<string, PrayerMethod> = {
    MWL: {
        name: 'Muslim World League',
        fajrAngle: -18,
        ishaAngle: -17,
        aladhanMethod: 3,
    },
    ISNA: {
        name: 'ISNA',
        fajrAngle: -15,
        ishaAngle: -15,
        aladhanMethod: 2,
    },
    EGYPT: {
        name: 'Egyptian General Authority',
        fajrAngle: -19.5,
        ishaAngle: -17.5,
        aladhanMethod: 5,
    },
    UMM_AL_QURA: {
        name: 'Umm Al-Qura (Makkah)',
        fajrAngle: -18.5,
        ishaAngle: -19,
        aladhanMethod: 4,
    },
    KARACHI: {
        name: 'Karachi',
        fajrAngle: -18,
        ishaAngle: -18,
        aladhanMethod: 1,
    },
    DUBAI: {
        name: 'Dubai',
        fajrAngle: -18.2,
        ishaAngle: -18.2,
        aladhanMethod: 12,
    },
    TURKEY: {
        name: 'Turkey (Diyanet)',
        fajrAngle: -18,
        ishaAngle: -17,
        aladhanMethod: 13,
    },
    UK: {
        // Moonsighting Committee Worldwide method, recommended for UK & North America.
        // Uses 18° Fajr/Isha angles with seasonal adjustments and automatically
        // applies the 1/7th of night rule above 55° latitude (covers all of Scotland).
        // Computed on-device by the adhan library - no API call needed.
        name: 'Moonsighting Committee (UK)',
        fajrAngle: -18,
        ishaAngle: -18,
        aladhanMethod: 3,
        highLatitude: true,
    },
};

export type PrayerMethodKey = keyof typeof PRAYER_METHODS;
export type Madhab = 'hanafi' | 'standard';

/** Per-prayer minute offsets - kept for type compatibility but no longer used in UI.
 * @deprecated Replaced by automatic high-latitude method selection.
 */
export type PrayerOffsets = {
    Fajr: number; Dhuhr: number; Asr: number; Maghrib: number; Isha: number;
};
export const DEFAULT_PRAYER_OFFSETS: PrayerOffsets = {
    Fajr: 0, Dhuhr: 0, Asr: 0, Maghrib: 0, Isha: 0,
};

// Map country codes → default calculation method key
function getMethodKeyForCountry(countryCode: string): PrayerMethodKey {
    const cc = countryCode.toUpperCase();

    // High-latitude countries: standard 18° Fajr/Isha angles are unreachable in
    // summer (sun stays above ~12° below horizon). Use 12° angles universally.
    if (['GB', 'IE', 'IS', 'NO', 'SE', 'FI'].includes(cc)) return 'UK';

    if (['FR', 'DE', 'NL', 'BE', 'AT', 'CH', 'IT', 'ES', 'PT',
         'DK', 'PL', 'CZ', 'HU', 'RO', 'BG', 'HR',
         'SK', 'SI', 'GR', 'BA', 'RS', 'ME', 'MK', 'AL', 'XK', 'LU', 'LT',
         'LV', 'EE'].includes(cc)) return 'MWL';
    if (['US', 'CA', 'MX'].includes(cc)) return 'ISNA';
    if (['SA', 'YE'].includes(cc)) return 'UMM_AL_QURA';
    if (['AE', 'OM', 'BH', 'QA', 'KW'].includes(cc)) return 'DUBAI';
    if (['EG', 'LY', 'SD'].includes(cc)) return 'EGYPT';
    if (['PK', 'IN', 'BD', 'AF', 'LK', 'NP'].includes(cc)) return 'KARACHI';
    if (['TR', 'AZ', 'KZ', 'UZ', 'TM', 'KG', 'TJ'].includes(cc)) return 'TURKEY';
    if (['MY', 'ID', 'SG', 'BN', 'PH', 'TH'].includes(cc)) return 'MWL';
    if (['MA', 'DZ', 'TN'].includes(cc)) return 'MWL';
    if (['IQ', 'JO', 'PS', 'LB', 'SY'].includes(cc)) return 'MWL';
    if (['SO', 'DJ', 'KM', 'MR', 'NG', 'GH', 'SN', 'ML', 'NE', 'CM',
         'KE', 'TZ', 'UG', 'ET'].includes(cc)) return 'EGYPT';
    if (['AU', 'NZ'].includes(cc)) return 'MWL';
    return 'MWL';
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

const FALLBACK_TIMINGS: Timings = {
    Fajr: '05:30', Sunrise: '07:00', Dhuhr: '12:15', Asr: '14:45',
    Sunset: '17:30', Maghrib: '17:30', Isha: '19:15',
};
const FALLBACK_DEADLINES: PrayerDeadlines = {
    Fajr: '07:00', Dhuhr: '14:45', Asr: '17:30', Maghrib: '19:15', Isha: '05:30',
};

function dateToHHMM(date: Date | undefined, timezone?: string): string {
    if (!date || isNaN(date.getTime())) return '00:00';
    if (timezone) {
        try {
            const parts = new Intl.DateTimeFormat('en-US', {
                hour: '2-digit', minute: '2-digit', hour12: false, timeZone: timezone,
            }).formatToParts(date);
            const h = parts.find(p => p.type === 'hour')?.value ?? '00';
            const m = parts.find(p => p.type === 'minute')?.value ?? '00';
            // Some locales return '24' for midnight with hour12:false
            return `${h === '24' ? '00' : h.padStart(2, '0')}:${m.padStart(2, '0')}`;
        } catch {
            // Fall through to device-local time if timezone string is invalid
        }
    }
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function getAdhanParams(key: PrayerMethodKey, coordinates: Coordinates): CalculationParameters {
    let params: CalculationParameters;
    switch (key) {
        case 'UK':          params = CalculationMethod.MoonsightingCommittee(); break;
        case 'ISNA':        params = CalculationMethod.NorthAmerica(); break;
        case 'EGYPT':       params = CalculationMethod.Egyptian(); break;
        case 'UMM_AL_QURA': params = CalculationMethod.UmmAlQura(); break;
        case 'KARACHI':     params = CalculationMethod.Karachi(); break;
        case 'DUBAI':       params = CalculationMethod.Dubai(); break;
        case 'TURKEY':      params = CalculationMethod.Turkey(); break;
        case 'MWL':
        default:            params = CalculationMethod.MuslimWorldLeague(); break;
    }
    // Automatically picks the best high-latitude rule for the user's coordinates.
    // - Below ~48°: no special rule needed.
    // - 48–55° (most of England, N. France, Germany): SeventhOfTheNight.
    // - Above 55° (Scotland, Scandinavia, Iceland): TwilightAngle.
    params.highLatitudeRule = HighLatitudeRule.recommended(coordinates);
    // If sunrise/sunset are undefined (polar circles) use the nearest day instead.
    params.polarCircleResolution = PolarCircleResolution.AqrabYaum;
    return params;
}

// ─── Hook ───────────────────────────────────────────────────────────────────────

export interface PrayerTimesConfig {
    madhab: Madhab;
    methodKey: PrayerMethodKey | null;  // null = auto-detect from country
    manualCoords?: { lat: number; lng: number; countryCode?: string; timezone?: string };
    locationReady?: boolean;  // must be true before location permission is requested
}

export function usePrayerTimes(config: PrayerTimesConfig = { madhab: 'standard', methodKey: null }) {
    const [timings, setTimings] = useState<Timings | null>(null);
    const [deadlines, setDeadlines] = useState<PrayerDeadlines | null>(null);
    const [nextPrayer, setNextPrayer] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [locationError, setLocationError] = useState<string | null>(null);
    const [detectedMethodKey, setDetectedMethodKey] = useState<PrayerMethodKey>('MWL');
    const { madhab, methodKey, manualCoords, locationReady = true } = config;

    useEffect(() => {
        if (!locationReady) return;

        const token = { alive: true };
        setLoading(true);

        getLocationAndComputeTimings(token);

        return () => { token.alive = false; };
    }, [madhab, methodKey, manualCoords, locationReady]);

    const applyTimings = (t: Timings, d: PrayerDeadlines, token: { alive: boolean }) => {
        if (!token.alive) return;
        setTimings(t);
        setDeadlines(d);
        calculateNextPrayer(t);
        setLoading(false);
    };

    const computeTimes = (lat: number, lng: number, key: PrayerMethodKey, token: { alive: boolean }, timezone?: string) => {
        try {
            const coordinates = new Coordinates(lat, lng);
            const params = getAdhanParams(key, coordinates);
            params.madhab = madhab === 'hanafi' ? AdhanMadhab.Hanafi : AdhanMadhab.Shafi;

            const today = new Date();
            const pt = new PrayerTimes(coordinates, today, params);

            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            const ptTomorrow = new PrayerTimes(coordinates, tomorrow, params);

            const fmt = (d: Date | undefined) => dateToHHMM(d, timezone);
            const t: Timings = {
                Fajr:    fmt(pt.fajr),
                Sunrise: fmt(pt.sunrise),
                Dhuhr:   fmt(pt.dhuhr),
                Asr:     fmt(pt.asr),
                Sunset:  fmt(pt.maghrib),
                Maghrib: fmt(pt.maghrib),
                Isha:    fmt(pt.isha),
            };
            const d: PrayerDeadlines = {
                Fajr:    t.Sunrise,
                Dhuhr:   t.Asr,
                Asr:     t.Sunset,
                Maghrib: t.Isha,
                Isha:    fmt(ptTomorrow.fajr),
            };

            console.log(`[Prayer] adhan/${key} @ (${lat.toFixed(4)}, ${lng.toFixed(4)}) - Fajr ${t.Fajr}, Isha ${t.Isha}`);
            applyTimings(t, d, token);
        } catch (err) {
            console.error('[Prayer] adhan computation failed, using fallback:', err);
            applyTimings(FALLBACK_TIMINGS, FALLBACK_DEADLINES, token);
        }
    };

    const getLocationAndComputeTimings = async (token: { alive: boolean }) => {
        try {
            // If the user has explicitly set a manual city, honour it unconditionally
            // regardless of whether GPS permission is granted.
            if (manualCoords) {
                const autoKey = manualCoords.countryCode
                    ? getMethodKeyForCountry(manualCoords.countryCode)
                    : 'MWL';
                if (token.alive) setDetectedMethodKey(autoKey);
                computeTimes(manualCoords.lat, manualCoords.lng, methodKey || autoKey, token, manualCoords.timezone);
                return;
            }

            const { status } = await Location.requestForegroundPermissionsAsync();

            if (status !== 'granted') {
                setLocationError('Location permission denied');
                // No manual coords and no GPS - last resort is London
                computeTimes(51.5074, -0.1278, 'UK', token);
                return;
            }

            const location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
            });

            const { latitude, longitude } = location.coords;

            // Auto-detect calculation method from country
            let autoKey: PrayerMethodKey = 'MWL';
            try {
                const geocode = await Location.reverseGeocodeAsync({ latitude, longitude });
                if (geocode.length > 0 && geocode[0].isoCountryCode) {
                    autoKey = getMethodKeyForCountry(geocode[0].isoCountryCode);
                    console.log(`Auto-detected method: ${autoKey} (${geocode[0].isoCountryCode})`);
                }
            } catch (geoErr) {
                console.warn('Reverse geocode failed, using MWL:', geoErr);
            }

            if (token.alive) setDetectedMethodKey(autoKey);

            const activeKey = methodKey || autoKey;
            computeTimes(latitude, longitude, activeKey, token);
        } catch (error) {
            console.error('Location error:', error);
            setLocationError('Failed to get location');
            computeTimes(51.5074, -0.1278, 'UK', token);
        }
    };

    const calculateNextPrayer = (timings: Timings) => {
        const prayers = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();

        for (const prayer of prayers) {
            const timeStr = timings[prayer];
            if (timeStr) {
                const [hours, minutes] = timeStr.split(':').map(Number);
                if (hours * 60 + minutes > currentMinutes) {
                    setNextPrayer(prayer);
                    return;
                }
            }
        }
        setNextPrayer('Fajr');
    };

    // Keep `nextPrayer` fresh as time passes. calculateNextPrayer only ran when the
    // times were (re)computed, so once a prayer's window opened (e.g. Maghrib) the
    // value went stale and the countdown rolled to tomorrow's copy of that prayer
    // instead of advancing to the next one (Isha). Re-evaluate every minute and
    // whenever the app returns to the foreground (e.g. after tapping a notification).
    useEffect(() => {
        if (!timings) return;
        const recompute = () => calculateNextPrayer(timings);
        recompute();
        const interval = setInterval(recompute, 60 * 1000);
        const sub = AppState.addEventListener('change', (s) => {
            if (s === 'active') recompute();
        });
        return () => {
            clearInterval(interval);
            sub.remove();
        };
    }, [timings]);

    return { timings, deadlines, nextPrayer, loading, locationError, detectedMethodKey };
}

import { useState, useEffect, useRef } from 'react';
import * as Location from 'expo-location';

type Timings = {
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
// Each method defines the Fajr/Isha sun angles used by Islamic authorities in
// that region. Angles are passed directly to Muwaqqit (fa/ea params) so it
// computes the correct astronomical time — no post-hoc minute offsets.

export interface PrayerMethod {
    name: string;
    fajrAngle: number;        // degrees below horizon (negative), e.g. -18
    ishaAngle: number;        // degrees below horizon (negative), e.g. -17
    aladhanMethod: number;    // Aladhan API method ID (fallback)
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
};

export type PrayerMethodKey = keyof typeof PRAYER_METHODS;
export type Madhab = 'hanafi' | 'standard';

// Map country codes → default calculation method key
function getMethodKeyForCountry(countryCode: string): PrayerMethodKey {
    const cc = countryCode.toUpperCase();

    if (['GB', 'IE', 'FR', 'DE', 'NL', 'BE', 'AT', 'CH', 'IT', 'ES', 'PT',
         'DK', 'SE', 'NO', 'FI', 'IS', 'PL', 'CZ', 'HU', 'RO', 'BG', 'HR',
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

function toHHMM(time: string): string {
    if (!time) return '00:00';
    const parts = time.split(':');
    return `${parts[0]}:${parts[1]}`;
}

function getTimezone(): string {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone; }
    catch { return 'UTC'; }
}

async function fetchWithRetry(url: string, retries = 2, timeoutMs = 8000): Promise<any> {
    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), timeoutMs);
            const response = await fetch(url, { signal: controller.signal });
            clearTimeout(timer);

            if (!response.ok) {
                console.warn(`API returned ${response.status} on attempt ${attempt + 1}`);
                if (attempt < retries - 1) {
                    await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
                    continue;
                }
                return null;
            }

            const text = await response.text();
            try {
                return JSON.parse(text);
            } catch {
                console.warn(`Non-JSON response (attempt ${attempt + 1}): ${text.slice(0, 120)}`);
                if (attempt < retries - 1) {
                    await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
                    continue;
                }
                return null;
            }
        } catch (error: any) {
            console.warn(`Fetch attempt ${attempt + 1} failed:`, error?.message || error);
            if (attempt < retries - 1) {
                await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
            }
        }
    }
    return null;
}

function findEntryByDate(data: any[], dateStr: string): any | null {
    for (const entry of data) {
        if (entry.d === dateStr) return entry;
    }
    for (const entry of data) {
        if (entry.fajr_date === dateStr || entry.sunset_date === dateStr) return entry;
    }
    return null;
}

// ─── Hook ───────────────────────────────────────────────────────────────────────

export interface PrayerTimesConfig {
    madhab: Madhab;
    methodKey: PrayerMethodKey | null;  // null = auto-detect from country
    manualCoords?: { lat: number; lng: number; countryCode?: string };
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

        const safetyTimer = setTimeout(() => {
            if (token.alive) {
                console.warn('Prayer times safety timeout — using hardcoded fallback');
                applyTimings(FALLBACK_TIMINGS, FALLBACK_DEADLINES, token);
            }
        }, 12000);

        getLocationAndFetchTimings(token).finally(() => clearTimeout(safetyTimer));

        return () => {
            token.alive = false;
            clearTimeout(safetyTimer);
        };
    }, [madhab, methodKey, manualCoords, locationReady]);

    const applyTimings = (t: Timings, d: PrayerDeadlines, token: { alive: boolean }) => {
        if (!token.alive) return;
        setTimings(t);
        setDeadlines(d);
        calculateNextPrayer(t);
        setLoading(false);
    };

    const getLocationAndFetchTimings = async (token: { alive: boolean }) => {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();

            if (status !== 'granted') {
                setLocationError('Location permission denied');
                // Use user-provided manual city coords if available, else London as last resort
                if (manualCoords) {
                    const autoKey = manualCoords.countryCode
                        ? getMethodKeyForCountry(manualCoords.countryCode)
                        : 'MWL';
                    if (token.alive) setDetectedMethodKey(autoKey);
                    await fetchTimes(manualCoords.lat, manualCoords.lng, 0, methodKey || autoKey, token);
                } else {
                    // True last resort — London. In practice this should rarely be reached
                    // because the Settings modal now prompts for manual city entry.
                    await fetchTimes(51.5074, -0.1278, 0, 'MWL', token);
                }
                return;
            }

            const location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
            });

            const { latitude, longitude, altitude } = location.coords;
            const elevationM = Math.max(altitude || 0, 0);

            // Auto-detect method from country
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

            // Use manual override if set, otherwise auto-detected
            const activeKey = methodKey || autoKey;
            await fetchTimes(latitude, longitude, elevationM, activeKey, token);
        } catch (error) {
            console.error('Location error:', error);
            setLocationError('Failed to get location');
            await fetchTimes(51.5074, -0.1278, 0, 'MWL', token);
        }
    };

    const fetchTimes = async (lat: number, lng: number, elevation: number, key: PrayerMethodKey, token: { alive: boolean }) => {
        const method = PRAYER_METHODS[key] || PRAYER_METHODS.MWL;
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const tz = encodeURIComponent(getTimezone());

        // Pass Fajr/Isha angles directly to Muwaqqit
        const url = `https://api.muwaqqit.com/api.json?lt=${lat}&ln=${lng}&d=${yyyy}-${mm}-${dd}&tz=${tz}&ht=${Math.round(elevation)}&fa=${method.fajrAngle}&ea=${method.ishaAngle}`;

        console.log(`[Prayer] ${method.name} — Fajr ${method.fajrAngle}°, Isha ${method.ishaAngle}°, Asr: ${madhab}`);

        const data = await fetchWithRetry(url);
        const entries = data && Array.isArray(data) ? data
            : data && Array.isArray(data?.list) ? data.list
            : null;

        if (entries) {
            const todayStr = `${yyyy}-${mm}-${dd}`;
            const todayEntry = findEntryByDate(entries, todayStr);

            if (todayEntry) {
                // Select Asr field based on madhab
                const asrTime = madhab === 'hanafi'
                    ? toHHMM(todayEntry.mithlain_time)   // Hanafi: shadow = 2× object length
                    : toHHMM(todayEntry.mithl_time);     // Standard: shadow = 1× object length

                const t: Timings = {
                    Fajr: toHHMM(todayEntry.fajr_time),
                    Sunrise: toHHMM(todayEntry.sunrise_time),
                    Dhuhr: toHHMM(todayEntry.zohr_time),
                    Asr: asrTime,
                    Sunset: toHHMM(todayEntry.sunset_time),
                    Maghrib: toHHMM(todayEntry.sunset_time),
                    Isha: toHHMM(todayEntry.esha_time),
                };

                // Tomorrow's Fajr for Isha deadline
                const tomorrow = new Date(today);
                tomorrow.setDate(tomorrow.getDate() + 1);
                const tmrStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
                const tomorrowEntry = findEntryByDate(entries, tmrStr);
                const nextFajr = tomorrowEntry ? toHHMM(tomorrowEntry.fajr_time) : t.Fajr;

                const d: PrayerDeadlines = {
                    Fajr: t.Sunrise,
                    Dhuhr: t.Asr,
                    Asr: t.Sunset,
                    Maghrib: t.Isha,
                    Isha: nextFajr,
                };

                applyTimings(t, d, token);
                return;
            }
        }

        // Muwaqqit failed — try Aladhan
        console.warn('Muwaqqit failed, trying Aladhan fallback...');
        await fetchFromAladhan(lat, lng, method, token);
    };

    const fetchFromAladhan = async (lat: number, lng: number, method: PrayerMethod, token: { alive: boolean }) => {
        const today = new Date();
        const dd = String(today.getDate()).padStart(2, '0');
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const yyyy = today.getFullYear();
        const school = madhab === 'hanafi' ? 1 : 0;

        const data = await fetchWithRetry(
            `https://api.aladhan.com/v1/timings/${dd}-${mm}-${yyyy}?latitude=${lat}&longitude=${lng}&method=${method.aladhanMethod}&school=${school}`
        );

        if (data && data.code === 200) {
            const at = data.data.timings;
            const t: Timings = {
                Fajr: at.Fajr, Sunrise: at.Sunrise, Dhuhr: at.Dhuhr,
                Asr: at.Asr, Sunset: at.Sunset, Maghrib: at.Maghrib, Isha: at.Isha,
            };
            const d: PrayerDeadlines = {
                Fajr: at.Sunrise, Dhuhr: at.Asr, Asr: at.Sunset,
                Maghrib: at.Isha, Isha: at.Fajr,
            };
            applyTimings(t, d, token);
        } else {
            console.warn('All API attempts failed — using hardcoded fallback');
            applyTimings(FALLBACK_TIMINGS, FALLBACK_DEADLINES, token);
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

    return { timings, deadlines, nextPrayer, loading, locationError, detectedMethodKey };
}

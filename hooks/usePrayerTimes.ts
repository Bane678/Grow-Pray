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

// Explicit Islamic deadlines for each prayer (HH:MM format)
// Derived from Muwaqqit astronomical calculations
export type PrayerDeadlines = {
    Fajr: string;      // Sunrise
    Dhuhr: string;     // Asr al-Mithl al-Awwal (shadow = object + meridian shadow)
    Asr: string;       // Sunset
    Maghrib: string;   // Isha (disappearance of red twilight)
    Isha: string;      // Next day's Fajr
};

// Hardcoded fallback — used when API is completely unreachable
const FALLBACK_TIMINGS: Timings = {
    Fajr: '05:30',
    Sunrise: '07:00',
    Dhuhr: '12:15',
    Asr: '14:45',
    Sunset: '17:30',
    Maghrib: '17:30',
    Isha: '19:15',
};

const FALLBACK_DEADLINES: PrayerDeadlines = {
    Fajr: '07:00',     // Sunrise
    Dhuhr: '14:45',    // Asr start
    Asr: '17:30',      // Sunset
    Maghrib: '19:15',  // Isha start
    Isha: '05:30',     // Next Fajr
};

// Convert Muwaqqit "HH:MM:SS" to "HH:MM"
function toHHMM(time: string): string {
    if (!time) return '00:00';
    const parts = time.split(':');
    return `${parts[0]}:${parts[1]}`;
}

// Get the user's IANA timezone string
function getTimezone(): string {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
        return 'UTC';
    }
}

// Fetch with timeout + retry
async function fetchWithRetry(url: string, retries = 3, timeoutMs = 10000): Promise<any> {
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

            return await response.json();
        } catch (error: any) {
            console.warn(`Fetch attempt ${attempt + 1} failed:`, error?.message || error);
            if (attempt < retries - 1) {
                await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
            }
        }
    }
    return null;
}

// Parse Muwaqqit monthly response to extract today's entry
function findTodayEntry(data: any[]): any | null {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;

    // Muwaqqit returns an array of daily entries for the month
    // Each entry has a 'd' field with the date
    for (const entry of data) {
        if (entry.d === dateStr) return entry;
    }
    // If exact date not found, try matching on fajr_date or sunset_date
    for (const entry of data) {
        if (entry.fajr_date === dateStr || entry.sunset_date === dateStr) return entry;
    }
    return null;
}

// Extract next day's entry (for Isha deadline = next Fajr)
function findTomorrowEntry(data: any[]): any | null {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yyyy = tomorrow.getFullYear();
    const mm = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const dd = String(tomorrow.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;

    for (const entry of data) {
        if (entry.d === dateStr) return entry;
    }
    for (const entry of data) {
        if (entry.fajr_date === dateStr) return entry;
    }
    return null;
}

export function usePrayerTimes() {
    const [timings, setTimings] = useState<Timings | null>(null);
    const [deadlines, setDeadlines] = useState<PrayerDeadlines | null>(null);
    const [nextPrayer, setNextPrayer] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [locationError, setLocationError] = useState<string | null>(null);
    const isMounted = useRef(true);

    useEffect(() => {
        isMounted.current = true;
        getLocationAndFetchTimings();
        return () => { isMounted.current = false; };
    }, []);

    const applyTimings = (t: Timings, d: PrayerDeadlines) => {
        if (!isMounted.current) return;
        setTimings(t);
        setDeadlines(d);
        calculateNextPrayer(t);
        setLoading(false);
    };

    const useFallback = () => {
        console.warn('All API attempts failed — using hardcoded fallback times');
        applyTimings(FALLBACK_TIMINGS, FALLBACK_DEADLINES);
    };

    const getLocationAndFetchTimings = async () => {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            
            if (status !== 'granted') {
                setLocationError('Location permission denied');
                // Fallback to London coords
                await fetchFromMuwaqqit(51.5074, -0.1278);
                return;
            }

            const location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
            });

            const { latitude, longitude } = location.coords;
            await fetchFromMuwaqqit(latitude, longitude);
        } catch (error) {
            console.error('Location error:', error);
            setLocationError('Failed to get location');
            // Fallback to London coords
            await fetchFromMuwaqqit(51.5074, -0.1278);
        }
    };

    const fetchFromMuwaqqit = async (lat: number, lng: number) => {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const tz = encodeURIComponent(getTimezone());

        // Muwaqqit returns the full month of data in one call
        const url = `https://api.muwaqqit.com/api.json?lt=${lat}&ln=${lng}&d=${yyyy}-${mm}-${dd}&tz=${tz}`;
        
        const data = await fetchWithRetry(url);

        if (data && Array.isArray(data)) {
            const todayEntry = findTodayEntry(data);
            const tomorrowEntry = findTomorrowEntry(data);

            if (todayEntry) {
                // Map Muwaqqit fields → our Timings shape
                //
                // Muwaqqit fields:
                //   fajr_time      — Fajr start
                //   sunrise_time   — Sunrise (Fajr deadline)
                //   zohr_time      — Dhuhr start (after zenith)
                //   mithl_time     — Asr al-Mithl al-Awwal (Dhuhr deadline / Asr start for majority)
                //   mithlain_time  — Asr al-Mithl al-Thani (Hanafi Asr start)
                //   karaha_time    — Karahah (reprehensible to delay Asr past this)
                //   sunset_time    — Sunset/Maghrib start (Asr deadline)
                //   esha_red_time  — Isha by red twilight (Maghrib deadline / Isha start for majority)
                //   esha_time      — Isha by white twilight (Hanafi)
                //
                const t: Timings = {
                    Fajr: toHHMM(todayEntry.fajr_time),
                    Sunrise: toHHMM(todayEntry.sunrise_time),
                    Dhuhr: toHHMM(todayEntry.zohr_time),
                    Asr: toHHMM(todayEntry.mithl_time),          // Majority: shadow = object + meridian
                    Sunset: toHHMM(todayEntry.sunset_time),
                    Maghrib: toHHMM(todayEntry.sunset_time),     // Maghrib = Sunset
                    Isha: toHHMM(todayEntry.esha_red_time),      // Majority: red twilight disappearance
                    // Extra Muwaqqit data for reference
                    Karahah: toHHMM(todayEntry.karaha_time),
                    AsrHanafi: toHHMM(todayEntry.mithlain_time),  // Hanafi Asr start (2× shadow)
                    IshaHanafi: toHHMM(todayEntry.esha_time),     // Hanafi Isha start (white twilight)
                };

                // Explicit Islamic deadlines
                const nextFajr = tomorrowEntry
                    ? toHHMM(tomorrowEntry.fajr_time)
                    : t.Fajr; // fallback to today's Fajr

                const d: PrayerDeadlines = {
                    Fajr: t.Sunrise,                              // Fajr ends at Sunrise
                    Dhuhr: t.Asr,                                 // Dhuhr ends at Asr al-Mithl al-Awwal
                    Asr: t.Sunset,                                // Asr ends at Sunset
                    Maghrib: t.Isha,                              // Maghrib ends at Isha (red twilight)
                    Isha: nextFajr,                               // Isha ends at next Fajr
                };

                applyTimings(t, d);
                return;
            }
        }

        // Muwaqqit failed — try Aladhan as secondary fallback
        console.warn('Muwaqqit failed, trying Aladhan fallback...');
        await fetchFromAladhan(lat, lng);
    };

    // Aladhan fallback (in case Muwaqqit is down / rate-limited)
    const fetchFromAladhan = async (lat: number, lng: number) => {
        const today = new Date();
        const dd = String(today.getDate()).padStart(2, '0');
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const yyyy = today.getFullYear();

        const data = await fetchWithRetry(
            `https://api.aladhan.com/v1/timings/${dd}-${mm}-${yyyy}?latitude=${lat}&longitude=${lng}&method=2`
        );

        if (data && data.code === 200) {
            const at = data.data.timings;
            const t: Timings = {
                Fajr: at.Fajr,
                Sunrise: at.Sunrise,
                Dhuhr: at.Dhuhr,
                Asr: at.Asr,
                Sunset: at.Sunset,
                Maghrib: at.Maghrib,
                Isha: at.Isha,
            };

            // Derive deadlines from Aladhan data (best approximation)
            const d: PrayerDeadlines = {
                Fajr: at.Sunrise,       // Fajr → Sunrise
                Dhuhr: at.Asr,          // Dhuhr → Asr start
                Asr: at.Sunset,         // Asr → Sunset
                Maghrib: at.Isha,       // Maghrib → Isha
                Isha: at.Fajr,          // Isha → next Fajr (approx — same day value)
            };

            applyTimings(t, d);
        } else {
            useFallback();
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
                const prayerMinutes = hours * 60 + minutes;
                if (prayerMinutes > currentMinutes) {
                    setNextPrayer(prayer);
                    return;
                }
            }
        }
        setNextPrayer('Fajr');
    };

    return { timings, deadlines, nextPrayer, loading, locationError };
}

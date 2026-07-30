// ─── Pure prayer-time calculation core ──────────────────────────────────────────
//
// Deliberately free of React, expo, and react-native imports so it can be run and
// tested under plain Node (see lib/prayerCalc.test.ts, `npm test`). Every piece of
// date/timezone reasoning the app depends on lives HERE and is covered by tests
// that sweep dozens of cities across whole years, including DST transitions, leap
// days, and the polar circles.
//
// Written in erasable-syntax-only TypeScript (no enum/namespace/parameter
// properties) so `node lib/prayerCalc.test.ts` runs it directly with no build step.
//
// ⚠️ If you change anything in this file, run `npm test` before shipping. Prayer
// times are the app's credibility - a silently wrong time is worse than a crash.

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

export type Madhab = 'hanafi' | 'standard';

export const PRAYER_ORDER = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'] as const;

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
export function getMethodKeyForCountry(countryCode: string): PrayerMethodKey {
    const cc = countryCode.toUpperCase();

    // High-latitude countries: standard 18° Fajr/Isha angles are unreachable in
    // summer (sun stays above ~12° below horizon). Use the Moonsighting method.
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

// ─── Fallbacks ──────────────────────────────────────────────────────────────────

export const FALLBACK_TIMINGS: Timings = {
    Fajr: '05:30', Sunrise: '07:00', Dhuhr: '12:15', Asr: '14:45',
    Sunset: '17:30', Maghrib: '17:30', Isha: '19:15',
};
export const FALLBACK_DEADLINES: PrayerDeadlines = {
    Fajr: '07:00', Dhuhr: '14:45', Asr: '17:30', Maghrib: '19:15', Isha: '05:30',
};

// ─── Timezone primitives ────────────────────────────────────────────────────────
// Everything below treats `timezone` as optional. When it is absent the device's
// own clock is authoritative, which is correct for GPS mode: the device IS at the
// prayer location. When a manual city is set, `timezone` is that city's IANA zone
// and every wall-clock question is answered in THAT zone, never the device's.

export interface ZonedParts {
    year: number;
    month: number;   // 1-12
    day: number;     // 1-31
    hour: number;    // 0-23
    minute: number;  // 0-59
}

/**
 * Break a UTC instant into wall-clock calendar parts for a given IANA timezone.
 * Falls back to device-local parts when no (or an invalid) timezone is supplied.
 * This is DST-correct by construction: Intl resolves the offset in effect at that
 * exact instant, so it needs no table of transition dates and never goes stale.
 */
export function zonedParts(date: Date, timezone?: string): ZonedParts {
    if (timezone) {
        try {
            const parts = new Intl.DateTimeFormat('en-US', {
                timeZone: timezone,
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit', hour12: false,
            }).formatToParts(date);
            const pick = (t: string) => parts.find(p => p.type === t)?.value ?? '0';
            const hour = parseInt(pick('hour'), 10);
            return {
                year: parseInt(pick('year'), 10),
                month: parseInt(pick('month'), 10),
                day: parseInt(pick('day'), 10),
                // Some ICU versions render midnight as '24' under hour12:false.
                hour: hour === 24 ? 0 : hour,
                minute: parseInt(pick('minute'), 10),
            };
        } catch {
            // Invalid timezone string - fall through to device-local.
        }
    }
    return {
        year: date.getFullYear(),
        month: date.getMonth() + 1,
        day: date.getDate(),
        hour: date.getHours(),
        minute: date.getMinutes(),
    };
}

/**
 * Stable 'YYYY-MM-DD' identity for "which day is it at the prayer location".
 * This is the key the app compares against to detect that a new day has begun and
 * the cached times must be recomputed.
 */
export function localDayKey(date: Date, timezone?: string): string {
    const p = zonedParts(date, timezone);
    return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

/** Minutes since midnight at the prayer location. */
export function tzMinutes(date: Date, timezone?: string): number {
    const p = zonedParts(date, timezone);
    return p.hour * 60 + p.minute;
}

/** Format an absolute instant as HH:MM wall-clock at the prayer location. */
export function dateToHHMM(date: Date | undefined, timezone?: string): string {
    if (!date || isNaN(date.getTime())) return '00:00';
    const p = zonedParts(date, timezone);
    return `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`;
}

/** 'HH:MM' → minutes since midnight. */
export function timeToMinutes(hhmm: string): number {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
}

// ─── Core computation ───────────────────────────────────────────────────────────

export function getAdhanParams(key: PrayerMethodKey, coordinates: Coordinates): CalculationParameters {
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
    // adhan's own recommendation for the latitude. Measured behaviour (see the
    // suite): it returns MiddleOfTheNight below ~48° and SeventhOfTheNight at every
    // latitude above it - it does NOT switch to TwilightAngle higher up, whatever
    // its docs imply. Verified across 45/50/55/60/64/69/78°.
    params.highLatitudeRule = HighLatitudeRule.recommended(coordinates);
    // If sunrise/sunset are undefined (polar circles) use the nearest sane day.
    params.polarCircleResolution = PolarCircleResolution.AqrabYaum;
    return params;
}

/**
 * Above this latitude adhan cannot produce a coherent day, whatever high-latitude
 * rule or polar resolution it is given.
 *
 * Measured, not assumed: sweeping every day of 2024 and 2026, the first latitude
 * at which the six prayers stop being strictly ordered is 66° (33 broken days per
 * two years); by 69.6° (Tromsø) it is 137, and at 78.2° (Longyearbyen) worse. The
 * failure is inherent rather than a library bug - during polar day and polar night
 * there is no sunset and no shadow of the required length, so Maghrib and Asr are
 * genuinely undefined and adhan emits Asr *after* Maghrib.
 *
 * 65° is the last latitude that is clean year-round with a margin. Everything at
 * or below it (including Reykjavík at 64.1°, which is clean on every single day)
 * computes normally.
 */
export const MAX_RELIABLE_LATITUDE = 65;

/**
 * Build the Date handed to adhan for a given calendar day.
 *
 * adhan reads only the *device-local* year/month/day off this Date, so we must
 * construct it from the calendar day at the PRAYER LOCATION, not from the device's
 * own date. Without this, a user in London with a manual city in Auckland gets
 * yesterday's Auckland times for ~12 hours a day.
 *
 * Anchored at noon rather than midnight: a handful of zones (historically Brazil,
 * and any zone that springs forward at 00:00) have no 00:00 wall-clock on some
 * days, and a ±1h DST shift around midnight can silently land on the wrong date.
 * Noon has ~12h of slack in both directions, so it can never cross a day boundary.
 */
export function adhanDateFor(year: number, month: number, day: number): Date {
    // JS normalises overflow (day 32 → next month, Feb 30 → Mar), which gives us
    // correct month-end, year-end and leap-year rollover for free.
    return new Date(year, month - 1, day, 12, 0, 0, 0);
}

export interface ComputeInput {
    lat: number;
    lng: number;
    methodKey: PrayerMethodKey;
    madhab: Madhab;
    /** IANA zone of the prayer location. Omit for GPS mode (device is there). */
    timezone?: string;
    /** The instant to compute "today" from. Defaults to now. */
    now?: Date;
}

export interface PrayerInstants {
    Fajr: Date;
    Sunrise: Date;
    Dhuhr: Date;
    Asr: Date;
    Maghrib: Date;
    Isha: Date;
}

export interface ComputedDay {
    timings: Timings;
    deadlines: PrayerDeadlines;
    /** The calendar day at the prayer location these timings describe. */
    dayKey: string;
    /**
     * The same six times as absolute instants.
     *
     * The `timings` strings are wall-clock only and therefore ambiguous at high
     * latitude, where Isha (and in Iceland even Maghrib) can fall *after* local
     * midnight and so render as e.g. "00:23" - a smaller number than Fajr. Any
     * logic that needs to order prayers or measure a gap must use these instants,
     * not the strings. Strings are for display; instants are for arithmetic.
     */
    instants: PrayerInstants;
    /**
     * Set when the location sits beyond MAX_RELIABLE_LATITUDE and the times were
     * therefore derived at the nearest usable latitude instead (Aqrab al-Bilad).
     * Holds the latitude actually used. `null` for virtually every user - it only
     * becomes non-null above 65°, i.e. Tromsø, Svalbard, northern Finland.
     * The UI should disclose it rather than present these as locally computed.
     */
    approximatedFromLatitude: number | null;
}

/**
 * Compute one full day of prayer times for a location.
 *
 * Correct across DST (all wall-clock rendering goes through Intl at the actual
 * instant), leap years and month/year boundaries (date arithmetic via JS Date
 * overflow normalisation), timezone mismatch (the location's calendar day drives
 * the computation), and the polar circles (AqrabYaum).
 */
export function computePrayerDay(input: ComputeInput): ComputedDay {
    const { lat, lng, methodKey, madhab, timezone } = input;
    const now = input.now ?? new Date();

    // Aqrab al-Bilad: beyond the reliable band, follow the nearest latitude where
    // the signs of the prayer times are actually discernible, keeping the user's
    // own longitude (and therefore their solar noon) intact.
    const beyondReliable = Math.abs(lat) > MAX_RELIABLE_LATITUDE;
    const calcLat = beyondReliable
        ? Math.sign(lat) * MAX_RELIABLE_LATITUDE
        : lat;
    const approximatedFromLatitude = beyondReliable ? calcLat : null;

    const coordinates = new Coordinates(calcLat, lng);
    const params = getAdhanParams(methodKey, coordinates);
    params.madhab = madhab === 'hanafi' ? AdhanMadhab.Hanafi : AdhanMadhab.Shafi;

    // Which calendar day is it *where the prayers are*?
    const here = zonedParts(now, timezone);
    const today = adhanDateFor(here.year, here.month, here.day);
    const tomorrow = adhanDateFor(here.year, here.month, here.day + 1);

    const pt = new PrayerTimes(coordinates, today, params);
    const ptTomorrow = new PrayerTimes(coordinates, tomorrow, params);

    const fmt = (d: Date | undefined) => dateToHHMM(d, timezone);
    const timings: Timings = {
        Fajr:    fmt(pt.fajr),
        Sunrise: fmt(pt.sunrise),
        Dhuhr:   fmt(pt.dhuhr),
        Asr:     fmt(pt.asr),
        Sunset:  fmt(pt.maghrib),
        Maghrib: fmt(pt.maghrib),
        Isha:    fmt(pt.isha),
    };
    const deadlines: PrayerDeadlines = {
        Fajr:    timings.Sunrise,
        Dhuhr:   timings.Asr,
        Asr:     timings.Sunset,
        Maghrib: timings.Isha,
        Isha:    fmt(ptTomorrow.fajr),
    };

    const instants: PrayerInstants = {
        Fajr: pt.fajr, Sunrise: pt.sunrise, Dhuhr: pt.dhuhr,
        Asr: pt.asr, Maghrib: pt.maghrib, Isha: pt.isha,
    };

    return {
        timings,
        deadlines,
        dayKey: localDayKey(now, timezone),
        instants,
        approximatedFromLatitude,
    };
}

/**
 * Which prayer is next, evaluated on the prayer location's clock.
 *
 * Handles Isha falling after midnight (common at high latitude in summer, where
 * Isha can land at 00:30): any prayer whose wall-clock time is earlier than the
 * prayer before it is understood to belong to the following day.
 */
export function nextPrayerFrom(timings: Timings, now?: Date, timezone?: string): string {
    const currentMinutes = tzMinutes(now ?? new Date(), timezone);

    let prev = -1;
    let dayOffset = 0;
    for (const prayer of PRAYER_ORDER) {
        const raw = timings[prayer];
        if (!raw) continue;
        let mins = timeToMinutes(raw);
        // Wrapped past midnight relative to the previous prayer → next day.
        if (mins < prev) dayOffset = 24 * 60;
        mins += dayOffset;
        prev = mins - dayOffset;
        if (mins > currentMinutes) return prayer;
    }
    // Everything today has passed - the next one is tomorrow's Fajr.
    return 'Fajr';
}

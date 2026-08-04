// ─── Prayer-time correctness suite ──────────────────────────────────────────────
//
// Run with:  npm test
//
// The app cannot be hand-verified against every location on earth, so instead of
// checking outputs one city at a time this suite proves *invariants* that must
// hold everywhere, then sweeps them across whole years of real calendar dates in
// cities spanning the equator to the arctic - including every DST transition and
// leap day in range.
//
// Layers:
//   1. Invariant sweep      - ordering/sanity for ~30 cities × 2 full years
//   2. Continuity sweep     - times move smoothly day to day (catches DST bugs)
//   3. DST transitions      - explicit assertions on spring-forward/fall-back days
//   4. Leap year / rollover - Feb 29, month ends, year ends
//   5. Timezone correctness - manual city in another zone gets ITS day, not ours
//   6. Staleness guard      - the regression test for the 2026-07 stale-cache bug
//   7. Golden references    - pinned values, so a library bump can't silently move
//
// A failure here means a user somewhere would be given a wrong prayer time.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
    computePrayerDay,
    computeUpcomingDays,
    PRAYER_SCHEDULE_DAYS,
    MAX_RELIABLE_LATITUDE,
    localDayKey,
    zonedParts,
    tzMinutes,
    timeToMinutes,
    nextPrayerFrom,
    adhanDateFor,
    getMethodKeyForCountry,
    type Madhab,
    type PrayerMethodKey,
    type Timings,
} from './prayerCalc.ts';

// ─── Fixtures ───────────────────────────────────────────────────────────────────

interface City {
    name: string;
    lat: number;
    lng: number;
    tz: string;
    cc: string;
    /** Above the arctic/antarctic circle: ordering invariants relax. */
    polar?: boolean;
}

const CITIES: City[] = [
    // Equatorial / low latitude
    { name: 'Singapore',    lat: 1.3521,   lng: 103.8198,  tz: 'Asia/Singapore',      cc: 'SG' },
    { name: 'Nairobi',      lat: -1.2921,  lng: 36.8219,   tz: 'Africa/Nairobi',      cc: 'KE' },
    { name: 'Jakarta',      lat: -6.2088,  lng: 106.8456,  tz: 'Asia/Jakarta',        cc: 'ID' },
    { name: 'Kuala Lumpur', lat: 3.1390,   lng: 101.6869,  tz: 'Asia/Kuala_Lumpur',   cc: 'MY' },
    { name: 'Lagos',        lat: 6.5244,   lng: 3.3792,    tz: 'Africa/Lagos',        cc: 'NG' },
    // Mid latitude, northern
    { name: 'Makkah',       lat: 21.3891,  lng: 39.8579,   tz: 'Asia/Riyadh',         cc: 'SA' },
    { name: 'Dubai',        lat: 25.2048,  lng: 55.2708,   tz: 'Asia/Dubai',          cc: 'AE' },
    { name: 'Karachi',      lat: 24.8607,  lng: 67.0011,   tz: 'Asia/Karachi',        cc: 'PK' },
    { name: 'Cairo',        lat: 30.0444,  lng: 31.2357,   tz: 'Africa/Cairo',        cc: 'EG' },
    { name: 'Delhi',        lat: 28.6139,  lng: 77.2090,   tz: 'Asia/Kolkata',        cc: 'IN' },
    { name: 'Dhaka',        lat: 23.8103,  lng: 90.4125,   tz: 'Asia/Dhaka',          cc: 'BD' },
    { name: 'Casablanca',   lat: 33.5731,  lng: -7.5898,   tz: 'Africa/Casablanca',   cc: 'MA' },
    { name: 'Houston',      lat: 29.7604,  lng: -95.3698,  tz: 'America/Chicago',     cc: 'US' },
    { name: 'Istanbul',     lat: 41.0082,  lng: 28.9784,   tz: 'Europe/Istanbul',     cc: 'TR' },
    { name: 'New York',     lat: 40.7128,  lng: -74.0060,  tz: 'America/New_York',    cc: 'US' },
    { name: 'Madrid',       lat: 40.4168,  lng: -3.7038,   tz: 'Europe/Madrid',       cc: 'ES' },
    { name: 'Toronto',      lat: 43.6532,  lng: -79.3832,  tz: 'America/Toronto',     cc: 'CA' },
    { name: 'Paris',        lat: 48.8566,  lng: 2.3522,    tz: 'Europe/Paris',        cc: 'FR' },
    { name: 'Frankfurt',    lat: 50.1109,  lng: 8.6821,    tz: 'Europe/Berlin',       cc: 'DE' },
    { name: 'London',       lat: 51.5074,  lng: -0.1278,   tz: 'Europe/London',       cc: 'GB' },
    { name: 'Birmingham',   lat: 52.4862,  lng: -1.8904,   tz: 'Europe/London',       cc: 'GB' },
    { name: 'Berlin',       lat: 52.5200,  lng: 13.4050,   tz: 'Europe/Berlin',       cc: 'DE' },
    { name: 'Manchester',   lat: 53.4808,  lng: -2.2426,   tz: 'Europe/London',       cc: 'GB' },
    { name: 'Moscow',       lat: 55.7558,  lng: 37.6173,   tz: 'Europe/Moscow',       cc: 'RU' },
    { name: 'Glasgow',      lat: 55.8642,  lng: -4.2518,   tz: 'Europe/London',       cc: 'GB' },
    { name: 'Stockholm',    lat: 59.3293,  lng: 18.0686,   tz: 'Europe/Stockholm',    cc: 'SE' },
    { name: 'Oslo',         lat: 59.9139,  lng: 10.7522,   tz: 'Europe/Oslo',         cc: 'NO' },
    { name: 'Helsinki',     lat: 60.1699,  lng: 24.9384,   tz: 'Europe/Helsinki',     cc: 'FI' },
    { name: 'Reykjavik',    lat: 64.1466,  lng: -21.9426,  tz: 'Atlantic/Reykjavik',  cc: 'IS' },
    // Arctic - the hardest case. Sun may not rise or set for weeks.
    { name: 'Tromso',       lat: 69.6492,  lng: 18.9553,   tz: 'Europe/Oslo',         cc: 'NO', polar: true },
    { name: 'Longyearbyen', lat: 78.2232,  lng: 15.6267,   tz: 'Europe/Oslo',         cc: 'NO', polar: true },
    // Southern hemisphere (DST runs opposite)
    { name: 'Sydney',       lat: -33.8688, lng: 151.2093,  tz: 'Australia/Sydney',    cc: 'AU' },
    { name: 'Auckland',     lat: -36.8485, lng: 174.7633,  tz: 'Pacific/Auckland',    cc: 'NZ' },
    { name: 'Cape Town',    lat: -33.9249, lng: 18.4241,   tz: 'Africa/Johannesburg', cc: 'ZA' },
    { name: 'Santiago',     lat: -33.4489, lng: -70.6693,  tz: 'America/Santiago',    cc: 'CL' },
];

const MADHABS: Madhab[] = ['standard', 'hanafi'];

/** Every day of a year, as a noon-UTC instant (safe from any zone's DST edges). */
function* daysOfYear(year: number): Generator<Date> {
    const d = new Date(Date.UTC(year, 0, 1, 12, 0, 0));
    while (d.getUTCFullYear() === year) {
        yield new Date(d.getTime());
        d.setUTCDate(d.getUTCDate() + 1);
    }
}

function methodFor(city: City): PrayerMethodKey {
    return getMethodKeyForCountry(city.cc);
}

function computeFor(city: City, now: Date, madhab: Madhab = 'standard') {
    return computePrayerDay({
        lat: city.lat, lng: city.lng,
        methodKey: methodFor(city), madhab, timezone: city.tz, now,
    });
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

// ─── 1. Invariant sweep ─────────────────────────────────────────────────────────

test('every prayer time is a well-formed HH:MM for every city, every day, both madhabs', () => {
    let checked = 0;
    for (const city of CITIES) {
        for (const madhab of MADHABS) {
            for (const day of daysOfYear(2026)) {
                const { timings, deadlines } = computeFor(city, day, madhab);
                for (const [k, v] of Object.entries(timings)) {
                    assert.match(v, HHMM, `${city.name} ${madhab} ${day.toISOString()} timings.${k} = ${v}`);
                }
                for (const [k, v] of Object.entries(deadlines)) {
                    assert.match(v, HHMM, `${city.name} ${madhab} ${day.toISOString()} deadlines.${k} = ${v}`);
                }
                checked++;
            }
        }
    }
    assert.ok(checked > 20000, `expected a large sweep, only ran ${checked}`);
});

// Ordering is asserted on ABSOLUTE INSTANTS, never on the HH:MM strings. At high
// latitude Isha (and in Iceland, Maghrib) genuinely falls after local midnight and
// renders as e.g. "00:23", which is numerically smaller than Fajr. The physical
// ordering still holds; only the wall-clock representation wraps.
const SEQUENCE = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'] as const;

test('prayers occur in the correct physical order (all cities incl. arctic, leap + non-leap years)', () => {
    for (const city of CITIES) {
        for (const madhab of MADHABS) {
            for (const year of [2024, 2026]) {   // 2024 is a leap year
                for (const day of daysOfYear(year)) {
                    const { instants } = computeFor(city, day, madhab);
                    const ctx = `${city.name} ${madhab} ${localDayKey(day, city.tz)}`;
                    for (const k of SEQUENCE) {
                        assert.ok(instants[k] instanceof Date && !isNaN(instants[k].getTime()),
                            `${ctx}: ${k} is not a valid instant`);
                    }
                    for (let i = 1; i < SEQUENCE.length; i++) {
                        const prev = SEQUENCE[i - 1];
                        const cur = SEQUENCE[i];
                        assert.ok(instants[prev].getTime() < instants[cur].getTime(),
                            `${ctx}: ${prev} (${instants[prev].toISOString()}) ` +
                            `is not before ${cur} (${instants[cur].toISOString()})`);
                    }
                    // The whole day must fit inside a sane span - catches any
                    // polar-resolution fallback that silently reaches days away.
                    const span = instants.Isha.getTime() - instants.Fajr.getTime();
                    assert.ok(span > 0 && span < 26 * 3600e3,
                        `${ctx}: Fajr→Isha span of ${(span / 3600e3).toFixed(1)}h is implausible`);
                }
            }
        }
    }
});

test('only genuinely arctic locations fall back to the nearest usable latitude', () => {
    for (const city of CITIES) {
        const { approximatedFromLatitude } = computeFor(city, new Date(Date.UTC(2026, 0, 15, 12)));
        if (city.polar) {
            assert.equal(approximatedFromLatitude, Math.sign(city.lat) * MAX_RELIABLE_LATITUDE,
                `${city.name} (${city.lat}°) should use the nearest usable latitude`);
        } else {
            assert.equal(approximatedFromLatitude, null,
                `${city.name} (${city.lat}°) must compute at its own latitude, not an approximation`);
        }
    }
});

test('Reykjavik computes at its true latitude - it is inside the reliable band', () => {
    const reykjavik = CITIES.find(c => c.name === 'Reykjavik')!;
    assert.ok(Math.abs(reykjavik.lat) < MAX_RELIABLE_LATITUDE);
    for (const day of daysOfYear(2026)) {
        assert.equal(computeFor(reykjavik, day).approximatedFromLatitude, null);
    }
});

test('the reliable-latitude threshold is not set higher than adhan can actually sustain', () => {
    // Guards the constant itself: at MAX_RELIABLE_LATITUDE the ordering must hold
    // every day of a leap year and a common year, at several longitudes.
    for (const lng of [-21.9, 0, 18.9, 100]) {
        for (const sign of [1, -1]) {
            for (const year of [2024, 2026]) {
                for (const day of daysOfYear(year)) {
                    const { instants } = computePrayerDay({
                        lat: sign * MAX_RELIABLE_LATITUDE, lng,
                        methodKey: 'UK', madhab: 'standard', timezone: 'UTC', now: day,
                    });
                    for (let i = 1; i < SEQUENCE.length; i++) {
                        assert.ok(
                            instants[SEQUENCE[i - 1]].getTime() < instants[SEQUENCE[i]].getTime(),
                            `lat ${sign * MAX_RELIABLE_LATITUDE} lng ${lng} ${day.toISOString().slice(0, 10)}: ` +
                            `${SEQUENCE[i - 1]} not before ${SEQUENCE[i]}`);
                    }
                }
            }
        }
    }
});

test('high-latitude wall-clock times may wrap past midnight, and that is expected', () => {
    // Documents the behaviour the ordering test above deliberately tolerates, so
    // nobody "fixes" it back into a wall-clock comparison. Reykjavik in June has
    // Maghrib at 00:00-00:05 the following calendar day.
    const reykjavik = CITIES.find(c => c.name === 'Reykjavik')!;
    const { timings, instants } = computeFor(reykjavik, new Date(Date.UTC(2024, 5, 12, 12)));
    assert.ok(timeToMinutes(timings.Maghrib) < timeToMinutes(timings.Asr),
        'wall-clock Maghrib appears "before" Asr because it wrapped past midnight');
    assert.ok(instants.Maghrib.getTime() > instants.Asr.getTime(),
        'but the actual instant is correctly after Asr');
});

// ─── 2. Continuity sweep ────────────────────────────────────────────────────────

test('prayer instants advance by almost exactly 24h each day, everywhere, all year', () => {
    // Measured on absolute instants, so this is immune to DST and to midnight
    // wrapping. A cached/stale day, an off-by-one date, or a botched leap-year
    // rollover all show up here as a delta far from 24h.
    for (const city of CITIES) {
        for (const prayer of SEQUENCE) {
            let prev: number | null = null;
            let prevKey = '';
            for (const day of daysOfYear(2026)) {
                const { instants } = computeFor(city, day);
                const t = instants[prayer].getTime();
                const key = localDayKey(day, city.tz);
                if (prev !== null) {
                    const deltaMin = (t - prev) / 60000;
                    assert.ok(Math.abs(deltaMin - 1440) <= 15,
                        `${city.name} ${prayer}: ${prevKey} → ${key} advanced ` +
                        `${deltaMin.toFixed(1)} min, expected ~1440`);
                }
                prev = t;
                prevKey = key;
            }
        }
    }
});

test('displayed Maghrib drifts smoothly in wall-clock terms, jumping only at DST', () => {
    // The wall-clock counterpart of the test above: this is what the user actually
    // reads on screen, and it is where a timezone/DST rendering bug would surface.
    for (const city of CITIES.filter(c => !c.polar && c.name !== 'Reykjavik')) {
        let prev: number | null = null;
        let prevKey = '';
        for (const day of daysOfYear(2026)) {
            const { timings } = computeFor(city, day);
            const mins = timeToMinutes(timings.Maghrib);
            const key = localDayKey(day, city.tz);
            if (prev !== null) {
                const delta = mins - prev;
                const ok =
                    Math.abs(delta) <= 12 ||                          // seasonal drift
                    (Math.abs(delta) >= 45 && Math.abs(delta) <= 75); // a DST hour shift
                assert.ok(ok,
                    `${city.name}: Maghrib jumped ${delta} min from ${prevKey} to ${key} ` +
                    `(${String(prev)} → ${String(mins)} minutes past midnight)`);
            }
            prev = mins;
            prevKey = key;
        }
    }
});

// ─── 3. DST transitions ─────────────────────────────────────────────────────────

const DST_DAYS: { city: string; date: string; label: string }[] = [
    { city: 'London',   date: '2026-03-29', label: 'spring forward' },
    { city: 'London',   date: '2026-10-25', label: 'fall back' },
    { city: 'New York', date: '2026-03-08', label: 'spring forward' },
    { city: 'New York', date: '2026-11-01', label: 'fall back' },
    { city: 'Sydney',   date: '2026-04-05', label: 'fall back (southern)' },
    { city: 'Sydney',   date: '2026-10-04', label: 'spring forward (southern)' },
];

test('DST transition days compute cleanly and land on the right calendar day', () => {
    for (const { city: cityName, date, label } of DST_DAYS) {
        const city = CITIES.find(c => c.name === cityName)!;
        const [y, m, d] = date.split('-').map(Number);
        // Probe the whole transition day hour by hour, in the city's own zone.
        for (let hour = 0; hour < 24; hour++) {
            // Build a UTC instant, then confirm the day key we derive matches
            // whatever the city's wall clock actually says at that instant.
            const instant = new Date(Date.UTC(y, m - 1, d, hour, 30, 0));
            const parts = zonedParts(instant, city.tz);
            const expectedKey =
                `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
            assert.equal(localDayKey(instant, city.tz), expectedKey,
                `${cityName} ${date} ${label}: day key disagrees with wall clock at ${hour}:30Z`);

            const { timings, dayKey } = computeFor(city, instant);
            assert.equal(dayKey, expectedKey, `${cityName} ${date} ${label}: computed dayKey wrong`);
            assert.match(timings.Maghrib, HHMM);
            assert.match(timings.Fajr, HHMM);
        }
    }
});

test('times either side of a DST change differ by roughly the offset shift, not by a day', () => {
    const london = CITIES.find(c => c.name === 'London')!;
    // 28 Mar (GMT) vs 30 Mar (BST) - clocks went forward on the 29th.
    const before = computeFor(london, new Date(Date.UTC(2026, 2, 28, 12)));
    const after  = computeFor(london, new Date(Date.UTC(2026, 2, 30, 12)));
    const delta = timeToMinutes(after.timings.Maghrib) - timeToMinutes(before.timings.Maghrib);
    // Two days of seasonal drift (~+4 min) plus the +60 min clock shift.
    assert.ok(delta > 50 && delta < 75,
        `expected ~+60 min wall-clock shift across UK spring-forward, got ${delta}`);
    assert.equal(before.dayKey, '2026-03-28');
    assert.equal(after.dayKey, '2026-03-30');
});

// ─── 4. Leap year and calendar rollover ─────────────────────────────────────────

test('leap day exists in leap years and is skipped in common years', () => {
    assert.equal(localDayKey(adhanDateFor(2024, 2, 29)), '2024-02-29');
    // 2026 has no 29 Feb - JS normalises it to 1 March, which is the behaviour the
    // date arithmetic in computePrayerDay relies on.
    assert.equal(localDayKey(adhanDateFor(2026, 2, 29)), '2026-03-01');
});

test('date arithmetic rolls over month ends, year ends and leap days', () => {
    const cases: [number, number, number, string][] = [
        [2026, 1, 32, '2026-02-01'],
        [2026, 12, 32, '2027-01-01'],
        [2024, 2, 30, '2024-03-01'],   // leap year: 29 days, so day 30 → 1 Mar
        [2026, 2, 29, '2026-03-01'],   // common year: 28 days
        [2026, 4, 31, '2026-05-01'],
    ];
    for (const [y, m, d, expected] of cases) {
        assert.equal(localDayKey(adhanDateFor(y, m, d)), expected, `adhanDateFor(${y},${m},${d})`);
    }
});

test('Feb 29 produces sane times and is continuous with its neighbours', () => {
    const london = CITIES.find(c => c.name === 'London')!;
    const feb28 = computeFor(london, new Date(Date.UTC(2024, 1, 28, 12)));
    const feb29 = computeFor(london, new Date(Date.UTC(2024, 1, 29, 12)));
    const mar01 = computeFor(london, new Date(Date.UTC(2024, 2, 1, 12)));
    assert.equal(feb29.dayKey, '2024-02-29');
    const a = timeToMinutes(feb28.timings.Maghrib);
    const b = timeToMinutes(feb29.timings.Maghrib);
    const c = timeToMinutes(mar01.timings.Maghrib);
    assert.ok(b > a && c > b, `Maghrib should lengthen across the leap day: ${a} → ${b} → ${c}`);
    assert.ok(b - a <= 12 && c - b <= 12, 'no discontinuity across the leap day');
});

// ─── 5. Timezone correctness (manual city in another zone) ──────────────────────

test('a manual city computes ITS calendar day, not the devices', () => {
    const auckland = CITIES.find(c => c.name === 'Auckland')!;
    // 30 Jul 2026 22:00 UTC = 23:00 in London, but already 10:00 on 31 Jul in Auckland.
    const instant = new Date('2026-07-30T22:00:00Z');
    const { dayKey, timings } = computeFor(auckland, instant);
    assert.equal(dayKey, '2026-07-31',
        'Auckland had already rolled into the 31st; we must compute that day');
    // Sanity: at 10:00 local, Fajr and sunrise are behind us, Maghrib is ahead.
    const nowMins = tzMinutes(instant, auckland.tz);
    assert.equal(nowMins, 10 * 60);
    assert.ok(timeToMinutes(timings.Maghrib) > nowMins, 'Maghrib should still be ahead at 10:00');
});

test('the same instant yields different days in different zones', () => {
    const instant = new Date('2026-07-30T22:00:00Z');
    assert.equal(localDayKey(instant, 'Europe/London'), '2026-07-30');
    assert.equal(localDayKey(instant, 'Pacific/Auckland'), '2026-07-31');
    assert.equal(localDayKey(instant, 'America/Los_Angeles'), '2026-07-30');
    assert.equal(localDayKey(instant, 'Asia/Tokyo'), '2026-07-31');
});

test('an invalid timezone degrades to device-local instead of throwing', () => {
    const d = new Date('2026-07-30T22:00:00Z');
    assert.doesNotThrow(() => localDayKey(d, 'Not/AZone'));
    assert.equal(localDayKey(d, 'Not/AZone'), localDayKey(d));
});

// ─── 6. Staleness guard (regression: the 2026-07 stale-cache bug) ───────────────
//
// Reported symptom: on 29 Jul 2026 the app displayed Maghrib 21:11 when the real
// time was ~20:56. 21:11 is London's Maghrib for 18 Jul - the times had been
// computed once, eleven days earlier, and never recomputed. The hook now keys its
// cache on `dayKey` and recomputes the moment that key changes.

test('consecutive days produce different Maghrib times (a cached day is detectable)', () => {
    const london = CITIES.find(c => c.name === 'London')!;
    const jul18 = computeFor(london, new Date(Date.UTC(2026, 6, 18, 12)));
    const jul29 = computeFor(london, new Date(Date.UTC(2026, 6, 29, 12)));

    assert.notEqual(jul18.dayKey, jul29.dayKey, 'day keys must differ, or staleness is undetectable');
    assert.equal(jul18.timings.Maghrib, '21:11', 'the stale value the user saw');
    assert.equal(jul29.timings.Maghrib, '20:56', 'the correct value for that day');
    const drift = timeToMinutes(jul18.timings.Maghrib) - timeToMinutes(jul29.timings.Maghrib);
    assert.equal(drift, 15, 'eleven days of staleness was a 15-minute error');
});

test('the day key changes exactly at local midnight, which is what triggers a refresh', () => {
    const tz = 'Europe/London';
    const justBefore = new Date('2026-07-29T22:59:30Z'); // 23:59:30 BST
    const justAfter  = new Date('2026-07-29T23:00:30Z'); // 00:00:30 BST next day
    assert.equal(localDayKey(justBefore, tz), '2026-07-29');
    assert.equal(localDayKey(justAfter, tz), '2026-07-30');
});

// ─── 6b. Multi-day scheduling (notification window) ─────────────────────────────
//
// Regression cover for the second stale-time bug: prayer alerts were scheduled as
// a daily-REPEATING alarm at one fixed wall-clock time, so they never tracked the
// drifting sunset. A user who did not reopen the app was an hour wrong within a
// month. Notifications now schedule from a rolling window of individually-dated
// days, which is what computeUpcomingDays produces.

test('computeUpcomingDays returns consecutive days starting today', () => {
    const london = CITIES.find(c => c.name === 'London')!;
    const days = computeUpcomingDays({
        lat: london.lat, lng: london.lng, methodKey: 'UK', madhab: 'standard',
        timezone: london.tz, now: new Date(Date.UTC(2026, 7, 4, 12)),
    }, 10);
    assert.equal(days.length, 10);
    const expected = [
        '2026-08-04', '2026-08-05', '2026-08-06', '2026-08-07', '2026-08-08',
        '2026-08-09', '2026-08-10', '2026-08-11', '2026-08-12', '2026-08-13',
    ];
    assert.deepEqual(days.map(d => d.dayKey), expected);
});

test('each day in the window matches what computePrayerDay gives for that day', () => {
    for (const city of CITIES.filter(c => !c.polar)) {
        const base = {
            lat: city.lat, lng: city.lng, methodKey: methodFor(city),
            madhab: 'standard' as Madhab, timezone: city.tz,
        };
        const start = new Date(Date.UTC(2026, 7, 4, 12));
        const window = computeUpcomingDays({ ...base, now: start }, 10);
        for (let i = 0; i < window.length; i++) {
            const single = computePrayerDay({
                ...base,
                now: new Date(start.getTime() + i * 86400e3),
            });
            assert.equal(window[i].dayKey, single.dayKey, `${city.name} day ${i} key`);
            assert.deepEqual(window[i].timings, single.timings, `${city.name} day ${i} timings`);
        }
    }
});

test('the scheduling window rolls over month ends, year ends and leap days', () => {
    const london = CITIES.find(c => c.name === 'London')!;
    const base = {
        lat: london.lat, lng: london.lng, methodKey: 'UK' as PrayerMethodKey,
        madhab: 'standard' as Madhab, timezone: london.tz,
    };
    const cases: [Date, string[]][] = [
        [new Date(Date.UTC(2026, 11, 29, 12)), ['2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02']],
        [new Date(Date.UTC(2024, 1, 27, 12)),  ['2024-02-27', '2024-02-28', '2024-02-29', '2024-03-01', '2024-03-02']],
        [new Date(Date.UTC(2026, 1, 26, 12)),  ['2026-02-26', '2026-02-27', '2026-02-28', '2026-03-01', '2026-03-02']],
        [new Date(Date.UTC(2026, 3, 29, 12)),  ['2026-04-29', '2026-04-30', '2026-05-01', '2026-05-02', '2026-05-03']],
    ];
    for (const [now, expected] of cases) {
        const days = computeUpcomingDays({ ...base, now }, 5);
        assert.deepEqual(days.map(d => d.dayKey), expected, `window from ${now.toISOString()}`);
    }
});

test('the window starts on the LOCATION\'s day, even from a distant device timezone', () => {
    const auckland = CITIES.find(c => c.name === 'Auckland')!;
    // 22:00 UTC on 30 Jul is still the 30th in London but already the 31st in NZ.
    const days = computeUpcomingDays({
        lat: auckland.lat, lng: auckland.lng, methodKey: 'MWL', madhab: 'standard',
        timezone: auckland.tz, now: new Date('2026-07-30T22:00:00Z'),
    }, 3);
    assert.deepEqual(days.map(d => d.dayKey), ['2026-07-31', '2026-08-01', '2026-08-02']);
});

test('a rolling window stays accurate where a fixed repeating alarm would not', () => {
    // Quantifies the bug being fixed. Maghrib moves ~2 min/day in August, so a
    // single alarm set on day 0 is badly wrong by the end of the window, while
    // every entry in the window is correct for its own day.
    const london = CITIES.find(c => c.name === 'London')!;
    const days = computeUpcomingDays({
        lat: london.lat, lng: london.lng, methodKey: 'UK', madhab: 'standard',
        timezone: london.tz, now: new Date(Date.UTC(2026, 7, 1, 12)),
    }, 10);

    const first = timeToMinutes(days[0].timings.Maghrib);
    const last = timeToMinutes(days[days.length - 1].timings.Maghrib);
    assert.ok(first - last >= 12,
        `expected a fixed alarm to be badly wrong after 10 days, drift was only ${first - last} min`);

    // And the window itself is monotonic - each day a little earlier than the last.
    for (let i = 1; i < days.length; i++) {
        const prev = timeToMinutes(days[i - 1].timings.Maghrib);
        const cur = timeToMinutes(days[i].timings.Maghrib);
        assert.ok(cur < prev, `day ${i} Maghrib ${days[i].timings.Maghrib} not earlier than previous`);
    }
});

test('the scheduling window fits inside iOS 64-notification cap', () => {
    // iOS keeps only the 64 soonest pending local notifications and silently
    // drops the rest, so raising PRAYER_SCHEDULE_DAYS without re-counting the
    // other schedulers would quietly lose prayer alerts at the far end.
    const IOS_PENDING_LIMIT = 64;
    const prayersPerDay = 5;
    const deadlineWarningsToday = 5;   // useNotifications, today only
    const reflectionReminder = 1;      // daily repeating
    const decayAlerts = 2;             // warn + critical

    const total = PRAYER_SCHEDULE_DAYS * prayersPerDay
        + deadlineWarningsToday + reflectionReminder + decayAlerts;

    assert.ok(total <= IOS_PENDING_LIMIT,
        `scheduling ${PRAYER_SCHEDULE_DAYS} days needs ${total} slots, over the ${IOS_PENDING_LIMIT} iOS allows`);
    // And it should be worth doing at all - a couple of days would defeat the point.
    assert.ok(PRAYER_SCHEDULE_DAYS >= 7,
        'the window should cover at least a week for a user who rarely opens the app');
});

// ─── 7. nextPrayerFrom ──────────────────────────────────────────────────────────

const SAMPLE: Timings = {
    Fajr: '03:12', Sunrise: '05:10', Dhuhr: '13:05',
    Asr: '17:20', Sunset: '20:56', Maghrib: '20:56', Isha: '22:35',
};

test('nextPrayerFrom advances through the day and wraps to Fajr', () => {
    const at = (hhmm: string) => {
        const [h, m] = hhmm.split(':').map(Number);
        return new Date(Date.UTC(2026, 6, 29, h, m));
    };
    const cases: [string, string][] = [
        ['00:30', 'Fajr'], ['03:11', 'Fajr'], ['03:13', 'Dhuhr'],
        ['13:04', 'Dhuhr'], ['13:06', 'Asr'], ['17:21', 'Maghrib'],
        ['20:57', 'Isha'], ['22:36', 'Fajr'], ['23:59', 'Fajr'],
    ];
    for (const [time, expected] of cases) {
        assert.equal(nextPrayerFrom(SAMPLE, at(time), 'UTC'), expected, `at ${time}`);
    }
});

test('nextPrayerFrom handles Isha after midnight (high-latitude summer)', () => {
    const wrapped: Timings = {
        Fajr: '01:40', Sunrise: '04:30', Dhuhr: '13:15',
        Asr: '18:00', Sunset: '22:20', Maghrib: '22:20', Isha: '00:30',
    };
    const at = (h: number, m: number) => new Date(Date.UTC(2026, 5, 21, h, m));
    assert.equal(nextPrayerFrom(wrapped, at(22, 30), 'UTC'), 'Isha',
        'after Maghrib, the next prayer is an Isha that falls after midnight');
    assert.equal(nextPrayerFrom(wrapped, at(1, 0), 'UTC'), 'Fajr');
});

test('nextPrayerFrom reads the clock at the prayer location, not the device', () => {
    // 08:00 UTC is 09:00 in London but 20:00 in Auckland: different next prayer.
    const instant = new Date('2026-07-29T08:00:00Z');
    assert.equal(tzMinutes(instant, 'Europe/London'), 9 * 60);
    assert.equal(tzMinutes(instant, 'Pacific/Auckland'), 20 * 60);
    assert.equal(nextPrayerFrom(SAMPLE, instant, 'Europe/London'), 'Dhuhr');
    assert.equal(nextPrayerFrom(SAMPLE, instant, 'Pacific/Auckland'), 'Maghrib');
});

// ─── 8. Golden references ───────────────────────────────────────────────────────
//
// Pinned outputs. These are not independent truth - they are a tripwire, so a
// future adhan upgrade or a refactor cannot silently move everyone's prayer times
// without a test turning red and forcing a deliberate re-verification.
//
// London 2026-07-30 Maghrib 20:55 was cross-checked against published sunset for
// that date, which is how the original stale-cache bug was diagnosed.

test('golden: pinned reference times must not drift silently', () => {
    const golden: { city: string; date: [number, number, number]; madhab: Madhab; expect: Partial<Timings> }[] = [
        { city: 'London',   date: [2026, 7, 30],  madhab: 'standard',
          expect: { Fajr: '03:33', Sunrise: '05:21', Dhuhr: '13:12', Asr: '17:17', Maghrib: '20:55', Isha: '22:01' } },
        { city: 'London',   date: [2026, 7, 18],  madhab: 'standard', expect: { Maghrib: '21:11' } },
        { city: 'London',   date: [2026, 12, 21], madhab: 'standard', expect: { Maghrib: '15:56', Fajr: '06:22' } },
        { city: 'Makkah',   date: [2026, 7, 30],  madhab: 'standard', expect: { Maghrib: '19:01', Fajr: '04:29' } },
        { city: 'New York', date: [2026, 7, 30],  madhab: 'standard', expect: { Maghrib: '20:13', Fajr: '04:21' } },
    ];
    for (const g of golden) {
        const city = CITIES.find(c => c.name === g.city)!;
        const [y, m, d] = g.date;
        const { timings } = computeFor(city, new Date(Date.UTC(y, m - 1, d, 12)), g.madhab);
        for (const [k, v] of Object.entries(g.expect)) {
            assert.equal(timings[k], v, `${g.city} ${y}-${m}-${d} ${k}`);
        }
    }
});

test('hanafi Asr is always later than standard Asr', () => {
    for (const city of CITIES.filter(c => !c.polar)) {
        for (const day of daysOfYear(2026)) {
            const std = computeFor(city, day, 'standard');
            const han = computeFor(city, day, 'hanafi');
            assert.ok(timeToMinutes(han.timings.Asr) >= timeToMinutes(std.timings.Asr),
                `${city.name} ${localDayKey(day, city.tz)}: hanafi Asr ${han.timings.Asr} ` +
                `earlier than standard ${std.timings.Asr}`);
            // Every other prayer is madhab-independent.
            for (const k of ['Fajr', 'Sunrise', 'Dhuhr', 'Maghrib', 'Isha']) {
                assert.equal(han.timings[k], std.timings[k],
                    `${city.name}: madhab must not affect ${k}`);
            }
        }
    }
});

test('country → method mapping covers the app\'s target markets', () => {
    assert.equal(getMethodKeyForCountry('gb'), 'UK');
    assert.equal(getMethodKeyForCountry('GB'), 'UK');
    assert.equal(getMethodKeyForCountry('US'), 'ISNA');
    assert.equal(getMethodKeyForCountry('SA'), 'UMM_AL_QURA');
    assert.equal(getMethodKeyForCountry('PK'), 'KARACHI');
    assert.equal(getMethodKeyForCountry('AE'), 'DUBAI');
    assert.equal(getMethodKeyForCountry('TR'), 'TURKEY');
    assert.equal(getMethodKeyForCountry('EG'), 'EGYPT');
    assert.equal(getMethodKeyForCountry('ZZ'), 'MWL', 'unknown country falls back to MWL');
});

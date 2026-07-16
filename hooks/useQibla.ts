import { useState, useEffect, useRef, useCallback } from 'react';
import * as Location from 'expo-location';

// expo-sensors is a native module used only as a fallback if the OS heading API is
// unavailable. On a dev build that predates this dependency, importing it throws at
// load time, so we require it lazily inside a guard and fall back gracefully.
let MagnetometerModule: any = null;
function getMagnetometer(): any | null {
  if (MagnetometerModule) return MagnetometerModule;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    MagnetometerModule = require('expo-sensors').Magnetometer;
    return MagnetometerModule;
  } catch {
    return null;
  }
}

// Kaaba coordinates (Makkah).
const KAABA = { lat: 21.4225, lng: 39.8262 };

// Alignment tolerance in degrees.
const ALIGN_TOLERANCE = 6;

// Low-pass smoothing factor for the heading (0..1). Higher = snappier but noisier,
// lower = smoother but laggier. 0.35 tracks the hand closely while still killing
// most sensor jitter; the UI adds a short animation on top for the final glide.
const SMOOTHING = 0.35;

// Only push a new heading to React when it moved at least this many degrees. Keeps
// the SVG dial from re-rendering on every one of the ~10-60 samples/sec, but small
// enough that motion stays continuous (the animated rose interpolates between them).
const MIN_RENDER_DELTA = 0.4;

export type QiblaStatus = 'loading' | 'ok' | 'no-location' | 'no-sensor';

export interface QiblaState {
  bearing: number | null; // great-circle bearing to Kaaba, 0..360
  heading: number;        // device heading (true north), 0..360
  aligned: boolean;       // device currently points within tolerance of Qibla
  status: QiblaStatus;
  coords: { lat: number; lng: number } | null;
  accuracy: number;       // heading accuracy in degrees (lower = better); -1 = unknown
}

const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

/**
 * Great-circle initial bearing from (lat,lng) to the Kaaba, in degrees clockwise
 * from true north (0..360). Pure and deterministic.
 */
export function qiblaBearing(lat: number, lng: number): number {
  if (!isFinite(lat) || !isFinite(lng)) return 0;
  const φ1 = toRad(lat);
  const φ2 = toRad(KAABA.lat);
  const Δλ = toRad(KAABA.lng - lng);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);
  return (toDeg(θ) + 360) % 360;
}

/** Smallest absolute angular difference between two bearings (0..180). */
export function angleDiff(a: number, b: number): number {
  const d = Math.abs(((a - b + 540) % 360) - 180);
  return d;
}

/**
 * Circular low-pass filter. Averaging bearings naively breaks across the 0°/360°
 * seam (e.g. 359° and 1° average to 180° instead of 0°), which makes the needle
 * spin. Interpolating along the shortest arc avoids that.
 */
function smoothHeading(prev: number, next: number, factor: number): number {
  let delta = ((next - prev + 540) % 360) - 180; // shortest signed delta, -180..180
  return (prev + delta * factor + 360) % 360;
}

interface UseQiblaArgs {
  manualCoords?: { lat: number; lng: number } | null;
  active?: boolean; // only subscribe to the compass while the view is shown
}

export function useQibla({ manualCoords, active = true }: UseQiblaArgs) {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    manualCoords ?? null,
  );
  const [bearing, setBearing] = useState<number | null>(
    manualCoords ? qiblaBearing(manualCoords.lat, manualCoords.lng) : null,
  );
  const [heading, setHeading] = useState(0);
  const [accuracy, setAccuracy] = useState(-1);
  const [status, setStatus] = useState<QiblaStatus>('loading');

  const headingSubRef = useRef<{ remove: () => void } | null>(null);
  const magSubRef = useRef<{ remove: () => void } | null>(null);
  // Smoothed heading kept in a ref so the filter is continuous across sensor samples
  // without forcing a re-render on every one.
  const smoothedRef = useRef<number | null>(null);
  const lastRenderedRef = useRef(0);

  // Push a raw sensor/OS heading through the smoother, and only re-render when it has
  // moved enough to be visible. This throttles React updates hard (the lag fix).
  const pushHeading = useCallback((raw: number, acc: number) => {
    if (!isFinite(raw)) return;
    const prev = smoothedRef.current;
    const next = prev == null ? raw : smoothHeading(prev, raw, SMOOTHING);
    smoothedRef.current = next;
    if (angleDiff(next, lastRenderedRef.current) >= MIN_RENDER_DELTA) {
      lastRenderedRef.current = next;
      setHeading(next);
    }
    if (acc >= 0) setAccuracy(acc);
  }, []);

  // Resolve coordinates: prefer manual city, else GPS (already permitted for prayers).
  useEffect(() => {
    let alive = true;
    (async () => {
      if (manualCoords) {
        setCoords(manualCoords);
        setBearing(qiblaBearing(manualCoords.lat, manualCoords.lng));
        return;
      }
      try {
        const { status: perm } = await Location.getForegroundPermissionsAsync();
        if (perm !== 'granted') {
          // Don't trigger a new prompt here; prayer-times flow owns that.
          if (alive) setStatus((s) => (s === 'loading' ? 'no-location' : s));
          return;
        }
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (!alive) return;
        const c = { lat: loc.coords.latitude, lng: loc.coords.longitude };
        setCoords(c);
        setBearing(qiblaBearing(c.lat, c.lng));
      } catch {
        if (alive) setStatus((s) => (s === 'loading' ? 'no-location' : s));
      }
    })();
    return () => {
      alive = false;
    };
  }, [manualCoords]);

  // Subscribe to the compass while active. Prefer the OS heading API (returns TRUE
  // north - already corrected for magnetic declination and device orientation, which
  // the raw magnetometer is not). Fall back to the raw magnetometer only if it fails.
  useEffect(() => {
    if (!active) return;
    let alive = true;
    // Reset the smoother so a stale value from a previous session doesn't leak in.
    smoothedRef.current = null;

    const startMagnetometerFallback = () => {
      try {
        const Magnetometer = getMagnetometer();
        if (!Magnetometer) {
          if (alive) setStatus((s) => (s === 'no-location' ? s : 'no-sensor'));
          return;
        }
        Magnetometer.isAvailableAsync().then((available: boolean) => {
          if (!alive) return;
          if (!available) {
            setStatus((s) => (s === 'no-location' ? s : 'no-sensor'));
            return;
          }
          Magnetometer.setUpdateInterval(50);
          magSubRef.current = Magnetometer.addListener(({ x, y }: { x: number; y: number }) => {
            // NOTE: raw magnetic heading (no declination correction) - only reached
            // when the OS heading API is unavailable.
            let angle = Math.atan2(y, x) * (180 / Math.PI);
            angle = (angle + 360) % 360;
            if (alive) pushHeading(angle, -1);
          });
          setStatus((s) => (s === 'no-location' ? s : 'ok'));
        }).catch(() => {
          if (alive) setStatus((s) => (s === 'no-location' ? s : 'no-sensor'));
        });
      } catch {
        if (alive) setStatus((s) => (s === 'no-location' ? s : 'no-sensor'));
      }
    };

    (async () => {
      try {
        // watchHeadingAsync gives { trueHeading, magHeading, accuracy }. trueHeading
        // is -1 when the OS can't compute it (no location fix yet); fall back to
        // magHeading in that case so the needle still moves.
        headingSubRef.current = await Location.watchHeadingAsync((h) => {
          if (!alive) return;
          const deg = h.trueHeading != null && h.trueHeading >= 0 ? h.trueHeading : h.magHeading;
          // iOS accuracy is degrees of error; Android reports an enum 0..3. Treat
          // anything non-negative as a usable accuracy hint.
          pushHeading(deg, typeof h.accuracy === 'number' ? h.accuracy : -1);
          setStatus((s) => (s === 'no-location' ? s : 'ok'));
        });
      } catch {
        // OS heading API unavailable on this device - fall back to the magnetometer.
        if (alive) startMagnetometerFallback();
      }
    })();

    return () => {
      alive = false;
      if (headingSubRef.current) {
        headingSubRef.current.remove();
        headingSubRef.current = null;
      }
      if (magSubRef.current) {
        magSubRef.current.remove();
        magSubRef.current = null;
      }
    };
  }, [active, pushHeading]);

  // Promote to 'ok' once we have a bearing (heading source is handled above).
  useEffect(() => {
    if (bearing != null) {
      setStatus((s) => (s === 'no-sensor' || s === 'no-location' ? s : 'ok'));
    }
  }, [bearing]);

  const aligned =
    bearing != null && angleDiff(heading, bearing) <= ALIGN_TOLERANCE;

  const stop = useCallback(() => {
    if (headingSubRef.current) {
      headingSubRef.current.remove();
      headingSubRef.current = null;
    }
    if (magSubRef.current) {
      magSubRef.current.remove();
      magSubRef.current = null;
    }
  }, []);

  const state: QiblaState = { bearing, heading, aligned, status, coords, accuracy };
  return { ...state, stop };
}

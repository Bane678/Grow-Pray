import { useState, useEffect, useRef, useCallback } from 'react';
import * as Location from 'expo-location';

// expo-sensors is a native module. On a dev build that predates this dependency,
// importing it throws at load time, so we require it lazily inside a guard and fall
// back to the 'no-sensor' state rather than crashing the screen.
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

export type QiblaStatus = 'loading' | 'ok' | 'no-location' | 'no-sensor';

export interface QiblaState {
  bearing: number | null; // great-circle bearing to Kaaba, 0..360
  heading: number;        // device heading from magnetometer, 0..360
  aligned: boolean;       // device currently points within tolerance of Qibla
  status: QiblaStatus;
  coords: { lat: number; lng: number } | null;
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

interface UseQiblaArgs {
  manualCoords?: { lat: number; lng: number } | null;
  active?: boolean; // only subscribe to the magnetometer while the view is shown
}

export function useQibla({ manualCoords, active = true }: UseQiblaArgs) {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    manualCoords ?? null,
  );
  const [bearing, setBearing] = useState<number | null>(
    manualCoords ? qiblaBearing(manualCoords.lat, manualCoords.lng) : null,
  );
  const [heading, setHeading] = useState(0);
  const [status, setStatus] = useState<QiblaStatus>('loading');
  const subRef = useRef<{ remove: () => void } | null>(null);

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

  // Subscribe to the magnetometer while active.
  useEffect(() => {
    if (!active) return;
    let alive = true;

    (async () => {
      try {
        const Magnetometer = getMagnetometer();
        if (!Magnetometer) {
          if (alive) setStatus((s) => (s === 'no-location' ? s : 'no-sensor'));
          return;
        }
        const available = await Magnetometer.isAvailableAsync();
        if (!available) {
          if (alive) setStatus((s) => (s === 'no-location' ? s : 'no-sensor'));
          return;
        }
        Magnetometer.setUpdateInterval(100);
        subRef.current = Magnetometer.addListener(({ x, y }: { x: number; y: number }) => {
          let angle = Math.atan2(y, x) * (180 / Math.PI);
          angle = (angle + 360) % 360;
          if (alive) setHeading(angle);
        });
        if (alive) setStatus((s) => (s === 'no-location' ? s : 'ok'));
      } catch {
        if (alive) setStatus((s) => (s === 'no-location' ? s : 'no-sensor'));
      }
    })();

    return () => {
      alive = false;
      if (subRef.current) {
        subRef.current.remove();
        subRef.current = null;
      }
    };
  }, [active]);

  // Promote to 'ok' once we have both a bearing and (implicitly) a heading source.
  useEffect(() => {
    if (bearing != null) {
      setStatus((s) => (s === 'no-sensor' || s === 'no-location' ? s : 'ok'));
    }
  }, [bearing]);

  const aligned =
    bearing != null && angleDiff(heading, bearing) <= ALIGN_TOLERANCE;

  const stop = useCallback(() => {
    if (subRef.current) {
      subRef.current.remove();
      subRef.current = null;
    }
  }, []);

  const state: QiblaState = { bearing, heading, aligned, status, coords };
  return { ...state, stop };
}

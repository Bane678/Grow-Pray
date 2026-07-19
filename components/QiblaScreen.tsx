import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Easing } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Circle, Line } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { FONTS } from '../theme/typography';
import { useQibla } from '../hooks/useQibla';

const ACCENT = '#e8a87c';
const DIAL = 280;

interface QiblaScreenProps {
  manualCoords?: { lat: number; lng: number } | null;
  active?: boolean;
  onClose: () => void;
}

const CARDINALS = [
  { label: 'N', angle: 0 },
  { label: 'E', angle: 90 },
  { label: 'S', angle: 180 },
  { label: 'W', angle: 270 },
];

// The dial's rings + tick marks never change, so render the SVG exactly once.
// (Previously it was rebuilt on every heading update - ~60x/sec - which is the
// main cause of the choppiness.) It rotates via the parent's native transform.
const DialFace = React.memo(function DialFace() {
  return (
    <Svg width={DIAL} height={DIAL}>
      <Circle cx={DIAL / 2} cy={DIAL / 2} r={DIAL / 2 - 6} stroke="rgba(255,255,255,0.12)" strokeWidth={2} fill="none" />
      <Circle cx={DIAL / 2} cy={DIAL / 2} r={DIAL / 2 - 30} stroke="rgba(255,255,255,0.06)" strokeWidth={1} fill="none" />
      {Array.from({ length: 12 }).map((_, i) => {
        const a = (i * 30 * Math.PI) / 180;
        const r1 = DIAL / 2 - 6;
        const r2 = DIAL / 2 - 16;
        const cx = DIAL / 2;
        const cy = DIAL / 2;
        return (
          <Line
            key={i}
            x1={cx + r1 * Math.sin(a)}
            y1={cy - r1 * Math.cos(a)}
            x2={cx + r2 * Math.sin(a)}
            y2={cy - r2 * Math.cos(a)}
            stroke="rgba(255,255,255,0.18)"
            strokeWidth={i % 3 === 0 ? 2 : 1}
          />
        );
      })}
    </Svg>
  );
});

// The big centre degrees readout updates every animation frame. Isolating it in
// its own memo leaf means only this tiny Text re-renders per frame - not the
// whole screen (dial, markers, cardinals) as before.
const HeadingReadout = React.memo(function HeadingReadout({
  rotation,
  aligned,
}: {
  rotation: Animated.Value;
  aligned: boolean;
}) {
  const [displayHeading, setDisplayHeading] = useState(0);
  useEffect(() => {
    const id = rotation.addListener(({ value }) => {
      const deg = ((Math.round(-value) % 360) + 360) % 360;
      setDisplayHeading((prev) => (prev === deg ? prev : deg));
    });
    return () => rotation.removeListener(id);
  }, [rotation]);
  return (
    <View style={styles.center} pointerEvents="none">
      <Text style={[styles.centerValue, aligned && styles.centerValueAligned]}>
        {`${displayHeading}°`}
      </Text>
      <Text style={[styles.centerLabel, aligned && styles.centerLabelAligned]}>
        {aligned ? 'On Qibla' : 'Heading'}
      </Text>
    </View>
  );
});

export const QiblaScreen = React.memo(function QiblaScreen({
  manualCoords,
  active = true,
  onClose,
}: QiblaScreenProps) {
  const { bearing, heading, aligned, status, accuracy } = useQibla({ manualCoords, active });
  const wasAligned = useRef(false);

  // Smoothly animate the rose to the latest heading rather than snapping. We track an
  // unwrapped (continuous) rotation so the dial always turns the short way and never
  // spins a full circle when the heading crosses the 0°/360° seam.
  const rotation = useRef(new Animated.Value(-heading)).current;
  const unwrappedRef = useRef(-heading);

  useEffect(() => {
    const target = -heading;
    // Move unwrappedRef by the shortest signed delta to the new target.
    let delta = ((target - unwrappedRef.current) % 360 + 540) % 360 - 180;
    unwrappedRef.current += delta;
    // LINEAR easing (not ease-out): sensor samples arrive every ~30ms and each
    // one restarts this animation. Ease-out decelerates toward a stop, so being
    // interrupted mid-decel reads as stutter. Linear keeps a constant velocity,
    // so back-to-back samples chain into one continuous glide (Apple-Compass feel).
    // Duration slightly exceeds the sample interval so motion never fully stops
    // between samples.
    Animated.timing(rotation, {
      toValue: unwrappedRef.current,
      duration: 120,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start();
  }, [heading, rotation]);

  const roseRotate = rotation.interpolate({
    inputRange: [-360, 360],
    outputRange: ['-360deg', '360deg'],
  });

  // iOS reports heading accuracy in degrees of error; Android reports 0..3 (3=high).
  // Flag poor accuracy so we can prompt the figure-8 calibration wiggle.
  const lowAccuracy =
    accuracy >= 0 && ((accuracy > 20 && accuracy <= 360) || accuracy === 1 || accuracy === 0);

  // Light haptic when the device first lines up with the Qibla.
  useEffect(() => {
    if (aligned && !wasAligned.current) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    wasAligned.current = aligned;
  }, [aligned]);

  const showCompass = status === 'ok' || (status === 'loading' && bearing != null);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Qibla</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <MaterialCommunityIcons name="close" size={24} color="#9ca3af" />
        </TouchableOpacity>
      </View>

      {status === 'no-location' && (
        <View style={styles.fallback}>
          <MaterialCommunityIcons name="map-marker-off" size={40} color={ACCENT} />
          <Text style={styles.fallbackTitle}>Location needed</Text>
          <Text style={styles.fallbackText}>
            Set your city in Settings or allow location so we can find the Qibla
            direction.
          </Text>
        </View>
      )}

      {status === 'no-sensor' && (
        <View style={styles.fallback}>
          <MaterialCommunityIcons name="compass-off" size={40} color={ACCENT} />
          <Text style={styles.fallbackTitle}>Compass unavailable</Text>
          <Text style={styles.fallbackText}>
            This device has no usable compass sensor.
          </Text>
          {bearing != null && (
            <Text style={styles.bearingBig}>{Math.round(bearing)}° from North</Text>
          )}
        </View>
      )}

      {showCompass && (
        <View style={styles.compassArea}>
          <Text style={[styles.alignHint, aligned && styles.alignHintActive]}>
            {aligned ? 'Facing the Qibla' : 'Turn until the marker reaches the top'}
          </Text>

          <View style={styles.dialWrap}>
            {/* Fixed top pointer = direction the device faces */}
            <View style={styles.topPointer}>
              <MaterialCommunityIcons
                name="triangle"
                size={18}
                color={aligned ? '#4ade80' : ACCENT}
              />
            </View>

            {/* Rotating rose - smoothly animated toward the latest heading */}
            <Animated.View style={[styles.rose, { transform: [{ rotate: roseRotate }] }]}>
              <DialFace />

              {/* Cardinal letters */}
              {CARDINALS.map((c) => (
                <View
                  key={c.label}
                  style={[styles.cardinalWrap, { transform: [{ rotate: `${c.angle}deg` }] }]}
                  pointerEvents="none"
                >
                  <Text style={[styles.cardinal, c.label === 'N' && styles.cardinalN]}>
                    {c.label}
                  </Text>
                </View>
              ))}

              {/* Kaaba marker at the Qibla bearing */}
              {bearing != null && (
                <View
                  style={[styles.markerWrap, { transform: [{ rotate: `${bearing}deg` }] }]}
                  pointerEvents="none"
                >
                  <View style={[styles.kaabaMarker, aligned && styles.kaabaMarkerActive]}>
                    <MaterialCommunityIcons name="cube" size={20} color={aligned ? '#1a1205' : '#e8e0d6'} />
                  </View>
                </View>
              )}
            </Animated.View>

            {/* Center readout - live heading, green when on the Qibla. Its own
                memo leaf so per-frame updates don't re-render the whole screen. */}
            <HeadingReadout rotation={rotation} aligned={aligned} />
          </View>

          <Text style={styles.headingText}>
            Qibla {bearing != null ? `${Math.round(bearing)}°` : '--'} from North
          </Text>

          {lowAccuracy && (
            <View style={styles.calibrateRow}>
              <MaterialCommunityIcons name="compass-outline" size={15} color={ACCENT} />
              <Text style={styles.calibrateText}>
                Low compass accuracy - wave your phone in a figure-8 to calibrate.
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 16 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingBottom: 8,
  },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#e8e0d6', fontFamily: FONTS.display },
  closeBtn: { padding: 4 },

  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 10 },
  fallbackTitle: { fontSize: 18, fontWeight: '800', color: '#e8e0d6', fontFamily: FONTS.display },
  fallbackText: { fontSize: 13, color: 'rgba(232,224,214,0.6)', textAlign: 'center', lineHeight: 19 },
  bearingBig: { fontSize: 22, fontWeight: '800', color: ACCENT, fontFamily: FONTS.display, marginTop: 10 },

  compassArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  alignHint: { fontSize: 13, color: 'rgba(232,224,214,0.5)', marginBottom: 24, fontWeight: '600' },
  alignHintActive: { color: '#4ade80', fontWeight: '800' },

  dialWrap: { width: DIAL, height: DIAL, alignItems: 'center', justifyContent: 'center' },
  topPointer: { position: 'absolute', top: -14, zIndex: 5 },
  rose: { width: DIAL, height: DIAL, alignItems: 'center', justifyContent: 'center', position: 'absolute' },

  cardinalWrap: { position: 'absolute', width: DIAL, height: DIAL, alignItems: 'center' },
  cardinal: { position: 'absolute', top: 16, fontSize: 15, fontWeight: '700', color: 'rgba(232,224,214,0.55)' },
  cardinalN: { color: ACCENT, fontWeight: '800' },

  markerWrap: { position: 'absolute', width: DIAL, height: DIAL, alignItems: 'center' },
  kaabaMarker: {
    position: 'absolute',
    top: 30,
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  kaabaMarkerActive: { backgroundColor: '#4ade80', borderColor: '#4ade80' },

  center: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  centerValue: { fontSize: 40, fontWeight: '800', color: '#e8e0d6', fontFamily: FONTS.display },
  centerValueAligned: { color: '#4ade80' },
  centerLabel: { fontSize: 12, color: 'rgba(232,224,214,0.45)', letterSpacing: 1, textTransform: 'uppercase' },
  centerLabelAligned: { color: '#4ade80', fontWeight: '800' },

  headingText: { fontSize: 13, color: 'rgba(232,224,214,0.5)', marginTop: 26, fontWeight: '600' },
  calibrateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 14,
    paddingHorizontal: 24,
  },
  calibrateText: {
    flex: 1,
    fontSize: 12,
    color: 'rgba(232,224,214,0.55)',
    lineHeight: 17,
  },
});

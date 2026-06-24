import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
  Easing,
} from 'react-native';
import { initialWindowMetrics } from 'react-native-safe-area-context';
import { FONTS } from '../theme/typography';
import { TutorialStep } from '../hooks/useTutorial';

const ACCENT = '#e8a87c';
const SEEDLING = require('../assets/Garden Assets/Icons/Icon_Seedling.png');

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface TutorialOverlayProps {
  visible: boolean;
  step: TutorialStep | null;
  rect: Rect | null;
  stepIndex: number;
  totalSteps: number;
  onNext: () => void;
  onSkip: () => void;
}

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const PAD = 8; // spotlight padding around the target
const SAFE_TOP = (initialWindowMetrics?.insets?.top ?? 44) + 12;
const SAFE_BOTTOM = (initialWindowMetrics?.insets?.bottom ?? 34) + 12;

export const TutorialOverlay = React.memo(function TutorialOverlay({
  visible,
  step,
  rect,
  stepIndex,
  totalSteps,
  onNext,
  onSkip,
}: TutorialOverlayProps) {
  const bob = useRef(new Animated.Value(0)).current;
  const [captionH, setCaptionH] = useState(230);

  useEffect(() => {
    if (!visible) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [visible, bob]);

  if (!visible || !step) return null;

  const isCenter = step.placement === 'center' || !rect;
  const isLast = stepIndex >= totalSteps - 1;

  // Spotlight rect (padded), clamped to screen.
  const spot = rect
    ? {
        x: Math.max(0, rect.x - PAD),
        y: Math.max(0, rect.y - PAD),
        width: Math.min(SCREEN_W, rect.width + PAD * 2),
        height: rect.height + PAD * 2,
      }
    : null;

  // Caption goes below the spotlight if the target is in the top half, else above.
  const bobStyle = { transform: [{ translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }] };

  const Caption = (
    <View style={styles.captionCard} onLayout={(e) => setCaptionH(e.nativeEvent.layout.height)}>
      <Animated.View style={[styles.guideWrap, bobStyle]}>
        <Image source={SEEDLING} style={styles.guide} resizeMode="contain" />
      </Animated.View>
      <Text style={styles.title}>{step.title}</Text>
      <Text style={styles.body}>{step.body}</Text>

      <View style={styles.dotsRow}>
        {Array.from({ length: totalSteps }).map((_, i) => (
          <View key={i} style={[styles.dot, i === stepIndex && styles.dotActive]} />
        ))}
      </View>

      <View style={styles.actions}>
        <TouchableOpacity onPress={onSkip} activeOpacity={0.7} style={styles.skipBtn}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onNext} activeOpacity={0.85} style={styles.nextBtn}>
          <Text style={styles.nextText}>{isLast ? 'Done' : 'Next'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 9999, elevation: 9999 }]} pointerEvents="box-none">
      {/* Dim layer(s) */}
      {isCenter || !spot ? (
        <View style={[StyleSheet.absoluteFill, styles.dim]} />
      ) : (
        <>
          {/* Top */}
          <View style={[styles.dim, { position: 'absolute', left: 0, top: 0, width: SCREEN_W, height: spot.y }]} />
          {/* Bottom */}
          <View style={[styles.dim, { position: 'absolute', left: 0, top: spot.y + spot.height, width: SCREEN_W, height: SCREEN_H - (spot.y + spot.height) }]} />
          {/* Left */}
          <View style={[styles.dim, { position: 'absolute', left: 0, top: spot.y, width: spot.x, height: spot.height }]} />
          {/* Right */}
          <View style={[styles.dim, { position: 'absolute', left: spot.x + spot.width, top: spot.y, width: SCREEN_W - (spot.x + spot.width), height: spot.height }]} />
          {/* Highlight ring */}
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: spot.x,
              top: spot.y,
              width: spot.width,
              height: spot.height,
              borderRadius: 16,
              borderWidth: 2,
              borderColor: ACCENT,
            }}
          />
        </>
      )}

      {/* Caption */}
      {isCenter ? (
        <View style={styles.centerWrap} pointerEvents="box-none">
          {Caption}
        </View>
      ) : (
        (() => {
          // Place the caption opposite the spotlight, clamped fully on-screen and
          // never under the bottom bar or above the status bar.
          const below = spot!.y + spot!.height < SCREEN_H * 0.5;
          let top = below
            ? spot!.y + spot!.height + 16
            : spot!.y - captionH - 16;
          const maxTop = SCREEN_H - SAFE_BOTTOM - captionH;
          const minTop = SAFE_TOP;
          top = Math.max(minTop, Math.min(maxTop, top));
          return (
            <View pointerEvents="box-none" style={{ position: 'absolute', left: 16, right: 16, top }}>
              {Caption}
            </View>
          );
        })()
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  dim: { backgroundColor: 'rgba(8,11,22,0.82)' },
  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },

  captionCard: {
    backgroundColor: '#141c2e',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(232,168,124,0.25)',
    alignItems: 'center',
  },
  guideWrap: { marginBottom: 8 },
  guide: { width: 44, height: 44 },
  title: { fontSize: 18, fontWeight: '800', color: '#e8e0d6', fontFamily: FONTS.display, textAlign: 'center', marginBottom: 6 },
  body: { fontSize: 14, color: 'rgba(232,224,214,0.75)', textAlign: 'center', lineHeight: 20 },

  dotsRow: { flexDirection: 'row', gap: 6, marginTop: 16, marginBottom: 16 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.18)' },
  dotActive: { backgroundColor: ACCENT, width: 18 },

  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' },
  skipBtn: { paddingVertical: 10, paddingHorizontal: 16 },
  skipText: { fontSize: 14, color: 'rgba(232,224,214,0.5)', fontWeight: '600' },
  nextBtn: { backgroundColor: ACCENT, paddingVertical: 11, paddingHorizontal: 28, borderRadius: 14 },
  nextText: { fontSize: 14, fontWeight: '800', color: '#1a1205' },
});

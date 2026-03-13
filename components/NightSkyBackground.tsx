import React, { useEffect, useRef, useMemo } from 'react';
import { View, Animated, Easing, Dimensions } from 'react-native';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// ── Colour palette ──────────────────────────────────────────────────────────
const SKY_TOP = '#060a14';        // near-black
const SKY_MID = '#0c1425';        // deep midnight
const SKY_BOTTOM = '#111d35';     // slightly lighter midnight blue

// ── Seeded pseudo-random so stars are stable across re-renders ──────────────
function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ── Star data (generated once) ──────────────────────────────────────────────
type Star = { x: number; y: number; size: number; opacity: number; glow: number };

function generateStars(): Star[] {
  const rand = seededRandom(42);
  const stars: Star[] = [];

  // Dim tiny stars (most of the field)
  for (let i = 0; i < 60; i++) {
    stars.push({
      x: rand() * SCREEN_W,
      y: rand() * SCREEN_H * 0.85,
      size: 1 + rand() * 1.2,
      opacity: 0.15 + rand() * 0.25,
      glow: 0,
    });
  }

  // Medium brighter stars
  for (let i = 0; i < 18; i++) {
    stars.push({
      x: rand() * SCREEN_W,
      y: rand() * SCREEN_H * 0.8,
      size: 1.8 + rand() * 1,
      opacity: 0.35 + rand() * 0.25,
      glow: 2 + rand() * 2,
    });
  }

  // A few glowing highlight stars
  for (let i = 0; i < 6; i++) {
    stars.push({
      x: rand() * SCREEN_W,
      y: 40 + rand() * SCREEN_H * 0.55,
      size: 2.2 + rand() * 1.2,
      opacity: 0.5 + rand() * 0.3,
      glow: 4 + rand() * 4,
    });
  }

  return stars;
}

// ── Individual twinkling star ───────────────────────────────────────────────
const TwinklingStar = React.memo(function TwinklingStar({ star, delay }: { star: Star; delay: number }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const duration = 3000 + delay * 800;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: duration * 0.5, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: duration * 0.5, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    // Stagger each star's start
    const timer = setTimeout(() => loop.start(), delay * 400);
    return () => { clearTimeout(timer); loop.stop(); };
  }, []);

  const opacity = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [star.opacity * 0.5, star.opacity],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: star.x - star.size / 2,
        top: star.y - star.size / 2,
        width: star.size,
        height: star.size,
        borderRadius: star.size / 2,
        backgroundColor: '#fffbe6',
        opacity,
        ...(star.glow > 0 && {
          shadowColor: '#ffefc2',
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: star.opacity,
          shadowRadius: star.glow,
          elevation: 0,
        }),
      }}
    />
  );
});

// ── Main component ──────────────────────────────────────────────────────────
export function NightSkyBackground() {
  const stars = useMemo(generateStars, []);

  // Slow drift animation for the nebula clouds
  const nebulaDrift = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(nebulaDrift, { toValue: 1, duration: 30000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(nebulaDrift, { toValue: 0, duration: 30000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    ).start();
  }, []);

  const nebulaTranslateX = nebulaDrift.interpolate({ inputRange: [0, 1], outputRange: [-8, 8] });
  const nebulaTranslateY = nebulaDrift.interpolate({ inputRange: [0, 1], outputRange: [4, -4] });

  // Crescent moon gentle pulse
  const moonGlow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(moonGlow, { toValue: 1, duration: 4000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(moonGlow, { toValue: 0, duration: 4000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    ).start();
  }, []);

  const moonOpacity = moonGlow.interpolate({ inputRange: [0, 1], outputRange: [0.12, 0.22] });
  const moonInnerOpacity = moonGlow.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0.95] });

  return (
    <View pointerEvents="none" style={{
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    }}>
      {/* ── Gradient sky (3-band) ── */}
      <View style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: SCREEN_H * 0.35,
        backgroundColor: SKY_TOP,
      }} />
      <View style={{
        position: 'absolute', top: SCREEN_H * 0.25, left: 0, right: 0, height: SCREEN_H * 0.35,
        backgroundColor: SKY_MID, opacity: 0.85,
      }} />
      <View style={{
        position: 'absolute', top: SCREEN_H * 0.5, left: 0, right: 0, bottom: 0,
        backgroundColor: SKY_BOTTOM, opacity: 0.6,
      }} />

      {/* ── Nebula / cosmic dust clouds ── */}
      <Animated.View pointerEvents="none" style={{
        position: 'absolute',
        top: SCREEN_H * 0.08,
        left: SCREEN_W * 0.15,
        width: SCREEN_W * 0.55,
        height: SCREEN_H * 0.18,
        borderRadius: SCREEN_W * 0.3,
        backgroundColor: 'rgba(100, 80, 160, 0.04)',
        transform: [{ translateX: nebulaTranslateX }, { translateY: nebulaTranslateY }],
      }} />
      <Animated.View pointerEvents="none" style={{
        position: 'absolute',
        top: SCREEN_H * 0.35,
        right: SCREEN_W * 0.05,
        width: SCREEN_W * 0.45,
        height: SCREEN_H * 0.14,
        borderRadius: SCREEN_W * 0.25,
        backgroundColor: 'rgba(70, 90, 150, 0.035)',
        transform: [
          { translateX: Animated.multiply(nebulaTranslateX, -1) },
          { translateY: Animated.multiply(nebulaTranslateY, -0.7) },
        ],
      }} />
      <Animated.View pointerEvents="none" style={{
        position: 'absolute',
        top: SCREEN_H * 0.55,
        left: SCREEN_W * 0.02,
        width: SCREEN_W * 0.5,
        height: SCREEN_H * 0.12,
        borderRadius: SCREEN_W * 0.25,
        backgroundColor: 'rgba(60, 70, 130, 0.03)',
        transform: [
          { translateX: Animated.multiply(nebulaTranslateX, 0.6) },
          { translateY: nebulaTranslateY },
        ],
      }} />

      {/* ── Crescent moon ── */}
      <View style={{
        position: 'absolute',
        top: 52,
        right: 36,
        width: 28,
        height: 28,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {/* Warm glow behind moon */}
        <Animated.View style={{
          position: 'absolute',
          width: 52,
          height: 52,
          borderRadius: 26,
          backgroundColor: '#fbbf24',
          opacity: moonOpacity,
        }} />
        {/* Moon body: full circle */}
        <Animated.View style={{
          width: 20,
          height: 20,
          borderRadius: 10,
          backgroundColor: '#fde68a',
          opacity: moonInnerOpacity,
        }} />
        {/* Shadow circle to create crescent shape */}
        <View style={{
          position: 'absolute',
          width: 16,
          height: 20,
          borderRadius: 10,
          backgroundColor: SKY_TOP,
          left: 11,
          top: 4,
        }} />
      </View>

      {/* ── Golden glow behind header area ── */}
      <View style={{
        position: 'absolute',
        top: -20,
        left: SCREEN_W * 0.15,
        right: SCREEN_W * 0.15,
        height: 160,
        borderRadius: 80,
        backgroundColor: 'rgba(251, 191, 36, 0.025)',
      }} />
      <View style={{
        position: 'absolute',
        top: 10,
        left: SCREEN_W * 0.25,
        right: SCREEN_W * 0.25,
        height: 100,
        borderRadius: 50,
        backgroundColor: 'rgba(251, 191, 36, 0.03)',
      }} />

      {/* ── Star field ── */}
      {stars.map((star, i) => (
        <TwinklingStar key={i} star={star} delay={i % 12} />
      ))}
    </View>
  );
}

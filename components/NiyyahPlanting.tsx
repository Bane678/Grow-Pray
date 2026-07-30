import React, { useCallback, useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet, Pressable, Easing } from 'react-native';
import Svg, { Circle, Ellipse, Path, Defs, RadialGradient, Stop } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { FONTS } from '../theme/typography';

const TILE_RECOVERED = require('../assets/Garden Assets/Ground Tiles/Recovered_Tile.png');

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// ─── Layout ──────────────────────────────────────────────────────────────────
// Laid out top-to-bottom: the intention tag, a thread down to the seed, and the
// earth below. Everything above the earth descends into it together.
const STAGE_W = 264;
const STAGE_H = 312;
const TILE_CY = 224;          // centre of the tile within the stage
const RING_R = 96;
const RING_C = 2 * Math.PI * RING_R;
const TILE_W = 148;
const TILE_H = 74;
const SEED_SIZE = 26;
const SEED_REST_CY = 128;     // seed centre at rest
const SEED_TRAVEL = TILE_CY - SEED_REST_CY - 6;
const THREAD_TOP = 74;        // where the thread leaves the tag
const GLOW_SIZE = 208;
const BLOOM_SIZE = 108;

const HOLD_MS = 1400;

// ─── The seed ────────────────────────────────────────────────────────────────
// Drawn procedurally so it costs no art asset. To swap in a real sprite later,
// replace this component's body with an <Image source={require(...)} /> at the
// same size - nothing else needs to change.
function Seed({ size = SEED_SIZE }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Ellipse cx="12" cy="13" rx="7" ry="9" fill="#6b4423" />
      <Ellipse cx="10" cy="11" rx="4.2" ry="6" fill="#8a5a2f" />
      <Ellipse cx="9.2" cy="9.6" rx="1.6" ry="2.4" fill="#a97544" opacity={0.9} />
      <Path d="M12 4.2 Q13.2 2.4 14.6 2.2" stroke="#4e3018" strokeWidth="1.4" fill="none" strokeLinecap="round" />
    </Svg>
  );
}

// ─── Soft radial glow ────────────────────────────────────────────────────────
// A View with borderRadius + a solid colour renders as a flat disc with a hard
// edge. A radial gradient falling off to fully transparent reads as light.
function RadialGlow({ size, color, intensity, id }: {
  size: number; color: string; intensity: number; id: string;
}) {
  return (
    <Svg width={size} height={size} pointerEvents="none">
      <Defs>
        <RadialGradient id={id} cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor={color} stopOpacity={intensity} />
          <Stop offset="40%" stopColor={color} stopOpacity={intensity * 0.5} />
          <Stop offset="70%" stopColor={color} stopOpacity={intensity * 0.16} />
          <Stop offset="100%" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${id})`} />
    </Svg>
  );
}

const PARTICLES = [
  { dx: -34, dy: -16, size: 4.5 },
  { dx: -18, dy: -26, size: 3.5 },
  { dx: 4,   dy: -30, size: 5 },
  { dx: 24,  dy: -24, size: 3.5 },
  { dx: 38,  dy: -12, size: 4 },
  { dx: -28, dy: -4,  size: 3 },
  { dx: 30,  dy: -2,  size: 3 },
];

interface NiyyahPlantingProps {
  planted: boolean;
  onPlanted: () => void;
  /** The user's chosen intention - carried by the seed and buried with it. */
  intention: string;
}

/**
 * The niyyah planting ceremony.
 *
 * The user's intention hangs on a tag, threaded down to a seed above the earth.
 * Holding the earth draws a gold ring while the tag, thread and seed descend
 * together - so the intention is visibly what goes into the ground, not a
 * caption sitting nearby. On completion the seed sinks, dirt bursts, the soil
 * settles, and light blooms where it went in.
 *
 * Plants a SEED, never a sapling: the sapling is the payoff for the user's
 * first real prayer on the next screen.
 */
export function NiyyahPlanting({ planted, onPlanted, intention }: NiyyahPlantingProps) {
  // Hold progress is split across two values animated in parallel: the ring is
  // an SVG prop (JS driver only), while the transforms run natively. Composing
  // one value across both drivers moves the node graph to native and throws.
  const holdRing = useRef(new Animated.Value(0)).current;  // JS - SVG only
  const holdSeed = useRef(new Animated.Value(0)).current;  // native - transforms
  const bob = useRef(new Animated.Value(0)).current;
  const burst = useRef(new Animated.Value(0)).current;
  const settle = useRef(new Animated.Value(0)).current;
  const sparkle = useRef(new Animated.Value(0)).current;
  const seedGone = useRef(new Animated.Value(0)).current;

  const holdAnim = useRef<Animated.CompositeAnimation | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const midHaptic = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bobLoop = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (planted) { bobLoop.current?.stop(); return; }
    bobLoop.current = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    bobLoop.current.start();
    return () => bobLoop.current?.stop();
  }, [planted]);

  useEffect(() => {
    if (planted) return;
    holdRing.setValue(0);
    holdSeed.setValue(0);
    burst.setValue(0);
    settle.setValue(0);
    sparkle.setValue(0);
    seedGone.setValue(0);
  }, [planted]);

  const clearTimers = useCallback(() => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    if (midHaptic.current) { clearTimeout(midHaptic.current); midHaptic.current = null; }
  }, []);

  useEffect(() => () => { clearTimers(); holdAnim.current?.stop(); bobLoop.current?.stop(); }, []);

  const finish = useCallback(() => {
    bobLoop.current?.stop();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Animated.sequence([
      Animated.timing(seedGone, { toValue: 1, duration: 180, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(burst, { toValue: 1, duration: 520, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.sequence([
          Animated.timing(settle, { toValue: 1, duration: 140, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.spring(settle, { toValue: 0, friction: 4, tension: 90, useNativeDriver: true }),
        ]),
      ]),
      Animated.timing(sparkle, { toValue: 1, duration: 420, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
    onPlanted();
  }, [onPlanted]);

  const start = () => {
    if (planted) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    holdAnim.current = Animated.parallel([
      Animated.timing(holdRing, { toValue: 1, duration: HOLD_MS, easing: Easing.linear, useNativeDriver: false }),
      Animated.timing(holdSeed, { toValue: 1, duration: HOLD_MS, easing: Easing.linear, useNativeDriver: true }),
    ]);
    holdAnim.current.start();
    midHaptic.current = setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium), HOLD_MS * 0.55);
    timer.current = setTimeout(finish, HOLD_MS);
  };

  const cancel = () => {
    if (planted) return;
    clearTimers();
    holdAnim.current?.stop();
    Animated.parallel([
      Animated.timing(holdRing, { toValue: 0, duration: 260, easing: Easing.out(Easing.quad), useNativeDriver: false }),
      Animated.timing(holdSeed, { toValue: 0, duration: 260, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
  };

  // Everything above the earth shares one descent, so the tag, the thread and
  // the seed read as a single object going into the ground.
  const descend = Animated.add(
    bob.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }),
    holdSeed.interpolate({ inputRange: [0, 1], outputRange: [0, SEED_TRAVEL] }),
  );
  const seedTranslate = Animated.add(
    descend,
    seedGone.interpolate({ inputRange: [0, 1], outputRange: [0, 14] }),
  );
  // The tag fades out as it nears the soil - the words go in with the seed.
  const carrierFade = Animated.multiply(
    holdSeed.interpolate({ inputRange: [0, 0.55, 1], outputRange: [1, 0.85, 0] }),
    seedGone.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
  );

  return (
    <Pressable onPressIn={start} onPressOut={cancel} disabled={planted}>
      <View style={styles.stage}>
        {/* Warm light pooling on the earth */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.glowWrap,
            {
              opacity: planted
                ? sparkle.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] })
                : holdSeed.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.85] }),
              transform: [{
                scale: planted
                  ? sparkle.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] })
                  : holdSeed.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.06] }),
              }],
            },
          ]}
        >
          <RadialGlow size={GLOW_SIZE} color="#d9a75f" intensity={0.5} id="niyyahGlow" />
        </Animated.View>

        {/* Progress ring around the earth */}
        <Svg width={STAGE_W} height={STAGE_H} style={StyleSheet.absoluteFill} pointerEvents="none">
          <Circle cx={STAGE_W / 2} cy={TILE_CY} r={RING_R} stroke="rgba(217,167,95,0.16)" strokeWidth={3} fill="none" />
          <AnimatedCircle
            cx={STAGE_W / 2}
            cy={TILE_CY}
            r={RING_R}
            stroke="#d9a75f"
            strokeWidth={3}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${RING_C} ${RING_C}`}
            strokeDashoffset={holdRing.interpolate({ inputRange: [0, 1], outputRange: [RING_C, 0] })}
            transform={`rotate(-90 ${STAGE_W / 2} ${TILE_CY})`}
          />
        </Svg>

        {/* The earth */}
        <Animated.Image
          source={TILE_RECOVERED}
          resizeMode="contain"
          style={[
            styles.tile,
            {
              transform: [
                { scaleX: settle.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] }) },
                { scaleY: settle.interpolate({ inputRange: [0, 1], outputRange: [1, 0.93] }) },
              ],
            },
          ]}
        />

        {/* Dirt kicked up on landing */}
        {PARTICLES.map((p, i) => (
          <Animated.View
            key={i}
            pointerEvents="none"
            style={[
              styles.particle,
              {
                width: p.size,
                height: p.size,
                borderRadius: p.size,
                opacity: burst.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.9, 0] }),
                transform: [
                  { translateX: burst.interpolate({ inputRange: [0, 1], outputRange: [0, p.dx] }) },
                  { translateY: burst.interpolate({ inputRange: [0, 0.45, 1], outputRange: [0, p.dy, p.dy + 22] }) },
                ],
              },
            ]}
          />
        ))}

        {/* The intention, hanging on a tag and threaded down to the seed.
            This is the whole point: the words ARE the seed. */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.tagWrap,
            { opacity: carrierFade, transform: [{ translateY: descend }] },
          ]}
        >
          <View style={styles.tag}>
            <Text style={styles.tagText}>{intention}</Text>
          </View>
        </Animated.View>

        {/* Thread from the tag down to the seed */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.thread,
            { opacity: carrierFade, transform: [{ translateY: descend }] },
          ]}
        />

        {/* The seed */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.seed,
            {
              opacity: seedGone.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 0.6, 0] }),
              transform: [
                { translateY: seedTranslate },
                { scale: seedGone.interpolate({ inputRange: [0, 1], outputRange: [1, 0.5] }) },
                { rotate: holdSeed.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '22deg'] }) },
              ],
            },
          ]}
        >
          <Seed />
        </Animated.View>

        {/* Bloom where the seed went in */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.bloomWrap,
            {
              opacity: sparkle.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 0.85, 0.45] }),
              transform: [{ scale: sparkle.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }) }],
            },
          ]}
        >
          <RadialGlow size={BLOOM_SIZE} color="#f8deb2" intensity={0.62} id="niyyahBloom" />
        </Animated.View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stage: { width: STAGE_W, height: STAGE_H, alignItems: 'center' },

  glowWrap: {
    position: 'absolute',
    width: GLOW_SIZE,
    height: GLOW_SIZE,
    top: TILE_CY + 10 - GLOW_SIZE / 2,
  },
  tile: { position: 'absolute', width: TILE_W, height: TILE_H, top: TILE_CY - TILE_H / 2 },
  particle: { position: 'absolute', backgroundColor: '#7a5230', top: TILE_CY - 8 },

  tagWrap: { position: 'absolute', top: 8, alignItems: 'center', paddingHorizontal: 6 },
  tag: {
    maxWidth: STAGE_W - 24,
    backgroundColor: 'rgba(217,167,95,0.13)',
    borderColor: 'rgba(217,167,95,0.5)',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  tagText: {
    color: '#f4e9d8',
    fontSize: 14.5,
    lineHeight: 20,
    fontWeight: '700',
    textAlign: 'center',
    fontFamily: FONTS.displayMedium,
  },
  thread: {
    position: 'absolute',
    top: THREAD_TOP,
    width: 1,
    height: SEED_REST_CY - THREAD_TOP - SEED_SIZE / 2 - 2,
    backgroundColor: 'rgba(217,167,95,0.45)',
  },

  seed: { position: 'absolute', top: SEED_REST_CY - SEED_SIZE / 2 },

  bloomWrap: {
    position: 'absolute',
    width: BLOOM_SIZE,
    height: BLOOM_SIZE,
    top: TILE_CY - BLOOM_SIZE / 2,
  },
});

import React, { useCallback, useEffect, useRef } from 'react';
import { View, Image, Animated, StyleSheet, Pressable, Easing } from 'react-native';
import Svg, { Circle, Ellipse, Path, Defs, RadialGradient, Stop } from 'react-native-svg';
import * as Haptics from 'expo-haptics';

const TILE_RECOVERED = require('../assets/Garden Assets/Ground Tiles/Recovered_Tile.png');

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// ─── Tuning ──────────────────────────────────────────────────────────────────
const HOLD_MS = 1400;        // how long the user must hold to plant
const STAGE = 230;           // overall square canvas
const RING_R = 104;
const RING_C = 2 * Math.PI * RING_R;
const TILE_W = 148;
const TILE_H = 74;
const SEED_SIZE = 26;
// Glows are drawn wider than what they light, so the falloff has room to fade
// out completely instead of stopping abruptly at the edge.
const GLOW_SIZE = 208;
const BLOOM_SIZE = 108;
// How far the seed travels from its floating rest position into the soil.
const SEED_TRAVEL = 74;

// ─── The seed ────────────────────────────────────────────────────────────────
// Drawn procedurally so it costs no art asset. To swap in a real sprite later,
// replace the body of this component with an <Image source={require(...)} />
// at the same size - nothing else needs to change.
function Seed({ size = SEED_SIZE }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {/* Body */}
      <Ellipse cx="12" cy="13" rx="7" ry="9" fill="#6b4423" />
      {/* Lit edge */}
      <Ellipse cx="10" cy="11" rx="4.2" ry="6" fill="#8a5a2f" />
      {/* Highlight */}
      <Ellipse cx="9.2" cy="9.6" rx="1.6" ry="2.4" fill="#a97544" opacity={0.9} />
      {/* Shoot scar at the tip */}
      <Path d="M12 4.2 Q13.2 2.4 14.6 2.2" stroke="#4e3018" strokeWidth="1.4" fill="none" strokeLinecap="round" />
    </Svg>
  );
}

// ─── Soft radial glow ────────────────────────────────────────────────────────
// A plain View with borderRadius + a solid backgroundColor renders as a flat
// disc with a hard edge, which reads as a coloured circle rather than light.
// A real radial gradient falling off to fully transparent is what actually
// looks like a glow.
function RadialGlow({
  size,
  color,
  intensity,
  id,
}: {
  size: number;
  color: string;
  intensity: number;
  id: string;
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

// Dirt specks that burst outward as the seed lands.
const PARTICLES = [
  { dx: -34, dy: -16, size: 4.5, delay: 0 },
  { dx: -18, dy: -26, size: 3.5, delay: 30 },
  { dx: 4,   dy: -30, size: 5,   delay: 10 },
  { dx: 24,  dy: -24, size: 3.5, delay: 45 },
  { dx: 38,  dy: -12, size: 4,   delay: 20 },
  { dx: -28, dy: -4,  size: 3,   delay: 60 },
  { dx: 30,  dy: -2,  size: 3,   delay: 55 },
];

interface NiyyahPlantingProps {
  planted: boolean;
  onPlanted: () => void;
}

/**
 * The niyyah planting ceremony: a seed floats above a garden tile, and the user
 * presses and holds the earth to plant it. During the hold a gold ring draws
 * around the tile while the seed descends; on completion the seed sinks in,
 * dirt bursts outward, the soil settles, and a sparkle blooms.
 *
 * Deliberately plants a SEED, not a sapling - the sapling is the payoff for the
 * user's first real prayer on the next screen.
 */
export function NiyyahPlanting({ planted, onPlanted }: NiyyahPlantingProps) {
  // Hold progress 0..1, split across TWO values that animate in parallel.
  //
  // They can't be one value: the ring is an SVG prop (strokeDashoffset), which
  // react-native-svg can only animate on the JS driver, while the seed's
  // transform and the glow run on the native driver alongside bob/seedGone.
  // Composing a JS-driven node into a native-driven transform moves the whole
  // graph to native and then throws on the next JS animation.
  const holdRing = useRef(new Animated.Value(0)).current;  // JS driver - SVG only
  const holdSeed = useRef(new Animated.Value(0)).current;  // native driver - transforms/opacity
  // Idle float, runs until the seed is planted.
  const bob = useRef(new Animated.Value(0)).current;
  // Post-plant beats.
  const burst = useRef(new Animated.Value(0)).current;
  const settle = useRef(new Animated.Value(0)).current;
  const sparkle = useRef(new Animated.Value(0)).current;
  const seedGone = useRef(new Animated.Value(0)).current; // 1 = fully buried

  const holdAnim = useRef<Animated.CompositeAnimation | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const midHaptic = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bobLoop = useRef<Animated.CompositeAnimation | null>(null);

  // Idle bobbing while the seed is still in the air.
  useEffect(() => {
    if (planted) { bobLoop.current?.stop(); return; }
    bobLoop.current = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    bobLoop.current.start();
    return () => bobLoop.current?.stop();
  }, [planted]);

  // Reset everything if the user navigates back and re-plants.
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
    // Seed sinks the last of the way and vanishes into the soil, dirt bursts,
    // the ground settles, then the sparkle blooms.
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
      Animated.timing(holdRing, {
        toValue: 1, duration: HOLD_MS, easing: Easing.linear, useNativeDriver: false,
      }),
      Animated.timing(holdSeed, {
        toValue: 1, duration: HOLD_MS, easing: Easing.linear, useNativeDriver: true,
      }),
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

  // Seed: floats, then descends as the hold progresses, then buries.
  // Every value composed here is native-driven (bob, holdSeed, seedGone).
  const seedTranslate = Animated.add(
    bob.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }),
    Animated.add(
      holdSeed.interpolate({ inputRange: [0, 1], outputRange: [0, SEED_TRAVEL] }),
      seedGone.interpolate({ inputRange: [0, 1], outputRange: [0, 14] }),
    ),
  );
  const seedScale = seedGone.interpolate({ inputRange: [0, 1], outputRange: [1, 0.5] });
  const seedOpacity = seedGone.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 0.6, 0] });
  const seedTilt = holdSeed.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '22deg'] });

  return (
    <Pressable onPressIn={start} onPressOut={cancel} disabled={planted}>
      <View style={styles.stage}>
        {/* Warm light pooling on the earth, brightening as the hold progresses
            and blooming once the seed is in. Soft radial falloff, no hard edge. */}
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
        <Svg width={STAGE} height={STAGE} style={StyleSheet.absoluteFill} pointerEvents="none">
          <Circle cx={STAGE / 2} cy={STAGE / 2} r={RING_R} stroke="rgba(217,167,95,0.16)" strokeWidth={3} fill="none" />
          <AnimatedCircle
            cx={STAGE / 2}
            cy={STAGE / 2}
            r={RING_R}
            stroke="#d9a75f"
            strokeWidth={3}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${RING_C} ${RING_C}`}
            strokeDashoffset={holdRing.interpolate({ inputRange: [0, 1], outputRange: [RING_C, 0] })}
            transform={`rotate(-90 ${STAGE / 2} ${STAGE / 2})`}
          />
        </Svg>

        {/* The earth. Squashes briefly as the seed lands. */}
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

        {/* Dirt specks kicked up on landing */}
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

        {/* The seed itself */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.seed,
            {
              opacity: seedOpacity,
              transform: [
                { translateY: seedTranslate },
                { scale: seedScale },
                { rotate: seedTilt },
              ],
            },
          ]}
        >
          <Seed />
        </Animated.View>

        {/* Bloom of light rising from where the seed went in */}
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
  stage: { width: STAGE, height: STAGE, alignItems: 'center', justifyContent: 'center' },
  glowWrap: {
    position: 'absolute',
    width: GLOW_SIZE,
    height: GLOW_SIZE,
    // Centred on the tile's surface rather than the canvas, so the light pools
    // on the earth instead of floating above it.
    top: STAGE / 2 + 24 - GLOW_SIZE / 2,
  },
  tile: { position: 'absolute', width: TILE_W, height: TILE_H, top: STAGE / 2 - 12 },
  seed: { position: 'absolute', top: STAGE / 2 - 78 },
  particle: { position: 'absolute', backgroundColor: '#7a5230', top: STAGE / 2 - 4 },
  bloomWrap: {
    position: 'absolute',
    width: BLOOM_SIZE,
    height: BLOOM_SIZE,
    // Sits over the point the seed entered the soil.
    top: STAGE / 2 + 14 - BLOOM_SIZE / 2,
  },
});

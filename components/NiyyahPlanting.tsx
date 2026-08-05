import React, { useCallback, useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Pressable, Easing } from 'react-native';
import Svg, { Circle, Ellipse, Path, Defs, RadialGradient, Stop } from 'react-native-svg';
import * as Haptics from 'expo-haptics';

const TILE_RECOVERED = require('../assets/Garden Assets/Ground Tiles/Recovered_Tile.png');
const SAPLING = require('../assets/Garden Assets/Tree Types/Basic Trees/Sapling_converted.png');

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// ─── Layout ──────────────────────────────────────────────────────────────────
// The ring frames the whole ceremony: the seed floats inside it, above the
// earth at its centre. Keeping everything within the ring means that once the
// seed is buried the remaining space reads as a framed scene rather than an
// empty gap - so nothing has to collapse afterwards.
const STAGE_W = 264;
const TILE_CY = 112;          // centre of the tile (and of the ring) within the stage
const RING_R = 92;
const RING_STROKE = 3;
const RING_C = 2 * Math.PI * RING_R;
// Derived, never hand-tuned: the stage must be tall enough to contain the
// ring's lowest point plus its stroke, or the ring clips at the bottom.
const STAGE_H = TILE_CY + RING_R + RING_STROKE + 8;
const TILE_W = 148;
const TILE_H = 74;
export const SEED_SIZE = 26;
const SEED_REST_CY = 44;      // seed centre at rest - inside the ring, above the earth
const SEED_TRAVEL = TILE_CY - SEED_REST_CY - 8;
const GLOW_SIZE = 208;
const BLOOM_SIZE = 108;

const HOLD_MS = 1400;

// ─── The sapling that rises after burial ─────────────────────────────────────
// Sized and anchored from the live garden's proportions (GardenScene) so the
// first thing the user ever sees growing is the same shape, at the same relative
// size, as the tree that will actually appear in their garden.
const G_TILE_W = 1456 * 0.08;        // GardenScene tile width
const G_TREE_W = 848 * 0.10;         // sapling stage width
const G_TREE_H = 1264 * 0.10 * 0.7;  // sapling stage height, incl. TREE_SQUASH
const SAPLING_W = TILE_W * (G_TREE_W / G_TILE_W);
const SAPLING_H = TILE_W * (G_TREE_H / G_TILE_W);
// GardenScene anchors trees 75% of their height above the tile centre; the
// remaining 25% is the sprite's transparent footer, which is why the visible
// trunk base lands on the soil.
const SAPLING_ANCHOR = 0.75;
const SAPLING_TOP = TILE_CY - SAPLING_H * SAPLING_ANCHOR;

// Beat timings. The sapling starts while the bloom is still opening so the
// light and the growth read as one event rather than two queued animations.
const BURY_MS = 180;
const BURST_MS = 520;
const BLOOM_MS = 420;
const SPROUT_DELAY_MS = 120;

// ─── The seed ────────────────────────────────────────────────────────────────
// Drawn procedurally so it costs no art asset. To swap in a real sprite later,
// replace this component's body with an <Image source={require(...)} /> at the
// same size - nothing else needs to change.
export function Seed({ size = SEED_SIZE }: { size?: number }) {
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
}

/**
 * The niyyah planting ceremony.
 *
 * A seed floats inside a gold ring, above the earth. Holding the earth draws
 * the ring closed while the seed descends; on completion it sinks, dirt bursts,
 * the soil settles and light blooms where it went in.
 *
 * The intention itself is stated in the text above this component, marked with
 * the same seed glyph - the connection is made by that visual rhyme and by the
 * copy, rather than by physically tethering the words to the seed.
 *
 * A sapling then rises out of the light, sized and anchored exactly as trees are
 * in the real garden, so the payoff is literally the thing they will keep
 * growing. Everything happens inside the ring and inside a fixed stage height,
 * so no part of the screen reflows at any point in the sequence.
 */
export function NiyyahPlanting({ planted, onPlanted }: NiyyahPlantingProps) {
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
  const sprout = useRef(new Animated.Value(0)).current;

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
    sprout.setValue(0);
  }, [planted]);

  const clearTimers = useCallback(() => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    if (midHaptic.current) { clearTimeout(midHaptic.current); midHaptic.current = null; }
  }, []);

  useEffect(() => () => { clearTimers(); holdAnim.current?.stop(); bobLoop.current?.stop(); }, []);

  const finish = useCallback(() => {
    bobLoop.current?.stop();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // Seed sinks → dirt bursts and the soil settles → light blooms, and the
    // sapling rises out of that light rather than waiting for it to finish.
    Animated.sequence([
      Animated.timing(seedGone, { toValue: 1, duration: BURY_MS, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(burst, { toValue: 1, duration: BURST_MS, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.sequence([
          Animated.timing(settle, { toValue: 1, duration: 140, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.spring(settle, { toValue: 0, friction: 4, tension: 90, useNativeDriver: true }),
        ]),
      ]),
      Animated.parallel([
        Animated.timing(sparkle, { toValue: 1, duration: BLOOM_MS, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.sequence([
          Animated.delay(SPROUT_DELAY_MS),
          // Spring rather than timing: the slight overshoot is what makes it
          // read as "coming to life" instead of simply scaling up.
          Animated.spring(sprout, { toValue: 1, friction: 6, tension: 55, useNativeDriver: true }),
        ]),
      ]),
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

  // The seed idles with a gentle bob, descends as the hold progresses, then
  // sinks the last of the way as it's buried.
  const seedTranslate = Animated.add(
    Animated.add(
      bob.interpolate({ inputRange: [0, 1], outputRange: [0, -5] }),
      holdSeed.interpolate({ inputRange: [0, 1], outputRange: [0, SEED_TRAVEL] }),
    ),
    seedGone.interpolate({ inputRange: [0, 1], outputRange: [0, 14] }),
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
          <Circle cx={STAGE_W / 2} cy={TILE_CY} r={RING_R} stroke="rgba(217,167,95,0.16)" strokeWidth={RING_STROKE} fill="none" />
          <AnimatedCircle
            cx={STAGE_W / 2}
            cy={TILE_CY}
            r={RING_R}
            stroke="#d9a75f"
            strokeWidth={RING_STROKE}
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

        {/* The sapling rising where the seed went in.
            Scales from its own trunk base (75% down the sprite, which is where
            the visible stem meets the soil) so it grows out of the ground
            rather than expanding from its middle. Occupies a fixed slot inside
            the ring that is reserved whether or not it is visible, so nothing
            reflows when it appears. */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.sapling,
            {
              opacity: sprout.interpolate({ inputRange: [0, 0.12, 1], outputRange: [0, 1, 1] }),
              transformOrigin: `center ${SAPLING_ANCHOR * 100}%`,
              transform: [
                { scaleY: sprout.interpolate({ inputRange: [0, 1], outputRange: [0.04, 1] }) },
                // Widens a touch behind the height so the leaves unfurl rather
                // than inflating uniformly.
                { scaleX: sprout.interpolate({ inputRange: [0, 0.45, 1], outputRange: [0.45, 0.82, 1] }) },
              ],
            },
          ]}
        >
          <Animated.Image
            source={SAPLING}
            resizeMode="contain"
            style={{ width: SAPLING_W, height: SAPLING_H }}
          />
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

  seed: { position: 'absolute', top: SEED_REST_CY - SEED_SIZE / 2 },

  sapling: {
    position: 'absolute',
    width: SAPLING_W,
    height: SAPLING_H,
    top: SAPLING_TOP,
  },

  bloomWrap: {
    position: 'absolute',
    width: BLOOM_SIZE,
    height: BLOOM_SIZE,
    top: TILE_CY - BLOOM_SIZE / 2,
  },
});

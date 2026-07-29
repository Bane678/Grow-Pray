import React, { useEffect, useRef, useState } from 'react';
import { View, Image, Animated, StyleSheet, Easing, Text, ImageSourcePropType } from 'react-native';
import { FONTS } from '../theme/typography';

// ─────────────────────────────────────────────────────────────────────────────
//  ⬇⬇  DROP YOUR SCREENSHOTS HERE  ⬇⬇
//
//  This is the ONLY thing you need to edit to swap in real garden screenshots.
//  Replace each `source` with a require() pointing at your image, keep 3-5
//  stages, and order them small → large. Everything else (cross-fade, timing,
//  captions, layout) adapts automatically.
//
//  Recommended: portrait-ish screenshots of the garden at increasing sizes,
//  cropped to roughly the same aspect ratio as each other so the cross-fade
//  doesn't jump. Put them in assets/Garden Assets/Icons/ with simple names.
//
//  Example once you have them:
//    { source: require('../assets/Garden Assets/Icons/garden-stage-1.png'), caption: 'Day 1' },
//    { source: require('../assets/Garden Assets/Icons/garden-stage-2.png'), caption: 'Week 1' },
//    { source: require('../assets/Garden Assets/Icons/garden-stage-3.png'), caption: 'Month 1' },
//    { source: require('../assets/Garden Assets/Icons/garden-stage-4.png'), caption: 'Flourishing' },
//
//  Until then this falls back to the real tree growth sprites, scaling up, so
//  the screen still reads as "small → large" and nothing looks broken.
// ─────────────────────────────────────────────────────────────────────────────
export type GardenStage = {
  source: ImageSourcePropType;
  caption: string;
  /** Relative size 0-1. Ignored once real screenshots are used (set all to 1). */
  scale?: number;
};

export const GARDEN_STAGES: GardenStage[] = [
  { source: require('../assets/Garden Assets/Tree Types/Basic Trees/Sapling_converted.png'),           caption: 'Day 1',       scale: 0.42 },
  { source: require('../assets/Garden Assets/Tree Types/Basic Trees/Growing_Tree_converted.png'),      caption: 'Week 1',      scale: 0.62 },
  { source: require('../assets/Garden Assets/Tree Types/Basic Trees/Grown_Tree_converted.png'),        caption: 'Month 1',     scale: 0.82 },
  { source: require('../assets/Garden Assets/Tree Types/Basic Trees/Flourishing_Tree_converted.png'),  caption: 'Flourishing', scale: 1 },
];

const GROUND = require('../assets/Garden Assets/Ground Tiles/Recovered_Tile.png');

const STAGE_MS = 1400;   // how long each stage holds
const FADE_MS = 520;     // cross-fade duration

/**
 * A looping "your garden grows" showcase: cross-fades through GARDEN_STAGES,
 * each one larger than the last, ending on a flourishing garden before looping.
 * Designed so real screenshots can be dropped into GARDEN_STAGES above with no
 * other code changes.
 */
export function GardenScaleShowcase({
  height = 170,
  showCaption = true,
  showGround = true,
}: {
  height?: number;
  showCaption?: boolean;
  showGround?: boolean;
}) {
  const [index, setIndex] = useState(0);
  const indexRef = useRef(0);
  const fade = useRef(new Animated.Value(1)).current;
  const grow = useRef(new Animated.Value(GARDEN_STAGES[0].scale ?? 1)).current;

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const advance = () => {
      if (cancelled) return;
      // Fade out, swap the image, then fade in at the new scale.
      Animated.timing(fade, {
        toValue: 0,
        duration: FADE_MS / 2,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }).start(() => {
        if (cancelled) return;
        const next = (indexRef.current + 1) % GARDEN_STAGES.length;
        indexRef.current = next;
        setIndex(next);
        grow.setValue(GARDEN_STAGES[next].scale ?? 1);
        Animated.timing(fade, {
          toValue: 1,
          duration: FADE_MS / 2,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }).start(() => {
          if (cancelled) return;
          timer = setTimeout(advance, STAGE_MS);
        });
      });
    };

    timer = setTimeout(advance, STAGE_MS);
    return () => { cancelled = true; clearTimeout(timer); };
  }, []);

  const stage = GARDEN_STAGES[index];

  return (
    <View style={[styles.wrap, { height }]}>
      {/* Soft glow that intensifies with the stage */}
      <View style={[styles.glow, { width: height * 0.8, height: height * 0.8, borderRadius: height * 0.4 }]} />

      {showGround && (
        <Image
          source={GROUND}
          style={{ position: 'absolute', bottom: showCaption ? 30 : 8, width: height * 0.72, height: height * 0.36 }}
          resizeMode="contain"
        />
      )}

      <Animated.Image
        source={stage.source}
        resizeMode="contain"
        style={{
          position: 'absolute',
          bottom: showCaption ? 44 : 22,
          width: height * 0.78,
          height: height * 0.78,
          opacity: fade,
          transform: [{ scale: grow }],
        }}
      />

      {showCaption && (
        <Animated.View style={[styles.captionPill, { opacity: fade }]}>
          <Text style={styles.captionText}>{stage.caption}</Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', alignItems: 'center', justifyContent: 'flex-end' },
  glow: {
    position: 'absolute',
    backgroundColor: 'rgba(217,167,95,0.13)',
    alignSelf: 'center',
    bottom: 20,
  },
  captionPill: {
    position: 'absolute',
    bottom: 0,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(217,167,95,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(217,167,95,0.42)',
  },
  captionText: {
    color: '#e8c97e',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontFamily: FONTS.displayMedium,
  },
});

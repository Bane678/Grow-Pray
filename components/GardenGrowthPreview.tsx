import React, { useEffect, useRef, useState } from 'react';
import { View, Animated, Image, StyleSheet, Easing, Text } from 'react-native';
import { FONTS } from '../theme/typography';

// Real in-app tree growth sprites — sapling → growing → grown → flourishing.
const STAGES = [
  require('../assets/Garden Assets/Tree Types/Basic Trees/Sapling_converted.png'),
  require('../assets/Garden Assets/Tree Types/Basic Trees/Growing_Tree_converted.png'),
  require('../assets/Garden Assets/Tree Types/Basic Trees/Grown_Tree_converted.png'),
  require('../assets/Garden Assets/Tree Types/Basic Trees/Flourishing_Tree_converted.png'),
];
const GROUND = require('../assets/Garden Assets/Ground Tiles/Recovered_Tile.png');

const STAGE_LABELS = ['Day 1', 'Day 7', 'Day 30', 'Flourishing'];

/**
 * A looping animation that grows a tree through its four real sprite stages,
 * giving onboarding a live preview of the core "pray → grow" mechanic without
 * needing a GIF asset.
 */
export function GardenGrowthPreview({ size = 200 }: { size?: number }) {
  const [stage, setStage] = useState(0);
  const scale = useRef(new Animated.Value(0.6)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const stageRef = useRef(0);

  useEffect(() => {
    let cancelled = false;

    const animateStageIn = () => {
      scale.setValue(0.6);
      opacity.setValue(0);
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, friction: 5, tension: 60, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 350, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]).start();
    };

    const tick = () => {
      if (cancelled) return;
      // Fade/scale current out, then advance to next stage and pop in.
      Animated.timing(opacity, { toValue: 0, duration: 280, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(() => {
        if (cancelled) return;
        stageRef.current = (stageRef.current + 1) % STAGES.length;
        setStage(stageRef.current);
        animateStageIn();
      });
    };

    animateStageIn();
    const interval = setInterval(tick, 1600);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  return (
    <View style={{ width: size, height: size }}>
      {/* Soft glow behind the canopy */}
      <View style={[styles.glow, { width: size * 0.7, height: size * 0.7, borderRadius: size * 0.35, left: size * 0.15, top: size * 0.12 }]} />

      {/* Ground tile (2:1 isometric) — centred */}
      <Image
        source={GROUND}
        style={{ width: size * 0.66, height: size * 0.33, position: 'absolute', left: size * 0.17, top: size * 0.455 }}
        resizeMode="contain"
      />

      {/* Growing tree — anchored exactly like the real garden:
          top = tileCenterY - 0.75 * treeHeight, so the base rests ~25% below tile centre */}
      <Animated.Image
        source={STAGES[stage]}
        resizeMode="contain"
        style={{
          width: size * 0.58,
          height: size * 0.58,
          position: 'absolute',
          left: size * 0.21,
          top: size * 0.185,
          opacity,
          transform: [{ scale }],
        }}
      />

      {/* Stage caption */}
      <View style={styles.captionRow}>
        <View style={styles.captionPill}>
          <Text style={styles.captionText}>{STAGE_LABELS[stage]}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    backgroundColor: 'rgba(232,168,124,0.10)',
  },
  captionRow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  captionPill: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  captionText: {
    color: 'rgba(232,224,214,0.7)',
    fontSize: 12,
    fontFamily: FONTS.displayMedium,
  },
});

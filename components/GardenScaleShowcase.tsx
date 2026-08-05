import React, { useEffect, useRef, useState } from 'react';
import { View, Image, Animated, StyleSheet, Easing, Text, ImageSourcePropType } from 'react-native';
import { FONTS } from '../theme/typography';

// ─────────────────────────────────────────────────────────────────────────────
//  ⬇⬇  DROP YOUR SCREENSHOTS HERE  ⬇⬇
//
//  Replace each `source` with a require() pointing at your image, keep 3-5
//  stages, and order them small → large. If you switch to screenshots, also set
//  `usesGardenGeometry: false` on each entry so they render as plain full-frame
//  images rather than being positioned as tree sprites on a tile.
//
//  Example once you have them:
//    { source: require('.../garden-stage-1.png'), caption: 'Day 1', usesGardenGeometry: false },
//
//  Until then this uses the real tree sprites, positioned with the EXACT same
//  geometry the live garden uses, so the preview matches the product.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Garden geometry (mirrors components/GardenScene.tsx) ───────────────────
// These must stay in step with GardenScene or the paywall preview stops looking
// like the real garden. Source of truth is GardenScene.tsx; the values are
// duplicated rather than imported because GardenScene pulls in the whole scene
// (sound, particles, animation state) and this is a static preview.
const TILE_PX_W = 1456;      // Ground tile asset is 1456x720
const TILE_PX_H = 720;
const TILE_SCALE = 0.08;     // GardenScene DISPLAY_SCALE

const TREE_PX_W = 848;       // Tree sprites are 848x1264
const TREE_PX_H = 1264;
const TREE_SQUASH = 0.7;     // GardenScene TREE_SQUASH - flattens for the camera angle

// Tree sits centred on the tile horizontally, and 75% of its height above the
// tile centre - i.e. GardenScene's `posY = tileCenterY - ptHeight * 0.75`.
// The sprite's visible trunk base lands on the tile because of the transparent
// padding at the bottom of the asset; do not "fix" this to 1.0.
const TREE_ANCHOR = 0.75;

const TILE_W = TILE_PX_W * TILE_SCALE;   // 116.48
const TILE_H = TILE_PX_H * TILE_SCALE;   // 57.6

export type GardenStage = {
  source: ImageSourcePropType;
  caption: string;
  /** GardenScene TREE_STAGES scale for this stage. Ignored for screenshots. */
  gardenScale?: number;
  /** False for screenshots - render full-frame instead of as a tree on a tile. */
  usesGardenGeometry?: boolean;
};

export const GARDEN_STAGES: GardenStage[] = [
  { source: require('../assets/Garden Assets/Tree Types/Basic Trees/Sapling_converted.png'),           caption: 'Day 1',       gardenScale: 0.10, usesGardenGeometry: true },
  { source: require('../assets/Garden Assets/Tree Types/Basic Trees/Growing_Tree_converted.png'),      caption: 'Week 1',      gardenScale: 0.12, usesGardenGeometry: true },
  { source: require('../assets/Garden Assets/Tree Types/Basic Trees/Grown_Tree_converted.png'),        caption: 'Month 1',     gardenScale: 0.14, usesGardenGeometry: true },
  { source: require('../assets/Garden Assets/Tree Types/Basic Trees/Flourishing_Tree_converted.png'),  caption: 'Flourishing', gardenScale: 0.16, usesGardenGeometry: true },
];

const GROUND = require('../assets/Garden Assets/Ground Tiles/Recovered_Tile.png');

const STAGE_MS = 1400;   // how long each stage holds
const FADE_MS = 520;     // cross-fade duration

// Natural bounds of the composition in garden units, with the tile centre at 0.
// The largest stage defines the extents, so every stage shares one stable frame
// and the tile never shifts as the tree grows.
const MAX_SCALE = Math.max(...GARDEN_STAGES.map(s => s.gardenScale ?? 0));
const MAX_TREE_H = TREE_PX_H * MAX_SCALE * TREE_SQUASH;
const MAX_TREE_W = TREE_PX_W * MAX_SCALE;
const CONTENT_TOP = -MAX_TREE_H * TREE_ANCHOR;                          // tallest tree's top
const CONTENT_BOTTOM = Math.max(TILE_H / 2, MAX_TREE_H * (1 - TREE_ANCHOR));
const NATURAL_H = CONTENT_BOTTOM - CONTENT_TOP;
const NATURAL_W = Math.max(TILE_W, MAX_TREE_W);

const CAPTION_SPACE = 34;

/**
 * A looping "your garden grows" showcase: cross-fades through GARDEN_STAGES,
 * each one larger than the last, ending on a flourishing garden before looping.
 *
 * Trees are positioned using the live garden's geometry rather than being
 * stretched into a square box, so each stage sits centred on the tile with its
 * base on the ground exactly as it does in the real garden.
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

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const advance = () => {
      if (cancelled) return;
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
  const usesGeometry = stage.usesGardenGeometry !== false && stage.gardenScale != null;

  // Scale the whole composition to fit the height we've been given.
  const sceneH = Math.max(1, height - (showCaption ? CAPTION_SPACE : 0));
  const k = sceneH / NATURAL_H;

  // Tile centre within the scene box.
  const centreX = (NATURAL_W * k) / 2;
  const centreY = -CONTENT_TOP * k;

  const tileW = TILE_W * k;
  const tileH = TILE_H * k;

  const treeW = usesGeometry ? TREE_PX_W * (stage.gardenScale as number) * k : 0;
  const treeH = usesGeometry ? TREE_PX_H * (stage.gardenScale as number) * TREE_SQUASH * k : 0;

  const glowSize = tileW * 1.5;

  return (
    <View style={[styles.wrap, { height }]}>
      <View style={{ width: NATURAL_W * k, height: sceneH }}>
        {/* Soft glow behind the tile */}
        <View
          pointerEvents="none"
          style={[
            styles.glow,
            {
              width: glowSize,
              height: glowSize,
              borderRadius: glowSize / 2,
              left: centreX - glowSize / 2,
              top: centreY - glowSize / 2,
            },
          ]}
        />

        {usesGeometry ? (
          <>
            {showGround && (
              <Image
                source={GROUND}
                style={{
                  position: 'absolute',
                  left: centreX - tileW / 2,
                  top: centreY - tileH / 2,
                  width: tileW,
                  height: tileH,
                }}
                resizeMode="contain"
              />
            )}
            <Animated.Image
              source={stage.source}
              resizeMode="contain"
              style={{
                position: 'absolute',
                // Exactly GardenScene's placement, scaled.
                left: centreX - treeW / 2,
                top: centreY - treeH * TREE_ANCHOR,
                width: treeW,
                height: treeH,
                opacity: fade,
              }}
            />
          </>
        ) : (
          // Screenshot mode: just show the image filling the scene box.
          <Animated.Image
            source={stage.source}
            resizeMode="contain"
            style={{ width: '100%', height: '100%', opacity: fade }}
          />
        )}
      </View>

      {showCaption && (
        <Animated.View style={[styles.captionPill, { opacity: fade }]}>
          <Text style={styles.captionText}>{stage.caption}</Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', alignItems: 'center', justifyContent: 'flex-start' },
  glow: {
    position: 'absolute',
    backgroundColor: 'rgba(217,167,95,0.13)',
  },
  captionPill: {
    marginTop: 8,
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

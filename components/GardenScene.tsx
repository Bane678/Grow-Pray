import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, Image, Animated, Easing, Dimensions } from 'react-native';
import { GestureHandlerRootView, PinchGestureHandler, PanGestureHandler, TapGestureHandler, TapGestureHandlerStateChangeEvent, State } from 'react-native-gesture-handler';
import { TileState, PlantedTree, TileTransition } from '../hooks/useGardenState';
import { TREE_CATALOG } from './ShopModal';
import { Audio } from 'expo-av';

const PARTICLE_IMAGES = [
    require('../assets/Garden Assets/Icons/particles/p0.png'),
    require('../assets/Garden Assets/Icons/particles/p1.png'),
    require('../assets/Garden Assets/Icons/particles/p2.png'),
    require('../assets/Garden Assets/Icons/particles/p3.png'),
    require('../assets/Garden Assets/Icons/particles/p4.png'),
    require('../assets/Garden Assets/Icons/particles/p5.png'),
    require('../assets/Garden Assets/Icons/particles/p6.png'),
    require('../assets/Garden Assets/Icons/particles/p7.png'),
    require('../assets/Garden Assets/Icons/particles/p8.png'),
    require('../assets/Garden Assets/Icons/particles/p9.png'),
    require('../assets/Garden Assets/Icons/particles/p10.png'),
    require('../assets/Garden Assets/Icons/particles/p11.png'),
];

const COLORS = {
    skyBg: '#0f1526',
};

// ─── Idle Ambient Animations ───────────────────────────────────────────────────
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// ── Star field ────────────────────────────────────────────────────────────────
// Stars span the full sky but get smaller and dimmer toward the bottom,
// creating a natural gradient that avoids overcrowding.
const STAR_DATA = Array.from({ length: 18 }, (_, i) => {
    const yFrac = ((i * 31 + 7) % 92 + 4) / 100;           // 4–96% — full screen
    const depth = 1 - yFrac;                                 // 1 at top → 0 at bottom
    return {
        x:    ((i * 47 + 13) % 97) / 100,
        y:    yFrac,
        r:    (1.0 + (i % 3) * 0.6) * (0.5 + depth * 0.5), // smaller toward bottom
        dur:  1800 + (i * 119) % 1600,
        init: ((i * 173) % 1000) / 1000,
        peak: 0.15 + depth * 0.40,                           // max brightness: 0.55 top → 0.15 bottom
    };
});

const StarField = React.memo(function StarField() {
    const anims = useRef(STAR_DATA.map(s => new Animated.Value(s.init))).current;
    useEffect(() => {
        const loops = anims.map((anim, i) => Animated.loop(Animated.sequence([
            Animated.timing(anim, { toValue: 1,   duration: STAR_DATA[i].dur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
            Animated.timing(anim, { toValue: 0.1, duration: STAR_DATA[i].dur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ])));
        loops.forEach(l => l.start());
        return () => loops.forEach(l => l.stop());
    }, []);
    return (
        <>
            {STAR_DATA.map((s, i) => (
                <Animated.View key={`star-${i}`} pointerEvents="none" style={{
                    position: 'absolute',
                    left: s.x * SCREEN_W, top: s.y * SCREEN_H,
                    width: s.r * 2, height: s.r * 2, borderRadius: s.r,
                    backgroundColor: '#ffffff',
                    opacity: anims[i].interpolate({ inputRange: [0, 1], outputRange: [0.03, s.peak] }),
                }} />
            ))}
        </>
    );
});

// ── Cloud drift ───────────────────────────────────────────────────────────────
const CLOUD_SPECS = [
    { startX: -180, endX: SCREEN_W + 180, y: 0.06, w: 120, h: 28, dur: 62000, alpha: 0.07 },
    { startX: -120, endX: SCREEN_W + 120, y: 0.14, w:  80, h: 20, dur: 84000, alpha: 0.05 },
    { startX: -200, endX: SCREEN_W + 200, y: 0.22, w: 160, h: 36, dur: 98000, alpha: 0.06 },
];

const CloudDrift = React.memo(function CloudDrift() {
    const anims = useRef(CLOUD_SPECS.map((c, i) => {
        const frac = i / CLOUD_SPECS.length;
        return new Animated.Value(c.startX + (c.endX - c.startX) * frac);
    })).current;
    useEffect(() => {
        const loops = CLOUD_SPECS.map((c, i) => {
            const frac = i / CLOUD_SPECS.length;
            return Animated.loop(Animated.sequence([
                Animated.timing(anims[i], { toValue: c.endX,   duration: c.dur * (1 - frac), easing: Easing.linear, useNativeDriver: true }),
                Animated.timing(anims[i], { toValue: c.startX, duration: 0,                  useNativeDriver: true }),
                Animated.timing(anims[i], { toValue: c.endX,   duration: c.dur,               easing: Easing.linear, useNativeDriver: true }),
            ]));
        });
        loops.forEach(l => l.start());
        return () => loops.forEach(l => l.stop());
    }, []);
    return (
        <>
            {CLOUD_SPECS.map((c, i) => (
                <Animated.View key={`cloud-${i}`} pointerEvents="none" style={{
                    position: 'absolute',
                    top: c.y * SCREEN_H, width: c.w, height: c.h,
                    borderRadius: c.h / 2, backgroundColor: '#ffffff', opacity: c.alpha,
                    transform: [{ translateX: anims[i] }],
                }} />
            ))}
        </>
    );
});

// ── Pollen / dust motes ───────────────────────────────────────────────────────
// Tree-anchored: motes spawn at actual tree canopy positions.
// Each grown tree gets 1 mote, flourishing gets 2. Hard cap of 12 for performance.
const MAX_MOTES = 12;

type MoteSpec = {
    spawnX: number;
    spawnY: number;
    dx: number;
    dy: number;
    size: number;
    dur: number;
    delay: number;
    wobble: number;
    restDur: number;
};

// Generate a deterministic mote spec from a tree position + seed index
function makeMoteSpec(spawnX: number, spawnY: number, seed: number): MoteSpec {
    // Fan angle: deterministic spread per seed
    const angleDeg = -40 - ((seed * 73 + 11) % 101);  // -40° to -140°
    const rad = (angleDeg * Math.PI) / 180;
    const dist = 55 + (seed * 13) % 65;
    return {
        spawnX,
        spawnY,
        dx: Math.cos(rad) * dist,
        dy: Math.sin(rad) * dist,
        size: 1.5 + (seed % 3) * 0.7,
        dur: 5500 + (seed * 390) % 3500,
        delay: (seed * 490) % 5000,
        wobble: 6 + (seed * 4) % 10,
        restDur: 700 + (seed * 370) % 1300,
    };
}

function DustMote({ spec }: { spec: MoteSpec }) {
    const opacity = useRef(new Animated.Value(0)).current;
    const tx      = useRef(new Animated.Value(0)).current;
    const ty      = useRef(new Animated.Value(0)).current;
    const wobble  = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // Organic lateral breath — perpendicular oscillation independent of drift
        const wobbleDur = 1400 + (spec.delay % 700);
        const wobbleLoop = Animated.loop(Animated.sequence([
            Animated.timing(wobble, { toValue: -spec.wobble, duration: wobbleDur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
            Animated.timing(wobble, { toValue:  spec.wobble, duration: wobbleDur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
            Animated.timing(wobble, { toValue:  0,           duration: wobbleDur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]));
        wobbleLoop.start();

        // Fully native-driven cycle: drift → invisible reset → rest → repeat
        // No JS setValue calls, so no cross-thread frame glitches.
        const fadeInDur  = spec.dur * 0.22;
        const holdDur    = spec.dur * 0.46;
        const fadeOutDur = spec.dur * 0.32;

        const cycle = Animated.loop(Animated.sequence([
            // Phase 1: emerge from tree canopy and drift outward
            Animated.parallel([
                Animated.sequence([
                    Animated.timing(opacity, { toValue: 0.48, duration: fadeInDur, easing: Easing.out(Easing.quad), useNativeDriver: true }),
                    Animated.timing(opacity, { toValue: 0.43, duration: holdDur, useNativeDriver: true }),
                    Animated.timing(opacity, { toValue: 0,    duration: fadeOutDur, easing: Easing.in(Easing.quad), useNativeDriver: true }),
                ]),
                Animated.timing(tx, { toValue: spec.dx, duration: spec.dur, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
                Animated.timing(ty, { toValue: spec.dy, duration: spec.dur, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
            ]),
            // Phase 2: guard — wait a frame to ensure opacity=0 is committed before position snaps
            Animated.delay(50),
            // Phase 3: invisible reset back to origin
            Animated.parallel([
                Animated.timing(tx, { toValue: 0, duration: 1, useNativeDriver: true }),
                Animated.timing(ty, { toValue: 0, duration: 1, useNativeDriver: true }),
            ]),
            // Phase 4: rest invisibly before next pollen release
            Animated.delay(spec.restDur),
        ]));

        // Stagger start per mote
        const t = setTimeout(() => cycle.start(), spec.delay);
        return () => { clearTimeout(t); cycle.stop(); wobbleLoop.stop(); };
    }, []);

    return (
        <Animated.View pointerEvents="none" style={{
            position: 'absolute',
            left: spec.spawnX - spec.size / 2,
            top:  spec.spawnY - spec.size / 2,
            width: spec.size * 4, height: spec.size * 4,
            opacity,
            transform: [
                // Animated.add merges primary drift + lateral wobble in one transform
                { translateX: Animated.add(tx, wobble) },
                { translateY: ty },
            ],
        }}>
            <Image source={ASSETS.pollenMote} style={{ width: spec.size * 4, height: spec.size * 4 }} resizeMode="contain" />
        </Animated.View>
    );
}

const FloatingParticles = React.memo(function FloatingParticles({ treePositions }: {
    treePositions: { x: number; y: number; isFlourishing: boolean }[];
}) {
    // Generate mote specs from tree positions — stable identity via useMemo
    const specs = useMemo(() => {
        const result: MoteSpec[] = [];
        let seed = 0;
        for (const tree of treePositions) {
            if (result.length >= MAX_MOTES) break;
            // Canopy offset: motes spawn above tree center
            const canopyY = tree.y - 20;
            // Small random scatter around canopy center
            const scatter1X = ((seed * 47 + 13) % 21) - 10;
            const scatter1Y = ((seed * 31 + 7) % 11) - 5;
            result.push(makeMoteSpec(tree.x + scatter1X, canopyY + scatter1Y, seed));
            seed++;
            // Flourishing trees get a second mote
            if (tree.isFlourishing && result.length < MAX_MOTES) {
                const scatter2X = ((seed * 59 + 23) % 21) - 10;
                const scatter2Y = ((seed * 37 + 11) % 11) - 5;
                result.push(makeMoteSpec(tree.x + scatter2X, canopyY + scatter2Y, seed));
                seed++;
            }
        }
        return result;
    }, [treePositions]);

    return <>{specs.map((s, i) => <DustMote key={i} spec={s} />)}</>;
});

// ── Falling Leaves ────────────────────────────────────────────────────────────
// Occasional small leaves drift down from the tree canopy zone.
// Sparse and gentle — long rest periods between each cycle.
const GARDEN_CX = SCREEN_W / 2;
const GARDEN_CY = SCREEN_H * 0.42;
const LEAF_COUNT = 3;
const LEAF_SPECS = Array.from({ length: LEAF_COUNT }, (_, i) => {
    const spawnX = GARDEN_CX + (((i * 67 + 11) % 51) - 25) / 25 * SCREEN_W * 0.18;
    const spawnY = GARDEN_CY - SCREEN_H * 0.04 + (((i * 37 + 7) % 31) - 15) / 15 * SCREEN_H * 0.03;
    const lateralDrift = ((i * 41 + 5) % 60) - 30;
    const fallDist = 60 + (i * 29) % 80;
    return {
        spawnX, spawnY,
        dx: lateralDrift,
        dy: fallDist,
        w: 3 + (i % 3) * 1.0,
        h: (3 + (i % 3) * 1.0) * (1.3 + (i % 2) * 0.3),
        dur: 4000 + (i * 670) % 3000,
        delay: (i * 2700) % 12000,
        restDur: 6000 + (i * 1170) % 8000,
        wobbleAmp: 8 + (i * 3) % 8,
        color: (['#c8a060', '#7da84e', '#d4b896', '#89a85c', '#e8a87c', '#a8c45a'] as const)[i % 6],
    };
});

function FallingLeaf({ spec }: { spec: typeof LEAF_SPECS[0] }) {
    const opacity = useRef(new Animated.Value(0)).current;
    const tx      = useRef(new Animated.Value(0)).current;
    const ty      = useRef(new Animated.Value(0)).current;
    const rotate  = useRef(new Animated.Value(0)).current;
    const wobble  = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const wobbleDur = 1200 + (spec.delay % 500);
        const wobbleLoop = Animated.loop(Animated.sequence([
            Animated.timing(wobble, { toValue:  spec.wobbleAmp, duration: wobbleDur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
            Animated.timing(wobble, { toValue: -spec.wobbleAmp, duration: wobbleDur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
            Animated.timing(wobble, { toValue:  0,              duration: wobbleDur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]));
        wobbleLoop.start();

        const fadeInDur  = spec.dur * 0.15;
        const holdDur    = spec.dur * 0.55;
        const fadeOutDur = spec.dur * 0.30;

        const cycle = Animated.loop(Animated.sequence([
            // Phase 1: drift and tumble
            Animated.parallel([
                Animated.sequence([
                    Animated.timing(opacity, { toValue: 0.55, duration: fadeInDur, easing: Easing.out(Easing.quad), useNativeDriver: true }),
                    Animated.timing(opacity, { toValue: 0.50, duration: holdDur, useNativeDriver: true }),
                    Animated.timing(opacity, { toValue: 0, duration: fadeOutDur, easing: Easing.in(Easing.quad), useNativeDriver: true }),
                ]),
                Animated.timing(tx, { toValue: spec.dx, duration: spec.dur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
                Animated.timing(ty, { toValue: spec.dy, duration: spec.dur, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
                Animated.timing(rotate, { toValue: 1, duration: spec.dur, easing: Easing.linear, useNativeDriver: true }),
            ]),
            // Phase 2: guard — wait a frame to ensure opacity=0 is committed before position snaps
            Animated.delay(50),
            // Phase 3: invisible instant reset (opacity is 0)
            Animated.parallel([
                Animated.timing(tx, { toValue: 0, duration: 1, useNativeDriver: true }),
                Animated.timing(ty, { toValue: 0, duration: 1, useNativeDriver: true }),
                Animated.timing(rotate, { toValue: 0, duration: 1, useNativeDriver: true }),
            ]),
            // Phase 4: rest before next leaf
            Animated.delay(spec.restDur),
        ]));

        const t = setTimeout(() => cycle.start(), spec.delay);
        return () => { clearTimeout(t); cycle.stop(); wobbleLoop.stop(); };
    }, []);

    return (
        <Animated.View pointerEvents="none" style={{
            position: 'absolute',
            left: spec.spawnX - spec.w * 2,
            top:  spec.spawnY - spec.h * 2,
            width: spec.w * 4,
            height: spec.h * 4,
            opacity,
            transform: [
                { translateX: Animated.add(tx, wobble) },
                { translateY: ty },
                { rotate: rotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '540deg'] }) },
            ],
        }}>
            <Image source={ASSETS.fallingLeaf} style={{ width: spec.w * 4, height: spec.h * 4 }} resizeMode="contain" />
        </Animated.View>
    );
}

const FallingLeaves = React.memo(function FallingLeaves({ count }: { count: number }) {
    const visible = Math.min(count, LEAF_SPECS.length);
    return <>{LEAF_SPECS.slice(0, visible).map((s, i) => <FallingLeaf key={`leaf-${i}`} spec={s} />)}</>;
});

// Tile dimensions (actual asset is 1456x720, ~2:1 ratio)
const TILE_WIDTH = 1456;
const TILE_HEIGHT = 720;
const DISPLAY_SCALE = 0.08;
const SCALED_WIDTH = TILE_WIDTH * DISPLAY_SCALE;
const SCALED_HEIGHT = TILE_HEIGHT * DISPLAY_SCALE;

// Isometric step sizes
const STEP_X = SCALED_WIDTH / 2;
const STEP_Y = SCALED_HEIGHT / 2;

const ASSETS = {
    deadTile: require('../assets/Garden Assets/Ground Tiles/Dead_Tile.png'),
    recoveringTile: require('../assets/Garden Assets/Ground Tiles/Recovering_Tile.png'),
    recoveredTile: require('../assets/Garden Assets/Ground Tiles/Recovered_Tile.png'),
    sapling: require('../assets/Garden Assets/Tree Types/Basic Trees/Sapling_converted.png'),
    growingTree: require('../assets/Garden Assets/Tree Types/Basic Trees/Growing_Tree_converted.png'),
    grownTree: require('../assets/Garden Assets/Tree Types/Basic Trees/Grown_Tree_converted.png'),
    flourishingTree: require('../assets/Garden Assets/Tree Types/Basic Trees/Flourishing_Tree_converted.png'),
    deadTree: require('../assets/Garden Assets/Tree Types/Basic Trees/Dead_Tree.png'),
    // Palm tree sprites
    palmSapling:     require('../assets/Garden Assets/Tree Types/Palm Trees/Palm_Sapling.png'),
    palmGrowing:     require('../assets/Garden Assets/Tree Types/Palm Trees/Palm_Growing.png'),
    palmGrown:       require('../assets/Garden Assets/Tree Types/Palm Trees/Palm_Grown.png'),
    palmFlourishing: require('../assets/Garden Assets/Tree Types/Palm Trees/Palm_Flourishing.png'),
    // Willow tree sprites
    willowSapling:     require('../assets/Garden Assets/Tree Types/Willow Trees/Willow_Sapling.png'),
    willowGrowing:     require('../assets/Garden Assets/Tree Types/Willow Trees/Willow_Growing.png'),
    willowGrown:       require('../assets/Garden Assets/Tree Types/Willow Trees/Willow_Grown.png'),
    willowFlourishing: require('../assets/Garden Assets/Tree Types/Willow Trees/Willow_Flourishing.png'),
    // Oak tree sprites
    oakSapling:     require('../assets/Garden Assets/Tree Types/Oak Trees/Oak_Sapling.png'),
    oakGrowing:     require('../assets/Garden Assets/Tree Types/Oak Trees/Oak_Growing.png'),
    oakGrown:       require('../assets/Garden Assets/Tree Types/Oak Trees/Oak_Grown.png'),
    oakFlourishing: require('../assets/Garden Assets/Tree Types/Oak Trees/Oak_Flourishing.png'),
    // Cherry Blossom tree sprites
    cherryBlossomSapling:     require('../assets/Garden Assets/Tree Types/Cherry Blossom Trees/Cherry_Blossom_Sapling.png'),
    cherryBlossomGrowing:     require('../assets/Garden Assets/Tree Types/Cherry Blossom Trees/Cherry_Blossom_Growing.png'),
    cherryBlossomGrown:       require('../assets/Garden Assets/Tree Types/Cherry Blossom Trees/Cherry_Blossom_Grown.png'),
    cherryBlossomFlourishing: require('../assets/Garden Assets/Tree Types/Cherry Blossom Trees/Cherry_Blossom_Flourishing.png'),
    // Maple tree sprites
    mapleSapling:     require('../assets/Garden Assets/Tree Types/Maple Trees/Maple_Sapling.png'),
    mapleGrowing:     require('../assets/Garden Assets/Tree Types/Maple Trees/Maple_Growing.png'),
    mapleGrown:       require('../assets/Garden Assets/Tree Types/Maple Trees/Maple_Grown.png'),
    mapleFlourishing: require('../assets/Garden Assets/Tree Types/Maple Trees/Maple_Flourishing.png'),
    // Golden tree sprites
    goldenTreeSapling:     require('../assets/Garden Assets/Tree Types/Golden Trees/Golden_Tree_Sapling.png'),
    goldenTreeGrowing:     require('../assets/Garden Assets/Tree Types/Golden Trees/Golden_Tree_Growing.png'),
    goldenTreeGrown:       require('../assets/Garden Assets/Tree Types/Golden Trees/Golden_Tree_Grown.png'),
    goldenTreeFlourishing: require('../assets/Garden Assets/Tree Types/Golden Trees/Golden_Tree_Flourishing.png'),
    // Cedar tree sprites
    cedarSapling:     require('../assets/Garden Assets/Tree Types/Cedar Trees/Cedar_Sapling.png'),
    cedarGrowing:     require('../assets/Garden Assets/Tree Types/Cedar Trees/Cedar_Growing.png'),
    cedarGrown:       require('../assets/Garden Assets/Tree Types/Cedar Trees/Cedar_Grown.png'),
    cedarFlourishing: require('../assets/Garden Assets/Tree Types/Cedar Trees/Cedar_Flourished.png'),
    axeIcon: require('../assets/Garden Assets/Icons/Axe.png'),
    // Decoration sprites
    deadGrassTuft: require('../assets/Garden Assets/Ground Tiles/Dead_Grass_Tuft.png'),
    pebbles: require('../assets/Garden Assets/Ground Tiles/Pebbles.png'),
    wildflowers: require('../assets/Garden Assets/Ground Tiles/Wildflowers.png'),
    grassBlades: require('../assets/Garden Assets/Ground Tiles/Grass_Blades.png'),
    mushrooms: require('../assets/Garden Assets/Ground Tiles/Mushrooms.png'),
    clovers: require('../assets/Garden Assets/Ground Tiles/Clovers.png'),
    // Effect sprites
    emberMote: require('../assets/Garden Assets/Effects/Ember_Mote.png'),
    dewSparkle: require('../assets/Garden Assets/Effects/Dew_Sparkle.png'),
    pollenMote: require('../assets/Garden Assets/Effects/Pollen_Mote.png'),
    fallingLeaf:   require('../assets/Garden Assets/Effects/Falling_Leaf.png'),
    fruitCommon:   require('../assets/Garden Assets/Effects/Fruit_Common.png'),
    fruitPremium:  require('../assets/Garden Assets/Effects/Fruit_Premium.png'),
};

const WOOD_CHOP_SOUND = require('../assets/sounds/Wood_Chopping_Noise.m4a');

// Tree dimensions (actual asset is 848x1264)
const TREE_WIDTH = 848;
const TREE_HEIGHT = 1264;

// Vertical squash factor — compresses tree height to simulate a more overhead camera angle
// and reduce visual overlap between neighboring tiles. 1.0 = no squash, 0.7 = 30% shorter.
const TREE_SQUASH = 0.7;

// Tree growth stages with XP thresholds and scales
// Thresholds are XP earned SINCE planting. At ~25 XP/day (5 on-time prayers):
//   Sapling  → Growing:    ~1 day  (15 XP)
//   Growing  → Grown:      ~3 days (75 XP)
//   Grown    → Flourishing: ~1 week (175 XP)
const TREE_STAGES = [
    { name: 'sapling', minXP: 0, scale: 0.10, asset: 'sapling' },
    { name: 'growing', minXP: 15, scale: 0.12, asset: 'growingTree' },
    { name: 'grown', minXP: 75, scale: 0.14, asset: 'grownTree' },
    { name: 'flourishing', minXP: 175, scale: 0.16, asset: 'flourishingTree' },
] as const;

// Get current tree stage based on XP
const getTreeStage = (xp: number) => {
    for (let i = TREE_STAGES.length - 1; i >= 0; i--) {
        if (xp >= TREE_STAGES[i].minXP) {
            return TREE_STAGES[i];
        }
    }
    return TREE_STAGES[0];
};

// Dead tree dimensions (720x1472)
const DEAD_TREE_WIDTH = 720;
const DEAD_TREE_HEIGHT = 1472;
const DEAD_TREE_SCALE = 0.08;
const SCALED_DEAD_TREE_WIDTH = DEAD_TREE_WIDTH * DEAD_TREE_SCALE;
const SCALED_DEAD_TREE_HEIGHT = DEAD_TREE_HEIGHT * DEAD_TREE_SCALE * TREE_SQUASH;

// Generate consistent dead tree positions (seeded for consistency)
// Dead trees only appear on 'dead' tiles, ~15% chance per tile
const generateDeadTreePositions = (maxGridSize: number) => {
    const positions: Array<{ row: number; col: number }> = [];
    const centerRow = Math.floor(maxGridSize / 2);
    const centerCol = Math.floor(maxGridSize / 2);

    for (let row = 0; row < maxGridSize; row++) {
        for (let col = 0; col < maxGridSize; col++) {
            // Skip initial cross of 5 recovered tiles
            const isCenter = row === centerRow && col === centerCol;
            const isCardinal = (row === centerRow - 1 && col === centerCol) ||
                               (row === centerRow + 1 && col === centerCol) ||
                               (row === centerRow && col === centerCol - 1) ||
                               (row === centerRow && col === centerCol + 1);
            if (isCenter || isCardinal) continue;

            // Deterministic ~15% chance
            const seed = row * 17 + col * 31;
            if ((seed % 100) < 15) {
                positions.push({ row, col });
            }
        }
    }
    return positions;
};

// All possible dead tree positions (computed once)
const ALL_DEAD_TREE_POSITIONS = generateDeadTreePositions(21); // MAX_GRID_SIZE from hook

// Rotates local grid coordinates to simulate camera orbiting the garden.
// This changes which tiles appear in front/back — the actual isometric camera rotation.
// rotation: 0=default, 1=90°CW, 2=180°, 3=270°CW
const rotateLocal = (localRow: number, localCol: number, rotation: number, maxLocal: number): [number, number] => {
    switch (((rotation % 4) + 4) % 4) {
        case 1: return [localCol, maxLocal - localRow];
        case 2: return [maxLocal - localRow, maxLocal - localCol];
        case 3: return [maxLocal - localCol, localRow];
        default: return [localRow, localCol];
    }
};

// Tile asset mapping
const TILE_ASSETS: Record<TileState, any> = {
    dead: ASSETS.deadTile,
    recovering: ASSETS.recoveringTile,
    recovered: ASSETS.recoveredTile,
};

// ─── LevelUpFX ────────────────────────────────────────────────────────────────
// Self-contained level-up celebration component.
// Fires sparkle burst + ring pulse + floating "Level Up!" text whenever
// `triggerKey` increments (triggerKey === 0 is the initial no-op state).
const NUM_FX_SPARKS = 10;
const FX_SPARK_RADIUS = 70;
const FX_RING_SIZE = 110;

const LevelUpFX = React.memo(function LevelUpFX({
    centerX,
    centerY,
    treeHeight,
    zIndex,
    triggerKey,
}: {
    centerX: number;
    centerY: number;
    treeHeight: number;
    zIndex: number;
    triggerKey: number;
}) {
    const [visible, setVisible] = useState(false);
    const sparkAnims = useRef(
        Array.from({ length: NUM_FX_SPARKS }, (_, i) => {
            const angle = (i / NUM_FX_SPARKS) * Math.PI * 2;
            return {
                tx: new Animated.Value(0),
                ty: new Animated.Value(0),
                opacity: new Animated.Value(0),
                targetX: Math.cos(angle) * FX_SPARK_RADIUS,
                targetY: Math.sin(angle) * FX_SPARK_RADIUS,
            };
        })
    ).current;
    const ringScale = useRef(new Animated.Value(0.5)).current;
    const ringOpacity = useRef(new Animated.Value(0)).current;
    const floatY = useRef(new Animated.Value(0)).current;
    const floatOpacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (triggerKey === 0) return;

        // Reset all values
        sparkAnims.forEach(s => { s.tx.setValue(0); s.ty.setValue(0); s.opacity.setValue(0); });
        ringScale.setValue(0.5);
        ringOpacity.setValue(0);
        floatY.setValue(0);
        floatOpacity.setValue(0);
        setVisible(true);

        const sparkAnim = Animated.stagger(
            40,
            sparkAnims.map(s =>
                Animated.parallel([
                    Animated.timing(s.tx, { toValue: s.targetX, duration: 750, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
                    Animated.timing(s.ty, { toValue: s.targetY, duration: 750, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
                    Animated.sequence([
                        Animated.timing(s.opacity, { toValue: 1, duration: 80, useNativeDriver: true }),
                        Animated.timing(s.opacity, { toValue: 0, duration: 670, useNativeDriver: true }),
                    ]),
                ])
            )
        );

        const ringAnim = Animated.parallel([
            Animated.timing(ringScale, { toValue: 3.2, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
            Animated.sequence([
                Animated.timing(ringOpacity, { toValue: 0.8, duration: 80, useNativeDriver: true }),
                Animated.timing(ringOpacity, { toValue: 0, duration: 820, useNativeDriver: true }),
            ]),
        ]);

        const textAnim = Animated.parallel([
            Animated.timing(floatY, { toValue: -75, duration: 1100, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
            Animated.sequence([
                Animated.timing(floatOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
                Animated.delay(500),
                Animated.timing(floatOpacity, { toValue: 0, duration: 420, useNativeDriver: true }),
            ]),
        ]);

        Animated.parallel([sparkAnim, ringAnim, textAnim]).start(() => setVisible(false));
    }, [triggerKey]);

    if (!visible) return null;

    return (
        <>
            {/* Ring pulse — temporarily hidden */}
            {/* <Animated.View
                pointerEvents="none"
                style={{
                    position: 'absolute',
                    left: centerX - FX_RING_SIZE / 2,
                    top: centerY - FX_RING_SIZE / 2,
                    width: FX_RING_SIZE,
                    height: FX_RING_SIZE,
                    borderRadius: FX_RING_SIZE / 2,
                    borderWidth: 3,
                    borderColor: '#86efac',
                    backgroundColor: 'transparent',
                    zIndex: zIndex + 50,
                    opacity: ringOpacity,
                    transform: [{ scale: ringScale }],
                }}
            /> */}
            {/* Image particles */}
            {sparkAnims.map((s, i) => (
                <Animated.Image
                    key={`spark-fx-${i}`}
                    source={PARTICLE_IMAGES[i % PARTICLE_IMAGES.length]}
                    style={{
                        position: 'absolute',
                        left: centerX - 16,
                        top: centerY - treeHeight * 0.6 - 16,
                        width: 32,
                        height: 32,
                        zIndex: zIndex + 51,
                        opacity: s.opacity,
                        transform: [{ translateX: s.tx }, { translateY: s.ty }],
                    }}
                    resizeMode="contain"
                />
            ))}
            {/* Floating "Level Up!" text */}
            <Animated.View
                pointerEvents="none"
                style={{
                    position: 'absolute',
                    left: centerX - 55,
                    top: centerY - treeHeight * 0.7,
                    width: 110,
                    alignItems: 'center',
                    zIndex: zIndex + 52,
                    opacity: floatOpacity,
                    transform: [{ translateY: floatY }],
                }}
            >
                <Text style={{
                    color: '#fde047',
                    fontWeight: 'bold',
                    fontSize: 14,
                    textShadowColor: 'rgba(0,0,0,0.85)',
                    textShadowOffset: { width: 0, height: 1 },
                    textShadowRadius: 4,
                }}>Level Up!</Text>
            </Animated.View>
        </>
    );
});

// ─── AnimatedPlantedTree ───────────────────────────────────────────────────────
// Renders a single planted tree with level-up FX on stage advance.
// tileCenterX/Y is the center of the tile in screen space.
const AnimatedPlantedTree = React.memo(function AnimatedPlantedTree({
    tileCenterX,
    tileCenterY,
    zIndexBase,
    planted,
    xp,
    tileState,
    daysSinceLastXP,
}: {
    tileCenterX: number;
    tileCenterY: number;
    zIndexBase: number;
    planted: PlantedTree;
    xp: number;
    tileState: TileState;
    daysSinceLastXP: number;
}) {
    // Compute effective stage index (with withering penalty)
    const { index: stageIndex } = getPlantedTreeStageWithIndex(xp, planted.plantedAtXP);
    let effectiveStageIndex = stageIndex;
    if (tileState !== 'recovered') {
        if (tileState === 'dead') {
            const effectiveDays = Math.max(0, daysSinceLastXP - 1);
            effectiveStageIndex = stageIndex - Math.floor(effectiveDays);
        } else {
            effectiveStageIndex = stageIndex - 1;
        }
    }

    const isDead = effectiveStageIndex < 0;
    // Clamp upper bound defensively
    if (!isDead && effectiveStageIndex >= TREE_STAGES.length) {
        effectiveStageIndex = TREE_STAGES.length - 1;
    }
    let ptWidth: number, ptHeight: number, ptAsset: any;

    if (isDead) {
        ptWidth = SCALED_DEAD_TREE_WIDTH * 0.9;
        ptHeight = SCALED_DEAD_TREE_HEIGHT * 0.9;
        ptAsset = ASSETS.deadTree;
    } else {
        const effectiveStage = TREE_STAGES[effectiveStageIndex];
        const ptScale = effectiveStage.scale * 0.9;
        ptWidth = TREE_WIDTH * ptScale;
        ptHeight = TREE_HEIGHT * ptScale * TREE_SQUASH;
        ptAsset = ASSETS[effectiveStage.asset as keyof typeof ASSETS];
    }

    const catalogItem = planted.type !== 'Basic' ? TREE_CATALOG.find(t => t.id === planted.type) : null;
    // Use per-type custom sprite if available, otherwise fall back to tinted base sprite
    const stageName = !isDead ? TREE_STAGES[effectiveStageIndex]?.name : undefined;
    const customAssetKey = stageName ? catalogItem?.sprites?.[stageName as keyof NonNullable<typeof catalogItem>['sprites']] : undefined;
    if (customAssetKey && customAssetKey in ASSETS) {
        ptAsset = ASSETS[customAssetKey as keyof typeof ASSETS];
    }
    // Apply per-tree scale override if defined for this stage
    if (!isDead && stageName && catalogItem?.scaleOverrides) {
        const overrideScale = catalogItem.scaleOverrides[stageName as keyof NonNullable<typeof catalogItem>['scaleOverrides']];
        if (overrideScale !== undefined) {
            ptWidth  = TREE_WIDTH  * overrideScale;
            ptHeight = TREE_HEIGHT * overrideScale * TREE_SQUASH;
        }
    }
    const tintStyle = (!isDead && !customAssetKey && catalogItem?.tint) ? { tintColor: catalogItem.tint } : {};
    const offsetX = (!isDead && stageName && catalogItem?.offsetX)
        ? (catalogItem.offsetX[stageName as keyof NonNullable<typeof catalogItem>['offsetX']] ?? 0)
        : 0;
    const offsetY = (!isDead && stageName && catalogItem?.offsetY)
        ? (catalogItem.offsetY[stageName as keyof NonNullable<typeof catalogItem>['offsetY']] ?? 0)
        : 0;

    // Detect stage advances and fire level-up FX + scale bounce
    const prevStageIndexRef = useRef(effectiveStageIndex);
    const [fxTrigger, setFxTrigger] = useState(0);
    const treeSizeAnim = useRef(new Animated.Value(1)).current;
    const swayAnim     = useRef(new Animated.Value(0)).current;
    const swayDur      = 3200 + (Math.abs(tileCenterX * 7 + tileCenterY * 13) % 900);

    useEffect(() => {
        const halfDur = swayDur / 2;
        const loop = Animated.loop(Animated.sequence([
            Animated.timing(swayAnim, { toValue:  1, duration: halfDur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
            Animated.timing(swayAnim, { toValue:  0, duration: halfDur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
            Animated.timing(swayAnim, { toValue: -1, duration: halfDur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
            Animated.timing(swayAnim, { toValue:  0, duration: halfDur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]));
        loop.start();
        return () => loop.stop();
    }, []);

    useEffect(() => {
        if (effectiveStageIndex > prevStageIndexRef.current) {
            setFxTrigger(n => n + 1);
            Animated.sequence([
                Animated.spring(treeSizeAnim, { toValue: 1.25, tension: 120, friction: 4, useNativeDriver: false }),
                Animated.spring(treeSizeAnim, { toValue: 1, tension: 80, friction: 8, useNativeDriver: false }),
            ]).start();
        }
        prevStageIndexRef.current = effectiveStageIndex;
    }, [effectiveStageIndex]);

    const posX = tileCenterX - ptWidth / 2 + offsetX;
    const posY = tileCenterY - ptHeight * 0.75 + offsetY;

    return (
        <>
            {/* Outer view: sway rotation on native driver (smooth, no JS overhead) */}
            <Animated.View
                pointerEvents="none"
                style={{
                    position: 'absolute',
                    left: posX,
                    top: posY,
                    width: ptWidth,
                    height: ptHeight,
                    zIndex: zIndexBase + 1,
                    transformOrigin: 'center bottom',
                    transform: [
                        { rotate: swayAnim.interpolate({ inputRange: [-1, 1], outputRange: ['-0.03rad', '0.03rad'] }) },
                    ],
                }}
            >
                {/* Inner view: level-up scale on JS driver so the image is re-rendered
                    at full resolution every frame — eliminates the grainy texture-stretch
                    artifact that native driver causes by rasterising at 1× then stretching. */}
                <Animated.View
                    style={{
                        width: ptWidth,
                        height: ptHeight,
                        transformOrigin: 'center bottom',
                        transform: [{ scale: treeSizeAnim }],
                    }}
                >
                    <Image
                        source={ptAsset}
                        style={{ width: ptWidth, height: ptHeight, ...tintStyle }}
                        resizeMode="contain"
                    />
                </Animated.View>
            </Animated.View>
            <LevelUpFX
                centerX={tileCenterX}
                centerY={tileCenterY}
                treeHeight={ptHeight}
                zIndex={zIndexBase}
                triggerKey={fxTrigger}
            />
        </>
    );
});

// AnimatedTile component — keeps previous tile underneath to prevent black flash during swap
// Supports ripple animation: scale + opacity spring on state transition
// ─── Tile decoration data ─────────────────────────────────────────────────────
// Deterministic decoration placement per tile — seeded by row+col so positions
// are stable across re-renders while still looking sparse and random.
const DEAD_DECORATIONS = [ASSETS.deadGrassTuft, ASSETS.pebbles] as const;
const RECOVERED_DECORATIONS = [ASSETS.wildflowers, ASSETS.grassBlades, ASSETS.mushrooms, ASSETS.clovers] as const;
const DECO_SIZE = 16; // display size in px for each decoration sprite

function seededUnit(seed: number) {
    const x = Math.sin(seed * 12.9898) * 43758.5453;
    return x - Math.floor(x);
}

function getTileDecorations(row: number, col: number, state: TileState) {
    const seed = row * 92821 + col * 68917 + (state === 'dead' ? 11 : 29);
    const spawnRoll = seededUnit(seed + 1);
    let count = 0;

    // Sparse placement: many tiles intentionally get no decoration.
    if (state === 'dead') {
        if (spawnRoll < 0.40) count = 1;
        if (spawnRoll < 0.14) count = 2;
    } else if (state === 'recovered') {
        if (spawnRoll < 0.45) count = 1;
        if (spawnRoll < 0.16) count = 2;
    }
    if (count === 0) return [];

    const decorations: Array<{ asset: any; x: number; y: number; flipX: boolean }> = [];

    const pool = state === 'dead' ? DEAD_DECORATIONS : RECOVERED_DECORATIONS;

    for (let i = 0; i < count; i++) {
        const s = seed + i * 97;
        const asset = pool[Math.floor(seededUnit(s + 3) * pool.length)];
        // Position within inner diamond bounds to avoid edge clutter.
        const fx = seededUnit(s + 5) * 0.9 - 0.45;
        const fy = seededUnit(s + 7) * 0.6 - 0.3;
        const x = SCALED_WIDTH * 0.5 + fx * SCALED_WIDTH * 0.55 - DECO_SIZE / 2;
        const y = SCALED_HEIGHT * 0.5 + fy * SCALED_HEIGHT * 0.55 - DECO_SIZE / 2;
        const flipX = seededUnit(s + 11) > 0.5;
        decorations.push({ asset, x, y, flipX });
    }
    return decorations;
}

// ─── Ember Mote ──────────────────────────────────────────────────────────────
// Slow-drifting glowing ember sprite above dead tiles. Haunting atmospheric feel.
const EMBER_SIZE = 10;
const EmberMote = React.memo(function EmberMote({
    cx, cy, zIndex, seed,
}: { cx: number; cy: number; zIndex: number; seed: number }) {
    const opacity = useRef(new Animated.Value(0)).current;
    const tx = useRef(new Animated.Value(0)).current;
    const ty = useRef(new Animated.Value(0)).current;
    const dur = 6000 + (seed * 370) % 4000;
    const driftX = ((seed * 13 + 7) % 30) - 15;
    const driftY = -((seed * 11 + 3) % 20) - 10; // always floats upward
    const delay = (seed * 490) % 6000;

    useEffect(() => {
        const cycle = Animated.loop(Animated.sequence([
            Animated.parallel([
                Animated.sequence([
                    Animated.timing(opacity, { toValue: 0.6, duration: dur * 0.25, easing: Easing.out(Easing.quad), useNativeDriver: true }),
                    Animated.timing(opacity, { toValue: 0.5, duration: dur * 0.45, useNativeDriver: true }),
                    Animated.timing(opacity, { toValue: 0, duration: dur * 0.30, easing: Easing.in(Easing.quad), useNativeDriver: true }),
                ]),
                Animated.timing(tx, { toValue: driftX, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
                Animated.timing(ty, { toValue: driftY, duration: dur, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
            ]),
            Animated.parallel([
                Animated.timing(tx, { toValue: 0, duration: 1, useNativeDriver: true }),
                Animated.timing(ty, { toValue: 0, duration: 1, useNativeDriver: true }),
            ]),
            Animated.delay(2000 + (seed * 310) % 3000),
        ]));
        const t = setTimeout(() => cycle.start(), delay);
        return () => { clearTimeout(t); cycle.stop(); };
    }, []);

    return (
        <Animated.View pointerEvents="none" style={{
            position: 'absolute',
            left: cx - EMBER_SIZE / 2,
            top: cy - EMBER_SIZE - 5,
            width: EMBER_SIZE, height: EMBER_SIZE,
            zIndex: zIndex + 2,
            opacity,
            transform: [{ translateX: tx }, { translateY: ty }],
        }}>
            <Image source={ASSETS.emberMote} style={{ width: EMBER_SIZE, height: EMBER_SIZE }} resizeMode="contain" />
        </Animated.View>
    );
});

// ─── Dew Sparkle ─────────────────────────────────────────────────────────────
// Gentle pulsing dew drop on recovered tiles. 1-2 per tile.
const DEW_SIZE = 8;
const DewSparkle = React.memo(function DewSparkle({
    cx, cy, zIndex, seed,
}: { cx: number; cy: number; zIndex: number; seed: number }) {
    const opacity = useRef(new Animated.Value(0)).current;
    const dur = 3000 + (seed * 230) % 2000;
    const delay = (seed * 370) % 4000;

    useEffect(() => {
        const cycle = Animated.loop(Animated.sequence([
            Animated.timing(opacity, { toValue: 0.7, duration: dur * 0.4, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 0.1, duration: dur * 0.6, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]));
        const t = setTimeout(() => cycle.start(), delay);
        return () => { clearTimeout(t); cycle.stop(); };
    }, []);

    return (
        <Animated.View pointerEvents="none" style={{
            position: 'absolute',
            left: cx - DEW_SIZE / 2,
            top: cy - DEW_SIZE / 2,
            width: DEW_SIZE, height: DEW_SIZE,
            zIndex: zIndex + 2,
            opacity,
        }}>
            <Image source={ASSETS.dewSparkle} style={{ width: DEW_SIZE, height: DEW_SIZE }} resizeMode="contain" />
        </Animated.View>
    );
});

// Pre-computed wind shimmer phase type — shared across all tiles from one animation loop
type WindShimmerPhase = {
    opacity: Animated.AnimatedInterpolation<number>;
    translateX: Animated.AnimatedInterpolation<number>;
};

const AnimatedTile = React.memo(function AnimatedTile({
    row,
    col,
    state,
    hasTree,
    screenX,
    screenY,
    zIndex,
    animDelay,
    windShimmer,
}: {
    row: number;
    col: number;
    state: TileState;
    hasTree: boolean;
    screenX: number;
    screenY: number;
    zIndex: number;
    animDelay?: number; // ms delay for staggered ripple (undefined = no animation)
    windShimmer?: WindShimmerPhase;
}) {
    const prevStateRef = useRef<TileState>(state);
    const [prevState, setPrevState] = useState<TileState>(state);
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const opacityAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        if (prevStateRef.current !== state) {
            setPrevState(prevStateRef.current);
            prevStateRef.current = state;

            // Run ripple animation with stagger delay
            const delay = animDelay ?? 0;
            const runAnimation = () => {
                // Start from small + transparent
                scaleAnim.setValue(0.7);
                opacityAnim.setValue(0.3);

                Animated.parallel([
                    Animated.spring(scaleAnim, {
                        toValue: 1,
                        tension: 120,
                        friction: 8,
                        useNativeDriver: true,
                    }),
                    Animated.timing(opacityAnim, {
                        toValue: 1,
                        duration: 250,
                        easing: Easing.out(Easing.quad),
                        useNativeDriver: true,
                    }),
                ]).start(() => setPrevState(state));
            };

            if (delay > 0) {
                setTimeout(runAnimation, delay);
            } else {
                runAnimation();
            }
        }
    }, [state]);

    return (
        <View
            pointerEvents="none"
            style={{
                position: 'absolute',
                left: screenX,
                top: screenY,
                width: SCALED_WIDTH,
                height: SCALED_HEIGHT,
                zIndex,
            }}
        >
            <Animated.View style={{
                width: SCALED_WIDTH,
                height: SCALED_HEIGHT,
                transform: [{ scale: scaleAnim }],
                opacity: opacityAnim,
            }}>
                {/* Previous tile underneath as fallback to prevent black flash */}
                {prevState !== state && (
                    <Image
                        source={TILE_ASSETS[prevState]}
                        style={{ position: 'absolute', width: SCALED_WIDTH, height: SCALED_HEIGHT }}
                        resizeMode="contain"
                    />
                )}
                {/* Current tile on top */}
                <Image
                    source={TILE_ASSETS[state]}
                    style={{ position: 'absolute', width: SCALED_WIDTH, height: SCALED_HEIGHT }}
                    resizeMode="contain"
                />
                {/* Wind shimmer overlay — recovered tiles only, driven by shared animation */}
                {state === 'recovered' && windShimmer && (
                    <Animated.View pointerEvents="none" style={{
                        position: 'absolute',
                        width: SCALED_WIDTH,
                        height: SCALED_HEIGHT,
                        opacity: windShimmer.opacity,
                        transform: [{ translateX: windShimmer.translateX }],
                    }}>
                        <Image
                            source={TILE_ASSETS.recovered}
                            style={{ width: SCALED_WIDTH, height: SCALED_HEIGHT, tintColor: '#ffffff' }}
                            resizeMode="contain"
                        />
                    </Animated.View>
                )}
                {/* Tile decorations — small sprites scattered on the tile */}
                {!hasTree && (state === 'dead' || state === 'recovered') && getTileDecorations(row, col, state).map((deco, i) => (
                    <Image
                        key={`deco-${i}`}
                        source={deco.asset}
                        style={{
                            position: 'absolute',
                            left: deco.x,
                            top: deco.y,
                            width: DECO_SIZE,
                            height: DECO_SIZE,
                            transform: deco.flipX ? [{ scaleX: -1 }] : [],
                        }}
                        resizeMode="contain"
                    />
                ))}
            </Animated.View>
        </View>
    );
});

// ─── Isometric diamond hit-test ─────────────────────────────────────────────
// Converts a screen-space tap (relative to grid container) into the correct
// grid tile (row, col) using diamond (rhombus) hit-testing.
// Tile positions use rotateLocal, so we apply inverse rotation to map screen
// tap coordinates back to actual grid coordinates.
// Returns null if tapped outside all tiles.
function screenToTile(
    tapX: number,
    tapY: number,
    gridSize: number,
    rotation: number,
    startRow: number,
    startCol: number,
): { row: number; col: number } | null {
    const maxLocal = gridSize - 1;
    const centerOffsetX = maxLocal * STEP_X;

    // Convert tap to isometric coordinates:
    // screenX = (rCol - rRow) * STEP_X + centerOffsetX
    // screenY = (rCol + rRow) * STEP_Y
    // Tile center is offset by (SCALED_WIDTH/2, SCALED_HEIGHT/2) from top-left
    const relX = tapX - SCALED_WIDTH / 2 - centerOffsetX;
    const relY = tapY - SCALED_HEIGHT / 2;

    // Solve for fractional rotated-local coordinates
    const a = relX / STEP_X; // rCol - rRow
    const b = relY / STEP_Y; // rCol + rRow
    const fRCol = (a + b) / 2;
    const fRRow = (b - a) / 2;

    // Round to nearest tile
    const rCol = Math.round(fRCol);
    const rRow = Math.round(fRRow);

    // Diamond check: fractional distance from tile center must be <= 0.5
    const fracCol = Math.abs(fRCol - rCol);
    const fracRow = Math.abs(fRRow - rRow);
    if (fracCol + fracRow > 0.5) return null;

    // Bounds check
    if (rRow < 0 || rRow > maxLocal || rCol < 0 || rCol > maxLocal) return null;

    // Un-rotate to get actual grid coordinates
    const inverseRotation = ((4 - ((rotation % 4) + 4) % 4) % 4);
    const [localRow, localCol] = rotateLocal(rRow, rCol, inverseRotation, maxLocal);

    return { row: localRow + startRow, col: localCol + startCol };
}

// Get planted tree growth stage based on XP earned since planting
// Returns both the stage and the stage index (for decay regression)
const getPlantedTreeStageWithIndex = (currentXP: number, plantedAtXP: number) => {
    const treeXP = currentXP - plantedAtXP;
    for (let i = TREE_STAGES.length - 1; i >= 0; i--) {
        if (treeXP >= TREE_STAGES[i].minXP) {
            return { stage: TREE_STAGES[i], index: i };
        }
    }
    return { stage: TREE_STAGES[0], index: 0 };
};

// Chopping animation component — 3 distinct axe swings synced to Wood_Chopping_Noise.m4a
// The sound has 3 chop hits at ~0.5s, ~1.3s, ~2.3s in a 3s file.
// Chops 1 & 2: moderate swing (axe getting in). Chop 3: big swing (tree felled).
const CHOP_DURATION_MS = 3000; // Matches the full sound length

const ChoppingAnimation = React.memo(function ChoppingAnimation({
    onComplete,
}: {
    onComplete: () => void;
}) {
    const swingAnim = useRef(new Animated.Value(0.5)).current; // 0.5 = centered
    const treeShake = useRef(new Animated.Value(0)).current;
    const progressAnim = useRef(new Animated.Value(0)).current;
    const dissolveOpacity = useRef(new Animated.Value(1)).current;
    const dissolveScale = useRef(new Animated.Value(1)).current;
    const rewardOpacity = useRef(new Animated.Value(0)).current;
    const rewardTranslateY = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // Set audio mode
        Audio.setAudioModeAsync({
            playsInSilentModeIOS: true,
            shouldDuckAndroid: false,
            staysActiveInBackground: false,
        }).catch(() => {});

        let soundObj: Audio.Sound | null = null;
        let cancelled = false;

        // Preload sound first, then start animation + playback together
        Audio.Sound.createAsync(WOOD_CHOP_SOUND, { shouldPlay: false, volume: 0.7 })
            .then(async ({ sound }) => {
                if (cancelled) { sound.unloadAsync(); return; }
                soundObj = sound;
                sound.setOnPlaybackStatusUpdate((status) => {
                    if (status.isLoaded && status.didJustFinish) {
                        sound.unloadAsync();
                    }
                });
                // Start sound and animation in the same microtask — no await before startChopAnimation
                sound.playAsync().catch(() => {});
                startChopAnimation();
            })
            .catch(() => {
                // If sound fails, still run the animation
                if (!cancelled) startChopAnimation();
            });

        const startChopAnimation = () => {

        // ── Helper: one chop = swing + shake in sync ──
        // Wind-up lifts the axe BACK (negative rotation), then the strike swings it
        // DOWN/FORWARD (positive rotation) into the tree. The tree shakes at the
        // exact frame the strike peaks, not after.
        const makeChop = (amplitude: number, windUpDur: number, shakeIntensity: number) => {
            const strikeDur = windUpDur * 0.45;   // strike is fast and snappy
            const reboundDur = windUpDur * 0.7;
            const liftBack = 0.5 - 0.5 * amplitude;  // negative rotation = raise axe
            const strikeDown = 0.5 + 0.5 * amplitude; // positive rotation = swing into tree
            const shakeD = 35;

            return Animated.parallel([
                // Axe swing: lift back → strike down → rebound to center
                Animated.sequence([
                    Animated.timing(swingAnim, { toValue: liftBack,   duration: windUpDur, easing: Easing.out(Easing.quad),  useNativeDriver: false }),
                    Animated.timing(swingAnim, { toValue: strikeDown, duration: strikeDur, easing: Easing.in(Easing.cubic),  useNativeDriver: false }),
                    Animated.timing(swingAnim, { toValue: 0.5,        duration: reboundDur, easing: Easing.out(Easing.quad), useNativeDriver: false }),
                ]),
                // Tree shake fires at impact (after windUp + strikeDur)
                Animated.sequence([
                    Animated.delay(windUpDur + strikeDur),
                    Animated.timing(treeShake, { toValue:  shakeIntensity,       duration: shakeD, useNativeDriver: false }),
                    Animated.timing(treeShake, { toValue: -shakeIntensity * 0.6, duration: shakeD, useNativeDriver: false }),
                    Animated.timing(treeShake, { toValue:  shakeIntensity * 0.3, duration: shakeD, useNativeDriver: false }),
                    Animated.timing(treeShake, { toValue:  0,                    duration: shakeD, useNativeDriver: false }),
                ]),
            ]);
        };

        // ── 3-chop sequence synced to sound hits at ~0.5s, ~1.3s, ~2.3s ──
        const chopSequence = Animated.sequence([
            // Chop 1: moderate (wind-up 350ms + strike ~158ms + rebound ~245ms ≈ 753ms)
            // Impact at ~508ms — matches first sound hit at ~500ms
            makeChop(0.6, 350, 2.5),
            // Gap to chop 2
            Animated.delay(50),
            // Chop 2: slightly harder
            makeChop(0.65, 360, 3),
            // Gap to final chop
            Animated.delay(80),
            // Chop 3: big finishing blow — tree felled
            makeChop(0.9, 420, 6),
            // Let the final shake settle
            Animated.delay(120),
        ]);

        chopSequence.start(({ finished }) => {
            if (!finished) return;
            // ── Dissolve phase: fade + shrink tree, float "+5" reward ──
            Animated.parallel([
                Animated.timing(dissolveOpacity, {
                    toValue: 0,
                    duration: 600,
                    easing: Easing.out(Easing.quad),
                    useNativeDriver: false,
                }),
                Animated.timing(dissolveScale, {
                    toValue: 0.3,
                    duration: 600,
                    easing: Easing.in(Easing.quad),
                    useNativeDriver: false,
                }),
                Animated.sequence([
                    Animated.timing(rewardOpacity, { toValue: 1, duration: 150, useNativeDriver: false }),
                    Animated.delay(450),
                    Animated.timing(rewardOpacity, { toValue: 0, duration: 400, useNativeDriver: false }),
                ]),
                Animated.timing(rewardTranslateY, {
                    toValue: -40,
                    duration: 1000,
                    easing: Easing.out(Easing.quad),
                    useNativeDriver: false,
                }),
            ]).start(({ finished: dissolveFinished }) => {
                if (dissolveFinished) {
                    setTimeout(() => onComplete(), 100);
                }
            });
        });

        // Progress bar fills over the chop duration
        Animated.timing(progressAnim, {
            toValue: 1,
            duration: CHOP_DURATION_MS,
            easing: Easing.linear,
            useNativeDriver: false,
        }).start();

        }; // end startChopAnimation

        return () => {
            cancelled = true;
            if (soundObj) soundObj.unloadAsync().catch(() => {});
        };
    }, []);

    const rotation = swingAnim.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: ['-25deg', '0deg', '25deg'],
    });

    return (
        <>
            {/* Tree + axe wrapped in dissolve container */}
            <Animated.View style={{
                opacity: dissolveOpacity,
                transform: [{ scale: dissolveScale }, { translateX: treeShake }],
                width: SCALED_DEAD_TREE_WIDTH,
                height: SCALED_DEAD_TREE_HEIGHT,
            }}>
                {/* Swinging axe */}
                <Animated.View style={{
                    position: 'absolute',
                    top: SCALED_DEAD_TREE_HEIGHT * 0.05,
                    left: (SCALED_DEAD_TREE_WIDTH / 2) - 24,
                    width: 48,
                    height: 48,
                    zIndex: 10,
                    transform: [{ rotate: rotation }],
                }}>
                    <Image
                        source={ASSETS.axeIcon}
                        style={{
                            width: 48,
                            height: 48,
                            shadowColor: '#000000',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.3,
                            shadowRadius: 3,
                        }}
                        resizeMode="contain"
                    />
                </Animated.View>

                {/* Dead tree image */}
                <Image
                    source={ASSETS.deadTree}
                    style={{ width: SCALED_DEAD_TREE_WIDTH, height: SCALED_DEAD_TREE_HEIGHT }}
                    resizeMode="contain"
                />
            </Animated.View>

            {/* Progress bar below tree */}
            <Animated.View style={{
                position: 'absolute',
                bottom: 0,
                left: SCALED_DEAD_TREE_WIDTH * 0.15,
                width: SCALED_DEAD_TREE_WIDTH * 0.7,
                height: 4,
                backgroundColor: 'rgba(0,0,0,0.3)',
                borderRadius: 2,
                overflow: 'hidden',
                opacity: dissolveOpacity,
            }}>
                <Animated.View style={{
                    width: progressAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0%', '100%'],
                    }),
                    height: '100%',
                    backgroundColor: '#4ade80',
                }} />
            </Animated.View>

            {/* "+5" reward text floats up */}
            <Animated.View style={{
                position: 'absolute',
                top: SCALED_DEAD_TREE_HEIGHT * 0.25,
                left: 0,
                right: 0,
                alignItems: 'center',
                opacity: rewardOpacity,
                transform: [{ translateY: rewardTranslateY }],
            }}>
                <Text style={{
                    color: '#fbbf24',
                    fontWeight: 'bold',
                    fontSize: 16,
                    textShadowColor: 'rgba(0,0,0,0.7)',
                    textShadowOffset: { width: 0, height: 1 },
                    textShadowRadius: 3,
                }}>+5</Text>
            </Animated.View>
        </>
    );
});

interface IsometricGridProps {
    xp: number;
    gridSize: number;
    rotation: number;
    getTileState: (row: number, col: number) => TileState;
    isDeadTreeRemoved: (row: number, col: number) => boolean;
    getPlantedTree: (row: number, col: number) => PlantedTree | null;
    choppingTrees: Set<string>;
    daysSinceLastXP: number;
    pendingTransitions?: TileTransition[];
    onTilePress?: (row: number, col: number, state: TileState) => void;
    onDeadTreePress?: (row: number, col: number) => void;
    onPlantPress?: (row: number, col: number) => void;
    onPlantedTreePress?: (row: number, col: number) => void;
    onChoppingComplete?: (row: number, col: number) => void;
    onStageChange?: (stage: string) => void;
    isZoomedOut?: boolean;
    onCenterTreeLoaded?: () => void;
}

function IsometricGrid({
    xp = 0,
    gridSize = 5,
    rotation = 0,
    getTileState,
    isDeadTreeRemoved,
    getPlantedTree,
    choppingTrees,
    daysSinceLastXP,
    pendingTransitions,
    onTilePress,
    onDeadTreePress,
    onPlantPress,
    onPlantedTreePress,
    onChoppingComplete,
    onStageChange,
    isZoomedOut = false,
    onCenterTreeLoaded,
}: IsometricGridProps) {
    const [currentStage, setCurrentStage] = useState(getTreeStage(xp));
    const glowAnim  = useRef(new Animated.Value(0)).current;
    const scaleAnim  = useRef(new Animated.Value(1)).current;
    const centerSwayAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const loop = Animated.loop(Animated.sequence([
            Animated.timing(centerSwayAnim, { toValue:  1, duration: 1750, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
            Animated.timing(centerSwayAnim, { toValue:  0, duration: 1750, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
            Animated.timing(centerSwayAnim, { toValue: -1, duration: 1750, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
            Animated.timing(centerSwayAnim, { toValue:  0, duration: 1750, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]));
        loop.start();
        return () => loop.stop();
    }, []);

    const [prevStageName, setPrevStageName] = useState(currentStage.name);

    // ─── Center-tree level-up FX ────────────────────────────────────────────────
    // triggerKey increments on each stage advance; <LevelUpFX> handles the animation.
    const [centerFxTrigger, setCenterFxTrigger] = useState(0);

    // Dead trees visible in current grid
    const visibleDeadTrees = useMemo(() => {
        const maxCenter = 10; // center of MAX_GRID_SIZE=21
        const half = Math.floor(gridSize / 2);
        return ALL_DEAD_TREE_POSITIONS.filter(({ row, col }) => {
            // Must be within current visible grid
            if (Math.abs(row - maxCenter) > half || Math.abs(col - maxCenter) > half) return false;
            // Only hide if the tree was explicitly removed by user
            if (isDeadTreeRemoved(row, col)) return false;
            return true;
        });
    }, [gridSize, isDeadTreeRemoved]);

    // Update tree stage when XP changes
    useEffect(() => {
        const newStage = getTreeStage(xp);
        if (newStage.name !== prevStageName) {
            // Stage changed! Play celebration animation
            setPrevStageName(newStage.name);
            setCurrentStage(newStage);
            onStageChange?.(newStage.name);

            // ── Glow and scale bounce ──────────────────────────────────────────
            Animated.parallel([
                Animated.sequence([
                    Animated.timing(glowAnim, {
                        toValue: 1,
                        duration: 300,
                        useNativeDriver: true,
                    }),
                    Animated.timing(glowAnim, {
                        toValue: 0,
                        duration: 800,
                        useNativeDriver: true,
                    }),
                ]),
                Animated.sequence([
                    Animated.spring(scaleAnim, {
                        toValue: 1.25,
                        tension: 120,
                        friction: 4,
                        useNativeDriver: true,
                    }),
                    Animated.spring(scaleAnim, {
                        toValue: 1,
                        tension: 80,
                        friction: 8,
                        useNativeDriver: true,
                    }),
                ]),
            ]).start();

            // ── Level-up FX: delegated to LevelUpFX component ─────────────────
            setCenterFxTrigger(n => n + 1);
        } else {
            setCurrentStage(newStage);
        }
    }, [xp]);

    // Calculate tree dimensions based on current stage
    const treeScale = currentStage.scale;
    const scaledTreeWidth = TREE_WIDTH * treeScale;
    const scaledTreeHeight = TREE_HEIGHT * treeScale * TREE_SQUASH;
    const treeAsset = ASSETS[currentStage.asset as keyof typeof ASSETS];

    // We render only the visible portion of the MAX_GRID_SIZE=21 coordinate space
    const maxCenter = 10; // Math.floor(21 / 2)
    const half = Math.floor(gridSize / 2);
    const startRow = maxCenter - half;
    const endRow = maxCenter + half;
    const startCol = maxCenter - half;
    const endCol = maxCenter + half;

    // Offset to center the isometric diamond
    const centerOffsetX = (gridSize - 1) * STEP_X;
    const maxLocal = gridSize - 1;

    // ─── Shared wind shimmer — 1 animation loop, 8 phase groups ────────────
    // Instead of 200+ per-tile Animated.loops, one native-driven value drives all tiles.
    // Each tile picks a pre-interpolated phase based on (row+col) for a wave-sweep effect.
    const windAnim = useRef(new Animated.Value(0)).current;
    const windPhases = useRef<WindShimmerPhase[]>(
        Array.from({ length: 8 }, (_, i) => {
            const phase = i / 8;
            const shifted = Animated.add(windAnim, phase);
            return {
                opacity: shifted.interpolate({
                    inputRange: [phase, phase + 0.5, phase + 1.0],
                    outputRange: [0, 0.06, 0],
                }),
                translateX: shifted.interpolate({
                    inputRange: [phase, phase + 0.5, phase + 1.0],
                    outputRange: [-4, 4, -4],
                }),
            };
        })
    ).current;

    useEffect(() => {
        const loop = Animated.loop(
            Animated.timing(windAnim, { toValue: 1, duration: 10000, easing: Easing.linear, useNativeDriver: true })
        );
        loop.start();
        return () => loop.stop();
    }, []);

    // Build animation delay map from pending transitions
    // Stagger: 120ms per ring distance from center, so inner tiles animate first
    const animDelayMap = useMemo(() => {
        const map = new Map<string, number>();
        if (!pendingTransitions || pendingTransitions.length === 0) return map;
        const minRing = Math.min(...pendingTransitions.map(t => t.ring));
        for (const t of pendingTransitions) {
            const ringOffset = t.ring - minRing;
            map.set(`${t.row},${t.col}`, ringOffset * 120);
        }
        return map;
    }, [pendingTransitions]);

    // Build dead-tree lookup set for O(1) checks instead of O(n) .some() per tile
    const deadTreeSet = useMemo(() => {
        const s = new Set<string>();
        for (const dt of visibleDeadTrees) s.add(`${dt.row},${dt.col}`);
        return s;
    }, [visibleDeadTrees]);

    // Tiles that currently have any tree asset on them (main, planted, or dead).
    const treeOccupiedTileSet = useMemo(() => {
        const set = new Set<string>();
        set.add(`${maxCenter},${maxCenter}`); // main center tree

        for (const dt of visibleDeadTrees) {
            set.add(`${dt.row},${dt.col}`);
        }

        for (let row = startRow; row <= endRow; row++) {
            for (let col = startCol; col <= endCol; col++) {
                if (row === maxCenter && col === maxCenter) continue;
                if (getPlantedTree(row, col)) {
                    set.add(`${row},${col}`);
                }
            }
        }

        return set;
    }, [startRow, endRow, startCol, endCol, maxCenter, visibleDeadTrees, getPlantedTree]);

    // ─── Tap highlight state ─────────────────────────────────────────────────
    const [tapHighlight, setTapHighlight] = useState<{ x: number; y: number; zIndex: number; tileState: TileState } | null>(null);
    const tapHighlightOpacity = useRef(new Animated.Value(0)).current;

    const showTapHighlight = useCallback((row: number, col: number) => {
        const localRow = row - startRow;
        const localCol = col - startCol;
        const [rRow, rCol] = rotateLocal(localRow, localCol, rotation, maxLocal);
        const screenX = (rCol - rRow) * STEP_X + centerOffsetX;
        const screenY = (rCol + rRow) * STEP_Y;
        const state = getTileState(row, col);
        setTapHighlight({ x: screenX, y: screenY, zIndex: rRow + rCol + 100, tileState: state });
        tapHighlightOpacity.setValue(0.65);
        Animated.timing(tapHighlightOpacity, {
            toValue: 0,
            duration: 600,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
        }).start(() => setTapHighlight(null));
    }, [startRow, startCol, rotation, maxLocal, centerOffsetX, tapHighlightOpacity, getTileState]);

    // ─── Grid-level tap handler with isometric diamond hit-testing ────────────
    const handleGridTap = useCallback((x: number, y: number) => {
        const hit = screenToTile(x, y, gridSize, rotation, startRow, startCol);
        if (!hit) return;
        const { row, col } = hit;
        const state = getTileState(row, col);

        // Show tap highlight on recovered tiles only
        if (state === 'recovered') {
            showTapHighlight(row, col);
        }

        const hasDeadTree = deadTreeSet.has(`${row},${col}`);
        const isBeingChopped = choppingTrees.has(`${row},${col}`);

        if (isBeingChopped) return;

        if (hasDeadTree && (state === 'recovering' || state === 'recovered') && onDeadTreePress) {
            onDeadTreePress(row, col);
        } else if (state === 'recovering' && onTilePress) {
            onTilePress(row, col, state);
        } else if (state === 'recovered') {
            if (row === maxCenter && col === maxCenter) return;
            const planted = getPlantedTree(row, col);
            if (!planted && onPlantPress) {
                onPlantPress(row, col);
            } else if (planted && onPlantedTreePress) {
                const { index: stageIndex } = getPlantedTreeStageWithIndex(xp, planted.plantedAtXP);
                if (stageIndex >= 0) {
                    onPlantedTreePress(row, col);
                }
            }
        }
    }, [gridSize, rotation, startRow, startCol, getTileState, deadTreeSet, choppingTrees,
        onDeadTreePress, onTilePress, onPlantPress, onPlantedTreePress, getPlantedTree, xp, showTapHighlight]);

    // TapGestureHandler state change — fires with coordinates relative to the grid container
    const onTapStateChange = useCallback((event: TapGestureHandlerStateChangeEvent) => {
        if (event.nativeEvent.state === State.ACTIVE) {
            handleGridTap(event.nativeEvent.x, event.nativeEvent.y);
        }
    }, [handleGridTap]);

    // Memoize the tile elements — only rebuilt when grid state actually changes
    const tiles = useMemo(() => {
        const result: React.ReactElement[] = [];
        for (let row = startRow; row <= endRow; row++) {
            for (let col = startCol; col <= endCol; col++) {
                const localRow = row - startRow;
                const localCol = col - startCol;
                const [rRow, rCol] = rotateLocal(localRow, localCol, rotation, maxLocal);
                const screenX = (rCol - rRow) * STEP_X + centerOffsetX;
                const screenY = (rCol + rRow) * STEP_Y;
                const state = getTileState(row, col);
                const hasTree = treeOccupiedTileSet.has(`${row},${col}`);

                result.push(
                    <AnimatedTile
                        key={`${row}-${col}`}
                        row={row}
                        col={col}
                        state={state}
                        hasTree={hasTree}
                        screenX={screenX}
                        screenY={screenY}
                        zIndex={rRow + rCol}
                        animDelay={animDelayMap.get(`${row},${col}`)}
                        windShimmer={windPhases[(row + col * 2) % 8]}
                    />
                );
            }
        }
        return result;
    }, [startRow, endRow, startCol, endCol, rotation, maxLocal, centerOffsetX, getTileState, animDelayMap, treeOccupiedTileSet]);

    // Memoize ambient tile effects — embers on dead, dew sparkles on recovered
    const tileEffects = useMemo(() => {
        if (isZoomedOut) return [];
        const effects: React.ReactElement[] = [];
        for (let row = startRow; row <= endRow; row++) {
            for (let col = startCol; col <= endCol; col++) {
                const state = getTileState(row, col);
                const localRow = row - startRow;
                const localCol = col - startCol;
                const [rRow, rCol] = rotateLocal(localRow, localCol, rotation, maxLocal);
                const screenX = (rCol - rRow) * STEP_X + centerOffsetX;
                const screenY = (rCol + rRow) * STEP_Y;
                const tileCX = screenX + SCALED_WIDTH / 2;
                const tileCY = screenY + SCALED_HEIGHT / 2;
                const zIdx = rRow + rCol;
                const seed = row * 17 + col * 31;
                const hasTree = treeOccupiedTileSet.has(`${row},${col}`);

                if (hasTree) continue;

                if (state === 'dead') {
                    // Sparse embers on dead tiles.
                    if (seed % 100 < 16) {
                        effects.push(
                            <EmberMote key={`ember-${row}-${col}`} cx={tileCX} cy={tileCY} zIndex={zIdx} seed={seed} />
                        );
                    }
                }
            }
        }
        return effects;
    }, [isZoomedOut, startRow, endRow, startCol, endCol, rotation, maxLocal, centerOffsetX, getTileState, treeOccupiedTileSet]);

    // Memoize dead tree elements
    const deadTreeElements = useMemo(() => {
        return visibleDeadTrees.map(({ row, col }) => {
            const localRow = row - startRow;
            const localCol = col - startCol;
            const [rRow, rCol] = rotateLocal(localRow, localCol, rotation, maxLocal);
            const deadTreeX = (rCol - rRow) * STEP_X + centerOffsetX;
            const deadTreeY = (rCol + rRow) * STEP_Y;
            const zIdx = rRow + rCol;
            const posX = deadTreeX + (SCALED_WIDTH / 2) - (SCALED_DEAD_TREE_WIDTH / 2);
            const posY = deadTreeY + (SCALED_HEIGHT / 2) - (SCALED_DEAD_TREE_HEIGHT * 0.75);

            const tileState = getTileState(row, col);
            const isTappable = (tileState === 'recovering' || tileState === 'recovered') && onDeadTreePress;
            const isBeingChopped = choppingTrees.has(`${row},${col}`);

            if (isTappable) {
                if (isBeingChopped) {
                    return (
                        <View
                            key={`dead-tree-${row}-${col}`}
                            pointerEvents="none"
                            style={{
                                position: 'absolute',
                                left: posX,
                                top: posY,
                                width: SCALED_DEAD_TREE_WIDTH,
                                height: SCALED_DEAD_TREE_HEIGHT,
                                zIndex: zIdx + 1,
                            }}
                        >
                            <ChoppingAnimation
                                onComplete={() => onChoppingComplete?.(row, col)}
                            />
                        </View>
                    );
                }

                return (
                    <View
                        key={`dead-tree-${row}-${col}`}
                        pointerEvents="none"
                        style={{
                            position: 'absolute',
                            left: posX,
                            top: posY,
                            width: SCALED_DEAD_TREE_WIDTH,
                            height: SCALED_DEAD_TREE_HEIGHT,
                            zIndex: zIdx + 1,
                        }}
                    >
                        <View style={{
                            position: 'absolute',
                            top: SCALED_DEAD_TREE_HEIGHT * 0.05,
                            left: (SCALED_DEAD_TREE_WIDTH / 2) - 24,
                            width: 48,
                            height: 48,
                            zIndex: 10,
                            shadowColor: '#ffffff',
                            shadowOffset: { width: 0, height: 0 },
                            shadowOpacity: 0.9,
                            shadowRadius: 3,
                        }}>
                            <Image
                                source={ASSETS.axeIcon}
                                style={{
                                    width: 48,
                                    height: 48,
                                    shadowColor: '#000000',
                                    shadowOffset: { width: 0, height: 2 },
                                    shadowOpacity: 0.3,
                                    shadowRadius: 3,
                                }}
                                resizeMode="contain"
                            />
                        </View>
                        <Image
                            source={ASSETS.deadTree}
                            style={{ width: SCALED_DEAD_TREE_WIDTH, height: SCALED_DEAD_TREE_HEIGHT }}
                            resizeMode="contain"
                        />
                    </View>
                );
            }

            return (
                <View
                    key={`dead-tree-${row}-${col}`}
                    pointerEvents="none"
                    style={{
                        position: 'absolute',
                        left: posX,
                        top: posY,
                        width: SCALED_DEAD_TREE_WIDTH,
                        height: SCALED_DEAD_TREE_HEIGHT,
                        zIndex: zIdx + 1,
                    }}
                >
                    <Image
                        source={ASSETS.deadTree}
                        style={{ width: SCALED_DEAD_TREE_WIDTH, height: SCALED_DEAD_TREE_HEIGHT }}
                        resizeMode="contain"
                    />
                </View>
            );
        });
    }, [visibleDeadTrees, gridSize, rotation, getTileState, choppingTrees, onDeadTreePress, onChoppingComplete]);

    // Memoize planted tree elements — each renders as an AnimatedPlantedTree component
    // which owns its own stage-tracking state and level-up FX
    const plantedTreeElements = useMemo(() => {
        const elements: React.ReactElement[] = [];
        for (let row = startRow; row <= endRow; row++) {
            for (let col = startCol; col <= endCol; col++) {
                if (row === maxCenter && col === maxCenter) continue;
                const planted = getPlantedTree(row, col);
                if (!planted) continue;

                const tileState = getTileState(row, col);
                const localRow = row - startRow;
                const localCol = col - startCol;
                const [rRow, rCol] = rotateLocal(localRow, localCol, rotation, maxLocal);
                const tileX = (rCol - rRow) * STEP_X + centerOffsetX;
                const tileY = (rCol + rRow) * STEP_Y;
                const tileCenterX = tileX + SCALED_WIDTH / 2;
                const tileCenterY = tileY + SCALED_HEIGHT / 2;

                elements.push(
                    <AnimatedPlantedTree
                        key={`planted-${row}-${col}`}
                        tileCenterX={tileCenterX}
                        tileCenterY={tileCenterY}
                        zIndexBase={rRow + rCol}
                        planted={planted}
                        xp={xp}
                        tileState={tileState}
                        daysSinceLastXP={daysSinceLastXP}
                    />
                );
            }
        }
        return elements;
    }, [gridSize, rotation, xp, getPlantedTree, getTileState, daysSinceLastXP]);

    // Center tile position for main tree
    const centerLocalRow = maxCenter - startRow;
    const centerLocalCol = maxCenter - startCol;
    const [rCenterRow, rCenterCol] = rotateLocal(centerLocalRow, centerLocalCol, rotation, maxLocal);
    const centerTileX = (rCenterCol - rCenterRow) * STEP_X + centerOffsetX;
    const centerTileY = (rCenterCol + rCenterRow) * STEP_Y;

    // Container sized to fit the isometric diamond
    const containerWidth = (gridSize - 1) * STEP_X * 2 + SCALED_WIDTH;
    const containerHeight = (gridSize - 1) * STEP_Y * 2 + SCALED_HEIGHT;

    // Center point of the center tile in screen space — anchor for level-up FX
    const fxCenterX = centerTileX + SCALED_WIDTH / 2;
    const fxCenterY = centerTileY + SCALED_HEIGHT / 2;

    // Touch-blocking is handled externally via pointerEvents on the wrapper.
    return (
        <TapGestureHandler
            onHandlerStateChange={onTapStateChange}
        >
            <View
                style={{
                    position: 'relative',
                    width: containerWidth,
                    height: containerHeight,
                }}
            >
            {tiles}

            {/* Ambient tile effects — embers & dew sparkles */}
            {tileEffects}

            {/* Tap highlight — subtle outline around diamond edge of tapped tile */}
            {tapHighlight && (
                <Animated.View
                    pointerEvents="none"
                    style={{
                        position: 'absolute',
                        left: tapHighlight.x,
                        top: tapHighlight.y,
                        width: SCALED_WIDTH,
                        height: SCALED_HEIGHT,
                        zIndex: tapHighlight.zIndex,
                        opacity: tapHighlightOpacity,
                    }}
                >
                    <Image
                        source={TILE_ASSETS[tapHighlight.tileState]}
                        style={{ width: SCALED_WIDTH, height: SCALED_HEIGHT, tintColor: '#ffffff' }}
                        resizeMode="contain"
                    />
                </Animated.View>
            )}
            
            {/* Dead trees on dead/recovering tiles (memoized) */}
            {deadTreeElements}
            
            {/* Planted trees on recovered tiles (memoized) */}
            {plantedTreeElements}

            {/* Main tree on center tile - changes based on XP */}
            <Animated.View
                pointerEvents="none"
                style={{
                    position: 'absolute',
                    left: centerTileX + (SCALED_WIDTH / 2) - (scaledTreeWidth / 2),
                    top: centerTileY + (SCALED_HEIGHT / 2) - (scaledTreeHeight * 0.75),
                    width: scaledTreeWidth,
                    height: scaledTreeHeight,
                    zIndex: rCenterRow + rCenterCol + 1,
                    transformOrigin: 'center bottom',
                    transform: [
                        { scale: scaleAnim },
                        { rotate: centerSwayAnim.interpolate({ inputRange: [-1, 1], outputRange: ['-0.03rad', '0.03rad'] }) },
                    ],
                }}
            >
                {/* Glow effect behind tree */}
                <Animated.View
                    style={{
                        position: 'absolute',
                        width: scaledTreeWidth * 1.5,
                        height: scaledTreeHeight * 0.8,
                        borderRadius: scaledTreeWidth,
                        backgroundColor: '#4ade80',
                        opacity: glowAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, 0.4],
                        }),
                        top: scaledTreeHeight * 0.3,
                        left: -scaledTreeWidth * 0.25,
                    }}
                />
                <Image
                    source={treeAsset}
                    style={{
                        width: scaledTreeWidth,
                        height: scaledTreeHeight,
                    }}
                    resizeMode="contain"
                    onLoad={onCenterTreeLoaded}
                />
            </Animated.View>

            {/* ── Level-up FX for center tree ──────────────────────────────── */}
            <LevelUpFX
                centerX={fxCenterX}
                centerY={fxCenterY}
                treeHeight={scaledTreeHeight}
                zIndex={rCenterRow + rCenterCol}
                triggerKey={centerFxTrigger}
            />
            </View>
        </TapGestureHandler>
    );
}

const MemoIsometricGrid = React.memo(IsometricGrid);

interface GardenSceneProps {
    xp?: number;
    gridSize?: number;
    getTileState: (row: number, col: number) => TileState;
    isDeadTreeRemoved: (row: number, col: number) => boolean;
    getPlantedTree: (row: number, col: number) => PlantedTree | null;
    choppingTrees: Set<string>;
    daysSinceLastXP?: number;
    pendingTransitions?: TileTransition[];
    onTilePress?: (row: number, col: number, state: TileState) => void;
    onDeadTreePress?: (row: number, col: number) => void;
    onPlantPress?: (row: number, col: number) => void;
    onPlantedTreePress?: (row: number, col: number) => void;
    onChoppingComplete?: (row: number, col: number) => void;
    frozen?: boolean;
    onRenderReady?: () => void;
}

export const GardenScene = React.memo(function GardenScene({
    xp = 0,
    gridSize = 5,
    getTileState,
    isDeadTreeRemoved,
    getPlantedTree,
    choppingTrees,
    daysSinceLastXP = 0,
    pendingTransitions,
    onTilePress,
    onDeadTreePress,
    onPlantPress,
    onPlantedTreePress,
    onChoppingComplete,
    frozen = false,
    onRenderReady,
}: GardenSceneProps) {
    // ── Fire onRenderReady when the center tree image actually decodes ──────
    // onLoad fires on the native thread once the bitmap is decoded and ready
    // to paint — a true signal that the garden's most prominent element is visible.
    const renderReadyFired = useRef(false);
    const handleCenterTreeLoaded = useCallback(() => {
        if (renderReadyFired.current || !onRenderReady) return;
        renderReadyFired.current = true;
        onRenderReady();
    }, [onRenderReady]);

    // ── Native-driver opacity for freeze — no React re-render ──────────────
    // We use an Animated.Value instead of useState so that hiding/showing the
    // garden when a modal opens doesn't trigger React reconciliation (which
    // would force IsometricGrid to re-render all N×N tiles).
    // Delayed 80ms on freeze to filter transient flickers from notifications.
    const gardenOpacity = useRef(new Animated.Value(frozen ? 0 : 1)).current;
    const frozenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => {
        if (frozen) {
            frozenTimerRef.current = setTimeout(() => {
                Animated.timing(gardenOpacity, { toValue: 0, duration: 0, useNativeDriver: true }).start();
            }, 80);
        } else {
            if (frozenTimerRef.current) {
                clearTimeout(frozenTimerRef.current);
                frozenTimerRef.current = null;
            }
            Animated.timing(gardenOpacity, { toValue: 1, duration: 0, useNativeDriver: true }).start();
        }
        return () => {
            if (frozenTimerRef.current) clearTimeout(frozenTimerRef.current);
        };
    }, [frozen]);
    // ── Particle count based on grown/flourishing trees ───────────────────
    // Compute screen positions of mature trees for tree-anchored pollen motes.
    // Also count mature trees for falling leaves (ambient, not tree-anchored).
    const { treePositions, leafCount } = useMemo(() => {
        const positions: { x: number; y: number; isFlourishing: boolean }[] = [];
        let grownCount = 0;
        const half = Math.floor(gridSize / 2);
        const maxCenter = 10;
        const startRow = maxCenter - half;
        const startCol = maxCenter - half;
        const maxLocal = gridSize - 1;
        const centerOffsetX = maxLocal * STEP_X;

        for (let row = 0; row < gridSize; row++) {
            for (let col = 0; col < gridSize; col++) {
                const planted = getPlantedTree(startRow + row, startCol + col);
                if (!planted) continue;
                const treeXP = xp - planted.plantedAtXP;
                const stage = getTreeStage(treeXP);
                if (stage.name === 'grown' || stage.name === 'flourishing') {
                    grownCount++;
                    // Compute screen position in the grid's coordinate space
                    const [rRow, rCol] = rotateLocal(row, col, 0, maxLocal);
                    const tileX = (rCol - rRow) * STEP_X + centerOffsetX;
                    const tileY = (rCol + rRow) * STEP_Y;
                    const tileCX = tileX + SCALED_WIDTH / 2;
                    const tileCY = tileY + SCALED_HEIGHT / 2;
                    positions.push({ x: tileCX, y: tileCY, isFlourishing: stage.name === 'flourishing' });
                }
            }
        }

        // Also check center tree (main tree)
        const centerStage = getTreeStage(xp);
        if (centerStage.name === 'grown' || centerStage.name === 'flourishing') {
            grownCount++;
            const cHalf = Math.floor(gridSize / 2);
            const [rRow, rCol] = rotateLocal(cHalf, cHalf, 0, maxLocal);
            const tileX = (rCol - rRow) * STEP_X + centerOffsetX;
            const tileY = (rCol + rRow) * STEP_Y;
            positions.push({ x: tileX + SCALED_WIDTH / 2, y: tileY + SCALED_HEIGHT / 2, isFlourishing: centerStage.name === 'flourishing' });
        }

        return {
            treePositions: positions,
            leafCount: Math.min(LEAF_COUNT, Math.round(grownCount * 0.75)),
        };
    }, [gridSize, xp, getPlantedTree]);

    // ── Gesture translation: fully on UI thread via Reanimated ──────────────
    // ── Gesture translation: offset (committed) + drag (live) ─────────────
    // Both driven on the native thread — zero JS involvement during drag or fling.
    const baseX  = useRef(new Animated.Value(0)).current;
    const baseY  = useRef(new Animated.Value(0)).current;
    const dragX  = useRef(new Animated.Value(0)).current;
    const dragY  = useRef(new Animated.Value(0)).current;
    // Animated.add produces a native-driver-compatible derived value
    const panX   = useRef(Animated.add(baseX, dragX)).current;
    const panY   = useRef(Animated.add(baseY, dragY)).current;
    const baseScaleAnim  = useRef(new Animated.Value(1)).current;
    const pinchScaleAnim = useRef(new Animated.Value(1)).current;
    const displayScale   = useRef(Animated.multiply(baseScaleAnim, pinchScaleAnim)).current;

    const lastBaseX   = useRef(0);
    const lastBaseY   = useRef(0);
    const baseScale   = useRef(1);
    const momentumRef = useRef<Animated.CompositeAnimation | null>(null);

    const [isZoomedOut, setIsZoomedOut] = useState(false);

    const pinchRef = useRef(null);
    const panRef   = useRef(null);

    // Native-driven: translationX/Y map straight to dragX/Y with no JS hop
    const onPanGestureEvent = Animated.event(
        [{ nativeEvent: { translationX: dragX, translationY: dragY } }],
        { useNativeDriver: true },
    );

    const onPinchGestureEvent = Animated.event(
        [{ nativeEvent: { scale: pinchScaleAnim } }],
        { useNativeDriver: true },
    );

    const onPinchStateChange = (event: any) => {
        if (event.nativeEvent.state === State.END || event.nativeEvent.state === State.CANCELLED) {
            const raw = baseScale.current * event.nativeEvent.scale;
            const clamped = Math.max(0.2, Math.min(4, raw));
            baseScale.current = clamped;
            baseScaleAnim.setValue(clamped);
            pinchScaleAnim.setValue(1);
            const nowZoomedOut = clamped < 0.5;
            setIsZoomedOut(prev => prev === nowZoomedOut ? prev : nowZoomedOut);
        }
    };

    // Stop any running decay and sync the native value back to the JS ref.
    const stopMomentum = (onSynced?: (x: number, y: number) => void) => {
        if (momentumRef.current) {
            momentumRef.current.stop();
            momentumRef.current = null;
            let sx = lastBaseX.current, sy = lastBaseY.current;
            let doneX = false, doneY = false;
            const check = () => { if (doneX && doneY) onSynced?.(sx, sy); };
            baseX.stopAnimation(v => { sx = v; doneX = true; check(); });
            baseY.stopAnimation(v => { sy = v; doneY = true; check(); });
        } else {
            onSynced?.(lastBaseX.current, lastBaseY.current);
        }
    };

    const onPanStateChange = (event: any) => {
        const { state, velocityX, velocityY, translationX, translationY } = event.nativeEvent;

        if (state === State.BEGAN) {
            stopMomentum((x, y) => {
                lastBaseX.current = x;
                lastBaseY.current = y;
                baseX.setValue(x);
                baseY.setValue(y);
                dragX.setValue(0);
                dragY.setValue(0);
            });
        }

        if (state === State.END || state === State.CANCELLED || state === State.FAILED) {
            const newBaseX = lastBaseX.current + translationX;
            const newBaseY = lastBaseY.current + translationY;

            baseX.setValue(newBaseX);
            baseY.setValue(newBaseY);
            dragX.setValue(0);
            dragY.setValue(0);
            lastBaseX.current = newBaseX;
            lastBaseY.current = newBaseY;

            const speed = Math.sqrt(velocityX ** 2 + velocityY ** 2);
            if (state === State.END && speed > 80) {
                momentumRef.current = Animated.parallel([
                    Animated.decay(baseX, { velocity: velocityX / 1000, deceleration: 0.998, useNativeDriver: true }),
                    Animated.decay(baseY, { velocity: velocityY / 1000, deceleration: 0.998, useNativeDriver: true }),
                ]);
                momentumRef.current.start(({ finished }) => {
                    momentumRef.current = null;
                    if (finished) {
                        baseX.stopAnimation(v => { lastBaseX.current = v; });
                        baseY.stopAnimation(v => { lastBaseY.current = v; });
                    }
                });
            }
        }
    };

    return (
        <GestureHandlerRootView style={styles.container}>
            {/* ── Sky ambience — behind gesture layer ──────────────────────── */}
            <View style={[StyleSheet.absoluteFill, { zIndex: 0 }]} pointerEvents="none">
                <StarField />
                <CloudDrift />
            </View>

            <PanGestureHandler
                ref={panRef}
                simultaneousHandlers={[pinchRef]}
                onGestureEvent={onPanGestureEvent}
                onHandlerStateChange={onPanStateChange}
                minPointers={1}
                maxPointers={2}
                avgTouches
                enabled={!frozen}
            >
                <Animated.View style={styles.canvasContainer}>
                    <PinchGestureHandler
                        ref={pinchRef}
                        simultaneousHandlers={[panRef]}
                        onGestureEvent={onPinchGestureEvent}
                        onHandlerStateChange={onPinchStateChange}
                        enabled={!frozen}
                    >
                        <Animated.View style={styles.canvasContainer}>
                            <Animated.View style={[styles.scaleWrapper, { transform: [{ translateX: panX }, { translateY: panY }, { scale: displayScale }] }]}>
                                {/* gardenOpacity is an Animated.Value — changes via native driver, no React re-render */}
                                <Animated.View style={{ opacity: gardenOpacity }} pointerEvents={frozen ? 'none' : 'box-none'}>
                                <MemoIsometricGrid
                                    xp={xp}
                                    gridSize={gridSize}
                                    rotation={0}
                                    getTileState={getTileState}
                                    isDeadTreeRemoved={isDeadTreeRemoved}
                                    getPlantedTree={getPlantedTree}
                                    choppingTrees={choppingTrees}
                                    daysSinceLastXP={daysSinceLastXP}
                                    pendingTransitions={pendingTransitions}
                                    onTilePress={onTilePress}
                                    onDeadTreePress={onDeadTreePress}
                                    onPlantPress={onPlantPress}
                                    onPlantedTreePress={onPlantedTreePress}
                                    onChoppingComplete={onChoppingComplete}
                                    isZoomedOut={isZoomedOut}
                                    onCenterTreeLoaded={handleCenterTreeLoaded}
                                />
                                {/* Pollen motes — always mounted so we never pay the cost of
                                    stopping/starting all animation loops on every modal open */}
                                {!frozen && !isZoomedOut && treePositions.length > 0 && (
                                    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                                        <FloatingParticles treePositions={treePositions} />
                                    </View>
                                )}
                                </Animated.View>
                            </Animated.View>
                        </Animated.View>
                    </PinchGestureHandler>
                </Animated.View>
            </PanGestureHandler>

            {/* ── Foreground ambience — above garden (leaves only; pollen is inside scaleWrapper) ── */}
            {!frozen && !isZoomedOut && leafCount > 0 && (
            <Animated.View
                pointerEvents="none"
                style={[StyleSheet.absoluteFill, { zIndex: 199, transform: [{ translateX: panX }, { translateY: panY }, { scale: displayScale }] }]}
            >
                <FallingLeaves count={leafCount} />
            </Animated.View>
            )}

        </GestureHandlerRootView>
    );
});

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    canvasContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scaleWrapper: {
        justifyContent: 'center',
        alignItems: 'center',
    },
});

import React, { useRef, useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Image, Animated, Easing, TouchableOpacity } from 'react-native';
import { GestureHandlerRootView, PinchGestureHandler, PanGestureHandler, RotationGestureHandler, PinchGestureHandlerGestureEvent, RotationGestureHandlerGestureEvent, State } from 'react-native-gesture-handler';
import { TileState, PlantedTree } from '../hooks/useGardenState';
import { TREE_CATALOG } from './ShopModal';

const COLORS = {
    skyBg: '#1a1a2e',
};

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
    sapling: require('../assets/Garden Assets/Tree Types/Sapling_converted.png'),
    growingTree: require('../assets/Garden Assets/Tree Types/Growing_Tree_converted.png'),
    grownTree: require('../assets/Garden Assets/Tree Types/Grown_Tree_converted.png'),
    deadTree: require('../assets/Garden Assets/Tree Types/Dead_Tree.png'),
    axeIcon: require('../assets/Garden Assets/Icons/Axe.png'),
};

// Tree dimensions (actual asset is 848x1264)
const TREE_WIDTH = 848;
const TREE_HEIGHT = 1264;

// Vertical squash factor — compresses tree height to simulate a more overhead camera angle
// and reduce visual overlap between neighboring tiles. 1.0 = no squash, 0.7 = 30% shorter.
const TREE_SQUASH = 0.7;

// Tree growth stages with XP thresholds and scales
const TREE_STAGES = [
    { name: 'sapling', minXP: 0, scale: 0.10, asset: 'sapling' },
    { name: 'growing', minXP: 100, scale: 0.12, asset: 'growingTree' },
    { name: 'grown', minXP: 300, scale: 0.14, asset: 'grownTree' },
    { name: 'flourishing', minXP: 600, scale: 0.16, asset: 'grownTree' }, // Use grown tree with larger scale for now
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
            // Skip initial recovered tiles
            const isCenter = row === centerRow && col === centerCol;
            const isAbove = row === centerRow - 1 && col === centerCol;
            const isBelow = row === centerRow + 1 && col === centerCol;
            const isLeft = row === centerRow && col === centerCol - 1;
            const isRight = row === centerRow && col === centerCol + 1;
            if (isCenter || isAbove || isBelow || isLeft || isRight) continue;

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

// Rotates local grid coordinates for isometric view rotation
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

// AnimatedTile component — keeps previous tile underneath to prevent black flash during swap
const AnimatedTile = React.memo(function AnimatedTile({
    row,
    col,
    state,
    screenX,
    screenY,
    zIndex,
    onPress,
}: {
    row: number;
    col: number;
    state: TileState;
    screenX: number;
    screenY: number;
    zIndex: number;
    onPress?: (row: number, col: number, state: TileState) => void;
}) {
    const prevStateRef = useRef<TileState>(state);
    const [prevState, setPrevState] = useState<TileState>(state);

    useEffect(() => {
        if (prevStateRef.current !== state) {
            setPrevState(prevStateRef.current);
            prevStateRef.current = state;
        }
    }, [state]);

    const isTappable = (state === 'recovering' || state === 'recovered') && onPress;

    const containerStyle = {
        position: 'absolute' as const,
        left: screenX,
        top: screenY,
        width: SCALED_WIDTH,
        height: SCALED_HEIGHT,
        zIndex,
    };

    const tileContent = (
        <View style={{ width: SCALED_WIDTH, height: SCALED_HEIGHT }}>
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
        </View>
    );

    if (isTappable) {
        return (
            <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => onPress!(row, col, state)}
                style={containerStyle}
            >
                {tileContent}
            </TouchableOpacity>
        );
    }

    return <View style={containerStyle}>{tileContent}</View>;
});

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

// Chopping animation component - axe swing + progress bar + dissolve + reward text
const ChoppingAnimation = React.memo(function ChoppingAnimation({
    onComplete,
}: {
    onComplete: () => void;
}) {
    const swingAnim = useRef(new Animated.Value(0.5)).current; // Start centered (no jump)
    const progressAnim = useRef(new Animated.Value(0)).current;
    const dissolveOpacity = useRef(new Animated.Value(1)).current;
    const dissolveScale = useRef(new Animated.Value(1)).current;
    const rewardOpacity = useRef(new Animated.Value(0)).current;
    const rewardTranslateY = useRef(new Animated.Value(0)).current;
    const swingLoopRef = useRef<Animated.CompositeAnimation | null>(null);

    useEffect(() => {
        // Axe swing loop — start from center position
        const swingLoop = Animated.loop(
            Animated.sequence([
                Animated.timing(swingAnim, { toValue: 1, duration: 250, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
                Animated.timing(swingAnim, { toValue: 0, duration: 500, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
                Animated.timing(swingAnim, { toValue: 0.5, duration: 250, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
            ])
        );
        swingLoopRef.current = swingLoop;
        swingLoop.start();

        // Progress bar fills over 2 seconds
        Animated.timing(progressAnim, {
            toValue: 1,
            duration: 2000,
            easing: Easing.linear,
            useNativeDriver: false,
        }).start(({ finished }) => {
            if (finished) {
                // Stop swing
                swingLoop.stop();

                // Dissolve phase: fade + shrink tree, float "+5" reward
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
                        // Delay to ensure all React renders complete before removing from state
                        setTimeout(() => onComplete(), 100);
                    }
                });
            }
        });
    }, []);

    const rotation = swingAnim.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: ['-20deg', '0deg', '20deg'],
    });

    return (
        <>
            {/* Tree + axe wrapped in dissolve container */}
            <Animated.View style={{
                opacity: dissolveOpacity,
                transform: [{ scale: dissolveScale }],
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
                    shadowColor: '#ffffff',
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0.9,
                    shadowRadius: 3,
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
                }}>+5 🪙</Text>
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
    choppingTree: { row: number; col: number } | null;
    daysSinceLastXP: number;
    onTilePress?: (row: number, col: number, state: TileState) => void;
    onDeadTreePress?: (row: number, col: number) => void;
    onPlantPress?: (row: number, col: number) => void;
    onPlantedTreePress?: (row: number, col: number) => void;
    onChoppingComplete?: (row: number, col: number) => void;
    onStageChange?: (stage: string) => void;
}

function IsometricGrid({
    xp = 0,
    gridSize = 11,
    rotation = 0,
    getTileState,
    isDeadTreeRemoved,
    getPlantedTree,
    choppingTree,
    daysSinceLastXP,
    onTilePress,
    onDeadTreePress,
    onPlantPress,
    onPlantedTreePress,
    onChoppingComplete,
    onStageChange,
}: IsometricGridProps) {
    const [currentStage, setCurrentStage] = useState(getTreeStage(xp));
    const glowAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const [prevStageName, setPrevStageName] = useState(currentStage.name);

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
    }, [gridSize, getTileState, isDeadTreeRemoved]);

    // Update tree stage when XP changes
    useEffect(() => {
        const newStage = getTreeStage(xp);
        if (newStage.name !== prevStageName) {
            // Stage changed! Play celebration animation
            setPrevStageName(newStage.name);
            setCurrentStage(newStage);
            onStageChange?.(newStage.name);

            // Glow and pulse animation
            Animated.parallel([
                Animated.sequence([
                    Animated.timing(glowAnim, {
                        toValue: 1,
                        duration: 300,
                        useNativeDriver: false,
                    }),
                    Animated.timing(glowAnim, {
                        toValue: 0,
                        duration: 800,
                        useNativeDriver: false,
                    }),
                ]),
                Animated.sequence([
                    Animated.spring(scaleAnim, {
                        toValue: 1.15,
                        tension: 100,
                        friction: 5,
                        useNativeDriver: false,
                    }),
                    Animated.spring(scaleAnim, {
                        toValue: 1,
                        tension: 80,
                        friction: 8,
                        useNativeDriver: false,
                    }),
                ]),
            ]).start();
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

    const tiles = [];
    
    // Offset to center the isometric diamond
    const centerOffsetX = (gridSize - 1) * STEP_X;
    const maxLocal = gridSize - 1;

    for (let row = startRow; row <= endRow; row++) {
        for (let col = startCol; col <= endCol; col++) {
            const localRow = row - startRow;
            const localCol = col - startCol;
            const [rRow, rCol] = rotateLocal(localRow, localCol, rotation, maxLocal);
            const screenX = (rCol - rRow) * STEP_X + centerOffsetX;
            const screenY = (rCol + rRow) * STEP_Y;
            const state = getTileState(row, col);

            // Determine the right press handler per tile state
            // All interactions route through tile taps (trees use pointerEvents="none")
            let tileHandler: ((r: number, c: number, s: TileState) => void) | undefined;

            // Check for dead environmental tree on this tile
            const hasDeadTree = visibleDeadTrees.some(dt => dt.row === row && dt.col === col);
            const isBeingChopped = choppingTree?.row === row && choppingTree?.col === col;

            if (isBeingChopped) {
                // Chopping animation in progress — no interaction
                tileHandler = undefined;
            } else if (hasDeadTree && (state === 'recovering' || state === 'recovered') && onDeadTreePress) {
                // Dead tree on recoverable tile → chop action
                tileHandler = (r: number, c: number, _s: TileState) => onDeadTreePress!(r, c);
            } else if (state === 'recovering') {
                // Recovering tiles → skip recovery
                tileHandler = onTilePress;
            } else if (state === 'recovered') {
                if (row === maxCenter && col === maxCenter) {
                    // Center tile with main tree → no action
                    tileHandler = undefined;
                } else {
                    const planted = getPlantedTree(row, col);
                    if (!planted) {
                        // Empty recovered tile → plant modal
                        tileHandler = (r: number, c: number, _s: TileState) => onPlantPress?.(r, c);
                    } else if (onPlantedTreePress) {
                        // Has a planted tree → removal (only if tree is alive)
                        const { index: stageIndex } = getPlantedTreeStageWithIndex(xp, planted.plantedAtXP);
                        if (stageIndex >= 0) {
                            tileHandler = (r: number, c: number, _s: TileState) => onPlantedTreePress!(r, c);
                        }
                    }
                }
            }

            tiles.push(
                <AnimatedTile
                    key={`${row}-${col}`}
                    row={row}
                    col={col}
                    state={state}
                    screenX={screenX}
                    screenY={screenY}
                    zIndex={rRow + rCol}
                    onPress={tileHandler}
                />
            );
        }
    }

    // Center tile position for main tree
    const centerLocalRow = maxCenter - startRow;
    const centerLocalCol = maxCenter - startCol;
    const [rCenterRow, rCenterCol] = rotateLocal(centerLocalRow, centerLocalCol, rotation, maxLocal);
    const centerTileX = (rCenterCol - rCenterRow) * STEP_X + centerOffsetX;
    const centerTileY = (rCenterCol + rCenterRow) * STEP_Y;

    // Container sized to fit the isometric diamond
    const containerWidth = (gridSize - 1) * STEP_X * 2 + SCALED_WIDTH;
    const containerHeight = (gridSize - 1) * STEP_Y * 2 + SCALED_HEIGHT;

    return (
        <View style={{
            position: 'relative',
            width: containerWidth,
            height: containerHeight,
        }}>
            {tiles}
            
            {/* Dead trees on dead/recovering tiles */}
            {visibleDeadTrees.map(({ row, col }) => {
                const localRow = row - startRow;
                const localCol = col - startCol;
                const [rRow, rCol] = rotateLocal(localRow, localCol, rotation, maxLocal);
                const deadTreeX = (rCol - rRow) * STEP_X + centerOffsetX;
                const deadTreeY = (rCol + rRow) * STEP_Y;
                const posX = deadTreeX + (SCALED_WIDTH / 2) - (SCALED_DEAD_TREE_WIDTH / 2);
                const posY = deadTreeY + (SCALED_HEIGHT / 2) - (SCALED_DEAD_TREE_HEIGHT * 0.75);

                const tileState = getTileState(row, col);
                // Dead trees become tappable once tile is recovering or recovered
                const isTappable = (tileState === 'recovering' || tileState === 'recovered') && onDeadTreePress;
                const isBeingChopped = choppingTree?.row === row && choppingTree?.col === col;

                if (isTappable) {
                    // When being chopped, ChoppingAnimation handles everything (axe + tree + dissolve)
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
                                    zIndex: rRow + rCol + 1,
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
                                zIndex: rRow + rCol + 1,
                            }}
                        >
                            {/* Static axe icon — hovering over tree with white outline + shadow */}
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
                            zIndex: rRow + rCol + 1,
                        }}
                    >
                        <Image
                            source={ASSETS.deadTree}
                            style={{ width: SCALED_DEAD_TREE_WIDTH, height: SCALED_DEAD_TREE_HEIGHT }}
                            resizeMode="contain"
                        />
                    </View>
                );
            })}
            
            {/* Planted trees on recovered tiles */}
            {(() => {
                const plantedTrees = [];
                for (let row = startRow; row <= endRow; row++) {
                    for (let col = startCol; col <= endCol; col++) {
                        if (row === maxCenter && col === maxCenter) continue; // Skip center (has main tree)
                        const planted = getPlantedTree(row, col);
                        if (!planted) continue;

                        const { stage: normalStage, index: stageIndex } = getPlantedTreeStageWithIndex(xp, planted.plantedAtXP);

                        // Check if tree is withering (tile decayed)
                        const tileState = getTileState(row, col);
                        const isWithering = tileState !== 'recovered';

                        // Regress tree stage during decay:
                        // - 'recovering' tile = lose 1 stage (warning phase)
                        // - 'dead' tile = lose 1 stage per day of decay
                        // - If tree regresses below sapling (stage 0), it becomes a dead tree
                        let effectiveStageIndex = stageIndex;
                        if (isWithering) {
                            if (tileState === 'dead') {
                                // Lose 1 stage per day past the grace period
                                const effectiveDays = Math.max(0, daysSinceLastXP - 1);
                                const stagesLost = Math.floor(effectiveDays);
                                effectiveStageIndex = stageIndex - stagesLost;
                            } else {
                                // Recovering = lose 1 stage as warning
                                effectiveStageIndex = stageIndex - 1;
                            }
                        }

                        // If tree has regressed below stage 0, it becomes a dead tree
                        const isDead = effectiveStageIndex < 0;
                        let ptWidth, ptHeight, ptAsset;

                        if (isDead) {
                            // Show dead tree
                            ptWidth = SCALED_DEAD_TREE_WIDTH * 0.9;
                            ptHeight = SCALED_DEAD_TREE_HEIGHT * 0.9; // already squashed via TREE_SQUASH
                            ptAsset = ASSETS.deadTree;
                        } else {
                            // Show living tree at its regressed stage
                            const effectiveStage = TREE_STAGES[effectiveStageIndex];
                            const ptScale = effectiveStage.scale * 0.9;
                            ptWidth = TREE_WIDTH * ptScale;
                            ptHeight = TREE_HEIGHT * ptScale * TREE_SQUASH;
                            ptAsset = ASSETS[effectiveStage.asset as keyof typeof ASSETS];
                        }

                        // Get tint color from catalog for non-Basic trees (only for living trees)
                        const catalogItem = planted.type !== 'Basic'
                            ? TREE_CATALOG.find(t => t.id === planted.type)
                            : null;

                        // Healthy trees show their type tint; dead trees have no tint
                        const tintStyle = (!isDead && catalogItem?.tint) ? { tintColor: catalogItem.tint } : {};

                        const localRow = row - startRow;
                        const localCol = col - startCol;
                        const [rRow, rCol] = rotateLocal(localRow, localCol, rotation, maxLocal);
                        const tileX = (rCol - rRow) * STEP_X + centerOffsetX;
                        const tileY = (rCol + rRow) * STEP_Y;
                        const posX = tileX + (SCALED_WIDTH / 2) - (ptWidth / 2);
                        const posY = tileY + (SCALED_HEIGHT / 2) - (ptHeight * 0.75);

                        const treeImage = (
                            <Image
                                source={ptAsset}
                                style={{
                                    width: ptWidth,
                                    height: ptHeight,
                                    ...tintStyle,
                                }}
                                resizeMode="contain"
                            />
                        );

                        // Dead trees are not tappable/removable
                        if (isDead) {
                            plantedTrees.push(
                                <View
                                    key={`planted-${row}-${col}`}
                                    pointerEvents="none"
                                    style={{
                                        position: 'absolute',
                                        left: posX,
                                        top: posY,
                                        width: ptWidth,
                                        height: ptHeight,
                                        zIndex: rRow + rCol + 1,
                                    }}
                                >
                                    {treeImage}
                                </View>
                            );
                        } else {
                            // Living trees — pointerEvents="none" so taps pass through to tile
                            plantedTrees.push(
                                <View
                                    key={`planted-${row}-${col}`}
                                    pointerEvents="none"
                                    style={{
                                        position: 'absolute',
                                        left: posX,
                                        top: posY,
                                        width: ptWidth,
                                        height: ptHeight,
                                        zIndex: rRow + rCol + 1,
                                    }}
                                >
                                    {treeImage}
                                </View>
                            );
                        }
                    }
                }
                return plantedTrees;
            })()}

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
                    transform: [{ scale: scaleAnim }],
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
                />
            </Animated.View>
        </View>
    );
}

interface GardenSceneProps {
    xp?: number;
    gridSize?: number;
    getTileState: (row: number, col: number) => TileState;
    isDeadTreeRemoved: (row: number, col: number) => boolean;
    getPlantedTree: (row: number, col: number) => PlantedTree | null;
    choppingTree: { row: number; col: number } | null;
    daysSinceLastXP?: number;
    onTilePress?: (row: number, col: number, state: TileState) => void;
    onDeadTreePress?: (row: number, col: number) => void;
    onPlantPress?: (row: number, col: number) => void;
    onPlantedTreePress?: (row: number, col: number) => void;
    onChoppingComplete?: (row: number, col: number) => void;
}

export function GardenScene({
    xp = 0,
    gridSize = 11,
    getTileState,
    isDeadTreeRemoved,
    getPlantedTree,
    choppingTree,
    daysSinceLastXP = 0,
    onTilePress,
    onDeadTreePress,
    onPlantPress,
    onPlantedTreePress,
    onChoppingComplete,
}: GardenSceneProps) {
    const [rotation, setRotation] = useState(0);
    // Use Animated values for smooth native-driven transforms
    const translateX = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(0)).current;
    const scale = useRef(new Animated.Value(1)).current;
    
    // Store the last committed position (where the grid actually is after gesture ends)
    const lastX = useRef(0);
    const lastY = useRef(0);
    const baseScale = useRef(1);
    const lastScale = useRef(1);
    
    const pinchRef = useRef(null);
    const panRef = useRef(null);
    const rotationRef = useRef(null);
    
    // Track if momentum animation is running
    const isAnimating = useRef(false);

    // Rotation gesture: accumulate angle, snap to 90° on release
    const cumulativeRotation = useRef(0); // radians accumulated during gesture

    const onRotationGestureEvent = (event: RotationGestureHandlerGestureEvent) => {
        cumulativeRotation.current = event.nativeEvent.rotation;
    };

    const onRotationStateChange = (event: any) => {
        if (event.nativeEvent.state === State.END) {
            const angleDeg = (cumulativeRotation.current * 180) / Math.PI;
            // Snap: if they've twisted past 30°, commit a 90° step
            if (angleDeg > 30) {
                setRotation(r => r + 1);
            } else if (angleDeg < -30) {
                setRotation(r => r - 1);
            }
            cumulativeRotation.current = 0;
        }
    };

    const onPinchGestureEvent = (event: PinchGestureHandlerGestureEvent) => {
        const newScale = Math.max(0.2, Math.min(4, baseScale.current * event.nativeEvent.scale));
        scale.setValue(newScale);
        lastScale.current = newScale;
    };

    const onPinchStateChange = (event: any) => {
        if (event.nativeEvent.state === State.END) {
            baseScale.current = lastScale.current;
        }
    };

    const onPanGestureEvent = (event: any) => {
        // When user starts dragging, stop any running animation and use last committed position
        if (isAnimating.current) {
            translateX.stopAnimation((value) => { lastX.current = value; });
            translateY.stopAnimation((value) => { lastY.current = value; });
            isAnimating.current = false;
        }
        
        // Calculate new position from last committed position + current drag
        const newX = lastX.current + event.nativeEvent.translationX;
        const newY = lastY.current + event.nativeEvent.translationY;
        
        translateX.setValue(newX);
        translateY.setValue(newY);
    };

    const onPanStateChange = (event: any) => {
        if (event.nativeEvent.state === State.END) {
            const { velocityX, velocityY, translationX, translationY } = event.nativeEvent;
            
            // Current position after drag
            const currentX = lastX.current + translationX;
            const currentY = lastY.current + translationY;
            
            // Calculate speed from velocity
            const speed = Math.sqrt(velocityX * velocityX + velocityY * velocityY);
            
            if (speed > 50) {
                // More natural momentum - distance scales with velocity
                // The faster you swipe, the further it goes
                const momentumDuration = Math.min(1200, Math.max(400, speed * 0.4));
                
                // Adaptive scaling: small swipes move faster, long swipes stay the same
                // Lower divisor for low speeds = more movement for small swipes
                const adaptiveDivisor = speed < 500 ? 2500 : 4000;
                
                // Target position based on velocity - feels like throwing
                const targetX = currentX + (velocityX * momentumDuration / adaptiveDivisor);
                const targetY = currentY + (velocityY * momentumDuration / adaptiveDivisor);
                
                isAnimating.current = true;
                
                Animated.parallel([
                    Animated.timing(translateX, {
                        toValue: targetX,
                        duration: momentumDuration,
                        easing: Easing.out(Easing.poly(4)), // Quartic ease-out for smoother, more gradual deceleration
                        useNativeDriver: false,
                    }),
                    Animated.timing(translateY, {
                        toValue: targetY,
                        duration: momentumDuration,
                        easing: Easing.out(Easing.poly(4)), // Smoother stop
                        useNativeDriver: false,
                    }),
                ]).start(({ finished }) => {
                    isAnimating.current = false;
                    if (finished) {
                        lastX.current = targetX;
                        lastY.current = targetY;
                    } else {
                        // If interrupted, sync to current animated value
                        translateX.stopAnimation((value) => { lastX.current = value; });
                        translateY.stopAnimation((value) => { lastY.current = value; });
                    }
                });
            } else {
                // No momentum, just commit current position
                lastX.current = currentX;
                lastY.current = currentY;
            }
        }
    };

    return (
        <GestureHandlerRootView style={styles.container}>
            <PanGestureHandler
                ref={panRef}
                simultaneousHandlers={[pinchRef, rotationRef]}
                onGestureEvent={onPanGestureEvent}
                onHandlerStateChange={onPanStateChange}
                minPointers={1}
                maxPointers={2}
                avgTouches
            >
                <Animated.View style={styles.canvasContainer}>
                    <PinchGestureHandler
                        ref={pinchRef}
                        simultaneousHandlers={[panRef, rotationRef]}
                        onGestureEvent={onPinchGestureEvent}
                        onHandlerStateChange={onPinchStateChange}
                    >
                        <Animated.View style={styles.canvasContainer}>
                            <RotationGestureHandler
                                ref={rotationRef}
                                simultaneousHandlers={[panRef, pinchRef]}
                                onGestureEvent={onRotationGestureEvent}
                                onHandlerStateChange={onRotationStateChange}
                            >
                                <Animated.View style={styles.canvasContainer}>
                                    <Animated.View style={[
                                        styles.scaleWrapper, 
                                        { 
                                            transform: [
                                                { translateX },
                                                { translateY },
                                                { scale }
                                            ] 
                                        }
                                    ]}>
                                        <IsometricGrid
                                            xp={xp}
                                            gridSize={gridSize}
                                            rotation={rotation}
                                            getTileState={getTileState}
                                            isDeadTreeRemoved={isDeadTreeRemoved}
                                            getPlantedTree={getPlantedTree}
                                            choppingTree={choppingTree}
                                            daysSinceLastXP={daysSinceLastXP}
                                            onTilePress={onTilePress}
                                            onDeadTreePress={onDeadTreePress}
                                            onPlantPress={onPlantPress}
                                            onPlantedTreePress={onPlantedTreePress}
                                            onChoppingComplete={onChoppingComplete}
                                        />
                                    </Animated.View>
                                </Animated.View>
                            </RotationGestureHandler>
                        </Animated.View>
                    </PinchGestureHandler>
                </Animated.View>
            </PanGestureHandler>
        </GestureHandlerRootView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.skyBg,
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

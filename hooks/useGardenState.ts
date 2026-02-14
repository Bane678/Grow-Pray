import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Types ────────────────────────────────────────────────────────────────────

export type TileState = 'dead' | 'recovering' | 'recovered';

export interface PlantedTree {
  type: string;       // e.g. 'Palm', 'Oak', etc.
  plantedAtXP: number; // XP at time of planting (for growth tracking)
}

export interface GardenData {
  gridSize: number;
  tileOverrides: Record<string, TileState>; // "row,col" → state (only coin-skipped tiles)
  deadTreesRemoved: string[];               // ["row,col", ...] tiles where dead tree was dug up
  plantedTrees: Record<string, PlantedTree>; // "row,col" → tree info
  lastExpansionSize: number;                 // Track last grid expansion for celebration
  lastXPGainTimestamp: number;               // Date.now() when XP was last earned (for decay)
}

export interface GardenStateResult {
  gardenData: GardenData;
  loading: boolean;
  // Computed tile states
  getTileState: (row: number, col: number) => TileState;
  // Recovery info
  totalRecoveredTiles: number;
  totalRecoveringTiles: number;
  nextRecoveryXP: number;         // XP needed for next tile event
  currentRecoveryProgress: number; // 0-1 progress toward next tile event
  // Grid expansion
  gridSize: number;
  gridJustExpanded: boolean;
  clearExpansionFlag: () => void;
  // Recovery queue
  recoveryQueue: Array<{ row: number; col: number; phase: 'recovering' | 'recovered'; cumulativeXP: number }>;
  // Actions
  skipRecoveryWithCoins: (row: number, col: number) => Promise<boolean>;
  getSkipCost: (row: number, col: number) => number;
  removeDeadTree: (row: number, col: number) => Promise<number>; // returns coin reward
  plantTree: (row: number, col: number, treeType: string, currentXP: number) => Promise<boolean>;
  removePlantedTree: (row: number, col: number) => Promise<boolean>;
  isDeadTreeRemoved: (row: number, col: number) => boolean;
  getPlantedTree: (row: number, col: number) => PlantedTree | null;
  // Tree inventory
  treeInventory: Record<string, number>;
  purchaseTree: (treeId: string, cost: number) => Promise<boolean>;
  useTreeFromInventory: (treeId: string) => Promise<boolean>;
  getOwnedTreeTypes: () => string[];
  // Decay system
  updateLastXPTimestamp: () => Promise<void>;
  setLastXPTimestamp: (timestamp: number) => Promise<void>;
  daysSinceLastXP: number;
  isDecaying: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = '@GrowPray:gardenState';
const INVENTORY_STORAGE_KEY = '@GrowPray:treeInventory';

// Starting green tiles: center cross of 5
const INITIAL_GRID_SIZE = 11;

// XP cost formula: tileCost(n) = floor(10 + n² * 0.3)
// Tile 0 costs 10, tile 10 costs 40, tile 20 costs 130, etc.
const tileCostToRecover = (tileIndex: number): number => {
  return Math.floor(10 + tileIndex * tileIndex * 0.3);
};

// Cost to complete recovery is half the initial cost (min 5)
const tileCostToComplete = (tileIndex: number): number => {
  return Math.max(5, Math.floor(tileCostToRecover(tileIndex) * 0.5));
};

// Coin cost to skip a recovering → recovered transition
const skipCoinCost = (tileIndex: number): number => {
  return Math.max(10, Math.floor(tileCostToComplete(tileIndex) * 0.8));
};

// Dead tree removal coin reward
const DEAD_TREE_REMOVAL_REWARD = 5;

// Grid expansion
const GRID_EXPANSION_INCREMENT = 2;
export const MAX_GRID_SIZE = 21;

// ─── Tile Recovery Order Algorithm ────────────────────────────────────────────
// Ring by ring, cross-first then corners within each ring

function generateRecoveryOrder(maxGridSize: number): Array<{ row: number; col: number }> {
  const center = Math.floor(maxGridSize / 2);
  const order: Array<{ row: number; col: number }> = [];

  // Starting recovered tiles (cross of 5) — skip these
  const isInitialTile = (r: number, c: number) => {
    if (r === center && c === center) return true;
    if (r === center - 1 && c === center) return true;
    if (r === center + 1 && c === center) return true;
    if (r === center && c === center - 1) return true;
    if (r === center && c === center + 1) return true;
    return false;
  };

  const maxRing = center;

  for (let ring = 1; ring <= maxRing; ring++) {
    const ringTiles: Array<{ row: number; col: number; priority: number }> = [];

    for (let r = center - ring; r <= center + ring; r++) {
      for (let c = center - ring; c <= center + ring; c++) {
        const chebyshev = Math.max(Math.abs(r - center), Math.abs(c - center));
        if (chebyshev !== ring) continue;
        if (r < 0 || c < 0 || r >= maxGridSize || c >= maxGridSize) continue;
        if (isInitialTile(r, c)) continue;

        const isCross = r === center || c === center;
        const manhattan = Math.abs(r - center) + Math.abs(c - center);
        const priority = isCross ? 0 : manhattan;

        ringTiles.push({ row: r, col: c, priority });
      }
    }

    // Cross tiles first, then by manhattan, then clockwise
    ringTiles.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      const angleA = Math.atan2(a.col - center, a.row - center);
      const angleB = Math.atan2(b.col - center, b.row - center);
      return angleA - angleB;
    });

    for (const tile of ringTiles) {
      order.push({ row: tile.row, col: tile.col });
    }
  }

  return order;
}

// Pre-compute full recovery schedule with cumulative XP thresholds
function buildRecoverySchedule(maxGridSize: number) {
  const order = generateRecoveryOrder(maxGridSize);
  const schedule: Array<{
    row: number;
    col: number;
    phase: 'recovering' | 'recovered';
    cumulativeXP: number;
    tileIndex: number;
  }> = [];

  let cumulativeXP = 0;

  for (let i = 0; i < order.length; i++) {
    const tile = order[i];
    const recoverCost = tileCostToRecover(i);
    const completeCost = tileCostToComplete(i);

    // Phase 1: Dead → Recovering
    cumulativeXP += recoverCost;
    schedule.push({
      row: tile.row,
      col: tile.col,
      phase: 'recovering',
      cumulativeXP,
      tileIndex: i,
    });

    // Phase 2: Recovering → Recovered
    cumulativeXP += completeCost;
    schedule.push({
      row: tile.row,
      col: tile.col,
      phase: 'recovered',
      cumulativeXP,
      tileIndex: i,
    });
  }

  return schedule;
}

// ─── Grid size calculation ───────────────────────────────────────────────────

function calculateGridSize(
  xp: number,
  schedule: ReturnType<typeof buildRecoverySchedule>,
  baseGridSize: number,
  maxGridSize: number
): number {
  const center = Math.floor(maxGridSize / 2);
  const half = Math.floor(baseGridSize / 2);

  // Count tiles in current grid that have started recovering
  let tilesInGrid = 0;
  let tilesRecoveringOrBetter = 0;

  for (const entry of schedule) {
    if (entry.phase !== 'recovering') continue; // Count each tile once
    const inGrid = Math.abs(entry.row - center) <= half &&
                   Math.abs(entry.col - center) <= half;
    if (!inGrid) continue;
    tilesInGrid++;
    if (xp >= entry.cumulativeXP) tilesRecoveringOrBetter++;
  }

  // Expand when 80%+ of current grid tiles are at least recovering
  if (tilesInGrid > 0 && tilesRecoveringOrBetter >= tilesInGrid * 0.8) {
    const newSize = Math.min(maxGridSize, baseGridSize + GRID_EXPANSION_INCREMENT);
    if (newSize > baseGridSize) {
      return calculateGridSize(xp, schedule, newSize, maxGridSize);
    }
  }

  return baseGridSize;
}

// ─── Initial recovered tiles ─────────────────────────────────────────────────

function getInitialRecoveredTiles(gridSize: number): Set<string> {
  const center = Math.floor(gridSize / 2);
  return new Set([
    `${center},${center}`,
    `${center - 1},${center}`,
    `${center + 1},${center}`,
    `${center},${center - 1}`,
    `${center},${center + 1}`,
  ]);
}

// ─── The Hook ─────────────────────────────────────────────────────────────────

const DEFAULT_GARDEN: GardenData = {
  gridSize: INITIAL_GRID_SIZE,
  tileOverrides: {},
  deadTreesRemoved: [],
  plantedTrees: {},
  lastExpansionSize: INITIAL_GRID_SIZE,
  lastXPGainTimestamp: Date.now(),
};

export function useGardenState(xp: number, coins: number, onSpendCoins?: (amount: number) => void): GardenStateResult {
  const [gardenData, setGardenData] = useState<GardenData>(DEFAULT_GARDEN);
  const [loading, setLoading] = useState(true);
  const [gridJustExpanded, setGridJustExpanded] = useState(false);
  const [treeInventory, setTreeInventory] = useState<Record<string, number>>({});

  // Pre-compute recovery schedule (never changes)
  const schedule = useMemo(() => buildRecoverySchedule(MAX_GRID_SIZE), []);

  // Initial 5 recovered tiles based on MAX_GRID_SIZE coordinate space
  const initialRecoveredSet = useMemo(() => getInitialRecoveredTiles(MAX_GRID_SIZE), []);

  // ─── Decay tracking: auto-update timestamp when XP increases ──────────────
  const prevXPRef = useRef(xp);
  useEffect(() => {
    if (!loading && xp > prevXPRef.current) {
      prevXPRef.current = xp;
      setGardenData(prev => {
        const updated = { ...prev, lastXPGainTimestamp: Date.now() };
        saveGarden(updated);
        return updated;
      });
    } else {
      prevXPRef.current = xp;
    }
  }, [xp, loading, saveGarden]);

  // ─── Max ring reached (for decay calculation) ─────────────────────────────
  const maxRingReached = useMemo(() => {
    const center = Math.floor(MAX_GRID_SIZE / 2);
    let maxRing = 0;
    for (const entry of schedule) {
      if (xp < entry.cumulativeXP) break;
      const ring = Math.max(Math.abs(entry.row - center), Math.abs(entry.col - center));
      maxRing = Math.max(maxRing, ring);
    }
    return maxRing;
  }, [xp, schedule]);

  // ─── Load ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [stored, storedInventory] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY),
          AsyncStorage.getItem(INVENTORY_STORAGE_KEY),
        ]);
        if (stored) {
          const parsed = JSON.parse(stored) as GardenData;
          // Migration: add lastXPGainTimestamp for existing users
          if (!parsed.lastXPGainTimestamp) parsed.lastXPGainTimestamp = Date.now();
          setGardenData(parsed);
        }
        if (storedInventory) {
          setTreeInventory(JSON.parse(storedInventory) as Record<string, number>);
        }
      } catch (e) {
        console.error('Failed to load garden state:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ─── Save ───────────────────────────────────────────────────────────────────
  const saveGarden = useCallback(async (data: GardenData) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error('Failed to save garden state:', e);
    }
  }, []);

  // ─── Dynamic grid size ─────────────────────────────────────────────────────
  const gridSize = useMemo(() => {
    return calculateGridSize(xp, schedule, gardenData.gridSize, MAX_GRID_SIZE);
  }, [xp, schedule, gardenData.gridSize]);

  // Persist grid expansion
  useEffect(() => {
    if (!loading && gridSize > gardenData.gridSize) {
      const updated = { ...gardenData, gridSize };
      setGardenData(updated);
      saveGarden(updated);
    }
  }, [gridSize, loading]);

  // Detect expansion for celebration
  useEffect(() => {
    if (!loading && gridSize > gardenData.lastExpansionSize) {
      setGridJustExpanded(true);
      const updated = { ...gardenData, lastExpansionSize: gridSize, gridSize };
      setGardenData(updated);
      saveGarden(updated);
    }
  }, [gridSize, loading]);

  const clearExpansionFlag = useCallback(() => setGridJustExpanded(false), []);

  // ─── Compute tile states from XP + schedule ────────────────────────────────
  const tileStatesFromXP = useMemo(() => {
    const states = new Map<string, TileState>();
    for (const entry of schedule) {
      if (xp < entry.cumulativeXP) break;
      states.set(`${entry.row},${entry.col}`, entry.phase);
    }
    return states;
  }, [xp, schedule]);

  // ─── Get tile state (main API) — includes decay ──────────────────────────
  const getTileState = useCallback((row: number, col: number): TileState => {
    const key = `${row},${col}`;
    // Center cross (initial 5 tiles) never decays
    if (initialRecoveredSet.has(key)) return 'recovered';

    // Base state from XP progress or coin-skip overrides
    const normalState = gardenData.tileOverrides[key] || tileStatesFromXP.get(key) || 'dead';

    // Apply decay if there's been inactivity
    if (normalState !== 'dead' && gardenData.lastXPGainTimestamp && maxRingReached > 0) {
      const daysSince = (Date.now() - gardenData.lastXPGainTimestamp) / 86400000;
      const effectiveDays = Math.max(0, daysSince - 1); // 1-day grace period
      if (effectiveDays > 0) {
        const center = Math.floor(MAX_GRID_SIZE / 2);
        const ringDistance = Math.max(Math.abs(row - center), Math.abs(col - center));
        const outwardDist = maxRingReached - ringDistance; // 0 = outermost reached ring
        if (outwardDist >= 0) {
          const fullyDeadRings = Math.floor(effectiveDays / 2);
          // Rings closer to the edge than fullyDeadRings → dead
          if (outwardDist < fullyDeadRings) return 'dead';
          // The ring currently decaying: recovered tiles demote to recovering
          if (outwardDist === fullyDeadRings && normalState === 'recovered') {
            return 'recovering';
          }
        }
      }
    }

    return normalState;
  }, [initialRecoveredSet, gardenData.tileOverrides, tileStatesFromXP, gardenData.lastXPGainTimestamp, maxRingReached]);

  // ─── Count tiles ──────────────────────────────────────────────────────────
  const { totalRecoveredTiles, totalRecoveringTiles } = useMemo(() => {
    let recovered = 5; // Initial cross
    let recovering = 0;
    const center = Math.floor(MAX_GRID_SIZE / 2);
    const half = Math.floor(gridSize / 2);

    for (let r = center - half; r <= center + half; r++) {
      for (let c = center - half; c <= center + half; c++) {
        const key = `${r},${c}`;
        if (initialRecoveredSet.has(key)) continue;
        const state = getTileState(r, c);
        if (state === 'recovered') recovered++;
        else if (state === 'recovering') recovering++;
      }
    }
    return { totalRecoveredTiles: recovered, totalRecoveringTiles: recovering };
  }, [gridSize, getTileState, initialRecoveredSet]);

  // ─── Next recovery XP + progress ───────────────────────────────────────────
  const { nextRecoveryXP, currentRecoveryProgress } = useMemo(() => {
    let prevXP = 0;
    for (const entry of schedule) {
      const key = `${entry.row},${entry.col}`;
      if (gardenData.tileOverrides[key] === 'recovered' && entry.phase === 'recovered') {
        prevXP = entry.cumulativeXP;
        continue;
      }
      if (xp < entry.cumulativeXP) {
        const needed = entry.cumulativeXP;
        const progress = prevXP > 0 ? (xp - prevXP) / (needed - prevXP) : xp / needed;
        return { nextRecoveryXP: needed, currentRecoveryProgress: Math.max(0, Math.min(1, progress)) };
      }
      prevXP = entry.cumulativeXP;
    }
    return { nextRecoveryXP: 0, currentRecoveryProgress: 1 };
  }, [xp, schedule, gardenData.tileOverrides]);

  // ─── Recovery queue (next 5 upcoming events) ──────────────────────────────
  const recoveryQueue = useMemo(() => {
    const upcoming: typeof schedule = [];
    for (const entry of schedule) {
      if (xp < entry.cumulativeXP) {
        upcoming.push(entry);
        if (upcoming.length >= 5) break;
      }
    }
    return upcoming;
  }, [xp, schedule]);

  // ─── Skip recovery with coins ──────────────────────────────────────────────
  const getSkipCost = useCallback((row: number, col: number): number => {
    const key = `${row},${col}`;
    for (const entry of schedule) {
      if (`${entry.row},${entry.col}` === key && entry.phase === 'recovering') {
        return skipCoinCost(entry.tileIndex);
      }
    }
    return 20;
  }, [schedule]);

  const skipRecoveryWithCoins = useCallback(async (row: number, col: number): Promise<boolean> => {
    const key = `${row},${col}`;
    const state = getTileState(row, col);
    if (state !== 'recovering') return false;

    const cost = getSkipCost(row, col);
    if (coins < cost) return false;

    onSpendCoins?.(cost);

    const updated = {
      ...gardenData,
      tileOverrides: { ...gardenData.tileOverrides, [key]: 'recovered' as TileState },
    };
    setGardenData(updated);
    await saveGarden(updated);
    return true;
  }, [gardenData, coins, getTileState, getSkipCost, onSpendCoins, saveGarden]);

  // ─── Dead tree removal ─────────────────────────────────────────────────────
  const isDeadTreeRemoved = useCallback((row: number, col: number): boolean => {
    return gardenData.deadTreesRemoved.includes(`${row},${col}`);
  }, [gardenData.deadTreesRemoved]);

  const removeDeadTree = useCallback(async (row: number, col: number): Promise<number> => {
    const key = `${row},${col}`;
    if (gardenData.deadTreesRemoved.includes(key)) return 0;

    const updated = {
      ...gardenData,
      deadTreesRemoved: [...gardenData.deadTreesRemoved, key],
    };
    setGardenData(updated);
    await saveGarden(updated);
    return DEAD_TREE_REMOVAL_REWARD;
  }, [gardenData, saveGarden]);

  // ─── Tree planting ─────────────────────────────────────────────────────────
  const getPlantedTree = useCallback((row: number, col: number): PlantedTree | null => {
    return gardenData.plantedTrees[`${row},${col}`] || null;
  }, [gardenData.plantedTrees]);

  const plantTree = useCallback(async (row: number, col: number, treeType: string, currentXP: number): Promise<boolean> => {
    const key = `${row},${col}`;
    if (getTileState(row, col) !== 'recovered') return false;
    if (gardenData.plantedTrees[key]) return false;

    const updated = {
      ...gardenData,
      plantedTrees: {
        ...gardenData.plantedTrees,
        [key]: { type: treeType, plantedAtXP: currentXP },
      },
    };
    setGardenData(updated);
    await saveGarden(updated);
    return true;
  }, [gardenData, getTileState, saveGarden]);

  const removePlantedTree = useCallback(async (row: number, col: number): Promise<boolean> => {
    const key = `${row},${col}`;
    if (!gardenData.plantedTrees[key]) return false;

    const { [key]: _, ...remaining } = gardenData.plantedTrees;
    const updated = {
      ...gardenData,
      plantedTrees: remaining,
    };
    setGardenData(updated);
    await saveGarden(updated);
    return true;
  }, [gardenData, saveGarden]);

  // ─── Tree inventory ────────────────────────────────────────────────────────
  const saveInventory = useCallback(async (inv: Record<string, number>) => {
    try {
      await AsyncStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(inv));
    } catch (e) {
      console.error('Failed to save tree inventory:', e);
    }
  }, []);

  const purchaseTree = useCallback(async (treeId: string, cost: number): Promise<boolean> => {
    if (coins < cost) return false;
    if (!onSpendCoins) return false;
    
    onSpendCoins(cost);
    const updated = { ...treeInventory, [treeId]: (treeInventory[treeId] || 0) + 1 };
    setTreeInventory(updated);
    await saveInventory(updated);
    return true;
  }, [coins, treeInventory, onSpendCoins, saveInventory]);

  const useTreeFromInventory = useCallback(async (treeId: string): Promise<boolean> => {
    // Basic tree is free and unlimited
    if (treeId === 'Basic') return true;
    
    const count = treeInventory[treeId] || 0;
    if (count <= 0) return false;
    
    const updated = { ...treeInventory, [treeId]: count - 1 };
    setTreeInventory(updated);
    await saveInventory(updated);
    return true;
  }, [treeInventory, saveInventory]);

  const getOwnedTreeTypes = useCallback((): string[] => {
    const owned = ['Basic']; // Always available
    for (const [id, count] of Object.entries(treeInventory)) {
      if (count > 0 && id !== 'Basic') owned.push(id);
    }
    return owned;
  }, [treeInventory]);

  // ─── Decay status ──────────────────────────────────────────────────────────
  const daysSinceLastXP = gardenData.lastXPGainTimestamp
    ? Math.max(0, (Date.now() - gardenData.lastXPGainTimestamp) / 86400000)
    : 0;
  const isDecaying = daysSinceLastXP > 1; // Past the 1-day grace period

  const updateLastXPTimestamp = useCallback(async () => {
    const updated = { ...gardenData, lastXPGainTimestamp: Date.now() };
    setGardenData(updated);
    await saveGarden(updated);
  }, [gardenData, saveGarden]);

  const setLastXPTimestamp = useCallback(async (timestamp: number) => {
    const updated = { ...gardenData, lastXPGainTimestamp: timestamp };
    setGardenData(updated);
    await saveGarden(updated);
  }, [gardenData, saveGarden]);

  return {
    gardenData,
    loading,
    getTileState,
    totalRecoveredTiles,
    totalRecoveringTiles,
    nextRecoveryXP,
    currentRecoveryProgress,
    gridSize,
    gridJustExpanded,
    clearExpansionFlag,
    recoveryQueue,
    skipRecoveryWithCoins,
    getSkipCost,
    removeDeadTree,
    isDeadTreeRemoved,
    getPlantedTree,
    plantTree,
    removePlantedTree,
    treeInventory,
    purchaseTree,
    useTreeFromInventory,
    getOwnedTreeTypes,
    updateLastXPTimestamp,
    setLastXPTimestamp,
    daysSinceLastXP,
    isDecaying,
  };
}

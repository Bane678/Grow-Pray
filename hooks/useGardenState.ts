import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TREE_CATALOG } from '../components/ShopModal';

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
  canExpand: boolean;
  pendingGridSize: number;
  confirmExpansion: () => Promise<void>;
  gridLimitReached: boolean;
  // Recovery queue
  recoveryQueue: Array<{ row: number; col: number; phase: 'recovering' | 'recovered'; cumulativeXP: number }>;
  // Tile transitions (for ripple animation)
  pendingTransitions: TileTransition[];
  clearTransitions: () => void;
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
  lastXPGainTimestamp: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = '@GrowPray:gardenState';
const INVENTORY_STORAGE_KEY = '@GrowPray:treeInventory';

// Starting grid: 5×5 with center cross of 5 green tiles (center + 4 cardinal)
const INITIAL_GRID_SIZE = 5;

// ─── Progressive tier-based costs ─────────────────────────────────────────────
// Tiles are ordered ring-by-ring from center outward.
// Initial cross of 5 is skipped. Ring 1 diagonals (4 tiles) come first.
// Ring 1 diags + Ring 2 (indices 0-19)  = 5×5 tier  → 20 tiles
// Ring 3 (indices 20-43) = 7×7 tier  → 24 tiles
// Ring 4 (indices 44-75) = 9×9 tier  → 32 tiles
// Ring 5 (indices 76-115) = 11×11    → 40 tiles
// Ring 6 (indices 116-163) = 13×13   → 48 tiles
// Ring 7 (indices 164-219) = 15×15   → 56 tiles
// Ring 8 (indices 220-283) = 17×17   → 64 tiles
// Ring 9 (indices 284-355) = 19×19   → 72 tiles
// Ring 10 (indices 356+) = 21×21     → 80 tiles
//
// Pacing (at ~25 XP/day, 5 on-time prayers):
//   5×5 → 7×7:  Day 1, 5th prayer (25 XP → 16/20 = 80% recovered)  ← FREE CAP
//   7×7 → 9×9:  ~Day 4  (premium only)
//   9×9 → 11×11: ~Day 10
//   11×11 → 13×13: ~Week 3
//   Progressive difficulty thereafter
//
// First tier split: tiles 0-7 cost 1 XP, tiles 8-19 cost 2 XP
// This ensures the 16th tile (80% threshold) needs cumulative 24 XP
// which is only reachable on the 5th on-time prayer (25 XP total).

const tileCostToRecover = (tileIndex: number): number => {
  if (tileIndex < 8) return 1;        // 5×5 tier (inner): 1 XP to start recovering
  if (tileIndex < 20) return 2;       // 5×5 tier (outer): 2 XP for slower ramp
  if (tileIndex < 44) return 2;       // 7×7 tier
  if (tileIndex < 76) return 3;       // 9×9 tier
  if (tileIndex < 116) return 5;      // 11×11 tier
  if (tileIndex < 164) return 8;      // 13×13 tier
  if (tileIndex < 220) return 14;     // 15×15 tier
  if (tileIndex < 284) return 22;     // 17×17 tier
  if (tileIndex < 356) return 32;     // 19×19 tier
  return 44;                           // 21×21 tier
};

const tileCostToComplete = (tileIndex: number): number => {
  if (tileIndex < 20) return 0;       // 5×5 tier: instant complete (dead→recovered in one step)
  if (tileIndex < 44) return 2;       // 7×7 tier
  if (tileIndex < 76) return 4;       // 9×9 tier
  if (tileIndex < 116) return 7;      // 11×11 tier
  if (tileIndex < 164) return 12;     // 13×13 tier
  if (tileIndex < 220) return 21;     // 15×15 tier
  if (tileIndex < 284) return 33;     // 17×17 tier
  if (tileIndex < 356) return 48;     // 19×19 tier
  return 66;                           // 21×21 tier
};

// Coin cost to skip a recovering → recovered transition
const skipCoinCost = (tileIndex: number): number => {
  const completeCost = tileCostToComplete(tileIndex);
  return Math.max(5, Math.floor(completeCost * 1.5));
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

  // Starting recovered tiles (cross of 5: center + 4 cardinal) — skip these
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

// ─── Grid expansion check (single step, non-recursive) ─────────────────────
// Checks if the grid can expand by one step from currentGridSize.
// Returns whether expansion is possible and what the next size would be.

function canExpandOneStep(
  xp: number,
  schedule: ReturnType<typeof buildRecoverySchedule>,
  currentGridSize: number,
  maxGridSize: number
): { canExpand: boolean; nextSize: number } {
  if (currentGridSize >= maxGridSize) return { canExpand: false, nextSize: currentGridSize };

  const center = Math.floor(MAX_GRID_SIZE / 2);
  const half = Math.floor(currentGridSize / 2);

  // Count tiles in current grid that are fully recovered
  let tilesInGrid = 0;
  let tilesRecovered = 0;

  for (const entry of schedule) {
    if (entry.phase !== 'recovered') continue;
    const inGrid = Math.abs(entry.row - center) <= half &&
                   Math.abs(entry.col - center) <= half;
    if (!inGrid) continue;
    tilesInGrid++;
    if (xp >= entry.cumulativeXP) tilesRecovered++;
  }

  // Expand when 80%+ of current grid tiles are fully recovered
  if (tilesInGrid > 0 && tilesRecovered >= tilesInGrid * 0.8) {
    const newSize = Math.min(maxGridSize, currentGridSize + GRID_EXPANSION_INCREMENT);
    if (newSize > currentGridSize) {
      return { canExpand: true, nextSize: newSize };
    }
  }

  return { canExpand: false, nextSize: currentGridSize };
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

// Tile transition tracking for ripple animation
export interface TileTransition {
  row: number;
  col: number;
  from: TileState;
  to: TileState;
  ring: number; // Chebyshev distance from center — used for stagger timing
}

export function useGardenState(xp: number, coins: number, onSpendCoins?: (amount: number) => void, userMaxGridSize?: number): GardenStateResult {
  const effectiveMaxGrid = userMaxGridSize ?? MAX_GRID_SIZE;
  const [gardenData, setGardenData] = useState<GardenData>(DEFAULT_GARDEN);
  const [loading, setLoading] = useState(true);
  // Track whether initial catch-up has been done (for migrated users)
  const [initialSyncDone, setInitialSyncDone] = useState(false);
  const [treeInventory, setTreeInventory] = useState<Record<string, number>>({});

  // Pre-compute recovery schedule (never changes)
  const schedule = useMemo(() => buildRecoverySchedule(MAX_GRID_SIZE), []);

  // Initial 5 recovered tiles (cross) based on MAX_GRID_SIZE coordinate space
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

  // ─── Grid size (clamped to effective max) ───────────────────────────────────
  // If the user's saved grid exceeds their cap (e.g. free cap lowered from 11→7),
  // display the capped size. Data stays intact so upgrading restores the full grid.
  const gridSize = Math.min(gardenData.gridSize, effectiveMaxGrid);

  // ─── Initial catch-up for migrated users ────────────────────────────────────
  // On first load, silently bring grid size up to what XP supports.
  // This prevents migrated users (gridSize=5 but high XP) from needing to
  // tap through many expansion prompts.
  useEffect(() => {
    if (loading || initialSyncDone) return;
    setInitialSyncDone(true);
    let currentSize = gardenData.gridSize;
    while (currentSize < effectiveMaxGrid) {
      const { canExpand: can, nextSize } = canExpandOneStep(xp, schedule, currentSize, effectiveMaxGrid);
      if (!can) break;
      currentSize = nextSize;
    }
    if (currentSize > gardenData.gridSize) {
      const updated = { ...gardenData, gridSize: currentSize, lastExpansionSize: currentSize };
      setGardenData(updated);
      saveGarden(updated);
    }
  }, [loading]);

  // ─── Premium upgrade catch-up ──────────────────────────────────────────────
  // When effectiveMaxGrid increases (e.g. free→premium), silently expand
  // the grid to whatever XP supports, avoiding a barrage of expansion modals.
  const prevMaxGridRef = useRef(effectiveMaxGrid);
  useEffect(() => {
    if (loading || !initialSyncDone) return;
    if (effectiveMaxGrid <= prevMaxGridRef.current) {
      prevMaxGridRef.current = effectiveMaxGrid;
      return;
    }
    prevMaxGridRef.current = effectiveMaxGrid;
    let currentSize = gardenData.gridSize;
    while (currentSize < effectiveMaxGrid) {
      const { canExpand: can, nextSize } = canExpandOneStep(xp, schedule, currentSize, effectiveMaxGrid);
      if (!can) break;
      currentSize = nextSize;
    }
    if (currentSize > gardenData.gridSize) {
      const updated = { ...gardenData, gridSize: currentSize, lastExpansionSize: currentSize };
      setGardenData(updated);
      saveGarden(updated);
    }
  }, [effectiveMaxGrid, loading, initialSyncDone]);

  // ─── Opt-in expansion check ─────────────────────────────────────────────────
  // Checks if the garden CAN expand by one step (user must confirm)
  const expansionCheck = useMemo(() => {
    return canExpandOneStep(xp, schedule, gardenData.gridSize, effectiveMaxGrid);
  }, [xp, schedule, gardenData.gridSize, effectiveMaxGrid]);

  const canExpand = expansionCheck.canExpand;
  const pendingGridSize = expansionCheck.nextSize;

  // Check if grid is capped (user would expand further if limit were higher)
  const gridLimitReached = useMemo(() => {
    if (gardenData.gridSize < effectiveMaxGrid) return false;
    const { canExpand: wouldExpand } = canExpandOneStep(xp, schedule, gardenData.gridSize, MAX_GRID_SIZE);
    return wouldExpand;
  }, [gardenData.gridSize, effectiveMaxGrid, xp, schedule]);

  // ─── Confirm expansion (user opts in) ──────────────────────────────────────
  const confirmExpansion = useCallback(async () => {
    if (!canExpand) return;
    const updated = { ...gardenData, gridSize: pendingGridSize, lastExpansionSize: pendingGridSize };
    setGardenData(updated);
    await saveGarden(updated);
  }, [canExpand, pendingGridSize, gardenData, saveGarden]);

  // ─── Compute tile states from XP + schedule ────────────────────────────────
  const tileStatesFromXP = useMemo(() => {
    const states = new Map<string, TileState>();
    for (const entry of schedule) {
      if (xp < entry.cumulativeXP) break;
      states.set(`${entry.row},${entry.col}`, entry.phase);
    }
    return states;
  }, [xp, schedule]);

  // ─── Track tile transitions for ripple animation ──────────────────────────
  const [pendingTransitions, setPendingTransitions] = useState<TileTransition[]>([]);
  const prevTileStatesRef = useRef<Map<string, TileState>>(new Map());

  useEffect(() => {
    if (loading) return;
    const prev = prevTileStatesRef.current;
    const center = Math.floor(MAX_GRID_SIZE / 2);
    const transitions: TileTransition[] = [];

    for (const [key, newState] of tileStatesFromXP) {
      const oldState = prev.get(key) || 'dead';
      if (oldState !== newState) {
        const [rowStr, colStr] = key.split(',');
        const row = parseInt(rowStr, 10);
        const col = parseInt(colStr, 10);
        const ring = Math.max(Math.abs(row - center), Math.abs(col - center));
        transitions.push({ row, col, from: oldState, to: newState, ring });
      }
    }

    if (transitions.length > 0) {
      setPendingTransitions(transitions);
    }

    // Update ref for next comparison
    prevTileStatesRef.current = new Map(tileStatesFromXP);
  }, [tileStatesFromXP, loading]);

  const clearTransitions = useCallback(() => setPendingTransitions([]), []);

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
    let recovered = 5; // Initial cross of 5
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
    
    // Use functional update to avoid stale closure issues when multiple trees removed simultaneously
    let wasAlreadyRemoved = false;
    setGardenData(prev => {
      if (prev.deadTreesRemoved.includes(key)) {
        wasAlreadyRemoved = true;
        return prev;
      }
      const updated = {
        ...prev,
        deadTreesRemoved: [...prev.deadTreesRemoved, key],
      };
      saveGarden(updated);
      return updated;
    });
    
    return wasAlreadyRemoved ? 0 : DEAD_TREE_REMOVAL_REWARD;
  }, [saveGarden]);

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
    // Return owned types sorted by their position in TREE_CATALOG so the
    // tree picker always matches the shop's display order.
    return TREE_CATALOG
      .filter(item => item.id === 'Basic' || (treeInventory[item.id] ?? 0) > 0)
      .map(item => item.id);
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
    canExpand,
    pendingGridSize,
    confirmExpansion,
    gridLimitReached,
    recoveryQueue,
    pendingTransitions,
    clearTransitions,
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
    lastXPGainTimestamp: gardenData.lastXPGainTimestamp,
  };
}

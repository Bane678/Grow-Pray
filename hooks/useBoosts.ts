import { useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Boost Catalog ─────────────────────────────────────────────────────────────

export interface BoostDefinition {
  id: string;
  name: string;
  icon: string;
  description: string;
  price: number;
  /** XP multiplier bonus (additive). 0.5 = +50% XP */
  xpBonus: number;
  /** Coin bonus per prayer (additive). 1 = +1 coin */
  coinBonus: number;
  /** Duration in hours. 0 = single-use (next prayer only) */
  durationHours: number;
  /** Rarity tier for styling */
  tier: 'basic' | 'enhanced' | 'divine';
}

export const BOOST_CATALOG: BoostDefinition[] = [
  {
    id: 'focus',
    name: 'Focus',
    icon: '🕯️',
    description: 'Steady focus for your next 3 hours of prayers. +25% XP.',
    price: 30,
    xpBonus: 0.25,
    coinBonus: 0,
    durationHours: 3,
    tier: 'basic',
  },
  {
    id: 'bloom',
    name: 'Bloom',
    icon: '🌸',
    description: 'Your garden blooms with energy for 6 hours. +50% XP & +1 coin per prayer.',
    price: 75,
    xpBonus: 0.5,
    coinBonus: 1,
    durationHours: 6,
    tier: 'enhanced',
  },
  {
    id: 'radiance',
    name: 'Radiance',
    icon: '✨',
    description: 'A full day of radiant blessings. +75% XP & +2 coins per prayer for 24 hours.',
    price: 150,
    xpBonus: 0.75,
    coinBonus: 2,
    durationHours: 24,
    tier: 'enhanced',
  },
  {
    id: 'noor',
    name: 'Divine Noor',
    icon: '🌟',
    description: 'The light of Noor fills your garden for 48 hours. +100% XP & +3 coins per prayer.',
    price: 350,
    xpBonus: 1.0,
    coinBonus: 3,
    durationHours: 48,
    tier: 'divine',
  },
];

// ─── Persisted State ────────────────────────────────────────────────────────────

const BOOSTS_INVENTORY_KEY = '@GrowPray:boostInventory';
const ACTIVE_BOOST_KEY = '@GrowPray:activeBoost';

export interface ActiveBoost {
  boostId: string;
  activatedAt: number;   // timestamp ms
  expiresAt: number;     // timestamp ms
}

export interface BoostState {
  /** Inventory counts: boostId → count */
  inventory: Record<string, number>;
  /** Currently active boost (only one at a time) */
  activeBoost: ActiveBoost | null;
  /** Combined XP multiplier from the active boost (1.0 = no boost) */
  xpMultiplier: number;
  /** Coin bonus per prayer from the active boost */
  coinBonus: number;
  /** Purchase a boost (adds to inventory) */
  purchaseBoost: (boostId: string) => Promise<boolean>;
  /** Activate a boost from inventory */
  activateBoost: (boostId: string) => Promise<boolean>;
  /** Time remaining on active boost in ms (0 if none) */
  timeRemainingMs: number;
  /** Whether state has loaded from storage */
  loaded: boolean;
}

export function useBoosts(
  coins: number,
  onSpendCoins: (amount: number, reason: string) => void,
): BoostState {
  const [inventory, setInventory] = useState<Record<string, number>>({});
  const [activeBoost, setActiveBoost] = useState<ActiveBoost | null>(null);
  const [timeRemainingMs, setTimeRemainingMs] = useState(0);
  const [loaded, setLoaded] = useState(false);

  // Keep refs for values that change frequently so callbacks stay stable
  const coinsRef = useRef(coins);
  coinsRef.current = coins;
  const spendRef = useRef(onSpendCoins);
  spendRef.current = onSpendCoins;
  const inventoryRef = useRef(inventory);
  inventoryRef.current = inventory;

  // Load from storage
  useEffect(() => {
    (async () => {
      try {
        const [invStr, activeStr] = await Promise.all([
          AsyncStorage.getItem(BOOSTS_INVENTORY_KEY),
          AsyncStorage.getItem(ACTIVE_BOOST_KEY),
        ]);
        if (invStr) setInventory(JSON.parse(invStr));
        if (activeStr) {
          const parsed: ActiveBoost = JSON.parse(activeStr);
          if (parsed.expiresAt > Date.now()) {
            setActiveBoost(parsed);
          } else {
            // Expired — clean up
            await AsyncStorage.removeItem(ACTIVE_BOOST_KEY);
          }
        }
      } catch {}
      setLoaded(true);
    })();
  }, []);

  // Timer to track remaining time and auto-expire
  useEffect(() => {
    if (!activeBoost) {
      setTimeRemainingMs(0);
      return;
    }

    const update = () => {
      const remaining = activeBoost.expiresAt - Date.now();
      if (remaining <= 0) {
        setActiveBoost(null);
        setTimeRemainingMs(0);
        AsyncStorage.removeItem(ACTIVE_BOOST_KEY).catch(() => {});
      } else {
        setTimeRemainingMs(remaining);
      }
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [activeBoost]);

  // Save helpers
  const saveInventory = useCallback(async (inv: Record<string, number>) => {
    setInventory(inv);
    await AsyncStorage.setItem(BOOSTS_INVENTORY_KEY, JSON.stringify(inv));
  }, []);

  const saveActiveBoost = useCallback(async (boost: ActiveBoost | null) => {
    setActiveBoost(boost);
    if (boost) {
      await AsyncStorage.setItem(ACTIVE_BOOST_KEY, JSON.stringify(boost));
    } else {
      await AsyncStorage.removeItem(ACTIVE_BOOST_KEY);
    }
  }, []);

  // Purchase a boost
  const purchaseBoost = useCallback(async (boostId: string): Promise<boolean> => {
    const def = BOOST_CATALOG.find(b => b.id === boostId);
    if (!def || coinsRef.current < def.price) return false;

    spendRef.current(def.price, 'boost_purchase');
    const updated = { ...inventoryRef.current, [boostId]: (inventoryRef.current[boostId] || 0) + 1 };
    await saveInventory(updated);
    return true;
  }, [saveInventory]);

  // Activate a boost from inventory
  const activateBoost = useCallback(async (boostId: string): Promise<boolean> => {
    const count = inventoryRef.current[boostId] || 0;
    if (count <= 0) return false;

    const def = BOOST_CATALOG.find(b => b.id === boostId);
    if (!def) return false;

    const now = Date.now();
    const boost: ActiveBoost = {
      boostId,
      activatedAt: now,
      expiresAt: now + def.durationHours * 60 * 60 * 1000,
    };

    // Consume from inventory
    const updated = { ...inventoryRef.current, [boostId]: count - 1 };
    await saveInventory(updated);
    await saveActiveBoost(boost);
    return true;
  }, [saveInventory, saveActiveBoost]);

  // Compute current multipliers from active boost
  let xpMultiplier = 1.0;
  let coinBonus = 0;
  if (activeBoost && activeBoost.expiresAt > Date.now()) {
    const def = BOOST_CATALOG.find(b => b.id === activeBoost.boostId);
    if (def) {
      xpMultiplier = 1.0 + def.xpBonus;
      coinBonus = def.coinBonus;
    }
  }

  return {
    inventory,
    activeBoost,
    xpMultiplier,
    coinBonus,
    purchaseBoost,
    activateBoost,
    timeRemainingMs,
    loaded,
  };
}

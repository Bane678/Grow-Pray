import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  Image,
  StyleSheet,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { BOOST_CATALOG, BoostDefinition, ActiveBoost } from '../hooks/useBoosts';

// ─── Freeze icons ─────────────────────────────────────────────────────────────
const SINGLE_FREEZE_ICON = require('../assets/Garden Assets/Icons/Streak_Freeze.png');
const ALL_FREEZE_ICON = require('../assets/Garden Assets/Icons/5_Streak_Freeze.png');

// ─── Custom pixel-art icons ───────────────────────────────────────────────────
const ICON_COIN = require('../assets/Garden Assets/Icons/Icon_Coin.png');
const ICON_HANDFUL = require('../assets/Garden Assets/Icons/Icon_Handful.png');
const ICON_POUCH = require('../assets/Garden Assets/Icons/Icon_Pouch.png');
const ICON_CHEST = require('../assets/Garden Assets/Icons/Icon_Chest.png');
const ICON_TREASURY = require('../assets/Garden Assets/Icons/Icon_Treasury.png');

// ─── Tree catalog ──────────────────────────────────────────────────────────────

export interface TreeCatalogItem {
  id: string;
  name: string;
  price: number;
  rarity: 'common' | 'rare' | 'premium';
  tint: string;       // tintColor applied to the base tree sprites (ignored when sprites provided)
  description: string;
  premiumOnly?: boolean;
  /** If set, uses dedicated per-stage sprites instead of tinting the base sprites */
  sprites?: {
    sapling?: string;
    growing?: string;
    grown?: string;
    flourishing?: string;
  };
  /** Per-stage final render scale overrides (replaces the default stage scale × 0.9) */
  scaleOverrides?: {
    sapling?: number;
    growing?: number;
    grown?: number;
    flourishing?: number;
  };
  /** Horizontal pixel offset at rendered size to correct for trunk not centred in asset (positive = right) */
  offsetX?: {
    sapling?: number;
    growing?: number;
    grown?: number;
    flourishing?: number;
  };
  /** Vertical pixel offset at rendered size (positive = down, negative = up) */
  offsetY?: {
    sapling?: number;
    growing?: number;
    grown?: number;
    flourishing?: number;
  };
}

export const TREE_CATALOG: TreeCatalogItem[] = [
  {
    id: 'Basic',
    name: 'Basic Tree',
    price: 0,
    rarity: 'common',
    tint: '',  // no tint — default green
    description: 'A simple tree. Free with every garden!',
  },
  {
    id: 'Palm',
    name: 'Palm Tree',
    price: 50,
    rarity: 'common',
    tint: '#7ecf6f',
    description: 'A lush tropical palm that sways in the breeze.',
    sprites: {
      sapling:     'palmSapling',
      growing:     'palmGrowing',
      grown:       'palmGrown',
      flourishing: 'palmFlourishing',
    },
    scaleOverrides: {
      sapling:     0.100,
      growing:     0.100,
      grown:       0.117,
      flourishing: 0.132,
    },
    offsetX: {
      sapling:     -2,
      growing:     9,
      grown:       17,
      flourishing: 19,
    },
    offsetY: {
      sapling:     -2,
      growing:     -12,
      grown:       -18,
      flourishing: -18,
    },
  },
  {
    id: 'Oak',
    name: 'Oak Tree',
    price: 50,
    rarity: 'common',
    tint: '#8B7355',
    description: 'A sturdy, resilient oak. Symbol of strength.',
    sprites: {
      sapling:     'oakSapling',
      growing:     'oakGrowing',
      grown:       'oakGrown',
      flourishing: 'oakFlourishing',
    },
    scaleOverrides: {
      sapling:     0.090,
      growing:     0.108,
      grown:       0.106,
      flourishing: 0.137,
    },
    offsetX: {
      sapling:     -2,
      growing:     2,
      grown:       1,
      flourishing: 1,
    },
    offsetY: {
      sapling:     -2,
      growing:     -2,
      grown:       -18,
      flourishing: -18,
    },
  },
  {
    id: 'Willow',
    name: 'Willow Tree',
    price: 75,
    rarity: 'common',
    tint: '#5cad6b',
    description: 'Graceful branches cascade like flowing water.',
    sprites: {
      sapling:     'willowSapling',
      growing:     'willowGrowing',
      grown:       'willowGrown',
      flourishing: 'willowFlourishing',
    },
    scaleOverrides: {
      sapling:     0.090,
      growing:     0.082,
      grown:       0.085,
      flourishing: 0.108,
    },
    offsetX: {
      sapling:     -2,
      growing:     0,
      grown:       5,
      flourishing: 5,
    },
    offsetY: {
      sapling:     -2,
      growing:     -12,
      grown:       -22,
      flourishing: -22,
    },
  },
  {
    id: 'CherryBlossom',
    name: 'Cherry Blossom',
    price: 200,
    rarity: 'rare',
    tint: '#FFB7C5',
    description: 'Delicate pink petals signifying renewal and hope.',
    sprites: {
      sapling:     'cherryBlossomSapling',
      growing:     'cherryBlossomGrowing',
      grown:       'cherryBlossomGrown',
      flourishing: 'cherryBlossomFlourishing',
    },
    scaleOverrides: {
      sapling:     0.090,
      growing:     0.108,
      grown:       0.133,
      flourishing: 0.154,
    },
    offsetX: {
      sapling:     -2,
      growing:     -1,
      grown:       0,
      flourishing: 0,
    },
    offsetY: {
      sapling:     -2,
      growing:     -4,
      grown:       -8,
      flourishing: -8,
    },
  },
  {
    id: 'Maple',
    name: 'Maple Tree',
    price: 200,
    rarity: 'rare',
    tint: '#D2691E',
    description: 'Fiery autumn leaves that warm the garden.',
    sprites: {
      sapling:     'mapleSapling',
      growing:     'mapleGrowing',
      grown:       'mapleGrown',
      flourishing: 'mapleFlourishing',
    },
    scaleOverrides: {
      sapling:     0.090,
      growing:     0.113,
      grown:       0.149,
      flourishing: 0.153,
    },
    offsetX: {
      sapling:     -2,
      growing:      2,
      grown:        0,
      flourishing:  1,
    },
    offsetY: {
      sapling:     -2,
      growing:     -8,
      grown:       -2,
      flourishing: -12,
    },
  },
  {
    id: 'Golden',
    name: 'Golden Tree',
    price: 500,
    rarity: 'premium',
    tint: '#FFD700',
    description: 'A radiant tree that glows with divine light.',
    premiumOnly: true,
    sprites: {
      sapling:     'goldenTreeSapling',
      growing:     'goldenTreeGrowing',
      grown:       'goldenTreeGrown',
      flourishing: 'goldenTreeFlourishing',
    },
    scaleOverrides: {
      sapling:     0.090,
      growing:     0.118,
      grown:       0.142,
      flourishing: 0.170,
    },
    offsetX: {
      sapling:     -2,
      growing:     0,
      grown:       1,
      flourishing: 2,
    },
    offsetY: {
      sapling:     -2,
      growing:     -4,
      grown:       -3,
      flourishing: -3,
    },
  },
  {
    id: 'Cedar',
    name: 'Cedar of Jannah',
    price: 500,
    rarity: 'premium',
    tint: '#1B4332',
    description: 'An ancient, towering cedar from the gardens of paradise.',
    premiumOnly: true,
    sprites: {
      sapling:     'cedarSapling',
      growing:     'cedarGrowing',
      grown:       'cedarGrown',
      flourishing: 'cedarFlourishing',
    },
    scaleOverrides: {
      sapling:     0.090,
      growing:     0.108,
      grown:       0.126,
      flourishing: 0.144,
    },
    offsetX: {
      sapling:     -2,
      growing:     2,
      grown:       2,
      flourishing: 2,
    },
    offsetY: {
      sapling:     -2,
      growing:     -6,
      grown:       -11,
      flourishing: -13,
    },
  },
];

// ─── Coin packages ──────────────────────────────────────────────────────────────

export interface CoinPackage {
  id: string;
  name: string;
  coins: number;
  price: string;      // Display price
  productId: string;  // App Store / Google Play product ID
  icon: ReturnType<typeof require>;
  bestValue?: boolean;
  bonusPercent?: number;
}

export const COIN_PACKAGES: CoinPackage[] = [
  {
    id: 'handful',
    name: 'Handful',
    coins: 500,
    price: '$0.99',
    productId: 'jannah_coins_500',
    icon: ICON_HANDFUL,
  },
  {
    id: 'pouch',
    name: 'Pouch',
    coins: 1500,
    price: '$2.99',
    productId: 'jannah_coins_1500',
    icon: ICON_POUCH,
    bonusPercent: 1,
  },
  {
    id: 'chest',
    name: 'Chest',
    coins: 5000,
    price: '$7.99',
    productId: 'jannah_coins_5000',
    icon: ICON_CHEST,
    bonusPercent: 26,
  },
  {
    id: 'treasury',
    name: 'Treasury',
    coins: 12000,
    price: '$14.99',
    productId: 'jannah_coins_12000',
    icon: ICON_TREASURY,
    bestValue: true,
    bonusPercent: 61,
  },
];

// ─── Types ──────────────────────────────────────────────────────────────────────

type ShopTab = 'trees' | 'freezes' | 'coins' | 'boosts';

interface ShopModalProps {
  visible: boolean;
  onClose: () => void;
  coins: number;
  inventory: Record<string, number>; // treeId → count owned
  onPurchaseTree: (treeId: string) => Promise<boolean>;
  isPremium?: boolean;
  onPremiumTap?: () => void;
  // Streak freezes
  freezeInventory: { single: number; all: number };
  onPurchaseFreeze: (type: 'single' | 'all', cost: number) => Promise<boolean>;
  // Coin purchases (IAP)
  onPurchaseCoins?: (packageId: string, coins: number) => Promise<boolean>;
  // Boosts
  boostInventory?: Record<string, number>;
  activeBoost?: ActiveBoost | null;
  boostTimeRemainingMs?: number;
  onPurchaseBoost?: (boostId: string) => Promise<boolean>;
  onActivateBoost?: (boostId: string) => Promise<boolean>;
  asPage?: boolean;
}

// ─── Rarity badge helpers ───────────────────────────────────────────────────────

const RARITY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  common:  { bg: 'rgba(74, 222, 128, 0.15)', text: '#4ade80', border: 'rgba(74, 222, 128, 0.3)' },
  rare:    { bg: 'rgba(168, 85, 247, 0.15)', text: '#a855f7', border: 'rgba(168, 85, 247, 0.3)' },
  premium: { bg: 'rgba(251, 191, 36, 0.15)', text: '#fbbf24', border: 'rgba(251, 191, 36, 0.3)' },
};

// Preview asset — we use sapling (what gets planted) as the shop preview
const PREVIEW_ASSET = require('../assets/Garden Assets/Tree Types/Basic Trees/Sapling_converted.png');

// Per-tree custom preview assets keyed by sprites.sapling value
const CUSTOM_PREVIEW_ASSETS: Record<string, ReturnType<typeof require>> = {
  palmSapling:   require('../assets/Garden Assets/Tree Types/Palm Trees/Palm_Sapling.png'),
  willowSapling: require('../assets/Garden Assets/Tree Types/Willow Trees/Willow_Sapling.png'),
  oakSapling:          require('../assets/Garden Assets/Tree Types/Oak Trees/Oak_Sapling.png'),
  cherryBlossomSapling: require('../assets/Garden Assets/Tree Types/Cherry Blossom Trees/Cherry_Blossom_Sapling.png'),
  mapleSapling:         require('../assets/Garden Assets/Tree Types/Maple Trees/Maple_Sapling.png'),
  goldenTreeSapling:    require('../assets/Garden Assets/Tree Types/Golden Trees/Golden_Tree_Sapling.png'),
  cedarSapling:         require('../assets/Garden Assets/Tree Types/Cedar Trees/Cedar_Sapling.png'),
};

// ─── Component ──────────────────────────────────────────────────────────────────

export function ShopModal({
  visible,
  onClose,
  coins,
  inventory,
  onPurchaseTree,
  isPremium = false,
  onPremiumTap,
  freezeInventory,
  onPurchaseFreeze,
  onPurchaseCoins,
  boostInventory = {},
  activeBoost = null,
  boostTimeRemainingMs = 0,
  onPurchaseBoost,
  onActivateBoost,
  asPage = false,
}: ShopModalProps) {
  const [activeTab, setActiveTab] = useState<ShopTab>('trees');
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [purchasingFreeze, setPurchasingFreeze] = useState<'single' | 'all' | null>(null);
  const [purchasingCoinPkg, setPurchasingCoinPkg] = useState<string | null>(null);
  const [coinPurchaseSuccess, setCoinPurchaseSuccess] = useState<string | null>(null);

  const handlePurchase = useCallback(async (item: TreeCatalogItem) => {
    if (purchasing) return;
    if (item.premiumOnly && !isPremium) return;
    if (coins < item.price) return;

    setPurchasing(item.id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const success = await onPurchaseTree(item.id);
    if (success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setPurchasing(null);
  }, [purchasing, coins, isPremium, onPurchaseTree]);

  const handlePurchaseCoinPackage = useCallback(async (pkg: CoinPackage) => {
    if (purchasingCoinPkg || !onPurchaseCoins) return;

    setPurchasingCoinPkg(pkg.id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const success = await onPurchaseCoins(pkg.id, pkg.coins);
    if (success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCoinPurchaseSuccess(pkg.id);
      setTimeout(() => setCoinPurchaseSuccess(null), 2000);
    }
    setPurchasingCoinPkg(null);
  }, [purchasingCoinPkg, onPurchaseCoins]);

  const handlePurchaseFreeze = useCallback(async (type: 'single' | 'all', cost: number) => {
    if (purchasingFreeze) return;
    if (coins < cost) return;

    setPurchasingFreeze(type);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const success = await onPurchaseFreeze(type, cost);
    if (success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setPurchasingFreeze(null);
  }, [purchasingFreeze, coins, onPurchaseFreeze]);

  const [purchasingBoost, setPurchasingBoost] = useState<string | null>(null);
  const [activatingBoost, setActivatingBoost] = useState<string | null>(null);
  const [expandedBoost, setExpandedBoost] = useState<string | null>(null);

  const handlePurchaseBoost = useCallback(async (boost: BoostDefinition) => {
    if (purchasingBoost || !onPurchaseBoost) return;
    if (coins < boost.price) return;

    setPurchasingBoost(boost.id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const success = await onPurchaseBoost(boost.id);
    if (success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setPurchasingBoost(null);
  }, [purchasingBoost, coins, onPurchaseBoost]);

  const handleActivateBoost = useCallback(async (boostId: string) => {
    if (activatingBoost || !onActivateBoost) return;

    setActivatingBoost(boostId);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const success = await onActivateBoost(boostId);
    if (success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setActivatingBoost(null);
  }, [activatingBoost, onActivateBoost]);

  const formatBoostTime = (ms: number): string => {
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  const renderTreeCard = (item: TreeCatalogItem) => {
    const owned = inventory[item.id] || 0;
    const canAfford = coins >= item.price;
    const locked = item.premiumOnly && !isPremium;
    const isFree = item.price === 0;
    const rarity = RARITY_COLORS[item.rarity];

    return (
      <View
        key={item.id}
        style={[
          styles.treeCard,
          { borderColor: rarity.border },
          locked && styles.lockedCard,
        ]}
      >
        {/* Tree preview with tint */}
        <View style={styles.previewContainer}>
          <Image
            source={item.sprites?.sapling && CUSTOM_PREVIEW_ASSETS[item.sprites.sapling] ? CUSTOM_PREVIEW_ASSETS[item.sprites.sapling] : PREVIEW_ASSET}
            style={[
              styles.treePreview,
              !item.sprites?.sapling && item.tint ? { tintColor: item.tint } : {},
            ]}
            resizeMode="contain"
          />
          {locked && (
            <View style={styles.lockOverlay}>
              <MaterialCommunityIcons name="lock" size={24} color="#fbbf24" />
            </View>
          )}
        </View>

        {/* Info */}
        <View style={styles.cardInfo}>
          <View style={styles.cardHeader}>
            <Text style={styles.treeName} numberOfLines={2}>
              {item.name}
            </Text>
            <View style={[styles.rarityBadge, { backgroundColor: rarity.bg, borderColor: rarity.border }]}>
              <Text style={[styles.rarityText, { color: rarity.text }]}>
                {item.rarity.charAt(0).toUpperCase() + item.rarity.slice(1)}
              </Text>
            </View>
          </View>

          <Text style={styles.treeDesc} numberOfLines={2}>{item.description}</Text>

          <Text style={[styles.ownedText, { opacity: owned > 0 ? 1 : 0 }]}>
            Owned: {owned}
          </Text>
        </View>

        {/* Purchase button */}
        <View style={styles.priceSection}>
          {isFree ? (
            <View style={[styles.buyButton, { backgroundColor: 'rgba(74, 222, 128, 0.2)' }]}>
              <Text style={{ color: '#4ade80', fontSize: 12, fontWeight: '700' }}>Free</Text>
            </View>
          ) : locked ? (
            <TouchableOpacity
              onPress={onPremiumTap}
              style={[styles.buyButton, { backgroundColor: 'rgba(251, 191, 36, 0.15)' }]}
            >
              <Text style={{ color: '#fbbf24', fontSize: 11, fontWeight: '600' }}>👑 Premium</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={() => handlePurchase(item)}
              disabled={!canAfford || purchasing === item.id}
              style={[
                styles.buyButton,
                canAfford
                  ? { backgroundColor: '#22c55e' }
                  : { backgroundColor: '#374151' },
                purchasing === item.id && { opacity: 0.45 },
              ]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <Image source={ICON_COIN} style={{ width: 12, height: 12 }} resizeMode="contain" />
                <Text style={{ color: canAfford ? '#fff' : '#6b7280', fontSize: 12, fontWeight: '700' }}>
                  {purchasing === item.id ? '...' : `${item.price}`}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const content = (
    <>
      {/* Header */}
          <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 24 }}>🏪</Text>
              <Text style={styles.title}>Shop</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={styles.coinBadge}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Image source={ICON_COIN} style={{ width: 14, height: 14 }} resizeMode="contain" />
                  <Text style={styles.coinText}>{coins}</Text>
                </View>
              </View>
              {!asPage && (
                <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <MaterialCommunityIcons name="close" size={24} color="#9ca3af" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Tabs */}
          <View style={styles.tabRow}>
            {(['trees', 'freezes', 'coins', 'boosts'] as ShopTab[]).map((tab) => {
              const isActive = activeTab === tab;
              const labels: Record<ShopTab, string> = {
                trees: '🌳 Trees',
                freezes: 'Freezes',
                coins: 'Coins',
                boosts: '⚡ Boosts',
              };
              return (
                <TouchableOpacity
                  key={tab}
                  onPress={() => setActiveTab(tab)}
                  style={[styles.tab, isActive && styles.activeTab]}
                >
                  {tab === 'freezes' ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Image source={SINGLE_FREEZE_ICON} style={{ width: 14, height: 14 }} resizeMode="contain" />
                      <Text style={[styles.tabText, isActive && styles.activeTabText]}>Freezes</Text>
                    </View>
                  ) : tab === 'coins' ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Image source={ICON_COIN} style={{ width: 12, height: 12 }} resizeMode="contain" />
                      <Text style={[styles.tabText, isActive && styles.activeTabText]}>Coins</Text>
                    </View>
                  ) : (
                    <Text style={[styles.tabText, isActive && styles.activeTabText]}>
                      {labels[tab]}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Content */}
          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={{ paddingBottom: 16 }}
            showsVerticalScrollIndicator={false}
          >
            {activeTab === 'trees' && (
              <>
                {/* Common */}
                <Text style={styles.sectionTitle}>Common</Text>
                {TREE_CATALOG.filter(t => t.rarity === 'common').map(renderTreeCard)}

                {/* Rare */}
                <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Rare</Text>
                {TREE_CATALOG.filter(t => t.rarity === 'rare').map(renderTreeCard)}

                {/* Premium */}
                <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Premium</Text>
                {TREE_CATALOG.filter(t => t.rarity === 'premium').map(renderTreeCard)}
              </>
            )}

            {activeTab === 'freezes' && (
              <>
                {/* Single Prayer Freeze */}
                <View style={[styles.freezeCard, { borderColor: 'rgba(74, 222, 128, 0.3)' }]}>
                  <View style={styles.freezeIconContainer}>
                    <Image source={SINGLE_FREEZE_ICON} style={{ width: 40, height: 40 }} resizeMode="contain" />
                  </View>
                  <View style={styles.freezeInfo}>
                    <Text style={styles.freezeName}>Single Prayer Freeze</Text>
                    <Text style={styles.freezeDesc}>Protect one prayer's streak when you miss it. Use when prompted after missing a prayer.</Text>
                    {freezeInventory.single > 0 && (
                      <Text style={styles.ownedText}>Owned: {freezeInventory.single}</Text>
                    )}
                  </View>
                  <View style={styles.priceSection}>
                    <TouchableOpacity
                      onPress={() => handlePurchaseFreeze('single', 50)}
                      disabled={coins < 50 || purchasingFreeze === 'single'}
                      style={[
                        styles.buyButton,
                        coins >= 50
                          ? { backgroundColor: '#22c55e' }
                          : { backgroundColor: '#374151' },
                      ]}
                    >
                      <Text style={{
                        color: coins >= 50 ? '#fff' : '#6b7280',
                        fontSize: 12,
                        fontWeight: '700',
                      }}>
                        {purchasingFreeze === 'single' ? '...' : (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                            <Image source={ICON_COIN} style={{ width: 12, height: 12 }} resizeMode="contain" />
                            <Text style={{ color: coins >= 50 ? '#fff' : '#6b7280', fontSize: 12, fontWeight: '700' }}>50</Text>
                          </View>
                        )}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* All Prayers Freeze */}
                <View style={[styles.freezeCard, { borderColor: 'rgba(168, 85, 247, 0.3)', marginTop: 12 }]}>
                  <View style={styles.freezeIconContainer}>
                    <Image source={ALL_FREEZE_ICON} style={{ width: 40, height: 40 }} resizeMode="contain" />
                  </View>
                  <View style={styles.freezeInfo}>
                    <Text style={styles.freezeName}>All Prayers Freeze</Text>
                    <Text style={styles.freezeDesc}>Protect all 5 prayer streaks for one day. Also keeps your perfect day streak alive! Perfect for travel or busy days.</Text>
                    {freezeInventory.all > 0 && (
                      <Text style={styles.ownedText}>Owned: {freezeInventory.all}</Text>
                    )}
                  </View>
                  <View style={styles.priceSection}>
                    <TouchableOpacity
                      onPress={() => handlePurchaseFreeze('all', 150)}
                      disabled={coins < 150 || purchasingFreeze === 'all'}
                      style={[
                        styles.buyButton,
                        coins >= 150
                          ? { backgroundColor: '#22c55e' }
                          : { backgroundColor: '#374151' },
                      ]}
                    >
                      <Text style={{
                        color: coins >= 150 ? '#fff' : '#6b7280',
                        fontSize: 12,
                        fontWeight: '700',
                      }}>
                        {purchasingFreeze === 'all' ? '...' : (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                            <Image source={ICON_COIN} style={{ width: 12, height: 12 }} resizeMode="contain" />
                            <Text style={{ color: coins >= 150 ? '#fff' : '#6b7280', fontSize: 12, fontWeight: '700' }}>150</Text>
                          </View>
                        )}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Info section */}
                <View style={styles.freezeInfoBox}>
                  <Text style={styles.freezeInfoTitle}>How Streak Freezes Work</Text>
                  <Text style={styles.freezeInfoText}>
                    • Single freezes protect individual prayers{'\n'}
                    • All-prayer freezes protect your entire day + consistency multiplier{'\n'}
                    • You'll be prompted to use them when you miss prayers{'\n'}
                    • Freezes are consumed on use
                  </Text>
                </View>
              </>
            )}

            {activeTab === 'coins' && (
              <>
                <Text style={[styles.sectionTitle, { marginBottom: 4 }]}>Buy Coins</Text>
                <Text style={{ color: '#9ca3af', fontSize: 12, marginBottom: 12, lineHeight: 16 }}>
                  Use coins to buy trees, streak freezes, and more.
                </Text>

                {COIN_PACKAGES.map((pkg) => {
                  const isProcessing = purchasingCoinPkg === pkg.id;
                  const justPurchased = coinPurchaseSuccess === pkg.id;

                  return (
                    <View
                      key={pkg.id}
                      style={[
                        styles.coinPackageCard,
                        pkg.bestValue && styles.coinPackageBest,
                      ]}
                    >
                      {pkg.bestValue && (
                        <View style={styles.bestValueBadge}>
                          <Text style={styles.bestValueText}>BEST VALUE</Text>
                        </View>
                      )}

                      <View style={styles.coinPackageIcon}>
                        <Image source={pkg.icon} style={{ width: 36, height: 36 }} resizeMode="contain" />
                      </View>

                      <View style={styles.coinPackageInfo}>
                        <Text style={styles.coinPackageName}>{pkg.name}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Image source={ICON_COIN} style={{ width: 14, height: 14 }} resizeMode="contain" />
                          <Text style={styles.coinPackageAmount}>{pkg.coins.toLocaleString()}</Text>
                          {pkg.bonusPercent != null && pkg.bonusPercent > 0 && (
                            <View style={styles.bonusBadge}>
                              <Text style={styles.bonusText}>+{pkg.bonusPercent}% bonus</Text>
                            </View>
                          )}
                        </View>
                      </View>

                      <TouchableOpacity
                        onPress={() => handlePurchaseCoinPackage(pkg)}
                        disabled={isProcessing}
                        style={[
                          styles.coinBuyButton,
                          justPurchased && { backgroundColor: '#22c55e' },
                        ]}
                      >
                        <Text style={styles.coinBuyText}>
                          {isProcessing ? '...' : justPurchased ? '✓ Added!' : pkg.price}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}

                {/* Info section */}
                <View style={[styles.freezeInfoBox, { marginTop: 12 }]}>
                  <Text style={styles.freezeInfoTitle}>About Coin Purchases</Text>
                  <Text style={styles.freezeInfoText}>
                    • Coins are added to your balance instantly{'\n'}
                    • Purchases are one-time (not subscriptions){'\n'}
                    • Larger packs give more coins per dollar{'\n'}
                    • Coins never expire
                  </Text>
                </View>
              </>
            )}

            {activeTab === 'boosts' && (
              <>
                {/* Active boost banner */}
                {activeBoost && boostTimeRemainingMs > 0 && (() => {
                  const def = BOOST_CATALOG.find(b => b.id === activeBoost.boostId);
                  if (!def) return null;
                  const tierColor = def.tier === 'divine' ? '#fbbf24' : def.tier === 'enhanced' ? '#a855f7' : '#4ade80';
                  return (
                    <View style={[styles.activeBoostBanner, { borderColor: tierColor + '40' }]}>
                      <Text style={{ fontSize: 24 }}>{def.icon}</Text>
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={{ color: tierColor, fontSize: 13, fontWeight: '700' }}>
                          {def.name} Active
                        </Text>
                        <Text style={{ color: '#9ca3af', fontSize: 11, marginTop: 2 }}>
                          +{Math.round(def.xpBonus * 100)}% XP{def.coinBonus > 0 ? ` · +${def.coinBonus} coins` : ''} · {formatBoostTime(boostTimeRemainingMs)} left
                        </Text>
                      </View>
                      <View style={[styles.activeBoostDot, { backgroundColor: tierColor }]} />
                    </View>
                  );
                })()}

                {BOOST_CATALOG.map((boost) => {
                  const owned = boostInventory[boost.id] || 0;
                  const canAfford = coins >= boost.price;
                  const isActive = activeBoost?.boostId === boost.id && boostTimeRemainingMs > 0;
                  const hasAnyActive = activeBoost !== null && boostTimeRemainingMs > 0;
                  const tierColor = boost.tier === 'divine' ? '#fbbf24' : boost.tier === 'enhanced' ? '#a855f7' : '#4ade80';
                  const tierBg = boost.tier === 'divine' ? 'rgba(251,191,36,0.08)' : boost.tier === 'enhanced' ? 'rgba(168,85,247,0.08)' : 'rgba(74,222,128,0.08)';

                  return (
                    <TouchableOpacity key={boost.id} activeOpacity={boost.tier !== 'basic' ? 0.85 : 1} onPress={() => { if (boost.tier !== 'basic') setExpandedBoost(expandedBoost === boost.id ? null : boost.id); }} style={[styles.boostCard, { borderColor: tierColor + '30', backgroundColor: tierBg }]}>
                      <View style={[styles.boostIconContainer, { backgroundColor: tierColor + '18' }]}>
                        <Text style={{ fontSize: 28 }}>{boost.icon}</Text>
                      </View>
                      <View style={styles.boostInfo}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={[styles.boostName, { color: tierColor }]}>{boost.name}</Text>
                          <View style={[styles.boostDurationBadge, { backgroundColor: tierColor + '18' }]}>
                            <Text style={{ color: tierColor, fontSize: 9, fontWeight: '700' }}>{boost.durationHours}h</Text>
                          </View>
                        </View>
                        <Text style={styles.boostDesc} numberOfLines={boost.tier !== 'basic' && expandedBoost !== boost.id ? 2 : undefined}>{boost.description}</Text>
                        {boost.tier !== 'basic' && expandedBoost !== boost.id && (
                          <Text style={{ color: tierColor + 'aa', fontSize: 10, marginTop: 2 }}>tap to read more</Text>
                        )}
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                          <Text style={{ color: '#e8a87c', fontSize: 11, fontWeight: '600' }}>+{Math.round(boost.xpBonus * 100)}% XP</Text>
                          {boost.coinBonus > 0 && (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                            <Text style={{ color: '#fbbf24', fontSize: 11, fontWeight: '600' }}>+{boost.coinBonus}</Text>
                            <Image source={ICON_COIN} style={{ width: 11, height: 11 }} resizeMode="contain" />
                          </View>
                          )}
                          {owned > 0 && (
                            <Text style={{ color: '#4ade80', fontSize: 11, fontWeight: '600' }}>Owned: {owned}</Text>
                          )}
                        </View>
                      </View>
                      <View style={{ alignItems: 'center', marginLeft: 8, gap: 6 }}>
                        {/* Buy button */}
                        <TouchableOpacity
                          onPress={() => handlePurchaseBoost(boost)}
                          disabled={!canAfford || purchasingBoost === boost.id}
                          style={[
                            styles.buyButton,
                            canAfford ? { backgroundColor: '#22c55e' } : { backgroundColor: '#374151' },
                            purchasingBoost === boost.id && { opacity: 0.45 },
                          ]}
                        >
                          {purchasingBoost === boost.id ? (
                            <Text style={{ color: canAfford ? '#fff' : '#6b7280', fontSize: 12, fontWeight: '700' }}>...</Text>
                          ) : (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                              <Image source={ICON_COIN} style={{ width: 12, height: 12 }} resizeMode="contain" />
                              <Text style={{ color: canAfford ? '#fff' : '#6b7280', fontSize: 12, fontWeight: '700' }}>{boost.price}</Text>
                            </View>
                          )}
                        </TouchableOpacity>
                        {/* Activate button (if owned and no other boost active) */}
                        {owned > 0 && !isActive && (
                          <TouchableOpacity
                            onPress={() => handleActivateBoost(boost.id)}
                            disabled={hasAnyActive || activatingBoost === boost.id}
                            style={[
                              styles.boostActivateBtn,
                              { borderColor: tierColor + '50' },
                              hasAnyActive && { opacity: 0.35 },
                            ]}
                          >
                            <Text style={{ color: tierColor, fontSize: 11, fontWeight: '700' }}>
                              {activatingBoost === boost.id ? '...' : '⚡ Use'}
                            </Text>
                          </TouchableOpacity>
                        )}
                        {isActive && (
                          <View style={[styles.boostActivateBtn, { borderColor: tierColor + '50', backgroundColor: tierColor + '15' }]}>
                            <Text style={{ color: tierColor, fontSize: 10, fontWeight: '700' }}>Active</Text>
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}

                {/* Info section */}
                <View style={[styles.freezeInfoBox, { marginTop: 12 }]}>
                  <Text style={styles.freezeInfoTitle}>How Boosts Work</Text>
                  <Text style={styles.freezeInfoText}>
                    • Buy boosts and store them for later use{'\n'}
                    • Activate a boost to gain bonus XP and coins{'\n'}
                    • Only one boost can be active at a time{'\n'}
                    • Boosts stack with your consistency multiplier{'\n'}
                    • Activate before prayer for maximum benefit
                  </Text>
                </View>
              </>
            )}
          </ScrollView>
    </>
  );

  if (asPage) {
    return (
      <View style={{ flex: 1, backgroundColor: 'transparent' }}>
        <View style={[styles.container, { flex: 1, borderRadius: 0, maxHeight: '100%', maxWidth: '100%' as any, borderWidth: 0, backgroundColor: 'rgba(15,21,38,0.65)' }]}>
          {content}
        </View>
      </View>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>{content}</View>
      </View>
    </Modal>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: '#0f1526',
    borderRadius: 24,
    width: '100%',
    maxWidth: 380,
    maxHeight: '85%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#e8e0d6',
  },
  coinBadge: {
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  coinText: {
    color: '#fbbf24',
    fontSize: 14,
    fontWeight: '700',
  },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 12,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  activeTab: {
    backgroundColor: 'rgba(232,168,124,0.15)',
  },
  tabText: {
    color: '#6b7280',
    fontSize: 13,
    fontWeight: '600',
  },
  activeTabText: {
    color: '#e8a87c',
  },
  scrollArea: {
    paddingHorizontal: 16,
  },
  sectionTitle: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  treeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
  },
  lockedCard: {
    opacity: 0.5,
  },
  previewContainer: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  treePreview: {
    width: 44,
    height: 44,
  },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  cardInfo: {
    flex: 1,
    marginLeft: 12,
    minWidth: 0,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 2,
  },
  treeName: {
    color: '#e8e0d6',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    flexShrink: 1,
    lineHeight: 18,
  },
  rarityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    marginLeft: 6,
    flexShrink: 0,
    alignSelf: 'flex-start',
  },
  rarityText: {
    fontSize: 10,
    fontWeight: '600',
  },
  treeDesc: {
    color: '#9ca3af',
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
  },
  ownedText: {
    color: '#4ade80',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
  priceSection: {
    marginLeft: 8,
    alignItems: 'center',
    flexShrink: 0,
  },
  buyButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    minWidth: 74,
    alignItems: 'center',
  },
  comingSoon: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  comingSoonTitle: {
    color: '#e8e0d6',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  comingSoonDesc: {
    color: '#9ca3af',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  freezeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    padding: 12,
  },
  freezeIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  freezeInfo: {
    flex: 1,
    marginLeft: 12,
  },
  freezeName: {
    color: '#e8e0d6',
    fontSize: 14,
    fontWeight: '600',
  },
  freezeDesc: {
    color: '#9ca3af',
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
  },
  freezeInfoBox: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  freezeInfoTitle: {
    color: '#e8e0d6',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  freezeInfoText: {
    color: '#9ca3af',
    fontSize: 11,
    lineHeight: 18,
  },
  // Coin package styles
  coinPackageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    position: 'relative',
    overflow: 'hidden',
  },
  coinPackageBest: {
    backgroundColor: 'rgba(251, 191, 36, 0.06)',
  },
  bestValueBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#fbbf24',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderBottomLeftRadius: 8,
  },
  bestValueText: {
    color: '#0f1526',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  coinPackageIcon: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  coinPackageInfo: {
    flex: 1,
    marginLeft: 12,
  },
  coinPackageName: {
    color: '#e8e0d6',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  coinPackageAmount: {
    color: '#fbbf24',
    fontSize: 13,
    fontWeight: '600',
  },
  bonusBadge: {
    backgroundColor: 'rgba(74, 222, 128, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  bonusText: {
    color: '#4ade80',
    fontSize: 10,
    fontWeight: '600',
  },
  coinBuyButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    minWidth: 72,
    alignItems: 'center',
    marginLeft: 8,
  },
  coinBuyText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  // Boost styles
  activeBoostBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  activeBoostDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  boostCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
  },
  boostIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  boostInfo: {
    flex: 1,
    marginLeft: 10,
  },
  boostName: {
    fontSize: 14,
    fontWeight: '700',
  },
  boostDurationBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  boostDesc: {
    color: '#9ca3af',
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
  },
  boostActivateBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    minWidth: 74,
  },
});

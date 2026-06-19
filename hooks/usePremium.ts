import { useState, useEffect, useCallback } from 'react';
import Purchases from 'react-native-purchases';

// ─── Constants ─────────────────────────────────────────────────────────────────

// ↓↓ PASTE YOUR REVENUECAT PUBLIC SDK KEY HERE — iOS key starts with "appl_"
const REVENUECAT_API_KEY_IOS = 'appl_VaGTERmLPtteHHWvmcvjUpXEfqo';
// Leave Android blank unless you ship on Android
const REVENUECAT_API_KEY_ANDROID = '';

// The entitlement identifier you created in RevenueCat dashboard (must be "premium")
const ENTITLEMENT_ID = 'premium';

// Premium plan IDs (must match App Store Connect / Google Play Console)
export const PREMIUM_PLANS = {
  monthly: {
    id: 'growpray_premium_monthly',
    price: '$6.99',
    period: 'month',
    trialDays: 7,
  },
  yearly: {
    id: 'growpray_premium_yearly',
    price: '$44.99',
    originalPrice: '$83.88',
    monthlyEquivalent: '$3.75',
    period: 'year',
    trialDays: 7,
    savings: '46%',
  },
} as const;

// Premium feature limits vs free
export const FREE_LIMITS = {
  maxGridSize: 7,          // 7×7 garden max (one expansion from 5×5 start)
  coinMultiplier: 1,       // 1× coins
  difficultDayUses: 3,     // 3 per month
  monthlyFreeFreezes: 0,   // No free freezes
  premiumTrees: false,     // Can't buy premium trees
} as const;

export const PREMIUM_LIMITS = {
  maxGridSize: 21,         // Unlimited garden (up to 21×21)
  coinMultiplier: 2,       // 2× coins
  difficultDayUses: 10,    // 10 per month
  monthlyFreeFreezes: 3,   // 3 free freezes on 1st of month
  premiumTrees: true,      // Can buy premium trees
} as const;

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface PremiumState {
  isPremium: boolean;
  loading: boolean;
  // Subscription info
  expirationDate: string | null;
  planId: string | null;
  // Feature access helpers
  limits: typeof FREE_LIMITS | typeof PREMIUM_LIMITS;
  // Actions
  purchaseMonthly: () => Promise<boolean>;
  purchaseYearly: () => Promise<boolean>;
  purchaseCoins: (productId: string) => Promise<boolean>;
  restorePurchases: () => Promise<boolean>;
  // For development/testing
  togglePremiumDebug: () => Promise<void>;
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function usePremium(): PremiumState {
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expirationDate, setExpirationDate] = useState<string | null>(null);
  const [planId, setPlanId] = useState<string | null>(null);

  // Configure RevenueCat SDK and check existing entitlement on mount
  useEffect(() => {
    try {
      Purchases.configure({ apiKey: REVENUECAT_API_KEY_IOS });
      Purchases.getCustomerInfo().then((info) => {
        const active = info.entitlements.active[ENTITLEMENT_ID];
        if (active) {
          setIsPremium(true);
          setExpirationDate(active.expirationDate ?? null);
          setPlanId(active.productIdentifier);
        }
      }).catch(() => {}).finally(() => setLoading(false));
    } catch {
      setLoading(false);
    }
  }, []);

  // Purchase a specific package by identifier
  const purchasePackage = useCallback(async (productId: string): Promise<boolean> => {
    try {
      const offerings = await Purchases.getOfferings();
      const current = offerings.current;
      if (!current) return false;

      const pkg = current.availablePackages.find(
        p => p.product.identifier === productId
      );
      if (!pkg) return false;

      const { customerInfo } = await Purchases.purchasePackage(pkg);
      const active = customerInfo.entitlements.active[ENTITLEMENT_ID];
      if (active) {
        setIsPremium(true);
        setExpirationDate(active.expirationDate ?? null);
        setPlanId(active.productIdentifier);
        return true;
      }
      return false;
    } catch (e: any) {
      // User cancelled — not a real error
      if (e?.code !== '1') console.error('Purchase failed:', e);
      return false;
    }
  }, []);

  const purchaseMonthly = useCallback(() =>
    purchasePackage(PREMIUM_PLANS.monthly.id), [purchasePackage]);

  const purchaseYearly = useCallback(() =>
    purchasePackage(PREMIUM_PLANS.yearly.id), [purchasePackage]);

  // Purchase a consumable coin pack by its App Store product ID.
  // Consumables don't grant an entitlement — we resolve `true` on a completed
  // (non-cancelled) transaction and the caller credits the coins.
  const purchaseCoins = useCallback(async (productId: string): Promise<boolean> => {
    try {
      // Prefer the product attached to the current offering (already fetched &
      // cached by RevenueCat); fall back to a direct product lookup.
      let storeProduct: any = null;
      try {
        const offerings = await Purchases.getOfferings();
        const pkgs = offerings.current?.availablePackages ?? [];
        const match = pkgs.find(p => p.product.identifier === productId);
        if (match) storeProduct = match.product;
      } catch { /* fall through to direct lookup */ }

      if (!storeProduct) {
        // Coin packs are consumables — must request the NON_SUBSCRIPTION category,
        // otherwise getProducts (which defaults to SUBSCRIPTION) returns nothing.
        const products = await Purchases.getProducts(
          [productId],
          Purchases.PRODUCT_CATEGORY.NON_SUBSCRIPTION,
        );
        if (!products || products.length === 0) return false;
        storeProduct = products[0];
      }

      await Purchases.purchaseStoreProduct(storeProduct);
      return true;
    } catch (e: any) {
      // User cancelled is not a real error
      if (!e?.userCancelled) console.error('Coin purchase failed:', e);
      return false;
    }
  }, []);

  // Restore purchases (required by Apple guidelines)
  const restorePurchases = useCallback(async (): Promise<boolean> => {
    try {
      const info = await Purchases.restorePurchases();
      const active = info.entitlements.active[ENTITLEMENT_ID];
      if (active) {
        setIsPremium(true);
        setExpirationDate(active.expirationDate ?? null);
        setPlanId(active.productIdentifier);
        return true;
      }
      return false;
    } catch (e) {
      console.error('Restore failed:', e);
      return false;
    }
  }, []);

  // Debug toggle — only use in dev, never call from production UI
  const togglePremiumDebug = useCallback(async () => {
    setIsPremium(prev => !prev);
  }, []);

  const limits = isPremium ? PREMIUM_LIMITS : FREE_LIMITS;

  return {
    isPremium,
    loading,
    expirationDate,
    planId,
    limits,
    purchaseMonthly,
    purchaseYearly,
    purchaseCoins,
    restorePurchases,
    togglePremiumDebug,
  };
}

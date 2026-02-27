import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
// import Purchases, { PurchasesPackage, CustomerInfo } from 'react-native-purchases';

// ─── Constants ─────────────────────────────────────────────────────────────────

const PREMIUM_STORAGE_KEY = '@GrowPray:premiumStatus';

// RevenueCat API keys — replace with real keys before production
const REVENUECAT_API_KEY_IOS = 'YOUR_IOS_API_KEY';
const REVENUECAT_API_KEY_ANDROID = 'YOUR_ANDROID_API_KEY';

// Premium plan IDs (must match App Store Connect / Google Play Console)
export const PREMIUM_PLANS = {
  monthly: {
    id: 'jannah_premium_monthly',
    price: '$6.99',
    period: 'month',
    trialDays: 7,
  },
  yearly: {
    id: 'jannah_premium_yearly',
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

  // Load premium status from storage (acts as cache until RevenueCat is wired)
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(PREMIUM_STORAGE_KEY);
        if (stored) {
          const data = JSON.parse(stored);
          setIsPremium(data.isPremium || false);
          setExpirationDate(data.expirationDate || null);
          setPlanId(data.planId || null);
        }

        // TODO: When RevenueCat is configured, check actual subscription status:
        // await initRevenueCat();
        // const info = await Purchases.getCustomerInfo();
        // const premium = info.entitlements.active['premium'] !== undefined;
        // setIsPremium(premium);

      } catch (e) {
        console.error('Failed to load premium status:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Save premium status
  const savePremiumStatus = useCallback(async (premium: boolean, expDate?: string, plan?: string) => {
    try {
      await AsyncStorage.setItem(PREMIUM_STORAGE_KEY, JSON.stringify({
        isPremium: premium,
        expirationDate: expDate || null,
        planId: plan || null,
      }));
    } catch (e) {
      console.error('Failed to save premium status:', e);
    }
  }, []);

  // TODO: Initialize RevenueCat when API keys are set
  // const initRevenueCat = async () => {
  //   const apiKey = Platform.OS === 'ios' ? REVENUECAT_API_KEY_IOS : REVENUECAT_API_KEY_ANDROID;
  //   await Purchases.configure({ apiKey });
  // };

  // Purchase monthly subscription
  const purchaseMonthly = useCallback(async (): Promise<boolean> => {
    try {
      // TODO: Replace with real RevenueCat purchase flow:
      // const offerings = await Purchases.getOfferings();
      // const package = offerings.current?.monthly;
      // if (!package) return false;
      // const { customerInfo } = await Purchases.purchasePackage(package);
      // const premium = customerInfo.entitlements.active['premium'] !== undefined;

      // For now, activate premium directly (dev/testing mode)
      setIsPremium(true);
      setPlanId(PREMIUM_PLANS.monthly.id);
      const expDate = new Date();
      expDate.setMonth(expDate.getMonth() + 1);
      const expStr = expDate.toISOString();
      setExpirationDate(expStr);
      await savePremiumStatus(true, expStr, PREMIUM_PLANS.monthly.id);
      return true;
    } catch (e) {
      console.error('Purchase failed:', e);
      return false;
    }
  }, [savePremiumStatus]);

  // Purchase yearly subscription
  const purchaseYearly = useCallback(async (): Promise<boolean> => {
    try {
      // TODO: Replace with real RevenueCat purchase flow
      setIsPremium(true);
      setPlanId(PREMIUM_PLANS.yearly.id);
      const expDate = new Date();
      expDate.setFullYear(expDate.getFullYear() + 1);
      const expStr = expDate.toISOString();
      setExpirationDate(expStr);
      await savePremiumStatus(true, expStr, PREMIUM_PLANS.yearly.id);
      return true;
    } catch (e) {
      console.error('Purchase failed:', e);
      return false;
    }
  }, [savePremiumStatus]);

  // Restore purchases
  const restorePurchases = useCallback(async (): Promise<boolean> => {
    try {
      // TODO: Replace with real RevenueCat restore:
      // const info = await Purchases.restorePurchases();
      // const premium = info.entitlements.active['premium'] !== undefined;
      // setIsPremium(premium);

      // For now, check stored status
      const stored = await AsyncStorage.getItem(PREMIUM_STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        if (data.isPremium) {
          setIsPremium(true);
          setExpirationDate(data.expirationDate);
          setPlanId(data.planId);
          return true;
        }
      }
      return false;
    } catch (e) {
      console.error('Restore failed:', e);
      return false;
    }
  }, []);

  // Debug toggle (for testing)
  const togglePremiumDebug = useCallback(async () => {
    const newStatus = !isPremium;
    setIsPremium(newStatus);
    if (newStatus) {
      const expDate = new Date();
      expDate.setMonth(expDate.getMonth() + 1);
      const expStr = expDate.toISOString();
      setExpirationDate(expStr);
      setPlanId('debug');
      await savePremiumStatus(true, expStr, 'debug');
    } else {
      setExpirationDate(null);
      setPlanId(null);
      await savePremiumStatus(false);
    }
  }, [isPremium, savePremiumStatus]);

  const limits = isPremium ? PREMIUM_LIMITS : FREE_LIMITS;

  return {
    isPremium,
    loading,
    expirationDate,
    planId,
    limits,
    purchaseMonthly,
    purchaseYearly,
    restorePurchases,
    togglePremiumDebug,
  };
}

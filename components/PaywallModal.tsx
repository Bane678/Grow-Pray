import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { PREMIUM_PLANS, FREE_LIMITS, PREMIUM_LIMITS } from '../hooks/usePremium';

const ICON_SPARKLE = require('../assets/Garden Assets/Icons/Icon_Sparkle.png');

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface PaywallModalProps {
  visible: boolean;
  onClose: () => void;
  onPurchaseMonthly: () => Promise<boolean>;
  onPurchaseYearly: () => Promise<boolean>;
  onRestore: () => Promise<boolean>;
  triggerReason?: 'garden_limit' | 'premium_tree' | 'settings' | 'general';
}

const COMPARISON_ROWS: Array<{
  label: string;
  icon: string;
  free: string;
  premium: string;
}> = [
  {
    label: 'Garden Size',
    icon: 'grid',
    free: `Up to ${FREE_LIMITS.maxGridSize}×${FREE_LIMITS.maxGridSize}`,
    premium: 'Unlimited',
  },
  {
    label: 'Coin Earning',
    icon: 'circle-multiple',
    free: '1× coins',
    premium: `${PREMIUM_LIMITS.coinMultiplier}× coins`,
  },
  {
    label: 'Difficult Days',
    icon: 'weather-partly-cloudy',
    free: `${FREE_LIMITS.difficultDayUses}/month`,
    premium: `${PREMIUM_LIMITS.difficultDayUses}/month`,
  },
  {
    label: 'Free Freezes',
    icon: 'shield-check',
    free: 'None',
    premium: `${PREMIUM_LIMITS.monthlyFreeFreezes}/month`,
  },
  {
    label: 'Premium Trees',
    icon: 'tree',
    free: 'Locked',
    premium: 'Unlocked',
  },
];

const TRIGGER_MESSAGES: Record<string, { title: string; subtitle: string }> = {
  garden_limit: {
    title: 'Garden Full!',
    subtitle: 'Upgrade to keep expanding your garden beyond 7×7',
  },
  premium_tree: {
    title: 'Premium Tree',
    subtitle: 'This tree is only available to premium members',
  },
  settings: {
    title: 'Go Premium',
    subtitle: 'Unlock the full Grow Pray experience',
  },
  general: {
    title: 'Upgrade to Premium',
    subtitle: 'Unlock the full Grow Pray experience',
  },
};

export function PaywallModal({
  visible,
  onClose,
  onPurchaseMonthly,
  onPurchaseYearly,
  onRestore,
  triggerReason = 'general',
}: PaywallModalProps) {
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('yearly');
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const message = TRIGGER_MESSAGES[triggerReason] || TRIGGER_MESSAGES.general;

  const handlePurchase = async () => {
    if (purchasing) return;
    setPurchasing(true);
    setError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const result = selectedPlan === 'yearly'
        ? await onPurchaseYearly()
        : await onPurchaseMonthly();

      if (result) {
        setSuccess(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        // Auto-close after celebration
        setTimeout(() => {
          onClose();
          // Reset success state after modal is hidden to avoid ghost modal
          setTimeout(() => setSuccess(false), 300);
        }, 2000);
      } else {
        setError('Purchase could not be completed. Please try again.');
      }
    } catch (e) {
      setError('Something went wrong. Please try again.');
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    if (restoring) return;
    setRestoring(true);
    setError(null);

    try {
      const result = await onRestore();
      if (result) {
        setSuccess(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setTimeout(() => {
          onClose();
          setTimeout(() => setSuccess(false), 300);
        }, 2000);
      } else {
        setError('No active subscription found.');
      }
    } catch (e) {
      setError('Could not restore purchases. Please try again.');
    } finally {
      setRestoring(false);
    }
  };

  // Single Modal to avoid React Native ghost modal bug:
  // Using one Modal and switching content inside prevents the native modal layer
  // from getting stuck when swapping between two different Modal components.
  return (
    <Modal
      visible={visible}
      transparent
      animationType={success ? 'fade' : 'slide'}
      onRequestClose={success ? undefined : onClose}
    >
      {success ? (
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 32,
        }}>
          <View style={{
            backgroundColor: '#0f1526',
            borderRadius: 28,
            padding: 40,
            alignItems: 'center',
            width: '100%',
            maxWidth: 340,
          }}>
            <Image source={ICON_SPARKLE} style={{ width: 60, height: 60, marginBottom: 16 }} resizeMode="contain" />
            <Text style={{ fontSize: 24, fontWeight: '800', color: '#e8a87c', marginBottom: 8, textAlign: 'center', width: '100%' }}>
              Welcome to Premium!
            </Text>
            <Text style={{ fontSize: 15, color: '#e8e0d6', textAlign: 'center', lineHeight: 22 }}>
              All premium features are now unlocked.
            </Text>
          </View>
        </View>
      ) : (
      <View style={{
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        justifyContent: 'center',
        padding: 20,
      }}>
        {/* Close button */}
        <TouchableOpacity
          onPress={onClose}
          style={{
            position: 'absolute',
            top: 50,
            right: 20,
            zIndex: 10,
            padding: 8,
          }}
        >
          <MaterialCommunityIcons name="close" size={28} color="#6b7280" />
        </TouchableOpacity>

        {/* Header */}
        <View style={{ alignItems: 'center', marginBottom: 16 }}>
          <Image source={ICON_SPARKLE} style={{ width: 40, height: 40, marginBottom: 6 }} resizeMode="contain" />
          <Text style={{
            fontSize: 24,
            fontWeight: '800',
            color: '#fbbf24',
            textAlign: 'center',
          }}>
            {message.title}
          </Text>
          <Text style={{
            fontSize: 14,
            color: '#94a3b8',
            textAlign: 'center',
            marginTop: 4,
            lineHeight: 20,
            paddingHorizontal: 12,
          }}>
            {message.subtitle}
          </Text>
        </View>

        {/* Comparison table */}
        <View style={{
          backgroundColor: 'rgba(15, 21, 38, 0.9)',
          borderRadius: 16,
          padding: 12,
          marginBottom: 12,
        }}>
          {/* Table header */}
          <View style={{
            flexDirection: 'row',
            marginBottom: 8,
            paddingBottom: 6,
            borderBottomWidth: 1,
            borderBottomColor: 'rgba(255,255,255,0.08)',
          }}>
            <View style={{ flex: 1.2 }} />
            <Text style={{
              flex: 1,
              fontSize: 11,
              fontWeight: '700',
              color: '#6b7280',
              textAlign: 'center',
              textTransform: 'uppercase',
            }}>
              Free
            </Text>
            <Text style={{
              flex: 1,
              fontSize: 11,
              fontWeight: '700',
              color: '#fbbf24',
              textAlign: 'center',
              textTransform: 'uppercase',
            }}>
              Premium
            </Text>
          </View>

          {/* Table rows */}
          {COMPARISON_ROWS.map((row, index) => (
            <View
              key={row.label}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 6,
                borderBottomWidth: index < COMPARISON_ROWS.length - 1 ? 1 : 0,
                borderBottomColor: 'rgba(255,255,255,0.04)',
              }}
            >
              <View style={{ flex: 1.2, flexDirection: 'row', alignItems: 'center' }}>
                <MaterialCommunityIcons
                  name={row.icon as any}
                  size={14}
                  color="#94a3b8"
                  style={{ marginRight: 4 }}
                />
                <Text style={{ fontSize: 12, color: '#e2e8f0', fontWeight: '500' }}>
                  {row.label}
                </Text>
              </View>
              <Text style={{
                flex: 1,
                fontSize: 11,
                color: '#6b7280',
                textAlign: 'center',
              }}>
                {row.free}
              </Text>
              <Text style={{
                flex: 1,
                fontSize: 11,
                color: '#4ade80',
                fontWeight: '600',
                textAlign: 'center',
              }}>
                {row.premium}
              </Text>
            </View>
          ))}
        </View>

        {/* Plan selector */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
          {/* Yearly plan */}
          <TouchableOpacity
            onPress={() => setSelectedPlan('yearly')}
            style={{
              flex: 1,
              backgroundColor: selectedPlan === 'yearly'
                ? 'rgba(251, 191, 36, 0.15)'
                : 'rgba(15, 21, 38, 0.9)',
              borderRadius: 12,
              padding: 12,
              borderWidth: selectedPlan === 'yearly' ? 2 : 0,
              borderColor: selectedPlan === 'yearly'
                ? '#fbbf24'
                : 'transparent',
              alignItems: 'center',
            }}
          >
            {PREMIUM_PLANS.yearly.savings && (
              <View style={{
                position: 'absolute',
                top: -8,
                right: -4,
                backgroundColor: '#ef4444',
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: 6,
              }}>
                <Text style={{ fontSize: 9, fontWeight: '800', color: '#fff' }}>
                  SAVE {PREMIUM_PLANS.yearly.savings}
                </Text>
              </View>
            )}
            <Text style={{
              fontSize: 11,
              fontWeight: '600',
              color: selectedPlan === 'yearly' ? '#fbbf24' : '#94a3b8',
              marginBottom: 2,
            }}>
              Yearly
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 }}>
              <Text style={{
                fontSize: 20,
                fontWeight: '800',
                color: selectedPlan === 'yearly' ? '#fbbf24' : '#e2e8f0',
              }}>
                {PREMIUM_PLANS.yearly.price}
              </Text>
              <Text style={{
                fontSize: 13,
                color: selectedPlan === 'yearly' ? '#94a3b8' : '#6b7280',
                textDecorationLine: 'line-through',
              }}>
                {PREMIUM_PLANS.yearly.originalPrice}
              </Text>
            </View>
            <Text style={{
              fontSize: 10,
              color: selectedPlan === 'yearly' ? '#fbbf24' : '#6b7280',
            }}>
              ({PREMIUM_PLANS.yearly.monthlyEquivalent}/month)
            </Text>
          </TouchableOpacity>

          {/* Monthly plan */}
          <TouchableOpacity
            onPress={() => setSelectedPlan('monthly')}
            style={{
              flex: 1,
              backgroundColor: selectedPlan === 'monthly'
                ? 'rgba(251, 191, 36, 0.15)'
                : 'rgba(15, 21, 38, 0.9)',
              borderRadius: 12,
              padding: 12,
              borderWidth: selectedPlan === 'monthly' ? 2 : 0,
              borderColor: selectedPlan === 'monthly'
                ? '#fbbf24'
                : 'transparent',
              alignItems: 'center',
            }}
          >
            <Text style={{
              fontSize: 11,
              fontWeight: '600',
              color: selectedPlan === 'monthly' ? '#fbbf24' : '#94a3b8',
              marginBottom: 2,
            }}>
              Monthly
            </Text>
            <Text style={{
              fontSize: 20,
              fontWeight: '800',
              color: selectedPlan === 'monthly' ? '#fbbf24' : '#e2e8f0',
            }}>
              {PREMIUM_PLANS.monthly.price}
            </Text>
            <Text style={{
              fontSize: 10,
              color: selectedPlan === 'monthly' ? '#fbbf24' : '#6b7280',
            }}>
              per month
            </Text>
          </TouchableOpacity>
        </View>

        {/* Purchase button */}
        <TouchableOpacity
          onPress={handlePurchase}
          disabled={purchasing}
          style={{
            backgroundColor: '#fbbf24',
            paddingVertical: 14,
            borderRadius: 14,
            alignItems: 'center',
            marginBottom: 10,
            opacity: purchasing ? 0.7 : 1,
          }}
        >
          {purchasing ? (
            <ActivityIndicator color="#0f1526" size="small" />
          ) : (
            <Text style={{
              fontSize: 16,
              fontWeight: '800',
              color: '#0f1526',
            }}>
              Start {PREMIUM_PLANS[selectedPlan].trialDays}-Day Free Trial
            </Text>
          )}
        </TouchableOpacity>

        {/* Error message */}
        {error && (
          <Text style={{
            fontSize: 12,
            color: '#f87171',
            textAlign: 'center',
            marginBottom: 8,
          }}>
            {error}
          </Text>
        )}

        {/* Restore purchases */}
        <TouchableOpacity
          onPress={handleRestore}
          disabled={restoring}
          style={{
            paddingVertical: 8,
            alignItems: 'center',
            marginBottom: 6,
          }}
        >
          <Text style={{
            fontSize: 13,
            color: '#6b7280',
            textDecorationLine: 'underline',
          }}>
            {restoring ? 'Restoring...' : 'Restore Purchases'}
          </Text>
        </TouchableOpacity>

        {/* Legal text */}
        <Text style={{
          fontSize: 9,
          color: '#4b5563',
          textAlign: 'center',
          lineHeight: 12,
          paddingHorizontal: 8,
        }}>
          Payment charged to App Store. Auto-renews unless cancelled 24h before period ends. Manage in App Store settings.
        </Text>
      </View>
      )}
    </Modal>
  );
}

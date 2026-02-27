import React, { useState, useCallback, memo } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  Switch,
  StyleSheet,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Types ─────────────────────────────────────────────────────────────────────

const PRAYER_ORDER = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'] as const;
type PrayerName = (typeof PRAYER_ORDER)[number];
type PrayerStreaks = Record<string, number>;

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
  // Prayer settings
  streaks: PrayerStreaks;
  // Notifications
  notificationsEnabled: boolean;
  onToggleNotifications: (enabled: boolean) => void;
  // Premium
  isPremium: boolean;
  onOpenPaywall: () => void;
  onRestorePurchases: () => Promise<boolean>;
  // Reset
  onResetProgress: () => void;
}

// ─── All AsyncStorage keys used by the app ─────────────────────────────────────

const ALL_STORAGE_KEYS = [
  '@GrowPray:completedPrayers',
  '@GrowPray:streaks',
  '@GrowPray:xp',
  '@GrowPray:coins',
  '@GrowPray:restPeriod',
  '@GrowPray:gardenState',
  '@GrowPray:treeInventory',
  '@GrowPray:freezeInventory',
  '@GrowPray:freezeResolvedDate',
  '@GrowPray:perfectDays',
  '@GrowPray:lastPerfectDate',
  '@GrowPray:weeklyChallenges',
  '@GrowPray:difficultDay',
  '@GrowPray:difficultDayUses',
  '@GrowPray:notificationsEnabled',
  '@GrowPray:premiumStatus',
  '@GrowPray:prayerHistory',
];

const APP_VERSION = '1.0.0';
const SUPPORT_EMAIL = 'support@jannahgarden.app';
const PRIVACY_URL = 'https://jannahgarden.app/privacy';
const TERMS_URL = 'https://jannahgarden.app/terms';

// ─── Component ─────────────────────────────────────────────────────────────────

export const SettingsModal = memo(function SettingsModal({
  visible,
  onClose,
  streaks,
  notificationsEnabled,
  onToggleNotifications,
  isPremium,
  onOpenPaywall,
  onRestorePurchases,
  onResetProgress,
}: SettingsModalProps) {
  const [restoringPurchases, setRestoringPurchases] = useState(false);

  const handleRestorePurchases = useCallback(async () => {
    setRestoringPurchases(true);
    try {
      const success = await onRestorePurchases();
      if (success) {
        Alert.alert('Restored!', 'Your premium subscription has been restored.');
      } else {
        Alert.alert('No Purchases Found', 'We couldn\'t find any previous purchases.');
      }
    } catch {
      Alert.alert('Error', 'Failed to restore purchases. Please try again.');
    } finally {
      setRestoringPurchases(false);
    }
  }, [onRestorePurchases]);

  const handleResetProgress = useCallback(() => {
    Alert.alert(
      '⚠️ Reset All Progress',
      'This will permanently delete ALL your data including streaks, coins, XP, garden, and inventory. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset Everything',
          style: 'destructive',
          onPress: async () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            try {
              await AsyncStorage.multiRemove(ALL_STORAGE_KEYS);
              onResetProgress();
              onClose();
              Alert.alert('Progress Reset', 'All data has been cleared. Please restart the app.');
            } catch {
              Alert.alert('Error', 'Failed to reset progress.');
            }
          },
        },
      ]
    );
  }, [onResetProgress, onClose]);

  const handleContact = useCallback(() => {
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=Jannah%20Garden%20Support`);
  }, []);

  const handleOpenLink = useCallback((url: string) => {
    Linking.openURL(url);
  }, []);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>⚙️ Settings</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            bounces={true}
            removeClippedSubviews={true}
          >
            {/* ── PRAYER SETTINGS ───────────────────────────────── */}
            <SectionHeader icon="clock-outline" title="Prayer Settings" />

            {/* ── NOTIFICATIONS ──────────────────────────────────── */}
            <SectionHeader icon="bell-outline" title="Notifications" />

            <View style={styles.switchRow}>
              <View style={styles.switchInfo}>
                <Text style={styles.switchLabel}>Prayer Notifications</Text>
                <Text style={styles.switchDesc}>
                  Get notified when each prayer time begins
                </Text>
              </View>
              <Switch
                value={notificationsEnabled}
                onValueChange={(val) => {
                  Haptics.selectionAsync();
                  onToggleNotifications(val);
                }}
                trackColor={{ false: '#374151', true: 'rgba(16, 185, 129, 0.5)' }}
                thumbColor={notificationsEnabled ? '#10b981' : '#6b7280'}
              />
            </View>

            {/* ── PREMIUM ────────────────────────────────────────── */}
            <SectionHeader icon="crown" title="Premium" />

            {isPremium ? (
              <View style={styles.premiumActiveBox}>
                <MaterialCommunityIcons name="check-decagram" size={24} color="#fbbf24" />
                <View style={{ marginLeft: 12, flex: 1 }}>
                  <Text style={styles.premiumActiveTitle}>Premium Active</Text>
                  <Text style={styles.premiumActiveDesc}>
                    You have access to all premium features
                  </Text>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.goPremiumBtn}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  onClose();
                  setTimeout(onOpenPaywall, 300);
                }}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons name="crown" size={20} color="#000" />
                <Text style={styles.goPremiumText}>Go Premium — $6.99/month</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.restoreBtn}
              onPress={handleRestorePurchases}
              disabled={restoringPurchases}
              activeOpacity={0.7}
            >
              <Text style={[styles.restoreBtnText, restoringPurchases && { opacity: 0.5 }]}>
                {restoringPurchases ? 'Restoring...' : 'Restore Purchases'}
              </Text>
            </TouchableOpacity>

            {/* ── ABOUT ──────────────────────────────────────────── */}
            <SectionHeader icon="information-outline" title="About" />

            <View style={styles.aboutRow}>
              <Text style={styles.aboutLabel}>Version</Text>
              <Text style={styles.aboutValue}>{APP_VERSION}</Text>
            </View>

            <TouchableOpacity style={styles.linkRow} onPress={() => handleOpenLink(PRIVACY_URL)}>
              <MaterialCommunityIcons name="shield-lock-outline" size={18} color="#9ca3af" />
              <Text style={styles.linkText}>Privacy Policy</Text>
              <MaterialCommunityIcons name="chevron-right" size={18} color="#4b5563" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.linkRow} onPress={() => handleOpenLink(TERMS_URL)}>
              <MaterialCommunityIcons name="file-document-outline" size={18} color="#9ca3af" />
              <Text style={styles.linkText}>Terms of Service</Text>
              <MaterialCommunityIcons name="chevron-right" size={18} color="#4b5563" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.linkRow} onPress={handleContact}>
              <MaterialCommunityIcons name="email-outline" size={18} color="#9ca3af" />
              <Text style={styles.linkText}>Contact Support</Text>
              <MaterialCommunityIcons name="chevron-right" size={18} color="#4b5563" />
            </TouchableOpacity>

            {/* ── DANGER ZONE ────────────────────────────────────── */}
            <SectionHeader icon="alert-circle-outline" title="Danger Zone" color="#ef4444" />

            <TouchableOpacity
              style={styles.resetBtn}
              onPress={handleResetProgress}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="delete-forever" size={20} color="#fca5a5" />
              <Text style={styles.resetBtnText}>Reset All Progress</Text>
            </TouchableOpacity>

            <Text style={styles.resetWarn}>
              This will permanently delete all streaks, coins, XP, garden data, and inventory.
            </Text>

            <View style={{ height: 30 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
});

// ─── Section Header ────────────────────────────────────────────────────────────

const SectionHeader = memo(function SectionHeader({
  icon,
  title,
  color = '#10b981',
}: {
  icon: string;
  title: string;
  color?: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <MaterialCommunityIcons name={icon as any} size={18} color={color} />
      <Text style={[styles.sectionTitle, { color }]}>{title}</Text>
    </View>
  );
});

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#0f1526',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  title: {
    color: '#e8e0d6',
    fontSize: 22,
    fontWeight: '800',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    color: '#9ca3af',
    fontSize: 16,
    fontWeight: '700',
  },
  scrollArea: {
    paddingHorizontal: 20,
  },
  scrollContent: {
    paddingTop: 8,
    paddingBottom: 8,
  },

  // Section
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 24,
    marginBottom: 14,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  // Streaks
  streakRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  streakPrayer: {
    fontSize: 15,
    color: '#e8e0d6',
    fontWeight: '500',
  },
  streakValue: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  streakFire: {
    fontSize: 13,
    marginRight: 4,
  },
  streakNum: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fb923c',
  },
  streakUnit: {
    fontSize: 12,
    color: '#6b7280',
    marginLeft: 4,
  },

  // Notifications
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  switchInfo: {
    flex: 1,
    marginRight: 12,
  },
  switchLabel: {
    color: '#e5e7eb',
    fontSize: 15,
    fontWeight: '600',
  },
  switchDesc: {
    color: '#6b7280',
    fontSize: 12,
    marginTop: 2,
  },

  // Premium
  premiumActiveBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    borderRadius: 14,
    padding: 14,
  },
  premiumActiveTitle: {
    color: '#fbbf24',
    fontSize: 15,
    fontWeight: '700',
  },
  premiumActiveDesc: {
    color: '#9ca3af',
    fontSize: 12,
    marginTop: 2,
  },
  goPremiumBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#fbbf24',
    borderRadius: 14,
    paddingVertical: 14,
  },
  goPremiumText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '800',
  },
  restoreBtn: {
    marginTop: 10,
    alignItems: 'center',
    paddingVertical: 10,
  },
  restoreBtnText: {
    color: '#60a5fa',
    fontSize: 13,
    fontWeight: '600',
  },

  // About
  aboutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  aboutLabel: {
    color: '#9ca3af',
    fontSize: 14,
  },
  aboutValue: {
    color: '#e5e7eb',
    fontSize: 14,
    fontWeight: '600',
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  linkText: {
    flex: 1,
    color: '#d1d5db',
    fontSize: 14,
    fontWeight: '500',
  },

  // Danger zone
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(220, 38, 38, 0.1)',
    borderRadius: 14,
    paddingVertical: 14,
  },
  resetBtnText: {
    color: '#fca5a5',
    fontSize: 14,
    fontWeight: '700',
  },
  resetWarn: {
    color: '#6b7280',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 16,
  },
});

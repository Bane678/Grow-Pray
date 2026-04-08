import React, { useState, useCallback, memo } from 'react';
import {
  View,
  Text,
  Image,
  Modal,
  TouchableOpacity,
  ScrollView,
  Switch,
  TextInput,
  StyleSheet,
  Alert,
  Linking,
  Platform,
  ActivityIndicator,
} from 'react-native';
import * as Location from 'expo-location';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PRAYER_METHODS, type PrayerMethodKey, type Madhab } from '../hooks/usePrayerTimes';

const ICON_GEAR = require('../assets/Garden Assets/Icons/Icon_Gear.png');

// ─── Types ─────────────────────────────────────────────────────────────────────

const PRAYER_ORDER = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'] as const;
type PrayerName = (typeof PRAYER_ORDER)[number];
type PrayerStreaks = Record<string, number>;

const METHOD_KEYS: PrayerMethodKey[] = ['MWL', 'ISNA', 'EGYPT', 'UMM_AL_QURA', 'KARACHI', 'DUBAI', 'TURKEY'];

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
  streaks: PrayerStreaks;
  madhab: Madhab;
  onChangeMadhab: (m: Madhab) => void;
  calcMethodKey: PrayerMethodKey | null;
  detectedMethodKey: PrayerMethodKey;
  onChangeCalcMethod: (key: PrayerMethodKey | null) => void;
  manualCity: string;
  onManualCitySearch: (city: string) => Promise<{ lat: number; lng: number; countryCode?: string; displayName: string } | null>;
  notificationsEnabled: boolean;
  onToggleNotifications: (enabled: boolean) => void;
  isPremium: boolean;
  onOpenPaywall: () => void;
  onRestorePurchases: () => Promise<boolean>;
  onResetProgress: () => void;
}

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
  '@GrowPray:madhab',
  '@GrowPray:calcMethod',
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
  madhab,
  onChangeMadhab,
  calcMethodKey,
  detectedMethodKey,
  onChangeCalcMethod,
  manualCity,
  onManualCitySearch,
  notificationsEnabled,
  onToggleNotifications,
  isPremium,
  onOpenPaywall,
  onRestorePurchases,
  onResetProgress,
}: SettingsModalProps) {
  const [restoringPurchases, setRestoringPurchases] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(calcMethodKey !== null);
  const [cityInput, setCityInput] = useState(manualCity);
  const [citySearching, setCitySearching] = useState(false);
  const [cityStatus, setCityStatus] = useState<'idle' | 'found' | 'notfound'>('idle');

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
      'Reset All Progress',
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
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=Grow%20Pray%20Support`);
  }, []);

  const handleCitySearch = useCallback(async () => {
    const trimmed = cityInput.trim();
    if (!trimmed) return;
    setCitySearching(true);
    setCityStatus('idle');
    const result = await onManualCitySearch(trimmed);
    setCitySearching(false);
    setCityStatus(result ? 'found' : 'notfound');
  }, [cityInput, onManualCitySearch]);

  const handleOpenLink = useCallback((url: string) => {
    Linking.openURL(url);
  }, []);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.sheet}>
          {/* Header */}
          <View style={s.header}>
            <View style={s.headerLeft}>
              <Image source={ICON_GEAR} style={s.headerIcon} resizeMode="contain" />
              <Text style={s.headerTitle}>Settings</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={s.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <MaterialCommunityIcons name="close" size={18} color="#9ca3af" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={s.scroll}
            contentContainerStyle={s.scrollInner}
            showsVerticalScrollIndicator={false}
            bounces={true}
          >
            {/* ── PRAYER CALCULATION ───────────────────────────── */}
            <SectionLabel label="Prayer Calculation" />

            <View style={s.calcCard}>
              {/* Recommended toggle header */}
              <View style={s.calcToggleRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <Text style={s.calcToggleTitle}>
                    {showAdvanced ? 'Grow Pray Advanced' : 'Grow Pray Recommended'}
                  </Text>
                  {!showAdvanced && (
                    <MaterialCommunityIcons name="check-circle" size={15} color="#10b981" style={{ marginLeft: 6 }} />
                  )}
                </View>
                <Switch
                  value={!showAdvanced}
                  onValueChange={(val) => {
                    Haptics.selectionAsync();
                    setShowAdvanced(!val);
                    if (val) onChangeCalcMethod(null);
                  }}
                  trackColor={{ false: 'rgba(232,168,124,0.35)', true: 'rgba(16,185,129,0.5)' }}
                  thumbColor={!showAdvanced ? '#10b981' : '#e8a87c'}
                />
              </View>
              <Text style={s.calcToggleDesc}>
                {!showAdvanced
                  ? 'Automatically uses the best calculation method for your region'
                  : 'Choose a prayer calculation method manually'}
              </Text>

              <View style={s.calcDivider} />

              {!showAdvanced ? (
                /* Recommended on: show active method highlighted card */
                <View style={s.activeMethodCard}>
                  <View style={{ flex: 1 }}>
                    <View style={s.autoBadge}>
                      <Text style={s.autoBadgeText}>Auto-selected</Text>
                    </View>
                    <Text style={s.activeMethodName}>
                      {PRAYER_METHODS[detectedMethodKey]?.name}
                    </Text>
                    <Text style={s.activeMethodAngles}>
                      Fajr {Math.abs(PRAYER_METHODS[detectedMethodKey]?.fajrAngle)}° · Isha {Math.abs(PRAYER_METHODS[detectedMethodKey]?.ishaAngle)}°
                    </Text>
                  </View>
                  <MaterialCommunityIcons name="check-circle" size={26} color="#10b981" />
                </View>
              ) : (
                /* Advanced: full method list */
                <View style={s.methodList}>
                  {METHOD_KEYS.map((key) => (
                    <TouchableOpacity
                      key={key}
                      onPress={() => { Haptics.selectionAsync(); onChangeCalcMethod(key); }}
                      style={[s.methodItem, calcMethodKey === key && s.methodItemSelected]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[s.methodName, calcMethodKey === key && s.methodNameSelected]}>
                          {PRAYER_METHODS[key].name}
                        </Text>
                        <Text style={s.methodAngles}>
                          Fajr {Math.abs(PRAYER_METHODS[key].fajrAngle)}° · Isha {Math.abs(PRAYER_METHODS[key].ishaAngle)}°
                        </Text>
                      </View>
                      {calcMethodKey === key && <MaterialCommunityIcons name="check-circle" size={18} color={ACCENT} />}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* ── ASR CALCULATION ──────────────────────────────── */}
            <SectionLabel label="Asr Calculation" />
            <View style={s.card}>
              <Text style={s.sectionDesc}>
                Determines when Asr prayer begins. Hanafi uses a later time than the standard Shafi'i/Maliki/Hanbali method.
              </Text>
              <View style={s.segmentRow}>
                <TouchableOpacity
                  onPress={() => { Haptics.selectionAsync(); onChangeMadhab('standard'); }}
                  style={[s.segmentBtn, madhab === 'standard' && s.segmentActive]}
                >
                  <Text style={[s.segmentText, madhab === 'standard' && s.segmentTextActive]}>Standard</Text>
                  <Text style={[s.segmentSubText, madhab === 'standard' && s.segmentSubTextActive]}>Shafi'i · Maliki · Hanbali</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => { Haptics.selectionAsync(); onChangeMadhab('hanafi'); }}
                  style={[s.segmentBtn, madhab === 'hanafi' && s.segmentActive]}
                >
                  <Text style={[s.segmentText, madhab === 'hanafi' && s.segmentTextActive]}>Hanafi</Text>
                  <Text style={[s.segmentSubText, madhab === 'hanafi' && s.segmentSubTextActive]}>Later Asr time</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* ── LOCATION ──────────────────────────────────────── */}
            <SectionLabel label="Location" />

            {/* Current location display */}
            <View style={s.card}>
              <View style={s.cardRow}>
                <View style={s.cardRowLeft}>
                  <MaterialCommunityIcons name="map-marker" size={20} color={ACCENT} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.cardRowLabel}>Current Location</Text>
                    <Text style={s.cardRowHint} numberOfLines={1}>
                      {cityStatus === 'found'
                        ? cityInput.trim()
                        : manualCity.length > 0
                        ? manualCity
                        : 'Using GPS'}
                    </Text>
                  </View>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={18} color="#374151" />
              </View>
            </View>

            {/* Manual city override */}
            <View style={[s.card, { marginTop: 8 }]}>
              <View style={s.cardRow}>
                <View style={s.cardRowLeft}>
                  <MaterialCommunityIcons name="crosshairs-gps" size={20} color="#9ca3af" />
                  <View style={{ flex: 1 }}>
                    <Text style={s.cardRowLabel}>Set City Manually</Text>
                    <Text style={s.cardRowHint}>Use when GPS access is unavailable</Text>
                  </View>
                </View>
              </View>
              <View style={s.cityInputRow}>
                <TextInput
                  value={cityInput}
                  onChangeText={(t) => { setCityInput(t); setCityStatus('idle'); }}
                  placeholder="e.g. Karachi, Cairo, New York"
                  placeholderTextColor="#4b5563"
                  returnKeyType="search"
                  onSubmitEditing={handleCitySearch}
                  style={[
                    s.cityInput,
                    cityStatus === 'found' && s.cityInputFound,
                    cityStatus === 'notfound' && s.cityInputError,
                  ]}
                />
                <TouchableOpacity
                  onPress={handleCitySearch}
                  disabled={citySearching || cityInput.trim().length === 0}
                  style={[s.citySetBtn, cityInput.trim().length === 0 && { opacity: 0.4 }]}
                >
                  {citySearching
                    ? <ActivityIndicator size="small" color="#0f1526" />
                    : <MaterialCommunityIcons name="magnify" size={18} color="#0f1526" />}
                </TouchableOpacity>
              </View>
              {cityStatus === 'found' && <Text style={s.citySuccess}>✓ Location set — prayer times updated</Text>}
              {cityStatus === 'notfound' && <Text style={s.cityError}>City not found. Try a nearby major city.</Text>}
            </View>

            {/* ── NOTIFICATIONS ───────────────────────────────── */}
            <SectionLabel label="Notifications" />
            <View style={s.card}>
              <View style={s.switchRow}>
                <View style={s.cardRowLeft}>
                  <MaterialCommunityIcons name="bell-outline" size={20} color="#9ca3af" />
                  <View style={{ flex: 1 }}>
                    <Text style={s.cardRowLabel}>Prayer Reminders</Text>
                    <Text style={s.cardRowHint}>Alert when each prayer time begins</Text>
                  </View>
                </View>
                <Switch
                  value={notificationsEnabled}
                  onValueChange={(val) => { Haptics.selectionAsync(); onToggleNotifications(val); }}
                  trackColor={{ false: '#374151', true: 'rgba(16, 185, 129, 0.5)' }}
                  thumbColor={notificationsEnabled ? '#10b981' : '#6b7280'}
                />
              </View>
            </View>

            {/* ── PREMIUM ────────────────────────────────────── */}
            <SectionLabel label="Premium" />
            {isPremium ? (
              <View style={s.premiumCard}>
                <MaterialCommunityIcons name="check-decagram" size={22} color="#fbbf24" />
                <View style={{ marginLeft: 12, flex: 1 }}>
                  <Text style={s.premiumActiveTitle}>Premium Active</Text>
                  <Text style={s.cardRowHint}>All features unlocked</Text>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                style={s.goPremiumBtn}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  onClose();
                  setTimeout(onOpenPaywall, 300);
                }}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons name="crown" size={18} color="#000" />
                <Text style={s.goPremiumText}>Go Premium — $6.99/month</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={s.restoreBtn}
              onPress={handleRestorePurchases}
              disabled={restoringPurchases}
              activeOpacity={0.7}
            >
              <Text style={[s.restoreText, restoringPurchases && { opacity: 0.5 }]}>
                {restoringPurchases ? 'Restoring...' : 'Restore Purchases'}
              </Text>
            </TouchableOpacity>

            {/* ── SUPPORT & INFO ──────────────────────────────── */}
            <SectionLabel label="Support" />
            <View style={s.card}>
              <LinkRow icon="shield-lock-outline" label="Privacy Policy" onPress={() => handleOpenLink(PRIVACY_URL)} />
              <View style={s.cardDivider} />
              <LinkRow icon="file-document-outline" label="Terms of Service" onPress={() => handleOpenLink(TERMS_URL)} />
              <View style={s.cardDivider} />
              <LinkRow icon="email-outline" label="Contact Support" onPress={handleContact} />
              <View style={s.cardDivider} />
              <View style={s.versionRow}>
                <Text style={s.versionLabel}>Version</Text>
                <Text style={s.versionValue}>{APP_VERSION}</Text>
              </View>
            </View>

            {/* ── RESET ──────────────────────────────────────── */}
            <TouchableOpacity
              style={s.resetBtn}
              onPress={handleResetProgress}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="trash-can-outline" size={16} color="#ef4444" />
              <Text style={s.resetText}>Reset All Progress</Text>
            </TouchableOpacity>

            <View style={{ height: 30 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
});

// ─── Sub-components ────────────────────────────────────────────────────────────

const SectionLabel = memo(function SectionLabel({ label }: { label: string }) {
  return <Text style={s.sectionLabel}>{label}</Text>;
});

const LinkRow = memo(function LinkRow({
  icon,
  label,
  onPress,
}: {
  icon: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={s.linkRow} onPress={onPress} activeOpacity={0.6}>
      <MaterialCommunityIcons name={icon as any} size={18} color="#6b7280" />
      <Text style={s.linkRowText}>{label}</Text>
      <MaterialCommunityIcons name="chevron-right" size={16} color="#374151" />
    </TouchableOpacity>
  );
});

// ─── Styles ────────────────────────────────────────────────────────────────────

const CARD_BG = 'rgba(255,255,255,0.04)';
const CARD_BORDER = 'rgba(255,255,255,0.06)';
const ACCENT = '#e8a87c';

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#111827',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '92%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIcon: { width: 22, height: 22 },
  headerTitle: {
    color: '#f3f4f6',
    fontSize: 20,
    fontWeight: '700',
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Scroll
  scroll: { paddingHorizontal: 16 },
  scrollInner: { paddingBottom: 8 },

  // Section label
  sectionLabel: {
    color: '#9ca3af',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 22,
    marginBottom: 8,
    marginLeft: 2,
  },
  sectionDesc: {
    color: '#6b7280',
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 12,
  },

  // Generic card
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    padding: 14,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  cardRowLabel: {
    color: '#e5e7eb',
    fontSize: 15,
    fontWeight: '600',
  },
  cardRowHint: {
    color: '#6b7280',
    fontSize: 12,
    marginTop: 1,
  },
  cardDivider: {
    height: 1,
    backgroundColor: CARD_BORDER,
    marginVertical: 10,
  },

  // City search
  cityInputRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  cityInput: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    color: '#e5e7eb',
    fontSize: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  cityInputFound: { borderColor: 'rgba(16,185,129,0.4)' },
  cityInputError: { borderColor: 'rgba(239,68,68,0.4)' },
  citySetBtn: {
    backgroundColor: ACCENT,
    borderRadius: 10,
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  citySuccess: { color: '#10b981', fontSize: 12, marginTop: 6, marginLeft: 2 },
  cityError: { color: '#ef4444', fontSize: 12, marginTop: 6, marginLeft: 2 },

  // Prayer Calculation card (larger, self-contained)
  calcCard: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    padding: 16,
  },
  calcToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  calcToggleTitle: {
    color: '#f3f4f6',
    fontSize: 16,
    fontWeight: '700',
  },
  calcToggleDesc: {
    color: '#6b7280',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },
  calcDivider: {
    height: 1,
    backgroundColor: CARD_BORDER,
    marginVertical: 14,
  },

  // Active method card (recommended mode)
  activeMethodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16,185,129,0.07)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.2)',
    padding: 14,
  },
  autoBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(16,185,129,0.15)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginBottom: 6,
  },
  autoBadgeText: {
    color: '#10b981',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  activeMethodName: {
    color: '#f3f4f6',
    fontSize: 17,
    fontWeight: '700',
  },
  activeMethodAngles: {
    color: '#6b7280',
    fontSize: 11,
    marginTop: 3,
  },

  // Method list (advanced mode)
  methodList: {
    gap: 4,
  },
  methodItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  methodItemSelected: {
    backgroundColor: 'rgba(232, 168, 124, 0.08)',
    borderColor: 'rgba(232, 168, 124, 0.25)',
  },
  methodName: {
    color: '#d1d5db',
    fontSize: 14,
    fontWeight: '500',
  },
  methodNameSelected: {
    color: ACCENT,
    fontWeight: '600',
  },
  methodAngles: {
    color: '#4b5563',
    fontSize: 11,
    marginTop: 1,
  },

  // Segment (Standard / Hanafi)
  segmentRow: {
    flexDirection: 'row',
    gap: 8,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 11,
    paddingHorizontal: 8,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  segmentActive: {
    backgroundColor: 'rgba(232, 168, 124, 0.12)',
    borderColor: ACCENT,
  },
  segmentText: {
    color: '#9ca3af',
    fontSize: 14,
    fontWeight: '600',
  },
  segmentTextActive: { color: ACCENT },
  segmentSubText: {
    color: '#4b5563',
    fontSize: 10,
    marginTop: 2,
    textAlign: 'center',
  },
  segmentSubTextActive: { color: 'rgba(232,168,124,0.7)' },

  // Notifications
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  // Premium
  premiumCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(251, 191, 36, 0.08)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.15)',
    padding: 14,
  },
  premiumActiveTitle: {
    color: '#fbbf24',
    fontSize: 15,
    fontWeight: '700',
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
    alignItems: 'center',
    paddingVertical: 10,
    marginTop: 6,
  },
  restoreText: {
    color: '#60a5fa',
    fontSize: 13,
    fontWeight: '600',
  },

  // Links / About
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
  },
  linkRowText: {
    flex: 1,
    color: '#d1d5db',
    fontSize: 14,
    fontWeight: '500',
  },
  versionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  versionLabel: { color: '#6b7280', fontSize: 13 },
  versionValue: { color: '#9ca3af', fontSize: 13, fontWeight: '600' },

  // Reset
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 24,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.15)',
  },
  resetText: {
    color: '#ef4444',
    fontSize: 13,
    fontWeight: '600',
  },
});

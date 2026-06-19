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
  onManualCitySearch: (city: string) => Promise<{ lat: number; lng: number; countryCode?: string; displayName: string }[]>;
  onManualCitySelect: (result: { lat: number; lng: number; countryCode?: string; displayName: string }) => void;
  onClearManualCity: () => void;
  notificationsEnabled: boolean;
  onToggleNotifications: (enabled: boolean) => void;
  isPremium: boolean;
  onOpenPaywall: () => void;
  onRestorePurchases: () => Promise<boolean>;
  onResetProgress: () => void;
  // Page mode (used when rendered as a full tab instead of a modal)
  asPage?: boolean;
  onRest?: () => void;
  onDebug?: () => void;
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
const SUPPORT_EMAIL = 'sayeedali224@gmail.com';
const PRIVACY_URL = 'https://bane678.github.io/grow-pray-site/privacy.html';
const TERMS_URL = 'https://bane678.github.io/grow-pray-site/support.html';

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
  onManualCitySelect,
  onClearManualCity,
  notificationsEnabled,
  onToggleNotifications,
  isPremium,
  onOpenPaywall,
  onRestorePurchases,
  onResetProgress,
  asPage,
  onRest,
  onDebug,
}: SettingsModalProps) {
  const [restoringPurchases, setRestoringPurchases] = useState(false);
  const [cityInput, setCityInput] = useState(manualCity);
  const [citySearching, setCitySearching] = useState(false);
  const [cityStatus, setCityStatus] = useState<'idle' | 'found' | 'notfound'>('idle');
  const [cityResults, setCityResults] = useState<{ lat: number; lng: number; countryCode?: string; displayName: string }[]>([]);

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
    setCityResults([]);
    const results = await onManualCitySearch(trimmed);
    setCitySearching(false);
    if (results.length > 0) {
      setCityResults(results);
      setCityStatus('found');
    } else {
      setCityStatus('notfound');
    }
  }, [cityInput, onManualCitySearch]);

  const handleCitySelect = useCallback((result: { lat: number; lng: number; countryCode?: string; displayName: string }) => {
    Haptics.selectionAsync();
    onManualCitySelect(result);
    setCityInput(result.displayName);
    setCityResults([]);
    setCityStatus('idle');
  }, [onManualCitySelect]);

  const handleOpenLink = useCallback((url: string) => {
    Linking.openURL(url);
  }, []);

  const innerContent = (
    <ScrollView
      style={s.scroll}
      contentContainerStyle={s.scrollInner}
      showsVerticalScrollIndicator={false}
      bounces
    >
      {asPage && <Text style={s.pageTitle}>Settings</Text>}

      {/* ── PREMIUM BANNER ────────────────────────────────── */}
      {isPremium ? (
        <View style={s.premiumActiveBannerRow}>
          <MaterialCommunityIcons name="check-decagram" size={20} color="#fbbf24" />
          <View style={{ marginLeft: 10, flex: 1 }}>
            <Text style={s.premiumActiveTxt}>Premium Active</Text>
            <Text style={s.rowHint}>All features unlocked</Text>
          </View>
        </View>
      ) : (
        <TouchableOpacity
          style={s.premiumBannerBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            if (asPage) onClose();
            setTimeout(onOpenPaywall, asPage ? 300 : 0);
          }}
          activeOpacity={0.85}
        >
          <View style={{ flex: 1 }}>
            <Text style={s.premiumBannerTitle}>👑 Unlock Premium</Text>
            <Text style={s.premiumBannerSub}>Exclusive trees · remove limits</Text>
          </View>
          <View style={s.premiumBannerPill}>
            <Text style={s.premiumBannerPillText}>$6.99/mo</Text>
          </View>
        </TouchableOpacity>
      )}

      {/* ── PRAYER TIMES ──────────────────────────────────── */}
      <SectionLabel label="PRAYER TIMES" />
      <Text style={s.sectionIntro}>
        Prayer times are calculated automatically using the correct method for your region. Just let us know where you are.
      </Text>

      <View style={s.groupCard}>
        {/* Location — always visible */}
        <View style={s.calcDescRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
            <MaterialCommunityIcons
              name={manualCity.length > 0 ? 'map-marker' : 'crosshairs-gps'}
              size={16}
              color={manualCity.length > 0 ? ACCENT : '#4ade80'}
              style={{ marginRight: 6 }}
            />
            <Text style={s.calcDescTitle}>Your Location</Text>
            {manualCity.length === 0 && (
              <View style={[s.recommendedBadge, { backgroundColor: 'rgba(74,222,128,0.1)', borderColor: 'rgba(74,222,128,0.25)' }]}>
                <Text style={[s.recommendedBadgeText, { color: '#4ade80' }]}>GPS</Text>
              </View>
            )}
          </View>
          <Text style={[s.calcDescBody, { marginBottom: 12 }]}>
            {manualCity.length > 0
              ? `Using ${manualCity} for prayer times. Search below to change city, or switch back to GPS.`
              : "Using your device's GPS. If GPS isn't available, or you'd prefer not to share it, search for your city below."}
          </Text>

          {/* City search input */}
          <View style={s.cityInputRow}>
            <TextInput
              value={cityInput}
              onChangeText={(t) => { setCityInput(t); setCityStatus('idle'); }}
              placeholder="Search city e.g. Karachi, Cairo, London"
              placeholderTextColor="#4b5563"
              returnKeyType="search"
              onSubmitEditing={handleCitySearch}
              style={[s.cityInput, cityStatus === 'found' && s.cityInputFound, cityStatus === 'notfound' && s.cityInputError]}
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

          {cityStatus === 'notfound' && (
            <Text style={s.cityError}>City not found. Try a nearby major city.</Text>
          )}
          {cityResults.length > 0 && (
            <View style={{ marginTop: 8 }}>
              {cityResults.map((r, i) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => handleCitySelect(r)}
                  style={{ paddingVertical: 10, paddingHorizontal: 12, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 8, marginBottom: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}
                >
                  <Text style={{ color: '#e5e7eb', fontSize: 13 }} numberOfLines={2}>{r.displayName}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* GPS restore button — only shown when a city is manually set */}
          {manualCity.length > 0 && (
            <TouchableOpacity
              onPress={() => { Haptics.selectionAsync(); setCityInput(''); setCityStatus('idle'); onClearManualCity(); }}
              style={[s.clearLocationBtn, { marginTop: 10 }]}
            >
              <MaterialCommunityIcons name="crosshairs-gps" size={14} color="#4ade80" />
              <Text style={{ color: '#4ade80', fontSize: 12, fontWeight: '600', marginLeft: 5 }}>Use GPS instead</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={s.groupDivider} />

        {/* Asr calculation */}
        <View style={s.calcDescRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
            <MaterialCommunityIcons name="weather-sunny" size={16} color="#fbbf24" style={{ marginRight: 6 }} />
            <Text style={s.calcDescTitle}>Asr Calculation</Text>
          </View>
          <Text style={[s.calcDescBody, { marginBottom: 12 }]}>
            Two scholarly opinions on when Asr begins. Hanafi uses a slightly later time than the standard Shafi'i, Maliki and Hanbali method.
          </Text>
          <View style={s.segmentRow}>
            <TouchableOpacity onPress={() => { Haptics.selectionAsync(); onChangeMadhab('standard'); }} style={[s.segmentBtn, madhab === 'standard' && s.segmentActive]}>
              <Text style={[s.segmentText, madhab === 'standard' && s.segmentTextActive]}>Standard</Text>
              <Text style={[s.segmentSubText, madhab === 'standard' && s.segmentSubTextActive]}>Shafi'i · Maliki · Hanbali</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { Haptics.selectionAsync(); onChangeMadhab('hanafi'); }} style={[s.segmentBtn, madhab === 'hanafi' && s.segmentActive]}>
              <Text style={[s.segmentText, madhab === 'hanafi' && s.segmentTextActive]}>Hanafi</Text>
              <Text style={[s.segmentSubText, madhab === 'hanafi' && s.segmentSubTextActive]}>Later Asr time</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* ── NOTIFICATIONS ─────────────────────────────────── */}
      <SectionLabel label="NOTIFICATIONS" />
      <View style={s.groupCard}>
        <View style={s.settingsRow}>
          <View style={[s.rowIconBg, { backgroundColor: 'rgba(168,85,247,0.1)' }]}>
            <MaterialCommunityIcons name="bell-outline" size={18} color="#a855f7" />
          </View>
          <View style={s.rowBody}>
            <Text style={s.rowLabel}>Prayer Reminders</Text>
            <Text style={s.rowHint}>Alert when each prayer time begins</Text>
          </View>
          <Switch
            value={notificationsEnabled}
            onValueChange={(val) => { Haptics.selectionAsync(); onToggleNotifications(val); }}
            trackColor={{ false: '#374151', true: 'rgba(168,85,247,0.5)' }}
            thumbColor={notificationsEnabled ? '#a855f7' : '#6b7280'}
          />
        </View>
      </View>

      {/* ── TOOLS (page only) ─────────────────────────────── */}
      {asPage && onRest && (
        <>
          <SectionLabel label="TOOLS" />
          <View style={s.groupCard}>
            <TouchableOpacity style={s.settingsRow} onPress={onRest} activeOpacity={0.7}>
              <View style={[s.rowIconBg, { backgroundColor: 'rgba(16,185,129,0.1)' }]}>
                <MaterialCommunityIcons name="moon-waning-crescent" size={18} color="#10b981" />
              </View>
              <View style={s.rowBody}>
                <Text style={s.rowLabel}>Rest Period</Text>
                <Text style={s.rowHint}>Pause garden decay temporarily</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color="#374151" />
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* ── ACCOUNT ───────────────────────────────────────── */}
      <SectionLabel label="ACCOUNT" />
      <View style={s.groupCard}>
        <TouchableOpacity style={s.settingsRow} onPress={handleRestorePurchases} disabled={restoringPurchases} activeOpacity={0.7}>
          <View style={[s.rowIconBg, { backgroundColor: 'rgba(96,165,250,0.1)' }]}>
            <MaterialCommunityIcons name="restore" size={18} color="#60a5fa" />
          </View>
          <View style={s.rowBody}>
            <Text style={s.rowLabel}>Restore Purchases</Text>
            <Text style={s.rowHint}>Recover a previous premium subscription</Text>
          </View>
          {restoringPurchases
            ? <ActivityIndicator size="small" color="#60a5fa" />
            : <MaterialCommunityIcons name="chevron-right" size={20} color="#374151" />}
        </TouchableOpacity>
      </View>

      {/* ── SUPPORT ───────────────────────────────────────── */}
      <SectionLabel label="SUPPORT" />
      <View style={s.groupCard}>
        <PageLinkRow icon="shield-lock-outline" label="Privacy Policy" onPress={() => handleOpenLink(PRIVACY_URL)} />
        <View style={s.groupDivider} />
        <PageLinkRow icon="file-document-outline" label="Terms of Service" onPress={() => handleOpenLink(TERMS_URL)} />
        <View style={s.groupDivider} />
        <PageLinkRow icon="email-outline" label="Contact Support" onPress={handleContact} />
        <View style={s.groupDivider} />
        <View style={s.settingsRow}>
          <View style={[s.rowIconBg, { backgroundColor: 'rgba(156,163,175,0.08)' }]}>
            <MaterialCommunityIcons name="information-outline" size={18} color="#6b7280" />
          </View>
          <View style={s.rowBody}>
            <Text style={s.rowLabel}>Version</Text>
          </View>
          <Text style={s.versionValue}>{APP_VERSION}</Text>
        </View>
      </View>

      {/* ── RESET ─────────────────────────────────────────── */}
      <TouchableOpacity style={s.resetBtn} onPress={handleResetProgress} activeOpacity={0.7}>
        <MaterialCommunityIcons name="trash-can-outline" size={16} color="#ef4444" />
        <Text style={s.resetText}>Reset All Progress</Text>
      </TouchableOpacity>

      {/* ── DEBUG (dev only — never shipped in production builds) ── */}
      {__DEV__ && asPage && onDebug && (
        <TouchableOpacity
          onPress={onDebug}
          activeOpacity={0.7}
          style={{ alignItems: 'center', paddingVertical: 16, marginTop: 4 }}
        >
          <Text style={{ color: '#374151', fontSize: 11, fontWeight: '600' }}>🐛 Developer Tools</Text>
        </TouchableOpacity>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );

  if (asPage) {
    return <View style={{ flex: 1 }}>{innerContent}</View>;
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.sheet}>
          <View style={s.header}>
            <View style={s.headerLeft}>
              <Image source={ICON_GEAR} style={s.headerIcon} resizeMode="contain" />
              <Text style={s.headerTitle}>Settings</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={s.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <MaterialCommunityIcons name="close" size={18} color="#9ca3af" />
            </TouchableOpacity>
          </View>
          {innerContent}
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

const PageLinkRow = memo(function PageLinkRow({
  icon,
  label,
  onPress,
}: {
  icon: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={s.settingsRow} onPress={onPress} activeOpacity={0.7}>
      <View style={[s.rowIconBg, { backgroundColor: 'rgba(156,163,175,0.08)' }]}>
        <MaterialCommunityIcons name={icon as any} size={18} color="#6b7280" />
      </View>
      <View style={s.rowBody}>
        <Text style={s.rowLabel}>{label}</Text>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={20} color="#374151" />
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
    color: '#6b7280',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 22,
    marginBottom: 8,
    marginLeft: 20,
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

  // ── Page-mode styles ───────────────────────────────────────────────────────
  sectionIntro: {
    color: '#9ca3af',
    fontSize: 13,
    lineHeight: 19,
    marginHorizontal: 20,
    marginTop: -4,
    marginBottom: 12,
  },
  calcDescRow: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 14,
  },
  calcDescTitle: {
    color: '#e5e7eb',
    fontSize: 15,
    fontWeight: '600',
  },
  calcDescBody: {
    color: '#6b7280',
    fontSize: 13,
    lineHeight: 19,
  },
  recommendedBadge: {
    marginLeft: 8,
    backgroundColor: 'rgba(16,185,129,0.12)',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.25)',
  },
  recommendedBadgeText: {
    color: '#10b981',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  pageTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: '#f3f4f6',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 20,
    letterSpacing: -0.5,
  },
  groupCard: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    overflow: 'hidden',
  },
  groupDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginHorizontal: 14,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 12,
    minHeight: 56,
  },
  rowIconBg: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  rowLabel: {
    color: '#e5e7eb',
    fontSize: 15,
    fontWeight: '600',
  },
  rowHint: {
    color: '#6b7280',
    fontSize: 12,
    fontWeight: '400',
  },
  rowExpanded: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    paddingTop: 2,
  },
  clearLocationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)',
  },
  premiumBannerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 20,
    backgroundColor: 'rgba(251,191,36,0.1)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.25)',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  premiumBannerTitle: {
    color: '#fbbf24',
    fontSize: 15,
    fontWeight: '700',
  },
  premiumBannerSub: {
    color: 'rgba(251,191,36,0.6)',
    fontSize: 12,
    marginTop: 2,
  },
  premiumBannerPill: {
    backgroundColor: '#fbbf24',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  premiumBannerPillText: {
    color: '#000',
    fontSize: 12,
    fontWeight: '800',
  },
  premiumActiveBannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 20,
    backgroundColor: 'rgba(251,191,36,0.07)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.18)',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  premiumActiveTxt: {
    color: '#fbbf24',
    fontSize: 14,
    fontWeight: '700',
  },
  activePill: {
    backgroundColor: 'rgba(167,139,250,0.18)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.35)',
  },
  activePillText: {
    color: '#a78bfa',
    fontSize: 12,
    fontWeight: '700',
  },
});

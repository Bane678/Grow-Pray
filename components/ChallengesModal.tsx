import React, { useEffect, useState, memo, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Platform,
  Pressable,
  StatusBar,
  Modal,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Challenge, ChallengeId, getTimeUntilReset, getTimeUntilMidnight } from '../hooks/useChallenges';

// Challenge IDs that use a pixel-art image instead of an emoji
const CHALLENGE_IMAGE_ICONS: Partial<Record<string, ReturnType<typeof require>>> = {
  fajrToday: require('../assets/Garden Assets/Icons/Fajr.png'),
};

type Section = 'daily' | 'weekly';

interface ChallengesModalProps {
  visible: boolean;
  onClose: () => void;
  challenges: Challenge[];
  onClaimReward: (challengeId: ChallengeId) => void;
  asPage?: boolean;
}

export const ChallengesModal = memo(function ChallengesModal({ visible, onClose, challenges, onClaimReward, asPage = false }: ChallengesModalProps) {
  const [section, setSection] = useState<Section>('daily');
  const [weeklyTimer, setWeeklyTimer] = useState(getTimeUntilReset());
  const [dailyTimer,  setDailyTimer]  = useState(getTimeUntilMidnight());

  // Update timers every minute
  useEffect(() => {
    if (!visible) return;
    setWeeklyTimer(getTimeUntilReset());
    setDailyTimer(getTimeUntilMidnight());
    const interval = setInterval(() => {
      setWeeklyTimer(getTimeUntilReset());
      setDailyTimer(getTimeUntilMidnight());
    }, 60000);
    return () => clearInterval(interval);
  }, [visible]);

  const sectionChallenges = useMemo(
    () => challenges.filter(c => c.type === section),
    [challenges, section],
  );

  // Stable callbacks per challenge id
  const claimHandlers = useMemo(() => {
    const map: Record<string, () => void> = {};
    for (const c of challenges) {
      map[c.id] = () => onClaimReward(c.id);
    }
    return map;
  }, [challenges, onClaimReward]);

  const totalCompleted = sectionChallenges.filter(c => c.claimed).length;

  // Claimable = complete but not yet claimed — drives the red badge on each tab
  const dailyClaimable  = useMemo(() => challenges.filter(c => c.type === 'daily'  && c.progress >= c.target && !c.claimed).length, [challenges]);
  const weeklyClaimable = useMemo(() => challenges.filter(c => c.type === 'weekly' && c.progress >= c.target && !c.claimed).length, [challenges]);

  const listData = useMemo(() => {
    return sectionChallenges;
  }, [sectionChallenges]);

  const renderItem = useCallback(({ item }: { item: any }) => (
    <MemoizedChallengeCard
      challenge={item as Challenge}
      onClaim={claimHandlers[(item as Challenge).id]}
    />
  ), [claimHandlers]);

  const keyExtractor = useCallback((item: any) => item.id ?? '_info', []);

  if (!visible && !asPage) return null;

  const resetLabel = section === 'daily'
    ? `Resets in ${dailyTimer.hours}h ${dailyTimer.minutes}m`
    : `Resets in ${weeklyTimer.days}d ${weeklyTimer.hours}h ${weeklyTimer.minutes}m`;

  const innerContent = (
    <>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Challenges</Text>
          <Text style={styles.subtitle}>{resetLabel}</Text>
        </View>
        {!asPage && (
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Daily / Weekly tab switcher */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabBtn, section === 'daily' && styles.tabBtnActive]}
          onPress={() => setSection('daily')}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabBtnText, section === 'daily' && styles.tabBtnTextActive]}>Daily</Text>
          {dailyClaimable > 0 && (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>{dailyClaimable}</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, section === 'weekly' && styles.tabBtnActive]}
          onPress={() => setSection('weekly')}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabBtnText, section === 'weekly' && styles.tabBtnTextActive]}>Weekly</Text>
          {weeklyClaimable > 0 && (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>{weeklyClaimable}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Progress summary */}
      <View style={styles.summaryRow}>
        <Text style={styles.summaryText}>
          {totalCompleted}/{sectionChallenges.length} completed
        </Text>
        {totalCompleted === sectionChallenges.length && sectionChallenges.length > 0 && (
          <Text style={styles.allDoneText}>{section === 'daily' ? 'All done today!' : 'All done this week!'}</Text>
        )}
      </View>

      {/* Overall section progress bar */}
      <View style={styles.overallProgressWrap}>
        <View style={styles.overallProgressBar}>
          <View style={[styles.overallProgressFill, { width: `${sectionChallenges.length > 0 ? (totalCompleted / sectionChallenges.length) * 100 : 0}%` as any }]} />
        </View>
      </View>

      {/* Challenge cards — FlatList for virtualized native scroll */}
      <FlatList
        key={section}
        data={listData}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={true}
        overScrollMode="never"
        removeClippedSubviews={true}
        ListFooterComponent={<View style={{ height: 20 }} />}
      />
    </>
  );

  if (asPage) {
    return (
      <View style={[styles.container, { flex: 1, borderTopLeftRadius: 0, borderTopRightRadius: 0, maxHeight: '100%' as any, backgroundColor: 'rgba(15,21,38,0.65)' }]}>
        {innerContent}
      </View>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.container}>{innerContent}</View>
      </View>
    </Modal>
  );
});

// ─── Challenge Card ────────────────────────────────────────────────────────────

const MemoizedChallengeCard = memo(ChallengeCard);

function ChallengeCard({ challenge, onClaim }: { challenge: Challenge; onClaim: () => void }) {
  const progress = Math.min(challenge.progress, challenge.target);
  const progressPct = (progress / challenge.target) * 100;
  const isComplete = progress >= challenge.target;
  const isClaimed = challenge.claimed;

  const statusColor = isClaimed ? '#4ade80' : isComplete ? '#fbbf24' : '#e8a87c';

  // Card wrapper — tinted left accent + status-aware background
  const cardStyle = useMemo(() => {
    const bg = isClaimed
      ? 'rgba(74,222,128,0.05)'
      : isComplete
      ? 'rgba(251,191,36,0.05)'
      : 'rgba(255,255,255,0.035)';
    return [
      styles.card,
      {
        backgroundColor: bg,
        borderLeftColor: statusColor,
        borderLeftWidth: 3,
      },
    ];
  }, [isClaimed, isComplete, statusColor]);

  const fillStyle = useMemo(
    () => [styles.progressFill, { width: `${progressPct}%` as any, backgroundColor: statusColor }],
    [progressPct, statusColor],
  );

  const textStyle = useMemo(
    () => [styles.progressText, { color: statusColor }],
    [statusColor],
  );

  const imageIcon = CHALLENGE_IMAGE_ICONS[challenge.id];

  return (
    <View style={cardStyle}>
      <View style={styles.cardTop}>
        <View style={styles.cardIconRow}>
          <View style={styles.cardIconContainer}>
            {imageIcon
              ? <Image source={imageIcon} style={styles.cardIconImage} resizeMode="contain" />
              : <Text style={styles.cardIcon}>{challenge.icon}</Text>
            }
          </View>
          <View style={styles.cardTitleArea}>
            <Text style={styles.cardTitle}>{challenge.title}</Text>
            <Text style={styles.cardDesc}>{challenge.description}</Text>
          </View>
        </View>
        <View style={[styles.rewardBadge, isComplete && !isClaimed && styles.rewardBadgeGlow]}>
          <Text style={styles.rewardText}>{challenge.reward} coins</Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={fillStyle} />
        </View>
        <Text style={textStyle}>
          {progress}/{challenge.target}
        </Text>
      </View>

      {/* Claim button */}
      {isComplete && !isClaimed && (
        <TouchableOpacity
          style={styles.claimBtn}
          onPress={() => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onClaim();
          }}
          activeOpacity={0.7}
        >
          <Text style={styles.claimBtnText}>Claim  •  +{challenge.reward} coins</Text>
        </TouchableOpacity>
      )}

      {isClaimed && (
        <View style={styles.claimedBadge}>
          <Text style={styles.claimedText}>✓ Claimed</Text>
        </View>
      )}
    </View>
  );
}

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
    maxHeight: '85%',
    paddingBottom: 30,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
  },
  title: {
    color: '#e8e0d6',
    fontSize: 22,
    fontWeight: '800',
  },
  subtitle: {
    color: '#6b7280',
    fontSize: 12,
    marginTop: 4,
    letterSpacing: 0.3,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    color: '#9ca3af',
    fontSize: 16,
    fontWeight: '700',
  },
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    padding: 3,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 11,
    alignItems: 'center',
    position: 'relative',
  },
  tabBadge: {
    position: 'absolute',
    top: -6,
    right: 8,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#0f1526',
  },
  tabBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    lineHeight: 13,
  },
  tabBtnActive: {
    backgroundColor: '#e8a87c',
  },
  tabBtnText: {
    color: '#6b7280',
    fontSize: 14,
    fontWeight: '600',
  },
  tabBtnTextActive: {
    color: '#0f1526',
    fontWeight: '700',
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 6,
  },
  summaryText: {
    color: '#e8e0d6',
    fontSize: 14,
    fontWeight: '600',
  },
  allDoneText: {
    color: '#4ade80',
    fontSize: 13,
    fontWeight: '700',
  },
  overallProgressWrap: {
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  overallProgressBar: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  overallProgressFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: '#e8a87c',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  card: {
    borderRadius: 16,
    padding: 14,
    paddingLeft: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  cardIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  cardIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    // No background — box removed per design
  },
  cardIcon: {
    fontSize: 28,
  },
  cardIconImage: {
    width: 36,
    height: 36,
  },
  cardTitleArea: {
    flex: 1,
  },
  cardTitle: {
    color: '#e8e0d6',
    fontSize: 15,
    fontWeight: '700',
  },
  cardDesc: {
    color: '#6b7280',
    fontSize: 12,
    marginTop: 3,
    lineHeight: 16,
  },
  rewardBadge: {
    backgroundColor: 'rgba(251,191,36,0.10)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginLeft: 8,
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.12)',
  },
  rewardBadgeGlow: {
    backgroundColor: 'rgba(251,191,36,0.18)',
    borderColor: 'rgba(251,191,36,0.30)',
  },
  rewardText: {
    color: '#fbbf24',
    fontSize: 13,
    fontWeight: '700',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '700',
    minWidth: 40,
    textAlign: 'right',
  },
  claimBtn: {
    marginTop: 12,
    backgroundColor: '#e8a87c',
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  claimBtnText: {
    color: '#0f1526',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  claimedBadge: {
    marginTop: 10,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(74,222,128,0.10)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  claimedText: {
    color: '#4ade80',
    fontSize: 12,
    fontWeight: '700',
  },
  infoBox: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 14,
    padding: 16,
    marginTop: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  infoTitle: {
    color: '#9ca3af',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  infoText: {
    color: '#6b7280',
    fontSize: 12,
    lineHeight: 20,
  },
});

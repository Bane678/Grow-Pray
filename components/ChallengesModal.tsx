import React, { useEffect, useState, memo, useCallback, useMemo } from 'react';
import {
  View,
  Text,
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

  const listData = useMemo(() => {
    return [...sectionChallenges, { _type: 'info' as const }];
  }, [sectionChallenges]);

  const renderItem = useCallback(({ item }: { item: any }) => {
    if (item._type === 'info') {
      const infoText = section === 'daily'
        ? '• Daily challenges reset at midnight\n• Complete prayers or plant trees to progress\n• Claim rewards before midnight or they reset\n• On Schedule: complete prayers within their time window'
        : '• Weekly challenges reset every Monday at midnight\n• On-Time Master: complete prayers before their Islamic deadline\n• Tree Planter: plant trees anytime during the week\n• Perfect Week requires all 35 prayers (5/day × 7 days)';
      return (
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>ℹ️ How it works</Text>
          <Text style={styles.infoText}>{infoText}</Text>
        </View>
      );
    }
    return (
      <MemoizedChallengeCard
        challenge={item as Challenge}
        onClaim={claimHandlers[(item as Challenge).id]}
      />
    );
  }, [claimHandlers, section]);

  const keyExtractor = useCallback((item: any) => item.id ?? '_info', []);

  if (!visible && !asPage) return null;

  const resetLabel = section === 'daily'
    ? `Resets in ${dailyTimer.hours}h ${dailyTimer.minutes}m`
    : `Resets in ${weeklyTimer.days}d ${weeklyTimer.hours}h ${weeklyTimer.minutes}m`;

  const Wrapper = asPage
    ? ({ children }: { children: React.ReactNode }) => (
        <View style={[styles.container, { flex: 1, borderTopLeftRadius: 0, borderTopRightRadius: 0, maxHeight: '100%' as any }]}>{children}</View>
      )
    : ({ children }: { children: React.ReactNode }) => (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
          <View style={styles.overlay}>
            <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
            <View style={styles.container}>{children}</View>
          </View>
        </Modal>
      );

  return (
    <Wrapper>
      {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>🏆 Challenges</Text>
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
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, section === 'weekly' && styles.tabBtnActive]}
            onPress={() => setSection('weekly')}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabBtnText, section === 'weekly' && styles.tabBtnTextActive]}>Weekly</Text>
          </TouchableOpacity>
        </View>

        {/* Progress summary */}
        <View style={styles.summaryRow}>
          <Text style={styles.summaryText}>
            {totalCompleted}/{sectionChallenges.length} completed
          </Text>
          {totalCompleted === sectionChallenges.length && sectionChallenges.length > 0 && (
            <Text style={styles.allDoneText}>{section === 'daily' ? '🎉 All done today!' : '🎉 All done this week!'}</Text>
          )}
        </View>

        {/* Challenge cards — FlatList for virtualized native scroll */}
        <FlatList
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
    </Wrapper>
  );
});

// ─── Challenge Card ────────────────────────────────────────────────────────────

const MemoizedChallengeCard = memo(ChallengeCard);

function ChallengeCard({ challenge, onClaim }: { challenge: Challenge; onClaim: () => void }) {
  const progress = Math.min(challenge.progress, challenge.target);
  const progressPct = (progress / challenge.target) * 100;
  const isComplete = progress >= challenge.target;
  const isClaimed = challenge.claimed;

  // Pre-compute styles to avoid inline object creation
  const cardStyle = useMemo(() => {
    const bg = isClaimed ? 'rgba(74,222,128,0.06)' : isComplete ? 'rgba(251,191,36,0.06)' : 'rgba(255,255,255,0.04)';
    return [styles.card, { backgroundColor: bg }];
  }, [isClaimed, isComplete]);

  const statusColor = isClaimed ? '#4ade80' : isComplete ? '#fbbf24' : '#e8a87c';

  const fillStyle = useMemo(
    () => [styles.progressFill, { width: `${progressPct}%` as any, backgroundColor: statusColor }],
    [progressPct, statusColor],
  );

  const textStyle = useMemo(
    () => [styles.progressText, { color: statusColor }],
    [statusColor],
  );

  return (
    <View style={cardStyle}>
      <View style={styles.cardTop}>
        <View style={styles.cardIconRow}>
          <Text style={styles.cardIcon}>{challenge.icon}</Text>
          <View style={styles.cardTitleArea}>
            <Text style={styles.cardTitle}>{challenge.title}</Text>
            <Text style={styles.cardDesc}>{challenge.description}</Text>
          </View>
        </View>
        <View style={styles.rewardBadge}>
          <Text style={styles.rewardText}>🪙 {challenge.reward}</Text>
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
          <Text style={styles.claimBtnText}>🎁 Claim Reward (+{challenge.reward} coins)</Text>
        </TouchableOpacity>
      )}

      {isClaimed && (
        <View style={styles.claimedBadge}>
          <Text style={styles.claimedText}>✅ Claimed!</Text>
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
    paddingBottom: 12,
  },
  title: {
    color: '#e8e0d6',
    fontSize: 22,
    fontWeight: '800',
  },
  subtitle: {
    color: '#9ca3af',
    fontSize: 13,
    marginTop: 2,
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
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    padding: 3,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 9,
    alignItems: 'center',
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
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  summaryText: {
    color: '#e8e0d6',
    fontSize: 14,
    fontWeight: '600',
  },
  allDoneText: {
    color: '#4ade80',
    fontSize: 14,
    fontWeight: '600',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
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
  cardIcon: {
    fontSize: 28,
    marginRight: 12,
  },
  cardTitleArea: {
    flex: 1,
  },
  cardTitle: {
    color: '#e8e0d6',
    fontSize: 16,
    fontWeight: '700',
  },
  cardDesc: {
    color: '#9ca3af',
    fontSize: 12,
    marginTop: 2,
  },
  rewardBadge: {
    backgroundColor: 'rgba(251,191,36,0.12)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginLeft: 8,
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
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 13,
    fontWeight: '700',
    minWidth: 45,
    textAlign: 'right',
  },
  claimBtn: {
    marginTop: 12,
    backgroundColor: '#e8a87c',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  claimBtnText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '800',
  },
  claimedBadge: {
    marginTop: 8,
    alignItems: 'center',
  },
  claimedText: {
    color: '#4ade80',
    fontSize: 13,
    fontWeight: '600',
  },
  infoBox: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    padding: 14,
    marginTop: 4,
  },
  infoTitle: {
    color: '#e8e0d6',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
  },
  infoText: {
    color: '#9ca3af',
    fontSize: 12,
    lineHeight: 20,
  },
});

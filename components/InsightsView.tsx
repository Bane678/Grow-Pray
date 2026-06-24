import React, { useMemo } from 'react';
import { View, Text, Image, StyleSheet, Dimensions } from 'react-native';
import Svg, { Polyline, Circle, Line } from 'react-native-svg';
import { FONTS } from '../theme/typography';
import {
  PrayerInsights,
  PRAYER_ORDER,
  computeYearOverview,
  PrayerHistory,
} from '../hooks/usePrayerInsights';

const PRAYER_COLORS: Record<string, string> = {
  Fajr: '#60a5fa',
  Dhuhr: '#fbbf24',
  Asr: '#fb923c',
  Maghrib: '#f87171',
  Isha: '#a78bfa',
};

const PRAYER_ICONS: Record<string, ReturnType<typeof require>> = {
  Fajr: require('../assets/Garden Assets/Icons/Fajr.png'),
  Dhuhr: require('../assets/Garden Assets/Icons/Dhuhr.png'),
  Asr: require('../assets/Garden Assets/Icons/Asr.png'),
  Maghrib: require('../assets/Garden Assets/Icons/Maghrib.png'),
  Isha: require('../assets/Garden Assets/Icons/Isha.png'),
};

const ICON_STAR = require('../assets/Garden Assets/Icons/Icon_Star.png');
const ICON_HANDS = require('../assets/Garden Assets/Icons/Icon_Hands.png');
const ICON_FIRE = require('../assets/Garden Assets/Icons/Icon_Fire.png');

const MONTH_SHORT = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

interface InsightsViewProps {
  insights: PrayerInsights;
  /** Raw history for the year overview (omitted in preview mode). */
  prayerHistory?: PrayerHistory;
  windowDays?: number;
}

function pct(v: number): string {
  return `${Math.round(v * 100)}%`;
}

export const InsightsView = React.memo(function InsightsView({
  insights,
  prayerHistory,
  windowDays = 30,
}: InsightsViewProps) {
  const year = new Date().getFullYear();
  const yearOverview = useMemo(
    () => (prayerHistory ? computeYearOverview(prayerHistory, year) : new Array(12).fill(0)),
    [prayerHistory, year],
  );

  const trend = insights.completionTrend.length ? insights.completionTrend : [0];

  // Trend sparkline geometry
  const chartW = Dimensions.get('window').width - 72;
  const chartH = 90;
  const maxY = 1;
  const points = trend
    .map((v, i) => {
      const x = trend.length === 1 ? chartW / 2 : (i / (trend.length - 1)) * chartW;
      const y = chartH - (v / maxY) * chartH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
      {/* Headline stats */}
      <View style={styles.statsBar}>
        {[
          { value: String(insights.perfectDays), label: 'Perfect Days', icon: ICON_STAR },
          { value: String(insights.totalPrayers), label: `Prayers (${windowDays}d)`, icon: ICON_HANDS },
          { value: String(insights.bestStreak), label: 'Best Streak', icon: ICON_FIRE },
        ].map((stat, idx) => (
          <React.Fragment key={stat.label}>
            {idx > 0 && <View style={styles.statDivider} />}
            <View style={styles.statItem}>
              <Image source={stat.icon} style={{ width: 18, height: 18 }} resizeMode="contain" />
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          </React.Fragment>
        ))}
      </View>

      {/* Per-prayer completion */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Completion by prayer</Text>
        <Text style={styles.cardSub}>Last {windowDays} days</Text>
        {PRAYER_ORDER.map((p) => {
          const rate = insights.perPrayerRate[p] || 0;
          return (
            <View key={p} style={styles.barRow}>
              <Image source={PRAYER_ICONS[p]} style={styles.barIcon} resizeMode="contain" />
              <Text style={styles.barLabel}>{p}</Text>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    { width: `${Math.max(2, rate * 100)}%` as any, backgroundColor: PRAYER_COLORS[p] },
                  ]}
                />
              </View>
              <Text style={[styles.barPct, { color: PRAYER_COLORS[p] }]}>{pct(rate)}</Text>
            </View>
          );
        })}
      </View>

      {/* Most / least consistent */}
      <View style={styles.dualRow}>
        <View style={[styles.card, styles.dualCard]}>
          <Text style={styles.miniLabel}>Most consistent</Text>
          <Text
            style={[
              styles.miniValue,
              { color: insights.mostConsistent ? PRAYER_COLORS[insights.mostConsistent] : '#e8e0d6' },
            ]}
          >
            {insights.mostConsistent || '—'}
          </Text>
        </View>
        <View style={[styles.card, styles.dualCard]}>
          <Text style={styles.miniLabel}>Needs attention</Text>
          <Text
            style={[
              styles.miniValue,
              { color: insights.leastConsistent ? PRAYER_COLORS[insights.leastConsistent] : '#e8e0d6' },
            ]}
          >
            {insights.leastConsistent || '—'}
          </Text>
        </View>
      </View>

      {/* Completion trend */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Completion trend</Text>
        <Text style={styles.cardSub}>Recent {windowDays} days</Text>
        <View style={{ marginTop: 10 }}>
          <Svg width={chartW} height={chartH}>
            {/* baseline + midline */}
            <Line x1={0} y1={chartH} x2={chartW} y2={chartH} stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
            <Line x1={0} y1={chartH / 2} x2={chartW} y2={chartH / 2} stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
            <Polyline
              points={points}
              fill="none"
              stroke="#e8a87c"
              strokeWidth={2.5}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {trend.map((v, i) => {
              const x = trend.length === 1 ? chartW / 2 : (i / (trend.length - 1)) * chartW;
              const y = chartH - (v / maxY) * chartH;
              return <Circle key={i} cx={x} cy={y} r={3} fill="#e8a87c" />;
            })}
          </Svg>
          <View style={styles.trendAxis}>
            <Text style={styles.axisText}>older</Text>
            <Text style={styles.axisText}>now</Text>
          </View>
        </View>
      </View>

      {/* Year overview */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{year} overview</Text>
        <Text style={styles.cardSub}>Monthly completion</Text>
        <View style={styles.yearRow}>
          {yearOverview.map((v, i) => (
            <View key={i} style={styles.yearCol}>
              <View style={styles.yearBarTrack}>
                <View
                  style={[
                    styles.yearBarFill,
                    { height: `${Math.max(2, v * 100)}%` as any },
                  ]}
                />
              </View>
              <Text style={styles.yearMonth}>{MONTH_SHORT[i]}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  statsBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    paddingVertical: 14,
    marginBottom: 12,
    alignItems: 'center',
  },
  statItem: { flex: 1, alignItems: 'center', gap: 3 },
  statDivider: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.08)' },
  statValue: { fontSize: 20, fontWeight: '800', color: '#e8e0d6', fontFamily: FONTS.display },
  statLabel: { fontSize: 10, color: 'rgba(232,224,214,0.5)', fontWeight: '500' },

  card: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#e8e0d6', fontFamily: FONTS.display },
  cardSub: { fontSize: 11, color: 'rgba(232,224,214,0.45)', marginTop: 2, marginBottom: 4 },

  barRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 8 },
  barIcon: { width: 18, height: 18 },
  barLabel: { width: 58, fontSize: 12, color: 'rgba(232,224,214,0.8)', fontWeight: '600' },
  barTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4 },
  barPct: { width: 40, textAlign: 'right', fontSize: 12, fontWeight: '700' },

  dualRow: { flexDirection: 'row', gap: 12 },
  dualCard: { flex: 1, alignItems: 'center' },
  miniLabel: { fontSize: 11, color: 'rgba(232,224,214,0.5)', fontWeight: '500', marginBottom: 4 },
  miniValue: { fontSize: 18, fontWeight: '800', fontFamily: FONTS.display },

  trendAxis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  axisText: { fontSize: 9, color: 'rgba(232,224,214,0.35)' },

  yearRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 80, marginTop: 10 },
  yearCol: { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
  yearBarTrack: { width: 8, height: 60, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'flex-end', overflow: 'hidden' },
  yearBarFill: { width: 8, borderRadius: 4, backgroundColor: '#e8a87c' },
  yearMonth: { fontSize: 8, color: 'rgba(232,224,214,0.4)', marginTop: 4 },
});

import React, { useState, useMemo, memo, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

// ─── Types ─────────────────────────────────────────────────────────────────────

const PRAYER_ORDER = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'] as const;
type PrayerName = (typeof PRAYER_ORDER)[number];
type PrayerStreaks = Record<string, number>;

// Daily log entry: which prayers were completed that day
export type DailyPrayerLog = {
  [date: string]: string[]; // e.g. { "2026-02-17": ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"] }
};

interface PrayerHistoryModalProps {
  visible: boolean;
  onClose: () => void;
  streaks: PrayerStreaks;
  prayerHistory: DailyPrayerLog;
  completedToday: Set<string>;
  asPage?: boolean;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function getDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getCalendarDays(year: number, month: number): (Date | null)[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startDow = firstDay.getDay(); // 0=Sun

  const cells: (Date | null)[] = [];
  // Leading empty cells
  for (let i = 0; i < startDow; i++) cells.push(null);
  // Day cells
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(new Date(year, month, d));
  }
  return cells;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

// ─── Prayer dot colors ─────────────────────────────────────────────────────────

const PRAYER_COLORS: Record<string, string> = {
  Fajr: '#60a5fa',     // blue
  Dhuhr: '#fbbf24',    // amber
  Asr: '#fb923c',      // orange
  Maghrib: '#f87171',  // red
  Isha: '#a78bfa',     // purple
};

// ─── Component ─────────────────────────────────────────────────────────────────

export const PrayerHistoryModal = memo(function PrayerHistoryModal({
  visible,
  onClose,
  streaks,
  prayerHistory,
  completedToday,
  asPage = false,
}: PrayerHistoryModalProps) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const prevMonth = useCallback(() => {
    Haptics.selectionAsync();
    setViewMonth(m => {
      if (m === 0) {
        setViewYear(y => y - 1);
        return 11;
      }
      return m - 1;
    });
  }, []);

  const nextMonth = useCallback(() => {
    Haptics.selectionAsync();
    setViewMonth(m => {
      if (m === 11) {
        setViewYear(y => y + 1);
        return 0;
      }
      return m + 1;
    });
  }, []);

  const calendarDays = useMemo(() => getCalendarDays(viewYear, viewMonth), [viewYear, viewMonth]);

  // Build a lookup for today's data merged with history
  const getCompletedForDate = useCallback((date: Date): string[] => {
    if (isSameDay(date, today)) {
      return Array.from(completedToday);
    }
    const key = getDateKey(date);
    return prayerHistory[key] || [];
  }, [prayerHistory, completedToday, today]);

  // Count stats
  const monthStats = useMemo(() => {
    let perfectDays = 0;
    let totalPrayers = 0;
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(viewYear, viewMonth, d);
      if (date > today) break; // Don't count future days
      const completed = getCompletedForDate(date);
      totalPrayers += completed.length;
      if (completed.length === 5) perfectDays++;
    }
    return { perfectDays, totalPrayers };
  }, [viewYear, viewMonth, prayerHistory, completedToday]);

  // Best current streak (max across all prayers)
  const bestStreak = useMemo(() => Math.max(0, ...Object.values(streaks)), [streaks]);

  // Selected day details
  const selectedDayPrayers = useMemo(() => {
    if (!selectedDate) return [];
    return getCompletedForDate(selectedDate);
  }, [selectedDate, getCompletedForDate]);

  const cellSize = Math.floor((Dimensions.get('window').width - 80) / 7);

  const Wrapper = asPage
    ? ({ children }: { children: React.ReactNode }) => (
        <View style={[styles.container, { flex: 1, borderTopLeftRadius: 0, borderTopRightRadius: 0, maxHeight: '100%' as any }]}>{children}</View>
      )
    : ({ children }: { children: React.ReactNode }) => (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
          <View style={styles.overlay}><View style={styles.container}>{children}</View></View>
        </Modal>
      );

  return (
    <Wrapper>
      {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Prayer History</Text>
            {!asPage && (
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <MaterialCommunityIcons name="close" size={24} color="#9ca3af" />
              </TouchableOpacity>
            )}
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
            {/* ── Streak Cards ──────────────────────────────── */}
            <View style={styles.streaksContainer}>
              {PRAYER_ORDER.map(prayer => (
                <View key={prayer} style={styles.streakCard}>
                  <View style={[styles.streakDot, { backgroundColor: PRAYER_COLORS[prayer] }]} />
                  <Text style={styles.streakLabel}>{prayer}</Text>
                  <Text style={styles.streakCount}>{streaks[prayer] || 0}</Text>
                  <Text style={styles.streakUnit}>days</Text>
                </View>
              ))}
            </View>

            {/* ── Month Stats Bar ───────────────────────────── */}
            <View style={styles.statsBar}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{monthStats.perfectDays}</Text>
                <Text style={styles.statLabel}>Perfect Days</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{monthStats.totalPrayers}</Text>
                <Text style={styles.statLabel}>Prayers</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{bestStreak}</Text>
                <Text style={styles.statLabel}>Best Streak</Text>
              </View>
            </View>

            {/* ── Calendar ──────────────────────────────────── */}
            <View style={styles.calendarContainer}>
              {/* Month navigation */}
              <View style={styles.monthNav}>
                <TouchableOpacity onPress={prevMonth} style={styles.monthArrow}>
                  <MaterialCommunityIcons name="chevron-left" size={28} color="#9ca3af" />
                </TouchableOpacity>
                <Text style={styles.monthTitle}>
                  {MONTH_NAMES[viewMonth]} {viewYear}
                </Text>
                <TouchableOpacity onPress={nextMonth} style={styles.monthArrow}>
                  <MaterialCommunityIcons name="chevron-right" size={28} color="#9ca3af" />
                </TouchableOpacity>
              </View>

              {/* Day-of-week headers */}
              <View style={styles.dowRow}>
                {DAYS_OF_WEEK.map(d => (
                  <Text key={d} style={[styles.dowCell, { width: cellSize }]}>{d}</Text>
                ))}
              </View>

              {/* Calendar grid */}
              <View style={styles.calGrid}>
                {calendarDays.map((date, i) => {
                  if (!date) {
                    return <View key={`empty-${i}`} style={{ width: cellSize, height: cellSize + 8 }} />;
                  }
                  const isToday = isSameDay(date, today);
                  const isFuture = date > today;
                  const completed = isFuture ? [] : getCompletedForDate(date);
                  const count = completed.length;
                  const isPerfect = count === 5;
                  const isSelected = selectedDate && isSameDay(date, selectedDate);

                  return (
                    <TouchableOpacity
                      key={`day-${date.getDate()}`}
                      onPress={() => {
                        if (!isFuture) {
                          setSelectedDate(isSelected ? null : date);
                          Haptics.selectionAsync();
                        }
                      }}
                      activeOpacity={isFuture ? 1 : 0.6}
                      style={[
                        styles.dayCell,
                        { width: cellSize, height: cellSize + 8 },
                        isSelected && styles.dayCellSelected,
                      ]}
                    >
                      <Text style={[
                        styles.dayNum,
                        isToday && styles.dayNumToday,
                        isFuture && styles.dayNumFuture,
                        isPerfect && styles.dayNumPerfect,
                      ]}>
                        {date.getDate()}
                      </Text>
                      {/* Prayer dots */}
                      {count > 0 && (
                        <View style={styles.dotsRow}>
                          {PRAYER_ORDER.map(p => (
                            <View
                              key={p}
                              style={[
                                styles.prayerDot,
                                {
                                  backgroundColor: completed.includes(p)
                                    ? PRAYER_COLORS[p]
                                    : 'rgba(107, 114, 128, 0.25)',
                                },
                              ]}
                            />
                          ))}
                        </View>
                      )}
                      {count === 0 && !isFuture && (
                        <View style={styles.dotsRow}>
                          {PRAYER_ORDER.map(p => (
                            <View
                              key={p}
                              style={[styles.prayerDot, { backgroundColor: 'rgba(107, 114, 128, 0.15)' }]}
                            />
                          ))}
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* ── Selected Day Detail ──────────────────────── */}
            {selectedDate && (
              <View style={styles.detailCard}>
                <Text style={styles.detailTitle}>
                  {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </Text>
                <Text style={styles.detailSubtitle}>
                  {selectedDayPrayers.length}/5 prayers completed
                </Text>
                <View style={styles.detailPrayers}>
                  {PRAYER_ORDER.map(prayer => {
                    const done = selectedDayPrayers.includes(prayer);
                    return (
                      <View key={prayer} style={styles.detailRow}>
                        <View style={[styles.detailDot, { backgroundColor: done ? PRAYER_COLORS[prayer] : 'rgba(107, 114, 128, 0.3)' }]} />
                        <Text style={[styles.detailPrayerName, !done && styles.detailPrayerMissed]}>
                          {prayer}
                        </Text>
                        <MaterialCommunityIcons
                          name={done ? 'check-circle' : 'close-circle-outline'}
                          size={18}
                          color={done ? '#4ade80' : '#6b7280'}
                        />
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {/* ── Legend ────────────────────────────────────── */}
            <View style={styles.legend}>
              {PRAYER_ORDER.map(p => (
                <View key={p} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: PRAYER_COLORS[p] }]} />
                  <Text style={styles.legendText}>{p}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
    </Wrapper>
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
    maxHeight: '92%',
    paddingTop: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#e8e0d6',
  },
  closeBtn: {
    padding: 4,
  },

  // Streak cards row
  streaksContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 6,
    marginBottom: 16,
  },
  streakCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  streakDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginBottom: 4,
  },
  streakLabel: {
    fontSize: 10,
    color: '#9ca3af',
    fontWeight: '600',
    marginBottom: 2,
  },
  streakCount: {
    fontSize: 20,
    fontWeight: '800',
    color: '#e8e0d6',
  },
  streakUnit: {
    fontSize: 9,
    color: '#6b7280',
    fontWeight: '500',
  },

  // Stats bar
  statsBar: {
    flexDirection: 'row',
    marginHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    paddingVertical: 14,
    marginBottom: 20,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#e8a87c',
  },
  statLabel: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '500',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },

  // Calendar
  calendarContainer: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  monthNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  monthArrow: {
    padding: 4,
  },
  monthTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#e8e0d6',
  },
  dowRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  dowCell: {
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '600',
    color: '#6b7280',
  },
  calGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
    borderRadius: 8,
  },
  dayCellSelected: {
    backgroundColor: 'rgba(232, 168, 124, 0.12)',
  },
  dayNum: {
    fontSize: 13,
    fontWeight: '600',
    color: '#d1d5db',
    marginBottom: 2,
  },
  dayNumToday: {
    color: '#e8a87c',
    fontWeight: '800',
  },
  dayNumFuture: {
    color: '#374151',
  },
  dayNumPerfect: {
    color: '#fbbf24',
    fontWeight: '800',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 2,
  },
  prayerDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },

  // Detail card
  detailCard: {
    marginHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  detailTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#e8e0d6',
    marginBottom: 2,
  },
  detailSubtitle: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 12,
  },
  detailPrayers: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  detailDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  detailPrayerName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#d1d5db',
  },
  detailPrayerMissed: {
    color: '#6b7280',
  },

  // Legend
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginHorizontal: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  legendText: {
    fontSize: 10,
    color: '#6b7280',
    fontWeight: '500',
  },
});

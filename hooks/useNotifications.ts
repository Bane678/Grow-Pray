import { useState, useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Asset } from 'expo-asset';

import { localDayKey, type PrayerDeadlines, type ComputedDay } from './usePrayerTimes';

const NOTIFICATIONS_KEY = '@GrowPray:notificationsEnabled';
const REFLECTION_REMINDER_KEY = '@GrowPray:reflectionReminder';
const REFLECTION_REMINDER_ID = 'daily-reflection';
const REFLECTION_REMINDER_HOUR = 9; // 9:00 local

// Configure how notifications are handled when the app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

type PrayerTimings = {
  Fajr: string;
  Dhuhr: string;
  Asr: string;
  Maghrib: string;
  Isha: string;
  [key: string]: string;
};

const PRAYER_ORDER = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'] as const;

// Local prayer icon assets - used as notification image attachments on iOS
const PRAYER_ICON_MODULES: Record<string, number> = {
  Fajr:    require('../assets/Garden Assets/Icons/Fajr.png'),
  Dhuhr:   require('../assets/Garden Assets/Icons/Dhuhr.png'),
  Asr:     require('../assets/Garden Assets/Icons/Asr.png'),
  Maghrib: require('../assets/Garden Assets/Icons/Maghrib.png'),
  Isha:    require('../assets/Garden Assets/Icons/Isha.png'),
};

async function getPrayerIconUri(prayer: string): Promise<string | null> {
  try {
    const mod = PRAYER_ICON_MODULES[prayer];
    if (mod == null) return null;
    const asset = Asset.fromModule(mod);
    await asset.downloadAsync();
    return asset.localUri ?? null;
  } catch {
    return null;
  }
}

// Warning before prayer deadline ends (minutes)
const DEADLINE_WARNING_MINUTES = 10;

// Fixed identifiers for decay notifications so we can cancel/replace them by ID
const DECAY_WARN_ID = 'garden-decay-warn';
const DECAY_CRITICAL_ID = 'garden-decay-critical';

// ─── Win-back ladder ─────────────────────────────────────────────────────────
//
// Prayer alerts only cover PRAYER_SCHEDULE_DAYS ahead, and the two decay alerts
// fire at 24h and 48h and then stop for good. Without this, a user who drifted
// away got nothing at all from roughly day 3 onward except the daily reflection
// reminder - the app went silent on exactly the people it most needed to reach.
//
// These are ordinary one-off dated notifications scheduled relative to *now*,
// and the whole ladder is cancelled and rebuilt every time the app opens. So
// "day 8" always means eight days after the user was last here, and the ladder
// resets itself the moment they come back. No server, no device tokens, and
// nothing about the user ever leaves the phone.
//
// Deliberately sparse - four over a month - and never accusatory. Onboarding
// promises gentle reminders and that every prayer is a fresh start, so these
// invite a return rather than tallying what was missed. Two carry an
// authenticated narration; the other two stay concrete about what is waiting.
//
// ⚠️ Any narration added here must be sahih or hasan with a real citation, the
// same bar as data/hadith.ts. Do not add anything you have not verified.
const WIN_BACK_LADDER: { days: number; title: string; body: string }[] = [
  {
    days: 4,
    title: 'Your sapling is waiting',
    body: 'One prayer brings it back to life.',
  },
  {
    days: 8,
    title: 'Your garden has gone quiet',
    body: 'Your trees are still standing. Pick up wherever you are.',
  },
  {
    days: 15,
    title: 'Small and steady is enough',
    body: '"The most beloved deeds to Allah are the most consistent, even if few." - Bukhari & Muslim',
  },
  {
    days: 30,
    title: 'The door is always open',
    body: '"Do not despair of the mercy of Allah." - Qur\'an 39:53',
  },
];

// Prayer-specific messages
const PRAYER_MESSAGES: Record<string, { title: string; body: string }> = {
  Fajr: {
    title: 'Time for Fajr',
    body: 'The early morning is a blessed time. Rise and pray.',
  },
  Dhuhr: {
    title: 'Time for Dhuhr',
    body: 'Step away for a moment and return to what matters most.',
  },
  Asr: {
    title: 'Time for Asr',
    body: 'The Prophet ﷺ warned you not to neglect this prayer. Answer the call.',
  },
  Maghrib: {
    title: 'Time for Maghrib',
    body: 'The day draws to a close. Hasten to your prayer.',
  },
  Isha: {
    title: 'Time for Isha',
    body: 'As night settles, close your day with dhikr and prayer.',
  },
};

export function useNotifications(
  timings: PrayerTimings | null,
  completedPrayers: Set<string>,
  deadlines: PrayerDeadlines | null = null,
  lastXPGainTimestamp?: number,
  hasGarden?: boolean,
  notifReady: boolean = true,
  /** Rolling window of upcoming days, so alerts stay right without the app being opened. */
  upcoming: ComputedDay[] | null = null,
) {
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<string | null>(null);
  const [reflectionReminderEnabled, setReflectionReminderEnabled] = useState(false);
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  // Request permissions once notifReady is true (i.e. after onboarding)
  useEffect(() => {
    if (!notifReady) return;

    registerForPushNotifications();
    loadNotificationPreference();
    loadReflectionReminderPreference();

    // Set up listeners for when notifications are received/tapped
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received:', notification);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification tapped:', response);
    });

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, [notifReady]);

  // Schedule prayer notifications whenever timings change or prayers are completed
  useEffect(() => {
    if (notificationsEnabled && timings) {
      schedulePrayerNotifications(timings, completedPrayers, deadlines, upcoming);
    }
  }, [timings, deadlines, completedPrayers, notificationsEnabled, upcoming]);

  // Schedule / reschedule decay notifications whenever last XP timestamp changes
  useEffect(() => {
    if (!notificationsEnabled) return;
    if (lastXPGainTimestamp && hasGarden) {
      scheduleDecayNotifications(lastXPGainTimestamp);
    } else {
      cancelDecayNotifications();
    }
  }, [lastXPGainTimestamp, hasGarden, notificationsEnabled]);

  const loadNotificationPreference = async () => {
    try {
      const stored = await AsyncStorage.getItem(NOTIFICATIONS_KEY);
      if (stored !== null) {
        setNotificationsEnabled(JSON.parse(stored));
      } else {
        // Default to enabled if permission granted
        setNotificationsEnabled(true);
      }
    } catch (error) {
      console.error('Error loading notification preference:', error);
    }
  };

  const loadReflectionReminderPreference = async () => {
    try {
      const stored = await AsyncStorage.getItem(REFLECTION_REMINDER_KEY);
      setReflectionReminderEnabled(stored !== null ? JSON.parse(stored) : false);
    } catch (error) {
      console.error('Error loading reflection reminder preference:', error);
    }
  };

  // Schedule (or cancel) one daily local reflection reminder. Reuses the existing
  // notification permission - no new prompt beyond what prayer reminders already ask.
  const scheduleReflectionReminder = async () => {
    try {
      await Notifications.cancelScheduledNotificationAsync(REFLECTION_REMINDER_ID).catch(() => {});
      await Notifications.scheduleNotificationAsync({
        identifier: REFLECTION_REMINDER_ID,
        content: {
          title: 'Reflection of the day',
          body: 'Take a moment for today\'s ayah or hadith.',
          data: { type: 'reflection' },
          sound: 'default',
          ...(Platform.OS === 'android' && { channelId: 'prayer-reminders' }),
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
          hour: REFLECTION_REMINDER_HOUR,
          minute: 0,
          repeats: true,
        },
      });
    } catch (error) {
      console.error('Error scheduling reflection reminder:', error);
    }
  };

  const toggleReflectionReminder = async (enabled: boolean) => {
    if (enabled && permissionStatus !== 'granted') {
      const granted = await registerForPushNotifications();
      if (!granted) return;
    }
    setReflectionReminderEnabled(enabled);
    await AsyncStorage.setItem(REFLECTION_REMINDER_KEY, JSON.stringify(enabled));
    if (enabled) {
      await scheduleReflectionReminder();
    } else {
      await Notifications.cancelScheduledNotificationAsync(REFLECTION_REMINDER_ID).catch(() => {});
    }
  };

  const registerForPushNotifications = async () => {
    try {
      // Check existing permission
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      // Request permission if not already granted
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      setPermissionStatus(finalStatus);

      if (finalStatus !== 'granted') {
        console.log('Notification permission not granted');
        setNotificationsEnabled(false);
        return false;
      }

      // Set up Android notification channels
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('prayer-reminders', {
          name: 'Prayer Reminders',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#4ade80',
          sound: 'default',
        });
        await Notifications.setNotificationChannelAsync('garden-decay', {
          name: 'Garden Decay Alerts',
          importance: Notifications.AndroidImportance.DEFAULT,
          lightColor: '#f59e0b',
          sound: 'default',
        });
      }

      setNotificationsEnabled(true);
      await AsyncStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(true));
      return true;
    } catch (error) {
      console.error('Error registering for notifications:', error);
      return false;
    }
  };

  const cancelDecayNotifications = async () => {
    try {
      await Notifications.cancelScheduledNotificationAsync(DECAY_WARN_ID).catch(() => {});
      await Notifications.cancelScheduledNotificationAsync(DECAY_CRITICAL_ID).catch(() => {});
    } catch (_) {}
  };

  const scheduleDecayNotifications = async (xpTimestamp: number) => {
    try {
      // Cancel existing decay notifications first
      await cancelDecayNotifications();

      const now = Date.now();
      const warnTime = xpTimestamp + 24 * 60 * 60 * 1000;  // 24h after last prayer
      const criticalTime = xpTimestamp + 48 * 60 * 60 * 1000; // 48h after last prayer

      // Only schedule if the trigger is in the future
      if (warnTime > now) {
        await Notifications.scheduleNotificationAsync({
          identifier: DECAY_WARN_ID,
          content: {
            title: 'Your garden needs care',
            body: "You haven't prayed today - your garden will start withering soon.",
            data: { type: 'decay-warning' },
            sound: 'default',
            ...(Platform.OS === 'android' && { channelId: 'garden-decay' }),
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: new Date(warnTime),
          },
        });
      }

      if (criticalTime > now) {
        await Notifications.scheduleNotificationAsync({
          identifier: DECAY_CRITICAL_ID,
          content: {
            title: 'Your garden is withering',
            body: 'A ring of tiles is dying. Pray to restore your garden.',
            data: { type: 'decay-critical' },
            sound: 'default',
            ...(Platform.OS === 'android' && { channelId: 'garden-decay' }),
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: new Date(criticalTime),
          },
        });
      }
    } catch (error) {
      console.error('Error scheduling decay notifications:', error);
    }
  };

  /**
   * Schedule one-off, individually-dated alerts for every prayer across the
   * rolling window.
   *
   * Each alarm is pinned to an absolute instant taken straight from the
   * calculation (`ComputedDay.instants`), so there is no wall-clock parsing here
   * and nothing to get wrong across DST or a timezone change.
   */
  const schedulePrayerStarts = async (
    window: ComputedDay[] | null,
    timings: PrayerTimings,
    completed: Set<string>,
  ) => {
    const now = Date.now();

    // Icons are resolved once per prayer rather than once per prayer per day -
    // the window is 50 alarms and getPrayerIconUri touches the filesystem.
    const iconUris: Record<string, string | null> = {};
    if (Platform.OS === 'ios') {
      for (const prayer of PRAYER_ORDER) {
        iconUris[prayer] = await getPrayerIconUri(prayer);
      }
    }

    const buildContent = (prayer: string) => {
      const message = PRAYER_MESSAGES[prayer];
      const iconUri = iconUris[prayer];
      return {
        title: message.title,
        body: message.body,
        sound: 'default' as const,
        ...(iconUri && { attachments: [{ identifier: prayer, url: iconUri, type: null }] }),
        ...(Platform.OS === 'android' && { channelId: 'prayer-reminders' }),
      };
    };

    if (!window || window.length === 0) {
      // No window available (calculation failed). Fall back to today only, from
      // the wall-clock strings, so the user still gets today's alerts.
      for (const prayer of PRAYER_ORDER) {
        const timeStr = timings[prayer];
        if (!timeStr) continue;
        if (completed.has(prayer)) continue;
        const [h, m] = timeStr.split(':').map(Number);
        const date = new Date();
        date.setHours(h, m, 0, 0);
        if (date.getTime() <= now) continue;
        await Notifications.scheduleNotificationAsync({
          identifier: `prayer-start-${prayer}-today`,
          content: { ...buildContent(prayer), data: { prayer, type: 'start' } },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date },
        });
      }
      return;
    }

    let count = 0;
    for (let d = 0; d < window.length; d++) {
      const day = window[d];
      for (const prayer of PRAYER_ORDER) {
        const at = day.instants[prayer];
        if (!at || isNaN(at.getTime())) continue;
        // Already passed - nothing to schedule.
        if (at.getTime() <= now) continue;
        // Don't nag about a prayer already marked done today.
        if (d === 0 && completed.has(prayer)) continue;

        await Notifications.scheduleNotificationAsync({
          identifier: `prayer-start-${prayer}-${day.dayKey}`,
          content: {
            ...buildContent(prayer),
            // dayKey lets cancelPrayerNotification target just today's alert
            // instead of wiping the whole future window.
            data: { prayer, type: 'start', dayKey: day.dayKey },
          },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at },
        });
        count++;
      }
    }
    console.log(`Scheduled ${count} prayer alerts across ${window.length} days`);
  };

  /**
   * (Re)book the win-back ladder from this moment.
   *
   * Called on every scheduling pass, and the pass cancels all non-decay
   * notifications first, so the effect is that every app open pushes the whole
   * ladder back out to its full length. A user who opens the app daily never
   * reaches even the first rung.
   */
  const scheduleWinBack = async () => {
    const now = Date.now();
    for (const rung of WIN_BACK_LADDER) {
      try {
        await Notifications.scheduleNotificationAsync({
          identifier: `winback-${rung.days}`,
          content: {
            title: rung.title,
            body: rung.body,
            data: { type: 'winback', days: rung.days },
            sound: 'default',
            // Re-engagement, not a time-critical call to prayer - kept on the
            // lower-importance channel so it can never feel like an adhan alert.
            ...(Platform.OS === 'android' && { channelId: 'garden-decay' }),
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: new Date(now + rung.days * 24 * 60 * 60 * 1000),
          },
        });
      } catch (error) {
        console.error(`Failed to schedule win-back day ${rung.days}:`, error);
      }
    }
  };

  const schedulePrayerNotifications = async (
    timings: PrayerTimings,
    completed: Set<string>,
    dl: PrayerDeadlines | null,
    window: ComputedDay[] | null = null,
  ) => {
    try {
      // Cancel only prayer-type notifications (leave decay notifications intact)
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      await Promise.all(
        scheduled
          .filter(n => n.content.data?.type !== 'decay-warning' && n.content.data?.type !== 'decay-critical')
          .map(n => Notifications.cancelScheduledNotificationAsync(n.identifier))
      );

      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      // ── Prayer start alerts ────────────────────────────────────────────────
      //
      // Scheduled as individually-dated one-off alarms across a rolling window,
      // NOT as a daily repeating trigger. A repeating trigger fires at one fixed
      // wall-clock time forever, but prayer times move: Maghrib and Isha drift
      // ~2 min/day, so a repeating alarm set once is ~13 min wrong after a week
      // and a full hour wrong after a month. It only ever got corrected when the
      // user happened to open the app, which is exactly what users don't do.
      //
      // The window is refreshed on every launch, so in practice it is topped back
      // up to its full length long before it runs out.
      await schedulePrayerStarts(window, timings, completed);

      // Covers the stretch beyond the prayer window, where the app would
      // otherwise say nothing at all.
      await scheduleWinBack();

      for (let i = 0; i < PRAYER_ORDER.length; i++) {
        const prayer = PRAYER_ORDER[i];

        const timeStr = timings[prayer];
        if (!timeStr) continue;

        const [hours, minutes] = timeStr.split(':').map(Number);
        const prayerStartMinutes = hours * 60 + minutes;

        // Use explicit deadlines if available, otherwise derive
        let prayerEndMinutes: number;
        if (dl && dl[prayer as keyof PrayerDeadlines]) {
          const dlStr = dl[prayer as keyof PrayerDeadlines];
          const [dlH, dlM] = dlStr.split(':').map(Number);
          prayerEndMinutes = dlH * 60 + dlM;
          if (prayer === 'Isha' && prayerEndMinutes < prayerStartMinutes) {
            prayerEndMinutes += 24 * 60;
          }
        } else {
          if (prayer === 'Fajr') {
            const sunriseStr = timings['Sunrise'];
            if (sunriseStr) {
              const [sunH, sunM] = sunriseStr.split(':').map(Number);
              prayerEndMinutes = sunH * 60 + sunM;
            } else {
              prayerEndMinutes = prayerStartMinutes + 90;
            }
          } else if (i < PRAYER_ORDER.length - 1) {
            const nextPrayer = PRAYER_ORDER[i + 1];
            const nextTimeStr = timings[nextPrayer];
            if (nextTimeStr) {
              const [nextHours, nextMins] = nextTimeStr.split(':').map(Number);
              prayerEndMinutes = nextHours * 60 + nextMins;
            } else {
              prayerEndMinutes = prayerStartMinutes + 120;
            }
          } else {
            const fajrTimeStr = timings['Fajr'];
            if (fajrTimeStr) {
              const [fajrHours, fajrMins] = fajrTimeStr.split(':').map(Number);
              prayerEndMinutes = 24 * 60 + fajrHours * 60 + fajrMins;
            } else {
              prayerEndMinutes = prayerStartMinutes + 180;
            }
          }
        }

        // Deadline warning - today only (time-sensitive, not repeating)
        const warningMinutes = prayerEndMinutes - DEADLINE_WARNING_MINUTES;
        if (warningMinutes > currentMinutes && warningMinutes < 24 * 60) {
          const warningHours = Math.floor(warningMinutes / 60);
          const warningMins = warningMinutes % 60;
          const warningDate = new Date();
          warningDate.setHours(warningHours, warningMins, 0, 0);

          await Notifications.scheduleNotificationAsync({
            identifier: `prayer-deadline-${prayer}`,
            content: {
              title: `${DEADLINE_WARNING_MINUTES} min left for ${prayer}`,
              body: `Don't break your streak - complete ${prayer} now!`,
              data: { prayer, type: 'deadline-warning' },
              sound: 'default',
              ...(Platform.OS === 'android' && { channelId: 'prayer-reminders' }),
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: warningDate,
            },
          });

          console.log(`Scheduled deadline warning for ${prayer} at ${warningHours}:${warningMins.toString().padStart(2, '0')}`);
        }
      }
    } catch (error) {
      console.error('Error scheduling notifications:', error);
    }
  };

  const toggleNotifications = async (enabled: boolean) => {    if (enabled && permissionStatus !== 'granted') {
      const granted = await registerForPushNotifications();
      if (!granted) return;
    }

    setNotificationsEnabled(enabled);
    await AsyncStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(enabled));

    if (!enabled) {
      // Cancel all scheduled notifications when disabled
      await Notifications.cancelAllScheduledNotificationsAsync();
    } else if (timings) {
      // Re-schedule when enabled
      await schedulePrayerNotifications(timings, completedPrayers, deadlines, upcoming);
    }
  };

  // Cancel notification for a specific prayer (call when prayer is completed)
  const cancelPrayerNotification = async (prayer: string) => {
    try {
      // Only today's alert. Prayer alerts are now scheduled across a rolling
      // window of future days, so matching on the prayer name alone would wipe
      // the next ten days of that prayer the moment the user ticked it off once.
      const todayKey = localDayKey(new Date());
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      for (const notification of scheduled) {
        const data = notification.content.data;
        if (data?.prayer !== prayer) continue;
        // Deadline warnings and the today-only fallback carry no dayKey; both are
        // for today by construction, so cancelling them here is correct.
        if (data?.dayKey && data.dayKey !== todayKey) continue;
        await Notifications.cancelScheduledNotificationAsync(notification.identifier);
        console.log(`Cancelled today's notification for ${prayer}`);
      }
    } catch (error) {
      console.error('Error cancelling notification:', error);
    }
  };

  // Test function to send notifications immediately (for testing only)
  const sendTestNotifications = async () => {
    try {
      // Test prayer start notification (fires in 5 seconds)
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Fajr has begun',
          body: 'Rise and shine! Time for your morning prayer.',
          data: { prayer: 'Fajr', type: 'start' },
          sound: 'default',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: 5,
        },
      });

      // Test deadline warning notification (fires in 10 seconds)
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '10 min left for Dhuhr',
          body: 'Don\'t break your streak - complete Dhuhr now!',
          data: { prayer: 'Dhuhr', type: 'deadline-warning' },
          sound: 'default',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: 10,
        },
      });

      console.log('Test notifications scheduled: Prayer start in 5s, Deadline warning in 10s');
    } catch (error) {
      console.error('Error sending test notifications:', error);
    }
  };

  return {
    notificationsEnabled,
    permissionStatus,
    toggleNotifications,
    cancelPrayerNotification,
    requestPermission: registerForPushNotifications,
    sendTestNotifications,
    reflectionReminderEnabled,
    toggleReflectionReminder,
  };
}

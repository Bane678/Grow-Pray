import { useState, useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const NOTIFICATIONS_KEY = '@GrowPray:notificationsEnabled';

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

// Grace period in minutes (must match App.tsx)
const GRACE_PERIOD_MINUTES = 30;
// Warning before grace period ends
const GRACE_WARNING_MINUTES = 10;

// Prayer-specific messages
const PRAYER_MESSAGES: Record<string, { title: string; body: string }> = {
  Fajr: {
    title: 'Fajr has begun',
    body: 'Rise and shine! Time for your morning prayer.',
  },
  Dhuhr: {
    title: 'Dhuhr has begun',
    body: 'Time for your midday prayer.',
  },
  Asr: {
    title: 'Asr has begun',
    body: 'Take a break for your afternoon prayer.',
  },
  Maghrib: {
    title: 'Maghrib has begun',
    body: 'The sun has set. Time for Maghrib prayer.',
  },
  Isha: {
    title: 'Isha has begun',
    body: 'Time for your night prayer.',
  },
};

export function useNotifications(
  timings: PrayerTimings | null,
  completedPrayers: Set<string>
) {
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<string | null>(null);
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  // Request permissions on mount
  useEffect(() => {
    registerForPushNotifications();
    loadNotificationPreference();

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
  }, []);

  // Schedule notifications whenever timings change or prayers are completed
  useEffect(() => {
    if (notificationsEnabled && timings) {
      schedulePrayerNotifications(timings, completedPrayers);
    }
  }, [timings, completedPrayers, notificationsEnabled]);

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

      // Set up Android notification channel
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('prayer-reminders', {
          name: 'Prayer Reminders',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#4ade80',
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

  const schedulePrayerNotifications = async (
    timings: PrayerTimings,
    completed: Set<string>
  ) => {
    try {
      // Cancel all existing prayer notifications first
      await Notifications.cancelAllScheduledNotificationsAsync();

      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      for (let i = 0; i < PRAYER_ORDER.length; i++) {
        const prayer = PRAYER_ORDER[i];
        
        // Skip if prayer is already completed
        if (completed.has(prayer)) {
          continue;
        }

        const timeStr = timings[prayer];
        if (!timeStr) continue;

        const [hours, minutes] = timeStr.split(':').map(Number);
        const prayerStartMinutes = hours * 60 + minutes;

        // Calculate when prayer window ends (when next prayer starts)
        let prayerEndMinutes: number;
        if (i < PRAYER_ORDER.length - 1) {
          // Next prayer start time
          const nextPrayer = PRAYER_ORDER[i + 1];
          const nextTimeStr = timings[nextPrayer];
          if (nextTimeStr) {
            const [nextHours, nextMins] = nextTimeStr.split(':').map(Number);
            prayerEndMinutes = nextHours * 60 + nextMins;
          } else {
            prayerEndMinutes = prayerStartMinutes + 120; // Default 2 hours
          }
        } else {
          // Isha ends at Fajr next day
          const fajrTimeStr = timings['Fajr'];
          if (fajrTimeStr) {
            const [fajrHours, fajrMins] = fajrTimeStr.split(':').map(Number);
            prayerEndMinutes = 24 * 60 + fajrHours * 60 + fajrMins; // Next day
          } else {
            prayerEndMinutes = prayerStartMinutes + 180; // Default 3 hours
          }
        }

        // Calculate grace period end time
        const graceEndMinutes = prayerEndMinutes + GRACE_PERIOD_MINUTES;
        // Warning time is 10 minutes before grace ends
        const warningMinutes = graceEndMinutes - GRACE_WARNING_MINUTES;

        // Schedule prayer start notification (if prayer time hasn't passed)
        if (prayerStartMinutes > currentMinutes) {
          const triggerDate = new Date();
          triggerDate.setHours(hours, minutes, 0, 0);

          const message = PRAYER_MESSAGES[prayer];
          
          await Notifications.scheduleNotificationAsync({
            content: {
              title: message.title,
              body: message.body,
              data: { prayer, type: 'start' },
              sound: 'default',
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: triggerDate,
            },
          });

          console.log(`Scheduled start notification for ${prayer} at ${timeStr}`);
        }

        // Schedule grace period warning notification (10 min before grace ends)
        if (warningMinutes > currentMinutes && warningMinutes < 24 * 60) {
          const warningHours = Math.floor(warningMinutes / 60);
          const warningMins = warningMinutes % 60;
          
          const warningDate = new Date();
          warningDate.setHours(warningHours, warningMins, 0, 0);

          await Notifications.scheduleNotificationAsync({
            content: {
              title: `${GRACE_WARNING_MINUTES} min left for ${prayer}`,
              body: `Don't break your streak - complete ${prayer} now!`,
              data: { prayer, type: 'grace-warning' },
              sound: 'default',
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: warningDate,
            },
          });

          console.log(`Scheduled grace warning for ${prayer} at ${warningHours}:${warningMins.toString().padStart(2, '0')}`);
        }
      }
    } catch (error) {
      console.error('Error scheduling notifications:', error);
    }
  };

  const toggleNotifications = async (enabled: boolean) => {
    if (enabled && permissionStatus !== 'granted') {
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
      await schedulePrayerNotifications(timings, completedPrayers);
    }
  };

  // Cancel notification for a specific prayer (call when prayer is completed)
  const cancelPrayerNotification = async (prayer: string) => {
    try {
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      for (const notification of scheduled) {
        if (notification.content.data?.prayer === prayer) {
          await Notifications.cancelScheduledNotificationAsync(notification.identifier);
          console.log(`Cancelled notification for ${prayer}`);
        }
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

      // Test grace warning notification (fires in 10 seconds)
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '10 min left for Dhuhr',
          body: 'Don\'t break your streak - complete Dhuhr now!',
          data: { prayer: 'Dhuhr', type: 'grace-warning' },
          sound: 'default',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: 10,
        },
      });

      console.log('Test notifications scheduled: Prayer start in 5s, Grace warning in 10s');
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
  };
}

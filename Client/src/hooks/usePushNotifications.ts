/**
 * usePushNotifications
 *
 * ─── Setup required ───────────────────────────────────────────────────────────
 * This hook requires expo-notifications. Install it first:
 *
 *   npx expo install expo-notifications expo-device
 *
 * For production FCM delivery, the server already has firebase-admin.
 * The client only needs to obtain the Expo push token and send it to the server.
 *
 * Server endpoint expected:
 *   POST /users/push-token  { token: string }
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Platform } from 'react-native';

import { api } from '../api/axios';
import { useAuthStore } from '../store/auth.store';

// ─── Conditional import — graceful fallback if not installed ──────────────────
let Notifications: typeof import('expo-notifications') | null = null;
let Device: typeof import('expo-device') | null = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Notifications = require('expo-notifications');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Device = require('expo-device');
} catch {
  console.warn(
    '[usePushNotifications] expo-notifications or expo-device is not installed.\n' +
      'Run: npx expo install expo-notifications expo-device',
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PushNotificationData {
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
}

interface UsePushNotificationsReturn {
  /** The Expo push token (null until registered) */
  expoPushToken: string | null;
  /** Last received notification while app was foregrounded */
  lastNotification: PushNotificationData | null;
  /** Last notification the user tapped on */
  lastNotificationResponse: PushNotificationData | null;
  /** Whether notifications are enabled */
  permissionGranted: boolean;
  /** Register for push notifications (called automatically when authenticated) */
  register: () => Promise<string | null>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function usePushNotifications(): UsePushNotificationsReturn {
  const { isAuthenticated } = useAuthStore();

  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [lastNotification, setLastNotification] =
    useState<PushNotificationData | null>(null);
  const [lastNotificationResponse, setLastNotificationResponse] =
    useState<PushNotificationData | null>(null);

  const notificationListenerRef = useRef<unknown>(null);
  const responseListenerRef = useRef<unknown>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // ── Configure foreground notification behaviour ─────────────────────────────

  useEffect(() => {
    if (!Notifications) return;

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
  }, []);

  // ── Register device & obtain Expo push token ────────────────────────────────

  const register = useCallback(async (): Promise<string | null> => {
    if (!Notifications || !Device) {
      console.warn('[usePushNotifications] expo-notifications not installed');
      return null;
    }

    // Physical device check (simulators can't receive push notifications)
    if (!Device.isDevice) {
      console.warn('[usePushNotifications] Push notifications require a physical device');
      return null;
    }

    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        if (isMountedRef.current) setPermissionGranted(false);
        console.warn('[usePushNotifications] Permission denied');
        return null;
      }

      if (isMountedRef.current) setPermissionGranted(true);

      // Android requires a notification channel
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
        });
      }

      const tokenData = await Notifications.getExpoPushTokenAsync();
      const token = tokenData.data;

      if (isMountedRef.current) setExpoPushToken(token);

      // Send token to server so it can target this device
      await api.post('/users/push-token', { token });

      return token;
    } catch (err) {
      console.error('[usePushNotifications] Registration error:', err);
      return null;
    }
  }, []);

  // ── Auto-register when authenticated ───────────────────────────────────────

  useEffect(() => {
    if (isAuthenticated) {
      register();
    }
  }, [isAuthenticated, register]);

  // ── Notification listeners ──────────────────────────────────────────────────

  useEffect(() => {
    if (!Notifications) return;

    // Foreground notification received
    notificationListenerRef.current =
      Notifications.addNotificationReceivedListener((notification) => {
        if (!isMountedRef.current) return;
        setLastNotification({
          title: notification.request.content.title ?? undefined,
          body: notification.request.content.body ?? undefined,
          data: (notification.request.content.data as Record<string, unknown>) ?? {},
        });
      });

    // User tapped a notification
    responseListenerRef.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        if (!isMountedRef.current) return;
        const content = response.notification.request.content;
        setLastNotificationResponse({
          title: content.title ?? undefined,
          body: content.body ?? undefined,
          data: (content.data as Record<string, unknown>) ?? {},
        });
      });

    return () => {
      if (Notifications) {
        if (notificationListenerRef.current) {
          Notifications.removeNotificationSubscription(
            notificationListenerRef.current as ReturnType<
              typeof Notifications.addNotificationReceivedListener
            >,
          );
        }
        if (responseListenerRef.current) {
          Notifications.removeNotificationSubscription(
            responseListenerRef.current as ReturnType<
              typeof Notifications.addNotificationResponseReceivedListener
            >,
          );
        }
      }
    };
  }, []);

  return {
    expoPushToken,
    lastNotification,
    lastNotificationResponse,
    permissionGranted,
    register,
  };
}

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { supabase } from './supabase.js';

/**
 * Firebase Cloud Messaging (FCM Web Push) Service
 * Centralized for BMC and Police Authority dashboards.
 */

// Load Firebase credentials from Vite environment
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
};

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || '';

let firebaseApp = null;
let messagingInstance = null;
let messagingSupported = null;

/**
 * Check if Firebase is configured with required keys
 */
export function isFirebaseConfigured() {
  return Boolean(
    firebaseConfig.apiKey &&
    firebaseConfig.projectId &&
    firebaseConfig.messagingSenderId &&
    firebaseConfig.appId
  );
}

/**
 * Get or initialize the Firebase App instance
 */
function getFirebaseAppInstance() {
  if (firebaseApp) return firebaseApp;

  if (getApps().length > 0) {
    firebaseApp = getApp();
    return firebaseApp;
  }

  if (!isFirebaseConfigured()) {
    console.info(
      '[FCM] Firebase credentials not fully provided in .env. FCM Web Push will operate in simulated/in-app mode.'
    );
    return null;
  }

  try {
    firebaseApp = initializeApp(firebaseConfig);
    return firebaseApp;
  } catch (err) {
    console.error('[FCM] Error initializing Firebase app:', err);
    return null;
  }
}

/**
 * Check whether FCM Web Push is supported in current environment
 */
export async function checkMessagingSupport() {
  if (messagingSupported !== null) return messagingSupported;

  try {
    if (
      typeof window === 'undefined' ||
      !('serviceWorker' in navigator) ||
      !('Notification' in window)
    ) {
      messagingSupported = false;
      return false;
    }

    const supported = await isSupported();
    messagingSupported = Boolean(supported);
    return messagingSupported;
  } catch (err) {
    console.warn('[FCM] isSupported check failed:', err);
    messagingSupported = false;
    return false;
  }
}

/**
 * Get Firebase Messaging instance
 */
async function getMessagingInstance() {
  if (messagingInstance) return messagingInstance;

  const supported = await checkMessagingSupport();
  if (!supported) return null;

  const app = getFirebaseAppInstance();
  if (!app) return null;

  try {
    messagingInstance = getMessaging(app);
    return messagingInstance;
  } catch (err) {
    console.error('[FCM] Error obtaining messaging instance:', err);
    return null;
  }
}

/**
 * Get current browser notification permission status
 */
export function getNotificationPermissionStatus() {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission; // 'default' | 'granted' | 'denied'
}

/**
 * Request Notification Permission and register FCM device token
 *
 * @param {Object} authority - Authority profile object ({ id, department, jurisdiction })
 * @returns {Promise<{ success: boolean, token?: string, permission: string, error?: string }>}
 */
export async function requestNotificationPermission(authority) {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return { success: false, permission: 'unsupported', error: 'Notifications not supported' };
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { success: false, permission, error: 'Permission denied by user' };
    }

    // Register service worker with config parameters
    let swRegistration = null;
    if ('serviceWorker' in navigator) {
      const swUrl = isFirebaseConfigured()
        ? `/firebase-messaging-sw.js?apiKey=${encodeURIComponent(firebaseConfig.apiKey)}&projectId=${encodeURIComponent(firebaseConfig.projectId)}&messagingSenderId=${encodeURIComponent(firebaseConfig.messagingSenderId)}&appId=${encodeURIComponent(firebaseConfig.appId)}`
        : '/firebase-messaging-sw.js';

      swRegistration = await navigator.serviceWorker.register(swUrl, { scope: '/' });
      console.log('[FCM] Service worker registered with scope:', swRegistration.scope);
    }

    const messaging = await getMessagingInstance();
    if (!messaging) {
      return {
        success: true,
        permission: 'granted',
        token: null,
        simulated: true,
        note: 'Notifications granted. In-app Realtime dispatch active (configure Firebase keys for background FCM Web Push).',
      };
    }

    const tokenOptions = {
      serviceWorkerRegistration: swRegistration,
    };
    if (VAPID_KEY) {
      tokenOptions.vapidKey = VAPID_KEY;
    }

    const currentToken = await getToken(messaging, tokenOptions);
    if (!currentToken) {
      return { success: false, permission, error: 'Failed to retrieve FCM device token' };
    }

    // Store token in Supabase authority_device_tokens table
    if (authority?.id) {
      await saveAuthorityDeviceToken(authority, currentToken);
    }

    return { success: true, permission, token: currentToken };
  } catch (err) {
    console.error('[FCM] Error in requestNotificationPermission:', err);
    return {
      success: false,
      permission: Notification.permission || 'default',
      error: err.message,
    };
  }
}

/**
 * Persist device token into public.authority_device_tokens
 */
export async function saveAuthorityDeviceToken(authority, fcmToken) {
  if (!authority?.id || !fcmToken) return;

  try {
    const { error } = await supabase.from('authority_device_tokens').upsert(
      {
        authority_id: authority.id,
        fcm_token: fcmToken,
        platform: 'web',
        department: authority.department ? authority.department.toUpperCase() : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'fcm_token' }
    );

    if (error) {
      console.warn('[FCM] Error recording device token to database:', error.message);
    } else {
      console.log('[FCM] Device token registered successfully for authority:', authority.id);
    }
  } catch (err) {
    console.error('[FCM] Unexpected error storing device token:', err);
  }
}

/**
 * Listen for foreground FCM messages while dashboard is active
 *
 * @param {Function} callback - Callback invoked when a foreground push is received
 * @returns {Function} Unsubscribe handler
 */
export function listenToForegroundMessages(callback) {
  let unsubscribe = () => {};

  getMessagingInstance().then((messaging) => {
    if (!messaging) return;

    try {
      unsubscribe = onMessage(messaging, (payload) => {
        console.log('[FCM] Foreground push message received:', payload);
        if (typeof callback === 'function') {
          callback(payload);
        }

        // Show browser notification if permission is granted
        if (Notification.permission === 'granted') {
          const title = payload.notification?.title || payload.data?.title || 'UniSafe Operational Alert';
          const body = payload.notification?.body || payload.data?.body || 'New operational update.';
          new Notification(title, {
            body,
            icon: '/favicon.svg',
            data: payload.data || {},
          });
        }
      });
    } catch (err) {
      console.warn('[FCM] Could not attach foreground message listener:', err);
    }
  });

  return () => {
    if (typeof unsubscribe === 'function') {
      unsubscribe();
    }
  };
}

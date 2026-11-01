import { supabase } from './supabase.js';

/**
 * UniSafe Centralized Authority Notification Service
 * Shared by BMC and Police Authority dashboards.
 *
 * Provides:
 * - Real-time in-app notification queries & mutations via Supabase
 * - Realtime subscriptions for instant live updates
 * - Dispatching and recording new notifications for civic complaints,
 *   verification disputes, and missing person sightings.
 */

export const NOTIFICATION_TYPES = {
  NEW_COMPLAINT: 'NEW_COMPLAINT',
  VERIFICATION_DISPUTED: 'VERIFICATION_DISPUTED',
  NEW_SIGHTING: 'NEW_SIGHTING',
  STATUS_UPDATE: 'STATUS_UPDATE',
  CRITICAL_ALERT: 'CRITICAL_ALERT',
};

/**
 * Fetch notifications for an authenticated authority
 *
 * @param {string} authorityId - UUID of the authority
 * @param {Object} options
 * @param {boolean} [options.unreadOnly=false]
 * @param {number} [options.limit=50]
 */
export async function fetchAuthorityNotifications(
  authorityId,
  { unreadOnly = false, limit = 50 } = {}
) {
  if (!authorityId || typeof authorityId !== 'string') {
    return [];
  }

  try {
    let query = supabase
      .from('notifications')
      .select('*')
      .eq('authority_id', authorityId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (unreadOnly) {
      query = query.eq('is_read', false);
    }

    const { data, error } = await query;
    if (error) {
      console.warn('[NotificationService] Fetch notifications error:', error.message);
      return [];
    }

    return (data || []).map((notif) => {
      const type = notif.notification_type || determineTypeFromTitle(notif.title);
      return {
        ...notif,
        notification_type: type,
        priority: determinePriority(type, notif.title),
        metadata: typeof notif.metadata === 'object' && notif.metadata !== null ? notif.metadata : {},
      };
    });
  } catch (err) {
    console.error('[NotificationService] Unexpected error fetching notifications:', err);
    return [];
  }
}

/**
 * Mark a single notification as read
 */
export async function markNotificationAsRead(notificationId) {
  if (!notificationId) return;
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId);
    if (error) console.warn('[NotificationService] markNotificationAsRead error:', error.message);
  } catch (err) {
    console.error('[NotificationService] Error marking notification as read:', err);
  }
}

/**
 * Mark all notifications for an authority as read
 */
export async function markAllNotificationsAsRead(authorityId) {
  if (!authorityId) return;
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('authority_id', authorityId)
      .eq('is_read', false);
    if (error) console.warn('[NotificationService] markAllNotificationsAsRead error:', error.message);
  } catch (err) {
    console.error('[NotificationService] Error marking all notifications as read:', err);
  }
}

/**
 * Subscribe to real-time notification events for this authority
 *
 * @param {string} authorityId
 * @param {Function} onNewNotification - Callback invoked on new notification
 * @returns {Function} Unsubscribe function
 */
export function subscribeToAuthorityNotifications(authorityId, onNewNotification) {
  const safeId = typeof authorityId === 'string' ? authorityId : (authorityId?.id || '');
  if (!safeId || typeof safeId !== 'string') return () => {};

  try {
    const channelName = `authority-notifications-${safeId.slice(0, 8)}-${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `authority_id=eq.${safeId}`,
        },
        (payload) => {
          try {
            const raw = payload?.new;
            if (!raw) return;
            const type = raw.notification_type || determineTypeFromTitle(raw.title);
            const enriched = {
              ...raw,
              notification_type: type,
              priority: determinePriority(type, raw.title),
              metadata: typeof raw.metadata === 'object' && raw.metadata !== null ? raw.metadata : {},
            };
            if (typeof onNewNotification === 'function') {
              onNewNotification(enriched);
            }
          } catch (e) {
            console.warn('[NotificationService] Callback error:', e);
          }
        }
      )
      .subscribe();

    return () => {
      try {
        supabase.removeChannel(channel);
      } catch (e) {
        // ignore
      }
    };
  } catch (err) {
    console.warn('[NotificationService] Subscription error:', err);
    return () => {};
  }
}

/**
 * Create and dispatch a new notification
 */
export async function createAuthorityNotification({
  authorityId,
  title,
  body,
  department = 'BMC',
  notificationType = 'NEW_COMPLAINT',
  referenceId = null,
  referenceType = 'complaint',
  metadata = {},
}) {
  if (!authorityId || !title) return null;

  try {
    // 1. Try atomic database RPC
    const { data: rpcId, error: rpcError } = await supabase.rpc(
      'create_authority_notification',
      {
        p_authority_id: authorityId,
        p_title: title,
        p_body: body,
        p_department: department.toUpperCase(),
        p_notification_type: notificationType,
        p_reference_id: referenceId ? String(referenceId) : null,
        p_reference_type: referenceType,
        p_metadata: metadata,
      }
    );

    if (!rpcError && rpcId) {
      return rpcId;
    }

    // 2. Direct table fallback if RPC is not present
    const { data: directData, error: directError } = await supabase
      .from('notifications')
      .insert({
        authority_id: authorityId,
        title,
        body,
        department: department.toUpperCase(),
        notification_type: notificationType,
        reference_id: referenceId ? String(referenceId) : null,
        reference_type: referenceType,
        metadata,
        is_read: false,
      })
      .select('id')
      .maybeSingle();

    if (directError) {
      console.warn('[NotificationService] Direct insert failed:', directError.message);
      return null;
    }

    return directData?.id || null;
  } catch (err) {
    console.error('[NotificationService] Error creating notification:', err);
    return null;
  }
}

/**
 * Helper: Classify priority from type and title
 */
function determinePriority(type, title = '') {
  const t = (type || '').toUpperCase();
  const lowerTitle = (title || '').toLowerCase();

  if (t === NOTIFICATION_TYPES.VERIFICATION_DISPUTED || lowerTitle.includes('failed') || lowerTitle.includes('critical')) {
    return 'CRITICAL';
  }
  if (t === NOTIFICATION_TYPES.NEW_SIGHTING) {
    return 'HIGH';
  }
  if (t === NOTIFICATION_TYPES.NEW_COMPLAINT) {
    return 'NORMAL';
  }
  return 'NORMAL';
}

/**
 * Helper: Deduce type from title string if column was empty
 */
function determineTypeFromTitle(title = '') {
  const lt = (title || '').toLowerCase();
  if (lt.includes('sighting')) return NOTIFICATION_TYPES.NEW_SIGHTING;
  if (lt.includes('verification') || lt.includes('dispute') || lt.includes('failed')) {
    return NOTIFICATION_TYPES.VERIFICATION_DISPUTED;
  }
  if (lt.includes('new civic') || lt.includes('complaint') || lt.includes('assigned')) {
    return NOTIFICATION_TYPES.NEW_COMPLAINT;
  }
  return NOTIFICATION_TYPES.STATUS_UPDATE;
}

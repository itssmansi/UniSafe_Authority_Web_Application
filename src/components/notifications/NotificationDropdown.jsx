import React, { useState, useEffect, useRef } from 'react';
import {
  Bell,
  CheckCheck,
  AlertTriangle,
  ShieldAlert,
  Eye,
  CheckCircle2,
  MapPin,
  Clock,
  Sparkles,
  Radio,
  ExternalLink,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  fetchAuthorityNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  subscribeToAuthorityNotifications,
  NOTIFICATION_TYPES,
} from '../../services/notificationService';
import {
  requestNotificationPermission,
  getNotificationPermissionStatus,
  listenToForegroundMessages,
} from '../../services/firebaseMessaging';

/**
 * Play a gentle two-tone chime via Web Audio API when a new alert arrives in real time
 */
function playNotificationChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12); // A5

    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.28);
  } catch (err) {
    // Non-blocking fallback if browser policy restricts audio context
  }
}

/**
 * Format timestamp into relative human-readable label
 */
function formatTimeAgo(dateString) {
  if (!dateString) return 'recently';
  const date = new Date(dateString);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
}

export default function NotificationDropdown({
  authority,
  onSelectComplaint,
  onSelectSighting,
  onSelectCase,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all'); // 'all' | 'unread'
  const [pushStatus, setPushStatus] = useState(getNotificationPermissionStatus());
  const [isRequestingPush, setIsRequestingPush] = useState(false);
  const dropdownRef = useRef(null);

  const isBmc = (authority?.department || '').trim().toUpperCase() === 'BMC';
  const isPolice = (authority?.department || '').trim().toUpperCase() === 'POLICE';

  // Load existing notifications
  const loadNotifications = async () => {
    if (!authority?.id) return;
    setLoading(true);
    try {
      const data = await fetchAuthorityNotifications(authority.id, { limit: 40 });
      setNotifications(data || []);
    } catch (err) {
      console.error('[NotificationDropdown] Failed loading notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authority?.id) return;
    loadNotifications();

    // Subscribe to Supabase Realtime changes
    const unsubscribeRealtime = subscribeToAuthorityNotifications(
      authority.id,
      (newNotif) => {
        setNotifications((prev) => {
          // Avoid duplicate entry
          if (prev.some((n) => n.id === newNotif.id)) return prev;
          return [newNotif, ...prev];
        });
        playNotificationChime();
      }
    );

    // Subscribe to Firebase foreground messages
    const unsubscribeFcm = listenToForegroundMessages((payload) => {
      loadNotifications();
      playNotificationChime();
    });

    return () => {
      unsubscribeRealtime();
      unsubscribeFcm();
    };
  }, [authority?.id]);

  // Close dropdown on outside click or escape
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const filteredNotifications =
    filter === 'unread' ? notifications.filter((n) => !n.is_read) : notifications;

  const handleMarkAllRead = async () => {
    if (!authority?.id) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    await markAllNotificationsAsRead(authority.id);
  };

  const handleNotificationClick = async (notif) => {
    if (!notif.is_read) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n))
      );
      markNotificationAsRead(notif.id);
    }

    setIsOpen(false);

    // Route / select according to reference
    const refType = notif.reference_type || '';
    const refId = notif.reference_id || notif.metadata?.complaint_id || notif.metadata?.sighting_id;

    if (refType === 'complaint' || notif.notification_type === NOTIFICATION_TYPES.NEW_COMPLAINT || notif.notification_type === NOTIFICATION_TYPES.VERIFICATION_DISPUTED) {
      if (typeof onSelectComplaint === 'function') {
        onSelectComplaint(refId || notif.metadata);
      }
    } else if (refType === 'sighting' || notif.notification_type === NOTIFICATION_TYPES.NEW_SIGHTING) {
      if (typeof onSelectSighting === 'function') {
        onSelectSighting(refId || notif.metadata?.sighting_id);
      }
    } else if (refType === 'case' && typeof onSelectCase === 'function') {
      onSelectCase(refId || notif.metadata?.missing_person_id);
    }
  };

  const handleEnablePush = async () => {
    setIsRequestingPush(true);
    try {
      const res = await requestNotificationPermission(authority);
      setPushStatus(res.permission);
      if (res.success) {
        console.log('[NotificationDropdown] Browser push notifications enabled.');
      }
    } catch (err) {
      console.warn('[NotificationDropdown] Push permission error:', err);
    } finally {
      setIsRequestingPush(false);
    }
  };

  const renderNotificationIcon = (notif) => {
    const type = notif.notification_type || '';
    if (type === NOTIFICATION_TYPES.VERIFICATION_DISPUTED) {
      return (
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
          <ShieldAlert className="size-4" />
        </div>
      );
    }
    if (type === NOTIFICATION_TYPES.NEW_SIGHTING) {
      return (
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
          <Eye className="size-4" />
        </div>
      );
    }
    if (type === NOTIFICATION_TYPES.NEW_COMPLAINT) {
      return (
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
          <AlertTriangle className="size-4" />
        </div>
      );
    }
    return (
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
        <Bell className="size-4" />
      </div>
    );
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Topbar Bell Trigger */}
      <button
        type="button"
        aria-label="View notifications"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative flex size-9 items-center justify-center rounded-lg border border-border/50 bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-colors"
      >
        <Bell className="size-4" />
        {unreadCount > 0 ? (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow-xs animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        ) : null}
      </button>

      {/* Floating Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl border border-border/80 bg-card/95 backdrop-blur-md shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/60 px-4 py-3 bg-secondary/30">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground tracking-tight">
                Dispatches & Alerts
              </span>
              <span
                className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                  isBmc
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                    : isPolice
                    ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
                    : 'bg-primary/10 text-primary border-primary/20'
                }`}
              >
                {isBmc ? 'BMC Authority' : isPolice ? 'Police Jurisdiction' : 'Authority'}
              </span>
            </div>

            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  title="Mark all as read"
                  className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-secondary transition-colors"
                >
                  <CheckCheck className="size-3.5 text-primary" />
                  <span>Mark all read</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-secondary"
              >
                <X className="size-3.5" />
              </button>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-border/40 bg-secondary/10 text-xs">
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setFilter('all')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  filter === 'all'
                    ? 'bg-background text-foreground shadow-xs border border-border/60'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                All ({notifications.length})
              </button>
              <button
                type="button"
                onClick={() => setFilter('unread')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  filter === 'unread'
                    ? 'bg-background text-foreground shadow-xs border border-border/60'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Unread ({unreadCount})
              </button>
            </div>

            {/* Live Indicator */}
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Realtime</span>
            </div>
          </div>

          {/* FCM Push Permission Banner */}
          {pushStatus !== 'granted' && pushStatus !== 'unsupported' && (
            <div className="flex items-center justify-between gap-2 px-4 py-2 bg-primary/5 border-b border-primary/20 text-xs">
              <div className="flex items-center gap-1.5 text-foreground/90">
                <Sparkles className="size-3.5 text-primary shrink-0" />
                <span className="text-[11px] leading-tight">
                  Enable browser push for live sound alerts
                </span>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isRequestingPush}
                onClick={handleEnablePush}
                className="h-6 px-2 text-[11px] font-medium rounded-md border-primary/40 hover:bg-primary hover:text-primary-foreground"
              >
                {isRequestingPush ? 'Enabling...' : 'Enable'}
              </Button>
            </div>
          )}

          {/* Notifications List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-border/40 no-scrollbar">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground text-xs gap-2">
                <Radio className="size-5 animate-spin text-primary" />
                <span>Syncing live dispatches...</span>
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center text-muted-foreground text-xs gap-2">
                <div className="flex size-10 items-center justify-center rounded-full bg-secondary/60">
                  <CheckCircle2 className="size-5 text-emerald-500" />
                </div>
                <span className="font-medium text-foreground">All caught up</span>
                <span className="text-[11px] max-w-[200px]">
                  {filter === 'unread'
                    ? 'No unread alerts at this time.'
                    : 'No operational dispatches recorded yet for this station.'}
                </span>
              </div>
            ) : (
              filteredNotifications.map((notif) => {
                const meta = notif.metadata || {};
                const location = meta.location || meta.ward || meta.jurisdiction;
                const category = meta.category || notif.notification_type;

                return (
                  <div
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif)}
                    className={`group relative flex items-start gap-3 p-3.5 text-left transition-colors cursor-pointer hover:bg-secondary/50 ${
                      !notif.is_read ? 'bg-primary/[0.03]' : ''
                    }`}
                  >
                    {renderNotificationIcon(notif)}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <span className="text-[11px] font-semibold text-foreground truncate">
                          {notif.title}
                        </span>
                        <span className="text-[10px] text-muted-foreground shrink-0 flex items-center gap-0.5">
                          <Clock className="size-2.5" />
                          {formatTimeAgo(notif.created_at)}
                        </span>
                      </div>

                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {notif.body}
                      </p>

                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        {category && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground">
                            {category}
                          </span>
                        )}
                        {location && (
                          <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                            <MapPin className="size-2.5" />
                            {location}
                          </span>
                        )}
                      </div>
                    </div>

                    {!notif.is_read && (
                      <span className="size-2 shrink-0 rounded-full bg-primary mt-1.5" />
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-2 border-t border-border/60 bg-secondary/30 text-[11px] text-muted-foreground">
            <span>
              Station Jurisdiction:{' '}
              <strong className="text-foreground font-medium">
                {authority?.jurisdiction || authority?.ward || 'Central'}
              </strong>
            </span>
            <span className="text-[10px] opacity-75">UniSafe Dispatch System</span>
          </div>
        </div>
      )}
    </div>
  );
}

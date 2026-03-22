import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { notificationsApi } from "../../api";
import type { Notification, NotificationType } from "../../types";

const TYPE_ICONS: Record<NotificationType, string> = {
  AGENT_ACTION: "🏞️",
  OVERDUE_INVOICE: "\uD83D\uDCB8",
  WEATHER_ALERT: "\uD83C\uDF27\uFE0F",
  JOB_REMINDER: "\uD83D\uDCC5",
  SEASONAL_TRIGGER: "\uD83C\uDF3F",
  SYSTEM: "\u2139\uFE0F",
};

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffSec = Math.floor((now - then) / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const navigate = useNavigate();

  function fetchCount() {
    notificationsApi.unreadCount()
      .then((res) => setUnreadCount(res.count))
      .catch(console.error);
  }

  function fetchNotifications() {
    notificationsApi.list({ limit: "10" })
      .then(setNotifications)
      .catch(console.error);
  }

  useEffect(() => {
    fetchCount();
    pollRef.current = setInterval(fetchCount, 60000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  useEffect(() => {
    if (open) fetchNotifications();
  }, [open]);

  // Close panel when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  async function handleClickNotification(n: Notification) {
    if (!n.isRead) {
      try {
        await notificationsApi.markRead(n.id);
        setUnreadCount((c) => Math.max(0, c - 1));
        setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
      } catch (e) {
        console.error(e);
      }
    }
    if (n.actionUrl) {
      navigate(n.actionUrl);
      setOpen(false);
    }
  }

  async function handleMarkAllRead() {
    try {
      await notificationsApi.markAllRead();
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex items-center justify-center w-9 h-9 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
      >
        <span className="text-lg">{"\uD83D\uDD14"}</span>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 min-w-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 card shadow-lg z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-sm text-gray-900">Notifications</h3>
            {unreadCount > 0 && (
              <button onClick={handleMarkAllRead} className="text-xs text-turf-600 hover:text-turf-700 font-medium">
                Mark all read
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-400 text-sm">
              No notifications yet
            </div>
          ) : (
            <ul className="max-h-80 overflow-auto divide-y divide-gray-50">
              {notifications.map((n) => (
                <li key={n.id}>
                  <button
                    onClick={() => handleClickNotification(n)}
                    className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors flex items-start gap-2.5 ${
                      !n.isRead ? "bg-turf-50/40" : ""
                    }`}
                  >
                    <span className="text-base mt-0.5">{TYPE_ICONS[n.type] ?? "\u2139\uFE0F"}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm truncate ${!n.isRead ? "font-medium text-gray-900" : "text-gray-700"}`}>
                        {n.title}
                      </p>
                      <p className="text-xs text-gray-400 truncate mt-0.5">{n.message}</p>
                      <p className="text-xs text-gray-300 mt-1">{timeAgo(n.createdAt)}</p>
                    </div>
                    {!n.isRead && (
                      <span className="w-2 h-2 bg-turf-500 rounded-full shrink-0 mt-1.5" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

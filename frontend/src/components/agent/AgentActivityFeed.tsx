import { useState, useEffect, useRef } from "react";
import { agentApi } from "../../api";
import type { AgentAction, AgentActionType } from "../../types";

const ACTION_ICONS: Record<AgentActionType, string> = {
  CREATE_JOB: "\uD83D\uDCC5",
  RESCHEDULE_JOB: "\uD83D\uDD04",
  CREATE_QUOTE: "\uD83D\uDCDD",
  CREATE_INVOICE: "\uD83D\uDCB0",
  SEND_REMINDER: "\uD83D\uDCE7",
  WEATHER_ALERT: "\uD83C\uDF27\uFE0F",
  SEASONAL_BATCH: "\uD83C\uDF3F",
  SUGGEST_SERVICE: "\uD83D\uDCA1",
  FLAG_OVERDUE: "\u26A0\uFE0F",
  LOG_CHEMICAL: "\uD83E\uDDEA",
};

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffSec = Math.floor((now - then) / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hr ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

export default function AgentActivityFeed() {
  const [actions, setActions] = useState<AgentAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingOn, setActingOn] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function load() {
    agentApi.listActions({ status: "PROPOSED", limit: "10" })
      .then(setActions)
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    intervalRef.current = setInterval(load, 30000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  async function handleApprove(id: string) {
    setActingOn(id);
    try {
      await agentApi.approveAction(id);
      load();
    } catch (e) {
      console.error(e);
    } finally {
      setActingOn(null);
    }
  }

  async function handleReject(id: string) {
    setActingOn(id);
    try {
      await agentApi.rejectAction(id);
      load();
    } catch (e) {
      console.error(e);
    } finally {
      setActingOn(null);
    }
  }

  return (
    <div className="card">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <h2 className="font-semibold text-gray-900">AI Agent Activity</h2>
        <span className="text-xs text-gray-400">Auto-refreshes</span>
      </div>

      {loading ? (
        <div className="px-5 py-8 text-center text-gray-400 text-sm">Loading proposals...</div>
      ) : actions.length === 0 ? (
        <div className="px-5 py-8 text-center text-gray-400 text-sm">
          <p className="text-2xl mb-2">{"🏞️"}</p>
          <p>No pending proposals.</p>
          <p className="mt-1">Your AI assistant is monitoring your business.</p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-50">
          {actions.map((action) => (
            <li key={action.id} className="px-5 py-3">
              <div className="flex items-start gap-3">
                <span className="text-lg mt-0.5">{ACTION_ICONS[action.type] ?? "🏞️"}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900">{action.summary}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{timeAgo(action.createdAt)}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => handleApprove(action.id)}
                    disabled={actingOn === action.id}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium bg-green-50 text-green-700 hover:bg-green-100 transition-colors disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleReject(action.id)}
                    disabled={actingOn === action.id}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

import { useState, useEffect, useCallback } from "react";
import { auditApi } from "../api";
import type { AuditEvent, AuditEventType, AuditSession } from "../types";

// ── Badge colors by event type ──────────────────────────────────────────

const eventTypeBadge: Record<AuditEventType, string> = {
  ENTITY_VIEW: "bg-blue-100 text-blue-700",
  ACTION_PROPOSED: "bg-yellow-100 text-yellow-700",
  ACTION_CONFIRMED: "bg-green-100 text-green-700",
  ACTION_REJECTED: "bg-red-100 text-red-600",
  BATCH_PROPOSED: "bg-purple-100 text-purple-700",
  SESSION_START: "bg-gray-100 text-gray-600",
};

const EVENT_TYPES: AuditEventType[] = [
  "ENTITY_VIEW",
  "ACTION_PROPOSED",
  "ACTION_CONFIRMED",
  "ACTION_REJECTED",
  "BATCH_PROPOSED",
  "SESSION_START",
];

const ENTITY_TYPES = [
  "client",
  "job",
  "quote",
  "invoice",
  "property",
  "service",
  "chemical",
  "contract",
  "recurring",
];

// ── Helpers ─────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatDuration(ms?: number): string {
  if (!ms) return "--";
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remaining}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

// ── Session List Item ───────────────────────────────────────────────────

function SessionItem({
  session,
  isActive,
  onClick,
}: {
  session: AuditSession;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-3 rounded-lg transition-colors ${
        isActive
          ? "bg-turf-100 border border-turf-300"
          : "hover:bg-gray-50 border border-transparent"
      }`}
    >
      <p className="text-sm font-medium text-gray-900">
        {formatDate(session.startedAt)}
      </p>
      <div className="flex items-center gap-3 mt-1">
        <span className="text-xs text-gray-500">
          {session.eventCount} event{session.eventCount !== 1 ? "s" : ""}
        </span>
        <span className="text-xs text-gray-400">
          {formatDuration(session.durationMs)}
        </span>
      </div>
    </button>
  );
}

// ── Main Component ──────────────────────────────────────────────────────

export default function AIActivity() {
  // Sessions
  const [sessions, setSessions] = useState<AuditSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [sessionsLoading, setSessionsLoading] = useState(true);

  // Audit events
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);

  // Filters
  const [eventTypeFilter, setEventTypeFilter] = useState<string>("");
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // Pagination
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const PAGE_SIZE = 50;

  // ── Load sessions ──────────────────────────────────────────────────────

  useEffect(() => {
    setSessionsLoading(true);
    auditApi
      .sessions()
      .then(setSessions)
      .catch(console.error)
      .finally(() => setSessionsLoading(false));
  }, []);

  // ── Load events ────────────────────────────────────────────────────────

  const loadEvents = useCallback(
    async (resetOffset = true) => {
      setEventsLoading(true);
      const currentOffset = resetOffset ? 0 : offset;
      if (resetOffset) setOffset(0);

      try {
        const params: Record<string, string> = {
          limit: String(PAGE_SIZE),
          offset: String(currentOffset),
        };
        if (selectedSessionId) params.sessionId = selectedSessionId;
        if (eventTypeFilter) params.eventType = eventTypeFilter;
        if (entityTypeFilter) params.entityType = entityTypeFilter;
        if (startDate) params.startDate = startDate;
        if (endDate) params.endDate = endDate;

        const data = await auditApi.list(params);

        if (resetOffset) {
          setEvents(data);
        } else {
          setEvents((prev) => [...prev, ...data]);
        }
        setHasMore(data.length >= PAGE_SIZE);
      } catch (e) {
        console.error("Failed to load audit events:", e);
      } finally {
        setEventsLoading(false);
      }
    },
    [selectedSessionId, eventTypeFilter, entityTypeFilter, startDate, endDate, offset]
  );

  // Re-load when filters or session changes
  useEffect(() => {
    loadEvents(true);
  }, [selectedSessionId, eventTypeFilter, entityTypeFilter, startDate, endDate]);

  function handleLoadMore() {
    setOffset((prev) => prev + PAGE_SIZE);
  }

  // Trigger load when offset changes (only for "Load More")
  useEffect(() => {
    if (offset > 0) {
      loadEvents(false);
    }
  }, [offset]);

  function handleSessionClick(id: string) {
    if (selectedSessionId === id) {
      setSelectedSessionId(null);
    } else {
      setSelectedSessionId(id);
    }
  }

  function clearFilters() {
    setEventTypeFilter("");
    setEntityTypeFilter("");
    setStartDate("");
    setEndDate("");
    setSelectedSessionId(null);
  }

  const hasActiveFilters =
    eventTypeFilter || entityTypeFilter || startDate || endDate || selectedSessionId;

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI Activity</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Audit log of all AI interactions, actions, and decisions
          </p>
        </div>
      </div>

      <div className="flex gap-4">
        {/* ── Section A: Session History (left sidebar) ────────────────────── */}
        <div className="w-64 shrink-0">
          <div className="card p-3">
            <h2 className="text-sm font-semibold text-gray-700 mb-2 px-1">
              Sessions
            </h2>

            {sessionsLoading ? (
              <div className="py-8 text-center text-gray-400 text-sm">
                Loading sessions...
              </div>
            ) : sessions.length === 0 ? (
              <div className="py-8 text-center text-gray-400 text-sm">
                No sessions yet
              </div>
            ) : (
              <div className="space-y-1 max-h-[calc(100vh-220px)] overflow-y-auto">
                {sessions.map((session) => (
                  <SessionItem
                    key={session.id}
                    session={session}
                    isActive={selectedSessionId === session.id}
                    onClick={() => handleSessionClick(session.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Section B: Audit Log Table (main area) ──────────────────────── */}
        <div className="flex-1 min-w-0 space-y-3">
          {/* Filter bar */}
          <div className="card px-4 py-3">
            <div className="flex items-end gap-3 flex-wrap">
              <div>
                <label className="label">Event Type</label>
                <select
                  className="input text-sm"
                  value={eventTypeFilter}
                  onChange={(e) => setEventTypeFilter(e.target.value)}
                >
                  <option value="">All Types</option>
                  {EVENT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Entity Type</label>
                <select
                  className="input text-sm"
                  value={entityTypeFilter}
                  onChange={(e) => setEntityTypeFilter(e.target.value)}
                >
                  <option value="">All Entities</option>
                  {ENTITY_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">From</label>
                <input
                  type="date"
                  className="input text-sm"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <label className="label">To</label>
                <input
                  type="date"
                  className="input text-sm"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="btn-secondary text-xs py-1.5"
                >
                  Clear Filters
                </button>
              )}
            </div>

            {selectedSessionId && (
              <div className="mt-2 flex items-center gap-2">
                <span className="badge bg-turf-100 text-turf-700">
                  Session: {selectedSessionId.slice(0, 8)}...
                </span>
                <button
                  onClick={() => setSelectedSessionId(null)}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  clear
                </button>
              </div>
            )}
          </div>

          {/* Table */}
          <div className="card overflow-hidden">
            {eventsLoading && events.length === 0 ? (
              <div className="py-16 text-center text-gray-400 text-sm">
                Loading events...
              </div>
            ) : events.length === 0 ? (
              <div className="py-16 text-center text-gray-400">
                <p className="text-lg mb-1">No audit events found</p>
                <p className="text-sm">
                  Events will appear here as you interact with AgenticMeadows
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="text-left px-4 py-2.5 font-medium text-gray-600">
                          Time
                        </th>
                        <th className="text-left px-4 py-2.5 font-medium text-gray-600">
                          Event Type
                        </th>
                        <th className="text-left px-4 py-2.5 font-medium text-gray-600">
                          Summary
                        </th>
                        <th className="text-left px-4 py-2.5 font-medium text-gray-600">
                          Entity
                        </th>
                        <th className="text-left px-4 py-2.5 font-medium text-gray-600">
                          Action
                        </th>
                        <th className="text-left px-4 py-2.5 font-medium text-gray-600">
                          Inference
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {events.map((evt) => (
                        <tr
                          key={evt.id}
                          className="hover:bg-gray-50 transition-colors"
                        >
                          {/* Time */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            <p className="text-gray-900">
                              {formatTime(evt.createdAt)}
                            </p>
                            <p className="text-xs text-gray-400">
                              {formatDate(evt.createdAt)}
                            </p>
                          </td>

                          {/* Event Type badge */}
                          <td className="px-4 py-3">
                            <span
                              className={`badge ${
                                eventTypeBadge[evt.eventType] ??
                                "bg-gray-100 text-gray-600"
                              }`}
                            >
                              {evt.eventType.replace(/_/g, " ")}
                            </span>
                          </td>

                          {/* Summary */}
                          <td className="px-4 py-3 max-w-xs">
                            <p className="text-gray-800 truncate">
                              {evt.summary}
                            </p>
                            {evt.latencyMs != null && (
                              <p className="text-xs text-gray-400 mt-0.5">
                                {evt.latencyMs}ms
                              </p>
                            )}
                          </td>

                          {/* Entity */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            {evt.entityType ? (
                              <span className="text-gray-600 capitalize">
                                {evt.entityType}
                                {evt.entityId && (
                                  <span className="text-gray-400 text-xs ml-1">
                                    #{evt.entityId.slice(0, 6)}
                                  </span>
                                )}
                              </span>
                            ) : (
                              <span className="text-gray-300">--</span>
                            )}
                          </td>

                          {/* Action */}
                          <td className="px-4 py-3">
                            {evt.action ? (
                              <span className="text-gray-600">
                                {evt.action.replace(/_/g, " ")}
                              </span>
                            ) : (
                              <span className="text-gray-300">--</span>
                            )}
                          </td>

                          {/* Inference Mode + Model */}
                          <td className="px-4 py-3">
                            {evt.inferenceMode ? (
                              <div>
                                <span className="text-gray-600">
                                  {evt.inferenceMode}
                                </span>
                                {evt.model && (
                                  <span className="badge bg-gray-100 text-gray-500 ml-1 text-xs">
                                    {evt.model}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-300">--</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {hasMore && (
                  <div className="px-4 py-3 border-t border-gray-100 text-center">
                    <button
                      onClick={handleLoadMore}
                      disabled={eventsLoading}
                      className="btn-secondary text-sm"
                    >
                      {eventsLoading ? "Loading..." : "Load More"}
                    </button>
                  </div>
                )}

                {/* Result count */}
                <div className="px-4 py-2 border-t border-gray-50 bg-gray-50/50">
                  <p className="text-xs text-gray-400 text-right">
                    Showing {events.length} event{events.length !== 1 ? "s" : ""}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

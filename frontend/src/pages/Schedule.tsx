import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { scheduleApi, jobsApi, clientsApi, settingsApi } from "../api";
import type { Job, JobStatus, Client } from "../types";

// ── Constants ────────────────────────────────────────────────────────────────

const HOUR_HEIGHT = 60; // px per hour
const START_HOUR = 6; // 6 AM
const END_HOUR = 21; // 9 PM (last visible hour is 8 PM row)
const TOTAL_HOURS = END_HOUR - START_HOUR;
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const DEFAULT_JOB_TYPES = [
  "Mow", "Fertilize", "Weed Control", "Aeration", "Overseeding",
  "Spring Cleanup", "Fall Cleanup", "Mulch", "Hedge Trimming", "Edging",
  "Leaf Removal", "Snow Removal", "Irrigation Check", "Tree Trimming",
  "Garden Maintenance", "Landscape Design", "Hardscape", "Other",
];

const statusColors: Record<JobStatus, string> = {
  PENDING: "bg-yellow-100 text-yellow-700 border-yellow-200",
  SCHEDULED: "bg-blue-100 text-blue-700 border-blue-200",
  IN_PROGRESS: "bg-turf-100 text-turf-700 border-turf-200",
  COMPLETED: "bg-gray-100 text-gray-600 border-gray-200",
  CANCELLED: "bg-red-50 text-red-500 border-red-100",
};

const statusBadgeColors: Record<JobStatus, string> = {
  PENDING: "bg-yellow-100 text-yellow-700",
  SCHEDULED: "bg-blue-100 text-blue-700",
  IN_PROGRESS: "bg-turf-100 text-turf-700",
  COMPLETED: "bg-gray-100 text-gray-600",
  CANCELLED: "bg-red-100 text-red-500",
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function getWeekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });
}

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatHour(hour: number): string {
  if (hour === 0 || hour === 24) return "12 AM";
  if (hour === 12) return "12 PM";
  if (hour < 12) return `${hour} AM`;
  return `${hour - 12} PM`;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatDateTime(date: Date): string {
  return date.toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Pixel offset from top of grid for a given Date */
function timeToPixels(date: Date): number {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  return (hours - START_HOUR) * HOUR_HEIGHT + minutes * (HOUR_HEIGHT / 60);
}

// ── Popout Card Component ────────────────────────────────────────────────────

function JobPopout({
  job,
  anchorRect,
  containerRect,
  onClose,
  onMarkComplete,
}: {
  job: Job;
  anchorRect: DOMRect;
  containerRect: DOMRect;
  onClose: () => void;
  onMarkComplete: (jobId: string) => void;
}) {
  const navigate = useNavigate();
  const popoutRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (popoutRef.current && !popoutRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    // Use timeout to prevent immediate close from the same click that opened it
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClick);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClick);
    };
  }, [onClose]);

  // Position calculation relative to the calendar container
  const popoutWidth = 320;
  const popoutHeight = 340;

  // Calculate position: try to show to the right of the card, fall back to left
  let left = anchorRect.right - containerRect.left + 8;
  let top = anchorRect.top - containerRect.top;

  // If it would overflow the right side, show to the left
  if (left + popoutWidth > containerRect.width) {
    left = anchorRect.left - containerRect.left - popoutWidth - 8;
  }
  // If it would overflow the left, just center it
  if (left < 0) {
    left = Math.max(8, (containerRect.width - popoutWidth) / 2);
  }

  // If it would overflow the bottom, push it up
  if (top + popoutHeight > containerRect.height) {
    top = Math.max(8, containerRect.height - popoutHeight - 8);
  }
  if (top < 0) top = 8;

  const start = job.scheduledStart ? new Date(job.scheduledStart) : null;
  const end = job.scheduledEnd ? new Date(job.scheduledEnd) : null;
  const clientName = job.client
    ? `${job.client.firstName} ${job.client.lastName}`
    : "No client";
  const propertyAddress = job.property
    ? `${job.property.streetAddress}, ${job.property.city}`
    : null;

  return (
    <div
      ref={popoutRef}
      className="absolute z-50 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden"
      style={{ left, top, width: popoutWidth }}
    >
      {/* Header */}
      <div className="bg-gray-50 px-4 py-3 flex items-start justify-between border-b border-gray-100">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-gray-900 text-sm truncate">
            {job.title}
          </h3>
          <p className="text-xs text-gray-500 mt-0.5 truncate">{clientName}</p>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 ml-2 shrink-0 -mt-0.5"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-3 text-sm">
        {/* Status badge */}
        <div>
          <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${statusBadgeColors[job.status]}`}>
            {job.status.replace("_", " ")}
          </span>
        </div>

        {/* Date/time */}
        {start && (
          <div className="flex items-start gap-2">
            <span className="text-gray-400 mt-0.5 shrink-0">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
            <div>
              <p className="text-gray-700">
                {formatDateTime(start)}
                {end && ` - ${formatTime(end)}`}
              </p>
            </div>
          </div>
        )}

        {/* Property address */}
        {propertyAddress && (
          <div className="flex items-start gap-2">
            <span className="text-gray-400 mt-0.5 shrink-0">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
              </svg>
            </span>
            <p className="text-gray-700">{propertyAddress}</p>
          </div>
        )}

        {/* Description / notes */}
        {(job.description || job.notes) && (
          <div className="flex items-start gap-2">
            <span className="text-gray-400 mt-0.5 shrink-0">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </span>
            <p className="text-gray-600 text-xs line-clamp-3">
              {job.description || job.notes}
            </p>
          </div>
        )}

        {/* Assigned to */}
        {job.assignedUser && (
          <div className="flex items-start gap-2">
            <span className="text-gray-400 mt-0.5 shrink-0">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            </span>
            <p className="text-gray-700">{job.assignedUser.name}</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-4 py-3 border-t border-gray-100 flex items-center gap-2">
        <button
          onClick={() => navigate(`/jobs/${job.id}`)}
          className="btn-primary text-xs py-1.5 px-3"
        >
          Edit
        </button>
        {job.status !== "COMPLETED" && job.status !== "CANCELLED" && (
          <button
            onClick={() => onMarkComplete(job.id)}
            className="btn-secondary text-xs py-1.5 px-3"
          >
            Mark Complete
          </button>
        )}
      </div>
    </div>
  );
}

// ── Create Job Popout Component ──────────────────────────────────────────────

function CreateJobPopout({
  date,
  startHour,
  topPx,
  onClose,
  onCreated,
}: {
  date: Date;
  startHour: number;
  topPx: number;
  onClose: () => void;
  onCreated: () => void;
}) {
  const popoutRef = useRef<HTMLDivElement>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [jobType, setJobType] = useState("");
  const [customJobType, setCustomJobType] = useState("");
  const [jobTypes, setJobTypes] = useState<string[]>(DEFAULT_JOB_TYPES);
  const [duration, setDuration] = useState("60");
  const [submitting, setSubmitting] = useState(false);

  // Fetch clients and job types on mount
  useEffect(() => {
    clientsApi.list().then(setClients).catch(console.error);
    settingsApi.getJobTypes().then((d) => setJobTypes(d.jobTypes)).catch(() => setJobTypes(DEFAULT_JOB_TYPES));
  }, []);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (popoutRef.current && !popoutRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClick);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClick);
    };
  }, [onClose]);

  const selectedClient = clients.find((c) => c.id === clientId);
  const properties = selectedClient?.properties ?? [];

  // Reset property when client changes
  useEffect(() => {
    setPropertyId("");
  }, [clientId]);

  const resolvedJobType = jobType === "Other" ? customJobType : jobType;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId || !resolvedJobType) return;

    setSubmitting(true);
    try {
      const hours = Math.floor(startHour);
      const minutes = Math.round((startHour - hours) * 60);
      const scheduledStart = new Date(date);
      scheduledStart.setHours(hours, minutes, 0, 0);

      const durationMs = parseInt(duration) * 60_000;
      const scheduledEnd = new Date(scheduledStart.getTime() + durationMs);

      await jobsApi.create({
        title: resolvedJobType,
        clientId,
        propertyId: propertyId || undefined,
        scheduledStart: scheduledStart.toISOString(),
        scheduledEnd: scheduledEnd.toISOString(),
        status: "SCHEDULED",
      });

      onCreated();
      onClose();
    } catch (err) {
      console.error("Failed to create job:", err);
    } finally {
      setSubmitting(false);
    }
  };

  // Round the displayed time for the pre-filled label
  const hours = Math.floor(startHour);
  const minutes = Math.round((startHour - hours) * 60);
  const displayDate = new Date(date);
  displayDate.setHours(hours, minutes, 0, 0);

  return (
    <div
      ref={popoutRef}
      className="absolute z-50 bg-white rounded-lg shadow-xl border border-gray-200"
      style={{ top: topPx, left: 4, width: 280 }}
    >
      <form onSubmit={handleSubmit} className="p-3 space-y-2">
        {/* Header */}
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-gray-500">
            {displayDate.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}{" "}
            at {formatTime(displayDate)}
          </p>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Client */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-0.5">Client</label>
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="w-full text-sm border border-gray-300 rounded-md px-2 py-1.5 focus:ring-1 focus:ring-turf-500 focus:border-turf-500"
            required
          >
            <option value="">Select client...</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.firstName} {c.lastName}
              </option>
            ))}
          </select>
        </div>

        {/* Property */}
        {properties.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-0.5">Property</label>
            <select
              value={propertyId}
              onChange={(e) => setPropertyId(e.target.value)}
              className="w-full text-sm border border-gray-300 rounded-md px-2 py-1.5 focus:ring-1 focus:ring-turf-500 focus:border-turf-500"
            >
              <option value="">Select property...</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.streetAddress}, {p.city}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Job Type */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-0.5">Job Type</label>
          <select
            value={jobType}
            onChange={(e) => setJobType(e.target.value)}
            className="w-full text-sm border border-gray-300 rounded-md px-2 py-1.5 focus:ring-1 focus:ring-turf-500 focus:border-turf-500"
            required
          >
            <option value="">Select type...</option>
            {jobTypes.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
            {!jobTypes.includes("Other") && <option value="Other">Other</option>}
          </select>
          {jobType === "Other" && (
            <input
              type="text"
              value={customJobType}
              onChange={(e) => setCustomJobType(e.target.value)}
              placeholder="Enter custom job type..."
              className="w-full text-sm border border-gray-300 rounded-md px-2 py-1.5 mt-1 focus:ring-1 focus:ring-turf-500 focus:border-turf-500"
              required
            />
          )}
        </div>

        {/* Duration */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-0.5">Duration</label>
          <select
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            className="w-full text-sm border border-gray-300 rounded-md px-2 py-1.5 focus:ring-1 focus:ring-turf-500 focus:border-turf-500"
          >
            <option value="30">30 min</option>
            <option value="60">1 hr</option>
            <option value="90">1.5 hr</option>
            <option value="120">2 hr</option>
            <option value="180">3 hr</option>
            <option value="240">4 hr</option>
          </select>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          <button
            type="submit"
            disabled={submitting || !clientId || !resolvedJobType}
            className="btn-primary text-xs py-1.5 px-3 disabled:opacity-50"
          >
            {submitting ? "Creating..." : "Create Job"}
          </button>
          <button type="button" onClick={onClose} className="text-xs text-gray-500 hover:text-gray-700">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Component ────────────────────────────────────────────────────────────────

export default function Schedule() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [jobs, setJobs] = useState<Job[]>([]);
  const [now, setNow] = useState(new Date());
  const scrollRef = useRef<HTMLDivElement>(null);
  const calendarRef = useRef<HTMLDivElement>(null);
  const hasScrolled = useRef(false);

  // Popout state
  const [popoutJob, setPopoutJob] = useState<Job | null>(null);
  const [popoutAnchor, setPopoutAnchor] = useState<DOMRect | null>(null);

  // Create-job popout state
  const [createPopout, setCreatePopout] = useState<{
    date: Date;
    startHour: number;
    topPx: number;
    dayIdx: number;
  } | null>(null);

  // Fetch jobs for the visible week
  useEffect(() => {
    const end = new Date(weekStart);
    end.setDate(end.getDate() + 7);
    scheduleApi.get(weekStart, end).then(setJobs).catch(console.error);
  }, [weekStart]);

  // Tick the clock every 60 s for the current-time indicator
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Auto-scroll so 8 AM is near the top on first render
  useEffect(() => {
    if (scrollRef.current && !hasScrolled.current) {
      const offset = (8 - START_HOUR) * HOUR_HEIGHT;
      scrollRef.current.scrollTop = offset;
      hasScrolled.current = true;
    }
  }, [jobs]); // wait until first paint with content

  const prevWeek = useCallback(
    () => setWeekStart((w) => new Date(w.getTime() - 7 * 86_400_000)),
    [],
  );
  const nextWeek = useCallback(
    () => setWeekStart((w) => new Date(w.getTime() + 7 * 86_400_000)),
    [],
  );
  const goToday = useCallback(() => setWeekStart(startOfWeek(new Date())), []);

  const handleJobClick = useCallback(
    (e: React.MouseEvent, job: Job) => {
      e.preventDefault();
      e.stopPropagation();
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setPopoutJob(job);
      setPopoutAnchor(rect);
    },
    [],
  );

  const handleClosePopout = useCallback(() => {
    setPopoutJob(null);
    setPopoutAnchor(null);
  }, []);

  const handleMarkComplete = useCallback(
    async (jobId: string) => {
      try {
        await jobsApi.update(jobId, { status: "COMPLETED" } as any);
        // Refresh jobs
        const end = new Date(weekStart);
        end.setDate(end.getDate() + 7);
        const updated = await scheduleApi.get(weekStart, end);
        setJobs(updated);
        handleClosePopout();
      } catch (err) {
        console.error("Failed to mark complete:", err);
      }
    },
    [weekStart, handleClosePopout],
  );

  const handleDayDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>, dayIdx: number, day: Date) => {
      // Only trigger on direct clicks on the day column, not on job cards
      if ((e.target as HTMLElement).closest("[data-job-card]")) return;

      const rect = e.currentTarget.getBoundingClientRect();
      const offsetY = e.clientY - rect.top;
      const rawHour = START_HOUR + offsetY / HOUR_HEIGHT;
      // Round to nearest 15 min
      const rounded = Math.round(rawHour * 4) / 4;
      const clampedHour = Math.max(START_HOUR, Math.min(END_HOUR - 0.25, rounded));

      // Close any existing job popout
      handleClosePopout();

      setCreatePopout({
        date: day,
        startHour: clampedHour,
        topPx: (clampedHour - START_HOUR) * HOUR_HEIGHT,
        dayIdx,
      });
    },
    [handleClosePopout],
  );

  const handleCloseCreatePopout = useCallback(() => {
    setCreatePopout(null);
  }, []);

  const handleJobCreated = useCallback(async () => {
    const end = new Date(weekStart);
    end.setDate(end.getDate() + 7);
    const updated = await scheduleApi.get(weekStart, end);
    setJobs(updated);
  }, [weekStart]);

  const days = getWeekDays(weekStart);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Group jobs by day index (0-6)
  const jobsByDay: Job[][] = days.map((day) =>
    jobs.filter((j) => {
      if (!j.scheduledStart) return false;
      return isSameDay(new Date(j.scheduledStart), day);
    }),
  );

  // Build hour labels array
  const hours = Array.from({ length: TOTAL_HOURS }, (_, i) => START_HOUR + i);

  // Get container rect for popout positioning
  const containerRect = calendarRef.current?.getBoundingClientRect() ?? new DOMRect();

  return (
    <div className="max-w-[1400px] mx-auto space-y-4">
      {/* ── Header / navigation ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Schedule</h1>
        <div className="flex items-center gap-2">
          <button onClick={prevWeek} className="btn-secondary py-1.5 px-3">
            &larr;
          </button>
          <span className="text-sm font-medium text-gray-700 min-w-[180px] text-center">
            {weekStart.toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })}{" "}
            &ndash;{" "}
            {weekEnd.toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>
          <button onClick={nextWeek} className="btn-secondary py-1.5 px-3">
            &rarr;
          </button>
          <button onClick={goToday} className="btn-ghost text-sm">
            Today
          </button>
        </div>
      </div>

      {/* ── Calendar grid ───────────────────────────────────────────────── */}
      <div className="card overflow-hidden" ref={calendarRef}>
        {/* Sticky day-column headers */}
        <div className="grid border-b border-gray-200" style={{ gridTemplateColumns: "64px repeat(7, 1fr)" }}>
          {/* Time gutter spacer */}
          <div className="border-r border-gray-200" />
          {days.map((day, i) => {
            const isToday = isSameDay(day, today);
            return (
              <div
                key={i}
                className={`py-3 text-center border-r border-gray-100 last:border-r-0 ${
                  isToday ? "bg-turf-50" : ""
                }`}
              >
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  {DAY_NAMES[day.getDay()]}
                </p>
                <p
                  className={`text-lg font-semibold mt-0.5 ${
                    isToday ? "text-turf-600" : "text-gray-800"
                  }`}
                >
                  {day.getDate()}
                </p>
              </div>
            );
          })}
        </div>

        {/* Scrollable time grid */}
        <div
          ref={scrollRef}
          className="overflow-y-auto relative"
          style={{ height: "calc(100vh - 200px)" }}
        >
          <div
            className="grid relative"
            style={{
              gridTemplateColumns: "64px repeat(7, 1fr)",
              height: TOTAL_HOURS * HOUR_HEIGHT,
            }}
          >
            {/* ── Time labels column ──────────────────────────────────── */}
            <div className="relative border-r border-gray-200">
              {hours.map((hour) => (
                <div
                  key={hour}
                  className="absolute right-2 text-[11px] text-gray-400 leading-none -translate-y-1/2 select-none"
                  style={{ top: (hour - START_HOUR) * HOUR_HEIGHT }}
                >
                  {formatHour(hour)}
                </div>
              ))}
            </div>

            {/* ── Day columns ─────────────────────────────────────────── */}
            {days.map((day, dayIdx) => {
              const isToday = isSameDay(day, today);
              const dayJobs = jobsByDay[dayIdx];

              return (
                <div
                  key={dayIdx}
                  onDoubleClick={(e) => handleDayDoubleClick(e, dayIdx, day)}
                  className={`relative border-r border-gray-100 last:border-r-0 ${
                    isToday ? "bg-turf-50/20" : ""
                  }`}
                >
                  {/* Hour grid lines */}
                  {hours.map((hour) => (
                    <div key={hour}>
                      {/* Full-hour line */}
                      <div
                        className="absolute left-0 right-0 border-t border-gray-100"
                        style={{ top: (hour - START_HOUR) * HOUR_HEIGHT }}
                      />
                      {/* Half-hour line */}
                      <div
                        className="absolute left-0 right-0 border-t border-gray-50 border-dashed"
                        style={{
                          top: (hour - START_HOUR) * HOUR_HEIGHT + HOUR_HEIGHT / 2,
                        }}
                      />
                    </div>
                  ))}

                  {/* Current-time indicator (red line on today) */}
                  {isToday &&
                    now.getHours() >= START_HOUR &&
                    now.getHours() < END_HOUR && (
                      <div
                        className="absolute left-0 right-0 z-20 flex items-center pointer-events-none"
                        style={{ top: timeToPixels(now) }}
                      >
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500 -ml-[5px] shrink-0" />
                        <div className="flex-1 h-[2px] bg-red-500" />
                      </div>
                    )}

                  {/* Job cards */}
                  {dayJobs.map((job) => {
                    const start = new Date(job.scheduledStart!);
                    const end = job.scheduledEnd
                      ? new Date(job.scheduledEnd)
                      : null;

                    const top = timeToPixels(start);
                    const durationMinutes = end
                      ? (end.getTime() - start.getTime()) / 60_000
                      : 60; // default 1 hr
                    const height = Math.max(
                      durationMinutes * (HOUR_HEIGHT / 60),
                      24, // minimum height so label is readable
                    );

                    const endDisplay = end ?? new Date(start.getTime() + 3_600_000);
                    const clientName = job.client
                      ? `${job.client.firstName} ${job.client.lastName}`
                      : job.title;

                    return (
                      <div
                        key={job.id}
                        data-job-card
                        onClick={(e) => handleJobClick(e, job)}
                        className={`absolute left-1 right-1 z-10 rounded-md px-2 py-1 text-xs border overflow-hidden cursor-pointer hover:shadow-md transition-shadow ${statusColors[job.status]}`}
                        style={{ top, height }}
                        title={`${clientName} - ${job.title}`}
                      >
                        <p className="font-semibold truncate leading-tight">
                          {clientName}
                        </p>
                        <p className="truncate opacity-60 leading-tight">
                          {formatTime(start)} &ndash; {formatTime(endDisplay)}
                        </p>
                      </div>
                    );
                  })}

                  {/* Create job popout */}
                  {createPopout && createPopout.dayIdx === dayIdx && (
                    <CreateJobPopout
                      date={createPopout.date}
                      startHour={createPopout.startHour}
                      topPx={createPopout.topPx}
                      onClose={handleCloseCreatePopout}
                      onCreated={handleJobCreated}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Popout card - rendered inside scrollable area for correct positioning */}
          {popoutJob && popoutAnchor && (
            <JobPopout
              job={popoutJob}
              anchorRect={popoutAnchor}
              containerRect={containerRect}
              onClose={handleClosePopout}
              onMarkComplete={handleMarkComplete}
            />
          )}
        </div>
      </div>

      {/* ── Job list overview (below calendar) ──────────────────────────── */}
      {jobs.length > 0 && (
        <div className="card">
          <div className="px-5 py-3 border-b border-gray-100">
            <p className="font-semibold text-sm">
              {jobs.length} job{jobs.length !== 1 ? "s" : ""} this week
            </p>
          </div>
          <ul className="divide-y divide-gray-50">
            {jobs.map((job) => (
              <li key={job.id}>
                <Link
                  to={`/jobs/${job.id}`}
                  className="flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-gray-50 hover:shadow-md transition-shadow"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{job.title}</p>
                    <p className="text-xs text-gray-500">
                      {job.client
                        ? `${job.client.firstName} ${job.client.lastName}`
                        : ""}
                      {job.scheduledStart
                        ? ` \u00b7 ${new Date(job.scheduledStart).toLocaleString()}`
                        : ""}
                    </p>
                  </div>
                  <span className={`badge ${statusColors[job.status]}`}>
                    {job.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

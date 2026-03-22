import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { dashboardApi } from "../api";
import type { DashboardStats, Job } from "../types";
import AgentActivityFeed from "../components/agent/AgentActivityFeed";

const currencyFmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function RevenueCard({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="card p-5">
      <p className="text-sm text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${accent ?? "text-gray-900"}`}>
        {currencyFmt.format(value ?? 0)}
      </p>
    </div>
  );
}

function PipelineCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="card p-4 text-center">
      <p className={`text-2xl font-bold ${color}`}>{value ?? 0}</p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
    </div>
  );
}

function statusColor(status: Job["status"]) {
  return {
    PENDING: "bg-yellow-100 text-yellow-700",
    SCHEDULED: "bg-blue-100 text-blue-700",
    IN_PROGRESS: "bg-turf-100 text-turf-700",
    COMPLETED: "bg-gray-100 text-gray-600",
    CANCELLED: "bg-red-100 text-red-600",
  }[status];
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const location = useLocation();
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    dashboardApi.stats()
      .then(setStats)
      .catch((err) => {
        console.error(err);
        setError(err.message || "Failed to load dashboard data");
      })
      .finally(() => setLoading(false));
  }, []);

  // Show welcome banner if arriving from onboarding
  useEffect(() => {
    const state = location.state as { welcomeToast?: boolean } | null;
    if (state?.welcomeToast) {
      setShowWelcome(true);
      // Clear the state so it doesn't show again on refresh
      window.history.replaceState({}, document.title);
      const timer = setTimeout(() => setShowWelcome(false), 8000);
      return () => clearTimeout(timer);
    }
  }, [location]);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-0.5">Loading...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !stats) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-0.5">Welcome to AgenticMeadows</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">&#x26A0;&#xFE0F;</span>
            <h3 className="font-semibold text-red-800 text-sm">Unable to load dashboard</h3>
          </div>
          <p className="text-sm text-red-600">{error}</p>
          <button
            onClick={() => {
              setLoading(true);
              setError("");
              dashboardApi.stats()
                .then(setStats)
                .catch((err) => setError(err.message || "Failed to load dashboard data"))
                .finally(() => setLoading(false));
            }}
            className="mt-3 btn-secondary text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Fallback to zeros if stats not loaded
  const revenue = stats?.revenue ?? { thisMonth: 0, lastMonth: 0, outstanding: 0, pending: 0 };
  const jobs = stats?.jobs ?? { pending: 0, scheduled: 0, inProgress: 0, completedThisMonth: 0, scheduledToday: 0 };
  const invoices = stats?.invoices ?? { overdue: [], overdueTotal: 0 };
  const upcoming = stats?.upcoming ?? [];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Welcome banner after onboarding */}
      {showWelcome && (
        <div className="bg-turf-50 border border-turf-200 rounded-xl px-5 py-4 flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-turf-500 rounded-xl flex items-center justify-center text-xl shrink-0">
              {"\uD83C\uDF3F"}
            </div>
            <div>
              <p className="text-sm font-semibold text-turf-900">Welcome to AgenticMeadows! Your workspace is ready.</p>
              <p className="text-xs text-turf-600 mt-0.5">Explore the dashboard, add clients, and schedule your first jobs.</p>
            </div>
          </div>
          <button
            onClick={() => setShowWelcome(false)}
            className="text-turf-400 hover:text-turf-600 shrink-0 ml-4"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-0.5">Welcome to AgenticMeadows</p>
      </div>

      {/* Revenue Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <RevenueCard label="Revenue This Month" value={revenue.thisMonth ?? 0} accent="text-turf-700" />
        <RevenueCard label="Last Month" value={revenue.lastMonth ?? 0} />
        <RevenueCard
          label="Outstanding"
          value={revenue.outstanding ?? 0}
          accent={(revenue.outstanding ?? 0) > 0 ? "text-amber-600" : "text-gray-900"}
        />
        <RevenueCard
          label="Pending Revenue"
          value={revenue.pending ?? 0}
          accent={(revenue.pending ?? 0) > 0 ? "text-amber-500" : "text-gray-900"}
        />
      </div>

      {/* Job Pipeline */}
      <div>
        <h2 className="font-semibold text-gray-900 mb-3">Job Pipeline</h2>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <PipelineCard label="Pending" value={jobs.pending ?? 0} color="text-yellow-600" />
          <PipelineCard label="Scheduled" value={jobs.scheduled ?? 0} color="text-blue-600" />
          <PipelineCard label="In Progress" value={jobs.inProgress ?? 0} color="text-turf-600" />
          <PipelineCard label="Completed This Month" value={jobs.completedThisMonth ?? 0} color="text-gray-600" />
          <PipelineCard label="Scheduled Today" value={jobs.scheduledToday ?? 0} color="text-indigo-600" />
        </div>
      </div>

      {/* Overdue Invoices Alert */}
      {(invoices.overdueTotal ?? 0) > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-lg">{"\u26A0\uFE0F"}</span>
              <h3 className="font-semibold text-red-800 text-sm">Overdue Invoices</h3>
            </div>
            <span className="text-sm font-bold text-red-700">{currencyFmt.format(invoices.overdueTotal ?? 0)} total</span>
          </div>
          <ul className="space-y-1.5">
            {(invoices.overdue ?? []).map((inv) => (
              <li key={inv.id}>
                <Link
                  to={`/invoices`}
                  className="flex items-center justify-between text-sm text-red-700 hover:text-red-800"
                >
                  <span>
                    {inv.client ? `${inv.client.firstName} ${inv.client.lastName}` : "Unknown client"}
                    {inv.dueDate && <span className="text-red-400 ml-2">due {new Date(inv.dueDate).toLocaleDateString()}</span>}
                  </span>
                  <span className="font-medium">{currencyFmt.format(inv.total ?? 0)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* AI Agent Activity Feed */}
        <AgentActivityFeed />

        {/* Upcoming Jobs */}
        <div className="card">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Upcoming Jobs</h2>
            <Link to="/jobs" className="text-sm text-turf-600 hover:text-turf-700">View all {"\u2192"}</Link>
          </div>
          {upcoming.length === 0 ? (
            <div className="px-5 py-8 text-center text-gray-400 text-sm">
              No upcoming jobs. <Link to="/jobs" className="text-turf-600 hover:underline">Create a job {"\u2192"}</Link>
            </div>
          ) : (
            <ul className="divide-y divide-gray-50">
              {upcoming.slice(0, 5).map((job) => (
                <li key={job.id}>
                  <Link to={`/jobs/${job.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-gray-900 truncate">{job.title}</p>
                      {job.client && (
                        <p className="text-xs text-gray-500">
                          {job.client.firstName} {job.client.lastName}
                        </p>
                      )}
                    </div>
                    <span className={`badge ${statusColor(job.status)}`}>{job.status}</span>
                    {job.scheduledStart && (
                      <p className="text-xs text-gray-400 shrink-0">
                        {new Date(job.scheduledStart).toLocaleDateString()}
                      </p>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* AI tip */}
      <div className="bg-turf-50 border border-turf-200 rounded-xl p-4 flex items-start gap-3">
        <span className="text-2xl">{"🏞️"}</span>
        <div>
          <p className="font-semibold text-turf-800 text-sm">AgenticMeadows is ready</p>
          <p className="text-turf-700 text-sm mt-0.5">
            Open any job, upload a site photo, and ask me to analyze it. I'll assess the work needed and draft a quote for your approval.
          </p>
        </div>
      </div>
    </div>
  );
}

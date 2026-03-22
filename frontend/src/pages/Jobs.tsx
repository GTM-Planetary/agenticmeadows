import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { jobsApi, clientsApi } from "../api";
import type { Job, Client, JobStatus } from "../types";

const statusColors: Record<JobStatus, string> = {
  PENDING: "bg-yellow-100 text-yellow-700",
  SCHEDULED: "bg-blue-100 text-blue-700",
  IN_PROGRESS: "bg-turf-100 text-turf-700",
  COMPLETED: "bg-gray-100 text-gray-600",
  CANCELLED: "bg-red-100 text-red-600",
};

function JobModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [clients, setClients] = useState<Client[]>([]);
  const [form, setForm] = useState({
    clientId: "", title: "", description: "",
    scheduledStart: "", scheduledEnd: "", notes: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { clientsApi.list().then(setClients).catch(console.error); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await jobsApi.create({
        clientId: form.clientId,
        title: form.title,
        description: form.description || undefined,
        scheduledStart: form.scheduledStart || undefined,
        scheduledEnd: form.scheduledEnd || undefined,
        notes: form.notes || undefined,
      });
      onSaved();
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="card w-full max-w-md p-6">
        <h2 className="font-bold text-lg mb-4">New Job</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="label">Client *</label>
            <select className="input" required value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })}>
              <option value="">Select client...</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Job Title *</label>
            <input className="input" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Spring Lawn Cleanup" />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Start</label>
              <input className="input" type="datetime-local" value={form.scheduledStart} onChange={(e) => setForm({ ...form, scheduledStart: e.target.value })} />
            </div>
            <div>
              <label className="label">End</label>
              <input className="input" type="datetime-local" value={form.scheduledEnd} onChange={(e) => setForm({ ...form, scheduledEnd: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center">{loading ? "Saving..." : "Create Job"}</button>
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Jobs() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("");

  function load() { jobsApi.list({ status: statusFilter || undefined }).then(setJobs).catch(console.error); }
  useEffect(() => { load(); }, [statusFilter]);

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Jobs</h1>
        <button onClick={() => setShowModal(true)} className="btn-primary">+ New Job</button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {["", "PENDING", "SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              statusFilter === s
                ? "bg-turf-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {s || "All"}
          </button>
        ))}
      </div>

      <div className="card overflow-hidden">
        {jobs.length === 0 ? (
          <div className="py-12 text-center text-gray-400">
            No jobs found. <button onClick={() => setShowModal(true)} className="text-turf-600 hover:underline">Create one →</button>
          </div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {jobs.map((job) => (
              <li key={job.id}>
                <Link to={`/jobs/${job.id}`} className="flex items-center gap-3 px-5 py-4 hover:bg-gray-50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-900">{job.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {job.client ? `${job.client.firstName} ${job.client.lastName}` : "No client"}
                      {job.scheduledStart ? ` · ${new Date(job.scheduledStart).toLocaleDateString()}` : ""}
                    </p>
                  </div>
                  <span className={`badge ${statusColors[job.status]}`}>{job.status}</span>
                  {job.isRecurring && <span className="badge bg-purple-100 text-purple-700">Recurring</span>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {showModal && <JobModal onClose={() => setShowModal(false)} onSaved={load} />}
    </div>
  );
}

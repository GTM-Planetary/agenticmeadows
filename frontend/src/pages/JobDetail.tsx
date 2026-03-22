import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { jobsApi, clientsApi, settingsApi } from "../api";
import { api } from "../api/client";
import type { Job, JobStatus, ChecklistItem, JobPhoto, Client } from "../types";
import SitePhotoSection from "../components/jobs/SitePhotoSection";
import AIChatPanel from "../components/layout/AIChatPanel";

const DEFAULT_JOB_TYPES = [
  "Mow", "Fertilize", "Weed Control", "Aeration", "Overseeding",
  "Spring Cleanup", "Fall Cleanup", "Mulch", "Hedge Trimming", "Edging",
  "Leaf Removal", "Snow Removal", "Irrigation Check", "Tree Trimming",
  "Garden Maintenance", "Landscape Design", "Hardscape", "Other",
];

const statusColors: Record<JobStatus, string> = {
  PENDING: "bg-yellow-100 text-yellow-700",
  SCHEDULED: "bg-blue-100 text-blue-700",
  IN_PROGRESS: "bg-turf-100 text-turf-700",
  COMPLETED: "bg-gray-100 text-gray-600",
  CANCELLED: "bg-red-100 text-red-600",
};

const statusTransitions: Record<JobStatus, JobStatus[]> = {
  PENDING: ["SCHEDULED", "CANCELLED"],
  SCHEDULED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

// ── Checklist sub-component ──────────────────────────────────────────────

function ChecklistCard({
  items,
  doneCount,
  onToggle,
  onAdd,
}: {
  items: ChecklistItem[];
  doneCount: number;
  onToggle: (i: number) => void;
  onAdd: (text: string) => void;
}) {
  const [newText, setNewText] = useState("");

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (newText.trim()) {
      onAdd(newText);
      setNewText("");
    }
  }

  return (
    <div className="card">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <h2 className="font-semibold text-gray-900">Checklist</h2>
        {items.length > 0 && (
          <span className="text-xs text-gray-400">{doneCount}/{items.length} done</span>
        )}
      </div>
      <div className="px-5 py-3 space-y-2">
        {items.map((item, i) => (
          <label key={i} className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={item.done}
              onChange={() => onToggle(i)}
              className="rounded border-gray-300 text-turf-600 focus:ring-turf-500 w-4 h-4"
            />
            <span className={`text-sm ${item.done ? "line-through text-gray-400" : "text-gray-700"}`}>
              {item.text}
            </span>
          </label>
        ))}
        <form onSubmit={handleAdd} className="flex gap-2 pt-1">
          <input
            className="input text-sm flex-1"
            placeholder="Add checklist item..."
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
          />
          <button type="submit" disabled={!newText.trim()} className="btn-secondary text-sm px-3">
            Add
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Helper to format datetime-local value ─────────────────────────────────

function toDatetimeLocal(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ── Main page ─────────────────────────────────────────────────────────────

export default function JobDetail() {
  const { id } = useParams<{ id: string }>();
  const [job, setJob] = useState<Job | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [prefillMessage, setPrefillMessage] = useState<string | undefined>();

  // Edit mode state
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    clientId: "",
    propertyId: "",
    assignedUserId: "",
    scheduledStart: "",
    scheduledEnd: "",
    notes: "",
  });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [clients, setClients] = useState<Client[]>([]);
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [jobTypes, setJobTypes] = useState<string[]>(DEFAULT_JOB_TYPES);
  const [customJobType, setCustomJobType] = useState("");

  useEffect(() => {
    if (id) jobsApi.get(id).then(setJob).catch(console.error);
  }, [id]);

  function enterEditMode() {
    if (!job) return;
    // Determine if existing title matches a known job type or is custom
    settingsApi.getJobTypes()
      .then((d) => {
        setJobTypes(d.jobTypes);
        if (d.jobTypes.includes(job.title)) {
          setEditForm((prev) => ({ ...prev, title: job.title }));
          setCustomJobType("");
        } else {
          setEditForm((prev) => ({ ...prev, title: "Other" }));
          setCustomJobType(job.title);
        }
      })
      .catch(() => {
        setJobTypes(DEFAULT_JOB_TYPES);
        if (DEFAULT_JOB_TYPES.includes(job.title)) {
          setCustomJobType("");
        } else {
          setEditForm((prev) => ({ ...prev, title: "Other" }));
          setCustomJobType(job.title);
        }
      });
    setEditForm({
      title: job.title,
      description: job.description || "",
      clientId: job.clientId,
      propertyId: job.propertyId || "",
      assignedUserId: job.assignedUserId || "",
      scheduledStart: toDatetimeLocal(job.scheduledStart),
      scheduledEnd: toDatetimeLocal(job.scheduledEnd),
      notes: job.notes || "",
    });
    setEditError("");
    setEditing(true);
    // Load clients and users for pickers
    clientsApi.list().then(setClients).catch(console.error);
    api<{ id: string; name: string }[]>("/api/users")
      .then(setUsers)
      .catch(() => setUsers([]));
  }

  function cancelEdit() {
    setEditing(false);
    setEditError("");
  }

  const resolvedEditTitle = editForm.title === "Other" ? customJobType : editForm.title;

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    setEditSaving(true);
    setEditError("");
    try {
      const updated = await jobsApi.update(id, {
        title: resolvedEditTitle,
        description: editForm.description || undefined,
        clientId: editForm.clientId,
        propertyId: editForm.propertyId || undefined,
        assignedUserId: editForm.assignedUserId || undefined,
        scheduledStart: editForm.scheduledStart || undefined,
        scheduledEnd: editForm.scheduledEnd || undefined,
        notes: editForm.notes || undefined,
      });
      setJob(updated);
      setEditing(false);
    } catch (e: any) {
      setEditError(e.message);
    } finally {
      setEditSaving(false);
    }
  }

  async function updateStatus(status: JobStatus) {
    if (!id) return;
    try {
      const updated = await jobsApi.update(id, { status });
      setJob(updated);
    } catch (e: any) {
      alert(e.message);
    }
  }

  async function toggleChecklist(idx: number) {
    if (!job || !id) return;
    const items = [...(job.checklistItems ?? [])];
    items[idx] = { ...items[idx], done: !items[idx].done };
    const updated = await jobsApi.update(id, { checklistItems: items });
    setJob(updated);
  }

  async function addChecklistItem(text: string) {
    if (!job || !id) return;
    const items = [...(job.checklistItems ?? []), { text, done: false }];
    const updated = await jobsApi.update(id, { checklistItems: items });
    setJob(updated);
  }

  function handleAskAI(message: string) {
    setPrefillMessage(message);
    setChatOpen(true);
  }

  function handlePhotosChange(photos: JobPhoto[]) {
    if (job) setJob({ ...job, photos });
  }

  if (!job) return <div className="text-gray-400 p-8">Loading...</div>;

  const transitions = statusTransitions[job.status];
  const checklist = job.checklistItems ?? [];
  const doneCount = checklist.filter((i) => i.done).length;

  // Find properties for selected client in edit mode
  const selectedClient = clients.find((c) => c.id === editForm.clientId);
  const clientProperties = selectedClient?.properties ?? [];

  return (
    <>
      <div className="max-w-3xl mx-auto space-y-5 pb-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Link to="/jobs" className="hover:text-turf-600">Jobs</Link>
          <span>/</span>
          <span className="truncate">{job.client ? `${job.client.firstName} ${job.client.lastName}` : job.title}</span>
          {job.client && <><span>/</span><span className="truncate text-gray-400">{job.title}</span></>}
        </div>

        {/* Header */}
        <div className="card p-5">
          {editing ? (
            /* ── Edit Mode ────────────────────────────────────── */
            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-semibold text-gray-900">Edit Job</h2>
                <span className={`badge text-sm px-3 py-1 ${statusColors[job.status]}`}>
                  {job.status}
                </span>
              </div>

              <div>
                <label className="label">Job Type *</label>
                <select
                  className="input"
                  required
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                >
                  <option value="">Select type...</option>
                  {jobTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                  {!jobTypes.includes("Other") && <option value="Other">Other</option>}
                </select>
                {editForm.title === "Other" && (
                  <input
                    className="input mt-2"
                    required
                    value={customJobType}
                    onChange={(e) => setCustomJobType(e.target.value)}
                    placeholder="Enter custom job type..."
                  />
                )}
              </div>

              <div>
                <label className="label">Description</label>
                <textarea
                  className="input"
                  rows={2}
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Client *</label>
                  <select
                    className="input"
                    required
                    value={editForm.clientId}
                    onChange={(e) => setEditForm({ ...editForm, clientId: e.target.value, propertyId: "" })}
                  >
                    <option value="">Select client...</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Property</label>
                  <select
                    className="input"
                    value={editForm.propertyId}
                    onChange={(e) => setEditForm({ ...editForm, propertyId: e.target.value })}
                  >
                    <option value="">None</option>
                    {clientProperties.map((p) => (
                      <option key={p.id} value={p.id}>{p.streetAddress}, {p.city}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Scheduled Start</label>
                  <input
                    className="input"
                    type="datetime-local"
                    value={editForm.scheduledStart}
                    onChange={(e) => setEditForm({ ...editForm, scheduledStart: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Scheduled End</label>
                  <input
                    className="input"
                    type="datetime-local"
                    value={editForm.scheduledEnd}
                    onChange={(e) => setEditForm({ ...editForm, scheduledEnd: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="label">Assigned To</label>
                <select
                  className="input"
                  value={editForm.assignedUserId}
                  onChange={(e) => setEditForm({ ...editForm, assignedUserId: e.target.value })}
                >
                  <option value="">Unassigned</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Notes</label>
                <textarea
                  className="input"
                  rows={2}
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                />
              </div>

              {editError && <p className="text-sm text-red-600">{editError}</p>}

              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={editSaving} className="btn-primary text-sm">
                  {editSaving ? "Saving..." : "Save Changes"}
                </button>
                <button type="button" onClick={cancelEdit} className="btn-secondary text-sm">
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            /* ── View Mode ────────────────────────────────────── */
            <>
              <div className="flex items-start justify-between gap-4">
                <div>
                  {job.client ? (
                    <Link to={`/clients/${job.client.id}`} className="text-2xl font-bold text-gray-900 hover:text-turf-700 transition-colors">
                      {job.client.firstName} {job.client.lastName}
                    </Link>
                  ) : (
                    <h1 className="text-2xl font-bold text-gray-900">No Client</h1>
                  )}
                  <p className="text-sm text-gray-500 mt-1">
                    <span className="text-gray-400">Job Type:</span>{" "}
                    <span className="text-gray-700 font-medium">{job.title}</span>
                  </p>
                  {job.property && (
                    <p className="text-sm text-gray-500 mt-0.5">
                      <span className="text-gray-400">Property:</span>{" "}
                      {job.property.streetAddress}, {job.property.city}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={enterEditMode} className="btn-secondary text-sm py-1 px-3">
                    Edit Job
                  </button>
                  <span className={`badge text-sm px-3 py-1 ${statusColors[job.status]}`}>
                    {job.status}
                  </span>
                </div>
              </div>

              {job.description && <p className="text-sm text-gray-600 mt-3">{job.description}</p>}

              <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
                {job.scheduledStart && (
                  <div>
                    <span className="text-gray-400 text-xs">Start: </span>
                    {new Date(job.scheduledStart).toLocaleString()}
                  </div>
                )}
                {job.scheduledEnd && (
                  <div>
                    <span className="text-gray-400 text-xs">End: </span>
                    {new Date(job.scheduledEnd).toLocaleString()}
                  </div>
                )}
                {job.assignedUser && (
                  <div>
                    <span className="text-gray-400 text-xs">Assigned: </span>
                    {job.assignedUser.name}
                  </div>
                )}
              </div>

              {job.notes && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <span className="text-gray-400 text-xs">Notes: </span>
                  <p className="text-sm text-gray-600 mt-0.5">{job.notes}</p>
                </div>
              )}

              {/* Status transitions */}
              {transitions.length > 0 && (
                <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
                  <span className="text-xs text-gray-400 self-center mr-1">Move to:</span>
                  {transitions.map((s) => (
                    <button key={s} onClick={() => updateStatus(s)} className="btn-secondary text-xs py-1 px-3">
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Checklist */}
        <ChecklistCard
          items={checklist}
          doneCount={doneCount}
          onToggle={toggleChecklist}
          onAdd={addChecklistItem}
        />

        {/* Site Photos & AI Mapping */}
        <SitePhotoSection
          jobId={job.id}
          clientId={job.clientId}
          photos={job.photos ?? []}
          onPhotosChange={handlePhotosChange}
          onAskAI={handleAskAI}
        />

        {/* AI CTA */}
        <div className="bg-turf-50 border border-turf-200 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="font-semibold text-turf-800 text-sm">AgenticMeadows</p>
            <p className="text-turf-600 text-xs mt-0.5">
              Upload a photo and ask me to analyze it, or say "Draft a quote" to get started
            </p>
          </div>
          <button onClick={() => setChatOpen(true)} className="btn-primary text-sm">
            Open AI Chat
          </button>
        </div>
      </div>

      {/* AI Chat Panel with job context */}
      <AIChatPanel
        isOpen={chatOpen}
        onClose={() => {
          setChatOpen(false);
          setPrefillMessage(undefined);
        }}
        clientId={job.clientId}
        jobId={job.id}
        prefillMessage={prefillMessage}
      />
    </>
  );
}

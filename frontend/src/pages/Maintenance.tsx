import { useState, useEffect, useCallback } from "react";
import { maintenanceApi, propertyHealthApi, propertiesApi } from "../api";

// ── Types & Constants ────────────────────────────────────────────────────

type Tab = "alerts" | "equipment" | "health";

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "alerts", label: "Alerts", icon: "\u26A0\uFE0F" },
  { key: "equipment", label: "Equipment", icon: "\uD83D\uDE9C" },
  { key: "health", label: "Property Health", icon: "\uD83C\uDF31" },
];

const EQUIPMENT_TYPE_ICONS: Record<string, string> = {
  MOWER: "\uD83D\uDE9C",
  TRIMMER: "\u2702\uFE0F",
  BLOWER: "\uD83C\uDF2A\uFE0F",
  EDGER: "\uD83D\uDD2A",
  AERATOR: "\uD83D\uDD73\uFE0F",
  SPRAYER: "\uD83D\uDCA6",
  CHAINSAW: "\uD83E\uDE93",
  VEHICLE: "\uD83D\uDE97",
  TRAILER: "\uD83D\uDE9B",
  OTHER: "\uD83D\uDD27",
};

const EQUIPMENT_TYPES = [
  "MOWER", "TRIMMER", "BLOWER", "EDGER", "AERATOR",
  "SPRAYER", "CHAINSAW", "VEHICLE", "TRAILER", "OTHER",
];

const CATEGORIES = ["EQUIPMENT", "VEHICLE", "TRAILER"];

const INTERVAL_TYPES = ["HOURS", "MILES", "DAYS", "MONTHS"];

const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: "bg-red-100 text-red-700",
  HIGH: "bg-orange-100 text-orange-700",
  NORMAL: "bg-yellow-100 text-yellow-700",
  LOW: "bg-gray-100 text-gray-600",
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-700",
  IN_SERVICE: "bg-yellow-100 text-yellow-700",
  RETIRED: "bg-gray-100 text-gray-600",
};

const CATEGORY_COLORS: Record<string, string> = {
  EQUIPMENT: "bg-blue-100 text-blue-700",
  VEHICLE: "bg-purple-100 text-purple-700",
  TRAILER: "bg-indigo-100 text-indigo-700",
};

function fmtDate(d: string | null | undefined): string {
  if (!d) return "\u2014";
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function healthColor(score: number): string {
  if (score >= 80) return "bg-green-500";
  if (score >= 50) return "bg-yellow-500";
  return "bg-red-500";
}

function healthTextColor(score: number): string {
  if (score >= 80) return "text-green-700";
  if (score >= 50) return "text-yellow-700";
  return "text-red-700";
}

// ── Log Service Modal ────────────────────────────────────────────────────

function LogServiceModal({
  equipmentId,
  equipmentName,
  schedules,
  onClose,
  onSaved,
}: {
  equipmentId: string;
  equipmentName: string;
  schedules?: any[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    taskName: "",
    hoursAtService: "",
    mileageAtService: "",
    cost: "",
    vendor: "",
    notes: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await maintenanceApi.logMaintenance(equipmentId, {
        taskName: form.taskName,
        hoursAtService: form.hoursAtService ? Number(form.hoursAtService) : undefined,
        mileageAtService: form.mileageAtService ? Number(form.mileageAtService) : undefined,
        cost: form.cost ? Number(form.cost) : undefined,
        vendor: form.vendor || undefined,
        notes: form.notes || undefined,
      });
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to log service");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 overflow-auto">
      <div className="card w-full max-w-lg p-6 my-4">
        <h2 className="font-bold text-lg mb-1">Log Service</h2>
        <p className="text-sm text-gray-500 mb-4">{equipmentName}</p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="label">Task *</label>
            {schedules && schedules.length > 0 ? (
              <select
                className="input"
                required
                value={form.taskName}
                onChange={(e) => setForm({ ...form, taskName: e.target.value })}
              >
                <option value="">Select task...</option>
                {schedules.map((s: any) => (
                  <option key={s.id} value={s.taskName}>
                    {s.taskName}
                  </option>
                ))}
                <option value="__custom">Other (custom)</option>
              </select>
            ) : (
              <input
                className="input"
                required
                placeholder="Oil Change, Blade Sharpening, etc."
                value={form.taskName}
                onChange={(e) => setForm({ ...form, taskName: e.target.value })}
              />
            )}
            {form.taskName === "__custom" && (
              <input
                className="input mt-2"
                required
                placeholder="Enter custom task name"
                value=""
                onChange={(e) => setForm({ ...form, taskName: e.target.value })}
              />
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Hours at Service</label>
              <input
                className="input"
                type="number"
                min={0}
                step={0.1}
                placeholder="0"
                value={form.hoursAtService}
                onChange={(e) => setForm({ ...form, hoursAtService: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Mileage at Service</label>
              <input
                className="input"
                type="number"
                min={0}
                placeholder="0"
                value={form.mileageAtService}
                onChange={(e) => setForm({ ...form, mileageAtService: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Cost ($)</label>
              <input
                className="input"
                type="number"
                min={0}
                step={0.01}
                placeholder="0.00"
                value={form.cost}
                onChange={(e) => setForm({ ...form, cost: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Vendor</label>
              <input
                className="input"
                placeholder="Dealer name, shop, etc."
                value={form.vendor}
                onChange={(e) => setForm({ ...form, vendor: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea
              className="input"
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center">
              {loading ? "Saving..." : "Log Service"}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Add Equipment Modal ──────────────────────────────────────────────────

function AddEquipmentModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: "",
    type: "MOWER",
    category: "EQUIPMENT",
    make: "",
    model: "",
    serialNumber: "",
    year: "",
    purchaseDate: "",
    purchasePrice: "",
    notes: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await maintenanceApi.createEquipment({
        name: form.name,
        type: form.type,
        category: form.category,
        make: form.make || undefined,
        model: form.model || undefined,
        serialNumber: form.serialNumber || undefined,
        year: form.year ? Number(form.year) : undefined,
        purchaseDate: form.purchaseDate || undefined,
        purchasePrice: form.purchasePrice ? Number(form.purchasePrice) : undefined,
        notes: form.notes || undefined,
      });
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to create equipment");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 overflow-auto">
      <div className="card w-full max-w-2xl p-6 my-4">
        <h2 className="font-bold text-lg mb-4">Add Equipment</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="label">Name *</label>
            <input
              className="input"
              required
              placeholder='e.g. "John Deere Z540R" or "F-150 Work Truck"'
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Type *</label>
              <select
                className="input"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
              >
                {EQUIPMENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {EQUIPMENT_TYPE_ICONS[t]} {t.charAt(0) + t.slice(1).toLowerCase()}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Category *</label>
              <select
                className="input"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c.charAt(0) + c.slice(1).toLowerCase()}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Make</label>
              <input
                className="input"
                placeholder="John Deere, Stihl, etc."
                value={form.make}
                onChange={(e) => setForm({ ...form, make: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Model</label>
              <input
                className="input"
                placeholder="Z540R, FS 91 R, etc."
                value={form.model}
                onChange={(e) => setForm({ ...form, model: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Serial Number</label>
              <input
                className="input"
                placeholder="SN-12345"
                value={form.serialNumber}
                onChange={(e) => setForm({ ...form, serialNumber: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Year</label>
              <input
                className="input"
                type="number"
                min={1980}
                max={2030}
                placeholder="2024"
                value={form.year}
                onChange={(e) => setForm({ ...form, year: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Purchase Date</label>
              <input
                className="input"
                type="date"
                value={form.purchaseDate}
                onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="label">Purchase Price ($)</label>
            <input
              className="input"
              type="number"
              min={0}
              step={0.01}
              placeholder="0.00"
              value={form.purchasePrice}
              onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea
              className="input"
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center">
              {loading ? "Saving..." : "Add Equipment"}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Add Schedule Modal ───────────────────────────────────────────────────

function AddScheduleModal({
  equipmentId,
  onClose,
  onSaved,
}: {
  equipmentId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    taskName: "",
    intervalType: "HOURS",
    intervalValue: "",
    estimatedCost: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await maintenanceApi.addSchedule(equipmentId, {
        taskName: form.taskName,
        intervalType: form.intervalType,
        intervalValue: Number(form.intervalValue),
        estimatedCost: form.estimatedCost ? Number(form.estimatedCost) : undefined,
      });
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to add schedule");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 overflow-auto">
      <div className="card w-full max-w-md p-6 my-4">
        <h2 className="font-bold text-lg mb-4">Add Maintenance Schedule</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="label">Task Name *</label>
            <input
              className="input"
              required
              placeholder="Oil Change, Belt Replacement, etc."
              value={form.taskName}
              onChange={(e) => setForm({ ...form, taskName: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Interval Type *</label>
              <select
                className="input"
                value={form.intervalType}
                onChange={(e) => setForm({ ...form, intervalType: e.target.value })}
              >
                {INTERVAL_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.charAt(0) + t.slice(1).toLowerCase()}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Interval Value *</label>
              <input
                className="input"
                type="number"
                min={1}
                required
                placeholder="e.g. 50"
                value={form.intervalValue}
                onChange={(e) => setForm({ ...form, intervalValue: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="label">Estimated Cost ($)</label>
            <input
              className="input"
              type="number"
              min={0}
              step={0.01}
              placeholder="0.00"
              value={form.estimatedCost}
              onChange={(e) => setForm({ ...form, estimatedCost: e.target.value })}
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center">
              {loading ? "Saving..." : "Add Schedule"}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Update Hours/Mileage Modal ───────────────────────────────────────────

function UpdateMetricsModal({
  equipment,
  onClose,
  onSaved,
}: {
  equipment: any;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [hours, setHours] = useState(String(equipment.currentHours ?? ""));
  const [mileage, setMileage] = useState(String(equipment.currentMileage ?? ""));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await maintenanceApi.updateEquipment(equipment.id, {
        currentHours: hours ? Number(hours) : undefined,
        currentMileage: mileage ? Number(mileage) : undefined,
      });
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to update");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 overflow-auto">
      <div className="card w-full max-w-sm p-6 my-4">
        <h2 className="font-bold text-lg mb-1">Update Hours / Mileage</h2>
        <p className="text-sm text-gray-500 mb-4">{equipment.name}</p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="label">Current Hours</label>
            <input
              className="input"
              type="number"
              min={0}
              step={0.1}
              value={hours}
              onChange={(e) => setHours(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Current Mileage</label>
            <input
              className="input"
              type="number"
              min={0}
              value={mileage}
              onChange={(e) => setMileage(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center">
              {loading ? "Saving..." : "Update"}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── New Assessment Modal ─────────────────────────────────────────────────

function NewAssessmentModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [propertySearch, setPropertySearch] = useState("");
  const [properties, setProperties] = useState<any[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [form, setForm] = useState({
    overallScore: 75,
    lawnScore: 75,
    irrigationScore: 75,
    treesScore: 75,
    hardscapeScore: 75,
    soilPH: "",
    moisture: "",
    thatchDepth: "",
    grassHeight: "",
    weedDensity: "NONE",
    pestPresence: "NONE",
    notes: "",
  });
  const [predictedNeeds, setPredictedNeeds] = useState<
    { serviceName: string; dueDate: string; reason: string; priority: string }[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (propertySearch.length >= 2) {
      propertiesApi.search(propertySearch).then(setProperties).catch(console.error);
    }
  }, [propertySearch]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPropertyId) {
      setError("Please select a property");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await propertyHealthApi.assess(selectedPropertyId, {
        overallScore: form.overallScore,
        lawnScore: form.lawnScore,
        irrigationScore: form.irrigationScore,
        treesScore: form.treesScore,
        hardscapeScore: form.hardscapeScore,
        soilPH: form.soilPH ? Number(form.soilPH) : undefined,
        moisture: form.moisture ? Number(form.moisture) : undefined,
        thatchDepth: form.thatchDepth ? Number(form.thatchDepth) : undefined,
        grassHeight: form.grassHeight ? Number(form.grassHeight) : undefined,
        weedDensity: form.weedDensity,
        pestPresence: form.pestPresence,
        notes: form.notes || undefined,
        predictedNeeds: predictedNeeds.length > 0 ? predictedNeeds : undefined,
      });
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save assessment");
    } finally {
      setLoading(false);
    }
  }

  function addNeed() {
    setPredictedNeeds([
      ...predictedNeeds,
      { serviceName: "", dueDate: "", reason: "", priority: "NORMAL" },
    ]);
  }

  function updateNeed(idx: number, field: string, value: string) {
    setPredictedNeeds(
      predictedNeeds.map((n, i) => (i === idx ? { ...n, [field]: value } : n))
    );
  }

  function removeNeed(idx: number) {
    setPredictedNeeds(predictedNeeds.filter((_, i) => i !== idx));
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 overflow-auto">
      <div className="card w-full max-w-2xl p-6 my-4 max-h-[90vh] overflow-y-auto">
        <h2 className="font-bold text-lg mb-4">New Property Health Assessment</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Property Selector */}
          <div>
            <label className="label">Property *</label>
            <input
              className="input"
              placeholder="Search by address..."
              value={propertySearch}
              onChange={(e) => {
                setPropertySearch(e.target.value);
                setSelectedPropertyId("");
              }}
            />
            {properties.length > 0 && !selectedPropertyId && propertySearch.length >= 2 && (
              <div className="border border-gray-200 rounded-lg mt-1 max-h-40 overflow-y-auto bg-white shadow-sm">
                {properties.map((p: any) => (
                  <button
                    key={p.id}
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b border-gray-50 last:border-0"
                    onClick={() => {
                      setSelectedPropertyId(p.id);
                      setPropertySearch(p.address || p.name || p.id);
                    }}
                  >
                    {p.address || p.name}
                    {p.city && <span className="text-gray-400 ml-1">{p.city}, {p.state}</span>}
                  </button>
                ))}
              </div>
            )}
            {selectedPropertyId && (
              <p className="text-xs text-green-600 mt-1">Property selected</p>
            )}
          </div>

          {/* Score Sliders */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700">Health Scores</h3>
            {(
              [
                { key: "overallScore", label: "Overall" },
                { key: "lawnScore", label: "Lawn" },
                { key: "irrigationScore", label: "Irrigation" },
                { key: "treesScore", label: "Trees" },
                { key: "hardscapeScore", label: "Hardscape" },
              ] as { key: keyof typeof form; label: string }[]
            ).map(({ key, label }) => (
              <div key={key} className="flex items-center gap-3">
                <label className="w-24 text-sm text-gray-600">{label}</label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  className="flex-1 accent-turf-600"
                  value={form[key] as number}
                  onChange={(e) =>
                    setForm({ ...form, [key]: Number(e.target.value) })
                  }
                />
                <span
                  className={`text-sm font-semibold w-10 text-right ${healthTextColor(
                    form[key] as number
                  )}`}
                >
                  {String(form[key])}
                </span>
              </div>
            ))}
          </div>

          {/* Additional Fields */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Soil pH</label>
              <input
                className="input"
                type="number"
                min={0}
                max={14}
                step={0.1}
                placeholder="6.5"
                value={form.soilPH}
                onChange={(e) => setForm({ ...form, soilPH: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Moisture (%)</label>
              <input
                className="input"
                type="number"
                min={0}
                max={100}
                placeholder="40"
                value={form.moisture}
                onChange={(e) => setForm({ ...form, moisture: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Thatch Depth (in)</label>
              <input
                className="input"
                type="number"
                min={0}
                step={0.1}
                placeholder="0.5"
                value={form.thatchDepth}
                onChange={(e) => setForm({ ...form, thatchDepth: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Grass Height (in)</label>
              <input
                className="input"
                type="number"
                min={0}
                step={0.1}
                placeholder="3.0"
                value={form.grassHeight}
                onChange={(e) => setForm({ ...form, grassHeight: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Weed Density</label>
              <select
                className="input"
                value={form.weedDensity}
                onChange={(e) => setForm({ ...form, weedDensity: e.target.value })}
              >
                <option value="NONE">None</option>
                <option value="LOW">Low</option>
                <option value="MODERATE">Moderate</option>
                <option value="HIGH">High</option>
              </select>
            </div>
            <div>
              <label className="label">Pest Presence</label>
              <select
                className="input"
                value={form.pestPresence}
                onChange={(e) => setForm({ ...form, pestPresence: e.target.value })}
              >
                <option value="NONE">None</option>
                <option value="LOW">Low</option>
                <option value="MODERATE">Moderate</option>
                <option value="HIGH">High</option>
              </select>
            </div>
          </div>

          {/* Predicted Needs */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-700">Predicted Needs</h3>
              <button type="button" onClick={addNeed} className="text-xs text-turf-600 hover:underline">
                + Add Predicted Need
              </button>
            </div>
            {predictedNeeds.length === 0 && (
              <p className="text-xs text-gray-400">No predicted needs added yet.</p>
            )}
            <div className="space-y-2">
              {predictedNeeds.map((need, i) => (
                <div key={i} className="flex gap-2 items-start bg-gray-50 rounded-lg p-2">
                  <input
                    className="input flex-1 text-sm"
                    placeholder="Service name"
                    value={need.serviceName}
                    onChange={(e) => updateNeed(i, "serviceName", e.target.value)}
                  />
                  <input
                    className="input w-32 text-sm"
                    type="date"
                    value={need.dueDate}
                    onChange={(e) => updateNeed(i, "dueDate", e.target.value)}
                  />
                  <input
                    className="input flex-1 text-sm"
                    placeholder="Reason"
                    value={need.reason}
                    onChange={(e) => updateNeed(i, "reason", e.target.value)}
                  />
                  <select
                    className="input w-24 text-sm"
                    value={need.priority}
                    onChange={(e) => updateNeed(i, "priority", e.target.value)}
                  >
                    <option value="LOW">Low</option>
                    <option value="NORMAL">Normal</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => removeNeed(i)}
                    className="text-red-400 hover:text-red-600 px-1 mt-2"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="label">Notes</label>
            <textarea
              className="input"
              rows={3}
              placeholder="Additional observations, recommendations..."
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center">
              {loading ? "Saving..." : "Save Assessment"}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Alerts Tab ───────────────────────────────────────────────────────────

function AlertsTab() {
  const [alerts, setAlerts] = useState<any>(null);
  const [predictions, setPredictions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [logTarget, setLogTarget] = useState<{
    equipmentId: string;
    equipmentName: string;
    schedules?: any[];
  } | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      maintenanceApi.getAlerts().catch(() => null),
      propertyHealthApi.predictions().catch(() => []),
    ])
      .then(([a, p]) => {
        setAlerts(a);
        setPredictions(Array.isArray(p) ? p : []);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="py-16 text-center text-gray-400">
        <div className="inline-block w-6 h-6 border-2 border-turf-500 border-t-transparent rounded-full animate-spin mb-3" />
        <p>Loading alerts...</p>
      </div>
    );
  }

  const alertItems: any[] = Array.isArray(alerts)
    ? alerts
    : alerts?.alerts ?? alerts?.items ?? [];

  const hasAlerts = alertItems.length > 0;
  const hasPredictions = predictions.length > 0;

  if (!hasAlerts && !hasPredictions) {
    return (
      <div className="card py-16 text-center">
        <div className="text-5xl mb-3 text-green-500">&#10003;</div>
        <h2 className="text-lg font-semibold text-green-700 mb-1">All Clear</h2>
        <p className="text-sm text-gray-500">
          No maintenance alerts or predicted property needs at this time.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Equipment Maintenance Alerts */}
      {hasAlerts && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
            Equipment Maintenance Alerts
          </h2>
          <div className="space-y-3">
            {alertItems.map((alert: any, i: number) => {
              const icon =
                EQUIPMENT_TYPE_ICONS[alert.equipmentType] ||
                EQUIPMENT_TYPE_ICONS[alert.type] ||
                "\uD83D\uDD27";
              const priority = alert.priority || "NORMAL";
              const isOverdue =
                alert.status === "OVERDUE" || alert.isOverdue === true;

              return (
                <div
                  key={alert.id || i}
                  className="card p-4 flex items-start gap-4 hover:shadow-md transition-shadow"
                >
                  <span className="text-2xl mt-0.5">{icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-gray-900">
                        {alert.equipmentName || alert.name}
                      </h3>
                      <span
                        className={`badge text-xs ${PRIORITY_COLORS[priority] || PRIORITY_COLORS.NORMAL}`}
                      >
                        {priority}
                      </span>
                      {isOverdue ? (
                        <span className="badge text-xs bg-red-100 text-red-700">
                          OVERDUE
                        </span>
                      ) : (
                        <span className="badge text-xs bg-amber-100 text-amber-700">
                          DUE SOON
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      {alert.message || alert.description || alert.taskName}
                    </p>
                    {alert.dueDate && (
                      <p className="text-xs text-gray-400 mt-1">
                        Due: {fmtDate(alert.dueDate)}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() =>
                      setLogTarget({
                        equipmentId: alert.equipmentId || alert.id,
                        equipmentName: alert.equipmentName || alert.name,
                        schedules: alert.schedules,
                      })
                    }
                    className="btn-primary text-sm shrink-0"
                  >
                    Log Service
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Property Health Predictions */}
      {hasPredictions && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
            Property Health Predictions
          </h2>
          <div className="space-y-3">
            {predictions.map((pred: any, i: number) => (
              <div
                key={pred.id || i}
                className="card p-4 flex items-start gap-4 hover:shadow-md transition-shadow"
              >
                <span className="text-2xl mt-0.5">{"\uD83C\uDFE0"}</span>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900">
                    {pred.propertyAddress || pred.address || "Property"}
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {pred.serviceName || pred.predictedService || pred.description}
                  </p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                    {pred.dueDate && <span>Due: {fmtDate(pred.dueDate)}</span>}
                    {pred.reason && (
                      <span className="text-gray-500">
                        Reason: {pred.reason}
                      </span>
                    )}
                  </div>
                </div>
                {pred.priority && (
                  <span
                    className={`badge text-xs ${PRIORITY_COLORS[pred.priority] || PRIORITY_COLORS.NORMAL}`}
                  >
                    {pred.priority}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {logTarget && (
        <LogServiceModal
          equipmentId={logTarget.equipmentId}
          equipmentName={logTarget.equipmentName}
          schedules={logTarget.schedules}
          onClose={() => setLogTarget(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}

// ── Equipment Detail Panel ───────────────────────────────────────────────

function EquipmentDetailPanel({
  equipment,
  onClose,
  onUpdated,
}: {
  equipment: any;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showAddSchedule, setShowAddSchedule] = useState(false);
  const [showLogService, setShowLogService] = useState(false);

  const loadDetail = useCallback(() => {
    setLoading(true);
    maintenanceApi
      .getEquipment(equipment.id)
      .then(setDetail)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [equipment.id]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  const schedules = detail?.schedules ?? detail?.maintenanceSchedules ?? [];
  const logs = detail?.logs ?? detail?.maintenanceLogs ?? [];
  const icon = EQUIPMENT_TYPE_ICONS[equipment.type] || "\uD83D\uDD27";

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-[480px] max-w-full h-full bg-white shadow-xl overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-start justify-between z-10">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xl">{icon}</span>
              <h2 className="font-bold text-lg text-gray-900 truncate">
                {equipment.name}
              </h2>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className={`badge text-xs ${STATUS_COLORS[equipment.status] || "bg-gray-100 text-gray-600"}`}>
                {equipment.status}
              </span>
              <span className={`badge text-xs ${CATEGORY_COLORS[equipment.category] || "bg-gray-100 text-gray-600"}`}>
                {equipment.category}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="ml-3 text-gray-400 hover:text-gray-600 text-xl leading-none flex-shrink-0"
          >
            &#10005;
          </button>
        </div>

        <div className="px-5 py-4 space-y-5">
          {loading ? (
            <div className="py-8 text-center text-gray-400">
              <div className="inline-block w-5 h-5 border-2 border-turf-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                {detail?.make && (
                  <div>
                    <span className="text-gray-400">Make</span>
                    <p className="font-medium">{detail.make}</p>
                  </div>
                )}
                {detail?.model && (
                  <div>
                    <span className="text-gray-400">Model</span>
                    <p className="font-medium">{detail.model}</p>
                  </div>
                )}
                {detail?.year && (
                  <div>
                    <span className="text-gray-400">Year</span>
                    <p className="font-medium">{detail.year}</p>
                  </div>
                )}
                {detail?.serialNumber && (
                  <div>
                    <span className="text-gray-400">Serial #</span>
                    <p className="font-medium">{detail.serialNumber}</p>
                  </div>
                )}
                <div>
                  <span className="text-gray-400">Hours</span>
                  <p className="font-medium">{detail?.currentHours ?? equipment.currentHours ?? "\u2014"}</p>
                </div>
                <div>
                  <span className="text-gray-400">Mileage</span>
                  <p className="font-medium">{detail?.currentMileage ?? equipment.currentMileage ?? "\u2014"}</p>
                </div>
              </div>

              {/* Maintenance Schedules */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-gray-700">
                    Maintenance Schedules
                  </h3>
                  <button
                    onClick={() => setShowAddSchedule(true)}
                    className="text-xs text-turf-600 hover:underline"
                  >
                    + Add Schedule
                  </button>
                </div>
                {schedules.length === 0 ? (
                  <p className="text-xs text-gray-400 py-2">No schedules configured yet.</p>
                ) : (
                  <div className="space-y-2">
                    {schedules.map((s: any) => (
                      <div
                        key={s.id}
                        className="bg-gray-50 rounded-lg px-3 py-2 text-sm flex items-center justify-between"
                      >
                        <div>
                          <p className="font-medium text-gray-800">{s.taskName}</p>
                          <p className="text-xs text-gray-500">
                            Every {s.intervalValue} {s.intervalType?.toLowerCase()}
                            {s.estimatedCost
                              ? ` \u00b7 ~$${Number(s.estimatedCost).toFixed(2)}`
                              : ""}
                          </p>
                        </div>
                        {s.nextDue && (
                          <span className="text-xs text-gray-400">
                            Next: {fmtDate(s.nextDue)}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent Maintenance Logs */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-gray-700">
                    Recent Service Log
                  </h3>
                  <button
                    onClick={() => setShowLogService(true)}
                    className="text-xs text-turf-600 hover:underline"
                  >
                    + Log Service
                  </button>
                </div>
                {logs.length === 0 ? (
                  <p className="text-xs text-gray-400 py-2">No service history recorded yet.</p>
                ) : (
                  <div className="space-y-2">
                    {logs.slice(0, 10).map((log: any) => (
                      <div
                        key={log.id}
                        className="bg-gray-50 rounded-lg px-3 py-2 text-sm"
                      >
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-gray-800">
                            {log.taskName}
                          </p>
                          <span className="text-xs text-gray-400">
                            {fmtDate(log.completedAt || log.createdAt)}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 flex gap-3 mt-0.5">
                          {log.cost != null && (
                            <span>${Number(log.cost).toFixed(2)}</span>
                          )}
                          {log.vendor && <span>{log.vendor}</span>}
                          {log.hoursAtService != null && (
                            <span>{log.hoursAtService} hrs</span>
                          )}
                          {log.mileageAtService != null && (
                            <span>{log.mileageAtService} mi</span>
                          )}
                        </div>
                        {log.notes && (
                          <p className="text-xs text-gray-400 mt-1">
                            {log.notes}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {detail?.notes && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-1">Notes</h3>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">{detail.notes}</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {showAddSchedule && (
        <AddScheduleModal
          equipmentId={equipment.id}
          onClose={() => setShowAddSchedule(false)}
          onSaved={() => {
            loadDetail();
            onUpdated();
          }}
        />
      )}

      {showLogService && (
        <LogServiceModal
          equipmentId={equipment.id}
          equipmentName={equipment.name}
          schedules={schedules}
          onClose={() => setShowLogService(false)}
          onSaved={() => {
            loadDetail();
            onUpdated();
          }}
        />
      )}
    </div>
  );
}

// ── Equipment Tab ────────────────────────────────────────────────────────

function EquipmentTab() {
  const [equipment, setEquipment] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [updateTarget, setUpdateTarget] = useState<any>(null);

  const load = useCallback(() => {
    setLoading(true);
    maintenanceApi
      .listEquipment()
      .then((data) => setEquipment(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="py-16 text-center text-gray-400">
        <div className="inline-block w-6 h-6 border-2 border-turf-500 border-t-transparent rounded-full animate-spin mb-3" />
        <p>Loading equipment...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {equipment.length} piece{equipment.length !== 1 ? "s" : ""} of equipment
        </p>
        <button onClick={() => setShowAdd(true)} className="btn-primary">
          + Add Equipment
        </button>
      </div>

      <div className="card overflow-hidden">
        {equipment.length === 0 ? (
          <div className="py-12 text-center text-gray-400">
            No equipment yet.{" "}
            <button
              onClick={() => setShowAdd(true)}
              className="text-turf-600 hover:underline"
            >
              Add your first piece &rarr;
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-5 py-3 font-medium text-gray-600">
                    Name
                  </th>
                  <th className="text-left px-5 py-3 font-medium text-gray-600">
                    Type
                  </th>
                  <th className="text-left px-5 py-3 font-medium text-gray-600">
                    Category
                  </th>
                  <th className="text-left px-5 py-3 font-medium text-gray-600">
                    Status
                  </th>
                  <th className="text-right px-5 py-3 font-medium text-gray-600">
                    Hours
                  </th>
                  <th className="text-right px-5 py-3 font-medium text-gray-600">
                    Mileage
                  </th>
                  <th className="text-left px-5 py-3 font-medium text-gray-600">
                    Assigned To
                  </th>
                  <th className="text-right px-5 py-3 font-medium text-gray-600">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {equipment.map((eq) => {
                  const icon = EQUIPMENT_TYPE_ICONS[eq.type] || "\uD83D\uDD27";
                  return (
                    <tr
                      key={eq.id}
                      onClick={() => setSelected(eq)}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <span>{icon}</span>
                          <span className="font-medium">{eq.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span className="badge bg-gray-100 text-gray-700 text-xs">
                          {eq.type}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`badge text-xs ${CATEGORY_COLORS[eq.category] || "bg-gray-100 text-gray-600"}`}
                        >
                          {eq.category}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`badge text-xs ${STATUS_COLORS[eq.status] || "bg-gray-100 text-gray-600"}`}
                        >
                          {eq.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right text-gray-600">
                        {eq.currentHours ?? "\u2014"}
                      </td>
                      <td className="px-5 py-3 text-right text-gray-600">
                        {eq.currentMileage ?? "\u2014"}
                      </td>
                      <td className="px-5 py-3 text-gray-600">
                        {eq.assignedTo || eq.assignedToName || "\u2014"}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setUpdateTarget(eq);
                          }}
                          className="text-xs text-turf-600 hover:underline"
                        >
                          Update Hrs/Mi
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAdd && (
        <AddEquipmentModal
          onClose={() => setShowAdd(false)}
          onSaved={load}
        />
      )}

      {selected && (
        <EquipmentDetailPanel
          equipment={selected}
          onClose={() => setSelected(null)}
          onUpdated={load}
        />
      )}

      {updateTarget && (
        <UpdateMetricsModal
          equipment={updateTarget}
          onClose={() => setUpdateTarget(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}

// ── Health Score Bar ─────────────────────────────────────────────────────

function HealthBar({
  label,
  score,
  small,
}: {
  label?: string;
  score: number | null | undefined;
  small?: boolean;
}) {
  const val = score ?? 0;
  const color = healthColor(val);
  const height = small ? "h-2" : "h-3";

  return (
    <div className={small ? "" : "mb-2"}>
      {label && (
        <div className="flex items-center justify-between mb-0.5">
          <span className={`${small ? "text-xs" : "text-sm"} text-gray-600`}>
            {label}
          </span>
          <span
            className={`${small ? "text-xs" : "text-sm"} font-semibold ${healthTextColor(val)}`}
          >
            {val}
          </span>
        </div>
      )}
      <div className={`w-full bg-gray-200 rounded-full ${height}`}>
        <div
          className={`${color} ${height} rounded-full transition-all`}
          style={{ width: `${Math.min(Math.max(val, 0), 100)}%` }}
        />
      </div>
    </div>
  );
}

// ── Property Health Tab ──────────────────────────────────────────────────

function PropertyHealthTab() {
  const [healthData, setHealthData] = useState<any[]>([]);
  const [predictions, setPredictions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAssessment, setShowAssessment] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    propertyHealthApi
      .predictions()
      .then((data) => {
        // The predictions endpoint may return health data grouped by property
        // or we may need to aggregate
        setPredictions(Array.isArray(data) ? data : []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Also try to load health assessments if the API supports it
  useEffect(() => {
    load();
    // Try fetching property health data separately
    // The API may return it within predictions or separately
  }, [load]);

  // Group predictions by property for display
  const propertyMap = new Map<string, any>();
  predictions.forEach((p: any) => {
    const key = p.propertyId || p.propertyAddress || p.address || "unknown";
    if (!propertyMap.has(key)) {
      propertyMap.set(key, {
        propertyId: p.propertyId,
        address: p.propertyAddress || p.address || "Unknown Property",
        overallScore: p.overallScore ?? p.healthScore ?? null,
        lawnScore: p.lawnScore ?? null,
        irrigationScore: p.irrigationScore ?? null,
        treesScore: p.treesScore ?? null,
        hardscapeScore: p.hardscapeScore ?? null,
        lastAssessment: p.assessedAt || p.lastAssessment || null,
        needs: [],
      });
    }
    const entry = propertyMap.get(key)!;
    entry.needs.push({
      serviceName: p.serviceName || p.predictedService || p.description,
      dueDate: p.dueDate,
      reason: p.reason,
      priority: p.priority,
    });
    // Update scores if available from a newer prediction
    if (p.overallScore != null) entry.overallScore = p.overallScore;
    if (p.lawnScore != null) entry.lawnScore = p.lawnScore;
    if (p.irrigationScore != null) entry.irrigationScore = p.irrigationScore;
    if (p.treesScore != null) entry.treesScore = p.treesScore;
    if (p.hardscapeScore != null) entry.hardscapeScore = p.hardscapeScore;
    if (p.assessedAt || p.lastAssessment) {
      entry.lastAssessment = p.assessedAt || p.lastAssessment;
    }
  });

  const propertyEntries = Array.from(propertyMap.values());

  if (loading) {
    return (
      <div className="py-16 text-center text-gray-400">
        <div className="inline-block w-6 h-6 border-2 border-turf-500 border-t-transparent rounded-full animate-spin mb-3" />
        <p>Loading property health data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {propertyEntries.length > 0
            ? `${propertyEntries.length} propert${propertyEntries.length !== 1 ? "ies" : "y"} tracked`
            : "No property health data yet"}
        </p>
        <button onClick={() => setShowAssessment(true)} className="btn-primary">
          + New Assessment
        </button>
      </div>

      {propertyEntries.length === 0 ? (
        <div className="card py-16 text-center">
          <p className="text-4xl mb-3">{"\uD83C\uDF31"}</p>
          <h2 className="text-lg font-semibold text-gray-700 mb-1">
            No Property Health Data Yet
          </h2>
          <p className="text-sm text-gray-400">
            Start by creating a health assessment for one of your properties.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {propertyEntries.map((prop, i) => (
            <div key={prop.propertyId || i} className="card p-5 hover:shadow-md transition-shadow">
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900">{prop.address}</h3>
                  {prop.lastAssessment && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      Last assessed: {fmtDate(prop.lastAssessment)}
                    </p>
                  )}
                </div>
                {prop.overallScore != null && (
                  <div
                    className={`text-2xl font-bold ${healthTextColor(prop.overallScore)}`}
                  >
                    {prop.overallScore}
                  </div>
                )}
              </div>

              {/* Overall Health Bar */}
              {prop.overallScore != null && (
                <HealthBar label="Overall Health" score={prop.overallScore} />
              )}

              {/* Sub-scores */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-3">
                {prop.lawnScore != null && (
                  <HealthBar label="Lawn" score={prop.lawnScore} small />
                )}
                {prop.irrigationScore != null && (
                  <HealthBar
                    label="Irrigation"
                    score={prop.irrigationScore}
                    small
                  />
                )}
                {prop.treesScore != null && (
                  <HealthBar label="Trees" score={prop.treesScore} small />
                )}
                {prop.hardscapeScore != null && (
                  <HealthBar
                    label="Hardscape"
                    score={prop.hardscapeScore}
                    small
                  />
                )}
              </div>

              {/* Predicted Needs */}
              {prop.needs.length > 0 && (
                <div className="mt-4 border-t border-gray-100 pt-3">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Predicted Needs
                  </h4>
                  <div className="space-y-1.5">
                    {prop.needs.map((need: any, ni: number) => (
                      <div
                        key={ni}
                        className="flex items-center gap-2 text-sm"
                      >
                        <span
                          className={`badge text-xs ${
                            PRIORITY_COLORS[need.priority] || PRIORITY_COLORS.NORMAL
                          }`}
                        >
                          {need.priority || "NORMAL"}
                        </span>
                        <span className="text-gray-700 flex-1 truncate">
                          {need.serviceName}
                        </span>
                        {need.dueDate && (
                          <span className="text-xs text-gray-400 shrink-0">
                            {fmtDate(need.dueDate)}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showAssessment && (
        <NewAssessmentModal
          onClose={() => setShowAssessment(false)}
          onSaved={load}
        />
      )}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────

export default function Maintenance() {
  const [activeTab, setActiveTab] = useState<Tab>("alerts");

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Predictive Maintenance
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Track fleet vehicles, equipment health, and property conditions
          &mdash; stay ahead of breakdowns and service needs.
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {TABS.map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-1.5 ${
              activeTab === key
                ? "bg-white shadow text-gray-900"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <span className="text-base">{icon}</span>
            {label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "alerts" && <AlertsTab />}
      {activeTab === "equipment" && <EquipmentTab />}
      {activeTab === "health" && <PropertyHealthTab />}
    </div>
  );
}

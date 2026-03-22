import { useState, useEffect } from "react";
import { measurementsApi, chemicalsApi } from "../../api";
import type { Property, PropertyMeasurement, ChemicalApplication } from "../../types";

function reentryStatus(expiresStr?: string): { label: string; color: string } {
  if (!expiresStr) return { label: "N/A", color: "bg-gray-100 text-gray-500" };
  const now = Date.now();
  const expires = new Date(expiresStr).getTime();
  const diff = expires - now;
  if (diff <= 0) return { label: "Clear", color: "bg-green-100 text-green-700" };
  const hoursLeft = diff / (1000 * 60 * 60);
  if (hoursLeft <= 24) return { label: "Active", color: "bg-yellow-100 text-yellow-700" };
  return { label: "Restricted", color: "bg-red-100 text-red-700" };
}

interface MeasurementFormProps {
  propertyId: string;
  onSaved: () => void;
  onCancel: () => void;
}

function MeasurementForm({ propertyId, onSaved, onCancel }: MeasurementFormProps) {
  const [form, setForm] = useState({
    lotSizeSqft: "",
    lawnSqft: "",
    bedSqft: "",
    edgingLinearFt: "",
    hardscapeSqft: "",
    notes: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const data: Partial<PropertyMeasurement> = {
        notes: form.notes || undefined,
      };
      if (form.lotSizeSqft) data.lotSizeSqft = parseFloat(form.lotSizeSqft);
      if (form.lawnSqft) data.lawnSqft = parseFloat(form.lawnSqft);
      if (form.bedSqft) data.bedSqft = parseFloat(form.bedSqft);
      if (form.edgingLinearFt) data.edgingLinearFt = parseFloat(form.edgingLinearFt);
      if (form.hardscapeSqft) data.hardscapeSqft = parseFloat(form.hardscapeSqft);
      await measurementsApi.create(propertyId, data);
      onSaved();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-gray-50 rounded-lg p-4 space-y-3 mt-3">
      <h4 className="font-medium text-sm text-gray-900">New Measurement</h4>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div>
          <label className="label">Lot Size (sqft)</label>
          <input className="input" type="number" step="1" value={form.lotSizeSqft} onChange={(e) => setForm({ ...form, lotSizeSqft: e.target.value })} />
        </div>
        <div>
          <label className="label">Lawn (sqft)</label>
          <input className="input" type="number" step="1" value={form.lawnSqft} onChange={(e) => setForm({ ...form, lawnSqft: e.target.value })} />
        </div>
        <div>
          <label className="label">Beds (sqft)</label>
          <input className="input" type="number" step="1" value={form.bedSqft} onChange={(e) => setForm({ ...form, bedSqft: e.target.value })} />
        </div>
        <div>
          <label className="label">Edging (lin ft)</label>
          <input className="input" type="number" step="1" value={form.edgingLinearFt} onChange={(e) => setForm({ ...form, edgingLinearFt: e.target.value })} />
        </div>
        <div>
          <label className="label">Hardscape (sqft)</label>
          <input className="input" type="number" step="1" value={form.hardscapeSqft} onChange={(e) => setForm({ ...form, hardscapeSqft: e.target.value })} />
        </div>
      </div>
      <div>
        <label className="label">Notes</label>
        <textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? "Saving..." : "Save Measurement"}
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary">Cancel</button>
      </div>
    </form>
  );
}

interface ChemicalFormProps {
  propertyId: string;
  onSaved: () => void;
  onCancel: () => void;
}

function ChemicalForm({ propertyId, onSaved, onCancel }: ChemicalFormProps) {
  const [form, setForm] = useState({
    productName: "",
    epaRegNumber: "",
    applicationRate: "",
    areaTreatedSqft: "",
    targetPest: "",
    reentryHours: "",
    notes: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const data: Partial<ChemicalApplication> = {
        propertyId,
        productName: form.productName,
        epaRegNumber: form.epaRegNumber || undefined,
        applicationRate: form.applicationRate || undefined,
        targetPest: form.targetPest || undefined,
        notes: form.notes || undefined,
        reentryHours: parseInt(form.reentryHours) || 0,
      };
      if (form.areaTreatedSqft) data.areaTreatedSqft = parseFloat(form.areaTreatedSqft);
      await chemicalsApi.create(data);
      onSaved();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-gray-50 rounded-lg p-4 space-y-3 mt-3">
      <h4 className="font-medium text-sm text-gray-900">Log Chemical Application</h4>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Product Name *</label>
          <input className="input" required value={form.productName} onChange={(e) => setForm({ ...form, productName: e.target.value })} />
        </div>
        <div>
          <label className="label">EPA Reg #</label>
          <input className="input" value={form.epaRegNumber} onChange={(e) => setForm({ ...form, epaRegNumber: e.target.value })} />
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div>
          <label className="label">Application Rate</label>
          <input className="input" value={form.applicationRate} onChange={(e) => setForm({ ...form, applicationRate: e.target.value })} />
        </div>
        <div>
          <label className="label">Area Treated (sqft)</label>
          <input className="input" type="number" step="1" value={form.areaTreatedSqft} onChange={(e) => setForm({ ...form, areaTreatedSqft: e.target.value })} />
        </div>
        <div>
          <label className="label">Target Pest</label>
          <input className="input" value={form.targetPest} onChange={(e) => setForm({ ...form, targetPest: e.target.value })} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Re-entry Hours *</label>
          <input className="input" type="number" min="0" required value={form.reentryHours} onChange={(e) => setForm({ ...form, reentryHours: e.target.value })} />
        </div>
      </div>
      <div>
        <label className="label">Notes</label>
        <textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? "Saving..." : "Log Application"}
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary">Cancel</button>
      </div>
    </form>
  );
}

function formatNum(val?: number): string {
  if (val == null) return "\u2014";
  return new Intl.NumberFormat("en-US").format(val);
}

interface Props {
  property: Property;
}

export default function PropertyDetail({ property }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [tab, setTab] = useState<"measurements" | "chemicals">("measurements");
  const [latestMeasurement, setLatestMeasurement] = useState<PropertyMeasurement | null>(null);
  const [chemicals, setChemicals] = useState<ChemicalApplication[]>([]);
  const [showMeasurementForm, setShowMeasurementForm] = useState(false);
  const [showChemicalForm, setShowChemicalForm] = useState(false);

  function loadMeasurements() {
    measurementsApi.latest(property.id)
      .then(setLatestMeasurement)
      .catch(() => setLatestMeasurement(null));
  }

  function loadChemicals() {
    chemicalsApi.byProperty(property.id)
      .then(setChemicals)
      .catch(console.error);
  }

  useEffect(() => {
    if (expanded) {
      loadMeasurements();
      loadChemicals();
    }
  }, [expanded, property.id]);

  return (
    <div className="card overflow-hidden">
      {/* Header - always visible */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors text-left"
      >
        <div>
          <p className="font-medium text-sm text-gray-900">{property.streetAddress}</p>
          <p className="text-xs text-gray-500">{property.city}, {property.state} {property.zip}</p>
        </div>
        <span className="text-gray-400 text-sm">{expanded ? "\u25B2" : "\u25BC"}</span>
      </button>

      {/* Expandable content */}
      {expanded && (
        <div className="border-t border-gray-100 px-5 py-4">
          {/* Tab switcher */}
          <div className="flex gap-1 mb-4">
            <button
              onClick={() => setTab("measurements")}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                tab === "measurements" ? "bg-turf-100 text-turf-700" : "text-gray-500 hover:bg-gray-100"
              }`}
            >
              Measurements
            </button>
            <button
              onClick={() => setTab("chemicals")}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                tab === "chemicals" ? "bg-turf-100 text-turf-700" : "text-gray-500 hover:bg-gray-100"
              }`}
            >
              Chemical History
            </button>
          </div>

          {/* Measurements tab */}
          {tab === "measurements" && (
            <div>
              {latestMeasurement ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-500 mb-1">{"\uD83C\uDFE1"} Lot Size</p>
                    <p className="font-semibold text-sm text-gray-900">{formatNum(latestMeasurement.lotSizeSqft)} sqft</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-500 mb-1">{"\uD83C\uDF3F"} Lawn</p>
                    <p className="font-semibold text-sm text-gray-900">{formatNum(latestMeasurement.lawnSqft)} sqft</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-500 mb-1">{"\uD83C\uDF3A"} Beds</p>
                    <p className="font-semibold text-sm text-gray-900">{formatNum(latestMeasurement.bedSqft)} sqft</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-500 mb-1">{"\uD83D\uDCCF"} Edging</p>
                    <p className="font-semibold text-sm text-gray-900">{formatNum(latestMeasurement.edgingLinearFt)} ft</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-500 mb-1">{"\uD83E\uDDF1"} Hardscape</p>
                    <p className="font-semibold text-sm text-gray-900">{formatNum(latestMeasurement.hardscapeSqft)} sqft</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-400">No measurements recorded yet.</p>
              )}

              {latestMeasurement && latestMeasurement.notes && (
                <p className="text-xs text-gray-500 mt-2">Notes: {latestMeasurement.notes}</p>
              )}

              {latestMeasurement && (
                <p className="text-xs text-gray-400 mt-2">
                  Measured {new Date(latestMeasurement.measuredAt).toLocaleDateString()}
                  {latestMeasurement.measuredBy && ` by ${latestMeasurement.measuredBy}`}
                </p>
              )}

              {showMeasurementForm ? (
                <MeasurementForm
                  propertyId={property.id}
                  onSaved={() => { setShowMeasurementForm(false); loadMeasurements(); }}
                  onCancel={() => setShowMeasurementForm(false)}
                />
              ) : (
                <button
                  onClick={() => setShowMeasurementForm(true)}
                  className="btn-secondary mt-3 text-xs"
                >
                  + Add Measurement
                </button>
              )}
            </div>
          )}

          {/* Chemicals tab */}
          {tab === "chemicals" && (
            <div>
              {chemicals.length === 0 ? (
                <p className="text-sm text-gray-400">No chemical applications recorded.</p>
              ) : (
                <div className="space-y-2">
                  {chemicals.map((chem) => {
                    const status = reentryStatus(chem.reentryExpires);
                    return (
                      <div key={chem.id} className="flex items-center gap-3 bg-gray-50 rounded-lg px-4 py-2.5">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">{chem.productName}</p>
                          <p className="text-xs text-gray-500">
                            {new Date(chem.appliedAt).toLocaleDateString()}
                            {chem.targetPest && ` \u00B7 ${chem.targetPest}`}
                            {chem.areaTreatedSqft && ` \u00B7 ${formatNum(chem.areaTreatedSqft)} sqft`}
                          </p>
                        </div>
                        <span className={`badge ${status.color}`}>{status.label}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {showChemicalForm ? (
                <ChemicalForm
                  propertyId={property.id}
                  onSaved={() => { setShowChemicalForm(false); loadChemicals(); }}
                  onCancel={() => setShowChemicalForm(false)}
                />
              ) : (
                <button
                  onClick={() => setShowChemicalForm(true)}
                  className="btn-secondary mt-3 text-xs"
                >
                  + Log Application
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

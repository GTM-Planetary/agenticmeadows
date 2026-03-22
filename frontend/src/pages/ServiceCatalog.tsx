import { useState, useEffect } from "react";
import { servicesApi } from "../api";
import type { ServiceCatalogItem, ServiceCategory, PricingUnit } from "../types";

const CATEGORY_LABELS: Record<ServiceCategory, string> = {
  MOWING: "Mowing",
  TRIMMING: "Trimming",
  FERTILIZATION: "Fertilization",
  WEED_CONTROL: "Weed Control",
  AERATION: "Aeration",
  SEEDING: "Seeding",
  MULCHING: "Mulching",
  PRUNING: "Pruning",
  IRRIGATION: "Irrigation",
  CLEANUP: "Cleanup",
  HARDSCAPE: "Hardscape",
  PLANTING: "Planting",
  SNOW_REMOVAL: "Snow Removal",
  OTHER: "Other",
};

const PRICING_UNIT_LABELS: Record<PricingUnit, string> = {
  FLAT: "Flat Rate",
  PER_SQFT: "per sqft",
  PER_LINEAR_FT: "per lin ft",
  PER_HOUR: "per hour",
  PER_APPLICATION: "per application",
  PER_YARD: "per cubic yard",
};

const PRICING_UNIT_SHORT: Record<PricingUnit, string> = {
  FLAT: "/flat",
  PER_SQFT: "/sqft",
  PER_LINEAR_FT: "/lin ft",
  PER_HOUR: "/hr",
  PER_APPLICATION: "/app",
  PER_YARD: "/yd",
};

const CATEGORY_COLORS: Record<ServiceCategory, string> = {
  MOWING: "bg-green-100 text-green-700",
  TRIMMING: "bg-emerald-100 text-emerald-700",
  FERTILIZATION: "bg-yellow-100 text-yellow-700",
  WEED_CONTROL: "bg-orange-100 text-orange-700",
  AERATION: "bg-blue-100 text-blue-700",
  SEEDING: "bg-lime-100 text-lime-700",
  MULCHING: "bg-amber-100 text-amber-700",
  PRUNING: "bg-teal-100 text-teal-700",
  IRRIGATION: "bg-cyan-100 text-cyan-700",
  CLEANUP: "bg-gray-100 text-gray-600",
  HARDSCAPE: "bg-stone-100 text-stone-700",
  PLANTING: "bg-green-100 text-green-700",
  SNOW_REMOVAL: "bg-sky-100 text-sky-700",
  OTHER: "bg-purple-100 text-purple-700",
};

const ALL_CATEGORIES = Object.keys(CATEGORY_LABELS) as ServiceCategory[];
const ALL_PRICING_UNITS = Object.keys(PRICING_UNIT_LABELS) as PricingUnit[];

function formatPrice(price: number, unit: PricingUnit) {
  const formatted = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(price);
  return `${formatted}${PRICING_UNIT_SHORT[unit]}`;
}

interface ServiceModalProps {
  onClose: () => void;
  onSaved: () => void;
  service?: ServiceCatalogItem;
}

function ServiceModal({ onClose, onSaved, service }: ServiceModalProps) {
  const [form, setForm] = useState({
    name: service?.name ?? "",
    description: service?.description ?? "",
    category: service?.category ?? ("MOWING" as ServiceCategory),
    pricingUnit: service?.pricingUnit ?? ("FLAT" as PricingUnit),
    basePrice: service?.basePrice?.toString() ?? "",
    sortOrder: service?.sortOrder?.toString() ?? "0",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const data = {
        name: form.name,
        description: form.description || undefined,
        category: form.category,
        pricingUnit: form.pricingUnit,
        basePrice: parseFloat(form.basePrice),
        sortOrder: parseInt(form.sortOrder) || 0,
      };
      if (service) {
        await servicesApi.update(service.id, data);
      } else {
        await servicesApi.create(data);
      }
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
        <h2 className="font-bold text-lg mb-4">{service ? "Edit Service" : "New Service"}</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="label">Service Name *</label>
            <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Category *</label>
              <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as ServiceCategory })}>
                {ALL_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Pricing Unit *</label>
              <select className="input" value={form.pricingUnit} onChange={(e) => setForm({ ...form, pricingUnit: e.target.value as PricingUnit })}>
                {ALL_PRICING_UNITS.map((unit) => (
                  <option key={unit} value={unit}>{PRICING_UNIT_LABELS[unit]}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Base Price *</label>
              <input className="input" type="number" step="0.01" min="0" required value={form.basePrice} onChange={(e) => setForm({ ...form, basePrice: e.target.value })} />
            </div>
            <div>
              <label className="label">Sort Order</label>
              <input className="input" type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} />
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center">
              {loading ? "Saving..." : service ? "Update Service" : "Create Service"}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ServiceCatalog() {
  const [services, setServices] = useState<ServiceCatalogItem[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<ServiceCategory | "ALL">("ALL");
  const [showModal, setShowModal] = useState(false);
  const [editingService, setEditingService] = useState<ServiceCatalogItem | undefined>(undefined);

  function load() {
    const params: { category?: string; active?: string } = {};
    if (categoryFilter !== "ALL") params.category = categoryFilter;
    servicesApi.list(params).then(setServices).catch(console.error);
  }

  useEffect(() => { load(); }, [categoryFilter]);

  const filtered = services.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  function handleEdit(service: ServiceCatalogItem) {
    setEditingService(service);
    setShowModal(true);
  }

  async function handleDeactivate(service: ServiceCatalogItem) {
    try {
      await servicesApi.update(service.id, { isActive: !service.isActive });
      load();
    } catch (e) {
      console.error(e);
    }
  }

  function closeModal() {
    setShowModal(false);
    setEditingService(undefined);
  }

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Service Catalog</h1>
        <button onClick={() => { setEditingService(undefined); setShowModal(true); }} className="btn-primary">+ Add Service</button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <input
          className="input max-w-sm"
          placeholder="Search services..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="input max-w-xs"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as ServiceCategory | "ALL")}
        >
          <option value="ALL">All Categories</option>
          {ALL_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
          ))}
        </select>
      </div>

      <div className="card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-gray-400">
            <p className="text-lg mb-2">No services found</p>
            <button onClick={() => { setEditingService(undefined); setShowModal(true); }} className="btn-primary">Add your first service</button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Name</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Category</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Pricing Unit</th>
                <th className="text-right px-5 py-3 font-medium text-gray-600">Base Price</th>
                <th className="text-center px-5 py-3 font-medium text-gray-600">Status</th>
                <th className="text-right px-5 py-3 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((s) => (
                <tr key={s.id} className={`hover:bg-gray-50 transition-colors ${!s.isActive ? "opacity-50" : ""}`}>
                  <td className="px-5 py-3">
                    <p className="font-medium text-gray-900">{s.name}</p>
                    {s.description && <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{s.description}</p>}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`badge ${CATEGORY_COLORS[s.category]}`}>
                      {CATEGORY_LABELS[s.category]}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-500">{PRICING_UNIT_LABELS[s.pricingUnit]}</td>
                  <td className="px-5 py-3 text-right font-medium text-gray-900">
                    {formatPrice(s.basePrice, s.pricingUnit)}
                  </td>
                  <td className="px-5 py-3 text-center">
                    <span className={`badge ${s.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {s.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => handleEdit(s)} className="text-xs text-turf-600 hover:text-turf-700 font-medium">
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeactivate(s)}
                        className={`text-xs font-medium ${s.isActive ? "text-red-500 hover:text-red-600" : "text-green-600 hover:text-green-700"}`}
                      >
                        {s.isActive ? "Deactivate" : "Activate"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <ServiceModal onClose={closeModal} onSaved={load} service={editingService} />
      )}
    </div>
  );
}

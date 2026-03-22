import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { quotesApi, clientsApi, servicesApi } from "../api";
import type { Quote, Client, QuoteStatus, ServiceCatalogItem } from "../types";

const statusColors: Record<QuoteStatus, string> = {
  DRAFT: "bg-gray-100 text-gray-600",
  SENT: "bg-blue-100 text-blue-700",
  APPROVED: "bg-turf-100 text-turf-700",
  REJECTED: "bg-red-100 text-red-600",
  INVOICED: "bg-purple-100 text-purple-700",
};

// ── Shared Line Item Row with Service Dropdown ──────────────────────────

interface LineItemRow {
  serviceId: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

function LineItemEditor({
  items,
  setItems,
  services,
}: {
  items: LineItemRow[];
  services: ServiceCatalogItem[];
  setItems: (items: LineItemRow[]) => void;
}) {
  function updateItem(idx: number, field: string, value: string | number) {
    setItems(items.map((item, i) => (i === idx ? { ...item, [field]: value } : item)));
  }

  function handleServiceSelect(idx: number, serviceId: string) {
    if (serviceId === "") {
      updateItem(idx, "serviceId", "");
      return;
    }
    const svc = services.find((s) => s.id === serviceId);
    if (svc) {
      setItems(
        items.map((item, i) =>
          i === idx
            ? { ...item, serviceId: svc.id, description: svc.name, unitPrice: svc.basePrice }
            : item
        )
      );
    }
  }

  const total = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);

  return (
    <div>
      <label className="label">Line Items</label>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex gap-2 items-start">
            <select
              className="input w-40 text-sm"
              value={item.serviceId}
              onChange={(e) => handleServiceSelect(i, e.target.value)}
            >
              <option value="">Custom</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} (${s.basePrice.toFixed(2)})
                </option>
              ))}
            </select>
            <input
              className="input flex-1 text-sm"
              placeholder="Service description"
              value={item.description}
              onChange={(e) => updateItem(i, "description", e.target.value)}
            />
            <input
              className="input w-16 text-sm text-center"
              type="number"
              min={1}
              value={item.quantity}
              onChange={(e) => updateItem(i, "quantity", parseFloat(e.target.value) || 1)}
            />
            <input
              className="input w-24 text-sm text-right"
              type="number"
              min={0}
              step={0.01}
              placeholder="0.00"
              value={item.unitPrice || ""}
              onChange={(e) => updateItem(i, "unitPrice", parseFloat(e.target.value) || 0)}
            />
            {items.length > 1 && (
              <button
                type="button"
                onClick={() => setItems(items.filter((_, j) => j !== i))}
                className="text-red-400 hover:text-red-600 px-1 mt-2"
              >
                ✕
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            setItems([...items, { serviceId: "", description: "", quantity: 1, unitPrice: 0 }])
          }
          className="btn-ghost text-xs"
        >
          + Add line item
        </button>
      </div>
      <p className="text-right text-sm font-semibold mt-2 text-gray-700">
        Total: ${total.toFixed(2)}
      </p>
    </div>
  );
}

// ── New Quote Modal ─────────────────────────────────────────────────────

function QuoteModal({
  onClose,
  onSaved,
  services,
}: {
  onClose: () => void;
  onSaved: () => void;
  services: ServiceCatalogItem[];
}) {
  const [clients, setClients] = useState<Client[]>([]);
  const [form, setForm] = useState({ clientId: "", title: "", notes: "" });
  const [items, setItems] = useState<LineItemRow[]>([
    { serviceId: "", description: "", quantity: 1, unitPrice: 0 },
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    clientsApi.list().then(setClients).catch(console.error);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await quotesApi.create({
        ...form,
        lineItems: items.map(({ description, quantity, unitPrice }) => ({
          description,
          quantity,
          unitPrice,
        })),
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
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 overflow-auto">
      <div className="card w-full max-w-2xl p-6 my-4">
        <h2 className="font-bold text-lg mb-4">New Quote</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="label">Client *</label>
            <select
              className="input"
              required
              value={form.clientId}
              onChange={(e) => setForm({ ...form, clientId: e.target.value })}
            >
              <option value="">Select client...</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.firstName} {c.lastName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Quote Title *</label>
            <input
              className="input"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Spring Cleanup — 123 Main St"
            />
          </div>

          <LineItemEditor items={items} setItems={setItems} services={services} />

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
              {loading ? "Saving..." : "Create Quote"}
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

// ── Quote Detail Slide-out Panel ────────────────────────────────────────

function QuoteDetailPanel({
  quote,
  onClose,
  onUpdated,
  services,
}: {
  quote: Quote;
  onClose: () => void;
  onUpdated: () => void;
  services: ServiceCatalogItem[];
}) {
  const navigate = useNavigate();
  const [actionLoading, setActionLoading] = useState("");
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(quote.title);
  const [editNotes, setEditNotes] = useState(quote.notes || "");
  const [editItems, setEditItems] = useState<LineItemRow[]>(
    quote.lineItems.map((li) => ({
      serviceId: li.serviceId || "",
      description: li.description,
      quantity: li.quantity,
      unitPrice: li.unitPrice,
    }))
  );
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState("");

  const total = quote.lineItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const clientName = quote.client
    ? `${quote.client.firstName} ${quote.client.lastName}`
    : "Unknown Client";
  const createdDate = new Date(quote.createdAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  function handleStartEdit() {
    setEditTitle(quote.title);
    setEditNotes(quote.notes || "");
    setEditItems(
      quote.lineItems.map((li) => ({
        serviceId: li.serviceId || "",
        description: li.description,
        quantity: li.quantity,
        unitPrice: li.unitPrice,
      }))
    );
    setEditError("");
    setEditing(true);
  }

  function handleCancelEdit() {
    setEditing(false);
    setEditError("");
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    setEditLoading(true);
    setEditError("");
    try {
      await quotesApi.update(quote.id, {
        title: editTitle,
        notes: editNotes,
        lineItems: editItems.map(({ description, quantity, unitPrice }) => ({
          description,
          quantity,
          unitPrice,
        })),
      });
      setEditing(false);
      onUpdated();
    } catch (err: any) {
      setEditError(err.message || "Failed to save changes");
    } finally {
      setEditLoading(false);
    }
  }

  async function handleStatusChange(status: QuoteStatus) {
    setActionLoading(status);
    try {
      await quotesApi.update(quote.id, { status });
      onUpdated();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setActionLoading("");
    }
  }

  async function handleConvert() {
    setActionLoading("CONVERT");
    try {
      await quotesApi.convert(quote.id);
      onUpdated();
      navigate("/invoices");
    } catch (e: any) {
      alert(e.message);
    } finally {
      setActionLoading("");
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Delete quote "${quote.title}"? This cannot be undone.`)) return;
    setActionLoading("DELETE");
    try {
      await quotesApi.delete(quote.id);
      onClose();
      onUpdated();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setActionLoading("");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-[400px] max-w-full h-full bg-white shadow-xl overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <h2 className="font-bold text-lg text-gray-900 truncate">{quote.title}</h2>
            <p className="text-sm text-gray-500 mt-0.5">{clientName}</p>
          </div>
          <button
            onClick={onClose}
            className="ml-3 text-gray-400 hover:text-gray-600 text-xl leading-none flex-shrink-0"
          >
            ✕
          </button>
        </div>

        <div className="px-5 py-4 space-y-5">
          {/* Status + Date */}
          <div className="flex items-center gap-3">
            <span className={`badge ${statusColors[quote.status]}`}>{quote.status}</span>
            <span className="text-sm text-gray-400">Created {createdDate}</span>
          </div>

          {editing ? (
            /* ── Edit Mode ────────────────────────────────────── */
            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="label">Title</label>
                <input
                  className="input"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  required
                />
              </div>

              <LineItemEditor items={editItems} setItems={setEditItems} services={services} />

              <div>
                <label className="label">Notes</label>
                <textarea
                  className="input"
                  rows={3}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                />
              </div>

              {editError && <p className="text-sm text-red-600">{editError}</p>}

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={editLoading}
                  className="btn-primary flex-1 justify-center"
                >
                  {editLoading ? "Saving..." : "Save Changes"}
                </button>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="btn-secondary flex-1 justify-center"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            /* ── View Mode ────────────────────────────────────── */
            <>
              {/* Line Items */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Line Items</h3>
                <div className="border border-gray-100 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium text-gray-500">Description</th>
                        <th className="text-center px-3 py-2 font-medium text-gray-500 w-12">Qty</th>
                        <th className="text-right px-3 py-2 font-medium text-gray-500 w-20">Price</th>
                        <th className="text-right px-3 py-2 font-medium text-gray-500 w-20">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {quote.lineItems.map((item, i) => (
                        <tr key={item.id || i}>
                          <td className="px-3 py-2 text-gray-700">{item.description}</td>
                          <td className="px-3 py-2 text-center text-gray-500">{item.quantity}</td>
                          <td className="px-3 py-2 text-right text-gray-500">
                            ${item.unitPrice.toFixed(2)}
                          </td>
                          <td className="px-3 py-2 text-right font-medium">
                            ${(item.quantity * item.unitPrice).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="bg-gray-50 px-3 py-2 text-right font-semibold text-gray-900 border-t border-gray-100">
                    Total: ${total.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Notes */}
              {quote.notes && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-1">Notes</h3>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">{quote.notes}</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="border-t border-gray-100 pt-4 space-y-2">
                {quote.status === "DRAFT" && (
                  <>
                    <button
                      onClick={() => handleStatusChange("SENT")}
                      disabled={!!actionLoading}
                      className="btn-primary w-full justify-center"
                    >
                      {actionLoading === "SENT" ? "Updating..." : "Mark as Sent"}
                    </button>
                    <button
                      onClick={handleStartEdit}
                      disabled={!!actionLoading}
                      className="btn-secondary w-full justify-center"
                    >
                      Edit Quote
                    </button>
                    <button
                      onClick={handleDelete}
                      disabled={!!actionLoading}
                      className="w-full py-2 px-4 rounded-lg text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
                    >
                      {actionLoading === "DELETE" ? "Deleting..." : "Delete Quote"}
                    </button>
                  </>
                )}

                {quote.status === "SENT" && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleStatusChange("APPROVED")}
                      disabled={!!actionLoading}
                      className="flex-1 py-2 px-4 rounded-lg text-sm font-medium text-white bg-green-600 hover:bg-green-700 transition-colors"
                    >
                      {actionLoading === "APPROVED" ? "..." : "Approve"}
                    </button>
                    <button
                      onClick={() => handleStatusChange("REJECTED")}
                      disabled={!!actionLoading}
                      className="flex-1 py-2 px-4 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-colors"
                    >
                      {actionLoading === "REJECTED" ? "..." : "Reject"}
                    </button>
                  </div>
                )}

                {quote.status === "APPROVED" && (
                  <button
                    onClick={handleConvert}
                    disabled={!!actionLoading}
                    className="btn-primary w-full justify-center"
                  >
                    {actionLoading === "CONVERT" ? "Converting..." : "Convert to Invoice"}
                  </button>
                )}

                {quote.status === "REJECTED" && (
                  <button
                    onClick={() => handleStatusChange("DRAFT")}
                    disabled={!!actionLoading}
                    className="btn-secondary w-full justify-center"
                  >
                    {actionLoading === "DRAFT" ? "Updating..." : "Reopen as Draft"}
                  </button>
                )}

                {quote.status === "INVOICED" && (
                  <div className="text-center py-2">
                    <span className="text-sm text-purple-600 font-medium">
                      Converted to Invoice
                    </span>
                    <button
                      onClick={() => navigate("/invoices")}
                      className="block mx-auto mt-1 text-sm text-turf-600 hover:underline"
                    >
                      View Invoices
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Quotes Page ────────────────────────────────────────────────────

export default function Quotes() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [services, setServices] = useState<ServiceCatalogItem[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);

  function load() {
    quotesApi.list().then(setQuotes).catch(console.error);
  }

  useEffect(() => {
    load();
    servicesApi.list().then(setServices).catch(console.error);
  }, []);

  // After any status change, refresh list and sync the selected panel
  function handleUpdated() {
    quotesApi
      .list()
      .then((fresh) => {
        setQuotes(fresh);
        if (selectedQuote) {
          const updated = fresh.find((q) => q.id === selectedQuote.id);
          if (updated) {
            setSelectedQuote(updated);
          } else {
            setSelectedQuote(null);
          }
        }
      })
      .catch(console.error);
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Quotes</h1>
        <button onClick={() => setShowModal(true)} className="btn-primary">
          + New Quote
        </button>
      </div>

      <div className="card overflow-hidden">
        {quotes.length === 0 ? (
          <div className="py-12 text-center text-gray-400">
            No quotes yet.{" "}
            <button
              onClick={() => setShowModal(true)}
              className="text-turf-600 hover:underline"
            >
              Create one &rarr;
            </button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Title</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Client</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Total</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {quotes.map((q) => {
                const total = q.lineItems.reduce(
                  (s, i) => s + i.quantity * i.unitPrice,
                  0
                );
                return (
                  <tr
                    key={q.id}
                    onClick={() => setSelectedQuote(q)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="px-5 py-3 font-medium">{q.title}</td>
                    <td className="px-5 py-3 text-gray-500">
                      {q.client
                        ? `${q.client.firstName} ${q.client.lastName}`
                        : "\u2014"}
                    </td>
                    <td className="px-5 py-3">${total.toFixed(2)}</td>
                    <td className="px-5 py-3">
                      <span className={`badge ${statusColors[q.status]}`}>
                        {q.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <QuoteModal
          onClose={() => setShowModal(false)}
          onSaved={load}
          services={services}
        />
      )}

      {selectedQuote && (
        <QuoteDetailPanel
          quote={selectedQuote}
          onClose={() => setSelectedQuote(null)}
          onUpdated={handleUpdated}
          services={services}
        />
      )}
    </div>
  );
}

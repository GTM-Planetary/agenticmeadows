import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { clientsApi } from "../api";
import type { Client } from "../types";

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const [client, setClient] = useState<Client | null>(null);
  const [showPropForm, setShowPropForm] = useState(false);
  const [propForm, setPropForm] = useState({ streetAddress: "", city: "", state: "", zip: "", notes: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (id) clientsApi.get(id).then(setClient).catch(console.error);
  }, [id]);

  async function addProperty(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    setSaving(true);
    try {
      await clientsApi.addProperty(id, propForm);
      const updated = await clientsApi.get(id);
      setClient(updated);
      setShowPropForm(false);
      setPropForm({ streetAddress: "", city: "", state: "", zip: "", notes: "" });
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (!client) return <div className="text-gray-400 p-8">Loading...</div>;

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
        <Link to="/clients" className="hover:text-turf-600">Clients</Link>
        <span>/</span>
        <span>{client.firstName} {client.lastName}</span>
      </div>

      <div className="card p-5">
        <h1 className="text-xl font-bold text-gray-900">{client.firstName} {client.lastName}</h1>
        {client.company && <p className="text-gray-500 text-sm">{client.company}</p>}
        <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
          {client.email && <div><span className="text-gray-400">Email: </span>{client.email}</div>}
          {client.phone && <div><span className="text-gray-400">Phone: </span>{client.phone}</div>}
          {client.notes && <div className="col-span-2"><span className="text-gray-400">Notes: </span>{client.notes}</div>}
        </div>
      </div>

      {/* Properties */}
      <div className="card">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Properties</h2>
          <button onClick={() => setShowPropForm(!showPropForm)} className="btn-secondary text-xs">
            {showPropForm ? "Cancel" : "+ Add Property"}
          </button>
        </div>

        {showPropForm && (
          <form onSubmit={addProperty} className="px-5 py-4 bg-gray-50 border-b border-gray-100 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="label text-xs">Street Address *</label>
                <input className="input text-sm" required value={propForm.streetAddress} onChange={(e) => setPropForm({ ...propForm, streetAddress: e.target.value })} />
              </div>
              <div>
                <label className="label text-xs">City *</label>
                <input className="input text-sm" required value={propForm.city} onChange={(e) => setPropForm({ ...propForm, city: e.target.value })} />
              </div>
              <div>
                <label className="label text-xs">State *</label>
                <input className="input text-sm" required value={propForm.state} onChange={(e) => setPropForm({ ...propForm, state: e.target.value })} maxLength={2} />
              </div>
              <div>
                <label className="label text-xs">ZIP *</label>
                <input className="input text-sm" required value={propForm.zip} onChange={(e) => setPropForm({ ...propForm, zip: e.target.value })} />
              </div>
              <div>
                <label className="label text-xs">Notes</label>
                <input className="input text-sm" value={propForm.notes} onChange={(e) => setPropForm({ ...propForm, notes: e.target.value })} />
              </div>
            </div>
            <button type="submit" disabled={saving} className="btn-primary text-sm">
              {saving ? "Saving..." : "Add Property"}
            </button>
          </form>
        )}

        {client.properties.length === 0 ? (
          <p className="px-5 py-4 text-sm text-gray-400">No properties yet.</p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {client.properties.map((p) => (
              <li key={p.id} className="px-5 py-3">
                <p className="font-medium text-sm">{p.streetAddress}</p>
                <p className="text-xs text-gray-500">{p.city}, {p.state} {p.zip}</p>
                {p.notes && <p className="text-xs text-gray-400 mt-0.5">{p.notes}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Quick links */}
      <div className="flex gap-3">
        <Link to={`/jobs?clientId=${client.id}`} className="btn-secondary text-sm">View Jobs</Link>
        <Link to={`/quotes?clientId=${client.id}`} className="btn-secondary text-sm">View Quotes</Link>
      </div>
    </div>
  );
}

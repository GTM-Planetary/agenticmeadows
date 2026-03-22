import { useState, useEffect, useRef } from "react";
import { useAuth } from "../hooks/useAuth";
import { api, apiPost, apiPut, apiDelete } from "../api/client";
import { authApi } from "../api";

interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive?: boolean;
  photoUrl?: string | null;
  createdAt: string;
}

interface GuardrailsConfig {
  enabled: boolean;
  inputRails: { checkJailbreak: boolean; checkPromptInjection: boolean };
  model: string;
}

interface PlatformApiKey {
  id: string;
  name: string;
  keyPreview: string;
  permissions: string[];
  createdAt: string;
  lastUsedAt?: string;
}

type Tab = "general" | "org" | "users" | "customfields" | "guardrails" | "aiagent" | "integrations" | "apikeys" | "profile";

export default function Settings() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("general");

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your workspace, users, AI guardrails, and profile</p>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-6 w-fit">
        {([
          { key: "general", label: "General" },
          { key: "org", label: "Organization" },
          { key: "users", label: "Users & Roles" },
          { key: "customfields", label: "Custom Fields" },
          { key: "guardrails", label: "NemoClaw Security" },
          { key: "aiagent", label: "AI Agent" },
          { key: "integrations", label: "Integrations" },
          { key: "apikeys", label: "API Keys" },
          { key: "profile", label: "My Profile" },
        ] as { key: Tab; label: string }[]).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              tab === key ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "general" && <GeneralSettings />}
      {tab === "org" && <OrgSettingsTab />}
      {tab === "users" && <UserManagement currentUser={user} />}
      {tab === "customfields" && <CustomFieldsTab />}
      {tab === "guardrails" && <GuardrailsSettings />}
      {tab === "aiagent" && <AIAgentSettings />}
      {tab === "integrations" && <IntegrationsSettings />}
      {tab === "apikeys" && <ApiKeysSettings />}
      {tab === "profile" && <ProfileSettings />}
    </div>
  );
}

// ── General Settings ──────────────────────────────────────────────────────

function GeneralSettings() {
  const [companyName, setCompanyName] = useState("AgenticMeadows Landscaping");
  const [companyZip, setCompanyZip] = useState("");
  const [defaultJobDuration, setDefaultJobDuration] = useState("120");
  const [saved, setSaved] = useState(false);

  function handleSave() {
    // In a real app, these would be persisted to a settings table
    localStorage.setItem("am_company_name", companyName);
    localStorage.setItem("am_company_zip", companyZip);
    localStorage.setItem("am_default_job_duration", defaultJobDuration);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  useEffect(() => {
    setCompanyName(localStorage.getItem("am_company_name") || "AgenticMeadows Landscaping");
    setCompanyZip(localStorage.getItem("am_company_zip") || "");
    setDefaultJobDuration(localStorage.getItem("am_default_job_duration") || "120");
  }, []);

  return (
    <div className="card p-6 max-w-2xl">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">General Settings</h2>
      <div className="space-y-4">
        <div>
          <label className="label">Company Name</label>
          <input className="input" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
        </div>
        <div>
          <label className="label">Company ZIP Code</label>
          <input className="input" value={companyZip} onChange={(e) => setCompanyZip(e.target.value)} placeholder="Used for weather forecasts" />
          <p className="text-xs text-gray-400 mt-1">Used by the AI agent for weather-aware scheduling</p>
        </div>
        <div>
          <label className="label">Default Job Duration (minutes)</label>
          <input className="input" type="number" value={defaultJobDuration} onChange={(e) => setDefaultJobDuration(e.target.value)} />
        </div>
        <div className="pt-2">
          <button onClick={handleSave} className="btn-primary">
            {saved ? "Saved!" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Organization Settings ─────────────────────────────────────────────────

interface OrgData {
  companyName: string;
  companyLogo: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  invoicePrefix: string;
  invoiceNextNum: number;
  paymentTerms: string;
  invoiceFooter: string | null;
}

function OrgSettingsTab() {
  const [org, setOrg] = useState<OrgData>({
    companyName: "", companyLogo: null, address: null, city: null, state: null,
    zip: null, phone: null, email: null, website: null,
    invoicePrefix: "INV", invoiceNextNum: 1001, paymentTerms: "Net 30", invoiceFooter: null,
  });
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<OrgData>("/api/org").then((data) => { setOrg(data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  async function handleSave() {
    await apiPut("/api/org", org);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { alert("Logo must be under 2MB"); return; }
    const reader = new FileReader();
    reader.onload = () => setOrg({ ...org, companyLogo: reader.result as string });
    reader.readAsDataURL(file);
  }

  if (loading) return <p className="text-sm text-gray-400 py-8">Loading...</p>;

  return (
    <div className="max-w-3xl space-y-6">
      {/* Company Identity */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Company Identity</h2>
        <div className="flex gap-6">
          {/* Logo upload */}
          <div className="shrink-0">
            <label className="label mb-2">Company Logo</label>
            <div className="w-28 h-28 border-2 border-dashed border-gray-300 rounded-xl flex items-center justify-center bg-gray-50 overflow-hidden relative group cursor-pointer">
              {org.companyLogo ? (
                <img src={org.companyLogo} alt="Logo" className="w-full h-full object-contain" />
              ) : (
                <div className="text-center">
                  <p className="text-2xl text-gray-300">🏢</p>
                  <p className="text-xs text-gray-400 mt-1">Upload</p>
                </div>
              )}
              <input type="file" accept="image/*" onChange={handleLogoUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
              {org.companyLogo && (
                <button onClick={() => setOrg({ ...org, companyLogo: null })} className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-1">Max 2MB, PNG/JPG</p>
          </div>

          {/* Company details */}
          <div className="flex-1 space-y-3">
            <div>
              <label className="label">Company Name</label>
              <input className="input" value={org.companyName} onChange={(e) => setOrg({ ...org, companyName: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Phone</label>
                <input className="input" value={org.phone || ""} onChange={(e) => setOrg({ ...org, phone: e.target.value || null })} placeholder="(555) 123-4567" />
              </div>
              <div>
                <label className="label">Email</label>
                <input className="input" type="email" value={org.email || ""} onChange={(e) => setOrg({ ...org, email: e.target.value || null })} placeholder="info@company.com" />
              </div>
            </div>
            <div>
              <label className="label">Website</label>
              <input className="input" value={org.website || ""} onChange={(e) => setOrg({ ...org, website: e.target.value || null })} placeholder="https://www.company.com" />
            </div>
          </div>
        </div>
      </div>

      {/* Address */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Company Address</h2>
        <div className="space-y-3">
          <div>
            <label className="label">Street Address</label>
            <input className="input" value={org.address || ""} onChange={(e) => setOrg({ ...org, address: e.target.value || null })} placeholder="123 Main St" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">City</label>
              <input className="input" value={org.city || ""} onChange={(e) => setOrg({ ...org, city: e.target.value || null })} />
            </div>
            <div>
              <label className="label">State</label>
              <input className="input" value={org.state || ""} onChange={(e) => setOrg({ ...org, state: e.target.value || null })} />
            </div>
            <div>
              <label className="label">ZIP Code</label>
              <input className="input" value={org.zip || ""} onChange={(e) => setOrg({ ...org, zip: e.target.value || null })} />
            </div>
          </div>
        </div>
      </div>

      {/* Invoice Settings */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Invoice Settings</h2>
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Invoice Prefix</label>
              <input className="input" value={org.invoicePrefix} onChange={(e) => setOrg({ ...org, invoicePrefix: e.target.value })} />
            </div>
            <div>
              <label className="label">Next Invoice #</label>
              <input className="input" type="number" value={org.invoiceNextNum} onChange={(e) => setOrg({ ...org, invoiceNextNum: parseInt(e.target.value) || 1001 })} />
            </div>
            <div>
              <label className="label">Payment Terms</label>
              <select className="input" value={org.paymentTerms} onChange={(e) => setOrg({ ...org, paymentTerms: e.target.value })}>
                <option>Due on Receipt</option>
                <option>Net 15</option>
                <option>Net 30</option>
                <option>Net 45</option>
                <option>Net 60</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Invoice Footer Text</label>
            <textarea className="input" rows={2} value={org.invoiceFooter || ""} onChange={(e) => setOrg({ ...org, invoiceFooter: e.target.value || null })} placeholder="Thank you for your business! Payment is due within the stated terms." />
          </div>
        </div>
      </div>

      {/* Invoice Preview */}
      <div className="card p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Invoice Preview</h3>
        <div className="border rounded-lg p-6 bg-white text-sm">
          <div className="flex justify-between items-start mb-6">
            <div className="flex items-center gap-3">
              {org.companyLogo ? (
                <img src={org.companyLogo} alt="Logo" className="w-12 h-12 object-contain" />
              ) : (
                <div className="w-12 h-12 bg-turf-100 rounded-lg flex items-center justify-center text-xl">🌿</div>
              )}
              <div>
                <p className="font-bold text-gray-900">{org.companyName || "Your Company"}</p>
                {org.address && <p className="text-xs text-gray-500">{org.address}</p>}
                {(org.city || org.state || org.zip) && (
                  <p className="text-xs text-gray-500">{[org.city, org.state, org.zip].filter(Boolean).join(", ")}</p>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="text-xl font-bold text-gray-300">{org.invoicePrefix}-{org.invoiceNextNum}</p>
              <p className="text-xs text-gray-400 mt-1">Terms: {org.paymentTerms}</p>
            </div>
          </div>
          <div className="border-t border-gray-100 pt-3 text-xs text-gray-400 text-center">
            {org.invoiceFooter || "Thank you for your business!"}
          </div>
        </div>
      </div>

      <button onClick={handleSave} className="btn-primary">
        {saved ? "Saved!" : "Save Organization Settings"}
      </button>
    </div>
  );
}

// ── Custom Fields ──────────────────────────────────────────────────────────

interface FieldDef {
  id: string;
  entity: string;
  sectionId: string | null;
  name: string;
  fieldKey: string;
  fieldType: string;
  isRequired: boolean;
  placeholder: string | null;
  options: string[] | null;
  defaultValue: string | null;
  sortOrder: number;
  isActive: boolean;
}

interface FieldSection {
  id: string;
  entity: string;
  name: string;
  sortOrder: number;
  fields: FieldDef[];
}

const ENTITIES = [
  { key: "CLIENT", label: "Clients" },
  { key: "JOB", label: "Jobs" },
  { key: "QUOTE", label: "Quotes" },
  { key: "INVOICE", label: "Invoices" },
  { key: "PROPERTY", label: "Properties" },
];

const FIELD_TYPES = [
  { key: "TEXT", label: "Text" },
  { key: "NUMBER", label: "Number" },
  { key: "DATE", label: "Date" },
  { key: "DROPDOWN", label: "Dropdown" },
  { key: "CHECKBOX", label: "Checkbox" },
  { key: "TEXTAREA", label: "Long Text" },
  { key: "EMAIL", label: "Email" },
  { key: "PHONE", label: "Phone" },
  { key: "URL", label: "URL" },
  { key: "CURRENCY", label: "Currency" },
];

function CustomFieldsTab() {
  const [entity, setEntity] = useState("CLIENT");
  const [sections, setSections] = useState<FieldSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddSection, setShowAddSection] = useState(false);
  const [newSectionName, setNewSectionName] = useState("");
  const [showAddField, setShowAddField] = useState<string | null>(null); // sectionId or "unsectioned"
  const [newField, setNewField] = useState({ name: "", fieldKey: "", fieldType: "TEXT", placeholder: "", isRequired: false, options: "" });

  async function loadSections() {
    try {
      const data = await api<FieldSection[]>(`/api/custom-fields/sections?entity=${entity}`);
      setSections(data);
    } catch { setSections([]); }
    setLoading(false);
  }

  useEffect(() => { setLoading(true); loadSections(); }, [entity]);

  async function handleAddSection(e: React.FormEvent) {
    e.preventDefault();
    if (!newSectionName.trim()) return;
    await apiPost("/api/custom-fields/sections", { entity, name: newSectionName, sortOrder: sections.length });
    setNewSectionName("");
    setShowAddSection(false);
    loadSections();
  }

  async function handleDeleteSection(id: string) {
    if (!confirm("Delete this section and all its fields?")) return;
    await apiDelete(`/api/custom-fields/sections/${id}`);
    loadSections();
  }

  async function handleAddField(e: React.FormEvent, sectionId: string | null) {
    e.preventDefault();
    const key = newField.fieldKey || newField.name.toLowerCase().replace(/[^a-z0-9]/g, "_");
    await apiPost("/api/custom-fields/definitions", {
      entity,
      sectionId,
      name: newField.name,
      fieldKey: key,
      fieldType: newField.fieldType,
      placeholder: newField.placeholder || null,
      isRequired: newField.isRequired,
      options: newField.fieldType === "DROPDOWN" && newField.options ? newField.options.split(",").map((s: string) => s.trim()) : null,
    });
    setNewField({ name: "", fieldKey: "", fieldType: "TEXT", placeholder: "", isRequired: false, options: "" });
    setShowAddField(null);
    loadSections();
  }

  async function handleDeleteField(id: string) {
    if (!confirm("Remove this custom field?")) return;
    await apiDelete(`/api/custom-fields/definitions/${id}`);
    loadSections();
  }

  const fieldTypeIcon: Record<string, string> = {
    TEXT: "Aa", NUMBER: "#", DATE: "📅", DROPDOWN: "▾", CHECKBOX: "☑", TEXTAREA: "¶",
    EMAIL: "@", PHONE: "📞", URL: "🔗", CURRENCY: "$",
  };

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Custom Fields & Sections</h2>
        <p className="text-sm text-gray-500 mt-1">Add custom fields to clients, jobs, quotes, invoices, and properties</p>
      </div>

      {/* Entity tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-6 w-fit">
        {ENTITIES.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setEntity(key)}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              entity === key ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-gray-400 py-4">Loading...</p>
      ) : (
        <div className="space-y-4">
          {/* Sections */}
          {sections.map((section) => (
            <div key={section.id} className="card">
              <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
                <h3 className="font-semibold text-sm text-gray-800">{section.name}</h3>
                <div className="flex items-center gap-2">
                  <button onClick={() => setShowAddField(section.id)} className="text-xs text-turf-600 hover:underline">+ Add Field</button>
                  <button onClick={() => handleDeleteSection(section.id)} className="text-xs text-red-400 hover:text-red-600">Remove</button>
                </div>
              </div>

              {/* Fields in this section */}
              {section.fields.length === 0 && showAddField !== section.id ? (
                <div className="px-5 py-4 text-sm text-gray-400">No fields yet. Click "+ Add Field" to create one.</div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {section.fields.map((field) => (
                    <div key={field.id} className="flex items-center justify-between px-5 py-2.5">
                      <div className="flex items-center gap-3">
                        <span className="w-7 h-7 bg-gray-100 rounded flex items-center justify-center text-xs font-mono text-gray-500">
                          {fieldTypeIcon[field.fieldType] || "?"}
                        </span>
                        <div>
                          <p className="text-sm font-medium text-gray-700">
                            {field.name}
                            {field.isRequired && <span className="text-red-400 ml-1">*</span>}
                          </p>
                          <p className="text-xs text-gray-400">{field.fieldType.toLowerCase()} · key: {field.fieldKey}</p>
                        </div>
                      </div>
                      <button onClick={() => handleDeleteField(field.id)} className="text-xs text-gray-300 hover:text-red-500">✕</button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add field form (inline) */}
              {showAddField === section.id && (
                <form onSubmit={(e) => handleAddField(e, section.id)} className="px-5 py-3 bg-gray-50 border-t border-gray-100 space-y-2">
                  <div className="grid grid-cols-3 gap-2">
                    <input className="input text-sm" placeholder="Field name" value={newField.name} onChange={(e) => setNewField({ ...newField, name: e.target.value })} required />
                    <select className="input text-sm" value={newField.fieldType} onChange={(e) => setNewField({ ...newField, fieldType: e.target.value })}>
                      {FIELD_TYPES.map(({ key, label }) => <option key={key} value={key}>{label}</option>)}
                    </select>
                    <input className="input text-sm" placeholder="Placeholder text" value={newField.placeholder} onChange={(e) => setNewField({ ...newField, placeholder: e.target.value })} />
                  </div>
                  {newField.fieldType === "DROPDOWN" && (
                    <input className="input text-sm" placeholder="Options (comma separated): Option 1, Option 2, Option 3" value={newField.options} onChange={(e) => setNewField({ ...newField, options: e.target.value })} />
                  )}
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-1.5 text-sm text-gray-600">
                      <input type="checkbox" checked={newField.isRequired} onChange={(e) => setNewField({ ...newField, isRequired: e.target.checked })} className="rounded" />
                      Required
                    </label>
                    <button type="submit" className="btn-primary text-xs py-1.5 px-3">Add Field</button>
                    <button type="button" onClick={() => setShowAddField(null)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                  </div>
                </form>
              )}
            </div>
          ))}

          {/* Add section */}
          {showAddSection ? (
            <form onSubmit={handleAddSection} className="card p-4 flex gap-2">
              <input className="input flex-1 text-sm" placeholder="Section name (e.g., Property Details, Billing Info)" value={newSectionName} onChange={(e) => setNewSectionName(e.target.value)} required autoFocus />
              <button type="submit" className="btn-primary text-sm">Create</button>
              <button type="button" onClick={() => setShowAddSection(false)} className="btn-secondary text-sm">Cancel</button>
            </form>
          ) : (
            <button onClick={() => setShowAddSection(true)} className="btn-secondary w-full justify-center py-3">
              + Add Section to {ENTITIES.find((e) => e.key === entity)?.label}
            </button>
          )}

          {/* Help text */}
          <div className="bg-gray-50 rounded-lg p-4 text-xs text-gray-500">
            <p className="font-semibold text-gray-600 mb-1">How custom fields work:</p>
            <ul className="space-y-0.5 list-disc pl-4">
              <li>Create <strong>sections</strong> to group related fields (e.g., "Referral Info", "Property Details")</li>
              <li>Add <strong>fields</strong> within sections — they'll appear on all {ENTITIES.find((e) => e.key === entity)?.label.toLowerCase()} forms</li>
              <li>Supported types: text, number, date, dropdown, checkbox, long text, email, phone, URL, currency</li>
              <li>Fields marked as <strong>required</strong> must be filled in before saving</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

// ── User Management ──────────────────────────────────────────────────────

function UserManagement({ currentUser }: { currentUser: { id: string; name: string; email: string; role: string } | null }) {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newConfirmPassword, setNewConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [newRole, setNewRole] = useState<"TECHNICIAN" | "VIEWER">("TECHNICIAN");
  const [error, setError] = useState("");

  // Invite link state
  const [inviteRole, setInviteRole] = useState<"TECHNICIAN" | "VIEWER">("TECHNICIAN");
  const [inviteLink, setInviteLink] = useState("");
  const [inviteCopied, setInviteCopied] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);

  async function loadUsers() {
    try {
      const data = await api<UserRecord[]>("/api/users");
      setUsers(data);
    } catch {
      // If /api/users doesn't exist yet, fall back to showing current user only
      if (currentUser) {
        setUsers([{ ...currentUser, createdAt: new Date().toISOString() }]);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadUsers(); }, []);

  async function handleAddUser(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    // Validation
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (newPassword !== newConfirmPassword) {
      setError("Passwords do not match");
      return;
    }

    try {
      await apiPost("/api/auth/register", { name: newName, email: newEmail, password: newPassword, role: newRole });
      setShowAdd(false);
      setNewName("");
      setNewEmail("");
      setNewPassword("");
      setNewConfirmPassword("");
      setShowPassword(false);
      setShowConfirmPassword(false);
      loadUsers();
    } catch (e: any) {
      setError(e.message || "Failed to create user");
    }
  }

  async function handleGenerateInvite() {
    setInviteLoading(true);
    setInviteLink("");
    try {
      const res = await authApi.createInvite(inviteRole);
      // Build frontend invite URL
      const baseUrl = window.location.origin;
      setInviteLink(`${baseUrl}/invite/${res.token}`);
    } catch (e: any) {
      setError(e.message || "Failed to generate invite link");
    } finally {
      setInviteLoading(false);
    }
  }

  function handleCopyInvite() {
    navigator.clipboard.writeText(inviteLink);
    setInviteCopied(true);
    setTimeout(() => setInviteCopied(false), 2000);
  }

  async function handleRoleChange(userId: string, role: string) {
    try {
      await apiPut(`/api/users/${userId}/role`, { role });
      loadUsers();
    } catch {
      // endpoint may not exist yet
    }
  }

  async function handleDeactivate(userId: string) {
    try {
      await authApi.deactivateUser(userId);
      loadUsers();
    } catch (e: any) {
      setError(e.message || "Failed to deactivate user");
    }
  }

  async function handleReactivate(userId: string) {
    try {
      await authApi.reactivateUser(userId);
      loadUsers();
    } catch (e: any) {
      setError(e.message || "Failed to reactivate user");
    }
  }

  const roleColors: Record<string, string> = {
    ADMIN: "bg-red-100 text-red-700",
    TECHNICIAN: "bg-blue-100 text-blue-700",
    VIEWER: "bg-gray-100 text-gray-600",
  };

  // Eye icon SVG for show/hide password
  const EyeIcon = ({ open }: { open: boolean }) => (
    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      {open ? (
        <>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </>
      ) : (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.98 8.223A10.477 10.477 0 001.934 12c1.292 4.338 5.31 7.5 10.066 7.5.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
      )}
    </svg>
  );

  return (
    <div className="card p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Users & Roles</h2>
          <p className="text-sm text-gray-500 mt-0.5">Manage team members and their permissions</p>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} className="btn-primary text-sm">
          {showAdd ? "Cancel" : "+ Add User"}
        </button>
      </div>

      {/* Add user form */}
      {showAdd && (
        <form onSubmit={handleAddUser} className="bg-gray-50 rounded-lg p-4 mb-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Full Name</label>
              <input className="input" value={newName} onChange={(e) => setNewName(e.target.value)} required />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} required />
            </div>
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input
                  className="input pr-10"
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="Min 6 characters"
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-200 rounded"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  <EyeIcon open={showPassword} />
                </button>
              </div>
            </div>
            <div>
              <label className="label">Confirm Password</label>
              <div className="relative">
                <input
                  className="input pr-10"
                  type={showConfirmPassword ? "text" : "password"}
                  value={newConfirmPassword}
                  onChange={(e) => setNewConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="Re-enter password"
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-200 rounded"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  tabIndex={-1}
                >
                  <EyeIcon open={showConfirmPassword} />
                </button>
              </div>
              {newConfirmPassword && newPassword !== newConfirmPassword && (
                <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
              )}
            </div>
            <div>
              <label className="label">Role</label>
              <select className="input" value={newRole} onChange={(e) => setNewRole(e.target.value as "TECHNICIAN" | "VIEWER")}>
                <option value="TECHNICIAN">Technician -- Jobs & schedule</option>
                <option value="VIEWER">Viewer -- Read-only</option>
              </select>
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" className="btn-primary text-sm">Create User</button>
        </form>
      )}

      {/* Invite Link Generator */}
      <div className="bg-blue-50 rounded-lg p-4 mb-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Invite Link</h3>
        <p className="text-xs text-gray-500 mb-3">Generate a shareable link to invite a new team member. The link expires after 7 days.</p>
        <div className="flex items-center gap-3">
          <select
            className="input w-48 text-sm"
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value as "TECHNICIAN" | "VIEWER")}
          >
            <option value="TECHNICIAN">Technician</option>
            <option value="VIEWER">Viewer</option>
          </select>
          <button
            type="button"
            onClick={handleGenerateInvite}
            disabled={inviteLoading}
            className="btn-primary text-sm"
          >
            {inviteLoading ? "Generating..." : "Generate Invite Link"}
          </button>
        </div>
        {inviteLink && (
          <div className="mt-3 flex items-center gap-2 bg-white rounded-lg border border-blue-200 p-3">
            <input
              className="flex-1 text-sm text-gray-700 bg-transparent outline-none font-mono"
              value={inviteLink}
              readOnly
              onClick={(e) => (e.target as HTMLInputElement).select()}
            />
            <button
              type="button"
              onClick={handleCopyInvite}
              className="shrink-0 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700 transition-colors"
            >
              {inviteCopied ? "Copied!" : "Copy"}
            </button>
          </div>
        )}
      </div>

      {/* User table */}
      {loading ? (
        <p className="text-sm text-gray-400 py-4">Loading...</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 uppercase tracking-wider border-b">
              <th className="pb-2 font-medium">Name</th>
              <th className="pb-2 font-medium">Email</th>
              <th className="pb-2 font-medium">Role</th>
              <th className="pb-2 font-medium">Status</th>
              <th className="pb-2 font-medium">Joined</th>
              <th className="pb-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className={`border-b border-gray-100 last:border-0 ${u.isActive === false ? "opacity-60" : ""}`}>
                <td className="py-3 font-medium text-gray-900">
                  {u.name}
                  {u.id === currentUser?.id && (
                    <span className="ml-2 text-xs text-gray-400">(you)</span>
                  )}
                </td>
                <td className="py-3 text-gray-600">{u.email}</td>
                <td className="py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${roleColors[u.role] || "bg-gray-100 text-gray-600"}`}>
                    {u.role}
                  </span>
                </td>
                <td className="py-3">
                  {u.isActive === false ? (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-500">Inactive</span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Active</span>
                  )}
                </td>
                <td className="py-3 text-gray-500">{new Date(u.createdAt).toLocaleDateString()}</td>
                <td className="py-3">
                  <div className="flex items-center gap-2">
                    {u.id !== currentUser?.id && (
                      <>
                        <select
                          className="text-xs border rounded px-2 py-1"
                          value={u.role}
                          onChange={(e) => handleRoleChange(u.id, e.target.value)}
                        >
                          <option value="ADMIN">Admin</option>
                          <option value="TECHNICIAN">Technician</option>
                          <option value="VIEWER">Viewer</option>
                        </select>
                        {u.isActive === false ? (
                          <button
                            onClick={() => handleReactivate(u.id)}
                            className="text-xs px-2 py-1 rounded bg-green-100 text-green-700 hover:bg-green-200 transition-colors"
                          >
                            Reactivate
                          </button>
                        ) : (
                          <button
                            onClick={() => handleDeactivate(u.id)}
                            className="text-xs px-2 py-1 rounded bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
                          >
                            Deactivate
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {error && !showAdd && <p className="text-sm text-red-600 mt-2">{error}</p>}

      {/* Permission descriptions */}
      <div className="mt-6 bg-gray-50 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Role Permissions</h3>
        <div className="grid grid-cols-3 gap-4 text-xs text-gray-600">
          <div>
            <p className="font-medium text-red-700 mb-1">Admin</p>
            <ul className="space-y-0.5">
              <li>Full access to all features</li>
              <li>Manage users and settings</li>
              <li>AI agent controls</li>
              <li>View analytics and reports</li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-blue-700 mb-1">Technician</p>
            <ul className="space-y-0.5">
              <li>View and update assigned jobs</li>
              <li>Upload photos and checklists</li>
              <li>View schedule</li>
              <li>Log chemical applications</li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-gray-600 mb-1">Viewer</p>
            <ul className="space-y-0.5">
              <li>View-only access</li>
              <li>View schedule and clients</li>
              <li>Cannot modify data</li>
              <li>Cannot use AI agent</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── AI Agent Settings ────────────────────────────────────────────────────

const MCP_VIEW_TOOLS = [
  { key: "lookup_client", name: "Find Client", desc: "Look up a client by name, phone, or email" },
  { key: "lookup_property", name: "Find Property", desc: "Look up a property by address or client" },
  { key: "lookup_job", name: "Find Job", desc: "Look up a job by ID, client, or date" },
  { key: "lookup_quote", name: "Find Quote", desc: "Look up a quote by ID or client" },
  { key: "list_clients", name: "List All Clients", desc: "Show all your clients in a list" },
  { key: "get_schedule", name: "Check Schedule", desc: "See upcoming jobs on your calendar" },
  { key: "get_service_catalog", name: "View Services & Pricing", desc: "Show your service menu and prices" },
  { key: "get_dashboard_stats", name: "Business Dashboard", desc: "See revenue, job counts, and trends" },
  { key: "check_weather", name: "Weather Forecast", desc: "Get the weather for scheduling decisions" },
];

const MCP_ACTION_TOOLS = [
  { key: "draft_quote", name: "Create Quote", desc: "Draft a new quote for a client" },
  { key: "create_job", name: "Schedule Job", desc: "Add a new job to the schedule" },
  { key: "mark_job_complete", name: "Complete Job", desc: "Mark a job as finished" },
  { key: "update_client", name: "Update Client Info", desc: "Change a client's name, phone, or address" },
  { key: "add_line_item", name: "Add to Quote/Invoice", desc: "Add a line item to a quote or invoice" },
  { key: "create_invoice", name: "Create Invoice", desc: "Generate an invoice for completed work" },
  { key: "log_chemical", name: "Log Chemical Application", desc: "Record a fertilizer or chemical treatment" },
  { key: "send_notification", name: "Send Reminder", desc: "Send a reminder text or email to a client" },
];

const AGENT_SKILLS = [
  { name: "Client Management", desc: "Find, add, and update customer info" },
  { name: "Job Scheduling", desc: "Create, reschedule, and complete jobs" },
  { name: "Quoting & Invoicing", desc: "Build quotes and generate invoices" },
  { name: "Property Care", desc: "Track property details and chemical logs" },
  { name: "Business Insights", desc: "Revenue, schedule, and weather reports" },
  { name: "Main Agent", desc: "Coordinates all skills and conversations" },
];

function AIAgentSettings() {
  const [aiHealth, setAiHealth] = useState<any>(null);
  const [healthError, setHealthError] = useState(false);
  const [agentStyle, setAgentStyle] = useState("Professional");
  const [confirmMode, setConfirmMode] = useState(true);
  const [proactiveSuggestions, setProactiveSuggestions] = useState(true);
  const [disabledTools, setDisabledTools] = useState<string[]>([]);

  useEffect(() => {
    // Fetch AI health
    fetch("/ai/health")
      .then((r) => r.json())
      .then((data) => setAiHealth(data))
      .catch(() => setHealthError(true));

    // Load preferences from localStorage
    setAgentStyle(localStorage.getItem("am_agent_style") || "Professional");
    setConfirmMode(localStorage.getItem("am_agent_confirm") !== "false");
    setProactiveSuggestions(localStorage.getItem("am_agent_proactive") !== "false");

    const stored = localStorage.getItem("am_disabled_tools");
    if (stored) {
      try { setDisabledTools(JSON.parse(stored)); } catch {}
    }
  }, []);

  function saveStyle(val: string) {
    setAgentStyle(val);
    localStorage.setItem("am_agent_style", val);
  }

  function saveConfirmMode(val: boolean) {
    setConfirmMode(val);
    localStorage.setItem("am_agent_confirm", String(val));
  }

  function saveProactive(val: boolean) {
    setProactiveSuggestions(val);
    localStorage.setItem("am_agent_proactive", String(val));
  }

  function toggleTool(toolKey: string) {
    const next = disabledTools.includes(toolKey)
      ? disabledTools.filter((k) => k !== toolKey)
      : [...disabledTools, toolKey];
    setDisabledTools(next);
    localStorage.setItem("am_disabled_tools", JSON.stringify(next));
  }

  // Derive model display name
  const modelRaw = aiHealth?.model || "";
  const modelDisplay = modelRaw
    ? modelRaw.replace("qwen3.5:", "Qwen 3.5 · ").replace("0.8b", "0.8B parameters").replace("2b", "2B parameters").replace("4b", "4B parameters").replace("9b", "9B parameters").replace("27b", "27B parameters")
    : "Unknown";

  const inferenceMode = aiHealth?.nemoclaw?.nvidia_cloud ? "Cloud + Local" : "Running Locally";
  const openclawActive = aiHealth?.nemoclaw?.openclaw ?? false;
  const sandboxSecured = aiHealth?.nemoclaw?.sandbox_active ?? false;

  // Placeholder audit stats (would come from localStorage or API)
  const actionsToday = parseInt(localStorage.getItem("am_audit_today_count") || "0", 10);
  const totalSessions = parseInt(localStorage.getItem("am_audit_session_count") || "0", 10);

  return (
    <div className="max-w-3xl space-y-6">
      {/* ── 1. Agent Status ───────────────────────────────────────── */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Agent Status</h2>
        <p className="text-sm text-gray-500 mb-4">Your AI assistant's current connection and setup</p>

        <div className="flex items-center gap-3 mb-4">
          <span className={`w-3 h-3 rounded-full ${aiHealth && !healthError ? "bg-green-500" : "bg-red-500"}`} />
          <span className="text-sm font-medium text-gray-800">
            {aiHealth && !healthError ? "Connected" : "Disconnected"}
          </span>
        </div>

        {aiHealth && (
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-gray-50 rounded-lg px-4 py-3">
              <p className="text-xs text-gray-500 mb-0.5">Model</p>
              <p className="font-medium text-gray-800">{modelDisplay}</p>
            </div>
            <div className="bg-gray-50 rounded-lg px-4 py-3">
              <p className="text-xs text-gray-500 mb-0.5">Inference Mode</p>
              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                inferenceMode === "Running Locally"
                  ? "bg-green-100 text-green-700"
                  : "bg-blue-100 text-blue-700"
              }`}>
                {inferenceMode}
              </span>
            </div>
            <div className="bg-gray-50 rounded-lg px-4 py-3">
              <p className="text-xs text-gray-500 mb-0.5">OpenClaw</p>
              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                openclawActive ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-500"
              }`}>
                {openclawActive ? "Active" : "Not Available"}
              </span>
            </div>
            <div className="bg-gray-50 rounded-lg px-4 py-3">
              <p className="text-xs text-gray-500 mb-0.5">NemoClaw Sandbox</p>
              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                sandboxSecured ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
              }`}>
                {sandboxSecured ? "Secured" : "Application Safety Only"}
              </span>
            </div>
          </div>
        )}

        {healthError && (
          <p className="text-sm text-red-500 mt-2">
            Could not reach the AI service. Make sure it's running.
          </p>
        )}
      </div>

      {/* ── 2. AI Personality ─────────────────────────────────────── */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">AI Personality</h2>
        <p className="text-sm text-gray-500 mb-4">Control how your AI assistant talks and behaves</p>

        <div className="space-y-5">
          {/* Response Style */}
          <div>
            <label className="label">Response Style</label>
            <p className="text-xs text-gray-400 mb-1.5">Pick how the AI sounds when it talks to you</p>
            <select
              className="input max-w-xs"
              value={agentStyle}
              onChange={(e) => saveStyle(e.target.value)}
            >
              <option value="Professional">Professional</option>
              <option value="Friendly">Friendly</option>
              <option value="Brief">Brief</option>
            </select>
          </div>

          {/* Confirmation Mode */}
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-gray-900">Confirmation Mode</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {confirmMode
                  ? "AI asks for your OK before making any changes"
                  : "AI makes simple changes automatically (still confirms big actions)"}
              </p>
            </div>
            <button
              onClick={() => saveConfirmMode(!confirmMode)}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                confirmMode ? "bg-turf-500" : "bg-gray-300"
              }`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                confirmMode ? "translate-x-5" : ""
              }`} />
            </button>
          </div>

          {/* Proactive Suggestions */}
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-gray-900">Proactive Suggestions</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {proactiveSuggestions
                  ? "AI will remind you about overdue invoices, weather alerts, and follow-ups"
                  : "AI only responds when you ask"}
              </p>
            </div>
            <button
              onClick={() => saveProactive(!proactiveSuggestions)}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                proactiveSuggestions ? "bg-turf-500" : "bg-gray-300"
              }`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                proactiveSuggestions ? "translate-x-5" : ""
              }`} />
            </button>
          </div>
        </div>
      </div>

      {/* ── 3. MCP Tools ─────────────────────────────────────────── */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">AI Tools</h2>
        <p className="text-sm text-gray-500 mb-4">Choose which tools the AI is allowed to use</p>

        {/* View Tools */}
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">View Tools</h3>
          <p className="text-xs text-gray-400 mb-3">These let the AI look up information</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 uppercase tracking-wider border-b">
                <th className="pb-2 font-medium">Tool</th>
                <th className="pb-2 font-medium">What It Does</th>
                <th className="pb-2 font-medium text-right">Enabled</th>
              </tr>
            </thead>
            <tbody>
              {MCP_VIEW_TOOLS.map((tool) => {
                const enabled = !disabledTools.includes(tool.key);
                const lastUsed = localStorage.getItem(`am_tool_last_${tool.key}`);
                return (
                  <tr key={tool.key} className="border-b border-gray-100 last:border-0">
                    <td className="py-2.5 font-medium text-gray-800">{tool.name}</td>
                    <td className="py-2.5 text-gray-500">
                      {tool.desc}
                      <span className="block text-xs text-gray-300 mt-0.5">
                        Last used: {lastUsed || "Never"}
                      </span>
                    </td>
                    <td className="py-2.5 text-right">
                      <button
                        onClick={() => toggleTool(tool.key)}
                        className={`relative w-11 h-6 rounded-full transition-colors ${
                          enabled ? "bg-turf-500" : "bg-gray-300"
                        }`}
                      >
                        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                          enabled ? "translate-x-5" : ""
                        }`} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Action Tools */}
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Action Tools</h3>
          <p className="text-xs text-gray-400 mb-3">These let the AI make changes (with your approval)</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 uppercase tracking-wider border-b">
                <th className="pb-2 font-medium">Tool</th>
                <th className="pb-2 font-medium">What It Does</th>
                <th className="pb-2 font-medium text-right">Enabled</th>
              </tr>
            </thead>
            <tbody>
              {MCP_ACTION_TOOLS.map((tool) => {
                const enabled = !disabledTools.includes(tool.key);
                const lastUsed = localStorage.getItem(`am_tool_last_${tool.key}`);
                return (
                  <tr key={tool.key} className="border-b border-gray-100 last:border-0">
                    <td className="py-2.5 font-medium text-gray-800">{tool.name}</td>
                    <td className="py-2.5 text-gray-500">
                      {tool.desc}
                      <span className="block text-xs text-gray-300 mt-0.5">
                        Last used: {lastUsed || "Never"}
                      </span>
                    </td>
                    <td className="py-2.5 text-right">
                      <button
                        onClick={() => toggleTool(tool.key)}
                        className={`relative w-11 h-6 rounded-full transition-colors ${
                          enabled ? "bg-turf-500" : "bg-gray-300"
                        }`}
                      >
                        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                          enabled ? "translate-x-5" : ""
                        }`} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 4. Skills ─────────────────────────────────────────────── */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Loaded Skills</h2>
        <p className="text-sm text-gray-500 mb-4">These are the skill sets your AI assistant knows</p>

        <div className="grid grid-cols-2 gap-3">
          {AGENT_SKILLS.map((skill) => (
            <div key={skill.name} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-medium text-gray-800">{skill.name}</p>
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                  Active
                </span>
              </div>
              <p className="text-xs text-gray-500">{skill.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── 5. Audit Summary ──────────────────────────────────────── */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Activity Tracking</h2>
        <p className="text-sm text-gray-500 mb-4">Summary of AI actions in your workspace</p>

        <div className="flex items-center gap-6 mb-4">
          <div className="bg-gray-50 rounded-lg px-4 py-3 flex-1 text-center">
            <p className="text-2xl font-bold text-gray-900">{actionsToday}</p>
            <p className="text-xs text-gray-500">actions tracked today</p>
          </div>
          <div className="bg-gray-50 rounded-lg px-4 py-3 flex-1 text-center">
            <p className="text-2xl font-bold text-gray-900">{totalSessions}</p>
            <p className="text-xs text-gray-500">sessions total</p>
          </div>
        </div>

        <a
          href="/ai-activity"
          className="inline-flex items-center text-sm font-medium text-turf-600 hover:text-turf-700 hover:underline"
        >
          View Full Activity Log &rarr;
        </a>
      </div>
    </div>
  );
}

// ── Guardrails Settings ──────────────────────────────────────────────────

function GuardrailsSettings() {
  const [config, setConfig] = useState<GuardrailsConfig>({
    enabled: true,
    inputRails: { checkJailbreak: true, checkPromptInjection: true },
    model: "qwen3.5:2b",
  });
  const [aiHealth, setAiHealth] = useState<any>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    // Load current AI health/model info
    fetch("/ai/health")
      .then((r) => r.json())
      .then((data) => {
        setAiHealth(data);
        setConfig((prev) => ({ ...prev, model: data.model || prev.model, enabled: data.guardrails ?? prev.enabled }));
      })
      .catch(() => {});

    // Load saved config from localStorage
    const saved = localStorage.getItem("am_guardrails_config");
    if (saved) {
      try {
        setConfig(JSON.parse(saved));
      } catch {}
    }
  }, []);

  function handleSave() {
    localStorage.setItem("am_guardrails_config", JSON.stringify(config));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">NemoClaw Security</h2>
        <p className="text-sm text-gray-500 mb-4">Control AI safety rails and behavior boundaries</p>

        {/* AI Status */}
        <div className="bg-gray-50 rounded-lg p-4 mb-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700">AI Service Status</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Model: <span className="font-mono">{aiHealth?.model || config.model}</span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${aiHealth ? "bg-green-500" : "bg-red-500"}`} />
              <span className="text-sm text-gray-600">{aiHealth ? "Connected" : "Disconnected"}</span>
            </div>
          </div>
          {aiHealth && (
            <div className="mt-2 space-y-1 text-xs text-gray-500">
              <div>
                Guardrails:{" "}
                <span className={aiHealth.guardrails ? "text-green-600 font-medium" : "text-yellow-600 font-medium"}>
                  {aiHealth.guardrails ? "Active" : "Inactive (direct mode)"}
                </span>
              </div>
              {aiHealth.nemoclaw && (
                <>
                  <div>
                    Inference mode:{" "}
                    <span className="font-medium text-gray-700">
                      {aiHealth.nemoclaw.inference_mode || "local"}
                    </span>
                  </div>
                  {aiHealth.nemoclaw.nvidia_cloud && (
                    <div>
                      Cloud inference:{" "}
                      <span className="font-medium text-green-600">Active (Nemotron)</span>
                    </div>
                  )}
                  {aiHealth.nemoclaw.sandbox_active && (
                    <div>
                      OpenShell sandbox:{" "}
                      <span className="font-medium text-green-600">Active</span>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Guardrails toggle */}
        <div className="space-y-4">
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-gray-900">Enable NeMo Guardrails</p>
              <p className="text-xs text-gray-500">Routes all AI messages through safety checks before responding</p>
            </div>
            <button
              onClick={() => setConfig((c) => ({ ...c, enabled: !c.enabled }))}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                config.enabled ? "bg-turf-500" : "bg-gray-300"
              }`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                config.enabled ? "translate-x-5" : ""
              }`} />
            </button>
          </div>

          {/* Input Rails */}
          <div className="pl-4 border-l-2 border-gray-200 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Input Rails</p>

            <div className="flex items-center justify-between py-1">
              <div>
                <p className="text-sm text-gray-700">Jailbreak Detection</p>
                <p className="text-xs text-gray-400">Blocks attempts to override AI instructions</p>
              </div>
              <button
                onClick={() => setConfig((c) => ({
                  ...c,
                  inputRails: { ...c.inputRails, checkJailbreak: !c.inputRails.checkJailbreak },
                }))}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  config.inputRails.checkJailbreak ? "bg-turf-500" : "bg-gray-300"
                }`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  config.inputRails.checkJailbreak ? "translate-x-5" : ""
                }`} />
              </button>
            </div>

            <div className="flex items-center justify-between py-1">
              <div>
                <p className="text-sm text-gray-700">Prompt Injection Detection</p>
                <p className="text-xs text-gray-400">Detects and blocks prompt injection attacks</p>
              </div>
              <button
                onClick={() => setConfig((c) => ({
                  ...c,
                  inputRails: { ...c.inputRails, checkPromptInjection: !c.inputRails.checkPromptInjection },
                }))}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  config.inputRails.checkPromptInjection ? "bg-turf-500" : "bg-gray-300"
                }`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  config.inputRails.checkPromptInjection ? "translate-x-5" : ""
                }`} />
              </button>
            </div>
          </div>

          {/* Agent Behavior */}
          <div className="pl-4 border-l-2 border-gray-200 space-y-3 pt-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Agent Behavior</p>
            <div className="flex items-center justify-between py-1">
              <div>
                <p className="text-sm text-gray-700">Require Confirmation for Write Actions</p>
                <p className="text-xs text-gray-400">AI must show pending action card before creating/modifying data</p>
              </div>
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">Always On</span>
            </div>
            <div className="flex items-center justify-between py-1">
              <div>
                <p className="text-sm text-gray-700">Stay On Topic (Landscaping Only)</p>
                <p className="text-xs text-gray-400">AI will refuse to discuss unrelated topics</p>
              </div>
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">Always On</span>
            </div>
          </div>
        </div>

        <div className="pt-4 mt-4 border-t">
          <button onClick={handleSave} className="btn-primary">
            {saved ? "Saved!" : "Save Configuration"}
          </button>
          <p className="text-xs text-gray-400 mt-2">
            Note: Changes to guardrails require an AI service restart to take full effect.
          </p>
        </div>
      </div>

      {/* Model Info */}
      <div className="card p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Qwen 3.5 Model Tiers</h3>
        <p className="text-xs text-gray-500 mb-3">The model is auto-selected based on available RAM at startup.</p>
        <div className="space-y-2 text-xs">
          {[
            { model: "qwen3.5:0.8b", ram: "< 4 GB", quality: "Basic" },
            { model: "qwen3.5:2b", ram: "4-7 GB", quality: "Good" },
            { model: "qwen3.5:4b", ram: "8-15 GB", quality: "Better" },
            { model: "qwen3.5:9b", ram: "16-31 GB", quality: "Great" },
            { model: "qwen3.5:27b", ram: "32+ GB", quality: "Best" },
          ].map(({ model, ram, quality }) => (
            <div
              key={model}
              className={`flex items-center justify-between p-2 rounded ${
                (aiHealth?.model || config.model) === model
                  ? "bg-turf-50 border border-turf-300"
                  : "bg-gray-50"
              }`}
            >
              <div className="flex items-center gap-2">
                {(aiHealth?.model || config.model) === model && (
                  <span className="text-turf-600">●</span>
                )}
                <span className="font-mono">{model}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-gray-500">RAM: {ram}</span>
                <span className="text-gray-400">{quality}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Integrations Settings ────────────────────────────────────────────────

function IntegrationsSettings() {
  const [newKey, setNewKey] = useState("");
  const [nvidiaStatus, setNvidiaStatus] = useState<"connected" | "not_configured">("not_configured");
  const [keyPreview, setKeyPreview] = useState("");
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    // Check if key is configured on the backend
    api<{ nvidia_api_key_set?: boolean; nvidia_api_key_preview?: string }>("/api/settings")
      .then((s) => {
        if (s.nvidia_api_key_set) {
          setNvidiaStatus("connected");
          setKeyPreview(s.nvidia_api_key_preview || "nvapi-****");
        }
      })
      .catch(() => {});
  }, []);

  async function handleSaveKey() {
    if (!newKey.trim()) return;
    setSaving(true);
    setTestResult(null);
    try {
      const res = await apiPost<{ success: boolean; valid: boolean; error?: string; preview: string }>(
        "/api/settings/nvidia-key", { key: newKey }
      );
      setNvidiaStatus("connected");
      setKeyPreview(res.preview);
      setNewKey("");
      setTestResult({
        ok: res.valid,
        message: res.valid ? "Key saved and verified" : `Key saved but verification failed: ${res.error || "unknown error"}`,
      });
    } catch (e: any) {
      setTestResult({ ok: false, message: e.message || "Failed to save key" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteKey() {
    if (!confirm("Remove the NVIDIA API key? The AI will fall back to local Ollama.")) return;
    setDeleting(true);
    try {
      await api<{ success: boolean }>("/api/settings/nvidia-key", { method: "DELETE" });
      setNvidiaStatus("not_configured");
      setKeyPreview("");
      setTestResult(null);
    } catch {
      // ignore
    } finally {
      setDeleting(false);
    }
  }

  async function handleTestConnection() {
    setTestLoading(true);
    setTestResult(null);
    try {
      const res = await apiPost<{ valid: boolean; status?: number; error?: string }>("/api/settings/nvidia-key/test", {});
      setTestResult({
        ok: res.valid,
        message: res.valid ? "Connection verified — Nemotron cloud is reachable" : `Test failed: ${res.error || `HTTP ${res.status}`}`,
      });
    } catch (e: any) {
      setTestResult({ ok: false, message: e.message || "Could not reach test endpoint" });
    } finally {
      setTestLoading(false);
    }
  }

  const futureIntegrations = [
    { name: "QuickBooks Online", desc: "Sync invoices and payments", icon: "QB" },
    { name: "Stripe", desc: "Accept online payments", icon: "S" },
    { name: "Twilio", desc: "SMS notifications and reminders", icon: "T" },
    { name: "Google Calendar", desc: "Sync schedules and appointments", icon: "GC" },
  ];

  return (
    <div className="max-w-2xl space-y-6">
      {/* NVIDIA API Section */}
      <div className="card p-6">
        <div className="flex items-start justify-between mb-1">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">NVIDIA API</h2>
            <p className="text-sm text-gray-500 mt-1">
              Connect to NVIDIA Nemotron cloud for enhanced AI inference. The AI agent will use Nemotron for
              better quality responses and fall back to local Ollama when unavailable.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 ml-4">
            <span className={`w-2.5 h-2.5 rounded-full ${nvidiaStatus === "connected" ? "bg-green-500" : "bg-gray-300"}`} />
            <span className={`text-sm font-medium ${nvidiaStatus === "connected" ? "text-green-600" : "text-gray-400"}`}>
              {nvidiaStatus === "connected" ? "Connected" : "Not configured"}
            </span>
          </div>
        </div>

        <div className="mt-4 space-y-4">
          {nvidiaStatus === "connected" ? (
            <>
              <div>
                <label className="label">NVIDIA API Key</label>
                <div className="flex items-center gap-3">
                  <div className="input bg-gray-50 flex-1 font-mono text-gray-500 cursor-default">
                    {keyPreview}
                  </div>
                  <button
                    onClick={handleDeleteKey}
                    disabled={deleting}
                    className="px-3 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    {deleting ? "Removing..." : "Remove Key"}
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleTestConnection}
                  disabled={testLoading}
                  className="btn-secondary text-sm"
                >
                  {testLoading ? "Testing..." : "Test Connection"}
                </button>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="label">NVIDIA API Key</label>
                <input
                  className="input"
                  type="password"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  placeholder="nvapi-..."
                  autoComplete="off"
                />
              </div>
              <button
                onClick={handleSaveKey}
                disabled={!newKey.trim() || saving}
                className="btn-primary text-sm"
              >
                {saving ? "Saving..." : "Save Key"}
              </button>
            </>
          )}

          {testResult && (
            <div className={`text-sm px-3 py-2 rounded-lg ${testResult.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
              {testResult.message}
            </div>
          )}

          <div className="bg-gray-50 rounded-lg p-4 text-xs text-gray-600 space-y-2">
            <p className="font-semibold text-gray-700">How to get your NVIDIA API key:</p>
            <ol className="list-decimal pl-4 space-y-1">
              <li>Go to <a href="https://build.nvidia.com" target="_blank" rel="noopener noreferrer" className="text-turf-600 hover:underline font-medium">build.nvidia.com</a></li>
              <li>Sign in or create a free NVIDIA account</li>
              <li>Search for <strong>Nemotron</strong></li>
              <li>Click <strong>"Get API Key"</strong> — it generates a key starting with <code className="bg-gray-200 px-1 rounded">nvapi-</code></li>
              <li>Copy the key and paste it above</li>
            </ol>
            <p className="text-gray-400 pt-1">Free tier available — no credit card required. The AI agent will use Nemotron cloud for better responses and fall back to local Ollama when unavailable.</p>
          </div>
        </div>
      </div>

      {/* Cloud Integrations */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">More Integrations</h2>
        <p className="text-sm text-gray-500 mb-4">Available with AgenticMeadows Cloud</p>

        <div className="grid grid-cols-2 gap-3">
          {futureIntegrations.map((integration) => (
            <div
              key={integration.name}
              className="relative border border-gray-200 rounded-lg p-4 opacity-60"
            >
              <span className="absolute top-2 right-2 text-xs font-medium bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
                Cloud Only
              </span>
              <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-400 mb-3">
                {integration.icon}
              </div>
              <p className="text-sm font-medium text-gray-700">{integration.name}</p>
              <p className="text-xs text-gray-400 mt-0.5">{integration.desc}</p>
              <a href="#" className="text-xs text-turf-600 hover:text-turf-700 hover:underline mt-2 inline-block">
                Learn about AgenticMeadows Cloud &rarr;
              </a>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── API Keys Settings ────────────────────────────────────────────────────

function ApiKeysSettings() {
  const [keys, setKeys] = useState<PlatformApiKey[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyPermissions, setNewKeyPermissions] = useState<string[]>([]);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  const allPermissions = [
    { value: "read:clients", label: "Read Clients" },
    { value: "read:jobs", label: "Read Jobs" },
    { value: "read:quotes", label: "Read Quotes" },
    { value: "write:jobs", label: "Write Jobs" },
    { value: "write:quotes", label: "Write Quotes" },
    { value: "full_access", label: "Full Access" },
  ];

  useEffect(() => {
    loadKeys();
  }, []);

  async function loadKeys() {
    setLoading(true);
    try {
      const data = await api<PlatformApiKey[]>("/api/api-keys");
      setKeys(data);
    } catch {
      // Fallback to localStorage
      const stored = localStorage.getItem("am_platform_api_keys");
      if (stored) {
        try {
          setKeys(JSON.parse(stored));
        } catch {}
      }
    } finally {
      setLoading(false);
    }
  }

  function saveKeysLocal(updatedKeys: PlatformApiKey[]) {
    localStorage.setItem("am_platform_api_keys", JSON.stringify(updatedKeys));
    setKeys(updatedKeys);
  }

  function generateKeyString(): string {
    const uuid = crypto.randomUUID().replace(/-/g, "");
    return `am_${uuid}`;
  }

  function maskKey(key: string): string {
    if (key.length <= 12) return key;
    return `${key.slice(0, 5)}****...${key.slice(-4)}`;
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!newKeyName.trim()) return;

    const fullKey = generateKeyString();
    const newApiKey: PlatformApiKey = {
      id: crypto.randomUUID(),
      name: newKeyName.trim(),
      keyPreview: maskKey(fullKey),
      permissions: newKeyPermissions.length > 0 ? newKeyPermissions : ["full_access"],
      createdAt: new Date().toISOString(),
    };

    try {
      await apiPost("/api/api-keys", { ...newApiKey, key: fullKey });
      await loadKeys();
    } catch {
      // Fallback to localStorage
      saveKeysLocal([...keys, newApiKey]);
    }

    setGeneratedKey(fullKey);
    setNewKeyName("");
    setNewKeyPermissions([]);
    setShowForm(false);
  }

  function handleCopyKey() {
    if (generatedKey) {
      navigator.clipboard.writeText(generatedKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function dismissGeneratedKey() {
    setGeneratedKey(null);
    setCopied(false);
  }

  async function handleRevoke(keyId: string) {
    if (!window.confirm("Revoke this API key? Any integrations using it will stop working.")) return;
    try {
      await apiDelete(`/api/api-keys/${keyId}`);
      await loadKeys();
    } catch {
      // Fallback to localStorage
      saveKeysLocal(keys.filter((k) => k.id !== keyId));
    }
  }

  function togglePermission(perm: string) {
    if (perm === "full_access") {
      setNewKeyPermissions(["full_access"]);
      return;
    }
    const filtered = newKeyPermissions.filter((p) => p !== "full_access");
    if (filtered.includes(perm)) {
      setNewKeyPermissions(filtered.filter((p) => p !== perm));
    } else {
      setNewKeyPermissions([...filtered, perm]);
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-1">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Platform API Keys</h2>
            <p className="text-sm text-gray-500 mt-1">
              Generate API keys to connect AgenticMeadows with external automation tools like n8n, Zapier, Make, or custom integrations.
            </p>
          </div>
          <button onClick={() => { setShowForm(!showForm); setGeneratedKey(null); }} className="btn-primary text-sm">
            {showForm ? "Cancel" : "+ Generate New Key"}
          </button>
        </div>

        {/* Generated key banner */}
        {generatedKey && (
          <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm font-semibold text-yellow-800 mb-2">
              Copy this key now — you won't be able to see it again.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-white border border-yellow-300 rounded px-3 py-2 text-sm font-mono text-gray-800 break-all">
                {generatedKey}
              </code>
              <button onClick={handleCopyKey} className="btn-secondary text-sm flex-shrink-0">
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            <button
              onClick={dismissGeneratedKey}
              className="mt-2 text-xs text-yellow-700 hover:underline"
            >
              I've copied it, dismiss this
            </button>
          </div>
        )}

        {/* Generate new key form */}
        {showForm && (
          <form onSubmit={handleGenerate} className="mt-4 bg-gray-50 rounded-lg p-4 space-y-3">
            <div>
              <label className="label">Key Name *</label>
              <input
                className="input"
                required
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="e.g., n8n Production, Zapier Webhooks"
              />
            </div>
            <div>
              <label className="label">Permissions</label>
              <div className="grid grid-cols-3 gap-2 mt-1">
                {allPermissions.map((perm) => (
                  <label
                    key={perm.value}
                    className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={newKeyPermissions.includes(perm.value)}
                      onChange={() => togglePermission(perm.value)}
                      className="rounded border-gray-300 text-turf-600 focus:ring-turf-500"
                    />
                    {perm.label}
                  </label>
                ))}
              </div>
            </div>
            <button type="submit" className="btn-primary text-sm">
              Generate Key
            </button>
          </form>
        )}

        {/* Keys table */}
        <div className="mt-4">
          {loading ? (
            <p className="text-sm text-gray-400 py-4">Loading...</p>
          ) : keys.length === 0 ? (
            <div className="py-8 text-center text-gray-400 text-sm">
              No API keys yet. Generate one to get started with integrations.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 uppercase tracking-wider border-b">
                  <th className="pb-2 font-medium">Name</th>
                  <th className="pb-2 font-medium">Key</th>
                  <th className="pb-2 font-medium">Created</th>
                  <th className="pb-2 font-medium">Last Used</th>
                  <th className="pb-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {keys.map((k) => (
                  <tr key={k.id} className="border-b border-gray-100 last:border-0">
                    <td className="py-3 font-medium text-gray-900">{k.name}</td>
                    <td className="py-3">
                      <code className="text-xs font-mono text-gray-500 bg-gray-50 px-2 py-0.5 rounded">
                        {k.keyPreview}
                      </code>
                    </td>
                    <td className="py-3 text-gray-500">
                      {new Date(k.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 text-gray-500">
                      {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString() : "Never"}
                    </td>
                    <td className="py-3">
                      <button
                        onClick={() => handleRevoke(k.id)}
                        className="text-xs text-red-600 hover:text-red-700 font-medium"
                      >
                        Revoke
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* API Documentation */}
      <div className="card p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">API Documentation</h3>
        <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm font-mono">
          <div>
            <span className="text-gray-500">API Base URL:</span>{" "}
            <span className="text-gray-800">http://localhost:3001/api</span>
          </div>
          <div>
            <span className="text-gray-500">Authentication:</span>{" "}
            <span className="text-gray-800">Bearer &lt;your-api-key&gt;</span>
          </div>
          <div className="pt-2 border-t border-gray-200">
            <p className="text-gray-500 mb-1">Endpoints:</p>
            <div className="space-y-1 text-xs">
              <p><span className="text-green-600">GET</span> /api/clients</p>
              <p><span className="text-green-600">GET</span> /api/jobs</p>
              <p><span className="text-blue-600">POST</span> /api/quotes</p>
              <p><span className="text-green-600">GET</span> /api/quotes</p>
              <p><span className="text-green-600">GET</span> /api/invoices</p>
              <p><span className="text-blue-600">POST</span> /api/jobs</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Profile Settings ──────────────────────────────────────────────────────

function ProfileSettings() {
  const { user } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(user?.photoUrl || null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const result = await authApi.updateMe({
        name,
        ...(newPassword ? { currentPassword, newPassword } : {}),
      });
      // Update stored user data
      const storedUser = localStorage.getItem("am_user");
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        parsed.name = result.name;
        if (result.photoUrl !== undefined) parsed.photoUrl = result.photoUrl;
        localStorage.setItem("am_user", JSON.stringify(parsed));
      }
      setSaved(true);
      setCurrentPassword("");
      setNewPassword("");
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      setError(e.message || "Failed to update profile");
    }
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("Photo must be under 5MB");
      return;
    }
    if (!file.type.startsWith("image/")) {
      setError("Only image files are allowed");
      return;
    }
    setUploading(true);
    setError("");
    try {
      const result = await authApi.uploadPhoto(file);
      setPhotoUrl(result.photoUrl || null);
      // Update stored user data
      const storedUser = localStorage.getItem("am_user");
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        parsed.photoUrl = result.photoUrl;
        localStorage.setItem("am_user", JSON.stringify(parsed));
      }
    } catch (e: any) {
      setError(e.message || "Failed to upload photo");
    } finally {
      setUploading(false);
    }
  }

  const initials = (user?.name || "U").split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  return (
    <div className="card p-6 max-w-2xl">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">My Profile</h2>

      {/* Avatar section */}
      <div className="flex items-center gap-4 mb-6 pb-6 border-b">
        <div className="relative group">
          <div className="w-20 h-20 rounded-full overflow-hidden bg-turf-100 flex items-center justify-center text-turf-700 text-xl font-bold border-2 border-gray-200">
            {photoUrl ? (
              <img src={photoUrl} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <span>{initials}</span>
            )}
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
          >
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handlePhotoUpload}
            className="hidden"
          />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-900">{user?.name}</p>
          <p className="text-xs text-gray-500">{user?.email}</p>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="mt-1 text-xs text-turf-600 hover:text-turf-700 font-medium"
          >
            {uploading ? "Uploading..." : "Change Photo"}
          </button>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="label">Full Name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="label">Email</label>
          <input className="input bg-gray-50 cursor-not-allowed" type="email" value={email} disabled />
          <p className="text-xs text-gray-400 mt-1">Email cannot be changed</p>
        </div>

        <div className="pt-3 border-t">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Change Password</h3>
          <div className="space-y-3">
            <div>
              <label className="label">Current Password</label>
              <input className="input" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
            </div>
            <div>
              <label className="label">New Password</label>
              <input className="input" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={6} />
            </div>
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="pt-2">
          <button type="submit" className="btn-primary">
            {saved ? "Saved!" : "Update Profile"}
          </button>
        </div>
      </form>
    </div>
  );
}

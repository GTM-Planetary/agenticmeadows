// AgenticMeadows — API layer exports
import { api, apiPost, apiPut, apiPatch, apiDelete, aiApi, getAuthToken } from "./client";
import type {
  Client, Property, Job, JobPhoto, Quote, Invoice, ChatResponse,
  ServiceCatalogItem, PropertyMeasurement, ChemicalApplication,
  SeasonalContract, RecurringJobTemplate, AgentAction, Notification,
  WeatherForecast, WeatherAlert, DashboardStats,
  AuditEvent, AuditSession, AuditSessionDetail,
} from "../types";

// ── Auth ──────────────────────────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) =>
    apiPost<{ token: string; user: { id: string; name: string; email: string; role: string; photoUrl?: string | null } }>(
      "/api/auth/login", { email, password }
    ),
  register: (name: string, email: string, password: string, role?: string) =>
    apiPost<{ token: string; user: { id: string; name: string; email: string; role: string } }>(
      "/api/auth/register", { name, email, password, role }
    ),
  me: () => api<{ id: string; name: string; email: string; role: string; photoUrl?: string | null }>("/api/auth/me"),
  hasUsers: () => api<{ hasUsers: boolean }>("/api/auth/has-users"),
  createInvite: (role: "TECHNICIAN" | "VIEWER") =>
    apiPost<{ token: string; url: string; role: string }>("/api/auth/invite", { role }),
  validateInvite: (token: string) =>
    api<{ valid: boolean; role?: string }>(`/api/auth/invite/${token}`),
  registerWithInvite: (data: { token: string; name: string; email: string; password: string }) =>
    apiPost<{ token: string; user: { id: string; name: string; email: string; role: string } }>(
      "/api/auth/register-invite", data
    ),
  updateMe: (data: { name?: string; currentPassword?: string; newPassword?: string }) =>
    apiPut<{ id: string; name: string; email: string; role: string; photoUrl?: string | null }>("/api/auth/me", data),
  uploadPhoto: (file: File) => {
    const form = new FormData();
    form.append("photo", file);
    return api<{ id: string; name: string; email: string; role: string; photoUrl?: string | null }>(
      "/api/auth/me/photo", { method: "PUT", body: form }
    );
  },
  listUsers: () =>
    api<{ id: string; name: string; email: string; role: string; isActive: boolean; photoUrl?: string | null; createdAt: string }[]>("/api/auth/users"),
  deactivateUser: (id: string) =>
    apiPut<{ id: string; name: string; email: string; role: string; isActive: boolean }>(`/api/auth/users/${id}/deactivate`, {}),
  reactivateUser: (id: string) =>
    apiPut<{ id: string; name: string; email: string; role: string; isActive: boolean }>(`/api/auth/users/${id}/reactivate`, {}),
};

// ── Organization ─────────────────────────────────────────────────────────
export const orgApi = {
  get: () => api<{
    companyName: string; companyLogo: string | null; address: string | null;
    city: string | null; state: string | null; zip: string | null;
    phone: string | null; email: string | null; website: string | null;
  }>("/api/org"),
  update: (data: Record<string, unknown>) => apiPut<Record<string, unknown>>("/api/org", data),
};

// ── Clients ───────────────────────────────────────────────────────────────
export const clientsApi = {
  list: (search?: string) =>
    api<Client[]>(`/api/clients${search ? `?search=${encodeURIComponent(search)}` : ""}`),
  get: (id: string) => api<Client>(`/api/clients/${id}`),
  create: (data: Partial<Client> & { properties?: Partial<Property>[] }) =>
    apiPost<Client>("/api/clients", data),
  update: (id: string, data: Partial<Client>) =>
    apiPut<Client>(`/api/clients/${id}`, data),
  delete: (id: string) => apiDelete(`/api/clients/${id}`),
  addProperty: (clientId: string, data: Partial<Property>) =>
    apiPost<Property>(`/api/clients/${clientId}/properties`, data),
};

// ── Jobs ──────────────────────────────────────────────────────────────────
export const jobsApi = {
  list: (params?: { clientId?: string; status?: string }) => {
    const filtered: Record<string, string> = {};
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== "") filtered[k] = v;
      }
    }
    const qs = new URLSearchParams(filtered).toString();
    return api<Job[]>(`/api/jobs${qs ? `?${qs}` : ""}`);
  },
  get: (id: string) => api<Job>(`/api/jobs/${id}`),
  create: (data: Partial<Job>) => apiPost<Job>("/api/jobs", data),
  update: (id: string, data: Partial<Job>) => apiPut<Job>(`/api/jobs/${id}`, data),
  delete: (id: string) => apiDelete(`/api/jobs/${id}`),
  uploadPhoto: (jobId: string, file: File, caption?: string, photoType?: string) => {
    const form = new FormData();
    form.append("photo", file);
    if (caption) form.append("caption", caption);
    if (photoType) form.append("photoType", photoType);
    return api<JobPhoto>(`/api/jobs/${jobId}/photos`, { method: "POST", body: form });
  },
  updatePhoto: (jobId: string, photoId: string, data: Partial<JobPhoto>) =>
    apiPatch<JobPhoto>(`/api/jobs/${jobId}/photos/${photoId}`, data),
};

// ── Quotes ────────────────────────────────────────────────────────────────
export const quotesApi = {
  list: (params?: { clientId?: string; status?: string }) => {
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    return api<Quote[]>(`/api/quotes${qs ? `?${qs}` : ""}`);
  },
  get: (id: string) => api<Quote>(`/api/quotes/${id}`),
  create: (data: Partial<Quote> & { lineItems?: { description: string; quantity: number; unitPrice: number }[] }) =>
    apiPost<Quote>("/api/quotes", data),
  update: (id: string, data: Partial<Quote> & { lineItems?: { description: string; quantity: number; unitPrice: number }[] }) =>
    apiPut<Quote>(`/api/quotes/${id}`, data),
  delete: (id: string) => apiDelete(`/api/quotes/${id}`),
  convert: (id: string) => apiPost<Invoice>(`/api/quotes/${id}/convert`, {}),
  addLineItem: (quoteId: string, item: { description: string; quantity: number; unitPrice: number }) =>
    apiPost<Quote>(`/api/quotes/${quoteId}/line-items`, item),
  removeLineItem: (quoteId: string, itemId: string) =>
    apiDelete(`/api/quotes/${quoteId}/line-items/${itemId}`),
};

// ── Invoices ──────────────────────────────────────────────────────────────
export const invoicesApi = {
  list: (params?: { clientId?: string; status?: string }) => {
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    return api<Invoice[]>(`/api/invoices${qs ? `?${qs}` : ""}`);
  },
  get: (id: string) => api<Invoice>(`/api/invoices/${id}`),
  create: (data: Partial<Invoice>) => apiPost<Invoice>("/api/invoices", data),
  update: (id: string, data: Partial<Invoice>) =>
    apiPut<Invoice>(`/api/invoices/${id}`, data),
  delete: (id: string) => apiDelete(`/api/invoices/${id}`),
  markPaid: (id: string) => apiPost<Invoice>(`/api/invoices/${id}/paid`, {}),
  addLineItem: (invoiceId: string, item: { description: string; quantity: number; unitPrice: number }) =>
    apiPost<Invoice>(`/api/invoices/${invoiceId}/line-items`, item),
  removeLineItem: (invoiceId: string, itemId: string) =>
    apiDelete(`/api/invoices/${invoiceId}/line-items/${itemId}`),
};

// ── Schedule ──────────────────────────────────────────────────────────────
export const scheduleApi = {
  get: (start: Date, end: Date) =>
    api<Job[]>(
      `/api/schedule?start=${start.toISOString()}&end=${end.toISOString()}`
    ),
};

// ── Service Catalog ──────────────────────────────────────────────────────
export const servicesApi = {
  list: (params?: { category?: string; active?: string }) => {
    const qs = params ? new URLSearchParams(params).toString() : "";
    return api<ServiceCatalogItem[]>(`/api/services${qs ? `?${qs}` : ""}`);
  },
  get: (id: string) => api<ServiceCatalogItem>(`/api/services/${id}`),
  create: (data: Partial<ServiceCatalogItem>) =>
    apiPost<ServiceCatalogItem>("/api/services", data),
  update: (id: string, data: Partial<ServiceCatalogItem>) =>
    apiPut<ServiceCatalogItem>(`/api/services/${id}`, data),
  delete: (id: string) => apiDelete(`/api/services/${id}`),
};

// ── Property Measurements ────────────────────────────────────────────────
export const measurementsApi = {
  list: (propertyId: string) =>
    api<PropertyMeasurement[]>(`/api/properties/${propertyId}/measurements`),
  latest: (propertyId: string) =>
    api<PropertyMeasurement>(`/api/properties/${propertyId}/measurements/latest`),
  create: (propertyId: string, data: Partial<PropertyMeasurement>) =>
    apiPost<PropertyMeasurement>(`/api/properties/${propertyId}/measurements`, data),
  update: (id: string, data: Partial<PropertyMeasurement>) =>
    apiPut<PropertyMeasurement>(`/api/measurements/${id}`, data),
  delete: (id: string) => apiDelete(`/api/measurements/${id}`),
};

// ── Properties ──────────────────────────────────────────────────────
export const propertiesApi = {
  search: (q: string) =>
    api<Property[]>(`/api/properties/search?q=${encodeURIComponent(q)}`),
};

// ── Chemical Applications ────────────────────────────────────────────────
export const chemicalsApi = {
  list: (params?: { propertyId?: string; startDate?: string; endDate?: string }) => {
    const qs = params ? new URLSearchParams(params as Record<string, string>).toString() : "";
    return api<ChemicalApplication[]>(`/api/chemicals${qs ? `?${qs}` : ""}`);
  },
  get: (id: string) => api<ChemicalApplication>(`/api/chemicals/${id}`),
  create: (data: Partial<ChemicalApplication>) =>
    apiPost<ChemicalApplication>("/api/chemicals", data),
  update: (id: string, data: Partial<ChemicalApplication>) =>
    apiPut<ChemicalApplication>(`/api/chemicals/${id}`, data),
  delete: (id: string) => apiDelete(`/api/chemicals/${id}`),
  byProperty: (propertyId: string) =>
    api<ChemicalApplication[]>(`/api/properties/${propertyId}/chemicals`),
};

// ── Seasonal Contracts ───────────────────────────────────────────────────
export const contractsApi = {
  list: (params?: { clientId?: string; active?: string }) => {
    const qs = params ? new URLSearchParams(params).toString() : "";
    return api<SeasonalContract[]>(`/api/contracts${qs ? `?${qs}` : ""}`);
  },
  get: (id: string) => api<SeasonalContract>(`/api/contracts/${id}`),
  create: (data: Partial<SeasonalContract> & { templates?: Partial<RecurringJobTemplate>[] }) =>
    apiPost<SeasonalContract>("/api/contracts", data),
  update: (id: string, data: Partial<SeasonalContract>) =>
    apiPut<SeasonalContract>(`/api/contracts/${id}`, data),
  delete: (id: string) => apiDelete(`/api/contracts/${id}`),
};

// ── Recurring Job Templates ──────────────────────────────────────────────
export const recurringApi = {
  list: (params?: { clientId?: string; contractId?: string; active?: string }) => {
    const qs = params ? new URLSearchParams(params as Record<string, string>).toString() : "";
    return api<RecurringJobTemplate[]>(`/api/recurring${qs ? `?${qs}` : ""}`);
  },
  get: (id: string) => api<RecurringJobTemplate>(`/api/recurring/${id}`),
  create: (data: Partial<RecurringJobTemplate>) =>
    apiPost<RecurringJobTemplate>("/api/recurring", data),
  update: (id: string, data: Partial<RecurringJobTemplate>) =>
    apiPut<RecurringJobTemplate>(`/api/recurring/${id}`, data),
  delete: (id: string) => apiDelete(`/api/recurring/${id}`),
  generate: (id: string, params?: { count?: number; startDate?: string }) =>
    apiPost<Job[]>(`/api/recurring/${id}/generate`, params ?? {}),
  generateBatch: (params?: { season?: string }) =>
    apiPost<{ generated: number; templates: number; jobs: Job[] }>("/api/recurring/generate-batch", params ?? {}),
};

// ── Agent Actions ────────────────────────────────────────────────────────
export const agentApi = {
  listActions: (params?: { status?: string; type?: string; limit?: string; offset?: string }) => {
    const qs = params ? new URLSearchParams(params).toString() : "";
    return api<AgentAction[]>(`/api/agent/actions${qs ? `?${qs}` : ""}`);
  },
  getAction: (id: string) => api<AgentAction>(`/api/agent/actions/${id}`),
  approveAction: (id: string) =>
    apiPost<AgentAction>(`/api/agent/actions/${id}/approve`, {}),
  rejectAction: (id: string) =>
    apiPost<AgentAction>(`/api/agent/actions/${id}/reject`, {}),
  pendingCount: () =>
    api<{ count: number }>("/api/agent/actions/pending-count"),
};

// ── Notifications ────────────────────────────────────────────────────────
export const notificationsApi = {
  list: (params?: { unreadOnly?: string; limit?: string }) => {
    const qs = params ? new URLSearchParams(params).toString() : "";
    return api<Notification[]>(`/api/notifications${qs ? `?${qs}` : ""}`);
  },
  markRead: (id: string) =>
    apiPatch<Notification>(`/api/notifications/${id}/read`, {}),
  markAllRead: () =>
    apiPost<void>("/api/notifications/mark-all-read", {}),
  unreadCount: () =>
    api<{ count: number }>("/api/notifications/unread-count"),
  delete: (id: string) => apiDelete(`/api/notifications/${id}`),
};

// ── Weather ──────────────────────────────────────────────────────────────
export const weatherApi = {
  get: (zip: string, days?: number) =>
    api<WeatherForecast>(`/api/weather?zip=${zip}&days=${days ?? 7}`),
  scheduleCheck: (start: string, end: string) =>
    api<{ alerts: WeatherAlert[] }>(`/api/weather/schedule-check?start=${start}&end=${end}`),
};

// ── Dashboard ────────────────────────────────────────────────────────────
export const dashboardApi = {
  stats: () => api<DashboardStats>("/api/dashboard/stats"),
};

// ── Audit / AI Activity ──────────────────────────────────────────────────
export const auditApi = {
  list: (params?: { eventType?: string; entityType?: string; sessionId?: string; startDate?: string; endDate?: string; limit?: string; offset?: string }) => {
    const qs = params ? new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== "")) as Record<string, string>
    ).toString() : "";
    return api<AuditEvent[]>(`/api/audit${qs ? `?${qs}` : ""}`);
  },
  sessions: () => api<AuditSession[]>("/api/audit/sessions"),
  sessionDetail: (id: string) => api<AuditSessionDetail>(`/api/audit/sessions/${id}`),
};

// ── Reports ──────────────────────────────────────────────────────────────
export const reportsApi = {
  revenue: (params?: { startDate?: string; endDate?: string; groupBy?: string }) => {
    const qs = params ? new URLSearchParams(params as Record<string, string>).toString() : "";
    return api<any>(`/api/reports/revenue${qs ? `?${qs}` : ""}`);
  },
  jobs: (params?: Record<string, string>) => {
    const qs = params ? new URLSearchParams(params).toString() : "";
    return api<any>(`/api/reports/jobs${qs ? `?${qs}` : ""}`);
  },
  clients: (params?: Record<string, string>) => {
    const qs = params ? new URLSearchParams(params).toString() : "";
    return api<any>(`/api/reports/clients${qs ? `?${qs}` : ""}`);
  },
  salesPipeline: (params?: Record<string, string>) => {
    const qs = params ? new URLSearchParams(params).toString() : "";
    return api<any>(`/api/reports/sales-pipeline${qs ? `?${qs}` : ""}`);
  },
  aging: () => api<any>("/api/reports/aging"),
  chemicalLog: (params?: Record<string, string>) => {
    const qs = params ? new URLSearchParams(params).toString() : "";
    return api<any>(`/api/reports/chemical-log${qs ? `?${qs}` : ""}`);
  },
};

// ── Maintenance ─────────────────────────────────────────────────────────
export const maintenanceApi = {
  listEquipment: (params?: Record<string, string>) => {
    const qs = params ? new URLSearchParams(params).toString() : "";
    return api<any[]>(`/api/maintenance/equipment${qs ? `?${qs}` : ""}`);
  },
  getEquipment: (id: string) => api<any>(`/api/maintenance/equipment/${id}`),
  createEquipment: (data: any) => apiPost<any>("/api/maintenance/equipment", data),
  updateEquipment: (id: string, data: any) => apiPut<any>(`/api/maintenance/equipment/${id}`, data),
  logMaintenance: (equipmentId: string, data: any) => apiPost<any>(`/api/maintenance/equipment/${equipmentId}/log`, data),
  getAlerts: () => api<any>("/api/maintenance/alerts"),
  addSchedule: (equipmentId: string, data: any) => apiPost<any>(`/api/maintenance/equipment/${equipmentId}/schedules`, data),
  updateSchedule: (id: string, data: any) => apiPut<any>(`/api/maintenance/schedules/${id}`, data),
  deleteSchedule: (id: string) => apiDelete(`/api/maintenance/schedules/${id}`),
};

// ── Property Health ─────────────────────────────────────────────────────
export const propertyHealthApi = {
  assess: (propertyId: string, data: any) => apiPost<any>(`/api/property-health/${propertyId}`, data),
  get: (propertyId: string) => api<any>(`/api/property-health/${propertyId}`),
  history: (propertyId: string) => api<any[]>(`/api/property-health/${propertyId}/history`),
  predictions: () => api<any[]>("/api/property-health/predictions"),
};

// ── AI ────────────────────────────────────────────────────────────────────
export const aiChatApi = {
  chat: (params: {
    message: string;
    conversation_id?: string;
    image_url?: string;
    client_id?: string;
    job_id?: string;
  }) =>
    aiApi<ChatResponse>("/ai/chat", {
      method: "POST",
      body: JSON.stringify({ ...params, auth_token: getAuthToken() }),
    }),
  confirm: (conversation_id: string) =>
    aiApi<{ success: boolean; result?: unknown; message?: string }>("/ai/confirm-action", {
      method: "POST",
      body: JSON.stringify({ conversation_id, auth_token: getAuthToken() }),
    }),
  confirmBatch: (conversation_id: string, action_indices?: number[]) =>
    aiApi<{ success: boolean; results: unknown[]; errors: unknown[]; executed: number }>("/ai/confirm-batch", {
      method: "POST",
      body: JSON.stringify({ conversation_id, action_indices, auth_token: getAuthToken() }),
    }),
  cancel: (conversation_id: string) =>
    aiApi<{ success: boolean }>(`/ai/pending-action/${conversation_id}`, {
      method: "DELETE",
    }),
  proactiveCheck: (checkTypes?: string[]) =>
    aiApi<{ actions_created: number; notifications_created: number }>("/ai/proactive-check", {
      method: "POST",
      body: JSON.stringify({ auth_token: getAuthToken(), check_types: checkTypes ?? ["overdue", "weather", "recurring", "followup"] }),
    }),
};

// AgenticMeadows — TypeScript type definitions
// Mirrors the Prisma schema models

export type UserRole = "ADMIN" | "TECHNICIAN" | "VIEWER";
export type JobStatus = "PENDING" | "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
export type PhotoType = "BEFORE" | "AFTER" | "MAPPING_IDEA";
export type QuoteStatus = "DRAFT" | "SENT" | "APPROVED" | "REJECTED" | "INVOICED";
export type InvoiceStatus = "DRAFT" | "SENT" | "PAID" | "OVERDUE" | "VOID";

// ── Phase 1 Enums ────────────────────────────
export type ServiceCategory = "MOWING" | "TRIMMING" | "FERTILIZATION" | "WEED_CONTROL" | "AERATION" | "SEEDING" | "MULCHING" | "PRUNING" | "IRRIGATION" | "CLEANUP" | "HARDSCAPE" | "PLANTING" | "SNOW_REMOVAL" | "OTHER";
export type PricingUnit = "FLAT" | "PER_SQFT" | "PER_LINEAR_FT" | "PER_HOUR" | "PER_APPLICATION" | "PER_YARD";
export type Season = "SPRING" | "SUMMER" | "FALL" | "WINTER" | "ALL_YEAR";
export type RecurrenceFrequency = "WEEKLY" | "BIWEEKLY" | "MONTHLY" | "QUARTERLY" | "SEASONAL" | "ANNUAL";
export type AgentActionStatus = "PROPOSED" | "CONFIRMED" | "REJECTED" | "AUTO_EXECUTED" | "EXPIRED";
export type AgentActionType = "CREATE_JOB" | "RESCHEDULE_JOB" | "CREATE_QUOTE" | "CREATE_INVOICE" | "SEND_REMINDER" | "WEATHER_ALERT" | "SEASONAL_BATCH" | "SUGGEST_SERVICE" | "FLAG_OVERDUE" | "LOG_CHEMICAL";
export type NotificationType = "AGENT_ACTION" | "OVERDUE_INVOICE" | "WEATHER_ALERT" | "JOB_REMINDER" | "SEASONAL_TRIGGER" | "SYSTEM";

// ─────────────────────────────────────────────
// Core Interfaces
// ─────────────────────────────────────────────

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

export interface Property {
  id: string;
  clientId: string;
  streetAddress: string;
  city: string;
  state: string;
  zip: string;
  notes?: string;
  measurements?: PropertyMeasurement[];
  chemicalApplications?: ChemicalApplication[];
}

export interface Client {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  company?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  properties: Property[];
}

export interface ChecklistItem {
  text: string;
  done: boolean;
}

export interface JobPhoto {
  id: string;
  jobId: string;
  url: string;
  caption?: string;
  photoType: PhotoType;
  aiAnalysis?: {
    analysis: string;
    suggested_services: string[];
    estimated_price?: number;
    model_used?: string;
    error?: boolean;
  };
  createdAt: string;
}

export interface LineItem {
  id?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  jobId?: string;
  quoteId?: string;
  invoiceId?: string;
  serviceId?: string;
}

export interface Job {
  id: string;
  clientId: string;
  propertyId?: string;
  assignedUserId?: string;
  recurringTemplateId?: string;
  title: string;
  description?: string;
  status: JobStatus;
  scheduledStart?: string;
  scheduledEnd?: string;
  isRecurring: boolean;
  checklistItems?: ChecklistItem[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
  client?: Pick<Client, "id" | "firstName" | "lastName">;
  property?: Pick<Property, "id" | "streetAddress" | "city">;
  assignedUser?: Pick<User, "id" | "name">;
  photos?: JobPhoto[];
  lineItems?: LineItem[];
}

export interface Quote {
  id: string;
  clientId: string;
  propertyId?: string;
  title: string;
  status: QuoteStatus;
  validUntil?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  client?: Pick<Client, "id" | "firstName" | "lastName">;
  property?: Property;
  lineItems: LineItem[];
}

export interface Invoice {
  id: string;
  clientId: string;
  jobId?: string;
  quoteId?: string;
  propertyId?: string;
  status: InvoiceStatus;
  dueDate?: string;
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
  client?: Pick<Client, "id" | "firstName" | "lastName">;
  job?: Pick<Job, "id" | "title">;
  quote?: Pick<Quote, "id" | "title">;
  lineItems: LineItem[];
}

// ─────────────────────────────────────────────
// Phase 1 Interfaces
// ─────────────────────────────────────────────

export interface ServiceCatalogItem {
  id: string;
  name: string;
  description?: string;
  category: ServiceCategory;
  pricingUnit: PricingUnit;
  basePrice: number;
  seasonalPrices?: Record<Season, number>;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface PropertyMeasurement {
  id: string;
  propertyId: string;
  lotSizeSqft?: number;
  lawnSqft?: number;
  bedSqft?: number;
  edgingLinearFt?: number;
  hardscapeSqft?: number;
  notes?: string;
  measuredAt: string;
  measuredBy?: string;
}

export interface ChemicalApplication {
  id: string;
  propertyId: string;
  jobId?: string;
  appliedBy?: string;
  productName: string;
  epaRegNumber?: string;
  applicationRate?: string;
  areaTreatedSqft?: number;
  targetPest?: string;
  windSpeedMph?: number;
  temperatureF?: number;
  humidity?: number;
  weatherNotes?: string;
  reentryHours: number;
  reentryExpires?: string;
  notes?: string;
  appliedAt: string;
  createdAt: string;
  property?: Pick<Property, "id" | "streetAddress" | "city">;
  job?: Pick<Job, "id" | "title">;
}

export interface SeasonalContract {
  id: string;
  clientId: string;
  propertyId?: string;
  title: string;
  startDate: string;
  endDate: string;
  totalValue?: number;
  notes?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  client?: Pick<Client, "id" | "firstName" | "lastName">;
  property?: Pick<Property, "id" | "streetAddress" | "city">;
  templates?: RecurringJobTemplate[];
}

export interface RecurringJobTemplate {
  id: string;
  clientId: string;
  propertyId?: string;
  serviceId?: string;
  contractId?: string;
  title: string;
  description?: string;
  frequency: RecurrenceFrequency;
  season: Season;
  preferredDayOfWeek?: number;
  preferredTimeSlot?: string;
  lastGeneratedAt?: string;
  nextGenerateAfter?: string;
  isActive: boolean;
  assignedUserId?: string;
  checklistTemplate?: ChecklistItem[];
  createdAt: string;
  updatedAt: string;
  client?: Pick<Client, "id" | "firstName" | "lastName">;
  property?: Pick<Property, "id" | "streetAddress" | "city">;
  service?: Pick<ServiceCatalogItem, "id" | "name" | "category">;
}

export interface AgentAction {
  id: string;
  type: AgentActionType;
  status: AgentActionStatus;
  userId?: string;
  summary: string;
  details?: Record<string, unknown>;
  resultType?: string;
  resultId?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  expiresAt?: string;
  createdAt: string;
  user?: Pick<User, "id" | "name">;
}

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  actionUrl?: string;
  isRead: boolean;
  agentActionId?: string;
  createdAt: string;
}

export interface WeatherDay {
  date: string;
  tempHighF: number;
  tempLowF: number;
  precipMm: number;
  windMph: number;
  weatherCode: number;
  description: string;
}

export interface WeatherForecast {
  zipCode: string;
  days: WeatherDay[];
  fetchedAt: string;
}

export interface WeatherAlert {
  jobId: string;
  jobTitle: string;
  date: string;
  issue: string;
  severity: "low" | "medium" | "high";
}

export interface DashboardStats {
  revenue: {
    thisMonth: number;
    lastMonth: number;
    outstanding: number;
    pending?: number;
  };
  jobs: {
    pending: number;
    scheduled: number;
    inProgress: number;
    completedThisMonth: number;
    scheduledToday?: number;
  };
  invoices: {
    overdue: Array<Pick<Invoice, "id" | "clientId" | "dueDate" | "status"> & { client?: Pick<Client, "firstName" | "lastName">; total: number }>;
    overdueTotal: number;
  };
  upcoming: Job[];
  agentPending: number;
  notificationsUnread: number;
}

// ── Audit / AI Activity types ─────────────────────────────────────────────

export type AuditEventType = "ENTITY_VIEW" | "ACTION_PROPOSED" | "ACTION_CONFIRMED" | "ACTION_REJECTED" | "BATCH_PROPOSED" | "SESSION_START";

export interface AuditEvent {
  id: string;
  sessionId: string;
  eventType: AuditEventType;
  summary: string;
  entityType?: string;
  entityId?: string;
  action?: string;
  inferenceMode?: string;
  model?: string;
  latencyMs?: number;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface AuditSession {
  id: string;
  startedAt: string;
  endedAt?: string;
  eventCount: number;
  durationMs?: number;
}

export interface AuditSessionDetail extends AuditSession {
  events: AuditEvent[];
}

// ── AI types ──────────────────────────────────────────────────────────────

export interface PendingAction {
  type: "CREATE_CLIENT" | "CREATE_QUOTE" | "CREATE_JOB" | "RESCHEDULE_JOB" | "CREATE_INVOICE" | "LOG_CHEMICAL" | "CREATE_RECURRING" | "SEND_REMINDER" | "SUGGEST_SERVICE" | "UPDATE_CLIENT" | "UPDATE_JOB" | "UPDATE_QUOTE" | "ADD_LINE_ITEM" | "REMOVE_LINE_ITEM" | "MARK_JOB_COMPLETE";
  payload: Record<string, unknown>;
  description: string;
  display_items?: LineItem[];
  total?: number;
}

export type EntityCardType = "client" | "job" | "quote" | "invoice" | "property" | "service";

export interface EntityAction {
  label: string;
  action: string;
  params?: Record<string, any>;
  requiresConfirmation?: boolean;
}

export interface EntityCard {
  type: EntityCardType;
  id: string;
  data: Record<string, any>;
  editable: boolean;
  editableFields?: string[];
  actions?: EntityAction[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  pendingAction?: PendingAction;
  entities?: EntityCard[];
  batchActions?: PendingAction[];
}

export interface ChatResponse {
  reply: string;
  conversation_id: string;
  pending_action?: PendingAction;
  entities?: EntityCard[];
  batch_actions?: PendingAction[];
}

// ── Auth types ────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  photoUrl?: string | null;
}

export interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
}

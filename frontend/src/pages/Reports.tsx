import { useState, useCallback } from "react";
import { reportsApi } from "../api";

// ── Types ────────────────────────────────────────────────────────────────

type ReportType = "revenue" | "jobs" | "clients" | "pipeline" | "aging" | "chemical";

interface ReportTab {
  key: ReportType;
  label: string;
  icon: string;
}

const REPORT_TABS: ReportTab[] = [
  { key: "revenue", label: "Revenue", icon: "💰" },
  { key: "jobs", label: "Jobs", icon: "🔧" },
  { key: "clients", label: "Clients", icon: "👤" },
  { key: "pipeline", label: "Sales Pipeline", icon: "📈" },
  { key: "aging", label: "Aging", icon: "⏰" },
  { key: "chemical", label: "Chemical Log", icon: "🧪" },
];

const GROUP_BY_OPTIONS: Record<string, { value: string; label: string }[]> = {
  revenue: [
    { value: "month", label: "Month" },
    { value: "week", label: "Week" },
    { value: "client", label: "Client" },
    { value: "serviceType", label: "Service Type" },
  ],
  jobs: [
    { value: "month", label: "Month" },
    { value: "week", label: "Week" },
    { value: "status", label: "Status" },
    { value: "assignee", label: "Assignee" },
  ],
  clients: [
    { value: "revenue", label: "Sort by Revenue" },
    { value: "jobs", label: "Sort by Jobs" },
    { value: "recent", label: "Sort by Recent" },
  ],
};

// ── Formatting helpers ───────────────────────────────────────────────────

const fmtCurrency = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);

const fmtDate = (date: string) => new Date(date).toLocaleDateString();

const fmtPercent = (value: number) => `${(value * 100).toFixed(1)}%`;

// ── Summary card config per report type ──────────────────────────────────

interface SummaryCard {
  label: string;
  key: string;
  format: "currency" | "number" | "percent" | "duration";
}

const SUMMARY_CARDS: Record<ReportType, SummaryCard[]> = {
  revenue: [
    { label: "Total Revenue", key: "totalRevenue", format: "currency" },
    { label: "Total Invoices", key: "totalInvoices", format: "number" },
    { label: "Avg Deal Size", key: "avgDealSize", format: "currency" },
  ],
  jobs: [
    { label: "Total Jobs", key: "totalJobs", format: "number" },
    { label: "Completed", key: "completed", format: "number" },
    { label: "Avg Duration", key: "avgDuration", format: "duration" },
    { label: "On-Time %", key: "onTimePercent", format: "percent" },
  ],
  clients: [
    { label: "Total Clients", key: "totalClients", format: "number" },
    { label: "New This Period", key: "newClients", format: "number" },
    { label: "Avg Revenue/Client", key: "avgRevenuePerClient", format: "currency" },
  ],
  pipeline: [
    { label: "Total Pipeline Value", key: "totalPipelineValue", format: "currency" },
    { label: "Conversion Rate", key: "conversionRate", format: "percent" },
    { label: "Avg Deal Size", key: "avgDealSize", format: "currency" },
  ],
  aging: [
    { label: "Current", key: "current", format: "currency" },
    { label: "30-Day Overdue", key: "overdue30", format: "currency" },
    { label: "60-Day Overdue", key: "overdue60", format: "currency" },
    { label: "90-Day Overdue", key: "overdue90", format: "currency" },
  ],
  chemical: [
    { label: "Total Applications", key: "totalApplications", format: "number" },
    { label: "Properties Treated", key: "propertiesTreated", format: "number" },
    { label: "Total Volume", key: "totalVolume", format: "number" },
  ],
};

// ── Table column config per report type ──────────────────────────────────

interface TableColumn {
  key: string;
  label: string;
  format?: "currency" | "date" | "percent" | "number";
  align?: "left" | "right" | "center";
}

const TABLE_COLUMNS: Record<ReportType, TableColumn[]> = {
  revenue: [
    { key: "period", label: "Period" },
    { key: "clientName", label: "Client" },
    { key: "serviceType", label: "Service Type" },
    { key: "invoiceCount", label: "Invoices", align: "right" },
    { key: "revenue", label: "Revenue", format: "currency", align: "right" },
  ],
  jobs: [
    { key: "period", label: "Period" },
    { key: "assignee", label: "Assignee" },
    { key: "status", label: "Status" },
    { key: "jobCount", label: "Jobs", align: "right" },
    { key: "completed", label: "Completed", align: "right" },
    { key: "avgDurationHrs", label: "Avg Hrs", align: "right" },
  ],
  clients: [
    { key: "clientName", label: "Client" },
    { key: "email", label: "Email" },
    { key: "totalJobs", label: "Total Jobs", align: "right" },
    { key: "totalRevenue", label: "Revenue", format: "currency", align: "right" },
    { key: "lastJobDate", label: "Last Job", format: "date" },
  ],
  pipeline: [
    { key: "stage", label: "Stage" },
    { key: "count", label: "Count", align: "right" },
    { key: "value", label: "Value", format: "currency", align: "right" },
    { key: "conversionRate", label: "Conversion", format: "percent", align: "right" },
    { key: "avgDaysInStage", label: "Avg Days", align: "right" },
  ],
  aging: [
    { key: "invoiceNumber", label: "Invoice #" },
    { key: "clientName", label: "Client" },
    { key: "issueDate", label: "Issue Date", format: "date" },
    { key: "dueDate", label: "Due Date", format: "date" },
    { key: "daysOverdue", label: "Days Overdue", align: "right" },
    { key: "amount", label: "Amount", format: "currency", align: "right" },
    { key: "agingBucket", label: "Bucket" },
  ],
  chemical: [
    { key: "applicationDate", label: "Date", format: "date" },
    { key: "propertyAddress", label: "Property" },
    { key: "clientName", label: "Client" },
    { key: "productName", label: "Product" },
    { key: "applicationRate", label: "Rate" },
    { key: "applicator", label: "Applicator" },
    { key: "licenseNumber", label: "License #" },
  ],
};

// ── CSV export ───────────────────────────────────────────────────────────

function downloadCSV(data: Record<string, unknown>[], filename: string) {
  if (data.length === 0) return;
  const headers = Object.keys(data[0]);
  const csvRows = [
    headers.join(","),
    ...data.map((row) =>
      headers
        .map((h) => {
          const val = row[h];
          const str = val == null ? "" : String(val);
          // Escape quotes and wrap fields that contain commas or quotes
          if (str.includes(",") || str.includes('"') || str.includes("\n")) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        })
        .join(",")
    ),
  ];
  const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── PDF export ───────────────────────────────────────────────────────────

function downloadPDF(
  data: Record<string, unknown>[],
  title: string,
  columns: TableColumn[],
  dateRange: { start: string; end: string }
) {
  if (data.length === 0) return;
  const companyName = localStorage.getItem("am_company_name") || "AgenticMeadows";

  const headerRow = columns.map((c) => `<th style="padding:8px 12px;text-align:${c.align || "left"};border-bottom:2px solid #333;font-size:13px;">${c.label}</th>`).join("");

  const bodyRows = data
    .map(
      (row) =>
        `<tr>${columns
          .map((c) => {
            let val = row[c.key];
            if (c.format === "currency" && typeof val === "number") val = fmtCurrency(val);
            else if (c.format === "date" && val) val = fmtDate(String(val));
            else if (c.format === "percent" && typeof val === "number") val = fmtPercent(val);
            return `<td style="padding:6px 12px;text-align:${c.align || "left"};border-bottom:1px solid #e5e7eb;font-size:12px;">${val ?? ""}</td>`;
          })
          .join("")}</tr>`
    )
    .join("");

  const html = `<!DOCTYPE html>
<html>
<head>
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 40px; color: #1a1a1a; }
    h1 { font-size: 20px; margin: 0 0 4px 0; }
    .meta { color: #666; font-size: 13px; margin-bottom: 24px; }
    table { width: 100%; border-collapse: collapse; }
    @media print { body { padding: 20px; } }
  </style>
</head>
<body>
  <h1>${companyName}</h1>
  <div class="meta">${title} &mdash; ${fmtDate(dateRange.start)} to ${fmtDate(dateRange.end)}</div>
  <table>
    <thead><tr>${headerRow}</tr></thead>
    <tbody>${bodyRows}</tbody>
  </table>
</body>
</html>`;

  const w = window.open("", "_blank");
  if (w) {
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 400);
  }
}

// ── Default date range: last 3 months ────────────────────────────────────

function defaultDateRange() {
  const end = new Date();
  const start = new Date();
  start.setMonth(start.getMonth() - 3);
  return {
    start: start.toISOString().split("T")[0],
    end: end.toISOString().split("T")[0],
  };
}

// ── Summary Card Component ───────────────────────────────────────────────

const CARD_BORDERS = ["border-t-turf-500", "border-t-blue-500", "border-t-amber-500", "border-t-purple-500"];

function SummaryCardRow({
  cards,
  summary,
}: {
  cards: SummaryCard[];
  summary: Record<string, unknown>;
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((card, i) => {
        const raw = summary[card.key];
        let display = "—";
        if (raw != null) {
          if (card.format === "currency") display = fmtCurrency(Number(raw));
          else if (card.format === "percent") display = fmtPercent(Number(raw));
          else if (card.format === "duration") display = `${Number(raw).toFixed(1)} hrs`;
          else display = String(raw);
        }
        return (
          <div
            key={card.key}
            className={`card border-t-4 ${CARD_BORDERS[i % CARD_BORDERS.length]} p-4`}
          >
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              {card.label}
            </p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{display}</p>
          </div>
        );
      })}
    </div>
  );
}

// ── Main Reports Page ────────────────────────────────────────────────────

export default function Reports() {
  const [activeTab, setActiveTab] = useState<ReportType>("revenue");
  const [dateRange, setDateRange] = useState(defaultDateRange);
  const [groupBy, setGroupBy] = useState("month");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reportData, setReportData] = useState<Record<string, unknown>[]>([]);
  const [summary, setSummary] = useState<Record<string, unknown>>({});
  const [hasGenerated, setHasGenerated] = useState(false);

  // Reset groupBy when switching tabs
  function handleTabChange(tab: ReportType) {
    setActiveTab(tab);
    setHasGenerated(false);
    setReportData([]);
    setSummary({});
    setError("");
    const opts = GROUP_BY_OPTIONS[tab];
    if (opts && opts.length > 0) {
      setGroupBy(opts[0].value);
    } else {
      setGroupBy("");
    }
  }

  const generateReport = useCallback(async () => {
    setLoading(true);
    setError("");
    setHasGenerated(true);
    try {
      // Build params, filtering out empty values to avoid "undefined" strings
      const params: Record<string, string> = {};
      if (dateRange.start) params.startDate = dateRange.start;
      if (dateRange.end) params.endDate = dateRange.end;

      if (groupBy && GROUP_BY_OPTIONS[activeTab]) {
        // Clients report uses "sortBy" instead of "groupBy"
        if (activeTab === "clients") {
          params.sortBy = groupBy;
        } else {
          params.groupBy = groupBy;
        }
      }

      let result: any;
      switch (activeTab) {
        case "revenue":
          result = await reportsApi.revenue(params);
          break;
        case "jobs":
          result = await reportsApi.jobs(params);
          break;
        case "clients":
          result = await reportsApi.clients(params);
          break;
        case "pipeline":
          result = await reportsApi.salesPipeline(params);
          break;
        case "aging":
          result = await reportsApi.aging();
          break;
        case "chemical":
          result = await reportsApi.chemicalLog(params);
          break;
      }

      // Backend returns { data: [...], totals: {...} } (or similar shapes per endpoint)
      // Map to our internal state: summary (totals) + reportData (rows)
      if (result && typeof result === "object") {
        // Extract summary from totals or top-level fields
        const summaryData: Record<string, unknown> = {};

        if (result.totals) {
          Object.assign(summaryData, result.totals);
        }
        // Pipeline report has top-level fields instead of nested totals
        if (activeTab === "pipeline") {
          if (result.totalPipeline != null) summaryData.totalPipelineValue = result.totalPipeline;
          if (result.conversionRate != null) summaryData.conversionRate = result.conversionRate / 100; // convert from integer percent to decimal
          if (result.avgDealSize != null) summaryData.avgDealSize = result.avgDealSize;
        }
        // Revenue: compute avg deal size from totals
        if (activeTab === "revenue" && result.totals) {
          const t = result.totals;
          summaryData.avgDealSize = t.totalInvoices > 0
            ? Math.round((t.totalRevenue / t.totalInvoices) * 100) / 100
            : 0;
        }
        // Jobs: map totals to expected keys
        if (activeTab === "jobs" && result.totals) {
          summaryData.completed = result.totals.totalCompleted;
        }
        // Clients: compute derived metrics
        if (activeTab === "clients" && result.totals) {
          summaryData.newClients = result.totals.totalClients; // close enough, backend doesn't distinguish "new"
          summaryData.avgRevenuePerClient = result.totals.totalClients > 0
            ? Math.round((result.totals.totalRevenue / result.totals.totalClients) * 100) / 100
            : 0;
        }
        // Chemical: compute summary from data array
        if (activeTab === "chemical" && result.data) {
          summaryData.totalApplications = result.data.length;
          const propertySet = new Set(result.data.map((d: any) => d.propertyId));
          summaryData.propertiesTreated = propertySet.size;
          summaryData.totalVolume = result.data.reduce((s: number, d: any) => s + (d.areaTreatedSqft || 0), 0);
        }
        // Aging: merge totals from the totals object directly (keys already match)

        setSummary(summaryData);

        // Extract rows from data array
        const rows = Array.isArray(result.data) ? result.data : [];

        // Map row fields to match table column keys
        const mappedRows = rows.map((row: any) => {
          const mapped = { ...row };

          // Revenue report: "label" -> "period" / "clientName" / "serviceType" depending on groupBy
          if (activeTab === "revenue") {
            if (groupBy === "client") mapped.clientName = row.label;
            else if (groupBy === "serviceType" || groupBy === "service") mapped.serviceType = row.label;
            else mapped.period = row.label;
          }

          // Jobs report
          if (activeTab === "jobs") {
            if (groupBy === "assignee") mapped.assignee = row.label;
            else if (groupBy === "status") mapped.status = row.label;
            else mapped.period = row.label;
            mapped.completed = row.completedCount;
            mapped.avgDurationHrs = row.avgDuration;
          }

          // Clients report
          if (activeTab === "clients") {
            mapped.email = row.clientEmail;
            mapped.totalJobs = row.jobCount;
            mapped.totalRevenue = row.revenue;
          }

          // Aging report
          if (activeTab === "aging") {
            mapped.invoiceNumber = row.invoiceId;
            mapped.agingBucket = row.daysOverdue <= 0
              ? "Current"
              : row.daysOverdue <= 30
              ? "1-30 Days"
              : row.daysOverdue <= 60
              ? "31-60 Days"
              : "60+ Days";
          }

          // Chemical report
          if (activeTab === "chemical") {
            mapped.applicationDate = row.date;
            mapped.applicator = row.appliedBy;
            mapped.licenseNumber = row.epaRegNumber ?? "";
          }

          return mapped;
        });

        setReportData(mappedRows);
      } else {
        setReportData([]);
        setSummary({});
      }
    } catch (err: any) {
      setError(err.message || "Failed to generate report");
      setReportData([]);
      setSummary({});
    } finally {
      setLoading(false);
    }
  }, [activeTab, dateRange, groupBy]);

  const columns = TABLE_COLUMNS[activeTab];
  const summaryCards = SUMMARY_CARDS[activeTab];
  const groupOptions = GROUP_BY_OPTIONS[activeTab] || [];
  const reportTitle = REPORT_TABS.find((t) => t.key === activeTab)?.label || "Report";

  // ── Format cell values for display ─────────────────────────────────────

  function formatCell(value: unknown, format?: string): string {
    if (value == null) return "—";
    if (format === "currency") return fmtCurrency(Number(value));
    if (format === "date") return fmtDate(String(value));
    if (format === "percent") return fmtPercent(Number(value));
    return String(value);
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <p className="text-sm text-gray-500 mt-1">
          Generate and export business reports for your landscaping operations
        </p>
      </div>

      {/* Report type tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit flex-wrap">
        {REPORT_TABS.map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => handleTabChange(key)}
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

      {/* Controls bar */}
      <div className="card p-4">
        <div className="flex flex-wrap items-end gap-4">
          {/* Date range */}
          <div>
            <label className="label">Start Date</label>
            <input
              type="date"
              className="input"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
            />
          </div>
          <div>
            <label className="label">End Date</label>
            <input
              type="date"
              className="input"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
            />
          </div>

          {/* Group By / Sort By */}
          {groupOptions.length > 0 && (
            <div>
              <label className="label">
                {activeTab === "clients" ? "Sort By" : "Group By"}
              </label>
              <select
                className="input"
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value)}
              >
                {groupOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 ml-auto">
            <button
              onClick={generateReport}
              disabled={loading}
              className="btn-primary"
            >
              {loading ? "Generating..." : "Generate Report"}
            </button>
            <button
              onClick={() => {
                const filename = `${reportTitle.toLowerCase().replace(/\s+/g, "-")}-${dateRange.start}-to-${dateRange.end}.csv`;
                downloadCSV(reportData, filename);
              }}
              disabled={reportData.length === 0}
              className="btn-secondary flex items-center gap-1.5"
            >
              <span className="text-sm">⬇</span> Export CSV
            </button>
            <button
              onClick={() => downloadPDF(reportData, `${reportTitle} Report`, columns, dateRange)}
              disabled={reportData.length === 0}
              className="btn-secondary flex items-center gap-1.5"
            >
              <span className="text-sm">📄</span> Export PDF
            </button>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Summary cards */}
      {hasGenerated && Object.keys(summary).length > 0 && (
        <SummaryCardRow cards={summaryCards} summary={summary} />
      )}

      {/* Data table */}
      {hasGenerated && (
        <div className="card overflow-hidden">
          {loading ? (
            <div className="py-16 text-center text-gray-400">
              <div className="inline-block w-6 h-6 border-2 border-turf-500 border-t-transparent rounded-full animate-spin mb-3" />
              <p>Generating report...</p>
            </div>
          ) : reportData.length === 0 ? (
            <div className="py-16 text-center text-gray-400">
              <p className="text-lg mb-1">No data for this period</p>
              <p className="text-sm">
                Try adjusting the date range or filters and generate again.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {columns.map((col) => (
                      <th
                        key={col.key}
                        className={`px-5 py-3 font-medium text-gray-600 ${
                          col.align === "right"
                            ? "text-right"
                            : col.align === "center"
                            ? "text-center"
                            : "text-left"
                        }`}
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {reportData.map((row, idx) => (
                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                      {columns.map((col) => (
                        <td
                          key={col.key}
                          className={`px-5 py-3 ${
                            col.align === "right"
                              ? "text-right"
                              : col.align === "center"
                              ? "text-center"
                              : "text-left"
                          } ${col.format === "currency" ? "font-medium" : "text-gray-700"}`}
                        >
                          {formatCell(row[col.key], col.format)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Row count footer */}
          {reportData.length > 0 && (
            <div className="bg-gray-50 border-t border-gray-100 px-5 py-2.5 text-xs text-gray-500">
              Showing {reportData.length} row{reportData.length !== 1 ? "s" : ""}
            </div>
          )}
        </div>
      )}

      {/* Prompt to generate */}
      {!hasGenerated && (
        <div className="card py-20 text-center">
          <p className="text-4xl mb-3">📊</p>
          <h2 className="text-lg font-semibold text-gray-700 mb-1">
            Select a report type and click Generate
          </h2>
          <p className="text-sm text-gray-400">
            Choose your date range and grouping, then hit "Generate Report" to see your data.
          </p>
        </div>
      )}
    </div>
  );
}

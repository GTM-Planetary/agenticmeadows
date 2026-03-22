import { Request, Response, NextFunction } from "express";
import { prisma } from "../index";

// ── Helpers ────────────────────────────────────────────────────────────────

function parseDateRange(req: Request): { start: Date; end: Date } {
  const start = req.query.startDate
    ? new Date(req.query.startDate as string)
    : new Date(new Date().setMonth(new Date().getMonth() - 3));
  const end = req.query.endDate
    ? new Date(req.query.endDate as string)
    : new Date();
  return { start, end };
}

function sumLineItems(lineItems: { quantity: number; unitPrice: number }[]): number {
  return lineItems.reduce((sum, li) => sum + li.quantity * li.unitPrice, 0);
}

// ── GET /api/reports/revenue ───────────────────────────────────────────────

export async function getRevenueReport(req: Request, res: Response, next: NextFunction) {
  try {
    const { start, end } = parseDateRange(req);
    const groupBy = (req.query.groupBy as string) || "month";

    const invoices = await prisma.invoice.findMany({
      where: {
        status: { in: ["SENT", "PAID", "OVERDUE"] },
        createdAt: { gte: start, lte: end },
      },
      include: { lineItems: true, client: true },
      orderBy: { createdAt: "asc" },
    });

    const buckets = new Map<string, { revenue: number; invoiceCount: number }>();

    for (const inv of invoices) {
      let label: string;

      switch (groupBy) {
        case "week": {
          const d = new Date(inv.createdAt);
          // ISO week start (Monday)
          const day = d.getDay();
          const diff = d.getDate() - day + (day === 0 ? -6 : 1);
          const weekStart = new Date(d.setDate(diff));
          label = weekStart.toISOString().slice(0, 10);
          break;
        }
        case "client":
          label = inv.client
            ? `${inv.client.firstName} ${inv.client.lastName}`
            : "Unknown";
          break;
        case "service":
          // Group by first line item description or "Uncategorized"
          label = inv.lineItems.length > 0 ? inv.lineItems[0].description : "Uncategorized";
          break;
        case "month":
        default: {
          const d = new Date(inv.createdAt);
          label = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
          break;
        }
      }

      const total = sumLineItems(inv.lineItems);
      const existing = buckets.get(label) || { revenue: 0, invoiceCount: 0 };
      existing.revenue += total;
      existing.invoiceCount += 1;
      buckets.set(label, existing);
    }

    const data = Array.from(buckets.entries()).map(([label, vals]) => ({
      label,
      revenue: Math.round(vals.revenue * 100) / 100,
      invoiceCount: vals.invoiceCount,
      avgDealSize:
        vals.invoiceCount > 0
          ? Math.round((vals.revenue / vals.invoiceCount) * 100) / 100
          : 0,
    }));

    const totalRevenue = data.reduce((s, d) => s + d.revenue, 0);
    const totalInvoices = data.reduce((s, d) => s + d.invoiceCount, 0);

    res.json({
      data,
      totals: {
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalInvoices,
      },
    });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/reports/jobs ──────────────────────────────────────────────────

export async function getJobsReport(req: Request, res: Response, next: NextFunction) {
  try {
    const { start, end } = parseDateRange(req);
    const groupBy = (req.query.groupBy as string) || "month";

    const jobs = await prisma.job.findMany({
      where: {
        createdAt: { gte: start, lte: end },
      },
      include: {
        assignedUser: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    const buckets = new Map<
      string,
      { jobCount: number; completedCount: number; totalDurationMs: number; onTimeCount: number }
    >();

    for (const job of jobs) {
      let label: string;

      switch (groupBy) {
        case "week": {
          const d = new Date(job.createdAt);
          const day = d.getDay();
          const diff = d.getDate() - day + (day === 0 ? -6 : 1);
          const weekStart = new Date(d.setDate(diff));
          label = weekStart.toISOString().slice(0, 10);
          break;
        }
        case "status":
          label = job.status;
          break;
        case "assignee":
          label = job.assignedUser ? job.assignedUser.name : "Unassigned";
          break;
        case "month":
        default: {
          const d = new Date(job.createdAt);
          label = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
          break;
        }
      }

      const existing = buckets.get(label) || {
        jobCount: 0,
        completedCount: 0,
        totalDurationMs: 0,
        onTimeCount: 0,
      };

      existing.jobCount += 1;

      if (job.status === "COMPLETED") {
        existing.completedCount += 1;

        // Duration: scheduledStart to updatedAt (completion time)
        if (job.scheduledStart) {
          const duration = job.updatedAt.getTime() - job.scheduledStart.getTime();
          existing.totalDurationMs += Math.max(duration, 0);
        }

        // On-time: completed before or on scheduledEnd
        if (job.scheduledEnd && job.updatedAt <= job.scheduledEnd) {
          existing.onTimeCount += 1;
        }
      }

      buckets.set(label, existing);
    }

    const data = Array.from(buckets.entries()).map(([label, vals]) => ({
      label,
      jobCount: vals.jobCount,
      completedCount: vals.completedCount,
      avgDuration:
        vals.completedCount > 0
          ? Math.round(vals.totalDurationMs / vals.completedCount / 3600000 * 10) / 10 // hours
          : 0,
      onTimeRate:
        vals.completedCount > 0
          ? Math.round((vals.onTimeCount / vals.completedCount) * 100)
          : 0,
    }));

    const totalJobs = data.reduce((s, d) => s + d.jobCount, 0);
    const totalCompleted = data.reduce((s, d) => s + d.completedCount, 0);

    res.json({
      data,
      totals: {
        totalJobs,
        totalCompleted,
        completionRate: totalJobs > 0 ? Math.round((totalCompleted / totalJobs) * 100) : 0,
      },
    });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/reports/clients ───────────────────────────────────────────────

export async function getClientsReport(req: Request, res: Response, next: NextFunction) {
  try {
    const { start, end } = parseDateRange(req);
    const sortBy = (req.query.sortBy as string) || "revenue";

    const clients = await prisma.client.findMany({
      include: {
        invoices: {
          where: { createdAt: { gte: start, lte: end } },
          include: { lineItems: true },
        },
        jobs: {
          where: { createdAt: { gte: start, lte: end } },
          orderBy: { scheduledStart: "desc" },
        },
        quotes: {
          where: { createdAt: { gte: start, lte: end } },
        },
      },
    });

    const data = clients.map((client) => {
      const revenue = client.invoices
        .filter((inv) => inv.status === "PAID" || inv.status === "SENT")
        .reduce((sum, inv) => sum + sumLineItems(inv.lineItems), 0);

      const lastJob = client.jobs.length > 0 ? client.jobs[0] : null;

      return {
        clientId: client.id,
        clientName: `${client.firstName} ${client.lastName}`,
        clientEmail: client.email ?? "",
        revenue: Math.round(revenue * 100) / 100,
        jobCount: client.jobs.length,
        quoteCount: client.quotes.length,
        invoiceCount: client.invoices.length,
        lastJobDate: lastJob?.scheduledStart ?? lastJob?.createdAt ?? null,
      };
    });

    // Sort based on sortBy param
    switch (sortBy) {
      case "jobs":
        data.sort((a, b) => b.jobCount - a.jobCount);
        break;
      case "recent":
        data.sort((a, b) => {
          const aDate = a.lastJobDate ? new Date(a.lastJobDate).getTime() : 0;
          const bDate = b.lastJobDate ? new Date(b.lastJobDate).getTime() : 0;
          return bDate - aDate;
        });
        break;
      case "revenue":
      default:
        data.sort((a, b) => b.revenue - a.revenue);
        break;
    }

    const totalRevenue = data.reduce((s, d) => s + d.revenue, 0);
    const totalJobs = data.reduce((s, d) => s + d.jobCount, 0);
    const totalQuotes = data.reduce((s, d) => s + d.quoteCount, 0);
    const totalInvoices = data.reduce((s, d) => s + d.invoiceCount, 0);

    res.json({
      data,
      totals: {
        totalClients: data.length,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalJobs,
        totalQuotes,
        totalInvoices,
      },
    });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/reports/sales-pipeline ────────────────────────────────────────

export async function getSalesPipeline(req: Request, res: Response, next: NextFunction) {
  try {
    const { start, end } = parseDateRange(req);

    // Stages map to quote statuses + invoice statuses
    // DRAFT -> SENT -> APPROVED -> INVOICED -> PAID

    const quotes = await prisma.quote.findMany({
      where: { createdAt: { gte: start, lte: end } },
      include: { lineItems: true },
    });

    const invoices = await prisma.invoice.findMany({
      where: { createdAt: { gte: start, lte: end } },
      include: { lineItems: true },
    });

    const stages: Record<string, { count: number; value: number }> = {
      DRAFT: { count: 0, value: 0 },
      SENT: { count: 0, value: 0 },
      APPROVED: { count: 0, value: 0 },
      INVOICED: { count: 0, value: 0 },
      PAID: { count: 0, value: 0 },
    };

    for (const q of quotes) {
      const val = sumLineItems(q.lineItems);
      if (q.status === "DRAFT") {
        stages.DRAFT.count += 1;
        stages.DRAFT.value += val;
      } else if (q.status === "SENT") {
        stages.SENT.count += 1;
        stages.SENT.value += val;
      } else if (q.status === "APPROVED") {
        stages.APPROVED.count += 1;
        stages.APPROVED.value += val;
      } else if (q.status === "INVOICED") {
        stages.INVOICED.count += 1;
        stages.INVOICED.value += val;
      }
    }

    // PAID stage from invoices
    for (const inv of invoices) {
      if (inv.status === "PAID") {
        const val = sumLineItems(inv.lineItems);
        stages.PAID.count += 1;
        stages.PAID.value += val;
      }
    }

    const data = Object.entries(stages).map(([stage, vals]) => ({
      stage,
      count: vals.count,
      value: Math.round(vals.value * 100) / 100,
    }));

    const totalPipeline = data.reduce((s, d) => s + d.value, 0);
    const totalCount = data.reduce((s, d) => s + d.count, 0);
    const paidStage = stages.PAID;
    const conversionRate =
      totalCount > 0 ? Math.round((paidStage.count / totalCount) * 100) : 0;
    const avgDealSize =
      totalCount > 0 ? Math.round((totalPipeline / totalCount) * 100) / 100 : 0;

    res.json({
      data,
      conversionRate,
      avgDealSize,
      totalPipeline: Math.round(totalPipeline * 100) / 100,
    });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/reports/aging ─────────────────────────────────────────────────

export async function getAgingReport(_req: Request, res: Response, next: NextFunction) {
  try {
    const now = new Date();

    const invoices = await prisma.invoice.findMany({
      where: {
        status: { in: ["SENT", "OVERDUE"] },
        dueDate: { not: null },
      },
      include: {
        client: { select: { id: true, firstName: true, lastName: true } },
        lineItems: true,
      },
      orderBy: { dueDate: "asc" },
    });

    let current = 0;
    let overdue30 = 0;
    let overdue60 = 0;
    let overdue90 = 0;

    const data = invoices.map((inv) => {
      const amount = sumLineItems(inv.lineItems);
      const dueDate = inv.dueDate!;
      const daysOverdue = Math.max(
        0,
        Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
      );

      // Categorize into aging buckets
      if (daysOverdue <= 0) {
        current += amount;
      } else if (daysOverdue <= 30) {
        overdue30 += amount;
      } else if (daysOverdue <= 60) {
        overdue60 += amount;
      } else {
        overdue90 += amount;
      }

      return {
        clientName: inv.client
          ? `${inv.client.firstName} ${inv.client.lastName}`
          : "Unknown",
        invoiceId: inv.id,
        amount: Math.round(amount * 100) / 100,
        dueDate: inv.dueDate,
        daysOverdue,
        status: inv.status,
      };
    });

    res.json({
      data,
      totals: {
        current: Math.round(current * 100) / 100,
        overdue30: Math.round(overdue30 * 100) / 100,
        overdue60: Math.round(overdue60 * 100) / 100,
        overdue90: Math.round(overdue90 * 100) / 100,
      },
    });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/reports/chemical-log ──────────────────────────────────────────

export async function getChemicalLog(req: Request, res: Response, next: NextFunction) {
  try {
    const { start, end } = parseDateRange(req);
    const propertyId = req.query.propertyId as string | undefined;

    const applications = await prisma.chemicalApplication.findMany({
      where: {
        appliedAt: { gte: start, lte: end },
        ...(propertyId ? { propertyId } : {}),
      },
      include: {
        property: { select: { id: true, streetAddress: true, city: true, state: true, zip: true } },
        job: { select: { id: true, title: true } },
      },
      orderBy: { appliedAt: "desc" },
    });

    const now = new Date();

    const data = applications.map((app) => ({
      id: app.id,
      date: app.appliedAt,
      propertyId: app.propertyId,
      propertyAddress: app.property
        ? `${app.property.streetAddress}, ${app.property.city}, ${app.property.state} ${app.property.zip}`
        : "Unknown",
      productName: app.productName,
      epaRegNumber: app.epaRegNumber,
      applicationRate: app.applicationRate,
      areaTreatedSqft: app.areaTreatedSqft,
      targetPest: app.targetPest,
      quantity: app.areaTreatedSqft ?? null,
      appliedBy: app.appliedBy ?? "Unknown",
      reentryHours: app.reentryHours,
      reentryExpires: app.reentryExpires,
      reentryStatus: app.reentryExpires
        ? now >= app.reentryExpires
          ? "CLEARED"
          : "RESTRICTED"
        : "UNKNOWN",
      jobId: app.jobId,
      jobTitle: app.job?.title ?? null,
      weatherNotes: app.weatherNotes,
    }));

    res.json({ data });
  } catch (err) {
    next(err);
  }
}

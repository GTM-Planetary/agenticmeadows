import { Request, Response, NextFunction } from "express";
import { prisma } from "../index";

export async function getDashboardStats(req: Request, res: Response, next: NextFunction) {
  try {
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    // ── Revenue ────────────────────────────────────────────────────────────

    // Paid invoices this month
    const paidThisMonth = await prisma.invoice.findMany({
      where: {
        status: "PAID",
        paidAt: { gte: thisMonthStart, lte: now },
      },
      include: { lineItems: true },
    });
    const revenueThisMonth = paidThisMonth.reduce(
      (sum, inv) => sum + inv.lineItems.reduce((s, li) => s + li.quantity * li.unitPrice, 0),
      0,
    );

    // Paid invoices last month
    const paidLastMonth = await prisma.invoice.findMany({
      where: {
        status: "PAID",
        paidAt: { gte: lastMonthStart, lte: lastMonthEnd },
      },
      include: { lineItems: true },
    });
    const revenueLastMonth = paidLastMonth.reduce(
      (sum, inv) => sum + inv.lineItems.reduce((s, li) => s + li.quantity * li.unitPrice, 0),
      0,
    );

    // Outstanding invoices (SENT or OVERDUE)
    const outstandingInvoices = await prisma.invoice.findMany({
      where: { status: { in: ["SENT", "OVERDUE"] } },
      include: { lineItems: true },
    });
    const outstandingTotal = outstandingInvoices.reduce(
      (sum, inv) => sum + inv.lineItems.reduce((s, li) => s + li.quantity * li.unitPrice, 0),
      0,
    );

    // ── Pending Revenue (DRAFT + SENT quotes) ─────────────────────────────

    const pendingQuotes = await prisma.quote.findMany({
      where: { status: { in: ["DRAFT", "SENT"] } },
      include: { lineItems: true },
    });
    const pendingRevenue = pendingQuotes.reduce(
      (sum, q) => sum + q.lineItems.reduce((s, li) => s + li.quantity * li.unitPrice, 0),
      0,
    );

    // ── Jobs ───────────────────────────────────────────────────────────────

    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const [pendingJobs, scheduledJobs, inProgressJobs, completedThisMonth, scheduledJobsToday] = await Promise.all([
      prisma.job.count({ where: { status: "PENDING" } }),
      prisma.job.count({ where: { status: "SCHEDULED" } }),
      prisma.job.count({ where: { status: "IN_PROGRESS" } }),
      prisma.job.count({
        where: {
          status: "COMPLETED",
          updatedAt: { gte: thisMonthStart, lte: now },
        },
      }),
      prisma.job.count({
        where: {
          status: { in: ["SCHEDULED", "PENDING", "IN_PROGRESS"] },
          scheduledStart: { gte: todayStart, lte: todayEnd },
        },
      }),
    ]);

    // ── Overdue invoices ───────────────────────────────────────────────────

    const overdueInvoices = await prisma.invoice.findMany({
      where: { status: "OVERDUE" },
      include: {
        client: { select: { id: true, firstName: true, lastName: true } },
        lineItems: true,
      },
      orderBy: { dueDate: "asc" },
    });
    const overdueTotal = overdueInvoices.reduce(
      (sum, inv) => sum + inv.lineItems.reduce((s, li) => s + li.quantity * li.unitPrice, 0),
      0,
    );
    const overdueList = overdueInvoices.map((inv) => ({
      id: inv.id,
      clientId: inv.clientId,
      client: inv.client,
      dueDate: inv.dueDate,
      status: inv.status,
      total: inv.lineItems.reduce((s, li) => s + li.quantity * li.unitPrice, 0),
    }));

    // ── Upcoming jobs ──────────────────────────────────────────────────────

    const upcoming = await prisma.job.findMany({
      where: {
        status: { in: ["SCHEDULED", "PENDING"] },
        scheduledStart: { gte: now },
      },
      orderBy: { scheduledStart: "asc" },
      take: 5,
      include: {
        client: { select: { id: true, firstName: true, lastName: true } },
        property: { select: { id: true, streetAddress: true, city: true } },
      },
    });

    // ── Agent + Notifications ──────────────────────────────────────────────

    const [agentPending, notificationsUnread] = await Promise.all([
      prisma.agentAction.count({ where: { status: "PROPOSED" } }),
      prisma.notification.count({
        where: { userId: req.user!.userId, isRead: false },
      }),
    ]);

    // ── Response ───────────────────────────────────────────────────────────

    res.json({
      revenue: {
        thisMonth: revenueThisMonth,
        lastMonth: revenueLastMonth,
        outstanding: outstandingTotal,
        pending: pendingRevenue,
      },
      jobs: {
        pending: pendingJobs,
        scheduled: scheduledJobs,
        inProgress: inProgressJobs,
        completedThisMonth,
        scheduledToday: scheduledJobsToday,
      },
      invoices: {
        overdue: overdueList,
        overdueTotal,
      },
      upcoming,
      agentPending,
      notificationsUnread,
    });
  } catch (err) {
    next(err);
  }
}

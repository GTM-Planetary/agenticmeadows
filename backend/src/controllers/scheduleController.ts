import { Request, Response, NextFunction } from "express";
import { prisma } from "../index";
import { createError } from "../middleware/errorHandler";

export async function getSchedule(req: Request, res: Response, next: NextFunction) {
  try {
    const { start, end } = req.query;
    if (!start || !end) {
      return next(createError("start and end query parameters are required (ISO 8601)", 400));
    }

    const startDate = new Date(String(start));
    const endDate = new Date(String(end));

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return next(createError("Invalid date format — use ISO 8601 (e.g., 2026-03-01T00:00:00Z)", 400));
    }

    const jobs = await prisma.job.findMany({
      where: {
        scheduledStart: { gte: startDate },
        scheduledEnd: { lte: endDate },
        status: { notIn: ["CANCELLED"] },
      },
      include: {
        client: { select: { id: true, firstName: true, lastName: true } },
        property: { select: { id: true, streetAddress: true, city: true } },
        assignedUser: { select: { id: true, name: true } },
      },
      orderBy: { scheduledStart: "asc" },
    });

    res.json(jobs);
  } catch (err) {
    next(err);
  }
}

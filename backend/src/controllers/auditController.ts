import { Request, Response, NextFunction } from "express";
import { prisma } from "../index";
import { createError } from "../middleware/errorHandler";
import { AuditEventType } from "@prisma/client";

export async function listAuditLogs(req: Request, res: Response, next: NextFunction) {
  try {
    const { sessionId, userId, eventType, entityType, startDate, endDate, limit, offset } = req.query;

    const take = limit ? parseInt(String(limit), 10) : 50;
    const skip = offset ? parseInt(String(offset), 10) : 0;

    const where: Record<string, unknown> = {};
    if (sessionId) where.sessionId = String(sessionId);
    if (userId) where.userId = String(userId);
    if (eventType) where.eventType = String(eventType) as AuditEventType;
    if (entityType) where.entityType = String(entityType);
    if (startDate || endDate) {
      where.createdAt = {
        ...(startDate ? { gte: new Date(String(startDate)) } : {}),
        ...(endDate ? { lte: new Date(String(endDate)) } : {}),
      };
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take,
        skip,
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({ data: logs, total, limit: take, offset: skip });
  } catch (err) {
    next(err);
  }
}

export async function getSessionHistory(_req: Request, res: Response, next: NextFunction) {
  try {
    const sessions = await prisma.auditLog.groupBy({
      by: ["sessionId"],
      _count: { id: true },
      _min: { createdAt: true },
      _max: { createdAt: true },
      orderBy: { _max: { createdAt: "desc" } },
    });

    const result = sessions.map((s) => ({
      sessionId: s.sessionId,
      eventCount: s._count.id,
      firstEvent: s._min.createdAt,
      lastEvent: s._max.createdAt,
    }));

    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function createAuditLog(req: Request, res: Response, next: NextFunction) {
  try {
    const {
      sessionId, userId, eventType, summary,
      entityType, entityId, actionType,
      payload, result, inferenceMode, modelUsed, latencyMs,
    } = req.body;

    if (!sessionId || !eventType || !summary) {
      return next(createError("sessionId, eventType, and summary are required", 400));
    }

    const log = await prisma.auditLog.create({
      data: {
        sessionId,
        userId: userId ?? req.user?.userId ?? null,
        eventType: eventType as AuditEventType,
        summary,
        entityType: entityType ?? null,
        entityId: entityId ?? null,
        actionType: actionType ?? null,
        payload: payload ?? undefined,
        result: result ?? undefined,
        inferenceMode: inferenceMode ?? null,
        modelUsed: modelUsed ?? null,
        latencyMs: latencyMs != null ? parseInt(String(latencyMs), 10) : null,
      },
    });

    res.status(201).json(log);
  } catch (err) {
    next(err);
  }
}

export async function getSessionDetail(req: Request, res: Response, next: NextFunction) {
  try {
    const { sessionId } = req.params;
    if (!sessionId) return next(createError("sessionId is required", 400));

    const logs = await prisma.auditLog.findMany({
      where: { sessionId },
      orderBy: { createdAt: "asc" },
    });

    if (logs.length === 0) {
      return next(createError("No events found for this session", 404));
    }

    res.json(logs);
  } catch (err) {
    next(err);
  }
}

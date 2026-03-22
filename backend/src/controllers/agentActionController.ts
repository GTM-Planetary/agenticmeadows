import { Request, Response, NextFunction } from "express";
import { prisma } from "../index";
import { createError } from "../middleware/errorHandler";
import { AgentActionType, AgentActionStatus } from "@prisma/client";

export async function listActions(req: Request, res: Response, next: NextFunction) {
  try {
    const { status, type, limit, offset } = req.query;
    const actions = await prisma.agentAction.findMany({
      where: {
        ...(status ? { status: String(status) as AgentActionStatus } : {}),
        ...(type ? { type: String(type) as AgentActionType } : {}),
      },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: limit ? parseInt(String(limit), 10) : 20,
      skip: offset ? parseInt(String(offset), 10) : 0,
    });
    res.json(actions);
  } catch (err) {
    next(err);
  }
}

export async function getAction(req: Request, res: Response, next: NextFunction) {
  try {
    const action = await prisma.agentAction.findUnique({
      where: { id: req.params.id },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    if (!action) return next(createError("Agent action not found", 404));
    res.json(action);
  } catch (err) {
    next(err);
  }
}

export async function createAction(req: Request, res: Response, next: NextFunction) {
  try {
    const { type, summary, userId, details, expiresAt } = req.body;
    if (!type || !summary) {
      return next(createError("type and summary are required", 400));
    }

    const action = await prisma.agentAction.create({
      data: {
        type: type as AgentActionType,
        summary,
        userId,
        details: details ?? undefined,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    res.status(201).json(action);
  } catch (err) {
    next(err);
  }
}

export async function approveAction(req: Request, res: Response, next: NextFunction) {
  try {
    const action = await prisma.agentAction.findUnique({
      where: { id: req.params.id },
    });
    if (!action) return next(createError("Agent action not found", 404));
    if (action.status !== "PROPOSED") {
      return next(createError(`Action is already ${action.status}`, 409));
    }

    const details = (action.details as Record<string, any>) ?? {};
    let resultType: string | undefined;
    let resultId: string | undefined;

    switch (action.type) {
      case "CREATE_JOB": {
        const job = await prisma.job.create({
          data: {
            clientId: details.clientId,
            propertyId: details.propertyId,
            assignedUserId: details.assignedUserId,
            title: details.title,
            description: details.description,
            status: details.status ?? "PENDING",
            scheduledStart: details.scheduledStart ? new Date(details.scheduledStart) : undefined,
            scheduledEnd: details.scheduledEnd ? new Date(details.scheduledEnd) : undefined,
            isRecurring: details.isRecurring ?? false,
            notes: details.notes,
          },
        });
        resultType = "Job";
        resultId = job.id;
        break;
      }

      case "RESCHEDULE_JOB": {
        await prisma.job.update({
          where: { id: details.jobId },
          data: {
            ...(details.scheduledStart && { scheduledStart: new Date(details.scheduledStart) }),
            ...(details.scheduledEnd && { scheduledEnd: new Date(details.scheduledEnd) }),
          },
        });
        resultType = "Job";
        resultId = details.jobId;
        break;
      }

      case "CREATE_QUOTE": {
        const quote = await prisma.$transaction(async (tx) => {
          const q = await tx.quote.create({
            data: {
              clientId: details.clientId,
              propertyId: details.propertyId,
              title: details.title,
              status: details.status ?? "DRAFT",
              validUntil: details.validUntil ? new Date(details.validUntil) : undefined,
              notes: details.notes,
            },
          });
          if (Array.isArray(details.lineItems) && details.lineItems.length > 0) {
            await tx.lineItem.createMany({
              data: details.lineItems.map((item: any) => ({
                quoteId: q.id,
                description: item.description,
                quantity: item.quantity ?? 1,
                unitPrice: item.unitPrice,
              })),
            });
          }
          return q;
        });
        resultType = "Quote";
        resultId = quote.id;
        break;
      }

      case "CREATE_INVOICE": {
        const invoice = await prisma.$transaction(async (tx) => {
          const inv = await tx.invoice.create({
            data: {
              clientId: details.clientId,
              jobId: details.jobId,
              quoteId: details.quoteId,
              propertyId: details.propertyId,
              status: details.status ?? "DRAFT",
              dueDate: details.dueDate ? new Date(details.dueDate) : undefined,
            },
          });
          if (Array.isArray(details.lineItems) && details.lineItems.length > 0) {
            await tx.lineItem.createMany({
              data: details.lineItems.map((item: any) => ({
                invoiceId: inv.id,
                description: item.description,
                quantity: item.quantity ?? 1,
                unitPrice: item.unitPrice,
              })),
            });
          }
          return inv;
        });
        resultType = "Invoice";
        resultId = invoice.id;
        break;
      }

      case "LOG_CHEMICAL": {
        const chem = await prisma.chemicalApplication.create({
          data: {
            propertyId: details.propertyId,
            jobId: details.jobId,
            appliedBy: details.appliedBy,
            productName: details.productName,
            epaRegNumber: details.epaRegNumber,
            applicationRate: details.applicationRate,
            areaTreatedSqft: details.areaTreatedSqft,
            targetPest: details.targetPest,
            windSpeedMph: details.windSpeedMph,
            temperatureF: details.temperatureF,
            humidity: details.humidity,
            weatherNotes: details.weatherNotes,
            reentryHours: details.reentryHours ?? 24,
            reentryExpires: details.reentryExpires ? new Date(details.reentryExpires) : undefined,
            notes: details.notes,
            appliedAt: details.appliedAt ? new Date(details.appliedAt) : new Date(),
          },
        });
        resultType = "ChemicalApplication";
        resultId = chem.id;
        break;
      }

      case "SEND_REMINDER": {
        const notification = await prisma.notification.create({
          data: {
            userId: details.userId,
            type: details.type ?? "JOB_REMINDER",
            title: details.title,
            message: details.message,
            actionUrl: details.actionUrl,
            agentActionId: action.id,
          },
        });
        resultType = "Notification";
        resultId = notification.id;
        break;
      }

      default: {
        // For types without specific entity creation (WEATHER_ALERT, SEASONAL_BATCH, etc.)
        break;
      }
    }

    const updated = await prisma.agentAction.update({
      where: { id: req.params.id },
      data: {
        status: "CONFIRMED",
        resolvedAt: new Date(),
        resolvedBy: req.user!.userId,
        ...(resultType && { resultType }),
        ...(resultId && { resultId }),
      },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
}

export async function rejectAction(req: Request, res: Response, next: NextFunction) {
  try {
    const action = await prisma.agentAction.findUnique({
      where: { id: req.params.id },
    });
    if (!action) return next(createError("Agent action not found", 404));
    if (action.status !== "PROPOSED") {
      return next(createError(`Action is already ${action.status}`, 409));
    }

    const updated = await prisma.agentAction.update({
      where: { id: req.params.id },
      data: {
        status: "REJECTED",
        resolvedAt: new Date(),
        resolvedBy: req.user!.userId,
      },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

export async function countPending(req: Request, res: Response, next: NextFunction) {
  try {
    const count = await prisma.agentAction.count({
      where: {
        status: "PROPOSED",
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
    });
    res.json({ count });
  } catch (err) {
    next(err);
  }
}

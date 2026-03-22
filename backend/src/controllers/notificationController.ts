import { Request, Response, NextFunction } from "express";
import { prisma } from "../index";
import { createError } from "../middleware/errorHandler";
import { NotificationType } from "@prisma/client";

export async function listNotifications(req: Request, res: Response, next: NextFunction) {
  try {
    const { unreadOnly, limit } = req.query;
    const notifications = await prisma.notification.findMany({
      where: {
        userId: req.user!.userId,
        ...(unreadOnly === "true" ? { isRead: false } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit ? parseInt(String(limit), 10) : 20,
    });
    res.json(notifications);
  } catch (err) {
    next(err);
  }
}

export async function markRead(req: Request, res: Response, next: NextFunction) {
  try {
    const notification = await prisma.notification.findUnique({
      where: { id: req.params.id },
    });
    if (!notification) return next(createError("Notification not found", 404));
    if (notification.userId !== req.user!.userId) {
      return next(createError("Forbidden", 403));
    }

    const updated = await prisma.notification.update({
      where: { id: req.params.id },
      data: { isRead: true },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

export async function markAllRead(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await prisma.notification.updateMany({
      where: { userId: req.user!.userId, isRead: false },
      data: { isRead: true },
    });
    res.json({ updated: result.count });
  } catch (err) {
    next(err);
  }
}

export async function countUnread(req: Request, res: Response, next: NextFunction) {
  try {
    const count = await prisma.notification.count({
      where: { userId: req.user!.userId, isRead: false },
    });
    res.json({ count });
  } catch (err) {
    next(err);
  }
}

export async function createNotification(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId, type, title, message, actionUrl, agentActionId } = req.body;
    if (!userId || !type || !title || !message) {
      return next(createError("userId, type, title, and message are required", 400));
    }

    const notification = await prisma.notification.create({
      data: {
        userId,
        type: type as NotificationType,
        title,
        message,
        actionUrl,
        agentActionId,
      },
    });
    res.status(201).json(notification);
  } catch (err) {
    next(err);
  }
}

export async function deleteNotification(req: Request, res: Response, next: NextFunction) {
  try {
    const notification = await prisma.notification.findUnique({
      where: { id: req.params.id },
    });
    if (!notification) return next(createError("Notification not found", 404));
    if (notification.userId !== req.user!.userId) {
      return next(createError("Forbidden", 403));
    }

    await prisma.notification.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

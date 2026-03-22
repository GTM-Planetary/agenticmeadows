import { Request, Response, NextFunction } from "express";
import { prisma } from "../index";
import { createError } from "../middleware/errorHandler";
import { JobStatus } from "@prisma/client";

// Valid status transitions
const STATUS_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  PENDING: ["SCHEDULED", "CANCELLED"],
  SCHEDULED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export async function listJobs(req: Request, res: Response, next: NextFunction) {
  try {
    const { clientId, status } = req.query;
    const jobs = await prisma.job.findMany({
      where: {
        ...(clientId ? { clientId: String(clientId) } : {}),
        ...(status ? { status: status as JobStatus } : {}),
      },
      include: { client: true, property: true, assignedUser: { select: { id: true, name: true } } },
      orderBy: { scheduledStart: "asc" },
    });
    res.json(jobs);
  } catch (err) {
    next(err);
  }
}

export async function getJob(req: Request, res: Response, next: NextFunction) {
  try {
    const job = await prisma.job.findUnique({
      where: { id: req.params.id },
      include: {
        client: true,
        property: true,
        assignedUser: { select: { id: true, name: true, email: true } },
        photos: { orderBy: { createdAt: "asc" } },
        lineItems: true,
      },
    });
    if (!job) return next(createError("Job not found", 404));
    res.json(job);
  } catch (err) {
    next(err);
  }
}

export async function createJob(req: Request, res: Response, next: NextFunction) {
  try {
    const { clientId, propertyId, assignedUserId, title, description, status,
            scheduledStart, scheduledEnd, isRecurring, notes, checklistItems } = req.body;
    if (!clientId || !title) {
      return next(createError("clientId and title are required", 400));
    }
    const job = await prisma.job.create({
      data: {
        clientId, propertyId, assignedUserId, title, description,
        status: status ?? "PENDING",
        scheduledStart: scheduledStart ? new Date(scheduledStart) : undefined,
        scheduledEnd: scheduledEnd ? new Date(scheduledEnd) : undefined,
        isRecurring: isRecurring ?? false,
        notes,
        checklistItems: checklistItems ?? [],
      },
      include: { client: true, property: true },
    });
    res.status(201).json(job);
  } catch (err) {
    next(err);
  }
}

export async function updateJob(req: Request, res: Response, next: NextFunction) {
  try {
    const existing = await prisma.job.findUnique({ where: { id: req.params.id } });
    if (!existing) return next(createError("Job not found", 404));

    const { status } = req.body;
    // Validate status transition if status is changing
    if (status && status !== existing.status) {
      const allowed = STATUS_TRANSITIONS[existing.status as JobStatus];
      if (!allowed.includes(status as JobStatus)) {
        return next(createError(
          `Cannot transition from ${existing.status} to ${status}`, 400
        ));
      }
    }

    const { clientId, propertyId, assignedUserId, title, description,
            scheduledStart, scheduledEnd, isRecurring, notes, checklistItems } = req.body;

    const job = await prisma.job.update({
      where: { id: req.params.id },
      data: {
        ...(clientId !== undefined && { clientId }),
        ...(propertyId !== undefined && { propertyId }),
        ...(assignedUserId !== undefined && { assignedUserId }),
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(status !== undefined && { status }),
        ...(scheduledStart !== undefined && { scheduledStart: new Date(scheduledStart) }),
        ...(scheduledEnd !== undefined && { scheduledEnd: new Date(scheduledEnd) }),
        ...(isRecurring !== undefined && { isRecurring }),
        ...(notes !== undefined && { notes }),
        ...(checklistItems !== undefined && { checklistItems }),
      },
      include: { client: true, property: true, photos: true, lineItems: true },
    });
    res.json(job);
  } catch (err) {
    next(err);
  }
}

export async function deleteJob(req: Request, res: Response, next: NextFunction) {
  try {
    await prisma.job.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function listPhotos(req: Request, res: Response, next: NextFunction) {
  try {
    const photos = await prisma.jobPhoto.findMany({
      where: { jobId: req.params.id },
      orderBy: { createdAt: "asc" },
    });
    res.json(photos);
  } catch (err) {
    next(err);
  }
}

export async function uploadPhoto(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file) return next(createError("No file uploaded", 400));

    const { caption, photoType } = req.body;
    const url = `/photos/${req.file.filename}`;

    const photo = await prisma.jobPhoto.create({
      data: {
        jobId: req.params.id,
        url,
        caption,
        photoType: photoType ?? "BEFORE",
      },
    });
    res.status(201).json(photo);
  } catch (err) {
    next(err);
  }
}

export async function updatePhotoAnalysis(req: Request, res: Response, next: NextFunction) {
  try {
    const { aiAnalysis, caption, photoType } = req.body;
    const photo = await prisma.jobPhoto.update({
      where: { id: req.params.photoId },
      data: {
        ...(aiAnalysis !== undefined && { aiAnalysis }),
        ...(caption !== undefined && { caption }),
        ...(photoType !== undefined && { photoType }),
      },
    });
    res.json(photo);
  } catch (err) {
    next(err);
  }
}

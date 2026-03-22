import { Request, Response, NextFunction } from "express";
import { prisma } from "../index";
import { createError } from "../middleware/errorHandler";

export async function listApplications(req: Request, res: Response, next: NextFunction) {
  try {
    const { propertyId, startDate, endDate } = req.query;
    const applications = await prisma.chemicalApplication.findMany({
      where: {
        ...(propertyId ? { propertyId: String(propertyId) } : {}),
        ...(startDate || endDate
          ? {
              appliedAt: {
                ...(startDate ? { gte: new Date(String(startDate)) } : {}),
                ...(endDate ? { lte: new Date(String(endDate)) } : {}),
              },
            }
          : {}),
      },
      include: { property: true, job: true },
      orderBy: { appliedAt: "desc" },
    });
    res.json(applications);
  } catch (err) {
    next(err);
  }
}

export async function getApplication(req: Request, res: Response, next: NextFunction) {
  try {
    const application = await prisma.chemicalApplication.findUnique({
      where: { id: req.params.id },
      include: { property: true, job: true },
    });
    if (!application) return next(createError("Chemical application not found", 404));
    res.json(application);
  } catch (err) {
    next(err);
  }
}

export async function createApplication(req: Request, res: Response, next: NextFunction) {
  try {
    const {
      propertyId, jobId, appliedBy, productName, epaRegNumber,
      applicationRate, areaTreatedSqft, targetPest,
      windSpeedMph, temperatureF, humidity, weatherNotes,
      reentryHours, notes, appliedAt,
    } = req.body;

    if (!propertyId || !productName) {
      return next(createError("propertyId and productName are required", 400));
    }

    const effectiveAppliedAt = appliedAt ? new Date(appliedAt) : new Date();
    const effectiveReentryHours = reentryHours ?? 24;

    // Auto-calculate reentryExpires = appliedAt + reentryHours * 3600000 ms
    const reentryExpires = new Date(
      effectiveAppliedAt.getTime() + effectiveReentryHours * 3600000
    );

    const application = await prisma.chemicalApplication.create({
      data: {
        propertyId,
        jobId,
        appliedBy,
        productName,
        epaRegNumber,
        applicationRate,
        areaTreatedSqft,
        targetPest,
        windSpeedMph,
        temperatureF,
        humidity,
        weatherNotes,
        reentryHours: effectiveReentryHours,
        reentryExpires,
        notes,
        appliedAt: effectiveAppliedAt,
      },
      include: { property: true, job: true },
    });
    res.status(201).json(application);
  } catch (err) {
    next(err);
  }
}

export async function updateApplication(req: Request, res: Response, next: NextFunction) {
  try {
    const {
      propertyId, jobId, appliedBy, productName, epaRegNumber,
      applicationRate, areaTreatedSqft, targetPest,
      windSpeedMph, temperatureF, humidity, weatherNotes,
      reentryHours, reentryExpires, notes, appliedAt,
    } = req.body;

    // If appliedAt or reentryHours change, recalculate reentryExpires
    let computedReentryExpires = reentryExpires ? new Date(reentryExpires) : undefined;
    if ((appliedAt !== undefined || reentryHours !== undefined) && reentryExpires === undefined) {
      const existing = await prisma.chemicalApplication.findUnique({ where: { id: req.params.id } });
      if (!existing) return next(createError("Chemical application not found", 404));

      const effectiveAppliedAt = appliedAt ? new Date(appliedAt) : existing.appliedAt;
      const effectiveReentryHours = reentryHours ?? existing.reentryHours;
      computedReentryExpires = new Date(
        effectiveAppliedAt.getTime() + effectiveReentryHours * 3600000
      );
    }

    const application = await prisma.chemicalApplication.update({
      where: { id: req.params.id },
      data: {
        ...(propertyId !== undefined && { propertyId }),
        ...(jobId !== undefined && { jobId }),
        ...(appliedBy !== undefined && { appliedBy }),
        ...(productName !== undefined && { productName }),
        ...(epaRegNumber !== undefined && { epaRegNumber }),
        ...(applicationRate !== undefined && { applicationRate }),
        ...(areaTreatedSqft !== undefined && { areaTreatedSqft }),
        ...(targetPest !== undefined && { targetPest }),
        ...(windSpeedMph !== undefined && { windSpeedMph }),
        ...(temperatureF !== undefined && { temperatureF }),
        ...(humidity !== undefined && { humidity }),
        ...(weatherNotes !== undefined && { weatherNotes }),
        ...(reentryHours !== undefined && { reentryHours }),
        ...(computedReentryExpires !== undefined && { reentryExpires: computedReentryExpires }),
        ...(notes !== undefined && { notes }),
        ...(appliedAt !== undefined && { appliedAt: new Date(appliedAt) }),
      },
      include: { property: true, job: true },
    });
    res.json(application);
  } catch (err) {
    next(err);
  }
}

export async function deleteApplication(req: Request, res: Response, next: NextFunction) {
  try {
    await prisma.chemicalApplication.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function listByProperty(req: Request, res: Response, next: NextFunction) {
  try {
    const applications = await prisma.chemicalApplication.findMany({
      where: { propertyId: req.params.id },
      include: { job: true },
      orderBy: { appliedAt: "desc" },
    });
    res.json(applications);
  } catch (err) {
    next(err);
  }
}

import { Request, Response, NextFunction } from "express";
import { prisma } from "../index";
import { createError } from "../middleware/errorHandler";

export async function listMeasurements(req: Request, res: Response, next: NextFunction) {
  try {
    const measurements = await prisma.propertyMeasurement.findMany({
      where: { propertyId: req.params.id },
      orderBy: { measuredAt: "desc" },
    });
    res.json(measurements);
  } catch (err) {
    next(err);
  }
}

export async function createMeasurement(req: Request, res: Response, next: NextFunction) {
  try {
    const { lotSizeSqft, lawnSqft, bedSqft, edgingLinearFt, hardscapeSqft, notes } = req.body;

    // Require at least one measurement field
    if (
      lotSizeSqft === undefined &&
      lawnSqft === undefined &&
      bedSqft === undefined &&
      edgingLinearFt === undefined &&
      hardscapeSqft === undefined
    ) {
      return next(createError("At least one measurement field is required", 400));
    }

    const measurement = await prisma.propertyMeasurement.create({
      data: {
        propertyId: req.params.id,
        measuredBy: req.user!.userId,
        lotSizeSqft,
        lawnSqft,
        bedSqft,
        edgingLinearFt,
        hardscapeSqft,
        notes,
      },
    });
    res.status(201).json(measurement);
  } catch (err) {
    next(err);
  }
}

export async function getLatestMeasurement(req: Request, res: Response, next: NextFunction) {
  try {
    const measurement = await prisma.propertyMeasurement.findFirst({
      where: { propertyId: req.params.id },
      orderBy: { measuredAt: "desc" },
    });
    if (!measurement) return next(createError("No measurements found for this property", 404));
    res.json(measurement);
  } catch (err) {
    next(err);
  }
}

export async function updateMeasurement(req: Request, res: Response, next: NextFunction) {
  try {
    const { lotSizeSqft, lawnSqft, bedSqft, edgingLinearFt, hardscapeSqft, notes } = req.body;
    const measurement = await prisma.propertyMeasurement.update({
      where: { id: req.params.measurementId },
      data: {
        ...(lotSizeSqft !== undefined && { lotSizeSqft }),
        ...(lawnSqft !== undefined && { lawnSqft }),
        ...(bedSqft !== undefined && { bedSqft }),
        ...(edgingLinearFt !== undefined && { edgingLinearFt }),
        ...(hardscapeSqft !== undefined && { hardscapeSqft }),
        ...(notes !== undefined && { notes }),
      },
    });
    res.json(measurement);
  } catch (err) {
    next(err);
  }
}

export async function deleteMeasurement(req: Request, res: Response, next: NextFunction) {
  try {
    await prisma.propertyMeasurement.delete({ where: { id: req.params.measurementId } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

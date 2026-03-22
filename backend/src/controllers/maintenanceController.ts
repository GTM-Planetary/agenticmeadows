import { Request, Response, NextFunction } from "express";
import { prisma } from "../index";
import { createError } from "../middleware/errorHandler";

// ── Equipment CRUD ─────────────────────────────────────────────────────────

export async function listEquipment(req: Request, res: Response, next: NextFunction) {
  try {
    const { type, category, status, assignedToId } = req.query;
    const equipment = await prisma.equipment.findMany({
      where: {
        ...(type ? { type: String(type) } : {}),
        ...(category ? { category: String(category) } : {}),
        ...(status ? { status: String(status) } : {}),
        ...(assignedToId ? { assignedToId: String(assignedToId) } : {}),
      },
      include: { assignedTo: true },
      orderBy: { name: "asc" },
    });
    res.json(equipment);
  } catch (err) {
    next(err);
  }
}

export async function getEquipment(req: Request, res: Response, next: NextFunction) {
  try {
    const equipment = await prisma.equipment.findUnique({
      where: { id: req.params.id },
      include: {
        assignedTo: true,
        maintenanceLogs: {
          orderBy: { performedAt: "desc" },
          include: { performedBy: true },
        },
        maintenanceSchedules: {
          where: { isActive: true },
          orderBy: { nextDue: "asc" },
        },
      },
    });
    if (!equipment) return next(createError("Equipment not found", 404));
    res.json(equipment);
  } catch (err) {
    next(err);
  }
}

export async function createEquipment(req: Request, res: Response, next: NextFunction) {
  try {
    const {
      name, type, category, make, model, serialNumber, year,
      purchaseDate, purchasePrice, status, currentHours, currentMileage,
      photoUrl, notes, assignedToId,
    } = req.body;

    if (!name || !type) {
      return next(createError("name and type are required", 400));
    }

    const equipment = await prisma.equipment.create({
      data: {
        name,
        type,
        category: category ?? "EQUIPMENT",
        make,
        model,
        serialNumber,
        year,
        purchaseDate: purchaseDate ? new Date(purchaseDate) : undefined,
        purchasePrice,
        status: status ?? "ACTIVE",
        currentHours: currentHours ?? 0,
        currentMileage: currentMileage ?? 0,
        photoUrl,
        notes,
        assignedToId,
      },
      include: { assignedTo: true },
    });
    res.status(201).json(equipment);
  } catch (err) {
    next(err);
  }
}

export async function updateEquipment(req: Request, res: Response, next: NextFunction) {
  try {
    const {
      name, type, category, make, model, serialNumber, year,
      purchaseDate, purchasePrice, status, currentHours, currentMileage,
      photoUrl, notes, assignedToId,
    } = req.body;

    const existing = await prisma.equipment.findUnique({ where: { id: req.params.id } });
    if (!existing) return next(createError("Equipment not found", 404));

    const equipment = await prisma.equipment.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(type !== undefined && { type }),
        ...(category !== undefined && { category }),
        ...(make !== undefined && { make }),
        ...(model !== undefined && { model }),
        ...(serialNumber !== undefined && { serialNumber }),
        ...(year !== undefined && { year }),
        ...(purchaseDate !== undefined && { purchaseDate: purchaseDate ? new Date(purchaseDate) : null }),
        ...(purchasePrice !== undefined && { purchasePrice }),
        ...(status !== undefined && { status }),
        ...(currentHours !== undefined && { currentHours }),
        ...(currentMileage !== undefined && { currentMileage }),
        ...(photoUrl !== undefined && { photoUrl }),
        ...(notes !== undefined && { notes }),
        ...(assignedToId !== undefined && { assignedToId }),
      },
      include: { assignedTo: true },
    });

    // If hours or mileage changed, recalculate schedule next-due values
    if (currentHours !== undefined || currentMileage !== undefined) {
      await recalculateSchedules(req.params.id, equipment.currentHours, equipment.currentMileage);
    }

    res.json(equipment);
  } catch (err) {
    next(err);
  }
}

// ── Maintenance Logging ────────────────────────────────────────────────────

export async function logMaintenance(req: Request, res: Response, next: NextFunction) {
  try {
    const equipmentId = req.params.id;
    const {
      taskName, performedAt, performedById, hoursAtService,
      mileageAtService, cost, vendor, parts, notes, photoUrls,
    } = req.body;

    if (!taskName) {
      return next(createError("taskName is required", 400));
    }

    const equipment = await prisma.equipment.findUnique({ where: { id: equipmentId } });
    if (!equipment) return next(createError("Equipment not found", 404));

    // Create the log entry
    const log = await prisma.maintenanceLog.create({
      data: {
        equipmentId,
        taskName,
        performedAt: performedAt ? new Date(performedAt) : new Date(),
        performedById,
        hoursAtService: hoursAtService ?? equipment.currentHours,
        mileageAtService: mileageAtService ?? equipment.currentMileage,
        cost,
        vendor,
        parts,
        notes,
        photoUrls,
      },
      include: { performedBy: true },
    });

    // Update equipment hours/mileage if provided
    if (hoursAtService !== undefined || mileageAtService !== undefined) {
      await prisma.equipment.update({
        where: { id: equipmentId },
        data: {
          ...(hoursAtService !== undefined && { currentHours: hoursAtService }),
          ...(mileageAtService !== undefined && { currentMileage: mileageAtService }),
        },
      });
    }

    // Find and update matching maintenance schedules
    const matchingSchedules = await prisma.maintenanceSchedule.findMany({
      where: {
        equipmentId,
        taskName,
        isActive: true,
      },
    });

    const effectivePerformedAt = performedAt ? new Date(performedAt) : new Date();
    const effectiveHours = hoursAtService ?? equipment.currentHours;
    const effectiveMileage = mileageAtService ?? equipment.currentMileage;

    for (const schedule of matchingSchedules) {
      const nextDueData = calculateNextDue(
        schedule.intervalType,
        schedule.intervalValue,
        effectivePerformedAt,
        effectiveHours,
        effectiveMileage,
      );

      await prisma.maintenanceSchedule.update({
        where: { id: schedule.id },
        data: {
          lastPerformed: effectivePerformedAt,
          lastHours: effectiveHours,
          lastMileage: effectiveMileage,
          ...nextDueData,
        },
      });
    }

    res.status(201).json(log);
  } catch (err) {
    next(err);
  }
}

// ── Maintenance Alerts (Predictive) ────────────────────────────────────────

export async function getMaintenanceAlerts(req: Request, res: Response, next: NextFunction) {
  try {
    // Get all active schedules with their equipment
    const schedules = await prisma.maintenanceSchedule.findMany({
      where: { isActive: true },
      include: {
        equipment: { include: { assignedTo: true } },
      },
    });

    const now = new Date();
    const alerts: Array<{
      schedule: typeof schedules[number];
      alertType: "OVERDUE" | "UPCOMING";
      message: string;
    }> = [];

    for (const schedule of schedules) {
      const eq = schedule.equipment;

      if (schedule.intervalType === "HOURS") {
        const nextDueHours = schedule.nextDueHours;
        if (nextDueHours !== null && nextDueHours !== undefined) {
          if (eq.currentHours >= nextDueHours) {
            alerts.push({
              schedule,
              alertType: "OVERDUE",
              message: `${eq.name}: ${schedule.taskName} is overdue (current: ${eq.currentHours}h, due: ${nextDueHours}h)`,
            });
          } else {
            // Check if within 10% of interval
            const threshold = nextDueHours - schedule.intervalValue * 0.1;
            if (eq.currentHours >= threshold) {
              alerts.push({
                schedule,
                alertType: "UPCOMING",
                message: `${eq.name}: ${schedule.taskName} due soon (current: ${eq.currentHours}h, due: ${nextDueHours}h)`,
              });
            }
          }
        }
      } else if (schedule.intervalType === "MILES") {
        const nextDueMileage = schedule.nextDueMileage;
        if (nextDueMileage !== null && nextDueMileage !== undefined) {
          if (eq.currentMileage >= nextDueMileage) {
            alerts.push({
              schedule,
              alertType: "OVERDUE",
              message: `${eq.name}: ${schedule.taskName} is overdue (current: ${eq.currentMileage}mi, due: ${nextDueMileage}mi)`,
            });
          } else {
            const threshold = nextDueMileage - schedule.intervalValue * 0.1;
            if (eq.currentMileage >= threshold) {
              alerts.push({
                schedule,
                alertType: "UPCOMING",
                message: `${eq.name}: ${schedule.taskName} due soon (current: ${eq.currentMileage}mi, due: ${nextDueMileage}mi)`,
              });
            }
          }
        }
      } else if (schedule.intervalType === "DAYS" || schedule.intervalType === "MONTHS") {
        const nextDue = schedule.nextDue;
        if (nextDue) {
          if (now >= nextDue) {
            alerts.push({
              schedule,
              alertType: "OVERDUE",
              message: `${eq.name}: ${schedule.taskName} is overdue (was due ${nextDue.toISOString().slice(0, 10)})`,
            });
          } else {
            // Check if within 10% of interval (in days)
            const totalIntervalMs =
              schedule.intervalType === "DAYS"
                ? schedule.intervalValue * 86400000
                : schedule.intervalValue * 30 * 86400000;
            const thresholdMs = totalIntervalMs * 0.1;
            const timeUntilDue = nextDue.getTime() - now.getTime();
            if (timeUntilDue <= thresholdMs) {
              alerts.push({
                schedule,
                alertType: "UPCOMING",
                message: `${eq.name}: ${schedule.taskName} due soon (${nextDue.toISOString().slice(0, 10)})`,
              });
            }
          }
        }
      }
    }

    // Sort: overdue first, then upcoming
    alerts.sort((a, b) => {
      if (a.alertType === "OVERDUE" && b.alertType !== "OVERDUE") return -1;
      if (a.alertType !== "OVERDUE" && b.alertType === "OVERDUE") return 1;
      return 0;
    });

    res.json(alerts);
  } catch (err) {
    next(err);
  }
}

// ── Maintenance Schedule CRUD ──────────────────────────────────────────────

export async function addMaintenanceSchedule(req: Request, res: Response, next: NextFunction) {
  try {
    const equipmentId = req.params.id;
    const {
      taskName, intervalType, intervalValue, lastPerformed,
      lastHours, lastMileage, priority, estimatedCost, notes,
    } = req.body;

    if (!taskName || !intervalType || intervalValue === undefined) {
      return next(createError("taskName, intervalType, and intervalValue are required", 400));
    }

    const equipment = await prisma.equipment.findUnique({ where: { id: equipmentId } });
    if (!equipment) return next(createError("Equipment not found", 404));

    // Calculate initial nextDue values
    const effectiveLastPerformed = lastPerformed ? new Date(lastPerformed) : new Date();
    const effectiveLastHours = lastHours ?? equipment.currentHours;
    const effectiveLastMileage = lastMileage ?? equipment.currentMileage;

    const nextDueData = calculateNextDue(
      intervalType,
      intervalValue,
      effectiveLastPerformed,
      effectiveLastHours,
      effectiveLastMileage,
    );

    const schedule = await prisma.maintenanceSchedule.create({
      data: {
        equipmentId,
        taskName,
        intervalType,
        intervalValue,
        lastPerformed: lastPerformed ? new Date(lastPerformed) : undefined,
        lastHours,
        lastMileage,
        ...nextDueData,
        priority: priority ?? "NORMAL",
        estimatedCost,
        notes,
      },
      include: { equipment: true },
    });

    res.status(201).json(schedule);
  } catch (err) {
    next(err);
  }
}

export async function updateMaintenanceSchedule(req: Request, res: Response, next: NextFunction) {
  try {
    const {
      taskName, intervalType, intervalValue, lastPerformed,
      lastHours, lastMileage, nextDue, nextDueHours, nextDueMileage,
      priority, estimatedCost, notes, isActive,
    } = req.body;

    const existing = await prisma.maintenanceSchedule.findUnique({
      where: { id: req.params.id },
      include: { equipment: true },
    });
    if (!existing) return next(createError("Maintenance schedule not found", 404));

    // Recalculate nextDue if interval changed
    let computedNextDue: Record<string, any> = {};
    if (
      (intervalType !== undefined || intervalValue !== undefined) &&
      nextDue === undefined &&
      nextDueHours === undefined &&
      nextDueMileage === undefined
    ) {
      const effIntervalType = intervalType ?? existing.intervalType;
      const effIntervalValue = intervalValue ?? existing.intervalValue;
      const effLastPerformed = lastPerformed
        ? new Date(lastPerformed)
        : existing.lastPerformed ?? new Date();
      const effLastHours = lastHours ?? existing.lastHours ?? existing.equipment.currentHours;
      const effLastMileage = lastMileage ?? existing.lastMileage ?? existing.equipment.currentMileage;

      computedNextDue = calculateNextDue(
        effIntervalType,
        effIntervalValue,
        effLastPerformed,
        effLastHours,
        effLastMileage,
      );
    }

    const schedule = await prisma.maintenanceSchedule.update({
      where: { id: req.params.id },
      data: {
        ...(taskName !== undefined && { taskName }),
        ...(intervalType !== undefined && { intervalType }),
        ...(intervalValue !== undefined && { intervalValue }),
        ...(lastPerformed !== undefined && { lastPerformed: new Date(lastPerformed) }),
        ...(lastHours !== undefined && { lastHours }),
        ...(lastMileage !== undefined && { lastMileage }),
        ...(nextDue !== undefined && { nextDue: new Date(nextDue) }),
        ...(nextDueHours !== undefined && { nextDueHours }),
        ...(nextDueMileage !== undefined && { nextDueMileage }),
        ...computedNextDue,
        ...(priority !== undefined && { priority }),
        ...(estimatedCost !== undefined && { estimatedCost }),
        ...(notes !== undefined && { notes }),
        ...(isActive !== undefined && { isActive }),
      },
      include: { equipment: true },
    });

    res.json(schedule);
  } catch (err) {
    next(err);
  }
}

export async function deleteMaintenanceSchedule(req: Request, res: Response, next: NextFunction) {
  try {
    await prisma.maintenanceSchedule.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function calculateNextDue(
  intervalType: string,
  intervalValue: number,
  lastPerformed: Date,
  lastHours: number,
  lastMileage: number,
): { nextDue?: Date; nextDueHours?: number; nextDueMileage?: number } {
  switch (intervalType) {
    case "HOURS":
      return { nextDueHours: lastHours + intervalValue };
    case "MILES":
      return { nextDueMileage: lastMileage + intervalValue };
    case "DAYS":
      return {
        nextDue: new Date(lastPerformed.getTime() + intervalValue * 86400000),
      };
    case "MONTHS": {
      const next = new Date(lastPerformed);
      next.setMonth(next.getMonth() + intervalValue);
      return { nextDue: next };
    }
    default:
      return {};
  }
}

async function recalculateSchedules(
  equipmentId: string,
  currentHours: number,
  currentMileage: number,
) {
  // For HOURS/MILES-based schedules that don't have a nextDue set yet,
  // recalculate based on last performed values
  const schedules = await prisma.maintenanceSchedule.findMany({
    where: { equipmentId, isActive: true },
  });

  for (const schedule of schedules) {
    // Only recalculate if lastPerformed exists (otherwise the schedule hasn't been initialized yet)
    if (!schedule.lastPerformed && !schedule.lastHours && !schedule.lastMileage) continue;

    const nextDueData = calculateNextDue(
      schedule.intervalType,
      schedule.intervalValue,
      schedule.lastPerformed ?? new Date(),
      schedule.lastHours ?? 0,
      schedule.lastMileage ?? 0,
    );

    await prisma.maintenanceSchedule.update({
      where: { id: schedule.id },
      data: nextDueData,
    });
  }
}

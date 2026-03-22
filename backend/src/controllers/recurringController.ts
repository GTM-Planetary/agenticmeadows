import { Request, Response, NextFunction } from "express";
import { Season } from "@prisma/client";
import { prisma } from "../index";
import { createError } from "../middleware/errorHandler";

export async function listTemplates(req: Request, res: Response, next: NextFunction) {
  try {
    const { clientId, contractId, active } = req.query;
    const templates = await prisma.recurringJobTemplate.findMany({
      where: {
        ...(clientId ? { clientId: String(clientId) } : {}),
        ...(contractId ? { contractId: String(contractId) } : {}),
        ...(active !== undefined ? { isActive: active === "true" } : {}),
      },
      include: {
        client: { select: { id: true, firstName: true, lastName: true } },
        property: { select: { id: true, streetAddress: true, city: true } },
        service: { select: { id: true, name: true, category: true, basePrice: true } },
        contract: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(templates);
  } catch (err) {
    next(err);
  }
}

export async function getTemplate(req: Request, res: Response, next: NextFunction) {
  try {
    const template = await prisma.recurringJobTemplate.findUnique({
      where: { id: req.params.id },
      include: {
        client: { select: { id: true, firstName: true, lastName: true } },
        property: true,
        service: true,
        contract: true,
        generatedJobs: { orderBy: { scheduledStart: "desc" }, take: 10 },
      },
    });
    if (!template) return next(createError("Template not found", 404));
    res.json(template);
  } catch (err) {
    next(err);
  }
}

export async function createTemplate(req: Request, res: Response, next: NextFunction) {
  try {
    const {
      clientId, propertyId, serviceId, contractId, title, description,
      frequency, season, preferredDayOfWeek, preferredTimeSlot,
      assignedUserId, checklistTemplate,
    } = req.body;

    if (!clientId || !title || !frequency) {
      return next(createError("clientId, title, and frequency are required", 400));
    }

    const template = await prisma.recurringJobTemplate.create({
      data: {
        clientId, propertyId, serviceId, contractId, title, description,
        frequency, season: season ?? "ALL_YEAR",
        preferredDayOfWeek, preferredTimeSlot,
        assignedUserId, checklistTemplate,
      },
      include: {
        client: { select: { id: true, firstName: true, lastName: true } },
        property: { select: { id: true, streetAddress: true, city: true } },
        service: { select: { id: true, name: true, category: true } },
      },
    });

    res.status(201).json(template);
  } catch (err) {
    next(err);
  }
}

export async function updateTemplate(req: Request, res: Response, next: NextFunction) {
  try {
    const {
      title, description, frequency, season, preferredDayOfWeek,
      preferredTimeSlot, isActive, assignedUserId, checklistTemplate,
      serviceId, propertyId,
    } = req.body;

    const template = await prisma.recurringJobTemplate.update({
      where: { id: req.params.id },
      data: {
        ...(title !== undefined ? { title } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(frequency !== undefined ? { frequency } : {}),
        ...(season !== undefined ? { season } : {}),
        ...(preferredDayOfWeek !== undefined ? { preferredDayOfWeek } : {}),
        ...(preferredTimeSlot !== undefined ? { preferredTimeSlot } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
        ...(assignedUserId !== undefined ? { assignedUserId } : {}),
        ...(checklistTemplate !== undefined ? { checklistTemplate } : {}),
        ...(serviceId !== undefined ? { serviceId } : {}),
        ...(propertyId !== undefined ? { propertyId } : {}),
      },
      include: {
        client: { select: { id: true, firstName: true, lastName: true } },
        property: { select: { id: true, streetAddress: true, city: true } },
        service: { select: { id: true, name: true, category: true } },
      },
    });
    res.json(template);
  } catch (err) {
    next(err);
  }
}

export async function deleteTemplate(req: Request, res: Response, next: NextFunction) {
  try {
    await prisma.recurringJobTemplate.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

// Calculate next occurrence dates based on frequency
function getNextDates(
  frequency: string,
  startDate: Date,
  count: number,
  preferredDayOfWeek?: number | null
): Date[] {
  const dates: Date[] = [];
  const current = new Date(startDate);

  // Align to preferred day of week if specified
  if (preferredDayOfWeek !== undefined && preferredDayOfWeek !== null) {
    while (current.getDay() !== preferredDayOfWeek) {
      current.setDate(current.getDate() + 1);
    }
  }

  const freqDays: Record<string, number> = {
    WEEKLY: 7,
    BIWEEKLY: 14,
    MONTHLY: 30,
    QUARTERLY: 91,
    SEASONAL: 91,
    ANNUAL: 365,
  };

  const interval = freqDays[frequency] ?? 7;

  for (let i = 0; i < count; i++) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + interval);
  }

  return dates;
}

// Check if a date falls within the active season
function isInSeason(date: Date, season: string): boolean {
  if (season === "ALL_YEAR") return true;
  const month = date.getMonth(); // 0-11
  const seasonMonths: Record<string, number[]> = {
    SPRING: [2, 3, 4],     // Mar, Apr, May
    SUMMER: [5, 6, 7],     // Jun, Jul, Aug
    FALL: [8, 9, 10],      // Sep, Oct, Nov
    WINTER: [11, 0, 1],    // Dec, Jan, Feb
  };
  return seasonMonths[season]?.includes(month) ?? true;
}

export async function generateJobs(req: Request, res: Response, next: NextFunction) {
  try {
    const templateId = req.params.id;
    const { count = 4, startDate } = req.body;

    const template = await prisma.recurringJobTemplate.findUnique({
      where: { id: templateId },
      include: { service: true },
    });
    if (!template) return next(createError("Template not found", 404));
    if (!template.isActive) return next(createError("Template is inactive", 400));

    const genStart = startDate ? new Date(startDate) : new Date();
    const dates = getNextDates(
      template.frequency,
      genStart,
      parseInt(String(count), 10),
      template.preferredDayOfWeek
    );

    // Filter dates by season
    const seasonDates = dates.filter((d) => isInSeason(d, template.season));

    const jobs = await prisma.$transaction(async (tx) => {
      const created: any[] = [];
      for (const date of seasonDates) {
        // Set time based on preferred slot
        const hour = template.preferredTimeSlot === "AFTERNOON" ? 13 : 8;
        date.setHours(hour, 0, 0, 0);

        const endDate = new Date(date);
        endDate.setHours(date.getHours() + 2); // Default 2 hour duration

        const job = await tx.job.create({
          data: {
            clientId: template.clientId,
            propertyId: template.propertyId,
            assignedUserId: template.assignedUserId,
            recurringTemplateId: template.id,
            title: template.title,
            description: template.description,
            status: "SCHEDULED",
            scheduledStart: date,
            scheduledEnd: endDate,
            isRecurring: true,
            checklistItems: template.checklistTemplate ?? undefined,
          },
          include: {
            client: { select: { id: true, firstName: true, lastName: true } },
            property: { select: { id: true, streetAddress: true, city: true } },
          },
        });
        created.push(job);
      }

      // Update template tracking
      await tx.recurringJobTemplate.update({
        where: { id: templateId },
        data: {
          lastGeneratedAt: new Date(),
          nextGenerateAfter: seasonDates.length > 0
            ? new Date(seasonDates[seasonDates.length - 1].getTime() - 3 * 24 * 60 * 60 * 1000) // 3 days before last generated date
            : undefined,
        },
      });

      return created;
    });

    res.status(201).json(jobs);
  } catch (err) {
    next(err);
  }
}

export async function generateBatch(req: Request, res: Response, next: NextFunction) {
  try {
    const { season } = req.body;
    const now = new Date();

    // Find all active templates that are due for generation
    const templates = await prisma.recurringJobTemplate.findMany({
      where: {
        isActive: true,
        OR: [
          { nextGenerateAfter: null },
          { nextGenerateAfter: { lte: now } },
        ],
        ...(season ? { season: season as Season } : {}),
      },
      include: { service: true },
    });

    let totalGenerated = 0;
    const allJobs: any[] = [];

    for (const template of templates) {
      const dates = getNextDates(template.frequency, now, 4, template.preferredDayOfWeek);
      const seasonDates = dates.filter((d) => isInSeason(d, template.season));

      for (const date of seasonDates) {
        const hour = template.preferredTimeSlot === "AFTERNOON" ? 13 : 8;
        date.setHours(hour, 0, 0, 0);
        const endDate = new Date(date);
        endDate.setHours(date.getHours() + 2);

        const job = await prisma.job.create({
          data: {
            clientId: template.clientId,
            propertyId: template.propertyId,
            assignedUserId: template.assignedUserId,
            recurringTemplateId: template.id,
            title: template.title,
            description: template.description,
            status: "SCHEDULED",
            scheduledStart: date,
            scheduledEnd: endDate,
            isRecurring: true,
            checklistItems: template.checklistTemplate ?? undefined,
          },
        });
        allJobs.push(job);
        totalGenerated++;
      }

      await prisma.recurringJobTemplate.update({
        where: { id: template.id },
        data: {
          lastGeneratedAt: now,
          nextGenerateAfter: seasonDates.length > 0
            ? new Date(seasonDates[seasonDates.length - 1].getTime() - 3 * 24 * 60 * 60 * 1000)
            : new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        },
      });
    }

    res.json({
      generated: totalGenerated,
      templates: templates.length,
      jobs: allJobs,
    });
  } catch (err) {
    next(err);
  }
}

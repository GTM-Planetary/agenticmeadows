import { Request, Response, NextFunction } from "express";
import { prisma } from "../index";
import { createError } from "../middleware/errorHandler";

export async function listContracts(req: Request, res: Response, next: NextFunction) {
  try {
    const { clientId, active } = req.query;
    const contracts = await prisma.seasonalContract.findMany({
      where: {
        ...(clientId ? { clientId: String(clientId) } : {}),
        ...(active !== undefined ? { isActive: active === "true" } : {}),
      },
      include: {
        client: { select: { id: true, firstName: true, lastName: true } },
        property: { select: { id: true, streetAddress: true, city: true } },
        templates: { include: { service: { select: { id: true, name: true, category: true } } } },
      },
      orderBy: { startDate: "desc" },
    });
    res.json(contracts);
  } catch (err) {
    next(err);
  }
}

export async function getContract(req: Request, res: Response, next: NextFunction) {
  try {
    const contract = await prisma.seasonalContract.findUnique({
      where: { id: req.params.id },
      include: {
        client: { select: { id: true, firstName: true, lastName: true } },
        property: true,
        templates: {
          include: {
            service: { select: { id: true, name: true, category: true, basePrice: true } },
          },
        },
      },
    });
    if (!contract) return next(createError("Contract not found", 404));
    res.json(contract);
  } catch (err) {
    next(err);
  }
}

export async function createContract(req: Request, res: Response, next: NextFunction) {
  try {
    const { clientId, propertyId, title, startDate, endDate, totalValue, notes, templates } = req.body;
    if (!clientId || !title || !startDate || !endDate) {
      return next(createError("clientId, title, startDate, and endDate are required", 400));
    }

    const result = await prisma.$transaction(async (tx) => {
      const contract = await tx.seasonalContract.create({
        data: { clientId, propertyId, title, startDate: new Date(startDate), endDate: new Date(endDate), totalValue, notes },
      });

      if (Array.isArray(templates) && templates.length > 0) {
        for (const t of templates) {
          await tx.recurringJobTemplate.create({
            data: {
              clientId,
              propertyId: t.propertyId ?? propertyId,
              serviceId: t.serviceId,
              contractId: contract.id,
              title: t.title,
              description: t.description,
              frequency: t.frequency,
              season: t.season ?? "ALL_YEAR",
              preferredDayOfWeek: t.preferredDayOfWeek,
              preferredTimeSlot: t.preferredTimeSlot,
              assignedUserId: t.assignedUserId,
              checklistTemplate: t.checklistTemplate,
            },
          });
        }
      }

      return tx.seasonalContract.findUnique({
        where: { id: contract.id },
        include: {
          client: { select: { id: true, firstName: true, lastName: true } },
          property: true,
          templates: { include: { service: { select: { id: true, name: true, category: true } } } },
        },
      });
    });

    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function updateContract(req: Request, res: Response, next: NextFunction) {
  try {
    const { title, startDate, endDate, totalValue, notes, isActive } = req.body;
    const contract = await prisma.seasonalContract.update({
      where: { id: req.params.id },
      data: {
        ...(title !== undefined ? { title } : {}),
        ...(startDate !== undefined ? { startDate: new Date(startDate) } : {}),
        ...(endDate !== undefined ? { endDate: new Date(endDate) } : {}),
        ...(totalValue !== undefined ? { totalValue } : {}),
        ...(notes !== undefined ? { notes } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
      },
      include: {
        client: { select: { id: true, firstName: true, lastName: true } },
        property: true,
        templates: true,
      },
    });
    res.json(contract);
  } catch (err) {
    next(err);
  }
}

export async function deleteContract(req: Request, res: Response, next: NextFunction) {
  try {
    await prisma.seasonalContract.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

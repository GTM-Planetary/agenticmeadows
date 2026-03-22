import { Request, Response, NextFunction } from "express";
import { prisma } from "../index";
import { createError } from "../middleware/errorHandler";
import { ServiceCategory } from "@prisma/client";

export async function listServices(req: Request, res: Response, next: NextFunction) {
  try {
    const { category, active } = req.query;
    const services = await prisma.serviceCatalog.findMany({
      where: {
        ...(category ? { category: category as ServiceCategory } : {}),
        ...(active !== undefined ? { isActive: active === "true" } : {}),
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
    res.json(services);
  } catch (err) {
    next(err);
  }
}

export async function getService(req: Request, res: Response, next: NextFunction) {
  try {
    const service = await prisma.serviceCatalog.findUnique({
      where: { id: req.params.id },
    });
    if (!service) return next(createError("Service not found", 404));
    res.json(service);
  } catch (err) {
    next(err);
  }
}

export async function createService(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, category, basePrice, description, pricingUnit, seasonalPrices, sortOrder } = req.body;
    if (!name || !category || basePrice === undefined) {
      return next(createError("name, category, and basePrice are required", 400));
    }
    const service = await prisma.serviceCatalog.create({
      data: {
        name,
        category,
        basePrice,
        description,
        pricingUnit,
        seasonalPrices,
        sortOrder,
      },
    });
    res.status(201).json(service);
  } catch (err) {
    next(err);
  }
}

export async function updateService(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, description, category, pricingUnit, basePrice, seasonalPrices, isActive, sortOrder } = req.body;
    const service = await prisma.serviceCatalog.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(category !== undefined && { category }),
        ...(pricingUnit !== undefined && { pricingUnit }),
        ...(basePrice !== undefined && { basePrice }),
        ...(seasonalPrices !== undefined && { seasonalPrices }),
        ...(isActive !== undefined && { isActive }),
        ...(sortOrder !== undefined && { sortOrder }),
      },
    });
    res.json(service);
  } catch (err) {
    next(err);
  }
}

export async function deleteService(req: Request, res: Response, next: NextFunction) {
  try {
    const service = await prisma.serviceCatalog.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });
    res.json(service);
  } catch (err) {
    next(err);
  }
}

import { Request, Response, NextFunction } from "express";
import { prisma } from "../index";
import { createError } from "../middleware/errorHandler";

export async function listClients(req: Request, res: Response, next: NextFunction) {
  try {
    const { search } = req.query;
    // Split search into words so "John Demo" matches firstName="John" + lastName="Demo"
    const searchWords = search ? String(search).trim().split(/\s+/) : [];
    const searchFilter = searchWords.length > 0
      ? {
          AND: searchWords.map((word) => ({
            OR: [
              { firstName: { contains: word, mode: "insensitive" as const } },
              { lastName: { contains: word, mode: "insensitive" as const } },
              { email: { contains: word, mode: "insensitive" as const } },
              { company: { contains: word, mode: "insensitive" as const } },
            ],
          })),
        }
      : undefined;
    const clients = await prisma.client.findMany({
      where: searchFilter,
      include: { properties: true },
      orderBy: { lastName: "asc" },
    });
    res.json(clients);
  } catch (err) {
    next(err);
  }
}

export async function getClient(req: Request, res: Response, next: NextFunction) {
  try {
    const client = await prisma.client.findUnique({
      where: { id: req.params.id },
      include: { properties: true, jobs: { orderBy: { createdAt: "desc" }, take: 10 } },
    });
    if (!client) return next(createError("Client not found", 404));
    res.json(client);
  } catch (err) {
    next(err);
  }
}

export async function createClient(req: Request, res: Response, next: NextFunction) {
  try {
    const { firstName, lastName, email, phone, company, notes, properties } = req.body;
    if (!firstName || !lastName) {
      return next(createError("firstName and lastName are required", 400));
    }

    const client = await prisma.$transaction(async (tx) => {
      const c = await tx.client.create({
        data: { firstName, lastName, email, phone, company, notes },
      });
      if (Array.isArray(properties) && properties.length > 0) {
        await tx.property.createMany({
          data: properties.map((p: any) => ({ ...p, clientId: c.id })),
        });
      }
      return tx.client.findUnique({ where: { id: c.id }, include: { properties: true } });
    });

    res.status(201).json(client);
  } catch (err) {
    next(err);
  }
}

export async function updateClient(req: Request, res: Response, next: NextFunction) {
  try {
    const { firstName, lastName, email, phone, company, notes } = req.body;
    const client = await prisma.client.update({
      where: { id: req.params.id },
      data: { firstName, lastName, email, phone, company, notes },
      include: { properties: true },
    });
    res.json(client);
  } catch (err) {
    next(err);
  }
}

export async function deleteClient(req: Request, res: Response, next: NextFunction) {
  try {
    await prisma.client.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function listClientProperties(req: Request, res: Response, next: NextFunction) {
  try {
    const props = await prisma.property.findMany({
      where: { clientId: req.params.id },
    });
    res.json(props);
  } catch (err) {
    next(err);
  }
}

export async function createClientProperty(req: Request, res: Response, next: NextFunction) {
  try {
    const { streetAddress, city, state, zip, notes } = req.body;
    if (!streetAddress || !city || !state || !zip) {
      return next(createError("streetAddress, city, state, zip are required", 400));
    }
    const prop = await prisma.property.create({
      data: { clientId: req.params.id, streetAddress, city, state, zip, notes },
    });
    res.status(201).json(prop);
  } catch (err) {
    next(err);
  }
}

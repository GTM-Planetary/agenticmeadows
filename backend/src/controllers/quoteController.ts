import { Request, Response, NextFunction } from "express";
import { prisma } from "../index";
import { createError } from "../middleware/errorHandler";

export async function listQuotes(req: Request, res: Response, next: NextFunction) {
  try {
    const { clientId, status } = req.query;
    const quotes = await prisma.quote.findMany({
      where: {
        ...(clientId ? { clientId: String(clientId) } : {}),
        ...(status ? { status: String(status) as any } : {}),
      },
      include: { client: true, property: true, lineItems: true },
      orderBy: { createdAt: "desc" },
    });
    res.json(quotes);
  } catch (err) {
    next(err);
  }
}

export async function getQuote(req: Request, res: Response, next: NextFunction) {
  try {
    const quote = await prisma.quote.findUnique({
      where: { id: req.params.id },
      include: { client: true, property: true, lineItems: true },
    });
    if (!quote) return next(createError("Quote not found", 404));
    res.json(quote);
  } catch (err) {
    next(err);
  }
}

export async function createQuote(req: Request, res: Response, next: NextFunction) {
  try {
    const { clientId, propertyId, title, status, validUntil, notes, lineItems } = req.body;
    if (!clientId || !title) {
      return next(createError("clientId and title are required", 400));
    }

    const quote = await prisma.$transaction(async (tx) => {
      const q = await tx.quote.create({
        data: {
          clientId, propertyId, title,
          status: status ?? "DRAFT",
          validUntil: validUntil ? new Date(validUntil) : undefined,
          notes,
        },
      });
      if (Array.isArray(lineItems) && lineItems.length > 0) {
        await tx.lineItem.createMany({
          data: lineItems.map((item: any) => ({
            quoteId: q.id,
            description: item.description,
            quantity: item.quantity ?? 1,
            unitPrice: item.unitPrice,
          })),
        });
      }
      return tx.quote.findUnique({ where: { id: q.id }, include: { lineItems: true, client: true } });
    });

    res.status(201).json(quote);
  } catch (err) {
    next(err);
  }
}

export async function updateQuote(req: Request, res: Response, next: NextFunction) {
  try {
    const { title, status, validUntil, notes, lineItems } = req.body;

    const quote = await prisma.$transaction(async (tx) => {
      const q = await tx.quote.update({
        where: { id: req.params.id },
        data: {
          ...(title !== undefined && { title }),
          ...(status !== undefined && { status }),
          ...(validUntil !== undefined && { validUntil: new Date(validUntil) }),
          ...(notes !== undefined && { notes }),
        },
      });

      // Replace line items if provided
      if (Array.isArray(lineItems)) {
        await tx.lineItem.deleteMany({ where: { quoteId: q.id } });
        if (lineItems.length > 0) {
          await tx.lineItem.createMany({
            data: lineItems.map((item: any) => ({
              quoteId: q.id,
              description: item.description,
              quantity: item.quantity ?? 1,
              unitPrice: item.unitPrice,
            })),
          });
        }
      }
      return tx.quote.findUnique({ where: { id: q.id }, include: { lineItems: true, client: true } });
    });

    res.json(quote);
  } catch (err) {
    next(err);
  }
}

export async function deleteQuote(req: Request, res: Response, next: NextFunction) {
  try {
    await prisma.quote.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function addQuoteLineItem(req: Request, res: Response, next: NextFunction) {
  try {
    const { description, quantity, unitPrice } = req.body;
    if (!description || unitPrice === undefined) {
      return next(createError("description and unitPrice are required", 400));
    }

    const quote = await prisma.quote.findUnique({ where: { id: req.params.id } });
    if (!quote) return next(createError("Quote not found", 404));

    const lineItem = await prisma.lineItem.create({
      data: {
        quoteId: req.params.id,
        description,
        quantity: quantity ?? 1,
        unitPrice,
      },
    });

    // Return the updated quote with all line items
    const updated = await prisma.quote.findUnique({
      where: { id: req.params.id },
      include: { lineItems: true, client: true },
    });

    res.status(201).json(updated);
  } catch (err) {
    next(err);
  }
}

export async function deleteQuoteLineItem(req: Request, res: Response, next: NextFunction) {
  try {
    const { id, itemId } = req.params;

    // Verify the line item belongs to this quote
    const lineItem = await prisma.lineItem.findFirst({
      where: { id: itemId, quoteId: id },
    });
    if (!lineItem) return next(createError("Line item not found on this quote", 404));

    await prisma.lineItem.delete({ where: { id: itemId } });

    // Return the updated quote with remaining line items
    const updated = await prisma.quote.findUnique({
      where: { id },
      include: { lineItems: true, client: true },
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
}

export async function convertToInvoice(req: Request, res: Response, next: NextFunction) {
  try {
    const quote = await prisma.quote.findUnique({
      where: { id: req.params.id },
      include: { lineItems: true },
    });
    if (!quote) return next(createError("Quote not found", 404));
    if (quote.status === "INVOICED") {
      return next(createError("Quote has already been converted to an invoice", 409));
    }

    const invoice = await prisma.$transaction(async (tx) => {
      // Create the invoice
      const inv = await tx.invoice.create({
        data: {
          clientId: quote.clientId,
          quoteId: quote.id,
          propertyId: quote.propertyId,
          status: "DRAFT",
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        },
      });

      // Clone line items from quote
      if (quote.lineItems.length > 0) {
        await tx.lineItem.createMany({
          data: quote.lineItems.map((item) => ({
            invoiceId: inv.id,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          })),
        });
      }

      // Mark quote as invoiced
      await tx.quote.update({
        where: { id: quote.id },
        data: { status: "INVOICED" },
      });

      return tx.invoice.findUnique({
        where: { id: inv.id },
        include: { lineItems: true, client: true, quote: true },
      });
    });

    res.status(201).json(invoice);
  } catch (err) {
    next(err);
  }
}

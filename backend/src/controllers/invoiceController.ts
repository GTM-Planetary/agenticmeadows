import { Request, Response, NextFunction } from "express";
import { prisma } from "../index";
import { createError } from "../middleware/errorHandler";

export async function listInvoices(req: Request, res: Response, next: NextFunction) {
  try {
    const { clientId, status } = req.query;
    const invoices = await prisma.invoice.findMany({
      where: {
        ...(clientId ? { clientId: String(clientId) } : {}),
        ...(status ? { status: String(status) as any } : {}),
      },
      include: { client: true, lineItems: true, job: { select: { id: true, title: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json(invoices);
  } catch (err) {
    next(err);
  }
}

export async function getInvoice(req: Request, res: Response, next: NextFunction) {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.id },
      include: { client: true, property: true, lineItems: true, job: true, quote: true },
    });
    if (!invoice) return next(createError("Invoice not found", 404));
    res.json(invoice);
  } catch (err) {
    next(err);
  }
}

export async function createInvoice(req: Request, res: Response, next: NextFunction) {
  try {
    const { clientId, jobId, quoteId, propertyId, status, dueDate, lineItems } = req.body;
    if (!clientId) return next(createError("clientId is required", 400));

    const invoice = await prisma.$transaction(async (tx) => {
      const inv = await tx.invoice.create({
        data: {
          clientId, jobId, quoteId, propertyId,
          status: status ?? "DRAFT",
          dueDate: dueDate ? new Date(dueDate) : undefined,
        },
      });
      if (Array.isArray(lineItems) && lineItems.length > 0) {
        await tx.lineItem.createMany({
          data: lineItems.map((item: any) => ({
            invoiceId: inv.id,
            description: item.description,
            quantity: item.quantity ?? 1,
            unitPrice: item.unitPrice,
          })),
        });
      }
      return tx.invoice.findUnique({
        where: { id: inv.id },
        include: { lineItems: true, client: true },
      });
    });

    res.status(201).json(invoice);
  } catch (err) {
    next(err);
  }
}

export async function updateInvoice(req: Request, res: Response, next: NextFunction) {
  try {
    const { status, dueDate, lineItems } = req.body;

    const invoice = await prisma.$transaction(async (tx) => {
      const inv = await tx.invoice.update({
        where: { id: req.params.id },
        data: {
          ...(status !== undefined && { status }),
          ...(dueDate !== undefined && { dueDate: new Date(dueDate) }),
        },
      });
      if (Array.isArray(lineItems)) {
        await tx.lineItem.deleteMany({ where: { invoiceId: inv.id } });
        if (lineItems.length > 0) {
          await tx.lineItem.createMany({
            data: lineItems.map((item: any) => ({
              invoiceId: inv.id,
              description: item.description,
              quantity: item.quantity ?? 1,
              unitPrice: item.unitPrice,
            })),
          });
        }
      }
      return tx.invoice.findUnique({
        where: { id: inv.id },
        include: { lineItems: true, client: true },
      });
    });

    res.json(invoice);
  } catch (err) {
    next(err);
  }
}

export async function deleteInvoice(req: Request, res: Response, next: NextFunction) {
  try {
    await prisma.invoice.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function addInvoiceLineItem(req: Request, res: Response, next: NextFunction) {
  try {
    const { description, quantity, unitPrice } = req.body;
    if (!description || unitPrice === undefined) {
      return next(createError("description and unitPrice are required", 400));
    }

    const invoice = await prisma.invoice.findUnique({ where: { id: req.params.id } });
    if (!invoice) return next(createError("Invoice not found", 404));

    const lineItem = await prisma.lineItem.create({
      data: {
        invoiceId: req.params.id,
        description,
        quantity: quantity ?? 1,
        unitPrice,
      },
    });

    // Return the updated invoice with all line items
    const updated = await prisma.invoice.findUnique({
      where: { id: req.params.id },
      include: { lineItems: true, client: true },
    });

    res.status(201).json(updated);
  } catch (err) {
    next(err);
  }
}

export async function deleteInvoiceLineItem(req: Request, res: Response, next: NextFunction) {
  try {
    const { id, itemId } = req.params;

    // Verify the line item belongs to this invoice
    const lineItem = await prisma.lineItem.findFirst({
      where: { id: itemId, invoiceId: id },
    });
    if (!lineItem) return next(createError("Line item not found on this invoice", 404));

    await prisma.lineItem.delete({ where: { id: itemId } });

    // Return the updated invoice with remaining line items
    const updated = await prisma.invoice.findUnique({
      where: { id },
      include: { lineItems: true, client: true },
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
}

export async function markPaid(req: Request, res: Response, next: NextFunction) {
  try {
    const invoice = await prisma.invoice.update({
      where: { id: req.params.id },
      data: { status: "PAID", paidAt: new Date() },
      include: { lineItems: true, client: true },
    });
    res.json(invoice);
  } catch (err) {
    next(err);
  }
}

import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../index";
import { requireAuth } from "../middleware/auth";
import { createError } from "../middleware/errorHandler";

const router = Router();
router.use(requireAuth);

// ── Sections ─────────────────────────────────────────────────────────────

// List sections for an entity (with fields)
router.get("/sections", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { entity } = req.query;
    const sections = await prisma.customFieldSection.findMany({
      where: entity ? { entity: String(entity) as any } : undefined,
      include: { fields: { where: { isActive: true }, orderBy: { sortOrder: "asc" } } },
      orderBy: { sortOrder: "asc" },
    });
    res.json(sections);
  } catch (err) {
    next(err);
  }
});

// Create section
router.post("/sections", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { entity, name, sortOrder } = req.body;
    if (!entity || !name) return next(createError("entity and name are required", 400));

    const section = await prisma.customFieldSection.create({
      data: { entity, name, sortOrder: sortOrder ?? 0 },
      include: { fields: true },
    });
    res.status(201).json(section);
  } catch (err) {
    next(err);
  }
});

// Update section
router.put("/sections/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, sortOrder, isCollapsed } = req.body;
    const section = await prisma.customFieldSection.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(sortOrder !== undefined ? { sortOrder } : {}),
        ...(isCollapsed !== undefined ? { isCollapsed } : {}),
      },
      include: { fields: { orderBy: { sortOrder: "asc" } } },
    });
    res.json(section);
  } catch (err) {
    next(err);
  }
});

// Delete section (and its fields)
router.delete("/sections/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.customFieldSection.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ── Field Definitions ────────────────────────────────────────────────────

// List field definitions for an entity
router.get("/definitions", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { entity } = req.query;
    const fields = await prisma.customFieldDefinition.findMany({
      where: {
        ...(entity ? { entity: String(entity) as any } : {}),
        isActive: true,
      },
      include: { section: { select: { id: true, name: true } } },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
    res.json(fields);
  } catch (err) {
    next(err);
  }
});

// Create field definition
router.post("/definitions", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      entity, sectionId, name, fieldKey, fieldType,
      isRequired, placeholder, options, defaultValue, sortOrder,
    } = req.body;

    if (!entity || !name || !fieldKey) {
      return next(createError("entity, name, and fieldKey are required", 400));
    }

    const field = await prisma.customFieldDefinition.create({
      data: {
        entity, sectionId, name, fieldKey,
        fieldType: fieldType ?? "TEXT",
        isRequired: isRequired ?? false,
        placeholder, options, defaultValue,
        sortOrder: sortOrder ?? 0,
      },
      include: { section: { select: { id: true, name: true } } },
    });
    res.status(201).json(field);
  } catch (err) {
    next(err);
  }
});

// Update field definition
router.put("/definitions/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      name, fieldType, sectionId, isRequired,
      placeholder, options, defaultValue, sortOrder, isActive,
    } = req.body;

    const field = await prisma.customFieldDefinition.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(fieldType !== undefined ? { fieldType } : {}),
        ...(sectionId !== undefined ? { sectionId } : {}),
        ...(isRequired !== undefined ? { isRequired } : {}),
        ...(placeholder !== undefined ? { placeholder } : {}),
        ...(options !== undefined ? { options } : {}),
        ...(defaultValue !== undefined ? { defaultValue } : {}),
        ...(sortOrder !== undefined ? { sortOrder } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
      },
      include: { section: { select: { id: true, name: true } } },
    });
    res.json(field);
  } catch (err) {
    next(err);
  }
});

// Delete field definition
router.delete("/definitions/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.customFieldDefinition.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ── Field Values ─────────────────────────────────────────────────────────

// Get custom field values for a specific entity record
router.get("/values", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { clientId, jobId, quoteId, invoiceId, propertyId } = req.query;

    const where: any = {};
    if (clientId) where.clientId = String(clientId);
    if (jobId) where.jobId = String(jobId);
    if (quoteId) where.quoteId = String(quoteId);
    if (invoiceId) where.invoiceId = String(invoiceId);
    if (propertyId) where.propertyId = String(propertyId);

    const values = await prisma.customFieldValue.findMany({
      where,
      include: { field: { select: { id: true, name: true, fieldKey: true, fieldType: true } } },
    });

    // Return as a key-value map for easy consumption
    const map: Record<string, string | null> = {};
    for (const v of values) {
      map[v.field.fieldKey] = v.value;
    }

    res.json({ values, map });
  } catch (err) {
    next(err);
  }
});

// Set custom field values for a specific entity record (bulk upsert)
router.post("/values", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { clientId, jobId, quoteId, invoiceId, propertyId, values } = req.body;

    if (!values || typeof values !== "object") {
      return next(createError("values object is required (fieldKey → value)", 400));
    }

    // Resolve field definitions
    const fieldKeys = Object.keys(values);
    const fields = await prisma.customFieldDefinition.findMany({
      where: { fieldKey: { in: fieldKeys }, isActive: true },
    });

    const results = [];
    for (const field of fields) {
      const value = values[field.fieldKey];

      // Upsert the value
      const existing = await prisma.customFieldValue.findFirst({
        where: {
          fieldId: field.id,
          ...(clientId ? { clientId } : {}),
          ...(jobId ? { jobId } : {}),
          ...(quoteId ? { quoteId } : {}),
          ...(invoiceId ? { invoiceId } : {}),
          ...(propertyId ? { propertyId } : {}),
        },
      });

      if (existing) {
        const updated = await prisma.customFieldValue.update({
          where: { id: existing.id },
          data: { value: value != null ? String(value) : null },
        });
        results.push(updated);
      } else {
        const created = await prisma.customFieldValue.create({
          data: {
            fieldId: field.id,
            value: value != null ? String(value) : null,
            ...(clientId ? { clientId } : {}),
            ...(jobId ? { jobId } : {}),
            ...(quoteId ? { quoteId } : {}),
            ...(invoiceId ? { invoiceId } : {}),
            ...(propertyId ? { propertyId } : {}),
          },
        });
        results.push(created);
      }
    }

    res.json({ saved: results.length });
  } catch (err) {
    next(err);
  }
});

export default router;

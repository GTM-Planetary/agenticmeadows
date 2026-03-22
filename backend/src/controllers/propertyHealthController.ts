import { Request, Response, NextFunction } from "express";
import { prisma } from "../index";
import { createError } from "../middleware/errorHandler";

// ── Assess Property Health ─────────────────────────────────────────────────

export async function assessPropertyHealth(req: Request, res: Response, next: NextFunction) {
  try {
    const propertyId = req.params.propertyId;
    const {
      assessedById, overallScore, lawnHealth, irrigationHealth,
      treeHealth, hardscapeCondition, soilPh, soilMoisture,
      thatchDepth, grassHeight, weedDensity, pestPresence,
      predictedNeeds, notes, photoUrls,
    } = req.body;

    if (overallScore === undefined) {
      return next(createError("overallScore is required", 400));
    }

    // Verify property exists
    const property = await prisma.property.findUnique({ where: { id: propertyId } });
    if (!property) return next(createError("Property not found", 404));

    const assessment = await prisma.propertyHealthScore.create({
      data: {
        propertyId,
        assessedById,
        overallScore,
        lawnHealth,
        irrigationHealth,
        treeHealth,
        hardscapeCondition,
        soilPh,
        soilMoisture,
        thatchDepth,
        grassHeight,
        weedDensity,
        pestPresence,
        predictedNeeds,
        notes,
        photoUrls,
      },
      include: { property: true },
    });

    res.status(201).json(assessment);
  } catch (err) {
    next(err);
  }
}

// ── Get Latest Property Health ─────────────────────────────────────────────

export async function getPropertyHealth(req: Request, res: Response, next: NextFunction) {
  try {
    const propertyId = req.params.propertyId;

    const latest = await prisma.propertyHealthScore.findFirst({
      where: { propertyId },
      orderBy: { assessedAt: "desc" },
      include: { property: true },
    });

    if (!latest) return next(createError("No health assessment found for this property", 404));
    res.json(latest);
  } catch (err) {
    next(err);
  }
}

// ── Get Property Health History ────────────────────────────────────────────

export async function getPropertyHealthHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const propertyId = req.params.propertyId;

    const assessments = await prisma.propertyHealthScore.findMany({
      where: { propertyId },
      orderBy: { assessedAt: "desc" },
    });

    res.json(assessments);
  } catch (err) {
    next(err);
  }
}

// ── Get Predicted Maintenance (next 30 days) ───────────────────────────────

export async function getPredictedMaintenance(req: Request, res: Response, next: NextFunction) {
  try {
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    // Get the latest health score for each property that has predicted needs
    const allLatest = await prisma.propertyHealthScore.findMany({
      where: {
        predictedNeeds: { not: { equals: null } },
      },
      orderBy: { assessedAt: "desc" },
      include: {
        property: {
          include: { client: true },
        },
      },
    });

    // Deduplicate to latest per property
    const seenProperties = new Set<string>();
    const latestPerProperty: typeof allLatest = [];
    for (const assessment of allLatest) {
      if (!seenProperties.has(assessment.propertyId)) {
        seenProperties.add(assessment.propertyId);
        latestPerProperty.push(assessment);
      }
    }

    // Filter to those with predicted needs in the next 30 days
    const results = latestPerProperty
      .map((assessment) => {
        const needs = assessment.predictedNeeds as Array<{
          service: string;
          dueDate: string;
          reason: string;
          priority: string;
        }> | null;

        if (!needs || !Array.isArray(needs)) return null;

        const upcomingNeeds = needs.filter((need) => {
          const dueDate = new Date(need.dueDate);
          return dueDate <= thirtyDaysFromNow;
        });

        if (upcomingNeeds.length === 0) return null;

        return {
          property: assessment.property,
          latestAssessment: {
            id: assessment.id,
            assessedAt: assessment.assessedAt,
            overallScore: assessment.overallScore,
          },
          upcomingNeeds,
        };
      })
      .filter(Boolean);

    res.json(results);
  } catch (err) {
    next(err);
  }
}

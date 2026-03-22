import { Router, Request, Response, NextFunction } from "express";
import {
  listMeasurements,
  createMeasurement,
  getLatestMeasurement,
  updateMeasurement,
  deleteMeasurement,
} from "../controllers/propertyMeasurementController";
import { requireAuth } from "../middleware/auth";
import { prisma } from "../index";

const router = Router();

router.use(requireAuth);

// Property search by address substring match
router.get("/search", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { q } = req.query;
    if (!q || typeof q !== "string") {
      return res.json([]);
    }

    const properties = await prisma.property.findMany({
      where: {
        OR: [
          { streetAddress: { contains: q, mode: "insensitive" } },
          { city: { contains: q, mode: "insensitive" } },
          { state: { contains: q, mode: "insensitive" } },
          { zip: { contains: q, mode: "insensitive" } },
        ],
      },
      include: {
        client: { select: { id: true, firstName: true, lastName: true } },
      },
      take: 10,
    });

    res.json(properties);
  } catch (err) {
    next(err);
  }
});

// Property-scoped routes (mounted at /api/properties)
// NOTE: "latest" must come before "/:measurementId" to avoid being caught as a param
router.get("/:id/measurements/latest", getLatestMeasurement);
router.get("/:id/measurements", listMeasurements);
router.post("/:id/measurements", createMeasurement);

// Direct measurement routes (mounted at /api/measurements)
// These use a separate router exported below
const measurementRouter = Router();

measurementRouter.use(requireAuth);

measurementRouter.put("/:measurementId", updateMeasurement);
measurementRouter.delete("/:measurementId", deleteMeasurement);

export { measurementRouter };
export default router;

import { Router } from "express";
import {
  assessPropertyHealth,
  getPropertyHealth,
  getPropertyHealthHistory,
  getPredictedMaintenance,
} from "../controllers/propertyHealthController";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.use(requireAuth);

// Predicted maintenance across all properties (must be before /:propertyId routes)
router.get("/predictions", getPredictedMaintenance);

// Property health assessments
router.post("/:propertyId", assessPropertyHealth);
router.get("/:propertyId", getPropertyHealth);
router.get("/:propertyId/history", getPropertyHealthHistory);

export default router;

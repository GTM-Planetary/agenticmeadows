import { Router } from "express";
import { getSchedule } from "../controllers/scheduleController";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.use(requireAuth);
router.get("/", getSchedule);

export default router;

import { Router } from "express";
import { getWeather, checkScheduleWeather } from "../controllers/weatherController";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.use(requireAuth);

router.get("/", getWeather);
router.get("/schedule-check", checkScheduleWeather);

export default router;

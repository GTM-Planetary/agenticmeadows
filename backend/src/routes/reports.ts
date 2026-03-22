import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import {
  getRevenueReport,
  getJobsReport,
  getClientsReport,
  getSalesPipeline,
  getAgingReport,
  getChemicalLog,
} from "../controllers/reportController";

const router = Router();

router.get("/revenue", requireAuth, getRevenueReport);
router.get("/jobs", requireAuth, getJobsReport);
router.get("/clients", requireAuth, getClientsReport);
router.get("/sales-pipeline", requireAuth, getSalesPipeline);
router.get("/aging", requireAuth, getAgingReport);
router.get("/chemical-log", requireAuth, getChemicalLog);

export default router;

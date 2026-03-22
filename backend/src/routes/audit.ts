import { Router } from "express";
import {
  listAuditLogs,
  getSessionHistory,
  getSessionDetail,
  createAuditLog,
} from "../controllers/auditController";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.use(requireAuth);

router.get("/", listAuditLogs);
router.get("/sessions", getSessionHistory);
router.get("/sessions/:sessionId", getSessionDetail);
router.post("/", createAuditLog);

export default router;

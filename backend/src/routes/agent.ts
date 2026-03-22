import { Router } from "express";
import {
  listActions,
  getAction,
  createAction,
  approveAction,
  rejectAction,
  countPending,
} from "../controllers/agentActionController";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.use(requireAuth);

router.get("/actions", listActions);
router.get("/actions/pending-count", countPending);
router.get("/actions/:id", getAction);
router.post("/actions", createAction);
router.post("/actions/:id/approve", approveAction);
router.post("/actions/:id/reject", rejectAction);

export default router;

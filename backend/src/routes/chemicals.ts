import { Router } from "express";
import {
  listApplications,
  getApplication,
  createApplication,
  updateApplication,
  deleteApplication,
} from "../controllers/chemicalController";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.use(requireAuth);

router.get("/", listApplications);
router.post("/", createApplication);
router.get("/:id", getApplication);
router.put("/:id", updateApplication);
router.delete("/:id", deleteApplication);

export default router;

import { Router } from "express";
import {
  listTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  generateJobs,
  generateBatch,
} from "../controllers/recurringController";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.use(requireAuth);

router.get("/", listTemplates);
router.post("/", createTemplate);
router.post("/generate-batch", generateBatch); // Must be before /:id
router.get("/:id", getTemplate);
router.put("/:id", updateTemplate);
router.delete("/:id", deleteTemplate);
router.post("/:id/generate", generateJobs);

export default router;

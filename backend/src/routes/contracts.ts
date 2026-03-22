import { Router } from "express";
import {
  listContracts,
  getContract,
  createContract,
  updateContract,
  deleteContract,
} from "../controllers/contractController";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.use(requireAuth);

router.get("/", listContracts);
router.post("/", createContract);
router.get("/:id", getContract);
router.put("/:id", updateContract);
router.delete("/:id", deleteContract);

export default router;

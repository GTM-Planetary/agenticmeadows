import { Router } from "express";
import {
  listClients,
  getClient,
  createClient,
  updateClient,
  deleteClient,
  listClientProperties,
  createClientProperty,
} from "../controllers/clientController";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.use(requireAuth);

router.get("/", listClients);
router.post("/", createClient);
router.get("/:id", getClient);
router.put("/:id", updateClient);
router.delete("/:id", deleteClient);
router.get("/:id/properties", listClientProperties);
router.post("/:id/properties", createClientProperty);

export default router;

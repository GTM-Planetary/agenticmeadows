import { Router } from "express";
import {
  listEquipment,
  getEquipment,
  createEquipment,
  updateEquipment,
  logMaintenance,
  getMaintenanceAlerts,
  addMaintenanceSchedule,
  updateMaintenanceSchedule,
  deleteMaintenanceSchedule,
} from "../controllers/maintenanceController";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.use(requireAuth);

// Equipment CRUD
router.get("/equipment", listEquipment);
router.get("/equipment/:id", getEquipment);
router.post("/equipment", createEquipment);
router.put("/equipment/:id", updateEquipment);

// Maintenance logging
router.post("/equipment/:id/log", logMaintenance);

// Maintenance alerts (predictive)
router.get("/alerts", getMaintenanceAlerts);

// Maintenance schedules
router.post("/equipment/:id/schedules", addMaintenanceSchedule);
router.put("/schedules/:id", updateMaintenanceSchedule);
router.delete("/schedules/:id", deleteMaintenanceSchedule);

export default router;

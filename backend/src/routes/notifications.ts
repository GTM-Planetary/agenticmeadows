import { Router } from "express";
import {
  listNotifications,
  markRead,
  markAllRead,
  countUnread,
  createNotification,
  deleteNotification,
} from "../controllers/notificationController";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.use(requireAuth);

router.get("/", listNotifications);
router.get("/unread-count", countUnread);
router.post("/", createNotification);
router.post("/mark-all-read", markAllRead);
router.patch("/:id/read", markRead);
router.delete("/:id", deleteNotification);

export default router;

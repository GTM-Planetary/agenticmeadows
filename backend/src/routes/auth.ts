import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import {
  register, login, getMe, hasUsers, createInvite, validateInvite, registerWithInvite,
  updateMe, updateMyPhoto, listUsers, deactivateUser, reactivateUser,
} from "../controllers/authController";
import { requireAuth } from "../middleware/auth";

const PHOTOS_DIR = process.env.PHOTOS_DIR ?? "/app/photos";
const PROFILES_DIR = path.join(PHOTOS_DIR, "profiles");

// Ensure profiles directory exists
if (!fs.existsSync(PROFILES_DIR)) {
  fs.mkdirSync(PROFILES_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, PROFILES_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed"));
  },
});

const router = Router();

router.get("/has-users", hasUsers);
router.post("/register", register);
router.post("/login", login);
router.get("/me", requireAuth, getMe);
router.put("/me", requireAuth, updateMe);
router.put("/me/photo", requireAuth, upload.single("photo"), updateMyPhoto);

// User management (admin)
router.get("/users", requireAuth, listUsers);
router.put("/users/:id/deactivate", requireAuth, deactivateUser);
router.put("/users/:id/reactivate", requireAuth, reactivateUser);

// Invite token endpoints
router.post("/invite", requireAuth, createInvite);
router.get("/invite/:token", validateInvite);
router.post("/register-invite", registerWithInvite);

export default router;

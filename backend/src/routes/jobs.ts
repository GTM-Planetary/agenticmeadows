import { Router } from "express";
import multer from "multer";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import {
  listJobs,
  getJob,
  createJob,
  updateJob,
  deleteJob,
  uploadPhoto,
  listPhotos,
  updatePhotoAnalysis,
} from "../controllers/jobController";
import { requireAuth } from "../middleware/auth";

const PHOTOS_DIR = process.env.PHOTOS_DIR ?? "/app/photos";

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, PHOTOS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed"));
  },
});

const router = Router();

router.use(requireAuth);

router.get("/", listJobs);
router.post("/", createJob);
router.get("/:id", getJob);
router.put("/:id", updateJob);
router.delete("/:id", deleteJob);
router.get("/:id/photos", listPhotos);
router.post("/:id/photos", upload.single("photo"), uploadPhoto);
router.patch("/:jobId/photos/:photoId", updatePhotoAnalysis);

export default router;

import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../index";
import { requireAuth } from "../middleware/auth";
import { createError } from "../middleware/errorHandler";

const router = Router();

router.use(requireAuth);

// List all users (admin only in production, but available for settings page)
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, isActive: true, photoUrl: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
    res.json(users);
  } catch (err) {
    next(err);
  }
});

// Update user role
router.put("/:id/role", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { role } = req.body;
    if (!role || !["ADMIN", "TECHNICIAN", "VIEWER"].includes(role)) {
      return next(createError("Invalid role. Must be ADMIN, TECHNICIAN, or VIEWER", 400));
    }

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { role },
      select: { id: true, name: true, email: true, role: true, isActive: true, photoUrl: true, createdAt: true },
    });
    res.json(user);
  } catch (err) {
    next(err);
  }
});

export default router;

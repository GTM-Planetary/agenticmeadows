import { Router, Request, Response, NextFunction } from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "../index";
import { requireAuth } from "../middleware/auth";
import { createError } from "../middleware/errorHandler";
import { Prisma } from "@prisma/client";

const router = Router();

router.use(requireAuth);

// Ensure table exists
async function ensureTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ApiKey" (
      id TEXT PRIMARY KEY,
      "userId" TEXT NOT NULL,
      name TEXT NOT NULL,
      "keyHash" TEXT NOT NULL,
      "keyPreview" TEXT NOT NULL,
      permissions JSONB DEFAULT '["read"]',
      "createdAt" TIMESTAMPTZ DEFAULT NOW(),
      "lastUsedAt" TIMESTAMPTZ
    )
  `);
}

// List all API keys for current user (masked)
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    await ensureTable();
    const keys = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id, name, "keyPreview", permissions, "createdAt", "lastUsedAt"
       FROM "ApiKey"
       WHERE "userId" = $1
       ORDER BY "createdAt" DESC`,
      req.user!.userId
    );
    res.json(keys);
  } catch (err) {
    res.json([]);
  }
});

// Generate a new API key
router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, permissions } = req.body;
    if (!name) return next(createError("name is required", 400));

    await ensureTable();

    // Generate a secure random API key
    const id = crypto.randomUUID();
    const rawKey = `am_${crypto.randomBytes(32).toString("hex")}`;
    const keyHash = await bcrypt.hash(rawKey, 10);
    const keyPreview = `am_****...${rawKey.slice(-4)}`;
    const perms = JSON.stringify(permissions || ["read"]);

    await prisma.$executeRawUnsafe(
      `INSERT INTO "ApiKey" (id, "userId", name, "keyHash", "keyPreview", permissions, "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, NOW())`,
      id, req.user!.userId, name, keyHash, keyPreview, perms
    );

    // Return the raw key ONE TIME — it's hashed in the database
    res.status(201).json({
      id,
      name,
      key: rawKey,
      keyPreview,
      permissions: permissions || ["read"],
      createdAt: new Date().toISOString(),
      warning: "Copy this key now — you won't be able to see it again.",
    });
  } catch (err) {
    next(err);
  }
});

// Revoke (delete) an API key
router.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.$executeRawUnsafe(
      `DELETE FROM "ApiKey" WHERE id = $1 AND "userId" = $2`,
      req.params.id, req.user!.userId
    );
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;

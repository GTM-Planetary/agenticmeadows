import { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "../index";
import { signToken } from "../middleware/auth";
import { createError } from "../middleware/errorHandler";

// ── In-memory invite token store ──────────────────────────────────────────
interface InviteToken {
  token: string;
  role: "TECHNICIAN" | "VIEWER";
  createdAt: Date;
  used: boolean;
}

const inviteTokens = new Map<string, InviteToken>();

// Clean up expired tokens (older than 7 days)
function cleanExpiredTokens() {
  const now = Date.now();
  const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
  for (const [key, invite] of inviteTokens) {
    if (now - invite.createdAt.getTime() > SEVEN_DAYS || invite.used) {
      inviteTokens.delete(key);
    }
  }
}

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return next(createError("name, email, and password are required", 400));
    }
    if (password.length < 6) {
      return next(createError("Password must be at least 6 characters", 400));
    }
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return next(createError("Email already registered", 409));

    // First user gets ADMIN role automatically
    const userCount = await prisma.user.count();
    const assignedRole = userCount === 0 ? "ADMIN" : "TECHNICIAN";

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { name, email, passwordHash, role: assignedRole },
    });
    const token = signToken(user.id, user.role);
    res.status(201).json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = req.body;
    if (!email || !password) return next(createError("email and password required", 400));

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return next(createError("Invalid credentials", 401));
    if (!user.isActive) return next(createError("Account has been deactivated. Contact an administrator.", 403));

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return next(createError("Invalid credentials", 401));

    const token = signToken(user.id, user.role);
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, photoUrl: user.photoUrl } });
  } catch (err) {
    next(err);
  }
}

export async function hasUsers(_req: Request, res: Response, next: NextFunction) {
  try {
    const count = await prisma.user.count();
    res.json({ hasUsers: count > 0 });
  } catch (err) {
    next(err);
  }
}

export async function getMe(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { id: true, name: true, email: true, role: true, photoUrl: true, isActive: true, createdAt: true },
    });
    if (!user) return next(createError("User not found", 404));
    res.json(user);
  } catch (err) {
    next(err);
  }
}

export async function updateMe(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, currentPassword, newPassword } = req.body;
    const userId = req.user!.userId;

    const existing = await prisma.user.findUnique({ where: { id: userId } });
    if (!existing) return next(createError("User not found", 404));

    const data: Record<string, unknown> = {};
    if (name) data.name = name;

    if (newPassword) {
      if (!currentPassword) return next(createError("Current password is required to change password", 400));
      if (newPassword.length < 6) return next(createError("New password must be at least 6 characters", 400));
      const valid = await bcrypt.compare(currentPassword, existing.passwordHash);
      if (!valid) return next(createError("Current password is incorrect", 401));
      data.passwordHash = await bcrypt.hash(newPassword, 10);
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data,
      select: { id: true, name: true, email: true, role: true, photoUrl: true, createdAt: true },
    });
    res.json(user);
  } catch (err) {
    next(err);
  }
}

export async function updateMyPhoto(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    if (!req.file) return next(createError("No photo file uploaded", 400));

    const photoUrl = `/photos/profiles/${req.file.filename}`;
    const user = await prisma.user.update({
      where: { id: userId },
      data: { photoUrl },
      select: { id: true, name: true, email: true, role: true, photoUrl: true, createdAt: true },
    });
    res.json(user);
  } catch (err) {
    next(err);
  }
}

// ── User Management (Admin) ──────────────────────────────────────────────

export async function listUsers(req: Request, res: Response, next: NextFunction) {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, isActive: true, photoUrl: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
    res.json(users);
  } catch (err) {
    next(err);
  }
}

export async function deactivateUser(req: Request, res: Response, next: NextFunction) {
  try {
    if (req.user!.role !== "ADMIN") return next(createError("Forbidden", 403));
    const { id } = req.params;
    if (id === req.user!.userId) return next(createError("Cannot deactivate yourself", 400));

    const user = await prisma.user.update({
      where: { id },
      data: { isActive: false },
      select: { id: true, name: true, email: true, role: true, isActive: true, photoUrl: true, createdAt: true },
    });
    res.json(user);
  } catch (err) {
    next(err);
  }
}

export async function reactivateUser(req: Request, res: Response, next: NextFunction) {
  try {
    if (req.user!.role !== "ADMIN") return next(createError("Forbidden", 403));
    const { id } = req.params;

    const user = await prisma.user.update({
      where: { id },
      data: { isActive: true },
      select: { id: true, name: true, email: true, role: true, isActive: true, photoUrl: true, createdAt: true },
    });
    res.json(user);
  } catch (err) {
    next(err);
  }
}

// ── Admin Password Reset ──────────────────────────────────────────────

export async function resetUserPassword(req: Request, res: Response, next: NextFunction) {
  try {
    if (req.user!.role !== "ADMIN") return next(createError("Forbidden", 403));
    const { id } = req.params;
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return next(createError("Password must be at least 6 characters", 400));
    }
    const passwordHash = await bcrypt.hash(newPassword, 10);
    const user = await prisma.user.update({
      where: { id },
      data: { passwordHash },
      select: { id: true, name: true, email: true, role: true },
    });
    res.json({ success: true, message: `Password reset for ${user.email}` });
  } catch (err) {
    next(err);
  }
}

// ── Invite Token Endpoints ──────────────────────────────────────────────

export async function createInvite(req: Request, res: Response, next: NextFunction) {
  try {
    const { role } = req.body;
    if (!role || !["TECHNICIAN", "VIEWER"].includes(role)) {
      return next(createError("role must be TECHNICIAN or VIEWER", 400));
    }

    cleanExpiredTokens();

    const token = crypto.randomBytes(24).toString("hex");
    inviteTokens.set(token, {
      token,
      role: role as "TECHNICIAN" | "VIEWER",
      createdAt: new Date(),
      used: false,
    });

    const host = req.headers.host || "localhost:3001";
    const protocol = req.protocol || "http";
    const url = `${protocol}://${host}/invite/${token}`;

    res.status(201).json({ token, url, role });
  } catch (err) {
    next(err);
  }
}

export async function validateInvite(req: Request, res: Response, next: NextFunction) {
  try {
    const { token } = req.params;
    const invite = inviteTokens.get(token);

    if (!invite || invite.used) {
      return res.json({ valid: false });
    }

    // Check if expired (7 days)
    const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
    if (Date.now() - invite.createdAt.getTime() > SEVEN_DAYS) {
      inviteTokens.delete(token);
      return res.json({ valid: false });
    }

    res.json({ valid: true, role: invite.role });
  } catch (err) {
    next(err);
  }
}

export async function registerWithInvite(req: Request, res: Response, next: NextFunction) {
  try {
    const { token, name, email, password } = req.body;

    if (!token || !name || !email || !password) {
      return next(createError("token, name, email, and password are required", 400));
    }
    if (password.length < 6) {
      return next(createError("Password must be at least 6 characters", 400));
    }

    const invite = inviteTokens.get(token);
    if (!invite || invite.used) {
      return next(createError("Invalid or expired invite token", 400));
    }

    // Check if expired (7 days)
    const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
    if (Date.now() - invite.createdAt.getTime() > SEVEN_DAYS) {
      inviteTokens.delete(token);
      return next(createError("Invite token has expired", 400));
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return next(createError("Email already registered", 409));

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { name, email, passwordHash, role: invite.role },
    });

    // Mark invite as used
    invite.used = true;

    const authToken = signToken(user.id, user.role);
    res.status(201).json({
      token: authToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    next(err);
  }
}

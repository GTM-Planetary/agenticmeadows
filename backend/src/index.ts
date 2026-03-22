import express from "express";
import cors from "cors";
import path from "path";
import { PrismaClient } from "@prisma/client";

import { errorHandler } from "./middleware/errorHandler";
import clientRoutes from "./routes/clients";
import jobRoutes from "./routes/jobs";
import quoteRoutes from "./routes/quotes";
import invoiceRoutes from "./routes/invoices";
import scheduleRoutes from "./routes/schedule";
import authRoutes from "./routes/auth";
import serviceRoutes from "./routes/services";
import measurementRoutes from "./routes/measurements";
import chemicalRoutes from "./routes/chemicals";
import agentRoutes from "./routes/agent";
import notificationRoutes from "./routes/notifications";
import dashboardRoutes from "./routes/dashboard";
import weatherRoutes from "./routes/weather";
import contractRoutes from "./routes/contracts";
import recurringRoutes from "./routes/recurring";
import userRoutes from "./routes/users";
import apikeyRoutes from "./routes/apikeys";
import settingsRoutes from "./routes/settings";
import orgRoutes from "./routes/org";
import customFieldRoutes from "./routes/customfields";
import auditRoutes from "./routes/audit";
import reportRoutes from "./routes/reports";
import maintenanceRoutes from "./routes/maintenance";
import propertyHealthRoutes from "./routes/propertyHealth";

export const prisma = new PrismaClient();

const app = express();
const PORT = parseInt(process.env.PORT ?? "4000", 10);
const PHOTOS_DIR = process.env.PHOTOS_DIR ?? "/app/photos";

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(cors({ origin: "*", methods: ["GET", "POST", "PUT", "PATCH", "DELETE"] }));
app.use(express.json({ limit: "50mb" }));

// Serve uploaded photos from the shared Docker volume
app.use("/photos", express.static(PHOTOS_DIR));

// ── Health check ────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "agenticmeadows-backend" });
});

// ── API Routes ──────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/clients", clientRoutes);
app.use("/api/jobs", jobRoutes);
app.use("/api/quotes", quoteRoutes);
app.use("/api/invoices", invoiceRoutes);
app.use("/api/schedule", scheduleRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/properties", measurementRoutes);
app.use("/api/chemicals", chemicalRoutes);
app.use("/api/agent", agentRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/weather", weatherRoutes);
app.use("/api/contracts", contractRoutes);
app.use("/api/recurring", recurringRoutes);
app.use("/api/users", userRoutes);
app.use("/api/api-keys", apikeyRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/org", orgRoutes);
app.use("/api/custom-fields", customFieldRoutes);
app.use("/api/audit", auditRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/maintenance", maintenanceRoutes);
app.use("/api/property-health", propertyHealthRoutes);

// ── Error handler (must be last) ────────────────────────────────────────────
app.use(errorHandler);

// ── Start ───────────────────────────────────────────────────────────────────
async function main() {
  try {
    await prisma.$connect();
    console.log("✅ Database connected");
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`🌿 AgenticMeadows backend running on port ${PORT}`);
    });
  } catch (err) {
    console.error("❌ Failed to start backend:", err);
    process.exit(1);
  }
}

main();

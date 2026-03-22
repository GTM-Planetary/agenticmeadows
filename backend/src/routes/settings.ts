import { Router, Request, Response, NextFunction } from "express";
import { requireAuth } from "../middleware/auth";
import { createError } from "../middleware/errorHandler";
import fs from "fs";
import path from "path";

const router = Router();
router.use(requireAuth);

// Settings are stored as a JSON file in the photos volume (persistent across restarts)
const SETTINGS_FILE = path.join(process.env.PHOTOS_DIR || "/app/photos", "settings.json");

function readSettings(): Record<string, any> {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      return JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf8"));
    }
  } catch {}
  return {};
}

function writeSettings(data: Record<string, any>) {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(data, null, 2));
}

// Get all settings
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const settings = readSettings();
    // Mask sensitive values
    if (settings.nvidia_api_key) {
      settings.nvidia_api_key_preview = `nvapi-****...${settings.nvidia_api_key.slice(-4)}`;
      settings.nvidia_api_key_set = true;
      delete settings.nvidia_api_key; // Don't send the raw key back
    }
    res.json(settings);
  } catch (err) {
    next(err);
  }
});

// Update a specific setting
router.put("/:key", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { key } = req.params;
    const { value } = req.body;

    if (value === undefined) return next(createError("value is required", 400));

    const settings = readSettings();
    settings[key] = value;
    writeSettings(settings);

    res.json({ success: true, key });
  } catch (err) {
    next(err);
  }
});

// Save NVIDIA API key (special endpoint with validation)
router.post("/nvidia-key", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { key } = req.body;
    if (!key) return next(createError("key is required", 400));

    // Basic validation
    if (!key.startsWith("nvapi-")) {
      return next(createError("Invalid NVIDIA API key format. Keys should start with 'nvapi-'", 400));
    }

    // Test the key by making a simple API call
    let testResult = { valid: false, error: "" };
    try {
      const resp = await fetch("https://integrate.api.nvidia.com/v1/models", {
        headers: { Authorization: `Bearer ${key}` },
      });
      testResult.valid = resp.ok;
      if (!resp.ok) {
        testResult.error = `API returned status ${resp.status}`;
      }
    } catch (e: any) {
      testResult.error = e.message || "Connection failed";
    }

    // Save regardless of test result (user might be offline)
    const settings = readSettings();
    settings.nvidia_api_key = key;
    settings.nvidia_key_tested = testResult.valid;
    settings.nvidia_key_updated_at = new Date().toISOString();
    writeSettings(settings);

    res.json({
      success: true,
      valid: testResult.valid,
      error: testResult.error || undefined,
      preview: `nvapi-****...${key.slice(-4)}`,
    });
  } catch (err) {
    next(err);
  }
});

// Remove NVIDIA API key
router.delete("/nvidia-key", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const settings = readSettings();
    delete settings.nvidia_api_key;
    delete settings.nvidia_key_tested;
    delete settings.nvidia_key_updated_at;
    writeSettings(settings);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// Test NVIDIA API key connectivity
router.post("/nvidia-key/test", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const settings = readSettings();
    const key = settings.nvidia_api_key;
    if (!key) return next(createError("No NVIDIA API key configured", 404));

    try {
      const resp = await fetch("https://integrate.api.nvidia.com/v1/models", {
        headers: { Authorization: `Bearer ${key}` },
      });
      const valid = resp.ok;
      settings.nvidia_key_tested = valid;
      writeSettings(settings);
      res.json({ valid, status: resp.status });
    } catch (e: any) {
      res.json({ valid: false, error: e.message });
    }
  } catch (err) {
    next(err);
  }
});

export default router;

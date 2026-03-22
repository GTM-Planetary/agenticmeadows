import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../index";
import { requireAuth } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

// Get org settings (create default if not exists)
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    let org = await prisma.orgSettings.findUnique({ where: { id: "default" } });
    if (!org) {
      org = await prisma.orgSettings.create({ data: { id: "default" } });
    }
    res.json(org);
  } catch (err) {
    next(err);
  }
});

// Update org settings
router.put("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      companyName, companyLogo, address, city, state, zip,
      phone, email, website, invoicePrefix, invoiceNextNum,
      paymentTerms, invoiceFooter,
    } = req.body;

    const org = await prisma.orgSettings.upsert({
      where: { id: "default" },
      create: {
        id: "default",
        ...(companyName !== undefined ? { companyName } : {}),
        ...(companyLogo !== undefined ? { companyLogo } : {}),
        ...(address !== undefined ? { address } : {}),
        ...(city !== undefined ? { city } : {}),
        ...(state !== undefined ? { state } : {}),
        ...(zip !== undefined ? { zip } : {}),
        ...(phone !== undefined ? { phone } : {}),
        ...(email !== undefined ? { email } : {}),
        ...(website !== undefined ? { website } : {}),
        ...(invoicePrefix !== undefined ? { invoicePrefix } : {}),
        ...(invoiceNextNum !== undefined ? { invoiceNextNum } : {}),
        ...(paymentTerms !== undefined ? { paymentTerms } : {}),
        ...(invoiceFooter !== undefined ? { invoiceFooter } : {}),
      },
      update: {
        ...(companyName !== undefined ? { companyName } : {}),
        ...(companyLogo !== undefined ? { companyLogo } : {}),
        ...(address !== undefined ? { address } : {}),
        ...(city !== undefined ? { city } : {}),
        ...(state !== undefined ? { state } : {}),
        ...(zip !== undefined ? { zip } : {}),
        ...(phone !== undefined ? { phone } : {}),
        ...(email !== undefined ? { email } : {}),
        ...(website !== undefined ? { website } : {}),
        ...(invoicePrefix !== undefined ? { invoicePrefix } : {}),
        ...(invoiceNextNum !== undefined ? { invoiceNextNum } : {}),
        ...(paymentTerms !== undefined ? { paymentTerms } : {}),
        ...(invoiceFooter !== undefined ? { invoiceFooter } : {}),
      },
    });

    res.json(org);
  } catch (err) {
    next(err);
  }
});

// Upload logo (base64 encoded, stored in OrgSettings)
router.post("/logo", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { logo } = req.body; // base64 data URI
    if (!logo) return res.status(400).json({ error: "logo is required" });

    const org = await prisma.orgSettings.upsert({
      where: { id: "default" },
      create: { id: "default", companyLogo: logo },
      update: { companyLogo: logo },
    });

    res.json({ success: true, companyLogo: org.companyLogo });
  } catch (err) {
    next(err);
  }
});

export default router;

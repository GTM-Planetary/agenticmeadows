import { Router } from "express";
import {
  listInvoices,
  getInvoice,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  markPaid,
  addInvoiceLineItem,
  deleteInvoiceLineItem,
} from "../controllers/invoiceController";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.use(requireAuth);

router.get("/", listInvoices);
router.post("/", createInvoice);
router.get("/:id", getInvoice);
router.put("/:id", updateInvoice);
router.delete("/:id", deleteInvoice);
router.post("/:id/paid", markPaid);
router.post("/:id/line-items", addInvoiceLineItem);
router.delete("/:id/line-items/:itemId", deleteInvoiceLineItem);

export default router;

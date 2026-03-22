import { Router } from "express";
import {
  listQuotes,
  getQuote,
  createQuote,
  updateQuote,
  deleteQuote,
  convertToInvoice,
  addQuoteLineItem,
  deleteQuoteLineItem,
} from "../controllers/quoteController";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.use(requireAuth);

router.get("/", listQuotes);
router.post("/", createQuote);
router.get("/:id", getQuote);
router.put("/:id", updateQuote);
router.delete("/:id", deleteQuote);
router.post("/:id/convert", convertToInvoice);
router.post("/:id/line-items", addQuoteLineItem);
router.delete("/:id/line-items/:itemId", deleteQuoteLineItem);

export default router;

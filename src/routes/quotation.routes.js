const express = require("express");
const router = express.Router();
const {
  getAllQuotations,
  getQuotationById,
  getQuotationByToken,
  createQuotation,
  updateQuotation,
  deleteQuotation,
} = require("../controllers/quotation.controller");

// Public route (no auth needed)
router.get("/public/:token", getQuotationByToken);

router.get("/", getAllQuotations);
router.get("/:id", getQuotationById);
router.post("/", createQuotation);
router.put("/:id", updateQuotation);
router.delete("/:id", deleteQuotation);

module.exports = router;

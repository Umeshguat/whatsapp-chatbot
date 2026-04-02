const Quotation = require("../models/Quotation");
const Lead = require("../models/Lead");

const populateFields = [
  { path: "lead", select: "companyName contactPerson email phone" },
  { path: "items.product", select: "name sku price" },
];

// GET /api/quotations
const getAllQuotations = async (req, res) => {
  try {
    const { search, status, lead, page = 1, limit = 20 } = req.query;

    const filter = {};
    if (search) {
      filter.quotationNumber = { $regex: search, $options: "i" };
    }
    if (status) filter.status = status;
    if (lead) filter.lead = lead;

    const skip = (Number(page) - 1) * Number(limit);

    const [quotations, totalCount] = await Promise.all([
      Quotation.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .populate(populateFields),
      Quotation.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: {
        quotations,
        totalCount,
        page: Number(page),
        totalPages: Math.ceil(totalCount / Number(limit)),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/quotations/:id
const getQuotationById = async (req, res) => {
  try {
    const quotation = await Quotation.findById(req.params.id).populate(
      populateFields
    );

    if (!quotation) {
      return res
        .status(404)
        .json({ success: false, message: "Quotation not found" });
    }

    res.status(200).json({ success: true, data: quotation });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/quotations/public/:token (no auth)
const getQuotationByToken = async (req, res) => {
  try {
    const quotation = await Quotation.findOne({
      publicToken: req.params.token,
    }).populate(populateFields);

    if (!quotation) {
      return res
        .status(404)
        .json({ success: false, message: "Quotation not found" });
    }

    res.status(200).json({ success: true, data: quotation });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/quotations
const createQuotation = async (req, res) => {
  try {
    // Validate lead exists
    if (req.body.lead) {
      const leadExists = await Lead.findById(req.body.lead);
      if (!leadExists) {
        return res
          .status(404)
          .json({ success: false, message: "Lead not found" });
      }
    }

    const quotation = await Quotation.create(req.body);
    const populated = await Quotation.findById(quotation._id).populate(
      populateFields
    );

    res.status(201).json({
      success: true,
      message: "Quotation created successfully",
      data: populated,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// PUT /api/quotations/:id
const updateQuotation = async (req, res) => {
  try {
    const quotation = await Quotation.findById(req.params.id);
    if (!quotation) {
      return res
        .status(404)
        .json({ success: false, message: "Quotation not found" });
    }

    Object.assign(quotation, req.body);
    await quotation.save();

    const populated = await Quotation.findById(quotation._id).populate(
      populateFields
    );

    res.status(200).json({
      success: true,
      message: "Quotation updated successfully",
      data: populated,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// DELETE /api/quotations/:id
const deleteQuotation = async (req, res) => {
  try {
    const quotation = await Quotation.findByIdAndDelete(req.params.id);
    if (!quotation) {
      return res
        .status(404)
        .json({ success: false, message: "Quotation not found" });
    }

    res.status(200).json({
      success: true,
      message: "Quotation deleted successfully",
      data: null,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getAllQuotations,
  getQuotationById,
  getQuotationByToken,
  createQuotation,
  updateQuotation,
  deleteQuotation,
};

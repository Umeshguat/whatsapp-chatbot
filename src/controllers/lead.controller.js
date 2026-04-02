const Lead = require("../models/Lead");

// GET /api/leads
const getAllLeads = async (req, res) => {
  try {
    const { search, stage, source, page = 1, limit = 20 } = req.query;

    const filter = {};
    if (search) {
      filter.$or = [
        { companyName: { $regex: search, $options: "i" } },
        { contactPerson: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }
    if (stage) filter.stage = stage;
    if (source) filter.source = source;

    const skip = (Number(page) - 1) * Number(limit);

    const [leads, totalCount] = await Promise.all([
      Lead.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .populate("products", "name sku price"),
      Lead.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: {
        leads,
        totalCount,
        page: Number(page),
        totalPages: Math.ceil(totalCount / Number(limit)),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/leads/:id
const getLeadById = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id).populate(
      "products",
      "name sku price"
    );

    if (!lead) {
      return res.status(404).json({ success: false, message: "Lead not found" });
    }

    res.status(200).json({ success: true, data: lead });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/leads
const createLead = async (req, res) => {
  try {
    const lead = await Lead.create(req.body);
    const populated = await lead.populate("products", "name sku price");

    res.status(201).json({
      success: true,
      message: "Lead created successfully",
      data: populated,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res
        .status(409)
        .json({ success: false, message: "Lead with this email already exists" });
    }
    res.status(400).json({ success: false, message: error.message });
  }
};

// PUT /api/leads/:id
const updateLead = async (req, res) => {
  try {
    const lead = await Lead.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    }).populate("products", "name sku price");

    if (!lead) {
      return res.status(404).json({ success: false, message: "Lead not found" });
    }

    res.status(200).json({
      success: true,
      message: "Lead updated successfully",
      data: lead,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// DELETE /api/leads/:id
const deleteLead = async (req, res) => {
  try {
    const lead = await Lead.findByIdAndDelete(req.params.id);
    if (!lead) {
      return res.status(404).json({ success: false, message: "Lead not found" });
    }

    res.status(200).json({
      success: true,
      message: "Lead deleted successfully",
      data: null,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getAllLeads,
  getLeadById,
  createLead,
  updateLead,
  deleteLead,
};

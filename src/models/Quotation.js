const mongoose = require("mongoose");
const crypto = require("crypto");

const quotationItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: [true, "Product is required"],
    },
    quantity: {
      type: Number,
      required: [true, "Quantity is required"],
      min: 1,
    },
    unitPrice: {
      type: Number,
      required: [true, "Unit price is required"],
      min: 0,
    },
    total: {
      type: Number,
      default: 0,
    },
  },
  { _id: true }
);

const quotationSchema = new mongoose.Schema(
  {
    quotationNumber: {
      type: String,
      unique: true,
    },
    lead: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lead",
      required: [true, "Lead is required"],
      index: true,
    },
    items: {
      type: [quotationItemSchema],
      validate: {
        validator: (v) => Array.isArray(v) && v.length > 0,
        message: "At least one item is required",
      },
    },
    discountType: {
      type: String,
      enum: ["PERCENTAGE", "FLAT"],
      default: "FLAT",
    },
    discountValue: {
      type: Number,
      default: 0,
      min: 0,
    },
    subtotal: {
      type: Number,
      default: 0,
    },
    discountAmount: {
      type: Number,
      default: 0,
    },
    total: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["DRAFT", "SENT", "ACCEPTED", "REJECTED", "EXPIRED"],
      default: "DRAFT",
    },
    notes: {
      type: String,
      trim: true,
      default: "",
    },
    validUntil: {
      type: Date,
      default: null,
    },
    publicToken: {
      type: String,
      unique: true,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

// Auto-generate quotation number + compute totals
quotationSchema.pre("save", async function () {
  // Auto-generate public token for new documents
  if (this.isNew && !this.publicToken) {
    this.publicToken = crypto.randomBytes(16).toString("hex");
  }

  // Auto-generate quotation number for new documents
  if (this.isNew && !this.quotationNumber) {
    const last = await mongoose
      .model("Quotation")
      .findOne({}, { quotationNumber: 1 })
      .sort({ createdAt: -1 });

    let nextNum = 1;
    if (last?.quotationNumber) {
      const match = last.quotationNumber.match(/QTN-(\d+)/);
      if (match) nextNum = parseInt(match[1], 10) + 1;
    }
    this.quotationNumber = `QTN-${String(nextNum).padStart(4, "0")}`;
  }

  // Compute item totals and subtotal
  let subtotal = 0;
  for (const item of this.items) {
    item.total = item.quantity * item.unitPrice;
    subtotal += item.total;
  }
  this.subtotal = subtotal;

  // Compute discount
  if (this.discountType === "PERCENTAGE") {
    this.discountAmount = Math.round((subtotal * this.discountValue) / 100 * 100) / 100;
  } else {
    this.discountAmount = this.discountValue;
  }

  // Compute total
  this.total = Math.max(subtotal - this.discountAmount, 0);
});

const Quotation = mongoose.model("Quotation", quotationSchema);

module.exports = Quotation;

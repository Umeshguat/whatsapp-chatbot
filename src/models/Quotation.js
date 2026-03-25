const mongoose = require("mongoose");

const quotationItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
  },
  productName: String,
  unitPrice: Number,
  quantity: {
    type: Number,
    min: [1, "Quantity must be at least 1"],
  },
  lineTotal: Number,
});

const quotationSchema = new mongoose.Schema(
  {
    quotationNumber: {
      type: String,
      required: true,
      unique: true,
    },
    lead: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lead",
      default: null,
    },
    customerName: {
      type: String,
      required: [true, "Customer name is required"],
    },
    items: [quotationItemSchema],
    subtotal: {
      type: Number,
      default: 0,
    },
    discountPercent: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    discountAmount: {
      type: Number,
      default: 0,
    },
    grandTotal: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["Draft", "Sent", "Accepted", "Rejected"],
      default: "Draft",
    },
    createdBy: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

quotationSchema.methods.calculateTotals = function () {
  this.subtotal = this.items.reduce((sum, item) => {
    item.lineTotal = item.unitPrice * item.quantity;
    return sum + item.lineTotal;
  }, 0);

  this.discountAmount = (this.subtotal * this.discountPercent) / 100;
  this.grandTotal = this.subtotal - this.discountAmount;
};

quotationSchema.statics.generateQuotationNumber = async function () {
  const today = new Date();
  const dateStr =
    today.getFullYear().toString() +
    String(today.getMonth() + 1).padStart(2, "0") +
    String(today.getDate()).padStart(2, "0");

  const prefix = `QT-${dateStr}-`;

  const lastQuotation = await this.findOne({
    quotationNumber: { $regex: `^${prefix}` },
  }).sort({ quotationNumber: -1 });

  let nextNum = 1;
  if (lastQuotation) {
    const lastNum = parseInt(lastQuotation.quotationNumber.split("-").pop());
    nextNum = lastNum + 1;
  }

  return `${prefix}${String(nextNum).padStart(3, "0")}`;
};

module.exports = mongoose.model("Quotation", quotationSchema);

const mongoose = require("mongoose");

const leadSchema = new mongoose.Schema(
  {
    companyName: {
      type: String,
      required: [true, "Company name is required"],
      trim: true,
      maxlength: 100,
    },
    contactPerson: {
      type: String,
      required: [true, "Contact person is required"],
      trim: true,
      maxlength: 50,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
      default: "",
    },
    value: {
      type: Number,
      default: 0,
      min: 0,
    },
    stage: {
      type: String,
      enum: ["New", "Qualified", "Proposal", "Negotiation", "Won", "Lost"],
      default: "New",
    },
    source: {
      type: String,
      enum: [
        "Website",
        "Referral",
        "LinkedIn",
        "Trade Show",
        "Cold Call",
        "Email",
        "Other",
      ],
      default: "Other",
    },
    assignee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    notes: {
      type: String,
      trim: true,
      default: "",
    },
    products: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

const Lead = mongoose.model("Lead", leadSchema);

module.exports = Lead;

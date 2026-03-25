const mongoose = require("mongoose");

const leadSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Lead name is required"],
      trim: true,
    },
    phone: {
      type: String,
      required: [true, "Phone number is required"],
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      default: "",
    },
    company: {
      type: String,
      trim: true,
      default: "",
    },
    source: {
      type: String,
      enum: ["WhatsApp", "Website", "Referral", "Cold Call", "Other"],
      default: "WhatsApp",
    },
    status: {
      type: String,
      enum: ["New", "Contacted", "Qualified", "Lost", "Converted"],
      default: "New",
    },
    notes: {
      type: String,
      default: "",
    },
    createdBy: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Lead", leadSchema);

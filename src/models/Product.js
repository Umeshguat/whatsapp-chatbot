const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
      maxlength: 100,
    },
    sku: {
      type: String,
      required: [true, "SKU is required"],
      unique: true,
      uppercase: true,
      trim: true,
    },
    price: {
      type: Number,
      required: [true, "Price is required"],
      min: 0,
    },
    stock: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: [true, "Category is required"],
    },
    status: {
      type: String,
      enum: ["Active", "Low Stock", "Out of Stock"],
      default: "Active",
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    image: {
      type: String,
      default: "",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

productSchema.pre("save", function () {
  if (this.isModified("stock")) {
    if (this.stock === 0) this.status = "Out of Stock";
    else if (this.stock <= 20) this.status = "Low Stock";
    else this.status = "Active";
  }
});

const Product = mongoose.model("Product", productSchema);

module.exports = Product;

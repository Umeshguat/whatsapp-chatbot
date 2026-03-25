require("dotenv").config();

const mongoose = require("mongoose");
const Product = require("./src/models/Product");

const sampleProducts = [
  { name: "Widget A", price: 500, unit: "piece", description: "Standard widget", category: "Widgets" },
  { name: "Widget B", price: 1200, unit: "piece", description: "Premium widget", category: "Widgets" },
  { name: "Premium Widget", price: 2500, unit: "piece", description: "Enterprise grade widget", category: "Widgets" },
  { name: "Consultation Service", price: 3000, unit: "hour", description: "Expert consultation", category: "Services" },
  { name: "Installation Service", price: 5000, unit: "unit", description: "Professional installation", category: "Services" },
  { name: "Maintenance Package", price: 8000, unit: "month", description: "Monthly maintenance plan", category: "Services" },
];

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    for (const product of sampleProducts) {
      await Product.updateOne({ name: product.name }, { $set: product }, { upsert: true });
    }

    console.log(`✅ Seeded ${sampleProducts.length} products`);
    const products = await Product.find();
    products.forEach((p) => console.log(`  - ${p.name}: Rs.${p.price}/${p.unit}`));

    await mongoose.disconnect();
    console.log("Done!");
  } catch (error) {
    console.error("Seed error:", error.message);
    process.exit(1);
  }
};

seed();

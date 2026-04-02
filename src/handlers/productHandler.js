const Product = require("../models/Product");
const { formatProductList } = require("../utils/formatter");

const handleProductMenu = async (client, msg, session) => {
  const chatId = msg.from;
  const text = msg.body.trim();

  if (session.step === 0) {
    session.step = 1;
    await client.sendMessage(
      chatId,
      "📦 *Product Management*\n\n1. List All Products\n2. Add New Product\n0. Back to Main Menu\n\nReply with number:"
    );
    return;
  }

  if (session.step === 1) {
    if (text === "0") {
      session.menu = "main";
      session.step = 0;
      return "show_menu";
    }

    if (text === "1") {
      const products = await Product.find({ isActive: true }).sort({ name: 1 });
      await client.sendMessage(chatId, formatProductList(products) + "\nType *0* to go back.");
      session.step = 0;
      return;
    }

    if (text === "2") {
      session.menu = "product_add";
      session.step = 0;
      session.data = {};
      await handleAddProduct(client, msg, session);
      return;
    }

    await client.sendMessage(chatId, "Invalid option. Reply with 1, 2, or 0.");
  }
};

const handleAddProduct = async (client, msg, session) => {
  const chatId = msg.from;
  const text = msg.body.trim();

  switch (session.step) {
    case 0:
      session.step = 1;
      session.data = {};
      await client.sendMessage(chatId, "📦 *Add New Product*\n\nEnter product name:");
      break;

    case 1:
      session.data.name = text;
      session.step = 2;
      await client.sendMessage(chatId, "Enter price (number only):");
      break;

    case 2: {
      const price = parseFloat(text);
      if (isNaN(price) || price < 0) {
        await client.sendMessage(chatId, "❌ Invalid price. Enter a valid number:");
        return;
      }
      session.data.price = price;
      session.step = 3;
      await client.sendMessage(chatId, "Enter description (or type *skip*):");
      break;
    }

    case 3:
      session.data.description = text.toLowerCase() === "skip" ? "" : text;
      session.step = 4;
      await client.sendMessage(chatId, "Enter unit (piece/kg/hour/month or type *skip* for 'piece'):");
      break;

    case 4:
      session.data.unit = text.toLowerCase() === "skip" ? "piece" : text.toLowerCase();

      try {
        const product = await Product.create(session.data);
        await client.sendMessage(
          chatId,
          `✅ *Product Added!*\n\nName  : ${product.name}\nPrice : Rs.${product.price}/${product.unit}\nDesc  : ${product.description || "N/A"}\n\nType *menu* to go back.`
        );
      } catch (error) {
        if (error.code === 11000) {
          await client.sendMessage(chatId, "❌ Product with this name already exists.\n\nType *menu* to go back.");
        } else {
          await client.sendMessage(chatId, `❌ Error: ${error.message}\n\nType *menu* to go back.`);
        }
      }

      session.menu = "main";
      session.step = 0;
      session.data = {};
      break;
  }
};

module.exports = { handleProductMenu, handleAddProduct };

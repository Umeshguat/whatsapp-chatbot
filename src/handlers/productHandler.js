const apiClient = require("../utils/apiClient");
const { formatProductList } = require("../utils/formatter");

const handleProductMenu = async (client, msg, session) => {
  const chatId = msg.from;
  const text = msg.body.trim();

  if (session.step === 0) {
    session.step = 1;
    await client.sendMessage(
      chatId,
      "📦 *Product Management*\n\n1. List All Products\n2. Search Product\n0. Back to Main Menu\n\nReply with number:"
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
      try {
        const result = await apiClient.get("/api/v1/public/products?page=1&limit=20");
        const products = result.data?.products || result.data || result.products || [];
        await client.sendMessage(chatId, formatProductList(products) + "\nType *0* to go back.");
      } catch (error) {
        await client.sendMessage(chatId, `❌ Error: ${error.message}\nType *0* to go back.`);
      }
      return;
    }

    if (text === "2") {
      session.step = 2;
      await client.sendMessage(chatId, "🔍 Enter product name to search:");
      return;
    }

    await client.sendMessage(chatId, "Invalid option. Reply with 1, 2, or 0.");
    return;
  }

  if (session.step === 2) {
    try {
      const result = await apiClient.get(`/api/v1/public/products?search=${encodeURIComponent(text)}&page=1&limit=10`);
      const products = result.data?.products || result.data || result.products || [];

      if (!products.length) {
        await client.sendMessage(chatId, `No products found for "${text}".\n\nType *0* to go back.`);
      } else {
        await client.sendMessage(chatId, formatProductList(products) + "\nType *0* to go back.");
      }
    } catch (error) {
      await client.sendMessage(chatId, `❌ Error: ${error.message}\nType *0* to go back.`);
    }
    session.step = 1;
  }
};

module.exports = { handleProductMenu };

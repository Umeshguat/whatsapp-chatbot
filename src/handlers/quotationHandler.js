const apiClient = require("../utils/apiClient");
const { formatQuotation, formatCurrency } = require("../utils/formatter");

const handleQuotation = async (client, msg, session) => {
  const chatId = msg.from;
  const text = msg.body.trim();

  switch (session.step) {
    // Step 0: Show products to select
    case 0: {
      await showProductSelection(client, chatId, session);
      break;
    }

    // Step 1: Product selection
    case 1: {
      if (text.toLowerCase() === "done") {
        if (session.data.items.length === 0) {
          await client.sendMessage(
            chatId,
            `Please add at least one product before finishing. 🙂\n\nSelect a product number or type *back* to cancel.`
          );
          return;
        }
        session.step = 3;
        await client.sendMessage(
          chatId,
          `Great! 🎉 Almost done!\n\nWould you like to apply a *discount*?\n\n` +
          `1️⃣ Yes, percentage discount\n` +
          `2️⃣ Yes, flat amount discount\n` +
          `3️⃣ No discount\n\n` +
          `Reply with the number 🙂`
        );
        return;
      }

      const index = parseInt(text) - 1;
      if (!session.data.products || !session.data.products[index]) {
        await client.sendMessage(
          chatId,
          `Hmm, that doesn't seem right. 🤔\n\nPlease select a valid product number, type *done* to finish, or *back* to cancel.`
        );
        return;
      }

      const selectedProduct = session.data.products[index];
      session.data.currentProduct = selectedProduct;
      session.step = 2;
      await client.sendMessage(
        chatId,
        `You selected *${selectedProduct.name}* (Rs.${selectedProduct.price}/${selectedProduct.unit || "piece"}) 👍\n\nHow many do you need? Please enter the *quantity*.`
      );
      break;
    }

    // Step 2: Quantity entered → add item, back to product selection
    case 2: {
      const qty = parseInt(text);
      if (isNaN(qty) || qty < 1) {
        await client.sendMessage(
          chatId,
          `Please enter a valid quantity (1 or more). 🙂`
        );
        return;
      }

      const product = session.data.currentProduct;
      const lineTotal = product.price * qty;

      session.data.items.push({
        product: String(product._id || product.id),
        productName: product.name,
        unitPrice: product.price,
        quantity: qty,
        lineTotal: lineTotal,
      });

      let summary = `✅ Added: *${product.name}* x ${qty} = ${formatCurrency(lineTotal)}\n\n`;
      summary += `📦 *Items added so far:*\n`;
      let runningTotal = 0;
      session.data.items.forEach((item, i) => {
        summary += `${i + 1}. ${item.productName} x${item.quantity} = ${formatCurrency(item.lineTotal)}\n`;
        runningTotal += item.lineTotal;
      });
      summary += `\n💰 *Running Total: ${formatCurrency(runningTotal)}*\n`;
      summary += `\nWould you like to add more products? 🛒\n`;
      summary += `Select a product number to add more, or type *done* to finish.`;

      session.step = 1;
      await client.sendMessage(chatId, summary);
      break;
    }

    // Step 3: Discount type selection
    case 3: {
      if (text === "3") {
        session.data.discountType = "FLAT";
        session.data.discountValue = 0;
        await submitQuotation(client, chatId, session);
        return;
      }

      if (text === "1") {
        session.data.discountType = "PERCENTAGE";
        session.step = 4;
        await client.sendMessage(
          chatId,
          `Sure! 👍\n\nPlease enter the *discount percentage* (0-100).`
        );
        return;
      }

      if (text === "2") {
        session.data.discountType = "FLAT";
        session.step = 4;
        await client.sendMessage(
          chatId,
          `Sure! 👍\n\nPlease enter the *flat discount amount*.`
        );
        return;
      }

      await client.sendMessage(
        chatId,
        `Please reply with *1*, *2*, or *3*. 🙂`
      );
      break;
    }

    // Step 4: Discount value
    case 4: {
      const value = parseFloat(text);
      if (isNaN(value) || value < 0) {
        await client.sendMessage(
          chatId,
          `Please enter a valid number. 🙂`
        );
        return;
      }

      if (session.data.discountType === "PERCENTAGE" && value > 100) {
        await client.sendMessage(
          chatId,
          `Percentage must be between 0 and 100. Please try again.`
        );
        return;
      }

      session.data.discountValue = value;
      await submitQuotation(client, chatId, session);
      break;
    }
  }
};

const submitQuotation = async (client, chatId, session) => {
  try {
    const payload = {
      lead: String(session.data.leadId),
      items: session.data.items.map((item) => ({
        product: String(item.product),
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })),
      discountType: session.data.discountType,
      discountValue: session.data.discountValue,
      status: "DRAFT",
    };

    const result = await apiClient.post("/api/v1/quotations/generate", payload);
    const quotation = result.data || result;

    // Build display data from API response or local data
    const displayData = {
      quotationNumber: quotation.quotationNumber || quotation._id || "N/A",
      customerName: session.data.leadName,
      items: session.data.items,
      subtotal: quotation.subtotal || session.data.items.reduce((sum, i) => sum + i.lineTotal, 0),
      discountPercent: session.data.discountType === "PERCENTAGE" ? session.data.discountValue : 0,
      discountAmount: quotation.discountAmount || 0,
      grandTotal: quotation.total || quotation.grandTotal || 0,
      createdAt: quotation.createdAt || new Date(),
    };

    const formatted = formatQuotation(displayData);
    await client.sendMessage(chatId, formatted);
    await client.sendMessage(
      chatId,
      `✅ *Quotation generated successfully!* 🎉\n\nThank you! We'll get back to you soon. 😊\n\nType *hi* to start again.`
    );
  } catch (error) {
    await client.sendMessage(chatId, `❌ Oops! Something went wrong: ${error.message}\n\nType *hi* to try again.`);
  }

  session.menu = "main";
  session.step = 0;
  session.data = {};
};

const showProductSelection = async (client, chatId, session) => {
  try {
    const result = await apiClient.get("/api/v1/public/products?page=1&limit=20");
    const products = result.data?.products || result.data || result.products || [];

    if (!products.length) {
      await client.sendMessage(
        chatId,
        `Sorry, no products are available right now. 😔\n\nType *hi* to start again.`
      );
      session.menu = "main";
      session.step = 0;
      return;
    }

    session.data.products = products;
    if (!session.data.items) session.data.items = [];

    let text = `📄 *Let's create your quotation!*\n\n`;
    text += `Lead: *${session.data.leadName}*\n\n`;
    text += `Please select a product to add: 🛒\n\n`;
    products.forEach((p, i) => {
      text += `*${i + 1}.* ${p.name} - Rs.${p.price}/${p.unit || "piece"}\n`;
    });
    text += `\nReply with the product number.\nType *done* when you're finished adding products.`;

    session.step = 1;
    await client.sendMessage(chatId, text);
  } catch (error) {
    await client.sendMessage(chatId, `❌ Oops! Couldn't load products: ${error.message}\n\nType *hi* to try again.`);
    session.menu = "main";
    session.step = 0;
  }
};

module.exports = { handleQuotation };

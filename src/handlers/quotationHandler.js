const { List } = require("whatsapp-web.js");
const Product = require("../models/Product");
const Quotation = require("../models/Quotation");
const { formatQuotation, formatCurrency } = require("../utils/formatter");

const handleQuotation = async (client, msg, session) => {
  const chatId = msg.from;
  const text = msg.body ? msg.body.trim() : "";
  const selectedId = msg._selectedId || text;

  switch (session.step) {
    case 0:
      session.step = 1;
      session.data = { items: [] };
      await client.sendMessage(chatId, "📄 *Generate Quotation*\n\nEnter customer name:");
      break;

    case 1:
      session.data.customerName = text;
      session.step = 2;
      await showProductSelection(client, chatId, session);
      break;

    case 2: {
      if (selectedId === "qtn_done" || text.toLowerCase() === "done") {
        if (session.data.items.length === 0) {
          await client.sendMessage(chatId, "❌ Add at least one product before finishing.\n\nSelect a product or type *0* to cancel:");
          return;
        }
        session.step = 4;
        await client.sendMessage(chatId, "Enter discount percentage (0-100, or type *0* for no discount):");
        return;
      }

      // Handle both list selection (qtn_prod_0, qtn_prod_1...) and number input
      let index;
      if (selectedId.startsWith("qtn_prod_")) {
        index = parseInt(selectedId.replace("qtn_prod_", ""));
      } else {
        index = parseInt(text) - 1;
      }

      if (!session.data.products || !session.data.products[index]) {
        await client.sendMessage(chatId, "❌ Invalid selection. Select a product, type *done* to finish, or *0* to cancel.");
        return;
      }

      const selectedProduct = session.data.products[index];
      session.data.currentProduct = selectedProduct;
      session.step = 3;
      await client.sendMessage(chatId, `Enter quantity for *${selectedProduct.name}* (Rs.${selectedProduct.price}/${selectedProduct.unit}):`);
      break;
    }

    case 3: {
      const qty = parseInt(text);
      if (isNaN(qty) || qty < 1) {
        await client.sendMessage(chatId, "❌ Invalid quantity. Enter a number >= 1:");
        return;
      }

      const product = session.data.currentProduct;
      const lineTotal = product.price * qty;

      session.data.items.push({
        product: product._id,
        productName: product.name,
        unitPrice: product.price,
        quantity: qty,
        lineTotal: lineTotal,
      });

      let summary = `✅ Added: ${product.name} x ${qty} = ${formatCurrency(lineTotal)}\n\n`;
      summary += `*Items so far:*\n`;
      let runningTotal = 0;
      session.data.items.forEach((item, i) => {
        summary += `${i + 1}. ${item.productName} x${item.quantity} = ${formatCurrency(item.lineTotal)}\n`;
        runningTotal += item.lineTotal;
      });
      summary += `\n*Running Total: ${formatCurrency(runningTotal)}*\n`;

      session.step = 2;
      await client.sendMessage(chatId, summary);
      await showProductSelection(client, chatId, session, true);
      break;
    }

    case 4: {
      const discount = parseFloat(text);
      if (isNaN(discount) || discount < 0 || discount > 100) {
        await client.sendMessage(chatId, "❌ Enter a valid discount between 0 and 100:");
        return;
      }

      try {
        const quotationNumber = await Quotation.generateQuotationNumber();

        const quotation = new Quotation({
          quotationNumber,
          customerName: session.data.customerName,
          items: session.data.items,
          discountPercent: discount,
          createdBy: chatId,
        });

        quotation.calculateTotals();
        await quotation.save();

        const formatted = formatQuotation(quotation);
        await client.sendMessage(chatId, formatted);
        await client.sendMessage(chatId, `✅ Quotation *${quotationNumber}* saved!\n\nType *menu* to go back.`);
      } catch (error) {
        await client.sendMessage(chatId, `❌ Error: ${error.message}\n\nType *menu* to go back.`);
      }

      session.menu = "main";
      session.step = 0;
      session.data = {};
      break;
    }
  }
};

const showProductSelection = async (client, chatId, session, isAddMore = false) => {
  const products = await Product.find({ isActive: true }).sort({ name: 1 }).lean();

  if (!products.length) {
    await client.sendMessage(chatId, "❌ No products found. Add products first.\n\nType *menu* to go back.");
    session.menu = "main";
    session.step = 0;
    return;
  }

  session.data.products = products;

  const rows = products.map((p, i) => ({
    id: `qtn_prod_${i}`,
    title: p.name,
    description: `Rs.${p.price}/${p.unit}`,
  }));

  if (isAddMore) {
    rows.push({ id: "qtn_done", title: "✅ Done", description: "Finish adding products" });
  }

  const productList = new List(
    isAddMore
      ? "Select another product or tap Done to finish:"
      : "Select a product to add to the quotation:",
    "Select Product",
    [{ title: "Available Products", rows }],
    "📄 Product Selection",
    isAddMore ? "Add more or finish" : "Reply with number or tap to select"
  );

  await client.sendMessage(chatId, productList);
};

module.exports = { handleQuotation };

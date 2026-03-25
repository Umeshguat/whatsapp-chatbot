const Product = require("../models/Product");
const Quotation = require("../models/Quotation");
const { formatQuotation, formatCurrency } = require("../utils/formatter");

const handleQuotation = async (client, msg, session) => {
  const chatId = msg.from;
  const text = msg.body.trim();

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
      if (text.toLowerCase() === "done") {
        if (session.data.items.length === 0) {
          await client.sendMessage(chatId, "❌ Add at least one product before finishing.\n\nSelect a product number or type *0* to cancel:");
          return;
        }
        session.step = 4;
        await client.sendMessage(chatId, "Enter discount percentage (0-100, or type *0* for no discount):");
        return;
      }

      const index = parseInt(text) - 1;
      if (!session.data.products || !session.data.products[index]) {
        await client.sendMessage(chatId, "❌ Invalid selection. Enter product number, *done* to finish, or *0* to cancel.");
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
      summary += "\nSelect another product number, or type *done* to finish:";

      session.step = 2;
      await client.sendMessage(chatId, summary);
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

const showProductSelection = async (client, chatId, session) => {
  const products = await Product.find({ isActive: true }).sort({ name: 1 });

  if (!products.length) {
    await client.sendMessage(chatId, "❌ No products found. Add products first.\n\nType *menu* to go back.");
    session.menu = "main";
    session.step = 0;
    return;
  }

  session.data.products = products;

  let text = "*Select a product to add:*\n\n";
  products.forEach((p, i) => {
    text += `*${i + 1}.* ${p.name} - Rs.${p.price}/${p.unit}\n`;
  });
  text += "\nReply with product number.\nType *done* when finished adding products.\nType *0* to cancel.";

  await client.sendMessage(chatId, text);
};

module.exports = { handleQuotation };

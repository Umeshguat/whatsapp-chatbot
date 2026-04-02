const apiClient = require("../utils/apiClient");
const { formatQuotation, formatCurrency } = require("../utils/formatter");

const handleQuotation = async (client, msg, session) => {
  const chatId = msg.from;
  const text = msg.body.trim();

  switch (session.step) {
    // Step 0: Fetch and show leads for selection
    case 0: {
      try {
        const result = await apiClient.get("/api/v1/public/leads?page=1&limit=10");
        const leads = result.data?.leads || result.data || result.leads || [];

        if (!leads.length) {
          await client.sendMessage(chatId, "❌ No leads found. Add a lead first.\n\nType *menu* to go back.");
          session.menu = "main";
          return;
        }

        session.data = { items: [], leads };

        let msg = "📄 *Generate Quotation*\n\n*Select a Lead:*\n\n";
        leads.forEach((l, i) => {
          msg += `*${i + 1}.* ${l.contactPerson} - ${l.companyName || "N/A"}\n`;
        });
        msg += "\nReply with number, or *0* to cancel.";

        session.step = 1;
        await client.sendMessage(chatId, msg);
      } catch (error) {
        await client.sendMessage(chatId, `❌ Error: ${error.message}\n\nType *menu* to go back.`);
        session.menu = "main";
      }
      break;
    }

    // Step 1: Lead selected → show products
    case 1: {
      if (text === "0") {
        session.menu = "main";
        session.step = 0;
        session.data = {};
        return "show_menu";
      }

      const leadIndex = parseInt(text) - 1;
      if (!session.data.leads || !session.data.leads[leadIndex]) {
        await client.sendMessage(chatId, "❌ Invalid selection. Enter a valid number or *0* to cancel.");
        return;
      }

      const selectedLead = session.data.leads[leadIndex];
      session.data.leadId = selectedLead._id || selectedLead.id;
      session.data.leadName = selectedLead.contactPerson;
      session.step = 2;
      await showProductSelection(client, chatId, session);
      break;
    }

    // Step 2: Product selection
    case 2: {
      if (text.toLowerCase() === "done") {
        if (session.data.items.length === 0) {
          await client.sendMessage(chatId, "❌ Add at least one product before finishing.\n\nSelect a product number or type *0* to cancel:");
          return;
        }
        session.step = 4;
        await client.sendMessage(
          chatId,
          "Select discount type:\n\n1. PERCENTAGE\n2. FLAT (fixed amount)\n0. No discount\n\nReply with number:"
        );
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
      await client.sendMessage(chatId, `Enter quantity for *${selectedProduct.name}* (Rs.${selectedProduct.price}/${selectedProduct.unit || "piece"}):`);
      break;
    }

    // Step 3: Quantity entered → add item, back to product selection
    case 3: {
      const qty = parseInt(text);
      if (isNaN(qty) || qty < 1) {
        await client.sendMessage(chatId, "❌ Invalid quantity. Enter a number >= 1:");
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

      let summary = `✅ Added: ${product.name} x ${qty} = ${formatCurrency(lineTotal)}\n\n`;
      summary += `*Items so far:*\n`;
      let runningTotal = 0;
      session.data.items.forEach((item, i) => {
        summary += `${i + 1}. ${item.productName} x${item.quantity} = ${formatCurrency(item.lineTotal)}\n`;
        runningTotal += item.lineTotal;
      });
      summary += `\n*Running Total: ${formatCurrency(runningTotal)}*\n`;
      summary += "\n*Available Products:*\n";
      session.data.products.forEach((p, i) => {
        summary += `*${i + 1}.* ${p.name} - Rs.${p.price}/${p.unit || "piece"}\n`;
      });
      summary += "\nSelect another product number, or type *done* to finish:";

      session.step = 2;
      await client.sendMessage(chatId, summary);
      break;
    }

    // Step 4: Discount type selection
    case 4: {
      if (text === "0") {
        session.data.discountType = "FLAT";
        session.data.discountValue = 0;
        await submitQuotation(client, chatId, session);
        return;
      }

      if (text === "1") {
        session.data.discountType = "PERCENTAGE";
        session.step = 5;
        await client.sendMessage(chatId, "Enter discount percentage (0-100):");
        return;
      }

      if (text === "2") {
        session.data.discountType = "FLAT";
        session.step = 5;
        await client.sendMessage(chatId, "Enter flat discount amount:");
        return;
      }

      await client.sendMessage(chatId, "Invalid option. Reply with 1, 2, or 0.");
      break;
    }

    // Step 5: Discount value
    case 5: {
      const value = parseFloat(text);
      if (isNaN(value) || value < 0) {
        await client.sendMessage(chatId, "❌ Enter a valid number:");
        return;
      }

      if (session.data.discountType === "PERCENTAGE" && value > 100) {
        await client.sendMessage(chatId, "❌ Percentage must be between 0 and 100:");
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
    await client.sendMessage(chatId, `✅ Quotation saved successfully!\n\nType *menu* to go back.`);
  } catch (error) {
    await client.sendMessage(chatId, `❌ Error: ${error.message}\n\nType *menu* to go back.`);
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
      await client.sendMessage(chatId, "❌ No products found.\n\nType *menu* to go back.");
      session.menu = "main";
      session.step = 0;
      return;
    }

    session.data.products = products;

    let text = `Lead: *${session.data.leadName}*\n\n*Select a product to add:*\n\n`;
    products.forEach((p, i) => {
      text += `*${i + 1}.* ${p.name} - Rs.${p.price}/${p.unit || "piece"}\n`;
    });
    text += "\nReply with product number.\nType *done* when finished adding products.\nType *0* to cancel.";

    await client.sendMessage(chatId, text);
  } catch (error) {
    await client.sendMessage(chatId, `❌ Error fetching products: ${error.message}\n\nType *menu* to go back.`);
    session.menu = "main";
    session.step = 0;
  }
};

module.exports = { handleQuotation };

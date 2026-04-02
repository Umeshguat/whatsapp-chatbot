const formatCurrency = (amount) => {
  return "Rs." + amount.toLocaleString("en-IN", { minimumFractionDigits: 2 });
};

const formatQuotation = (quotation) => {
  const date = new Date(quotation.createdAt || Date.now());
  const dateStr = date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  let text = "```\n";
  text += "================================\n";
  text += "         QUOTATION\n";
  text += "================================\n";
  text += `Quotation #: ${quotation.quotationNumber}\n`;
  text += `Date       : ${dateStr}\n`;
  text += `Customer   : ${quotation.customerName}\n`;
  text += "--------------------------------\n";
  text += "# | Product        | Qty | Total\n";
  text += "--------------------------------\n";

  quotation.items.forEach((item, i) => {
    const num = String(i + 1).padEnd(2);
    const name = item.productName.substring(0, 14).padEnd(14);
    const qty = String(item.quantity).padStart(3);
    const total = formatCurrency(item.lineTotal).padStart(10);
    text += `${num}| ${name} | ${qty} | ${total}\n`;
  });

  text += "--------------------------------\n";
  text += `Subtotal     : ${formatCurrency(quotation.subtotal).padStart(14)}\n`;

  if (quotation.discountPercent > 0) {
    text += `Discount(${quotation.discountPercent}%): ${formatCurrency(quotation.discountAmount).padStart(14)}\n`;
  }

  text += "--------------------------------\n";
  text += `GRAND TOTAL  : ${formatCurrency(quotation.grandTotal).padStart(14)}\n`;
  text += "================================\n";
  text += "  Thank you for your business!\n";
  text += "================================\n";
  text += "```";

  return text;
};

const formatLeadSummary = (lead) => {
  return (
    `*Lead Details*\n` +
    `Name    : ${lead.contactPerson}\n` +
    `Phone   : ${lead.phone || "N/A"}\n` +
    `Email   : ${lead.email}\n` +
    `Company : ${lead.companyName}\n` +
    `Source  : ${lead.source}\n` +
    `Stage   : ${lead.stage}\n` +
    `Added   : ${new Date(lead.createdAt).toLocaleDateString("en-IN")}`
  );
};

const formatProductList = (products) => {
  if (!products.length) return "No products found.";

  let text = "*Product Catalog:*\n\n";
  products.forEach((p, i) => {
    text += `*${i + 1}.* ${p.name}\n`;
    text += `   Price: ${formatCurrency(p.price)}/${p.unit}\n`;
    if (p.description) text += `   ${p.description}\n`;
    text += "\n";
  });

  return text;
};

module.exports = { formatQuotation, formatLeadSummary, formatProductList, formatCurrency };

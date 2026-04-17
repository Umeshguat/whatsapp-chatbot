const { MessageMedia } = require("whatsapp-web.js");
const apiClient = require("../utils/apiClient");
const { formatQuotation, formatLeadSummary } = require("../utils/formatter");
const {
  analyzeMessage,
  extractLeadDetails,
  matchProductsToServices,
} = require("../services/openaiService");

const REQUIRED_FIELDS = ["contactPerson", "phone", "email", "companyName"];

const mergeExtracted = (current, incoming) => {
  if (!incoming) return current;
  for (const f of REQUIRED_FIELDS) {
    if (!current[f] && incoming[f]) current[f] = incoming[f];
  }
  const newServices = Array.isArray(incoming.interestedProducts)
    ? incoming.interestedProducts
    : [];
  if (newServices.length) {
    current.interestedProducts = [
      ...(current.interestedProducts || []),
      ...newServices,
    ];
  }
  return current;
};

const missingFields = (data) =>
  REQUIRED_FIELDS.filter((f) => !data[f]);

const needsService = (data) =>
  data.intent === "create_quote" &&
  (!data.interestedProducts || data.interestedProducts.length === 0);

const isReady = (data) => missingFields(data).length === 0 && !needsService(data);

const startAiFlow = async (client, msg, session) => {
  const chatId = msg.from;
  const text = msg.body.trim();

  const analysis = await analyzeMessage(text, chatId);
  if (!analysis) {
    await client.sendMessage(
      chatId,
      `I had trouble understanding that. 🤔 Could you try again?`
    );
    return;
  }

  session.menu = "ai_flow";
  session.step = 1;
  session.data = {
    intent: analysis.intent,
    ...analysis.extractedData,
    interestedProducts: analysis.extractedData?.interestedProducts || [],
  };

  if (analysis.intent === "casual") {
    await client.sendMessage(chatId, analysis.reply);
    session.menu = "greeting";
    session.step = 0;
    return;
  }

  await client.sendMessage(chatId, analysis.reply);

  if (isReady(session.data)) {
    await finalizeLeadAndQuote(client, chatId, session);
  }
};

const handleAiFlow = async (client, msg, session) => {
  const chatId = msg.from;
  const text = msg.body.trim();

  const extraction = await extractLeadDetails(text, session.data);
  if (!extraction) {
    await client.sendMessage(
      chatId,
      `Sorry, I couldn't process that. Could you rephrase? 🙂`
    );
    return;
  }

  mergeExtracted(session.data, extraction.extractedData);

  await client.sendMessage(chatId, extraction.reply);

  if (isReady(session.data)) {
    await finalizeLeadAndQuote(client, chatId, session);
  }
};

const finalizeLeadAndQuote = async (client, chatId, session) => {
  try {
    const leadPayload = {
      contactPerson: session.data.contactPerson,
      phone: session.data.phone,
      email: session.data.email,
      companyName: session.data.companyName,
      source: "WhatsApp",
    };

    const leadResult = await apiClient.post("/api/v1/public/leads", leadPayload);
    console.log("Lead API response:", JSON.stringify(leadResult, null, 2));

    const serverLead =
      leadResult?.data?.lead ||
      leadResult?.lead ||
      leadResult?.data ||
      leadResult ||
      {};
    const leadId = serverLead._id || serverLead.id;
    const leadName = session.data.contactPerson;

    const leadSummary = {
      contactPerson: session.data.contactPerson,
      phone: session.data.phone,
      email: session.data.email,
      companyName: session.data.companyName,
      source: leadPayload.source,
      stage: serverLead.stage || "New",
      createdAt: serverLead.createdAt || new Date(),
    };

    await client.sendMessage(
      chatId,
      `${formatLeadSummary(leadSummary)}\n\n✅ Lead saved!`
    );

    const wantsQuote =
      session.data.intent === "create_quote" ||
      (session.data.interestedProducts || []).length > 0;

    if (!wantsQuote) {
      await client.sendMessage(
        chatId,
        `Thanks! We'll be in touch soon. 😊\n\nType *hi* anytime.`
      );
      resetSession(session);
      return;
    }

    await generateQuotationFromServices(client, chatId, session, leadId, leadName);
  } catch (error) {
    console.error("finalizeLeadAndQuote error:", error);
    await client.sendMessage(
      chatId,
      `❌ Oops, couldn't save the lead: ${error.message}\n\nType *hi* to retry.`
    );
    resetSession(session);
  }
};

const generateQuotationFromServices = async (client, chatId, session, leadId, leadName) => {
  try {
    const productsResult = await apiClient.get(
      "/api/v1/public/products?page=1&limit=50"
    );
    const products =
      productsResult.data?.products ||
      productsResult.data ||
      productsResult.products ||
      [];

    if (!products.length) {
      await client.sendMessage(
        chatId,
        `⚠️ No products in catalog right now. We'll get back to you manually.`
      );
      resetSession(session);
      return;
    }

    const match = await matchProductsToServices(
      session.data.interestedProducts,
      products
    );

    if (!match || !match.matches || match.matches.length === 0) {
      await client.sendMessage(
        chatId,
        `I couldn't match the services you mentioned to our catalog. Our team will contact you for a custom quote. 🙂`
      );
      resetSession(session);
      return;
    }

    const items = match.matches
      .map((m) => {
        const p = products.find(
          (pp) => String(pp._id || pp.id) === String(m.productId)
        );
        if (!p) return null;
        const qty = Number(m.quantity) || 1;
        return {
          product: String(p._id || p.id),
          productName: p.name,
          unitPrice: p.price,
          quantity: qty,
          lineTotal: p.price * qty,
        };
      })
      .filter(Boolean);

    if (!items.length) {
      await client.sendMessage(
        chatId,
        `I couldn't build a quote from the services mentioned. Our team will reach out. 🙂`
      );
      resetSession(session);
      return;
    }

    if (match.unmatched && match.unmatched.length) {
      await client.sendMessage(
        chatId,
        `ℹ️ Note: we couldn't auto-price these — ${match.unmatched.join(", ")}. Our team will add them manually.`
      );
    }

    const payload = {
      lead: String(leadId),
      items: items.map((i) => ({
        product: String(i.product),
        quantity: Number(i.quantity),
        unitPrice: Number(i.unitPrice),
      })),
      discountType: "FLAT",
      discountValue: 0,
      status: "DRAFT",
    };

    const result = await apiClient.post("/api/v1/quotations/generate", payload);
    const quotation = result.data || result;

    const displayData = {
      quotationNumber: quotation.quotationNumber || quotation._id || "N/A",
      customerName: leadName,
      items,
      subtotal:
        quotation.subtotal || items.reduce((s, i) => s + i.lineTotal, 0),
      discountPercent: 0,
      discountAmount: quotation.discountAmount || 0,
      grandTotal: quotation.total || quotation.grandTotal || 0,
      createdAt: quotation.createdAt || new Date(),
    };

    await client.sendMessage(chatId, formatQuotation(displayData));

    const quotationId = quotation._id || quotation.id;
    try {
      const pdfBuffer = await apiClient.getBuffer(
        `/api/v1/public/quotations/${quotationId}/pdf`
      );
      const pdfMedia = new MessageMedia(
        "application/pdf",
        pdfBuffer.toString("base64"),
        `Quotation_${displayData.quotationNumber}.pdf`
      );
      await client.sendMessage(chatId, pdfMedia, {
        caption: `📎 Here's your quotation PDF!`,
      });
    } catch (pdfError) {
      console.error("PDF fetch error:", pdfError.message);
      await client.sendMessage(
        chatId,
        `⚠️ Quotation created but couldn't fetch the PDF.`
      );
    }

    await client.sendMessage(
      chatId,
      `🎉 All done!\n\nType *hi* to start again.`
    );
  } catch (error) {
    console.error("generateQuotationFromServices error:", error);
    await client.sendMessage(
      chatId,
      `❌ Couldn't generate quotation: ${error.message}\n\nType *hi* to retry.`
    );
  }
  resetSession(session);
};

const resetSession = (session) => {
  session.menu = "main";
  session.step = 0;
  session.data = {};
};

module.exports = { startAiFlow, handleAiFlow };

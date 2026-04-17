const OpenAI = require("openai");

let openai = null;

const getClient = () => {
  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openai;
};

const SYSTEM_COMPANY_CONTEXT = `You are a lead + quotation assistant for a digital services company. We offer:
- SEO Services
- Website Development / Website Design
- Mobile App Development (Android / iOS)
- Digital Marketing
- Social Media Marketing
- Graphic Design / Logo Design
- Content Writing
- E-commerce Solutions
- Software Development
- Hosting / Domain`;

/**
 * Analyze a free-form WhatsApp message and extract intent + lead data
 * + interested services/products in one shot.
 */
const analyzeMessage = async (message, senderPhone) => {
  try {
    const response = await getClient().chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `${SYSTEM_COMPANY_CONTEXT}

Analyze the incoming WhatsApp message. Decide the user's intent and pull out every piece of contact / business data you can.

Intents:
- "create_quote"  → user wants a price/quote/proposal/estimate for a service
- "add_lead"      → user wants to register / share their details / be contacted
- "casual"        → greeting, chit-chat, or irrelevant

For interestedProducts: pull out EVERY service or product mentioned. Infer quantity (default 1 if not said). Use the service name the user spoke, not our catalog (matching happens separately).

Respond ONLY in this exact JSON (no markdown):
{
  "intent": "create_quote" | "add_lead" | "casual",
  "confidence": "high" | "medium" | "low",
  "extractedData": {
    "contactPerson": "full name if mentioned, else null",
    "phone": "phone if mentioned, else null",
    "email": "email if mentioned, else null",
    "companyName": "company if mentioned, else null",
    "interestedProducts": [ { "service": "e.g. Website Development", "quantity": 1 } ]
  },
  "reply": "Short, friendly WhatsApp acknowledgement. If intent is create_quote or add_lead and fields are missing, ask ONLY for what's missing (name / phone / email / company). If intent is create_quote and no service was named, also ask which service they need. Keep it one short paragraph."
}`,
        },
        {
          role: "user",
          content: `Message from ${senderPhone}:\n"${message}"`,
        },
      ],
    });

    const content = response.choices[0].message.content.trim();
    console.log("OpenAI analyze:", content);
    return JSON.parse(content);
  } catch (error) {
    console.error("OpenAI analyze error:", error.message);
    return null;
  }
};

/**
 * Extract more fields from a follow-up reply given what we already have.
 * Also appends any newly mentioned services.
 */
const extractLeadDetails = async (message, existingData) => {
  try {
    const missing = [];
    if (!existingData.contactPerson) missing.push("name");
    if (!existingData.phone) missing.push("phone number");
    if (!existingData.email) missing.push("email address");
    if (!existingData.companyName) missing.push("company name");

    const response = await getClient().chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `${SYSTEM_COMPANY_CONTEXT}

We are collecting lead details from a user via WhatsApp.
Already collected: ${JSON.stringify(existingData)}
Still missing contact fields: ${missing.join(", ") || "none"}
Intent: ${existingData.intent || "unknown"}
Services already captured: ${JSON.stringify(existingData.interestedProducts || [])}

From the user's latest message, extract any of the missing contact fields AND any new services/products they mention.

Respond ONLY in this JSON:
{
  "extractedData": {
    "contactPerson": "name if found, else null",
    "phone": "phone if found, else null",
    "email": "email if found, else null",
    "companyName": "company if found, else null",
    "interestedProducts": [ { "service": "...", "quantity": 1 } ]
  },
  "isComplete": true/false,
  "reply": "Friendly short WhatsApp reply. If contact fields are still missing, ask only for those. If intent is create_quote and no service is captured yet, also ask which service they need. If all fields are filled AND (intent is add_lead OR at least one service is captured), confirm we are preparing everything."
}`,
        },
        { role: "user", content: message },
      ],
    });

    const content = response.choices[0].message.content.trim();
    console.log("OpenAI extract:", content);
    return JSON.parse(content);
  } catch (error) {
    console.error("OpenAI extract error:", error.message);
    return null;
  }
};

/**
 * Map the user's interested services to actual products from the catalog.
 * Returns an array of { productId, quantity } picked from availableProducts.
 */
const matchProductsToServices = async (interestedProducts, availableProducts) => {
  try {
    const catalog = availableProducts.map((p) => ({
      id: String(p._id || p.id),
      name: p.name,
      description: p.description || "",
      price: p.price,
      unit: p.unit || "piece",
    }));

    const response = await getClient().chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You match requested services to a product catalog.

Available catalog (JSON):
${JSON.stringify(catalog, null, 2)}

For each requested service, pick the single BEST matching product id from the catalog. If nothing matches reasonably, skip it. Use the quantity given by the user (default 1).

Respond ONLY in this JSON:
{
  "matches": [ { "productId": "<id from catalog>", "quantity": 1, "matchedFor": "requested service string" } ],
  "unmatched": [ "requested services that had no good match" ]
}`,
        },
        {
          role: "user",
          content: `Requested:\n${JSON.stringify(interestedProducts, null, 2)}`,
        },
      ],
    });

    const content = response.choices[0].message.content.trim();
    console.log("OpenAI match:", content);
    return JSON.parse(content);
  } catch (error) {
    console.error("OpenAI match error:", error.message);
    return null;
  }
};

module.exports = { analyzeMessage, extractLeadDetails, matchProductsToServices };

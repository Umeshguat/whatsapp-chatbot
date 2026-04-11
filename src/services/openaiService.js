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

/**
 * Analyze a WhatsApp message using OpenAI to detect lead intent
 * and extract available contact/service information.
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
          content: `You are a lead qualification assistant for a digital services company that offers:
- SEO Services
- Website Development
- Mobile App Development
- Digital Marketing
- Social Media Marketing
- Graphic Design
- Content Writing
- E-commerce Solutions

Analyze the incoming WhatsApp message and determine:
1. Is this person interested in any service? (lead intent)
2. Extract any available information: name, phone, email, company name, services they're interested in.

Respond ONLY in this exact JSON format (no markdown, no extra text):
{
  "isLead": true/false,
  "confidence": "high"/"medium"/"low",
  "extractedData": {
    "contactPerson": "name if mentioned, otherwise null",
    "phone": "phone if mentioned, otherwise null",
    "email": "email if mentioned, otherwise null",
    "companyName": "company if mentioned, otherwise null",
    "interestedServices": ["list of services they asked about"],
    "message": "original message summary"
  },
  "reply": "A friendly, professional reply acknowledging their interest and asking for any missing information (name, phone, email, company) to create a lead. Keep it short and conversational for WhatsApp."
}

If the message is NOT a lead (just casual chat, spam, or irrelevant), set isLead to false and provide a friendly reply.`,
        },
        {
          role: "user",
          content: `WhatsApp message from ${senderPhone}:\n"${message}"`,
        },
      ],
    });

    const content = response.choices[0].message.content.trim();
    console.log("OpenAI analysis response:", content);
    const parsed = JSON.parse(content);
    return parsed;
  } catch (error) {
    console.error("OpenAI analysis error:", error.message);
    if (error.response) {
      console.error("OpenAI API status:", error.response.status);
    }
    return null;
  }
};

/**
 * Extract remaining lead fields from a follow-up message
 * when we already have partial data.
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
          content: `You are extracting contact details from a WhatsApp message.
We already have this data: ${JSON.stringify(existingData)}
We still need: ${missing.join(", ")}

Extract any of the missing fields from the user's message.

Respond ONLY in this exact JSON format:
{
  "extractedData": {
    "contactPerson": "name if found, otherwise null",
    "phone": "phone if found, otherwise null",
    "email": "email if found, otherwise null",
    "companyName": "company if found, otherwise null"
  },
  "isComplete": true/false,
  "reply": "If all fields are now filled, confirm the details. If still missing fields, ask for the remaining ones in a friendly WhatsApp message."
}`,
        },
        {
          role: "user",
          content: message,
        },
      ],
    });

    const content = response.choices[0].message.content.trim();
    console.log("OpenAI extraction response:", content);
    return JSON.parse(content);
  } catch (error) {
    console.error("OpenAI extraction error:", error.message);
    if (error.response) {
      console.error("OpenAI API status:", error.response.status);
    }
    return null;
  }
};

module.exports = { analyzeMessage, extractLeadDetails };

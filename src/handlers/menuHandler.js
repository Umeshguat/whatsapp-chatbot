const { handleAddLead, handleViewLeads } = require("./leadHandler");
const { handleQuotation } = require("./quotationHandler");
const { handleProductMenu } = require("./productHandler");

const sessions = new Map();

const getSession = (chatId) => {
  if (!sessions.has(chatId)) {
    sessions.set(chatId, { menu: "main", step: 0, data: {} });
  }
  return sessions.get(chatId);
};

// Extract choice number from any format: "1", "1️⃣", "1️⃣ Add Lead", "1. Add Lead", "Add Lead"
const parseMenuChoice = (text) => {
  const clean = text.trim().toLowerCase();

  // Direct number match
  if (/^[0-9]$/.test(clean)) return clean;

  // Extract leading number from text like "1️⃣ Add Lead", "1. Add Lead", "1 Add Lead"
  const numMatch = clean.match(/^(\d)/);
  if (numMatch) return numMatch[1];

  // Match by keyword
  if (clean.includes("add lead")) return "1";
  if (clean.includes("view lead")) return "2";
  if (clean.includes("quotation") || clean.includes("quote")) return "3";
  if (clean.includes("product")) return "4";
  if (clean.includes("help")) return "5";

  return clean;
};

const MAIN_MENU_TEXT =
  `🤖 *WhatsApp Business Bot*\n\n` +
  `Please select an option:\n\n` +
  `1️⃣ Add Lead\n` +
  `2️⃣ View Leads\n` +
  `3️⃣ Generate Quotation\n` +
  `4️⃣ Manage Products\n` +
  `5️⃣ Help\n\n` +
  `Reply with the number of your choice.`;

const HELP_TEXT =
  `📖 *Help Guide*\n\n` +
  `This bot helps you manage leads and generate quotations.\n\n` +
  `*Commands:*\n` +
  `• Type *menu* - Show main menu\n` +
  `• Type *0* or *back* - Go back\n` +
  `• Type *hi/hello* - Start conversation\n\n` +
  `*Features:*\n` +
  `• *Add Lead* - Save new lead with name, phone, email, company\n` +
  `• *View Leads* - See recent leads and update their status\n` +
  `• *Generate Quotation* - Select products, set quantities, apply discounts\n` +
  `• *Manage Products* - View catalog and add new products\n\n` +
  `Type *menu* to get started.`;

const menuHandler = async (client, msg) => {
  // Ignore group messages and status updates
  if (msg.from.includes("@g.us") || msg.from === "status@broadcast") return;

  // Skip empty messages
  if (!msg.body || !msg.body.trim()) return;

  const chatId = msg.from;
  const text = msg.body.trim().toLowerCase();
  const session = getSession(chatId);

  // Global commands - reset to main menu
  const greetings = ["menu", "hi", "hii", "hiii", "hello", "helo", "start", "hey", "heyy", "hola", "namaste", "yo"];
  if (greetings.includes(text) || (text.startsWith("hi") && text.length <= 5)) {
    session.menu = "main";
    session.step = 0;
    session.data = {};
    await client.sendMessage(chatId, MAIN_MENU_TEXT);
    return;
  }

  // Back command
  if (text === "back") {
    session.menu = "main";
    session.step = 0;
    session.data = {};
    await client.sendMessage(chatId, MAIN_MENU_TEXT);
    return;
  }

  // "0" goes back only when in main menu (not during quotation/lead/product flows)
  if (text === "0" && session.menu === "main") {
    await client.sendMessage(chatId, MAIN_MENU_TEXT);
    return;
  }

  // Route based on current menu
  switch (session.menu) {
    case "main":
      await handleMainMenu(client, msg, session);
      break;

    case "lead_add":
      await handleAddLead(client, msg, session);
      break;

    case "lead_view":
      const result = await handleViewLeads(client, msg, session);
      if (result === "show_menu") {
        await client.sendMessage(chatId, MAIN_MENU_TEXT);
      }
      break;

    case "quotation":
      const quotResult = await handleQuotation(client, msg, session);
      if (quotResult === "show_menu") {
        await client.sendMessage(chatId, MAIN_MENU_TEXT);
      }
      break;

    case "product":
      const prodResult = await handleProductMenu(client, msg, session);
      if (prodResult === "show_menu") {
        await client.sendMessage(chatId, MAIN_MENU_TEXT);
      }
      break;

    default:
      await client.sendMessage(chatId, MAIN_MENU_TEXT);
      break;
  }
};

const handleMainMenu = async (client, msg, session) => {
  const chatId = msg.from;
  const choice = parseMenuChoice(msg.body.trim());

  switch (choice) {
    case "1":
      session.menu = "lead_add";
      session.step = 0;
      await handleAddLead(client, msg, session);
      break;

    case "2":
      session.menu = "lead_view";
      session.step = 0;
      session.data = {};
      await handleViewLeads(client, msg, session);
      break;

    case "3":
      session.menu = "quotation";
      session.step = 0;
      await handleQuotation(client, msg, session);
      break;

    case "4":
      session.menu = "product";
      session.step = 0;
      await handleProductMenu(client, msg, session);
      break;

    case "5":
      await client.sendMessage(chatId, HELP_TEXT);
      break;

    default:
      await client.sendMessage(
        chatId,
        "❌ Invalid option. Please reply with a number (1-5) or type *menu*."
      );
      break;
  }
};

module.exports = menuHandler;

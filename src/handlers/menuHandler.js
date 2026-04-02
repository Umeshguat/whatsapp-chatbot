const { List } = require("whatsapp-web.js");
const { handleAddLead, handleViewLeads } = require("./leadHandler");
const { handleQuotation } = require("./quotationHandler");
const { handleProductMenu, handleAddProduct } = require("./productHandler");

const sessions = new Map();

const getSession = (chatId) => {
  if (!sessions.has(chatId)) {
    sessions.set(chatId, { menu: "main", step: 0, data: {} });
  }
  return sessions.get(chatId);
};

// Extract row ID from list response or fall back to message body
const getSelectedId = (msg) => {
  if (msg.type === "list_response") {
    const rowId =
      msg.selectedRowId ||
      (msg._data &&
        msg._data.listResponse &&
        msg._data.listResponse.singleSelectReply &&
        msg._data.listResponse.singleSelectReply.selectedRowId);
    if (rowId) return rowId;
  }
  return msg.body ? msg.body.trim() : "";
};

const sendMainMenu = async (client, chatId) => {
  const list = new List(
    "Please select an option from the menu below:",
    "View Menu",
    [
      {
        title: "Main Menu",
        rows: [
          { id: "menu_1", title: "Add Lead", description: "Save a new lead with contact details" },
          { id: "menu_2", title: "View Leads", description: "See recent leads and update status" },
          { id: "menu_3", title: "Generate Quotation", description: "Create quotation with products" },
          { id: "menu_4", title: "Manage Products", description: "View catalog and add products" },
          { id: "menu_5", title: "Help", description: "View help guide and commands" },
        ],
      },
    ],
    "🤖 WhatsApp Business Bot",
    "Reply with a number or tap to select"
  );
  await client.sendMessage(chatId, list);
};

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

  // Skip empty messages (but allow list_response which may have empty body)
  if (msg.type !== "list_response" && (!msg.body || !msg.body.trim())) return;

  const chatId = msg.from;
  const text = msg.body ? msg.body.trim().toLowerCase() : "";
  const selectedId = getSelectedId(msg);
  const session = getSession(chatId);

  // Global commands - reset to main menu
  const greetings = ["menu", "hi", "hii", "hiii", "hello", "helo", "start", "hey", "heyy", "hola", "namaste", "yo"];
  if (greetings.includes(text) || (text.startsWith("hi") && text.length <= 5)) {
    session.menu = "main";
    session.step = 0;
    session.data = {};
    await sendMainMenu(client, chatId);
    return;
  }

  // Back command
  if (text === "back") {
    session.menu = "main";
    session.step = 0;
    session.data = {};
    await sendMainMenu(client, chatId);
    return;
  }

  // "0" goes back only when in main menu (not during quotation/lead/product flows)
  if (text === "0" && session.menu === "main") {
    await sendMainMenu(client, chatId);
    return;
  }

  // Attach selectedId to msg for handlers to use
  msg._selectedId = selectedId;

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
        await sendMainMenu(client, chatId);
      }
      break;

    case "quotation":
      await handleQuotation(client, msg, session);
      break;

    case "product":
      const prodResult = await handleProductMenu(client, msg, session);
      if (prodResult === "show_menu") {
        await sendMainMenu(client, chatId);
      }
      break;

    case "product_add":
      await handleAddProduct(client, msg, session);
      break;

    default:
      await sendMainMenu(client, chatId);
      break;
  }
};

const handleMainMenu = async (client, msg, session) => {
  const chatId = msg.from;
  const text = msg.body ? msg.body.trim() : "";
  const selectedId = msg._selectedId || text;

  // Map list selection IDs to menu choices
  const choice =
    selectedId === "menu_1" ? "1" :
    selectedId === "menu_2" ? "2" :
    selectedId === "menu_3" ? "3" :
    selectedId === "menu_4" ? "4" :
    selectedId === "menu_5" ? "5" :
    text;

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
module.exports.sendMainMenu = sendMainMenu;

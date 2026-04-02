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

const HELP_TEXT =
  `📖 *Help Guide*\n\n` +
  `This bot helps you manage your leads.\n\n` +
  `*Commands:*\n` +
  `• Type *hi/hello* - Start conversation\n` +
  `• Type *menu* - Show main menu\n` +
  `• Type *back* - Go back\n\n` +
  `*What I can do:*\n` +
  `• *Add Lead* - Save new lead with name, phone, email, company\n\n` +
  `Type *hi* to get started.`;

const menuHandler = async (client, msg) => {
  // Ignore group messages and status updates
  if (msg.from.includes("@g.us") || msg.from === "status@broadcast") return;

  // Skip empty messages
  if (!msg.body || !msg.body.trim()) return;

  const chatId = msg.from;
  const text = msg.body.trim().toLowerCase();
  const session = getSession(chatId);

  // Menu command
  if (text === "menu") {
    session.menu = "greeting";
    session.step = 0;
    session.data = {};

    const ASK_LEAD_TEXT =
      `🤖 *WhatsApp Business Bot*\n\n` +
      `Would you like to add a new lead? 📝\n\n` +
      `Reply *Yes* to add a lead\n` +
      `Reply *Help* for assistance`;

    await client.sendMessage(chatId, ASK_LEAD_TEXT);
    return;
  }

  // Greeting messages - welcome first, then ask about adding lead
  const greetings = ["hi", "hii", "hiii", "hello", "helo", "start", "hey", "heyy", "hola", "namaste", "yo"];
  if (greetings.includes(text) || (text.startsWith("hi") && text.length <= 5)) {
    session.menu = "greeting";
    session.step = 0;
    session.data = {};

    const GREETING_TEXT =
      `👋 *Hello! Welcome to our WhatsApp Business Assistant!*\n\n` +
      `We're glad you reached out. 😊\n` +
      `I'm here to help you with our services.\n\n` +
      `Would you like to add a new lead? 📝\n\n` +
      `Reply *Yes* to add a lead\n` +
      `Reply *Help* for assistance`;

    await client.sendMessage(chatId, GREETING_TEXT);
    return;
  }

  // Back command
  if (text === "back") {
    session.menu = "greeting";
    session.step = 0;
    session.data = {};

    await client.sendMessage(
      chatId,
      `Would you like to add a new lead? 📝\n\nReply *Yes* to add a lead\nReply *Help* for assistance`
    );
    return;
  }

  // Route based on current menu
  switch (session.menu) {
    case "greeting":
      await handleGreetingResponse(client, msg, session);
      break;

    case "lead_add":
      await handleAddLead(client, msg, session);
      break;

    case "ask_quotation":
      await handleAskQuotationResponse(client, msg, session);
      break;

    case "quotation":
      await handleQuotation(client, msg, session);
      break;

    case "lead_view":
      const result = await handleViewLeads(client, msg, session);
      if (result === "show_menu") {
        await client.sendMessage(
          chatId,
          `Would you like to add a new lead? 📝\n\nReply *Yes* to add a lead\nReply *Help* for assistance`
        );
      }
      break;

    case "product":
      const prodResult = await handleProductMenu(client, msg, session);
      if (prodResult === "show_menu") {
        await client.sendMessage(
          chatId,
          `Would you like to add a new lead? 📝\n\nReply *Yes* to add a lead\nReply *Help* for assistance`
        );
      }
      break;

    default:
      // First time or unknown state - greet them
      await client.sendMessage(
        chatId,
        `👋 Hi there! Type *hi* or *hello* to get started.`
      );
      break;
  }
};

const handleGreetingResponse = async (client, msg, session) => {
  const chatId = msg.from;
  const text = msg.body.trim().toLowerCase();

  // Yes responses - start add lead flow
  const yesResponses = ["yes", "yep", "yeah", "y", "sure", "ok", "okay", "haan", "ha", "1"];
  if (yesResponses.includes(text)) {
    session.menu = "lead_add";
    session.step = 0;
    await handleAddLead(client, msg, session);
    return;
  }

  // Help
  if (text === "help" || text === "2") {
    await client.sendMessage(chatId, HELP_TEXT);
    return;
  }

  // No responses
  const noResponses = ["no", "nope", "nah", "n", "nahi"];
  if (noResponses.includes(text)) {
    await client.sendMessage(
      chatId,
      `No worries! 😊\n\nFeel free to type *hi* anytime you need help.\nOr type *help* for more information.`
    );
    return;
  }

  // Invalid input
  await client.sendMessage(
    chatId,
    `I didn't quite get that. 🤔\n\nReply *Yes* to add a lead\nReply *Help* for assistance\nOr type *hi* to start over.`
  );
};

const handleAskQuotationResponse = async (client, msg, session) => {
  const chatId = msg.from;
  const text = msg.body.trim().toLowerCase();

  // Yes - start quotation flow with the lead already selected
  const yesResponses = ["yes", "yep", "yeah", "y", "sure", "ok", "okay", "haan", "ha"];
  if (yesResponses.includes(text)) {
    const leadId = session.data.leadId;
    const leadName = session.data.leadName;
    session.menu = "quotation";
    session.step = 0;
    session.data = { items: [], leadId, leadName };
    await handleQuotation(client, msg, session);
    return;
  }

  // No - end conversation
  const noResponses = ["no", "nope", "nah", "n", "nahi"];
  if (noResponses.includes(text)) {
    session.menu = "main";
    session.step = 0;
    session.data = {};
    await client.sendMessage(
      chatId,
      `No worries! Thank you for your time. 😊\n\nFeel free to type *hi* anytime you need help.`
    );
    return;
  }

  // Invalid input
  await client.sendMessage(
    chatId,
    `I didn't quite get that. 🤔\n\nReply *Yes* to generate a quotation\nReply *No* to finish`
  );
};

module.exports = menuHandler;

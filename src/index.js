require("dotenv").config();

const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const express = require("express");
const connectDB = require("./config/db");
const menuHandler = require("./handlers/menuHandler");

const app = express();
const PORT = process.env.PORT || 3000;

// WhatsApp Client
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  },
});

// QR Code for authentication
client.on("qr", (qr) => {
  console.log("Scan the QR code below to login:");
  qrcode.generate(qr, { small: true });
});

// Ready
client.on("ready", () => {
  console.log("✅ WhatsApp Client is ready!");
  console.log("Bot is now listening for messages...");
});

// Handle incoming messages
// "message" = messages from others only
// "message_create" = all messages including your own (for self-chat testing)
const allowSelfChat = process.env.ALLOW_SELF_CHAT === "true";

client.on("message_create", async (msg) => {
  try {
    // If self-chat is enabled, respond to your own messages sent to yourself
    if (msg.fromMe) {
      if (!allowSelfChat) return; // skip own messages when self-chat disabled
      // Only respond to self-chat (messages to yourself), not messages you send to others
      if (msg.to !== msg.from) return;
    }

    await menuHandler(client, msg);
  } catch (error) {
    console.error("Message handler error:", error);
    try {
      await client.sendMessage(msg.from, "❌ Something went wrong. Type *menu* to restart.");
    } catch (e) {
      console.error("Failed to send error message:", e);
    }
  }
});

// Authentication failure
client.on("auth_failure", (error) => {
  console.error("Authentication failed:", error);
});

// Disconnected
client.on("disconnected", (reason) => {
  console.log("Client disconnected:", reason);
  console.log("Attempting to reconnect...");
  client.initialize();
});

// Health check endpoint
app.get("/", (req, res) => {
  res.json({ status: "running", bot: "WhatsApp Chatbot" });
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Start
const start = async () => {
  await connectDB();
  console.log("Initializing WhatsApp client...");
  client.initialize();

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

start().catch(console.error);

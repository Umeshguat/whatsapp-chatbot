require("dotenv").config();

const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const express = require("express");
const menuHandler = require("./handlers/menuHandler");

const app = express();
const PORT = process.env.PORT || 3000;

// WhatsApp Client with stability fixes
const client = new Client({
  authStrategy: new LocalAuth(),
  webVersionCache: {
    type: "remote",
    remotePath:
      "https://raw.githubusercontent.com/nicedeveloper/nicedeveloper.github.io/main/nicedeveloper.github.io/nicedeveloper/nicedeveloper_web_version",
  },
  puppeteer: {
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--no-first-run",
      "--disable-gpu",
    ],
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
const allowSelfChat = process.env.ALLOW_SELF_CHAT === "true";

client.on("message_create", async (msg) => {
  try {
    if (msg.fromMe) {
      if (!allowSelfChat) return;
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

// Disconnected - reconnect with delay
client.on("disconnected", (reason) => {
  console.log("Client disconnected:", reason);
  console.log("Reconnecting in 5 seconds...");
  setTimeout(() => {
    client.initialize();
  }, 5000);
});

app.use(express.json());

// Health check endpoint
app.get("/", (req, res) => {
  res.json({ status: "running", bot: "WhatsApp Chatbot" });
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Send a message to a phone number (one-way, no bot reply)
app.post("/api/send-test", async (req, res) => {
  try {
    const { phone, message } = req.body;

    if (!phone || !message) {
      return res.status(400).json({ success: false, message: "phone and message are required" });
    }

    const chatId = phone.includes("@c.us") ? phone : `${phone}@c.us`;

    const state = await client.getState();
    if (state !== "CONNECTED") {
      return res.status(503).json({ success: false, message: "WhatsApp client not connected" });
    }

    await client.sendMessage(chatId, message);
    res.json({ success: true, message: `Message sent to ${chatId}` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Simulate incoming message — bot processes it and replies on WhatsApp
app.post("/api/simulate", async (req, res) => {
  try {
    const { phone, message } = req.body;

    if (!phone || !message) {
      return res.status(400).json({ success: false, message: "phone and message are required" });
    }

    const chatId = phone.includes("@c.us") ? phone : `${phone}@c.us`;

    const state = await client.getState();
    if (state !== "CONNECTED") {
      return res.status(503).json({ success: false, message: "WhatsApp client not connected" });
    }

    const fakeMsg = {
      from: chatId,
      to: chatId,
      body: message,
      fromMe: false,
      type: "chat",
    };

    await menuHandler(client, fakeMsg);
    res.json({ success: true, message: `Bot replied to ${chatId} for: "${message}"` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Start
const start = async () => {
  console.log("Initializing WhatsApp client...");
  client.initialize();

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

start().catch(console.error);

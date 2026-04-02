const Lead = require("../models/Lead");
const { formatLeadSummary } = require("../utils/formatter");

const SOURCE_MAP = {
  "1": "WhatsApp",
  "2": "Website",
  "3": "Referral",
  "4": "Cold Call",
  "5": "Other",
};

const handleAddLead = async (client, msg, session) => {
  const chatId = msg.from;
  const text = msg.body.trim();

  switch (session.step) {
    case 0:
      session.step = 1;
      session.data = {};
      await client.sendMessage(chatId, "📋 *Add New Lead*\n\nEnter lead name:");
      break;

    case 1:
      session.data.name = text;
      session.step = 2;
      await client.sendMessage(chatId, "Enter phone number:");
      break;

    case 2:
      session.data.phone = text;
      session.step = 3;
      await client.sendMessage(chatId, "Enter email (or type *skip*):");
      break;

    case 3:
      session.data.email = text.toLowerCase() === "skip" ? "" : text;
      session.step = 4;
      await client.sendMessage(chatId, "Enter company name (or type *skip*):");
      break;

    case 4:
      session.data.company = text.toLowerCase() === "skip" ? "" : text;
      session.step = 5;
      await client.sendMessage(
        chatId,
        "Select lead source:\n1. WhatsApp\n2. Website\n3. Referral\n4. Cold Call\n5. Other\n\nReply with number:"
      );
      break;

    case 5:
      session.data.source = SOURCE_MAP[text] || "WhatsApp";
      session.data.createdBy = chatId;

      try {
        const lead = await Lead.create(session.data);
        await client.sendMessage(
          chatId,
          `✅ *Lead Added Successfully!*\n\n${formatLeadSummary(lead)}\n\nType *menu* to go back.`
        );
      } catch (error) {
        await client.sendMessage(chatId, `❌ Error: ${error.message}\n\nType *menu* to go back.`);
      }

      session.menu = "main";
      session.step = 0;
      session.data = {};
      break;
  }
};

const handleViewLeads = async (client, msg, session) => {
  const chatId = msg.from;
  const text = msg.body.trim();

  if (session.step === 0) {
    try {
      const leads = await Lead.find().sort({ createdAt: -1 }).limit(10);
      const total = await Lead.countDocuments();

      if (!leads.length) {
        await client.sendMessage(chatId, "No leads found.\n\nType *menu* to go back.");
        session.menu = "main";
        return;
      }

      let list = `📋 *Recent Leads* (${leads.length} of ${total})\n\n`;
      leads.forEach((lead, i) => {
        list += `*${i + 1}.* ${lead.name} - ${lead.phone} [${lead.status}]\n`;
      });
      list += "\nReply with number to view details, or *0* to go back.";

      session.data = { leads };
      session.step = 1;
      await client.sendMessage(chatId, list);
    } catch (error) {
      await client.sendMessage(chatId, `❌ Error: ${error.message}`);
      session.menu = "main";
    }
  } else if (session.step === 1) {
    if (text === "0") {
      session.menu = "main";
      session.step = 0;
      session.data = {};
      return "show_menu";
    }

    const index = parseInt(text) - 1;
    if (session.data.leads && session.data.leads[index]) {
      const lead = session.data.leads[index];
      await client.sendMessage(
        chatId,
        `${formatLeadSummary(lead)}\n\n*Update Status:*\n1. New\n2. Contacted\n3. Qualified\n4. Lost\n5. Converted\n0. Back\n\nReply with number to update status:`
      );
      session.data.selectedLead = lead;
      session.step = 2;
    } else {
      await client.sendMessage(chatId, "Invalid selection. Try again or type *0* to go back.");
    }
  } else if (session.step === 2) {
    if (text === "0") {
      session.menu = "main";
      session.step = 0;
      session.data = {};
      return "show_menu";
    }

    const statusMap = { "1": "New", "2": "Contacted", "3": "Qualified", "4": "Lost", "5": "Converted" };
    const newStatus = statusMap[text];

    if (newStatus && session.data.selectedLead) {
      try {
        await Lead.findByIdAndUpdate(session.data.selectedLead._id, { status: newStatus });
        await client.sendMessage(chatId, `✅ Status updated to *${newStatus}*\n\nType *menu* to go back.`);
      } catch (error) {
        await client.sendMessage(chatId, `❌ Error: ${error.message}`);
      }
    } else {
      await client.sendMessage(chatId, "Invalid option. Type *menu* to go back.");
    }

    session.menu = "main";
    session.step = 0;
    session.data = {};
  }
};

module.exports = { handleAddLead, handleViewLeads };

const apiClient = require("../utils/apiClient");
const { formatLeadSummary } = require("../utils/formatter");

const SOURCE_MAP = {
  "1": "Website",
  "2": "Referral",
  "3": "LinkedIn",
  "4": "Cold Call",
  "5": "Email",
  "6": "Trade Show",
  "7": "Other",
};

const handleAddLead = async (client, msg, session) => {
  const chatId = msg.from;
  const text = msg.body.trim();

  switch (session.step) {
    case 0:
      session.step = 1;
      session.data = {};
      await client.sendMessage(chatId, "📋 *Add New Lead*\n\nEnter contact person name:");
      break;

    case 1:
      session.data.contactPerson = text;
      session.step = 2;
      await client.sendMessage(chatId, "Enter phone number:");
      break;

    case 2:
      session.data.phone = text;
      session.step = 3;
      await client.sendMessage(chatId, "Enter email:");
      break;

    case 3:
      session.data.email = text;
      session.step = 4;
      await client.sendMessage(chatId, "Enter company name:");
      break;

    case 4:
      session.data.companyName = text;
      session.step = 5;
      await client.sendMessage(
        chatId,
        "Select lead source:\n1. Website\n2. Referral\n3. LinkedIn\n4. Cold Call\n5. Email\n6. Trade Show\n7. Other\n\nReply with number:"
      );
      break;

    case 5:
      session.data.source = SOURCE_MAP[text] || "Other";

      try {
        const result = await apiClient.post("/api/v1/public/leads", session.data);
        const lead = result.data || result;
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
      const result = await apiClient.get("/api/v1/public/leads?page=1&limit=10");
      const leads = result.data?.leads || result.data || result.leads || [];
      const total = result.data?.total || result.total || result.totalCount || leads.length;

      if (!leads.length) {
        await client.sendMessage(chatId, "No leads found.\n\nType *menu* to go back.");
        session.menu = "main";
        return;
      }

      let list = `📋 *Recent Leads* (${leads.length} of ${total})\n\n`;
      leads.forEach((lead, i) => {
        list += `*${i + 1}.* ${lead.contactPerson} - ${lead.phone || "N/A"} [${lead.stage || "New"}]\n`;
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
        `${formatLeadSummary(lead)}\n\nType *0* to go back or *menu* for main menu.`
      );
      session.menu = "main";
      session.step = 0;
      session.data = {};
    } else {
      await client.sendMessage(chatId, "Invalid selection. Try again or type *0* to go back.");
    }
  }
};

module.exports = { handleAddLead, handleViewLeads };

const apiClient = require("../utils/apiClient");
const { formatLeadSummary } = require("../utils/formatter");

const handleAddLead = async (client, msg, session) => {
  const chatId = msg.from;
  const text = msg.body.trim();

  switch (session.step) {
    case 0:
      session.step = 1;
      session.data = {};
      await client.sendMessage(
        chatId,
        `Please share your *name* 🙂`
      );
      break;

    case 1:
      session.data.contactPerson = text;
      session.step = 2;
      await client.sendMessage(
        chatId,
        `Thank you, *${text}*! 👍\n\nPlease share your *phone number* 📱`
      );
      break;

    case 2:
      session.data.phone = text;
      session.step = 3;
      await client.sendMessage(
        chatId,
        `Got it! 👍\n\nPlease share your *email address* 📧`
      );
      break;

    case 3:
      session.data.email = text;
      session.step = 4;
      await client.sendMessage(
        chatId,
        `Thanks! 👍\n\nPlease share your *company name* 🏢`
      );
      break;

    case 4:
      session.data.companyName = text;
      session.data.source = "WhatsApp";

      try {
        const result = await apiClient.post("/api/v1/public/leads", session.data);
        const lead = result.data || result;
        const leadId = lead._id || lead.id;
        const leadName = session.data.contactPerson;

        await client.sendMessage(
          chatId,
          `✅ *Lead Added Successfully!* 🎉\n\n${formatLeadSummary(lead)}\n\nThank you for your details! 😊`
        );

        // Ask if they want to generate a quotation
        session.menu = "ask_quotation";
        session.step = 0;
        session.data = { leadId, leadName };

        await client.sendMessage(
          chatId,
          `Would you like to generate a *quotation* for this lead? 📄\n\nReply *Yes* to generate quotation\nReply *No* to finish`
        );
      } catch (error) {
        await client.sendMessage(chatId, `❌ Oops! Something went wrong: ${error.message}\n\nType *hi* to try again.`);
        session.menu = "main";
        session.step = 0;
        session.data = {};
      }
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

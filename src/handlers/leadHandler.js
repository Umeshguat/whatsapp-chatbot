const { List } = require("whatsapp-web.js");
const Lead = require("../models/Lead");
const { formatLeadSummary } = require("../utils/formatter");

const SOURCE_MAP = {
  "1": "WhatsApp",
  "2": "Website",
  "3": "Referral",
  "4": "Cold Call",
  "5": "Other",
  "source_1": "WhatsApp",
  "source_2": "Website",
  "source_3": "Referral",
  "source_4": "Cold Call",
  "source_5": "Other",
};

const handleAddLead = async (client, msg, session) => {
  const chatId = msg.from;
  const text = msg.body ? msg.body.trim() : "";
  const selectedId = msg._selectedId || text;

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
      {
        const sourceList = new List(
          "Choose how this lead was acquired:",
          "Select Source",
          [
            {
              title: "Lead Sources",
              rows: [
                { id: "source_1", title: "WhatsApp", description: "Lead from WhatsApp" },
                { id: "source_2", title: "Website", description: "Lead from website" },
                { id: "source_3", title: "Referral", description: "Lead from referral" },
                { id: "source_4", title: "Cold Call", description: "Lead from cold call" },
                { id: "source_5", title: "Other", description: "Other source" },
              ],
            },
          ],
          "📋 Select Lead Source",
          "Tap to select or reply with number"
        );
        await client.sendMessage(chatId, sourceList);
      }
      break;

    case 5:
      session.data.source = SOURCE_MAP[selectedId] || SOURCE_MAP[text] || "WhatsApp";
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
  const text = msg.body ? msg.body.trim() : "";
  const selectedId = msg._selectedId || text;

  if (session.step === 0) {
    try {
      const leads = await Lead.find().sort({ createdAt: -1 }).limit(10);
      const total = await Lead.countDocuments();

      if (!leads.length) {
        await client.sendMessage(chatId, "No leads found.\n\nType *menu* to go back.");
        session.menu = "main";
        return;
      }

      const rows = leads.map((lead, i) => ({
        id: `lead_${i}`,
        title: lead.name,
        description: `${lead.phone} [${lead.status}]`,
      }));
      rows.push({ id: "lead_back", title: "⬅ Back", description: "Go back to main menu" });

      const leadList = new List(
        `Showing ${leads.length} of ${total} leads. Tap to view details:`,
        "View Leads",
        [{ title: "Recent Leads", rows }],
        "📋 Recent Leads",
        "Select a lead to view details"
      );

      session.data = { leads };
      session.step = 1;
      await client.sendMessage(chatId, leadList);
    } catch (error) {
      await client.sendMessage(chatId, `❌ Error: ${error.message}`);
      session.menu = "main";
    }
  } else if (session.step === 1) {
    if (selectedId === "lead_back" || text === "0") {
      session.menu = "main";
      session.step = 0;
      session.data = {};
      return "show_menu";
    }

    // Handle both list selection (lead_0, lead_1...) and number input
    let index;
    if (selectedId.startsWith("lead_")) {
      index = parseInt(selectedId.replace("lead_", ""));
    } else {
      index = parseInt(text) - 1;
    }

    if (session.data.leads && session.data.leads[index]) {
      const lead = session.data.leads[index];

      const statusList = new List(
        formatLeadSummary(lead),
        "Update Status",
        [
          {
            title: "Update Status",
            rows: [
              { id: "status_1", title: "New", description: "Mark as new lead" },
              { id: "status_2", title: "Contacted", description: "Lead has been contacted" },
              { id: "status_3", title: "Qualified", description: "Lead is qualified" },
              { id: "status_4", title: "Lost", description: "Lead is lost" },
              { id: "status_5", title: "Converted", description: "Lead is converted" },
              { id: "status_back", title: "⬅ Back", description: "Go back to main menu" },
            ],
          },
        ],
        `📋 ${lead.name}`,
        "Select new status or go back"
      );

      session.data.selectedLead = lead;
      session.step = 2;
      await client.sendMessage(chatId, statusList);
    } else {
      await client.sendMessage(chatId, "Invalid selection. Try again or type *0* to go back.");
    }
  } else if (session.step === 2) {
    if (selectedId === "status_back" || text === "0") {
      session.menu = "main";
      session.step = 0;
      session.data = {};
      return "show_menu";
    }

    const statusMap = {
      "1": "New", "2": "Contacted", "3": "Qualified", "4": "Lost", "5": "Converted",
      "status_1": "New", "status_2": "Contacted", "status_3": "Qualified", "status_4": "Lost", "status_5": "Converted",
    };
    const newStatus = statusMap[selectedId] || statusMap[text];

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

import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { generateResponse } from "../services/openaiService";

const router = Router();
const prisma = new PrismaClient();

// ==========================================
// 1. WHATSAPP WEBHOOK ENDPOINTS
// ==========================================

// Verification endpoint for Meta WhatsApp API setup (GET)
router.get("/webhook", (req: Request, res: Response) => {
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || "super-secret-verify-token";
  
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token) {
    if (mode === "subscribe" && token === verifyToken) {
      console.log("WhatsApp Webhook verified successfully.");
      return res.status(200).send(challenge);
    }
    return res.status(403).send("Forbidden");
  }
  return res.status(400).send("Bad Request");
});

// Webhook message processor (POST)
// Handles incoming payloads from Twilio, Meta, or the frontend dashboard simulator.
router.post("/webhook", async (req: Request, res: Response) => {
  try {
    const body = req.body;
    console.log("Webhook payload received:", JSON.stringify(body, null, 2));

    let phone = "";
    let name = "";
    let messageText = "";

    // 1. Try parsing simulator format (direct custom JSON)
    if (body.simulator && body.phone && body.message) {
      phone = body.phone;
      name = body.name || "Customer";
      messageText = body.message;
    }
    // 2. Try parsing Twilio SMS/WhatsApp Webhook format
    else if (body.From && body.Body) {
      // From format is often "whatsapp:+123456789"
      phone = body.From.replace("whatsapp:", "");
      name = body.ProfileName || "Customer";
      messageText = body.Body;
    }
    // 3. Try parsing Meta Cloud API format
    else if (
      body.object === "whatsapp_business_account" &&
      body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]
    ) {
      const value = body.entry[0].changes[0].value;
      const message = value.messages[0];
      const contact = value.contacts?.[0];
      
      phone = "+" + message.from;
      name = contact?.profile?.name || "Customer";
      
      if (message.type === "text") {
        messageText = message.text.body;
      } else if (message.type === "audio") {
        messageText = "[Audio voice note received - transcription simulated]";
      } else {
        messageText = `[Received media type: ${message.type}]`;
      }
    }

    if (!phone || !messageText) {
      return res.status(200).json({ status: "ignored", reason: "Unsupported payload structure" });
    }

    // Process message through OpenAI/Mock logic
    console.log(`Processing inbound message from ${name} (${phone}): "${messageText}"`);
    const aiResponse = await generateResponse(phone, name, messageText);
    
    return res.status(200).json({
      status: "success",
      response: aiResponse,
    });
  } catch (error) {
    console.error("Webhook processing error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

// ==========================================
// 2. LIVE CHAT & CUSTOMER MANAGEMENT
// ==========================================

// Get list of active chats (customers)
router.get("/chats", async (req: Request, res: Response) => {
  try {
    const customers = await prisma.customer.findMany({
      include: {
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    const chats = customers.map(cust => ({
      id: cust.id,
      phone: cust.phone,
      name: cust.name,
      status: cust.status,
      updatedAt: cust.updatedAt,
      lastMessage: cust.messages[0] || null,
    }));

    return res.json(chats);
  } catch (error) {
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

// Get chat history for a customer
router.get("/chats/:phone/history", async (req: Request, res: Response) => {
  try {
    const { phone } = req.params;
    const customer = await prisma.customer.findUnique({
      where: { phone },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    return res.json({
      customer,
      messages: customer.messages,
    });
  } catch (error) {
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

// Support agent sends message to customer (Manual Interceptor)
router.post("/chats/:phone/message", async (req: Request, res: Response) => {
  try {
    const { phone } = req.params;
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message body is required" });
    }

    const customer = await prisma.customer.findUnique({
      where: { phone },
    });

    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    // Append outbound message to database
    const savedMsg = await prisma.message.create({
      data: {
        body: message,
        direction: "OUTBOUND",
        sender: "HUMAN",
        customerId: customer.id,
      },
    });

    // Automatically ensure customer is in handover mode since human has taken action
    if (customer.status !== "HUMAN_HANDOVER") {
      await prisma.customer.update({
        where: { id: customer.id },
        data: { status: "HUMAN_HANDOVER" },
      });
    }

    // In a real system, you would call WhatsApp Cloud API or Twilio API here to send the SMS:
    // await sendWhatsAppMessage(customer.phone, message);

    return res.json(savedMsg);
  } catch (error) {
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

// Toggle human takeover / release chat to AI control
router.post("/chats/:phone/takeover", async (req: Request, res: Response) => {
  try {
    const { phone } = req.params;
    const { status } = req.body; // "HUMAN_HANDOVER" or "AI_ACTIVE"

    if (status !== "HUMAN_HANDOVER" && status !== "AI_ACTIVE") {
      return res.status(400).json({ error: "Invalid status value" });
    }

    const customer = await prisma.customer.update({
      where: { phone },
      data: { status },
    });

    // Append alert message in chat log to indicate state change
    const stateMsg = status === "HUMAN_HANDOVER"
      ? "🚨 Support agent has taken over this chat. AI automated replies are suspended."
      : "🤖 Chat handed back to AI assistant. Automated responses resumed.";

    await prisma.message.create({
      data: {
        body: stateMsg,
        direction: "OUTBOUND",
        sender: status === "HUMAN_HANDOVER" ? "HUMAN" : "AI",
        customerId: customer.id,
      },
    });

    return res.json(customer);
  } catch (error) {
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

// ==========================================
// 3. TICKET MANAGEMENT API
// ==========================================

router.get("/tickets", async (req: Request, res: Response) => {
  try {
    const tickets = await prisma.ticket.findMany({
      include: {
        customer: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return res.json(tickets);
  } catch (error) {
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

router.patch("/tickets/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // OPEN, IN_PROGRESS, RESOLVED

    if (!["OPEN", "IN_PROGRESS", "RESOLVED"].includes(status)) {
      return res.status(400).json({ error: "Invalid ticket status" });
    }

    const ticket = await prisma.ticket.update({
      where: { id },
      data: { status },
      include: { customer: true },
    });

    // Notify customer about ticket update (Simulated WhatsApp Alert)
    const alertBody = `🎟️ *Ticket Update*:\nYour support ticket (\`${ticket.id}\`) status has been updated to *${ticket.status}*.`;
    await prisma.message.create({
      data: {
        body: alertBody,
        direction: "OUTBOUND",
        sender: "AI",
        customerId: ticket.customerId,
      },
    });

    return res.json(ticket);
  } catch (error) {
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

router.delete("/tickets/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.ticket.delete({ where: { id } });
    return res.status(204).send();
  } catch (error) {
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

// ==========================================
// 4. FAQ / KNOWLEDGE BASE API
// ==========================================

router.get("/faqs", async (req: Request, res: Response) => {
  try {
    const faqs = await prisma.fAQ.findMany({ orderBy: { createdAt: "desc" } });
    return res.json(faqs);
  } catch (error) {
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/faqs", async (req: Request, res: Response) => {
  try {
    const { id, question, answer, category } = req.body;

    if (!question || !answer) {
      return res.status(400).json({ error: "Question and Answer are required" });
    }

    if (id) {
      const updated = await prisma.fAQ.update({
        where: { id: Number(id) },
        data: { question, answer, category },
      });
      return res.json(updated);
    } else {
      const created = await prisma.fAQ.create({
        data: { question, answer, category },
      });
      return res.json(created);
    }
  } catch (error) {
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

router.delete("/faqs/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.fAQ.delete({ where: { id: Number(id) } });
    return res.status(204).send();
  } catch (error) {
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

// ==========================================
// 5. SHOPIFY ORDER SIMULATOR API
// ==========================================

router.get("/orders", async (req: Request, res: Response) => {
  try {
    const orders = await prisma.order.findMany({ orderBy: { createdAt: "desc" } });
    return res.json(orders);
  } catch (error) {
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/orders", async (req: Request, res: Response) => {
  try {
    const { id, orderNumber, customerName, email, status, items, trackingUrl } = req.body;

    if (!orderNumber || !customerName || !email || !status || !items) {
      return res.status(400).json({ error: "Missing required order fields" });
    }

    if (id) {
      const updated = await prisma.order.update({
        where: { id: Number(id) },
        data: { orderNumber, customerName, email, status, items, trackingUrl },
      });
      return res.json(updated);
    } else {
      const created = await prisma.order.create({
        data: { orderNumber, customerName, email, status, items, trackingUrl },
      });
      return res.json(created);
    }
  } catch (error) {
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

router.delete("/orders/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.order.delete({ where: { id: Number(id) } });
    return res.status(204).send();
  } catch (error) {
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;

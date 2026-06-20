import { PrismaClient } from "@prisma/client";
import OpenAI from "openai";
import { searchFAQ } from "./ragService";

const prisma = new PrismaClient();

// Initialize OpenAI client if key is present
const apiKey = process.env.OPENAI_API_KEY || "";
const openai = apiKey ? new OpenAI({ apiKey }) : null;

if (openai) {
  console.log("OpenAI client initialized in Real Mode.");
} else {
  console.log("OpenAI API key not found. Running in Fallback/Mock Mode.");
}

export interface ChatResponse {
  message: string;
  sender: "AI" | "HUMAN";
}

/**
 * Generates an AI response for a customer message, handling tool calls or falling back to mock logic.
 */
export async function generateResponse(
  phone: string,
  name: string,
  userMessage: string
): Promise<ChatResponse> {
  // 1. Get or create the customer
  let customer = await prisma.customer.findUnique({
    where: { phone },
  });

  if (!customer) {
    customer = await prisma.customer.create({
      data: { phone, name },
    });
  }

  // If customer is currently in human handover mode, AI should not respond.
  if (customer.status === "HUMAN_HANDOVER") {
    return {
      message: "An agent is handling this chat.",
      sender: "HUMAN",
    };
  }

  // 2. Save the incoming message
  await prisma.message.create({
    data: {
      body: userMessage,
      direction: "INBOUND",
      sender: "CUSTOMER",
      customerId: customer.id,
    },
  });

  // 3. Load recent chat history (last 10 messages)
  const history = await prisma.message.findMany({
    where: { customerId: customer.id },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  // Sort history chronologically
  history.reverse();

  let replyText = "";

  if (openai) {
    try {
      replyText = await runRealOpenAI(customer.id, phone, name, history);
    } catch (error) {
      console.error("OpenAI API Error, falling back to mock logic:", error);
      replyText = await runMockLogic(customer.id, userMessage);
    }
  } else {
    replyText = await runMockLogic(customer.id, userMessage);
  }

  // 4. Save the outgoing AI message
  await prisma.message.create({
    data: {
      body: replyText,
      direction: "OUTBOUND",
      sender: "AI",
      customerId: customer.id,
    },
  });

  return {
    message: replyText,
    sender: "AI",
  };
}

/**
 * Real OpenAI call using function tools
 */
async function runRealOpenAI(
  customerId: number,
  phone: string,
  name: string,
  history: any[]
): Promise<string> {
  if (!openai) throw new Error("OpenAI not initialized");

  const systemMessage = {
    role: "system",
    content: `You are an AI Support Agent named "ShopBot" for our e-commerce store.
You help customers check order status, answer FAQ questions (about returns, shipping, refunds), and escalate to a human agent or create a support ticket if you cannot solve their issues.
Be concise, friendly, and helpful. Always respond in the customer's language (English, Hindi, Spanish, French, etc.).

When dealing with complaints or issues (e.g., damaged items, wrong order, missing items, refunds):
1. Politely ask the customer if they would like you to open a support ticket.
2. If they agree, use the 'createSupportTicket' tool to create it.
3. Once created, provide them the ticket reference ID.

When they ask about orders:
1. Try to extract the order number.
2. If they didn't provide it, ask for the order number.
3. Use 'checkOrderStatus' tool to query Shopify.

When they ask for refunds/policies/shipping information:
1. Use 'searchFAQ' to locate the correct policy.

If they explicitly ask for a human agent or get angry, call 'escalateToHuman' to pass control to a support specialist.`,
  };

  const messages: any[] = [
    systemMessage,
    ...history.map((msg) => ({
      role: msg.sender === "CUSTOMER" ? "user" : "assistant",
      content: msg.body,
    })),
  ];

  const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
    {
      type: "function",
      function: {
        name: "checkOrderStatus",
        description: "Fetch mock Shopify order details by order number",
        parameters: {
          type: "object",
          properties: {
            orderNumber: { type: "string", description: "The order number, e.g., '1548'" },
          },
          required: ["orderNumber"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "searchFAQ",
        description: "Retrieve store policies, shipping/return info, refunds timelines",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "The customer question or search terms" },
          },
          required: ["query"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "createSupportTicket",
        description: "Create a customer support ticket for manual reviews",
        parameters: {
          type: "object",
          properties: {
            description: { type: "string", description: "Summary of the issue or complaint" },
          },
          required: ["description"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "escalateToHuman",
        description: "Transfer the chat to a live customer support representative",
        parameters: { type: "object", properties: {} },
      },
    },
  ];

  let runCounter = 0;
  while (runCounter < 5) {
    runCounter++;
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      tools,
      tool_choice: "auto",
    });

    const choice = response.choices[0];
    const assistantMessage = choice.message;

    messages.push(assistantMessage);

    if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
      return assistantMessage.content || "I'm sorry, I couldn't process your request.";
    }

    for (const toolCall of assistantMessage.tool_calls) {
      const args = JSON.parse(toolCall.function.arguments);
      let toolResult = "";

      if (toolCall.function.name === "checkOrderStatus") {
        const order = await prisma.order.findUnique({
          where: { orderNumber: args.orderNumber },
        });
        if (order) {
          toolResult = JSON.stringify({
            found: true,
            orderNumber: order.orderNumber,
            customerName: order.customerName,
            status: order.status,
            items: order.items,
            trackingUrl: order.trackingUrl || "No tracking link available yet",
          });
        } else {
          toolResult = JSON.stringify({ found: false, error: "Order not found" });
        }
      } else if (toolCall.function.name === "searchFAQ") {
        const result = await searchFAQ(args.query);
        toolResult = JSON.stringify(
          result
            ? { found: true, question: result.question, answer: result.answer }
            : { found: false, error: "No relevant policy found" }
        );
      } else if (toolCall.function.name === "createSupportTicket") {
        const ticket = await prisma.ticket.create({
          data: {
            description: args.description,
            customerId: customerId,
            status: "OPEN",
          },
        });
        toolResult = JSON.stringify({
          created: true,
          ticketId: ticket.id,
          status: ticket.status,
        });
      } else if (toolCall.function.name === "escalateToHuman") {
        await prisma.customer.update({
          where: { id: customerId },
          data: { status: "HUMAN_HANDOVER" },
        });
        toolResult = JSON.stringify({
          success: true,
          status: "TRANSFERRED_TO_HUMAN",
          note: "A human agent has been requested. AI response is paused.",
        });
      }

      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: toolResult,
      });
    }
  }

  return "I'm experiencing technical issues. Let me connect you with a human.";
}

/**
 * Deterministic Mock AI logic (Fallback)
 */
async function runMockLogic(customerId: number, message: string): Promise<string> {
  const text = message.toLowerCase();

  // 1. Human Handover check
  if (text.match(/\b(human|agent|person|live chat|support staff|representative|speak to someone)\b/)) {
    await prisma.customer.update({
      where: { id: customerId },
      data: { status: "HUMAN_HANDOVER" },
    });
    return "🛎️ I am transferring your chat to a customer support agent. A representative will be with you shortly. AI support has been paused.";
  }

  // 2. Order check
  const orderMatch = text.match(/order\s*#?([0-9]+)/);
  if (orderMatch) {
    const orderNum = orderMatch[1];
    const order = await prisma.order.findUnique({
      where: { orderNumber: orderNum },
    });

    if (order) {
      let trackingStr = order.trackingUrl
        ? `\n🚚 Track your shipment here: ${order.trackingUrl}`
        : "\n📦 A tracking link will be generated once it is dispatched.";
      return `📦 *Order #${order.orderNumber} Status*:\n👤 Name: ${order.customerName}\n🛒 Items: ${order.items}\n⚙️ Status: *${order.status}*${trackingStr}`;
    } else {
      return `❌ I couldn't find an order with number *#${orderNum}*. Please double-check your order number or let me know if you would like me to create a support ticket.`;
    }
  }

  // 3. Ticket Request check
  if (
    text.match(/\b(ticket|damaged|broken|refund|complaint|defective|wrong item|cancel order)\b/)
  ) {
    // Determine if they are confirming ticket creation or just complaining
    if (text.match(/\b(yes|please|create|open|confirm)\b/)) {
      const ticket = await prisma.ticket.create({
        data: {
          description: `Customer reported issue: "${message}"`,
          customerId: customerId,
          status: "OPEN",
        },
      });
      return `🎟️ I have successfully created a support ticket for you!\n• *Ticket ID:* \`${ticket.id}\`\n• *Status:* Open\n\nOur customer care team will review this and respond to you as soon as possible.`;
    } else {
      return `😢 I'm sorry to hear that you're facing this issue. Would you like me to create a customer support ticket so our team can help you resolve it? (Reply "yes please" to confirm)`;
    }
  }

  // 4. FAQ Match (using RAG service token matching)
  const faqMatch = await searchFAQ(message);
  if (faqMatch) {
    return faqMatch.answer;
  }

  // 5. Help / General response
  return `👋 Hello! I am the automated support assistant.\n\nHere is how I can help you:\n• Check order status: write something like *"Where is my order #1548?"*\n• Ask questions: write *"What is your return policy?"* or *"When will I get my refund?"*\n• If you need manual support, say *"connect me to a human"* or request a ticket.`;
}

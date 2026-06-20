# ShopBot: AI-Powered WhatsApp Support Agent

An intelligent, production-ready WhatsApp Customer Support Agent system featuring automated e-commerce queries, semantic RAG lookup, ticket creation, and an interactive **Live Agent Takeover** console. 

This repository contains both the TypeScript/Express API backend and a Next.js admin dashboard that includes an **interactive WhatsApp Simulator** for local testing.

---

## 🚀 Key Features

*   💬 **FAQ Assistant (RAG):** Answers customer queries regarding shipping, refunds, and return policies using token-weighted semantic database retrieval.
*   🛍️ **Shopify Order Lookup (AI Tool Calling):** The AI extracts order numbers from conversations and triggers functions to retrieve order details and tracking status from the Shopify Admin API in real-time.
*   🎟️ **Support Ticket Desk:** Automatically prompts the user and logs a support ticket in the database when the AI encounters unresolved queries or product damage reports.
*   🙋‍♂️ **Live Agent Handover (Escalation):** Support agents can monitor chat transcripts and toggle **Manual Takeover** via the dashboard, instantly pausing AI automation to send direct replies to WhatsApp.
*   🎭 **WhatsApp Simulator:** A fully-featured WhatsApp UI mockup inside a mobile shell to initiate messages and verify webhook payloads instantly without external setup.

---

## 🛠️ Tech Stack

*   **Backend:** Node.js, Express, TypeScript, Prisma ORM, PostgreSQL.
*   **AI Engine:** OpenAI API (GPT-4o) with Function Calling tools. Supports an offline fallback mode for local rule-based simulation.
*   **Frontend Dashboard:** Next.js, React, Tailwind CSS (v4).

---

## 📦 System Architecture

```
Customer (WhatsApp Device) 
         │ 
         ▼
  Webhook Payload 
         │
         ▼
Express API Backend (Port 3001) <───> Next.js Dashboard Client (Port 3000)
         │                                   │
         ├───► OpenAI GPT-4o (Tools)         ├───► Live Inbox (Takeover Chat)
         ├───► Local RAG (FAQ DB search)     ├───► Shopify Order Injector
         └───► PostgreSQL Database           └───► Tickets Desk
```

---

## 📂 Project Structure

```text
whatsapp-ai-support/
├── src/                          # Backend Source Code
│   ├── routes/                   # API Endpoints (Webhook & Dashboard Services)
│   ├── services/                 # OpenAI Chat Agent & FAQ RAG Search Logic
│   ├── prisma/                   # Database Schema & Data Seeding Scripts
│   └── app.ts                    # Main Express Application
├── dashboard/                    # Frontend Application
│   ├── src/app/
│   │   ├── page.tsx              # Main Dashboard UI & WhatsApp Simulator
│   │   ├── globals.css           # Tailwind CSS Configuration & Patterns
│   │   └── layout.tsx            # Next.js Metadata Setup
│   └── package.json
├── package.json
└── tsconfig.json
```

---

## 🏁 How to Run Locally

### Prerequisites
- Node.js (v18+)
- PostgreSQL (running locally)

### 1. Installation & Setup

Install the root backend dependencies:
```bash
npm install
```

### 2. Configure Environment

Create a `.env` file at the root workspace:
```env
PORT=3001
DATABASE_URL="postgresql://<username>@localhost:5432/whatsapp_ai_support?schema=public"
OPENAI_API_KEY="your-openai-api-key" # Optional. Leave blank for rule-based mock mode!
```

### 3. Setup Database & Seeding

Generate the database tables and apply migrations:
```bash
npx prisma migrate dev --schema=src/prisma/schema.prisma --name init
```

Seed the mock database with default FAQs and Shopify orders:
```bash
npx ts-node src/prisma/seed.ts
```

### 4. Run the Application

Start the **Backend API Server** (runs on port `3001`):
```bash
npm run dev
```

Start the **Dashboard & Simulator Client** (runs on port `3000`):
```bash
npm run dev --prefix dashboard
```

Open **[http://localhost:3000](http://localhost:3000)** in your browser to interact with the ShopBot support system!

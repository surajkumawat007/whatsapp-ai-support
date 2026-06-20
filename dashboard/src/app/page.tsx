"use client";

import React, { useState, useEffect, useRef } from "react";

const BACKEND_URL = "http://localhost:3001";

interface FAQ {
  id?: number;
  question: string;
  answer: string;
  category: string;
}

interface Order {
  id?: number;
  orderNumber: string;
  customerName: string;
  email: string;
  status: string;
  items: string;
  trackingUrl: string;
}

interface Ticket {
  id: string;
  description: string;
  status: string;
  customerId: number;
  createdAt: string;
  customer: {
    name: string;
    phone: string;
  };
}

interface Message {
  id: number;
  body: string;
  direction: "INBOUND" | "OUTBOUND";
  sender: "CUSTOMER" | "AI" | "HUMAN";
  createdAt: string;
}

interface CustomerChat {
  id: number;
  phone: string;
  name: string;
  status: "AI_ACTIVE" | "HUMAN_HANDOVER";
  updatedAt: string;
  lastMessage: Message | null;
}

export default function Dashboard() {
  // Navigation
  const [activeTab, setActiveTab] = useState<"inbox" | "analytics" | "tickets" | "faqs" | "shopify">("inbox");

  // Global Lists loaded from server
  const [chats, setChats] = useState<CustomerChat[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);

  // Selection states
  const [selectedChatPhone, setSelectedChatPhone] = useState<string>("");
  const [selectedChatHistory, setSelectedChatHistory] = useState<Message[]>([]);
  const [selectedChatDetails, setSelectedChatDetails] = useState<CustomerChat | null>(null);

  // WhatsApp Simulator state
  const [simPhone, setSimPhone] = useState<string>("+15550199");
  const [simName, setSimName] = useState<string>("John Doe");
  const [simMessage, setSimMessage] = useState<string>("");
  const [simHistory, setSimHistory] = useState<Message[]>([]);
  const [simDetails, setSimDetails] = useState<CustomerChat | null>(null);
  const [simIsTyping, setSimIsTyping] = useState<boolean>(false);
  const [showNewSimChatModal, setShowNewSimChatModal] = useState<boolean>(false);

  // Agent response input
  const [agentReplyText, setAgentReplyText] = useState<string>("");

  // CRUD Form states
  const [faqForm, setFaqForm] = useState<FAQ>({ question: "", answer: "", category: "General" });
  const [editingFaqId, setEditingFaqId] = useState<number | null>(null);

  const [orderForm, setOrderForm] = useState<Order>({
    orderNumber: "",
    customerName: "",
    email: "",
    status: "PROCESSING",
    items: "",
    trackingUrl: "",
  });
  const [editingOrderId, setEditingOrderId] = useState<number | null>(null);

  // Scrolling refs
  const simEndRef = useRef<HTMLDivElement>(null);
  const agentEndRef = useRef<HTMLDivElement>(null);

  // ----------------------------------------------------
  // Load data initially and start polling
  // ----------------------------------------------------
  useEffect(() => {
    fetchFaqs();
    fetchOrders();
    fetchTickets();
    fetchChats();

    // Poll chats list every 3s
    const chatInterval = setInterval(fetchChats, 3000);
    // Poll tickets list every 5s
    const ticketInterval = setInterval(fetchTickets, 5000);

    return () => {
      clearInterval(chatInterval);
      clearInterval(ticketInterval);
    };
  }, []);

  // Poll selected agent chat messages every 1.5s
  useEffect(() => {
    if (!selectedChatPhone) return;

    fetchSelectedChatHistory();
    const interval = setInterval(fetchSelectedChatHistory, 1500);
    return () => clearInterval(interval);
  }, [selectedChatPhone]);

  // Poll simulator messages every 1.5s
  useEffect(() => {
    if (!simPhone) return;

    fetchSimHistory();
    const interval = setInterval(fetchSimHistory, 1500);
    return () => clearInterval(interval);
  }, [simPhone]);

  // Scroll to bottom of chat when history changes
  useEffect(() => {
    simEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [simHistory]);

  useEffect(() => {
    agentEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selectedChatHistory]);

  // ----------------------------------------------------
  // API Core Calls
  // ----------------------------------------------------
  const fetchChats = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/chats`);
      if (res.ok) {
        const data = await res.json();
        setChats(data);
        
        // Update selected chat details inline
        if (selectedChatPhone) {
          const matched = data.find((c: CustomerChat) => c.phone === selectedChatPhone);
          if (matched) setSelectedChatDetails(matched);
        }
        // Update simulator chat details inline
        if (simPhone) {
          const matched = data.find((c: CustomerChat) => c.phone === simPhone);
          if (matched) setSimDetails(matched);
        }
      }
    } catch (err) {
      console.error("Failed fetching chats", err);
    }
  };

  const fetchTickets = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/tickets`);
      if (res.ok) setTickets(await res.json());
    } catch (err) {}
  };

  const fetchFaqs = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/faqs`);
      if (res.ok) setFaqs(await res.json());
    } catch (err) {}
  };

  const fetchOrders = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/orders`);
      if (res.ok) setOrders(await res.json());
    } catch (err) {}
  };

  const fetchSelectedChatHistory = async () => {
    if (!selectedChatPhone) return;
    try {
      const res = await fetch(`${BACKEND_URL}/chats/${encodeURIComponent(selectedChatPhone)}/history`);
      if (res.ok) {
        const data = await res.json();
        setSelectedChatHistory(data.messages);
        setSelectedChatDetails(data.customer);
      }
    } catch (err) {}
  };

  const fetchSimHistory = async () => {
    if (!simPhone) return;
    try {
      const res = await fetch(`${BACKEND_URL}/chats/${encodeURIComponent(simPhone)}/history`);
      if (res.ok) {
        const data = await res.json();
        setSimHistory(data.messages);
        setSimDetails(data.customer);
      } else if (res.status === 404) {
        // Customer doesn't exist yet
        setSimHistory([]);
        setSimDetails(null);
      }
    } catch (err) {}
  };

  // ----------------------------------------------------
  // Simulator Actions
  // ----------------------------------------------------
  const handleSendSimMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!simMessage.trim()) return;

    const messageText = simMessage;
    setSimMessage("");

    // Optimistically push customer message to simulator screen
    const optimisticMessage: Message = {
      id: Date.now(),
      body: messageText,
      direction: "INBOUND",
      sender: "CUSTOMER",
      createdAt: new Date().toISOString(),
    };
    setSimHistory((prev) => [...prev, optimisticMessage]);
    setSimIsTyping(true);

    try {
      const res = await fetch(`${BACKEND_URL}/webhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          simulator: true,
          phone: simPhone,
          name: simName,
          message: messageText,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        // Force refresh chat list & histories
        fetchChats();
        fetchSimHistory();
        fetchSelectedChatHistory();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSimIsTyping(false);
    }
  };

  const handleStartSimChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!simPhone.trim() || !simName.trim()) return;

    // Check if customer already exists in chat database to load correct name
    const existing = chats.find(c => c.phone === simPhone);
    if (existing) {
      setSimName(existing.name);
    }

    setShowNewSimChatModal(false);
    fetchSimHistory();
  };

  // ----------------------------------------------------
  // Agent Panel Actions
  // ----------------------------------------------------
  const handleToggleTakeover = async (customerPhone: string, currentStatus: string) => {
    const nextStatus = currentStatus === "AI_ACTIVE" ? "HUMAN_HANDOVER" : "AI_ACTIVE";
    try {
      const res = await fetch(`${BACKEND_URL}/chats/${encodeURIComponent(customerPhone)}/takeover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (res.ok) {
        fetchChats();
        fetchSelectedChatHistory();
        fetchSimHistory();
      }
    } catch (err) {}
  };

  const handleSendAgentReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agentReplyText.trim() || !selectedChatPhone) return;

    const messageText = agentReplyText;
    setAgentReplyText("");

    try {
      const res = await fetch(`${BACKEND_URL}/chats/${encodeURIComponent(selectedChatPhone)}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: messageText }),
      });
      if (res.ok) {
        fetchChats();
        fetchSelectedChatHistory();
        fetchSimHistory();
      }
    } catch (err) {}
  };

  // ----------------------------------------------------
  // Ticket Actions
  // ----------------------------------------------------
  const handleUpdateTicketStatus = async (ticketId: string, status: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        fetchTickets();
        fetchChats();
        fetchSelectedChatHistory();
        fetchSimHistory();
      }
    } catch (err) {}
  };

  const handleDeleteTicket = async (ticketId: string) => {
    if (!confirm("Are you sure you want to delete this ticket?")) return;
    try {
      const res = await fetch(`${BACKEND_URL}/tickets/${ticketId}`, { method: "DELETE" });
      if (res.ok) fetchTickets();
    } catch (err) {}
  };

  // ----------------------------------------------------
  // FAQ Management Actions
  // ----------------------------------------------------
  const handleSaveFaq = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!faqForm.question.trim() || !faqForm.answer.trim()) return;

    try {
      const res = await fetch(`${BACKEND_URL}/faqs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingFaqId || undefined,
          ...faqForm,
        }),
      });

      if (res.ok) {
        setFaqForm({ question: "", answer: "", category: "General" });
        setEditingFaqId(null);
        fetchFaqs();
      }
    } catch (err) {}
  };

  const handleEditFaq = (faq: FAQ) => {
    setFaqForm({ question: faq.question, answer: faq.answer, category: faq.category || "General" });
    setEditingFaqId(faq.id || null);
  };

  const handleDeleteFaq = async (faqId: number) => {
    if (!confirm("Delete this FAQ article?")) return;
    try {
      const res = await fetch(`${BACKEND_URL}/faqs/${faqId}`, { method: "DELETE" });
      if (res.ok) fetchFaqs();
    } catch (err) {}
  };

  // ----------------------------------------------------
  // Shopify Simulation Actions
  // ----------------------------------------------------
  const handleSaveOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    const { orderNumber, customerName, email, status, items, trackingUrl } = orderForm;
    if (!orderNumber || !customerName || !email || !items) return;

    try {
      const res = await fetch(`${BACKEND_URL}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingOrderId || undefined,
          orderNumber,
          customerName,
          email,
          status,
          items,
          trackingUrl: trackingUrl || null,
        }),
      });

      if (res.ok) {
        setOrderForm({
          orderNumber: "",
          customerName: "",
          email: "",
          status: "PROCESSING",
          items: "",
          trackingUrl: "",
        });
        setEditingOrderId(null);
        fetchOrders();
      }
    } catch (err) {}
  };

  const handleEditOrder = (order: Order) => {
    setOrderForm({
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      email: order.email,
      status: order.status,
      items: order.items,
      trackingUrl: order.trackingUrl || "",
    });
    setEditingOrderId(order.id || null);
  };

  const handleDeleteOrder = async (orderId: number) => {
    if (!confirm("Delete this order?")) return;
    try {
      const res = await fetch(`${BACKEND_URL}/orders/${orderId}`, { method: "DELETE" });
      if (res.ok) fetchOrders();
    } catch (err) {}
  };

  // ----------------------------------------------------
  // Helpers
  // ----------------------------------------------------
  const formatTime = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  // ----------------------------------------------------
  // Render Panels
  // ----------------------------------------------------
  return (
    <div className="flex-1 bg-slate-950 text-slate-100 flex flex-col font-sans overflow-hidden">
      
      {/* 1. Header Bar */}
      <header className="h-16 border-b border-slate-800 bg-slate-900/60 px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-green-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <svg className="w-6 h-6 text-slate-950" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-emerald-400 to-teal-200 bg-clip-text text-transparent">
              ShopBot Console
            </h1>
            <p className="text-xs text-slate-400 font-medium">WhatsApp AI Support & Live Escalation Dashboard</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Quick Stats Banner */}
          <div className="hidden md:flex items-center gap-4 text-xs">
            <div className="bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-slate-300">AI Mode: Auto-Active</span>
            </div>
            <div className="bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg text-slate-300">
              ⚡ Open Tickets: <strong className="text-amber-400">{tickets.filter(t => t.status === "OPEN").length}</strong>
            </div>
          </div>
        </div>
      </header>

      {/* 2. Main Workspace Layout: 2 Panels (Simulator Left, Admin Dashboard Right) */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* ========================================================
            LEFT SIDEBAR: WHATSAPP MOBILE SIMULATOR 
            ======================================================== */}
        <section className="w-[380px] lg:w-[420px] border-r border-slate-800 bg-slate-900/30 p-6 flex flex-col shrink-0 overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold tracking-wider uppercase text-slate-400">WhatsApp Simulator</h2>
            <button
              onClick={() => setShowNewSimChatModal(true)}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-md shadow-emerald-600/10 flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              New Session
            </button>
          </div>

          {/* Active Sim Chat Indicator */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 mb-4 flex items-center justify-between shadow-inner">
            <div>
              <div className="text-xs text-slate-400 font-medium">Testing Phone Session:</div>
              <div className="text-sm font-bold text-emerald-400">{simPhone}</div>
              <div className="text-xs text-slate-300">User Profile Name: {simName}</div>
            </div>
            <div className="flex flex-col items-end">
              <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                simDetails?.status === "HUMAN_HANDOVER" 
                  ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" 
                  : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
              }`}>
                {simDetails?.status === "HUMAN_HANDOVER" ? "Agent Handover" : "AI Agent Auto"}
              </span>
            </div>
          </div>

          {/* The Phone Mock Shell */}
          <div className="flex-1 bg-slate-950 border border-slate-800 rounded-[36px] overflow-hidden flex flex-col shadow-2xl relative min-h-[480px]">
            {/* Camera notch mockup */}
            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-32 h-4 bg-slate-900 rounded-full z-20 flex items-center justify-center">
              <div className="w-3 h-3 bg-slate-800 rounded-full mr-2"></div>
              <div className="w-1.5 h-1.5 bg-slate-800 rounded-full"></div>
            </div>

            {/* Mobile screen header */}
            <div className="bg-emerald-850 pt-7 pb-3 px-4 flex items-center justify-between border-b border-emerald-900 text-white shrink-0 z-10">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-emerald-700/80 border border-emerald-500/40 flex items-center justify-center text-sm font-bold uppercase shadow-sm">
                  {simName.charAt(0)}
                </div>
                <div>
                  <div className="text-sm font-bold tracking-wide">{simName}</div>
                  <div className="text-[10px] text-emerald-200 font-medium">
                    {simIsTyping ? "typing..." : "online"}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-3 text-emerald-100">
                {/* Audio call icon */}
                <svg className="w-4 h-4 cursor-pointer hover:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.321.988l-1.305.98a10.582 10.582 0 004.872 4.872l.98-1.305a1 1 0 01.988-.321l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                {/* Video call icon */}
                <svg className="w-4 h-4 cursor-pointer hover:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
            </div>

            {/* Mobile Screen Messages Area */}
            <div className="flex-1 p-3 overflow-y-auto bg-[#0b141a] flex flex-col space-y-2.5 pattern-background">
              {simHistory.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-xs text-slate-500">
                  <div className="p-3 bg-slate-900/50 rounded-full border border-slate-800/40 mb-2">
                    <svg className="w-6 h-6 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <span>Send a message to initiate WhatsApp Webhook events and test ShopBot!</span>
                </div>
              ) : (
                simHistory.map((msg) => {
                  const isCustomer = msg.direction === "INBOUND";
                  return (
                    <div
                      key={msg.id}
                      className={`max-w-[75%] rounded-lg p-2.5 text-xs relative ${
                        isCustomer
                          ? "self-end bg-[#005c4b] text-emerald-50 rounded-tr-none shadow"
                          : "self-start bg-[#202c33] text-slate-100 rounded-tl-none shadow"
                      }`}
                    >
                      {/* Message Content */}
                      <p className="whitespace-pre-line leading-normal break-words">{msg.body}</p>
                      
                      {/* Timestamp & Meta info */}
                      <div className="flex justify-end items-center gap-1.5 mt-1 text-[9px] text-slate-400">
                        <span>{formatTime(msg.createdAt)}</span>
                        {!isCustomer && (
                          <span className={`font-semibold px-1 rounded-sm uppercase ${
                            msg.sender === "HUMAN" ? "bg-amber-500/20 text-amber-400" : "bg-emerald-500/20 text-emerald-400"
                          }`}>
                            {msg.sender}
                          </span>
                        )}
                        {isCustomer && (
                          <svg className="w-3.5 h-3.5 text-[#53bdeb]" viewBox="0 0 16 15" fill="none">
                            <path d="M15.01 3.3l-5.3 5.3-2.5-2.5-.7.7 3.2 3.2 6-6-.7-.7zM9.01 8.6L3.71 3.3l-.7.7 6 6 .7-.7z" fill="currentColor"/>
                            <path d="M11.51 3.3L6.21 8.6l-2.5-2.5-.7.7 3.2 3.2 6-6-.7-.7z" fill="currentColor"/>
                          </svg>
                        )}
                      </div>
                    </div>
                  );
                })
              )}

              {/* Bot typing simulation */}
              {simIsTyping && (
                <div className="self-start bg-[#202c33] text-slate-100 rounded-lg rounded-tl-none p-2.5 text-xs max-w-[75%] shadow animate-pulse">
                  <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce delay-100"></span>
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce delay-200"></span>
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce delay-300"></span>
                  </div>
                </div>
              )}
              <div ref={simEndRef} />
            </div>

            {/* Mobile Screen message input */}
            <form onSubmit={handleSendSimMessage} className="bg-[#111b21] p-2 flex items-center gap-2 border-t border-slate-800 shrink-0">
              <input
                type="text"
                value={simMessage}
                onChange={(e) => setSimMessage(e.target.value)}
                placeholder="Type a WhatsApp message..."
                className="flex-1 bg-[#2a3942] border-none rounded-xl text-xs px-3 py-2 text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <button
                type="submit"
                className="w-8 h-8 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center transition-all shadow-md active:scale-95 shrink-0"
              >
                <svg className="w-4.5 h-4.5 transform rotate-90 translate-x-[1px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </form>
          </div>
        </section>

        {/* ========================================================
            RIGHT SIDEBAR: ADMIN CONTROL WORKSPACE
            ======================================================== */}
        <main className="flex-1 bg-slate-900/10 flex flex-col overflow-hidden">
          
          {/* Workspace Tab Buttons */}
          <nav className="h-12 border-b border-slate-800 bg-slate-900/40 px-6 flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => setActiveTab("inbox")}
              className={`h-full px-4 text-xs font-semibold border-b-2 flex items-center gap-2 transition-all ${
                activeTab === "inbox" 
                  ? "border-emerald-500 text-emerald-400 bg-emerald-500/5" 
                  : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
              }`}
            >
              📥 Live Agent Inbox
              {chats.some(c => c.status === "HUMAN_HANDOVER") && (
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("analytics")}
              className={`h-full px-4 text-xs font-semibold border-b-2 flex items-center gap-2 transition-all ${
                activeTab === "analytics" 
                  ? "border-emerald-500 text-emerald-400 bg-emerald-500/5" 
                  : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
              }`}
            >
              📊 Analytics Overview
            </button>
            <button
              onClick={() => setActiveTab("tickets")}
              className={`h-full px-4 text-xs font-semibold border-b-2 flex items-center gap-2 transition-all ${
                activeTab === "tickets" 
                  ? "border-emerald-500 text-emerald-400 bg-emerald-500/5" 
                  : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
              }`}
            >
              🎟️ Tickets Manager
              {tickets.filter(t => t.status === "OPEN").length > 0 && (
                <span className="bg-amber-500/20 text-amber-400 text-[10px] px-1.5 py-0.5 rounded font-extrabold">
                  {tickets.filter(t => t.status === "OPEN").length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("faqs")}
              className={`h-full px-4 text-xs font-semibold border-b-2 flex items-center gap-2 transition-all ${
                activeTab === "faqs" 
                  ? "border-emerald-500 text-emerald-400 bg-emerald-500/5" 
                  : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
              }`}
            >
              📖 Knowledge Base (FAQ)
            </button>
            <button
              onClick={() => setActiveTab("shopify")}
              className={`h-full px-4 text-xs font-semibold border-b-2 flex items-center gap-2 transition-all ${
                activeTab === "shopify" 
                  ? "border-emerald-500 text-emerald-400 bg-emerald-500/5" 
                  : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
              }`}
            >
              🛍️ Shopify Mock Engine
            </button>
          </nav>

          {/* Tab Screen Content */}
          <div className="flex-1 p-6 overflow-y-auto">
            
            {/* ----------------- INBOX TAB ----------------- */}
            {activeTab === "inbox" && (
              <div className="h-full flex gap-6 overflow-hidden max-h-[calc(100vh-230px)]">
                {/* Inbox Left Sidebar: Customers List */}
                <div className="w-80 bg-slate-900/60 border border-slate-850 rounded-2xl flex flex-col overflow-hidden shrink-0">
                  <div className="p-4 border-b border-slate-850 bg-slate-900/20">
                    <h3 className="text-xs font-semibold uppercase text-slate-400 tracking-wider">Active Conversations</h3>
                  </div>
                  <div className="flex-1 overflow-y-auto divide-y divide-slate-850">
                    {chats.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-500">
                        No active WhatsApp chat sessions found. Start one in the simulator!
                      </div>
                    ) : (
                      chats.map((chat) => {
                        const isSelected = chat.phone === selectedChatPhone;
                        return (
                          <div
                            key={chat.id}
                            onClick={() => setSelectedChatPhone(chat.phone)}
                            className={`p-3.5 cursor-pointer hover:bg-slate-800/50 transition-all flex items-start justify-between gap-3 ${
                              isSelected ? "bg-emerald-500/10 border-l-2 border-emerald-500" : ""
                            }`}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-200 truncate block">
                                  {chat.name}
                                </span>
                                <span className={`text-[8px] px-1 rounded-sm uppercase ${
                                  chat.status === "HUMAN_HANDOVER" ? "bg-amber-500/20 text-amber-400" : "bg-emerald-500/20 text-emerald-400"
                                }`}>
                                  {chat.status === "HUMAN_HANDOVER" ? "Agent" : "AI"}
                                </span>
                              </div>
                              <span className="text-[10px] text-slate-400 block mb-1">{chat.phone}</span>
                              <p className="text-xs text-slate-400 truncate font-normal">
                                {chat.lastMessage ? chat.lastMessage.body : "No messages yet"}
                              </p>
                            </div>
                            <span className="text-[9px] text-slate-500 shrink-0">
                              {chat.lastMessage ? formatTime(chat.lastMessage.createdAt) : ""}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Inbox Right Panel: Selected Customer Chat Log & Agent Console */}
                <div className="flex-1 bg-slate-900/60 border border-slate-850 rounded-2xl flex flex-col overflow-hidden">
                  {selectedChatDetails ? (
                    <>
                      {/* Active Chat Header Controls */}
                      <div className="p-4 border-b border-slate-850 bg-slate-900/30 flex items-center justify-between shrink-0">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-slate-200">{selectedChatDetails.name}</h3>
                            <span className="text-xs text-slate-400">({selectedChatDetails.phone})</span>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            Status:{" "}
                            <span className={selectedChatDetails.status === "HUMAN_HANDOVER" ? "text-amber-400 font-semibold" : "text-emerald-400 font-semibold"}>
                              {selectedChatDetails.status === "HUMAN_HANDOVER" ? "Support Specialist Takeover (AI Paused)" : "AI Assistant Operating"}
                            </span>
                          </p>
                        </div>

                        {/* Takeover toggle button */}
                        <button
                          onClick={() => handleToggleTakeover(selectedChatDetails.phone, selectedChatDetails.status)}
                          className={`text-xs px-3.5 py-2 rounded-xl font-semibold transition-all border ${
                            selectedChatDetails.status === "HUMAN_HANDOVER"
                              ? "bg-emerald-600/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-600/20"
                              : "bg-amber-600/10 text-amber-400 border-amber-500/20 hover:bg-amber-600/20"
                          }`}
                        >
                          {selectedChatDetails.status === "HUMAN_HANDOVER" ? "🤖 Return to AI bot" : "🙋‍♂️ Manual Takeover"}
                        </button>
                      </div>

                      {/* Chat log contents */}
                      <div className="flex-1 p-4 overflow-y-auto space-y-3.5 bg-slate-950/20">
                        {selectedChatHistory.map((msg) => {
                          const isCustomer = msg.direction === "INBOUND";
                          return (
                            <div
                              key={msg.id}
                              className={`flex flex-col ${isCustomer ? "items-start" : "items-end"}`}
                            >
                              <div
                                className={`max-w-[70%] rounded-xl p-3 text-xs shadow-md ${
                                  isCustomer
                                    ? "bg-slate-800 text-slate-200"
                                    : msg.sender === "HUMAN"
                                    ? "bg-amber-650 text-white"
                                    : "bg-emerald-800 text-white"
                                }`}
                              >
                                <p className="whitespace-pre-line leading-relaxed">{msg.body}</p>
                              </div>
                              <div className="flex items-center gap-1.5 mt-1 text-[9px] text-slate-500 px-1">
                                <span>{formatTime(msg.createdAt)}</span>
                                <span className="font-semibold uppercase">• {msg.sender}</span>
                              </div>
                            </div>
                          );
                        })}
                        <div ref={agentEndRef} />
                      </div>

                      {/* Outbound reply form */}
                      <form onSubmit={handleSendAgentReply} className="p-4 border-t border-slate-850 bg-slate-900/20 flex gap-2 shrink-0">
                        <input
                          type="text"
                          value={agentReplyText}
                          onChange={(e) => setAgentReplyText(e.target.value)}
                          placeholder={
                            selectedChatDetails.status === "HUMAN_HANDOVER"
                              ? "Send a message as the support agent..."
                              : "Manual Takeover is disabled. Click 'Manual Takeover' above to type replies."
                          }
                          disabled={selectedChatDetails.status !== "HUMAN_HANDOVER"}
                          className="flex-1 bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed"
                        />
                        <button
                          type="submit"
                          disabled={selectedChatDetails.status !== "HUMAN_HANDOVER" || !agentReplyText.trim()}
                          className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-amber-600/10 active:scale-95"
                        >
                          Send Reply
                        </button>
                      </form>
                    </>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-6 text-slate-500 text-xs">
                      <svg className="w-10 h-10 text-slate-700 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      Select an active conversation session from the left sidebar to view history, perform live human takeover and pause/resume AI control.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ----------------- ANALYTICS TAB ----------------- */}
            {activeTab === "analytics" && (
              <div className="space-y-6">
                {/* Scorecards Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-slate-900/60 border border-slate-850 p-5 rounded-2xl shadow-md">
                    <div className="text-xs text-slate-400 font-semibold mb-1">Active Customer Contacts</div>
                    <div className="text-3xl font-extrabold text-slate-100">{chats.length}</div>
                    <div className="text-[10px] text-slate-500 mt-1">Unique numbers created</div>
                  </div>
                  
                  <div className="bg-slate-900/60 border border-slate-850 p-5 rounded-2xl shadow-md">
                    <div className="text-xs text-slate-400 font-semibold mb-1">Escalated Live Chats</div>
                    <div className="text-3xl font-extrabold text-amber-400">
                      {chats.filter(c => c.status === "HUMAN_HANDOVER").length}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1">Currently assigned to agents</div>
                  </div>

                  <div className="bg-slate-900/60 border border-slate-850 p-5 rounded-2xl shadow-md">
                    <div className="text-xs text-slate-400 font-semibold mb-1">Open Support Tickets</div>
                    <div className="text-3xl font-extrabold text-red-400">
                      {tickets.filter(t => t.status === "OPEN").length}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1">Unresolved tickets from AI</div>
                  </div>

                  <div className="bg-slate-900/60 border border-slate-850 p-5 rounded-2xl shadow-md">
                    <div className="text-xs text-slate-400 font-semibold mb-1">Total System Tickets</div>
                    <div className="text-3xl font-extrabold text-teal-400">{tickets.length}</div>
                    <div className="text-[10px] text-slate-500 mt-1">All tickets created</div>
                  </div>
                </div>

                {/* Additional metrics info */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* FAQs stats */}
                  <div className="bg-slate-900/60 border border-slate-850 p-5 rounded-2xl shadow-md">
                    <h3 className="text-sm font-bold text-slate-200 mb-3.5">Knowledge Base Stats</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between text-xs py-1.5 border-b border-slate-850">
                        <span className="text-slate-400">Total FAQ Q&A Articles</span>
                        <span className="font-bold text-slate-200">{faqs.length}</span>
                      </div>
                      <div className="flex justify-between text-xs py-1.5 border-b border-slate-850">
                        <span className="text-slate-400">Unique FAQ Categories</span>
                        <span className="font-bold text-slate-200">
                          {new Set(faqs.map(f => f.category || "General")).size}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Shopify mockup stats */}
                  <div className="bg-slate-900/60 border border-slate-850 p-5 rounded-2xl shadow-md">
                    <h3 className="text-sm font-bold text-slate-200 mb-3.5">Simulated Shopify Store Stats</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between text-xs py-1.5 border-b border-slate-850">
                        <span className="text-slate-400">Total Simulated Orders</span>
                        <span className="font-bold text-slate-200">{orders.length}</span>
                      </div>
                      <div className="flex justify-between text-xs py-1.5 border-b border-slate-850">
                        <span className="text-slate-400">Orders Status Breakdown</span>
                        <span className="font-bold text-slate-200 flex gap-2">
                          <span className="text-amber-400 font-extrabold">{orders.filter(o => o.status === "PROCESSING").length} Proc</span>
                          <span className="text-blue-400 font-extrabold">{orders.filter(o => o.status === "SHIPPED").length} Ship</span>
                          <span className="text-green-400 font-extrabold">{orders.filter(o => o.status === "DELIVERED").length} Deliv</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ----------------- TICKETS TAB ----------------- */}
            {activeTab === "tickets" && (
              <div className="bg-slate-900/60 border border-slate-850 rounded-2xl shadow-md overflow-hidden">
                <div className="p-4 border-b border-slate-850 bg-slate-900/20 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-200">Customer Support Tickets</h3>
                  <span className="text-xs text-slate-400">{tickets.length} tickets total</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-850 bg-slate-900/30 text-slate-400 font-bold uppercase tracking-wider">
                        <th className="p-4">Ticket ID</th>
                        <th className="p-4">Customer</th>
                        <th className="p-4">Problem Summary</th>
                        <th className="p-4">Status</th>
                        <th className="p-4">Date Created</th>
                        <th className="p-4">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850">
                      {tickets.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-6 text-center text-slate-500">
                            No customer support tickets created yet. When the AI fails to resolve inquiries, ticket generation starts!
                          </td>
                        </tr>
                      ) : (
                        tickets.map((t) => (
                          <tr key={t.id} className="hover:bg-slate-800/20 transition-all">
                            <td className="p-4 font-mono text-emerald-400 select-all font-semibold max-w-[120px] truncate">
                              {t.id}
                            </td>
                            <td className="p-4">
                              <div className="font-bold text-slate-200">{t.customer.name}</div>
                              <div className="text-[10px] text-slate-400 mt-0.5">{t.customer.phone}</div>
                            </td>
                            <td className="p-4 text-slate-300 max-w-xs break-words">{t.description}</td>
                            <td className="p-4">
                              <select
                                value={t.status}
                                onChange={(e) => handleUpdateTicketStatus(t.id, e.target.value)}
                                className={`px-2 py-1 rounded text-[10px] font-bold border outline-none ${
                                  t.status === "OPEN"
                                    ? "bg-red-500/10 text-red-400 border-red-500/20"
                                    : t.status === "IN_PROGRESS"
                                    ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                    : "bg-green-500/10 text-green-400 border-green-500/20"
                                }`}
                              >
                                <option value="OPEN" className="bg-slate-900 text-red-400">OPEN</option>
                                <option value="IN_PROGRESS" className="bg-slate-900 text-amber-400">IN PROGRESS</option>
                                <option value="RESOLVED" className="bg-slate-900 text-green-400">RESOLVED</option>
                              </select>
                            </td>
                            <td className="p-4 text-slate-400">
                              {new Date(t.createdAt).toLocaleString()}
                            </td>
                            <td className="p-4">
                              <button
                                onClick={() => handleDeleteTicket(t.id)}
                                className="text-red-400 hover:text-red-300 font-bold hover:underline"
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ----------------- FAQS TAB ----------------- */}
            {activeTab === "faqs" && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* FAQ Editor Form */}
                <div className="bg-slate-900/60 border border-slate-850 p-5 rounded-2xl shadow-md h-fit">
                  <h3 className="text-sm font-bold text-slate-200 mb-4">
                    {editingFaqId ? "✏️ Edit FAQ Article" : "➕ Create FAQ Article"}
                  </h3>
                  <form onSubmit={handleSaveFaq} className="space-y-4 text-xs">
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Category / Tag</label>
                      <input
                        type="text"
                        value={faqForm.category}
                        onChange={(e) => setFaqForm({ ...faqForm, category: e.target.value })}
                        placeholder="e.g. Shipping, Returns, Refund"
                        className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-3.5 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Question</label>
                      <input
                        type="text"
                        value={faqForm.question}
                        onChange={(e) => setFaqForm({ ...faqForm, question: e.target.value })}
                        placeholder="e.g. Do you ship to Canada?"
                        className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-3.5 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Detailed Answer</label>
                      <textarea
                        rows={4}
                        value={faqForm.answer}
                        onChange={(e) => setFaqForm({ ...faqForm, answer: e.target.value })}
                        placeholder="Provide policies and instructions..."
                        className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-3.5 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                        required
                      />
                    </div>
                    <div className="flex gap-2.5 pt-2">
                      <button
                        type="submit"
                        className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold shadow-md shadow-emerald-600/10 transition-all active:scale-95"
                      >
                        {editingFaqId ? "Update Article" : "Save Article"}
                      </button>
                      {editingFaqId && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingFaqId(null);
                            setFaqForm({ question: "", answer: "", category: "General" });
                          }}
                          className="px-3 py-2 bg-slate-850 hover:bg-slate-800 text-slate-300 rounded-xl border border-slate-800"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </form>
                </div>

                {/* FAQ List Table */}
                <div className="lg:col-span-2 bg-slate-900/60 border border-slate-850 rounded-2xl shadow-md overflow-hidden">
                  <div className="p-4 border-b border-slate-850 bg-slate-900/20">
                    <h3 className="text-sm font-bold text-slate-200">Knowledge Articles Database</h3>
                  </div>
                  <div className="divide-y divide-slate-850">
                    {faqs.length === 0 ? (
                      <div className="p-6 text-center text-slate-500 text-xs">
                        No articles added. Seed standard FAQs to start.
                      </div>
                    ) : (
                      faqs.map((f) => (
                        <div key={f.id} className="p-4 hover:bg-slate-800/10 transition-all text-xs flex gap-4 justify-between items-start">
                          <div className="space-y-1">
                            <span className="inline-block text-[9px] font-extrabold px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded">
                              {f.category}
                            </span>
                            <h4 className="font-extrabold text-slate-200 text-sm">{f.question}</h4>
                            <p className="text-slate-400 text-[11px] leading-relaxed whitespace-pre-line">{f.answer}</p>
                          </div>
                          
                          <div className="flex gap-2 shrink-0">
                            <button
                              onClick={() => handleEditFaq(f)}
                              className="text-emerald-400 hover:text-emerald-300 hover:underline font-bold"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteFaq(f.id!)}
                              className="text-red-400 hover:text-red-300 hover:underline font-bold"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ----------------- SHOPIFY TAB ----------------- */}
            {activeTab === "shopify" && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Mock Order Creator Form */}
                <div className="bg-slate-900/60 border border-slate-850 p-5 rounded-2xl shadow-md h-fit">
                  <h3 className="text-sm font-bold text-slate-200 mb-4">
                    {editingOrderId ? "✏️ Edit Shopify Order" : "➕ Mock Shopify Order"}
                  </h3>
                  <form onSubmit={handleSaveOrder} className="space-y-4 text-xs">
                    <div className="grid grid-cols-2 gap-3.5">
                      <div>
                        <label className="block text-slate-400 font-semibold mb-1">Order #</label>
                        <input
                          type="text"
                          value={orderForm.orderNumber}
                          onChange={(e) => setOrderForm({ ...orderForm, orderNumber: e.target.value })}
                          placeholder="e.g. 1548"
                          className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-3.5 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                          required
                          disabled={!!editingOrderId}
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 font-semibold mb-1">Delivery Status</label>
                        <select
                          value={orderForm.status}
                          onChange={(e) => setOrderForm({ ...orderForm, status: e.target.value })}
                          className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-3.5 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                        >
                          <option value="PENDING" className="bg-slate-900 text-slate-100">PENDING</option>
                          <option value="PROCESSING" className="bg-slate-900 text-slate-100">PROCESSING</option>
                          <option value="SHIPPED" className="bg-slate-900 text-slate-100">SHIPPED</option>
                          <option value="DELIVERED" className="bg-slate-900 text-slate-100">DELIVERED</option>
                          <option value="CANCELLED" className="bg-slate-900 text-slate-100">CANCELLED</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Customer Full Name</label>
                      <input
                        type="text"
                        value={orderForm.customerName}
                        onChange={(e) => setOrderForm({ ...orderForm, customerName: e.target.value })}
                        placeholder="e.g. John Doe"
                        className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-3.5 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Email Address</label>
                      <input
                        type="email"
                        value={orderForm.email}
                        onChange={(e) => setOrderForm({ ...orderForm, email: e.target.value })}
                        placeholder="e.g. john@example.com"
                        className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-3.5 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Ordered Items (Description)</label>
                      <input
                        type="text"
                        value={orderForm.items}
                        onChange={(e) => setOrderForm({ ...orderForm, items: e.target.value })}
                        placeholder="e.g. 1x Wireless Headphone, 2x Premium Cable"
                        className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-3.5 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Tracking URL (optional)</label>
                      <input
                        type="url"
                        value={orderForm.trackingUrl}
                        onChange={(e) => setOrderForm({ ...orderForm, trackingUrl: e.target.value })}
                        placeholder="e.g. https://track.package.com/1234"
                        className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-3.5 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div className="flex gap-2.5 pt-2">
                      <button
                        type="submit"
                        className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold shadow-md shadow-emerald-600/10 transition-all active:scale-95"
                      >
                        {editingOrderId ? "Update Order" : "Inject Order"}
                      </button>
                      {editingOrderId && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingOrderId(null);
                            setOrderForm({
                              orderNumber: "",
                              customerName: "",
                              email: "",
                              status: "PROCESSING",
                              items: "",
                              trackingUrl: "",
                            });
                          }}
                          className="px-3 py-2 bg-slate-850 hover:bg-slate-800 text-slate-300 rounded-xl border border-slate-800"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </form>
                </div>

                {/* Orders List Table */}
                <div className="lg:col-span-2 bg-slate-900/60 border border-slate-850 rounded-2xl shadow-md overflow-hidden">
                  <div className="p-4 border-b border-slate-850 bg-slate-900/20">
                    <h3 className="text-sm font-bold text-slate-200">Shopify Mock Database</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-850 bg-slate-900/30 text-slate-400 font-bold uppercase tracking-wider">
                          <th className="p-4">Order #</th>
                          <th className="p-4">Customer Details</th>
                          <th className="p-4">Items</th>
                          <th className="p-4">Delivery Status</th>
                          <th className="p-4">Tracking</th>
                          <th className="p-4">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-850 text-[11px]">
                        {orders.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="p-6 text-center text-slate-500">
                              No mock Shopify orders found.
                            </td>
                          </tr>
                        ) : (
                          orders.map((o) => (
                            <tr key={o.id} className="hover:bg-slate-800/10 transition-all">
                              <td className="p-4 font-bold text-slate-200">#{o.orderNumber}</td>
                              <td className="p-4">
                                <div className="font-bold text-slate-200">{o.customerName}</div>
                                <div className="text-[10px] text-slate-400 mt-0.5">{o.email}</div>
                              </td>
                              <td className="p-4 text-slate-300 font-medium">{o.items}</td>
                              <td className="p-4">
                                <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase ${
                                  o.status === "DELIVERED"
                                    ? "bg-green-500/10 text-green-400 border border-green-500/20"
                                    : o.status === "SHIPPED"
                                    ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                                    : o.status === "CANCELLED"
                                    ? "bg-red-500/10 text-red-400 border border-red-500/20"
                                    : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                }`}>
                                  {o.status}
                                </span>
                              </td>
                              <td className="p-4 truncate max-w-[140px]">
                                {o.trackingUrl ? (
                                  <a href={o.trackingUrl} target="_blank" rel="noreferrer" className="text-emerald-400 hover:underline">
                                    Click here to Track
                                  </a>
                                ) : (
                                  <span className="text-slate-500">No link</span>
                                )}
                              </td>
                              <td className="p-4">
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleEditOrder(o)}
                                    className="text-emerald-400 hover:text-emerald-300 hover:underline font-bold"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => handleDeleteOrder(o.id!)}
                                    className="text-red-400 hover:text-red-300 hover:underline font-bold"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* 3. New Chat Modal for Simulator */}
      {showNewSimChatModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-200">Start New Test Session</h3>
              <button
                onClick={() => setShowNewSimChatModal(false)}
                className="text-slate-400 hover:text-slate-200 text-sm"
              >
                ✖
              </button>
            </div>

            <form onSubmit={handleStartSimChat} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Testing Phone Number</label>
                <input
                  type="text"
                  value={simPhone}
                  onChange={(e) => setSimPhone(e.target.value)}
                  placeholder="e.g. +15550199"
                  className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-3.5 py-2.5 text-slate-100 focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Customer Profile Name</label>
                <input
                  type="text"
                  value={simName}
                  onChange={(e) => setSimName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-3.5 py-2.5 text-slate-100 focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold shadow-md shadow-emerald-600/10 transition-all active:scale-95"
                >
                  Start Testing Session
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewSimChatModal(false)}
                  className="px-4 py-2.5 bg-slate-800 text-slate-300 rounded-xl border border-slate-800"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Seed FAQs
  const faqs = [
    {
      question: "What is your return policy?",
      answer: "We offer a 30-day return policy for all items in their original condition and packaging. Return shipping is free. To start a return, please visit our online portal or ask me to open a support ticket for our team.",
      category: "Returns"
    },
    {
      question: "How long does shipping take?",
      answer: "Standard shipping takes 3-5 business days. Express shipping takes 1-2 business days. Shipping tracking details are sent via email once your order ships.",
      category: "Shipping"
    },
    {
      question: "Where do you ship to?",
      answer: "We ship worldwide! Domestic shipping within the US is free for orders over $50. International shipping rates and times vary by country and are calculated at checkout.",
      category: "Shipping"
    },
    {
      question: "When will I get my refund?",
      answer: "Refunds are processed within 5-7 business days after we receive your returned items. The amount will be credited back to your original payment method.",
      category: "Billing"
    }
  ];

  for (const faq of faqs) {
    await prisma.fAQ.create({
      data: faq
    });
  }

  // Seed Orders
  const orders = [
    {
      orderNumber: "1548",
      customerName: "John Doe",
      email: "john.doe@example.com",
      status: "SHIPPED",
      items: "1x Wireless Headphones, 1x Leather Phone Case",
      trackingUrl: "https://track.package.com/123456789"
    },
    {
      orderNumber: "2040",
      customerName: "Jane Smith",
      email: "jane.smith@example.com",
      status: "PROCESSING",
      items: "1x Ergonomic Keyboard, 1x Wireless Mouse",
      trackingUrl: null
    },
    {
      orderNumber: "3012",
      customerName: "Robert Johnson",
      email: "robert.johnson@example.com",
      status: "DELIVERED",
      items: "2x Premium USB-C Cables, 1x 65W GaN Charger",
      trackingUrl: "https://track.package.com/987654321"
    }
  ];

  for (const order of orders) {
    await prisma.order.create({
      data: order
    });
  }

  console.log("Database seeded successfully!");
}

main()
  .catch((e) => {
    console.error("Error seeding database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

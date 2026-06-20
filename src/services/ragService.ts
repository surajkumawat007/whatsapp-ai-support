import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function searchFAQ(query: string): Promise<{ question: string; answer: string; score: number } | null> {
  const faqs = await prisma.fAQ.findMany();
  if (faqs.length === 0) return null;

  const queryTokens = tokenize(query);
  let bestFaq = null;
  let highestScore = 0;

  for (const faq of faqs) {
    const questionTokens = tokenize(faq.question);
    const categoryTokens = faq.category ? tokenize(faq.category) : [];
    
    // Simple overlap scoring
    let matches = 0;
    queryTokens.forEach(token => {
      if (questionTokens.includes(token)) matches += 1.5; // weight question matches higher
      if (categoryTokens.includes(token)) matches += 1.0;
    });

    // Normalize by query length to prevent long queries from matching everything
    const score = matches / (Math.sqrt(queryTokens.length * questionTokens.length) || 1);

    if (score > highestScore) {
      highestScore = score;
      bestFaq = faq;
    }
  }

  // Threshold check to avoid irrelevant answers
  if (highestScore > 0.15 && bestFaq) {
    return {
      question: bestFaq.question,
      answer: bestFaq.answer,
      score: highestScore
    };
  }

  return null;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter(token => token.length > 2); // filter out short words like 'is', 'to', 'a'
}

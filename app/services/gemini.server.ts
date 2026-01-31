import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize Gemini client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// Tone configurations for different brand voices
const TONE_PROMPTS: Record<string, string> = {
  PROFESSIONAL: "Use a professional, authoritative tone. Be clear, concise, and trustworthy.",
  FUN: "Use a fun, energetic tone. Be playful and engaging while remaining informative.",
  URGENT: "Use an urgent, action-driven tone. Create FOMO and encourage immediate action.",
  LUXURY: "Use a sophisticated, premium tone. Emphasize exclusivity, quality, and elegance.",
};

interface ProductInput {
  title: string;
  description: string;
  vendor: string;
  tags: string[];
  price?: string;
}

/**
 * Generates an SEO-optimized meta description using Gemini AI
 * @param product - Product data from Shopify
 * @param tone - Brand voice tone (PROFESSIONAL, FUN, URGENT, LUXURY)
 * @returns Meta description string (130-160 chars) or null on failure
 */
export async function generateMetaDescription(
  product: ProductInput,
  tone: string = "PROFESSIONAL"
): Promise<string | null> {
  // 1. Sanitize and prepare inputs
  const cleanDescription = product.description
    .replace(/<[^>]*>/g, "") // Strip HTML
    .replace(/\s+/g, " ")    // Normalize whitespace
    .slice(0, 500)           // Limit to save tokens
    .trim();

  const cleanTags = product.tags
    .filter(tag => tag.length > 0)
    .slice(0, 10)
    .join(", ");

  const toneInstruction = TONE_PROMPTS[tone] || TONE_PROMPTS.PROFESSIONAL;

  // 2. Construct the prompt
  const systemPrompt = `You are an expert SEO copywriter specializing in e-commerce product descriptions.

STRICT RULES:
1. LENGTH: Output MUST be between 130 and 160 characters. This is a hard requirement.
2. TONE: ${toneInstruction}
3. SOURCE: ONLY use the provided product information. Do NOT invent features or claims.
4. FORMAT:
   - No hashtags
   - No emojis
   - No ALL CAPS words
   - No quotation marks in the output
   - No special characters like ™ or ®
5. STRUCTURE:
   - Start with a strong action verb (Shop, Discover, Upgrade, Experience, etc.)
   - Include 1-2 key product benefits
   - End with a value proposition or call-to-action implication
6. OUTPUT: Return ONLY the meta description text. No explanations, no alternatives, no formatting.`;

  const userPrompt = `Write a meta description for this product:

Product Title: ${product.title}
Brand: ${product.vendor}
Tags/Keywords: ${cleanTags}
${product.price ? `Price: ${product.price}` : ""}
Product Details: ${cleanDescription || "No description available"}

Remember: Output ONLY the meta description (130-160 characters).`;

  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: {
        temperature: 0.3,      // Low creativity for consistency
        maxOutputTokens: 100,  // Limit output length
        topP: 0.8,
        topK: 40,
      },
    });

    const result = await model.generateContent([systemPrompt, userPrompt]);
    const response = await result.response;
    let output = response.text().trim();

    // 3. Post-processing validation
    if (!output) {
      console.error("[Gemini] Empty response received");
      return null;
    }

    // Remove any quotes that might wrap the response
    output = output.replace(/^["']|["']$/g, "");

    // Remove any markdown formatting
    output = output.replace(/\*\*/g, "").replace(/\*/g, "");

    // Validate length
    if (output.length < 50) {
      console.error("[Gemini] Response too short:", output.length, "chars");
      return null;
    }

    // Truncate if too long (with graceful ending)
    if (output.length > 160) {
      // Find last complete word before 157 chars
      const truncated = output.slice(0, 157);
      const lastSpace = truncated.lastIndexOf(" ");
      if (lastSpace > 100) {
        output = truncated.slice(0, lastSpace) + "...";
      } else {
        output = truncated + "...";
      }
    }

    console.log(`[Gemini] Generated meta description (${output.length} chars)`);
    return output;

  } catch (error) {
    console.error("[Gemini] Generation failed:", error);
    return null;
  }
}

/**
 * Batch generate meta descriptions for multiple products
 * @param products - Array of product data
 * @param tone - Brand voice tone
 * @returns Array of results with productId and generated description
 */
export async function batchGenerateMetaDescriptions(
  products: (ProductInput & { id: string })[],
  tone: string = "PROFESSIONAL"
): Promise<{ id: string; description: string | null }[]> {
  const results: { id: string; description: string | null }[] = [];

  for (const product of products) {
    // Add small delay between requests to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 200));

    const description = await generateMetaDescription(product, tone);
    results.push({
      id: product.id,
      description,
    });
  }

  return results;
}

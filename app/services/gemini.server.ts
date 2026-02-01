import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize Gemini client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// Tone configurations for different brand voices
export const TONE_PROMPTS: Record<string, string> = {
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
 * @param customPrompt - Optional custom instructions to override default prompt
 * @returns Meta description string (130-160 chars) or null on failure
 */
export async function generateMetaDescription(
  product: ProductInput,
  tone: string = "PROFESSIONAL",
  customPrompt?: string | null
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

  // 2. Construct the prompt (use custom if provided)
  const systemPrompt = customPrompt
    ? `${customPrompt}

TONE: ${toneInstruction}
LENGTH: Output MUST be between 130 and 160 characters.
OUTPUT: Return ONLY the meta description text. No explanations.`
    : `You are an expert SEO copywriter specializing in e-commerce product descriptions.

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
 * Generates an SEO-optimized meta title using Gemini AI
 * @param product - Product data from Shopify
 * @param tone - Brand voice tone (PROFESSIONAL, FUN, URGENT, LUXURY)
 * @param customPrompt - Optional custom instructions to override default prompt
 * @returns Meta title string (50-60 chars) or null on failure
 */
export async function generateMetaTitle(
  product: ProductInput,
  tone: string = "PROFESSIONAL",
  customPrompt?: string | null
): Promise<string | null> {
  const toneInstruction = TONE_PROMPTS[tone] || TONE_PROMPTS.PROFESSIONAL;

  // Clean the product description for context
  const cleanDescription = product.description
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 300)
    .trim();

  const cleanTags = product.tags
    .filter(tag => tag.length > 0)
    .slice(0, 5)
    .join(", ");

  // Use custom prompt if provided, otherwise use default
  const systemPrompt = customPrompt
    ? `${customPrompt}

TONE: ${toneInstruction}
LENGTH: Output MUST be between 50 and 60 characters.
OUTPUT: Return ONLY the meta title text. No explanations.`
    : `You are an expert SEO copywriter specializing in e-commerce product titles.

STRICT RULES:
1. LENGTH: Output MUST be between 50 and 60 characters. This is a hard requirement.
2. TONE: ${toneInstruction}
3. SOURCE: ONLY use the provided product information. Do NOT invent features.
4. FORMAT:
   - No emojis
   - No ALL CAPS words (except brand names if appropriate)
   - No special characters like ™ or ®
   - No quotation marks
   - Use title case (capitalize first letter of major words)
5. STRUCTURE:
   - Include the core product name/type
   - Add 1-2 key differentiating features or benefits
   - Include brand name if space allows and it adds value
   - Make it compelling and click-worthy
6. OUTPUT: Return ONLY the meta title text. No explanations, no alternatives.`;

  const userPrompt = `Write an SEO meta title for this product:

Product Title: ${product.title}
Brand: ${product.vendor}
Tags/Keywords: ${cleanTags}
${product.price ? `Price: ${product.price}` : ""}
Product Details: ${cleanDescription || "No description available"}

Remember: Output ONLY the meta title (50-60 characters).`;

  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 50,
        topP: 0.8,
        topK: 40,
      },
    });

    const result = await model.generateContent([systemPrompt, userPrompt]);
    const response = await result.response;
    let output = response.text().trim();

    if (!output) {
      console.error("[Gemini] Empty title response received");
      return null;
    }

    // Remove any quotes that might wrap the response
    output = output.replace(/^["']|["']$/g, "");

    // Remove any markdown formatting
    output = output.replace(/\*\*/g, "").replace(/\*/g, "");

    // Validate minimum length
    if (output.length < 20) {
      console.error("[Gemini] Title too short:", output.length, "chars");
      return null;
    }

    // Truncate if too long (with graceful ending)
    if (output.length > 60) {
      const truncated = output.slice(0, 57);
      const lastSpace = truncated.lastIndexOf(" ");
      if (lastSpace > 40) {
        output = truncated.slice(0, lastSpace);
      } else {
        output = truncated;
      }
    }

    console.log(`[Gemini] Generated meta title (${output.length} chars): ${output}`);
    return output;

  } catch (error) {
    console.error("[Gemini] Title generation failed:", error);
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

/**
 * Generates SEO-optimized alt text for a product image using Gemini Vision
 * @param imageUrl - URL of the product image
 * @param productTitle - Product title for context
 * @param tone - Brand voice tone
 * @param customPrompt - Optional custom instructions
 * @returns Alt text string (max 125 chars for accessibility) or null on failure
 */
export async function generateAltTextWithVision(
  imageUrl: string,
  productTitle: string,
  tone: string = "PROFESSIONAL",
  customPrompt?: string | null
): Promise<string | null> {
  try {
    // Fetch the image and convert to base64
    // Use a smaller image size for faster processing (Shopify CDN supports size params)
    const optimizedUrl = imageUrl.includes("?")
      ? `${imageUrl}&width=400`
      : `${imageUrl}?width=400`;

    const imageResponse = await fetch(optimizedUrl);
    if (!imageResponse.ok) {
      console.error(`[Gemini] Failed to fetch image: ${imageResponse.status}`);
      return null;
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString("base64");

    // Determine mime type from URL or default to jpeg
    let mimeType = "image/jpeg";
    if (imageUrl.toLowerCase().includes(".png")) {
      mimeType = "image/png";
    } else if (imageUrl.toLowerCase().includes(".webp")) {
      mimeType = "image/webp";
    } else if (imageUrl.toLowerCase().includes(".gif")) {
      mimeType = "image/gif";
    }

    const toneInstruction = TONE_PROMPTS[tone] || TONE_PROMPTS.PROFESSIONAL;

    // Build the prompt
    const prompt = customPrompt
      ? `${customPrompt}

Product: ${productTitle}
TONE: ${toneInstruction}
LENGTH: Keep under 125 characters for accessibility.
OUTPUT: Return ONLY the alt text. No explanations.`
      : `Generate SEO-optimized alt text for this product image.

RULES:
1. DESCRIBE what you actually see in the image (colors, shapes, materials, details)
2. Include the product type and key visible features
3. Keep under 125 characters for accessibility compliance
4. Do NOT invent features not visible in the image
5. TONE: ${toneInstruction}

Product: ${productTitle}

OUTPUT: Return ONLY the alt text. No quotes, no explanations.`;

    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 60,
        topP: 0.8,
        topK: 40,
      },
    });

    const result = await model.generateContent([
      { text: prompt },
      {
        inlineData: {
          mimeType,
          data: base64Image,
        },
      },
    ]);

    const response = await result.response;
    let output = response.text().trim();

    if (!output) {
      console.error("[Gemini] Empty alt text response");
      return null;
    }

    // Clean up the output
    output = output.replace(/^["']|["']$/g, ""); // Remove quotes
    output = output.replace(/\*\*/g, "").replace(/\*/g, ""); // Remove markdown

    // Ensure it's not too long
    if (output.length > 125) {
      const truncated = output.slice(0, 122);
      const lastSpace = truncated.lastIndexOf(" ");
      if (lastSpace > 80) {
        output = truncated.slice(0, lastSpace) + "...";
      } else {
        output = truncated + "...";
      }
    }

    console.log(`[Gemini] Generated alt text (${output.length} chars): ${output}`);
    return output;
  } catch (error) {
    console.error("[Gemini] Alt text generation failed:", error);
    return null;
  }
}

/**
 * Fallback text-only alt text generation (when vision fails or for testing)
 */
export async function generateAltTextFallback(
  productTitle: string,
  productDescription: string,
  tone: string = "PROFESSIONAL",
  customPrompt?: string | null
): Promise<string | null> {
  const cleanDescription = productDescription
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 200)
    .trim();

  const toneInstruction = TONE_PROMPTS[tone] || TONE_PROMPTS.PROFESSIONAL;

  const prompt = customPrompt
    ? `${customPrompt}

Product: ${productTitle}
Description: ${cleanDescription}
TONE: ${toneInstruction}
LENGTH: Keep under 125 characters.
OUTPUT: Return ONLY the alt text.`
    : `Generate alt text for a product image based on this information:

Product: ${productTitle}
Description: ${cleanDescription}

RULES:
1. Describe what a typical product image would show
2. Keep under 125 characters
3. TONE: ${toneInstruction}

OUTPUT: Return ONLY the alt text. No quotes.`;

  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 60,
      },
    });

    const result = await model.generateContent(prompt);
    let output = result.response.text().trim();

    if (!output) return null;

    output = output.replace(/^["']|["']$/g, "");
    if (output.length > 125) {
      output = output.slice(0, 122) + "...";
    }

    console.log(`[Gemini] Generated fallback alt text (${output.length} chars)`);
    return output;
  } catch (error) {
    console.error("[Gemini] Fallback alt text failed:", error);
    return null;
  }
}

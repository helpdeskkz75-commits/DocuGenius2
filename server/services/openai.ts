import OpenAI from 'openai';

let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient && process.env.OPENAI_API_KEY) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  if (!openaiClient) {
    throw new Error('OpenAI API key not configured');
  }
  return openaiClient;
}

// Industry-specific system prompts
const INDUSTRY_PROMPTS = {
  retail: "You are an AI assistant for a retail business. Help customers find products, provide pricing information, and assist with orders. Be friendly and sales-focused.",
  construction: "You are an AI assistant for a construction and building materials company. Help customers with technical specifications, material requirements, and project estimates.",
  automotive: "You are an AI assistant for an automotive business. Help customers with vehicle parts, maintenance advice, and service scheduling.",
  'real-estate': "You are an AI assistant for a real estate business. Help clients with property information, viewing schedules, and market insights.",
  'food-service': "You are an AI assistant for a restaurant/food service. Help customers with menu information, orders, and dietary requirements.",
  healthcare: "You are an AI assistant for a healthcare service. Provide general information and help schedule appointments. Always advise consulting professionals for medical advice.",
  beauty: "You are an AI assistant for a beauty and cosmetics business. Help customers choose products, provide beauty tips, and assist with orders.",
  tech: "You are an AI assistant for a technology company. Help with product information, technical support, and service inquiries.",
  finance: "You are an AI assistant for financial services. Provide general information about services and help schedule consultations. Always advise consulting professionals for financial advice.",
  education: "You are an AI assistant for an educational institution. Help with course information, enrollment, and academic support.",
  travel: "You are an AI assistant for a travel and tourism business. Help customers plan trips, book services, and provide travel information.",
  fitness: "You are an AI assistant for a fitness and wellness business. Help with membership information, class schedules, and wellness tips."
};

// Personality adjustments
const PERSONALITY_ADJUSTMENTS = {
  professional: "Maintain a professional and business-focused tone.",
  friendly: "Be warm, friendly, and conversational in your responses.",
  expert: "Provide detailed, technical, and authoritative information.",
  casual: "Keep responses relaxed, casual, and easy to understand.",
  enthusiastic: "Be energetic, positive, and enthusiastic in your responses."
};

interface AIConfig {
  industry?: string;
  personality?: string;
  temperature?: number;
  maxTokens?: number;
  contextMemory?: boolean;
}

export async function generateAIResponse(
  message: string, 
  conversationHistory: Array<{role: 'user' | 'assistant', content: string}> = [],
  config: AIConfig = {}
): Promise<string> {
  try {
    const client = getOpenAIClient();
    
    const industry = config.industry || 'retail';
    const personality = config.personality || 'professional';
    const temperature = config.temperature || 0.7;
    const maxTokens = config.maxTokens || 1000;
    const useContext = config.contextMemory !== false;

    // Build system prompt
    let systemPrompt = INDUSTRY_PROMPTS[industry as keyof typeof INDUSTRY_PROMPTS] || INDUSTRY_PROMPTS.retail;
    systemPrompt += ' ' + PERSONALITY_ADJUSTMENTS[personality as keyof typeof PERSONALITY_ADJUSTMENTS];
    systemPrompt += ' Always respond in the same language as the user (Russian or Kazakh).';

    // Build messages array
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt }
    ];

    // Add conversation history if enabled
    if (useContext && conversationHistory.length > 0) {
      // Keep last 10 messages to manage token usage
      const recentHistory = conversationHistory.slice(-10);
      messages.push(...recentHistory.map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      })));
    }

    // Add current message
    messages.push({ role: 'user', content: message });

    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    
    const response = await client.chat.completions.create({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    });

    return response.choices[0]?.message?.content || 'Извините, не могу ответить прямо сейчас.';
  } catch (error: any) {
    console.error('OpenAI API error:', error);
    if (error?.status === 401) {
      throw new Error('OpenAI API key is invalid');
    } else if (error?.status === 429) {
      throw new Error('OpenAI API rate limit exceeded');
    } else if (error?.status === 500) {
      throw new Error('OpenAI API is currently unavailable');
    }
    throw new Error('Failed to generate AI response');
  }
}

export async function generateProductRecommendations(
  userQuery: string,
  products: Array<{name: string, category: string, sku: string, price: number}>,
  config: AIConfig = {}
): Promise<string> {
  try {
    const client = getOpenAIClient();
    
    const productsContext = products.slice(0, 10).map(p => 
      `${p.name} (${p.category}) - ${p.price} KZT - SKU: ${p.sku}`
    ).join('\n');

    const prompt = `Based on the user's request "${userQuery}" and the following available products:

${productsContext}

Recommend the most suitable products and explain why they match the user's needs. Respond in the same language as the user's query.`;

    const response = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a helpful product recommendation assistant.' },
        { role: 'user', content: prompt }
      ],
      temperature: config.temperature || 0.7,
      max_tokens: config.maxTokens || 500,
    });

    return response.choices[0]?.message?.content || 'Не могу предоставить рекомендации в данный момент.';
  } catch (error: any) {
    console.error('Product recommendation error:', error);
    return 'Не удалось сгенерировать рекомендации товаров.';
  }
}
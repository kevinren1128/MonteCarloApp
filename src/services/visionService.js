/**
 * Vision Service
 *
 * @module services/visionService
 * @description AI vision API integration for extracting position data from screenshots
 */

const STORAGE_KEY = 'monte-carlo-vision-api';

const EXTRACTION_PROMPT = `Analyze this screenshot of a brokerage positions page (likely Interactive Brokers / IBKR).

Extract all stock/ETF positions and return them as a JSON array. For each position, extract:
- ticker: The stock symbol (string, uppercase, e.g., "AAPL", "MSFT")
- quantity: Number of shares (integer, negative for short positions)
- price: Current market price per share if visible (number, optional)
- marketValue: Total market value if visible (number, optional)
- currency: Currency code if not USD (string, optional, e.g., "EUR", "GBP")
- name: Company/fund name if visible (string, optional)

Return ONLY valid JSON in this exact format (no markdown, no explanation):
{
  "positions": [
    { "ticker": "AAPL", "quantity": 100, "price": 185.50, "name": "Apple Inc" },
    { "ticker": "MSFT", "quantity": -50, "price": 378.25, "name": "Microsoft Corp" }
  ],
  "confidence": 0.95,
  "notes": "Any parsing issues or ambiguities"
}

If you cannot extract positions, return:
{ "positions": [], "error": "Description of the issue" }`;

/**
 * Save API settings to localStorage
 */
export const saveApiSettings = (apiKey, provider = 'claude') => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ apiKey, provider }));
  } catch (err) {
    console.warn('Failed to save API settings:', err);
  }
};

/**
 * Get API settings from localStorage
 */
export const getApiSettings = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch (err) {
    console.warn('Failed to load API settings:', err);
    return null;
  }
};

/**
 * Clear API settings from localStorage
 */
export const clearApiSettings = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn('Failed to clear API settings:', err);
  }
};

/**
 * Extract positions from image using Claude API
 */
const extractWithClaude = async (imageBase64, mediaType, apiKey) => {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: imageBase64,
            },
          },
          {
            type: 'text',
            text: EXTRACTION_PROMPT,
          },
        ],
      }],
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    if (response.status === 401) {
      throw new Error('Invalid API key. Please check your Anthropic API key.');
    }
    if (response.status === 429) {
      throw new Error('Rate limit exceeded. Please wait a moment and try again.');
    }
    throw new Error(error.error?.message || `API error: ${response.status}`);
  }

  const data = await response.json();
  return data.content?.[0]?.text || '';
};

/**
 * Extract positions from image using OpenAI API
 */
const extractWithOpenAI = async (imageBase64, mediaType, apiKey) => {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'text',
            text: EXTRACTION_PROMPT,
          },
          {
            type: 'image_url',
            image_url: {
              url: `data:${mediaType};base64,${imageBase64}`,
            },
          },
        ],
      }],
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    if (response.status === 401) {
      throw new Error('Invalid API key. Please check your OpenAI API key.');
    }
    if (response.status === 429) {
      throw new Error('Rate limit exceeded. Please wait a moment and try again.');
    }
    throw new Error(error.error?.message || `API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
};

/**
 * Parse the AI response to extract positions
 */
const parseResponse = (text) => {
  // Try to extract JSON from response (may be wrapped in markdown)
  let jsonStr = text;

  // Remove markdown code blocks if present
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1];
  } else {
    // Try to find raw JSON object
    const objectMatch = text.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      jsonStr = objectMatch[0];
    }
  }

  const parsed = JSON.parse(jsonStr);

  if (parsed.error) {
    throw new Error(parsed.error);
  }

  if (!parsed.positions || !Array.isArray(parsed.positions)) {
    throw new Error('Invalid response format: missing positions array');
  }

  // Normalize and validate positions
  const positions = parsed.positions
    .filter(p => p.ticker && typeof p.ticker === 'string')
    .map(p => ({
      ticker: p.ticker.toUpperCase().trim(),
      quantity: parseInt(p.quantity) || 0,
      price: p.price ? parseFloat(p.price) : null,
      marketValue: p.marketValue ? parseFloat(p.marketValue) : null,
      currency: p.currency || 'USD',
      name: p.name || null,
    }));

  return {
    positions,
    confidence: parsed.confidence || null,
    notes: parsed.notes || null,
  };
};

/**
 * Extract positions from an image using AI vision
 *
 * @param {string} imageBase64 - Base64 encoded image data (without data URL prefix)
 * @param {string} mediaType - Image MIME type (e.g., 'image/png')
 * @param {string} apiKey - API key for the provider
 * @param {string} provider - 'claude' or 'openai'
 * @returns {Promise<{positions: Array, confidence: number, notes: string}>}
 */
export const extractPositionsFromImage = async (imageBase64, mediaType, apiKey, provider = 'claude') => {
  if (!imageBase64) {
    throw new Error('No image provided');
  }
  if (!apiKey) {
    throw new Error('API key is required');
  }

  let responseText;

  if (provider === 'openai') {
    responseText = await extractWithOpenAI(imageBase64, mediaType, apiKey);
  } else {
    responseText = await extractWithClaude(imageBase64, mediaType, apiKey);
  }

  if (!responseText) {
    throw new Error('Empty response from API');
  }

  return parseResponse(responseText);
};

/**
 * Process an image file for upload
 *
 * @param {File} file - Image file
 * @returns {Promise<{base64: string, mediaType: string}>}
 */
export const processImageFile = (file) => {
  return new Promise((resolve, reject) => {
    // Validate type
    const validTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      reject(new Error('Invalid image format. Please use PNG, JPG, WebP, or GIF.'));
      return;
    }

    // Validate size (max 10MB for API limits)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      reject(new Error('Image too large. Maximum size is 10MB.'));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      // Extract base64 data (remove data URL prefix)
      const base64 = dataUrl.split(',')[1];
      resolve({
        base64,
        mediaType: file.type,
      });
    };
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });
};

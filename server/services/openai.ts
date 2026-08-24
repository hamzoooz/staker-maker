import fs from 'fs';
import path from 'path';
import { STICKER_STYLES } from '../../src/data/constants.js';
import { ExpressionId, StickerStyleId } from '../../src/types/index.js';
import { storageService } from './storage.js';
import { db } from '../db.js';

export interface GenerateStickerParams {
  orderId: string;
  photoUrl: string;
  styleId: StickerStyleId;
  expressionId: ExpressionId;
  expressionPrompt: string;
  expressionName: string;
  bubbleText?: string;
  canonicalCharacterPrompt?: string;
}

export interface GeneratedStickerResult {
  rawBase64?: string;
  publicUrl?: string;
  success: boolean;
  error?: string;
}

export class OpenAIService {
  private systemPromptCache: string | null = null;
  private lastPromptRead: number = 0;

  public getSystemPrompt(): string {
    const now = Date.now();
    if (this.systemPromptCache && now - this.lastPromptRead < 10000) {
      return this.systemPromptCache;
    }

    try {
      const promptPath = path.join(process.cwd(), 'system-promper.md');
      if (fs.existsSync(promptPath)) {
        this.systemPromptCache = fs.readFileSync(promptPath, 'utf-8');
        this.lastPromptRead = now;
        return this.systemPromptCache;
      }
    } catch (err) {
      console.warn('Could not read system-promper.md:', err);
    }

    return 'StickerMe AI Engine: Transform user selfies into expressive, high-impact personalized messaging stickers for WhatsApp and Telegram.';
  }

  public getApiKey(): string {
    const settings = db.getSettings();
    return settings.openaiApiKey || process.env.OPENAI_API_KEY || '';
  }

  /**
   * Analyzes selfie face features with GPT-4o vision to anchor identity
   */
  public async analyzeFaceAndCreateAnchor(
    photoUrl: string,
    styleId: StickerStyleId
  ): Promise<string> {
    const apiKey = this.getApiKey();
    const styleObj = STICKER_STYLES.find(s => s.id === styleId) || STICKER_STYLES[0];
    const systemPrompt = this.getSystemPrompt();

    if (!apiKey) {
      return `Character based on photo in ${styleObj.name} style with consistent hair, facial structure, skin tone, and signature attire.`;
    }

    try {
      const fileData = await storageService.getFileBase64(photoUrl);
      if (!fileData) {
        return `Character in ${styleObj.name} style.`;
      }

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: systemPrompt,
            },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `Analyze the person's face in this selfie. Extract key recognizable identity characteristics: gender presentation, approximate age, hairstyle and color, face shape, skin tone, facial hair (if any), eye shape/color, glasses or accessories, and clothing color.
Summarize this into a concise 2-sentence character design description suitable for creating consistent WhatsApp stickers in "${styleObj.name}" style (${styleObj.promptModifier}).
Emphasize preserving recognizable identity while adapting to a cute, expressive sticker character.`,
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:${fileData.mimeType};base64,${fileData.base64}`,
                  },
                },
              ],
            },
          ],
          max_tokens: 250,
        }),
      });

      const data: any = await response.json();
      const content = data.choices?.[0]?.message?.content;
      return content?.trim() || `Character in ${styleObj.name} style based on photo features.`;
    } catch (e) {
      console.warn('OpenAI face analysis fallback:', e);
      return `Character in ${styleObj.name} style based on photo features.`;
    }
  }

  /**
   * Generates a single sticker image from the person's actual reference photo
   * via the image-editing endpoint (image input + prompt), so the output stays
   * anchored to their real likeness instead of being invented from text alone.
   */
  public async generateSticker(params: GenerateStickerParams): Promise<GeneratedStickerResult> {
    const apiKey = this.getApiKey();
    const styleObj = STICKER_STYLES.find(s => s.id === params.styleId) || STICKER_STYLES[0];

    if (!apiKey) {
      return {
        success: false,
        error: 'OpenAI API key is not configured.',
      };
    }

    try {
      const fileData = await storageService.getFileBase64(params.photoUrl);
      if (!fileData) {
        return {
          success: false,
          error: 'Reference selfie could not be loaded',
        };
      }

      const prompt = `Turn the person in this reference photo into a WhatsApp messaging sticker. Preserve their recognizable facial identity, gender, hairstyle, skin tone, and any accessories from the photo — do not invent a different person.
Character context: ${params.canonicalCharacterPrompt || ''}.
Art style: ${styleObj.promptModifier}.
Expression and pose: ${params.expressionPrompt} (${params.expressionName}).
Sticker specifications: pure solid white background with clean thick white die-cut sticker outline contour, isolated subject centered, waist-up composition, bold readable shapes, vibrant colors, expressive facial emotion, zero background scenery, no watermarks, no unwanted text, high quality vector sticker.`;

      const imageBuffer = Buffer.from(fileData.base64, 'base64');
      const form = new FormData();
      form.append('model', 'gpt-image-2');
      form.append('image', new Blob([imageBuffer], { type: fileData.mimeType }), 'reference.png');
      form.append('prompt', prompt);
      form.append('n', '1');
      form.append('size', '1024x1024');

      const response = await fetch('https://api.openai.com/v1/images/edits', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: form,
      });

      const data: any = await response.json();

      if (!response.ok || !data.data || !data.data[0]) {
        const errorMsg = data.error?.message || 'OpenAI image edit generation failed';
        console.warn('OpenAI image edit error:', errorMsg);
        return {
          success: false,
          error: errorMsg,
        };
      }

      const b64 = data.data[0].b64_json;
      const imageUrl = data.data[0].url;

      if (b64) {
        return {
          rawBase64: `data:image/png;base64,${b64}`,
          success: true,
        };
      } else if (imageUrl) {
        // Fallback: download from URL and convert to base64
        const imgRes = await fetch(imageUrl);
        if (imgRes.ok) {
          const arrayBuffer = await imgRes.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const mimeType = imgRes.headers.get('content-type') || 'image/png';
          return {
            rawBase64: `data:${mimeType};base64,${buffer.toString('base64')}`,
            success: true,
          };
        } else {
          return {
            success: false,
            error: `Failed to download image from generated URL. Status: ${imgRes.status}`,
          };
        }
      }

      return {
        success: false,
        error: 'No image data or URL returned from OpenAI',
      };
    } catch (err: any) {
      console.error('OpenAI generation exception:', err?.message || err);
      return {
        success: false,
        error: err?.message || 'OpenAI generation error',
      };
    }
  }

  /**
   * Generates a single WhatsApp sticker sheet featuring the same character repeated in many reactions.
   */
  public async generateStickerSheet(params: {
    orderId: string;
    photoUrl: string;
    styleId: StickerStyleId;
    canonicalCharacterPrompt: string;
  }): Promise<GeneratedStickerResult> {
    const apiKey = this.getApiKey();
    const styleObj = STICKER_STYLES.find(s => s.id === params.styleId) || STICKER_STYLES[0];

    if (!apiKey) {
      return {
        success: false,
        error: 'OpenAI API key is not configured.',
      };
    }

    try {
      const prompt = `Turn this portrait photo into a clean horizontal WhatsApp sticker sheet featuring the SAME person in many soft, expressive, funny, and relatable emotions.

Preserve the exact recognizable facial identity of the person.

Keep:
* the same facial identity: ${params.canonicalCharacterPrompt}
* same face proportions
* same glasses
* same beard style
* same hairstyle/headwear
* same skin tone
* same recognizable facial characteristics

Style:
minimal cute sticker style, ${styleObj.promptModifier}, semi-realistic illustration, clean modern digital art, emotionally expressive but visually soft and friendly, high-quality WhatsApp sticker aesthetic.

Create approximately 24–30 different expressive reactions arranged in a clean, organized grid.

Expressions can include:
* anger
* sadness
* surprise
* confusion
* suspicion
* sarcasm
* boredom
* laughter
* awkward smile
* sleepy
* deep thinking
* stress
* anxiety
* victory
* disbelief
* emotional damage
* "bro seriously?" reaction
* shy embarrassment
* smug confidence
* existential crisis
* innocent shrug
* side-eye judgment
* overwhelmed
* fake confidence
* excitement
* anticipation
* panic
* relief
* wholesome happiness

Use expressive eyebrows, eyes, mouth, hands and subtle body gestures where appropriate.

Add subtle sticker effects such as:
* sweat drops
* sparkles
* blush marks
* small reaction lines
* soft glow
* tiny emotional symbols

Do NOT add written words.
Do NOT add captions.
Do NOT add speech bubbles.
Do NOT add logos.
Do NOT add watermarks.
Do NOT add random letters, numbers, typography, fake text, signatures, labels, or UI elements.

The final image must contain ONLY the illustrated person and subtle visual emotion effects.

Composition:
* wide horizontal sticker sheet
* approximately 24–30 individual reactions
* clean organized grid
* balanced spacing
* each reaction clearly separated
* consistent character design across every sticker
* white or very light neutral background
* white sticker-like outline around each character
* soft shadows
* crisp clean edges
* optimized for mobile viewing

The person must remain visually consistent across every reaction.

The result should look like a professionally designed WhatsApp reaction sticker pack, not a collection of unrelated AI-generated portraits.

ABSOLUTELY NO TEXT OR TYPOGRAPHY OF ANY KIND.
Do not generate letters, words, numbers, captions, speech bubbles, signs, labels, logos, watermarks, signatures, or pseudo-text.
The image must contain zero readable or unreadable writing.`;

      const response = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-image-2',
          prompt,
          n: 1,
          size: '1792x1024',
        }),
      });

      const data: any = await response.json();

      if (!response.ok || !data.data || !data.data[0]) {
        const errorMsg = data.error?.message || 'OpenAI DALL-E 3 sticker sheet generation failed';
        console.warn('OpenAI DALL-E 3 error:', errorMsg);
        return {
          success: false,
          error: errorMsg,
        };
      }

      const b64 = data.data[0].b64_json;
      const imageUrl = data.data[0].url;

      if (b64) {
        return {
          rawBase64: `data:image/png;base64,${b64}`,
          success: true,
        };
      } else if (imageUrl) {
        // Fallback: download from URL and convert to base64
        const imgRes = await fetch(imageUrl);
        if (imgRes.ok) {
          const arrayBuffer = await imgRes.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const mimeType = imgRes.headers.get('content-type') || 'image/png';
          return {
            rawBase64: `data:${mimeType};base64,${buffer.toString('base64')}`,
            success: true,
          };
        } else {
          return {
            success: false,
            error: `Failed to download image sheet from generated URL. Status: ${imgRes.status}`,
          };
        }
      }

      return {
        success: false,
        error: 'No image data or URL returned from OpenAI',
      };
    } catch (err: any) {
      console.error('OpenAI sticker sheet generation exception:', err?.message || err);
      return {
        success: false,
        error: err?.message || 'OpenAI sticker sheet generation error',
      };
    }
  }

  /**
   * Evaluates if the generated sticker sheet contains unwanted text using gpt-4o-mini
   */
  public async checkImageForText(base64Image: string): Promise<boolean> {
    const apiKey = this.getApiKey();
    if (!apiKey) return false;

    try {
      const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, '');
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are an AI assistant that checks images for the presence of generated text, letters, captions, speech bubbles, labels, signatures, or pseudo-text.',
            },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Does this image contain any visible text, letters, words, labels, captions, speech bubbles, signatures, or gibberish writing? Answer with a JSON object containing: {"hasText": true/false}. Return ONLY this JSON.',
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:image/png;base64,${cleanBase64}`,
                  },
                },
              ],
            },
          ],
          response_format: { type: 'json_object' },
          max_tokens: 50,
          temperature: 0.1,
        }),
      });

      if (!response.ok) return false;
      const data: any = await response.json();
      const content = data.choices?.[0]?.message?.content?.trim();
      if (content) {
        const parsed = JSON.parse(content);
        return !!parsed.hasText;
      }
    } catch (e) {
      console.warn('Failed to check image for text:', e);
    }
    return false;
  }
}

export const openAIService = new OpenAIService();

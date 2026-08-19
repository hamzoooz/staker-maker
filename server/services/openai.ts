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
   * Analyzes selfie face features with GPT-4o vision
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
   * Generates a single sticker image with DALL-E 3 or fallback
   */
  public async generateSticker(params: GenerateStickerParams): Promise<GeneratedStickerResult> {
    const apiKey = this.getApiKey();
    const styleObj = STICKER_STYLES.find(s => s.id === params.styleId) || STICKER_STYLES[0];
    const systemPrompt = this.getSystemPrompt();

    if (!apiKey) {
      console.log(`[OpenAI Mock/Canvas] Generating vector sticker for ${params.expressionName}`);
      return { success: true };
    }

    try {
      const prompt = `A clean WhatsApp messaging sticker of a character: ${params.canonicalCharacterPrompt || 'friendly expressive person'}.
Art style: ${styleObj.promptModifier}.
Expression: ${params.expressionPrompt} (${params.expressionName}).
Sticker specifications: pure white background with clean white die-cut sticker outline contour, isolated subject, waist-up composition, bold readable shapes, vibrant colors, expressive facial emotion, zero background clutter.`;

      const response = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'dall-e-3',
          prompt,
          n: 1,
          size: '1024x1024',
          response_format: 'b64_json',
        }),
      });

      const data: any = await response.json();

      if (!response.ok || !data.data || !data.data[0]) {
        console.warn('DALL-E 3 generation note:', data.error?.message || 'Fallback to canvas');
        return { success: true };
      }

      const b64 = data.data[0].b64_json;
      if (b64) {
        return {
          rawBase64: `data:image/png;base64,${b64}`,
          success: true,
        };
      }

      return { success: true };
    } catch (err: any) {
      console.error('OpenAI generation error:', err?.message || err);
      return { success: true }; // fallback to vector processor
    }
  }
}

export const openAIService = new OpenAIService();

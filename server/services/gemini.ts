import fs from 'fs';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
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

class GeminiService {
  private systemPromptCache: string | null = null;
  private lastPromptRead: number = 0;

  /**
   * Dynamically loads the system prompt from system-promper.md
   */
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
    return settings.geminiApiKey || process.env.GEMINI_API_KEY || '';
  }

  private getClient(): GoogleGenAI | null {
    const apiKey = this.getApiKey();
    if (!apiKey) return null;

    try {
      return new GoogleGenAI({
        apiKey,
      });
    } catch (e) {
      console.error('Failed to initialize GoogleGenAI client:', e);
      return null;
    }
  }

  /**
   * Generates a canonical sticker character description and identity anchor
   * based on the customer's uploaded selfie, strictly guided by system-promper.md.
   */
  public async analyzeFaceAndCreateAnchor(
    photoUrl: string,
    styleId: StickerStyleId
  ): Promise<string> {
    const ai = this.getClient();
    const styleObj = STICKER_STYLES.find(s => s.id === styleId) || STICKER_STYLES[0];
    const systemPrompt = this.getSystemPrompt();

    if (!ai) {
      return `Character based on photo in ${styleObj.name} style with consistent hair, facial structure, skin tone, and signature attire.`;
    }

    try {
      const fileData = await storageService.getFileBase64(photoUrl);
      if (!fileData) {
        return `Character in ${styleObj.name} style.`;
      }

      const visionModels = ['gemini-2.5-flash', 'gemini-1.5-flash'];
      for (const model of visionModels) {
        try {
          const response = await ai.models.generateContent({
            model,
            contents: {
              parts: [
                {
                  inlineData: {
                    mimeType: fileData.mimeType,
                    data: fileData.base64,
                  },
                },
                {
                  text: `[SYSTEM PROMPT RULES]\n${systemPrompt}\n\n[TASK]\nAnalyze the person's face in this selfie. Extract key recognizable identity characteristics: gender presentation, approximate age, hairstyle and color, face shape, skin tone, facial hair (if any), eye shape/color, glasses or accessories, and clothing color.
Summarize this into a concise 2-sentence character design description suitable for creating consistent WhatsApp stickers in "${styleObj.name}" style (${styleObj.promptModifier}).
Emphasize preserving recognizable identity while adapting to a cute, expressive sticker character.`,
                },
              ],
            },
          });

          if (response.text?.trim()) {
            return response.text.trim();
          }
        } catch (mErr) {
          console.warn(`Vision model ${model} attempt note:`, mErr);
        }
      }

      return `Character in ${styleObj.name} style based on photo features.`;
    } catch (e) {
      console.warn('Face analysis fallback:', e);
      return `Character in ${styleObj.name} style based on photo features.`;
    }
  }

  /**
   * Generates a single sticker image with Google Imagen 3
   */
  public async generateSticker(params: GenerateStickerParams): Promise<GeneratedStickerResult> {
    const ai = this.getClient();
    const styleObj = STICKER_STYLES.find(s => s.id === params.styleId) || STICKER_STYLES[0];

    if (!ai) {
      return {
        success: false,
        error: 'Gemini API key is not configured.',
      };
    }

    try {
      const stickerPrompt = `A high quality WhatsApp messaging sticker illustration of this character: ${params.canonicalCharacterPrompt || 'expressive person'}.
Art style: ${styleObj.promptModifier}.
Expression and pose: ${params.expressionPrompt} (${params.expressionName}).
Sticker specifications: pure white background with clean white die-cut sticker outline contour, isolated subject, waist-up composition, bold readable shapes, vibrant colors, expressive facial emotion, zero background clutter, family-friendly WhatsApp sticker asset.`;

      const imagenModels = ['imagen-3.0-generate-002', 'imagen-3.0-fast-generate-001'];
      for (const model of imagenModels) {
        try {
          const response = await ai.models.generateImages({
            model,
            prompt: stickerPrompt,
            config: {
              numberOfImages: 1,
              aspectRatio: '1:1',
              outputMimeType: 'image/png',
            },
          });

          const imageBytes = response.generatedImages?.[0]?.image?.imageBytes;
          if (imageBytes) {
            return {
              rawBase64: `data:image/png;base64,${imageBytes}`,
              success: true,
            };
          }
        } catch (imgErr: any) {
          console.warn(`Gemini image generation model ${model} error:`, imgErr?.message || imgErr);
        }
      }

      return {
        success: false,
        error: 'Gemini Imagen returned no image bytes.',
      };
    } catch (error: any) {
      console.error(`Gemini generation error for ${params.expressionId}:`, error?.message || error);
      return {
        success: false,
        error: error?.message || 'Gemini image generation failed',
      };
    }
  }
}

export const geminiService = new GeminiService();

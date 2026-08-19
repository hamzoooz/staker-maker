import fs from 'fs';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import { STICKER_STYLES } from '../../src/data/constants.js';
import { ExpressionId, StickerStyleId } from '../../src/types/index.js';
import { storageService } from './storage.js';

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
    // Cache for 10 seconds to allow live editing
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

  private getClient(): GoogleGenAI | null {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return null;

    return new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'stickerai-build',
        },
      },
    });
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

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
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

      return response.text?.trim() || `Character in ${styleObj.name} style.`;
    } catch (e) {
      console.warn('Face analysis fallback:', e);
      return `Character in ${styleObj.name} style based on photo features.`;
    }
  }

  /**
   * Generates a single sticker image with the selected style and expression
   * adhering strictly to system-promper.md rules.
   */
  public async generateSticker(params: GenerateStickerParams): Promise<GeneratedStickerResult> {
    const ai = this.getClient();
    const styleObj = STICKER_STYLES.find(s => s.id === params.styleId) || STICKER_STYLES[0];
    const systemPrompt = this.getSystemPrompt();

    // If no API key configured, return success so imageProcessor renders vector/canvas artwork
    if (!ai) {
      console.log(`[Gemini Mock/Canvas] Generating sticker for ${params.expressionName}`);
      return {
        success: true,
      };
    }

    try {
      const fileData = await storageService.getFileBase64(params.photoUrl);
      if (!fileData) {
        throw new Error('Reference selfie could not be loaded');
      }

      const stickerPrompt = `[SYSTEM INSTRUCTIONS]\n${systemPrompt}\n\n[GENERATION REQUEST]\nCreate a single WhatsApp messaging sticker based on the person in the reference selfie photo.
Preserve recognizable facial identity, key appearance, hair style, skin tone, and accessories.
Transform the person into a clean, highly expressive sticker character in this art style: ${styleObj.promptModifier}.
Expression and Action: ${params.expressionPrompt} (${params.expressionName}).
Character Identity Context: ${params.canonicalCharacterPrompt || ''}.
Sticker Requirements:
- Pure white or transparent isolated plain background with no background scenery or complex clutter.
- Bold readable shapes, polished digital illustration, punchy emotion, crisp silhouette with a clean white die-cut sticker outline contour.
- Centered waist-up or head-and-shoulders composition.
- Wholesome, friendly, suitable for WhatsApp family and friends messaging.`;

      // Try image generation models
      const modelCandidates = ['gemini-2.5-flash', 'gemini-3.1-flash-image', 'gemini-3.1-flash-lite-image'];

      for (const model of modelCandidates) {
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
                  text: stickerPrompt,
                },
              ],
            },
            config: {
              imageConfig: {
                aspectRatio: '1:1',
                imageSize: '512px',
              },
            } as any,
          });

          // Check for inline generated image data
          for (const candidate of response.candidates || []) {
            for (const part of candidate.content?.parts || []) {
              if (part.inlineData && part.inlineData.data) {
                const rawBase64 = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
                return {
                  rawBase64,
                  success: true,
                };
              }
            }
          }
        } catch (modelErr: any) {
          console.warn(`Model ${model} attempt note:`, modelErr?.message || modelErr);
          // continue to next model candidate
        }
      }

      // If no image was returned by Gemini vision (e.g. text model only), imageProcessor handles vector/canvas rendering
      return {
        success: true,
      };
    } catch (error: any) {
      console.error(`Gemini generation error for ${params.expressionId}:`, error?.message || error);
      return {
        success: false,
        error: error?.message || 'AI Generation failed',
      };
    }
  }
}

export const geminiService = new GeminiService();

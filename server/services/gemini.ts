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
  private getClient(): GoogleGenAI | null {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return null;

    return new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }

  /**
   * Generates a canonical sticker character description and identity anchor
   * based on the customer's uploaded selfie.
   */
  public async analyzeFaceAndCreateAnchor(
    photoUrl: string,
    styleId: StickerStyleId
  ): Promise<string> {
    const ai = this.getClient();
    const styleObj = STICKER_STYLES.find(s => s.id === styleId) || STICKER_STYLES[0];

    if (!ai) {
      return `Character based on photo in ${styleObj.name} style with consistent hair, facial structure, skin tone, and signature attire.`;
    }

    try {
      const fileData = await storageService.getFileBase64(photoUrl);
      if (!fileData) {
        return `Character in ${styleObj.name} style.`;
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3.7-flash',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: fileData.mimeType,
                data: fileData.base64,
              },
            },
            {
              text: `Analyze the person's face in this selfie. Extract key recognizable identity characteristics: gender presentation, approximate age, hairstyle and color, face shape, skin tone, facial hair (if any), eye shape/color, glasses or accessories, and clothing color.
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
   * Generates a single sticker image with the selected style and expression.
   */
  public async generateSticker(params: GenerateStickerParams): Promise<GeneratedStickerResult> {
    const ai = this.getClient();
    const styleObj = STICKER_STYLES.find(s => s.id === params.styleId) || STICKER_STYLES[0];

    // If no API key configured, use test generator
    if (!ai) {
      console.log(`[Gemini Mock] Generating mock sticker for ${params.expressionName}`);
      return {
        success: true,
        // Will be converted to vector sticker by imageProcessor
      };
    }

    try {
      const fileData = await storageService.getFileBase64(params.photoUrl);
      if (!fileData) {
        throw new Error('Reference selfie could not be loaded');
      }

      const stickerPrompt = `Create a single WhatsApp messaging sticker based on the person in the reference selfie photo.
Preserve recognizable facial identity, key appearance, hair style, skin tone, and accessories.
Transform the person into a clean, highly expressive sticker character in this art style: ${styleObj.promptModifier}.
Expression and Action: ${params.expressionPrompt}.
Character Context: ${params.canonicalCharacterPrompt || ''}.
Sticker Requirements:
- Pure white or transparent isolated plain background with no background scenery or complex clutter.
- Bold readable shapes, polished digital illustration, punchy emotion, crisp silhouette with a clean white die-cut sticker outline contour.
- Centered waist-up or head-and-shoulders composition.
- Wholesome, friendly, suitable for WhatsApp family and friends messaging.`;

      // Use gemini-3.1-flash-image for fast, high-quality image generation
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-image',
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
        },
      });

      // Extract image from response candidates
      const candidates = response.candidates;
      if (candidates && candidates.length > 0) {
        for (const part of candidates[0].content?.parts || []) {
          if (part.inlineData && part.inlineData.data) {
            const rawBase64 = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
            return {
              rawBase64,
              success: true,
            };
          }
        }
      }

      // If text response returned instead of image, try flash-lite-image
      console.warn('No inline image in primary model response, trying flash-lite-image fallback...');
      const fallbackResponse = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite-image',
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
      });

      for (const part of fallbackResponse.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData && part.inlineData.data) {
          const rawBase64 = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
          return {
            rawBase64,
            success: true,
          };
        }
      }

      return {
        success: true, // Will fall back to vector character in image processor
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

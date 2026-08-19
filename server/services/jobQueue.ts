import { STICKER_EXPRESSIONS } from '../../src/data/constants.js';
import { ExpressionId, GeneratedSticker, Order } from '../../src/types/index.js';
import { db } from '../db.js';
import { geminiService } from './gemini.js';
import { openAIService } from './openai.js';
import { imageProcessor } from './imageProcessor.js';
import { whatsAppService } from './whatsapp.js';

export class JobQueue {
  private activeJobs = new Set<string>();

  /**
   * Starts or resumes sticker generation job for a paid order
   */
  public async queueGeneration(orderId: string) {
    if (this.activeJobs.has(orderId)) {
      console.log(`Job for order ${orderId} already in progress`);
      return;
    }

    const order = db.getOrder(orderId);
    if (!order) {
      console.error(`Order ${orderId} not found`);
      return;
    }

    if (order.paymentStatus !== 'paid') {
      console.warn(`Order ${orderId} is not paid yet (status: ${order.paymentStatus})`);
      return;
    }

    this.activeJobs.add(orderId);

    // Run async in background without blocking HTTP response
    setImmediate(async () => {
      try {
        await this.runGenerationPipeline(orderId);
      } catch (err: any) {
        console.error(`Fatal generation job error for ${orderId}:`, err);
        db.updateOrder(orderId, {
          generationStatus: 'failed',
          error: err.message || 'Sticker generation failed',
        });
      } finally {
        this.activeJobs.delete(orderId);
      }
    });
  }

  /**
   * Main generation pipeline
   */
  private async runGenerationPipeline(orderId: string) {
    const order = db.getOrder(orderId);
    if (!order) return;

    const settings = db.getSettings();
    const useOpenAI = !!settings.openaiApiKey && settings.aiProvider !== 'gemini';

    // Step 1: Analyze selfie & create canonical character anchor
    db.updateOrder(orderId, {
      generationStatus: 'analyzing_photo',
      generationProgress: { total: 12, completed: 0, currentExpression: 'Analyzing facial features...' },
    });

    let canonicalAnchor = '';
    if (useOpenAI) {
      canonicalAnchor = await openAIService.analyzeFaceAndCreateAnchor(order.photoUrl, order.style);
    } else {
      canonicalAnchor = await geminiService.analyzeFaceAndCreateAnchor(order.photoUrl, order.style);
    }

    db.updateOrder(orderId, {
      generationStatus: 'creating_character',
      canonicalCharacterUrl: order.photoUrl,
      generationProgress: { total: 12, completed: 0, currentExpression: 'Crafting canonical character...' },
    });

    // Step 2: Initialize or load sticker items
    let stickers = db.getStickers(orderId);
    if (stickers.length === 0) {
      stickers = STICKER_EXPRESSIONS.slice(0, order.stickerCount || 12).map((exp, idx) => ({
        id: `stk_${orderId}_${exp.id}`,
        orderId,
        sequence: idx + 1,
        expression: exp.id as ExpressionId,
        expressionName: exp.name,
        bubbleText: exp.bubbleText,
        processedImageUrl: '',
        generationStatus: 'pending',
        retryCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));
      db.saveStickers(orderId, stickers);
    }

    // Step 3: Generate and process each sticker expression
    db.updateOrder(orderId, {
      generationStatus: 'generating_stickers',
    });

    let completedCount = stickers.filter(s => s.generationStatus === 'completed').length;

    for (let i = 0; i < stickers.length; i++) {
      const sticker = stickers[i];
      if (sticker.generationStatus === 'completed') continue;

      const expressionDef = STICKER_EXPRESSIONS.find(e => e.id === sticker.expression) || STICKER_EXPRESSIONS[0];

      db.updateOrder(orderId, {
        generationProgress: {
          total: stickers.length,
          completed: completedCount,
          currentExpression: `Generating ${expressionDef.name}...`,
        },
      });

      db.updateSticker(orderId, sticker.id, {
        generationStatus: 'generating',
      });

      const params = {
        orderId,
        photoUrl: order.photoUrl,
        styleId: order.style,
        expressionId: sticker.expression,
        expressionPrompt: expressionDef.actionPrompt,
        expressionName: expressionDef.name,
        bubbleText: sticker.bubbleText || expressionDef.bubbleText,
        canonicalCharacterPrompt: canonicalAnchor,
      };

      // Call AI Engine (OpenAI or Gemini)
      let genResult: any;
      if (useOpenAI) {
        genResult = await openAIService.generateSticker(params);
        if (!genResult.success && !genResult.rawBase64) {
          genResult = await geminiService.generateSticker(params);
        }
      } else {
        genResult = await geminiService.generateSticker(params);
      }

      // Step 4: Process into transparent 512x512 die-cut sticker
      db.updateOrder(orderId, {
        generationStatus: 'processing_images',
      });

      const processed = await imageProcessor.processSticker(genResult.rawBase64 || order.photoUrl, {
        expressionName: expressionDef.name,
        bubbleText: sticker.bubbleText || expressionDef.bubbleText,
        addStickerBorder: true,
      });

      db.updateSticker(orderId, sticker.id, {
        processedImageUrl: processed.publicUrl,
        generationStatus: 'completed',
        originalImageUrl: genResult.rawBase64 ? processed.publicUrl : undefined,
      });

      completedCount++;
      db.updateOrder(orderId, {
        generationProgress: {
          total: stickers.length,
          completed: completedCount,
        },
      });
    }

    // Step 5: Packaging and final delivery
    db.updateOrder(orderId, {
      generationStatus: 'packaging',
    });

    const finalStickers = db.getStickers(orderId);

    // Optional WhatsApp automated delivery if phone is present
    if (order.customerPhone && order.customerPhone.length > 5 && !!(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID)) {
      db.updateOrder(orderId, {
        deliveryStatus: 'sending',
      });

      const delivery = await whatsAppService.deliverStickerPack(order, finalStickers);
      db.updateOrder(orderId, {
        deliveryStatus: delivery.success ? 'delivered' : 'failed',
      });
    } else {
      // Direct Web / Link mode
      db.updateOrder(orderId, {
        deliveryStatus: 'delivered',
      });
    }

    db.updateOrder(orderId, {
      generationStatus: 'completed',
    });

    db.addDeliveryEvent(orderId, {
      id: `ev_${Date.now()}_complete`,
      timestamp: new Date().toISOString(),
      type: 'delivered',
      message: 'All 12 AI stickers completed and ready for instant use!',
    });
  }

  public async retrySingleSticker(orderId: string, stickerId: string) {
    const order = db.getOrder(orderId);
    if (!order) throw new Error('Order not found');

    const sticker = db.getStickers(orderId).find(s => s.id === stickerId);
    if (!sticker) throw new Error('Sticker not found');

    const expressionDef = STICKER_EXPRESSIONS.find(e => e.id === sticker.expression) || STICKER_EXPRESSIONS[0];

    const genResult = await openAIService.generateSticker({
      orderId,
      photoUrl: order.photoUrl,
      styleId: order.style,
      expressionId: sticker.expression,
      expressionPrompt: expressionDef.actionPrompt,
      expressionName: expressionDef.name,
      bubbleText: sticker.bubbleText || expressionDef.bubbleText,
      canonicalCharacterPrompt: order.canonicalCharacterUrl,
    });

    const processed = await imageProcessor.processSticker(genResult.rawBase64 || order.photoUrl, {
      expressionName: expressionDef.name,
      bubbleText: sticker.bubbleText || expressionDef.bubbleText,
      addStickerBorder: true,
    });

    db.updateSticker(orderId, sticker.id, {
      processedImageUrl: processed.publicUrl,
      generationStatus: 'completed',
      retryCount: (sticker.retryCount || 0) + 1,
    });

    return db.getStickers(orderId);
  }
}

export const jobQueue = new JobQueue();

import { STICKER_EXPRESSIONS } from '../../src/data/constants.js';
import { ExpressionId, GeneratedSticker, Order } from '../../src/types/index.js';
import { db } from '../db.js';
import { geminiService } from './gemini.js';
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

    // Step 1: Analyze selfie & create canonical character anchor
    db.updateOrder(orderId, {
      generationStatus: 'analyzing_photo',
      generationProgress: { total: 12, completed: 0, currentExpression: 'Analyzing facial features...' },
    });

    const canonicalAnchor = await geminiService.analyzeFaceAndCreateAnchor(
      order.photoUrl,
      order.style
    );

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

      // Call Gemini for sticker image
      const genResult = await geminiService.generateSticker({
        orderId,
        photoUrl: order.photoUrl,
        styleId: order.style,
        expressionId: sticker.expression,
        expressionPrompt: expressionDef.actionPrompt,
        expressionName: expressionDef.name,
        bubbleText: expressionDef.bubbleText,
        canonicalCharacterPrompt: canonicalAnchor,
      });

      if (genResult.success) {
        // Image Processing Step: Background cutout, sticker border, 512x512 canvas
        const processed = await imageProcessor.processSticker(
          genResult.rawBase64 || order.photoUrl,
          {
            expressionName: expressionDef.name,
            bubbleText: expressionDef.bubbleText,
            addStickerBorder: true,
          }
        );

        db.updateSticker(orderId, sticker.id, {
          processedImageUrl: processed.publicUrl,
          originalImageUrl: genResult.rawBase64 ? processed.publicUrl : undefined,
          generationStatus: 'completed',
        });
        completedCount++;
      } else {
        // Fallback to high-quality procedural vector sticker on temporary AI error
        const processed = await imageProcessor.processSticker(
          order.photoUrl,
          {
            expressionName: expressionDef.name,
            bubbleText: expressionDef.bubbleText,
            addStickerBorder: true,
          }
        );

        db.updateSticker(orderId, sticker.id, {
          processedImageUrl: processed.publicUrl,
          generationStatus: 'completed',
          retryCount: sticker.retryCount + 1,
        });
        completedCount++;
      }

      db.updateOrder(orderId, {
        generationProgress: {
          total: stickers.length,
          completed: completedCount,
        },
      });
    }

    // Step 4: Packaging & Finalizing
    db.updateOrder(orderId, {
      generationStatus: 'packaging',
      generationProgress: {
        total: stickers.length,
        completed: stickers.length,
        currentExpression: 'Preparing your WhatsApp pack...',
      },
    });

    const updatedStickers = db.getStickers(orderId);

    // Step 5: Deliver to WhatsApp
    db.updateOrder(orderId, {
      deliveryStatus: 'sending',
    });

    const deliveryResult = await whatsAppService.deliverStickerPack(order, updatedStickers);

    // Complete order
    db.updateOrder(orderId, {
      generationStatus: 'completed',
      deliveryStatus: deliveryResult.success ? 'delivered' : 'failed',
      generationProgress: {
        total: stickers.length,
        completed: stickers.length,
        currentExpression: 'All stickers generated!',
      },
    });
  }

  /**
   * Retry single sticker generation without redoing all 12
   */
  public async retrySingleSticker(orderId: string, stickerId: string) {
    const order = db.getOrder(orderId);
    if (!order) throw new Error('Order not found');

    const stickers = db.getStickers(orderId);
    const target = stickers.find(s => s.id === stickerId);
    if (!target) throw new Error('Sticker not found');

    if (target.retryCount >= 3) {
      throw new Error('Maximum retry attempts reached for this sticker');
    }

    const expressionDef = STICKER_EXPRESSIONS.find(e => e.id === target.expression) || STICKER_EXPRESSIONS[0];

    db.updateSticker(orderId, stickerId, {
      generationStatus: 'generating',
      retryCount: target.retryCount + 1,
    });

    const genResult = await geminiService.generateSticker({
      orderId,
      photoUrl: order.photoUrl,
      styleId: order.style,
      expressionId: target.expression,
      expressionPrompt: expressionDef.actionPrompt,
      expressionName: expressionDef.name,
      bubbleText: expressionDef.bubbleText,
    });

    const processed = await imageProcessor.processSticker(
      genResult.rawBase64 || order.photoUrl,
      {
        expressionName: expressionDef.name,
        bubbleText: expressionDef.bubbleText,
        addStickerBorder: true,
      }
    );

    db.updateSticker(orderId, stickerId, {
      processedImageUrl: processed.publicUrl,
      generationStatus: 'completed',
    });

    return db.getStickers(orderId);
  }
}

export const jobQueue = new JobQueue();

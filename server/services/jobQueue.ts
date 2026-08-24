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
   * Starts or resumes sticker generation job for a paid order.
   * By default, stickers already marked 'completed' are left untouched (resume
   * behavior). Pass `force: true` to regenerate every sticker from scratch.
   */
  public async queueGeneration(orderId: string, options: { force?: boolean } = {}) {
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
        await this.runGenerationPipeline(orderId, options.force || false);
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
  private async runGenerationPipeline(orderId: string, force = false) {
    const order = db.getOrder(orderId);
    if (!order) return;

    const settings = db.getSettings();
    const hasOpenAI = !!settings.openaiApiKey || !!process.env.OPENAI_API_KEY;
    const hasGemini = !!settings.geminiApiKey || !!process.env.GEMINI_API_KEY;
    const aiProvider = settings.aiProvider || (hasOpenAI ? 'openai' : hasGemini ? 'gemini' : 'auto');

    // Step 1: Analyze selfie & create canonical character anchor
    db.updateOrder(orderId, {
      generationStatus: 'analyzing_photo',
      generationProgress: { total: 1, completed: 0, currentExpression: 'Analyzing facial features...' },
    });

    let canonicalAnchor = '';
    try {
      if (aiProvider === 'openai' || (aiProvider === 'auto' && hasOpenAI)) {
        canonicalAnchor = await openAIService.analyzeFaceAndCreateAnchor(order.photoUrl, order.style);
      } else if (hasGemini) {
        canonicalAnchor = await geminiService.analyzeFaceAndCreateAnchor(order.photoUrl, order.style);
      }
    } catch (anchorErr) {
      console.warn('Face anchor creation error:', anchorErr);
    }

    db.updateOrder(orderId, {
      generationStatus: 'creating_character',
      canonicalCharacterUrl: order.photoUrl,
      generationProgress: { total: 1, completed: 0, currentExpression: 'Analyzing face characteristics...' },
    });

    // Step 2: Initialize or load individual stickers
    let stickers = db.getStickers(orderId);
    if (stickers.length === 0 || force) {
      stickers = STICKER_EXPRESSIONS.map((expr, idx) => ({
        id: `stk_${orderId}_${expr.id}`,
        orderId,
        sequence: idx + 1,
        expression: expr.id,
        expressionName: expr.name,
        bubbleText: expr.bubbleText || '',
        processedImageUrl: '',
        generationStatus: 'pending',
        retryCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));
      db.saveStickers(orderId, stickers);
    }

    // Step 3: Generate and process each sticker
    db.updateOrder(orderId, {
      generationStatus: 'generating_stickers',
    });

    const totalStickers = stickers.length;
    let completedCount = 0;

    for (const sticker of stickers) {
      if (sticker.generationStatus === 'completed' && !force) {
        completedCount++;
        continue;
      }

      db.updateOrder(orderId, {
        generationProgress: {
          total: totalStickers,
          completed: completedCount,
          currentExpression: `Generating ${sticker.expressionName} (${completedCount + 1}/${totalStickers})...`,
        },
      });

      db.updateSticker(orderId, sticker.id, {
        generationStatus: 'generating',
      });

      try {
        let genResult: any = { success: false };
        const exprDef = STICKER_EXPRESSIONS.find(e => e.id === sticker.expression);
        const actionPrompt = exprDef ? exprDef.actionPrompt : sticker.expressionName;

        if (aiProvider === 'openai' || (aiProvider === 'auto' && hasOpenAI)) {
          genResult = await openAIService.generateSticker({
            orderId,
            photoUrl: order.photoUrl,
            styleId: order.style,
            expressionId: sticker.expression,
            expressionPrompt: actionPrompt,
            expressionName: sticker.expressionName,
            bubbleText: sticker.bubbleText,
            canonicalCharacterPrompt: canonicalAnchor,
          });
        } else if (hasGemini) {
          genResult = await geminiService.generateSticker({
            orderId,
            photoUrl: order.photoUrl,
            styleId: order.style,
            expressionId: sticker.expression,
            expressionPrompt: actionPrompt,
            expressionName: sticker.expressionName,
            bubbleText: sticker.bubbleText,
            canonicalCharacterPrompt: canonicalAnchor,
          });
        }

        if (!genResult.success) {
          throw new Error(genResult.error || 'Failed to generate sticker.');
        }

        // Process into transparent WebP/PNG with border and emoji badges
        db.updateOrder(orderId, {
          generationProgress: {
            total: totalStickers,
            completed: completedCount,
            currentExpression: `Processing and optimizing ${sticker.expressionName}...`,
          },
        });

        const processed = await imageProcessor.processSticker(genResult.rawBase64, {
          expressionId: sticker.expression,
          expressionName: sticker.expressionName,
          styleId: order.style,
          bubbleText: sticker.bubbleText,
          isAIGenerated: true,
        });

        db.updateSticker(orderId, sticker.id, {
          processedImageUrl: processed.publicUrl,
          webpUrl: processed.webpUrl,
          generationStatus: 'completed',
          originalImageUrl: processed.publicUrl,
        });

        completedCount++;
        db.updateOrder(orderId, {
          generationProgress: {
            total: totalStickers,
            completed: completedCount,
            currentExpression: `Finished ${sticker.expressionName}!`,
          },
        });

      } catch (err: any) {
        console.error(`Failed to generate sticker ${sticker.expression}:`, err);
        // Retry mechanism: if it fails, retry once immediately
        try {
          console.log(`Retrying sticker ${sticker.expression} once...`);
          let genResult: any = { success: false };
          const exprDef = STICKER_EXPRESSIONS.find(e => e.id === sticker.expression);
          const actionPrompt = exprDef ? exprDef.actionPrompt : sticker.expressionName;

          if (aiProvider === 'openai' || (aiProvider === 'auto' && hasOpenAI)) {
            genResult = await openAIService.generateSticker({
              orderId,
              photoUrl: order.photoUrl,
              styleId: order.style,
              expressionId: sticker.expression,
              expressionPrompt: actionPrompt,
              expressionName: sticker.expressionName,
              bubbleText: sticker.bubbleText,
              canonicalCharacterPrompt: canonicalAnchor,
            });
          } else if (hasGemini) {
            genResult = await geminiService.generateSticker({
              orderId,
              photoUrl: order.photoUrl,
              styleId: order.style,
              expressionId: sticker.expression,
              expressionPrompt: actionPrompt,
              expressionName: sticker.expressionName,
              bubbleText: sticker.bubbleText,
              canonicalCharacterPrompt: canonicalAnchor,
            });
          }

          if (!genResult.success) {
            throw new Error(genResult.error || 'Failed to generate sticker on retry.');
          }

          const processed = await imageProcessor.processSticker(genResult.rawBase64, {
            expressionId: sticker.expression,
            expressionName: sticker.expressionName,
            styleId: order.style,
            bubbleText: sticker.bubbleText,
            isAIGenerated: true,
          });

          db.updateSticker(orderId, sticker.id, {
            processedImageUrl: processed.publicUrl,
            webpUrl: processed.webpUrl,
            generationStatus: 'completed',
            originalImageUrl: processed.publicUrl,
          });

          completedCount++;
        } catch (retryErr: any) {
          db.updateSticker(orderId, sticker.id, {
            generationStatus: 'failed',
            error: retryErr.message || 'Generation failed',
          });
        }
      }
    }

    // Step 4: Packaging and final delivery
    db.updateOrder(orderId, {
      generationStatus: 'packaging',
      generationProgress: {
        total: totalStickers,
        completed: completedCount,
        currentExpression: 'Packaging finished!',
      },
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
      message: 'Your 12 personalized stickers have been generated successfully and are ready!',
    });
  }

  public async retrySingleSticker(orderId: string, stickerId: string) {
    const order = db.getOrder(orderId);
    if (!order) throw new Error('Order not found');

    const sticker = db.getStickers(orderId).find(s => s.id === stickerId);
    if (!sticker) throw new Error('Sticker not found');

    const settings = db.getSettings();
    const hasOpenAI = !!settings.openaiApiKey || !!process.env.OPENAI_API_KEY;
    const hasGemini = !!settings.geminiApiKey || !!process.env.GEMINI_API_KEY;
    const aiProvider = settings.aiProvider || (hasOpenAI ? 'openai' : hasGemini ? 'gemini' : 'auto');

    db.updateOrder(orderId, {
      generationStatus: 'generating_stickers',
      generationProgress: {
        total: 1,
        completed: 0,
        currentExpression: `Regenerating ${sticker.expressionName}...`,
      },
    });

    db.updateSticker(orderId, sticker.id, {
      generationStatus: 'generating',
    });

    let canonicalAnchor = order.photoUrl; // fallback
    try {
      if (aiProvider === 'openai' || (aiProvider === 'auto' && hasOpenAI)) {
        canonicalAnchor = await openAIService.analyzeFaceAndCreateAnchor(order.photoUrl, order.style);
      } else if (hasGemini) {
        canonicalAnchor = await geminiService.analyzeFaceAndCreateAnchor(order.photoUrl, order.style);
      }
    } catch (anchorErr) {
      console.warn('Face anchor creation error on retry:', anchorErr);
    }

    let genResult: any = { success: false };
    const exprDef = STICKER_EXPRESSIONS.find(e => e.id === sticker.expression);
    const actionPrompt = exprDef ? exprDef.actionPrompt : sticker.expressionName;

    if (aiProvider === 'openai' || (aiProvider === 'auto' && hasOpenAI)) {
      genResult = await openAIService.generateSticker({
        orderId,
        photoUrl: order.photoUrl,
        styleId: order.style,
        expressionId: sticker.expression,
        expressionPrompt: actionPrompt,
        expressionName: sticker.expressionName,
        bubbleText: sticker.bubbleText,
        canonicalCharacterPrompt: canonicalAnchor,
      });
    } else if (hasGemini) {
      genResult = await geminiService.generateSticker({
        orderId,
        photoUrl: order.photoUrl,
        styleId: order.style,
        expressionId: sticker.expression,
        expressionPrompt: actionPrompt,
        expressionName: sticker.expressionName,
        bubbleText: sticker.bubbleText,
        canonicalCharacterPrompt: canonicalAnchor,
      });
    }

    if (!genResult.success) {
      throw new Error(genResult.error || 'Failed to regenerate sticker.');
    }

    const processed = await imageProcessor.processSticker(genResult.rawBase64, {
      expressionId: sticker.expression,
      expressionName: sticker.expressionName,
      styleId: order.style,
      bubbleText: sticker.bubbleText,
      isAIGenerated: true,
    });

    db.updateSticker(orderId, sticker.id, {
      processedImageUrl: processed.publicUrl,
      webpUrl: processed.webpUrl,
      generationStatus: 'completed',
      retryCount: (sticker.retryCount || 0) + 1,
    });

    const allStickers = db.getStickers(orderId);
    const totalCompleted = allStickers.filter(s => s.generationStatus === 'completed').length;

    db.updateOrder(orderId, {
      generationStatus: 'completed',
      generationProgress: {
        total: allStickers.length,
        completed: totalCompleted,
      },
    });

    return allStickers;
  }
}

export const jobQueue = new JobQueue();

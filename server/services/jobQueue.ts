import { STICKER_EXPRESSIONS } from '../../src/data/constants.js';
import { ExpressionId, GeneratedSticker, Order } from '../../src/types/index.js';
import { db } from '../db.js';
import { geminiService } from './gemini.js';
import { openAIService } from './openai.js';
import { imageProcessor } from './imageProcessor.js';
import { whatsAppService } from './whatsapp.js';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/** Extracts a suggested wait time from a "please try again in Ns" style rate-limit message. */
function parseRetryAfterSeconds(message: string, fallbackSeconds = 15): number {
  const match = message.match(/try again in\s+([\d.]+)s/i);
  if (match) {
    const seconds = Math.ceil(parseFloat(match[1]));
    return Math.min(Math.max(seconds, 1), 60) + 1; // small buffer, capped for sanity
  }
  return fallbackSeconds;
}

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

    const generateOnce = async (sticker: GeneratedSticker, actionPrompt: string) => {
      if (aiProvider === 'openai' || (aiProvider === 'auto' && hasOpenAI)) {
        return openAIService.generateSticker({
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
        return geminiService.generateSticker({
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
      return { success: false, error: 'No AI provider configured.' } as any;
    };

    const processOneSticker = async (sticker: GeneratedSticker) => {
      if (sticker.generationStatus === 'completed' && !force) {
        completedCount++;
        return;
      }

      db.updateSticker(orderId, sticker.id, {
        generationStatus: 'generating',
      });
      db.updateOrder(orderId, {
        generationProgress: {
          total: totalStickers,
          completed: completedCount,
          currentExpression: `Generating ${sticker.expressionName} (${completedCount + 1}/${totalStickers})...`,
        },
      });

      const exprDef = STICKER_EXPRESSIONS.find(e => e.id === sticker.expression);
      const actionPrompt = exprDef ? exprDef.actionPrompt : sticker.expressionName;

      // The image-generation API enforces a hard per-minute rate limit
      // (observed: 5 requests/min for gpt-image-2), so a rate-limited attempt
      // isn't a real failure — wait out the limit and retry rather than
      // giving up. Non-rate-limit errors still only get one quick retry.
      const MAX_ATTEMPTS = 4;
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        try {
          const genResult: any = await generateOnce(sticker, actionPrompt);
          if (!genResult.success) {
            throw new Error(genResult.error || 'Failed to generate sticker.');
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
          db.updateOrder(orderId, {
            generationProgress: {
              total: totalStickers,
              completed: completedCount,
              currentExpression: `Finished ${sticker.expressionName}!`,
            },
          });
          return;
        } catch (err: any) {
          const message: string = err.message || 'Generation failed';
          console.error(`Failed to generate sticker ${sticker.expression} (attempt ${attempt + 1}):`, message);

          const isRateLimit = /rate limit/i.test(message);
          const isLastAttempt = attempt === MAX_ATTEMPTS - 1 || (!isRateLimit && attempt === 1);

          if (isLastAttempt) {
            db.updateSticker(orderId, sticker.id, {
              generationStatus: 'failed',
              error: message,
            });
            return;
          }

          if (isRateLimit) {
            const waitSeconds = parseRetryAfterSeconds(message);
            db.updateOrder(orderId, {
              generationProgress: {
                total: totalStickers,
                completed: completedCount,
                currentExpression: `Rate limited — retrying ${sticker.expressionName} in ${waitSeconds}s...`,
              },
            });
            await sleep(waitSeconds * 1000);
          }
        }
      }
    };

    // Sequential, not parallel: the AI provider enforces a low per-minute
    // rate limit on image generation, so concurrent requests just burn
    // through that budget faster and cause more rate-limit failures.
    for (const sticker of stickers) {
      await processOneSticker(sticker);
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
    const anySucceeded = finalStickers.some(s => s.generationStatus === 'completed');

    if (!anySucceeded) {
      // Every sticker failed — don't lie and say the order is "completed" and
      // "delivered" when there's nothing to deliver. Surface it as a real failure.
      db.updateOrder(orderId, {
        generationStatus: 'failed',
        deliveryStatus: 'failed',
        error: finalStickers[0]?.error || 'All stickers failed to generate.',
      });
      db.addDeliveryEvent(orderId, {
        id: `ev_${Date.now()}_allfailed`,
        timestamp: new Date().toISOString(),
        type: 'failed',
        message: 'Sticker generation failed for this order. Please retry.',
      });
      return;
    }

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

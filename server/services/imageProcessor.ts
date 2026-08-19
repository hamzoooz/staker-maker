import { createCanvas, loadImage } from 'canvas';
import { storageService } from './storage.js';

export interface ProcessedStickerResult {
  publicUrl: string;
  width: number;
  height: number;
}

export class ImageProcessor {
  /**
   * Processes a raw generated image into a WhatsApp sticker:
   * - 512x512 square canvas
   * - White sticker die-cut border & subtle soft sticker drop-shadow
   * - Transparent background (PNG format)
   * - Optional expressive speech bubble or emoji accent
   */
  public async processSticker(
    rawBase64OrUrl: string, 
    options: {
      expressionName?: string;
      bubbleText?: string;
      addStickerBorder?: boolean;
      styleId?: string;
    } = {}
  ): Promise<ProcessedStickerResult> {
    const { addStickerBorder = true, bubbleText } = options;
    const canvasSize = 512;
    const canvas = createCanvas(canvasSize, canvasSize);
    const ctx = canvas.getContext('2d');

    // Clean transparent background
    ctx.clearRect(0, 0, canvasSize, canvasSize);

    try {
      let imageSource = rawBase64OrUrl;
      if (!rawBase64OrUrl.startsWith('data:') && !rawBase64OrUrl.startsWith('http')) {
        const fileData = await storageService.getFileBase64(rawBase64OrUrl);
        if (fileData) {
          imageSource = `data:${fileData.mimeType};base64,${fileData.base64}`;
        }
      }

      const img = await loadImage(imageSource);

      // Fit character proportionally in the 512x512 area with margin for sticker border and bubble
      const padding = 28;
      const availableW = canvasSize - padding * 2;
      const availableH = canvasSize - padding * 2;

      let drawW = availableW;
      let drawH = availableH;
      const imgAspect = img.width / img.height;

      if (imgAspect > 1) {
        drawH = availableW / imgAspect;
      } else {
        drawW = availableH * imgAspect;
      }

      const posX = padding + (availableW - drawW) / 2;
      const posY = padding + (availableH - drawH) / 2;

      // First pass: White die-cut sticker silhouette/border effect
      if (addStickerBorder) {
        const strokeCanvas = createCanvas(canvasSize, canvasSize);
        const strokeCtx = strokeCanvas.getContext('2d');
        strokeCtx.drawImage(img, posX, posY, drawW, drawH);

        // Apply soft shadow underneath the white sticker outline
        ctx.shadowColor = 'rgba(0, 0, 0, 0.22)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 4;

        // Draw multiple slight offsets for a clean white die-cut sticker border
        const borderWidth = 7;
        ctx.save();
        // Create an outer white border silhouette
        for (let x = -borderWidth; x <= borderWidth; x += 2) {
          for (let y = -borderWidth; y <= borderWidth; y += 2) {
            if (x * x + y * y <= borderWidth * borderWidth) {
              ctx.drawImage(strokeCanvas, x, y);
            }
          }
        }
        // Fill the silhouette in pure white
        ctx.globalCompositeOperation = 'source-in';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvasSize, canvasSize);
        ctx.restore();
      }

      // Reset shadow for main character drawing
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;

      // Draw the crisp character
      ctx.drawImage(img, posX, posY, drawW, drawH);

      // Optional sticker speech bubble or punchy reaction tag
      if (bubbleText) {
        this.drawStickerBubble(ctx, bubbleText, canvasSize);
      }

      // Export processed sticker buffer
      const buffer = canvas.toBuffer('image/png');
      const stored = await storageService.saveImage(buffer, 'stickers', 'png');

      return {
        publicUrl: stored.publicUrl,
        width: canvasSize,
        height: canvasSize,
      };
    } catch (err) {
      console.error('Image processing error, falling back:', err);
      return this.processVectorSticker({ expressionName: options.expressionName, bubbleText, styleId: options.styleId });
    }
  }

  /**
   * Renders a distinct stylized vector sticker (no photo involved) — used when no
   * AI-generated image is available (mock mode / generation error), so each of the
   * 12 expressions still looks visually different instead of repeating the same asset.
   */
  public async processVectorSticker(options: {
    expressionName?: string;
    bubbleText?: string;
    styleId?: string;
  } = {}): Promise<ProcessedStickerResult> {
    const canvasSize = 512;
    const canvas = createCanvas(canvasSize, canvasSize);
    const ctx = canvas.getContext('2d');
    this.drawStylizedVectorSticker(ctx, options.expressionName || 'Happy', options.bubbleText, options.styleId);
    const buffer = canvas.toBuffer('image/png');
    const stored = await storageService.saveImage(buffer, 'stickers', 'png');
    return {
      publicUrl: stored.publicUrl,
      width: canvasSize,
      height: canvasSize,
    };
  }

  /**
   * Renders a comic sticker speech bubble on the sticker
   */
  private drawStickerBubble(ctx: any, text: string, size: number) {
    ctx.save();
    ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
    const textMetrics = ctx.measureText(text);
    const textWidth = textMetrics.width;
    const paddingX = 14;
    const paddingY = 8;
    const bubbleW = Math.min(textWidth + paddingX * 2, size - 40);
    const bubbleH = 38;
    const bx = (size - bubbleW) / 2;
    const by = size - bubbleH - 16;

    // Drop shadow
    ctx.shadowColor = 'rgba(0,0,0,0.25)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 3;

    // White outer border
    ctx.fillStyle = '#FFFFFF';
    this.roundRect(ctx, bx - 3, by - 3, bubbleW + 6, bubbleH + 6, 16);
    ctx.fill();

    // Bubble body with punchy gradient
    ctx.shadowColor = 'transparent';
    const grad = ctx.createLinearGradient(bx, by, bx, by + bubbleH);
    grad.addColorStop(0, '#10B981');
    grad.addColorStop(1, '#059669');
    ctx.fillStyle = grad;
    this.roundRect(ctx, bx, by, bubbleW, bubbleH, 14);
    ctx.fill();

    // Text
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, size / 2, by + bubbleH / 2);
    ctx.restore();
  }

  private readonly STYLE_FACE_COLORS: Record<string, [string, string]> = {
    cute: ['#FBCFE8', '#F9A8D4'],
    '3d_character': ['#A5F3FC', '#67E8F9'],
    anime: ['#DDD6FE', '#C4B5FD'],
    professional: ['#CBD5E1', '#94A3B8'],
    meme_style: ['#FDE68A', '#FCD34D'],
    surprise_me: ['#99F6E4', '#5EEAD4'],
    cartoon: ['#BFDBFE', '#93C5FD'],
    fun_expressive: ['#FED7AA', '#FDBA74'],
  };

  /**
   * Generates a stylized sticker illustration (used for test mode or fallback).
   * Face color reflects the chosen style, and eyes/mouth/props vary per expression
   * so a full 12-pack looks visually distinct even without a real AI-generated image.
   */
  public drawStylizedVectorSticker(ctx: any, expression: string, bubble?: string, styleId?: string) {
    const size = 512;
    const e = expression.toLowerCase();
    ctx.clearRect(0, 0, size, size);

    // Outer sticker white die-cut background
    ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 6;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(size / 2, size / 2 - 10, 190, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowColor = 'transparent';

    // Character face circle, colored by the selected sticker style
    const [colorTop, colorBottom] = this.STYLE_FACE_COLORS[styleId || ''] || this.STYLE_FACE_COLORS.fun_expressive;
    const faceGrad = ctx.createLinearGradient(size / 2, 80, size / 2, 400);
    faceGrad.addColorStop(0, colorTop);
    faceGrad.addColorStop(1, colorBottom);
    ctx.fillStyle = faceGrad;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2 - 10, 165, 0, Math.PI * 2);
    ctx.fill();

    // Hair / Accent
    ctx.fillStyle = '#451A03';
    ctx.beginPath();
    ctx.arc(size / 2, 180, 150, Math.PI * 1.05, Math.PI * 1.95);
    ctx.fill();

    const eyesClosed = e.includes('laugh') || e.includes('sleepy') || e.includes('goodnight');

    // Eyes
    ctx.fillStyle = '#1E293B';
    if (eyesClosed) {
      ctx.lineWidth = 5;
      ctx.strokeStyle = '#1E293B';
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(size / 2 - 50, size / 2 - 22, 14, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.arc(size / 2 + 50, size / 2 - 22, 14, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(size / 2 - 50, size / 2 - 25, 16, 0, Math.PI * 2);
      ctx.arc(size / 2 + 50, size / 2 - 25, 16, 0, Math.PI * 2);
      ctx.fill();

      // Sparkle in eyes
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(size / 2 - 46, size / 2 - 30, 5, 0, Math.PI * 2);
      ctx.arc(size / 2 + 54, size / 2 - 30, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Eyebrows for grumpy/angry expression
    if (e.includes('angry') || e.includes('grumpy')) {
      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(size / 2 - 66, size / 2 - 48);
      ctx.lineTo(size / 2 - 34, size / 2 - 38);
      ctx.moveTo(size / 2 + 66, size / 2 - 48);
      ctx.lineTo(size / 2 + 34, size / 2 - 38);
      ctx.stroke();
    }

    // Cheeks
    ctx.fillStyle = 'rgba(244, 63, 94, 0.4)';
    ctx.beginPath();
    ctx.arc(size / 2 - 75, size / 2 + 10, 18, 0, Math.PI * 2);
    ctx.arc(size / 2 + 75, size / 2 + 10, 18, 0, Math.PI * 2);
    ctx.fill();

    // Small tear for sad/pleading expression
    if (e.includes('sad') || e.includes('pleading')) {
      ctx.fillStyle = '#38BDF8';
      ctx.beginPath();
      ctx.moveTo(size / 2 + 58, size / 2 - 10);
      ctx.quadraticCurveTo(size / 2 + 68, size / 2 + 12, size / 2 + 58, size / 2 + 20);
      ctx.quadraticCurveTo(size / 2 + 48, size / 2 + 12, size / 2 + 58, size / 2 - 10);
      ctx.fill();
    }

    // Mouth / smile, shaped per expression
    ctx.lineWidth = 8;
    ctx.strokeStyle = '#831843';
    ctx.lineCap = 'round';
    ctx.beginPath();
    if (e.includes('laugh') || e.includes('celebrat') || e.includes('party')) {
      ctx.arc(size / 2, size / 2 + 30, 40, 0.1 * Math.PI, 0.9 * Math.PI);
      ctx.fillStyle = '#E11D48';
      ctx.fill();
    } else if (e.includes('surprised') || e.includes('shock')) {
      ctx.arc(size / 2, size / 2 + 45, 25, 0, Math.PI * 2);
      ctx.fillStyle = '#831843';
      ctx.fill();
    } else if (e.includes('love') || e.includes('heart')) {
      ctx.moveTo(size / 2, size / 2 + 38);
      ctx.bezierCurveTo(size / 2 - 26, size / 2 + 10, size / 2 - 10, size / 2 + 44, size / 2, size / 2 + 30);
      ctx.bezierCurveTo(size / 2 + 10, size / 2 + 44, size / 2 + 26, size / 2 + 10, size / 2, size / 2 + 38);
      ctx.fillStyle = '#E11D48';
      ctx.fill();
    } else if (e.includes('sad') || e.includes('pleading')) {
      ctx.arc(size / 2, size / 2 + 55, 28, 1.1 * Math.PI, 1.9 * Math.PI);
    } else if (e.includes('thinking') || e.includes('hmm')) {
      ctx.arc(size / 2 + 8, size / 2 + 32, 8, 0, Math.PI * 2);
      ctx.fillStyle = '#831843';
      ctx.fill();
    } else if (e.includes('sleepy') || e.includes('goodnight')) {
      ctx.arc(size / 2, size / 2 + 30, 10, 0, Math.PI * 2);
      ctx.fillStyle = '#831843';
      ctx.fill();
    } else if (e.includes('angry') || e.includes('grumpy')) {
      ctx.arc(size / 2, size / 2 + 50, 26, 1.15 * Math.PI, 1.85 * Math.PI);
    } else if (e.includes('facepalm') || e.includes('smh')) {
      ctx.moveTo(size / 2 - 22, size / 2 + 32);
      ctx.lineTo(size / 2 + 22, size / 2 + 32);
    } else {
      // thumbs_up, thank_you, and any remaining default expressions
      ctx.arc(size / 2, size / 2 + 25, 30, 0.15 * Math.PI, 0.85 * Math.PI);
    }
    ctx.stroke();

    // Bubble if present
    if (bubble) {
      this.drawStickerBubble(ctx, bubble, size);
    }
  }

  private roundRect(ctx: any, x: number, y: number, w: number, h: number, r: number) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
}

export const imageProcessor = new ImageProcessor();

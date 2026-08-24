import { createCanvas, loadImage } from 'canvas';
import sharp from 'sharp';
import { storageService } from './storage.js';
import { backgroundRemover } from './backgroundRemover.js';

export interface ProcessedStickerResult {
  publicUrl: string;
  webpUrl?: string;
  width: number;
  height: number;
}

export interface PersonalizedStickerOptions {
  photoUrl: string;
  expressionId: string;
  expressionName: string;
  bubbleText?: string;
  styleId?: string;
  emoji?: string;
}

export class ImageProcessor {
  /**
   * Processes an image into a stunning WhatsApp sticker:
   * - 512x512 transparent canvas
   * - Background removed from photo (pure subject cutout)
   * - Auto-rotated right side up (fixes mobile phone orientation)
   * - Thick white die-cut contour border & realistic shadow
   * - Natural facial expression morphing & props
   * - Saves both PNG and official WhatsApp WebP
   */
  public async processSticker(
    rawBase64OrUrl: string,
    options: {
      expressionName?: string;
      bubbleText?: string;
      addStickerBorder?: boolean;
      styleId?: string;
      emoji?: string;
      expressionId?: string;
      isAIGenerated?: boolean;
    } = {}
  ): Promise<ProcessedStickerResult> {
    if (options.isAIGenerated) {
      return this.processAIGeneratedSticker(rawBase64OrUrl, options);
    }
    return this.processPersonalizedPhotoSticker({
      photoUrl: rawBase64OrUrl,
      expressionId: options.expressionId || 'happy',
      expressionName: options.expressionName || 'Sticker',
      bubbleText: options.bubbleText,
      styleId: options.styleId,
      emoji: options.emoji,
    });
  }

  /**
   * Transforms the user's ACTUAL uploaded selfie into an expressive transparent WhatsApp sticker
   * with background removal, natural facial expression morphing, thick white die-cut border & shadow.
   */
  public async processPersonalizedPhotoSticker(
    options: PersonalizedStickerOptions
  ): Promise<ProcessedStickerResult> {
    const size = 512;
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');

    // Clean transparent background
    ctx.clearRect(0, 0, size, size);

    try {
      let imageSource: string | Buffer = options.photoUrl;
      if (!options.photoUrl.startsWith('data:') && !options.photoUrl.startsWith('http')) {
        const fileData = await storageService.getFileBase64(options.photoUrl);
        if (fileData) {
          imageSource = Buffer.from(fileData.base64, 'base64');
        }
      }

      // 1. Remove background & auto-rotate to create a clean subject cutout
      const cutoutBuffer = await backgroundRemover.removeBackground(imageSource);
      const cutout = await loadImage(cutoutBuffer);

      const expId = (options.expressionId || 'happy').toLowerCase();

      // Fit cutout character in the 512x512 area
      const padding = 32;
      const maxW = size - padding * 2;
      const maxH = size - padding * 2;

      let drawW = maxW;
      let drawH = maxH;
      const aspect = cutout.width / cutout.height;

      if (aspect > 1) {
        drawH = maxW / aspect;
      } else {
        drawW = maxH * aspect;
      }

      // Center the isolated face prominently in the 512x512 canvas
      const posX = (size - drawW) / 2;
      const posY = (size - drawH) / 2 - 10;

      // 2. Thick White Die-Cut Silhouette Border & Realistic Shadow
      const strokeCanvas = createCanvas(size, size);
      const sCtx = strokeCanvas.getContext('2d');
      sCtx.drawImage(cutout, posX, posY, drawW, drawH);

      // Shadow underneath the white die-cut border
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.40)';
      ctx.shadowBlur = 18;
      ctx.shadowOffsetY = 8;

      const borderWidth = 10;
      for (let x = -borderWidth; x <= borderWidth; x += 2) {
        for (let y = -borderWidth; y <= borderWidth; y += 2) {
          if (x * x + y * y <= borderWidth * borderWidth) {
            ctx.drawImage(strokeCanvas, x, y);
          }
        }
      }
      ctx.globalCompositeOperation = 'source-in';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, size, size);
      ctx.restore();

      // 3. Draw the isolated face
      ctx.drawImage(cutout, posX, posY, drawW, drawH);

      // 4. Calculate facial feature anchor points
      const headCenterX = posX + drawW / 2;
      const headCenterY = posY + drawH * 0.46;
      const headRadius = drawW * 0.44;

      // 5. Apply Natural Facial Expression Morphing
      this.applyFacialExpressionMorphing(ctx, expId, headCenterX, headCenterY, headRadius);

      // 6. Draw Hand-Crafted Emoji Expression Props (floating hearts, party hat, steam, etc.)
      this.drawEmojiExpressionProps(ctx, expId, headCenterX, headCenterY, headRadius);

      // 7. Draw Crisp Vector Emoji Badge in corner
      this.drawVectorEmojiBadge(ctx, expId, size);

      // 8. Draw Platform Branding Tag (stickerai.online)
      this.drawPlatformBranding(ctx, size);

      // 9. Generate PNG and official WhatsApp WebP buffers
      const pngBuffer = canvas.toBuffer('image/png');
      const webpBuffer = await sharp(pngBuffer)
        .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .webp({ quality: 90, lossless: false })
        .toBuffer();

      const storedPng = await storageService.saveImage(pngBuffer, 'stickers', 'png');
      const storedWebp = await storageService.saveImage(webpBuffer, 'stickers', 'webp');

      return {
        publicUrl: storedPng.publicUrl,
        webpUrl: storedWebp.publicUrl,
        width: size,
        height: size,
      };
    } catch (err) {
      console.error('Personalized photo sticker error:', err);
      const pngBuffer = canvas.toBuffer('image/png');
      const stored = await storageService.saveImage(pngBuffer, 'stickers', 'png');
      return {
        publicUrl: stored.publicUrl,
        width: size,
        height: size,
      };
    }
  }

  /**
   * Morphs the facial features (eyes, eyebrows, rage tint, romantic blush, tears) based on emotion!
   */
  private applyFacialExpressionMorphing(ctx: any, expId: string, cx: number, cy: number, r: number) {
    const e = expId.toLowerCase();
    ctx.save();

    const leftEyeX = cx - r * 0.28;
    const rightEyeX = cx + r * 0.28;
    const eyeY = cy - r * 0.12;

    if (e.includes('laugh') || e.includes('crying_joy')) {
      // 🤣 1. LAUGHING OUT LOUD: Squinting closed laughing eyes arcs!
      ctx.shadowColor = 'rgba(0,0,0,0.45)';
      ctx.shadowBlur = 4;
      ctx.lineWidth = 6;
      ctx.strokeStyle = '#1E293B';
      ctx.lineCap = 'round';

      // Left eye laughing arc
      ctx.beginPath();
      ctx.arc(leftEyeX, eyeY - 2, 15, 1.15 * Math.PI, 1.85 * Math.PI);
      ctx.stroke();

      // Right eye laughing arc
      ctx.beginPath();
      ctx.arc(rightEyeX, eyeY - 2, 15, 1.15 * Math.PI, 1.85 * Math.PI);
      ctx.stroke();
    } else if (e.includes('angry') || e.includes('grumpy')) {
      // 😡 2. ANGRY / RAGING: Red rage heat filter, sharp angled fierce eyebrows!
      const grad = ctx.createRadialGradient(cx, cy, r * 0.1, cx, cy, r * 0.9);
      grad.addColorStop(0, 'rgba(239, 68, 68, 0.30)');
      grad.addColorStop(1, 'rgba(185, 28, 28, 0.60)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.85, 0, Math.PI * 2);
      ctx.fill();

      // Fierce angled angry eyebrows
      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = 7;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(leftEyeX - 18, eyeY - 18);
      ctx.lineTo(leftEyeX + 14, eyeY - 6);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(rightEyeX + 18, eyeY - 18);
      ctx.lineTo(rightEyeX - 14, eyeY - 6);
      ctx.stroke();
    } else if (e.includes('love') || e.includes('heart')) {
      // 😍 3. LOVE / HEART EYES: Big 3D Glowing Red Hearts over eyes & sweet romantic blush!
      this.drawHeart(ctx, leftEyeX, eyeY, 28, '#EF4444');
      this.drawHeart(ctx, rightEyeX, eyeY, 28, '#EF4444');

      // Sweet blushing cheeks
      const blushGradL = ctx.createRadialGradient(cx - r * 0.45, cy + r * 0.15, 0, cx - r * 0.45, cy + r * 0.15, r * 0.25);
      blushGradL.addColorStop(0, 'rgba(244, 63, 94, 0.40)');
      blushGradL.addColorStop(1, 'rgba(244, 63, 94, 0)');
      ctx.fillStyle = blushGradL;
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

      const blushGradR = ctx.createRadialGradient(cx + r * 0.45, cy + r * 0.15, 0, cx + r * 0.45, cy + r * 0.15, r * 0.25);
      blushGradR.addColorStop(0, 'rgba(244, 63, 94, 0.40)');
      blushGradR.addColorStop(1, 'rgba(244, 63, 94, 0)');
      ctx.fillStyle = blushGradR;
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    } else if (e.includes('sad') || e.includes('pleading')) {
      // 🥺 4. SAD / PLEADING: Giant puppy eyes with glisten & flowing tears!
      this.drawPleadingEye(ctx, leftEyeX, eyeY, 18);
      this.drawPleadingEye(ctx, rightEyeX, eyeY, 18);
      this.drawWaterfallTear(ctx, leftEyeX, eyeY + 14, 45);
      this.drawWaterfallTear(ctx, rightEyeX, eyeY + 14, 45);
    } else if (e.includes('sleepy') || e.includes('goodnight')) {
      // 😴 5. SLEEPY: Closed sleeping eyes!
      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(leftEyeX - 14, eyeY);
      ctx.lineTo(leftEyeX + 14, eyeY);
      ctx.moveTo(rightEyeX - 14, eyeY);
      ctx.lineTo(rightEyeX + 14, eyeY);
      ctx.stroke();
    } else if (e.includes('surprised') || e.includes('shock')) {
      // 😱 6. SURPRISED / SHOCKED: Wide open anime shock eyes!
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(leftEyeX, eyeY, 16, 0, Math.PI * 2);
      ctx.arc(rightEyeX, eyeY, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#1E293B';
      ctx.beginPath();
      ctx.arc(leftEyeX, eyeY, 7, 0, Math.PI * 2);
      ctx.arc(rightEyeX, eyeY, 7, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.includes('thinking') || e.includes('hmm')) {
      // 🤔 7. THINKING: One raised eyebrow!
      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(rightEyeX, eyeY - 14, 16, 1.2 * Math.PI, 1.8 * Math.PI);
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * Draws authentic, expressive emoji accessories and visual props onto the cutout
   */
  private drawEmojiExpressionProps(ctx: any, expressionId: string, cx: number, cy: number, r: number) {
    const e = expressionId.toLowerCase();
    ctx.save();

    if (e.includes('love') || e.includes('heart')) {
      // Floating 3D Glowing Red/Pink Hearts orbiting the person
      this.drawHeart(ctx, cx - r * 0.85, cy - r * 0.65, 34, '#EF4444');
      this.drawHeart(ctx, cx + r * 0.85, cy - r * 0.6, 32, '#F43F5E');
      this.drawHeart(ctx, cx + r * 0.95, cy + r * 0.2, 24, '#EC4899');
      this.drawHeart(ctx, cx - r * 0.95, cy + r * 0.18, 26, '#F43F5E');
      this.drawHeart(ctx, cx, cy - r * 0.95, 24, '#E11D48');
    } else if (e.includes('laugh') || e.includes('crying_joy')) {
      // Flying Big Tear Droplets of Joy & Laugh Sparkles
      this.drawTearDrop(ctx, cx - r * 0.78, cy - r * 0.08, 28, '#38BDF8', -0.4);
      this.drawTearDrop(ctx, cx + r * 0.78, cy - r * 0.08, 28, '#38BDF8', 0.4);
      this.drawTearDrop(ctx, cx - r * 0.92, cy + r * 0.26, 22, '#0EA5E9', -0.6);
      this.drawTearDrop(ctx, cx + r * 0.92, cy + r * 0.26, 22, '#0EA5E9', 0.6);
      this.drawSparkle(ctx, cx - r * 0.5, cy - r * 0.85, 22, '#FCD34D');
      this.drawSparkle(ctx, cx + r * 0.5, cy - r * 0.85, 22, '#FCD34D');
    } else if (e.includes('celebrat') || e.includes('party')) {
      // Festive Party Cone Hat on Head & Multi-color Confetti Explosion
      this.drawPartyHat(ctx, cx, cy - r * 0.88, 70);
      this.drawConfetti(ctx, cx, cy, r);
    } else if (e.includes('angry') || e.includes('grumpy')) {
      // Large Comic Steam Puffs & Anger Cross Marks
      this.drawSteamPuff(ctx, cx - r * 0.92, cy - r * 0.35, true);
      this.drawSteamPuff(ctx, cx + r * 0.92, cy - r * 0.35, false);
      this.drawAngerMark(ctx, cx + r * 0.65, cy - r * 0.85, 32);
      this.drawAngerMark(ctx, cx - r * 0.65, cy - r * 0.85, 26);
    } else if (e.includes('thinking') || e.includes('hmm')) {
      // Glowing Idea Lightbulb above head & Question marks
      this.drawLightbulb(ctx, cx + r * 0.6, cy - r * 0.9, 44);
      this.drawComicQuestion(ctx, cx - r * 0.75, cy - r * 0.8, 34);
    } else if (e.includes('sleepy') || e.includes('goodnight')) {
      // Floating Zzz cloud letters & crescent moon
      this.drawZzz(ctx, cx + r * 0.6, cy - r * 0.75);
      this.drawMoon(ctx, cx - r * 0.75, cy - r * 0.8, 28);
    } else if (e.includes('surprised') || e.includes('shock')) {
      // Anime shock exclamation lines & ‼️
      this.drawExclamation(ctx, cx + r * 0.7, cy - r * 0.85);
      this.drawShockLines(ctx, cx, cy, r);
    } else if (e.includes('facepalm') || e.includes('smh')) {
      // Comic sweat drop on temple & dizzy stars
      this.drawTearDrop(ctx, cx - r * 0.65, cy - r * 0.7, 24, '#38BDF8', 0.2);
      this.drawSparkle(ctx, cx + r * 0.7, cy - r * 0.7, 18, '#FDE047');
      this.drawSparkle(ctx, cx, cy - r * 0.95, 18, '#FBBF24');
    } else if (e.includes('thank_you') || e.includes('shukran')) {
      // Golden gratitude sparkles & rays
      this.drawSparkle(ctx, cx - r * 0.8, cy - r * 0.5, 22, '#FBBF24');
      this.drawSparkle(ctx, cx + r * 0.8, cy - r * 0.5, 22, '#FBBF24');
      this.drawSparkle(ctx, cx, cy - r * 0.95, 26, '#F59E0B');
    } else {
      // Thumbs up / Happy / Default Sparkles
      this.drawSparkle(ctx, cx - r * 0.8, cy - r * 0.5, 20, '#F59E0B');
      this.drawSparkle(ctx, cx + r * 0.8, cy - r * 0.5, 20, '#F59E0B');
    }

    ctx.restore();
  }

  private drawPleadingEye(ctx: any, x: number, y: number, size: number) {
    ctx.save();
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();

    // Big glisten
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(x - size * 0.35, y - size * 0.35, size * 0.45, 0, Math.PI * 2);
    ctx.arc(x + size * 0.35, y + size * 0.35, size * 0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawWaterfallTear(ctx: any, x: number, y: number, length: number) {
    ctx.save();
    const grad = ctx.createLinearGradient(x, y, x, y + length);
    grad.addColorStop(0, '#38BDF8');
    grad.addColorStop(1, '#0284C7');
    ctx.fillStyle = grad;
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 5, y);
    ctx.quadraticCurveTo(x - 8, y + length * 0.6, x - 10, y + length);
    ctx.arc(x, y + length, 10, Math.PI, 0);
    ctx.quadraticCurveTo(x + 8, y + length * 0.6, x + 5, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  private drawHeart(ctx: any, x: number, y: number, size: number, color: string) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#FFFFFF';
    this.drawHeartPath(ctx, x, y, size + 6);
    ctx.fill();

    ctx.shadowColor = 'transparent';
    ctx.fillStyle = color;
    this.drawHeartPath(ctx, x, y, size);
    ctx.fill();
    ctx.restore();
  }

  private drawHeartPath(ctx: any, x: number, y: number, size: number) {
    const s = size / 2;
    ctx.beginPath();
    ctx.moveTo(x, y + s / 4);
    ctx.quadraticCurveTo(x, y, x - s / 2, y);
    ctx.quadraticCurveTo(x - s, y, x - s, y + s / 2);
    ctx.quadraticCurveTo(x - s, y + s, x, y + s * 1.5);
    ctx.quadraticCurveTo(x + s, y + s, x + s, y + s / 2);
    ctx.quadraticCurveTo(x + s, y, x + s / 2, y);
    ctx.quadraticCurveTo(x, y, x, y + s / 4);
    ctx.closePath();
  }

  private drawTearDrop(ctx: any, x: number, y: number, size: number, color: string, angle: number) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 6;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(0, 0, size + 3, 0, Math.PI);
    ctx.lineTo(0, -size * 1.6 - 3);
    ctx.closePath();
    ctx.fill();

    ctx.shadowColor = 'transparent';
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, size, 0, Math.PI);
    ctx.lineTo(0, -size * 1.6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private drawPartyHat(ctx: any, x: number, y: number, height: number) {
    ctx.save();
    const w = height * 0.75;
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(x, y - height - 6);
    ctx.lineTo(x - w / 2 - 6, y + 6);
    ctx.lineTo(x + w / 2 + 6, y + 6);
    ctx.closePath();
    ctx.fill();

    ctx.shadowColor = 'transparent';
    const grad = ctx.createLinearGradient(x - w / 2, y, x + w / 2, y);
    grad.addColorStop(0, '#EC4899');
    grad.addColorStop(0.5, '#F59E0B');
    grad.addColorStop(1, '#8B5CF6');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(x, y - height);
    ctx.lineTo(x - w / 2, y);
    ctx.lineTo(x + w / 2, y);
    ctx.closePath();
    ctx.fill();

    // Pom-pom on top
    ctx.fillStyle = '#FDE047';
    ctx.beginPath();
    ctx.arc(x, y - height - 3, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawConfetti(ctx: any, cx: number, cy: number, r: number) {
    const colors = ['#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6', '#FDE047'];
    for (let i = 0; i < 20; i++) {
      const angle = (i / 20) * Math.PI * 2;
      const dist = r * (0.8 + (i % 3) * 0.18);
      const px = cx + Math.cos(angle) * dist;
      const py = cy + Math.sin(angle) * dist;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(i * 0.5);
      ctx.fillStyle = colors[i % colors.length];
      ctx.fillRect(-5, -5, 10, 10);
      ctx.restore();
    }
  }

  private drawSteamPuff(ctx: any, x: number, y: number, left: boolean) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.2)';
    ctx.shadowBlur = 6;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(x, y, 16, 0, Math.PI * 2);
    ctx.arc(x + (left ? -14 : 14), y - 12, 20, 0, Math.PI * 2);
    ctx.arc(x + (left ? -28 : 28), y - 22, 14, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();
  }

  private drawAngerMark(ctx: any, x: number, y: number, size: number) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 6;
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    this.drawAngerPath(ctx, x, y, size);

    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = '#EF4444';
    ctx.lineWidth = 6;
    this.drawAngerPath(ctx, x, y, size);
    ctx.restore();
  }

  private drawAngerPath(ctx: any, x: number, y: number, size: number) {
    ctx.beginPath();
    ctx.moveTo(x - size / 2, y - size / 4);
    ctx.quadraticCurveTo(x, y - size / 4, x, y - size / 2);
    ctx.moveTo(x + size / 2, y - size / 4);
    ctx.quadraticCurveTo(x, y - size / 4, x, y - size / 2);
    ctx.moveTo(x - size / 2, y + size / 4);
    ctx.quadraticCurveTo(x, y + size / 4, x, y + size / 2);
    ctx.moveTo(x + size / 2, y + size / 4);
    ctx.quadraticCurveTo(x, y + size / 4, x, y + size / 2);
    ctx.stroke();
  }

  private drawLightbulb(ctx: any, x: number, y: number, size: number) {
    ctx.save();
    ctx.shadowColor = 'rgba(251, 191, 36, 0.6)';
    ctx.shadowBlur = 14;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(x, y, size / 2 + 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#FBBF24';
    ctx.beginPath();
    ctx.arc(x, y, size / 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#94A3B8';
    ctx.fillRect(x - 6, y + size / 2 - 2, 12, 8);
    ctx.restore();
  }

  private drawComicQuestion(ctx: any, x: number, y: number, size: number) {
    ctx.save();
    ctx.font = `bold ${size}px system-ui, sans-serif`;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText('?', x - 2, y + 2);
    ctx.fillStyle = '#38BDF8';
    ctx.fillText('?', x, y);
    ctx.restore();
  }

  private drawZzz(ctx: any, x: number, y: number) {
    ctx.save();
    ctx.font = 'bold 30px system-ui, sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText('Z', x, y);
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillText('z', x + 20, y - 18);
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.fillText('z', x + 34, y - 30);

    ctx.fillStyle = '#818CF8';
    ctx.font = 'bold 30px system-ui, sans-serif';
    ctx.fillText('Z', x - 1, y - 1);
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillText('z', x + 19, y - 19);
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.fillText('z', x + 33, y - 31);
    ctx.restore();
  }

  private drawMoon(ctx: any, x: number, y: number, size: number) {
    ctx.save();
    ctx.shadowColor = 'rgba(253, 224, 71, 0.6)';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#FDE047';
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(x + size * 0.55, y - size * 0.2, size * 0.85, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawExclamation(ctx: any, x: number, y: number) {
    ctx.save();
    ctx.font = 'black 38px system-ui, sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText('!!', x - 2, y + 2);
    ctx.fillStyle = '#EF4444';
    ctx.fillText('!!', x, y);
    ctx.restore();
  }

  private drawShockLines(ctx: any, cx: number, cy: number, r: number) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.lineWidth = 4;
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2;
      const inner = r * 0.96;
      const outer = r * 1.18;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
      ctx.lineTo(cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawSparkle(ctx: any, x: number, y: number, size: number, color: string) {
    ctx.save();
    ctx.fillStyle = '#FFFFFF';
    this.drawSparkleStar(ctx, x, y, size + 4);
    ctx.fill();

    ctx.fillStyle = color;
    this.drawSparkleStar(ctx, x, y, size);
    ctx.fill();
    ctx.restore();
  }

  private drawSparkleStar(ctx: any, x: number, y: number, s: number) {
    ctx.beginPath();
    ctx.moveTo(x, y - s);
    ctx.quadraticCurveTo(x, y, x + s, y);
    ctx.quadraticCurveTo(x, y, x, y + s);
    ctx.quadraticCurveTo(x, y, x - s, y);
    ctx.quadraticCurveTo(x, y, x, y - s);
    ctx.closePath();
  }

  /**
   * Draws a crisp, gorgeous vector emoji badge on the sticker corner
   */
  private drawVectorEmojiBadge(ctx: any, expId: string, size: number) {
    const e = expId.toLowerCase();
    const bx = size - 64;
    const by = size - 64;
    const r = 28;

    ctx.save();
    // 1. White die-cut outline & shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 4;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(bx, by, r + 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowColor = 'transparent';

    if (e.includes('laugh') || e.includes('crying_joy')) {
      // 🤣 ROFL / Laughing Emoji
      ctx.fillStyle = '#FBBF24';
      ctx.beginPath();
      ctx.arc(bx, by, r, 0, Math.PI * 2);
      ctx.fill();

      // Closed laughing eyes
      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(bx - 9, by - 5, 7, 1.15 * Math.PI, 1.85 * Math.PI);
      ctx.arc(bx + 9, by - 5, 7, 1.15 * Math.PI, 1.85 * Math.PI);
      ctx.stroke();

      // Open laughing mouth
      ctx.fillStyle = '#831843';
      ctx.beginPath();
      ctx.arc(bx, by + 4, 14, 0.1 * Math.PI, 0.9 * Math.PI);
      ctx.closePath();
      ctx.fill();

      // Blue tears on sides
      ctx.fillStyle = '#38BDF8';
      ctx.beginPath();
      ctx.arc(bx - 18, by + 2, 5, 0, Math.PI * 2);
      ctx.arc(bx + 18, by + 2, 5, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.includes('love') || e.includes('heart')) {
      // 😍 Heart Eyes Emoji
      ctx.fillStyle = '#FBBF24';
      ctx.beginPath();
      ctx.arc(bx, by, r, 0, Math.PI * 2);
      ctx.fill();

      // Heart eyes
      this.drawHeartPath(ctx, bx - 8, by - 4, 12);
      ctx.fillStyle = '#EF4444';
      ctx.fill();

      this.drawHeartPath(ctx, bx + 8, by - 4, 12);
      ctx.fillStyle = '#EF4444';
      ctx.fill();

      // Smile
      ctx.strokeStyle = '#831843';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(bx, by + 5, 10, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
    } else if (e.includes('angry') || e.includes('grumpy')) {
      // 😡 Angry Red Face Emoji
      ctx.fillStyle = '#EF4444';
      ctx.beginPath();
      ctx.arc(bx, by, r, 0, Math.PI * 2);
      ctx.fill();

      // Angry eyes
      ctx.fillStyle = '#1E293B';
      ctx.beginPath();
      ctx.arc(bx - 8, by - 2, 3.5, 0, Math.PI * 2);
      ctx.arc(bx + 8, by - 2, 3.5, 0, Math.PI * 2);
      ctx.fill();

      // Angry eyebrows
      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(bx - 14, by - 10);
      ctx.lineTo(bx - 3, by - 5);
      ctx.moveTo(bx + 14, by - 10);
      ctx.lineTo(bx + 3, by - 5);
      ctx.stroke();

      // Grumpy frown
      ctx.beginPath();
      ctx.arc(bx, by + 14, 10, 1.2 * Math.PI, 1.8 * Math.PI);
      ctx.stroke();
    } else if (e.includes('celebrat') || e.includes('party')) {
      // 🥳 Party Emoji
      ctx.fillStyle = '#FBBF24';
      ctx.beginPath();
      ctx.arc(bx, by, r, 0, Math.PI * 2);
      ctx.fill();

      // Party hat
      this.drawPartyHat(ctx, bx - 5, by - 12, 22);

      // Smile
      ctx.strokeStyle = '#831843';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(bx, by + 5, 10, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
    } else {
      // 😊 Cheerful Happy Emoji
      ctx.fillStyle = '#FBBF24';
      ctx.beginPath();
      ctx.arc(bx, by, r, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#1E293B';
      ctx.beginPath();
      ctx.arc(bx - 8, by - 5, 3.5, 0, Math.PI * 2);
      ctx.arc(bx + 8, by - 5, 3.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#831843';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(bx, by + 4, 10, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * Draws a sleek, subtle platform watermark tag (stickerai.online)
   * on the bottom-left of the sticker with white die-cut outline and drop shadow.
   */
  private drawPlatformBranding(ctx: any, size: number) {
    ctx.save();
    const text = 'stickerai.online';
    ctx.font = 'bold 12px system-ui, -apple-system, sans-serif';
    const textW = ctx.measureText(text).width;
    const pillW = textW + 24;
    const pillH = 22;
    const pillX = 20;
    const pillY = size - 36;

    // Shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 3;

    // White die-cut outline
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.roundRect(pillX - 2, pillY - 2, pillW + 4, pillH + 4, 11);
    ctx.fill();

    // Dark pill background
    ctx.shadowColor = 'transparent';
    const grad = ctx.createLinearGradient(pillX, pillY, pillX + pillW, pillY);
    grad.addColorStop(0, '#0F172A');
    grad.addColorStop(1, '#1E293B');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 9);
    ctx.fill();

    // Sparkle icon & text
    ctx.fillStyle = '#38BDF8';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('✨', pillX + 6, pillY + pillH / 2);

    ctx.fillStyle = '#F8FAFC';
    ctx.font = 'bold 10.5px system-ui, -apple-system, sans-serif';
    ctx.fillText(text, pillX + 22, pillY + pillH / 2 + 1);

    ctx.restore();
  }

  /**
   * Processes the generated DALL-E 3 sticker sheet:
   * saves the original PNG and produces a high-quality WebP version.
   */
  public async processStickerSheet(
    rawBase64: string
  ): Promise<ProcessedStickerResult> {
    const base64Data = rawBase64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    
    // Save original PNG
    const storedPng = await storageService.saveImage(buffer, 'stickers', 'png');
    
    // Save WebP version using sharp
    const webpBuffer = await sharp(buffer)
      .webp({ quality: 90 })
      .toBuffer();
    const storedWebp = await storageService.saveImage(webpBuffer, 'stickers', 'webp');

    return {
      publicUrl: storedPng.publicUrl,
      webpUrl: storedWebp.publicUrl,
      width: 1792,
      height: 1024,
    };
  }

  /**
   * Performs boundary flood fill starting from borders of the image
   * to remove the solid white background and replace it with transparency.
   */
  public async makeBackgroundTransparent(imageSource: Buffer): Promise<Buffer> {
    const img = await loadImage(imageSource);
    const w = img.width;
    const h = img.height;
    const canvas = createCanvas(w, h);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;

    const visited = new Uint8Array(w * h);
    const queue: number[] = [];

    const isWhite = (r: number, g: number, b: number) => {
      // Threshold for "white" background pixels
      return r > 240 && g > 240 && b > 240;
    };

    // Add all border pixels to the queue
    for (let x = 0; x < w; x++) {
      // Top border
      if (isWhite(data[x * 4], data[x * 4 + 1], data[x * 4 + 2])) {
        queue.push(x, 0);
        visited[x] = 1;
      }
      // Bottom border
      const yBottom = h - 1;
      const idxBottom = yBottom * w + x;
      if (isWhite(data[idxBottom * 4], data[idxBottom * 4 + 1], data[idxBottom * 4 + 2])) {
        queue.push(x, yBottom);
        visited[idxBottom] = 1;
      }
    }

    for (let y = 0; y < h; y++) {
      // Left border
      const idxLeft = y * w;
      if (isWhite(data[idxLeft * 4], data[idxLeft * 4 + 1], data[idxLeft * 4 + 2])) {
        queue.push(0, y);
        visited[idxLeft] = 1;
      }
      // Right border
      const xRight = w - 1;
      const idxRight = y * w + xRight;
      if (isWhite(data[idxRight * 4], data[idxRight * 4 + 1], data[idxRight * 4 + 2])) {
        queue.push(xRight, y);
        visited[idxRight] = 1;
      }
    }

    let head = 0;
    const dx = [0, 0, 1, -1];
    const dy = [1, -1, 0, 0];

    while (head < queue.length) {
      const cx = queue[head++];
      const cy = queue[head++];

      for (let i = 0; i < 4; i++) {
        const nx = cx + dx[i];
        const ny = cy + dy[i];

        if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
          const nIdx = ny * w + nx;
          if (!visited[nIdx]) {
            const r = data[nIdx * 4];
            const g = data[nIdx * 4 + 1];
            const b = data[nIdx * 4 + 2];

            if (isWhite(r, g, b)) {
              visited[nIdx] = 1;
              queue.push(nx, ny);
            }
          }
        }
      }
    }

    // Turn all visited pixels transparent
    for (let i = 0; i < w * h; i++) {
      if (visited[i]) {
        data[i * 4 + 3] = 0;
      }
    }

    ctx.putImageData(imgData, 0, 0);
    return canvas.toBuffer('image/png');
  }

  /**
   * Processes the AI-generated sticker image:
   * 1. Flood-fills the white background to transparency.
   * 2. Draws on a 512x512 canvas, applying white contour border and shadow.
   * 3. Adds vector emoji badge and platform branding.
   */
  public async processAIGeneratedSticker(
    rawBase64OrUrl: string,
    options: {
      expressionId?: string;
      expressionName?: string;
      styleId?: string;
    } = {}
  ): Promise<ProcessedStickerResult> {
    const size = 512;
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, size, size);

    try {
      let imageSource: string | Buffer = rawBase64OrUrl;
      if (!rawBase64OrUrl.startsWith('data:') && !rawBase64OrUrl.startsWith('http')) {
        const fileData = await storageService.getFileBase64(rawBase64OrUrl);
        if (fileData) {
          imageSource = Buffer.from(fileData.base64, 'base64');
        }
      } else if (rawBase64OrUrl.startsWith('data:')) {
        const base64Data = rawBase64OrUrl.replace(/^data:image\/\w+;base64,/, '');
        imageSource = Buffer.from(base64Data, 'base64');
      }

      // 1. Load the AI sticker and remove its white background using flood fill
      const transparentBuffer = await this.makeBackgroundTransparent(imageSource as Buffer);
      const cutout = await loadImage(transparentBuffer);

      // Fit cutout in the 512x512 area
      const padding = 40;
      const maxW = size - padding * 2;
      const maxH = size - padding * 2;

      let drawW = maxW;
      let drawH = maxH;
      const aspect = cutout.width / cutout.height;

      if (aspect > 1) {
        drawH = maxW / aspect;
      } else {
        drawW = maxH * aspect;
      }

      const posX = (size - drawW) / 2;
      const posY = (size - drawH) / 2 - 10;

      // 2. Thick White Die-Cut Silhouette Border & Realistic Shadow
      const strokeCanvas = createCanvas(size, size);
      const sCtx = strokeCanvas.getContext('2d');
      sCtx.drawImage(cutout, posX, posY, drawW, drawH);

      // Shadow underneath
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.40)';
      ctx.shadowBlur = 18;
      ctx.shadowOffsetY = 8;

      const borderWidth = 8;
      for (let x = -borderWidth; x <= borderWidth; x += 2) {
        for (let y = -borderWidth; y <= borderWidth; y += 2) {
          if (x * x + y * y <= borderWidth * borderWidth) {
            ctx.drawImage(strokeCanvas, x, y);
          }
        }
      }
      ctx.globalCompositeOperation = 'source-in';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, size, size);
      ctx.restore();

      // 3. Draw the character
      ctx.drawImage(cutout, posX, posY, drawW, drawH);

      // 4. Draw Crisp Vector Emoji Badge in corner
      const expId = (options.expressionId || 'happy').toLowerCase();
      this.drawVectorEmojiBadge(ctx, expId, size);

      // 5. Draw Platform Branding Tag (stickerai.online)
      this.drawPlatformBranding(ctx, size);

      // 6. Generate PNG and WebP buffers
      const pngBuffer = canvas.toBuffer('image/png');
      const webpBuffer = await sharp(pngBuffer)
        .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .webp({ quality: 95, lossless: false })
        .toBuffer();

      const storedPng = await storageService.saveImage(pngBuffer, 'stickers', 'png');
      const storedWebp = await storageService.saveImage(webpBuffer, 'stickers', 'webp');

      return {
        publicUrl: storedPng.publicUrl,
        webpUrl: storedWebp.publicUrl,
        width: size,
        height: size,
      };

    } catch (err) {
      console.error('AI generated sticker processing error:', err);
      // Fallback: save original
      let buffer: Buffer;
      if (Buffer.isBuffer(rawBase64OrUrl)) {
        buffer = rawBase64OrUrl;
      } else {
        const base64Data = rawBase64OrUrl.replace(/^data:image\/\w+;base64,/, '');
        buffer = Buffer.from(base64Data, 'base64');
      }
      const stored = await storageService.saveImage(buffer, 'stickers', 'png');
      return {
        publicUrl: stored.publicUrl,
        width: size,
        height: size,
      };
    }
  }
}

export const imageProcessor = new ImageProcessor();

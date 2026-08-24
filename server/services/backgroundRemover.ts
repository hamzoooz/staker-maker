import { createCanvas, loadImage } from 'canvas';
import sharp from 'sharp';

export class BackgroundRemover {
  /**
   * Auto-orients the image (fixes orientation), isolates ONLY the head and face
   * (eliminating shoulders, chest, clothing, and background), and returns a pristine transparent cutout.
   */
  public async removeBackground(imageSource: string | Buffer): Promise<Buffer> {
    let inputBuffer: Buffer;

    if (Buffer.isBuffer(imageSource)) {
      inputBuffer = imageSource;
    } else if (imageSource.startsWith('data:')) {
      const base64Data = imageSource.replace(/^data:image\/\w+;base64,/, '');
      inputBuffer = Buffer.from(base64Data, 'base64');
    } else {
      inputBuffer = await sharp(imageSource).toBuffer();
    }

    // 1. Auto-rotate based on EXIF orientation (crucial for mobile camera uploads)
    const orientedBuffer = await sharp(inputBuffer)
      .rotate() // automatically detects and applies EXIF orientation!
      .png()
      .toBuffer();

    const origImg = await loadImage(orientedBuffer);
    const origW = origImg.width;
    const origH = origImg.height;

    // 2. Tightly crop to the Head & Face region (top 5% to 68% height, center 75% width)
    const cropX = Math.floor(origW * 0.12);
    const cropY = Math.floor(origH * 0.04);
    const cropW = Math.max(100, Math.floor(origW * 0.76));
    const cropH = Math.max(100, Math.floor(origH * 0.64));

    const canvas = createCanvas(cropW, cropH);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(origImg, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

    const imgData = ctx.getImageData(0, 0, cropW, cropH);
    const data = imgData.data;

    // 3. Sample background colors from perimeter
    const bgSamples: [number, number, number][] = [];
    const sampleDepth = Math.max(6, Math.min(20, Math.floor(cropW * 0.08)));

    // Top-left and Top-right corners
    for (let y = 0; y < sampleDepth; y++) {
      for (let x = 0; x < sampleDepth; x++) {
        const idxL = (y * cropW + x) * 4;
        bgSamples.push([data[idxL], data[idxL + 1], data[idxL + 2]]);

        const idxR = (y * cropW + (cropW - 1 - x)) * 4;
        bgSamples.push([data[idxR], data[idxR + 1], data[idxR + 2]]);
      }
    }

    // Average background color
    const avgBg = bgSamples.reduce(
      (acc, c) => [acc[0] + c[0], acc[1] + c[1], acc[2] + c[2]],
      [0, 0, 0]
    ).map((v) => v / Math.max(1, bgSamples.length));

    // Calculate background variance
    let variance = 0;
    for (const s of bgSamples) {
      variance += Math.sqrt(
        Math.pow(s[0] - avgBg[0], 2) +
        Math.pow(s[1] - avgBg[1], 2) +
        Math.pow(s[2] - avgBg[2], 2)
      );
    }
    variance = variance / Math.max(1, bgSamples.length);
    const baseThresh = Math.max(25, Math.min(50, variance * 2.0));

    // 4. Soft keying: Isolate head/face contour into oval mask & remove all background colors
    const headCx = cropW / 2;
    const headCy = cropH * 0.48;
    const rx = cropW * 0.38;
    const ry = cropH * 0.44;

    for (let y = 0; y < cropH; y++) {
      for (let x = 0; x < cropW; x++) {
        const idx = (y * cropW + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];

        // Elliptical distance from head center
        const ex = (x - headCx) / rx;
        const ey = (y - headCy) / ry;
        const ellipseDist = ex * ex + ey * ey;

        const colorDist = Math.sqrt(
          Math.pow(r - avgBg[0], 2) +
          Math.pow(g - avgBg[1], 2) +
          Math.pow(b - avgBg[2], 2)
        );

        if (ellipseDist > 1.0) {
          // Outside head/face oval -> completely transparent
          data[idx + 3] = 0;
        } else if (colorDist < baseThresh) {
          // Background color anywhere -> transparent
          data[idx + 3] = 0;
        } else if (ellipseDist > 0.85) {
          // Smooth feathered outer edge of head
          const edgeAlpha = Math.max(0, Math.min(1, (1.0 - ellipseDist) / 0.15));
          data[idx + 3] = Math.round(data[idx + 3] * edgeAlpha);
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);
    return canvas.toBuffer('image/png');
  }
}

export const backgroundRemover = new BackgroundRemover();

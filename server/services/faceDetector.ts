import sharp from 'sharp';
import { openAIService } from './openai.js';
import { storageService } from './storage.js';

export interface FaceValidationResult {
  success: boolean;
  error?: string;
  croppedUrl?: string;
}

export class FaceDetector {
  /**
   * Validates if a face exists, whether multiple faces exist, and crops the image around the primary face.
   */
  public async validateAndCrop(imageBuffer: Buffer): Promise<FaceValidationResult> {
    try {
      // 1. Auto-rotate/orient using sharp to prevent orientation issues
      const orientedBuffer = await sharp(imageBuffer).rotate().png().toBuffer();

      // Get image dimensions using sharp
      const metadata = await sharp(orientedBuffer).metadata();
      const width = metadata.width || 0;
      const height = metadata.height || 0;

      // 2. Call OpenAI API with the image to check for faces
      const apiKey = openAIService.getApiKey();
      if (!apiKey) {
        console.warn('FaceDetector: No OpenAI API key configured, skipping validation.');
        const stored = await storageService.saveImage(orientedBuffer, 'uploads', 'png');
        return { success: true, croppedUrl: stored.publicUrl };
      }

      const base64Image = orientedBuffer.toString('base64');
      const systemPrompt = `You are an expert computer vision model. Your task is to detect and analyze human faces in the provided photo.
Analyze the image and return a JSON object with the following fields:
- "faceDetected": boolean (true if at least one clear human face is detected)
- "multipleFaces": boolean (true if there are 2 or more human faces in the image)
- "primaryFaceBox": [ymin, xmin, ymax, xmax] (normalized coordinates from 0 to 1000 representing the bounding box of the largest, most centered human face: ymin, xmin, ymax, xmax. If no face is detected, return null)
- "faceQuality": "low" | "medium" | "high" (quality of the primary face details)

Ensure you return ONLY a raw JSON block. Do not add markdown backticks, explanations, or any text other than the JSON object itself. Example:
{
  "faceDetected": true,
  "multipleFaces": false,
  "primaryFaceBox": [120, 340, 680, 780],
  "faceQuality": "high"
}`;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: systemPrompt,
            },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Detect and validate the faces in this photo. Return the JSON object.',
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:image/png;base64,${base64Image}`,
                  },
                },
              ],
            },
          ],
          response_format: { type: 'json_object' },
          max_tokens: 150,
          temperature: 0.1,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('OpenAI Face Detection API error response:', errorText);
        throw new Error(`OpenAI API responded with status ${response.status}`);
      }

      const data: any = await response.json();
      const content = data.choices?.[0]?.message?.content?.trim();
      if (!content) {
        throw new Error('No response content from OpenAI model');
      }

      const result = JSON.parse(content);

      if (!result.faceDetected) {
        return { success: false, error: 'No face detected. Please upload a clear portrait.' };
      }

      if (result.multipleFaces) {
        return { success: false, error: 'Multiple faces detected. Please upload a photo containing one person.' };
      }

      const isLowQuality = result.faceQuality === 'low';

      if (result.primaryFaceBox && Array.isArray(result.primaryFaceBox) && result.primaryFaceBox.length === 4) {
        const [ymin, xmin, ymax, xmax] = result.primaryFaceBox;

        // Convert normalized coordinates to pixels
        const yMinPx = (ymin / 1000) * height;
        const xMinPx = (xmin / 1000) * width;
        const yMaxPx = (ymax / 1000) * height;
        const xMaxPx = (xmax / 1000) * width;

        const faceW = xMaxPx - xMinPx;
        const faceH = yMaxPx - yMinPx;

        // Crop with extra padding to preserve hair, headwear, beard, skin tone
        const padX = faceW * 0.45;
        const padY = faceH * 0.45;

        const cropLeft = Math.max(0, Math.floor(xMinPx - padX));
        const cropTop = Math.max(0, Math.floor(yMinPx - padY * 1.5)); // More top padding for turban/hair
        const cropWidth = Math.min(width - cropLeft, Math.floor(faceW + padX * 2));
        const cropHeight = Math.min(height - cropTop, Math.floor(faceH + padY * 2.5));

        let croppedBuffer = await sharp(orientedBuffer)
          .extract({ left: cropLeft, top: cropTop, width: cropWidth, height: cropHeight })
          .toBuffer();

        // Enhance low quality images using sharp upscale and sharpening filters
        if (isLowQuality) {
          console.log('Face detector: Enhancing low-quality uploaded face image...');
          croppedBuffer = await sharp(croppedBuffer)
            .resize(800, 800, { fit: 'inside', kernel: sharp.kernel.lanczos3 })
            .sharpen({ sigma: 1.5 })
            .toBuffer();
        }

        const stored = await storageService.saveImage(croppedBuffer, 'uploads', 'png');
        return { success: true, croppedUrl: stored.publicUrl };
      }

      // Fallback: save oriented image if face coordinate format failed but a face was detected
      let finalBuffer = orientedBuffer;
      if (isLowQuality) {
        console.log('Face detector: Enhancing low-quality fallback uploaded face image...');
        finalBuffer = await sharp(orientedBuffer)
          .resize(800, 800, { fit: 'inside', kernel: sharp.kernel.lanczos3 })
          .sharpen({ sigma: 1.5 })
          .toBuffer();
      }
      const stored = await storageService.saveImage(finalBuffer, 'uploads', 'png');
      return { success: true, croppedUrl: stored.publicUrl };

    } catch (e: any) {
      console.error('FaceDetector error during validateAndCrop:', e);
      return { success: false, error: 'Failed to process face detection. Please try again.' };
    }
  }
}

export const faceDetector = new FaceDetector();

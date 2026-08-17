import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const UPLOADS_DIR = path.join(process.cwd(), 'public', 'assets', 'uploads');
const STICKERS_DIR = path.join(process.cwd(), 'public', 'assets', 'stickers');

// Ensure directories exist
[UPLOADS_DIR, STICKERS_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

export interface StoredFile {
  filename: string;
  filepath: string;
  publicUrl: string;
  size: number;
  mimeType: string;
}

export class StorageService {
  /**
   * Saves raw buffer or base64 image data to public storage.
   */
  public async saveImage(
    buffer: Buffer, 
    folder: 'uploads' | 'stickers', 
    extension = 'png'
  ): Promise<StoredFile> {
    const randomId = crypto.randomUUID();
    const filename = `${randomId}.${extension}`;
    const targetDir = folder === 'uploads' ? UPLOADS_DIR : STICKERS_DIR;
    const filepath = path.join(targetDir, filename);

    await fs.promises.writeFile(filepath, buffer);
    const stats = await fs.promises.stat(filepath);

    const publicUrl = `/assets/${folder}/${filename}`;

    return {
      filename,
      filepath,
      publicUrl,
      size: stats.size,
      mimeType: extension === 'jpg' || extension === 'jpeg' ? 'image/jpeg' : 'image/png',
    };
  }

  /**
   * Saves a base64 string directly
   */
  public async saveBase64Image(
    base64Data: string, 
    folder: 'uploads' | 'stickers',
    extension = 'png'
  ): Promise<StoredFile> {
    // Strip data url prefix if present
    const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');
    return this.saveImage(buffer, folder, extension);
  }

  /**
   * Reads file as Base64 for feeding directly to Gemini SDK
   */
  public async getFileBase64(publicUrl: string): Promise<{ base64: string; mimeType: string } | null> {
    try {
      let relativePath = publicUrl;
      if (relativePath.startsWith('/')) relativePath = relativePath.slice(1);
      
      const localPath = path.join(process.cwd(), 'public', relativePath);
      if (!fs.existsSync(localPath)) return null;

      const buffer = await fs.promises.readFile(localPath);
      const ext = path.extname(localPath).toLowerCase();
      const mimeType = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.webp' ? 'image/webp' : 'image/png';
      
      return {
        base64: buffer.toString('base64'),
        mimeType,
      };
    } catch (e) {
      console.error('Error reading file as base64:', e);
      return null;
    }
  }

  /**
   * Deletes files older than retention days
   */
  public async pruneOldAssets(retentionDays = 7): Promise<number> {
    const thresholdMs = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
    let deletedCount = 0;

    for (const dir of [UPLOADS_DIR, STICKERS_DIR]) {
      try {
        const files = await fs.promises.readdir(dir);
        for (const file of files) {
          const fullPath = path.join(dir, file);
          const stat = await fs.promises.stat(fullPath);
          if (stat.mtimeMs < thresholdMs) {
            await fs.promises.unlink(fullPath);
            deletedCount++;
          }
        }
      } catch (e) {
        console.error('Error pruning directory:', dir, e);
      }
    }

    return deletedCount;
  }
}

export const storageService = new StorageService();

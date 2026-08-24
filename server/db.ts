import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { AppSettings, DeliveryEvent, GeneratedSticker, Order } from '../src/types/index.js';

interface DatabaseSchema {
  orders: Record<string, Order>;
  stickers: Record<string, GeneratedSticker[]>;
  deliveryLogs: Record<string, DeliveryEvent[]>;
  settings: AppSettings;
  adminTokens: Record<string, { email: string; name: string; expiresAt: number }>;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

const DEFAULT_SETTINGS: AppSettings = {
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  basePrice: 0.99,
  gatewayFee: 0.20,
  currency: 'USD',
  zolnaPaySecretKey: process.env.ZOLNAPAY_SECRET_KEY || '',
  zolnaPayPublishableKey: process.env.ZOLNAPAY_PUBLISHABLE_KEY || '',
  zolnaPayApiUrl: process.env.ZOLNAPAY_API_URL || 'http://127.0.0.1:4000/v1',
  systemPrompt: '',
  aiProvider: 'openai',
};

class DatabaseStore {
  private data: DatabaseSchema = {
    orders: {},
    stickers: {},
    deliveryLogs: {},
    settings: { ...DEFAULT_SETTINGS },
    adminTokens: {},
  };
  private isLoaded = false;

  constructor() {
    this.init();
  }

  private init() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        this.data = {
          orders: parsed.orders || {},
          stickers: parsed.stickers || {},
          deliveryLogs: parsed.deliveryLogs || {},
          settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) },
          adminTokens: parsed.adminTokens || {},
        };
      }
    } catch (e) {
      console.warn('Could not load database file, starting fresh:', e);
    }
    this.isLoaded = true;
  }

  private save() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (e) {
      console.error('Failed to persist database:', e);
    }
  }

  // Settings
  public getSettings(): AppSettings {
    return this.data.settings;
  }

  public updateSettings(updates: Partial<AppSettings>): AppSettings {
    this.data.settings = {
      ...this.data.settings,
      ...updates,
    };
    this.save();
    return this.data.settings;
  }

  // Admin Authentication
  public validateAdminCredentials(username: string, pass: string): { email: string; name: string } | null {
    const cleanUser = (username || '').trim().toLowerCase();
    const cleanPass = (pass || '').trim();

    // Admin 1: Hamza
    if ((cleanUser === 'hamzoooz123@gmail.com' || cleanUser === 'hamzoooz') && cleanPass === 'Hamza@2020') {
      return { email: 'hamzoooz123@gmail.com', name: 'Hamza (Super Admin)' };
    }

    // Admin 2: Anwr
    if (
      (cleanUser === 'anwraltaher.com' || cleanUser === 'anwraltahir@gmail.com' || cleanUser === 'anwraltaher@gmail.com' || cleanUser === 'anwr') &&
      cleanPass === 'Anwr@2020'
    ) {
      return { email: 'anwraltaher.com', name: 'Anwr Altahir (Admin)' };
    }

    // Fallback secret key auth
    if (cleanPass === (process.env.ADMIN_SECRET_KEY || 'stickerai-admin-2025')) {
      return { email: cleanUser || 'admin@stickerai.online', name: 'Platform Admin' };
    }

    return null;
  }

  public createAdminSession(email: string, name: string): string {
    const token = `adm_${crypto.randomBytes(24).toString('hex')}`;
    const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days
    this.data.adminTokens[token] = { email, name, expiresAt };
    this.save();
    return token;
  }

  public verifyAdminToken(token?: string): { email: string; name: string } | null {
    if (!token) return null;
    const session = this.data.adminTokens[token];
    if (!session) return null;
    if (session.expiresAt < Date.now()) {
      delete this.data.adminTokens[token];
      this.save();
      return null;
    }
    return { email: session.email, name: session.name };
  }

  // Orders
  public createOrder(order: Order): Order {
    this.data.orders[order.id] = order;
    this.data.stickers[order.id] = [];
    this.data.deliveryLogs[order.id] = order.deliveryEvents || [];
    this.save();
    return order;
  }

  public getOrder(orderId: string): Order | undefined {
    return this.data.orders[orderId];
  }

  public updateOrder(orderId: string, updates: Partial<Order>): Order | undefined {
    const existing = this.data.orders[orderId];
    if (!existing) return undefined;

    const updated: Order = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.data.orders[orderId] = updated;
    this.save();
    return updated;
  }

  public deleteOrder(orderId: string): boolean {
    if (this.data.orders[orderId]) {
      delete this.data.orders[orderId];
      delete this.data.stickers[orderId];
      delete this.data.deliveryLogs[orderId];
      this.save();
      return true;
    }
    return false;
  }

  public getAllOrders(): Order[] {
    return Object.values(this.data.orders).sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  // Stickers
  public saveStickers(orderId: string, stickers: GeneratedSticker[]) {
    this.data.stickers[orderId] = stickers;
    this.save();
  }

  public getStickers(orderId: string): GeneratedSticker[] {
    return this.data.stickers[orderId] || [];
  }

  public updateSticker(orderId: string, stickerId: string, updates: Partial<GeneratedSticker>): GeneratedSticker | undefined {
    const list = this.data.stickers[orderId] || [];
    const idx = list.findIndex(s => s.id === stickerId);
    if (idx === -1) return undefined;

    list[idx] = {
      ...list[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.data.stickers[orderId] = list;
    this.save();
    return list[idx];
  }

  // Delivery Events
  public addDeliveryEvent(orderId: string, event: DeliveryEvent) {
    if (!this.data.deliveryLogs[orderId]) {
      this.data.deliveryLogs[orderId] = [];
    }
    this.data.deliveryLogs[orderId].push(event);

    const order = this.data.orders[orderId];
    if (order) {
      order.deliveryEvents = this.data.deliveryLogs[orderId];
      order.updatedAt = new Date().toISOString();
    }
    this.save();
  }

  public getDeliveryEvents(orderId: string): DeliveryEvent[] {
    return this.data.deliveryLogs[orderId] || [];
  }

  // Data Lifecycle Cleanup (retention rule)
  public cleanupExpiredOrders(retentionDays = 7): number {
    const now = Date.now();
    let cleaned = 0;
    const thresholdMs = retentionDays * 24 * 60 * 60 * 1000;

    for (const [id, order] of Object.entries(this.data.orders)) {
      const orderAge = now - new Date(order.createdAt).getTime();
      if (orderAge > thresholdMs) {
        delete this.data.orders[id];
        delete this.data.stickers[id];
        delete this.data.deliveryLogs[id];
        cleaned++;
      }
    }
    if (cleaned > 0) {
      this.save();
    }
    return cleaned;
  }
}

export const db = new DatabaseStore();

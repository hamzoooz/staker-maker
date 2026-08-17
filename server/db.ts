import fs from 'fs';
import path from 'path';
import { DeliveryEvent, GeneratedSticker, Order } from '../src/types/index.js';

interface DatabaseSchema {
  orders: Record<string, Order>;
  stickers: Record<string, GeneratedSticker[]>;
  deliveryLogs: Record<string, DeliveryEvent[]>;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

class DatabaseStore {
  private data: DatabaseSchema = {
    orders: {},
    stickers: {},
    deliveryLogs: {},
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
        this.data = JSON.parse(raw);
      }
    } catch (e) {
      console.warn('Could not load database file, starting in-memory:', e);
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

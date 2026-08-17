import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import multer from 'multer';
import { createServer as createViteServer } from 'vite';
import { db } from './server/db.js';
import { storageService } from './server/services/storage.js';
import { getPaymentService } from './server/services/payment.js';
import { jobQueue } from './server/services/jobQueue.js';
import { whatsAppService } from './server/services/whatsapp.js';
import { POPULAR_COUNTRIES, STICKER_PACKAGES, STICKER_STYLES } from './src/data/constants.js';
import { Order, StickerStyleId } from './src/types/index.js';

// Setup multer for in-memory file uploads with 10MB limit
const upload = multer({
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype.toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error('Only JPG, JPEG, PNG, and WEBP image files are allowed.'));
    }
  },
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  // JSON and URL-encoded body parsers (with 15MB limit for base64 uploads)
  app.use(express.json({ limit: '15mb' }));
  app.use(express.urlencoded({ extended: true, limit: '15mb' }));

  // Serve static generated assets
  const publicAssetsDir = path.join(process.cwd(), 'public', 'assets');
  if (!fs.existsSync(publicAssetsDir)) {
    fs.mkdirSync(publicAssetsDir, { recursive: true });
  }
  app.use('/assets', express.static(publicAssetsDir));

  // --- API Endpoints ---

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'StickerMe AI',
      timestamp: new Date().toISOString(),
    });
  });

  // Public config for frontend
  app.get('/api/config', (_req, res) => {
    res.json({
      styles: STICKER_STYLES,
      packages: STICKER_PACKAGES,
      countries: POPULAR_COUNTRIES,
      pricing: {
        amount: 2.99,
        currency: 'USD',
        stickersCount: 12,
      },
      hasGeminiApiKey: !!process.env.GEMINI_API_KEY,
      hasWhatsAppCredentials: !!(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID),
      hasPaymentCredentials: !!process.env.PAYMENT_SECRET_KEY,
    });
  });

  // Create Order with Photo & WhatsApp Number
  app.post('/api/orders', upload.single('photo'), async (req, res) => {
    try {
      const { phone, countryCode = 'QA', style = 'fun_expressive', photoBase64 } = req.body;

      if (!phone || typeof phone !== 'string') {
        res.status(400).json({ error: 'Valid WhatsApp phone number is required.' });
        return;
      }

      // Validate and normalize phone number
      const cleanDigits = phone.replace(/[^0-9+]/g, '');
      const normalizedPhone = cleanDigits.startsWith('+') ? cleanDigits : `+${cleanDigits}`;

      if (normalizedPhone.length < 8 || normalizedPhone.length > 18) {
        res.status(400).json({ error: 'Please enter a valid international WhatsApp number.' });
        return;
      }

      // Handle photo upload
      let photoUrl = '';
      if (req.file) {
        const ext = req.file.mimetype.includes('webp') ? 'webp' : req.file.mimetype.includes('png') ? 'png' : 'jpg';
        const stored = await storageService.saveImage(req.file.buffer, 'uploads', ext);
        photoUrl = stored.publicUrl;
      } else if (photoBase64 && typeof photoBase64 === 'string') {
        const stored = await storageService.saveBase64Image(photoBase64, 'uploads', 'jpg');
        photoUrl = stored.publicUrl;
      } else {
        res.status(400).json({ error: 'Please upload a clear selfie photo.' });
        return;
      }

      // Validate sticker style
      const validStyle = STICKER_STYLES.some(s => s.id === style) ? (style as StickerStyleId) : 'fun_expressive';

      // Create new Order (Fixed server-side price of $2.99)
      const orderId = `ord_${crypto.randomBytes(6).toString('hex')}`;
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const newOrder: Order = {
        id: orderId,
        customerPhone: normalizedPhone,
        countryCode: countryCode.toUpperCase(),
        rawPhone: phone,
        photoUrl,
        style: validStyle,
        packageId: 'pack_12',
        stickerCount: 12,
        price: 2.99,
        currency: 'USD',
        paymentStatus: 'pending',
        generationStatus: 'queued',
        generationProgress: {
          total: 12,
          completed: 0,
        },
        deliveryStatus: 'pending',
        deliveryEvents: [
          {
            id: `ev_${Date.now()}`,
            timestamp: now.toISOString(),
            type: 'info',
            message: 'Order created. Awaiting payment confirmation.',
          },
        ],
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        expiresAt,
      };

      db.createOrder(newOrder);

      res.status(201).json({
        success: true,
        order: newOrder,
      });
    } catch (err: any) {
      console.error('Order creation error:', err);
      res.status(500).json({ error: err.message || 'Failed to create order.' });
    }
  });

  // Start Checkout for an Order
  app.post('/api/orders/:id/checkout', async (req, res) => {
    try {
      const order = db.getOrder(req.params.id);
      if (!order) {
        res.status(404).json({ error: 'Order not found.' });
        return;
      }

      const baseUrl = process.env.APP_BASE_URL || process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
      const successUrl = `${baseUrl}/order/${order.id}?payment=success`;
      const cancelUrl = `${baseUrl}/order/${order.id}?payment=cancelled`;

      const paymentService = getPaymentService();
      const session = await paymentService.createCheckoutSession(order, successUrl, cancelUrl);

      db.updateOrder(order.id, {
        paymentId: session.paymentId,
      });

      res.json({
        success: true,
        checkoutUrl: session.checkoutUrl,
        paymentId: session.paymentId,
        provider: session.provider,
      });
    } catch (err: any) {
      console.error('Checkout error:', err);
      res.status(500).json({ error: err.message || 'Checkout failed.' });
    }
  });

  // Payment Webhook (Source of truth for payment confirmation)
  app.post('/api/payments/webhook', async (req, res) => {
    try {
      const headerSig = req.headers['stripe-signature'] || req.headers['x-webhook-signature'];
      const signature = Array.isArray(headerSig) ? headerSig[0] : (headerSig as string) || '';
      const paymentService = getPaymentService();
      const webhookResult = await paymentService.verifyWebhook(req.body, signature);

      if (!webhookResult.orderId) {
        res.status(400).json({ error: 'Order ID missing in webhook payload.' });
        return;
      }

      const order = db.getOrder(webhookResult.orderId);
      if (!order) {
        res.status(404).json({ error: 'Order not found.' });
        return;
      }

      if (webhookResult.status === 'paid' && order.paymentStatus !== 'paid') {
        db.updateOrder(order.id, {
          paymentStatus: 'paid',
          paymentId: webhookResult.paymentId,
        });

        db.addDeliveryEvent(order.id, {
          id: `ev_${Date.now()}_paid`,
          timestamp: new Date().toISOString(),
          type: 'info',
          message: `Payment of $${webhookResult.amount} ${webhookResult.currency} verified. Starting AI sticker creation pipeline.`,
        });

        // Trigger asynchronous sticker generation pipeline
        jobQueue.queueGeneration(order.id);
      }

      res.json({ received: true, status: webhookResult.status });
    } catch (err: any) {
      console.error('Webhook processing error:', err);
      res.status(400).json({ error: err.message || 'Webhook verification failed.' });
    }
  });

  // Simulate Payment (Development / Demo instant confirmation)
  app.post('/api/orders/:id/simulate-payment', async (req, res) => {
    try {
      const order = db.getOrder(req.params.id);
      if (!order) {
        res.status(404).json({ error: 'Order not found.' });
        return;
      }

      const paymentId = `sim_pay_${crypto.randomBytes(6).toString('hex')}`;
      db.updateOrder(order.id, {
        paymentStatus: 'paid',
        paymentId,
      });

      db.addDeliveryEvent(order.id, {
        id: `ev_${Date.now()}_sim`,
        timestamp: new Date().toISOString(),
        type: 'info',
        message: 'Payment confirmed successfully. Generation job queued.',
      });

      // Queue generation in background
      jobQueue.queueGeneration(order.id);

      res.json({
        success: true,
        order: db.getOrder(order.id),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get Order Status & Generated Stickers (Live Polling)
  app.get('/api/orders/:id/status', (req, res) => {
    const order = db.getOrder(req.params.id);
    if (!order) {
      res.status(404).json({ error: 'Order not found.' });
      return;
    }

    const stickers = db.getStickers(order.id);
    const events = db.getDeliveryEvents(order.id);

    // Build direct WhatsApp link
    const cleanPhone = order.customerPhone.replace(/[^0-9]/g, '');
    const baseUrl = process.env.APP_BASE_URL || process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    const packUrl = `${baseUrl}/order/${order.id}`;
    const prefilledText = encodeURIComponent(
      `🎉 My 12 WhatsApp stickers from StickerMe AI are ready! Check them out: ${packUrl}`
    );
    const whatsappLink = `https://wa.me/${cleanPhone}?text=${prefilledText}`;

    res.json({
      order: {
        ...order,
        deliveryEvents: events,
      },
      stickers,
      whatsappLink,
      isCompleted: order.generationStatus === 'completed',
    });
  });

  // Retry Sticker or Order Generation
  app.post('/api/orders/:id/retry', async (req, res) => {
    try {
      const { stickerId } = req.body;
      const order = db.getOrder(req.params.id);
      if (!order) {
        res.status(404).json({ error: 'Order not found.' });
        return;
      }

      if (stickerId) {
        const stickers = await jobQueue.retrySingleSticker(order.id, stickerId);
        res.json({ success: true, stickers });
      } else {
        jobQueue.queueGeneration(order.id);
        res.json({ success: true, message: 'Generation job re-queued.' });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Retry WhatsApp Delivery
  app.post('/api/orders/:id/deliver', async (req, res) => {
    try {
      const order = db.getOrder(req.params.id);
      if (!order) {
        res.status(404).json({ error: 'Order not found.' });
        return;
      }

      const stickers = db.getStickers(order.id);
      const deliveryResult = await whatsAppService.deliverStickerPack(order, stickers);

      db.updateOrder(order.id, {
        deliveryStatus: deliveryResult.success ? 'delivered' : 'failed',
      });

      res.json({ success: true, result: deliveryResult });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Admin Dashboard: View all orders
  app.get('/api/admin/orders', (req, res) => {
    const adminKey = req.headers['x-admin-key'] || req.query.key;
    const requiredKey = process.env.ADMIN_SECRET_KEY || 'stickerme-admin-2025';

    // Allow in dev mode or with key
    if (adminKey && adminKey !== requiredKey) {
      res.status(401).json({ error: 'Unauthorized: Invalid admin credentials.' });
      return;
    }

    const orders = db.getAllOrders();
    const stats = {
      totalOrders: orders.length,
      paidOrders: orders.filter(o => o.paymentStatus === 'paid').length,
      completedGenerations: orders.filter(o => o.generationStatus === 'completed').length,
      deliveredOrders: orders.filter(o => o.deliveryStatus === 'delivered').length,
      totalRevenueUSD: orders.filter(o => o.paymentStatus === 'paid').reduce((acc, o) => acc + o.price, 0),
    };

    res.json({
      stats,
      orders,
    });
  });

  // Admin: Update order notes or refund
  app.post('/api/admin/orders/:id/update', (req, res) => {
    const { paymentStatus, adminNotes } = req.body;
    const updated = db.updateOrder(req.params.id, {
      ...(paymentStatus ? { paymentStatus } : {}),
      ...(adminNotes ? { adminNotes } : {}),
    });

    if (!updated) {
      res.status(404).json({ error: 'Order not found.' });
      return;
    }
    res.json({ success: true, order: updated });
  });

  // Prune expired assets routine
  setInterval(() => {
    const retentionDays = parseInt(process.env.ASSET_RETENTION_DAYS || '7', 10);
    storageService.pruneOldAssets(retentionDays);
    db.cleanupExpiredOrders(retentionDays);
  }, 12 * 60 * 60 * 1000); // every 12 hours

  // Vite middleware for dev / static build for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 StickerMe AI Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Server startup failure:', err);
});

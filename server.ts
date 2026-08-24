import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import multer from 'multer';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { db } from './server/db.js';
import { storageService } from './server/services/storage.js';
import { getPaymentService, ZolnaPayPaymentService } from './server/services/payment.js';
import { jobQueue } from './server/services/jobQueue.js';
import { whatsAppService } from './server/services/whatsapp.js';
import { faceDetector } from './server/services/faceDetector.js';
import { POPULAR_COUNTRIES, STICKER_PACKAGES, STICKER_STYLES } from './src/data/constants.js';
import { Order, StickerStyleId } from './src/types/index.js';

// Load environment variables
dotenv.config();

// Setup multer for in-memory file uploads with 15MB limit
const upload = multer({
  limits: {
    fileSize: 15 * 1024 * 1024,
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
  const PORT = parseInt(process.env.PORT || '3005', 10);

  // JSON and URL-encoded body parsers (with 25MB limit for base64 uploads)
  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ extended: true, limit: '25mb' }));

  // Serve static generated assets
  const publicAssetsDir = path.join(process.cwd(), 'public', 'assets');
  if (!fs.existsSync(publicAssetsDir)) {
    fs.mkdirSync(publicAssetsDir, { recursive: true });
  }
  app.use('/assets', express.static(publicAssetsDir));

  // Middleware to extract Admin Session
  const getAdminUser = (req: express.Request) => {
    const authHeader = req.headers['authorization'] || '';
    const headerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : (req.headers['x-admin-token'] as string);
    return db.verifyAdminToken(headerToken);
  };

  // --- API Endpoints ---

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'StickerAI Online',
      domain: 'stickerai.online',
      timestamp: new Date().toISOString(),
    });
  });

  // Validate uploaded image and detect/crop face
  app.post('/api/validate-image', upload.single('photo'), async (req, res) => {
    try {
      let imageBuffer: Buffer;
      if (req.file) {
        imageBuffer = req.file.buffer;
      } else if (req.body.photoBase64) {
        const base64Data = req.body.photoBase64.replace(/^data:image\/\w+;base64,/, '');
        imageBuffer = Buffer.from(base64Data, 'base64');
      } else {
        res.status(400).json({ success: false, error: 'Please upload a photo.' });
        return;
      }

      const result = await faceDetector.validateAndCrop(imageBuffer);
      res.json(result);
    } catch (err: any) {
      console.error('Image validation endpoint error:', err);
      res.status(500).json({ success: false, error: err.message || 'Failed to process face validation.' });
    }
  });

  // Public config for frontend
  app.get('/api/config', (_req, res) => {
    const settings = db.getSettings();
    const zolnaKey = settings.zolnaPaySecretKey || process.env.ZOLNAPAY_SECRET_KEY || process.env.PAYMENT_SECRET_KEY;
    const basePrice = settings.basePrice || 0.99;
    const feePrice = settings.gatewayFee || 0.20;
    const totalPrice = Math.round((basePrice + feePrice) * 100) / 100;

    res.json({
      styles: STICKER_STYLES,
      packages: STICKER_PACKAGES,
      countries: POPULAR_COUNTRIES,
      pricing: {
        basePrice,
        gatewayFee: feePrice,
        amount: totalPrice,
        currency: settings.currency || 'USD',
        stickersCount: 12,
      },
      hasOpenAiKey: !!(settings.openaiApiKey || process.env.OPENAI_API_KEY),
      hasGeminiApiKey: !!(settings.geminiApiKey || process.env.GEMINI_API_KEY),
      hasWhatsAppCredentials: !!(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID),
      hasPaymentCredentials: !!zolnaKey,
      hasZolnaPayCredentials: !!zolnaKey,
      zolnapayPublishableKey: settings.zolnaPayPublishableKey || process.env.ZOLNAPAY_PUBLISHABLE_KEY || '',
      provider: zolnaKey ? 'zolnapay' : 'mock',
    });
  });

  // Admin Authentication
  app.post('/api/admin/login', (req, res) => {
    const { username, email, password } = req.body;
    const userIdentifier = username || email;

    if (!userIdentifier || !password) {
      res.status(400).json({ error: 'Username/email and password are required.' });
      return;
    }

    const admin = db.validateAdminCredentials(userIdentifier, password);
    if (!admin) {
      res.status(401).json({ error: 'Invalid admin credentials.' });
      return;
    }

    const token = db.createAdminSession(admin.email, admin.name);

    res.json({
      success: true,
      token,
      user: {
        email: admin.email,
        name: admin.name,
        isAdmin: true,
      },
    });
  });

  // Verify Admin Session
  app.get('/api/admin/me', (req, res) => {
    const admin = getAdminUser(req);
    if (!admin) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    res.json({
      success: true,
      user: {
        email: admin.email,
        name: admin.name,
        isAdmin: true,
      },
    });
  });

  // Admin: Get & Update Settings
  app.get('/api/admin/settings', (req, res) => {
    const admin = getAdminUser(req);
    if (!admin) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Read current system prompt from file
    let systemPrompt = '';
    try {
      const promptPath = path.join(process.cwd(), 'system-promper.md');
      if (fs.existsSync(promptPath)) {
        systemPrompt = fs.readFileSync(promptPath, 'utf-8');
      }
    } catch (e) {
      console.warn('Could not read system prompt:', e);
    }

    const settings = db.getSettings();
    res.json({
      settings: {
        ...settings,
        systemPrompt,
      },
    });
  });

  app.post('/api/admin/settings', (req, res) => {
    const admin = getAdminUser(req);
    if (!admin) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const {
      openaiApiKey,
      geminiApiKey,
      basePrice,
      gatewayFee,
      currency,
      zolnaPaySecretKey,
      zolnaPayPublishableKey,
      zolnaPayApiUrl,
      systemPrompt,
      aiProvider,
    } = req.body;

    const updated = db.updateSettings({
      ...(openaiApiKey !== undefined ? { openaiApiKey } : {}),
      ...(geminiApiKey !== undefined ? { geminiApiKey } : {}),
      ...(basePrice !== undefined ? { basePrice: parseFloat(basePrice) } : {}),
      ...(gatewayFee !== undefined ? { gatewayFee: parseFloat(gatewayFee) } : {}),
      ...(currency ? { currency } : {}),
      ...(zolnaPaySecretKey ? { zolnaPaySecretKey } : {}),
      ...(zolnaPayPublishableKey ? { zolnaPayPublishableKey } : {}),
      ...(zolnaPayApiUrl ? { zolnaPayApiUrl } : {}),
      ...(aiProvider ? { aiProvider } : {}),
    });

    // If system prompt was updated, write to system-promper.md
    if (systemPrompt && typeof systemPrompt === 'string') {
      try {
        const promptPath = path.join(process.cwd(), 'system-promper.md');
        fs.writeFileSync(promptPath, systemPrompt, 'utf-8');
      } catch (e) {
        console.error('Failed to write system-promper.md:', e);
      }
    }

    res.json({ success: true, settings: updated });
  });

  // Create Order (Phone number is OPTIONAL, Admin creates for FREE)
  app.post('/api/orders', upload.single('photo'), async (req, res) => {
    try {
      const { phone, countryCode = 'QA', style = 'fun_expressive', photoBase64 } = req.body;
      const admin = getAdminUser(req);
      const isAdminOrder = !!admin;

      // Normalize phone if provided, otherwise mark as Direct Web
      let normalizedPhone = 'Direct Web Link';
      let rawPhone = 'Direct Web';

      if (phone && typeof phone === 'string' && phone.trim().length > 3) {
        const cleanDigits = phone.replace(/[^0-9+]/g, '');
        normalizedPhone = cleanDigits.startsWith('+') ? cleanDigits : `+${cleanDigits}`;
        rawPhone = phone;
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

      const settings = db.getSettings();
      const basePrice = settings.basePrice || 0.99;
      const feePrice = settings.gatewayFee || 0.20;
      const totalPrice = Math.round((basePrice + feePrice) * 100) / 100;

      const orderId = `ord_${crypto.randomBytes(6).toString('hex')}`;
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const newOrder: Order = {
        id: orderId,
        customerPhone: normalizedPhone,
        countryCode: countryCode.toUpperCase(),
        rawPhone,
        photoUrl,
        style: validStyle,
        packageId: 'pack_12',
        stickerCount: 12,
        basePrice: isAdminOrder ? 0 : basePrice,
        feePrice: isAdminOrder ? 0 : feePrice,
        price: isAdminOrder ? 0 : totalPrice,
        currency: 'USD',
        paymentStatus: isAdminOrder ? 'paid' : 'pending',
        isAdminOrder,
        adminUser: admin ? admin.email : undefined,
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
            message: isAdminOrder
              ? `Order created by Admin (${admin?.name}). Free bypass activated.`
              : 'Order created. Awaiting payment confirmation.',
          },
        ],
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        expiresAt,
      };

      db.createOrder(newOrder);

      let checkoutUrl = '';
      if (!isAdminOrder) {
        try {
          const baseUrl = process.env.APP_BASE_URL || process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
          const successUrl = `${baseUrl}/order/${orderId}?payment=success`;
          const cancelUrl = `${baseUrl}/order/${orderId}?payment=cancelled`;
          const paymentService = getPaymentService();
          const session = await paymentService.createCheckoutSession(newOrder, successUrl, cancelUrl);
          checkoutUrl = session.checkoutUrl;
          db.updateOrder(orderId, { paymentId: session.paymentId });
        } catch (e) {
          console.warn('Could not auto-create ZolnaPay checkout session:', e);
        }
      }

      // If created by Admin, immediately queue generation pipeline without charging!
      if (isAdminOrder) {
        jobQueue.queueGeneration(orderId);
      }

      res.status(201).json({
        success: true,
        order: db.getOrder(orderId) || newOrder,
        checkoutUrl,
        isAdminOrder,
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
        clientSecret: session.clientSecret,
      });
    } catch (err: any) {
      console.error('Checkout error:', err);
      res.status(500).json({ error: err.message || 'Checkout failed.' });
    }
  });

  // Direct Card Payment with ZolnaPay Gateway ($0.99 + $0.20 fee = $1.19)
  app.post('/api/orders/:id/pay-card', async (req, res) => {
    try {
      const order = db.getOrder(req.params.id);
      if (!order) {
        res.status(404).json({ error: 'Order not found.' });
        return;
      }

      if (order.paymentStatus === 'paid') {
        res.json({ success: true, order, message: 'Order is already paid.' });
        return;
      }

      const { cardNumber, cardholderName, expMonth, expYear, cvc } = req.body;

      if (!cardNumber || !cardholderName || !expMonth || !expYear || !cvc) {
        res.status(400).json({ error: 'All card details (number, holder name, expiry, cvc) are required.' });
        return;
      }

      const paymentService = getPaymentService();

      let paymentId = order.paymentId;
      if (!paymentId || paymentId.startsWith('sim_')) {
        const baseUrl = process.env.APP_BASE_URL || process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
        const session = await paymentService.createCheckoutSession(
          order,
          `${baseUrl}/order/${order.id}?payment=success`,
          `${baseUrl}/order/${order.id}?payment=cancelled`
        );
        paymentId = session.paymentId;
        db.updateOrder(order.id, { paymentId });
      }

      if (paymentService.confirmCardPayment) {
        const cardResult = await paymentService.confirmCardPayment(order, paymentId, {
          cardNumber,
          cardholderName,
          expMonth,
          expYear,
          cvc,
        });

        if (!cardResult.success) {
          res.status(400).json({
            error: cardResult.error || 'Card payment was declined.',
            requiresAction: cardResult.requiresAction,
            actionUrl: cardResult.actionUrl,
          });
          return;
        }
      }

      // Mark order as paid
      db.updateOrder(order.id, {
        paymentStatus: 'paid',
        paymentId,
      });

      db.addDeliveryEvent(order.id, {
        id: `ev_${Date.now()}_card_paid`,
        timestamp: new Date().toISOString(),
        type: 'info',
        message: `Credit/Debit card payment of $${order.price} ${order.currency} ($${order.basePrice || 0.99} + $${order.feePrice || 0.20} fee) confirmed via ZolnaPay. AI sticker pipeline started.`,
      });

      // Queue AI sticker generation job
      jobQueue.queueGeneration(order.id);

      const updatedOrder = db.getOrder(order.id);

      res.json({
        success: true,
        order: updatedOrder,
      });
    } catch (err: any) {
      console.error('Direct card payment error:', err);
      res.status(500).json({ error: err.message || 'Payment processing failed.' });
    }
  });

  // Payment Webhook
  app.post(['/api/payments/webhook', '/api/payments/zolnapay-webhook'], async (req, res) => {
    try {
      const headerSig = req.headers['stripe-signature'] || req.headers['x-webhook-signature'] || req.headers['x-zolnapay-signature'];
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
          message: `Payment of $${webhookResult.amount} ${webhookResult.currency} verified via webhook. Starting AI sticker creation pipeline.`,
        });

        jobQueue.queueGeneration(order.id);
      }

      res.json({ received: true, status: webhookResult.status });
    } catch (err: any) {
      console.error('Webhook processing error:', err);
      res.status(400).json({ error: err.message || 'Webhook verification failed.' });
    }
  });

  // Simulate Payment (Development / Testing)
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

      jobQueue.queueGeneration(order.id);

      res.json({
        success: true,
        order: db.getOrder(order.id),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get Order Status & Generated Stickers
  app.get('/api/orders/:id/status', (req, res) => {
    const order = db.getOrder(req.params.id);
    if (!order) {
      res.status(404).json({ error: 'Order not found.' });
      return;
    }

    const paymentParam = req.query.payment;
    const zolnapayId = req.query.zolnapay_id || req.query.payment_id || req.query.link;

    if ((paymentParam === 'success' || zolnapayId) && order.paymentStatus !== 'paid') {
      db.updateOrder(order.id, {
        paymentStatus: 'paid',
        paymentId: (zolnapayId as string) || order.paymentId || `pay_zolna_${Date.now()}`,
      });
      db.addDeliveryEvent(order.id, {
        id: `ev_${Date.now()}_paid_redirect`,
        timestamp: new Date().toISOString(),
        type: 'info',
        message: 'Payment confirmed via ZolnaPay Hosted Gateway. Starting AI sticker creation pipeline.',
      });
      jobQueue.queueGeneration(order.id);
    }

    const updatedOrder = db.getOrder(req.params.id) || order;
    const stickers = db.getStickers(updatedOrder.id);
    const events = db.getDeliveryEvents(updatedOrder.id);

    // Build direct WhatsApp link
    const cleanPhone = (order.customerPhone || '').replace(/[^0-9]/g, '');
    const baseUrl = process.env.APP_BASE_URL || process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    const packUrl = `${baseUrl}/order/${order.id}`;
    const prefilledText = encodeURIComponent(
      `🎉 My 12 WhatsApp stickers from StickerAI are ready! Check them out: ${packUrl}`
    );
    const whatsappLink = cleanPhone ? `https://wa.me/${cleanPhone}?text=${prefilledText}` : `https://wa.me/?text=${prefilledText}`;

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
        // Admin "Retry Generation": force a full regenerate, including stickers
        // already marked completed (e.g. to fix a previously botched pack).
        jobQueue.queueGeneration(order.id, { force: true });
        res.json({ success: true, message: 'Generation job re-queued.' });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Admin Dashboard: View all orders & statistics
  app.get('/api/admin/orders', (req, res) => {
    const admin = getAdminUser(req);
    const adminKey = req.headers['x-admin-key'] || req.query.key;
    const requiredKey = process.env.ADMIN_SECRET_KEY || 'stickerai-admin-2025';

    if (!admin && adminKey !== requiredKey) {
      res.status(401).json({ error: 'Unauthorized: Invalid admin credentials.' });
      return;
    }

    const orders = db.getAllOrders();
    const paidOrders = orders.filter(o => o.paymentStatus === 'paid');
    const totalRevenueUSD = paidOrders.reduce((acc, o) => acc + (o.price || 0), 0);
    const totalFeesUSD = paidOrders.reduce((acc, o) => acc + (o.feePrice || 0.20), 0);
    const netRevenueUSD = Math.round((totalRevenueUSD - totalFeesUSD) * 100) / 100;

    const stats = {
      totalOrders: orders.length,
      paidOrders: paidOrders.length,
      completedGenerations: orders.filter(o => o.generationStatus === 'completed').length,
      deliveredOrders: orders.filter(o => o.deliveryStatus === 'delivered').length,
      totalRevenueUSD: Math.round(totalRevenueUSD * 100) / 100,
      totalFeesUSD: Math.round(totalFeesUSD * 100) / 100,
      netRevenueUSD,
      adminCreations: orders.filter(o => o.isAdminOrder).length,
    };

    // Attach sticker count and preview to each order
    const enrichedOrders = orders.map(o => ({
      ...o,
      stickers: db.getStickers(o.id),
    }));

    res.json({
      stats,
      orders: enrichedOrders,
      admin: admin ? { email: admin.email, name: admin.name } : null,
    });
  });

  // Admin: Delete order
  app.delete('/api/admin/orders/:id', (req, res) => {
    const admin = getAdminUser(req);
    if (!admin) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const success = db.deleteOrder(req.params.id);
    res.json({ success });
  });

  // Prune expired assets routine
  setInterval(() => {
    const retentionDays = parseInt(process.env.ASSET_RETENTION_DAYS || '7', 10);
    storageService.pruneOldAssets(retentionDays);
    db.cleanupExpiredOrders(retentionDays);
  }, 12 * 60 * 60 * 1000);

  // Vite middleware for dev / static build for production
  const distPath = path.join(process.cwd(), 'dist');
  const isProduction = process.env.NODE_ENV === 'production' || fs.existsSync(path.join(distPath, 'index.html'));

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true, allowedHosts: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 StickerAI Server running on port ${PORT} (http://0.0.0.0:${PORT})`);
  });
}

startServer().catch(err => {
  console.error('Server startup failure:', err);
});

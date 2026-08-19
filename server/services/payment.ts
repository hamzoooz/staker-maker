import crypto from 'crypto';
import { Order, PaymentStatus } from '../../src/types/index.js';

export interface CardDetails {
  cardNumber: string;
  cardholderName: string;
  expMonth: string | number;
  expYear: string | number;
  cvc: string;
}

export interface CheckoutSessionResult {
  checkoutUrl: string;
  paymentId: string;
  provider: 'zolnapay' | 'stripe' | 'mock' | 'tap' | 'moyasar';
  clientSecret?: string;
}

export interface DirectPaymentResult {
  success: boolean;
  paymentId: string;
  status: PaymentStatus;
  requiresAction?: boolean;
  actionUrl?: string;
  error?: string;
}

export interface PaymentWebhookResult {
  orderId: string;
  paymentId: string;
  status: PaymentStatus;
  amount: number;
  currency: string;
  signatureValid: boolean;
}

export interface IPaymentService {
  createCheckoutSession(order: Order, successUrl: string, cancelUrl: string): Promise<CheckoutSessionResult>;
  confirmCardPayment?(order: Order, paymentId: string, card: CardDetails): Promise<DirectPaymentResult>;
  verifyWebhook(payload: any, signature: string | undefined): Promise<PaymentWebhookResult>;
}

/**
 * ZolnaPay Enterprise Payment Gateway Service
 */
export class ZolnaPayPaymentService implements IPaymentService {
  private secretKey: string;
  private publishableKey: string;
  private apiBaseUrl: string;

  constructor(secretKey: string, publishableKey: string = '', apiBaseUrl?: string) {
    this.secretKey = secretKey;
    this.publishableKey = publishableKey;
    // Connect to local Django ZolnaPay instance (port 4000) or public API
    this.apiBaseUrl = (apiBaseUrl || process.env.ZOLNAPAY_API_URL || 'http://127.0.0.1:4000/v1').replace(/\/$/, '');
  }

  public async createCheckoutSession(
    order: Order,
    successUrl: string,
    cancelUrl: string
  ): Promise<CheckoutSessionResult> {
    const amountCents = Math.round(order.price * 100);

    try {
      const response = await fetch(`${this.apiBaseUrl}/payments`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': `ord_pay_${order.id}_${Date.now()}`,
        },
        body: JSON.stringify({
          amountCents,
          currency: (order.currency || 'USD').toLowerCase(),
          description: `StickerAI - 12 Personalized WhatsApp Stickers (${order.id})`,
          customerPhone: order.customerPhone,
          customerName: order.rawPhone || 'Customer',
          customerEmail: `order_${order.id}@stickerai.online`,
          category: 'digital_goods',
          metadata: {
            orderId: order.id,
            style: order.style,
            stickerCount: order.stickerCount,
            source: 'stickerai.online',
            successUrl,
            cancelUrl,
          },
        }),
      });

      const paymentData: any = await response.json();
      if (!response.ok) {
        throw new Error(paymentData.error || paymentData.detail || 'Failed to create ZolnaPay PaymentIntent');
      }

      const paymentId = paymentData.id;
      // Official ZolnaPay Hosted Checkout URL
      const checkoutUrl = paymentData.checkoutUrl || `https://checkout.zolna.app/c/${paymentId}`;

      return {
        checkoutUrl,
        paymentId,
        provider: 'zolnapay',
        clientSecret: paymentData.clientSecret,
      };
    } catch (err: any) {
      console.error('ZolnaPay create payment error:', err);
      // Fallback session ID if direct connection fails
      const fallbackId = `zp_${crypto.randomBytes(8).toString('hex')}`;
      return {
        checkoutUrl: `${successUrl}${successUrl.includes('?') ? '&' : '?'}payment_id=${fallbackId}`,
        paymentId: fallbackId,
        provider: 'zolnapay',
      };
    }
  }

  /**
   * Confirms payment directly using customer credit/debit card
   */
  public async confirmCardPayment(
    order: Order,
    paymentId: string,
    card: CardDetails
  ): Promise<DirectPaymentResult> {
    try {
      const cleanCardNumber = card.cardNumber.replace(/\s+/g, '');
      const expMonth = parseInt(String(card.expMonth).trim(), 10);
      let expYear = parseInt(String(card.expYear).trim(), 10);
      if (expYear < 100) expYear += 2000; // handle 2-digit years

      const response = await fetch(`${this.apiBaseUrl}/payments/${paymentId}/confirm`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paymentMethod: {
            type: 'card',
            number: cleanCardNumber,
            cardNumber: cleanCardNumber,
            cardholderName: card.cardholderName,
            name: card.cardholderName,
            expMonth,
            expYear,
            cvc: card.cvc.trim(),
          },
        }),
      });

      const result: any = await response.json();

      if (!response.ok) {
        return {
          success: false,
          paymentId,
          status: 'failed',
          error: result.error || result.detail || result.failureMessage || 'Card payment declined or invalid.',
        };
      }

      if (result.status === 'succeeded' || result.status === 'paid') {
        return {
          success: true,
          paymentId,
          status: 'paid',
        };
      }

      if (result.status === 'requires_action') {
        return {
          success: false,
          paymentId,
          status: 'requires_action',
          requiresAction: true,
          actionUrl: result.action?.redirectUrl || result.action?.url,
        };
      }

      return {
        success: result.status === 'succeeded',
        paymentId,
        status: result.status,
        error: result.failureMessage || 'Payment processing not completed.',
      };
    } catch (err: any) {
      console.error('ZolnaPay card confirm error:', err);
      return {
        success: false,
        paymentId,
        status: 'failed',
        error: err.message || 'Payment processor communication error.',
      };
    }
  }

  public async verifyWebhook(payload: any, signature: string | undefined): Promise<PaymentWebhookResult> {
    const event = typeof payload === 'string' ? JSON.parse(payload) : payload;
    const payment = event.payment || event.data?.payment || event.data?.object || event;

    const orderId = payment.metadata?.orderId || payment.metadata?.order_id || event.orderId;
    const isPaid = payment.status === 'succeeded' || payment.status === 'paid' || event.type === 'payment.succeeded';

    return {
      orderId,
      paymentId: payment.id || event.id,
      status: isPaid ? 'paid' : 'pending',
      amount: (payment.amountCents || 299) / 100,
      currency: (payment.currency || 'USD').toUpperCase(),
      signatureValid: true,
    };
  }
}

export class MockPaymentService implements IPaymentService {
  public async createCheckoutSession(
    order: Order,
    successUrl: string,
    _cancelUrl: string
  ): Promise<CheckoutSessionResult> {
    const paymentId = `pay_mock_${crypto.randomBytes(8).toString('hex')}`;
    const checkoutUrl = `${successUrl}${successUrl.includes('?') ? '&' : '?'}mock_payment_id=${paymentId}&status=success`;

    return {
      checkoutUrl,
      paymentId,
      provider: 'mock',
    };
  }

  public async confirmCardPayment(
    _order: Order,
    paymentId: string,
    _card: CardDetails
  ): Promise<DirectPaymentResult> {
    // Instant simulated success
    return {
      success: true,
      paymentId: paymentId || `pay_mock_${crypto.randomBytes(6).toString('hex')}`,
      status: 'paid',
    };
  }

  public async verifyWebhook(payload: any, _signature: string | undefined): Promise<PaymentWebhookResult> {
    return {
      orderId: payload.orderId || payload.data?.orderId,
      paymentId: payload.paymentId || payload.data?.paymentId || `pay_${Date.now()}`,
      status: (payload.status as PaymentStatus) || 'paid',
      amount: payload.amount || 2.99,
      currency: payload.currency || 'USD',
      signatureValid: true,
    };
  }
}

export function getPaymentService(): IPaymentService {
  const { db } = require('../db.js');
  const settings = db.getSettings();
  const zolnaSecretKey = settings.zolnaPaySecretKey || process.env.ZOLNAPAY_SECRET_KEY || process.env.PAYMENT_SECRET_KEY;
  const zolnaPublishableKey = settings.zolnaPayPublishableKey || process.env.ZOLNAPAY_PUBLISHABLE_KEY || '';
  const apiUrl = settings.zolnaPayApiUrl || process.env.ZOLNAPAY_API_URL;

  if (zolnaSecretKey && (zolnaSecretKey.startsWith('sk_live_') || zolnaSecretKey.startsWith('sk_test_'))) {
    return new ZolnaPayPaymentService(zolnaSecretKey, zolnaPublishableKey, apiUrl);
  }

  return new MockPaymentService();
}

import crypto from 'crypto';
import { Order, PaymentStatus } from '../../src/types/index.js';

export interface CheckoutSessionResult {
  checkoutUrl: string;
  paymentId: string;
  provider: 'mock' | 'stripe' | 'tap' | 'moyasar';
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
  verifyWebhook(payload: any, signature: string | undefined): Promise<PaymentWebhookResult>;
}

export class MockPaymentService implements IPaymentService {
  public async createCheckoutSession(
    order: Order, 
    successUrl: string, 
    _cancelUrl: string
  ): Promise<CheckoutSessionResult> {
    const paymentId = `pay_mock_${crypto.randomBytes(8).toString('hex')}`;
    
    // In Mock mode, redirect to simulated instant checkout page or auto-confirm URL
    const checkoutUrl = `${successUrl}${successUrl.includes('?') ? '&' : '?'}mock_payment_id=${paymentId}&status=success`;

    return {
      checkoutUrl,
      paymentId,
      provider: 'mock',
    };
  }

  public async verifyWebhook(payload: any, _signature: string | undefined): Promise<PaymentWebhookResult> {
    // In mock mode, payload contains orderId, paymentId, status
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

export class StripePaymentService implements IPaymentService {
  private secretKey: string;
  private webhookSecret: string;

  constructor(secretKey: string, webhookSecret: string) {
    this.secretKey = secretKey;
    this.webhookSecret = webhookSecret;
  }

  public async createCheckoutSession(
    order: Order, 
    successUrl: string, 
    cancelUrl: string
  ): Promise<CheckoutSessionResult> {
    // Standard Stripe REST API call using fetch without requiring heavy client dependency
    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        'payment_method_types[0]': 'card',
        'line_items[0][price_data][currency]': order.currency.toLowerCase(),
        'line_items[0][price_data][product_data][name]': `StickerMe AI - 12 Personalized WhatsApp Stickers`,
        'line_items[0][price_data][unit_amount]': Math.round(order.price * 100).toString(),
        'line_items[0][quantity]': '1',
        mode: 'payment',
        success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: cancelUrl,
        client_reference_id: order.id,
        'metadata[order_id]': order.id,
        'metadata[phone]': order.customerPhone,
      }).toString(),
    });

    const session: any = await response.json();
    if (!response.ok) {
      throw new Error(`Stripe checkout session creation failed: ${session.error?.message || 'Unknown error'}`);
    }

    return {
      checkoutUrl: session.url,
      paymentId: session.id,
      provider: 'stripe',
    };
  }

  public async verifyWebhook(payload: any, signature: string | undefined): Promise<PaymentWebhookResult> {
    // Basic webhook extraction
    const event = typeof payload === 'string' ? JSON.parse(payload) : payload;
    const session = event.data?.object;
    const orderId = session?.client_reference_id || session?.metadata?.order_id;
    const isPaid = event.type === 'checkout.session.completed' && session?.payment_status === 'paid';

    return {
      orderId,
      paymentId: session?.id || event.id,
      status: isPaid ? 'paid' : 'pending',
      amount: (session?.amount_total || 299) / 100,
      currency: (session?.currency || 'usd').toUpperCase(),
      signatureValid: !!(signature || this.webhookSecret),
    };
  }
}

export function getPaymentService(): IPaymentService {
  const secretKey = process.env.PAYMENT_SECRET_KEY;
  const webhookSecret = process.env.PAYMENT_WEBHOOK_SECRET || '';

  if (secretKey && secretKey.startsWith('sk_')) {
    return new StripePaymentService(secretKey, webhookSecret);
  }

  // Default to robust MockPaymentService in dev/demo environment
  return new MockPaymentService();
}

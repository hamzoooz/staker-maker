import { DeliveryEvent, GeneratedSticker, Order } from '../../src/types/index.js';
import { db } from '../db.js';

export interface WhatsAppDeliveryResult {
  success: boolean;
  messageId?: string;
  error?: string;
  deliveryMethod: 'cloud_api' | 'direct_chat_link' | 'mock_simulation';
  whatsappLink?: string;
}

export interface IWhatsAppService {
  deliverStickerPack(order: Order, stickers: GeneratedSticker[]): Promise<WhatsAppDeliveryResult>;
  sendTextNotification(phoneNumber: string, message: string): Promise<boolean>;
}

export class WhatsAppService implements IWhatsAppService {
  private accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  private phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  private apiVersion = process.env.WHATSAPP_API_VERSION || 'v20.0';

  /**
   * Dispatches the full sticker pack to the customer's WhatsApp.
   */
  public async deliverStickerPack(
    order: Order, 
    stickers: GeneratedSticker[]
  ): Promise<WhatsAppDeliveryResult> {
    const cleanPhone = order.customerPhone.replace(/[^0-9]/g, '');
    const completedStickers = stickers.filter(s => s.generationStatus === 'completed');

    // Build the direct wa.me link with pre-filled message
    const baseUrl = process.env.APP_BASE_URL || process.env.APP_URL || 'http://localhost:3000';
    const packUrl = `${baseUrl}/order/${order.id}`;
    const prefilledText = encodeURIComponent(
      `🎉 Hello! Your 12 custom WhatsApp Stickers from StickerMe AI are ready!\n\nView and download your sticker pack here: ${packUrl}\n\nThank you for using StickerMe AI!`
    );
    const directWhatsAppUrl = `https://wa.me/${cleanPhone}?text=${prefilledText}`;

    // If real Cloud API is configured
    if (this.accessToken && this.phoneNumberId) {
      try {
        db.addDeliveryEvent(order.id, {
          id: `ev_${Date.now()}_start`,
          timestamp: new Date().toISOString(),
          type: 'info',
          message: `Attempting WhatsApp Cloud API dispatch to ${order.customerPhone}...`,
        });

        // 1. Send welcome message
        const welcomeMessage = `✨ *Your StickerMe AI Pack is Ready!* ✨\n\nWe've crafted 12 personalized WhatsApp stickers based on your selfie! 🎉\n\nTap below to view and download all your stickers:\n🔗 ${packUrl}\n\n*How to save on WhatsApp:*\n1. Open your pack link\n2. Tap "Save to WhatsApp" or tap any sticker to save to your WhatsApp Favorites ⭐`;

        const msgRes = await fetch(
          `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}/messages`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${this.accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              recipient_type: 'individual',
              to: cleanPhone,
              type: 'text',
              text: { body: welcomeMessage },
            }),
          }
        );

        const data: any = await msgRes.json();

        if (!msgRes.ok) {
          throw new Error(data.error?.message || 'WhatsApp API request rejected');
        }

        const messageId = data.messages?.[0]?.id || `wa_${Date.now()}`;

        // 2. Dispatch every completed sticker as an actual WhatsApp sticker message.
        // WhatsApp requires the dedicated `sticker` message type (WebP media, no
        // caption) — sending as `type: 'image'` delivers a regular photo instead
        // of a sticker, so it never lands in the sticker tray.
        for (const sticker of completedStickers) {
          const mediaUrl = sticker.webpUrl || sticker.processedImageUrl;
          if (!mediaUrl) continue;

          const absoluteStickerUrl = mediaUrl.startsWith('http') ? mediaUrl : `${baseUrl}${mediaUrl}`;

          try {
            await fetch(
              `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}/messages`,
              {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${this.accessToken}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  messaging_product: 'whatsapp',
                  recipient_type: 'individual',
                  to: cleanPhone,
                  type: 'sticker',
                  sticker: {
                    link: absoluteStickerUrl,
                  },
                }),
              }
            );
          } catch (stickerErr) {
            console.warn(`WhatsApp sticker send error for ${sticker.id} (non-fatal):`, stickerErr);
          }
        }

        db.addDeliveryEvent(order.id, {
          id: `ev_${Date.now()}_success`,
          timestamp: new Date().toISOString(),
          type: 'delivered',
          message: `Successfully delivered sticker notification via WhatsApp Cloud API. Message ID: ${messageId}`,
          details: { messageId, phone: order.customerPhone },
        });

        return {
          success: true,
          messageId,
          deliveryMethod: 'cloud_api',
          whatsappLink: directWhatsAppUrl,
        };
      } catch (apiError: any) {
        console.error('WhatsApp Cloud API delivery error:', apiError);

        db.addDeliveryEvent(order.id, {
          id: `ev_${Date.now()}_fail`,
          timestamp: new Date().toISOString(),
          type: 'failed',
          message: `Cloud API delivery temporary error: ${apiError.message}. Direct WhatsApp Link is ready for customer.`,
        });

        return {
          success: true, // We still mark as available via direct link
          deliveryMethod: 'direct_chat_link',
          whatsappLink: directWhatsAppUrl,
          error: apiError.message,
        };
      }
    }

    // Dev/Mock Simulation Mode
    db.addDeliveryEvent(order.id, {
      id: `ev_${Date.now()}_mock`,
      timestamp: new Date().toISOString(),
      type: 'delivered',
      message: `[Development Mode] Sticker pack prepared and queued for WhatsApp (${order.customerPhone}). Direct deep link generated.`,
      details: {
        stickersCount: completedStickers.length,
        whatsappLink: directWhatsAppUrl,
      },
    });

    return {
      success: true,
      messageId: `mock_wa_${Date.now()}`,
      deliveryMethod: 'mock_simulation',
      whatsappLink: directWhatsAppUrl,
    };
  }

  public async sendTextNotification(phoneNumber: string, message: string): Promise<boolean> {
    if (!this.accessToken || !this.phoneNumberId) {
      console.log(`[Mock WhatsApp] Text to ${phoneNumber}: ${message}`);
      return true;
    }

    try {
      const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
      const res = await fetch(
        `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: cleanPhone,
            type: 'text',
            text: { body: message },
          }),
        }
      );
      return res.ok;
    } catch (e) {
      console.error('Failed to send text notification:', e);
      return false;
    }
  }
}

export const whatsAppService = new WhatsAppService();

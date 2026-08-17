export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';

export type GenerationStatus = 
  | 'queued' 
  | 'analyzing_photo' 
  | 'creating_character' 
  | 'generating_stickers' 
  | 'processing_images' 
  | 'packaging' 
  | 'completed' 
  | 'failed';

export type DeliveryStatus = 'pending' | 'sending' | 'delivered' | 'failed';

export type StickerStyleId = 
  | 'fun_expressive' 
  | 'cartoon' 
  | 'cute' 
  | 'professional' 
  | 'anime' 
  | '3d_character' 
  | 'meme_style' 
  | 'surprise_me';

export interface StickerStyle {
  id: StickerStyleId;
  name: string;
  nameAr?: string;
  description: string;
  descriptionAr?: string;
  badge?: string;
  promptModifier: string;
  previewColor: string;
  sampleEmoji: string;
}

export type ExpressionId = 
  | 'happy'
  | 'laughing'
  | 'love'
  | 'thumbs_up'
  | 'angry'
  | 'sad'
  | 'surprised'
  | 'thinking'
  | 'sleepy'
  | 'celebrating'
  | 'thank_you'
  | 'facepalm';

export interface StickerExpressionDef {
  id: ExpressionId;
  name: string;
  nameAr?: string;
  description: string;
  actionPrompt: string;
  bubbleText?: string;
  bubbleTextAr?: string;
  emoji: string;
}

export interface GeneratedSticker {
  id: string;
  orderId: string;
  sequence: number;
  expression: ExpressionId;
  expressionName: string;
  bubbleText?: string;
  originalImageUrl?: string;
  processedImageUrl: string;
  generationStatus: 'pending' | 'generating' | 'completed' | 'failed';
  retryCount: number;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Order {
  id: string;
  customerPhone: string; // Normalized E.164 e.g. +97455123456
  countryCode: string; // e.g. QA
  rawPhone: string;
  photoUrl: string;
  canonicalCharacterUrl?: string;
  style: StickerStyleId;
  packageId: string;
  stickerCount: number;
  price: number; // 2.99
  currency: string; // USD
  paymentStatus: PaymentStatus;
  paymentId?: string;
  paymentMethod?: string;
  generationStatus: GenerationStatus;
  generationProgress: {
    total: number;
    completed: number;
    currentExpression?: string;
  };
  deliveryStatus: DeliveryStatus;
  deliveryEvents: DeliveryEvent[];
  error?: string;
  adminNotes?: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
}

export interface DeliveryEvent {
  id: string;
  timestamp: string;
  type: 'info' | 'sent' | 'delivered' | 'failed' | 'retry';
  message: string;
  details?: Record<string, unknown>;
}

export interface CountryCodeItem {
  name: string;
  nameAr?: string;
  code: string; // ISO 2
  dialCode: string; // +974
  flag: string;
  formatPlaceholder: string;
}

export interface StickerPackage {
  id: string;
  name: string;
  stickersCount: number;
  price: number;
  currency: string;
  isPopular?: boolean;
  isActive: boolean;
}

import React, { useEffect, useState } from 'react';
import { 
  CheckCircle2, 
  Clock, 
  Sparkles, 
  MessageCircle, 
  Download, 
  ExternalLink, 
  RefreshCw, 
  AlertCircle, 
  ShieldCheck, 
  Phone, 
  ArrowLeft,
  Loader2,
  Share2,
  CreditCard,
  Lock
} from 'lucide-react';
import { GeneratedSticker, Order } from '../types/index.js';
import { CardPaymentModal } from './CardPaymentModal.js';

interface OrderStatusViewProps {
  orderId: string;
  lang: 'en' | 'ar';
  onBackToHome: () => void;
}

export const OrderStatusView: React.FC<OrderStatusViewProps> = ({
  orderId,
  lang,
  onBackToHome,
}) => {
  const [order, setOrder] = useState<Order | null>(null);
  const [stickers, setStickers] = useState<GeneratedSticker[]>([]);
  const [whatsappLink, setWhatsappLink] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSimulatingPayment, setIsSimulatingPayment] = useState(false);
  const [isRetryingSticker, setIsRetryingSticker] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCardModalOpen, setIsCardModalOpen] = useState(false);

  // Poll order status
  const fetchStatus = async () => {
    try {
      const res = await fetch(`/api/orders/${orderId}/status`);
      if (!res.ok) {
        throw new Error('Order not found or error loading status.');
      }
      const data = await res.json();
      setOrder(data.order);
      setStickers(data.stickers || []);
      setWhatsappLink(data.whatsappLink || '');
      setError(null);
    } catch (err: any) {
      console.error('Fetch status error:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    // Poll every 3 seconds while generation is in progress
    const interval = setInterval(() => {
      if (order && order.generationStatus === 'completed' && order.deliveryStatus === 'delivered') {
        return; // stop polling once completed
      }
      fetchStatus();
    }, 3000);

    return () => clearInterval(interval);
  }, [orderId]);

  // Simulate payment (useful for instant dev/demo workflow)
  const handleSimulatePayment = async () => {
    setIsSimulatingPayment(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/simulate-payment`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Payment simulation failed');
      await fetchStatus();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSimulatingPayment(false);
    }
  };

  // Retry individual sticker
  const handleRetrySticker = async (stickerId: string) => {
    setIsRetryingSticker(stickerId);
    try {
      const res = await fetch(`/api/orders/${orderId}/retry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stickerId }),
      });
      if (!res.ok) throw new Error('Retry failed');
      await fetchStatus();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsRetryingSticker(null);
    }
  };

  // Download individual sticker
  const handleDownloadSticker = (stickerUrl: string, name: string) => {
    const a = document.createElement('a');
    a.href = stickerUrl;
    a.download = `StickerAI_${name.replace(/\s+/g, '_')}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Batch download all completed stickers (PNG)
  const handleDownloadAll = () => {
    stickers
      .filter((s) => s.generationStatus === 'completed' && s.processedImageUrl)
      .forEach((s, idx) => {
        setTimeout(() => {
          handleDownloadSticker(s.processedImageUrl, `${idx + 1}_${s.expressionName}`);
        }, idx * 250);
      });
  };

  // Share actual sticker file directly to WhatsApp as native WebP sticker
  const handleShareStickerDirectly = async (stickerUrl: string, name: string, webpUrl?: string) => {
    const targetUrl = webpUrl || stickerUrl;
    const isWebp = !!webpUrl || targetUrl.endsWith('.webp');
    const mimeType = isWebp ? 'image/webp' : 'image/png';
    const ext = isWebp ? 'webp' : 'png';

    try {
      const res = await fetch(targetUrl);
      const blob = await res.blob();
      const file = new File([blob], `${name.replace(/\s+/g, '_')}.${ext}`, { type: mimeType });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'WhatsApp Sticker - StickerAI',
          text: `✨ صُنع بواسطة منصة stickerai.online`,
        });
      } else {
        // Fallback: Copy image to clipboard for direct pasting into WhatsApp Web / Desktop
        try {
          const pngRes = await fetch(stickerUrl);
          const pngBlob = await pngRes.blob();
          await navigator.clipboard.write([
            new ClipboardItem({
              'image/png': pngBlob,
            }),
          ]);
          alert(lang === 'en' ? 'Sticker copied to clipboard! You can now paste it directly into WhatsApp!' : 'تم نسخ الملصق! يمكنك الآن لصقه مباشرة (Paste) في محادثة واتساب!');
        } catch {
          handleDownloadSticker(targetUrl, `${name}.${ext}`);
        }
      }
    } catch (e) {
      console.warn('Direct share error:', e);
      handleDownloadSticker(targetUrl, `${name}.${ext}`);
    }
  };

  // Share all completed stickers at once via the native share sheet — this
  // attaches the actual sticker files to WhatsApp, unlike the wa.me deep link
  // below which can only pre-fill a text message with a URL, not media.
  const handleShareAllStickersDirectly = async () => {
    const completed = stickers.filter((s) => s.generationStatus === 'completed' && s.processedImageUrl);

    try {
      const files = await Promise.all(
        completed.map(async (s, idx) => {
          const targetUrl = s.webpUrl || s.processedImageUrl;
          const isWebp = !!s.webpUrl || targetUrl.endsWith('.webp');
          const res = await fetch(targetUrl);
          const blob = await res.blob();
          return new File([blob], `${idx + 1}_${s.expressionName.replace(/\s+/g, '_')}.${isWebp ? 'webp' : 'png'}`, {
            type: isWebp ? 'image/webp' : 'image/png',
          });
        })
      );

      if (navigator.canShare && navigator.canShare({ files })) {
        await navigator.share({
          files,
          title: 'WhatsApp Stickers - StickerAI',
          text: `✨ صُنع بواسطة منصة stickerai.online`,
        });
        return;
      }
    } catch (e) {
      console.warn('Share-all error, falling back to chat link:', e);
    }

    // Fallback: open WhatsApp with the pack link if native multi-file share isn't supported.
    if (whatsappLink) {
      window.open(whatsappLink, '_blank');
    }
  };

  if (isLoading && !order) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
        <Loader2 className="w-10 h-10 text-emerald-600 animate-spin mb-4" />
        <h3 className="text-lg font-bold text-slate-900">
          {lang === 'en' ? 'Loading your sticker order...' : 'جاري تحميل تفاصيل الطلب...'}
        </h3>
        <p className="text-xs text-slate-500 mt-1">Order ID: {orderId}</p>
      </div>
    );
  }

  if (error && !order) {
    return (
      <div className="max-w-md mx-auto my-16 p-8 bg-white rounded-3xl border border-rose-200 text-center space-y-4 shadow-xl">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
        <h3 className="text-xl font-bold text-slate-900">
          {lang === 'en' ? 'Order Not Found' : 'لم يتم العثور على الطلب'}
        </h3>
        <p className="text-sm text-slate-600">{error}</p>
        <button
          onClick={onBackToHome}
          className="px-6 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 transition-colors"
        >
          {lang === 'en' ? 'Back to Homepage' : 'العودة للرئيسية'}
        </button>
      </div>
    );
  }

  if (!order) return null;

  const isPaid = order.paymentStatus === 'paid';
  const isCompleted = order.generationStatus === 'completed';
  const completedStickersCount = stickers.filter((s) => s.generationStatus === 'completed').length;
  const totalStickersForProgress = order.stickerCount || stickers.length || 12;
  // Reflect actual sticker-by-sticker progress during generation instead of a flat
  // per-status bucket — otherwise the bar sits frozen for the several minutes it
  // takes to generate 12 stickers, which reads as stuck even when it isn't.
  const progressPercent = isCompleted
    ? 100
    : order.generationStatus === 'packaging'
    ? 95
    : order.generationStatus === 'generating_stickers' || order.generationStatus === 'processing_images'
    ? 15 + Math.round((completedStickersCount / totalStickersForProgress) * 80)
    : order.generationStatus === 'creating_character'
    ? 10
    : order.generationStatus === 'analyzing_photo'
    ? 5
    : 0;

  const stages = [
    {
      id: 'payment',
      title: lang === 'en' ? 'Payment confirmed' : 'تأكيد الدفع',
      isDone: isPaid,
      isActive: !isPaid,
      note: isPaid ? `$${order.price} ${order.currency}` : (lang === 'en' ? 'Pending payment' : 'في انتظار الدفع'),
    },
    {
      id: 'photo',
      title: lang === 'en' ? 'Photo received' : 'استلام الصورة',
      isDone: isPaid,
      isActive: false,
      note: lang === 'en' ? 'Selfie uploaded & face detected' : 'تم رفع السيلفي وقص الوجه',
    },
    {
      id: 'character',
      title: lang === 'en' ? 'Creating your character' : 'بناء الهوية البصرية للشخصية',
      isDone: order.generationStatus !== 'queued' && order.generationStatus !== 'analyzing_photo',
      isActive: order.generationStatus === 'analyzing_photo' || order.generationStatus === 'creating_character',
      note: lang === 'en' ? 'Facial identity anchor configured' : 'تثبيت ملامح الوجه والشعر',
    },
    {
      id: 'stickers',
      title: lang === 'en' ? 'Generating 12 stickers' : 'توليد ١٢ ملصقاً',
      isDone: isCompleted || completedStickersCount >= 1,
      isActive: order.generationStatus === 'generating_stickers' || order.generationStatus === 'processing_images',
      note: order.generationProgress?.currentExpression || (lang === 'en' ? 'Creating 12 unique expressions' : 'إنشاء ١٢ تعبيراً فريداً مخصصاً'),
    },
    {
      id: 'packaging',
      title: lang === 'en' ? 'Preparing your stickers' : 'تجهيز ملصقاتك',
      isDone: isCompleted,
      isActive: order.generationStatus === 'packaging',
      note: lang === 'en' ? 'Converting and saving stickers' : 'تحسين وحفظ صيغ الملصقات',
    },
    {
      id: 'delivery',
      title: lang === 'en' ? 'Sending to WhatsApp' : 'الإرسال إلى واتساب',
      isDone: order.deliveryStatus === 'delivered',
      isActive: order.deliveryStatus === 'sending',
      note: order.customerPhone,
    },
  ];

  return (
    <div className="py-12 bg-slate-50 min-h-screen">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-8">
        
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <button
            onClick={onBackToHome}
            className="inline-flex items-center space-x-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{lang === 'en' ? 'Create New Stickers' : 'إنشاء ملصقات جديدة'}</span>
          </button>

          <div className="flex items-center space-x-2">
            <span className="text-xs font-mono text-slate-500">Order #{order.id}</span>
            <button
              onClick={fetchStatus}
              className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-slate-900 transition-colors"
              title="Refresh status"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* STATUS HERO CARD */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-md border border-slate-200 space-y-6">
          
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
            <div>
              <div className="flex items-center space-x-2">
                {isCompleted ? (
                  <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold flex items-center space-x-1 border border-emerald-200">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{lang === 'en' ? 'Your Stickers Are Ready!' : 'ملصقاتك جاهزة الآن!'}</span>
                  </span>
                ) : isPaid ? (
                  <span className="px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold flex items-center space-x-1 border border-indigo-200">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600 animate-spin" />
                    <span>{lang === 'en' ? 'AI sticker generation in progress' : 'جاري توليد الملصقات بالذكاء الاصطناعي'}</span>
                  </span>
                ) : (
                  <span className="px-3 py-1 rounded-full bg-amber-50 text-amber-800 text-xs font-bold flex items-center space-x-1 border border-amber-200">
                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                    <span>{lang === 'en' ? 'Awaiting Payment Confirmation' : 'في انتظار تأكيد الدفع'}</span>
                  </span>
                )}
              </div>

              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-2">
                {isCompleted
                  ? (lang === 'en' ? '12 AI Stickers Created Successfully!' : 'تم إنشاء الـ ١٢ ملصقاً بنجاح!')
                  : isPaid
                  ? (lang === 'en' ? '12 AI Stickers Generation in Progress' : 'جاري إنشاء الـ ١٢ ملصقاً بالذكاء الاصطناعي...')
                  : (lang === 'en' ? 'Complete Payment to Begin Generation' : 'أكمل الدفع لبدء إنشاء الملصقات')}
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 flex items-center space-x-2">
                <span>{lang === 'en' ? 'Destination WhatsApp:' : 'رقم الواتساب المستلم:'}</span>
                <span className="font-mono font-bold text-slate-800">{order.customerPhone}</span>
              </p>
            </div>

            {/* Price badge */}
            <div className="bg-slate-50 px-5 py-3 rounded-2xl border border-slate-200 text-right shrink-0">
              <span className="text-xs font-semibold text-slate-500 block">
                {lang === 'en' ? 'Package Price' : 'سعر الحزمة'}
              </span>
              <span className="text-2xl font-black text-slate-900">${order.price} USD</span>
            </div>
          </div>

          {/* Pending Payment Card (With Direct Card Payment via ZolnaPay) */}
          {!isPaid && (
            <div className="p-6 sm:p-8 rounded-2xl bg-gradient-to-br from-indigo-50/90 via-slate-50 to-emerald-50/60 border border-indigo-200 space-y-6 shadow-xs">
              <div className="flex items-start space-x-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-md">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h4 className="font-black text-base sm:text-lg text-slate-900">
                    {lang === 'en' ? 'Instant Card Payment ($2.99 USD)' : 'الدفع الفوري بالبطاقة البنكية (2.99$ دولار)'}
                  </h4>
                  <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
                    {lang === 'en' 
                      ? 'Pay directly using your credit or debit card. Protected by ZolnaPay Enterprise 256-bit encryption.'
                      : 'ادفع بأمان وسرعة عبر بطاقتك الائتمانية أو مدى مع تشفير ZolnaPay العالي.'}
                  </p>
                </div>
              </div>

              {/* Direct Card Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <a
                  href={order.paymentId && !order.paymentId.startsWith('sim_') ? `https://checkout.zolna.app/c/${order.paymentId}` : '#'}
                  onClick={async (e) => {
                    if (!order.paymentId || order.paymentId.startsWith('sim_')) {
                      e.preventDefault();
                      try {
                        const res = await fetch(`/api/orders/${order.id}/checkout`, { method: 'POST' });
                        const data = await res.json();
                        if (data.checkoutUrl) window.location.href = data.checkoutUrl;
                      } catch (err) {
                        console.error('Checkout error:', err);
                      }
                    }
                  }}
                  className="py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-[0.99] text-white font-black text-sm sm:text-base shadow-xl shadow-emerald-600/25 flex items-center justify-center space-x-2 cursor-pointer transition-all text-center"
                >
                  <CreditCard className="w-5 h-5" />
                  <span>{lang === 'en' ? `Pay $${order.price || 1.19} with ZolnaPay Gateway` : `دفع $${order.price || 1.19} عبر بوابة ZolnaPay الآمنة`}</span>
                </a>

                <button
                  onClick={handleSimulatePayment}
                  disabled={isSimulatingPayment}
                  className="py-4 px-6 rounded-2xl bg-slate-900 hover:bg-slate-800 active:scale-[0.99] text-white font-extrabold text-xs sm:text-sm shadow-md flex items-center justify-center space-x-2 cursor-pointer transition-all disabled:opacity-60"
                >
                  {isSimulatingPayment ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  )}
                  <span>{lang === 'en' ? 'Simulate Payment (Instant Test)' : 'محاكاة دفع فوري (وضع الاختبار)'}</span>
                </button>
              </div>

              {/* Security badges */}
              <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-slate-500 pt-2 border-t border-indigo-100/60">
                <span className="flex items-center space-x-1">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>PCI-DSS Level 1 Compliant</span>
                </span>
                <span>•</span>
                <span>ZolnaPay Secured</span>
                <span>•</span>
                <span>Visa / Mastercard / AMEX</span>
              </div>
            </div>
          )}

          {/* Progress bar */}
          {isPaid && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                <span>{lang === 'en' ? 'Generation Progress' : 'نسبة الإنجاز'}</span>
                <span className="text-indigo-600 font-extrabold">{progressPercent}% {lang === 'en' ? 'Completed' : 'مكتمل'}</span>
              </div>
              <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-600 to-emerald-500 transition-all duration-500 rounded-full"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              {!isCompleted && (
                <p className="text-[11px] text-slate-400 pt-0.5">
                  {lang === 'en'
                    ? 'Crafting each expression individually usually takes a few minutes — feel free to leave this page open.'
                    : 'صنع كل تعبير يدويًا يستغرق عادة بضع دقائق — يمكنك ترك هذه الصفحة مفتوحة والعودة لاحقًا.'}
                </p>
              )}
            </div>
          )}

          {/* Real-time Progress Stages */}
          <div className="space-y-3 pt-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              {lang === 'en' ? 'Order Pipeline Stages' : 'مراحل تنفيذ الطلب'}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {stages.map((st) => (
                <div
                  key={st.id}
                  className={`p-3.5 rounded-2xl border flex items-center space-x-3 transition-all ${
                    st.isDone
                      ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                      : st.isActive
                      ? 'bg-indigo-50/80 border-indigo-200 text-indigo-950 ring-2 ring-indigo-200'
                      : 'bg-slate-50/60 border-slate-200 text-slate-400'
                  }`}
                >
                  <div className="shrink-0">
                    {st.isDone ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    ) : st.isActive ? (
                      <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
                    ) : (
                      <div className="w-5 h-5 rounded-full border-2 border-slate-300" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold truncate">{st.title}</p>
                    <p className="text-[11px] opacity-75 truncate">{st.note}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* COMPLETED STICKERS GRID / SHEET */}
        {isPaid && stickers.length > 0 && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-md border border-slate-200 space-y-6">
            
            {/* Sheet View */}
            {stickers.some(s => s.expression === 'sheet') ? (
              (() => {
                const sheetSticker = stickers.find(s => s.expression === 'sheet')!;
                const isSheetCompleted = sheetSticker.generationStatus === 'completed' && sheetSticker.processedImageUrl;
                return (
                  <div className="space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <h3 className="text-xl font-extrabold text-slate-900">
                          {lang === 'en' ? 'Your AI Expression Sticker Sheet' : 'لوحة الملصقات الذكية الخاصة بك'}
                        </h3>
                        <p className="text-xs text-slate-500">
                          {lang === 'en' 
                            ? 'High-quality professional sticker sheet containing 24-30 reactions'
                            : 'لوحة ملصقات احترافية عالية الجودة تحتوي على ٢٤-٣٠ تعبير مخصص'}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {isSheetCompleted && (
                          <>
                            <a
                              href={sheetSticker.processedImageUrl}
                              download={`StickerAI_Sheet_${order.id}.png`}
                              className="inline-flex items-center space-x-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md transition-colors cursor-pointer"
                            >
                              <Download className="w-4 h-4" />
                              <span>{lang === 'en' ? 'Download PNG' : 'تحميل صورة PNG'}</span>
                            </a>

                            {sheetSticker.webpUrl && (
                              <a
                                href={sheetSticker.webpUrl}
                                download={`StickerAI_Sheet_${order.id}.webp`}
                                className="inline-flex items-center space-x-1.5 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-md transition-colors cursor-pointer"
                              >
                                <Download className="w-4 h-4" />
                                <span>{lang === 'en' ? 'Download WebP' : 'تحميل صورة WebP'}</span>
                              </a>
                            )}
                          </>
                        )}

                        {/* Customer Regenerate Button */}
                        {isCompleted && (
                          <button
                            onClick={async () => {
                              setIsLoading(true);
                              try {
                                const res = await fetch(`/api/orders/${orderId}/retry`, {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({}), // Empty body triggers full order regeneration
                                });
                                if (!res.ok) throw new Error('Regeneration failed');
                                fetchStatus();
                              } catch (err: any) {
                                setError(err.message);
                              } finally {
                                setIsLoading(false);
                              }
                            }}
                            className="inline-flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors cursor-pointer border border-slate-200"
                          >
                            <RefreshCw className="w-4 h-4 text-slate-600" />
                            <span>{lang === 'en' ? 'Regenerate Sheet' : 'إعادة توليد اللوحة'}</span>
                          </button>
                        )}
                        
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(window.location.href);
                            alert(lang === 'en' ? 'Pack link copied to clipboard!' : 'تم نسخ رابط حزمة الملصقات!');
                          }}
                          className="inline-flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors cursor-pointer border border-slate-200"
                        >
                          <Share2 className="w-4 h-4 text-slate-600" />
                          <span>{lang === 'en' ? 'Share Pack' : 'مشاركة الحزمة'}</span>
                        </button>
                      </div>
                    </div>

                    {/* How to use */}
                    <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-indigo-50 border border-emerald-200/80 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4 shadow-sm">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-md">
                        <MessageCircle className="w-6 h-6" />
                      </div>
                      <div className="flex-1 space-y-1">
                        <h4 className="text-sm font-extrabold text-slate-900">
                          {lang === 'en' ? '⭐ WhatsApp Sticker Pack Use:' : '⭐ استخدام لوحة ملصقات واتساب:'}
                        </h4>
                        <p className="text-xs text-slate-600 leading-relaxed">
                          {lang === 'en'
                            ? 'Your face was automatically validated, cropped, and turned into this unified 24-30 expressions sticker sheet. Download the image to share with your friends, or upload it to your favorite sticker maker app!'
                            : 'تم التحقق من صورتك وقص وجهك تلقائياً لتوليد هذه اللوحة الموحدة من ٢٤-٣٠ تعبيراً. حمّل الصورة لمشاركتها مع أصدقائك أو ارفعها في تطبيق الملصقات المفضل لديك!'}
                        </p>
                      </div>
                    </div>

                    {/* Main Sticker Sheet Preview */}
                    <div className="w-full relative rounded-2xl border border-slate-200 bg-slate-100 overflow-hidden flex items-center justify-center p-2 shadow-xs group">
                      {isSheetCompleted ? (
                        <div className="relative w-full max-h-[600px] overflow-hidden flex items-center justify-center">
                          <img
                            src={sheetSticker.processedImageUrl}
                            alt="Sticker Sheet"
                            className="w-full max-h-[550px] object-contain rounded-xl shadow-lg hover:scale-[1.01] transition-transform duration-300"
                          />
                        </div>
                      ) : (
                        <div className="py-20 flex flex-col items-center justify-center text-slate-400 space-y-3">
                          <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
                          <span className="text-xs font-black">
                            {lang === 'en' ? 'Generating your custom sticker sheet...' : 'جاري توليد لوحة ملصقاتك الخاصة...'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()
            ) : (
              /* Fallback Grid View for older orders */
              <>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-extrabold text-slate-900">
                      {lang === 'en' ? 'Your 12 Personalized Stickers' : 'حزمة الـ 12 ملصقاً الخاصة بك'}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {lang === 'en' 
                        ? 'Preview, download individually, or save all directly to WhatsApp'
                        : 'استعرض الملصقات وحمّلها فراداً أو احفظها جميعاً على هاتفك'}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {isCompleted && (
                      <>
                        <button
                          onClick={() => {
                            stickers
                              .filter((s) => s.generationStatus === 'completed')
                              .forEach((s, idx) => {
                                setTimeout(() => {
                                  const url = s.webpUrl || s.processedImageUrl;
                                  const ext = s.webpUrl ? 'webp' : 'png';
                                  const a = document.createElement('a');
                                  a.href = url;
                                  a.download = `WhatsApp_Sticker_${idx + 1}_${s.expressionName}.${ext}`;
                                  document.body.appendChild(a);
                                  a.click();
                                  document.body.removeChild(a);
                                }, idx * 200);
                              });
                          }}
                          className="inline-flex items-center space-x-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md transition-colors cursor-pointer"
                        >
                          <Download className="w-4 h-4" />
                          <span>{lang === 'en' ? 'Download WhatsApp Stickers (.webp)' : 'تحميل ملصقات واتساب (.webp)'}</span>
                        </button>

                        <button
                          onClick={handleDownloadAll}
                          className="inline-flex items-center space-x-1.5 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-md transition-colors cursor-pointer"
                        >
                          <Download className="w-4 h-4" />
                          <span>{lang === 'en' ? 'Download PNG' : 'تحميل صور PNG'}</span>
                        </button>
                      </>
                    )}
                    
                    {(whatsappLink || completedStickersCount > 0) && (
                      <button
                        onClick={handleShareAllStickersDirectly}
                        className="inline-flex items-center space-x-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-extrabold shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
                      >
                        <MessageCircle className="w-4 h-4" />
                        <span>{lang === 'en' ? 'Send All to WhatsApp' : 'إرسال الكل إلى واتساب'}</span>
                      </button>
                    )}

                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(window.location.href);
                        alert(lang === 'en' ? 'Pack link copied to clipboard!' : 'تم نسخ رابط حزمة الملصقات!');
                      }}
                      className="inline-flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors cursor-pointer"
                    >
                      <Share2 className="w-4 h-4 text-slate-600" />
                      <span>{lang === 'en' ? 'Share Pack' : 'مشاركة الحزمة'}</span>
                    </button>
                  </div>
                </div>

                {/* Quick Guide: How to save to WhatsApp Keyboard */}
                <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-indigo-50 border border-emerald-200/80 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4 shadow-sm">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-md">
                    <MessageCircle className="w-6 h-6" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <h4 className="text-sm font-extrabold text-slate-900">
                      {lang === 'en' ? '⭐ How to save to your WhatsApp Sticker Tray in 1 Tap:' : '⭐ كيفية إضافة الملصقات إلى لوحة ملصقات واتساب بنقرة واحدة:'}
                    </h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {lang === 'en'
                        ? '1. Tap "Send All to WhatsApp" and pick a chat • 2. In your WhatsApp chat, tap any sticker • 3. Choose "Add to Favorites ⭐" to permanently save it to your WhatsApp keyboard!'
                        : '1. اضغط على زر "إرسال الكل إلى واتساب" واختر المحادثة • 2. داخل محادثة الواتساب اضغط على الستيكر • 3. اختر "إضافة إلى المفضلة ⭐" ليتم حفظه فوراً في لوحة ملصقات واتساب واستخدامه دائماً!'}
                    </p>
                  </div>
                </div>

                {/* Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {stickers.map((stk, idx) => (
                    <div
                      key={stk.id || idx}
                      className="group relative bg-slate-50 rounded-2xl p-4 border border-slate-200 flex flex-col items-center justify-between hover:shadow-lg transition-all"
                    >
                      <div className="w-full aspect-square relative rounded-xl overflow-hidden bg-white/80 flex items-center justify-center p-2">
                        {stk.processedImageUrl ? (
                          <img
                            src={stk.processedImageUrl}
                            alt={stk.expressionName}
                            className="w-full h-full object-contain drop-shadow-md group-hover:scale-105 transition-transform duration-200"
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center text-slate-400 space-y-2">
                            <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                            <span className="text-[10px] font-bold">Creating...</span>
                          </div>
                        )}
                      </div>

                      <div className="w-full text-center mt-3">
                        <span className="text-xs font-bold text-slate-900 block truncate">
                          {stk.expressionName}
                        </span>
                        {stk.processedImageUrl && (
                          <div className="space-y-1.5 mt-2 w-full">
                            <button
                              onClick={() => handleShareStickerDirectly(stk.processedImageUrl!, stk.expressionName, stk.webpUrl)}
                              className="w-full text-[11px] bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold py-1.5 px-2 rounded-lg flex items-center justify-center space-x-1 shadow-sm transition-all cursor-pointer"
                            >
                              <MessageCircle className="w-3 h-3" />
                              <span>{lang === 'en' ? 'Send Sticker Directly' : 'إرسال كملصق مباشر'}</span>
                            </button>
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => handleDownloadSticker(stk.webpUrl || stk.processedImageUrl, `${stk.expressionName}.webp`)}
                                className="flex-1 text-[10px] bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold py-1 px-1.5 rounded-md border border-emerald-200 inline-flex items-center justify-center space-x-1"
                              >
                                <Download className="w-2.5 h-2.5" />
                                <span>WebP</span>
                              </button>
                              <button
                                onClick={() => handleDownloadSticker(stk.processedImageUrl!, `${stk.expressionName}.png`)}
                                className="flex-1 text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-1 px-1.5 rounded-md border border-slate-200 inline-flex items-center justify-center space-x-1"
                              >
                                <Download className="w-2.5 h-2.5" />
                                <span>PNG</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

      {/* Direct Card Payment Modal */}
      <CardPaymentModal
        isOpen={isCardModalOpen}
        order={order}
        lang={lang}
        onClose={() => setIsCardModalOpen(false)}
        onPaymentSuccess={(updated) => {
          setOrder(updated);
          fetchStatus();
        }}
      />

    </div>
  </div>
  );
};

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

  // Batch download all completed stickers
  const handleDownloadAll = () => {
    stickers
      .filter((s) => s.generationStatus === 'completed' && s.processedImageUrl)
      .forEach((s, idx) => {
        setTimeout(() => {
          handleDownloadSticker(s.processedImageUrl, `${idx + 1}_${s.expressionName}`);
        }, idx * 250);
      });
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
  const progressPercent = Math.round((completedStickersCount / (order.stickerCount || 12)) * 100);

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
      note: lang === 'en' ? 'Selfie uploaded & sanitized' : 'تم رفع السيلفي ومعالجته',
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
      title: lang === 'en' ? `Generating stickers (${completedStickersCount}/${order.stickerCount || 12})` : `توليد الملصقات (${completedStickersCount}/${order.stickerCount || 12})`,
      isDone: isCompleted || completedStickersCount >= (order.stickerCount || 12),
      isActive: order.generationStatus === 'generating_stickers' || order.generationStatus === 'processing_images',
      note: order.generationProgress?.currentExpression || (lang === 'en' ? 'Crafting 12 expressions' : 'رسم 12 تعبيراً مختلفاً'),
    },
    {
      id: 'packaging',
      title: lang === 'en' ? 'Preparing sticker pack' : 'تجهيز حزمة الملصقات',
      isDone: isCompleted,
      isActive: order.generationStatus === 'packaging',
      note: lang === 'en' ? '512x512 transparent PNG normalization' : 'أبعاد 512x512 وخلفية مفرغة',
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
      <div className="max-w-4xl mx-auto px-4 sm:px-6 space-y-8">
        
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
                  ? (lang === 'en' ? '12 Stickers Created Successfully!' : 'تم إنشاء 12 ملصقاً بنجاح!')
                  : isPaid
                  ? (lang === 'en' ? 'AI Sticker Generation in Progress' : 'جاري إنشاء ملصقاتك بالذكاء الاصطناعي...')
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

        {/* COMPLETED STICKERS GRID */}
        {isPaid && stickers.length > 0 && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-md border border-slate-200 space-y-6">
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
                  <button
                    onClick={handleDownloadAll}
                    className="inline-flex items-center space-x-1.5 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-md transition-colors cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>{lang === 'en' ? 'Download All 12 Stickers (PNG)' : 'تحميل الـ 12 ملصقاً (PNG)'}</span>
                  </button>
                )}
                
                {whatsappLink && (
                  <a
                    href={whatsappLink}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center space-x-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-extrabold shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>{lang === 'en' ? 'Add to WhatsApp Direct' : 'إضافة للواتساب مباشرة'}</span>
                  </a>
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
                      <button
                        onClick={() => handleDownloadSticker(stk.processedImageUrl!, stk.expressionName)}
                        className="mt-2 text-[11px] text-indigo-600 hover:text-indigo-800 font-bold inline-flex items-center space-x-1"
                      >
                        <Download className="w-3 h-3" />
                        <span>Download</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

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
  );
};

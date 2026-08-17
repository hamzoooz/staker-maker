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
  Share2
} from 'lucide-react';
import { GeneratedSticker, Order } from '../types/index.js';

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
    a.download = `StickerMe_${name.replace(/\s+/g, '_')}.png`;
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
        <h3 className="text-lg font-bold text-slate-900">Loading your sticker order...</h3>
        <p className="text-xs text-slate-500 mt-1">Order ID: {orderId}</p>
      </div>
    );
  }

  if (error && !order) {
    return (
      <div className="max-w-md mx-auto my-16 p-8 bg-white rounded-3xl border border-rose-200 text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
        <h3 className="text-xl font-bold text-slate-900">Order Not Found</h3>
        <p className="text-sm text-slate-600">{error}</p>
        <button
          onClick={onBackToHome}
          className="px-6 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-bold"
        >
          Back to Homepage
        </button>
      </div>
    );
  }

  if (!order) return null;

  const isPaid = order.paymentStatus === 'paid';
  const isCompleted = order.generationStatus === 'completed';
  const completedStickersCount = stickers.filter((s) => s.generationStatus === 'completed').length;
  const progressPercent = Math.round((completedStickersCount / (order.stickerCount || 12)) * 100);

  // Define actual progress stages strictly based on backend state
  const stages = [
    {
      id: 'payment',
      title: 'Payment confirmed',
      isDone: isPaid,
      isActive: !isPaid,
      note: isPaid ? `$${order.price} ${order.currency}` : 'Pending payment',
    },
    {
      id: 'photo',
      title: 'Photo received',
      isDone: isPaid,
      isActive: false,
      note: 'Selfie uploaded & sanitized',
    },
    {
      id: 'character',
      title: 'Creating your character',
      isDone: order.generationStatus !== 'queued' && order.generationStatus !== 'analyzing_photo',
      isActive: order.generationStatus === 'analyzing_photo' || order.generationStatus === 'creating_character',
      note: 'Facial identity anchor configured',
    },
    {
      id: 'stickers',
      title: `Generating stickers (${completedStickersCount}/${order.stickerCount || 12})`,
      isDone: isCompleted || completedStickersCount >= (order.stickerCount || 12),
      isActive: order.generationStatus === 'generating_stickers' || order.generationStatus === 'processing_images',
      note: order.generationProgress?.currentExpression || 'Crafting 12 expressions',
    },
    {
      id: 'packaging',
      title: 'Preparing your sticker pack',
      isDone: isCompleted,
      isActive: order.generationStatus === 'packaging',
      note: '512x512 transparent PNG normalization',
    },
    {
      id: 'delivery',
      title: 'Sending to WhatsApp',
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
            <span>Create New Stickers</span>
          </button>

          <div className="flex items-center space-x-2">
            <span className="text-xs font-mono text-slate-500">Order #{order.id}</span>
            <button
              onClick={fetchStatus}
              className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-slate-900"
              title="Refresh status"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* STATUS HERO CARD */}
        <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-xs border border-slate-200 space-y-6">
          
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
            <div>
              <div className="flex items-center space-x-2">
                {isCompleted ? (
                  <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold flex items-center space-x-1 border border-emerald-200">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Your Stickers Are Ready!</span>
                  </span>
                ) : isPaid ? (
                  <span className="px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold flex items-center space-x-1 border border-indigo-200">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600 animate-spin" />
                    <span>Your stickers are being created</span>
                  </span>
                ) : (
                  <span className="px-3 py-1 rounded-full bg-amber-50 text-amber-800 text-xs font-bold flex items-center space-x-1 border border-amber-200">
                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                    <span>Awaiting Payment Confirmation</span>
                  </span>
                )}
              </div>

              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-2">
                {isCompleted
                  ? '12 Stickers Created Successfully!'
                  : isPaid
                  ? 'AI Sticker Generation in Progress'
                  : 'Complete Payment to Begin Generation'}
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 flex items-center space-x-2">
                <span>Destination WhatsApp:</span>
                <span className="font-mono font-bold text-slate-800">{order.customerPhone}</span>
              </p>
            </div>

            {/* Price badge */}
            <div className="bg-slate-50 px-4 py-3 rounded-xl border border-slate-200 text-right shrink-0">
              <span className="text-xs font-semibold text-slate-500 block">Package Price</span>
              <span className="text-xl font-extrabold text-slate-900">${order.price} USD</span>
            </div>
          </div>

          {/* Pending Payment Callout (For test & review flow) */}
          {!isPaid && (
            <div className="p-6 rounded-xl bg-amber-50/70 border border-amber-200 space-y-4">
              <div className="flex items-start space-x-3">
                <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-bold text-sm text-amber-900">Payment Required ($2.99)</h4>
                  <p className="text-xs text-amber-800 mt-0.5">
                    Stickers are only generated once payment is confirmed. Click below to simulate or test instant confirmation.
                  </p>
                </div>
              </div>

              <button
                onClick={handleSimulatePayment}
                disabled={isSimulatingPayment}
                className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white font-bold text-sm shadow-md flex items-center justify-center space-x-2 cursor-pointer transition-all"
              >
                {isSimulatingPayment ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                <span>Simulate / Confirm Instant $2.99 Payment (Test Mode)</span>
              </button>
            </div>
          )}

          {/* Progress bar */}
          {isPaid && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                <span>Generation Progress</span>
                <span className="text-indigo-600 font-extrabold">{progressPercent}% Completed</span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-600 transition-all duration-500 rounded-full"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}

          {/* Real-time Progress Stages */}
          <div className="space-y-3 pt-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Order Pipeline Stages
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {stages.map((st) => (
                <div
                  key={st.id}
                  className={`p-3 rounded-xl border flex items-center space-x-3 transition-all ${
                    st.isDone
                      ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
                      : st.isActive
                      ? 'bg-indigo-50/70 border-indigo-200 text-indigo-950 ring-1 ring-indigo-300'
                      : 'bg-slate-50/60 border-slate-200 text-slate-400'
                  }`}
                >
                  <div className="shrink-0">
                    {st.isDone ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    ) : st.isActive ? (
                      <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
                    ) : (
                      <div className="w-5 h-5 rounded-full border-2 border-slate-300 flex items-center justify-center" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold truncate">{st.title}</p>
                    <p className="text-[10px] text-slate-500 truncate">{st.note}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Finished CTA Buttons */}
          {isCompleted && (
            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center gap-3">
              {whatsappLink && (
                <a
                  href={whatsappLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:flex-1 py-3.5 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-extrabold text-sm shadow-lg shadow-emerald-600/20 flex items-center justify-center space-x-2 transition-all"
                >
                  <MessageCircle className="w-5 h-5" />
                  <span>Open WhatsApp & View Stickers</span>
                  <ExternalLink className="w-4 h-4 ml-1" />
                </a>
              )}

              <button
                onClick={handleDownloadAll}
                className="w-full sm:w-auto py-3.5 px-6 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm flex items-center justify-center space-x-2 transition-all cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Download All 12 Stickers</span>
              </button>
            </div>
          )}

        </div>

        {/* STICKER PACK GALLERY */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-extrabold text-slate-900">Your 12 Personalized Stickers</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                512x512 WhatsApp compatible transparent stickers with white die-cut contour
              </p>
            </div>
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-100 text-emerald-800">
              {completedStickersCount}/12 Ready
            </span>
          </div>

          {/* Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {stickers.map((stk) => {
              const isStkCompleted = stk.generationStatus === 'completed';
              const isRetrying = isRetryingSticker === stk.id;

              return (
                <div
                  key={stk.id}
                  className="group relative bg-slate-50/80 hover:bg-emerald-50/40 rounded-2xl p-3 border border-slate-200 hover:border-emerald-300 transition-all flex flex-col items-center text-center shadow-2xs hover:shadow-md"
                >
                  {/* Sequence number */}
                  <span className="absolute top-2 left-2 text-[10px] font-bold text-slate-400 bg-white px-1.5 py-0.5 rounded-md border border-slate-200">
                    #{stk.sequence}
                  </span>

                  {/* Sticker Display */}
                  <div className="w-24 h-24 sm:w-28 sm:h-28 my-2 relative flex items-center justify-center">
                    {isStkCompleted && stk.processedImageUrl ? (
                      <img
                        src={stk.processedImageUrl}
                        alt={stk.expressionName}
                        className="w-full h-full object-contain filter drop-shadow-md group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <div className="w-full h-full rounded-xl bg-slate-200 animate-pulse flex flex-col items-center justify-center p-2 text-center">
                        <Loader2 className="w-6 h-6 text-slate-400 animate-spin mb-1" />
                        <span className="text-[10px] font-semibold text-slate-500">Generating...</span>
                      </div>
                    )}
                  </div>

                  {/* Name & Bubble */}
                  <p className="text-xs font-bold text-slate-900 truncate w-full mt-1">
                    {stk.expressionName}
                  </p>
                  {stk.bubbleText && (
                    <span className="text-[9px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full truncate max-w-full mt-0.5">
                      {stk.bubbleText}
                    </span>
                  )}

                  {/* Action buttons */}
                  {isStkCompleted && (
                    <div className="mt-2 w-full flex items-center justify-center space-x-1 pt-1 border-t border-slate-200/60">
                      <button
                        onClick={() => handleDownloadSticker(stk.processedImageUrl, stk.expressionName)}
                        className="p-1 text-slate-600 hover:text-emerald-600 rounded-md hover:bg-white text-[11px] flex items-center space-x-1 font-semibold"
                        title="Download PNG"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>PNG</span>
                      </button>
                      <button
                        onClick={() => handleRetrySticker(stk.id)}
                        disabled={isRetrying}
                        className="p-1 text-slate-400 hover:text-slate-700 rounded-md hover:bg-white text-[11px] font-semibold"
                        title="Regenerate this sticker"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* WhatsApp Installation Guide */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 space-y-4">
          <h3 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
            <MessageCircle className="w-5 h-5 text-emerald-600" />
            <span>How to Add Stickers to WhatsApp</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-slate-600">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <span className="font-bold text-slate-900 block mb-1">1. Open Link in WhatsApp</span>
              <span>Tap the "Open WhatsApp" button above to access your pack directly inside your chat.</span>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <span className="font-bold text-slate-900 block mb-1">2. Add to Favorites</span>
              <span>Tap and hold on any sticker in WhatsApp, then select "Add to Favorites" ⭐ to use anytime.</span>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <span className="font-bold text-slate-900 block mb-1">3. Or Download Image Files</span>
              <span>You can also download all 12 PNG files directly to your phone gallery and share them anywhere.</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

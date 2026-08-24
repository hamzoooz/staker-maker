import React, { useEffect, useState } from 'react';
import { 
  CheckCircle2, 
  Sparkles, 
  MessageCircle, 
  Download, 
  RefreshCw, 
  AlertCircle, 
  ArrowLeft,
  Loader2,
  Share2,
  Copy,
  Info
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
  const [isLoading, setIsLoading] = useState(true);
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
      if (order && order.generationStatus === 'completed') {
        clearInterval(interval);
        return;
      }
      fetchStatus();
    }, 3000);

    return () => clearInterval(interval);
  }, [orderId, order?.generationStatus]);

  // Download individual sticker
  const handleDownloadSticker = (stickerUrl: string, name: string, ext = 'png') => {
    const a = document.createElement('a');
    a.href = stickerUrl;
    a.download = `StickerAI_${name.replace(/\s+/g, '_')}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
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
          title: 'WhatsApp Sticker - StickerMe AI',
          text: lang === 'en' ? 'Created with StickerMe AI' : 'صُنع بواسطة StickerMe AI',
        });
      } else {
        // Fallback: Copy to clipboard
        handleCopySticker(stickerUrl);
      }
    } catch (e) {
      console.warn('Share error, falling back to download:', e);
      handleDownloadSticker(targetUrl, name, ext);
    }
  };

  // Copy PNG image to clipboard for easy pasting into WhatsApp on iOS
  const handleCopySticker = async (stickerUrl: string) => {
    try {
      const pngRes = await fetch(stickerUrl);
      const pngBlob = await pngRes.blob();
      await navigator.clipboard.write([
        new ClipboardItem({
          'image/png': pngBlob,
        }),
      ]);
      alert(
        lang === 'en' 
          ? 'Sticker copied to clipboard! Open WhatsApp and paste it into any chat.' 
          : 'تم نسخ الملصق للحافظة! افتح محادثة واتساب وقم بلصقه مباشرة.'
      );
    } catch (err) {
      console.error('Copy failed:', err);
      alert(
        lang === 'en'
          ? 'Could not copy automatically. Please download or share the WebP sticker instead.'
          : 'لم نتمكن من النسخ تلقائياً. يرجى استخدام زر تحميل كملصق (WebP) أو إرسال مباشر.'
      );
    }
  };

  if (isLoading && !order) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center bg-[#030014]">
        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-4" />
        <h3 className="text-lg font-bold text-white">
          {lang === 'en' ? 'Connecting to AI model...' : 'جاري الاتصال بنموذج الذكاء الاصطناعي...'}
        </h3>
        <p className="text-xs text-slate-500 mt-1">Sticker Batch #{orderId}</p>
      </div>
    );
  }

  if (error && !order) {
    return (
      <div className="max-w-md mx-auto my-16 p-8 bg-slate-900/60 border border-rose-900/40 text-center space-y-4 shadow-2xl rounded-3xl backdrop-blur-md">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
        <h3 className="text-xl font-bold text-white">
          {lang === 'en' ? 'Sticker Pack Not Found' : 'لم يتم العثور على حزمة الملصقات'}
        </h3>
        <p className="text-sm text-slate-400">{error}</p>
        <button
          onClick={onBackToHome}
          className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-sm font-bold transition-colors cursor-pointer"
        >
          {lang === 'en' ? 'Create New Stickers' : 'إنشاء ملصقات جديدة'}
        </button>
      </div>
    );
  }

  if (!order) return null;

  const isCompleted = order.generationStatus === 'completed';
  const completedStickersCount = stickers.filter((s) => s.generationStatus === 'completed').length;
  const progressPercent = isCompleted
    ? 100
    : order.generationStatus === 'packaging'
    ? 95
    : order.generationStatus === 'generating_stickers'
    ? 15 + Math.round((completedStickersCount / 4) * 80)
    : order.generationStatus === 'creating_character'
    ? 10
    : order.generationStatus === 'analyzing_photo'
    ? 5
    : 0;

  const stages = [
    {
      id: 'photo',
      title: lang === 'en' ? 'Selfie Analyzing' : 'تحليل الصورة الشخصية',
      isDone: order.generationStatus !== 'queued' && order.generationStatus !== 'analyzing_photo',
      isActive: order.generationStatus === 'analyzing_photo',
      note: lang === 'en' ? 'AI is scanning facial features' : 'الذكاء الاصطناعي يقوم بفحص ملامح الوجه للرسم',
    },
    {
      id: 'character',
      title: lang === 'en' ? 'Styling Avatar' : 'بناء الشخصية الكرتونية',
      isDone: order.generationStatus !== 'queued' && order.generationStatus !== 'analyzing_photo' && order.generationStatus !== 'creating_character',
      isActive: order.generationStatus === 'creating_character',
      note: lang === 'en' ? 'Constructing visual character identity' : 'تثبيت لون البشرة والشعر والملامح الموحدة',
    },
    {
      id: 'stickers',
      title: lang === 'en' ? 'Generating 4 Stickers' : 'توليد الـ 4 ملصقات بالكامل',
      isDone: isCompleted,
      isActive: order.generationStatus === 'generating_stickers',
      note: order.generationProgress?.currentExpression || (lang === 'en' ? 'Creating emotional reactions' : 'رسم تعبيرات وجه مختلفة وضاحكة ومرحة'),
    },
    {
      id: 'packaging',
      title: lang === 'en' ? 'Polishing Transparency' : 'معالجة الشفافية وقص الأطراف',
      isDone: isCompleted,
      isActive: order.generationStatus === 'packaging',
      note: lang === 'en' ? 'Adding outline die-cuts & WebP format' : 'إضافة الإطار الأبيض المفرغ وتصدير صيغة WebP للواتساب',
    },
  ];

  return (
    <div className="py-8 sm:py-12 bg-[#030014] min-h-screen">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 space-y-6 sm:space-y-8">
        
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <button
            onClick={onBackToHome}
            className="inline-flex items-center space-x-1.5 text-xs font-bold text-slate-300 hover:text-white bg-slate-900/60 hover:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-800 shadow-sm transition-colors cursor-pointer"
          >
            <ArrowLeft className={`w-3.5 h-3.5 ${lang === 'ar' ? 'rotate-180' : ''}`} />
            <span>{lang === 'en' ? 'Create New Stickers' : 'إنشاء ملصقات جديدة'}</span>
          </button>

          <div className="flex items-center space-x-2">
            <span className="text-xs font-mono text-slate-500">AI Batch #{order.id}</span>
            <button
              onClick={fetchStatus}
              className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="Refresh status"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* STATUS CARD */}
        <div className="bg-slate-900/40 rounded-3xl p-5 sm:p-8 shadow-2xl border border-slate-800/80 space-y-6 backdrop-blur-md">
          
          {/* Header */}
          <div className="pb-6 border-b border-slate-800/60">
            <div className="flex items-center space-x-2">
              {isCompleted ? (
                <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-bold flex items-center space-x-1 border border-emerald-500/20">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{lang === 'en' ? 'Stickers Ready!' : 'الملصقات جاهزة الآن!'}</span>
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 text-xs font-bold flex items-center space-x-1 border border-indigo-500/20">
                  <Sparkles className="w-3.5 h-3.5 animate-spin" />
                  <span>{lang === 'en' ? 'AI sticker pipeline generating...' : 'جاري توليد ملصقاتك بالذكاء الاصطناعي...'}</span>
                </span>
              )}
            </div>

            <h2 className="text-xl sm:text-3xl font-extrabold text-white mt-3">
              {isCompleted
                ? (lang === 'en' ? '4 Custom AI Stickers Created Successfully!' : 'تم إنشاء ملصقاتك الأربعة بالذكاء الاصطناعي!')
                : (lang === 'en' ? 'AI Sticker Generation in Progress' : 'جاري تنفيذ أمر الرسم والتوليد بالذكاء الاصطناعي...')}
            </h2>
          </div>

          {/* Progress bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-slate-400">{lang === 'en' ? 'AI Generation Progress' : 'مستوى تقدم الرسم'}</span>
              <span className="text-indigo-400 font-extrabold">{progressPercent}%</span>
            </div>
            <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-400 transition-all duration-500 rounded-full shadow-[0_0_10px_rgba(99,102,241,0.5)]"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            {!isCompleted && (
              <p className="text-[10px] text-slate-500 pt-0.5">
                {lang === 'en'
                  ? 'Our AI takes about 1-2 minutes to paint, extract, and convert your stickers to WebP. Keep this page open.'
                  : 'يستغرق الذكاء الاصطناعي حوالي دقيقة إلى دقيقتين للرسم وقص وتجهيز الملصقات بصيغة واتساب WebP. يرجى إبقاء هذه الصفحة مفتوحة.'}
              </p>
            )}
          </div>

          {/* Progress Stages */}
          <div className="space-y-3 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {stages.map((st) => (
                <div
                  key={st.id}
                  className={`p-3.5 rounded-2xl border flex items-center space-x-3 transition-all ${
                    st.isDone
                      ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-200'
                      : st.isActive
                      ? 'bg-indigo-500/10 border-indigo-500/40 text-indigo-100 shadow-[0_0_10px_rgba(99,102,241,0.05)]'
                      : 'bg-slate-950/20 border-slate-900 text-slate-500'
                  }`}
                >
                  <div className="shrink-0">
                    {st.isDone ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    ) : st.isActive ? (
                      <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
                    ) : (
                      <div className="w-5 h-5 rounded-full border-2 border-slate-800" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold truncate">{st.title}</p>
                    <p className="text-[10px] opacity-60 truncate">{st.note}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* STICKERS DISPLAY */}
        {stickers.length > 0 && (
          <div className="bg-slate-900/40 rounded-3xl p-5 sm:p-8 shadow-2xl border border-slate-800/80 space-y-8 backdrop-blur-md">
            
            {/* Grid */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/60 pb-4">
                <div>
                  <h3 className="text-lg sm:text-xl font-extrabold text-white">
                    {lang === 'en' ? 'Your AI Custom Stickers' : 'ملصقاتك الشخصية الجاهزة'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {lang === 'en' ? 'Add them to your WhatsApp tray using the options below' : 'قم بحفظها وإضافتها مباشرة إلى لوحة ملصقات الواتساب الخاصة بك'}
                  </p>
                </div>
              </div>

              {/* Grid Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
                {stickers.map((stk, idx) => (
                  <div
                    key={stk.id || idx}
                    className="group bg-slate-950/40 rounded-2xl p-4 border border-slate-850 flex flex-col items-center justify-between hover:border-slate-700 transition-all shadow-sm hover:shadow-lg"
                  >
                    <div className="w-full aspect-square relative rounded-xl overflow-hidden bg-slate-900/40 flex items-center justify-center p-3 border border-slate-800/50 shadow-inner">
                      {stk.processedImageUrl ? (
                        <img
                          src={stk.processedImageUrl}
                          alt={stk.expressionName}
                          className="w-full h-full object-contain filter drop-shadow-md group-hover:scale-105 transition-transform duration-200"
                        />
                      ) : stk.generationStatus === 'failed' ? (
                        <div className="flex flex-col items-center justify-center text-rose-400 p-2 text-center">
                          <AlertCircle className="w-6 h-6 mb-1" />
                          <span className="text-[9px] font-bold">Failed to load</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center text-slate-500 space-y-2">
                          <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                          <span className="text-[10px] font-bold">Generating...</span>
                        </div>
                      )}
                    </div>

                    <div className="w-full text-center mt-3">
                      <span className="text-xs font-bold text-slate-200 block truncate">
                        {lang === 'en' ? stk.expressionName : stk.expressionName}
                      </span>
                      {stk.processedImageUrl && (
                        <div className="space-y-1.5 mt-3 w-full">
                          
                          {/* Share Direct */}
                          <button
                            onClick={() => handleShareStickerDirectly(stk.processedImageUrl!, stk.expressionName, stk.webpUrl)}
                            className="w-full text-[11px] bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold py-1.5 px-2 rounded-lg flex items-center justify-center space-x-1 transition-all cursor-pointer shadow-md"
                          >
                            <Share2 className="w-3.5 h-3.5 mr-1" />
                            <span>{lang === 'en' ? 'Direct Share Sticker' : 'إرسال كملصق مباشر'}</span>
                          </button>

                          {/* Copy Clipboard (iOS shortcut) */}
                          <button
                            onClick={() => handleCopySticker(stk.processedImageUrl!)}
                            className="w-full text-[10px] bg-slate-900 hover:bg-slate-800 text-slate-200 font-extrabold py-1 px-1.5 rounded-lg flex items-center justify-center space-x-1 border border-slate-800 transition-all cursor-pointer"
                          >
                            <Copy className="w-3 h-3 mr-1" />
                            <span>{lang === 'en' ? 'Copy to Clipboard' : 'نسخ كملصق'}</span>
                          </button>

                          {/* Download Actions */}
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleDownloadSticker(stk.webpUrl || stk.processedImageUrl!, stk.expressionName, 'webp')}
                              className="flex-1 text-[9px] bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 font-bold py-1 px-1 rounded-md border border-indigo-500/20 inline-flex items-center justify-center space-x-1 cursor-pointer"
                              title="Download WebP sticker file"
                            >
                              <Download className="w-2.5 h-2.5 mr-1" />
                              <span>WebP</span>
                            </button>
                            <button
                              onClick={() => handleDownloadSticker(stk.processedImageUrl!, stk.expressionName, 'png')}
                              className="flex-1 text-[9px] bg-slate-900 hover:bg-slate-800 text-slate-400 font-bold py-1 px-1 rounded-md border border-slate-800 inline-flex items-center justify-center space-x-1 cursor-pointer"
                              title="Download PNG image file"
                            >
                              <Download className="w-2.5 h-2.5 mr-1" />
                              <span>PNG</span>
                            </button>
                          </div>

                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* INTEGRATION INSTRUCTIONS */}
            {isCompleted && (
              <div className="p-5 sm:p-6 bg-slate-950/50 border border-slate-800 rounded-2xl space-y-4">
                <div className="flex items-center space-x-2 border-b border-slate-800/80 pb-3">
                  <Info className="w-5 h-5 text-indigo-400" />
                  <h4 className="text-sm sm:text-base font-extrabold text-white">
                    {lang === 'en' ? '💡 Step-by-Step WhatsApp Add Guide' : '💡 دليل خطوة بخطوة لإضافة الملصقات للواتساب'}
                  </h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-slate-300">
                  
                  {/* iOS / iPhone */}
                  <div className="space-y-2 p-3 bg-slate-900/30 rounded-xl border border-slate-900">
                    <span className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-300 font-black">iPhone / iOS</span>
                    <ol className="list-decimal list-inside space-y-1.5 leading-relaxed pt-1">
                      <li>اضغط على زر **"نسخ كملصق"** أسفل أي ملصق أعلاه.</li>
                      <li>افتح محادثة واتساب على هاتفك.</li>
                      <li>المس حقل كتابة الرسائل ضغطة مطولة واختر **لصق (Paste)**.</li>
                      <li>سيتم إرسال الملصق فوراً! اضغط عليه في الشات واختر **إضافة للمفضلة ⭐** لحفظه بلوحة المفاتيح.</li>
                    </ol>
                  </div>

                  {/* Android */}
                  <div className="space-y-2 p-3 bg-slate-900/30 rounded-xl border border-slate-900">
                    <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 font-black">Android</span>
                    <ol className="list-decimal list-inside space-y-1.5 leading-relaxed pt-1">
                      <li>اضغط على **"إرسال كملصق مباشر"** لمشاركة الملف إلى محادثات واتساب مباشرة.</li>
                      <li>أو اضغط على زر **"WebP"** لتحميل الملصق كملف شفاف.</li>
                      <li>افتح أي تطبيق لتجميع الملصقات (مثل **Sticker.ly** أو **Sticker Maker**) من متجر Google Play.</li>
                      <li>ارفع الملفات التي قمت بتحميلها واضغط **أضف إلى واتساب**.</li>
                    </ol>
                  </div>

                  {/* WhatsApp Web */}
                  <div className="space-y-2 p-3 bg-slate-900/30 rounded-xl border border-slate-900">
                    <span className="px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-400 font-black">WhatsApp Web / Desktop</span>
                    <ol className="list-decimal list-inside space-y-1.5 leading-relaxed pt-1">
                      <li>اضغط على زر **"WebP"** لتحميل الملصقات الشفافة على حاسوبك.</li>
                      <li>افتح واتساب ويب في المتصفح وادخل إلى أي محادثة.</li>
                      <li>اضغط على زر **أيقونة الملصقات (Stickers Icon)** بجانب مربع الكتابة، ثم اضغط على زر **إنشاء (Create)**.</li>
                      <li>اختر ملف الـ **WebP** الذي قمت بتحميله وسيقوم واتساب ويب بتحويله فوراً لملصق رسمي!</li>
                    </ol>
                  </div>

                </div>
              </div>
            )}

          </div>
        )}

      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { ArrowRight, Sparkles, CheckCircle2, MessageCircle, Heart, ThumbsUp, Laugh, PartyPopper, Zap, ShieldCheck } from 'lucide-react';

interface HeroProps {
  onStartOrder: () => void;
  lang: 'en' | 'ar';
}

const SAMPLE_DEMO_STICKERS = [
  {
    id: 'wow',
    label: 'WOW!',
    labelAr: 'وااو!',
    emoji: '🤩',
    bg: 'from-amber-400 to-rose-500',
    color: 'text-amber-500',
    tilt: 'rotate-[-4deg] sm:rotate-[-6deg]',
    tag: 'Surprise',
  },
  {
    id: 'love',
    label: 'LOVE',
    labelAr: 'حب ❤️',
    emoji: '🥰',
    bg: 'from-rose-400 to-pink-600',
    color: 'text-pink-500',
    tilt: 'translate-y-2 sm:translate-y-6 rotate-[3deg] sm:rotate-[4deg]',
    tag: 'Heart',
  },
  {
    id: 'ok',
    label: 'OK!',
    labelAr: 'تمام 👍',
    emoji: '👍',
    bg: 'from-emerald-400 to-teal-600',
    color: 'text-emerald-500',
    tilt: 'rotate-[4deg] sm:rotate-[8deg]',
    tag: 'Thumbs Up',
  },
  {
    id: 'wait',
    label: 'WAIT..',
    labelAr: 'لحظة 🤔',
    emoji: '🤔',
    bg: 'from-blue-400 to-indigo-600',
    color: 'text-blue-500',
    tilt: '-translate-x-1 sm:-translate-x-2 rotate-[6deg] sm:rotate-[10deg]',
    tag: 'Thinking',
  },
  {
    id: 'yay',
    label: 'YAY!',
    labelAr: 'مبروك 🥳',
    emoji: '🥳',
    bg: 'from-purple-400 to-indigo-600',
    color: 'text-purple-500',
    tilt: 'translate-y-3 sm:translate-y-8 -rotate-[3deg] sm:-rotate-[5deg]',
    tag: 'Celebrate',
  },
  {
    id: 'cool',
    label: 'COOL',
    labelAr: 'روعة 😎',
    emoji: '😎',
    bg: 'from-cyan-400 to-blue-600',
    color: 'text-cyan-500',
    tilt: 'translate-x-1 -rotate-[6deg] sm:-rotate-[12deg]',
    tag: 'Cool',
  },
];

export const Hero: React.FC<HeroProps> = ({ onStartOrder, lang }) => {
  const [activeStickerIdx, setActiveStickerIdx] = useState(0);

  return (
    <section className="relative overflow-hidden pt-6 pb-12 sm:pt-12 sm:pb-16 bg-gradient-to-b from-slate-50 via-white to-slate-50 border-b border-slate-200/80">
      
      {/* Ambient background glows */}
      <div className="absolute top-0 right-1/2 translate-x-1/2 w-72 sm:w-96 h-72 sm:h-96 bg-indigo-200/40 rounded-full blur-3xl pointer-events-none -mt-20" />
      <div className="absolute bottom-0 left-0 w-60 sm:w-80 h-60 sm:h-80 bg-emerald-100/40 rounded-full blur-3xl pointer-events-none -ml-10" />

      <div className="max-w-6xl mx-auto px-4 sm:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 sm:gap-12 items-center">
          
          {/* Left Column: Headline & CTA */}
          <div className="lg:col-span-6 space-y-5 sm:space-y-6 text-center lg:text-left">
            
            {/* Pill Tag */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-slate-200/80 text-slate-800 text-xs font-bold shadow-xs">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>{lang === 'en' ? 'Turn 1 Selfie into 4 WhatsApp Stickers' : 'سيلفي واحد يتحول إلى 4 ملصقات واتساب'}</span>
            </div>

            {/* Main Title */}
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-slate-950 leading-[1.12] tracking-tight">
              {lang === 'en' ? (
                <>
                  Your Face.{' '}
                  <span className="bg-gradient-to-r from-indigo-600 to-indigo-800 bg-clip-text text-transparent">
                    Your Stickers.
                  </span>
                </>
              ) : (
                <>
                  صورتك.{' '}
                  <span className="bg-gradient-to-r from-indigo-600 to-indigo-800 bg-clip-text text-transparent">
                    ملصقاتك الخاصة.
                  </span>
                </>
              )}
            </h1>

            {/* Subtext */}
            <p className="text-slate-600 text-base sm:text-lg font-medium leading-relaxed max-w-lg mx-auto lg:mx-0">
              {lang === 'en'
                ? 'Upload one selfie and get 4 personalized WhatsApp & Telegram stickers in seconds. Powered by AI.'
                : 'ارفع صورة سيلفي واحدة واحصل على 4 ملصقات ذكية ومخصصة لواتساب وتيليجرام في ثوانٍ بالذكاء الاصطناعي.'}
            </p>

            {/* Action CTA */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3.5">
              <button
                id="hero-cta-btn"
                onClick={onStartOrder}
                className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-indigo-600 via-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 active:scale-[0.98] text-white font-black text-base rounded-2xl shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-3 transition-all cursor-pointer"
              >
                <span>{lang === 'en' ? 'Create My 4 Stickers Now' : 'اصنع حزمة ملصقاتي الآن'}</span>
                <ArrowRight className="w-5 h-5 opacity-90" />
              </button>

              <div className="flex items-center gap-2 text-slate-700 text-xs sm:text-sm font-bold">
                <span className="inline-flex items-center text-emerald-600">
                  <CheckCircle2 className="w-4 h-4 mr-1 text-emerald-500" />
                  4 Stickers
                </span>
                <span>•</span>
                <span>Direct WhatsApp Pack</span>
              </div>
            </div>

          </div>

          {/* Right Column: Visual Showcase Mobile-Friendly */}
          <div className="lg:col-span-6 relative flex flex-col items-center justify-center py-2 sm:py-6">
            <div className="relative w-full max-w-sm sm:max-w-md">
              
              {/* Selfie Avatar Inset */}
              <div className="absolute -top-4 -left-2 sm:-top-8 sm:-left-6 w-16 h-16 sm:w-22 sm:h-22 rounded-2xl sm:rounded-3xl border-3 sm:border-4 border-white shadow-xl overflow-hidden z-20 bg-slate-900 ring-2 ring-indigo-500/20">
                <div className="w-full h-full bg-gradient-to-br from-indigo-900 to-slate-900 flex items-center justify-center text-2xl sm:text-3xl">
                  🤳
                </div>
                <div className="absolute bottom-0 inset-x-0 bg-indigo-600 text-white text-[7px] sm:text-[9px] font-extrabold py-0.5 text-center">
                  Your Selfie
                </div>
              </div>

              {/* 6 Tilted Die-Cut Sticker Cards */}
              <div className="grid grid-cols-3 gap-2.5 sm:gap-4 relative pt-3 sm:pt-4">
                {SAMPLE_DEMO_STICKERS.map((stk, idx) => (
                  <div
                    key={stk.id}
                    onClick={() => setActiveStickerIdx(idx)}
                    className={`relative bg-white rounded-2xl sm:rounded-3xl p-3 sm:p-4 shadow-md border-2 border-slate-100/80 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 hover:scale-105 active:scale-95 ${stk.tilt} ${
                      activeStickerIdx === idx ? 'ring-3 ring-indigo-500 shadow-xl z-10 scale-105' : 'hover:shadow-lg'
                    }`}
                  >
                    {/* White sticker border simulator */}
                    <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-xl sm:rounded-2xl bg-slate-50 flex items-center justify-center text-3xl sm:text-4xl shadow-inner mb-2 border border-slate-100">
                      <span>{stk.emoji}</span>
                    </div>

                    <span className="text-[10px] sm:text-xs font-black text-slate-900 tracking-tight">
                      {lang === 'en' ? stk.label : stk.labelAr}
                    </span>
                  </div>
                ))}
              </div>

            </div>
          </div>

        </div>
      </div>
    </section>
  );
};

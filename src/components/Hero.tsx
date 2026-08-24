import React, { useState } from 'react';
import { ArrowRight, Sparkles, CheckCircle2, MessageCircle } from 'lucide-react';

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
    bg: 'from-amber-500 to-orange-600',
    tilt: 'rotate-[-6deg]',
  },
  {
    id: 'love',
    label: 'LOVE',
    labelAr: 'حب ❤️',
    emoji: '🥰',
    bg: 'from-pink-500 to-rose-600',
    tilt: 'translate-y-2 rotate-[4deg]',
  },
  {
    id: 'ok',
    label: 'OK!',
    labelAr: 'تمام 👍',
    emoji: '👍',
    bg: 'from-emerald-500 to-teal-600',
    tilt: 'rotate-[6deg]',
  },
  {
    id: 'wait',
    label: 'WAIT..',
    labelAr: 'لحظة 🤔',
    emoji: '🤔',
    bg: 'from-blue-500 to-indigo-600',
    tilt: 'rotate-[-4deg]',
  },
  {
    id: 'yay',
    label: 'YAY!',
    labelAr: 'مبروك 🥳',
    emoji: '🥳',
    bg: 'from-purple-500 to-violet-600',
    tilt: 'translate-y-2 rotate-[3deg]',
  },
  {
    id: 'cool',
    label: 'COOL',
    labelAr: 'روعة 😎',
    emoji: '😎',
    bg: 'from-cyan-500 to-blue-600',
    tilt: 'rotate-[-8deg]',
  },
];

export const Hero: React.FC<HeroProps> = ({ onStartOrder, lang }) => {
  const [activeStickerIdx, setActiveStickerIdx] = useState(0);

  return (
    <section className="relative overflow-hidden pt-10 pb-16 sm:pt-16 sm:pb-24 bg-[#030014]">
      
      {/* Background gradients */}
      <div className="absolute top-0 right-1/2 translate-x-1/2 w-96 h-96 bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none -mt-20" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-purple-500/50 rounded-full blur-[130px] pointer-events-none -ml-10 opacity-20" />

      <div className="max-w-6xl mx-auto px-4 sm:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          
          {/* Left Column: Headline & CTA */}
          <div className="lg:col-span-6 space-y-6 text-center lg:text-start">
            
            {/* Pill Tag */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/80 border border-slate-800 text-slate-300 text-xs font-bold shadow-md">
              <span className="flex h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
              <span>
                {lang === 'en' 
                  ? 'Turn 1 Selfie into 4 Custom WhatsApp Stickers' 
                  : 'حول صورتك الشخصية إلى ٤ ملصقات واتساب مميزة'}
              </span>
            </div>

            {/* Main Title */}
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white leading-[1.15] tracking-tight">
              {lang === 'en' ? (
                <>
                  Your Face. <br />
                  <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
                    AI Sticker Generator
                  </span>
                </>
              ) : (
                <>
                  صورتك الشخصية. <br />
                  <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
                    مصنع ملصقات بالذكاء الاصطناعي
                  </span>
                </>
              )}
            </h1>

            {/* Subtext */}
            <p className="text-slate-400 text-base sm:text-lg font-medium leading-relaxed max-w-lg mx-auto lg:mx-0">
              {lang === 'en'
                ? 'Upload your photo, select your style, and let our AI generate 4 custom messaging stickers. 100% Free, mobile-responsive, and ready for WhatsApp.'
                : 'ارفع صورتك واختر ستايلك، وسيقوم الذكاء الاصطناعي بتوليد ٤ ملصقات مخصصة لتعبيرات وجهك. مجاني بالكامل، متجاوب مع الهواتف، وجاهز للواتساب.'}
            </p>

            {/* Action CTA */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
              <button
                id="hero-cta-btn"
                onClick={onStartOrder}
                className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-indigo-600 via-indigo-650 to-purple-600 hover:from-indigo-500 hover:to-purple-500 active:scale-[0.98] text-white font-black text-base rounded-2xl shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-3 transition-all cursor-pointer border border-indigo-500/30"
              >
                <span>{lang === 'en' ? 'Create My Free Stickers' : 'اصنع ملصقاتي مجاناً'}</span>
                <ArrowRight className={`w-5 h-5 opacity-90 ${lang === 'ar' ? 'rotate-180' : ''}`} />
              </button>

              <div className="flex items-center gap-2 text-slate-400 text-xs sm:text-sm font-bold">
                <span className="inline-flex items-center text-cyan-400">
                  <CheckCircle2 className="w-4 h-4 mr-1 text-cyan-400" />
                  {lang === 'en' ? '100% Free' : 'مجاني ١٠٠٪'}
                </span>
                <span>•</span>
                <span>{lang === 'en' ? 'WhatsApp Ready' : 'جاهز للواتساب'}</span>
              </div>
            </div>

          </div>

          {/* Right Column: Visual Showcase */}
          <div className="lg:col-span-6 relative flex flex-col items-center justify-center py-2 sm:py-6">
            <div className="relative w-full max-w-sm sm:max-w-md">
              
              {/* Selfie Avatar Inset */}
              <div className="absolute -top-4 -left-2 sm:-top-8 sm:-left-6 w-16 h-16 sm:w-22 sm:h-22 rounded-2xl sm:rounded-3xl border-2 border-slate-700 shadow-2xl overflow-hidden z-20 bg-slate-900 ring-4 ring-indigo-500/10">
                <div className="w-full h-full bg-gradient-to-br from-indigo-950 via-slate-950 to-purple-950 flex items-center justify-center text-2xl sm:text-3xl">
                  🤳
                </div>
                <div className="absolute bottom-0 inset-x-0 bg-indigo-600/90 text-white text-[7px] sm:text-[9px] font-extrabold py-0.5 text-center">
                  {lang === 'en' ? 'Your Selfie' : 'صورتك'}
                </div>
              </div>

              {/* 6 Tilted Die-Cut Sticker Cards */}
              <div className="grid grid-cols-3 gap-3 sm:gap-4 relative pt-3 sm:pt-4">
                {SAMPLE_DEMO_STICKERS.map((stk, idx) => (
                  <div
                    key={stk.id}
                    onClick={() => setActiveStickerIdx(idx)}
                    className={`relative bg-slate-900/60 backdrop-blur-md rounded-2xl sm:rounded-3xl p-3 sm:p-4 shadow-xl border border-slate-800 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 hover:scale-105 active:scale-95 ${stk.tilt} ${
                      activeStickerIdx === idx 
                        ? 'ring-2 ring-indigo-500 border-indigo-500/50 shadow-indigo-500/10 z-10 scale-105' 
                        : 'hover:border-slate-700'
                    }`}
                  >
                    {/* White sticker border simulator */}
                    <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-xl sm:rounded-2xl bg-slate-850 flex items-center justify-center text-3xl sm:text-4xl shadow-inner mb-2 border border-slate-800/80">
                      <span>{stk.emoji}</span>
                    </div>

                    <span className="text-[10px] sm:text-xs font-black text-slate-200 tracking-tight">
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

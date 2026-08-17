import React, { useState } from 'react';
import { ArrowRight, Sparkles, CheckCircle2, MessageCircle, Heart, ThumbsUp, Laugh, PartyPopper } from 'lucide-react';

interface HeroProps {
  onStartOrder: () => void;
  lang: 'en' | 'ar';
}

const SAMPLE_DEMO_STICKERS = [
  {
    id: 'wow',
    label: 'WOW!',
    emoji: '🤩',
    bg: 'bg-indigo-50',
    color: 'text-indigo-600',
    tilt: 'rotate-[-6deg]',
    tag: 'Surprise',
  },
  {
    id: 'love',
    label: 'LOVE',
    emoji: '❤️',
    bg: 'bg-pink-50',
    color: 'text-pink-600',
    tilt: 'translate-y-6 rotate-[4deg]',
    tag: 'Heart',
  },
  {
    id: 'ok',
    label: 'OK!',
    emoji: '👍',
    bg: 'bg-emerald-50',
    color: 'text-emerald-600',
    tilt: 'rotate-[8deg]',
    tag: 'Thumbs Up',
  },
  {
    id: 'wait',
    label: 'WAIT..',
    emoji: '🤔',
    bg: 'bg-amber-50',
    color: 'text-amber-600',
    tilt: '-translate-x-2 rotate-[10deg]',
    tag: 'Thinking',
  },
  {
    id: 'yay',
    label: 'YAY!',
    emoji: '🥳',
    bg: 'bg-blue-50',
    color: 'text-blue-600',
    tilt: 'translate-y-8 -rotate-[5deg]',
    tag: 'Celebrate',
  },
  {
    id: 'sleepy',
    label: 'ZZZ...',
    emoji: '😴',
    bg: 'bg-violet-50',
    color: 'text-violet-600',
    tilt: 'translate-x-2 -translate-y-2 -rotate-[12deg]',
    tag: 'Sleepy',
  },
];

export const Hero: React.FC<HeroProps> = ({ onStartOrder, lang }) => {
  const [activeStickerIdx, setActiveStickerIdx] = useState(0);

  return (
    <section className="relative overflow-hidden pt-8 pb-14 lg:pt-12 lg:pb-16 bg-slate-50 border-b border-slate-200/80">
      {/* Subtle Ambient Background Orbs */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-100 rounded-full blur-3xl opacity-40 -mr-20 -mt-20 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-100 rounded-full blur-3xl opacity-40 -ml-10 -mb-10 pointer-events-none" />

      <div className="max-w-6xl mx-auto px-4 sm:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          
          {/* Left Column: Core Value Proposition */}
          <div className="lg:col-span-6 space-y-6 text-center lg:text-left">
            
            {/* Top Tag */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-slate-200 text-slate-700 text-xs font-semibold shadow-xs">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>{lang === 'en' ? 'Turn one selfie into WhatsApp stickers' : 'سيلفي واحد يتحول إلى ملصقات واتساب'}</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 leading-[1.12] tracking-tight">
              {lang === 'en' ? (
                <>
                  Your Face.{' '}
                  <span className="text-indigo-600">
                    Your Stickers.
                  </span>
                </>
              ) : (
                <>
                  وجهك.{' '}
                  <span className="text-indigo-600">
                    ملصقاتك الخاصة.
                  </span>
                </>
              )}
            </h1>

            {/* Subheadline */}
            <p className="text-slate-600 text-lg sm:text-xl font-normal leading-relaxed max-w-xl mx-auto lg:mx-0">
              {lang === 'en'
                ? 'Turn one selfie into a personalized 12-pack for WhatsApp in minutes. Handcrafted with AI.'
                : 'حوّل صورة سيلفي واحدة إلى حزمة مخصصة من 12 ملصقاً لواتساب في دقائق بالذكاء الاصطناعي.'}
            </p>

            {/* Primary Action Block */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
              <button
                id="hero-cta-btn"
                onClick={onStartOrder}
                className="w-full sm:w-auto px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 flex items-center justify-center gap-3 transition-all active:scale-[0.98] cursor-pointer"
              >
                <span>{lang === 'en' ? 'Create My Stickers — $2.99' : 'اصنع ملصقاتي — 2.99$'}</span>
                <ArrowRight className="w-5 h-5 opacity-80" />
              </button>

              <div className="flex items-center gap-2 text-slate-600 text-xs sm:text-sm font-semibold">
                <span className="inline-flex items-center text-emerald-600">
                  <CheckCircle2 className="w-4 h-4 mr-1 text-emerald-500" />
                  12 Stickers
                </span>
                <span>•</span>
                <span>Instant Delivery</span>
              </div>
            </div>

            {/* Trust Badges */}
            <div className="pt-2 flex flex-wrap items-center justify-center lg:justify-start gap-y-2 gap-x-6 text-[11px] font-bold text-slate-500 uppercase tracking-tight">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>No Account Required</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>Delivered to WhatsApp</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>Auto-Deleted in 7 Days</span>
              </div>
            </div>

          </div>

          {/* Right Column: Visual Showcase with Tilted 3D Cards */}
          <div className="lg:col-span-6 relative flex flex-col items-center justify-center py-6">
            <div className="relative w-full max-w-md">
              
              {/* Selfie Avatar Inset */}
              <div className="absolute -top-6 -left-4 sm:-top-8 sm:-left-6 w-20 h-20 sm:w-24 sm:h-24 rounded-full border-4 border-white shadow-xl overflow-hidden z-20 bg-slate-900">
                <svg viewBox="0 0 100 100" className="w-full h-full object-cover">
                  <rect width="100" height="100" fill="#E2E8F0" />
                  <circle cx="50" cy="38" r="20" fill="#F87171" />
                  <circle cx="50" cy="40" r="16" fill="#FDE047" />
                  <path d="M 32 30 Q 50 15 68 30 Q 50 24 32 30" fill="#1E293B" />
                  <circle cx="44" cy="38" r="2" fill="#1E293B" />
                  <circle cx="56" cy="38" r="2" fill="#1E293B" />
                  <path d="M 44 46 Q 50 52 56 46" stroke="#1E293B" strokeWidth="2" fill="none" strokeLinecap="round" />
                  <path d="M 22 88 Q 50 68 78 88 Z" fill="#4F46E5" />
                </svg>
                <div className="absolute bottom-1 inset-x-0 text-center">
                  <span className="bg-indigo-600 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full shadow-xs">
                    Your Selfie
                  </span>
                </div>
              </div>

              {/* 6 Tilted Die-Cut Sticker Cards */}
              <div className="grid grid-cols-3 gap-4 sm:gap-6 relative pt-4">
                {SAMPLE_DEMO_STICKERS.map((stk, idx) => (
                  <div
                    key={stk.id}
                    onClick={() => setActiveStickerIdx(idx)}
                    className={`aspect-square bg-white rounded-2xl shadow-xl flex items-center justify-center p-3 transform transition-all duration-300 hover:scale-110 cursor-pointer border border-slate-100 ${stk.tilt} ${
                      activeStickerIdx === idx ? 'ring-2 ring-indigo-600 ring-offset-2 scale-105 z-10' : ''
                    }`}
                  >
                    <div className="w-full h-full bg-slate-50 rounded-full flex flex-col items-center justify-center text-[10px] font-bold text-slate-600">
                      <div className={`w-10 h-10 sm:w-12 sm:h-12 ${stk.bg} rounded-full mb-1 flex items-center justify-center text-xl sm:text-2xl shadow-2xs`}>
                        {stk.emoji}
                      </div>
                      <span className="tracking-wide text-slate-800 font-extrabold">{stk.label}</span>
                    </div>
                  </div>
                ))}
              </div>

            </div>

            {/* Bottom mini pill guide */}
            <div className="mt-8 bg-white border border-slate-200 rounded-xl px-4 py-2 shadow-xs flex items-center gap-2 text-xs font-semibold text-slate-700">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <span>Tap stickers to preview expressions • 12 delivered to WhatsApp</span>
            </div>

          </div>

        </div>
      </div>
    </section>
  );
};


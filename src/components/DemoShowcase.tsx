import React, { useState } from 'react';
import { STICKER_EXPRESSIONS, STICKER_STYLES } from '../data/constants.js';
import { StickerStyleId } from '../types/index.js';
import { Sparkles, Check, Heart, Laugh, ThumbsUp, PartyPopper, Smile, Coffee, HelpCircle, Zap } from 'lucide-react';

interface DemoShowcaseProps {
  lang: 'en' | 'ar';
  onSelectStyle: (styleId: StickerStyleId) => void;
}

export const DemoShowcase: React.FC<DemoShowcaseProps> = ({ lang, onSelectStyle }) => {
  const [selectedStyle, setSelectedStyle] = useState<StickerStyleId>('fun_expressive');

  const currentStyleObj = STICKER_STYLES.find(s => s.id === selectedStyle) || STICKER_STYLES[0];

  return (
    <section className="py-14 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-10">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-black mb-3 border border-indigo-100/80 shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600 animate-pulse" />
            <span>{lang === 'en' ? '12 Personalized Expressions' : '١٢ ملصقاً مخصصاً بصورتك وتعبيراتك'}</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-slate-950 tracking-tight">
            {lang === 'en' ? 'One Selfie. 12 Endless Reactions.' : 'صورتك الحقيقية. ١٢ تعبيراً لمحادثاتك اليومية.'}
          </h2>
          <p className="text-sm sm:text-base text-slate-600 mt-2 font-medium">
            {lang === 'en'
              ? 'Our AI adapts your real facial features into 12 expressive, die-cut WhatsApp stickers matching your favorite art style.'
              : 'نحول صورتك وملامحك الشخصية إلى 12 ستيكر واتساب ممتع مع تعبيرات الإيموجي وإطار مقصوص جاهز للاستخدام.'}
          </p>
        </div>

        {/* Style Selector Chips */}
        <div className="mb-8 flex items-center justify-center flex-wrap gap-2">
          {STICKER_STYLES.map((style) => {
            const isSelected = selectedStyle === style.id;
            return (
              <button
                key={style.id}
                onClick={() => {
                  setSelectedStyle(style.id);
                  onSelectStyle(style.id);
                }}
                className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-md ring-2 ring-indigo-400/40 ring-offset-2 scale-105'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <span>{style.sampleEmoji}</span>
                <span>{lang === 'en' ? style.name : style.nameAr || style.name}</span>
                {style.badge && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-500 text-white font-black ml-1">
                    {style.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* 12 Expressions Grid Preview */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5 sm:gap-4">
          {STICKER_EXPRESSIONS.map((exp, index) => {
            return (
              <div
                key={exp.id}
                className="group relative bg-slate-50/80 hover:bg-indigo-50/40 rounded-3xl p-3 sm:p-4 border border-slate-200/90 hover:border-indigo-400 transition-all flex flex-col items-center text-center shadow-xs hover:shadow-xl hover:-translate-y-1"
              >
                {/* Number tag */}
                <span className="absolute top-2.5 left-2.5 text-[10px] font-black text-slate-600 bg-white/95 px-2 py-0.5 rounded-lg border border-slate-200/80 shadow-2xs">
                  #{index + 1}
                </span>

                {/* Sticker Render Preview */}
                <div className="w-22 h-22 sm:w-26 sm:h-26 my-2 relative flex items-center justify-center">
                  
                  {/* Outer Die-cut white border + realistic sticker shadow */}
                  <div className="w-full h-full relative flex items-center justify-center filter drop-shadow-lg group-hover:scale-105 transition-transform">
                    <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full p-1 bg-white shadow-md flex items-center justify-center relative overflow-visible ring-2 ring-slate-100">
                      
                      {/* Avatar Face with Style Gradient */}
                      <div className={`w-full h-full rounded-full flex items-center justify-center relative overflow-hidden bg-gradient-to-br ${currentStyleObj.previewColor || 'from-indigo-600 to-purple-600'}`}>
                        {/* Person Silhouette / Avatar */}
                        <div className="w-full h-full flex flex-col items-center justify-center text-white/90">
                          <span className="text-2xl sm:text-3xl opacity-90 drop-shadow-md">👤</span>
                        </div>

                        {/* Expression overlay effects */}
                        {exp.id === 'love' && (
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <span className="absolute top-1 right-1 text-xs animate-bounce">💖</span>
                            <span className="absolute bottom-1 left-1 text-xs">✨</span>
                          </div>
                        )}
                        {exp.id === 'laughing' && (
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <span className="absolute top-1 left-1 text-[10px]">💧</span>
                            <span className="absolute top-1 right-1 text-[10px]">💧</span>
                          </div>
                        )}
                        {exp.id === 'celebrating' && (
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <span className="absolute -top-1 text-sm">🎉</span>
                          </div>
                        )}
                        {exp.id === 'angry' && (
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <span className="absolute top-1 right-1 text-xs text-rose-300 font-bold">💢</span>
                            <span className="absolute top-1 left-1 text-[10px]">💨</span>
                          </div>
                        )}
                        {exp.id === 'thinking' && (
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <span className="absolute top-0.5 right-1 text-xs">💡</span>
                          </div>
                        )}
                        {exp.id === 'sleepy' && (
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <span className="absolute top-0.5 right-1 text-[10px] font-black text-indigo-200">Zzz</span>
                          </div>
                        )}
                        {exp.id === 'thumbs_up' && (
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <span className="absolute bottom-1 right-1 text-xs">👍</span>
                          </div>
                        )}
                      </div>

                      {/* Floating Emoji Badge on corner */}
                      <div className="absolute -bottom-1.5 -right-1 bg-white rounded-full w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center shadow-md border border-slate-100 text-xs sm:text-sm">
                        {exp.emoji}
                      </div>

                    </div>
                  </div>
                </div>

                {/* Title */}
                <h4 className="text-xs font-black text-slate-900 truncate w-full mt-1">
                  {lang === 'en' ? exp.name : exp.nameAr || exp.name}
                </h4>

                {/* Speech bubble tag */}
                {exp.bubbleText && (
                  <span className="mt-1.5 inline-block text-[10px] font-black text-indigo-700 bg-indigo-50/90 border border-indigo-200/80 px-2 py-0.5 rounded-full truncate max-w-full shadow-2xs">
                    {lang === 'en' ? exp.bubbleText : exp.bubbleTextAr || exp.bubbleText}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Selected style description box */}
        <div className="mt-8 p-5 rounded-3xl bg-slate-900 text-white flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl border border-slate-800">
          <div className="flex items-center space-x-3.5">
            <span className="text-3xl sm:text-4xl p-2.5 rounded-2xl bg-white/10">{currentStyleObj.sampleEmoji}</span>
            <div>
              <p className="text-sm font-black text-white flex items-center gap-2">
                <span>{lang === 'en' ? currentStyleObj.name : currentStyleObj.nameAr || currentStyleObj.name}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500 text-white font-extrabold uppercase">
                  {lang === 'en' ? 'Active Style' : 'النمط المختار'}
                </span>
              </p>
              <p className="text-xs text-slate-300 mt-0.5 max-w-xl">
                {lang === 'en' ? currentStyleObj.description : currentStyleObj.descriptionAr || currentStyleObj.description}
              </p>
            </div>
          </div>
          <button
            onClick={() => onSelectStyle(selectedStyle)}
            className="text-xs font-black px-5 py-2.5 rounded-2xl bg-indigo-500 hover:bg-indigo-400 text-white whitespace-nowrap transition-all cursor-pointer shadow-lg active:scale-95 flex items-center gap-1.5"
          >
            <span>{lang === 'en' ? 'Use This Style' : 'استخدم هذا النمط'}</span>
            <span>→</span>
          </button>
        </div>

      </div>
    </section>
  );
};

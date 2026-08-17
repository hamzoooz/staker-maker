import React, { useState } from 'react';
import { STICKER_EXPRESSIONS, STICKER_STYLES } from '../data/constants.js';
import { StickerStyleId } from '../types/index.js';
import { Sparkles, Check, Heart, Laugh, ThumbsUp, PartyPopper, Smile, Coffee, HelpCircle } from 'lucide-react';

interface DemoShowcaseProps {
  lang: 'en' | 'ar';
  onSelectStyle: (styleId: StickerStyleId) => void;
}

export const DemoShowcase: React.FC<DemoShowcaseProps> = ({ lang, onSelectStyle }) => {
  const [selectedStyle, setSelectedStyle] = useState<StickerStyleId>('fun_expressive');

  const currentStyleObj = STICKER_STYLES.find(s => s.id === selectedStyle) || STICKER_STYLES[0];

  // Helper icons for demo expressions
  const getExpressionIcon = (id: string) => {
    switch (id) {
      case 'happy': return Smile;
      case 'laughing': return Laugh;
      case 'love': return Heart;
      case 'thumbs_up': return ThumbsUp;
      case 'celebrating': return PartyPopper;
      case 'sleepy': return Coffee;
      default: return Sparkles;
    }
  };

  return (
    <section className="py-14 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold mb-3 border border-indigo-100">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            <span>12 Unique Expressions In Every Pack</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            {lang === 'en' ? 'One Selfie. 12 Endless Reactions.' : 'سيلفي واحد. ١٢ تعبيراً لمحادثاتك اليومية.'}
          </h2>
          <p className="text-base text-slate-500 mt-2">
            {lang === 'en'
              ? 'Our AI extracts your recognizable facial features and creates a matching set of WhatsApp stickers tailored to your favorite art style.'
              : 'يحافظ الذكاء الاصطناعي على ملامحك المميزة ويحوّلها إلى ملصقات واتساب ممتعة ومميزة.'}
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
                className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-600/30 ring-offset-2'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <span>{style.sampleEmoji}</span>
                <span>{lang === 'en' ? style.name : style.nameAr || style.name}</span>
                {style.badge && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-500 text-white font-bold ml-1">
                    {style.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* 12 Expressions Grid Preview */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
          {STICKER_EXPRESSIONS.map((exp, index) => {
            const Icon = getExpressionIcon(exp.id);
            return (
              <div
                key={exp.id}
                className="group relative bg-slate-50/70 hover:bg-indigo-50/30 rounded-2xl p-3 sm:p-4 border border-slate-200 hover:border-indigo-300 transition-all flex flex-col items-center text-center shadow-xs hover:shadow-md"
              >
                {/* Number tag */}
                <span className="absolute top-2 left-2 text-[10px] font-bold text-slate-500 bg-white/95 px-1.5 py-0.5 rounded-md border border-slate-200">
                  #{index + 1}
                </span>

                {/* Sticker Render Preview */}
                <div className="w-20 h-20 sm:w-24 sm:h-24 my-2 relative flex items-center justify-center">
                  
                  {/* Outer Die-cut white border */}
                  <div className="w-full h-full relative flex items-center justify-center filter drop-shadow-md group-hover:scale-105 transition-transform">
                    <svg viewBox="0 0 100 100" className="w-full h-full">
                      {/* White die-cut outline */}
                      <circle cx="50" cy="50" r="44" fill="#FFFFFF" />
                      
                      {/* Character Face Color matched to selected style */}
                      <circle 
                        cx="50" 
                        cy="50" 
                        r="38" 
                        fill={
                          selectedStyle === 'cute' ? '#FBCFE8' :
                          selectedStyle === '3d_character' ? '#67E8F9' :
                          selectedStyle === 'anime' ? '#DDD6FE' :
                          '#FDE047'
                        } 
                      />

                      {/* Hair */}
                      <path d="M 22 40 Q 50 15 78 40 Q 50 25 22 40" fill="#1E293B" />

                      {/* Face features based on expression */}
                      {exp.id === 'laughing' ? (
                        <>
                          <path d="M 36 44 Q 42 38 46 44" stroke="#1E293B" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                          <path d="M 54 44 Q 58 38 64 44" stroke="#1E293B" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                          <path d="M 38 54 Q 50 72 62 54 Z" fill="#E11D48" stroke="#1E293B" strokeWidth="2" />
                          <circle cx="70" cy="46" r="3" fill="#38BDF8" />
                        </>
                      ) : exp.id === 'love' ? (
                        <>
                          <path d="M 34 42 Q 40 36 46 42 Q 40 50 34 42" fill="#E11D48" />
                          <path d="M 54 42 Q 60 36 66 42 Q 60 50 54 42" fill="#E11D48" />
                          <path d="M 40 58 Q 50 68 60 58" stroke="#1E293B" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                        </>
                      ) : exp.id === 'thumbs_up' ? (
                        <>
                          <circle cx="40" cy="42" r="3" fill="#1E293B" />
                          <circle cx="60" cy="42" r="3" fill="#1E293B" />
                          <path d="M 40 56 Q 50 66 60 56" stroke="#1E293B" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                          <text x="68" y="58" fontSize="12">👍</text>
                        </>
                      ) : exp.id === 'celebrating' ? (
                        <>
                          <circle cx="40" cy="42" r="3" fill="#1E293B" />
                          <circle cx="60" cy="42" r="3" fill="#1E293B" />
                          <path d="M 38 54 Q 50 70 62 54 Z" fill="#E11D48" />
                          <text x="66" y="36" fontSize="11">🎉</text>
                        </>
                      ) : exp.id === 'angry' ? (
                        <>
                          <line x1="34" y1="38" x2="46" y2="44" stroke="#1E293B" strokeWidth="2.5" strokeLinecap="round" />
                          <line x1="66" y1="38" x2="54" y2="44" stroke="#1E293B" strokeWidth="2.5" strokeLinecap="round" />
                          <circle cx="40" cy="46" r="2.5" fill="#1E293B" />
                          <circle cx="60" cy="46" r="2.5" fill="#1E293B" />
                          <path d="M 42 62 Q 50 54 58 62" stroke="#1E293B" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                        </>
                      ) : (
                        <>
                          <circle cx="40" cy="42" r="3" fill="#1E293B" />
                          <circle cx="60" cy="42" r="3" fill="#1E293B" />
                          <path d="M 38 56 Q 50 68 62 56" stroke="#1E293B" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                        </>
                      )}

                      {/* Cheeks */}
                      <circle cx="30" cy="52" r="4" fill="#FB7185" opacity="0.6" />
                      <circle cx="70" cy="52" r="4" fill="#FB7185" opacity="0.6" />
                    </svg>

                    {/* Emoji overlay */}
                    <div className="absolute -bottom-1 bg-white rounded-full p-0.5 shadow-xs border border-slate-100 text-sm">
                      {exp.emoji}
                    </div>
                  </div>
                </div>

                {/* Title */}
                <h4 className="text-xs font-bold text-slate-900 truncate w-full mt-1">
                  {lang === 'en' ? exp.name : exp.nameAr || exp.name}
                </h4>

                {/* Speech bubble tag */}
                {exp.bubbleText && (
                  <span className="mt-1 inline-block text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full truncate max-w-full">
                    {lang === 'en' ? exp.bubbleText : exp.bubbleTextAr || exp.bubbleText}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Selected style description box */}
        <div className="mt-8 p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
          <div className="flex items-center space-x-3">
            <span className="text-2xl">{currentStyleObj.sampleEmoji}</span>
            <div>
              <p className="text-xs font-bold text-slate-900">
                {lang === 'en' ? currentStyleObj.name : currentStyleObj.nameAr || currentStyleObj.name} Style Active
              </p>
              <p className="text-xs text-slate-600">
                {lang === 'en' ? currentStyleObj.description : currentStyleObj.descriptionAr || currentStyleObj.description}
              </p>
            </div>
          </div>
          <button
            onClick={() => onSelectStyle(selectedStyle)}
            className="text-xs font-bold px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white whitespace-nowrap transition-colors cursor-pointer shadow-xs"
          >
            Use This Style →
          </button>
        </div>

      </div>
    </section>
  );
};

import React from 'react';
import { Sparkles, MessageCircle } from 'lucide-react';

interface NavbarProps {
  onScrollToOrder: () => void;
  onOpenAdmin: () => void;
  onOpenPrivacy: () => void;
  lang: 'en' | 'ar';
  onToggleLang: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onScrollToOrder,
  lang,
  onToggleLang,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full bg-[#030014]/70 backdrop-blur-lg border-b border-slate-800/50 transition-all">
      <div className="max-w-6xl mx-auto px-4 sm:px-8 h-15 sm:h-16 flex items-center justify-between">
        
        {/* Brand Logo */}
        <div 
          className="flex items-center gap-2 cursor-pointer select-none active:scale-95 transition-transform" 
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        >
          <div className="w-8 h-8 sm:w-9 sm:h-9 bg-gradient-to-tr from-indigo-600 via-purple-600 to-cyan-400 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="font-black text-lg sm:text-xl tracking-tight text-white">
              StickerMe<span className="text-indigo-400">AI</span>
            </span>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-3 text-sm font-medium">
          
          <div className="hidden sm:flex px-2.5 py-1 bg-indigo-500/10 text-indigo-300 rounded-full border border-indigo-500/20 items-center gap-1.5 text-[11px] font-bold">
            <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse" />
            <span>{lang === 'en' ? '4 Custom Stickers' : '٤ ملصقات مخصصة'}</span>
          </div>

          {/* Language Switch */}
          <button
            onClick={onToggleLang}
            className="text-xs font-bold px-2.5 py-1.5 rounded-xl border border-slate-700 bg-slate-900/60 hover:bg-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer shadow-sm whitespace-nowrap"
            title="Switch Language"
          >
            {lang === 'en' ? 'العربية' : 'EN'}
          </button>

          {/* Primary CTA */}
          <button
            onClick={onScrollToOrder}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs sm:text-sm font-extrabold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-md shadow-indigo-600/30 active:scale-95 transition-all cursor-pointer whitespace-nowrap"
          >
            <MessageCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>{lang === 'en' ? 'Create' : 'ابدأ الآن'}</span>
          </button>

        </div>

      </div>
    </header>
  );
};

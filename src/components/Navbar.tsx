import React from 'react';
import { Sparkles, MessageCircle, Lock, ShieldCheck } from 'lucide-react';

interface NavbarProps {
  onScrollToOrder: () => void;
  onOpenAdmin: () => void;
  onOpenPrivacy: () => void;
  lang: 'en' | 'ar';
  onToggleLang: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onScrollToOrder,
  onOpenAdmin,
  lang,
  onToggleLang,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full bg-white border-b border-slate-200 shadow-xs transition-all">
      <div className="max-w-6xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <div 
          className="flex items-center gap-2.5 cursor-pointer" 
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        >
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-xs">
            <div className="w-4 h-4 border-2 border-white rounded-full flex items-center justify-center">
              <div className="w-1.5 h-1.5 bg-white rounded-full" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-bold text-xl tracking-tight text-slate-900">
              StickerMe<span className="text-indigo-600">AI</span>
            </span>
            <span className="hidden sm:inline-block text-[11px] font-semibold text-slate-400">
              WhatsApp Pack
            </span>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-3 sm:gap-5 text-sm font-medium text-slate-600">
          {/* System Online / Ready status */}
          <div className="hidden md:flex px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-100 items-center gap-2 text-xs font-semibold">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span>AI Ready • $2.99</span>
          </div>

          {/* Language switch */}
          <button
            onClick={onToggleLang}
            className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
            title="Toggle Language"
          >
            {lang === 'en' ? 'العربية' : 'English'}
          </button>

          {/* Admin link */}
          <button
            onClick={onOpenAdmin}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
            title="Admin Console"
          >
            <Lock className="w-4 h-4" />
          </button>

          {/* CTA Button */}
          <button
            onClick={onScrollToOrder}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-200 active:scale-95 transition-all cursor-pointer"
          >
            <MessageCircle className="w-4 h-4" />
            <span>Create Stickers</span>
          </button>
        </div>
      </div>
    </header>
  );
};


import React from 'react';
import { Sparkles, MessageCircle, Lock, ShieldCheck, Zap, LogOut } from 'lucide-react';
import { AdminUser } from '../types/index.js';

interface NavbarProps {
  onScrollToOrder: () => void;
  onOpenAdmin: () => void;
  onOpenPrivacy: () => void;
  lang: 'en' | 'ar';
  onToggleLang: () => void;
  adminUser?: AdminUser | null;
  onLogout?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onScrollToOrder,
  onOpenAdmin,
  lang,
  onToggleLang,
  adminUser,
  onLogout,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full bg-white/90 backdrop-blur-lg border-b border-slate-200/80 shadow-2xs transition-all">
      <div className="max-w-6xl mx-auto px-3.5 sm:px-8 h-15 sm:h-16 flex items-center justify-between">
        
        {/* Brand Logo */}
        <div 
          className="flex items-center gap-2 cursor-pointer select-none active:scale-95 transition-transform" 
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        >
          <div className="w-8 h-8 sm:w-9 sm:h-9 bg-gradient-to-tr from-indigo-600 via-indigo-700 to-emerald-500 rounded-xl flex items-center justify-center shadow-md shadow-indigo-600/20">
            <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
          </div>
          <div className="flex flex-col sm:flex-row sm:items-baseline sm:gap-1.5">
            <span className="font-black text-lg sm:text-xl tracking-tight text-slate-950">
              StickerMe<span className="text-indigo-600">AI</span>
            </span>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-1.5 sm:gap-3 text-sm font-medium">
          
          {/* Admin VIP Badge if logged in */}
          {adminUser ? (
            <div className="flex items-center space-x-1.5">
              <button
                onClick={onOpenAdmin}
                className="px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full bg-slate-900 text-purple-300 border border-purple-500/50 flex items-center space-x-1 text-[11px] sm:text-xs font-black shadow-md hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span className="truncate max-w-[80px] sm:max-w-none">{adminUser.name.split(' ')[0]}</span>
              </button>
              {onLogout && (
                <button
                  onClick={onLogout}
                  className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                  title="Logout"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ) : (
            <div className="hidden lg:flex px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200/80 items-center gap-1.5 text-[11px] font-bold">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              <span>12 Custom Stickers</span>
            </div>
          )}

          {/* Language Switch */}
          <button
            onClick={onToggleLang}
            className="text-xs font-bold px-1.5 py-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer shadow-2xs whitespace-nowrap"
            title="Switch Language"
          >
            {lang === 'en' ? 'العربية' : 'EN'}
          </button>

          {/* Discreet Admin Lock Button (Only when not logged in) */}
          {!adminUser && (
            <button
              onClick={onOpenAdmin}
              className="hidden sm:block p-1.5 sm:p-2 text-slate-400 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              title="Admin"
            >
              <Lock className="w-4 h-4" />
            </button>
          )}

          {/* Primary CTA */}
          <button
            onClick={onScrollToOrder}
            className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs sm:text-sm font-extrabold text-white bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 shadow-md shadow-indigo-600/25 active:scale-95 transition-all cursor-pointer whitespace-nowrap"
          >
            <MessageCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>{lang === 'en' ? 'Create' : 'اصنع الآن'}</span>
          </button>

        </div>

      </div>
    </header>
  );
};

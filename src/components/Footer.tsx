import React from 'react';
import { Sparkles, Shield, Heart } from 'lucide-react';

interface FooterProps {
  onOpenLegal: (type: any) => void;
  onScrollToTop: () => void;
  lang: 'en' | 'ar';
}

export const Footer: React.FC<FooterProps> = ({ onScrollToTop, lang }) => {
  return (
    <footer className="bg-[#030014] border-t border-slate-900 py-12 relative z-10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-8 border-b border-slate-900">
          
          {/* Brand */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={onScrollToTop}>
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-md">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-sm text-white">
                StickerMe<span className="text-indigo-400">AI</span>
              </span>
              <p className="text-[11px] text-slate-500">
                {lang === 'en' ? 'Turn your selfie into WhatsApp stickers' : 'حول صورتك الشخصية لملصقات واتساب'}
              </p>
            </div>
          </div>

          {/* Trust badge */}
          <div className="flex items-center space-x-2 text-xs text-slate-400 bg-slate-900/40 px-3 py-1.5 rounded-full border border-slate-800">
            <Shield className="w-4 h-4 text-cyan-400" />
            <span>{lang === 'en' ? 'Automatic 7-Day Asset Pruning' : 'حذف تلقائي للملفات بعد ٧ أيام للخصوصية'}</span>
          </div>

        </div>

        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
          <p>© {new Date().getFullYear()} StickerMe AI. {lang === 'en' ? 'All rights reserved.' : 'جميع الحقوق محفوظة.'}</p>
          <p className="flex items-center space-x-1">
            <span>{lang === 'en' ? 'Crafted with AI &' : 'صُنع بكل حب بالذكاء الاصطناعي'}</span>
            <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
            <span>{lang === 'en' ? 'for WhatsApp creators' : 'لمحبي ملصقات الواتساب'}</span>
          </p>
        </div>
      </div>
    </footer>
  );
};

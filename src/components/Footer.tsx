import React from 'react';
import { Sparkles, Shield, Heart } from 'lucide-react';
import { LegalModalType } from './LegalModals.js';

interface FooterProps {
  onOpenLegal: (type: LegalModalType) => void;
  onScrollToTop: () => void;
  lang: 'en' | 'ar';
}

export const Footer: React.FC<FooterProps> = ({ onOpenLegal, onScrollToTop, lang }) => {
  return (
    <footer className="bg-white border-t border-slate-200 py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-8 border-b border-slate-100">
          
          {/* Brand */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={onScrollToTop}>
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-sm text-slate-900">
                StickerMe<span className="text-indigo-600">AI</span>
              </span>
              <p className="text-[11px] text-slate-500">Turn your selfie into WhatsApp stickers</p>
            </div>
          </div>

          {/* Links */}
          <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-slate-600 font-semibold">
            <button
              onClick={() => onOpenLegal('privacy')}
              className="hover:text-indigo-600 transition-colors"
            >
              Privacy Policy
            </button>
            <button
              onClick={() => onOpenLegal('terms')}
              className="hover:text-indigo-600 transition-colors"
            >
              Terms of Service
            </button>
            <button
              onClick={() => onOpenLegal('refund')}
              className="hover:text-indigo-600 transition-colors"
            >
              Refund Policy
            </button>
          </div>

          {/* Trust badge */}
          <div className="flex items-center space-x-2 text-xs text-slate-500">
            <Shield className="w-4 h-4 text-emerald-600" />
            <span>7-Day Auto Asset Pruning</span>
          </div>

        </div>

        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-600 gap-2">
          <p>© {new Date().getFullYear()} StickerMe AI. All rights reserved.</p>
          <p className="flex items-center space-x-1">
            <span>Crafted with AI &</span>
            <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
            <span>for WhatsApp creators worldwide</span>
          </p>
        </div>
      </div>
    </footer>
  );
};

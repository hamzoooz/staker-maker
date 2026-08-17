import React from 'react';
import { X, Shield, FileText, RotateCcw } from 'lucide-react';

export type LegalModalType = 'privacy' | 'terms' | 'refund' | null;

interface LegalModalProps {
  type: LegalModalType;
  onClose: () => void;
}

export const LegalModals: React.FC<LegalModalProps> = ({ type, onClose }) => {
  if (!type) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-2.5">
            {type === 'privacy' && <Shield className="w-5 h-5 text-indigo-600" />}
            {type === 'terms' && <FileText className="w-5 h-5 text-indigo-600" />}
            {type === 'refund' && <RotateCcw className="w-5 h-5 text-indigo-600" />}
            <h3 className="font-bold text-base text-slate-900 capitalize">
              {type === 'privacy' && 'Privacy Policy & Data Retention'}
              {type === 'terms' && 'Terms of Service'}
              {type === 'refund' && '100% Satisfaction & Refund Policy'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto text-xs sm:text-sm text-slate-600 space-y-4 leading-relaxed">
          {type === 'privacy' && (
            <>
              <p className="font-semibold text-slate-900">
                Your privacy is our core promise. Here is exactly how your photo and data are treated:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  <strong className="text-slate-900">Single Purpose Use:</strong> Your uploaded selfie is used solely to generate your 12 personalized WhatsApp stickers.
                </li>
                <li>
                  <strong className="text-slate-900">No Selling or Sharing:</strong> We never sell, rent, license, or transfer your photo or WhatsApp number to third-party advertisers or data brokers.
                </li>
                <li>
                  <strong className="text-slate-900">7-Day Automatic Asset Deletion:</strong> Uploaded selfies and generated sticker assets are automatically deleted from our secure storage after 7 days (ASSET_RETENTION_DAYS).
                </li>
                <li>
                  <strong className="text-slate-900">No Account Friction:</strong> You do not need to create an account or provide passwords to use the service.
                </li>
                <li>
                  <strong className="text-slate-900">Secure Transmission:</strong> All uploads and payment transactions are protected via 256-bit SSL encryption.
                </li>
              </ul>
            </>
          )}

          {type === 'terms' && (
            <>
              <p className="font-semibold text-slate-900">
                Terms of Service for StickerMe AI:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  <strong className="text-slate-900">Personal Ownership:</strong> You confirm that you have the right to upload the photo provided (either yourself or with explicit consent).
                </li>
                <li>
                  <strong className="text-slate-900">Content Standards:</strong> Uploads containing nudity, violence, hate speech, or unlawful content are strictly prohibited and will be rejected automatically.
                </li>
                <li>
                  <strong className="text-slate-900">Sticker Pack Delivery:</strong> Upon successful payment of $2.99 USD, 12 digital stickers will be generated and delivered via WhatsApp and on your private web status page.
                </li>
                <li>
                  <strong className="text-slate-900">WhatsApp Compatibility:</strong> Delivered stickers conform to standard 512x512 transparent sticker specifications compatible with WhatsApp on iOS, Android, and Web.
                </li>
              </ul>
            </>
          )}

          {type === 'refund' && (
            <>
              <p className="font-semibold text-slate-900">
                Risk-Free Satisfaction Guarantee:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  <strong className="text-slate-900">Automated Retries:</strong> If any sticker generation encounters a temporary AI glitch, our system automatically re-generates the failed sticker at zero extra cost.
                </li>
                <li>
                  <strong className="text-slate-900">Refund Guarantee:</strong> If our system fails to deliver your completed sticker pack to your WhatsApp and web status page within 15 minutes of payment confirmation, you are eligible for an immediate full refund.
                </li>
                <li>
                  <strong className="text-slate-900">Support Contact:</strong> Simply contact support through the order status page or reach out with your Order ID for prompt resolution.
                </li>
              </ul>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-colors"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { 
  CreditCard, 
  Lock, 
  ShieldCheck, 
  AlertCircle, 
  Loader2, 
  X, 
  CheckCircle2,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { Order } from '../types/index.js';

interface CardPaymentModalProps {
  isOpen: boolean;
  order: Order;
  lang: 'en' | 'ar';
  onClose: () => void;
  onPaymentSuccess: (updatedOrder: Order) => void;
}

export const CardPaymentModal: React.FC<CardPaymentModalProps> = ({
  isOpen,
  order,
  lang,
  onClose,
  onPaymentSuccess,
}) => {
  const [cardNumber, setCardNumber] = useState('');
  const [cardholderName, setCardholderName] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [cardBrand, setCardBrand] = useState<'visa' | 'mastercard' | 'amex' | 'generic'>('generic');
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Format Card Number (XXXX XXXX XXXX XXXX) & Detect Brand
  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 16);
    const formatted = raw.match(/.{1,4}/g)?.join(' ') || raw;
    setCardNumber(formatted);

    if (raw.startsWith('4')) {
      setCardBrand('visa');
    } else if (/^5[1-5]/.test(raw) || /^2[2-7]/.test(raw)) {
      setCardBrand('mastercard');
    } else if (/^3[47]/.test(raw)) {
      setCardBrand('amex');
    } else {
      setCardBrand('generic');
    }
  };

  // Format Expiry (MM/YY)
  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value.replace(/\D/g, '').slice(0, 4);
    if (raw.length >= 3) {
      raw = `${raw.slice(0, 2)}/${raw.slice(2, 4)}`;
    }
    setExpiry(raw);
  };

  // Format CVC
  const handleCvcChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 4);
    setCvc(raw);
  };

  // Submit Direct Card Payment
  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanCard = cardNumber.replace(/\s+/g, '');
    if (cleanCard.length < 13) {
      setError(lang === 'en' ? 'Please enter a valid card number.' : 'يرجى إدخال رقم بطاقة صالح.');
      return;
    }

    if (!expiry.includes('/')) {
      setError(lang === 'en' ? 'Please enter expiry date (MM/YY).' : 'يرجى إدخال تاريخ انتهاء صالح (MM/YY).');
      return;
    }

    const [expMonth, expYear] = expiry.split('/');
    if (!expMonth || !expYear || parseInt(expMonth, 10) < 1 || parseInt(expMonth, 10) > 12) {
      setError(lang === 'en' ? 'Invalid expiry month.' : 'الشهر غير صحيح.');
      return;
    }

    if (cvc.length < 3) {
      setError(lang === 'en' ? 'Please enter a valid 3 or 4-digit CVC code.' : 'رمز الأمان CVC غير صحيح.');
      return;
    }

    setIsProcessing(true);

    try {
      const res = await fetch(`/api/orders/${order.id}/pay-card`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardNumber: cleanCard,
          cardholderName: cardholderName.trim() || 'Valued Customer',
          expMonth,
          expYear,
          cvc: cvc.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Card payment was declined. Please check details.');
      }

      if (data.requiresAction && data.actionUrl) {
        window.location.href = data.actionUrl;
        return;
      }

      if (data.success && data.order) {
        onPaymentSuccess(data.order);
      }
    } catch (err: any) {
      console.error('Payment failure:', err);
      setError(err.message || 'Payment processing failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      
      {/* Modal Container */}
      <div className="relative w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in slide-in-from-bottom-8 sm:zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 sm:p-6 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/30 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black">
                {lang === 'en' ? 'Direct Card Payment' : 'الدفع المباشر بالبطاقة'}
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-400">
                {lang === 'en' ? '256-Bit Encrypted • Instant Activation' : 'مشفر بالكامل • تفعيل فوري للحزمة'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-8 space-y-5 sm:space-y-6">

          {/* Interactive 3D Card Simulation (Responsive Mobile-Friendly) */}
          <div className="relative w-full aspect-[1.58/1] max-w-xs sm:max-w-sm mx-auto rounded-2xl bg-gradient-to-tr from-slate-950 via-indigo-950 to-slate-900 text-white p-4 sm:p-6 shadow-2xl flex flex-col justify-between overflow-hidden border border-indigo-500/30">
            
            {/* Ambient pattern */}
            <div className="absolute -right-12 -top-12 w-36 h-36 bg-indigo-500/20 rounded-full blur-2xl pointer-events-none" />
            
            {/* Top Row */}
            <div className="flex items-center justify-between z-10">
              <div className="w-9 h-7 sm:w-11 sm:h-8 rounded-md bg-gradient-to-r from-amber-200 via-amber-400 to-amber-300 shadow-inner flex items-center justify-around px-1">
                <div className="w-full h-[1px] bg-amber-800/40" />
              </div>
              <div className="font-black tracking-widest text-xs uppercase px-2.5 py-1 rounded-md bg-black/40 backdrop-blur-xs">
                {cardBrand === 'visa' && <span className="text-blue-300 font-serif italic text-sm">VISA</span>}
                {cardBrand === 'mastercard' && <span className="text-orange-400 font-bold">Mastercard</span>}
                {cardBrand === 'amex' && <span className="text-sky-300 font-bold">AMEX</span>}
                {cardBrand === 'generic' && <span className="text-slate-300">Debit / Credit</span>}
              </div>
            </div>

            {/* Card Number */}
            <div className="z-10 tracking-[0.16em] sm:tracking-[0.2em] font-mono text-base sm:text-xl font-medium text-slate-100 drop-shadow-sm">
              {cardNumber || '•••• •••• •••• ••••'}
            </div>

            {/* Bottom Row */}
            <div className="flex items-end justify-between z-10">
              <div>
                <span className="text-[8px] sm:text-[9px] uppercase tracking-wider text-slate-400 block">Cardholder</span>
                <span className="text-[11px] sm:text-xs font-bold tracking-wide uppercase text-slate-200 truncate max-w-[140px] sm:max-w-none block">
                  {cardholderName || (lang === 'en' ? 'YOUR NAME' : 'الاسم الكامل')}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[8px] sm:text-[9px] uppercase tracking-wider text-slate-400 block">Expires</span>
                <span className="text-[11px] sm:text-xs font-mono font-bold text-slate-200">
                  {expiry || 'MM/YY'}
                </span>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center space-x-2 animate-shake">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmitPayment} className="space-y-3.5 sm:space-y-4">
            
            {/* Card Number */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {lang === 'en' ? 'Card Number' : 'رقم البطاقة'}
              </label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="cc-number"
                  value={cardNumber}
                  onChange={handleCardNumberChange}
                  placeholder="4242 •••• •••• 4242"
                  className="w-full px-4 py-3 pl-10 rounded-xl border border-slate-300 text-slate-900 font-mono text-sm focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 transition-all outline-hidden font-bold"
                  required
                />
                <CreditCard className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              </div>
            </div>

            {/* Cardholder Name */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {lang === 'en' ? 'Cardholder Full Name' : 'الاسم الكامل على البطاقة'}
              </label>
              <input
                type="text"
                autoComplete="cc-name"
                value={cardholderName}
                onChange={(e) => setCardholderName(e.target.value)}
                placeholder="Hamza Ahmed"
                className="w-full px-4 py-3 rounded-xl border border-slate-300 text-slate-900 text-sm font-medium focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 transition-all outline-hidden"
                required
              />
            </div>

            {/* Expiry & CVC */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {lang === 'en' ? 'Expiry (MM/YY)' : 'تاريخ الانتهاء'}
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="cc-exp"
                  value={expiry}
                  onChange={handleExpiryChange}
                  placeholder="12/28"
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 text-slate-900 font-mono text-sm focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 transition-all outline-hidden text-center font-bold"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {lang === 'en' ? 'Security Code (CVC)' : 'رمز الأمان (CVC)'}
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  autoComplete="cc-csc"
                  value={cvc}
                  onChange={handleCvcChange}
                  placeholder="123"
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 text-slate-900 font-mono text-sm focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 transition-all outline-hidden text-center font-bold"
                  required
                />
              </div>
            </div>

            {/* Price Breakdown Banner */}
            <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span>{lang === 'en' ? '4 AI Stickers Pack' : 'حزمة 4 ملصقات بالذكاء الاصطناعي'}</span>
                <span className="font-mono font-bold text-slate-800">${order.basePrice || 0.99}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>{lang === 'en' ? 'Gateway Transfer Fee' : 'عمولة التحويل وبوابة الدفع'}</span>
                <span className="font-mono font-bold text-slate-600">+${order.feePrice || 0.20}</span>
              </div>
              <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-xs font-black text-slate-900 block">
                    {lang === 'en' ? 'Total Amount' : 'المبلغ الإجمالي'}
                  </span>
                  <span className="text-[10px] text-emerald-600 font-bold">
                    {lang === 'en' ? 'Instant Delivery • No Subscription' : 'تفعيل فوري • بدون اشتراك'}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-lg sm:text-xl font-black text-slate-900">${order.price || 1.19} USD</span>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isProcessing}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-[0.99] text-white font-black text-sm sm:text-base shadow-lg shadow-emerald-600/25 flex items-center justify-center space-x-2 transition-all cursor-pointer disabled:opacity-70"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>{lang === 'en' ? 'Processing...' : 'جاري التأكيد...'}</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-5 h-5" />
                  <span>{lang === 'en' ? `Pay $${order.price || 1.19} & Generate Pack` : `دفع $${order.price || 1.19} وتوليد الحزمة`}</span>
                </>
              )}
            </button>
          </form>

          {/* Security footer */}
          <div className="flex items-center justify-center space-x-3 text-[10px] text-slate-400 pt-1">
            <span className="flex items-center space-x-1">
              <Lock className="w-3 h-3 text-slate-500" />
              <span>TLS 1.3 / 256-Bit SSL</span>
            </span>
            <span>•</span>
            <span>PCI-DSS Level 1</span>
            <span>•</span>
            <span>ZolnaPay Verified</span>
          </div>

        </div>

      </div>
    </div>
  );
};

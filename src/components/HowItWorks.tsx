import React from 'react';
import { Camera, CreditCard, MessageSquare } from 'lucide-react';

interface HowItWorksProps {
  lang: 'en' | 'ar';
}

export const HowItWorks: React.FC<HowItWorksProps> = ({ lang }) => {
  const steps = [
    {
      number: '1',
      title: lang === 'en' ? 'Upload your selfie' : 'ارفع صورة سيلفي',
      description:
        lang === 'en'
          ? 'Use any clear photo where your face is visible. We use AI to extract your facial features and style.'
          : 'استخدم أي صورة واضحة يظهر فيها وجهك بوضوح لتحليل ملامحك المميزة.',
      icon: Camera,
      badge: lang === 'en' ? 'Step 1' : 'الخطوة ١',
    },
    {
      number: '2',
      title: lang === 'en' ? 'AI Generation & $2.99' : 'التوليد بالذكاء الاصطناعي',
      description:
        lang === 'en'
          ? 'Quick, one-time payment. We generate your 12 unique sticker expressions.'
          : 'دفع لمرة واحدة، ونقوم بإنشاء 12 تعبيراً مميزاً خاصاً بك.',
      icon: CreditCard,
      badge: lang === 'en' ? 'Step 2' : 'الخطوة ٢',
    },
    {
      number: '3',
      title: lang === 'en' ? 'Direct WhatsApp Delivery' : 'استلام فوري على واتساب',
      description:
        lang === 'en'
          ? 'Stickers are formatted to WhatsApp 512x512 specs and sent straight to your chat.'
          : 'تصل الملصقات الجاهزة متوافقة تماماً وبخلفية شفافة مباشرة لمحادثة واتساب.',
      icon: MessageSquare,
      badge: lang === 'en' ? 'Step 3' : 'الخطوة ٣',
    },
  ];

  return (
    <section className="py-14 bg-white border-b border-slate-200/80">
      <div className="max-w-6xl mx-auto px-4 sm:px-8">
        <div className="text-center max-w-xl mx-auto mb-10">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            {lang === 'en' ? 'Simple 3-Step Process' : '٣ خطوات بسيطة'}
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-1">
            {lang === 'en' ? 'How It Works' : 'كيف تعمل الخدمة؟'}
          </h2>
          <p className="text-sm sm:text-base text-slate-500 mt-2">
            {lang === 'en' ? 'Turn your photo into WhatsApp stickers in three easy steps' : 'من صورتك إلى ملصقات واتساب بدقائق'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <div
                key={step.number}
                className="relative bg-slate-50/70 hover:bg-white rounded-2xl p-6 border border-slate-200 shadow-xs hover:shadow-md transition-all flex flex-col items-start"
              >
                <div className="flex items-center justify-between w-full mb-4">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                    {step.number}
                  </div>
                </div>

                <h3 className="text-base font-bold text-slate-900 mb-1.5">{step.title}</h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">{step.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};


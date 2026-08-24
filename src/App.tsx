import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar.js';
import { Hero } from './components/Hero.js';
import { HowItWorks } from './components/HowItWorks.js';
import { OrderForm } from './components/OrderForm.js';
import { OrderStatusView } from './components/OrderStatusView.js';
import { Footer } from './components/Footer.js';
import { Order, StickerStyleId } from './types/index.js';

export default function App() {
  const [lang, setLang] = useState<'en' | 'ar'>('ar'); // Default to Arabic
  const [selectedStyle, setSelectedStyle] = useState<StickerStyleId>('fun_expressive');
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);

  // Parse path or query for existing order id
  useEffect(() => {
    const path = window.location.pathname;
    const urlParams = new URLSearchParams(window.location.search);
    
    // Check if path is /order/:id or query has orderId
    const match = path.match(/\/order\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      setActiveOrderId(match[1]);
    } else if (urlParams.get('orderId')) {
      setActiveOrderId(urlParams.get('orderId'));
    }
  }, []);

  const handleOrderCreated = (order: Order) => {
    setActiveOrderId(order.id);
    window.history.pushState({}, '', `/order/${order.id}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBackToHome = () => {
    setActiveOrderId(null);
    window.history.pushState({}, '', '/');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const scrollToOrder = () => {
    const el = document.getElementById('order-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const toggleLanguage = () => {
    setLang(prev => (prev === 'en' ? 'ar' : 'en'));
  };

  return (
    <div 
      dir={lang === 'ar' ? 'rtl' : 'ltr'} 
      className={`min-h-screen bg-[#030014] text-slate-100 font-sans selection:bg-indigo-500/30 selection:text-white bg-grid-pattern ${
        lang === 'ar' ? 'font-arabic' : ''
      }`}
    >
      {/* Ambient background glows */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full blur-[160px] pointer-events-none ambient-purple opacity-40 -translate-y-1/2" />
      <div className="absolute top-1/3 right-1/4 w-[500px] h-[500px] rounded-full blur-[140px] pointer-events-none ambient-cyan opacity-30" />

      {/* Navigation */}
      <Navbar
        onScrollToOrder={scrollToOrder}
        onOpenAdmin={() => {}}
        onOpenPrivacy={() => {}}
        lang={lang}
        onToggleLang={toggleLanguage}
      />

      {/* Main View: Order Status vs Homepage */}
      {activeOrderId ? (
        <OrderStatusView
          orderId={activeOrderId}
          lang={lang}
          onBackToHome={handleBackToHome}
        />
      ) : (
        <main className="relative z-10">
          {/* Hero Section */}
          <Hero
            onStartOrder={scrollToOrder}
            lang={lang}
          />

          {/* Minimal 3-Step How It Works */}
          <HowItWorks lang={lang} />

          {/* Main Order Form */}
          <OrderForm
            lang={lang}
            selectedStyle={selectedStyle}
            onStyleChange={setSelectedStyle}
            onOrderCreated={handleOrderCreated}
            onOpenPrivacy={() => {}}
          />
        </main>
      )}

      {/* Footer */}
      <Footer
        onOpenLegal={() => {}}
        onScrollToTop={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        lang={lang}
      />
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar.js';
import { Hero } from './components/Hero.js';
import { HowItWorks } from './components/HowItWorks.js';
import { DemoShowcase } from './components/DemoShowcase.js';
import { OrderForm } from './components/OrderForm.js';
import { OrderStatusView } from './components/OrderStatusView.js';
import { AdminDashboard } from './components/AdminDashboard.js';
import { LegalModals, LegalModalType } from './components/LegalModals.js';
import { Footer } from './components/Footer.js';
import { Order, StickerStyleId } from './types/index.js';

export default function App() {
  const [lang, setLang] = useState<'en' | 'ar'>('en');
  const [selectedStyle, setSelectedStyle] = useState<StickerStyleId>('fun_expressive');
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [legalModalType, setLegalModalType] = useState<LegalModalType>(null);

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

    if (path === '/admin' || urlParams.get('admin') === 'true') {
      setIsAdminOpen(true);
    }
  }, []);

  // Update URL history when viewing order
  const handleOrderCreated = (order: Order, checkoutUrl?: string) => {
    setActiveOrderId(order.id);
    window.history.pushState({}, '', `/order/${order.id}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // If external checkout url provided and not mock, navigate
    if (checkoutUrl && !checkoutUrl.includes('mock_payment_id')) {
      window.location.href = checkoutUrl;
    }
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
      className={`min-h-screen bg-white text-slate-900 font-sans selection:bg-emerald-100 selection:text-emerald-900 ${
        lang === 'ar' ? 'font-arabic' : ''
      }`}
    >
      {/* Navigation */}
      <Navbar
        onScrollToOrder={scrollToOrder}
        onOpenAdmin={() => setIsAdminOpen(true)}
        onOpenPrivacy={() => setLegalModalType('privacy')}
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
        <main>
          {/* Hero Section with Before/After Demo */}
          <Hero
            onStartOrder={scrollToOrder}
            lang={lang}
          />

          {/* Minimal 3-Step How It Works */}
          <HowItWorks lang={lang} />

          {/* 12 Expressions Demo Showcase */}
          <DemoShowcase
            lang={lang}
            onSelectStyle={(styleId) => {
              setSelectedStyle(styleId);
              scrollToOrder();
            }}
          />

          {/* Main Order Form (Upload -> Style -> Phone -> $2.99 Checkout) */}
          <OrderForm
            lang={lang}
            selectedStyle={selectedStyle}
            onStyleChange={setSelectedStyle}
            onOrderCreated={handleOrderCreated}
            onOpenPrivacy={() => setLegalModalType('privacy')}
          />
        </main>
      )}

      {/* Footer */}
      <Footer
        onOpenLegal={(type) => setLegalModalType(type)}
        onScrollToTop={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        lang={lang}
      />

      {/* Admin Dashboard Modal */}
      {isAdminOpen && (
        <AdminDashboard
          onClose={() => setIsAdminOpen(false)}
          onViewOrder={(orderId) => {
            setActiveOrderId(orderId);
            window.history.pushState({}, '', `/order/${orderId}`);
          }}
        />
      )}

      {/* Legal Policies Modal */}
      <LegalModals
        type={legalModalType}
        onClose={() => setLegalModalType(null)}
      />
    </div>
  );
}

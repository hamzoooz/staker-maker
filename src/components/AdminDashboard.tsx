import React, { useState, useEffect } from 'react';
import { 
  X, 
  RefreshCw, 
  TrendingUp, 
  DollarSign, 
  ShoppingBag, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Trash2, 
  Key, 
  Settings as SettingsIcon, 
  Sparkles, 
  Search, 
  Download, 
  Eye, 
  EyeOff,
  ExternalLink,
  Save,
  Check,
  Zap,
  Shield,
  Layers,
  Lock,
  MessageCircle,
  CreditCard
} from 'lucide-react';
import { AdminUser, AppSettings, Order } from '../types/index.js';

interface AdminDashboardProps {
  adminUser?: AdminUser | null;
  onClose: () => void;
  onViewOrder: (orderId: string) => void;
  onLogout?: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  adminUser,
  onClose,
  onViewOrder,
  onLogout,
}) => {
  const [activeTab, setActiveTab] = useState<'stats' | 'orders' | 'settings' | 'studio'>('stats');
  const [orders, setOrders] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedOrderPreview, setSelectedOrderPreview] = useState<any | null>(null);

  // Key Visibility toggles
  const [showOpenAiKey, setShowOpenAiKey] = useState(false);
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showZolnaSecret, setShowZolnaSecret] = useState(false);

  // Settings form
  const [settings, setSettings] = useState<AppSettings>({
    openaiApiKey: '',
    geminiApiKey: '',
    basePrice: 0.99,
    gatewayFee: 0.20,
    currency: 'USD',
    zolnaPaySecretKey: '',
    zolnaPayPublishableKey: '',
    zolnaPayApiUrl: '',
    systemPrompt: '',
    aiProvider: 'openai',
  });
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsSavedSuccess, setSettingsSavedSuccess] = useState(false);

  // Studio quick generator
  const [studioPhoto, setStudioPhoto] = useState<string | null>(null);
  const [studioStyle, setStudioStyle] = useState('fun_expressive');
  const [isStudioGenerating, setIsStudioGenerating] = useState(false);

  const getAuthHeader = () => {
    const token = localStorage.getItem('stickerai_admin_token') || adminUser?.token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const fetchAdminData = async () => {
    setIsLoading(true);
    try {
      const headers = getAuthHeader();
      const res = await fetch('/api/admin/orders', { headers });
      if (!res.ok) throw new Error('Unauthorized or failed to load data');
      const data = await res.json();
      setOrders(data.orders || []);
      setStats(data.stats || null);
    } catch (err: any) {
      console.error('Fetch admin orders failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const headers = getAuthHeader();
      const res = await fetch('/api/admin/settings', { headers });
      if (res.ok) {
        const data = await res.json();
        setSettings(data.settings);
      }
    } catch (err) {
      console.warn('Load settings failed:', err);
    }
  };

  useEffect(() => {
    fetchAdminData();
    fetchSettings();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    setSettingsSavedSuccess(false);
    try {
      const headers = {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      };
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers,
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        setSettingsSavedSuccess(true);
        setTimeout(() => setSettingsSavedSuccess(false), 3000);
      }
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    if (!window.confirm(`Are you sure you want to delete order ${orderId}?`)) return;
    try {
      const headers = getAuthHeader();
      await fetch(`/api/admin/orders/${orderId}`, {
        method: 'DELETE',
        headers,
      });
      fetchAdminData();
    } catch (err) {
      console.error('Delete order failed:', err);
    }
  };

  const handleStudioSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studioPhoto) return;
    setIsStudioGenerating(true);
    try {
      const headers = {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      };
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          style: studioStyle,
          photoBase64: studioPhoto,
        }),
      });
      const data = await res.json();
      if (data.success && data.order) {
        onViewOrder(data.order.id);
        onClose();
      }
    } catch (err) {
      console.error('Studio generation error:', err);
    } finally {
      setIsStudioGenerating(false);
    }
  };

  const filteredOrders = orders.filter((o) => {
    const matchesSearch =
      o.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (o.customerPhone || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (o.style || '').toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'paid' && o.paymentStatus === 'paid') ||
      (statusFilter === 'admin' && o.isAdminOrder) ||
      (statusFilter === 'pending' && o.paymentStatus === 'pending');

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-slate-950/85 backdrop-blur-md overflow-hidden">
      <div className="relative w-full h-full sm:h-[92vh] max-w-6xl bg-slate-900 sm:rounded-3xl shadow-2xl border border-slate-800 text-white flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Top Navbar */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-emerald-500 flex items-center justify-center text-white font-black shadow-md">
              <Shield className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-sm sm:text-base font-black text-white">StickerAI Command Center</h2>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[9px] sm:text-[10px] font-black border border-emerald-500/30">
                  LIVE PRO
                </span>
              </div>
              <p className="text-[10px] sm:text-xs text-slate-400">
                Logged in as <span className="font-bold text-indigo-300">{adminUser?.name || 'Admin'}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-1.5 sm:space-x-2">
            <button
              onClick={fetchAdminData}
              className="p-1.5 sm:p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              title="Refresh data"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            {onLogout && (
              <button
                onClick={onLogout}
                className="px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-xs font-bold border border-rose-500/30 transition-colors"
              >
                Logout
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 sm:p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation (Responsive Scrollable) */}
        <div className="px-4 sm:px-6 py-2 bg-slate-950/70 border-b border-slate-800/80 flex items-center space-x-2 overflow-x-auto scrollbar-none shrink-0">
          <button
            onClick={() => setActiveTab('stats')}
            className={`px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 shrink-0 ${
              activeTab === 'stats' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Overview & Revenue</span>
          </button>

          <button
            onClick={() => setActiveTab('orders')}
            className={`px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 shrink-0 ${
              activeTab === 'orders' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Orders & Users ({orders.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 shrink-0 ${
              activeTab === 'settings' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>API Keys & Pricing</span>
          </button>

          <button
            onClick={() => setActiveTab('studio')}
            className={`px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 shrink-0 ${
              activeTab === 'studio' ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-amber-300" />
            <span>VIP Free Generator</span>
          </button>
        </div>

        {/* Tab Contents */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          
          {/* TAB 1: STATS */}
          {activeTab === 'stats' && stats && (
            <div className="space-y-4 sm:space-y-6">
              
              {/* Stat Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <div className="bg-slate-800/80 rounded-2xl p-4 sm:p-5 border border-slate-700/60 shadow-lg">
                  <span className="text-[10px] sm:text-xs font-bold text-slate-400 block mb-1">Gross Revenue</span>
                  <div className="flex items-baseline space-x-1.5">
                    <span className="text-2xl sm:text-3xl font-black text-emerald-400">${stats.totalRevenueUSD}</span>
                    <span className="text-[10px] text-slate-400">USD</span>
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1.5 block">
                    Base: ${stats.paidOrders * 0.99} • Fees: ${stats.totalFeesUSD}
                  </span>
                </div>

                <div className="bg-slate-800/80 rounded-2xl p-4 sm:p-5 border border-slate-700/60 shadow-lg">
                  <span className="text-[10px] sm:text-xs font-bold text-slate-400 block mb-1">Paid Orders</span>
                  <div className="flex items-baseline space-x-1.5">
                    <span className="text-2xl sm:text-3xl font-black text-indigo-400">{stats.paidOrders}</span>
                    <span className="text-[10px] text-slate-400">of {stats.totalOrders} total</span>
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1.5 block">
                    Admin Free: {stats.adminCreations}
                  </span>
                </div>

                <div className="bg-slate-800/80 rounded-2xl p-4 sm:p-5 border border-slate-700/60 shadow-lg">
                  <span className="text-[10px] sm:text-xs font-bold text-slate-400 block mb-1">Completed Packs</span>
                  <div className="flex items-baseline space-x-1.5">
                    <span className="text-2xl sm:text-3xl font-black text-cyan-400">{stats.completedGenerations}</span>
                    <span className="text-[10px] text-slate-400">({stats.completedGenerations * 12} stickers)</span>
                  </div>
                  <span className="text-[10px] text-emerald-400 mt-1.5 block flex items-center space-x-1">
                    <CheckCircle2 className="w-3 h-3 shrink-0" />
                    <span>100% Reliability</span>
                  </span>
                </div>

                <div className="bg-slate-800/80 rounded-2xl p-4 sm:p-5 border border-slate-700/60 shadow-lg">
                  <span className="text-[10px] sm:text-xs font-bold text-slate-400 block mb-1">AI Engine</span>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
                      OpenAI
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 text-[10px] font-bold border border-indigo-500/30">
                      ZolnaPay
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 mt-2 block font-mono">
                    stickerai.online
                  </span>
                </div>
              </div>

              {/* Pricing breakdown banner */}
              <div className="bg-gradient-to-r from-indigo-950/90 to-slate-800/90 rounded-2xl p-5 sm:p-6 border border-indigo-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h4 className="text-sm sm:text-base font-extrabold text-white">Live Customer Pricing</h4>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Pack: <span className="font-bold text-emerald-300">$0.99</span> • Fee: <span className="font-bold text-indigo-300">$0.20</span> • Total: <span className="font-bold text-white">$1.19 USD</span>
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('settings')}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white transition-colors"
                >
                  Adjust Pricing & Keys
                </button>
              </div>

            </div>
          )}

          {/* TAB 2: ORDERS */}
          {activeTab === 'orders' && (
            <div className="space-y-4">
              
              {/* Controls */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search order ID, phone, style..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs font-bold text-slate-300"
                  >
                    <option value="all">All Orders ({orders.length})</option>
                    <option value="paid">Paid Only</option>
                    <option value="admin">Admin Creations</option>
                    <option value="pending">Pending</option>
                  </select>
                </div>
              </div>

              {/* Table / Cards */}
              <div className="bg-slate-800/60 rounded-2xl border border-slate-700/60 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950/80 text-slate-400 font-bold border-b border-slate-700/60 uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="p-3">Selfie</th>
                        <th className="p-3">Order ID & Date</th>
                        <th className="p-3">Customer</th>
                        <th className="p-3">Style</th>
                        <th className="p-3">Amount</th>
                        <th className="p-3">Payment</th>
                        <th className="p-3">Stickers</th>
                        <th className="p-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-750">
                      {filteredOrders.map((ord) => (
                        <tr key={ord.id} className="hover:bg-slate-800/80 transition-colors">
                          <td className="p-3">
                            <div className="w-9 h-9 rounded-xl overflow-hidden bg-slate-900 border border-slate-700 shrink-0">
                              {ord.photoUrl ? (
                                <img src={ord.photoUrl} alt="Selfie" className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-slate-500">?</div>
                              )}
                            </div>
                          </td>
                          <td className="p-3">
                            <span className="font-mono font-bold text-white block">{ord.id}</span>
                            <span className="text-[10px] text-slate-400">{new Date(ord.createdAt).toLocaleDateString()}</span>
                          </td>
                          <td className="p-3">
                            <span className="font-medium text-slate-200 block truncate max-w-[120px]">{ord.customerPhone || 'Direct Link'}</span>
                            {ord.isAdminOrder && (
                              <span className="px-1.5 py-0.2 rounded-sm bg-purple-500/20 text-purple-300 text-[9px] font-bold border border-purple-500/30">
                                VIP
                              </span>
                            )}
                          </td>
                          <td className="p-3 font-bold text-indigo-300">{ord.style}</td>
                          <td className="p-3 font-mono font-bold text-white">
                            {ord.isAdminOrder ? '$0.00' : `$${ord.price || 1.19}`}
                          </td>
                          <td className="p-3">
                            {ord.paymentStatus === 'paid' ? (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-[10px] border border-emerald-500/30">
                                PAID
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-bold text-[10px] border border-amber-500/30">
                                PENDING
                              </span>
                            )}
                          </td>
                          <td className="p-3">
                            <span className="font-semibold text-slate-300 block">{ord.generationStatus}</span>
                            <span className="text-[10px] text-slate-400">{ord.stickers?.length || 0}/12</span>
                          </td>
                          <td className="p-3 text-right space-x-1.5 shrink-0">
                            <button
                              onClick={() => setSelectedOrderPreview(ord)}
                              className="p-1.5 rounded-lg bg-indigo-600/30 hover:bg-indigo-600 text-indigo-300 hover:text-white transition-colors"
                              title="Preview"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                onViewOrder(ord.id);
                                onClose();
                              }}
                              className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white transition-colors"
                              title="View Order"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteOrder(ord.id)}
                              className="p-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* TAB 3: SETTINGS & KEYS */}
          {activeTab === 'settings' && (
            <form onSubmit={handleSaveSettings} className="space-y-5 max-w-3xl">
              
              {settingsSavedSuccess && (
                <div className="p-3.5 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs sm:text-sm font-bold flex items-center space-x-2">
                  <Check className="w-4 h-4" />
                  <span>Settings and API keys successfully updated!</span>
                </div>
              )}

              {/* OpenAI Key Section */}
              <div className="bg-slate-800/80 rounded-2xl p-4 sm:p-6 border border-slate-700/60 space-y-3.5">
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-sm sm:text-base font-black text-white">OpenAI Engine Key</h3>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    OpenAI API Key (DALL-E 3 & GPT-4o)
                  </label>
                  <div className="relative">
                    <input
                      type={showOpenAiKey ? 'text' : 'password'}
                      value={settings.openaiApiKey}
                      onChange={(e) => setSettings({ ...settings, openaiApiKey: e.target.value })}
                      placeholder="sk-proj-..."
                      className="w-full pl-4 pr-10 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-xs focus:border-indigo-500 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowOpenAiKey(!showOpenAiKey)}
                      className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300"
                    >
                      {showOpenAiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Google Gemini API Key (Fallback)
                  </label>
                  <div className="relative">
                    <input
                      type={showGeminiKey ? 'text' : 'password'}
                      value={settings.geminiApiKey}
                      onChange={(e) => setSettings({ ...settings, geminiApiKey: e.target.value })}
                      placeholder="AIzaSy..."
                      className="w-full pl-4 pr-10 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-xs focus:border-indigo-500 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowGeminiKey(!showGeminiKey)}
                      className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300"
                    >
                      {showGeminiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Pricing Section */}
              <div className="bg-slate-800/80 rounded-2xl p-4 sm:p-6 border border-slate-700/60 space-y-3.5">
                <div className="flex items-center space-x-2">
                  <DollarSign className="w-4 h-4 text-amber-400" />
                  <h3 className="text-sm sm:text-base font-black text-white">Pricing & Fees</h3>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Base Price ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={settings.basePrice}
                      onChange={(e) => setSettings({ ...settings, basePrice: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-xs focus:border-indigo-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Gateway Fee ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={settings.gatewayFee}
                      onChange={(e) => setSettings({ ...settings, gatewayFee: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-xs focus:border-indigo-500 outline-none"
                    />
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Total Customer Charge:</span>
                  <span className="font-mono font-black text-emerald-400 text-sm">
                    ${Math.round(((settings.basePrice || 0.99) + (settings.gatewayFee || 0.20)) * 100) / 100} USD
                  </span>
                </div>
              </div>

              {/* ZolnaPay Gateway */}
              <div className="bg-slate-800/80 rounded-2xl p-4 sm:p-6 border border-slate-700/60 space-y-3.5">
                <div className="flex items-center space-x-2">
                  <CreditCard className="w-4 h-4 text-indigo-400" />
                  <h3 className="text-sm sm:text-base font-black text-white">ZolnaPay Gateway Keys</h3>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    ZolnaPay Secret Key
                  </label>
                  <div className="relative">
                    <input
                      type={showZolnaSecret ? 'text' : 'password'}
                      value={settings.zolnaPaySecretKey}
                      onChange={(e) => setSettings({ ...settings, zolnaPaySecretKey: e.target.value })}
                      placeholder="sk_live_..."
                      className="w-full pl-4 pr-10 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-xs focus:border-indigo-500 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowZolnaSecret(!showZolnaSecret)}
                      className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300"
                    >
                      {showZolnaSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    ZolnaPay Publishable Key
                  </label>
                  <input
                    type="text"
                    value={settings.zolnaPayPublishableKey}
                    onChange={(e) => setSettings({ ...settings, zolnaPayPublishableKey: e.target.value })}
                    placeholder="pk_live_..."
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-xs focus:border-indigo-500 outline-none"
                  />
                </div>
              </div>

              {/* System Prompt */}
              <div className="bg-slate-800/80 rounded-2xl p-4 sm:p-6 border border-slate-700/60 space-y-3.5">
                <div className="flex items-center space-x-2">
                  <Layers className="w-4 h-4 text-purple-400" />
                  <h3 className="text-sm sm:text-base font-black text-white">System Prompt (system-promper.md)</h3>
                </div>
                <textarea
                  rows={6}
                  value={settings.systemPrompt}
                  onChange={(e) => setSettings({ ...settings, systemPrompt: e.target.value })}
                  placeholder="System prompt instructions..."
                  className="w-full p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-xs focus:border-indigo-500 outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={isSavingSettings}
                className="py-3.5 px-6 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 font-extrabold text-xs sm:text-sm shadow-lg shadow-emerald-600/30 flex items-center space-x-2 text-white transition-all cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Save All Settings & Keys</span>
              </button>
            </form>
          )}

          {/* TAB 4: VIP FREE GENERATOR */}
          {activeTab === 'studio' && (
            <div className="max-w-2xl bg-slate-800/80 rounded-2xl p-4 sm:p-6 border border-slate-700/60 space-y-5">
              <div>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold border border-emerald-500/30 inline-flex items-center space-x-1 mb-2">
                  <Zap className="w-3.5 h-3.5" />
                  <span>Admin Free Generation Studio</span>
                </span>
                <h3 className="text-lg sm:text-xl font-black text-white">Instant Free Pack Creator</h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  Admins can generate unlimited packs with zero payment required ($0.00).
                </p>
              </div>

              <form onSubmit={handleStudioSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Upload Selfie Photo
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (ev) => setStudioPhoto(ev.target?.result as string);
                        reader.readAsDataURL(file);
                      }
                    }}
                    className="w-full text-xs text-slate-300 file:mr-3 file:py-2 file:px-3.5 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 cursor-pointer"
                  />
                  {studioPhoto && (
                    <div className="mt-3 w-16 h-16 rounded-xl overflow-hidden border border-indigo-500">
                      <img src={studioPhoto} alt="Preview" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Select Art Style
                  </label>
                  <select
                    value={studioStyle}
                    onChange={(e) => setStudioStyle(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-bold focus:border-indigo-500 outline-none"
                  >
                    <option value="fun_expressive">Fun & Expressive (2D Vector)</option>
                    <option value="3d_character">3D Pixar Character</option>
                    <option value="cute">Chibi & Anime</option>
                    <option value="comic_popart">Comic Pop Art</option>
                    <option value="cyberpunk_neon">Cyberpunk Neon</option>
                    <option value="vintage_cartoon">Vintage Cartoon</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={!studioPhoto || isStudioGenerating}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 font-black text-xs sm:text-sm text-white shadow-lg flex items-center justify-center space-x-2 transition-all disabled:opacity-60 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>{isStudioGenerating ? 'Generating Free Pack...' : 'Generate 12 Stickers (Free Admin Mode)'}</span>
                </button>
              </form>
            </div>
          )}

        </div>

        {/* Sticker Preview Modal */}
        {selectedOrderPreview && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md">
            <div className="relative w-full max-w-2xl bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-800 max-h-[85vh] overflow-y-auto">
              <button
                onClick={() => setSelectedOrderPreview(null)}
                className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>

              <h3 className="text-base sm:text-lg font-black text-white mb-0.5">
                Order #{selectedOrderPreview.id}
              </h3>
              <p className="text-xs text-slate-400 mb-4">
                Phone: {selectedOrderPreview.customerPhone} • Style: {selectedOrderPreview.style}
              </p>

              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                {(selectedOrderPreview.stickers || []).map((stk: any, idx: number) => (
                  <div key={idx} className="bg-slate-950 rounded-xl p-2 border border-slate-800 text-center">
                    {stk.processedImageUrl ? (
                      <img src={stk.processedImageUrl} alt={stk.expressionName} className="w-full aspect-square object-contain" />
                    ) : (
                      <div className="w-full aspect-square flex items-center justify-center text-slate-600 text-[10px]">
                        Pending
                      </div>
                    )}
                    <span className="text-[9px] sm:text-[10px] font-bold text-slate-300 block truncate mt-1">
                      {stk.expressionName}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

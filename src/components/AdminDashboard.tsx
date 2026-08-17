import React, { useEffect, useState } from 'react';
import { 
  Lock, 
  Search, 
  RefreshCw, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Eye, 
  MessageCircle, 
  Sparkles, 
  RotateCcw, 
  DollarSign,
  Send,
  X,
  ExternalLink
} from 'lucide-react';
import { Order } from '../types/index.js';

interface AdminDashboardProps {
  onClose: () => void;
  onViewOrder: (orderId: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onClose, onViewOrder }) => {
  const [adminKey, setAdminKey] = useState('stickerme-admin-2025');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Fetch admin orders
  const fetchOrders = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/admin/orders?key=${encodeURIComponent(adminKey)}`);
      if (res.status === 401) {
        setIsAuthenticated(false);
        return;
      }
      const data = await res.json();
      setOrders(data.orders || []);
      setStats(data.stats || null);
      setIsAuthenticated(true);
    } catch (e) {
      console.error('Failed to fetch admin data:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    fetchOrders();
  };

  // Retry generation
  const handleRetryGen = async (orderId: string) => {
    try {
      await fetch(`/api/orders/${orderId}/retry`, { method: 'POST' });
      setActionMessage(`Re-queued generation for order #${orderId}`);
      fetchOrders();
    } catch (e) {
      console.error(e);
    }
  };

  // Retry WhatsApp delivery
  const handleRetryDelivery = async (orderId: string) => {
    try {
      await fetch(`/api/orders/${orderId}/deliver`, { method: 'POST' });
      setActionMessage(`Re-attempted WhatsApp delivery for order #${orderId}`);
      fetchOrders();
    } catch (e) {
      console.error(e);
    }
  };

  // Filter orders
  const filteredOrders = orders.filter((ord) => {
    const matchesSearch =
      ord.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ord.customerPhone.includes(searchQuery);

    if (statusFilter === 'paid') return matchesSearch && ord.paymentStatus === 'paid';
    if (statusFilter === 'pending') return matchesSearch && ord.paymentStatus === 'pending';
    if (statusFilter === 'completed') return matchesSearch && ord.generationStatus === 'completed';
    if (statusFilter === 'delivered') return matchesSearch && ord.deliveryStatus === 'delivered';

    return matchesSearch;
  });

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-5xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Top Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900 text-white">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">StickerMe AI Admin Console</h3>
              <p className="text-[11px] text-slate-400">Order Management & Monitoring</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        {!isAuthenticated ? (
          <div className="p-12 text-center max-w-md mx-auto space-y-4">
            <Lock className="w-10 h-10 text-slate-400 mx-auto" />
            <h4 className="text-lg font-bold text-slate-900">Admin Authentication</h4>
            <p className="text-xs text-slate-500">
              Enter your admin secret key to access order operations.
            </p>
            <form onSubmit={handleLogin} className="space-y-3">
              <input
                type="password"
                value={adminKey}
                onChange={(e) => setAdminKey(e.target.value)}
                placeholder="Admin Secret Key"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-indigo-500"
              />
              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-500 cursor-pointer shadow-xs"
              >
                Access Dashboard
              </button>
            </form>
          </div>
        ) : (
          <div className="p-6 overflow-y-auto space-y-6 flex-1">
            
            {/* Stats Cards */}
            {stats && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-xs text-slate-500 font-medium">Total Orders</span>
                  <p className="text-2xl font-extrabold text-slate-900">{stats.totalOrders}</p>
                </div>
                <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200">
                  <span className="text-xs text-emerald-800 font-medium">Paid Orders</span>
                  <p className="text-2xl font-extrabold text-emerald-900">{stats.paidOrders}</p>
                </div>
                <div className="p-4 rounded-xl bg-indigo-50/60 border border-indigo-200">
                  <span className="text-xs text-indigo-700 font-medium">Stickers Completed</span>
                  <p className="text-2xl font-extrabold text-indigo-900">{stats.completedGenerations}</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-900 text-white border border-slate-800">
                  <span className="text-xs text-slate-400 font-medium">Total Revenue</span>
                  <p className="text-2xl font-extrabold text-white">${stats.totalRevenueUSD.toFixed(2)}</p>
                </div>
              </div>
            )}

            {/* Action feedback */}
            {actionMessage && (
              <div className="p-3 rounded-xl bg-emerald-50 text-emerald-800 text-xs font-semibold flex items-center justify-between border border-emerald-200">
                <span>{actionMessage}</span>
                <button onClick={() => setActionMessage(null)} className="cursor-pointer">✕</button>
              </div>
            )}

            {/* Filters Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search Order ID or Phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-indigo-500"
                />
              </div>

              <div className="flex items-center space-x-2 w-full sm:w-auto overflow-x-auto">
                {['all', 'paid', 'pending', 'completed', 'delivered'].map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setStatusFilter(filter)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-colors cursor-pointer ${
                      statusFilter === filter
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {filter}
                  </button>
                ))}

                <button
                  onClick={fetchOrders}
                  className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
                  title="Refresh"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Orders Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-700">
                      <th className="p-3">Order ID</th>
                      <th className="p-3">Date</th>
                      <th className="p-3">WhatsApp Number</th>
                      <th className="p-3">Style</th>
                      <th className="p-3">Payment</th>
                      <th className="p-3">Generation</th>
                      <th className="p-3">Delivery</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredOrders.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-slate-400">
                          No orders found matching criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredOrders.map((ord) => (
                        <tr key={ord.id} className="hover:bg-slate-50/70">
                          <td className="p-3 font-mono font-bold text-slate-900">{ord.id}</td>
                          <td className="p-3 text-slate-500">
                            {new Date(ord.createdAt).toLocaleDateString()}
                          </td>
                          <td className="p-3 font-mono font-semibold text-slate-800">
                            {ord.customerPhone}
                          </td>
                          <td className="p-3 capitalize">{ord.style.replace('_', ' ')}</td>
                          <td className="p-3">
                            <span
                              className={`px-2 py-0.5 rounded-md font-bold uppercase text-[10px] ${
                                ord.paymentStatus === 'paid'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {ord.paymentStatus} (${ord.price})
                            </span>
                          </td>
                          <td className="p-3">
                            <span
                              className={`px-2 py-0.5 rounded-md font-bold uppercase text-[10px] ${
                                ord.generationStatus === 'completed'
                                  ? 'bg-indigo-100 text-indigo-800'
                                  : ord.generationStatus === 'failed'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {ord.generationStatus}
                            </span>
                          </td>
                          <td className="p-3">
                            <span
                              className={`px-2 py-0.5 rounded-md font-bold uppercase text-[10px] ${
                                ord.deliveryStatus === 'delivered'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {ord.deliveryStatus}
                            </span>
                          </td>
                          <td className="p-3 text-right space-x-1">
                            <button
                              onClick={() => {
                                onViewOrder(ord.id);
                                onClose();
                              }}
                              className="px-2 py-1 rounded bg-slate-900 text-white font-bold hover:bg-slate-800 cursor-pointer"
                              title="View Customer Order Status Page"
                            >
                              <Eye className="w-3.5 h-3.5 inline mr-1" />
                              View
                            </button>
                            <button
                              onClick={() => handleRetryGen(ord.id)}
                              className="px-2 py-1 rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-bold cursor-pointer"
                              title="Retry Generation"
                            >
                              <RotateCcw className="w-3.5 h-3.5 inline" />
                            </button>
                            <button
                              onClick={() => handleRetryDelivery(ord.id)}
                              className="px-2 py-1 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold cursor-pointer"
                              title="Retry WhatsApp Dispatch"
                            >
                              <Send className="w-3.5 h-3.5 inline" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
};

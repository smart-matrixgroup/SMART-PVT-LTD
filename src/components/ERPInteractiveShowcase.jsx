import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  LayoutGrid, ShoppingBag, Utensils, Layers, 
  BarChart3, DollarSign, Users, CheckCircle2, 
  Printer, ArrowRight, Sparkles, Plus, AlertTriangle, Clock
} from 'lucide-react';

export default function ERPInteractiveShowcase({ onOpenQuote }) {
  const [activeTab, setActiveTab] = useState('pos');

  // Simulated live POS state
  const [cart, setCart] = useState([
    { id: 1, name: "Signature Burger Meal", qty: 2, price: 1450 },
    { id: 2, name: "Iced Cappuccino", qty: 1, price: 650 },
  ]);

  const sampleProducts = [
    { id: 1, name: "Signature Burger Meal", price: 1450, cat: "Food" },
    { id: 2, name: "Iced Cappuccino", price: 650, cat: "Beverage" },
    { id: 3, name: "Crispy Chicken Sub", price: 1200, cat: "Food" },
    { id: 4, name: "Passion Fruit Mojito", price: 550, cat: "Beverage" },
    { id: 5, name: "Chocolate Lava Cake", price: 750, cat: "Dessert" },
  ];

  const addToCart = (prod) => {
    setCart(prev => {
      const exists = prev.find(item => item.id === prod.id);
      if (exists) {
        return prev.map(item => item.id === prod.id ? { ...item, qty: item.qty + 1 } : item);
      }
      return [...prev, { ...prod, qty: 1 }];
    });
  };

  const subtotal = cart.reduce((acc, item) => acc + (item.price * item.qty), 0);
  const tax = Math.round(subtotal * 0.08); // 8% SSCL/service
  const total = subtotal + tax;

  const tabs = [
    { id: 'pos', name: 'POS Checkout', icon: ShoppingBag },
    { id: 'tables', name: 'Table Map', icon: Utensils },
    { id: 'kot', name: 'Kitchen KOT', icon: Clock },
    { id: 'inventory', name: 'Live Inventory', icon: Layers },
    { id: 'analytics', name: 'Reports & Revenue', icon: BarChart3 },
  ];

  return (
    <section className="py-20 relative overflow-hidden bg-gradient-to-b from-navy-900 to-midnight border-y border-surface-border">
      
      {/* Background Tech Mesh */}
      <div className="absolute inset-0 bg-grid-pattern opacity-10 pointer-events-none" />
      <div className="absolute top-1/2 right-0 w-96 h-96 bg-primary/10 blur-[130px] rounded-full pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/30 text-primary-cyan text-xs font-bold uppercase tracking-wider mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            Flagship Enterprise Platform
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight">
            Run More of Your Business from <span className="gradient-text-cyan">One Smart Platform</span>
          </h2>
          <p className="text-sm sm:text-base text-text-muted mt-3">
            <strong>SMARTORIX ERP & POS</strong> synchronizes touch billing, restaurant floor tables, kitchen queues, multi-store stock depletion, and financial ledgers in real-time.
          </p>
        </div>

        {/* Interactive Module Window Frame */}
        <div className="rounded-3xl glass-card border border-surface-borderHighlight/40 shadow-2xl overflow-hidden bg-navy-950/90">
          
          {/* Top Window Bar with Tabs */}
          <div className="p-4 bg-navy-900/90 border-b border-surface-border flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 mr-3">
                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
              </div>
              <span className="text-xs font-bold text-white tracking-wide flex items-center gap-1.5">
                <LayoutGrid className="w-3.5 h-3.5 text-primary-cyan" /> SMARTORIX Core v2.4 (Live Demo View)
              </span>
            </div>

            {/* Module Switcher Tabs */}
            <div className="flex items-center flex-wrap gap-1 bg-navy-800 p-1 rounded-xl border border-surface-border">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                      isActive 
                        ? 'bg-primary text-white shadow-glow-sm' 
                        : 'text-text-muted hover:text-white hover:bg-surface-card'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {tab.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tab Content Display Area */}
          <div className="p-4 sm:p-6 lg:p-8 min-h-[460px]">
            
            {/* 1. POS TAB */}
            {activeTab === 'pos' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in duration-200">
                
                {/* Product Catalog Column */}
                <div className="lg:col-span-7 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-text-light uppercase tracking-wider">
                      Item Catalog / Fast Touch Menu
                    </span>
                    <span className="text-[11px] text-text-muted">Click any item to add</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {sampleProducts.map((prod) => (
                      <button
                        key={prod.id}
                        onClick={() => addToCart(prod)}
                        className="p-3.5 rounded-2xl bg-navy-800/80 hover:bg-primary/20 border border-surface-border hover:border-primary/50 text-left transition-all group flex flex-col justify-between h-24"
                      >
                        <div>
                          <span className="text-[10px] font-semibold text-primary-cyan uppercase">
                            {prod.cat}
                          </span>
                          <p className="text-xs font-bold text-white group-hover:text-primary-electric transition-colors line-clamp-1 mt-0.5">
                            {prod.name}
                          </p>
                        </div>
                        <div className="flex items-center justify-between pt-2">
                          <span className="text-xs font-bold text-emerald-400">
                            LKR {prod.price.toLocaleString()}
                          </span>
                          <span className="p-1 rounded-md bg-navy-700 text-text-muted group-hover:text-white group-hover:bg-primary">
                            <Plus className="w-3 h-3" />
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Operational Controls Info */}
                  <div className="p-3.5 rounded-2xl bg-navy-800/40 border border-surface-border/60 flex items-center justify-between text-xs text-text-muted">
                    <span>Active Terminal: <strong>Register #01 (Main Bar)</strong></span>
                    <span>Staff PIN: <strong>Active (Cashier 04)</strong></span>
                    <span className="text-emerald-400 font-medium">Cloud Synchronized</span>
                  </div>
                </div>

                {/* Live Order Cart Column */}
                <div className="lg:col-span-5 p-4 rounded-2xl bg-navy-900 border border-surface-border flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between pb-3 border-b border-surface-border">
                      <div>
                        <h4 className="text-xs font-bold text-white">Current Dine-In Ticket</h4>
                        <p className="text-[11px] text-text-muted">Table #04 • Server: Suresh</p>
                      </div>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-primary/20 text-primary-cyan border border-primary/30">
                        Order #1042
                      </span>
                    </div>

                    {/* Cart Items List */}
                    <div className="py-3 space-y-2 max-h-48 overflow-y-auto">
                      {cart.map((item) => (
                        <div key={item.id} className="flex items-center justify-between text-xs py-1 border-b border-surface-border/40">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded bg-navy-800 text-text-light font-bold flex items-center justify-center text-[10px]">
                              {item.qty}x
                            </span>
                            <span className="text-white font-medium">{item.name}</span>
                          </div>
                          <span className="font-bold text-white">
                            LKR {(item.price * item.qty).toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Subtotal & Actions */}
                  <div className="pt-3 border-t border-surface-border space-y-2">
                    <div className="flex justify-between text-xs text-text-muted">
                      <span>Subtotal</span>
                      <span>LKR {subtotal.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-xs text-text-muted">
                      <span>Tax & Service (8%)</span>
                      <span>LKR {tax.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold text-white pt-1 border-t border-surface-border/40">
                      <span>Total Due</span>
                      <span className="text-emerald-400 text-base">LKR {total.toLocaleString()}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2">
                      <button 
                        onClick={() => alert("Simulated KOT sent to Kitchen Thermal Printer!")}
                        className="py-2.5 rounded-xl text-xs font-bold bg-navy-800 hover:bg-navy-700 text-text-light border border-surface-border flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Printer className="w-3.5 h-3.5" /> Send KOT
                      </button>
                      <button 
                        onClick={() => alert(`Bill of LKR ${total.toLocaleString()} settled successfully!`)}
                        className="py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-glow-sm flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Pay / Settle
                      </button>
                    </div>
                  </div>

                </div>

              </div>
            )}

            {/* 2. TABLE MAP TAB */}
            {activeTab === 'tables' && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="flex items-center justify-between pb-2 border-b border-surface-border">
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    Restaurant Dining Floor Layout (Zone A & B)
                  </span>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-400" /> Available</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> Occupied</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-primary" /> Billing</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {[
                    { id: 'T-01', seats: '2 Seats', status: 'Available', time: '-' },
                    { id: 'T-02', seats: '4 Seats', status: 'Occupied', time: '35 mins' },
                    { id: 'T-03', seats: '6 Seats (VIP)', status: 'Occupied', time: '12 mins' },
                    { id: 'T-04', seats: '4 Seats', status: 'Billing', time: '55 mins' },
                    { id: 'T-05', seats: '2 Seats', status: 'Available', time: '-' },
                    { id: 'T-06', seats: '8 Seats (Family)', status: 'Occupied', time: '20 mins' },
                    { id: 'T-07', seats: '4 Seats', status: 'Available', time: '-' },
                    { id: 'T-08', seats: '2 Seats (Outdoor)', status: 'Available', time: '-' },
                  ].map((table) => {
                    const isAvail = table.status === 'Available';
                    const isOcc = table.status === 'Occupied';
                    return (
                      <div 
                        key={table.id}
                        className={`p-4 rounded-2xl border text-left transition-all ${
                          isAvail ? 'bg-navy-800/60 border-emerald-500/30' :
                          isOcc ? 'bg-amber-500/10 border-amber-500/30' :
                          'bg-primary/10 border-primary/40'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-base font-extrabold text-white">{table.id}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isAvail ? 'bg-emerald-500/20 text-emerald-400' :
                            isOcc ? 'bg-amber-500/20 text-amber-400' :
                            'bg-primary/20 text-primary-cyan'
                          }`}>
                            {table.status}
                          </span>
                        </div>
                        <p className="text-xs text-text-muted mt-2">{table.seats}</p>
                        <p className="text-[11px] text-text-muted mt-0.5">Duration: <strong className="text-white">{table.time}</strong></p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 3. KITCHEN KOT TAB */}
            {activeTab === 'kot' && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="flex items-center justify-between pb-2 border-b border-surface-border">
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    Live Kitchen Display System (KDS)
                  </span>
                  <span className="text-xs text-primary-cyan font-semibold">3 Active Cooking Queues</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { ticket: 'KOT #1042', table: 'Table #04', time: '6m ago', items: ['2x Signature Burger Meal (No Mayo)', '1x Iced Cappuccino'], status: 'Cooking' },
                    { ticket: 'KOT #1041', table: 'Table #02', time: '14m ago', items: ['1x Crispy Chicken Sub', '2x Passion Fruit Mojito'], status: 'Ready to Serve' },
                    { ticket: 'KOT #1040', table: 'Table #06', time: '18m ago', items: ['3x Chocolate Lava Cake', '1x Espresso'], status: 'Completed' },
                  ].map((kot) => (
                    <div key={kot.ticket} className="p-4 rounded-2xl bg-navy-900 border border-surface-border space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-white">{kot.ticket}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          kot.status === 'Cooking' ? 'bg-amber-500/20 text-amber-400' :
                          kot.status === 'Ready to Serve' ? 'bg-emerald-500/20 text-emerald-400' :
                          'bg-navy-800 text-text-muted'
                        }`}>
                          {kot.status}
                        </span>
                      </div>
                      <p className="text-xs text-text-muted font-medium">{kot.table} • Sent {kot.time}</p>
                      <ul className="text-xs text-text-light space-y-1 bg-navy-800 p-2.5 rounded-xl">
                        {kot.items.map((it, i) => (
                          <li key={i} className="flex items-start gap-1">
                            <span className="text-primary-cyan">•</span> {it}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 4. LIVE INVENTORY TAB */}
            {activeTab === 'inventory' && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="flex items-center justify-between pb-2 border-b border-surface-border">
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    Real-Time Ingredient & Retail Stock Depletion
                  </span>
                  <span className="text-xs text-amber-400 font-semibold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> 1 Item Below Minimum Threshold
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-navy-800/80 text-text-muted uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="p-3">SKU / Item</th>
                        <th className="p-3">Category</th>
                        <th className="p-3">Current Stock</th>
                        <th className="p-3">Minimum Safety</th>
                        <th className="p-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-border">
                      {[
                        { sku: 'ING-014', name: 'Fresh Burger Buns', cat: 'Bakery', current: '142 Units', min: '50 Units', status: 'Healthy' },
                        { sku: 'ING-088', name: 'Premium Arabica Coffee Beans', cat: 'Beverage', current: '2.4 Kg', min: '5.0 Kg', status: 'Low Stock' },
                        { sku: 'ING-032', name: 'Cheddar Cheese Slices', cat: 'Dairy', current: '320 Slices', min: '100 Slices', status: 'Healthy' },
                        { sku: 'PKG-005', name: 'Eco Delivery Takeaway Boxes', cat: 'Packaging', current: '840 Units', min: '200 Units', status: 'Healthy' },
                      ].map((row) => (
                        <tr key={row.sku} className="hover:bg-navy-800/40">
                          <td className="p-3 font-semibold text-white">{row.name} <span className="text-[10px] text-text-muted font-normal block">{row.sku}</span></td>
                          <td className="p-3 text-text-muted">{row.cat}</td>
                          <td className="p-3 font-bold text-white">{row.current}</td>
                          <td className="p-3 text-text-muted">{row.min}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              row.status === 'Low Stock' 
                                ? 'bg-red-500/20 text-red-400 border border-red-500/30' 
                                : 'bg-emerald-500/20 text-emerald-400'
                            }`}>
                              {row.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 5. ANALYTICS & REVENUE TAB */}
            {activeTab === 'analytics' && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3.5 rounded-2xl bg-navy-800/80 border border-surface-border">
                    <span className="text-[10px] text-text-muted uppercase font-bold">Today's Gross Sales</span>
                    <p className="text-lg sm:text-xl font-extrabold text-white mt-0.5">LKR 184,500</p>
                    <span className="text-[10px] text-emerald-400 font-bold">+18.4% vs last week</span>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-navy-800/80 border border-surface-border">
                    <span className="text-[10px] text-text-muted uppercase font-bold">Orders Processed</span>
                    <p className="text-lg sm:text-xl font-extrabold text-white mt-0.5">92 Bills</p>
                    <span className="text-[10px] text-text-muted">Avg ticket LKR 2,005</span>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-navy-800/80 border border-surface-border">
                    <span className="text-[10px] text-text-muted uppercase font-bold">Net Margin Ratio</span>
                    <p className="text-lg sm:text-xl font-extrabold text-emerald-400 mt-0.5">64.2%</p>
                    <span className="text-[10px] text-text-muted">Food cost tracked</span>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-navy-800/80 border border-surface-border">
                    <span className="text-[10px] text-text-muted uppercase font-bold">Cash Drawer Balance</span>
                    <p className="text-lg sm:text-xl font-extrabold text-primary-cyan mt-0.5">LKR 72,400</p>
                    <span className="text-[10px] text-emerald-400">Reconciled</span>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-navy-900 border border-surface-border flex items-center justify-between text-xs">
                  <div>
                    <h4 className="font-bold text-white">Top 3 Bestselling Items Today</h4>
                    <p className="text-text-muted text-[11px]">1. Signature Burger Meal (48 sold) • 2. Iced Cappuccino (34 sold) • 3. Crispy Sub (22 sold)</p>
                  </div>
                  <button 
                    onClick={() => alert("Downloading PDF Financial Summary...")}
                    className="px-3 py-1.5 rounded-lg bg-navy-800 hover:bg-primary text-white border border-surface-border text-xs font-semibold transition-colors"
                  >
                    Export Daily PDF
                  </button>
                </div>
              </div>
            )}

          </div>

          {/* Bottom Card Footer */}
          <div className="p-4 sm:p-6 bg-navy-900/90 border-t border-surface-border flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs text-text-muted text-center sm:text-left">
              <CheckCircle2 className="w-4 h-4 text-primary-cyan shrink-0" />
              <span>Available for Single Outlet and Multi-Branch Enterprise Chains.</span>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <Link
                to="/services/erp-pos"
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-bold text-text-light bg-surface-card hover:bg-surface-cardHover border border-surface-border text-center transition-colors flex items-center justify-center gap-1.5"
              >
                Full Feature List <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <button
                onClick={onOpenQuote}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-primary hover:bg-primary-hover shadow-glow-sm text-center transition-all"
              >
                Schedule an ERP Demo
              </button>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
}


"use client";

import React, { useReducer, useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Home, MapPin, History, Shield, Zap, 
  Search, Filter, ArrowRight, ShieldCheck, 
  Package, Clock, AlertTriangle, TrendingUp,
  X, CheckCircle2, Loader2, Sparkles, LogOut,
  ChevronRight, ArrowLeft, BarChart3, PieChart as PieIcon, Globe
} from "lucide-react";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend
} from 'recharts';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🌸 TYPES & CONSTANTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

type ProductType = 'regular' | 'overnight' | 'ultra';
type PodStatus = 'active' | 'inactive' | 'maintenance';

interface Pod {
  id: string;
  name: string;
  location: string;
  lat?: number;
  lng?: number;
  status: PodStatus;
  inventory: Record<ProductType, number>;
  totalDispensed: number;
  demandScore: number;
  lastRestocked: number;
}

interface Transaction {
  id: string;
  podId: string;
  podName: string;
  product: ProductType;
  status: 'success' | 'failed';
  timestamp: number;
  reason?: string;
}

interface SahayaaEvent {
  id: string;
  timestamp: number;
  podName: string;
  type: 'dispense' | 'restock' | 'status_change' | 'failed_attempt' | 'anomaly';
  details: string;
}

interface Notification {
  id: string;
  type: 'success' | 'warning' | 'error' | 'admin';
  message: string;
}

interface State {
  pods: Pod[];
  transactions: Transaction[];
  eventLog: SahayaaEvent[];
  pendingReservations: Record<string, boolean>;
  notifications: Notification[];
  activePage: 'home' | 'find' | 'detail' | 'history' | 'admin' | 'subscription' | 'signup' | 'about';
  selectedPodId: string | null;
  isLoggedIn: boolean;
  user: any | null;
}

const INITIAL_PODS: Pod[] = [
  { id: "p1", name: "Lotus Pod", location: "City College, Block A", lat: 19.0760, lng: 72.8777, status: "active", inventory: { regular: 12, overnight: 7, ultra: 3 }, totalDispensed: 47, demandScore: 82, lastRestocked: Date.now() - 86400000 },
  { id: "p2", name: "Iris Pod", location: "Metro Station, Platform 2", lat: 19.1176, lng: 72.8489, status: "active", inventory: { regular: 18, overnight: 14, ultra: 11 }, totalDispensed: 23, demandScore: 45, lastRestocked: Date.now() - 172800000 },
  { id: "p3", name: "Rose Pod", location: "District Hospital, Ward B", lat: 18.9402, lng: 72.8347, status: "active", inventory: { regular: 2, overnight: 1, ultra: 8 }, totalDispensed: 89, demandScore: 95, lastRestocked: Date.now() - 43200000 },
  { id: "p4", name: "Dahlia Pod", location: "Central Mall, 2nd Floor", lat: 19.1351, lng: 72.9149, status: "active", inventory: { regular: 15, overnight: 10, ultra: 6 }, totalDispensed: 34, demandScore: 58, lastRestocked: Date.now() - 259200000 },
  { id: "p5", name: "Jasmine Pod", location: "Tech Park, Cafeteria", lat: 19.2183, lng: 72.9781, status: "maintenance", inventory: { regular: 8, overnight: 5, ultra: 9 }, totalDispensed: 61, demandScore: 70, lastRestocked: Date.now() - 345600000 },
  { id: "p6", name: "Marigold Pod", location: "Railway Station, Exit 3", lat: 19.0522, lng: 72.8314, status: "active", inventory: { regular: 20, overnight: 18, ultra: 15 }, totalDispensed: 11, demandScore: 30, lastRestocked: Date.now() - 432000000 },
  { id: "p7", name: "Orchid Pod", location: "Women's Hostel, Ground Floor", lat: 19.0178, lng: 72.8478, status: "active", inventory: { regular: 4, overnight: 2, ultra: 1 }, totalDispensed: 102, demandScore: 98, lastRestocked: Date.now() - 21600000 },
  { id: "p8", name: "Tulip Pod", location: "Community Health Centre", lat: 19.0632, lng: 72.8400, status: "inactive", inventory: { regular: 0, overnight: 0, ultra: 0 }, totalDispensed: 156, demandScore: 88, lastRestocked: Date.now() - 604800000 }
];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🧠 STATE MNGMT (useReducer)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

type Action = 
  | { type: 'SET_PAGE', page: State['activePage'], podId?: string }
  | { type: 'RESERVE_PRODUCT', podId: string, product: ProductType }
  | { type: 'CONFIRM_DISPENSE', podId: string, product: ProductType }
  | { type: 'CANCEL_DISPENSE', podId: string, product: ProductType }
  | { type: 'RESTOCK_POD', podId: string }
  | { type: 'TOGGLE_STATUS', podId: string }
  | { type: 'SET_AUTH', status: boolean, user?: State['user'] }
  | { type: 'ADD_NOTIFICATION', notification: Notification }
  | { type: 'DISMISS_NOTIFICATION', id: string }
  | { type: 'LOG_EVENT', event: Omit<SahayaaEvent, 'id'> };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_PAGE':
      return { ...state, activePage: action.page, selectedPodId: action.podId || null };
    
    case 'RESERVE_PRODUCT':
      return { 
        ...state, 
        pendingReservations: { ...state.pendingReservations, [`${action.podId}_${action.product}`]: true } 
      };
      
    case 'CANCEL_DISPENSE':
      const newReservations = { ...state.pendingReservations };
      delete newReservations[`${action.podId}_${action.product}`];
      return { ...state, pendingReservations: newReservations };

    case 'CONFIRM_DISPENSE': {
      const pod = state.pods.find(p => p.id === action.podId);
      if (!pod) return state;

      const updatedPods = state.pods.map(p => {
        if (p.id === action.podId) {
          const newDemand = Math.min(100, p.demandScore + 2);
          return {
            ...p,
            inventory: { ...p.inventory, [action.product]: p.inventory[action.product] - 1 },
            totalDispensed: p.totalDispensed + 1,
            demandScore: newDemand
          };
        }
        return p;
      });

      const newTxn: Transaction = {
        id: Math.random().toString(36).substr(2, 9),
        podId: action.podId,
        podName: pod.name,
        product: action.product,
        status: 'success',
        timestamp: Date.now()
      };

      const newLog: SahayaaEvent = {
        id: Math.random().toString(36).substr(2, 9),
        timestamp: Date.now(),
        podName: pod.name,
        type: 'dispense',
        details: `Dispensed ${action.product}`
      };

      const reservations = { ...state.pendingReservations };
      delete reservations[`${action.podId}_${action.product}`];

      return { 
        ...state, 
        pods: updatedPods, 
        transactions: [newTxn, ...state.transactions],
        eventLog: [newLog, ...state.eventLog],
        pendingReservations: reservations 
      };
    }

    case 'RESTOCK_POD':
      return {
        ...state,
        pods: state.pods.map(p => p.id === action.podId ? { ...p, inventory: { regular: 20, overnight: 20, ultra: 20 }, lastRestocked: Date.now() } : p),
        eventLog: [{ id: Math.random().toString(36).substr(2, 9), timestamp: Date.now(), podName: state.pods.find(p => p.id === action.podId)?.name || '', type: 'restock', details: 'All products filled to 20' }, ...state.eventLog]
      };

    case 'TOGGLE_STATUS':
      return {
        ...state,
        pods: state.pods.map(p => p.id === action.podId ? { ...p, status: p.status === 'active' ? 'inactive' : 'active' } : p)
      };

    case 'SET_AUTH':
      return { ...state, isLoggedIn: action.status, user: action.user || null };

    case 'ADD_NOTIFICATION':
      return { ...state, notifications: [action.notification, ...state.notifications] };

    case 'DISMISS_NOTIFICATION':
      return { ...state, notifications: state.notifications.filter(n => n.id !== action.id) };

    case 'LOG_EVENT':
      return { ...state, eventLog: [{ id: Math.random().toString(36).substr(2, 9), ...action.event }, ...state.eventLog] };

    default:
      return state;
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🎨 SHARED COMPONENTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const BotanicalBackground = () => (
  <div className="fixed inset-0 pointer-events-none -z-10 bg-sage-light overflow-hidden">
    <div className="absolute inset-0 bg-gradient-to-b from-sage-medium/20 to-transparent opacity-60" />
    
    {/* Soft Organic Background Shapes */}
    <div className="absolute top-[-10%] left-[-5%] w-[40%] h-[40%] organic-shape-1 blur-3xl" />
    <div className="absolute bottom-[-5%] right-[-10%] w-[50%] h-[50%] organic-shape-1 blur-3xl rotate-45" />

    {/* Floating Elements */}
    {[...Array(8)].map((_, i) => (
      <motion.div
        key={i}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ 
          opacity: [0.3, 0.6, 0.3], 
          y: [-20, 20, -20],
          rotate: [0, 10, 0]
        }}
        transition={{ 
          duration: 8 + i * 2, 
          repeat: Infinity, 
          delay: i * 1,
          ease: "easeInOut" 
        }}
        className="absolute"
        style={{
          top: `${10 + i * 12}%`,
          left: `${5 + (i * 15) % 90}%`,
        }}
      >
        <svg width="80" height="80" viewBox="0 0 100 100" fill="none">
          {i % 2 === 0 ? (
            <path 
              d="M50 20 C 60 40, 80 50, 50 80 C 20 50, 40 40, 50 20 Z" 
              fill={i % 3 === 0 ? "#86A397" : "#F2D5D5"} 
              fillOpacity="0.2"
              stroke={i % 3 === 0 ? "#86A397" : "#F2D5D5"} 
              strokeWidth="0.5" 
            />
          ) : (
            <circle 
              cx="50" cy="50" r="25" 
              stroke="#D9CFC1" 
              strokeWidth="0.5" 
              strokeDasharray="4 8" 
            />
          )}
        </svg>
      </motion.div>
    ))}
  </div>
);

const TopNavbar = ({ activePage, onNavigate, isLoggedIn }: { activePage: State['activePage'], onNavigate: (p: State['activePage']) => void, isLoggedIn: boolean }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const menuItems = [
    { id: 'home', label: 'Home' },
    { id: 'find', label: 'Find a Pod' },
    { id: 'subscription', label: 'Subscriptions' },
    { id: 'about', label: 'About' }
  ];

  return (
    <nav className={`fixed top-0 left-0 right-0 z-[1000] px-6 py-4 transition-all duration-500 ${scrolled ? 'bg-white/80 backdrop-blur-xl shadow-lg' : 'bg-transparent'}`}>
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Logo */}
        <div 
          onClick={() => onNavigate('home')}
          className="cursor-pointer group flex items-center gap-2"
        >
          <div className="w-10 h-10 bg-forest rounded-2xl flex items-center justify-center text-white font-serif italic font-black shadow-xl group-hover:rotate-12 transition-transform">S</div>
          <span className="text-2xl font-serif font-black text-forest">Sahayaa.</span>
        </div>

        {/* Desktop Menu */}
        <div className="hidden lg:flex items-center gap-10">
          <div className="flex items-center gap-8">
            {menuItems.map(item => (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id as State['activePage'])}
                className={`text-[10px] font-black uppercase tracking-[0.2em] transition-all hover:text-leaf ${activePage === item.id ? 'text-forest translate-y-[-2px]' : 'text-text-muted text-opacity-70'}`}
              >
                {item.label}
              </button>
            ))}
          </div>
          
          <div className="h-6 w-[1px] bg-forest/10" />

          {isLoggedIn ? (
            <button 
              onClick={() => onNavigate('admin')}
              className="flex items-center gap-3 px-6 py-3 rounded-full bg-forest/5 border border-forest/10 text-forest font-black text-[10px] uppercase tracking-widest hover:bg-forest hover:text-white transition-all"
            >
              Dashboard <ChevronRight className="w-3 h-3" />
            </button>
          ) : (
            <div className="flex items-center gap-4">
              <button 
                onClick={() => onNavigate('admin')}
                className="text-[10px] font-black uppercase tracking-widest text-forest hover:text-leaf transition-colors"
              >
                Login
              </button>
              <button 
                onClick={() => onNavigate('signup')}
                className="px-6 py-3 rounded-full bg-forest text-white font-black text-[10px] uppercase tracking-widest shadow-xl shadow-forest/10 hover:scale-105 active:scale-95 transition-all"
              >
                Sign Up
              </button>
            </div>
          )}
        </div>

        {/* Mobile Toggle */}
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="lg:hidden p-3 rounded-2xl bg-forest/5 text-forest"
        >
          {isOpen ? <X className="w-6 h-6" /> : <Filter className="w-6 h-6 rotate-90" />}
        </button>
      </div>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-full left-6 right-6 mt-4 glass p-10 flex flex-col items-center gap-8 shadow-2xl border-white/50 border-4 lg:hidden"
          >
            {menuItems.map(item => (
              <button
                key={item.id}
                onClick={() => { onNavigate(item.id as State['activePage']); setIsOpen(false); }}
                className={`text-sm font-black uppercase tracking-[0.3em] ${activePage === item.id ? 'text-forest' : 'text-text-muted'}`}
              >
                {item.label}
              </button>
            ))}
            <div className="w-full h-[1px] bg-forest/10" />
            <button 
              onClick={() => { onNavigate('admin'); setIsOpen(false); }}
              className="w-full py-4 rounded-full bg-forest text-white font-black uppercase text-[10px] tracking-widest"
            >
              Access Portal
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 📍 PAGES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const HomePage = ({ onNavigate, stats }: { onNavigate: (p: State['activePage']) => void, stats: any }) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
    className="min-h-screen py-24 px-6 flex flex-col items-center justify-center space-y-16"
  >
    <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
      {/* Left: Content */}
      <div className="space-y-10 relative">
        <div className="absolute -top-20 -left-10 w-40 h-40 bg-blossom/10 rounded-full blur-3xl -z-10 animate-pulse" />
        
        <div className="space-y-4">
          <motion.div 
            initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-forest/5 border border-forest/10 text-[10px] font-black uppercase tracking-widest text-forest"
          >
            <Sparkles className="w-3 h-3" /> New Boutique Network
          </motion.div>
          <h1 className="text-7xl md:text-9xl font-serif font-black text-forest leading-[0.85] tracking-tighter">
            Dignity <br/> <span className="italic font-medium text-leaf">Delivered.</span>
          </h1>
          <p className="text-lg text-text-muted max-w-lg font-medium leading-relaxed">
            Sahayaa provides seamless, discreet, and automated access to high-quality hygiene essentials in public spaces.
          </p>
        </div>

        <div className="flex flex-wrap gap-4">
          {['Easy Access', 'Safe & Hygienic', '24/7 Availability', 'Affordable'].map((tag, i) => (
            <motion.div
              key={tag}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 + i * 0.1 }}
              className="px-6 py-3 rounded-2xl glass border-sage-medium text-[10px] font-black uppercase tracking-widest text-forest shadow-sm flex items-center gap-2"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-leaf animate-pulse" />
              {tag}
            </motion.div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-6 pt-4">
          <button 
            onClick={() => onNavigate('find')}
            className="px-12 py-6 rounded-full bg-forest text-white font-black uppercase text-xs tracking-[0.2em] shadow-2xl shadow-forest/20 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-4"
          >
            Find a Pod Right Now <ArrowRight className="w-5 h-5" />
          </button>
          <button 
            onClick={() => onNavigate('subscription')}
            className="px-10 py-6 rounded-full border-2 border-forest text-forest font-black uppercase text-xs tracking-widest hover:bg-forest hover:text-white transition-all"
          >
            View Subscriptions
          </button>
        </div>
      </div>

      {/* Right: Visual */}
      <div className="relative group">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1, delay: 0.3 }}
          className="relative rounded-[4rem] overflow-hidden shadow-2xl border-8 border-white group-hover:rotate-2 transition-transform duration-700"
        >
          <img 
            src="/images/hero.png" 
            alt="Empowered Woman" 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-forest/30 to-transparent" />
        </motion.div>

        {/* Floating Elements */}
        <motion.div 
          animate={{ y: [0, -10, 0] }} transition={{ duration: 5, repeat: Infinity }}
          className="absolute -top-10 -right-10 glass p-6 aspect-square rounded-3xl shadow-xl flex flex-col items-center justify-center border-white"
        >
          <div className="text-3xl">🌸</div>
          <div className="text-[8px] font-black uppercase mt-2 text-forest">Premium Care</div>
        </motion.div>
      </div>
    </div>

    <div className="glass px-10 py-6 flex flex-wrap justify-center items-center gap-8 md:gap-16 shadow-xl w-full max-w-4xl border-white/50 bg-white/40">
      <div className="text-center">
        <div className="text-4xl font-black text-forest">{stats.activePods}</div>
        <div className="text-[10px] font-black uppercase text-text-muted tracking-widest">Active Pods</div>
      </div>
      <div className="hidden md:block w-[1px] h-10 bg-forest/10" />
      <div className="text-center">
        <div className="text-4xl font-black text-leaf">{stats.dispensedToday}</div>
        <div className="text-[10px] font-black uppercase text-text-muted tracking-widest">Dispensed</div>
      </div>
      <div className="hidden md:block w-[1px] h-10 bg-forest/10" />
      <div className="text-center">
        <div className="text-4xl font-black text-earth">1.2k</div>
        <div className="text-[10px] font-black uppercase text-text-muted tracking-widest">Happy Users</div>
      </div>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl w-full">
      {[
        { t: "Instant Access", d: "Zero wait times, fully automated pods at station locations." },
        { t: "Always Stocked", d: "Predictive replenishment ensures you never find an empty pod." },
        { t: "Free & Dignified", d: "Private access designed for safety and absolute comfort." }
      ].map(f => (
        <div key={f.t} className="glass p-8 space-y-4 hover:translate-y-[-5px] transition-all">
          <div className="w-10 h-10 bg-white/5 rounded-xl border border-white/10 flex items-center justify-center text-xl">✨</div>
          <h3 className="text-xl font-serif font-black">{f.t}</h3>
          <p className="text-sm text-text-muted leading-relaxed">{f.d}</p>
        </div>
      ))}
    </div>
  </motion.div>
);

const FindPodPage = ({ pods, onSelect, dispatch }: { pods: Pod[], onSelect: (id: string) => void, dispatch: React.Dispatch<Action> }) => {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<'all' | 'available' | 'high'>('all');

  const ranking = useMemo(() => {
    return pods.map(p => {
      const avgStock = Object.values(p.inventory).reduce((a, b) => a + b, 0) / 3;
      const stockScore = (avgStock / 20) * 0.4;
      const demandVal = (p.demandScore / 100) * 0.3;
      const distScore = (Math.random()) * 0.3; 
      return { ...p, score: stockScore + demandVal + distScore };
    }).sort((a, b) => b.score - a.score);
  }, [pods]);

  const bestPod = ranking.find(p => p.status === 'active');

  const filtered = ranking.filter(p => {
    const matchQ = p.name.toLowerCase().includes(query.toLowerCase()) || p.location.toLowerCase().includes(query.toLowerCase());
    if (filter === 'available') return matchQ && p.status === 'active';
    if (filter === 'high') return matchQ && p.demandScore > 80;
    return matchQ;
  });

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen py-32 px-6 max-w-6xl mx-auto space-y-12">
      <div className="space-y-6">
        <div className="flex items-end justify-between">
          <h1 className="text-5xl font-serif font-black">Find a <span className="text-leaf">Pod.</span></h1>
          <button 
            onClick={() => {
              dispatch({ type: 'ADD_NOTIFICATION', notification: { id: Math.random().toString(), type: 'success', message: "Location updated: Mumbai, MH" } });
            }}
            className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-forest hover:text-leaf transition-colors bg-white/40 px-4 py-2 rounded-full border border-forest/10"
          >
            <Globe className="w-3 h-3" /> Use My Location
          </button>
        </div>
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative group">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted group-focus-within:text-forest" />
            <input 
              type="text" placeholder="Search by location..." 
              value={query} onChange={e => setQuery(e.target.value)}
              className="w-full bg-white/60 border border-sage-medium rounded-3xl py-5 pl-14 pr-8 outline-none focus:ring-4 focus:ring-leaf/5 transition-all text-sm font-medium" 
            />
          </div>
          <div className="flex gap-2 p-1 bg-sage-medium/30 rounded-3xl">
            {(['all', 'available', 'high'] as const).map(f => (
              <button 
                key={f} onClick={() => setFilter(f)}
                className={`px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  filter === f ? 'bg-white shadow-sm text-forest' : 'text-text-muted hover:text-forest'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      {bestPod && (
        <div className="glass p-10 border-leaf/10 bg-leaf/5 flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-5 font-black text-[10px] uppercase text-leaf flex items-center gap-2">
            <Sparkles className="w-3 h-3" /> Recommended for You
          </div>
          <div className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-4xl font-serif font-black">{bestPod.name}</h2>
              <p className="text-text-muted flex items-center gap-2 text-sm font-medium"><MapPin className="w-4 h-4 text-leaf" /> {bestPod.location}</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="px-4 py-2 rounded-full bg-leaf/10 text-forest text-[10px] font-black uppercase tracking-widest border border-leaf/20">Available Now</div>
              <div className="text-forest font-black text-lg">0.4 km away</div>
            </div>
          </div>
          <div className="flex gap-4">
            <button 
              onClick={() => onSelect(bestPod.id)}
              className="px-12 py-5 rounded-full bg-forest text-white font-black uppercase text-xs tracking-widest hover:scale-105 transition-all shadow-xl"
            >
              Go to Pod
            </button>
            <button 
              onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${bestPod.lat},${bestPod.lng}`, '_blank')}
              className="p-5 rounded-full glass border-forest/10 text-forest hover:bg-forest hover:text-white transition-all shadow-sm"
            >
              <MapPin className="w-6 h-6" />
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {filtered.map(p => (
          <div 
            key={p.id} 
            onClick={() => p.status !== 'inactive' && onSelect(p.id)}
            className={`glass p-8 space-y-6 group cursor-pointer transition-all border-sage-medium/50 hover:border-leaf/30 shadow-sm hover:shadow-xl ${p.status === 'inactive' ? 'opacity-40 grayscale pointer-events-none' : 'hover:translate-y-[-4px]'}`}
          >
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <h3 className="text-2xl font-serif font-black text-forest">{p.name}</h3>
                <p className="text-xs text-text-muted font-bold uppercase tracking-widest">{p.location}</p>
              </div>
              <div className={`w-3 h-3 rounded-full ${p.status === 'active' ? 'glow-teal' : p.status === 'maintenance' ? 'glow-gold' : 'glow-coral'}`} />
            </div>

            <div className="space-y-5">
              {['regular', 'overnight', 'ultra'].map(type => {
                const count = p.inventory[type as ProductType];
                return (
                  <div key={type} className="space-y-2">
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                      <span className="text-text-muted">{type}</span>
                      <span className={count < 5 ? 'text-coral' : 'text-forest'}>{count} / 20</span>
                    </div>
                    <div className="h-1.5 w-full bg-sage-medium/50 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-1000 ${count < 5 ? 'bg-coral' : 'bg-leaf'}`} 
                        style={{ width: `${(count / 20) * 100}%` }} 
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-2">
              {p.demandScore > 80 ? (
                <div className="text-[10px] font-black text-magenta flex items-center gap-2 uppercase tracking-widest bg-magenta/5 px-3 py-1.5 rounded-full border border-magenta/10">
                  🔥 High Demand
                </div>
              ) : <div />}
              {p.status === 'active' ? (
                <div className="flex items-center gap-2">
                  <button 
                    onClick={(e) => { e.stopPropagation(); window.open(`https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`, '_blank'); }}
                    className="p-3 rounded-full hover:bg-forest/5 text-forest transition-colors"
                  >
                    <Globe className="w-4 h-4" />
                  </button>
                  <div className="text-forest font-black text-xs inline-flex items-center gap-2 group-hover:translate-x-2 transition-all">
                    Access Pod <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              ) : (
                <div className="text-coral font-black text-[10px] uppercase tracking-widest">Unavailable</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
};

const PodDetailPage = ({ pod, onDispense, onBack }: { pod: Pod, onDispense: (type: ProductType) => void, onBack: () => void }) => {
  const [step, setStep] = useState<'idle' | 'processing' | 'result'>('idle');
  const [procPhase, setProcPhase] = useState("");

  const dispense = async (type: ProductType) => {
    if (pod.inventory[type] === 0) return;
    setStep('processing');
    setProcPhase("Initialising Secure Link...");
    await new Promise(r => setTimeout(r, 600));
    setProcPhase("Allocating Item...");
    await new Promise(r => setTimeout(r, 600));
    setProcPhase("Dispensing Care Unit...");
    await new Promise(r => setTimeout(r, 800));

    onDispense(type);
    setStep('result');
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen py-32 px-6 max-w-5xl mx-auto space-y-12">
      <header className="flex items-center justify-between">
        <button onClick={onBack} className="p-5 rounded-full glass hover:border-forest/20 transition-all text-text-muted hover:text-forest shadow-sm group">
          <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
        </button>
        <div className="text-right space-y-1">
          <h1 className="text-4xl font-serif font-black text-forest">{pod.name}</h1>
          <p className="text-text-muted text-sm font-medium">{pod.location}</p>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {(['regular', 'overnight', 'ultra'] as const).map(type => {
          const inv = pod.inventory[type];
          const isLow = inv > 0 && inv < 5;
          return (
            <div key={type} className={`glass p-10 space-y-10 flex flex-col items-center text-center transition-all border-sage-medium/50 ${inv === 0 ? 'opacity-40 grayscale selection:bg-none' : 'hover:border-leaf/30 shadow-sm'}`}>
              <div className="relative">
                <div className="text-7xl drop-shadow-sm">{type === 'regular' ? '🌿' : type === 'overnight' ? '🌙' : '✨'}</div>
                {isLow && (
                  <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ repeat: Infinity }} className="absolute -top-2 -right-2 bg-coral text-white text-[8px] font-black px-2 py-1 rounded-full uppercase">Low</motion.div>
                )}
              </div>
              <div className="space-y-4 w-full">
                <div className="space-y-1">
                  <h3 className="text-2xl font-serif font-black capitalize text-forest">{type}</h3>
                  <p className={`text-[10px] font-black uppercase tracking-widest ${inv < 5 ? 'text-coral' : 'text-text-muted'}`}>
                    {inv > 0 ? `${inv} Units Available` : 'Completely Depleted'}
                  </p>
                </div>
                <div className="h-1 w-full bg-sage-medium/40 rounded-full overflow-hidden">
                   <div className={`h-full rounded-full ${inv < 5 ? 'bg-coral' : 'bg-leaf'}`} style={{ width: `${(inv / 20) * 100}%` }} />
                </div>
              </div>
              <button 
                disabled={inv === 0}
                onClick={() => dispense(type)}
                className={`w-full py-5 rounded-full font-black text-[10px] uppercase tracking-widest transition-all shadow-md ${
                  inv >= 5 ? 'bg-forest text-white hover:scale-105 active:scale-95' :
                  inv >= 1 ? 'bg-earth text-forest hover:scale-105 active:scale-95' :
                  'bg-sage-medium text-text-muted pointer-events-none shadow-none'
                }`}
              >
                {inv === 0 ? 'Unavailable' : 'Confirm & Dispense'}
              </button>
            </div>
          );
        })}
      </div>

      <AnimatePresence>
        {step !== 'idle' && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-forest/20 backdrop-blur-xl"
          >
            <div className="max-w-md w-full glass p-12 text-center space-y-10 border-white shadow-2xl">
              {step === 'processing' && (
                <div className="space-y-8">
                  <div className="relative w-24 h-24 mx-auto">
                    <Loader2 className="w-24 h-24 text-forest animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center text-3xl animate-pulse">🌱</div>
                  </div>
                  <div className="space-y-3">
                    <h2 className="text-3xl font-serif font-black text-forest">{procPhase}</h2>
                    <p className="text-[10px] font-black text-text-muted uppercase tracking-[0.4em]">Hardware-Level Handshake</p>
                  </div>
                </div>
              )}

              {step === 'result' && (
                <div className="space-y-10">
                  <motion.div 
                    initial={{ scale: 0.8 }} animate={{ scale: 1 }}
                    className="w-32 h-32 mx-auto rounded-full bg-leaf/10 border border-leaf/20 flex items-center justify-center text-7xl shadow-inner"
                  >
                    🌿
                  </motion.div>
                  <div className="space-y-3">
                    <h2 className="text-4xl font-serif font-black text-forest">Care Dispensed</h2>
                    <p className="text-sm text-text-muted font-medium">Your request was processed successfully. Please collect your unit from the pod opening.</p>
                  </div>
                  <button 
                    onClick={() => { setStep('idle'); onBack(); }}
                    className="w-full py-5 rounded-full bg-forest text-white font-black text-[10px] uppercase tracking-widest shadow-xl"
                  >
                    Complete Session
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const SubscriptionPage = ({ onSubscribe, user }: { onSubscribe: () => void, user: any }) => {
  const plans = [
    { name: 'Starter Care', price: '$5', units: 5, color: 'bg-blossom', desc: 'Perfect for light usage and backup.' },
    { name: 'Monthly Essential', price: '$12', units: 15, color: 'bg-leaf', desc: 'Our most popular plan for full monthly care.', popular: true },
    { name: 'Annual Bloom', price: '$99', units: 'Unlimited', color: 'bg-earth', desc: 'Zero worries for the entire year.' }
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen py-32 px-6 max-w-6xl mx-auto space-y-16">
      <div className="text-center space-y-4">
        <h1 className="text-6xl font-serif font-black text-forest">Choose Your <span className="text-leaf">Plan.</span></h1>
        <p className="text-text-muted max-w-xl mx-auto font-medium">Predictable care, delivered with dignity. Choose a plan that fits your lifestyle perfectly.</p>
      </div>

      {user && (
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="glass p-10 bg-forest/5 border-forest/10 flex flex-col md:flex-row items-center justify-between gap-8">
           <div className="flex items-center gap-6 text-center md:text-left">
              <div className="w-16 h-16 rounded-full bg-forest/10 flex items-center justify-center text-3xl">🌿</div>
              <div className="space-y-1">
                 <h2 className="text-2xl font-serif font-black text-forest">Your Current Plan: <span className="text-leaf italic">Monthly Essential</span></h2>
                 <p className="text-xs text-text-muted font-bold uppercase tracking-widest">Next Billing Cycle: Oct 12, 2026</p>
              </div>
           </div>
           <div className="flex items-center gap-4">
              <div className="text-right">
                 <div className="text-3xl font-black text-forest">12 / 15</div>
                 <div className="text-[10px] font-black uppercase text-text-muted tracking-widest">Units Remaining</div>
              </div>
              <button className="px-8 py-4 rounded-full glass border-forest/10 text-forest font-black uppercase text-[10px] tracking-widest hover:bg-forest hover:text-white transition-all">Manage</button>
           </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {plans.map(p => (
          <div key={p.name} className={`glass p-10 flex flex-col items-center text-center space-y-8 relative transition-all border-sage-medium/50 hover:border-leaf/30 shadow-sm hover:shadow-xl ${p.popular ? 'ring-2 ring-forest/20' : ''}`}>
            {p.popular && (
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 px-4 py-1.5 bg-forest text-white text-[9px] font-black uppercase tracking-widest rounded-full shadow-lg">Most Loved</div>
            )}
            <div className={`w-20 h-20 rounded-3xl ${p.color} bg-opacity-20 flex items-center justify-center text-4xl`}>
              {p.units === 5 ? '🌸' : p.units === 15 ? '🌿' : '🌳'}
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-serif font-black text-forest">{p.name}</h3>
              <p className="text-sm text-text-muted font-medium">{p.desc}</p>
            </div>
            <div className="text-5xl font-serif font-black text-forest">
               {p.price}<span className="text-sm font-sans font-bold text-text-muted">/mo</span>
            </div>
            <ul className="space-y-3 w-full text-left">
               {[ `${p.units} Units per month`, 'Zero priority queueing', 'Direct map navigation', 'Real-time stock alerts' ].map(f => (
                 <li key={f} className="flex items-center gap-3 text-xs font-semibold text-text-muted">
                    <CheckCircle2 className="w-4 h-4 text-leaf" /> {f}
                 </li>
               ))}
            </ul>
            <button 
              onClick={onSubscribe}
              className={`w-full py-5 rounded-full font-black text-[10px] uppercase tracking-widest transition-all ${p.popular ? 'bg-forest text-white shadow-xl' : 'bg-sage-medium text-forest hover:bg-forest hover:text-white shadow-md'}`}
            >
              Select Plan
            </button>
          </div>
        ))}
      </div>

      <div className="glass p-12 bg-earth/5 border-earth/20 flex flex-col md:flex-row items-center gap-10">
         <div className="flex-1 space-y-4">
            <h3 className="text-3xl font-serif font-black text-forest">Need a custom plan?</h3>
            <p className="text-text-muted font-medium">We partner with colleges, hospitals, and stations for bulk installations and custom logistics.</p>
         </div>
         <button className="px-10 py-5 rounded-full border-2 border-forest text-forest font-black uppercase text-xs tracking-widest hover:bg-forest hover:text-white transition-all">Contact Partnerships</button>
      </div>
    </motion.div>
  );
};

const TransactionsPage = ({ txns }: { txns: Transaction[] }) => {
  const [filter, setFilter] = useState<'all' | 'success' | 'failed'>('all');
  const filtered = txns.filter(t => filter === 'all' ? true : t.status === filter);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen py-32 px-6 max-w-4xl mx-auto space-y-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <h1 className="text-5xl font-serif font-black text-forest">Activity History <span className="text-magenta">.</span></h1>
        <div className="flex gap-2 p-1 bg-sage-medium/30 rounded-full">
          {(['all', 'success', 'failed'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} className={`px-6 py-2 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${filter === f ? 'bg-white shadow-sm text-forest' : 'text-text-muted hover:text-forest'}`}>{f}</button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <AnimatePresence mode="popLayout">
          {filtered.map((t, i) => (
            <motion.div 
              key={t.id} layout
              initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
              className="glass p-6 flex flex-col sm:flex-row items-center justify-between gap-6 group hover:border-leaf/20 shadow-sm"
            >
              <div className="flex items-center gap-6">
                <div className="text-4xl group-hover:scale-110 transition-transform">{t.product === 'regular' ? '🌿' : t.product === 'overnight' ? '🌙' : '✨'}</div>
                <div className="space-y-1 text-center sm:text-left">
                  <h3 className="text-sm font-black text-forest uppercase tracking-widest">{t.product}</h3>
                  <p className="text-xs text-text-muted font-medium">{t.podName}</p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${t.status === 'success' ? 'bg-leaf/10 text-forest' : 'bg-coral/10 text-coral'}`}>
                  {t.status === 'success' ? '✓ Completed' : '✗ Unsuccessful'}
                </div>
                <span className="text-[10px] text-text-muted font-bold tracking-widest">{new Date(t.timestamp).toLocaleTimeString()}</span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {filtered.length === 0 && (
          <div className="py-32 flex flex-col items-center text-center space-y-6">
             <div className="text-6xl opacity-20">🍃</div>
             <p className="text-text-muted font-black text-[10px] uppercase tracking-[0.4em]">No transactions documented yet.</p>
          </div>
        )}
      </div>
    </motion.div>
  );
};

const AdminDashboard = ({ pods, logs, onAction }: { pods: Pod[], logs: SahayaaEvent[], onAction: (type: string, id?: string) => void }) => {
  const stats = {
    total: pods.length,
    active: pods.filter(p => p.status === 'active').length,
    dispensed: pods.reduce((acc, p) => acc + p.totalDispensed, 0),
    alerts: pods.filter(p => Object.values(p.inventory).some(v => v <= 3)).length,
    highDemand: pods.filter(p => p.demandScore > 70).length
  };

  const barData = pods.map(p => ({ name: p.name.split(' ')[0], dispensed: p.totalDispensed }));
  const donutData = [
    { name: 'Regular', value: pods.reduce((a, p) => a + p.inventory.regular, 0) },
    { name: 'Overnight', value: pods.reduce((a, p) => a + p.inventory.overnight, 0) },
    { name: 'Ultra', value: pods.reduce((a, p) => a + p.inventory.ultra, 0) }
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen py-32 px-6 max-w-7xl mx-auto space-y-12">
      <header className="space-y-2">
        <h1 className="text-5xl font-serif font-black">Admin <span className="text-gold">Shield.</span></h1>
        <p className="text-text-muted text-xs uppercase font-bold tracking-[0.4em]">Network Operations Command</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { l: 'Network Health', v: `${stats.active}/${stats.total}`, t: 'Active Pods', i: Zap, c: 'teal' },
          { l: 'System Throughput', v: stats.dispensed, t: 'Dispensed Today', i: TrendingUp, c: 'magenta' },
          { l: 'Inventory Alerts', v: stats.alerts, t: 'Low Stock Pods', i: AlertTriangle, c: 'coral' },
          { l: 'Demand Heatmap', v: stats.highDemand, t: 'Hotspots Detected', i: PieIcon, c: 'gold' }
        ].map(s => (
          <div key={s.l} className="glass p-8 space-y-4">
            <s.i className={`w-6 h-6 text-${s.c}`} />
            <div className="space-y-1">
              <div className="text-3xl font-black text-text-primary">{s.v}</div>
              <div className="text-[10px] font-black uppercase text-text-muted tracking-widest">{s.t}</div>
            </div>
            {s.c === 'coral' && stats.alerts > 0 && <div className="text-[8px] font-black text-coral uppercase tracking-widest animate-pulse">Critical Depletion Likely</div>}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[400px]">
        <div className="glass lg:col-span-2 p-8 space-y-6">
          <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2"><BarChart3 className="w-4 h-4 text-gold" /> Performance per Pod</h3>
          <ResponsiveContainer width="100%" height="80%">
            <BarChart data={barData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
              <XAxis dataKey="name" stroke="#555" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="#555" fontSize={10} tickLine={false} axisLine={false} />
              <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ backgroundColor: '#051209', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }} />
              <Bar dataKey="dispensed" fill="#E8629A" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="glass p-8 space-y-6">
           <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2"><PieIcon className="w-4 h-4 text-teal" /> Stock Distribution</h3>
           <ResponsiveContainer width="100%" height="80%">
            <PieChart>
              <Pie data={donutData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                <Cell fill="#E8629A" />
                <Cell fill="#3DFFD0" />
                <Cell fill="#FFD97D" />
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: '#051209', border: 'none', borderRadius: '12px' }} />
              <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="space-y-8">
        <h2 className="text-3xl font-serif font-black">Network <span className="text-teal">Table.</span></h2>
        <div className="glass overflow-hidden border-white/5">
          <table className="w-full text-left">
            <thead className="bg-white/5 font-black text-[10px] uppercase tracking-widest text-text-muted">
               <tr>
                 <th className="px-8 py-5">Pod Identity</th>
                 <th className="px-8 py-5">Health</th>
                 <th className="px-8 py-5">Inventory (R/O/U)</th>
                 <th className="px-8 py-5">Hotscore</th>
                 <th className="px-8 py-5 text-right">Actions</th>
               </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {pods.map(p => (
                <tr key={p.id} className="group hover:bg-white/[0.02] transition-all">
                  <td className="px-8 py-6">
                    <div className="font-serif font-black text-lg">{p.name}</div>
                    <div className="text-[10px] text-text-muted uppercase font-bold">{p.location}</div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-2">
                       <div className={`w-2 h-2 rounded-full ${p.status === 'active' ? 'glow-teal' : 'glow-coral'}`} />
                       <span className="text-[10px] font-black uppercase tracking-widest">{p.status}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex gap-4">
                      {['regular', 'overnight', 'ultra'].map(k => (
                        <div key={k} className={`text-xs font-black ${p.inventory[k as ProductType] <= 3 ? 'text-coral animate-pulse' : 'text-text-primary/70'}`}>
                           {p.inventory[k as ProductType]}
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="px-8 py-6">
                     <div className="text-lg font-black text-gold/60">{p.demandScore}</div>
                  </td>
                  <td className="px-8 py-6 text-right space-x-2">
                     <button onClick={() => onAction('TOGGLE_STATUS', p.id)} className="px-5 py-2.5 rounded-full glass border-white/10 text-[9px] font-black uppercase tracking-widest hover:border-gold transition-all">Status</button>
                     <button onClick={() => onAction('RESTOCK_POD', p.id)} className="px-5 py-2.5 rounded-full glass bg-teal text-night text-[9px] font-black uppercase tracking-widest transition-all">Restock</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 pt-12">
        <div className="space-y-6">
           <h3 className="text-xl font-serif font-black text-magenta">Audit Log</h3>
           <div className="glass p-6 h-96 overflow-y-auto space-y-4 font-mono text-[9px] uppercase tracking-widest text-[#aaa] custom-scrollbar">
              {logs.map(log => (
                <div key={log.id} className="border-l border-white/10 pl-4 py-1">
                   <span className="text-text-muted">[{new Date(log.timestamp).toLocaleTimeString()}]</span> <span className="text-teal">{log.podName}</span> <span className="text-magenta">{log.type}</span>: {log.details}
                </div>
              ))}
           </div>
        </div>
        <div className="space-y-6">
           <h3 className="text-xl font-serif font-black text-coral">Anomalies & Predictions</h3>
           <div className="space-y-4">
              {pods.filter(p => Object.values(p.inventory).some(v => v <= 5) && p.demandScore > 60).map(p => (
                <div key={p.id} className="glass p-6 border-coral/20 bg-coral/5 flex items-center justify-between">
                   <div className="space-y-1">
                      <div className="text-xs font-black uppercase text-coral">Risk: High Depletion</div>
                      <div className="text-sm font-serif font-black">{p.name} predicted empty in 2 hours</div>
                   </div>
                   <button onClick={() => onAction('RESTOCK_POD', p.id)} className="px-6 py-3 rounded-xl bg-coral text-white font-black text-[10px] uppercase tracking-widest">Execute Restock</button>
                </div>
              ))}
           </div>
        </div>
      </div>
    </motion.div>
  );
};

const LoginPage = ({ onUnlock, onNavigate }: { onUnlock: () => void, onNavigate: (p: State['activePage']) => void }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setIsError(false);
    
    // Simulate API Auth
    await new Promise(r => setTimeout(r, 1500));
    
    if (email.includes("@sahayaa.com") || email === "demo@care.com") {
      onUnlock();
    } else {
      setIsError(true);
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen pt-40 pb-20 px-6 flex items-center justify-center">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="max-w-md w-full glass p-12 space-y-10 border-sage-medium/50 shadow-2xl">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 bg-forest/5 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <ShieldCheck className="w-10 h-10 text-forest" />
          </div>
          <h2 className="text-4xl font-serif font-black text-forest">Welcome Back.</h2>
          <p className="text-[10px] font-black uppercase text-text-muted tracking-[0.4em]">Secure Access Required</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-text-muted px-2">Email Address</label>
            <input 
              type="email" 
              required
              className="w-full bg-white/50 border border-sage-medium rounded-2xl px-6 py-4 outline-none focus:ring-2 focus:ring-leaf/20 transition-all"
              placeholder="user@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-text-muted px-2">Password</label>
            <input 
              type="password" 
              required
              className="w-full bg-white/50 border border-sage-medium rounded-2xl px-6 py-4 outline-none focus:ring-2 focus:ring-leaf/20 transition-all"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>
          
          {isError && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[10px] font-black text-coral uppercase text-center">Invalid credentials</motion.p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-5 rounded-full bg-forest text-white font-black text-[10px] uppercase tracking-widest hover:scale-[1.02] transition-all shadow-xl disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Sign In"}
          </button>
        </form>

        <div className="text-center pt-4">
          <button 
            onClick={() => onNavigate('signup')}
            className="text-[10px] font-black uppercase tracking-widest text-text-muted hover:text-forest transition-colors"
          >
            Don't have an account? <span className="text-leaf">Sign Up</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const SignUpPage = ({ onSignup, onNavigate }: { onSignup: () => void, onNavigate: (p: State['activePage']) => void }) => {
  const [formData, setFormData] = useState({ name: "", email: "", password: "", confirm: "" });
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    await new Promise(r => setTimeout(r, 2000));
    onSignup();
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen pt-40 pb-20 px-6 flex items-center justify-center">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-md w-full glass p-12 space-y-10 border-sage-medium/50 shadow-2xl">
        <div className="text-center space-y-3">
          <h2 className="text-4xl font-serif font-black text-forest">Join Sahayaa.</h2>
          <p className="text-[10px] font-black uppercase text-text-muted tracking-[0.4em]">Start Your Wellness Journey</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-text-muted px-2">Full Name</label>
            <input 
              required className="w-full bg-white/50 border border-sage-medium rounded-2xl px-6 py-4 outline-none focus:ring-2 focus:ring-leaf/20"
              placeholder="Ananya Roy" onChange={e => setFormData({...formData, name: e.target.value})}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-text-muted px-2">Email Address</label>
            <input 
              required type="email" className="w-full bg-white/50 border border-sage-medium rounded-2xl px-6 py-4 outline-none focus:ring-2 focus:ring-leaf/20"
              placeholder="user@example.com"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-text-muted px-2">Create Password</label>
            <input 
              required type="password" className="w-full bg-white/50 border border-sage-medium rounded-2xl px-6 py-4 outline-none focus:ring-2 focus:ring-leaf/20"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit" disabled={isLoading}
            className="w-full py-5 rounded-full bg-forest text-white font-black text-[10px] uppercase tracking-widest hover:scale-[1.02] shadow-xl disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Create Account"}
          </button>
        </form>

        <div className="text-center pt-4">
          <button 
            onClick={() => onNavigate('admin')} 
            className="text-[10px] font-black uppercase tracking-widest text-text-muted hover:text-forest transition-colors"
          >
            Already have an account? <span className="text-leaf">Sign In</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const AboutPage = () => (
  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen py-40 px-6 max-w-4xl mx-auto space-y-20">
    <div className="space-y-6 text-center">
      <h1 className="text-7xl font-serif font-black text-forest leading-tight">Empowering <br/> <span className="text-leaf italic font-medium">Every Journey.</span></h1>
      <p className="text-lg text-text-muted max-w-2xl mx-auto leading-relaxed">
        Sahayaa was born from a simple belief: that dignified access to hygiene is not a luxury, but a fundamental right. 
        Our network of automated boutique pods provides high-quality care products exactly where you need them most.
      </p>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
      <div className="space-y-4">
        <h3 className="text-2xl font-serif font-black text-forest">The Mission</h3>
        <p className="text-sm text-text-muted leading-relaxed">
          We are building infrastructure for a more equitable future. By combining smart logistics with empathetic design, 
          we ensure that every woman can navigate public spaces with confidence and comfort.
        </p>
      </div>
      <div className="space-y-4">
        <h3 className="text-2xl font-serif font-black text-forest">Sustainability</h3>
        <p className="text-sm text-text-muted leading-relaxed">
          From our energy-efficient pods to our thoughtfully sourced products, every aspect of Sahayaa is designed 
          with the planet and its people in mind.
        </p>
      </div>
    </div>
  </motion.div>
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 👑 MAIN APP WRAPPER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function SahayaaApp() {
  const [state, dispatch] = useReducer(reducer, {
    pods: INITIAL_PODS,
    transactions: [],
    eventLog: [],
    pendingReservations: {},
    notifications: [],
    activePage: 'home',
    selectedPodId: null,
    isLoggedIn: false,
    user: null
  });

  const selectedPod = state.pods.find(p => p.id === state.selectedPodId);

  const statsSummary = useMemo(() => {
    return {
      activePods: state.pods.filter(p => p.status === 'active').length,
      dispensedToday: state.transactions.filter(t => t.timestamp > Date.now() - 86400000 && t.status === 'success').length
    };
  }, [state.transactions, state.pods]);

  // Simulated background dispense (every 30s)
  useEffect(() => {
    const interval = setInterval(() => {
      const activePods = state.pods.filter(p => p.status === 'active');
      const randomPod = activePods[Math.floor(Math.random() * activePods.length)];
      const products = Object.keys(randomPod.inventory) as ProductType[];
      const randomProd = products[Math.floor(Math.random() * products.length)];
      
      if (randomPod.inventory[randomProd] > 0) {
        dispatch({ type: 'CONFIRM_DISPENSE', podId: randomPod.id, product: randomProd });
        
        // Potential Anomaly Check
        if (randomPod.totalDispensed > 150) {
           dispatch({ type: 'LOG_EVENT', event: { podName: randomPod.name, type: 'anomaly', timestamp: Date.now(), details: 'Critical usage spike detected' }});
        }
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [state.pods]);

  // Auto-dismiss notifications
  useEffect(() => {
    if (state.notifications.length > 0) {
      const timer = setTimeout(() => {
        dispatch({ type: 'DISMISS_NOTIFICATION', id: state.notifications[0].id });
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [state.notifications]);

  return (
    <div className="relative min-h-screen">
      <BotanicalBackground />

      <div className="pb-32">
        <AnimatePresence mode="wait">
          {state.activePage === 'home' && <HomePage key="h" onNavigate={p => dispatch({ type: 'SET_PAGE', page: p })} stats={statsSummary} />}
          {state.activePage === 'find' && <FindPodPage key="f" pods={state.pods} onSelect={id => dispatch({ type: 'SET_PAGE', page: 'detail', podId: id })} dispatch={dispatch} />}
          {state.activePage === 'detail' && selectedPod && (
            <PodDetailPage 
              key="d" 
              pod={selectedPod} 
              onBack={() => dispatch({ type: 'SET_PAGE', page: 'find' })} 
              onDispense={type => {
                dispatch({ type: 'CONFIRM_DISPENSE', podId: selectedPod.id, product: type });
                dispatch({ type: 'ADD_NOTIFICATION', notification: { id: Date.now().toString(), type: 'success', message: `Dispensed ${type} from ${selectedPod.name}` }});
              }}
            />
          )}
          {state.activePage === 'history' && <TransactionsPage key="hs" txns={state.transactions} />}
          {state.activePage === 'subscription' && (
            <SubscriptionPage 
              key="sub" 
              user={state.user}
              onSubscribe={() => {
                dispatch({ type: 'ADD_NOTIFICATION', notification: { id: Date.now().toString(), type: 'success', message: 'Subscription activated successfully!' }});
                dispatch({ type: 'SET_PAGE', page: 'home' });
              }} 
            />
          )}
          {state.activePage === 'admin' && (
            state.isLoggedIn ? (
              <AdminDashboard 
                key="ad"
                pods={state.pods} logs={state.eventLog} 
                onAction={(type, id) => {
                  if (type === 'RESTOCK_POD' && id) dispatch({ type: 'RESTOCK_POD', podId: id });
                  if (type === 'TOGGLE_STATUS' && id) dispatch({ type: 'TOGGLE_STATUS', podId: id });
                }}
              />
            ) : <LoginPage key="al" onUnlock={() => dispatch({ type: 'SET_AUTH', status: true, user: { name: "Ananya Roy", email: "demo@care.com", plan: "Monthly Essential" } })} onNavigate={p => dispatch({ type: 'SET_PAGE', page: p })} />
          )}
          {state.activePage === 'signup' && (
            <SignUpPage key="sup" onSignup={() => dispatch({ type: 'SET_PAGE', page: 'home' })} onNavigate={p => dispatch({ type: 'SET_PAGE', page: p })} />
          )}
          {state.activePage === 'about' && (
            <AboutPage key="abt" />
          )}
        </AnimatePresence>
      </div>

      <TopNavbar 
        activePage={state.activePage} 
        onNavigate={p => dispatch({ type: 'SET_PAGE', page: p })} 
        isLoggedIn={state.isLoggedIn} 
      />

      {/* Notifications */}
      <div className="fixed top-8 right-8 z-[500] flex flex-col gap-4">
        <AnimatePresence>
          {state.notifications.map(n => (
            <motion.div
              key={n.id}
              initial={{ x: 100, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 100, opacity: 0 }}
              className={`p-6 rounded-2xl glass flex items-center gap-4 shadow-2xl border-${n.type === 'success' ? 'teal' : n.type === 'warning' ? 'gold' : 'coral'}/20`}
            >
              <div className={`w-2 h-2 rounded-full ${n.type === 'success' ? 'glow-teal' : n.type === 'warning' ? 'glow-gold' : 'glow-coral'}`} />
              <div className="text-sm font-bold text-text-primary">{n.message}</div>
              <button onClick={() => dispatch({ type: 'DISMISS_NOTIFICATION', id: n.id })} className="text-text-muted hover:text-white"><X className="w-4 h-4" /></button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

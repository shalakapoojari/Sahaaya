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

import { LiveCarePanel } from "@/components/LiveCarePanel";
import { DonatePage } from "@/components/DonatePage";
import { PharmacyPage } from "@/components/PharmacyPage";
import { LiveCarePage } from "@/components/LiveCarePage";
import { apiFetch } from "@/lib/api";
import { useLanguage } from "@/context/language-context";
import LanguageSelector from "@/components/LanguageSelector";

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
  id: number | string;
  transaction_id?: string;
  session_id?: string;
  machine_id?: number | string;
  machine_name?: string;
  podId?: string; // fallback
  podName?: string; // fallback
  product_id?: number;
  product_name?: string;
  product?: ProductType; // fallback
  amount?: number;
  quantity?: number;
  type?: string;
  payment_method?: string;
  status: string;
  timestamp: number | string;
  reason?: string;
}

interface SHAYEvent {
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
  eventLog: SHAYEvent[];
  pendingReservations: Record<string, boolean>;
  notifications: Notification[];
  activePage: 'home' | 'find' | 'detail' | 'history' | 'subscription' | 'admin' | 'signup' | 'about' | 'donate' | 'pharmacy' | 'livecare';
  selectedPodId: string | null;
  signalId: number | null;
  isLoggedIn: boolean;
  user: any | null;
}

const INITIAL_PODS: Pod[] = [];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🧠 STATE MNGMT (useReducer)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

type Action =
  | { type: 'SET_PAGE'; page: State['activePage']; podId?: string; signalId?: number }
  | { type: 'SET_PODS'; pods: any[] }
  | { type: 'SET_TRANSACTIONS'; transactions: any[] }
  | { type: 'RESERVE_PRODUCT', podId: string, product: ProductType }
  | { type: 'CONFIRM_DISPENSE', podId: string, product: ProductType }
  | { type: 'CANCEL_DISPENSE', podId: string, product: ProductType }
  | { type: 'RESTOCK_POD', podId: string }
  | { type: 'TOGGLE_STATUS', podId: string }
  | { type: 'SET_AUTH', status: boolean, user?: State['user'] }
  | { type: 'ADD_NOTIFICATION', notification: Notification }
  | { type: 'DISMISS_NOTIFICATION', id: string }
  | { type: 'LOG_EVENT', event: Omit<SHAYEvent, 'id'> };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_PODS':
      return { 
         ...state, 
         pods: action.pods.map(p => ({
            id: String(p.id),
            name: p.name,
            location: p.location,
            lat: p.latitude,
            lng: p.longitude,
            status: p.status,
            inventory: {
               regular: p.inventory?.reduce((a:number, i:any) => i.product_name.toLowerCase().includes('wings') ? a+i.quantity : a, 0) || 5,
               overnight: p.inventory?.reduce((a:number, i:any) => i.product_name.toLowerCase().includes('night') ? a+i.quantity : a, 0) || 5,
               ultra: p.inventory?.reduce((a:number, i:any) => i.product_name.toLowerCase().includes('ultra') ? a+i.quantity : a, 0) || 5
            },
            totalDispensed: p.total_dispensed || 0,
            demandScore: Math.floor(Math.random() * 100),
            lastRestocked: Date.now()
         }))
      };

    case 'SET_TRANSACTIONS':
      return { ...state, transactions: action.transactions };

    case 'SET_PAGE':
      return { 
        ...state, 
        activePage: action.page, 
        selectedPodId: action.podId !== undefined ? action.podId : state.selectedPodId,
        signalId: action.signalId !== undefined ? action.signalId : state.signalId
      };

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

      const newLog: SHAYEvent = {
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

const ShayBackground = () => (
  <div className="fixed inset-0 pointer-events-none -z-10 bg-surface overflow-hidden">
    <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent opacity-60" />

    {/* Soft Organic Background Shapes */}
    <div className="absolute top-[-10%] left-[-5%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-3xl animate-pulse" />
    <div className="absolute bottom-[-5%] right-[-10%] w-[50%] h-[50%] rounded-full bg-secondary/5 blur-3xl rotate-45 animate-pulse" />

    {/* Floating Elements */}
    {[...Array(6)].map((_, i) => (
      <motion.div
        key={i}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{
          opacity: [0.1, 0.3, 0.1],
          y: [-20, 20, -20],
          rotate: [0, 10, 0]
        }}
        transition={{
          duration: 10 + i * 2,
          repeat: Infinity,
          delay: i * 1,
          ease: "easeInOut"
        }}
        className="absolute text-4xl opacity-10"
        style={{
          top: `${15 + i * 15}%`,
          left: `${5 + (i * 20) % 80}%`,
        }}
      >
        {i % 2 === 0 ? '🌸' : '✨'}
      </motion.div>
    ))}
  </div>
);

const TopNavbar = ({ activePage, onNavigate, isLoggedIn }: { activePage: State['activePage'], onNavigate: (p: State['activePage']) => void, isLoggedIn: boolean }) => {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const menuItems = [
    { id: 'home', label: t('navigation.home') || 'Home' },
    { id: 'find', label: t('navigation.findAPod') || 'Find a Pod' },
    { id: 'pharmacy', label: t('navigation.pharmacy') || 'Find Pharmacy' },
    { id: 'livecare', label: t('navigation.livecare') || 'Live Care' },
    { id: 'subscription', label: t('navigation.subscriptions') || 'Subscriptions' },
    { id: 'about', label: t('navigation.about') || 'About' }
  ];

  return (
    <nav className={`fixed top-0 left-0 right-0 z-[1000] px-6 py-4 transition-all duration-500 ${scrolled ? 'bg-white/80 backdrop-blur-xl shadow-lg' : 'bg-transparent'}`}>
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Logo */}
        <div
          onClick={() => onNavigate('home')}
          className="cursor-pointer group flex items-center gap-2"
        >
          <div className="w-10 h-10 bg-primary rounded-2xl flex items-center justify-center text-white font-serif italic font-black shadow-xl group-hover:rotate-12 transition-transform">S</div>
          <span className="text-2xl font-serif font-black text-primary"></span>
        </div>

        {/* Desktop Menu */}
        <div className="hidden lg:flex items-center gap-10">
          <div className="flex items-center gap-8">
            {menuItems.map(item => (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id as State['activePage'])}
                className={`text-[10px] font-black uppercase tracking-[0.2em] transition-all hover:text-accent ${activePage === item.id ? 'text-primary translate-y-[-2px]' : 'text-text-muted text-opacity-70'}`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="h-6 w-[1px] bg-primary/10" />

          {isLoggedIn ? (
            <button
              onClick={() => onNavigate('admin')}
              className="flex items-center gap-3 px-6 py-3 rounded-full bg-primary/5 border border-primary/10 text-primary font-black text-[10px] uppercase tracking-widest hover:bg-primary hover:text-white transition-all"
            >
              {t('navigation.dashboard') || 'Dashboard'} <ChevronRight className="w-3 h-3" />
            </button>
          ) : (
            <div className="flex items-center gap-4">
              <button
                onClick={() => onNavigate('admin')}
                className="text-[10px] font-black uppercase tracking-widest text-primary hover:text-accent transition-colors"
              >
                {t('navigation.login') || 'Login'}
              </button>
              <button
                onClick={() => onNavigate('signup')}
                className="px-6 py-3 rounded-full bg-primary text-white font-black text-[10px] uppercase tracking-widest shadow-xl shadow-primary/10 hover:scale-105 active:scale-95 transition-all"
              >
                {t('navigation.signup') || 'Sign Up'}
              </button>
            </div>
          )}
        </div>

        {/* Mobile Toggle */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="lg:hidden p-3 rounded-2xl bg-primary/5 text-primary"
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
                className={`text-sm font-black uppercase tracking-[0.3em] ${activePage === item.id ? 'text-primary' : 'text-text-muted'}`}
              >
                {item.label}
              </button>
            ))}
            <div className="w-full h-[1px] bg-primary/10" />
            <button
              onClick={() => { onNavigate('admin'); setIsOpen(false); }}
              className="w-full py-4 rounded-full bg-primary text-white font-black uppercase text-[10px] tracking-widest"
            >
              {t('navigation.accessPortal') || 'Access Portal'}
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

const FreeClaimModal = ({ isOpen, onClose, podId }: { isOpen: boolean, onClose: () => void, podId?: string }) => {
  const { t } = useLanguage();
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error' | 'cooldown'>('idle');
  const [message, setMessage] = useState("");

  const checkCooldown = () => {
    const lastClaim = localStorage.getItem("sh_last_claim");
    if (lastClaim) {
      const hoursPassed = (Date.now() - parseInt(lastClaim)) / (1000 * 60 * 60);
      if (hoursPassed < 4) return true;
    }
    return false;
  };

  const handleClaim = async () => {
    if (checkCooldown()) {
      setStatus('cooldown');
      return;
    }

    setStatus('loading');
    try {
      const res = await apiFetch('/api/claim-free', {
        method: 'POST',
        body: JSON.stringify({
          machine_id: podId,
          session_id: Math.random().toString(36).substring(7)
        })
      });

      if (res.success) {
        setStatus('success');
        setMessage(res.message);
        localStorage.setItem("sh_last_claim", Date.now().toString());
      } else {
        setStatus('error');
        setMessage(res.message);
      }
    } catch (err: any) {
      setStatus('error');
      setMessage(err.message || "Something went wrong. Please try again.");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-6 bg-primary/20 backdrop-blur-xl">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="max-w-md w-full glass p-12 text-center space-y-8 border-white shadow-2xl relative">
        <button onClick={onClose} className="absolute top-6 right-6 text-sh-secondary underline uppercase text-[10px] font-black">{t('common.close')}</button>

        {status === 'idle' && (
          <div className="space-y-8">
            <div className="text-7xl">🎁</div>
            <div className="space-y-2">
              <h2 className="text-4xl font-serif font-black text-sh-primary tracking-tighter italic">{t('claimModal.needAPad')}</h2>
              <p className="text-sm text-sh-secondary font-medium px-4">{t('claimModal.claimText')}</p>
            </div>
            <button onClick={handleClaim} className="w-full btn-primary py-5 text-xs uppercase tracking-widest">{t('claimModal.claimButton')}</button>
          </div>
        )}

        {status === 'loading' && (
          <div className="py-12 flex flex-col items-center gap-6">
            <Loader2 className="w-12 h-12 text-primary animate-spin" />
            <p className="text-[10px] font-black uppercase text-sh-secondary tracking-widest">{t('claimModal.checkingPool')}</p>
          </div>
        )}

        {status === 'success' && (
          <div className="space-y-8 animate-scale-in">
            <div className="text-7xl">🌸</div>
            <div className="space-y-2">
              <h2 className="text-4xl font-serif font-black text-success tracking-tighter italic">{t('claimModal.comingUp')}</h2>
              <p className="text-sm text-sh-secondary font-medium">{message}</p>
            </div>
            <button onClick={onClose} className="w-full btn-primary py-5 text-xs uppercase tracking-widest">{t('common.done')}</button>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-8">
            <div className="text-7xl">💛</div>
            <div className="space-y-2">
              <h2 className="text-4xl font-serif font-black text-sh-primary tracking-tighter italic">{t('claimModal.checkSoon')}</h2>
              <p className="text-sm text-sh-secondary font-medium">{message}</p>
            </div>
            <button
              onClick={onClose}
              className="w-full btn-primary py-5 text-xs uppercase tracking-widest"
            >
              {t('claimModal.sponsorOne')}
            </button>
          </div>
        )}

        {status === 'cooldown' && (
          <div className="space-y-8">
            <div className="text-7xl">⏳</div>
            <div className="space-y-2">
              <h2 className="text-4xl font-serif font-black text-sh-primary tracking-tighter italic">{t('claimModal.slowDown')}</h2>
              <p className="text-sm text-sh-secondary font-medium">{t('claimModal.cooldownText')}</p>
            </div>
            <button onClick={onClose} className="w-full btn-primary py-5 text-xs uppercase tracking-widest">{t('common.done')}</button>
          </div>
        )}
      </motion.div>
    </div>
  );
};

const HomePage = ({ onNavigate, stats, dispatch }: { onNavigate: (p: State['activePage']) => void, stats: any, dispatch: any }) => {
  const { t } = useLanguage();
  const [showClaimModal, setShowClaimModal] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
      className="min-h-screen py-24 px-6 flex flex-col items-center justify-center space-y-16"
    >
      <FreeClaimModal isOpen={showClaimModal} onClose={() => setShowClaimModal(false)} />
      <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        {/* Left: Content */}
        <div className="space-y-10 relative">
          <div className="absolute -top-20 -left-10 w-40 h-40 bg-blossom/10 rounded-full blur-3xl -z-10 animate-pulse" />

          <div className="space-y-4">
            <motion.div
              initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/5 border border-primary/10 text-[10px] font-black uppercase tracking-widest text-primary"
            >
              <Sparkles className="w-3 h-3" /> {t('home.newNetwork')}
            </motion.div>
            <h1 className="text-7xl md:text-9xl font-serif font-black text-primary leading-[0.85] tracking-tighter">
              {t('home.title').split(' ').slice(0, -1).join(' ')} <br /> <span className="italic font-medium text-accent">{t('home.title').split(' ').pop()}</span>
            </h1>
            <p className="text-lg text-text-muted max-w-lg font-medium leading-relaxed">
              {t('home.tagline')}
            </p>
          </div>

          <div className="flex flex-wrap gap-4">
            {['Easy Access', 'Safe & Hygienic', '24/7 Availability', 'Affordable'].map((tag, i) => (
              <motion.div
                key={tag}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 + i * 0.1 }}
                className="px-6 py-3 rounded-2xl glass border-muted-border text-[10px] font-black uppercase tracking-widest text-primary shadow-sm flex items-center gap-2"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                {tag}
              </motion.div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-6 pt-4">
            <button
              onClick={() => onNavigate('find')}
              className="px-12 py-6 rounded-full bg-primary text-white font-black uppercase text-xs tracking-[0.2em] shadow-2xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-4 border border-transparent"
            >
              {t('home.need_pad')} <ArrowRight className="w-5 h-5" />
            </button>

            {/* Donate Pads CTA */}
            <button
              onClick={() => onNavigate('donate')}
              className="px-10 py-6 rounded-full glass border-primary/20 text-primary font-black uppercase text-xs tracking-widest hover:bg-primary/5 transition-all flex items-center justify-center gap-3 shadow-lg hover:scale-105 active:scale-95"
            >
              🎁 {t('home.donate')}
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
            <div className="absolute inset-0 bg-gradient-to-t from-primary/30 to-transparent" />
          </motion.div>

          {/* Floating Elements */}
          <motion.div
            animate={{ y: [0, -10, 0] }} transition={{ duration: 5, repeat: Infinity }}
            className="absolute -top-10 -right-10 glass p-6 aspect-square rounded-3xl shadow-xl flex flex-col items-center justify-center border-white"
          >
            <div className="text-3xl">🌸</div>
            <div className="text-[8px] font-black uppercase mt-2 text-primary">{t('home.premiumCare')}</div>
          </motion.div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl w-full">
        {(t('home.features') as any[]).map(f => (
          <div key={f.t} className="glass p-8 space-y-4 hover:translate-y-[-5px] transition-all">
            <div className="w-10 h-10 bg-white/5 rounded-xl border border-white/10 flex items-center justify-center text-xl">✨</div>
            <h3 className="text-xl font-serif font-black">{f.t}</h3>
            <p className="text-sm text-text-muted leading-relaxed">{f.d}</p>
          </div>
        ))}
      </div>

      {/* Live Care Panel Section underneath features */}
      <div className="w-full max-w-5xl mt-16">
        <LiveCarePanel onSponsor={(id) => dispatch({ type: 'SET_PAGE', page: 'livecare', signalId: id })} />
      </div>
    </motion.div>
  );
};

const FindPodPage = ({ pods, onSelect, dispatch }: { pods: Pod[], onSelect: (id: string) => void, dispatch: React.Dispatch<Action> }) => {
  const { t } = useLanguage();
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
          <h1 className="text-5xl font-serif font-black">{t('find.title').split(' ').slice(0, -1).join(' ')} <span className="text-accent">{t('find.title').split(' ').pop()}</span></h1>
          <button
            onClick={() => {
              dispatch({ type: 'ADD_NOTIFICATION', notification: { id: Math.random().toString(), type: 'success', message: "Location updated: Mumbai, MH" } });
            }}
            className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-primary hover:text-accent transition-colors bg-white/40 px-4 py-2 rounded-full border border-primary/10"
          >
            <Globe className="w-3 h-3" /> {t('find.useLocation')}
          </button>
        </div>
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative group">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted group-focus-within:text-primary" />
            <input
              type="text" placeholder={t('find.searchPlaceholder')}
              value={query} onChange={e => setQuery(e.target.value)}
              className="w-full bg-white/60 border border-muted-border rounded-3xl py-5 pl-14 pr-8 outline-none focus:ring-4 focus:ring-accent/5 transition-all text-sm font-medium"
            />
          </div>
          <div className="flex gap-2 p-1 bg-muted-border/30 rounded-3xl">
            {(['all', 'available', 'high'] as const).map(f => (
              <button
                key={f} onClick={() => setFilter(f)}
                className={`px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${filter === f ? 'bg-white shadow-sm text-primary' : 'text-text-muted hover:text-primary'
                  }`}
              >
                {t(`common.${f}`) || f}
              </button>
            ))}
          </div>
        </div>
      </div>

      {bestPod && (
        <div className="glass p-10 border-accent/10 bg-accent/5 flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-5 font-black text-[10px] uppercase text-accent flex items-center gap-2">
            <Sparkles className="w-3 h-3" /> {t('find.recommended')}
          </div>
          <div className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-4xl font-serif font-black">{bestPod.name}</h2>
              <p className="text-text-muted flex items-center gap-2 text-sm font-medium"><MapPin className="w-4 h-4 text-accent" /> {bestPod.location}</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="px-4 py-2 rounded-full bg-accent/10 text-primary text-[10px] font-black uppercase tracking-widest border border-accent/20">{t('find.available')}</div>
              <div className="text-primary font-black text-lg">0.4 km away</div>
            </div>
          </div>
          <div className="flex gap-4">
            <button
              onClick={() => onSelect(bestPod.id)}
              className="px-12 py-5 rounded-full bg-primary text-white font-black uppercase text-xs tracking-widest hover:scale-105 transition-all shadow-xl"
            >
              {t('find.goToPod')}
            </button>
            <button
              onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${bestPod.lat},${bestPod.lng}`, '_blank')}
              className="p-5 rounded-full glass border-primary/10 text-primary hover:bg-primary hover:text-white transition-all shadow-sm"
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
            className={`glass p-8 space-y-6 group cursor-pointer transition-all border-muted-border/50 hover:border-accent/30 shadow-sm hover:shadow-xl ${p.status === 'inactive' ? 'opacity-40 grayscale pointer-events-none' : 'hover:translate-y-[-4px]'}`}
          >
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <h3 className="text-2xl font-serif font-black text-primary">{p.name}</h3>
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
                      <span className="text-text-muted">{t(`vending.types.${type}`) || type}</span>
                      <span className={count < 5 ? 'text-coral' : 'text-primary'}>{count} / 20</span>
                    </div>
                    <div className="h-1.5 w-full bg-muted-border/50 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-1000 ${count < 5 ? 'bg-coral' : 'bg-accent'}`}
                        style={{ width: `${(count / 20) * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-2">
              {p.demandScore > 80 ? (
                <div className="text-[10px] font-black text-secondary flex items-center gap-2 uppercase tracking-widest bg-secondary/5 px-3 py-1.5 rounded-full border border-secondary/10">
                  🔥 {t('find.highDemand')}
                </div>
              ) : <div />}
              {p.status === 'active' ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); window.open(`https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`, '_blank'); }}
                    className="p-3 rounded-full hover:bg-primary/5 text-primary transition-colors"
                  >
                    <Globe className="w-4 h-4" />
                  </button>
                  <div className="text-primary font-black text-xs inline-flex items-center gap-2 group-hover:translate-x-2 transition-all">
                    {t('find.accessPod')} <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              ) : (
                <div className="text-coral font-black text-[10px] uppercase tracking-widest">{t('find.unavailable')}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
};

const PodDetailPage = ({ pod, onDispense, onBack }: { pod: Pod, onDispense: (type: ProductType) => void, onBack: () => void }) => {
  const { t } = useLanguage();
  const [step, setStep] = useState<'idle' | 'processing' | 'result'>('idle');
  const [procPhase, setProcPhase] = useState("");

  const dispense = async (type: ProductType) => {
    if (pod.inventory[type] === 0) return;
    setStep('processing');
    setProcPhase(t('vending.securingHardware'));
    await new Promise(r => setTimeout(r, 600));
    setProcPhase(t('vending.allocatingItem'));
    await new Promise(r => setTimeout(r, 600));
    setProcPhase(t('vending.dispensingCare'));
    await new Promise(r => setTimeout(r, 800));

    onDispense(type);
    setStep('result');
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen py-32 px-6 max-w-5xl mx-auto space-y-12">
      <header className="flex items-center justify-between">
        <button onClick={onBack} className="p-5 rounded-full glass hover:border-primary/20 transition-all text-text-muted hover:text-primary shadow-sm group">
          <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
        </button>
        <div className="text-right space-y-1">
          <h1 className="text-4xl font-serif font-black text-primary">{pod.name}</h1>
          <p className="text-text-muted text-sm font-medium">{pod.location}</p>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {(['regular', 'overnight', 'ultra'] as const).map(type => {
          const inv = pod.inventory[type];
          const isLow = inv > 0 && inv < 5;
          return (
            <div key={type} className={`glass p-10 space-y-10 flex flex-col items-center text-center transition-all border-muted-border/50 ${inv === 0 ? 'opacity-40 grayscale selection:bg-none' : 'hover:border-accent/30 shadow-sm'}`}>
              <div className="relative">
                <div className="text-7xl drop-shadow-sm">{type === 'regular' ? '🌿' : type === 'overnight' ? '🌙' : '✨'}</div>
                {isLow && (
                  <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ repeat: Infinity }} className="absolute -top-2 -right-2 bg-coral text-white text-[8px] font-black px-2 py-1 rounded-full uppercase">{t('find.low')}</motion.div>
                )}
              </div>
              <div className="space-y-4 w-full">
                <div className="space-y-1">
                  <h3 className="text-2xl font-serif font-black capitalize text-primary">{t(`vending.types.${type}`) || type}</h3>
                  <p className={`text-[10px] font-black uppercase tracking-widest ${inv < 5 ? 'text-coral' : 'text-text-muted'}`}>
                    {inv > 0 ? `${inv} ${t('find.unitsAvailable')}` : t('find.completelyDepleted')}
                  </p>
                </div>
                <div className="h-1 w-full bg-muted-border/40 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${inv < 5 ? 'bg-coral' : 'bg-accent'}`} style={{ width: `${(inv / 20) * 100}%` }} />
                </div>
              </div>
              <button
                disabled={inv === 0}
                onClick={() => dispense(type)}
                className={`w-full py-5 rounded-full font-black text-[10px] uppercase tracking-widest transition-all shadow-md ${inv >= 5 ? 'bg-primary text-white hover:scale-105 active:scale-95' :
                  inv >= 1 ? 'bg-earth text-primary hover:scale-105 active:scale-95' :
                    'bg-muted-border text-text-muted pointer-events-none shadow-none'
                  }`}
              >
                {inv === 0 ? t('find.unavailable') : t('vending.confirmAndDispense')}
              </button>
            </div>
          );
        })}
      </div>

      <AnimatePresence>
        {step !== 'idle' && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-primary/20 backdrop-blur-xl"
          >
            <div className="max-w-md w-full glass p-12 text-center space-y-10 border-white shadow-2xl">
              {step === 'processing' && (
                <div className="space-y-8">
                  <div className="relative w-24 h-24 mx-auto">
                    <Loader2 className="w-24 h-24 text-primary animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center text-3xl animate-pulse">🌱</div>
                  </div>
                  <div className="space-y-3">
                    <h2 className="text-3xl font-serif font-black text-primary">{procPhase}</h2>
                    <p className="text-[10px] font-black text-text-muted uppercase tracking-[0.4em]">{t('vending.hardwareHandshake')}</p>
                  </div>
                </div>
              )}

              {step === 'result' && (
                <div className="space-y-10">
                  <motion.div
                    initial={{ scale: 0.8 }} animate={{ scale: 1 }}
                    className="w-32 h-32 mx-auto rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center text-7xl shadow-inner"
                  >
                    🌿
                  </motion.div>
                  <div className="space-y-3">
                    <h2 className="text-4xl font-serif font-black text-primary">{t('vending.careDispensed')}</h2>
                    <p className="text-sm text-text-muted font-medium">{t('vending.requestSuccess')}</p>
                  </div>
                  <button
                    onClick={() => { setStep('idle'); onBack(); }}
                    className="w-full py-5 rounded-full bg-primary text-white font-black text-[10px] uppercase tracking-widest shadow-xl"
                  >
                    {t('vending.completeSession')}
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
  const { t } = useLanguage();
  const [subData, setSubData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const plans = [
    { name: 'Starter Care', price: '₹199', units: 5, color: 'bg-blossom', desc: 'Perfect for light usage and backup.' },
    { name: 'Monthly Essential', price: '₹499', units: 15, color: 'bg-accent', desc: 'Our most popular plan for full monthly care.', popular: true },
    { name: 'Annual Bloom', price: '₹4999', units: 'Unlimited', color: 'bg-earth', desc: 'Zero worries for the entire year.' }
  ];

  useEffect(() => {
    const fetchSub = async () => {
       try {
          const sessionId = localStorage.getItem('sh_device_hash') || `anon_${Date.now()}`;
          localStorage.setItem('sh_device_hash', sessionId);
          const res = await apiFetch('/api/dispense/check', {
             method: 'POST',
             body: JSON.stringify({ session_id: sessionId })
          });
          if (res.subscription_valid) {
             setSubData(res.subscription);
          }
       } catch (e) {
          console.error("Failed to fetch sub", e);
       } finally {
          setLoading(false);
       }
    };
    fetchSub();
  }, []);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen py-32 px-6 max-w-6xl mx-auto space-y-16">
      <div className="text-center space-y-4">
        <h1 className="text-6xl font-serif font-black text-primary">{t('subscription.title')} <span className="text-accent">{t('subscription.plan')}.</span></h1>
        <p className="text-text-muted max-w-xl mx-auto font-medium">{t('subscription.tagline')}</p>
      </div>

      {subData && (
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="glass p-10 bg-primary/5 border-primary/10 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-6 text-center md:text-left">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-3xl">🌿</div>
            <div className="space-y-1">
              <h2 className="text-2xl font-serif font-black text-primary">Your Current Plan: <span className="text-accent italic uppercase">{subData.plan_name}</span></h2>
              <p className="text-xs text-text-muted font-bold uppercase tracking-widest">Active Session Protection • INR {subData.price_inr}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-3xl font-black text-primary">{subData.pads_remaining} / {subData.pads_total}</div>
              <div className="text-[10px] font-black uppercase text-text-muted tracking-widest">Pads Remaining</div>
            </div>
            <button className="px-8 py-4 rounded-full glass border-primary/10 text-primary font-black uppercase text-[10px] tracking-widest hover:bg-primary hover:text-white transition-all">Manage</button>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {plans.map(p => (
          <div key={p.name} className={`glass p-10 flex flex-col items-center text-center space-y-8 relative transition-all border-muted-border/50 hover:border-accent/30 shadow-sm hover:shadow-xl ${p.popular ? 'ring-2 ring-primary/20' : ''}`}>
            {p.popular && (
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 px-4 py-1.5 bg-primary text-white text-[9px] font-black uppercase tracking-widest rounded-full shadow-lg">Most Loved</div>
            )}
            <div className={`w-20 h-20 rounded-3xl ${p.color} bg-opacity-20 flex items-center justify-center text-4xl`}>
              {p.units === 5 ? '🌸' : p.units === 15 ? '🌿' : '🌳'}
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-serif font-black text-primary">{p.name}</h3>
              <p className="text-sm text-text-muted font-medium">{p.desc}</p>
            </div>
            <div className="text-5xl font-serif font-black text-primary">
              {p.price}<span className="text-sm font-sans font-bold text-text-muted">/mo</span>
            </div>
            <ul className="space-y-3 w-full text-left">
              {[`${p.units} Units per month`, 'Zero priority queueing', 'Direct map navigation', 'Real-time stock alerts'].map(f => (
                <li key={f} className="flex items-center gap-3 text-xs font-semibold text-text-muted">
                  <CheckCircle2 className="w-4 h-4 text-accent" /> {f}
                </li>
              ))}
            </ul>
            <button
              onClick={onSubscribe}
              className={`w-full py-5 rounded-full font-black text-[10px] uppercase tracking-widest transition-all ${p.popular ? 'bg-primary text-white shadow-xl' : 'bg-muted-border text-primary hover:bg-primary hover:text-white shadow-md'}`}
            >
              {t('subscription.selectPlan')}
            </button>
          </div>
        ))}
      </div>

      <div className="glass p-12 bg-earth/5 border-earth/20 flex flex-col md:flex-row items-center gap-10">
        <div className="flex-1 space-y-4">
          <h3 className="text-3xl font-serif font-black text-primary">Need a custom plan?</h3>
          <p className="text-text-muted font-medium">We partner with colleges, hospitals, and stations for bulk installations and custom logistics.</p>
        </div>
        <button className="px-10 py-5 rounded-full border-2 border-primary text-primary font-black uppercase text-xs tracking-widest hover:bg-primary hover:text-white transition-all">Contact Partnerships</button>
      </div>
    </motion.div>
  );
};

const TransactionsPage = ({ txns }: { txns: Transaction[] }) => {
  const { t } = useLanguage();
  const [filter, setFilter] = useState<'all' | 'success' | 'failed'>('all');
  const filtered = txns.filter(t => filter === 'all' ? true : t.status === filter);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen py-32 px-6 max-w-4xl mx-auto space-y-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <h1 className="text-5xl font-serif font-black text-primary">{t('history.title')} <span className="text-secondary">.</span></h1>
        <div className="flex gap-2 p-1 bg-muted-border/30 rounded-full">
          {(['all', 'success', 'failed'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} className={`px-6 py-2 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${filter === f ? 'bg-white shadow-sm text-primary' : 'text-text-muted hover:text-primary'}`}>{t(`common.${f}`) || f}</button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <AnimatePresence mode="popLayout">
          {filtered.map((txn, i) => (
            <motion.div
              key={txn.id} layout
              initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
              className="glass p-6 flex flex-col sm:flex-row items-center justify-between gap-6 group hover:border-accent/20 shadow-sm"
            >
              <div className="flex items-center gap-6">
                <div className="text-4xl group-hover:scale-110 transition-transform">🌸</div>
                <div className="space-y-1 text-center sm:text-left">
                  <h3 className="text-sm font-black text-primary uppercase tracking-widest">{txn.product_name}</h3>
                  <p className="text-xs text-text-muted font-medium">{txn.machine_name}</p>
                  <div className="text-[10px] font-black text-primary/60">₹{txn.amount}</div>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${txn.status === 'success' ? 'bg-accent/10 text-primary' : 'bg-coral/10 text-coral'}`}>
                  {txn.status === 'success' ? t('history.completed') || '✓ Completed' : t('history.unsuccessful') || '✗ Unsuccessful'}
                </div>
                <span className="text-[10px] text-text-muted font-bold tracking-widest">{new Date(txn.timestamp).toLocaleTimeString()}</span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {filtered.length === 0 && (
          <div className="py-32 flex flex-col items-center text-center space-y-6">
            <div className="text-6xl opacity-20">🍃</div>
            <p className="text-text-muted font-black text-[10px] uppercase tracking-[0.4em]">{t('history.noTransactions')}</p>
          </div>
        )}
      </div>
    </motion.div>
  );
};

const AdminDashboard = ({ pods, logs, onAction }: { pods: Pod[], logs: SHAYEvent[], onAction: (type: string, id?: string) => void }) => {
  const { t } = useLanguage();
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
          { l: 'System Throughput', v: stats.dispensed, t: 'Dispensed Today', i: TrendingUp, c: 'secondary' },
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
                      <div className={`w-2 h-2 rounded-full ${p.status === 'active' ? 'glow-teal' : p.status === 'maintenance' ? 'glow-gold' : 'glow-coral'}`} />
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
          <h3 className="text-xl font-serif font-black text-secondary">Audit Log</h3>
          <div className="glass p-6 h-96 overflow-y-auto space-y-4 font-mono text-[9px] uppercase tracking-widest text-[#aaa] custom-scrollbar">
            {logs.map(log => (
              <div key={log.id} className="border-l border-white/10 pl-4 py-1">
                <span className="text-text-muted">[{new Date(log.timestamp).toLocaleTimeString()}]</span> <span className="text-teal">{log.podName}</span> <span className="text-secondary">{log.type}</span>: {log.details}
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
  const { t } = useLanguage();
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

    if (email.includes("@shay.care") || email === "demo@care.com") {
      onUnlock();
    } else {
      setIsError(true);
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen pt-40 pb-20 px-6 flex items-center justify-center">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="max-w-md w-full glass p-12 space-y-10 border-muted-border/50 shadow-2xl">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 bg-primary/5 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <ShieldCheck className="w-10 h-10 text-primary" />
          </div>
          <h2 className="text-4xl font-serif font-black text-primary">{t('navigation.login') || 'Welcome Back.'}</h2>
          <p className="text-[10px] font-black uppercase text-text-muted tracking-[0.4em]">Secure Access Required</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-text-muted px-2">Email Address</label>
            <input
              type="email"
              required
              className="w-full bg-white/50 border border-muted-border rounded-2xl px-6 py-4 outline-none focus:ring-2 focus:ring-accent/20 transition-all"
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
              className="w-full bg-white/50 border border-muted-border rounded-2xl px-6 py-4 outline-none focus:ring-2 focus:ring-accent/20 transition-all"
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
            className="w-full py-5 rounded-full bg-primary text-white font-black text-[10px] uppercase tracking-widest hover:scale-[1.02] transition-all shadow-xl disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : (t('navigation.login') || "Sign In")}
          </button>
        </form>

        <div className="text-center pt-4">
          <button
            onClick={() => onNavigate('signup')}
            className="text-[10px] font-black uppercase tracking-widest text-text-muted hover:text-primary transition-colors"
          >
            Don't have an account? <span className="text-accent">{t('navigation.signup') || 'Sign Up'}</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const SignUpPage = ({ onSignup, onNavigate }: { onSignup: () => void, onNavigate: (p: State['activePage']) => void }) => {
  const { t } = useLanguage();
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
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-md w-full glass p-12 space-y-10 border-muted-border/50 shadow-2xl">
        <div className="text-center space-y-3">
          <h2 className="text-4xl font-serif font-black text-primary">Join SHAY.</h2>
          <p className="text-[10px] font-black uppercase text-text-muted tracking-[0.4em]">Start Your Wellness Journey</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-text-muted px-2">Full Name</label>
            <input
              required className="w-full bg-white/50 border border-muted-border rounded-2xl px-6 py-4 outline-none focus:ring-2 focus:ring-accent/20"
              placeholder="Ananya Roy" onChange={e => setFormData({ ...formData, name: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-text-muted px-2">Email Address</label>
            <input
              required type="email" className="w-full bg-white/50 border border-muted-border rounded-2xl px-6 py-4 outline-none focus:ring-2 focus:ring-accent/20"
              placeholder="user@example.com"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-text-muted px-2">Create Password</label>
            <input
              required type="password" className="w-full bg-white/50 border border-muted-border rounded-2xl px-6 py-4 outline-none focus:ring-2 focus:ring-accent/20"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit" disabled={isLoading}
            className="w-full py-5 rounded-full bg-primary text-white font-black text-[10px] uppercase tracking-widest hover:scale-[1.02] shadow-xl disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : (t('navigation.signup') || "Create Account")}
          </button>
        </form>

        <div className="text-center pt-4">
          <button
            onClick={() => onNavigate('admin')}
            className="text-[10px] font-black uppercase tracking-widest text-text-muted hover:text-primary transition-colors"
          >
            Already have an account? <span className="text-accent">{t('navigation.login') || 'Sign In'}</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const AboutPage = () => {
  const { t } = useLanguage();
  const [stats, setStats] = useState({ available: 0, donated: 0, dispensed: 0 });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await apiFetch("/api/stats/overview");
        setStats({
          available: data.active_machines || 125,
          donated: data.total_donated_pads || 0,
          dispensed: data.total_pads_dispensed || 0
        });
      } catch (e) {
        setStats({ available: 125, donated: 1540, dispensed: 1415 }); // fallback
      }
    };
    fetchStats();
  }, []);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen py-32 px-6 max-w-5xl mx-auto space-y-24">
      {/* Header */}
      <div className="space-y-6 text-center max-w-3xl mx-auto mt-10">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/5 border border-primary/10 text-[10px] font-black uppercase tracking-widest text-primary mb-4">
          <Globe className="w-3 h-3" /> {t('about.title') || "Our Mission"}
        </div>
        <h1 className="text-6xl md:text-8xl font-serif font-black text-primary leading-none tracking-tighter">
          Sanitary Care <br /> <span className="text-accent italic font-medium">Reimagined.</span>
        </h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-16 md:gap-24 items-center">
        {/* The Problem */}
        <div className="space-y-6">
          <h3 className="text-sm font-black uppercase tracking-widest text-coral pb-4 border-b border-coral/20">01. {t('about.problem') || "The Problem"}</h3>
          <p className="text-lg text-text-muted leading-relaxed">
            Period poverty restricts mobility, chips away at dignity, and forces millions to rely on unhygienic alternatives. 
            Public spaces lack discreet, reliable access to essential menstrual products, turning completely natural biological functions into logistical nightmares.
          </p>
        </div>

        {/* The Solution */}
        <div className="space-y-6">
          <h3 className="text-sm font-black uppercase tracking-widest text-primary pb-4 border-b border-primary/20">02. {t('about.solution') || "Our Solution"}</h3>
          <p className="text-lg text-text-muted leading-relaxed">
            Sahayaa introduces a decentralized, community-driven network of smart dispensing pods. 
            By merging real-time inventory tracking with the Live Care Network, we guarantee 24/7 hyper-local access to high-quality pads—privately, freely, and reliably.
          </p>
        </div>
      </div>

      {/* The Process */}
      <div className="space-y-12">
        <h3 className="text-sm font-black uppercase tracking-widest text-primary pb-4 border-b border-primary/20 text-center">03. {t('about.what_we_do') || "How it Works"}</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { step: '01', title: 'Locate', desc: 'Find the nearest Sahayaa pod using our real-time tracking map.' },
            { step: '02', title: 'Dispense', desc: 'Interact with the pod via your mobile device for a 100% contactless experience.' },
            { step: '03', title: 'Empower', desc: 'Sponsor a pad for someone else through our Live Care Network.' }
          ].map((s) => (
            <div key={s.step} className="glass p-8 rounded-3xl space-y-4 hover:-translate-y-2 transition-transform border border-muted-border/50">
              <div className="text-4xl font-serif font-black text-primary/20 pb-4">{s.step}</div>
              <h4 className="text-xl font-black text-primary">{s.title}</h4>
              <p className="text-sm text-text-muted leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Real-time Ticker */}
      <div className="bg-primary text-white rounded-[3rem] p-12 relative overflow-hidden shadow-2xl">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-white/10 rounded-full blur-3xl animate-pulse" />
        <h3 className="text-sm font-black uppercase tracking-widest text-white/70 mb-12 text-center">Real-Time Community Impact</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center divide-y md:divide-y-0 md:divide-x divide-white/20">
          <div className="px-4 py-8 md:py-0 space-y-2">
            <div className="text-6xl font-serif font-black text-white">{stats.donated.toLocaleString()}</div>
            <div className="text-xs uppercase tracking-widest text-white/70 font-black">Pads Donated</div>
          </div>
          <div className="px-4 py-8 md:py-0 space-y-2">
            <div className="text-6xl font-serif font-black text-white">{stats.dispensed.toLocaleString()}</div>
            <div className="text-xs uppercase tracking-widest text-white/70 font-black">Pads Dispensed</div>
          </div>
          <div className="px-4 py-8 md:py-0 space-y-2">
            <div className="text-6xl font-serif font-black text-accent">{stats.available.toLocaleString()}</div>
            <div className="text-xs uppercase tracking-widest text-white/70 font-black">Ready in Pool</div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 👑 MAIN APP WRAPPER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function SHAYApp() {
  const [state, dispatch] = useReducer(reducer, {
    pods: INITIAL_PODS,
    transactions: [],
    eventLog: [],
    pendingReservations: {},
    notifications: [],
    activePage: 'home',
    selectedPodId: null,
    signalId: null,
    isLoggedIn: false,
    user: null
  });

  const selectedPod = state.pods.find(p => p.id === state.selectedPodId);

  const statsSummary = useMemo(() => {
    return {
      activePods: state.pods.filter(p => p.status === 'active').length,
      dispensedToday: state.transactions.filter(t => new Date(t.timestamp).getTime() > Date.now() - 86400000 && (t.status === 'success' || t.status === 'completed')).length
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
          dispatch({ type: 'LOG_EVENT', event: { podName: randomPod.name, type: 'anomaly', timestamp: Date.now(), details: 'Critical usage spike detected' } });
        }
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [state.pods]);

  // Initialize Live Data
  useEffect(() => {
     apiFetch('/api/machines').then(pods => {
        dispatch({ type: 'SET_PODS', pods });
     }).catch(console.error);

     apiFetch('/api/transactions').then(res => {
        if(res.transactions) dispatch({ type: 'SET_TRANSACTIONS', transactions: res.transactions });
     }).catch(console.error);
  }, []);

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
      <ShayBackground />
      <LanguageSelector />

      <div className="pb-32">
        <AnimatePresence mode="wait">
          {state.activePage === 'home' && <HomePage key="h" onNavigate={p => dispatch({ type: 'SET_PAGE', page: p })} stats={statsSummary} dispatch={dispatch} />}
          {state.activePage === 'find' && <FindPodPage key="f" pods={state.pods} onSelect={id => window.location.href = `/vend/${id}`} dispatch={dispatch} />}
          {state.activePage === 'detail' && selectedPod && (
            <PodDetailPage
              key="d"
              pod={selectedPod}
              onBack={() => dispatch({ type: 'SET_PAGE', page: 'find' })}
              onDispense={type => {
                dispatch({ type: 'CONFIRM_DISPENSE', podId: selectedPod.id, product: type });
                dispatch({ type: 'ADD_NOTIFICATION', notification: { id: Date.now().toString(), type: 'success', message: `Dispensed ${type} from ${selectedPod.name}` } });
              }}
            />
          )}
          {state.activePage === 'history' && <TransactionsPage key="hs" txns={state.transactions} />}
          {state.activePage === 'subscription' && (
            <SubscriptionPage
              key="sub"
              user={state.user}
              onSubscribe={() => {
                dispatch({ type: 'ADD_NOTIFICATION', notification: { id: Date.now().toString(), type: 'success', message: 'Subscription activated successfully!' } });
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
          {state.activePage === 'donate' && (
            <DonatePage key="dnt" onComplete={() => dispatch({ type: 'SET_PAGE', page: 'home' })} />
          )}
          {state.activePage === 'pharmacy' && (
            <PharmacyPage key="phr" />
          )}
          {state.activePage === 'livecare' && state.signalId && (
            <LiveCarePage key="lve" signalId={state.signalId} onComplete={() => dispatch({ type: 'SET_PAGE', page: 'home' })} />
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

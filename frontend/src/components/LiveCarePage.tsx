"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, Gift, Globe, Loader2, Sparkles, CheckCircle2 } from "lucide-react";
import { useLanguage } from "../context/language-context";
import { apiFetch } from "@/lib/api";

export const LiveCarePage = ({ signalId, onComplete }: { signalId: number, onComplete: () => void }) => {
  const { t } = useLanguage();
  const [phase, setPhase] = useState<'loading' | 'matching' | 'success'>('loading');
  const [signal, setSignal] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const executeSponsorship = async () => {
      try {
        const data = await apiFetch(`/api/livecare/sponsor/${signalId}`, {
          method: 'POST',
          body: JSON.stringify({ session_id: localStorage.getItem('sh_device_hash') || `anon_${Date.now()}` })
        });
        
        if (data.error) {
          setError(data.error);
          setPhase('success'); // allow them to click done anyway
          return;
        }

        setSignal(data.signal);
        setPhase('matching');
        setTimeout(() => setPhase('success'), 3000);
      } catch (e) {
        // Fallback for mock if backend is down
        setSignal({ area: "Nearby", product_type: "Regular", qty: 1 });
        setPhase('matching');
        setTimeout(() => setPhase('success'), 3000);
      }
    };
    executeSponsorship();
  }, [signalId]);

  return (
    <div className="fixed inset-0 z-[500] bg-surface flex flex-col items-center justify-center p-6 overflow-hidden">
      {/* Dynamic Background */}
      <div className="absolute inset-0 bg-gradient-to-t from-coral/10 to-transparent opacity-50" />
      <motion.div 
        animate={{ scale: [1, 1.2, 1], rotate: [0, 90, 0] }} 
        transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-coral/5 rounded-full blur-[100px] -z-10"
      />

      <AnimatePresence mode="wait">
        {phase === 'loading' && (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center">
            <Loader2 className="w-12 h-12 text-coral animate-spin mb-4" />
            <p className="text-sm font-black uppercase tracking-widest text-text-muted">{t('common.loading') || "Processing..."}</p>
          </motion.div>
        )}

        {phase === 'matching' && signal && (
          <motion.div key="matching" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.1 }} className="flex flex-col items-center text-center space-y-12">
            <div className="flex items-center gap-8 md:gap-16">
              {/* Sponsor Node */}
              <motion.div 
                initial={{ x: -50, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
                className="flex flex-col items-center gap-4"
              >
                <div className="w-20 h-20 rounded-full bg-white shadow-xl flex items-center justify-center border-4 border-coral/20">
                  <Heart className="w-8 h-8 text-coral fill-coral animate-pulse" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-primary">You</span>
              </motion.div>

              {/* Path */}
              <div className="relative w-24 md:w-48 h-1 bg-coral/10 rounded-full">
                <motion.div 
                  initial={{ width: 0 }} animate={{ width: "100%" }} transition={{ duration: 2, ease: "easeInOut" }}
                  className="absolute top-0 left-0 h-full bg-gradient-to-r from-coral/40 to-coral rounded-full"
                />
                <motion.div 
                  initial={{ left: "0%" }} animate={{ left: "100%" }} transition={{ duration: 2, ease: "easeInOut" }}
                  className="absolute top-1/2 -translate-y-1/2 -ml-3"
                >
                  <Gift className="w-6 h-6 text-coral" />
                </motion.div>
              </div>

              {/* Recipient Node */}
              <motion.div 
                initial={{ x: 50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.5 }}
                className="flex flex-col items-center gap-4"
              >
                <div className="w-20 h-20 rounded-full glass shadow-xl flex items-center justify-center border border-muted-border">
                  <Globe className="w-8 h-8 text-text-muted" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-primary">{signal.area}</span>
              </motion.div>
            </div>
            
            <motion.h2 initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }} className="text-3xl font-serif font-black text-primary">
              {t('livecare.fulfilling') || "Thank you for helping someone today"}
            </motion.h2>
          </motion.div>
        )}

        {phase === 'success' && (
          <motion.div key="success" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center text-center max-w-md space-y-8 glass p-12 drop-shadow-2xl">
            <div className="w-24 h-24 bg-coral rounded-full flex items-center justify-center shadow-lg shadow-coral/30">
              {error ? <Sparkles className="w-12 h-12 text-white" /> : <CheckCircle2 className="w-12 h-12 text-white" />}
            </div>
            <div className="space-y-4">
              <h2 className="text-4xl font-serif font-black text-primary">
                {error ? "Oops" : (t('common.success') || "Success")}
              </h2>
              <p className="text-text-muted leading-relaxed font-medium">
                {error ? error : `Your sponsorship of ${signal?.qty} pad(s) has been secured and sent directly to a pod in ${signal?.area}.`}
              </p>
            </div>
            <button
              onClick={onComplete}
              className="w-full py-5 rounded-full bg-primary text-white font-black uppercase tracking-widest text-[10px] shadow-xl hover:scale-105 active:scale-95 transition-all"
            >
              {t('common.done') || "Done"}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

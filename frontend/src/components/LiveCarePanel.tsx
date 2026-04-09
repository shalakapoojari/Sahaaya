"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, Gift, Users, Clock, Flame, MapPin, Loader2 } from "lucide-react";
import { useLanguage } from "../context/language-context";
import { apiFetch } from "@/lib/api";

interface Signal {
  id: number;
  area: string;
  brand: string;
  product_type: string;
  qty: number;
  status: string;
  expires_at: string;
  lat: number;
  lng: number;
}

export const LiveCarePanel = ({ onSponsor }: { onSponsor: (id: number) => void }) => {
  const { t } = useLanguage();
  const [signals, setSignals] = useState<Signal[]>([]);
  const [stats, setStats] = useState({ total_open: 0, recently_matched: 0 });
  const [loading, setLoading] = useState(true);
  const [requestingPin, setRequestingPin] = useState(false);

  const requestRescuePin = () => {
    setRequestingPin(true);
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            await apiFetch('/api/livecare/signal', {
              method: 'POST',
              body: JSON.stringify({
                session_id: localStorage.getItem('sh_device_hash') || `anon_${Date.now()}`,
                area: "P2P Pin",
                lat: position.coords.latitude,
                lng: position.coords.longitude,
                brand: "Generic",
                product_type: "Regular",
                qty: 1
              })
            });
            fetchSignals();
          } catch (e) {
            alert("Already requested or failed.");
          } finally {
            setRequestingPin(false);
          }
        },
        () => {
          alert("Location denied. Cannot drop rescue pin.");
          setRequestingPin(false);
        }
      );
    } else {
      alert("Geolocation not supported.");
      setRequestingPin(false);
    }
  };

  const deliverInPerson = async (id: number, lat: number, lng: number) => {
    try {
      await apiFetch(`/api/livecare/sponsor/${id}`, {
        method: 'POST',
        body: JSON.stringify({ 
          session_id: localStorage.getItem('sh_device_hash') || `anon_${Date.now()}`,
          physical: true
        })
      });
      // Opens google maps directly
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, "_blank");
      fetchSignals();
    } catch (e: any) {
      alert("Failed to confirm delivery: " + e.message);
    }
  };

  const fetchSignals = async () => {
    try {
      const data = await apiFetch('/api/livecare/signals');
      setSignals(data.signals || []);
      setStats({
        total_open: data.total_open || 0,
        recently_matched: data.recently_matched || 0
      });
    } catch (e) {
      console.error("Failed to fetch signals", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSignals();
    const interval = setInterval(fetchSignals, 10000); // poll every 10s
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="w-full glass p-8 animate-pulse flex flex-col items-center justify-center space-y-4">
        <Heart className="w-8 h-8 text-primary animate-bounce opacity-50" />
        <p className="text-sm font-black text-primary uppercase tracking-widest">{t('common.loading')}</p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col md:flex-row items-end md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-serif font-black text-primary mb-2 flex items-center gap-3">
            <Heart className="w-8 h-8 text-coral fill-coral animate-pulse" />
            {t('livecare.title') || "Live Care Network"}
          </h2>
          <p className="text-sm text-text-muted font-medium flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-accent animate-ping" />
            {(t('livecare.need_now') || "X people need help right now").replace('X', stats.total_open.toString())}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={requestRescuePin}
            disabled={requestingPin}
            className="glass px-6 py-3 rounded-full flex items-center gap-2 text-xs font-black uppercase tracking-widest text-primary hover:bg-primary/5 active:scale-95 transition-all"
          >
            {requestingPin ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4 text-coral" />}
            {requestingPin ? "Dropping..." : "Drop Rescue Pin"}
          </button>
          
          <div className="glass px-6 py-3 rounded-full flex items-center gap-2 text-xs font-black uppercase tracking-widest text-sh-secondary hidden md:flex">
            <Flame className="w-4 h-4 text-accent" />
            {stats.recently_matched} sponsored recently
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence>
          {signals.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="col-span-full py-12 flex flex-col items-center text-center">
              <div className="text-4xl opacity-50 mb-4">✨</div>
              <p className="text-sm font-medium text-text-muted">No active requests at the moment.</p>
            </motion.div>
          ) : (
            signals.map((s, i) => (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }}
                transition={{ delay: i * 0.1 }}
                className="glass p-6 space-y-6 relative overflow-hidden group hover:border-coral/30"
              >
                <div className="absolute -top-10 -right-10 w-24 h-24 bg-coral/5 rounded-full blur-2xl group-hover:bg-coral/20 transition-all" />

                <div className="space-y-1">
                  <div className="flex items-center justify-between mb-4">
                    <span className="px-3 py-1 bg-primary/5 text-primary text-[10px] font-black uppercase tracking-[0.2em] rounded-full">
                      {s.area}
                    </span>
                    <span className="text-xs font-bold text-coral flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {Math.max(0, Math.floor((new Date(s.expires_at).getTime() - Date.now()) / 60000))}m left
                    </span>
                  </div>
                  <h3 className="text-lg font-black text-text-base">Someone needs {s.qty} {s.qty > 1 ? 'pads' : 'pad'}</h3>
                  <p className="text-sm text-text-muted font-medium">
                    Prefers {s.brand !== "Generic" ? `${s.brand} ` : ''}{s.product_type}
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => deliverInPerson(s.id, s.lat, s.lng)}
                    className="flex-1 py-3 rounded-full border border-coral text-coral font-black uppercase text-[10px] tracking-widest hover:bg-coral/5 transition-all flex items-center justify-center gap-2"
                  >
                    <MapPin className="w-3 h-3" /> Deliver
                  </button>
                  <button
                    onClick={() => onSponsor(s.id)}
                    className="flex-1 py-3 rounded-full bg-coral/10 text-coral font-black uppercase text-[10px] tracking-widest hover:bg-coral hover:text-white transition-all flex items-center justify-center gap-2"
                  >
                    <Gift className="w-3 h-3" /> {t('livecare.sponsor') || "Help Virtual"}
                  </button>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

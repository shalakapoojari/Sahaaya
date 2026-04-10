"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, Heart, Loader2, MapPin, RefreshCw, Zap } from "lucide-react";
import { getLiveSignals, sponsorSignal, type NeedSignal } from "@/lib/api";

interface LiveCarePanelProps {
  onSponsor?: (signalId: number) => void;
}

const minutesLabel = (m: number) => {
  if (m <= 0) return "Expiring";
  if (m < 60) return `${m}m left`;
  return `${Math.floor(m / 60)}h left`;
};

const SignalCard = ({
  signal,
  onSponsor,
  sponsoring,
}: {
  signal: NeedSignal;
  onSponsor: (id: number) => void;
  sponsoring: boolean;
}) => {
  const urgency = signal.minutes_left < 10 ? "high" : signal.minutes_left < 20 ? "medium" : "low";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`glass p-6 rounded-[1.5rem] border transition-all space-y-4 ${urgency === "high"
          ? "border-red-200 bg-red-50/30"
          : urgency === "medium"
            ? "border-amber-200 bg-amber-50/20"
            : "border-white/60"
        }`}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
            <MapPin className="w-3 h-3 text-rose-400" />
            {signal.area || "Nearby"}
          </div>
          <p className="text-sm font-black text-slate-800">
            {signal.brand ?? "Any brand"} · {signal.product_type ?? "Regular"} × {signal.qty}
          </p>
        </div>
        <div
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${urgency === "high"
              ? "bg-red-100 text-red-600"
              : urgency === "medium"
                ? "bg-amber-100 text-amber-600"
                : "bg-slate-100 text-slate-500"
            }`}
        >
          <Clock className="w-3 h-3" />
          {minutesLabel(signal.minutes_left)}
        </div>
      </div>

      {/* Nearest machine */}
      {signal.nearest_machine && (
        <p className="text-[10px] text-slate-400 font-medium">
          Nearest pod: <span className="font-bold text-slate-600">{signal.nearest_machine.name}</span>
          {" · "}{signal.nearest_machine.area}
        </p>
      )}

      {/* Sponsor button */}
      <button
        onClick={() => onSponsor(signal.id)}
        disabled={sponsoring}
        className="w-full py-3 rounded-xl bg-rose-500 text-white font-black text-[10px] uppercase tracking-widest hover:bg-rose-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
      >
        {sponsoring ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Heart className="w-3.5 h-3.5 fill-white" />
        )}
        {sponsoring ? "Processing…" : "Sponsor This Request"}
      </button>
    </motion.div>
  );
};

export const LiveCarePanel = ({ onSponsor }: LiveCarePanelProps) => {
  const [signals, setSignals] = useState<NeedSignal[]>([]);
  const [stats, setStats] = useState({ total_open: 0, recently_matched: 0, avg_response_time_mins: null as number | null });
  const [loading, setLoading] = useState(true);
  const [sponsoringId, setSponsoringId] = useState<number | null>(null);

  const sessionId =
    typeof window !== "undefined"
      ? localStorage.getItem("sh_device_hash") || `anon_${Date.now()}`
      : "guest";

  const fetchSignals = useCallback(async () => {
    try {
      const res = await getLiveSignals();
      setSignals(res.signals);
      setStats({
        total_open: res.total_open,
        recently_matched: res.recently_matched,
        avg_response_time_mins: res.avg_response_time_mins,
      });
    } catch (e) {
      console.error("LiveCare fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSignals();
    const interval = setInterval(fetchSignals, 30_000);
    return () => clearInterval(interval);
  }, [fetchSignals]);

  const handleSponsor = async (signalId: number) => {
    if (onSponsor) {
      onSponsor(signalId);
      return;
    }
    setSponsoringId(signalId);
    try {
      await sponsorSignal(signalId, {
        session_id: sessionId,
        sponsor_method: "digital",
      });
      await fetchSignals();
    } catch (e) {
      console.error("Sponsor error:", e);
    } finally {
      setSponsoringId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-3xl font-serif font-black text-slate-800">
            Live Care <span className="text-rose-500 italic">Network.</span>
          </h2>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Real-time sponsor requests from your community
          </p>
        </div>
        <button
          onClick={fetchSignals}
          className="flex items-center gap-2 px-4 py-2.5 rounded-full border border-slate-200 text-slate-400 text-[10px] font-black uppercase tracking-widest hover:border-rose-300 hover:text-rose-500 transition-all"
        >
          <RefreshCw className="w-3 h-3" /> Refresh
        </button>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Open Requests", value: stats.total_open, icon: <Zap className="w-3.5 h-3.5 text-rose-400" /> },
          { label: "Recently Matched", value: stats.recently_matched, icon: <Heart className="w-3.5 h-3.5 text-emerald-500" /> },
          {
            label: "Avg Response",
            value: stats.avg_response_time_mins ? `${stats.avg_response_time_mins}m` : "—",
            icon: <Clock className="w-3.5 h-3.5 text-violet-400" />,
          },
        ].map((s) => (
          <div key={s.label} className="glass p-5 rounded-2xl border-white/60 text-center space-y-1">
            <div className="flex items-center justify-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">
              {s.icon} {s.label}
            </div>
            <p className="text-2xl font-serif font-black text-slate-800">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Signal cards */}
      {loading ? (
        <div className="py-12 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-rose-400 animate-spin" />
        </div>
      ) : signals.length === 0 ? (
        <div className="py-16 text-center space-y-3">
          <p className="text-5xl">🌸</p>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            No active requests right now
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <AnimatePresence mode="popLayout">
            {signals.map((s) => (
              <SignalCard
                key={s.id}
                signal={s}
                onSponsor={handleSponsor}
                sponsoring={sponsoringId === s.id}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};
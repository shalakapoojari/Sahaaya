"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { MapPin, ArrowRight, Zap } from "lucide-react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

const Hero = () => {
  const [nearestPod, setNearestPod] = useState<any>(null);

  useEffect(() => {
    fetchNearestPod();
  }, []);

  const fetchNearestPod = async () => {
    try {
      const res = await apiFetch("/api/machines/emergency");
      if (res.machine) {
        setNearestPod(res.machine);
      }
    } catch (err) {
      console.error("Error fetching emergency pod:", err);
    }
  };

  const handleNeedPadNow = () => {
    if (nearestPod && nearestPod.latitude && nearestPod.longitude) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${nearestPod.latitude},${nearestPod.longitude}`, '_blank');
    } else {
      // Fallback to machines page if no pod found
      window.location.href = "/machines";
    }
  };

  return (
    <section className="relative min-h-[90vh] flex flex-col items-center justify-center pt-24 pb-16 px-6 overflow-hidden">
      {/* Background Decor - Ethereal Circles */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full -z-10 opacity-30 select-none pointer-events-none">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-rose-quartz/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-gold-soft/20 rounded-full blur-[100px] animate-pulse [animation-delay:2s]" />
      </div>

      <div className="max-w-6xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        {/* Left: Content */}
        <motion.div
          initial={{ x: -60, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col items-center lg:items-start text-center lg:text-left space-y-10"
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="inline-flex items-center gap-3 px-6 py-2.5 rounded-full bg-white/60 border border-gold/10 backdrop-blur-md shadow-sm"
          >
            <span className="w-2 h-2 rounded-full bg-gold animate-pulse shadow-[0_0_10px_rgba(212,175,55,0.5)]" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-light">Support, Simplified.</span>
          </motion.div>

          <h1 className="text-6xl md:text-8xl font-serif font-black tracking-tight text-slate leading-[0.9] flex flex-col">
            <span>Ethereal</span>
            <span className="text-gold italic font-medium -mt-2">Empowerment.</span>
          </h1>

          <p className="text-lg md:text-xl text-slate-light font-medium max-w-lg leading-relaxed">
            Dignity is a right, not a luxury. Experience seamless access to premium hygiene products with our boutique pod network.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-8 pt-4">
            <motion.button
              whileHover={{ scale: 1.05, boxShadow: "0 25px 50px -12px rgba(212, 175, 55, 0.2)" }}
              whileTap={{ scale: 0.95 }}
              onClick={handleNeedPadNow}
              className="group relative flex items-center justify-center gap-4 px-12 py-6 rounded-full bg-slate text-white font-black text-xs uppercase tracking-widest transition-all duration-500 shadow-2xl shadow-slate/20"
            >
              <Zap className="w-4 h-4 text-gold fill-gold" />
              <span>Need a Pad Right Now</span>
              <div className="absolute inset-0 rounded-full border-2 border-gold/40 animate-ping opacity-20" />
            </motion.button>

            <Link href="/machines" className="flex items-center gap-3 text-slate font-black uppercase tracking-[0.2em] text-xs hover:text-gold transition-all group">
              <span className="border-b-2 border-gold pb-1 transition-all">Explore Network</span>
              <ArrowRight className="w-4 h-4 transform group-hover:translate-x-2 transition-transform" />
            </Link>
          </div>

          <div className="flex items-center gap-10 pt-10 border-t border-gold/10 w-full lg:w-auto">
            <div className="text-left space-y-1">
              <div className="text-slate font-black text-2xl tracking-tighter">50+</div>
              <div className="text-slate-light text-[10px] font-black uppercase tracking-widest">Active Pods</div>
            </div>
            <div className="h-10 w-[1px] bg-gold/20" />
            <div className="text-left space-y-1">
              <div className="text-slate font-black text-2xl tracking-tighter">12k+</div>
              <div className="text-slate-light text-[10px] font-black uppercase tracking-widest">Women Helped</div>
            </div>
          </div>
        </motion.div>

        {/* Right: Visual Ethereal Pod */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1.2, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="relative aspect-square flex items-center justify-center"
        >
          {/* Main Container */}
          <div className="relative w-full h-full flex items-center justify-center">
            {/* Ethereal Pod Visual */}
            <div className="relative w-[340px] h-[480px] bg-white/60 backdrop-blur-3xl rounded-[4rem] shadow-[0_32px_80px_rgba(212,175,55,0.08)] flex items-center justify-center border border-white/40 overflow-hidden group">
              {/* Animated Inner Glow */}
              <div className="absolute inset-0 bg-gradient-to-b from-white/80 via-transparent to-rose-quartz/5" />

              {/* Stylized Bloom */}
              <div className="relative z-10 flex flex-col items-center gap-10">
                <div className="w-32 h-32 rounded-full glass bg-white/80 border-gold/10 flex items-center justify-center text-6xl shadow-xl transition-transform group-hover:scale-110 duration-700">
                  🌸
                </div>
                <div className="space-y-4 text-center">
                  <div className="h-1 w-32 bg-slate/5 rounded-full overflow-hidden mx-auto">
                    <motion.div
                      animate={{ x: [-128, 128] }}
                      transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
                      className="h-full w-20 bg-gold/40 rounded-full"
                    />
                  </div>
                  <div className="text-[10px] font-black text-slate-light uppercase tracking-[0.4em]">Sahayaa Premium</div>
                </div>
              </div>

              {/* Reflection */}
              <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-transparent pointer-events-none" />
            </div>

            {/* Glowing Halos */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[110%] h-[110%] -z-10">
              <div className="absolute top-0 left-0 w-full h-full bg-gold/5 rounded-full blur-[100px]" />
              <div className="absolute bottom-0 right-0 w-[60%] h-[60%] bg-rose-quartz/5 rounded-full blur-[80px]" />
            </div>

            {/* Floating Icons */}
            <motion.div
              animate={{ y: [0, -15, 0], rotate: [0, 5, 0] }}
              transition={{ repeat: Infinity, duration: 5 }}
              className="absolute -top-12 -right-8 w-24 h-24 glass flex items-center justify-center text-4xl shadow-xl border-gold/10"
            >
              🌿
            </motion.div>
            <motion.div
              animate={{ y: [0, 15, 0], rotate: [0, -5, 0] }}
              transition={{ repeat: Infinity, duration: 6, delay: 1 }}
              className="absolute -bottom-10 -left-6 w-20 h-20 glass flex items-center justify-center text-3xl shadow-xl border-gold/10"
            >
              ⚜️
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default Hero;

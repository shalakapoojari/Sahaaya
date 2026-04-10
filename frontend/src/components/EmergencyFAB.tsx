"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldAlert, Zap, X, MapPin } from "lucide-react";
import { apiFetch } from "@/lib/api";

const EmergencyFAB = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [nearestPod, setNearestPod] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchNearestPod();
    } else {
      setNearestPod(null);
    }
  }, [isOpen]);

  const fallbackToEmergency = async () => {
    try {
      const res = await apiFetch("/api/machines/emergency");
      if (res.machine) {
        setNearestPod(res.machine);
      }
    } catch (err) {
      console.error("Error fetching emergency pod:", err);
    }
  };

  const fetchNearestPod = async () => {
    setLoading(true);
    setNearestPod(null);

    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;

          console.log("USER LOCATION:", lat, lng); // 🔍 debug

          try {
            const res = await apiFetch("/api/machines/nearest", {
              method: "POST",
              headers: {
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                lat,
                lng,
                product_id: 1 // 🔥 IMPORTANT: send product_id
              })
            });

            console.log("NEAREST RESPONSE:", res); // 🔍 debug

            if (res.machine) {
              setNearestPod(res.machine);
            } else {
              console.warn("No nearby pod found");
              // 🔥 TEMP: disable fallback to debug
              // await fallbackToEmergency();
            }

          } catch (e) {
            console.error("Nearest fetch failed:", e);
            // await fallbackToEmergency(); // disable temporarily
          } finally {
            setLoading(false);
          }
        },

        async (err) => {
          console.error("Geolocation error:", err);
          await fallbackToEmergency();
          setLoading(false);
        },

        {
          enableHighAccuracy: true, // 🔥 VERY IMPORTANT
          timeout: 10000,
          maximumAge: 0
        }
      );
    } else {
      await fallbackToEmergency();
      setLoading(false);
    }
  };

  const handleRouteToPod = () => {
    if (nearestPod && nearestPod.latitude && nearestPod.longitude) {
      // Direct Google Maps routing
      const url = `https://www.google.com/maps/dir/?api=1&destination=${nearestPod.latitude},${nearestPod.longitude}`;
      window.open(url, '_blank');
      setIsOpen(false);
    }
  };

  return (
    <>
      {/* "Need a Pad Now" FAB Button */}
      <motion.button
        layoutId="emergency-fab"
        whileHover={{ scale: 1.05, y: -5 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(true)}
        className="fixed bottom-10 right-10 z-[60] px-8 py-5 rounded-full bg-slate text-white flex items-center gap-4 shadow-3xl shadow-slate/40 border-4 border-white/40 ring-4 ring-gold/10 overflow-hidden group"
      >
        <div className="absolute inset-0 bg-gradient-to-tr from-gold/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
        <Zap className="w-5 h-5 text-gold fill-gold animate-pulse" />
        <span className="font-black text-xs uppercase tracking-[0.2em]">Need a Pad Now</span>
        {/* Pulse Ring */}
        <div className="absolute inset-0 rounded-full border-4 border-gold/40 animate-ping opacity-20" />
      </motion.button>

      {/* Emergency Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-white/60 backdrop-blur-3xl"
          >
            <motion.button
              initial={{ opacity: 0, rotate: -90 }}
              animate={{ opacity: 1, rotate: 0 }}
              onClick={() => setIsOpen(false)}
              className="absolute top-10 right-10 text-slate/40 hover:text-slate transition-colors"
            >
              <X className="w-10 h-10" />
            </motion.button>

            <div className="max-w-lg w-full text-center space-y-12">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="space-y-6"
              >
                <div className="w-24 h-24 mx-auto glass border-gold/20 bg-white/80 flex items-center justify-center text-4xl shadow-2xl relative">
                  🌸
                  <div className="absolute inset-0 rounded-full border-2 border-gold/20 animate-ping" />
                </div>

                <div className="space-y-2">
                  <h2 className="text-5xl font-serif font-black text-slate italic tracking-tighter">
                    Support <span className="text-gold">Incoming.</span>
                  </h2>
                  <p className="text-slate-light font-black text-[10px] uppercase tracking-[0.4em]">
                    Initiating Private Routing Route
                  </p>
                </div>
              </motion.div>

              <div className="glass p-10 border-gold/10 bg-white/80 space-y-8 shadow-3xl shadow-gold/5">
                {loading ? (
                  <div className="py-6 flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-4 border-gold/10 border-t-gold rounded-full animate-spin" />
                    <span className="text-[10px] font-black text-slate/40 uppercase tracking-widest leading-none">Locating Nearest Pod...</span>
                  </div>
                ) : nearestPod ? (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <h3 className="text-2xl font-serif font-black text-slate underline decoration-gold/30 underline-offset-8">{nearestPod.name}</h3>
                      <div className="flex items-center justify-center gap-2 text-slate-light font-medium">
                        <MapPin className="w-4 h-4 text-gold" />
                        <span>{nearestPod.location}</span>
                      </div>
                    </div>

                    <p className="text-slate-light text-sm font-medium leading-relaxed">
                      This pod is within your immediate reach. We have reserved a private path for you via Google Maps.
                    </p>

                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handleRouteToPod}
                      className="w-full py-6 rounded-full bg-gold text-white font-black text-xs uppercase tracking-[0.3em] shadow-2xl transition-all"
                    >
                      Navigate via Google Maps
                    </motion.button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <p className="text-slate-light text-sm font-medium">We couldn&apos;t find a pod in your immediate vicinity. Please check the network map.</p>
                    <button
                      onClick={() => { window.location.href = "/machines"; setIsOpen(false); }}
                      className="text-[10px] font-black text-gold uppercase tracking-widest border-b-2 border-gold/20 pb-1"
                    >
                      View Full Pod Network
                    </button>
                  </div>
                )}
              </div>

              <div className="pt-6">
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-slate/20 font-black uppercase tracking-widest text-[10px] hover:text-slate transition-all"
                >
                  Safety First • Cancel Search
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default EmergencyFAB;

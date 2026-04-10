"use client";

import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Clock, ExternalLink, Loader2, MapPin, Phone, Search } from "lucide-react";
import { findNearbyPharmacies, type Pharmacy } from "@/lib/api";

export const PharmacyPage = () => {
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");
  const [radius, setRadius] = useState(2000);

  const handleSearch = useCallback(() => {
    setError("");
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await findNearbyPharmacies(pos.coords.latitude, pos.coords.longitude, radius);
          setPharmacies(res.pharmacies);
          setSearched(true);
        } catch (e: any) {
          setError(e.message || "Failed to find pharmacies.");
        } finally {
          setLoading(false);
        }
      },
      (err) => {
        setError("Location access denied. Please enable location permissions.");
        setLoading(false);
      },
      { timeout: 10_000 }
    );
  }, [radius]);

  const openMaps = (p: Pharmacy) => {
    window.open(`https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`, "_blank");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-h-screen py-32 px-6 max-w-4xl mx-auto space-y-10"
    >
      {/* Header */}
      <div className="space-y-3">
        <h1 className="text-6xl font-serif font-black text-slate-800 tracking-tighter">
          Find <span className="text-rose-500 italic">Pharmacy.</span>
        </h1>
        <p className="text-slate-500 max-w-xl font-medium">
          Locate the nearest open pharmacies via OpenStreetMap data. Always call ahead to confirm stock.
        </p>
      </div>

      {/* Controls */}
      <div className="glass p-8 rounded-[1.75rem] border-white/60 space-y-6 shadow-sm">
        <div className="space-y-3">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Search radius: <span className="text-rose-500">{(radius / 1000).toFixed(1)} km</span>
          </label>
          <input
            type="range"
            min={500}
            max={10000}
            step={500}
            value={radius}
            onChange={(e) => setRadius(Number(e.target.value))}
            className="w-full accent-rose-500"
          />
          <div className="flex justify-between text-[9px] text-slate-300 font-black uppercase tracking-widest">
            <span>500 m</span><span>10 km</span>
          </div>
        </div>

        <button
          onClick={handleSearch}
          disabled={loading}
          className="w-full py-5 rounded-2xl bg-rose-600 text-white font-black uppercase text-[11px] tracking-widest hover:bg-rose-700 transition-colors shadow-lg shadow-rose-200 flex items-center justify-center gap-3 disabled:opacity-60"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <MapPin className="w-4 h-4" />
          )}
          {loading ? "Searching nearby pharmacies…" : "Use My Location & Search"}
        </button>

        {error && (
          <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-50 border border-amber-200">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-sm font-medium text-amber-700">{error}</p>
          </div>
        )}
      </div>

      {/* Results */}
      <AnimatePresence>
        {searched && (
          <motion.div key="results" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-serif font-black text-slate-700">
                {pharmacies.length > 0
                  ? `${pharmacies.length} pharmacies found`
                  : "No pharmacies found"}
              </h2>
              {pharmacies.length > 0 && (
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Sorted by distance</p>
              )}
            </div>

            {pharmacies.length === 0 && (
              <div className="py-16 text-center space-y-4">
                <p className="text-5xl">🔍</p>
                <p className="text-slate-400 font-medium">Try increasing the search radius.</p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {pharmacies.map((p) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="glass p-7 rounded-[1.5rem] border-white/60 space-y-4 hover:border-rose-200 hover:shadow-lg transition-all group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-black text-slate-800 text-base truncate">{p.name}</h3>
                      <p className="text-xs text-slate-400 font-medium mt-0.5 truncate">{p.address}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-lg font-black text-rose-500">{p.distance_km.toFixed(1)}</p>
                      <p className="text-[9px] uppercase tracking-widest text-slate-400 font-black">km away</p>
                    </div>
                  </div>

                  {p.timings !== "Timings unavailable" && (
                    <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                      <Clock className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                      <span className="truncate">{p.timings}</span>
                    </div>
                  )}

                  {p.phone && (
                    <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                      <Phone className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                      <a href={`tel:${p.phone}`} className="hover:text-rose-500 transition-colors">{p.phone}</a>
                    </div>
                  )}

                  <button
                    onClick={() => openMaps(p)}
                    className="w-full py-3 rounded-xl border border-slate-200 text-slate-500 text-[10px] font-black uppercase tracking-widest hover:border-rose-400 hover:text-rose-500 hover:bg-rose-50 transition-all flex items-center justify-center gap-2"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Open in Maps
                  </button>
                </motion.div>
              ))}
            </div>

            <p className="text-center text-[10px] font-black uppercase tracking-widest text-slate-300">
              Data sourced from OpenStreetMap via Overpass API
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
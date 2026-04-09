"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { MapPin, Navigation2, Search, Cross, ArrowRight, Loader2, Store } from "lucide-react";
import { useLanguage } from "../context/language-context";
import { apiFetch } from "@/lib/api";

interface Pharmacy {
  id: string;
  name: string;
  address: string;
  rating: number;
  total_ratings: number;
  open_now: boolean;
  distance: number;
  phone: string;
  timings: string;
}

export const PharmacyPage = () => {
  const { t } = useLanguage();
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);

  const fetchPharmacies = async (lat: number, lng: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch("/api/pharmacies/nearby", {
        method: "POST",
        body: JSON.stringify({ lat, lng, radius: 3000 })
      });
      setPharmacies(data.pharmacies || []);
    } catch (e) {
      console.error(e);
      setError("Failed to locate pharmacies at this time.");
    } finally {
      setLoading(false);
    }
  };

  const requestLocation = () => {
    setLoading(true);
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          setLocation({lat, lng});
          fetchPharmacies(lat, lng);
        },
        (err) => {
          setError("Location access denied. Please manually input your area or enable permissions.");
          setLoading(false);
        }
      );
    } else {
      setError("Geolocation is not supported by your browser.");
      setLoading(false);
    }
  };

  useEffect(() => {
    requestLocation();
  }, []);

  return (
    <div className="min-h-screen pt-32 pb-20 px-6 max-w-5xl mx-auto space-y-12">
      <div className="space-y-4 text-center max-w-2xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-serif font-black text-primary flex items-center justify-center gap-4">
          <Store className="w-10 h-10 text-accent" />
          {t('pharmacy.title') || "Nearby Pharmacies"}
        </h1>
        <p className="text-sm font-medium text-text-muted">
          Access pads, hygiene essentials, and emergency care near you.
        </p>
      </div>

      {error && (
        <div className="glass p-6 border-red-500/20 text-red-600 text-center text-sm font-bold bg-red-50/50 rounded-2xl">
          {error}
          <button onClick={requestLocation} className="mt-4 px-6 py-2 bg-red-100 rounded-full text-xs uppercase tracking-widest hover:bg-red-200">
            Retry Location
          </button>
        </div>
      )}

      {loading ? (
        <div className="py-20 flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-muted">
            {t('pharmacy.finding') || "Searching near you..."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {pharmacies.map((p) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="glass p-6 rounded-3xl space-y-4 hover:border-primary/20 transition-all border border-transparent shadow-md"
            >
              <div className="flex justify-between items-start">
                <Store className="w-6 h-6 text-primary" />
                {p.distance && (
                  <span className="text-[10px] font-black bg-primary/5 text-primary px-3 py-1 rounded-full">
                    {p.distance.toFixed(1)} km away
                  </span>
                )}
              </div>
              <div>
                <h3 className="text-lg font-black text-text-base leading-tight">
                  {p.name}
                </h3>
                <p className="text-xs text-text-muted mt-1 truncate">
                  {p.address}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${p.open_now ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {p.open_now ? 'OPEN' : 'CLOSED'}
                  </span>
                  <span className="text-[10px] text-text-muted">{p.timings}</span>
                </div>
              </div>
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(p.address)}`}
                target="_blank"
                rel="noreferrer"
                className="w-full py-3 rounded-full border border-primary/20 text-primary font-black uppercase text-[10px] tracking-widest hover:bg-primary/5 transition-colors flex items-center justify-center gap-2"
              >
                <Navigation2 className="w-4 h-4" /> {t('pharmacy.get_directions') || "Get Directions"}
              </a>
            </motion.div>
          ))}

          {pharmacies.length === 0 && !error && location && (
            <div className="col-span-full py-12 text-center text-text-muted">
              No pharmacies found within a 3km radius of your location.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

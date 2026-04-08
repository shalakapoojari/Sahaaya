"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Cloud, Newspaper, TrendingUp, Search, Bell } from "lucide-react";

const QuickExitOverlay = () => {
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsActive((prev) => !prev);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <>
      {/* Global Quick Exit Toggle Button in Navbar (handled in Navbar.tsx conventionally, 
          but we can also trigger it from here if we want a global listener) */}
      <AnimatePresence>
        {isActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="fixed inset-0 z-[9999] bg-[#f8fafc] flex flex-col items-center p-8 overflow-y-auto"
          >
            {/* Generic News/Weather Layout */}
            <div className="max-w-6xl w-full space-y-10">
               <header className="flex items-center justify-between border-b pb-6">
                  <div className="flex items-center gap-4">
                     <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center"><Cloud className="text-slate-500" /></div>
                     <div>
                        <div className="text-sm font-bold text-slate-800">24°C • Mumbai</div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Partly Cloudy</div>
                     </div>
                  </div>
                  <div className="flex items-center gap-6">
                     <Search className="w-5 h-5 text-slate-300" />
                     <Bell className="w-5 h-5 text-slate-300" />
                     <div className="w-8 h-8 rounded-full bg-slate-200" />
                  </div>
               </header>

               <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="md:col-span-2 space-y-8">
                     <div className="space-y-4">
                        <div className="px-3 py-1 bg-blue-50 text-blue-600 text-[10px] font-black uppercase tracking-widest inline-block rounded">Breaking News</div>
                        <h1 className="text-4xl font-serif font-black text-slate-900 leading-tight">Global Markets Stability Observed Amidst New Economic Policy.</h1>
                        <div className="h-[300px] w-full bg-slate-100 rounded-2xl flex items-center justify-center italic text-slate-300">Image Asset Placeholder</div>
                        <p className="text-slate-500 leading-relaxed">
                           Financial analysts suggest that the new fiscal adjustments have initiated a phase of stabilization across major trading hubs. 
                           Local indices showed a standard growth pattern in the early morning session...
                        </p>
                     </div>
                  </div>

                  <div className="space-y-8">
                     <h3 className="text-lg font-serif font-black text-slate-900 border-b pb-4 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5" /> Trending Topics
                     </h3>
                     {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="flex gap-4 group cursor-pointer">
                           <div className="w-20 h-20 bg-slate-100 rounded-xl flex-shrink-0" />
                           <div className="space-y-2">
                              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none">Technology</div>
                              <div className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors">Sustainable Computing: The Future of Infrastructure.</div>
                           </div>
                        </div>
                     ))}
                  </div>
               </div>
            </div>

            {/* Hidden return button */}
            <button 
               onClick={() => setIsActive(false)}
               className="mt-20 text-[10px] text-slate-300 hover:text-slate-400 font-bold uppercase tracking-[0.5em] transition-all"
            >
               Return (Esc)
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default QuickExitOverlay;

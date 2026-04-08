"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface VendingSimulationProps {
  product: any;
  isDispensing: boolean;
  onComplete: () => void;
}

const VendingSimulation = ({ product, isDispensing, onComplete }: VendingSimulationProps) => {
  const [stage, setStage] = useState("idle"); // "idle", "dispensing", "falling", "landed"

  useEffect(() => {
    if (isDispensing) {
      setStage("dispensing");
      const timer = setTimeout(() => {
        setStage("falling");
        const fallTimer = setTimeout(() => {
          setStage("landed");
          const landingTimer = setTimeout(onComplete, 2000);
          return () => clearTimeout(landingTimer);
        }, 1200);
        return () => clearTimeout(fallTimer);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isDispensing, onComplete]);

  return (
    <div className="relative w-full h-[600px] flex items-center justify-center overflow-hidden">
      {/* Vending Machine Glass Front Container */}
      <div className="relative w-[380px] h-[550px] glass rounded-[3rem] border border-white/10 shadow-[0_0_100px_rgba(247,202,201,0.1)] overflow-hidden">
        {/* Background Depth Grid */}
        <div className="absolute inset-0 opacity-10 pointer-events-none" 
             style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

        {/* Shelves (Abstract Lines) */}
        {[1, 2, 3].map((s) => (
           <div key={s} className="absolute w-full h-[2px] bg-white/10" style={{ top: `${s * 25}%` }} />
        ))}

        {/* Selection Spiral (3D-Lite) */}
        <div className="absolute top-[25%] left-1/2 -translate-x-1/2 w-48 h-12 border-b-4 border-rose-quartz/20 rounded-full flex items-center justify-center rotate-x-45">
           <motion.div 
             animate={stage === 'dispensing' ? { rotate: 360 } : {}}
             transition={{ duration: 1, ease: "linear", repeat: stage === 'dispensing' ? Infinity : 0 }}
             className="w-full h-full border-2 border-white/40 rounded-full"
           />
        </div>

        {/* Product Box (3D-Lite) */}
        <AnimatePresence>
          {(stage === 'dispensing' || stage === 'falling' || stage === 'landed') && (
            <motion.div
              initial={{ scale: 0.8, opacity: 1, y: 120, z: -50 }}
              animate={
                stage === 'dispensing' ? { y: 140, z: 0, rotateZ: 5 } :
                stage === 'falling' ? { y: 460, rotateZ: 15 } :
                { y: 480, rotateZ: 2, scale: 1.05 }
              }
              transition={
                stage === 'falling' 
                  ? { type: "spring", stiffness: 80, damping: 10, mass: 1.2 } 
                  : { duration: 0.8, ease: "easeOut" }
              }
              className="absolute left-1/2 -ml-16 w-32 h-44 rounded-2xl bg-gradient-to-br from-rose-quartz to-burgundy p-1 shadow-2xl flex items-center justify-center z-50"
            >
              <div className="w-full h-full glass rounded-xl flex flex-col items-center justify-center text-center space-y-4 p-4">
                 <div className="text-4xl shadow-xl">{product.type === 'Super' ? "📦" : "🌸"}</div>
                 <div className="text-[10px] font-black text-white/40 uppercase tracking-widest">{product.name}</div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Soft Landing Bounce Effect at bottom */}
        {stage === 'landed' && (
           <motion.div 
             initial={{ scaleY: 1 }}
             animate={{ scaleY: [1, 0.4, 1.2, 1] }}
             transition={{ duration: 0.6 }}
             className="absolute bottom-6 left-12 right-12 h-10 bg-white/5 rounded-full blur-xl"
           />
        )}

        {/* Reflection Highlight */}
        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent pointer-events-none" />
      </div>

      {/* Floating Info */}
      <AnimatePresence>
         {stage === 'dispensing' && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="absolute bottom-32 glass px-8 py-3 text-rose-quartz font-black text-sm uppercase tracking-[0.3em] overflow-hidden"
            >
               Dispensing...
               <motion.div 
                 animate={{ x: ['-100%', '200%'] }}
                 transition={{ repeat: Infinity, duration: 1.5 }}
                 className="absolute bottom-0 left-0 h-0.5 w-[50%] bg-burgundy"
               />
            </motion.div>
         )}
      </AnimatePresence>
    </div>
  );
};

export default VendingSimulation;

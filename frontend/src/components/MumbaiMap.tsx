"use client";

import React from "react";
import { motion } from "framer-motion";

interface MumbaiMapProps {
  machines: any[];
  selectedMachine: any | null;
  onSelectMachine: (machine: any) => void;
}

const MumbaiMap = ({ machines, selectedMachine, onSelectMachine }: MumbaiMapProps) => {
  // Simplified stylized Mumbai map drawing using SVG
  // This is a representative vector map
  return (
    <div className="w-full h-full relative p-12 flex items-center justify-center bg-off-white overflow-hidden">
      {/* Background Floral Texture for Map */}
      <div className="absolute inset-0 opacity-5 pointer-events-none">
         <div className="absolute top-[20%] left-[30%] w-64 h-64 border border-gold rounded-full blur-xl" />
         <div className="absolute bottom-[10%] right-[20%] w-96 h-96 border border-gold-soft rounded-full blur-3xl shadow-inner" />
      </div>

      <svg 
        viewBox="0 0 800 1000" 
        className="w-full h-full max-w-4xl drop-shadow-[0_20px_50px_rgba(212,175,55,0.05)]"
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Mumbai Shape Silhouette (Ethereal) */}
        <motion.path
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 2, ease: "easeInOut" }}
          d="M380 50 C 420 80, 450 150, 460 220 C 470 300, 500 350, 520 420 C 540 500, 550 580, 540 680 C 530 780, 500 850, 450 920 C 400 980, 320 950, 300 900 C 280 850, 250 820, 230 750 C 210 680, 200 600, 220 520 C 240 450, 280 380, 300 300 C 320 220, 350 120, 380 50 Z"
          fill="rgba(255, 255, 255, 0.4)"
          stroke="rgba(212, 175, 55, 0.15)"
          strokeWidth="3"
        />

        {/* Major Arteries / Lines (Ethereal Gold) */}
        <motion.path 
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.5, duration: 2 }}
          d="M380 80 Q 400 300, 420 500 T 450 900" stroke="rgba(212, 175, 55, 0.08)" strokeWidth="1.5" strokeDasharray="10 10" />
        <motion.path 
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.8, duration: 2 }}
          d="M320 150 Q 300 450, 320 850" stroke="rgba(212, 175, 55, 0.08)" strokeWidth="1" strokeDasharray="5 5" />

        {/* Machine Pins */}
        {machines.map((machine) => {
          const isSelected = selectedMachine?.id === machine.id;
          // Representative coordinates mapping for the stylized SVG
          // In a real app, these would be derived from actual lat/long 
          // or a more sophisticated mapping util.
          const x = (machine.longitude - 72.8) * 1500 + 400;
          const y = 950 - (machine.latitude - 18.9) * 2000;

          return (
            <motion.g 
              key={machine.id}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              whileHover={{ scale: 1.2 }}
              onClick={() => onSelectMachine(machine)}
              className="cursor-pointer"
            >
              {/* Outer Glow */}
              <circle 
                cx={x} cy={y} r="20" 
                className={isSelected ? "fill-gold/10 animate-pulse" : "fill-transparent hover:fill-gold/5"} 
              />
              
              {/* Pin Base */}
              <circle 
                cx={x} cy={y} r={isSelected ? "8" : "5"} 
                className={isSelected ? "fill-gold" : "fill-white stroke-gold/40"} 
                strokeWidth="1.5"
                style={{ transition: "all 0.5s ease" }}
              />
              
              {/* "Perfume Bottle" Metaphor - Stock usage */}
              {isSelected && (
                <motion.rect
                  initial={{ height: 0 }}
                  animate={{ height: 12 }}
                  x={x-1.5} y={y-15} width="3" rx="1.5"
                  fill="rgba(212, 175, 55, 0.6)"
                />
              )}
            </motion.g>
          );
        })}
      </svg>

      {/* Map Labels (Representative) */}
      <div className="absolute top-[15%] left-[55%] text-[10px] font-black uppercase text-slate/20 tracking-[0.4em] transform -rotate-12 select-none">Boutique South</div>
      <div className="absolute top-[45%] left-[35%] text-[10px] font-black uppercase text-slate/20 tracking-[0.4em] transform rotate-12 select-none">Central Silk Way</div>
      <div className="absolute bottom-[20%] left-[45%] text-[10px] font-black uppercase text-slate/20 tracking-[0.4em] select-none">Island City</div>

      {/* Bottom Map Legend */}
      <div className="absolute bottom-10 left-10 flex items-center gap-6">
         <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-gold" />
            <span className="text-[9px] font-black uppercase text-slate/40 tracking-widest leading-none">Active Pod</span>
         </div>
         <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-white border border-gold/40" />
            <span className="text-[9px] font-black uppercase text-slate/40 tracking-widest leading-none">Expanding...</span>
         </div>
      </div>
    </div>
  );
};

export default MumbaiMap;

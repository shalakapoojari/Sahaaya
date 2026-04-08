"use client";

import React from "react";
import { motion } from "framer-motion";
import { MapPin, Zap, Navigation, CheckCircle2, AlertCircle } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface MachineCardProps {
  machine: any;
  isSelected?: boolean;
  onClick: () => void;
}

const MachineCard = ({ machine, isSelected, onClick }: MachineCardProps) => {
  const isOnline = machine.status === "active";
  const lowStock = machine.products?.some((p: any) => p.inventory < 5);

  return (
    <motion.div
      whileHover={{ x: 5, scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className={cn(
        "group p-6 rounded-[2.5rem] transition-all duration-700 cursor-pointer overflow-hidden relative border border-transparent",
        isSelected 
          ? "glass bg-white/90 border-gold shadow-2xl shadow-gold/10" 
          : "hover:glass bg-white/40 hover:bg-white/60"
      )}
    >
      {/* Background Decor */}
      {isSelected && (
        <div className="absolute top-0 right-0 w-32 h-32 bg-gold/10 rounded-full blur-[40px] -z-10 animate-pulse" />
      )}

      <div className="flex flex-col gap-6 relative z-10">
        <div className="flex items-center justify-between">
           <div className="flex items-center gap-2">
              <span className={cn(
                "w-2 h-2 rounded-full",
                isOnline ? "bg-emerald-400" : "bg-slate/20"
              )} />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate/40">
                {isOnline ? "Operational" : "Offline"}
              </span>
           </div>
           
           {lowStock && (
             <div className="px-3 py-1 rounded-full bg-gold/5 text-gold text-[9px] font-black uppercase tracking-widest border border-gold/10 flex items-center gap-1.5 animate-pulse">
                <AlertCircle className="w-3 h-3" /> Low Stock
             </div>
           )}
        </div>

        <div className="space-y-1">
           <h3 className={cn(
             "text-2xl font-serif font-black transition-all",
             isSelected ? "text-gold italic" : "text-slate"
           )}>
              {machine.name}
           </h3>
           <div className="flex items-center gap-2 text-slate-light font-medium text-xs">
              <MapPin className="w-3.5 h-3.5 text-gold/60" />
              <span>{machine.area}</span>
           </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-gold/5">
           <div className="text-[10px] font-black text-slate/30 uppercase tracking-[0.2em] leading-none">
              Platform: {machine.location?.split(',')[0]}
           </div>
           <div className="flex items-center gap-3">
              <button 
                onClick={(e) => { e.stopPropagation(); window.location.href = `/vend/${machine.id}`; }}
                className="w-10 h-10 rounded-full glass border-gold/10 bg-white/80 flex items-center justify-center text-slate hover:text-gold hover:scale-110 active:scale-95 transition-all shadow-sm"
              >
                 <Zap className="w-4 h-4 fill-gold/10 group-hover:fill-gold/40 transition-colors" />
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); window.open(`https://www.google.com/maps/dir/?api=1&destination=${machine.latitude},${machine.longitude}`, '_blank'); }}
                className="w-10 h-10 rounded-full glass border-gold/10 bg-white/80 flex items-center justify-center text-slate hover:text-gold hover:scale-110 active:scale-95 transition-all shadow-sm"
              >
                 <Navigation className="w-4 h-4 text-gold/60 group-hover:text-gold transition-colors" />
              </button>
           </div>
        </div>
      </div>
    </motion.div>
  );
};

export default MachineCard;

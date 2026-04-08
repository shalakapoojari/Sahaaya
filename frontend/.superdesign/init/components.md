# Shared UI Components

## DashboardCard
- Path: `src/components/DashboardCard.tsx`
- Description: Glassmorphic stat card with trend indicator and progress bar.
```tsx
"use client";

import React from "react";
import { motion } from "framer-motion";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface DashboardCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: {
    value: string;
    isUp: boolean;
  };
  color?: string;
}

const DashboardCard = ({ title, value, icon, trend, color = "bg-rose-quartz/10" }: DashboardCardProps) => {
  return (
    <motion.div
      whileHover={{ y: -8, scale: 1.02 }}
      className="glass p-10 flex flex-col space-y-6 relative overflow-hidden group border-white/20 transition-all duration-700 hover:shadow-2xl hover:shadow-gold/5 bg-white/60"
    >
      <div className={cn(
        "absolute -top-10 -right-10 w-40 h-40 rounded-full blur-[80px] opacity-10 group-hover:opacity-30 transition-opacity duration-1000",
        color
      )} />

      <div className="flex items-center justify-between z-10">
         <div className={cn("w-14 h-14 rounded-full flex items-center justify-center transition-transform duration-700 group-hover:rotate-12 group-hover:scale-110", "bg-silk border border-gold/10")}>
            {icon}
         </div>
         {trend && (
            <div className={cn(
               "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5",
               trend.isUp ? "bg-emerald-50 text-emerald-600/80" : "bg-red-50 text-red-600/80"
            )}>
               <span className="w-1 h-1 rounded-full bg-current animate-pulse" />
               {trend.value}
            </div>
         )}
      </div>

      <div className="space-y-1 z-10">
         <h3 className="text-slate/40 font-black text-[10px] uppercase tracking-[0.3em] leading-none mb-2">{title}</h3>
         <div className="text-5xl font-serif font-black text-slate tracking-tighter">
            {value}
         </div>
      </div>

      <div className="pt-2 z-10">
         <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
            <motion.div 
               initial={{ width: 0 }}
               whileInView={{ width: "100%" }}
               transition={{ duration: 2, delay: 0.5 }}
               className="h-full rounded-full bg-gold/40" 
            />
         </div>
      </div>
    </motion.div>
  );
};

export default DashboardCard;
```

## MachineCard
- Path: `src/components/MachineCard.tsx`
- Description: Card for displaying pod information in the list view.
```tsx
"use client";

import React from "react";
import { motion } from "framer-motion";
import { MapPin, Zap, Info } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const MachineCard = ({ machine, isSelected, onClick }: any) => {
  return (
    <motion.div
      onClick={onClick}
      whileHover={{ scale: 1.01 }}
      className={cn(
        "p-6 rounded-3xl border transition-all duration-500 cursor-pointer overflow-hidden relative",
        isSelected 
          ? "bg-white border-gold shadow-2xl shadow-gold/10" 
          : "bg-white/40 border-gold/5 hover:border-gold/20 hover:bg-white/60"
      )}
    >
       <div className="flex flex-col gap-5">
          <div className="flex justify-between items-start">
             <div className="space-y-1">
                <h3 className="text-xl font-serif font-black text-slate leading-none">{machine.name}</h3>
                <p className="text-[9px] font-black text-slate/30 uppercase tracking-widest">{machine.area}</p>
             </div>
             <div className={cn(
                "w-3 h-3 rounded-full",
                machine.status === 'active' ? "glow-teal" : "bg-slate/20"
             )} />
          </div>
          
          <div className="flex items-center gap-6">
             <div className="flex -space-x-2">
                {[1,2,3].map(i => (
                  <div key={i} className="w-6 h-6 rounded-full border-2 border-white bg-gold/10 flex items-center justify-center text-[8px]">🌸</div>
                ))}
             </div>
             <div className="text-[10px] font-bold text-slate/50">85% Stock Available</div>
          </div>

          <div className="flex items-center justify-between pt-2">
             <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate/40">
                <MapPin className="w-3.5 h-3.5 text-gold/40" />
                {machine.location}
             </div>
             <Zap className={cn("w-4 h-4 transition-colors", isSelected ? "text-gold" : "text-slate/10")} />
          </div>
       </div>
    </motion.div>
  );
};

export default MachineCard;
```

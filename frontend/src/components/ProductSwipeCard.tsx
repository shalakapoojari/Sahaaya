"use client";

import React from "react";
import { motion } from "framer-motion";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { Check, Info } from "lucide-react";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ProductSwipeCardProps {
  product: any;
  isSelected?: boolean;
  onSelect?: () => void;
}

const ProductSwipeCard = ({ product, isSelected, onSelect }: ProductSwipeCardProps) => {
  return (
    <motion.div
      whileHover={{ y: -10, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onSelect}
      className={cn(
        "relative w-[280px] h-[400px] flex-shrink-0 rounded-[2.5rem] overflow-hidden transition-all duration-700 cursor-pointer group",
        isSelected 
          ? "ring-4 ring-rose-quartz ring-offset-4 ring-offset-[#1a151a] shadow-3xl shadow-rose-quartz/20" 
          : "hover:shadow-2xl hover:shadow-white/5"
      )}
    >
      {/* High-Contrast Background */}
      <div className="absolute inset-0 bg-[#251e25] border border-white/10" />
      
      {/* Selection Glow */}
      <div className={cn(
        "absolute inset-0 bg-gradient-to-br from-rose-quartz/20 via-transparent to-transparent opacity-0 transition-opacity duration-700",
        isSelected && "opacity-100"
      )} />

      {/* Product Image / Icon representation */}
      <div className="h-[55%] relative flex items-center justify-center p-8">
        <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent" />
        <motion.div 
          animate={isSelected ? { y: [0, -10, 0] } : {}}
          transition={{ repeat: Infinity, duration: 3 }}
          className="text-8xl filter drop-shadow-3xl"
        >
          {product.type === 'Super' ? "📦" : product.type === 'Overnight' ? "🌙" : "🌸"}
        </motion.div>
        
        {/* Type Tag */}
        <div className="absolute top-8 left-8 px-4 py-1.5 rounded-full glass border-white/10 text-[10px] font-black text-rose-quartz uppercase tracking-widest">
           {product.type || 'Regular'}
        </div>
      </div>

      {/* Content */}
      <div className="h-[45%] p-8 flex flex-col justify-between relative z-10">
        <div className="space-y-2">
           <h3 className="text-2xl font-serif font-black text-white leading-tight underline decoration-rose-quartz/30 decoration-4 underline-offset-4">
              {product.name}
           </h3>
           <p className="text-white/40 text-xs font-medium line-clamp-2 leading-relaxed">
              {product.description}
           </p>
        </div>

        <div className="flex items-center justify-between pt-4">
           <div className="flex flex-col">
              <span className="text-[10px] font-black text-white/30 uppercase tracking-widest">Value</span>
              <span className="text-2xl font-black text-rose-quartz">₹{product.price}</span>
           </div>

           <div className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500",
              isSelected ? "bg-rose-quartz text-burgundy" : "bg-white/5 text-white/40 group-hover:bg-white/10"
           )}>
              {isSelected ? <Check className="w-6 h-6 stroke-[3]" /> : <Info className="w-5 h-5" />}
           </div>
        </div>
      </div>

      {/* Animated Shine Effect */}
      <div className="absolute inset-x-[-100%] top-0 bottom-0 bg-gradient-to-r from-transparent via-white/5 to-transparent skew-x-[-20deg] pointer-events-none group-hover:animate-[shine_2s_infinite]" />
    </motion.div>
  );
};

export default ProductSwipeCard;

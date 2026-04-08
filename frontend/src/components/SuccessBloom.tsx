"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Heart, Share2, Download } from "lucide-react";

interface SuccessBloomProps {
  productName: string;
  onClose: () => void;
}

const SuccessBloom = ({ productName, onClose }: SuccessBloomProps) => {
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowConfetti(true), 800);
    return () => clearTimeout(timer);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-[#1a151a]/95 backdrop-blur-3xl overflow-hidden"
    >
      {/* Background Liquid Flow */}
      <div className="absolute inset-0 -z-10 pointer-events-none overflow-hidden opacity-30">
        <motion.div 
           animate={{ rotate: 360, scale: [1, 1.2, 1] }}
           transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
           className="absolute -top-1/2 -right-1/2 w-[100%] h-[100%] bg-gradient-radial from-rose-quartz/20 to-transparent blur-[120px]"
        />
        <motion.div 
           animate={{ rotate: -360, scale: [1, 1.1, 1] }}
           transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
           className="absolute -bottom-1/2 -left-1/2 w-[100%] h-[100%] bg-gradient-radial from-serenity-blue/20 to-transparent blur-[120px]"
        />
      </div>

      <div className="max-w-lg w-full text-center space-y-12 relative">
        {/* Blooming Flower Animation */}
        <div className="relative w-72 h-72 mx-auto flex items-center justify-center">
           {[...Array(8)].map((_, i) => (
             <motion.div
               key={i}
               initial={{ scale: 0, opacity: 0, rotate: i * 45 }}
               animate={{ scale: 1, opacity: 1, rotate: i * 45 }}
               transition={{ 
                 delay: 0.2 + i * 0.1, 
                 type: "spring", 
                 stiffness: 100, 
                 damping: 15,
                 duration: 1.5 
               }}
               style={{ transformOrigin: "bottom center" }}
               className="absolute bottom-1/2 w-12 h-32 bg-gradient-to-t from-rose-quartz/40 to-rose-quartz rounded-full blur-[2px] border border-white/20"
             />
           ))}
           <motion.div
             initial={{ scale: 0 }}
             animate={{ scale: 1 }}
             transition={{ delay: 1, type: "spring", stiffness: 200 }}
             className="relative z-10 w-24 h-24 rounded-full glass border-white/20 flex items-center justify-center shadow-2xl"
           >
              <CheckCircle2 className="w-12 h-12 text-burgundy stroke-[3]" />
           </motion.div>

           {/* Confetti / Petals */}
           <AnimatePresence>
              {showConfetti && [...Array(24)].map((_, i) => (
                 <motion.div
                   key={`confetti-${i}`}
                   initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
                   animate={{ 
                     opacity: [0, 1, 0], 
                     scale: [0, 1, 0.5],
                     x: (i % 2 === 0 ? 1 : -1) * (200 + Math.random() * 200),
                     y: - (200 + Math.random() * 200),
                     rotate: 360
                   }}
                   transition={{ duration: 3, delay: i * 0.05, ease: "easeOut" }}
                   className="absolute text-2xl z-20"
                 >
                   🌸
                 </motion.div>
              ))}
           </AnimatePresence>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2, duration: 1 }}
          className="space-y-6"
        >
          <div className="space-y-2">
             <h2 className="text-5xl font-serif font-black text-white italic tracking-tighter transition-all">
                Bloom <span className="text-rose-quartz">Complete.</span>
             </h2>
             <p className="text-white/40 font-black text-xs uppercase tracking-[0.4em]">Success • Transaction #SAH-2024-X</p>
          </div>

          <div className="glass p-8 border-white/10 space-y-4">
             <div className="flex justify-center -space-x-4">
                {[...Array(4)].map((_, i) => (
                   <div key={i} className="w-12 h-12 rounded-full glass border-white/10 flex items-center justify-center text-xl shadow-xl animate-pulse">🌸</div>
                ))}
             </div>
             <p className="text-white text-lg font-medium">
               Your <span className="text-rose-quartz font-black">{productName}</span> is ready for collection at the bin.
             </p>
             <div className="pt-4 flex items-center justify-center gap-4">
                <button className="flex items-center gap-2 px-6 py-3 rounded-2xl glass bg-white/5 border-white/10 text-white/60 hover:text-white transition-all">
                   <Share2 className="w-4 h-4" /> Share
                </button>
                <button className="flex items-center gap-2 px-6 py-3 rounded-2xl glass bg-white/5 border-white/10 text-white/60 hover:text-white transition-all">
                   <Download className="w-4 h-4" /> Receipt
                </button>
             </div>
          </div>

          <div className="flex flex-col items-center gap-6 pt-6">
             <motion.div 
               animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
               transition={{ repeat: Infinity, duration: 3 }}
               className="flex items-center gap-3 glass px-6 py-3 border-burgundy/30 bg-burgundy/10 text-burgundy font-black text-xs uppercase tracking-widest"
             >
                <Heart className="w-4 h-4 fill-burgundy" /> 
                <span>You Helped Plant 1 Flower in the Garden</span>
             </motion.div>
             
             <button 
                onClick={onClose}
                className="text-white/30 font-black uppercase tracking-widest text-xs border-b border-white/10 hover:text-white transition-all pb-1"
             >
                Return to Home
             </button>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default SuccessBloom;

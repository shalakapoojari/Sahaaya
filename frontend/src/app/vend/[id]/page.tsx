"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Zap, ArrowLeft, ShieldCheck, CheckCircle2, 
  CreditCard, Loader2, Package, Sparkles, MapPin, 
  Navigation, User, Shield
} from "lucide-react";
import { apiFetch } from "@/lib/api";

const VenderPage = () => {
  const { id } = useParams();
  const router = useRouter();
  const [machine, setMachine] = useState<any>(null);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [vendingStatus, setVendingStatus] = useState<'idle' | 'processing' | 'vending' | 'success'>('idle');
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    fetchMachine();
    const savedUser = localStorage.getItem("sahayaa_user");
    if (savedUser) setUser(JSON.parse(savedUser));
  }, [id]);

  const fetchMachine = async () => {
    try {
      const data = await apiFetch(`/api/machines/${id}`);
      setMachine(data);
    } catch (err) {
      console.error("Error fetching machine:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleVend = async () => {
    if (!selectedProduct) return;
    setVendingStatus('processing');
    
    try {
      // Simulate/Trigger Vending
      const res = await apiFetch(`/api/machines/${id}/vend`, {
        method: "POST",
        body: JSON.stringify({ product_id: selectedProduct.id })
      });

      if (res.success) {
        setTimeout(() => setVendingStatus('vending'), 1500);
        setTimeout(() => setVendingStatus('success'), 4500);
      }
    } catch (err: any) {
      alert("Vending failed: " + err.message);
      setVendingStatus('idle');
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-20 bg-off-white">
         <div className="w-12 h-12 border-4 border-gold/10 border-t-gold rounded-full animate-spin mb-4" />
         <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate/40">Awakening Pod Hardware...</span>
      </div>
    );
  }

  if (!machine) return <div>Machine not found</div>;

  return (
    <div className="flex-1 flex flex-col min-h-[90vh] bg-off-white relative">
      {/* Dynamic Background */}
      <div className="absolute inset-0 -z-10 opacity-30 overflow-hidden pointer-events-none">
         <div className="absolute -top-[10%] -left-[5%] w-[40%] h-[40%] bg-gold-soft/20 rounded-full blur-[100px] animate-pulse" />
         <div className="absolute bottom-[20%] -right-[10%] w-[35%] h-[45%] bg-rose-quartz/20 rounded-full blur-[100px] animate-pulse [animation-delay:2s]" />
      </div>

      <div className="max-w-6xl mx-auto w-full flex-1 flex flex-col p-6 md:p-12 space-y-12">
        {/* Navigation / Header */}
        <header className="flex items-center justify-between">
           <button 
             onClick={() => router.back()}
             className="p-4 rounded-full bg-white/60 border border-gold/10 hover:border-gold hover:scale-105 active:scale-95 transition-all text-slate"
           >
              <ArrowLeft className="w-5 h-5" />
           </button>
           
           <div className="flex items-center gap-4 text-right">
              <div className="space-y-1">
                 <h2 className="text-3xl font-serif font-black text-slate italic leading-none">{machine.name}</h2>
                 <div className="flex items-center justify-end gap-2 text-[10px] font-black text-slate/40 uppercase tracking-widest uppercase">
                    <MapPin className="w-3 h-3 text-gold/40" /> {machine.area}
                 </div>
              </div>
           </div>
        </header>

        {/* Selection Area */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-16 items-start">
           {/* Products Selection */}
           <div className="lg:col-span-2 space-y-10">
              <div className="space-y-2">
                 <h1 className="text-5xl font-serif font-black text-slate tracking-tighter">Choose Your <span className="text-gold italic font-medium">Boutique</span> Solution.</h1>
                 <p className="text-[10px] font-black text-slate/40 uppercase tracking-[0.4em]">Premium Hygiene Curated for You</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                 {machine.products?.map((prod: any) => (
                    <motion.div
                      key={prod.id}
                      whileHover={{ y: -5, scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => !prod.inventory === 0 && setSelectedProduct(prod)}
                      className={cn(
                        "group p-8 rounded-[3rem] border transition-all duration-700 cursor-pointer overflow-hidden relative",
                        selectedProduct?.id === prod.id 
                          ? "bg-white border-gold shadow-3xl shadow-gold/10" 
                          : "bg-white/40 border-gold/5 opacity-60 hover:opacity-100 hover:border-gold/20",
                        prod.inventory === 0 && "opacity-20 cursor-not-allowed"
                      )}
                    >
                       {/* Background Symbol */}
                       <div className="absolute top-0 right-0 w-32 h-32 bg-gold/5 rounded-full blur-[40px] -z-10" />

                       <div className="flex flex-col gap-6">
                          <div className="flex items-center justify-between">
                             <div className="w-12 h-12 rounded-full glass bg-white/80 border-gold/10 flex items-center justify-center text-2xl shadow-xl transition-transform group-hover:rotate-12 group-hover:scale-110">
                                🌸
                             </div>
                             {selectedProduct?.id === prod.id && (
                                <motion.div layoutId="check" className="w-6 h-6 rounded-full bg-emerald-400 flex items-center justify-center text-white shadow-lg">
                                   <CheckCircle2 className="w-4 h-4" />
                                </motion.div>
                             )}
                          </div>

                          <div className="space-y-1">
                             <h3 className="text-2xl font-serif font-black text-slate">{prod.product_name}</h3>
                             <p className="text-[10px] font-black text-slate/30 uppercase tracking-widest">{prod.category || 'Standard Care'}</p>
                          </div>

                          <div className="flex items-center justify-between pt-6 border-t border-gold/5">
                             <div className="text-2xl font-black text-gold">₹{prod.price}</div>
                             <div className="text-[9px] font-black uppercase text-slate-light tracking-widest">
                                {prod.inventory > 0 ? `${prod.inventory} Units Available` : 'Out of Stock'}
                             </div>
                          </div>
                       </div>
                    </motion.div>
                 ))}
              </div>
           </div>

           {/* Checkout / Summary */}
           <div className="relative pt-12 lg:pt-24 h-full">
              <AnimatePresence mode="wait">
                 {selectedProduct ? (
                    <motion.div
                       key="checkout"
                       initial={{ x: 40, opacity: 0 }}
                       animate={{ x: 0, opacity: 1 }}
                       exit={{ x: -40, opacity: 0 }}
                       className="glass p-12 space-y-10 border-gold/20 bg-white/80 shadow-3xl shadow-gold/5 sticky top-32"
                    >
                       <div className="space-y-2 text-center">
                          <h3 className="text-3xl font-serif font-black text-slate text-gold underline decoration-gold/20 underline-offset-8">Order Manifest.</h3>
                          <p className="text-[10px] font-black text-slate/30 uppercase tracking-[0.4em]">Final Secure Verification</p>
                       </div>

                       <div className="space-y-6 pt-6">
                          <div className="flex items-center justify-between py-2 border-b border-gold/5">
                             <span className="text-[10px] font-black text-slate/40 uppercase tracking-widest">Selected Pod</span>
                             <span className="text-xs font-black text-slate">{machine.name}</span>
                          </div>
                          <div className="flex items-center justify-between py-2 border-b border-gold/5">
                             <span className="text-[10px] font-black text-slate/40 uppercase tracking-widest">Product</span>
                             <span className="text-xs font-black text-slate">{selectedProduct.product_name}</span>
                          </div>
                          <div className="flex items-center justify-between py-6">
                             <span className="text-[10px] font-black text-slate/40 uppercase tracking-widest">Total Amount</span>
                             <span className="text-4xl font-black text-gold">₹{selectedProduct.price}</span>
                          </div>
                       </div>

                       <button 
                         onClick={handleVend}
                         disabled={vendingStatus !== 'idle'}
                         className="w-full py-6 rounded-full bg-slate text-white font-black text-[10px] uppercase tracking-[0.3em] shadow-2xl flex items-center justify-center gap-4 hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                       >
                          {vendingStatus === 'idle' ? (
                             <>
                                <Zap className="w-5 h-5 text-gold fill-gold" />
                                Initiate Vending
                             </>
                          ) : (
                             <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Processing...
                             </>
                          )}
                       </button>

                       <p className="text-center text-[10px] font-black text-slate/20 uppercase tracking-[0.2em] pt-4">
                          Secure Payment Handled Post-Dispense
                       </p>
                    </motion.div>
                 ) : (
                    <motion.div
                       key="empty"
                       initial={{ opacity: 0 }}
                       animate={{ opacity: 1 }}
                       className="h-[400px] flex flex-col items-center justify-center text-center space-y-6 lg:border-l lg:border-gold/5 lg:pl-12"
                    >
                       <div className="w-20 h-20 rounded-full border-2 border-gold/10 flex items-center justify-center text-3xl opacity-20 group-hover:scale-110 duration-700">
                          🌸
                       </div>
                       <p className="text-slate/30 font-black uppercase text-[10px] tracking-[0.4em] max-w-[200px]">
                          Select a product to manifest your boutique session.
                       </p>
                    </motion.div>
                 )}
              </AnimatePresence>
           </div>
        </div>
      </div>

      {/* Vending Overlay Animations */}
      <AnimatePresence>
         {vendingStatus !== 'idle' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] glass border-none flex items-center justify-center bg-white/90 backdrop-blur-3xl"
            >
               <div className="max-w-md w-full text-center space-y-12">
                  <AnimatePresence mode="wait">
                     {vendingStatus === 'processing' && (
                        <motion.div key="p" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -20, opacity: 0 }} className="space-y-6">
                           <div className="w-32 h-32 mx-auto rounded-full glass border-gold/20 flex items-center justify-center text-5xl relative">
                              🔒
                              <div className="absolute inset-0 rounded-full border-2 border-gold/40 animate-ping" />
                           </div>
                           <h2 className="text-4xl font-serif font-black text-slate italic tracking-tighter">Securing <span className="text-gold">Hardware.</span></h2>
                           <p className="text-slate/40 font-black text-[10px] uppercase tracking-[0.3em]">Validating Unit Internals</p>
                        </motion.div>
                     )}
                     
                     {vendingStatus === 'vending' && (
                        <motion.div key="v" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -20, opacity: 0 }} className="space-y-8">
                           <div className="relative w-48 h-64 mx-auto glass bg-white/80 border-gold/20 rounded-[2rem] flex items-center justify-center overflow-hidden">
                              <motion.div 
                                animate={{ y: [0, 150] }}
                                transition={{ duration: 1.5, repeat: Infinity, ease: "easeIn" }}
                                className="w-32 h-16 glass bg-gold/10 border-gold/20 flex items-center justify-center text-3xl shadow-xl"
                              >
                                 🌸
                              </motion.div>
                           </div>
                           <h2 className="text-4xl font-serif font-black text-slate italic tracking-tighter">Dispensing <span className="text-gold">Care.</span></h2>
                           <p className="text-slate/40 font-black text-[10px] uppercase tracking-[0.3em]">Physical Handover in Progress</p>
                        </motion.div>
                     )}

                     {vendingStatus === 'success' && (
                        <motion.div key="s" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="space-y-8">
                           <motion.div
                             initial={{ scale: 0 }} animate={{ scale: 1, rotate: [0, 360] }}
                             className="w-40 h-40 mx-auto rounded-full bg-emerald-50 border-4 border-emerald-400 flex items-center justify-center text-7xl shadow-3xl shadow-emerald-400/20"
                           >
                              🌸
                           </motion.div>
                           <div className="space-y-4">
                              <h2 className="text-5xl font-serif font-black text-slate italic tracking-tighter">Session <span className="text-emerald-500">Perfected.</span></h2>
                              <p className="text-slate/40 font-black text-[10px] uppercase tracking-[0.4em]">Please Collect Your Product Below</p>
                           </div>
                           <motion.button
                             whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                             onClick={() => router.push("/")}
                             className="px-12 py-5 rounded-full bg-slate text-white font-black text-[10px] uppercase tracking-widest shadow-2xl"
                           >
                              Return to Life
                           </motion.button>
                        </motion.div>
                     )}
                  </AnimatePresence>
               </div>
            </motion.div>
         )}
      </AnimatePresence>
    </div>
  );
};

// Simple CN helper
function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(" ");
}

export default VenderPage;

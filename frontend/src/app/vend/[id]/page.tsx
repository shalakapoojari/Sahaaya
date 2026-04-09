"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Zap, ArrowLeft, CheckCircle2, 
  Loader2, Package, Sparkles, MapPin, 
  Minus, Plus, Heart, Info, ChevronRight
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useLanguage } from "@/context/language-context";
import LanguageSelector from "@/components/LanguageSelector";

const VenderPage = () => {
  const { t } = useLanguage();
  const { id } = useParams();
  const router = useRouter();
  
  // App State
  const [machine, setMachine] = useState<any>(null);
  const [brands, setBrands] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Selection State
  const [step, setStep] = useState(1);
  const [selectedBrand, setSelectedBrand] = useState<any>(null);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [quantity, setQuantity] = useState(1);
  const [isSponsoring, setIsSponsoring] = useState(false);
  
  // UI State
  const [vendingStatus, setVendingStatus] = useState<'idle' | 'processing' | 'vending' | 'success'>('idle');
  const [filter, setFilter] = useState<'all' | 'instock' | 'wings' | 'overnight'>('all');

  useEffect(() => {
    fetchData();
  }, [id]);

  useEffect(() => {
    const lastBrandId = localStorage.getItem("sh_last_brand");
    if (lastBrandId && brands.length > 0) {
      const found = brands.find(b => b.id === lastBrandId);
      if (found) setSelectedBrand(found);
    }
  }, [brands]);

  const suggestions = useMemo(() => {
    if (!selectedBrand || !machine) return null;
    
    // Check if any product of this brand is in stock
    const brandStock = machine.inventory.filter((i: any) => 
      i.product_name.toLowerCase().includes(selectedBrand.name.toLowerCase()) && i.quantity > 0
    );

    if (brandStock.length === 0) {
      // Suggest from OTHER brands
      const otherStock = machine.inventory.filter((i: any) => 
        !i.product_name.toLowerCase().includes(selectedBrand.name.toLowerCase()) && i.quantity > 0
      );
      return otherStock.length > 0 ? { type: 'brand', item: otherStock[0] } : null;
    }
    return null;
  }, [selectedBrand, machine]);

  const fetchData = async () => {
    try {
      const [mRes, bRes] = await Promise.all([
         apiFetch(`/api/machines/${id}`),
         apiFetch(`/api/products/brands`)
      ]);
      setMachine(mRes);
      setBrands(bRes);
    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  };

  const subtypes = useMemo(() => {
    if (!selectedBrand || !machine) return [];
    return machine.inventory
      .filter((item: any) => item.product_name.toLowerCase().includes(selectedBrand.name.toLowerCase()))
      .map((item: any) => ({
        ...item,
        brand_color: selectedBrand.color
      }));
  }, [selectedBrand, machine]);

  const filteredSubtypes = useMemo(() => {
    return subtypes.filter((s: any) => {
      if (filter === 'instock') return s.quantity > 0;
      if (filter === 'wings') return s.product_name.toLowerCase().includes('wings');
      if (filter === 'overnight') return s.product_name.toLowerCase().includes('night') || s.product_name.toLowerCase().includes('overnight');
      return true;
    });
  }, [subtypes, filter]);

  const handleVend = async () => {
    setVendingStatus('processing');
    try {
      const res = await apiFetch(`/api/vend`, {
        method: "POST",
        body: JSON.stringify({ 
          machine_id: id,
          product_id: selectedProduct.product_id,
          quantity: quantity,
          sponsored_added: isSponsoring,
          sponsored_price: 45,
          session_id: Math.random().toString(36).substring(7)
        })
      });

      if (res.success) {
        localStorage.setItem("sh_last_brand", selectedBrand.id);
        setTimeout(() => setVendingStatus('vending'), 1000);
        setTimeout(() => setVendingStatus('success'), 4000);
      }
    } catch (err: any) {
      alert("Vending failed: " + err.message);
      setVendingStatus('idle');
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-20 bg-surface min-h-screen">
         <div className="w-12 h-12 border-4 border-primary/10 border-t-primary rounded-full animate-spin mb-4" />
         <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/40">{t('common.loading')}</span>
      </div>
    );
  }

  if (!machine) return <div className="p-20 text-center">Machine not found</div>;

  const totalAmount = (selectedProduct?.product_price || 0) * quantity + (isSponsoring ? 45 : 0);

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-surface relative">
      <LanguageSelector />
      {/* Step Progress Indicator */}
      <div className="fixed top-0 left-0 w-full h-1 bg-primary/5 z-[1001]">
        <motion.div 
          className="h-full bg-gradient-to-r from-primary to-secondary"
          initial={{ width: "0%" }}
          animate={{ width: `${(step / 4) * 100}%` }}
        />
      </div>

      <div className="max-w-6xl mx-auto w-full flex-1 flex flex-col p-6 md:p-12 space-y-8">
        {/* Header */}
        <header className="flex items-center justify-between">
            <button 
              onClick={() => step > 1 ? setStep(step - 1) : router.back()}
              className="p-4 rounded-full glass hover:border-primary/20 transition-all text-sh-primary"
            >
               <ArrowLeft className="w-5 h-5" />
            </button>
            
            <div className="flex items-center gap-4 text-right">
               <div className="space-y-1">
                  <h2 className="text-3xl font-serif font-black text-sh-primary italic">{machine.name}</h2>
                  <div className="flex items-center justify-end gap-2 text-[10px] font-black text-sh-secondary uppercase tracking-widest">
                     <MapPin className="w-3 h-3 text-primary/40" /> {machine.area}
                  </div>
               </div>
            </div>
        </header>

        {/* Step Flow */}
        <div className="flex-1 flex flex-col">
          <AnimatePresence mode="wait">
            {/* STEP 1: BRAND SELECTION */}
            {step === 1 && (
              <motion.div 
                key="step1"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-12"
              >
                <div className="text-center space-y-4">
                  <h1 className="text-5xl md:text-7xl font-serif font-black text-sh-primary tracking-tighter">
                    {t('vending.chooseBrand').split(' ').slice(0, -1).join(' ')} <span className="italic text-secondary">{t('vending.chooseBrand').split(' ').pop()}</span>
                  </h1>
                  <p className="text-xs font-bold text-sh-secondary uppercase tracking-widest">{t('vending.trustedProtection')}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-12 max-w-5xl mx-auto py-12 px-6">
                  {brands.map((brand, idx) => (
                    <motion.div
                      key={brand.id}
                      onClick={() => {
                        setSelectedBrand(brand);
                        setStep(2);
                      }}
                      initial={{ rotate: idx % 2 === 0 ? -2 : 2 }}
                      whileHover={{ rotate: 0, y: -10, scale: 1.05 }}
                      className="fanned-card bg-white p-10 border border-primary/10 shadow-xl cursor-pointer relative overflow-hidden group"
                    >
                      <div className="absolute top-0 left-0 w-full h-2" style={{ backgroundColor: brand.color }} />
                      <div className="space-y-6">
                        <div className="w-16 h-16 rounded-2xl glass border-primary/5 flex items-center justify-center text-3xl group-hover:rotate-12 transition-transform">
                          {idx === 0 ? '🌸' : idx === 1 ? '✨' : '🌿'}
                        </div>
                        <div className="space-y-2">
                          <h3 className="text-3xl font-serif font-black text-sh-primary">{brand.name}</h3>
                          <p className="text-sm font-medium text-sh-secondary">{brand.tagline}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                          <span className="text-[10px] font-black uppercase text-success tracking-widest">{t('vending.inStock')}</span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* STEP 2: SUBTYPE SELECTION */}
            {step === 2 && (
              <motion.div 
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-12"
              >
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-primary/5 pb-8">
                  <div className="space-y-2">
                    <h1 className="text-5xl font-serif font-black text-sh-primary tracking-tighter">
                      {t('vending.selectSubtype').split(' ').slice(0, -1).join(' ')} <span className="italic text-secondary">{t('vending.selectSubtype').split(' ').pop()}</span>
                    </h1>
                    <p className="text-xs font-bold text-sh-secondary uppercase tracking-widest">{selectedBrand.name} {t('vending.brandVarieties')}</p>
                  </div>
                  
                  <div className="flex gap-2 p-1 bg-primary/5 rounded-full">
                    {(['all', 'instock', 'wings', 'overnight'] as const).map(f => (
                      <button
                        key={f} onClick={() => setFilter(f)}
                        className={cn("px-6 py-3 rounded-full text-[10px] font-black uppercase tracking-widest transition-all",
                        filter === f ? 'bg-white shadow-sm text-primary' : 'text-sh-secondary hover:text-primary')}
                      >
                        {t(`common.${f}`) || f}
                      </button>
                    ))}
                  </div>
                </div>

                {suggestions && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="p-6 bg-secondary/5 border border-secondary/20 rounded-3xl flex items-center justify-between gap-6"
                  >
                    <div className="flex items-center gap-4">
                      <div className="text-2xl">💡</div>
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-sh-primary uppercase tracking-wider">{t('vending.smartSuggestion')}</p>
                        <p className="text-sm text-sh-secondary font-medium">
                          {t('vending.suggestionText', { name: <span className="font-black text-secondary">{suggestions.item.product_name}</span> })}
                        </p>
                      </div>
                    </div>
                    <button 
                      onClick={() => {
                        const suggestedBrand = brands.find(b => suggestions.item.product_name.includes(b.name));
                        if (suggestedBrand) setSelectedBrand(suggestedBrand);
                        setSelectedProduct(suggestions.item);
                        setStep(3);
                      }}
                      className="btn-primary px-8 py-3 text-[10px] uppercase tracking-widest"
                    >
                      {t('vending.useSuggestion')}
                    </button>
                  </motion.div>
                )}

                {filteredSubtypes.length === 0 ? (
                  <div className="p-20 glass text-center space-y-4">
                    <div className="text-4xl">💛</div>
                    <p className="text-sh-secondary font-bold uppercase text-[10px] tracking-widest">{t('vending.noMatching')}</p>
                    <button onClick={() => setStep(1)} className="btn-ghost px-6 py-2">{t('vending.tryAnother')}</button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {filteredSubtypes.map((sub: any) => (
                      <motion.div
                        key={sub.product_id}
                        whileHover={{ y: -5 }}
                        onClick={() => {
                          if (sub.quantity > 0) {
                            setSelectedProduct(sub);
                            setStep(3);
                          }
                        }}
                        className={cn(
                          "bg-white p-8 rounded-[2rem] border transition-all cursor-pointer group relative overflow-hidden",
                          sub.quantity === 0 ? "opacity-40 grayscale cursor-not-allowed" : "border-primary/10 hover:border-primary/30 shadow-lg"
                        )}
                      >
                        {sub.quantity > 0 && sub.quantity <= 3 && (
                          <div className="absolute top-4 right-4 bg-error text-white text-[8px] font-black px-2 py-1 rounded-full uppercase z-10 animate-pulse">
                            {sub.quantity === 1 ? t('vending.lastOne') : `${sub.quantity} ${t('vending.left')}`}
                          </div>
                        )}
                        <div className="space-y-6">
                          <div className="w-full aspect-[4/3] glass bg-primary/5 rounded-2xl flex items-center justify-center text-4xl group-hover:scale-110 transition-transform">
                            {sub.product_name.toLowerCase().includes('night') ? '🌙' : '✨'}
                          </div>
                          <div className="space-y-1">
                            <h3 className="text-2xl font-serif font-black text-sh-primary">{sub.product_name.replace(selectedBrand.name, '').trim()}</h3>
                            <p className="text-[10px] font-black text-sh-secondary uppercase tracking-widest">₹{sub.product_price} {t('vending.perPack')}</p>
                          </div>
                          <button 
                            disabled={sub.quantity === 0}
                            className="w-full py-4 rounded-2xl bg-primary/5 text-primary font-black text-[10px] uppercase tracking-widest transition-all group-hover:bg-primary group-hover:text-white"
                          >
                            {sub.quantity === 0 ? t('common.unavailable') : t('common.select')}
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* STEP 3: QUANTITY */}
            {step === 3 && (
              <motion.div 
                key="step3"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="max-w-xl mx-auto w-full py-20 space-y-12 text-center"
              >
                <div className="space-y-4">
                  <h1 className="text-5xl font-serif font-black text-sh-primary tracking-tighter">
                    {t('vending.howManyPacks').split(' ').slice(0, -1).join(' ')} <span className="italic text-secondary">{t('vending.howManyPacks').split(' ').pop()}</span>
                  </h1>
                  <p className="text-xs font-bold text-sh-secondary uppercase tracking-widest">{t('vending.availableStock', { count: selectedProduct.quantity })}</p>
                </div>

                <div className="glass p-12 rounded-[3rem] border-primary/20 space-y-10">
                   <div className="flex items-center justify-center gap-10">
                      <button 
                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                        className="w-20 h-20 rounded-full glass border-primary/10 flex items-center justify-center text-primary hover:bg-primary hover:text-white transition-all shadow-lg"
                      >
                        <Minus className="w-8 h-8" />
                      </button>
                      
                      <div className="text-8xl font-serif font-black text-sh-primary min-w-[120px]">
                        {quantity}
                      </div>

                      <button 
                        onClick={() => setQuantity(Math.min(selectedProduct.quantity, quantity + 1))}
                        className="w-20 h-20 rounded-full glass border-primary/10 flex items-center justify-center text-primary hover:bg-primary hover:text-white transition-all shadow-lg"
                      >
                        <Plus className="w-8 h-8" />
                      </button>
                   </div>

                   <div className="pt-6 border-t border-primary/5">
                      <div className="text-4xl font-black text-primary">₹{selectedProduct.product_price * quantity}</div>
                      <p className="text-[10px] font-black text-sh-secondary uppercase tracking-widest mt-2">{quantity} × ₹{selectedProduct.product_price}</p>
                   </div>
                </div>

                <button 
                  onClick={() => setStep(4)}
                  className="w-full btn-primary py-6 text-xs uppercase tracking-widest flex items-center justify-center gap-3"
                >
                  {t('common.proceed')} <ChevronRight className="w-5 h-5" />
                </button>
              </motion.div>
            )}

            {/* STEP 4: CHECKOUT */}
            {step === 4 && (
              <motion.div 
                key="step4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="max-w-xl mx-auto w-full space-y-8"
              >
                <div className="text-center space-y-2">
                  <h1 className="text-5xl font-serif font-black text-sh-primary tracking-tighter italic">{t('vending.checkout')}</h1>
                  <p className="text-xs font-bold text-sh-secondary uppercase tracking-widest">{t('vending.reviewSession')}</p>
                </div>

                <div className="bg-white p-10 rounded-[3rem] border border-primary/10 shadow-2xl space-y-8 relative overflow-hidden">
                   <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -z-0" />
                   
                   <div className="space-y-6 relative z-10">
                      <div className="flex justify-between items-center pb-4 border-b border-primary/5">
                        <span className="text-[10px] font-black text-sh-secondary uppercase tracking-widest">{t('vending.brand')}</span>
                        <span className="text-lg font-serif font-black text-sh-primary">{selectedBrand.name}</span>
                      </div>
                      <div className="flex justify-between items-center pb-4 border-b border-primary/5">
                        <span className="text-[10px] font-black text-sh-secondary uppercase tracking-widest">{t('vending.subtype')}</span>
                        <span className="text-sm font-bold text-sh-primary">{selectedProduct.product_name.replace(selectedBrand.name, '')}</span>
                      </div>
                      <div className="flex justify-between items-center pb-4 border-b border-primary/5">
                        <span className="text-[10px] font-black text-sh-secondary uppercase tracking-widest">{t('vending.quantity')}</span>
                        <span className="text-sm font-bold text-sh-primary">{quantity} {t('vending.packs')}</span>
                      </div>
                   </div>

                   {/* Sponsor Toggle */}
                   <div className={cn(
                     "p-6 rounded-3xl border-2 transition-all cursor-pointer flex items-center justify-between gap-4",
                     isSponsoring ? "border-primary bg-primary/5" : "border-primary/10 bg-surface"
                   )}
                   onClick={() => setIsSponsoring(!isSponsoring)}
                   >
                     <div className="flex items-center gap-4">
                        <div className={cn("w-12 h-12 rounded-full flex items-center justify-center text-2xl transition-all", 
                        isSponsoring ? "bg-primary text-white shadow-lg animate-heart" : "bg-white text-primary border border-primary/10")}>
                          ❤️
                        </div>
                        <div className="text-left">
                           <h4 className="text-xs font-black text-sh-primary uppercase tracking-wider">{t('vending.sponsorAPad')}</h4>
                           <p className="text-[10px] text-sh-secondary font-medium">{t('vending.sponsorHelp')}</p>
                        </div>
                     </div>
                     <div className={cn("w-12 h-6 rounded-full relative transition-all bg-primary/20", isSponsoring ? "bg-primary" : "bg-primary/20")}>
                        <motion.div 
                          className="absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow-sm"
                          animate={{ x: isSponsoring ? 24 : 0 }}
                        />
                     </div>
                   </div>

                   <div className="pt-6 flex justify-between items-end">
                      <div className="space-y-1">
                        <span className="text-[10px] font-black text-sh-secondary uppercase tracking-widest">{t('vending.totalPayable')}</span>
                        <h2 className="text-5xl font-black text-primary italic">₹{totalAmount}</h2>
                      </div>
                      {isSponsoring && <div className="text-[10px] font-black text-secondary uppercase animate-pulse">{t('vending.communityGiftIncluded')}</div>}
                   </div>
                </div>

                <div className="space-y-4">
                  <button 
                    onClick={handleVend}
                    className="w-full btn-primary py-8 text-xs uppercase tracking-widest flex items-center justify-center gap-4 relative overflow-hidden group"
                  >
                    {t('vending.confirmAndVend')} <Zap className="w-5 h-5 fill-white" />
                  </button>
                  <button onClick={() => setStep(step - 1)} className="w-full text-[10px] font-black uppercase text-sh-secondary hover:text-primary transition-colors py-4">
                    ← {t('vending.backToAdjustments')}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Vending Overlay Animations */}
      <AnimatePresence>
         {vendingStatus !== 'idle' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[2000] glass border-none flex items-center justify-center bg-white/90 backdrop-blur-3xl"
            >
               <div className="max-w-md w-full text-center space-y-12">
                  <AnimatePresence mode="wait">
                     {vendingStatus === 'processing' && (
                        <motion.div key="p" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -20, opacity: 0 }} className="space-y-6">
                           <div className="w-32 h-32 mx-auto rounded-full glass border-primary/20 flex items-center justify-center text-5xl relative">
                              🔒
                              <div className="absolute inset-0 rounded-full border-2 border-primary/40 animate-ping" />
                           </div>
                           <h2 className="text-4xl font-serif font-black text-sh-primary italic tracking-tighter">
                             {t('vending.securingHardware').split(' ').slice(0, -1).join(' ')} <span className="text-primary">{t('vending.securingHardware').split(' ').pop()}</span>
                           </h2>
                           <p className="text-sh-secondary font-black text-[10px] uppercase tracking-[0.3em]">{t('vending.validatingInternals')}</p>
                        </motion.div>
                     )}
                     
                     {vendingStatus === 'vending' && (
                        <motion.div key="v" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -20, opacity: 0 }} className="space-y-8">
                           <div className="relative w-48 h-64 mx-auto glass bg-white/80 border-primary/20 rounded-[2rem] flex items-center justify-center overflow-hidden">
                              <motion.div 
                                animate={{ y: [0, 150] }}
                                transition={{ duration: 1.5, repeat: Infinity, ease: "easeIn" }}
                                className="w-32 h-16 glass bg-primary/10 border-primary/20 flex items-center justify-center text-3xl shadow-xl"
                              >
                                 🌸
                              </motion.div>
                           </div>
                           <h2 className="text-4xl font-serif font-black text-sh-primary italic tracking-tighter">
                             {t('vending.dispensingCare').split(' ').slice(0, -1).join(' ')} <span className="text-primary">{t('vending.dispensingCare').split(' ').pop()}</span>
                           </h2>
                           <p className="text-sh-secondary font-black text-[10px] uppercase tracking-[0.3em]">{t('vending.handoverInProgress')}</p>
                        </motion.div>
                     )}

                     {vendingStatus === 'success' && (
                        <motion.div key="s" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="space-y-8 animate-scale-in">
                           <motion.div
                             initial={{ scale: 0 }} animate={{ scale: 1, rotate: [0, 360] }}
                             className="w-40 h-40 mx-auto rounded-full bg-success/10 border-4 border-success flex items-center justify-center text-7xl shadow-3xl shadow-success/20"
                           >
                              {isSponsoring ? '💖' : '🌸'}
                           </motion.div>
                           <div className="space-y-4">
                              <h2 className="text-5xl font-serif font-black text-sh-primary italic tracking-tighter">
                                {t('vending.padsOnWay').split('.').slice(0, -1).join('.')} <span className="text-success">{t('vending.padsOnWay').split('.').slice(-1).join('.')}</span>
                              </h2>
                              <p className="text-sh-secondary font-black text-[10px] uppercase tracking-[0.4em]">{t('vending.collectBelow')}</p>
                              {isSponsoring && <p className="text-primary font-bold text-sm">{t('vending.sponsoredPadThanks')}</p>}
                           </div>
                           <motion.button
                             whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                             onClick={() => router.push("/")}
                             className="px-12 py-5 rounded-full bg-sh-primary text-white font-black text-[10px] uppercase tracking-widest shadow-2xl"
                           >
                              {t('common.done')}
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

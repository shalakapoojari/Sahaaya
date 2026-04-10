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
  const [selectedMode, setSelectedMode] = useState<'pay' | 'subscription' | 'community' | 'sponsor_request'>('pay');
  const [isSponsoring, setIsSponsoring] = useState(false);
  
  // UI State
  const [vendingStatus, setVendingStatus] = useState<'idle' | 'processing' | 'vending' | 'success'>('idle');
  const [checkResult, setCheckResult] = useState<any>(null);
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
      const sessionId = localStorage.getItem('sh_device_hash') || `anon_${Date.now()}`;
      localStorage.setItem('sh_device_hash', sessionId);

      const [mRes, bRes, cRes] = await Promise.all([
         apiFetch(`/api/machines/${id}`),
         apiFetch(`/api/products/brands`),
         apiFetch(`/api/dispense/check`, {
            method: 'POST',
            body: JSON.stringify({ session_id: sessionId })
         })
      ]);
      setMachine(mRes);
      setBrands(bRes);
      setCheckResult(cRes);
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
      const res = await apiFetch(`/api/dispense`, {
        method: "POST",
        body: JSON.stringify({ 
          session_id: localStorage.getItem('sh_device_hash'),
          product_id: selectedProduct.product_id,
          quantity: quantity,
          machine_id: machine.id,
          mode: selectedMode,
          lat: machine?.latitude || machine?.lat || 19.0,
          lng: machine?.longitude || machine?.lon || 72.8
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

  const handleProceedToModeSelection = async () => {
    setStep(3);
  };

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

            {/* STEP 2: PACK SELECTION */}
            {step === 2 && (
              <motion.div 
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-12"
              >
                <div className="text-center space-y-4">
                  <h1 className="text-5xl md:text-7xl font-serif font-black text-sh-primary tracking-tighter">
                    Select your <span className="italic text-secondary">Pack.</span>
                  </h1>
                  <p className="text-xs font-bold text-sh-secondary uppercase tracking-widest">{selectedBrand.name} Collection</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
                  {subtypes.map((sub: any) => (
                    <motion.div
                      key={sub.product_id}
                      whileHover={{ y: -10 }}
                      onClick={() => {
                        if (sub.quantity > 0) {
                          setSelectedProduct(sub);
                          setStep(3);
                        }
                      }}
                      className={cn(
                        "bg-white p-10 rounded-[3rem] border transition-all cursor-pointer group relative overflow-hidden flex flex-col gap-6",
                        sub.quantity === 0 ? "opacity-40 grayscale cursor-not-allowed" : "border-primary/10 hover:border-primary/30 shadow-xl"
                      )}
                    >
                      <div className="absolute top-0 left-0 w-full h-2" style={{ backgroundColor: selectedBrand.color }} />
                      
                      <div className="space-y-4 flex-1">
                        <div className="flex justify-between items-start">
                          <div className="w-16 h-16 rounded-2xl glass bg-primary/5 flex items-center justify-center text-3xl">
                            {sub.product_name.toLowerCase().includes('night') ? '🌙' : '✨'}
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] font-black uppercase text-sh-secondary tracking-widest block">{sub.product_type} Variant</span>
                            <span className="text-2xl font-black text-primary">₹{sub.product_price}</span>
                          </div>
                        </div>

                        <div className="space-y-2">
                           <h3 className="text-3xl font-serif font-black text-sh-primary leading-tight">{sub.product_name}</h3>
                           <p className="text-sm text-sh-secondary font-medium leading-relaxed bg-primary/5 p-4 rounded-2xl border border-primary/10">
                              {sub.description || "Premium protection with advanced absorbent core for maximum comfort."}
                           </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-4 border-t border-primary/5">
                        <div className="flex items-center gap-2">
                           <Package className="w-4 h-4 text-sh-secondary" />
                           <span className="text-[10px] font-black uppercase tracking-widest text-sh-secondary">
                              {sub.quantity > 10 ? "High Stock" : sub.quantity > 0 ? "Limited Stock" : "Out of Stock"}
                           </span>
                        </div>
                        <button 
                          disabled={sub.quantity === 0}
                          className="px-8 py-3 rounded-full bg-primary text-white font-black text-[10px] uppercase tracking-widest shadow-lg shadow-primary/20 group-hover:scale-105 transition-all"
                        >
                          Select Pack
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* STEP 3: DISPENSE MODE */}
            {step === 3 && (
              <motion.div 
                key="step3"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="max-w-4xl mx-auto w-full py-10 space-y-12"
              >
                <div className="text-center space-y-4">
                  <h1 className="text-5xl font-serif font-black text-sh-primary tracking-tighter">
                    How would you like to <span className="italic text-secondary">Dispense?</span>
                  </h1>
                  <p className="text-xs font-bold text-sh-secondary uppercase tracking-widest">Select your preferred access method</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Mode: Pay */}
                  <motion.div 
                    onClick={() => setSelectedMode('pay')}
                    className={cn(
                      "p-8 rounded-[2.5rem] border-2 transition-all cursor-pointer flex flex-col gap-6",
                      selectedMode === 'pay' ? "border-primary bg-primary/5 shadow-xl" : "border-primary/5 bg-white hover:border-primary/20"
                    )}
                  >
                    <div className="flex items-center justify-between">
                       <div className="w-14 h-14 rounded-2xl bg-primary text-white flex items-center justify-center text-2xl shadow-lg">💳</div>
                       <div className="text-right">
                          <span className="text-[10px] font-black uppercase text-sh-secondary tracking-widest block">Standard Access</span>
                          <span className="text-xl font-black text-primary">Pay via UPI/Card</span>
                       </div>
                    </div>
                    <div className="space-y-4">
                       <p className="text-sm text-sh-secondary font-medium">Quick and secure digital payment for immediate relief.</p>
                       {selectedMode === 'pay' && (
                         <div className="flex items-center gap-6 p-4 bg-white rounded-2xl border border-primary/10">
                            <span className="text-[10px] font-black uppercase tracking-widest text-sh-secondary">Quantity:</span>
                            <div className="flex items-center gap-4">
                               <button onClick={(e) => { e.stopPropagation(); setQuantity(Math.max(1, quantity - 1)); }} className="w-8 h-8 rounded-full border border-primary/10 flex items-center justify-center text-primary"><Minus className="w-4 h-4" /></button>
                               <span className="text-xl font-black text-sh-primary w-6 text-center">{quantity}</span>
                               <button onClick={(e) => { e.stopPropagation(); setQuantity(Math.min(selectedProduct.quantity, quantity + 1)); }} className="w-8 h-8 rounded-full border border-primary/10 flex items-center justify-center text-primary"><Plus className="w-4 h-4" /></button>
                            </div>
                            <div className="ml-auto text-lg font-black text-primary">₹{selectedProduct.product_price * quantity}</div>
                         </div>
                       )}
                    </div>
                  </motion.div>

                  {/* Mode: Subscription */}
                  <motion.div 
                    onClick={() => checkResult?.subscription_valid && setSelectedMode('subscription')}
                    className={cn(
                      "p-8 rounded-[2.5rem] border-2 transition-all flex flex-col gap-6",
                      !checkResult?.subscription_valid ? "opacity-50 grayscale cursor-not-allowed bg-slate-50" : (selectedMode === 'subscription' ? "border-secondary bg-secondary/5 shadow-xl cursor-pointer" : "border-primary/5 bg-white hover:border-secondary/20 cursor-pointer")
                    )}
                  >
                    <div className="flex items-center justify-between">
                       <div className="w-14 h-14 rounded-2xl bg-secondary text-white flex items-center justify-center text-2xl shadow-lg">⭐</div>
                       <div className="text-right">
                          <span className="text-[10px] font-black uppercase text-sh-secondary tracking-widest block">Premium Access</span>
                          <span className="text-xl font-black text-secondary">Subscription</span>
                       </div>
                    </div>
                    <div className="space-y-2">
                       <p className="text-sm text-sh-secondary font-medium">Use your active {checkResult?.subscription?.plan_name} plan.</p>
                       {checkResult?.subscription_valid ? (
                         <div className="px-4 py-2 bg-secondary/10 rounded-full inline-block">
                           <span className="text-[10px] font-black uppercase tracking-widest text-secondary">{checkResult?.subscription?.pads_remaining} Pads Remaining</span>
                         </div>
                       ) : (
                         <p className="text-[10px] font-black uppercase text-error tracking-widest">No active plan found</p>
                       )}
                    </div>
                  </motion.div>

                  {/* Mode: Donated Pad (Community) */}
                  <motion.div 
                    onClick={() => checkResult?.donated_pads_available && setSelectedMode('community')}
                    className={cn(
                      "p-8 rounded-[2.5rem] border-2 transition-all flex flex-col gap-6",
                      !checkResult?.donated_pads_available ? "opacity-50 grayscale cursor-not-allowed bg-slate-50" : (selectedMode === 'community' ? "border-accent bg-accent/5 shadow-xl cursor-pointer" : "border-primary/5 bg-white hover:border-accent/20 cursor-pointer")
                    )}
                  >
                    <div className="flex items-center justify-between">
                       <div className="w-14 h-14 rounded-2xl bg-accent text-white flex items-center justify-center text-2xl shadow-lg">🎁</div>
                       <div className="text-right">
                          <span className="text-[10px] font-black uppercase text-sh-secondary tracking-widest block">Social Gift</span>
                          <span className="text-xl font-black text-accent">Donated Pad</span>
                       </div>
                    </div>
                    <div className="space-y-2">
                       <p className="text-sm text-sh-secondary font-medium">Received a pad donated by the community.</p>
                       {checkResult?.donated_pads_available ? (
                          <div className="px-4 py-2 bg-accent/10 rounded-full inline-block">
                            <span className="text-[10px] font-black uppercase tracking-widest text-accent">Available in Pool</span>
                          </div>
                       ) : (
                          <p className="text-[10px] font-black uppercase text-error tracking-widest">Pool current empty</p>
                       )}
                    </div>
                  </motion.div>

                  {/* Mode: Free Claim (Sponsor Request) */}
                  <motion.div 
                    onClick={() => checkResult?.can_claim && setSelectedMode('sponsor_request')}
                    className={cn(
                      "p-8 rounded-[2.5rem] border-2 transition-all flex flex-col gap-6",
                      !checkResult?.can_claim ? "opacity-50 grayscale cursor-not-allowed bg-slate-50" : (selectedMode === 'sponsor_request' ? "border-coral bg-coral/5 shadow-xl cursor-pointer" : "border-primary/5 bg-white hover:border-coral/20 cursor-pointer")
                    )}
                  >
                    <div className="flex items-center justify-between">
                       <div className="w-14 h-14 rounded-2xl bg-coral text-white flex items-center justify-center text-2xl shadow-lg">🤝</div>
                       <div className="text-right">
                          <span className="text-[10px] font-black uppercase text-sh-secondary tracking-widest block">Emergency Aid</span>
                          <span className="text-xl font-black text-coral">Free Claim</span>
                       </div>
                    </div>
                    <div className="space-y-2">
                       <p className="text-sm text-sh-secondary font-medium">Claim 1 free pad daily provided by sponsors.</p>
                       {!checkResult?.can_claim && (
                          <div className="px-4 py-2 bg-coral/10 rounded-full inline-block">
                            <span className="text-[10px] font-black uppercase tracking-widest text-coral">Claimed Today</span>
                          </div>
                       )}
                    </div>
                  </motion.div>
                </div>

                <div className="flex flex-col gap-4">
                  <button 
                    onClick={() => setStep(4)}
                    className="w-full btn-primary py-6 text-xs uppercase tracking-widest flex items-center justify-center gap-3 shadow-2xl"
                  >
                    Confirm selection <ChevronRight className="w-5 h-5" />
                  </button>
                  <button onClick={() => setStep(2)} className="text-[10px] font-black uppercase text-sh-secondary hover:text-primary transition-colors py-2">
                    ← Change Pack
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 4: SUMMARY & DISPENSE */}
            {step === 4 && (
              <motion.div 
                key="step4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="max-w-xl mx-auto w-full space-y-8"
              >
                <div className="text-center space-y-2">
                  <h1 className="text-5xl font-serif font-black text-sh-primary tracking-tighter italic">Final Review</h1>
                  <p className="text-xs font-bold text-sh-secondary uppercase tracking-widest">Ready to dispense your care</p>
                </div>

                <div className="bg-white p-10 rounded-[3rem] border border-primary/10 shadow-2xl space-y-8 relative overflow-hidden">
                   <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -z-0" />
                   
                   <div className="space-y-6 relative z-10">
                      <div className="flex justify-between items-center pb-4 border-b border-primary/5">
                        <span className="text-[10px] font-black text-sh-secondary uppercase tracking-widest">Brand</span>
                        <span className="text-lg font-serif font-black text-sh-primary">{selectedBrand.name}</span>
                      </div>
                      <div className="flex justify-between items-center pb-4 border-b border-primary/5">
                        <span className="text-[10px] font-black text-sh-secondary uppercase tracking-widest">Pack</span>
                        <span className="text-sm font-bold text-sh-primary">{selectedProduct.product_name}</span>
                      </div>
                      <div className="flex justify-between items-center pb-4 border-b border-primary/5">
                        <span className="text-[10px] font-black text-sh-secondary uppercase tracking-widest">Method</span>
                        <span className="text-sm font-black text-secondary tracking-widest uppercase">
                          {selectedMode === 'pay' ? 'Direct Payment' : 
                           selectedMode === 'subscription' ? 'Plan Allocation' : 
                           selectedMode === 'community' ? 'Community Gift' : 'Free Help'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center pb-4 border-b border-primary/5">
                        <span className="text-[10px] font-black text-sh-secondary uppercase tracking-widest">Quantity</span>
                        <span className="text-sm font-bold text-sh-primary">{quantity} Pack(s)</span>
                      </div>
                   </div>

                   {/* Optional Sponsorship for Paid dispensed */}
                   {selectedMode === 'pay' && (
                     <div className={cn(
                       "p-6 rounded-3xl border-2 transition-all cursor-pointer flex items-center justify-between gap-4",
                       isSponsoring ? "border-primary bg-primary/5" : "border-primary/10 bg-surface"
                     )}
                     onClick={() => setIsSponsoring(!isSponsoring)}
                     >
                       <div className="flex items-center gap-4">
                          <div className={cn("w-12 h-12 rounded-full flex items-center justify-center text-2xl transition-all", 
                          isSponsoring ? "bg-primary text-white shadow-lg" : "bg-white text-primary border border-primary/10")}>
                            ❤️
                          </div>
                          <div className="text-left">
                             <h4 className="text-xs font-black text-sh-primary uppercase tracking-wider">Sponsor 1 Pad</h4>
                             <p className="text-[10px] text-sh-secondary font-medium">Add ₹45 to help someone else.</p>
                          </div>
                       </div>
                       <div className={cn("w-12 h-6 rounded-full relative transition-all bg-primary/20", isSponsoring ? "bg-primary" : "bg-primary/20")}>
                          <motion.div 
                            className="absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow-sm"
                            animate={{ x: isSponsoring ? 24 : 0 }}
                          />
                       </div>
                     </div>
                   )}

                   <div className="pt-6 flex justify-between items-end">
                      <div className="space-y-1">
                        <span className="text-[10px] font-black text-sh-secondary uppercase tracking-widest">Total Payable</span>
                        <h2 className="text-5xl font-black text-primary italic">₹{selectedMode === 'pay' ? (selectedProduct.product_price * quantity + (isSponsoring ? 45 : 0)) : 0}</h2>
                      </div>
                      <div className="text-[10px] font-black text-secondary uppercase italic">Secure Handover</div>
                   </div>
                </div>

                <div className="space-y-4">
                  <button 
                    onClick={handleVend}
                    className="w-full btn-primary py-8 text-xs uppercase tracking-widest flex items-center justify-center gap-4 relative overflow-hidden group shadow-2xl"
                  >
                    Confirm & Dispense <Zap className="w-5 h-5 fill-white" />
                  </button>
                  <button onClick={() => setStep(3)} className="w-full text-[10px] font-black uppercase text-sh-secondary hover:text-primary transition-colors py-4">
                    ← Back to selection
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

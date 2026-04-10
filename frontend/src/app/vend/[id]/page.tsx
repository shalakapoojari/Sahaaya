"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap, ArrowLeft, Loader2, Package,
  MapPin, Minus, Plus, ChevronRight,
  Heart, Star, Gift, Users, AlertCircle,
  CheckCircle2, Clock
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useLanguage } from "@/context/language-context";
import LanguageSelector from "@/components/LanguageSelector";

// ─────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────
type DispenseMode = "pay" | "subscription" | "community" | "sponsor_request";
type VendStatus = "idle" | "processing" | "vending" | "success" | "signal_sent";

interface MachineData {
  id: number;
  name: string;
  area: string;
  latitude: number;
  longitude: number;
  status: string;
  is_free_zone: boolean;
  stock_status: string;
  inventory: EnrichedInventoryItem[];
}

interface EnrichedInventoryItem {
  id: number;
  machine_id: number;
  product_id: number;
  product_name: string;
  brand: string;
  quantity: number;
  sponsored_quantity: number;
  // Merged from /api/products
  price: number;
  product_type: string;
  description: string;
  brand_color?: string;
}

interface Brand {
  id: string;
  name: string;
  tagline: string;
  color: string;
  logo_url: string;
}

interface CheckResult {
  can_claim: boolean;
  last_claim_date: string | null;
  next_claim_time: string | null;
  subscription: SubscriptionInfo | null;
  subscription_valid: boolean;
  donated_pads_available: boolean;
  available_modes: { id: DispenseMode; label: string; description: string }[];
}

interface SubscriptionInfo {
  plan: string;
  plan_name: string;
  price_inr: number;
  pads_remaining: number;
  pads_total: number;
  status: string;
  is_valid: boolean;
}

// ─────────────────────────────────────────────
//  Session helper
// ─────────────────────────────────────────────
const SESSION_KEY = "sh_session_id";
const LAST_BRAND_KEY = "sh_last_brand";

function getSessionId(): string {
  if (typeof window === "undefined") return "";
  let sid = localStorage.getItem(SESSION_KEY);
  if (!sid) {
    sid = `anon_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(SESSION_KEY, sid);
  }
  return sid;
}

// ─────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────
function cn(...inputs: (string | boolean | undefined | null)[]) {
  return inputs.filter(Boolean).join(" ");
}

function modeIcon(mode: DispenseMode): string {
  const map: Record<DispenseMode, string> = {
    pay: "💳",
    subscription: "⭐",
    community: "🎁",
    sponsor_request: "🤝",
  };
  return map[mode];
}

function modeLabel(mode: DispenseMode): string {
  const map: Record<DispenseMode, string> = {
    pay: "Direct Payment",
    subscription: "Plan Allocation",
    community: "Community Gift",
    sponsor_request: "Sponsor Request",
  };
  return map[mode];
}

function brandEmoji(idx: number): string {
  const emojis = ["🌸", "✨", "🌿", "🌺", "💫", "🍃"];
  return emojis[idx % emojis.length];
}

function productEmoji(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("night") || n.includes("overnight")) return "🌙";
  if (n.includes("xl") || n.includes("extra")) return "💪";
  if (n.includes("ultra") || n.includes("thin")) return "🪶";
  if (n.includes("liner")) return "🌼";
  return "✨";
}

function stockLabel(qty: number, sponsoredQty: number): string {
  const total = qty + sponsoredQty;
  if (total === 0) return "Out of Stock";
  if (total <= 5) return "Low Stock";
  if (total <= 15) return "Available";
  return "High Stock";
}

function stockColor(qty: number, sponsoredQty: number): string {
  const total = qty + sponsoredQty;
  if (total === 0) return "text-red-400";
  if (total <= 5) return "text-amber-500";
  return "text-green-500";
}

// ─────────────────────────────────────────────
//  Component
// ─────────────────────────────────────────────
const VenderPage = () => {
  const { t } = useLanguage();
  const { id } = useParams();
  const router = useRouter();

  // Data
  const [machine, setMachine] = useState<MachineData | null>(null);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkResult, setCheckResult] = useState<CheckResult | null>(null);

  // Selection
  const [step, setStep] = useState(1);
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<EnrichedInventoryItem | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [selectedMode, setSelectedMode] = useState<DispenseMode>("pay");

  // Post-dispense donate toggle (only shown when mode === 'pay')
  const [donatePad, setDonatePad] = useState(false);

  // UI
  const [vendStatus, setVendStatus] = useState<VendStatus>("idle");
  const [dispenseResult, setDispenseResult] = useState<any>(null);
  const [vendError, setVendError] = useState<string | null>(null);

  // ── Fetch ───────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const sid = getSessionId();

      const [mRes, bRes, pRes, cRes] = await Promise.all([
        apiFetch(`/api/machines/${id}`),
        apiFetch(`/api/products/brands`),
        apiFetch(`/api/products`),
        apiFetch(`/api/dispense/check`, {
          method: "POST",
          body: JSON.stringify({ session_id: sid }),
        }),
      ]);

      // Merge inventory items with product details (for price, type, description)
      const productMap: Record<number, any> = {};
      (pRes as any[]).forEach((p: any) => {
        productMap[p.id] = p;
      });

      const enriched: EnrichedInventoryItem[] = (mRes.inventory || []).map(
        (inv: any) => {
          const prod = productMap[inv.product_id] || {};
          return {
            ...inv,
            price: prod.price ?? 0,
            product_type: prod.type ?? "",
            description: prod.description ?? "",
          };
        }
      );

      setMachine({ ...mRes, inventory: enriched });
      setBrands(bRes as Brand[]);
      setCheckResult(cRes as CheckResult);

      // Restore last selected brand
      const lastBrandId = localStorage.getItem(LAST_BRAND_KEY);
      if (lastBrandId && (bRes as Brand[]).length > 0) {
        const found = (bRes as Brand[]).find((b) => b.id === lastBrandId);
        if (found) setSelectedBrand(found);
      }
    } catch (err) {
      console.error("Error fetching vend page data:", err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Derived data ────────────────────────────
  /**
   * Inventory items belonging to the selected brand.
   * Matches on the `brand` field returned by the backend (exact name match).
   */
  const brandInventory = useMemo<EnrichedInventoryItem[]>(() => {
    if (!selectedBrand || !machine) return [];
    return machine.inventory
      .filter((item) => item.brand === selectedBrand.name)
      .map((item) => ({ ...item, brand_color: selectedBrand.color }));
  }, [selectedBrand, machine]);

  /**
   * If the selected brand is completely out of stock, suggest
   * the first in-stock item from a different brand.
   */
  const brandOutOfStock = useMemo(
    () =>
      brandInventory.length > 0 &&
      brandInventory.every((i) => i.quantity + i.sponsored_quantity === 0),
    [brandInventory]
  );

  const suggestedAltItem = useMemo<EnrichedInventoryItem | null>(() => {
    if (!brandOutOfStock || !machine) return null;
    return (
      machine.inventory.find(
        (i) =>
          i.brand !== selectedBrand?.name &&
          i.quantity + i.sponsored_quantity > 0
      ) || null
    );
  }, [brandOutOfStock, machine, selectedBrand]);

  /** Whether a mode is available (present in available_modes from the API) */
  const isModeAvailable = useCallback(
    (mode: DispenseMode) => {
      if (!checkResult) return mode === "pay";
      return checkResult.available_modes.some((m) => m.id === mode);
    },
    [checkResult]
  );

  /** Total amount displayed on step 4 */
  const totalAmount = useMemo(() => {
    if (!selectedProduct) return 0;
    if (selectedMode !== "pay") return 0;
    const base = selectedProduct.price * quantity;
    const donation = donatePad ? 45 : 0;
    return base + donation;
  }, [selectedProduct, selectedMode, quantity, donatePad]);

  // ── Max quantity (limited by available stock) ──
  const maxQty = useMemo(() => {
    if (!selectedProduct) return 1;
    const avail =
      selectedProduct.quantity + selectedProduct.sponsored_quantity;
    return Math.min(avail, 5);
  }, [selectedProduct]);

  // ── Handlers ────────────────────────────────
  const handleSelectBrand = (brand: Brand) => {
    setSelectedBrand(brand);
    setSelectedProduct(null);
    setQuantity(1);
    setStep(2);
  };

  const handleSelectProduct = (item: EnrichedInventoryItem) => {
    if (item.quantity + item.sponsored_quantity === 0) return;
    setSelectedProduct(item);
    setQuantity(1);
    setStep(3);
  };

  const handleVend = async () => {
    if (!selectedProduct || !machine) return;
    setVendError(null);
    setVendStatus("processing");

    const sid = getSessionId();

    try {
      const payload: Record<string, any> = {
        session_id: sid,
        product_id: selectedProduct.product_id,
        quantity,
        machine_id: machine.id,
        mode: selectedMode,
        lat: machine.latitude,
        lng: machine.longitude,
      };

      // For pay mode, include payment method
      if (selectedMode === "pay") {
        payload.payment_method = "upi";
      }

      // Include brand/area context for sponsor_request mode
      if (selectedMode === "sponsor_request") {
        payload.brand = selectedProduct.brand;
        payload.product_type = selectedProduct.product_type;
        payload.area = machine.area;
      }

      const res = await apiFetch(`/api/dispense`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (res.success) {
        // Persist last used brand
        if (selectedBrand) {
          localStorage.setItem(LAST_BRAND_KEY, selectedBrand.id);
        }

        setDispenseResult(res);

        // sponsor_request → signal created, show different success
        if (selectedMode === "sponsor_request") {
          setTimeout(() => setVendStatus("signal_sent"), 800);
          return;
        }

        // Normal dispense flow
        setTimeout(() => setVendStatus("vending"), 900);
        setTimeout(async () => {
          setVendStatus("success");

          // If user opted to donate a pad, fire the donate API
          if (donatePad && selectedMode === "pay") {
            try {
              await apiFetch(`/api/donate`, {
                method: "POST",
                body: JSON.stringify({
                  session_id: sid,
                  brand: selectedProduct.brand,
                  product_type: selectedProduct.product_type,
                  qty: 1,
                  area: machine.area,
                  lat: machine.latitude,
                  lng: machine.longitude,
                }),
              });
            } catch {
              // Non-critical — donation failure shouldn't break the success screen
            }
          }
        }, 3800);
      } else {
        throw new Error(res.error || res.message || "Dispense failed");
      }
    } catch (err: any) {
      setVendError(err.message || "Something went wrong. Please try again.");
      setVendStatus("idle");
    }
  };

  // ── Loading / Not found ──────────────────────
  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-20 bg-surface min-h-screen">
        <div className="w-12 h-12 border-4 border-primary/10 border-t-primary rounded-full animate-spin mb-4" />
        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/40">
          {t("common.loading")}
        </span>
      </div>
    );
  }

  if (!machine) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-20 min-h-screen text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
        <p className="text-sh-primary font-black text-xl">Machine not found</p>
        <button
          onClick={() => router.back()}
          className="text-primary underline text-sm"
        >
          Go back
        </button>
      </div>
    );
  }

  // ─────────────────────────────────────────────
  //  Render
  // ─────────────────────────────────────────────
  return (
    <div className="flex-1 flex flex-col min-h-screen bg-surface relative">
      <LanguageSelector />

      {/* Progress bar */}
      <div className="fixed top-0 left-0 w-full h-1 bg-primary/5 z-[1001]">
        <motion.div
          className="h-full bg-gradient-to-r from-primary to-secondary"
          initial={{ width: "0%" }}
          animate={{ width: `${(step / 4) * 100}%` }}
          transition={{ duration: 0.4 }}
        />
      </div>

      <div className="max-w-6xl mx-auto w-full flex-1 flex flex-col p-6 md:p-12 space-y-8">
        {/* Header */}
        <header className="flex items-center justify-between">
          <button
            onClick={() =>
              step > 1 ? setStep(step - 1) : router.back()
            }
            className="p-4 rounded-full glass hover:border-primary/20 transition-all text-sh-primary"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-4 text-right">
            <div className="space-y-1">
              <h2 className="text-3xl font-serif font-black text-sh-primary italic">
                {machine.name}
              </h2>
              <div className="flex items-center justify-end gap-2 text-[10px] font-black text-sh-secondary uppercase tracking-widest">
                <MapPin className="w-3 h-3 text-primary/40" />
                {machine.area}
                {machine.is_free_zone && (
                  <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-[9px] font-black uppercase tracking-widest">
                    Free Zone
                  </span>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Steps */}
        <div className="flex-1 flex flex-col">
          <AnimatePresence mode="wait">

            {/* ── STEP 1: Brand ── */}
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
                    {t("vending.chooseBrand").split(" ").slice(0, -1).join(" ")}{" "}
                    <span className="italic text-secondary">
                      {t("vending.chooseBrand").split(" ").pop()}
                    </span>
                  </h1>
                  <p className="text-xs font-bold text-sh-secondary uppercase tracking-widest">
                    {t("vending.trustedProtection")}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-12 max-w-5xl mx-auto py-12 px-6">
                  {brands.map((brand, idx) => {
                    // Count available stock for this brand at this machine
                    const brandStock = machine.inventory.filter(
                      (i) =>
                        i.brand === brand.name &&
                        i.quantity + i.sponsored_quantity > 0
                    ).length;
                    const totalItems = machine.inventory.filter(
                      (i) => i.brand === brand.name
                    ).length;

                    return (
                      <motion.div
                        key={brand.id}
                        onClick={() => handleSelectBrand(brand)}
                        initial={{ rotate: idx % 2 === 0 ? -2 : 2 }}
                        whileHover={{ rotate: 0, y: -10, scale: 1.05 }}
                        className="fanned-card bg-white p-10 border border-primary/10 shadow-xl cursor-pointer relative overflow-hidden group"
                      >
                        <div
                          className="absolute top-0 left-0 w-full h-2"
                          style={{ backgroundColor: brand.color || "#E91E8C" }}
                        />
                        <div className="space-y-6">
                          <div className="w-16 h-16 rounded-2xl glass border-primary/5 flex items-center justify-center text-3xl group-hover:rotate-12 transition-transform">
                            {brandEmoji(idx)}
                          </div>
                          <div className="space-y-2">
                            <h3 className="text-3xl font-serif font-black text-sh-primary">
                              {brand.name}
                            </h3>
                            <p className="text-sm font-medium text-sh-secondary">
                              {brand.tagline}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {brandStock > 0 ? (
                              <>
                                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                <span className="text-[10px] font-black uppercase text-green-600 tracking-widest">
                                  {brandStock}/{totalItems} variants in stock
                                </span>
                              </>
                            ) : (
                              <>
                                <div className="w-2 h-2 rounded-full bg-red-400" />
                                <span className="text-[10px] font-black uppercase text-red-400 tracking-widest">
                                  Out of stock
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* ── STEP 2: Product/Pack ── */}
            {step === 2 && selectedBrand && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-12"
              >
                <div className="text-center space-y-4">
                  <h1 className="text-5xl md:text-7xl font-serif font-black text-sh-primary tracking-tighter">
                    Select your{" "}
                    <span className="italic text-secondary">Pack.</span>
                  </h1>
                  <p className="text-xs font-bold text-sh-secondary uppercase tracking-widest">
                    {selectedBrand.name} Collection
                  </p>
                </div>

                {/* Out-of-stock brand alert + suggestion */}
                {brandOutOfStock && suggestedAltItem && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="max-w-xl mx-auto p-6 rounded-2xl bg-amber-50 border border-amber-200 flex items-center gap-4"
                  >
                    <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
                    <div className="text-sm">
                      <span className="font-bold text-amber-700">
                        {selectedBrand.name} is fully out of stock
                      </span>
                      <span className="text-amber-600">
                        {" "}— try{" "}
                        <button
                          className="underline font-bold"
                          onClick={() => {
                            const alt = brands.find(
                              (b) => b.name === suggestedAltItem.brand
                            );
                            if (alt) handleSelectBrand(alt);
                          }}
                        >
                          {suggestedAltItem.brand}
                        </button>{" "}
                        instead.
                      </span>
                    </div>
                  </motion.div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
                  {brandInventory.map((item) => {
                    const available = item.quantity + item.sponsored_quantity;
                    const isOut = available === 0;

                    return (
                      <motion.div
                        key={item.product_id}
                        whileHover={!isOut ? { y: -10 } : {}}
                        onClick={() => handleSelectProduct(item)}
                        className={cn(
                          "bg-white p-10 rounded-[3rem] border transition-all flex flex-col gap-6 relative overflow-hidden",
                          isOut
                            ? "opacity-40 grayscale cursor-not-allowed border-primary/5"
                            : "cursor-pointer border-primary/10 hover:border-primary/30 shadow-xl"
                        )}
                      >
                        <div
                          className="absolute top-0 left-0 w-full h-2"
                          style={{
                            backgroundColor:
                              selectedBrand.color || "#E91E8C",
                          }}
                        />

                        <div className="space-y-4 flex-1">
                          <div className="flex justify-between items-start">
                            <div className="w-16 h-16 rounded-2xl glass bg-primary/5 flex items-center justify-center text-3xl">
                              {productEmoji(item.product_name)}
                            </div>
                            <div className="text-right">
                              <span className="text-[10px] font-black uppercase text-sh-secondary tracking-widest block">
                                {item.product_type}
                              </span>
                              <span className="text-2xl font-black text-primary">
                                ₹{item.price}
                              </span>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <h3 className="text-3xl font-serif font-black text-sh-primary leading-tight">
                              {item.product_name}
                            </h3>
                            <p className="text-sm text-sh-secondary font-medium leading-relaxed bg-primary/5 p-4 rounded-2xl border border-primary/10">
                              {item.description ||
                                "Premium protection with advanced absorbent core for maximum comfort."}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-4 border-t border-primary/5">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <Package className="w-4 h-4 text-sh-secondary" />
                              <span
                                className={cn(
                                  "text-[10px] font-black uppercase tracking-widest",
                                  stockColor(item.quantity, item.sponsored_quantity)
                                )}
                              >
                                {stockLabel(item.quantity, item.sponsored_quantity)}
                              </span>
                            </div>
                            {item.sponsored_quantity > 0 && (
                              <span className="text-[9px] font-bold text-teal-600 uppercase tracking-widest flex items-center gap-1">
                                <Heart className="w-3 h-3" />
                                {item.sponsored_quantity} donated
                              </span>
                            )}
                          </div>
                          <button
                            disabled={isOut}
                            className={cn(
                              "px-8 py-3 rounded-full font-black text-[10px] uppercase tracking-widest shadow-lg transition-all",
                              isOut
                                ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                                : "bg-primary text-white shadow-primary/20 group-hover:scale-105"
                            )}
                          >
                            {isOut ? "Unavailable" : "Select Pack"}
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}

                  {brandInventory.length === 0 && (
                    <div className="col-span-3 text-center text-sh-secondary py-20">
                      <Package className="w-10 h-10 mx-auto mb-4 opacity-30" />
                      <p className="font-bold">
                        No products found for {selectedBrand.name} at this
                        machine.
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* ── STEP 3: Dispense Mode ── */}
            {step === 3 && selectedProduct && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="max-w-4xl mx-auto w-full py-10 space-y-12"
              >
                <div className="text-center space-y-4">
                  <h1 className="text-5xl font-serif font-black text-sh-primary tracking-tighter">
                    How would you like to{" "}
                    <span className="italic text-secondary">Access?</span>
                  </h1>
                  <p className="text-xs font-bold text-sh-secondary uppercase tracking-widest">
                    Select your preferred method
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                  {/* PAY */}
                  <ModeCard
                    mode="pay"
                    emoji="💳"
                    title="Pay via UPI / Card"
                    subtitle="Standard Access"
                    description="Quick and secure digital payment for immediate access."
                    available={true}
                    selected={selectedMode === "pay"}
                    colorClass="primary"
                    onClick={() => setSelectedMode("pay")}
                    extra={
                      selectedMode === "pay" ? (
                        <div className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-primary/10">
                          <span className="text-[10px] font-black uppercase tracking-widest text-sh-secondary">
                            Qty:
                          </span>
                          <div className="flex items-center gap-3">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setQuantity(Math.max(1, quantity - 1));
                              }}
                              className="w-8 h-8 rounded-full border border-primary/10 flex items-center justify-center text-primary"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <span className="text-xl font-black text-sh-primary w-6 text-center">
                              {quantity}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setQuantity(Math.min(maxQty, quantity + 1));
                              }}
                              className="w-8 h-8 rounded-full border border-primary/10 flex items-center justify-center text-primary"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="ml-auto text-lg font-black text-primary">
                            ₹{selectedProduct.price * quantity}
                          </div>
                        </div>
                      ) : null
                    }
                  />

                  {/* SUBSCRIPTION */}
                  <ModeCard
                    mode="subscription"
                    emoji="⭐"
                    title="Subscription Plan"
                    subtitle="Premium Access"
                    description={
                      checkResult?.subscription_valid
                        ? `Use your active ${checkResult.subscription?.plan_name} plan.`
                        : "Subscribe to get monthly pads at discounted rates."
                    }
                    available={!!checkResult?.subscription_valid}
                    unavailableReason={
                      !checkResult?.subscription_valid
                        ? "No active plan"
                        : undefined
                    }
                    selected={selectedMode === "subscription"}
                    colorClass="secondary"
                    onClick={() =>
                      checkResult?.subscription_valid &&
                      setSelectedMode("subscription")
                    }
                    badge={
                      checkResult?.subscription_valid
                        ? `${checkResult.subscription?.pads_remaining} pads left`
                        : undefined
                    }
                    badgeColor="secondary"
                  />

                  {/* COMMUNITY (donated pads) */}
                  <ModeCard
                    mode="community"
                    emoji="🎁"
                    title="Community Pad"
                    subtitle="Social Gift"
                    description="Receive a pad donated by someone in the community. Free of charge."
                    available={!!checkResult?.donated_pads_available}
                    unavailableReason={
                      !checkResult?.donated_pads_available
                        ? "Pool currently empty"
                        : undefined
                    }
                    selected={selectedMode === "community"}
                    colorClass="accent"
                    onClick={() =>
                      checkResult?.donated_pads_available &&
                      setSelectedMode("community")
                    }
                    badge={
                      checkResult?.donated_pads_available
                        ? "Available now"
                        : undefined
                    }
                    badgeColor="teal"
                  />

                  {/* SPONSOR REQUEST */}
                  <ModeCard
                    mode="sponsor_request"
                    emoji="🤝"
                    title="Request a Sponsor"
                    subtitle="Live Care Network"
                    description="Post a request to the community. Someone nearby can sponsor you digitally or in person."
                    available={!!checkResult?.can_claim}
                    unavailableReason={
                      !checkResult?.can_claim
                        ? checkResult?.next_claim_time
                          ? `Next request available at ${new Date(
                            checkResult.next_claim_time
                          ).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}`
                          : "Already requested today"
                        : undefined
                    }
                    selected={selectedMode === "sponsor_request"}
                    colorClass="coral"
                    onClick={() =>
                      checkResult?.can_claim &&
                      setSelectedMode("sponsor_request")
                    }
                  />
                </div>

                {vendError && (
                  <p className="text-center text-red-500 text-sm font-medium">
                    {vendError}
                  </p>
                )}

                <div className="flex flex-col gap-4">
                  <button
                    onClick={() => setStep(4)}
                    className="w-full btn-primary py-6 text-xs uppercase tracking-widest flex items-center justify-center gap-3 shadow-2xl"
                  >
                    Confirm selection <ChevronRight className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setStep(2)}
                    className="text-[10px] font-black uppercase text-sh-secondary hover:text-primary transition-colors py-2"
                  >
                    ← Change Pack
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── STEP 4: Summary & Dispense ── */}
            {step === 4 && selectedProduct && selectedBrand && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="max-w-xl mx-auto w-full space-y-8"
              >
                <div className="text-center space-y-2">
                  <h1 className="text-5xl font-serif font-black text-sh-primary tracking-tighter italic">
                    Final Review
                  </h1>
                  <p className="text-xs font-bold text-sh-secondary uppercase tracking-widest">
                    Ready to dispense your care
                  </p>
                </div>

                <div className="bg-white p-10 rounded-[3rem] border border-primary/10 shadow-2xl space-y-8 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -z-0" />

                  <div className="space-y-5 relative z-10">
                    {[
                      { label: "Machine", value: machine.name },
                      { label: "Brand", value: selectedBrand.name },
                      {
                        label: "Pack",
                        value: `${selectedProduct.product_name} · ${selectedProduct.product_type}`,
                      },
                      { label: "Quantity", value: `${quantity} pack(s)` },
                      { label: "Method", value: modeLabel(selectedMode) },
                    ].map(({ label, value }) => (
                      <div
                        key={label}
                        className="flex justify-between items-center pb-4 border-b border-primary/5"
                      >
                        <span className="text-[10px] font-black text-sh-secondary uppercase tracking-widest">
                          {label}
                        </span>
                        <span className="text-sm font-bold text-sh-primary text-right max-w-[55%]">
                          {value}
                        </span>
                      </div>
                    ))}

                    {/* Subscription breakdown */}
                    {selectedMode === "subscription" &&
                      checkResult?.subscription && (
                        <div className="p-4 bg-secondary/5 rounded-2xl border border-secondary/10 text-sm">
                          <p className="font-bold text-secondary">
                            {checkResult.subscription.plan_name} Plan
                          </p>
                          <p className="text-sh-secondary text-xs mt-1">
                            {checkResult.subscription.pads_remaining - 1} pads
                            remaining after this
                          </p>
                        </div>
                      )}

                    {/* Sponsored pad info */}
                    {selectedMode === "community" && (
                      <div className="p-4 bg-teal-50 rounded-2xl border border-teal-100 text-sm">
                        <p className="font-bold text-teal-700">
                          Community-donated pad
                        </p>
                        <p className="text-teal-600 text-xs mt-1">
                          Someone in your community donated this for you. 💝
                        </p>
                      </div>
                    )}

                    {/* Sponsor request info */}
                    {selectedMode === "sponsor_request" && (
                      <div className="p-4 bg-rose-50 rounded-2xl border border-rose-100 text-sm">
                        <p className="font-bold text-rose-700">
                          Live Care request
                        </p>
                        <p className="text-rose-600 text-xs mt-1">
                          Your request + pod location (
                          <strong>{machine.name}</strong>) will be visible for
                          30 minutes on the Live Care board.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Donate toggle (only for pay mode) */}
                  {selectedMode === "pay" && (
                    <button
                      type="button"
                      onClick={() => setDonatePad((p) => !p)}
                      className={cn(
                        "w-full p-6 rounded-3xl border-2 transition-all flex items-center justify-between gap-4",
                        donatePad
                          ? "border-primary bg-primary/5"
                          : "border-primary/10 bg-surface"
                      )}
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={cn(
                            "w-12 h-12 rounded-full flex items-center justify-center text-2xl transition-all",
                            donatePad
                              ? "bg-primary text-white shadow-lg"
                              : "bg-white text-primary border border-primary/10"
                          )}
                        >
                          <Heart
                            className={cn(
                              "w-5 h-5",
                              donatePad ? "fill-white text-white" : "text-primary"
                            )}
                          />
                        </div>
                        <div className="text-left">
                          <h4 className="text-xs font-black text-sh-primary uppercase tracking-wider">
                            Donate 1 Pad (₹45)
                          </h4>
                          <p className="text-[10px] text-sh-secondary font-medium">
                            Add ₹45 to donate a pad to the community pool for
                            someone in need.
                          </p>
                        </div>
                      </div>
                      <div
                        className={cn(
                          "w-12 h-6 rounded-full relative transition-all",
                          donatePad ? "bg-primary" : "bg-primary/20"
                        )}
                      >
                        <motion.div
                          className="absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow-sm"
                          animate={{ x: donatePad ? 24 : 0 }}
                        />
                      </div>
                    </button>
                  )}

                  {/* Total */}
                  <div className="pt-4 flex justify-between items-end">
                    <div className="space-y-1">
                      <span className="text-[10px] font-black text-sh-secondary uppercase tracking-widest">
                        Total
                      </span>
                      <h2 className="text-5xl font-black text-primary italic">
                        {selectedMode === "pay" ? `₹${totalAmount}` : "Free"}
                      </h2>
                      {selectedMode === "pay" && donatePad && (
                        <p className="text-[10px] text-sh-secondary font-medium">
                          incl. ₹45 donation
                        </p>
                      )}
                    </div>
                    <div className="text-[10px] font-black text-secondary uppercase italic">
                      Secure Handover
                    </div>
                  </div>
                </div>

                {vendError && (
                  <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-sm text-red-700 font-medium flex items-center gap-3">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {vendError}
                  </div>
                )}

                <div className="space-y-4">
                  <button
                    onClick={handleVend}
                    className="w-full btn-primary py-8 text-xs uppercase tracking-widest flex items-center justify-center gap-4 shadow-2xl"
                  >
                    {selectedMode === "sponsor_request"
                      ? "Post to Live Care Network"
                      : "Confirm & Dispense"}
                    <Zap className="w-5 h-5 fill-white" />
                  </button>
                  <button
                    onClick={() => setStep(3)}
                    className="w-full text-[10px] font-black uppercase text-sh-secondary hover:text-primary transition-colors py-4"
                  >
                    ← Back to selection
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Vending Overlay ── */}
      <AnimatePresence>
        {vendStatus !== "idle" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[2000] flex items-center justify-center bg-white/90 backdrop-blur-3xl"
          >
            <div className="max-w-md w-full text-center space-y-12 px-6">
              <AnimatePresence mode="wait">

                {/* Processing */}
                {vendStatus === "processing" && (
                  <motion.div
                    key="proc"
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -20, opacity: 0 }}
                    className="space-y-6"
                  >
                    <div className="w-32 h-32 mx-auto rounded-full glass border-primary/20 flex items-center justify-center text-5xl relative">
                      🔒
                      <div className="absolute inset-0 rounded-full border-2 border-primary/40 animate-ping" />
                    </div>
                    <h2 className="text-4xl font-serif font-black text-sh-primary italic tracking-tighter">
                      {t("vending.securingHardware")}
                    </h2>
                    <p className="text-sh-secondary font-black text-[10px] uppercase tracking-[0.3em]">
                      {t("vending.validatingInternals")}
                    </p>
                  </motion.div>
                )}

                {/* Vending animation */}
                {vendStatus === "vending" && (
                  <motion.div
                    key="vend"
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -20, opacity: 0 }}
                    className="space-y-8"
                  >
                    <div className="relative w-48 h-64 mx-auto glass bg-white/80 border-primary/20 rounded-[2rem] flex items-center justify-center overflow-hidden">
                      <motion.div
                        animate={{ y: [0, 150] }}
                        transition={{
                          duration: 1.5,
                          repeat: Infinity,
                          ease: "easeIn",
                        }}
                        className="w-32 h-16 glass bg-primary/10 border-primary/20 flex items-center justify-center text-3xl shadow-xl"
                      >
                        🌸
                      </motion.div>
                    </div>
                    <h2 className="text-4xl font-serif font-black text-sh-primary italic tracking-tighter">
                      {t("vending.dispensingCare")}
                    </h2>
                    <p className="text-sh-secondary font-black text-[10px] uppercase tracking-[0.3em]">
                      {t("vending.handoverInProgress")}
                    </p>
                  </motion.div>
                )}

                {/* Success */}
                {vendStatus === "success" && (
                  <motion.div
                    key="success"
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="space-y-8"
                  >
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1, rotate: [0, 360] }}
                      className="w-40 h-40 mx-auto rounded-full bg-green-50 border-4 border-green-400 flex items-center justify-center text-7xl shadow-xl"
                    >
                      {donatePad ? "💖" : "🌸"}
                    </motion.div>
                    <div className="space-y-4">
                      <h2 className="text-5xl font-serif font-black text-sh-primary italic tracking-tighter">
                        {t("vending.padsOnWay")}
                      </h2>
                      <p className="text-sh-secondary font-black text-[10px] uppercase tracking-[0.4em]">
                        {t("vending.collectBelow")}
                      </p>
                      {donatePad && (
                        <p className="text-primary font-bold text-sm">
                          {t("vending.sponsoredPadThanks")}
                        </p>
                      )}
                      {dispenseResult?.transaction_id && (
                        <p className="text-[10px] text-sh-secondary font-mono tracking-widest">
                          Ref: {dispenseResult.transaction_id}
                        </p>
                      )}
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => router.push("/")}
                      className="px-12 py-5 rounded-full bg-sh-primary text-white font-black text-[10px] uppercase tracking-widest shadow-2xl"
                    >
                      {t("common.done")}
                    </motion.button>
                  </motion.div>
                )}

                {/* Sponsor Request Sent */}
                {vendStatus === "signal_sent" && (
                  <motion.div
                    key="signal"
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="space-y-8"
                  >
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="w-40 h-40 mx-auto rounded-full bg-rose-50 border-4 border-rose-400 flex items-center justify-center text-7xl shadow-xl"
                    >
                      🤝
                    </motion.div>
                    <div className="space-y-4">
                      <h2 className="text-5xl font-serif font-black text-sh-primary italic tracking-tighter">
                        Request is live!
                      </h2>
                      <p className="text-sh-secondary text-sm font-medium leading-relaxed">
                        Your need has been posted to the{" "}
                        <strong>Live Care Network</strong>. A sponsor in your
                        area can see your location and your nearest pod (
                        <strong>{machine.name}</strong>) and can help you
                        digitally or in person.
                      </p>
                      <div className="flex items-center justify-center gap-2 text-[10px] font-black uppercase text-rose-500 tracking-widest">
                        <Clock className="w-3 h-3" />
                        Expires in 30 minutes
                      </div>
                    </div>
                    <div className="flex flex-col gap-3">
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => router.push("/livecare")}
                        className="px-12 py-5 rounded-full bg-sh-primary text-white font-black text-[10px] uppercase tracking-widest shadow-2xl"
                      >
                        Watch Live Care Board
                      </motion.button>
                      <button
                        onClick={() => router.push("/")}
                        className="text-[10px] font-black uppercase text-sh-secondary hover:text-primary transition-colors py-2"
                      >
                        Go home
                      </button>
                    </div>
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

// ─────────────────────────────────────────────
//  ModeCard sub-component
// ─────────────────────────────────────────────
interface ModeCardProps {
  mode: DispenseMode;
  emoji: string;
  title: string;
  subtitle: string;
  description: string;
  available: boolean;
  unavailableReason?: string;
  selected: boolean;
  colorClass: string;
  onClick: () => void;
  badge?: string;
  badgeColor?: string;
  extra?: React.ReactNode;
}

function ModeCard({
  emoji,
  title,
  subtitle,
  description,
  available,
  unavailableReason,
  selected,
  colorClass,
  onClick,
  badge,
  badgeColor,
  extra,
}: ModeCardProps) {
  const borderColor = selected
    ? `border-${colorClass}`
    : "border-primary/5";
  const bgColor = selected ? `bg-${colorClass}/5` : "bg-white";

  return (
    <motion.div
      onClick={available ? onClick : undefined}
      whileHover={available ? { scale: 1.01 } : {}}
      className={cn(
        "p-8 rounded-[2.5rem] border-2 transition-all flex flex-col gap-5",
        !available
          ? "opacity-50 grayscale cursor-not-allowed bg-slate-50 border-primary/5"
          : selected
            ? `border-${colorClass} bg-${colorClass}/5 shadow-xl cursor-pointer`
            : `border-primary/5 bg-white hover:border-${colorClass}/20 cursor-pointer`
      )}
    >
      <div className="flex items-center justify-between">
        <div
          className={cn(
            "w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-lg",
            available ? `bg-${colorClass} text-white` : "bg-gray-200"
          )}
        >
          {emoji}
        </div>
        <div className="text-right">
          <span className="text-[10px] font-black uppercase text-sh-secondary tracking-widest block">
            {subtitle}
          </span>
          <span
            className={cn(
              "text-xl font-black",
              available ? `text-${colorClass}` : "text-gray-400"
            )}
          >
            {title}
          </span>
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-sm text-sh-secondary font-medium">{description}</p>

        {badge && available && (
          <div
            className={cn(
              "px-4 py-1.5 rounded-full inline-block",
              `bg-${badgeColor || colorClass}/10`
            )}
          >
            <span
              className={cn(
                "text-[10px] font-black uppercase tracking-widest",
                `text-${badgeColor || colorClass}`
              )}
            >
              {badge}
            </span>
          </div>
        )}

        {unavailableReason && !available && (
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-red-400">
            <AlertCircle className="w-3 h-3" />
            {unavailableReason}
          </div>
        )}

        {extra}
      </div>
    </motion.div>
  );
}

export default VenderPage;
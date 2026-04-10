"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LogIn, UserPlus, Mail, Lock, User as UserIcon, ArrowRight, ShieldCheck } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useRouter } from "next/navigation";

const LoginPage = () => {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const data = await apiFetch("/api/auth/admin/login", {
        method: "POST",
        body: JSON.stringify({
          email: formData.email,
          password: formData.password
        }),
      });

      if (data.token) {
        localStorage.setItem("sahayaa_token", data.token);
        localStorage.setItem("sahayaa_user", JSON.stringify(data.user));
        router.push(data.user.role === 'admin' ? "/admin" : "/");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background Liquid Flow */}
      <div className="absolute inset-0 -z-10 pointer-events-none opacity-30">
        <motion.div 
           animate={{ rotate: 360, scale: [1, 1.2, 1] }}
           transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
           className="absolute -top-1/2 -right-1/2 w-[100%] h-[100%] bg-gradient-radial from-rose-quartz/20 to-transparent blur-[120px]"
        />
      </div>

      <motion.div 
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="max-w-md w-full glass p-10 space-y-10 border-rose-quartz/20 shadow-3xl shadow-rose-quartz/10"
      >
        <div className="text-center space-y-3">
           <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-rose-quartz to-serenity-blue flex items-center justify-center text-white shadow-xl mx-auto mb-6">
              <ShieldCheck className="w-8 h-8" />
           </div>
           <h1 className="text-4xl font-serif font-black text-slate tracking-tighter italic transition-all">
              {isLogin ? "Welcome Back." : "Join Sahayaa."}
           </h1>
           <p className="text-slate/40 font-black text-[10px] uppercase tracking-[0.4em]">
              Secure Authentication Bridge
           </p>
        </div>

        {error && (
           <motion.div 
             initial={{ scale: 0.95, opacity: 0 }}
             animate={{ scale: 1, opacity: 1 }}
             className="p-4 rounded-xl bg-burgundy/5 border border-burgundy/10 text-burgundy text-xs font-bold text-center"
           >
              {error}
           </motion.div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
           <AnimatePresence mode="wait">
              {!isLogin && (
                <motion.div 
                  key="name-field"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="space-y-2 overflow-hidden"
                >
                   <div className="relative group">
                      <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate/30 group-focus-within:text-burgundy" />
                      <input 
                        required={!isLogin}
                        type="text" 
                        placeholder="Full Name" 
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                        className="w-full bg-silk/50 border border-rose-quartz/20 rounded-2xl py-4 pl-12 pr-6 text-sm font-medium focus:ring-2 focus:ring-rose-quartz/30 focus:border-rose-quartz transition-all"
                      />
                   </div>
                </motion.div>
              )}
           </AnimatePresence>

           <div className="space-y-2 relative group">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate/30 group-focus-within:text-burgundy" />
              <input 
                required
                type="email" 
                placeholder="Email Address" 
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                className="w-full bg-silk/50 border border-rose-quartz/20 rounded-2xl py-4 pl-12 pr-6 text-sm font-medium focus:ring-2 focus:ring-rose-quartz/30 focus:border-rose-quartz transition-all"
              />
           </div>

           <div className="space-y-2 relative group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate/30 group-focus-within:text-burgundy" />
              <input 
                required
                type="password" 
                placeholder="Password" 
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
                className="w-full bg-silk/50 border border-rose-quartz/20 rounded-2xl py-4 pl-12 pr-6 text-sm font-medium focus:ring-2 focus:ring-rose-quartz/30 focus:border-rose-quartz transition-all"
              />
           </div>

           <motion.button
             whileHover={{ scale: 1.02 }}
             whileTap={{ scale: 0.98 }}
             disabled={loading}
             className="w-full py-5 rounded-[2.25rem] bg-burgundy text-white font-black text-sm uppercase tracking-widest shadow-2xl shadow-burgundy/20 hover:shadow-burgundy/40 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
           >
              {loading ? "Waking API..." : isLogin ? "Access Dashboard" : "Create Account"}
              <ArrowRight className="w-4 h-4" />
           </motion.button>
        </form>

        <div className="text-center">
           <p className="text-[10px] font-black text-slate/40 uppercase tracking-widest">
              Restricted Access Bridge
           </p>
        </div>
      </motion.div>
    </div>
  );
};

export default LoginPage;

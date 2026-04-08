"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { LogIn, Menu, X, User, LogOut, Shield, MapPin } from "lucide-react";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const Navbar = () => {
  const pathname = usePathname();
  const router = useRouter();
  
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    
    // Check for user in localStorage
    const savedUser = localStorage.getItem("sahayaa_user");
    if (savedUser) setUser(JSON.parse(savedUser));
    
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("sahayaa_token");
    localStorage.removeItem("sahayaa_user");
    setUser(null);
    router.push("/");
  };

  const navLinks = [
    { name: "Home", href: "/" },
    { name: "Find a Pod", href: "/machines" },
    { name: "Sponsorship", href: "/#sponsor" },
    { name: "Mission", href: "/#mission" },
  ];

  return (
    <nav
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-500 px-6",
        scrolled ? "py-2" : "py-6"
      )}
    >
      <motion.div
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className={cn(
          "max-w-7xl mx-auto flex items-center justify-between px-8 py-3 transition-all duration-500 rounded-full",
          scrolled ? "glass shadow-xl shadow-rose-quartz/10" : "bg-white/40 border border-white/20"
        )}
      >
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-rose-quartz to-gold-soft flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform duration-500">
            <span className="text-xl">🌸</span>
          </div>
          <span className="text-2xl font-serif font-black tracking-tight text-slate group-hover:text-gold transition-colors duration-500">
            Sahayaa
          </span>
        </Link>

        {/* Desktop Links */}
        <div className="hidden md:flex items-center gap-10">
          {navLinks.map((link) => (
            <Link
              key={link.name}
              href={link.href}
              className={cn(
                "text-xs font-black uppercase tracking-widest transition-all duration-500 relative py-1",
                pathname === link.href
                  ? "text-gold"
                  : "text-slate-light hover:text-gold"
              )}
            >
              {link.name}
              {pathname === link.href && (
                <motion.div
                  layoutId="nav-underline"
                  className="absolute -bottom-1 left-0 right-0 h-0.5 bg-gradient-to-r from-gold to-transparent"
                />
              )}
            </Link>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-4">
          {user ? (
            <div className="flex items-center gap-3">
               <Link 
                 href={user.role === 'admin' ? "/admin" : "/dashboard"}
                 className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-gold/20 text-slate font-bold text-xs hover:border-gold transition-all"
               >
                  {user.role === 'admin' ? <Shield className="w-4 h-4 text-gold" /> : <User className="w-4 h-4" />}
                  <span className="hidden lg:inline">{user.name.split(' ')[0]}</span>
               </Link>
               <button 
                 onClick={handleLogout}
                 className="p-2.5 rounded-xl text-slate/30 hover:text-gold transition-colors"
               >
                  <LogOut className="w-4 h-4" />
               </button>
            </div>
          ) : (
            <Link href="/login">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex items-center gap-2 px-6 py-2.5 rounded-full border border-gold/10 text-slate font-black text-xs uppercase tracking-widest hover:border-gold transition-all"
              >
                <LogIn className="w-4 h-4 text-gold" />
                <span className="hidden sm:inline">Login</span>
              </motion.button>
            </Link>
          )}
          
          <Link href="/machines">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-2 px-6 py-3 rounded-full bg-gold text-white font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-gold/20 hover:shadow-gold/40 transition-all duration-500"
            >
              <MapPin className="w-4 h-4" />
              <span className="hidden sm:inline">Find Pod</span>
            </motion.button>
          </Link>

          {/* Mobile Menu Toggle */}
          <button 
            className="md:hidden p-2 text-slate ml-2" 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </motion.div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: -20 }}
            animate={{ opacity: 1, height: "auto", y: 0 }}
            exit={{ opacity: 0, height: 0, y: -20 }}
            className="md:hidden mt-4 glass overflow-hidden flex flex-col p-8 gap-5 border border-white/20 shadow-2xl"
          >
            {navLinks.map((link) => (
              <Link
                key={link.name}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="text-lg font-serif font-black text-slate hover:text-gold transition-colors"
              >
                {link.name}
              </Link>
            ))}
            <div className="h-[1px] bg-gold/10 my-2" />
            <div className="flex flex-col gap-5">
              {!user ? (
                 <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
                    <div className="flex items-center gap-3 text-slate font-black uppercase text-xs tracking-widest">
                       <LogIn className="w-5 h-5 text-gold" /> Login
                    </div>
                 </Link>
              ) : (
                 <button onClick={handleLogout} className="flex items-center gap-3 text-red-400 font-black uppercase text-xs tracking-widest text-left">
                    <LogOut className="w-5 h-5" /> Logout
                 </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Navbar;

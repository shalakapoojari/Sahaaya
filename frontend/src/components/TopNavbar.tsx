"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, LogIn, UserPlus, Search, MapPin, Globe, Leaf } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface TopNavbarProps {
  activePage: string;
  onNavigate: (page: any) => void;
  isLoggedIn: boolean;
}

const TopNavbar = ({ activePage, onNavigate, isLoggedIn }: TopNavbarProps) => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { name: "Home", id: "home" },
    { name: "Find a Pod", id: "find" },
    { name: "Subscriptions", id: "subscription" },
    { name: "History", id: "history" },
    { name: "Admin", id: "admin" },
  ];

  const handleLinkClick = (id: string) => {
    onNavigate(id);
    setMobileMenuOpen(false);
  };

  return (
    <nav
      className={cn(
        "fixed top-0 left-0 right-0 z-[200] transition-all duration-500",
        scrolled ? "py-3 px-6" : "py-6 px-10"
      )}
    >
      <div
        className={cn(
          "max-w-7xl mx-auto flex items-center justify-between px-8 py-3 transition-all duration-500 rounded-2xl border",
          scrolled 
            ? "glass shadow-xl border-sage-medium/50 bg-white/80" 
            : "bg-transparent border-transparent"
        )}
      >
        {/* Logo */}
        <button 
          onClick={() => onNavigate('home')}
          className="flex items-center gap-3 group"
        >
          <div className="w-10 h-10 rounded-xl bg-forest flex items-center justify-center text-white shadow-lg group-hover:rotate-6 transition-transform">
            <Leaf className="w-6 h-6" />
          </div>
          <span className="text-2xl font-serif font-black text-forest tracking-tighter">
            Sahayaa
          </span>
        </button>

        {/* Desktop Links */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <button
              key={link.id}
              onClick={() => handleLinkClick(link.id)}
              className={cn(
                "text-[10px] font-black uppercase tracking-widest transition-all relative py-1",
                activePage === link.id
                  ? "text-forest"
                  : "text-text-muted hover:text-forest"
              )}
            >
              {link.name}
              {activePage === link.id && (
                <motion.div
                  layoutId="active-nav"
                  className="absolute -bottom-1 left-0 right-0 h-0.5 bg-leaf rounded-full"
                />
              )}
            </button>
          ))}
        </div>

        {/* Auth Buttons */}
        <div className="hidden md:flex items-center gap-4">
          {!isLoggedIn ? (
            <>
              <button 
                onClick={() => onNavigate('admin')} // Mock redirection to login
                className="text-[10px] font-black uppercase tracking-widest text-text-muted hover:text-forest transition-colors flex items-center gap-2"
              >
                <LogIn className="w-4 h-4" /> Login
              </button>
              <button 
                onClick={() => onNavigate('admin')} // Mock sign up
                className="px-6 py-3 rounded-full bg-forest text-white font-black text-[10px] uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg"
              >
                Sign Up
              </button>
            </>
          ) : (
            <button 
              onClick={() => onNavigate('home')} // Logout mock logic would go here
              className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-forest/20 text-forest font-black text-[10px] uppercase tracking-widest hover:bg-forest hover:text-white transition-all"
            >
              <X className="w-4 h-4" /> Logout
            </button>
          )}
        </div>

        {/* Mobile Toggle */}
        <button 
          className="md:hidden p-2 text-forest" 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            className="md:hidden mt-4 glass p-8 flex flex-col gap-6 shadow-2xl border-sage-medium"
          >
            {navLinks.map((link) => (
              <button
                key={link.id}
                onClick={() => handleLinkClick(link.id)}
                className={cn(
                  "text-xl font-serif font-black text-left",
                  activePage === link.id ? "text-forest" : "text-text-muted"
                )}
              >
                {link.name}
              </button>
            ))}
            <div className="h-[1px] bg-sage-medium my-2" />
            <div className="flex flex-col gap-4">
               <button className="text-sm font-black text-forest uppercase tracking-widest text-left flex items-center gap-2">
                 <LogIn className="w-4 h-4" /> Login
               </button>
               <button className="w-full py-4 rounded-full bg-forest text-white font-black text-[10px] uppercase tracking-widest shadow-lg">
                 Sign Up
               </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default TopNavbar;

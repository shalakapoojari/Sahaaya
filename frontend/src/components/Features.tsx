"use client";

import React from "react";
import { motion } from "framer-motion";
import { Shield, Zap, Heart, Globe, Lock, Leaf } from "lucide-react";

const features = [
  {
    title: "Instant Access",
    desc: "Private vending pods at 50+ railway stations in Mumbai.",
    icon: <Zap className="w-6 h-6 text-rose-quartz" />,
    color: "bg-rose-quartz/10",
  },
  {
    title: "Safe & Private",
    desc: "Discreet locations with 'Quick Exit' safety features built-in.",
    icon: <Lock className="w-6 h-6 text-serenity-blue" />,
    color: "bg-serenity-blue/10",
  },
  {
    title: "Eco-Friendly",
    desc: "Organic options available to support your wellness and the planet.",
    icon: <Leaf className="w-6 h-6 text-emerald-500/60" />,
    color: "bg-emerald-500/5",
  },
  {
    title: "Community Sourced",
    desc: "Sponsor a pad and plant a digital flower in our Giving Garden.",
    icon: <Heart className="w-6 h-6 text-burgundy/60" />,
    color: "bg-burgundy/5",
  },
  {
    title: "Health First",
    desc: "Hypoallergenic products tested for comfort and long-term safety.",
    icon: <Shield className="w-6 h-6 text-slate/60" />,
    color: "bg-slate/5",
  },
  {
    title: "Free Zones",
    desc: "Special locations with 100% free access for those in need.",
    icon: <Globe className="w-6 h-6 text-orchid/60" />,
    color: "bg-orchid/5",
  }
];

const Features = () => {
  return (
    <section className="py-24 px-6 max-w-7xl mx-auto">
      <div className="text-center space-y-4 mb-20">
        <motion.h2 
           initial={{ opacity:0, y: 20 }}
           whileInView={{ opacity: 1, y: 0 }}
           className="text-4xl md:text-5xl font-serif font-black text-slate"
        >
          Care, <span className="text-burgundy italic">Reimagined.</span>
        </motion.h2>
        <p className="text-slate/60 font-semibold max-w-xl mx-auto uppercase tracking-widest text-xs">
          Beyond a machine, it&apos;s a safe space for your wellness.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {features.map((f, i) => (
          <motion.div
            key={f.title}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            whileHover={{ y: -10, boxShadow: "0 25px 50px -12px rgba(0,0,0,0.08)" }}
            className="group glass p-10 flex flex-col space-y-6 hover:border-rose-quartz/50 transition-all duration-500 relative overflow-hidden"
          >
            {/* Background Icon Glow */}
            <div className={`absolute -top-10 -right-10 w-32 h-32 ${f.color} rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700`} />
            
            <div className={`w-14 h-14 rounded-2xl ${f.color} flex items-center justify-center transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6`}>
              {f.icon}
            </div>
            
            <div className="space-y-3">
              <h3 className="text-xl font-serif font-bold text-slate group-hover:text-burgundy transition-colors">{f.title}</h3>
              <p className="text-slate/60 text-sm font-medium leading-relaxed group-hover:text-slate transition-colors">{f.desc}</p>
            </div>

            <div className="pt-2 flex items-center gap-2 text-xs font-black text-rose-quartz uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all duration-500 translate-x-[-10px] group-hover:translate-x-0">
               Learn More <ArrowIcon />
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
};

const ArrowIcon = () => (
  <svg 
    width="14" height="14" viewBox="0 0 24 24" fill="none" 
    stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
  >
    <path d="M5 12h14M12 5l7 7-7 7" />
  </svg>
);

export default Features;

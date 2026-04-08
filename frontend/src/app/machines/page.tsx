"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, MapPin, Navigation, Info, Zap, X } from "lucide-react";
import MumbaiMap from "@/components/MumbaiMap";
import MachineCard from "@/components/MachineCard";
import EmergencyFAB from "@/components/EmergencyFAB";
import { apiFetch } from "@/lib/api";

const MachinesPage = () => {
  const [machines, setMachines] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMachine, setSelectedMachine] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMachines();
  }, []);

  const fetchMachines = async () => {
    try {
      const data = await apiFetch("/api/machines");
      setMachines(data);
    } catch (err) {
      console.error("Error fetching machines:", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredMachines = machines.filter(m => 
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.area.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-80px)] overflow-hidden relative">
      {/* Sidebar - Search & List */}
      <div className="w-full md:w-96 lg:w-[450px] h-full bg-white/70 backdrop-blur-3xl border-r border-gold/10 z-20 flex flex-col shadow-2xl relative">
        {/* Background Decor */}
        <div className="absolute top-0 left-0 w-full h-[600px] bg-gradient-to-b from-rose-quartz/5 to-transparent -z-10 pointer-events-none" />

        <div className="p-10 space-y-8">
          <div className="space-y-2">
            <h1 className="text-5xl font-serif font-black text-slate italic tracking-tighter">Locate <span className="text-gold">Pod.</span></h1>
            <p className="text-[10px] font-black text-slate/40 uppercase tracking-[0.4em]">Active Network Coverage • Mumbai</p>
          </div>

          <div className="relative group">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate/30 group-focus-within:text-gold transition-colors" />
            <input 
              type="text" 
              placeholder="Search by Station or Area..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-silk/50 border border-gold/10 rounded-full py-5 pl-14 pr-6 text-xs font-black uppercase tracking-widest text-slate outline-none focus:ring-4 focus:ring-gold/5 focus:border-gold/30 transition-all shadow-sm"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-10 space-y-4 custom-scrollbar">
          {loading ? (
             <div className="py-20 flex flex-col items-center gap-4">
                <div className="w-10 h-10 border-4 border-gold/10 border-t-gold rounded-full animate-spin" />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate/20">Syncing Network...</span>
             </div>
          ) : filteredMachines.length > 0 ? (
            filteredMachines.map((machine) => (
              <MachineCard 
                key={machine.id} 
                machine={machine} 
                isSelected={selectedMachine?.id === machine.id}
                onClick={() => setSelectedMachine(machine)}
              />
            ))
          ) : (
             <div className="py-20 text-center space-y-4">
                <div className="text-4xl">🔎</div>
                <p className="text-slate/40 font-black uppercase text-[10px] tracking-widest">No active pods found here.</p>
             </div>
          )}
        </div>
      </div>

      {/* Main Map View */}
      <div className="flex-1 relative bg-off-white">
        <MumbaiMap 
          machines={machines} 
          selectedMachine={selectedMachine}
          onSelectMachine={setSelectedMachine}
        />
        
        {/* Floating Quick Stats */}
        <div className="absolute top-8 right-8 z-20 flex items-center gap-4">
           <div className="glass px-6 py-3 border-gold/10 bg-white/80 shadow-xl flex items-center gap-4">
              <div className="flex flex-col items-end">
                 <span className="text-[9px] font-black text-slate/30 uppercase tracking-widest leading-none">Network Strength</span>
                 <span className="text-xs font-black text-slate">Optimal (98%)</span>
              </div>
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
           </div>
        </div>
      </div>

      {/* Map Overlay Specific Modals (Mobile view trigger) */}
      <EmergencyFAB />

      {/* Selected Machine Detail Overlay (Mobile/Overlay) */}
      <AnimatePresence>
        {selectedMachine && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white rounded-t-[3rem] p-10 shadow-[0_-20px_60px_rgba(212,175,55,0.15)] flex flex-col gap-8"
          >
             <div className="w-16 h-1.5 bg-gold/10 rounded-full mx-auto" onClick={() => setSelectedMachine(null)} />
             
             <div className="space-y-2">
                <h3 className="text-3xl font-serif font-black text-slate italic">{selectedMachine.name}</h3>
                <div className="flex items-center gap-2 text-slate-light font-medium text-sm">
                   <MapPin className="w-4 h-4 text-gold" />
                   <span>{selectedMachine.location}</span>
                </div>
             </div>

             <div className="grid grid-cols-2 gap-4">
                <button 
                   onClick={() => window.location.href = `/vend/${selectedMachine.id}`}
                   className="py-5 rounded-full bg-gold text-white font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-2xl shadow-gold/20"
                >
                   <Zap className="w-4 h-4" /> Use Pod
                </button>
                <button 
                   onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${selectedMachine.latitude},${selectedMachine.longitude}`, '_blank')}
                   className="py-5 rounded-full border border-gold/20 text-slate font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2"
                >
                   <Navigation className="w-4 h-4 text-gold" /> Route
                </button>
             </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MachinesPage;

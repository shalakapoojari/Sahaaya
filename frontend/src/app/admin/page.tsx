"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  BarChart3, Users, Package, DollarSign, 
  AlertTriangle, Search, Filter, Plus, 
  MapPin, Clock, MoreHorizontal, X, ArrowRight, Table
} from "lucide-react";
import DashboardCard from "@/components/DashboardCard";
import { apiFetch } from "@/lib/api";
import Link from "next/link";

const AdminPage = () => {
  const [stats, setStats] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [machines, setMachines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  const [filterMachineId, setFilterMachineId] = useState<string>("all");
  const [isAddPodOpen, setIsAddPodOpen] = useState(false);
  const [newPodData, setNewPodData] = useState({
     name: "", location: "", area: "", latitude: "", longitude: "", status: "active", is_free_zone: false
  });

  useEffect(() => {
    fetchData();
  }, [filterMachineId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [statsData, machinesData] = await Promise.all([
        apiFetch("/api/admin/stats"),
        apiFetch("/api/machines")
      ]);
      setStats(statsData);
      setMachines(machinesData);

      // Fetch transactions with filter
      let txnEndpoint = "/api/transactions";
      if (filterMachineId !== "all") {
        txnEndpoint += `?machine_id=${filterMachineId}`;
      }
      const txnsData = await apiFetch(txnEndpoint);
      setTransactions(txnsData.transactions);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddPod = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch("/api/machines", {
        method: "POST",
        body: JSON.stringify(newPodData)
      });
      setIsAddPodOpen(false);
      fetchData(); // Refresh
      setNewPodData({ name: "", location: "", area: "", latitude: "", longitude: "", status: "active", is_free_zone: false });
    } catch (err: any) {
      alert("Error adding pod: " + err.message);
    }
  };

  if (loading && !stats) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-20 bg-off-white">
         <div className="w-12 h-12 border-4 border-gold/10 border-t-gold rounded-full animate-spin mb-4" />
         <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate/40">Securing Admin Session...</span>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 md:p-12 space-y-12 max-w-7xl mx-auto">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-8">
        <div className="space-y-1">
           <h1 className="text-5xl font-serif font-black text-slate tracking-tighter">Command <span className="text-gold italic font-medium">Boutique.</span></h1>
           <p className="text-slate/40 font-black text-[10px] uppercase tracking-[0.4em]">Administrative Insights • Active Session</p>
        </div>
        
        <div className="flex items-center gap-4">
           <button 
             onClick={() => setIsAddPodOpen(true)}
             className="flex items-center gap-3 px-8 py-4 rounded-full bg-slate text-white font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-slate/20 hover:scale-105 active:scale-95 transition-all"
           >
              <Plus className="w-4 h-4 text-gold" /> Add New Pod
           </button>
        </div>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        <DashboardCard 
          title="Total Revenue" 
          value={`₹${stats?.overview?.total_revenue?.toLocaleString() || '0'}`}
          icon={<DollarSign className="w-6 h-6 text-gold" />}
          trend={{ value: "Ethereal Growth", isUp: true }}
          color="bg-gold/5"
        />
        <DashboardCard 
          title="Active Network" 
          value={stats?.overview?.active_machines || '0'}
          icon={<Package className="w-6 h-6 text-gold" />}
          trend={{ value: "Healthy", isUp: true }}
          color="bg-gold/5"
        />
        <DashboardCard 
          title="User Base" 
          value="1.2k"
          icon={<Users className="w-6 h-6 text-gold" />}
          trend={{ value: "Rising", isUp: true }}
          color="bg-gold/5"
        />
        <DashboardCard 
          title="Live Sessions" 
          value="24"
          icon={<Clock className="w-6 h-6 text-gold" />}
          trend={{ value: "Stable", isUp: true }}
          color="bg-gold/5"
        />
      </div>

      {/* Main Content: Orders View */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
         {/* Order Management Table */}
         <div className="lg:col-span-3 space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
               <h2 className="text-3xl font-serif font-black text-slate">Live <span className="text-gold italic font-medium">Orders.</span></h2>
               
               <div className="flex items-center gap-4 bg-white/60 p-2 rounded-2xl border border-gold/10">
                  <div className="text-[10px] font-black text-slate/30 uppercase tracking-widest pl-4">Filter:</div>
                  <select 
                    value={filterMachineId}
                    onChange={(e) => setFilterMachineId(e.target.value)}
                    className="bg-transparent border-none text-[10px] font-black uppercase tracking-widest text-slate outline-none cursor-pointer pr-4"
                  >
                     <option value="all">Everywhere</option>
                     {machines.map((m: any) => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                     ))}
                  </select>
               </div>
            </div>

            <div className="glass overflow-hidden border-gold/10">
               <table className="w-full text-left">
                  <thead className="bg-silk/50">
                     <tr>
                        <th className="px-8 py-5 text-[10px] font-black text-slate/30 uppercase tracking-[0.2em]">Transaction ID</th>
                        <th className="px-8 py-5 text-[10px] font-black text-slate/30 uppercase tracking-[0.2em]">Product</th>
                        <th className="px-8 py-5 text-[10px] font-black text-slate/30 uppercase tracking-[0.2em]">Location</th>
                        <th className="px-8 py-5 text-[10px] font-black text-slate/30 uppercase tracking-[0.2em]">Amount</th>
                        <th className="px-8 py-5 text-[10px] font-black text-slate/30 uppercase tracking-[0.2em]">Time</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-gold/10">
                     {transactions.map((t: any) => (
                        <tr key={t.id} className="group hover:bg-gold/5 transition-colors">
                           <td className="px-8 py-6 font-mono text-xs text-slate/60">{t.transaction_id}</td>
                           <td className="px-8 py-6">
                              <div className="flex items-center gap-3">
                                 <span className="text-lg">🌸</span>
                                 <span className="text-sm font-black text-slate">{t.product_name}</span>
                              </div>
                           </td>
                           <td className="px-8 py-6">
                              <span className="text-xs font-bold text-slate/60">{t.machine_name}</span>
                           </td>
                           <td className="px-8 py-6">
                              <span className="text-sm font-black text-gold">₹{t.amount}</span>
                           </td>
                           <td className="px-8 py-6">
                              <span className="text-xs font-medium text-slate-light">{new Date(t.timestamp).toLocaleTimeString()}</span>
                           </td>
                        </tr>
                     ))}
                     {transactions.length === 0 && (
                        <tr>
                           <td colSpan={5} className="px-8 py-20 text-center text-slate/30 italic text-sm font-medium">No order activity detected...</td>
                        </tr>
                     )}
                  </tbody>
               </table>
            </div>
         </div>
      </div>

      {/* Add Pod Modal */}
      <AnimatePresence>
         {isAddPodOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
               <motion.div 
                 initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                 className="absolute inset-0 bg-white/80 backdrop-blur-3xl" 
                 onClick={() => setIsAddPodOpen(false)}
               />
               <motion.div 
                 initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                 className="relative w-full max-w-xl glass p-12 space-y-10 border-gold/20 shadow-3xl shadow-gold/10"
               >
                  <div className="text-center space-y-2">
                     <h2 className="text-4xl font-serif font-black text-slate italic tracking-tighter">Manifest New <span className="text-gold">Pod.</span></h2>
                     <p className="text-[10px] font-black text-slate/30 uppercase tracking-[0.4em]">Register Unit to Network</p>
                  </div>

                  <form onSubmit={handleAddPod} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     <div className="space-y-2 col-span-2">
                        <label className="text-[10px] font-black text-slate-light uppercase tracking-widest pl-2">Machine Name</label>
                        <input required type="text" placeholder="e.g. CST Station Pod #09" 
                          value={newPodData.name} onChange={(e) => setNewPodData({...newPodData, name: e.target.value})}
                          className="w-full bg-silk/50 border border-gold/10 rounded-2xl py-4 px-6 text-sm font-medium focus:ring-2 focus:ring-gold/30 outline-none" />
                     </div>
                     <div className="space-y-2 col-span-2">
                        <label className="text-[10px] font-black text-slate-light uppercase tracking-widest pl-2">Exact Location</label>
                        <input required type="text" placeholder="Platform 1, Near Waiting Room" 
                          value={newPodData.location} onChange={(e) => setNewPodData({...newPodData, location: e.target.value})}
                          className="w-full bg-silk/50 border border-gold/10 rounded-2xl py-4 px-6 text-sm font-medium focus:ring-2 focus:ring-gold/30 outline-none" />
                     </div>
                     <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-light uppercase tracking-widest pl-2">Latitude</label>
                        <input required type="text" placeholder="18.9402" 
                          value={newPodData.latitude} onChange={(e) => setNewPodData({...newPodData, latitude: e.target.value})}
                          className="w-full bg-silk/50 border border-gold/10 rounded-2xl py-4 px-6 text-sm font-medium focus:ring-2 focus:ring-gold/30 outline-none" />
                     </div>
                     <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-light uppercase tracking-widest pl-2">Longitude</label>
                        <input required type="text" placeholder="72.8355" 
                          value={newPodData.longitude} onChange={(e) => setNewPodData({...newPodData, longitude: e.target.value})}
                          className="w-full bg-silk/50 border border-gold/10 rounded-2xl py-4 px-6 text-sm font-medium focus:ring-2 focus:ring-gold/30 outline-none" />
                     </div>
                     
                     <div className="col-span-2 pt-6">
                        <button type="submit" className="w-full py-5 rounded-full bg-gold text-white font-black text-xs uppercase tracking-[0.3em] shadow-2xl hover:scale-105 transition-all">
                           Publish Unit to Network
                        </button>
                     </div>
                  </form>

                  <button 
                    onClick={() => setIsAddPodOpen(false)}
                    className="absolute top-8 right-8 text-slate/20 hover:text-slate transition-colors"
                  >
                     <X className="w-6 h-6" />
                  </button>
               </motion.div>
            </div>
         )}
      </AnimatePresence>
    </div>
  );
};

export default AdminPage;

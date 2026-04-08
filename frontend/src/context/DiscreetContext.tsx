"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

interface DiscreetContextType {
  isDiscreet: boolean;
  toggleDiscreet: () => void;
  translate: (text: string) => string;
}

const DiscreetContext = createContext<DiscreetContextType | undefined>(undefined);

export const DiscreetProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDiscreet, setIsDiscreet] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("sahayaa_discreet");
    if (saved === "true") setIsDiscreet(true);
  }, []);

  const toggleDiscreet = () => {
    const next = !isDiscreet;
    setIsDiscreet(next);
    localStorage.setItem("sahayaa_discreet", String(next));
  };

  const translate = (text: string) => {
    if (!isDiscreet) return text;
    
    const map: Record<string, string> = {
      "Sanitary Pad": "Essential Product",
      "Pad": "Unit",
      "Menstrual": "Wellness",
      "Vending Pod": "Smart Access Point",
      "Find a Pad": "Request Unit",
      "Regular Pad": "Standard Unit",
      "Super Pad": "High Capacity Unit",
      "Overnight Pad": "Extended Unit",
      "Organic Pad": "Premium Organic Unit",
    };

    return map[text] || text;
  };

  return (
    <DiscreetContext.Provider value={{ isDiscreet, toggleDiscreet, translate }}>
      {children}
    </DiscreetContext.Provider>
  );
};

export const useDiscreet = () => {
  const context = useContext(DiscreetContext);
  if (!context) throw new Error("useDiscreet must be used within a DiscreetProvider");
  return context;
};

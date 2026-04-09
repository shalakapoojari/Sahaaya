import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/context/language-context';
import { Globe, ArrowRight, Sparkles } from 'lucide-react';

const LanguageSelector: React.FC = () => {
  const { language, setLanguage, isHydrated } = useLanguage();
  const [showSelector, setShowSelector] = useState(false);

  useEffect(() => {
    if (isHydrated) {
      const savedLang = localStorage.getItem('sh_language');
      if (!savedLang) {
        setShowSelector(true);
      }
    }
  }, [isHydrated]);

  const languages = [
    { code: 'en', name: 'English', native: 'English', icon: '🇺🇸' },
    { code: 'hi', name: 'Hindi', native: 'हिन्दी', icon: '🇮🇳' },
    { code: 'mr', name: 'Marathi', native: 'मराठी', icon: '🚩' }
  ] as const;

  const handleSelect = (code: 'en' | 'hi' | 'mr') => {
    setLanguage(code);
    setShowSelector(false);
  };

  if (!isHydrated) return null;

  return (
    <>
      <AnimatePresence>
        {showSelector && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[5000] flex items-center justify-center bg-surface overflow-hidden"
          >
            {/* Background Aesthetics */}
            <div className="absolute inset-0 pointer-events-none -z-10">
              <div className="absolute top-[-10%] left-[-5%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-3xl animate-pulse" />
              <div className="absolute bottom-[-5%] right-[-10%] w-[50%] h-[50%] rounded-full bg-secondary/5 blur-3xl rotate-45 animate-pulse" />
            </div>

            <div className="max-w-4xl w-full px-6 flex flex-col items-center space-y-16">
              <div className="text-center space-y-6">
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center text-primary mx-auto shadow-xl border border-primary/10"
                >
                  <Globe className="w-10 h-10" />
                </motion.div>
                
                <div className="space-y-4">
                  <h1 className="text-5xl md:text-7xl font-serif font-black text-primary tracking-tighter leading-tight">
                    Welcome to <span className="italic text-secondary">Sahaaya.</span>
                  </h1>
                  <p className="text-sm font-black uppercase tracking-[0.4em] text-primary/40">Select Your Preferred Language</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full">
                {languages.map((lang, idx) => (
                  <motion.div
                    key={lang.code}
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.4 + idx * 0.1 }}
                    onClick={() => handleSelect(lang.code)}
                    className="group relative cursor-pointer"
                  >
                    <div className="fanned-card bg-white p-10 border border-primary/10 shadow-xl transition-all group-hover:shadow-2xl group-hover:-translate-y-2 flex flex-col items-center text-center space-y-6">
                      <div className="text-5xl group-hover:scale-110 transition-transform">{lang.icon}</div>
                      <div className="space-y-1">
                        <h3 className="text-3xl font-serif font-black text-primary">{lang.native}</h3>
                        <p className="text-[10px] font-black uppercase tracking-widest text-primary/40">{lang.name}</p>
                      </div>
                      <div className="w-12 h-12 rounded-full border border-primary/10 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all">
                        <ArrowRight className="w-5 h-5" />
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}
                className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-primary/30"
              >
                <Sparkles className="w-4 h-4 text-secondary/30" /> Care, delivered naturally.
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!showSelector && (
        <button
          onClick={() => setShowSelector(true)}
          className="fixed bottom-10 right-10 z-[1001] p-4 rounded-full glass border-primary/20 text-primary shadow-2xl hover:bg-primary hover:text-white transition-all group"
        >
          <Globe className="w-6 h-6 group-hover:rotate-12 transition-transform" />
        </button>
      )}
    </>
  );
};

export default LanguageSelector;

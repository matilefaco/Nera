import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Download, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Check if user dismissed it recently (30 days)
    const lastDismissed = localStorage.getItem('nera_pwa_dismissed');
    if (lastDismissed) {
      const dismissDate = new Date(lastDismissed);
      const now = new Date();
      const diffDays = Math.ceil(Math.abs(now.getTime() - dismissDate.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays < 30) return;
    }

    const handler = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Update UI notify the user they can install the PWA
      setShowBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // If app is already installed, this won't fire often, 
    // but we can also check if it's already in standalone mode
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setShowBanner(false);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
      setShowBanner(false);
    } else {
      console.log('User dismissed the install prompt');
    }

    // We've used the prompt, and can't use it again, so clear it
    setDeferredPrompt(null);
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowBanner(false);
    localStorage.setItem('nera_pwa_dismissed', new Date().toISOString());
  };

  if (!showBanner) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="fixed bottom-24 left-6 right-6 z-50 md:left-auto md:right-12 md:w-80"
      >
        <div 
          onClick={handleInstallClick}
          className="bg-brand-ink text-brand-white p-5 rounded-[28px] shadow-2xl border border-brand-mist/20 flex items-center justify-between gap-4 cursor-pointer group"
        >
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-brand-terracotta rounded-full flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
              <Download size={20} />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-widest leading-none mb-1">Instalar Nera</p>
              <p className="text-[10px] text-brand-mist font-light italic truncate">Acesse mais rápido pelo seu celular →</p>
            </div>
          </div>
          <button 
            onClick={handleDismiss}
            className="p-2 text-brand-white/40 hover:text-white hover:bg-white/10 rounded-full transition-all"
          >
            <X size={16} />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

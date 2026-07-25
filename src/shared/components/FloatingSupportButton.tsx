import React, { useState, useEffect } from "react";
import { m, AnimatePresence } from "framer-motion";
import { MessageCircle, Phone, X, Headset } from "lucide-react";

const playSound = () => {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
    oscillator.frequency.setValueAtTime(880, audioCtx.currentTime + 0.1); // A5
    
    gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.1, audioCtx.currentTime + 0.05);
    gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.1);
    gainNode.gain.linearRampToValueAtTime(0.1, audioCtx.currentTime + 0.15);
    gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.2);

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.2);
  } catch (e) {
    console.error("Audio playback failed", e);
  }
};

export const FloatingSupportButton = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    // Show tooltip after a few seconds
    const timer = setTimeout(() => {
      setShowTooltip(true);
      playSound();
      setTimeout(() => setShowTooltip(false), 8000);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  const handleToggle = () => {
    if (!isOpen) {
      playSound();
    }
    setIsOpen(!isOpen);
    setShowTooltip(false);
  };

  const whatsappNumber = "+1234567890"; // Replace with actual WhatsApp number
  const phoneNumber = "+1234567890";     // Replace with actual phone number

  return (
    <div className="fixed bottom-24 md:bottom-6 right-6 z-[100] flex flex-col items-end">
      <AnimatePresence>
        {isOpen && (
          <m.div
            initial={{ opacity: 0, y: 20, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.8 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
            className="mb-4 flex flex-col gap-3"
          >
            <m.a
              href={`https://wa.me/${whatsappNumber}`}
              target="_blank"
              rel="noopener noreferrer"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-3 rounded-full bg-[#25D366] px-5 py-3 text-white shadow-lg transition-colors hover:bg-[#128C7E]"
            >
              <MessageCircle size={22} />
              <span className="font-semibold text-sm">WhatsApp</span>
            </m.a>
            <m.a
              href={`tel:${phoneNumber}`}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-3 rounded-full bg-blue-600 px-5 py-3 text-white shadow-lg transition-colors hover:bg-blue-700"
            >
              <Phone size={22} />
              <span className="font-semibold text-sm">Direct Call</span>
            </m.a>
          </m.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showTooltip && !isOpen && (
          <m.div
            initial={{ opacity: 0, x: 20, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 20, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
            className="absolute bottom-16 right-0 mb-4 w-[240px] rounded-2xl bg-white p-4 shadow-2xl dark:bg-slate-800 border border-slate-100 dark:border-slate-700"
          >
            <div className="flex flex-col items-center gap-2 text-center">
              <m.span 
                animate={{ rotate: [0, 20, -20, 20, -20, 0] }}
                transition={{ repeat: Infinity, duration: 2, repeatDelay: 1 }}
                className="text-4xl inline-block origin-bottom"
              >
                👋
              </m.span>
              <p className="font-medium text-slate-700 dark:text-slate-200 text-sm">
                Have any issues?
                <br />
                <span className="text-slate-500 text-xs font-normal">We're here to help!</span>
              </p>
            </div>
            {/* Triangle pointer */}
            <div className="absolute -bottom-2 right-6 h-4 w-4 rotate-45 border-b border-r border-slate-100 bg-white dark:border-slate-700 dark:bg-slate-800" />
          </m.div>
        )}
      </AnimatePresence>

      <m.button
        onClick={handleToggle}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-2xl transition-all hover:bg-primary/90 hover:shadow-primary/30"
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <m.div
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <X size={26} />
            </m.div>
          ) : (
            <m.div
              key="help"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <Headset size={26} />
            </m.div>
          )}
        </AnimatePresence>
      </m.button>
    </div>
  );
};

import { useState, useEffect } from "react";
import { toast } from "sonner";

const STORAGE_KEY = "linkup_sound_enabled";

export function useSoundSettings() {
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    return localStorage.getItem(STORAGE_KEY) === "true";
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(soundEnabled));
  }, [soundEnabled]);

  const toggleSound = () => {
    setSoundEnabled(prev => {
      const newState = !prev;
      
      if (newState) {
        // Play a silent or very brief sound immediately to unlock AudioContext
        try {
          const audio = new Audio("/notification.mp3");
          audio.volume = 0.01; // extremely low volume just to unlock
          const playPromise = audio.play();
          
          if (playPromise !== undefined) {
            playPromise.catch(error => {
              console.warn("Failed to unlock audio context:", error);
            });
          }
          toast.success("Notification sounds enabled!");
        } catch (e) {
          console.error("Audio unlock error", e);
        }
      } else {
        toast.info("Notification sounds muted");
      }
      
      return newState;
    });
  };

  return { soundEnabled, toggleSound };
}

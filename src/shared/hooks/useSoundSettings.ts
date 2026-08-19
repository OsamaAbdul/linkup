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

export const playNotificationSound = () => {
    try {
        if (localStorage.getItem("linkup_sound_enabled") === "true") {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            if (AudioContextClass) {
                const audioCtx = new AudioContextClass();
                const audioElement = new Audio("/sounds/notification.mp3");
                const track = audioCtx.createMediaElementSource(audioElement);
                
                const gainNode = audioCtx.createGain();
                gainNode.gain.value = 2.0; // 200% volume
                
                track.connect(gainNode).connect(audioCtx.destination);
                audioElement.play().catch(() => {});
            } else {
                // Fallback for older browsers
                const audio = new Audio("/sounds/notification.mp3");
                audio.volume = 1.0;
                audio.play().catch(() => {});
            }
        }
    } catch { }
};

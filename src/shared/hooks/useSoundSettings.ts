import { useState, useEffect } from "react";
import { toast } from "sonner";

const STORAGE_KEY = "linkup_sound_enabled";

let audioCtx: AudioContext | null = null;
let gainNode: GainNode | null = null;
let audioElement: HTMLAudioElement | null = null;

const initAudio = () => {
  if (audioCtx || audioElement) return;
  
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
      audioElement = new Audio("/sounds/notification.mp3");
      audioElement.crossOrigin = "anonymous";
      
      const track = audioCtx.createMediaElementSource(audioElement);
      gainNode = audioCtx.createGain();
      gainNode.gain.value = 2.0; // 200% volume
      
      track.connect(gainNode).connect(audioCtx.destination);
    } else {
      // Fallback for older browsers
      audioElement = new Audio("/sounds/notification.mp3");
      audioElement.volume = 1.0;
    }
  } catch (error) {
    console.warn("Failed to initialize audio:", error);
  }
};

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
        initAudio();
        
        if (audioCtx && audioCtx.state === 'suspended') {
          audioCtx.resume().catch(e => console.warn("Failed to resume audio context:", e));
        }

        if (audioElement) {
          audioElement.currentTime = 0;
          audioElement.play().catch(error => {
            console.warn("Failed to play audio:", error);
          });
        }
        
        toast.success("Notification sounds enabled!");
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
    if (localStorage.getItem(STORAGE_KEY) === "true") {
      initAudio();
      
      if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
      }
      
      if (audioElement) {
        audioElement.currentTime = 0;
        audioElement.play().catch(() => {});
      }
    }
  } catch { }
};

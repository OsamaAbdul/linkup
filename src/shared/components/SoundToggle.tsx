import { Volume2, VolumeX } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { useSoundSettings } from "@/shared/hooks/useSoundSettings";
import { cn } from "@/lib/utils";

interface SoundToggleProps {
  className?: string;
  showLabel?: boolean;
}

export function SoundToggle({ className, showLabel = false }: SoundToggleProps) {
  const { soundEnabled, toggleSound } = useSoundSettings();

  return (
    <Button
      variant="ghost"
      size={showLabel ? "default" : "icon"}
      onClick={toggleSound}
      className={cn(
        "rounded-xl transition-all",
        soundEnabled ? "text-primary hover:bg-primary/10" : "text-muted-foreground hover:bg-muted/50",
        showLabel && "justify-start px-3 py-3 w-full",
        className
      )}
      title={soundEnabled ? "Mute notification sounds" : "Enable notification sounds"}
    >
      {soundEnabled ? (
        <Volume2 size={20} className={showLabel ? "mr-3 h-4 w-4" : ""} />
      ) : (
        <VolumeX size={20} className={showLabel ? "mr-3 h-4 w-4" : ""} />
      )}
      {showLabel && (
        <span className="font-semibold">
          {soundEnabled ? "Sound: On" : "Sound: Off"}
        </span>
      )}
    </Button>
  );
}

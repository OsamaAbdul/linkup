import { Button } from "@/shared/components/ui/button";
import { Download, Share } from "lucide-react";
import { usePWA } from "@/shared/hooks/use-pwa";
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";
import { cn } from "@/lib/utils";

export function InstallAppButton({ className, variant = "default" }: { className?: string, variant?: "default" | "outline" | "ghost" }) {
  const { isInstallable, promptInstall, isIOS, isStandalone } = usePWA();
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);

  // If already installed or unsupported and not iOS, don't show the button
  if (isStandalone) return null;
  if (!isInstallable && !isIOS) return null; 

  const handleInstallClick = () => {
    if (isInstallable) {
      promptInstall();
    } else if (isIOS) {
      setShowIOSPrompt(true);
    }
  };

  return (
    <>
      <Button variant={variant} className={cn("gap-2", className)} onClick={handleInstallClick}>
        <Download className="w-4 h-4" />
        <span className="font-semibold">Install App</span>
      </Button>

      {/* iOS Instructions Modal */}
      <Dialog open={showIOSPrompt} onOpenChange={setShowIOSPrompt}>
        <DialogContent className="sm:max-w-md border-border rounded-xl">
          <DialogHeader>
            <DialogTitle className="font-heading font-black">Install on iOS</DialogTitle>
            <DialogDescription>
              To install the Linkup app on your iPhone or iPad, follow these quick steps:
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-5 py-4">
            <div className="flex items-center gap-4">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black shrink-0">1</div>
              <p className="text-sm">Tap the <strong>Share</strong> button <Share className="inline w-4 h-4 mx-1" /> at the bottom of your Safari screen.</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black shrink-0">2</div>
              <p className="text-sm">Scroll down and tap <strong>Add to Home Screen</strong>.</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black shrink-0">3</div>
              <p className="text-sm">Tap <strong>Add</strong> in the top right corner.</p>
            </div>
          </div>
          <div className="mt-2 text-xs text-muted-foreground bg-primary/5 p-3 rounded-lg border border-primary/10">
            Installing the app gives you a better experience, offline capabilities, and instant access from your home screen.
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

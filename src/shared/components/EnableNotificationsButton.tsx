import { Button } from "@/shared/components/ui/button";
import { BellRing } from "lucide-react";
import { usePushNotifications } from "@/shared/hooks/usePushNotifications";
import { cn } from "@/lib/utils";

export function EnableNotificationsButton({ className, variant = "default" }: { className?: string, variant?: "default" | "outline" | "ghost" }) {
  const { isSupported, permission, subscribe } = usePushNotifications();

  // Hide if not supported or already granted/denied
  if (!isSupported || permission !== 'default') return null;

  return (
    <Button 
      variant={variant} 
      className={cn("gap-2", className)} 
      onClick={() => subscribe()}
    >
      <BellRing className="w-4 h-4" />
      <span className="font-semibold">Enable Notifications</span>
    </Button>
  );
}
